import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  DialogueLine,
  PipelineStage,
  ProjectState,
  StageStatus,
  StoryboardBeat,
  SubtitleCue,
} from './src/types/storyboard';
import { STYLE_OPTIONS } from './src/data/initialProject';
import { splitTextIntoTwoLineCues } from './src/utils/validation';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(os.tmpdir(), 'festival_stand_exports');
const WORK_DIR = path.join(os.tmpdir(), 'festival_stand_work');
const TTS_CACHE_DIR = path.join(os.tmpdir(), 'festival_stand_tts_cache');
fs.mkdirSync(EXPORT_DIR, { recursive: true });
fs.mkdirSync(WORK_DIR, { recursive: true });
fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY가 설정되어 있지 않습니다. Settings > Secrets 패널에서 API 키를 확인해 주세요.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function checkFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function verifyMp4Capabilities(): Promise<void> {
  let encodersOut = '';
  let filtersOut = '';
  try {
    encodersOut = (await execFileAsync('ffmpeg', ['-hide_banner', '-encoders'])).stdout;
    filtersOut = (await execFileAsync('ffmpeg', ['-hide_banner', '-filters'])).stdout;
  } catch {
    throw new Error(
      'MP4 내보내기에 필요한 ffmpeg 및 ffprobe가 서버 환경에 설치되어 있지 않습니다. ffmpeg(libx264, aac, libass 지원)를 설치해 주세요.'
    );
  }
  if (!encodersOut.includes('libx264') || !encodersOut.includes('aac')) {
    throw new Error(
      '현재 ffmpeg 환경에서 H.264(libx264) 또는 AAC(aac) 인코더를 사용할 수 없어 MP4 내보내기를 완료할 수 없습니다.'
    );
  }
  if (!filtersOut.includes(' ass ')) {
    throw new Error(
      '현재 ffmpeg 환경에서 libass 자막 번인 필터(ass)를 지원하지 않아 자막 합성을 완료할 수 없습니다.'
    );
  }
}

function wrapPcm16ToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const val = parseFloat(stdout.trim());
  return Number.isFinite(val) ? val : 0;
}

function formatAssTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.min(99, Math.round((clamped - Math.floor(clamped)) * 100));
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

function resolveBeatImagePath(beat: StoryboardBeat, targetPath: string): string {
  if (beat.customImageBase64 && beat.customImageBase64.startsWith('data:image/')) {
    const match = beat.customImageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const out = `${targetPath}.${ext}`;
      fs.writeFileSync(out, Buffer.from(match[2], 'base64'));
      return out;
    }
  }

  if (beat.imageUrl && beat.imageUrl.startsWith('/src/assets/images/')) {
    const safeName = path.basename(beat.imageUrl);
    const localPath = path.resolve(__dirname, 'src', 'assets', 'images', safeName);
    if (fs.existsSync(localPath)) {
      return localPath;
    }
  }

  if (beat.imageUrl && beat.imageUrl.startsWith('/api/generated-images/')) {
    const safeName = path.basename(beat.imageUrl);
    const tmpPath = path.join(EXPORT_DIR, safeName);
    if (fs.existsSync(tmpPath)) {
      return tmpPath;
    }
  }

  throw new Error(`장면(${beat.label})의 이미지 파일을 찾을 수 없습니다.`);
}

function isPaidKeyOrQuotaError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
  return (
    msg.includes('permission_denied') ||
    msg.includes('403') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('paid') ||
    msg.includes('billing') ||
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('quota')
  );
}

function buildStaticVideoScaleFilter(inputLabel: string, outputLabel: string): string {
  // Crisp, completely stationary 1280x720 30fps Lanczos frame (zero zoom/pan jitter)
  return `${inputLabel}scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720,setsar=1,fps=30,settb=AVTB,format=yuv420p${outputLabel}`;
}

const ttsCooldownUntil: Record<string, number> = {};

async function generateLineTtsWav(
  aiBeta: GoogleGenAI,
  line: DialogueLine,
  outWavPath: string,
  brisk = false
): Promise<number> {
  const voiceName = line.speaker === 'A' ? 'Kore' : 'Puck';
  const cleanText = line.text.trim();
  const promptText = brisk
    ? `Speak clearly at a brisk, slightly faster natural conversational pace: ${cleanText}`
    : cleanText;
  const cacheKey = crypto
    .createHash('sha256')
    .update(`${voiceName}:${brisk ? 'brisk:' : ''}${cleanText}`)
    .digest('hex')
    .slice(0, 24);
  const cachePath = path.join(TTS_CACHE_DIR, `${cacheKey}.wav`);

  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 44) {
    fs.copyFileSync(cachePath, outWavPath);
    return probeDuration(outWavPath);
  }

  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] as const;
  let lastError: unknown;

  for (const model of ttsModels) {
    if ((ttsCooldownUntil[model] || 0) > Date.now()) {
      continue;
    }
    try {
      const response = await aiBeta.models.generateContent({
        model,
        contents: promptText,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const inlinePart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlinePart?.data;
      if (!base64Audio) {
        throw new Error(`음성 생성 결과가 비어 있습니다: "${cleanText}"`);
      }

      const rawBuf = Buffer.from(base64Audio, 'base64');
      const mime = (inlinePart?.mimeType || 'audio/wav').toLowerCase();
      const isRiffWav = rawBuf.length >= 4 && rawBuf.subarray(0, 4).toString('ascii') === 'RIFF';

      let wavBuf: Buffer = rawBuf;
      if (!isRiffWav || mime.includes('l16') || mime.includes('pcm')) {
        const rateMatch = mime.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
        wavBuf = wrapPcm16ToWav(rawBuf, sampleRate, 1);
      }

      fs.writeFileSync(cachePath, wavBuf);
      fs.writeFileSync(outWavPath, wavBuf);
      return probeDuration(outWavPath);
    } catch (err) {
      lastError = err;
      const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
      if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
        ttsCooldownUntil[model] = Date.now() + 5 * 60 * 1000;
        continue;
      }
      throw err;
    }
  }

  const finalMsg = String((lastError as { message?: string })?.message || lastError || '');
  if (
    finalMsg.toLowerCase().includes('429') ||
    finalMsg.toLowerCase().includes('resource_exhausted') ||
    finalMsg.toLowerCase().includes('quota')
  ) {
    throw new Error(
      '무료 API 등급의 일일 TTS 음성 생성 한도(모델당 하루 10회)를 초과했습니다. 잠시 후 다시 시도하거나 Settings > Secrets에서 유료 API 키를 연결해 주세요.'
    );
  }
  throw lastError instanceof Error ? lastError : new Error(finalMsg);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', async (_req, res) => {
    const ffmpegAvailable = await checkFfmpeg();
    const hasApiKey = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({ ok: true, hasApiKey, ffmpegAvailable });
  });

  app.get('/api/generated-images/:filename', (req, res) => {
    const safe = path.basename(req.params.filename);
    const full = path.join(EXPORT_DIR, safe);
    if (!fs.existsSync(full)) {
      res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
      return;
    }
    res.sendFile(full);
  });

  app.get('/api/exports/:filename', (req, res) => {
    const safe = path.basename(req.params.filename);
    const full = path.join(EXPORT_DIR, safe);
    if (!fs.existsSync(full)) {
      res.status(404).json({ error: '내보낸 영상 파일을 찾을 수 없습니다.' });
      return;
    }
    if (req.query.download === '1') {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="festival_stand_30s.mp4"'
      );
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.sendFile(full);
  });

  // F5: Regenerate a single storyboard beat without altering other beats
  app.post('/api/regenerate-beat', async (req, res) => {
    try {
      const {
        project,
        beatIndex,
        instruction,
      }: { project: ProjectState; beatIndex: number; instruction?: string } = req.body;

      if (!project || !Array.isArray(project.beats) || !project.beats[beatIndex]) {
        res.status(400).json({ error: '유효하지 않은 장면 번호입니다.' });
        return;
      }

      const targetBeat = project.beats[beatIndex];
      const otherWords = project.beats.reduce(
        (sum, b, idx) =>
          idx === beatIndex
            ? sum
            : sum +
              b.dialogue.reduce(
                (s, d) => s + (d.text.trim() ? d.text.trim().split(/\s+/).length : 0),
                0
              ),
        0
      );

      const minBeatWords = Math.max(8, 60 - otherWords);
      const maxBeatWords = Math.max(minBeatWords + 4, 70 - otherWords);

      const ai = getAiClient();
      const exprList = project.expressions
        .map((e) => `- "${e.expression}" (${e.meaning} / ${e.movie})`)
        .join('\n');

      const otherBeatsSummary = project.beats
        .map(
          (b, idx) =>
            `Beat ${idx + 1} (${b.startSec}-${b.endSec}s ${b.label})${idx === beatIndex ? ' [REGENERATE THIS ONE ONLY]' : ''}: ${b.sceneDescription} | Dialogue: ${b.dialogue.map((d) => `${d.speaker}: "${d.text}"`).join(' ')}`
        )
        .join('\n');

      const prompt = `You are writing one beat of a 30-second campus English learning animated short.
Project Title: ${project.title}
Setting: ${project.setting}
Characters: ${project.characters}
Situation: ${project.situation}

Full Expression List:
${exprList}

Current 4-beat Storyboard:
${otherBeatsSummary}

Task: Rewrite ONLY Beat ${beatIndex + 1} (${targetBeat.startSec}-${targetBeat.endSec}s, ${targetBeat.label}, duration ${targetBeat.durationSec} seconds).
Target expressions for this beat (must include these exact English phrases verbatim inside the dialogue): ${targetBeat.expressions.join(' | ') || 'pick relevant expressions from the list above'}
Word count target for THIS beat's spoken dialogue: between ${minBeatWords} and ${maxBeatWords} whitespace-separated words (counting contractions as 1 word) so the 4-beat total stays within 60-70 words.
${instruction ? `User creative direction: ${instruction}` : ''}
Rules:
- Keep characters A and B consistent.
- Never put speaker labels inside the spoken "text" field itself (speaker goes in the "speaker" field: "A" or "B").
- Provide natural Korean translations in "sceneDescriptionKo" and each line's "ko".`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sceneDescription: { type: Type.STRING },
              sceneDescriptionKo: { type: Type.STRING },
              dialogue: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING },
                    text: { type: Type.STRING },
                    ko: { type: Type.STRING },
                  },
                  required: ['speaker', 'text', 'ko'],
                },
              },
              expressions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              sourceFilms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'sceneDescription',
              'sceneDescriptionKo',
              'dialogue',
              'expressions',
              'sourceFilms',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const updatedDialogue: DialogueLine[] = (parsed.dialogue || []).map(
        (d: { speaker?: string; text?: string; ko?: string }, i: number) => ({
          id: `${targetBeat.id}-regen-${Date.now()}-${i}`,
          speaker: d.speaker === 'B' ? 'B' : 'A',
          text: String(d.text || '').trim(),
          ko: String(d.ko || '').trim(),
        })
      );

      const updatedBeat: StoryboardBeat = {
        ...targetBeat,
        sceneDescription: parsed.sceneDescription || targetBeat.sceneDescription,
        sceneDescriptionKo: parsed.sceneDescriptionKo || targetBeat.sceneDescriptionKo,
        dialogue: updatedDialogue.length > 0 ? updatedDialogue : targetBeat.dialogue,
        expressions:
          Array.isArray(parsed.expressions) && parsed.expressions.length > 0
            ? parsed.expressions
            : targetBeat.expressions,
        sourceFilms:
          Array.isArray(parsed.sourceFilms) && parsed.sourceFilms.length > 0
            ? parsed.sourceFilms
            : targetBeat.sourceFilms,
      };

      res.json({ beat: updatedBeat });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '장면 재생성 중 오류가 발생했습니다.';
      res.status(500).json({ error: message });
    }
  });

  // Regenerate a beat's visual frame (requires paid key for gemini-3.1-flash-lite-image)
  app.post('/api/generate-image', async (req, res) => {
    try {
      const {
        project,
        beatIndex,
      }: { project: ProjectState; beatIndex: number } = req.body;

      if (!project || !project.beats?.[beatIndex]) {
        res.status(400).json({ error: '유효하지 않은 장면 정보입니다.' });
        return;
      }

      const beat = project.beats[beatIndex];
      const styleInfo =
        STYLE_OPTIONS.find((s) => s.id === project.style) || STYLE_OPTIONS[0];
      const ai = getAiClient();

      const anchorBeat = project.beats.find(
        (b, idx) => idx !== beatIndex && Boolean(b.imageUrl || b.customImageBase64)
      ) || beat;
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      try {
        const refPath = resolveBeatImagePath(
          anchorBeat,
          path.join(WORK_DIR, `ref_${Date.now()}`)
        );
        const refBytes = fs.readFileSync(refPath).toString('base64');
        const refMime = refPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        parts.push({ inlineData: { mimeType: refMime, data: refBytes } });
        if (refPath.startsWith(WORK_DIR)) {
          fs.rmSync(refPath, { force: true });
        }
      } catch {
        // Proceed text-only if no reference file can be read
      }

      const prompt = `${styleInfo.promptStyle}.
Setting: ${project.setting}
Characters: ${project.characters}
Strict character continuity across all beats:
- Character A must keep the exact same face, dark-brown chin-length bob haircut with wispy bangs, cream off-white long-sleeve sweater, bright tangerine-orange bib apron, and blue jeans.
- Character B must keep the exact same face, neat jet-black medium-short parted hair, muted sage-green pullover hoodie with drawstrings, and dark charcoal pants.
- Match the exact art style, faces, outfits, and pastel color palette of the reference image if provided.
Scene action (${beat.label}): ${beat.sceneDescription}
IMPORTANT: Do NOT render any text, letters, captions, logos, or speech bubbles in the image.`;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: '16:9',
          },
        },
      });

      let imageBase64: string | undefined;
      let mimeType = 'image/png';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }

      if (!imageBase64) {
        res.status(500).json({ error: '이미지 생성 응답에 이미지 데이터가 없습니다.' });
        return;
      }

      const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
      const filename = `beat_${beatIndex + 1}_${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(EXPORT_DIR, filename), Buffer.from(imageBase64, 'base64'));

      res.json({ imageUrl: `/api/generated-images/${filename}` });
    } catch (err) {
      const requiresPaid = isPaidKeyOrQuotaError(err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      res.status(requiresPaid ? 403 : 500).json({
        requiresPaidKey: requiresPaid,
        error: requiresPaid
          ? '새 이미지 생성 모델(gemini-3.1-flash-lite-image)은 유료 API 키가 필요합니다. 기존 일러스트를 사용하거나 직접 이미지를 업로드해 주세요.'
          : `이미지 생성 실패: ${rawMsg}`,
      });
    }
  });

  // F6, F7, F8: 5-stage pipeline (images -> speech -> subtitles -> rendering -> export)
  app.post('/api/generate-video', async (req, res) => {
    const jobId = crypto.randomUUID().slice(0, 10);
    const jobDir = path.join(WORK_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const useStream = req.query.stream === '1';
    let currentStage: PipelineStage = 'images';

    const emitStage = (stage: PipelineStage, status: StageStatus, detail?: string) => {
      currentStage = stage;
      if (useStream) {
        res.write(JSON.stringify({ type: 'stage', stage, status, detail }) + '\n');
      }
    };

    if (useStream) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
    }

    try {
      const {
        project,
        modePreference = 'slideshow',
      }: { project: ProjectState; modePreference?: 'slideshow' | 'ai-video' | 'auto' } = req.body;

      if (!project || !Array.isArray(project.beats) || project.beats.length !== 4) {
        throw new Error('스토리보드는 정확히 4개 장면(7s, 8s, 8s, 7s)이어야 합니다.');
      }

      await verifyMp4Capabilities();
      const aiBeta = getAiClient('v1beta');
      const styleInfo =
        STYLE_OPTIONS.find((s) => s.id === project.style) || STYLE_OPTIONS[0];

      // Stage 1: IMAGES
      emitStage('images', 'running', '4개 장면의 원본 일러스트를 확인하고 있습니다.');
      const beatImagePaths = project.beats.map((b, idx) =>
        resolveBeatImagePath(b, path.join(jobDir, `custom_${idx}`))
      );
      emitStage('images', 'done', '4개 장면 이미지 준비 완료');

      // Stage 2: SPEECH
      emitStage('speech', 'running', '두 화자(A·B)의 영어 음성을 생성하고 길이를 측정하고 있습니다.');
      const beatAudioPaths: string[] = [];
      const beatAudioDurations: number[] = [];
      const allCues: SubtitleCue[] = [];
      let globalCursor = 0;

      for (let bIdx = 0; bIdx < project.beats.length; bIdx++) {
        const beat = project.beats[bIdx];
        const targetDur = beat.durationSec;
        const lines = beat.dialogue.filter((d) => d.text.trim().length > 0);

        let rawLineFiles: Array<{
          line: DialogueLine;
          wavPath: string;
          rawDur: number;
        }> = [];

        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const line = lines[lIdx];
          const wavPath = path.join(jobDir, `tts_${bIdx}_${lIdx}.wav`);
          const rawDur = await generateLineTtsWav(aiBeta, line, wavPath, false);
          rawLineFiles.push({ line, wavPath, rawDur });
        }

        const interGap = rawLineFiles.length > 1 ? 0.32 : 0;
        const leadPad = 0.28;
        // Reserve room in Beat 4 so dialogue finishes comfortably before 29.0s credit
        const maxSpeechBudget =
          bIdx === 3 ? Math.max(2.0, targetDur - 1.45) : Math.max(2.0, targetDur - 0.55);
        const availableForVoice =
          maxSpeechBudget - leadPad - interGap * Math.max(0, rawLineFiles.length - 1);

        let totalSpoken = rawLineFiles.reduce((s, r) => s + r.rawDur, 0);

        // If speech exceeds beat budget, first regenerate with a slightly faster natural delivery
        if (totalSpoken > availableForVoice && availableForVoice > 0) {
          const briskLineFiles: typeof rawLineFiles = [];
          for (let lIdx = 0; lIdx < lines.length; lIdx++) {
            const line = lines[lIdx];
            const briskPath = path.join(jobDir, `tts_brisk_${bIdx}_${lIdx}.wav`);
            const briskDur = await generateLineTtsWav(aiBeta, line, briskPath, true);
            briskLineFiles.push({ line, wavPath: briskPath, rawDur: briskDur });
          }
          const briskTotal = briskLineFiles.reduce((s, r) => s + r.rawDur, 0);
          if (briskTotal < totalSpoken) {
            rawLineFiles = briskLineFiles;
            totalSpoken = briskTotal;
          }
        }

        let tempoFactor = 1.0;
        if (totalSpoken > availableForVoice && availableForVoice > 0) {
          tempoFactor = Math.min(1.28, totalSpoken / availableForVoice);
        }

        const adjustedLineFiles: Array<{
          line: DialogueLine;
          wavPath: string;
          dur: number;
        }> = [];

        for (let lIdx = 0; lIdx < rawLineFiles.length; lIdx++) {
          const item = rawLineFiles[lIdx];
          const normPath = path.join(jobDir, `tts_norm_${bIdx}_${lIdx}.wav`);
          const filter =
            tempoFactor > 1.01
              ? `atempo=${tempoFactor.toFixed(3)},aresample=24000,aformat=sample_fmts=s16:channel_layouts=mono`
              : `aresample=24000,aformat=sample_fmts=s16:channel_layouts=mono`;

          await execFileAsync('ffmpeg', [
            '-y',
            '-i',
            item.wavPath,
            '-af',
            filter,
            normPath,
          ]);
          const dur = await probeDuration(normPath);
          adjustedLineFiles.push({ line: item.line, wavPath: normPath, dur });
        }

        const beatWavPath = path.join(jobDir, `beat_audio_${bIdx}.wav`);
        if (adjustedLineFiles.length === 0) {
          await execFileAsync('ffmpeg', [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'anullsrc=r=24000:cl=mono',
            '-t',
            String(targetDur),
            beatWavPath,
          ]);
        } else {
          const inputs: string[] = [];
          const filterParts: string[] = [];
          let streamIdx = 0;

          inputs.push('-f', 'lavfi', '-t', String(leadPad), '-i', 'anullsrc=r=24000:cl=mono');
          filterParts.push(
            `[${streamIdx}:a]aformat=sample_fmts=s16:sample_rates=24000:channel_layouts=mono[a${streamIdx}]`
          );
          streamIdx++;

          let localOffset = leadPad;
          for (let lIdx = 0; lIdx < adjustedLineFiles.length; lIdx++) {
            const adj = adjustedLineFiles[lIdx];
            inputs.push('-i', adj.wavPath);
            filterParts.push(
              `[${streamIdx}:a]aformat=sample_fmts=s16:sample_rates=24000:channel_layouts=mono[a${streamIdx}]`
            );
            streamIdx++;

            const twoLineCues = splitTextIntoTwoLineCues(adj.line.text, 38);
            const weights = twoLineCues.map((linesArr) =>
              Math.max(4, linesArr.join(' ').length)
            );
            const totalW = weights.reduce((s, w) => s + w, 0) || 1;
            let cueCursor = globalCursor + localOffset;

            twoLineCues.forEach((linesArr, cIdx) => {
              const cueDur = (weights[cIdx] / totalW) * adj.dur;
              const startSec = Number(cueCursor.toFixed(2));
              const endSec = Number((cueCursor + cueDur).toFixed(2));
              cueCursor += cueDur;
              allCues.push({
                id: `cue-${bIdx}-${lIdx}-${cIdx}`,
                beatIndex: bIdx,
                speaker: adj.line.speaker,
                startSec,
                endSec,
                lines: linesArr,
                fullText: linesArr.join(' '),
              });
            });

            localOffset += adj.dur;

            if (lIdx < adjustedLineFiles.length - 1) {
              inputs.push('-f', 'lavfi', '-t', String(interGap), '-i', 'anullsrc=r=24000:cl=mono');
              filterParts.push(
                `[${streamIdx}:a]aformat=sample_fmts=s16:sample_rates=24000:channel_layouts=mono[a${streamIdx}]`
              );
              streamIdx++;
              localOffset += interGap;
            }
          }

          const concatRefs = Array.from({ length: streamIdx }, (_, i) => `[a${i}]`).join('');
          filterParts.push(
            `${concatRefs}concat=n=${streamIdx}:v=0:a=1,apad,atrim=duration=${targetDur.toFixed(3)}[outa]`
          );

          await execFileAsync('ffmpeg', [
            '-y',
            ...inputs,
            '-filter_complex',
            filterParts.join(';'),
            '-map',
            '[outa]',
            beatWavPath,
          ]);
        }

        const actualBeatAudioDur = await probeDuration(beatWavPath);
        beatAudioDurations.push(Number(actualBeatAudioDur.toFixed(2)));
        beatAudioPaths.push(beatWavPath);
        globalCursor += targetDur;
      }
      emitStage('speech', 'done', '영어 음성 4구간(7s·8s·8s·7s) 정렬 완료');

      // Stage 3: SUBTITLES
      emitStage('subtitles', 'running', '단어 단위 동기화 자막과 마지막 1초 크레딧을 생성하고 있습니다.');
      const author = (project.authorName || '김세희').trim();
      const creditText = `Made with Google AI Studio · Script by [${author}]`;
      const assPath = path.join(jobDir, 'subtitles.ass');

      // Credit sits cleanly ABOVE bottom 2-line Dialogue subtitles (MarginV=142 vs MarginV=38)
      const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Dialogue,Noto Sans,40,&H00FFFFFF,&H000000FF,&H00181818,&H80000000,-1,0,0,0,100,100,0,0,1,3.2,1.2,2,64,64,38,1
Style: Credit,Noto Sans,25,&H00FFF6EB,&H000000FF,&H00181818,&H80000000,-1,0,0,0,100,100,0,0,1,2.4,1.0,2,48,48,142,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

      const cueLines = allCues.map((cue) => {
        const clampedEnd = Math.min(29.85, cue.endSec);
        const clampedStart = Math.min(clampedEnd - 0.1, cue.startSec);
        const textWithLineBreak = cue.lines
          .slice(0, 2)
          .map(escapeAssText)
          .join('\\N');
        return `Dialogue: 0,${formatAssTime(clampedStart)},${formatAssTime(clampedEnd)},Dialogue,,0,0,0,,${textWithLineBreak}`;
      });

      const creditLine = `Dialogue: 1,${formatAssTime(29.0)},${formatAssTime(30.0)},Credit,,0,0,0,,${escapeAssText(creditText)}`;
      fs.writeFileSync(assPath, assHeader + [...cueLines, creditLine].join('\n') + '\n', 'utf8');
      emitStage('subtitles', 'done', `${allCues.length}개 자막 큐 및 크레딧 구성 완료`);

      // Stage 4: RENDERING
      emitStage(
        'rendering',
        'running',
        modePreference === 'ai-video' || modePreference === 'auto'
          ? 'AI 영상 클립 생성을 시도하고 자막·음성을 합성하고 있습니다.'
          : '4개 고정 장면에 부드러운 페이드 전환을 적용하고 자막·음성을 합성하고 있습니다.'
      );

      let mode: 'ai-video' | 'slideshow-fallback' = 'slideshow-fallback';
      let fallbackReason: string | undefined;
      const clipVideoPaths: string[] = [];

      if (modePreference === 'ai-video' || modePreference === 'auto') {
        const generateSingleAiClip = async (bIdx: number, timeoutMs: number): Promise<string> => {
          const beat = project.beats[bIdx];
          const imgBytes = fs.readFileSync(beatImagePaths[bIdx]).toString('base64');
          const imgMime = beatImagePaths[bIdx].endsWith('.png') ? 'image/png' : 'image/jpeg';

          const interaction = await aiBeta.interactions.create(
            {
              model: 'gemini-omni-1.2-flash',
              api_version: 'v1beta',
              input: [
                {
                  type: 'image',
                  mime_type: imgMime,
                  data: imgBytes,
                },
                {
                  type: 'text',
                  text: `${styleInfo.promptStyle}. ${beat.sceneDescription}. Keep the exact same two characters, faces, hairstyles, outfits, and colors from the input image (${project.characters}; A keeps dark-brown bob hair, cream sweater, and bright orange apron; B keeps neat black hair and sage-green hoodie). Gentle natural character motion. Do not render any text or subtitles in the video.`,
                },
              ],
              background: false,
              store: false,
              stream: false,
              response_format: {
                type: 'video',
                aspect_ratio: '16:9',
                duration: `${beat.durationSec}s`,
                resolution: '720p',
              },
            },
            { timeout: timeoutMs }
          );

          const videoData = interaction.output_video?.data;
          if (!videoData) {
            throw new Error('AI 동영상 클립 데이터가 반환되지 않았습니다.');
          }
          const rawClip = path.join(jobDir, `ai_raw_${bIdx}.mp4`);
          const normClip = path.join(jobDir, `clip_${bIdx}.mp4`);
          fs.writeFileSync(rawClip, Buffer.from(videoData, 'base64'));
          await execFileAsync('ffmpeg', [
            '-y',
            '-i',
            rawClip,
            '-vf',
            'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,format=yuv420p',
            '-t',
            String(beat.durationSec),
            '-an',
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            normClip,
          ]);
          return normClip;
        };

        try {
          const firstClip = await generateSingleAiClip(0, 35000);
          const restClips = await Promise.all([
            generateSingleAiClip(1, 60000),
            generateSingleAiClip(2, 60000),
            generateSingleAiClip(3, 60000),
          ]);
          clipVideoPaths.push(firstClip, ...restClips);
          mode = 'ai-video';
        } catch (aiErr) {
          clipVideoPaths.length = 0;
          mode = 'slideshow-fallback';
          const rawMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
          fallbackReason = isPaidKeyOrQuotaError(aiErr)
            ? 'AI 동영상 생성 모델(gemini-omni-1.2-flash) 사용에 유료 API 키 권한이 필요하여, 흔들림 없는 4장의 고정 장면과 부드러운 페이드 전환 슬라이드쇼로 자동 전환했습니다.'
            : `AI 동영상 클립 생성이 지원되지 않거나 지연되어(${rawMsg.slice(0, 80)}) 흔들림 없는 4장의 고정 장면과 부드러운 페이드 전환 슬라이드쇼로 완성했습니다.`;
        }
      } else {
        fallbackReason =
          '흔들림·확대 없이 고정된 4장의 원본 장면, 장면 전환 시 부드러운 페이드, 영어 TTS 음성, 번인 자막으로 구성된 30초 영상을 완성했습니다.';
      }

      const exportId = `festival_stand_${jobId}`;
      const finalMp4 = path.join(EXPORT_DIR, `${exportId}.mp4`);
      const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

      if (mode === 'slideshow-fallback') {
        const fadeDur = 0.4;
        const halfFade = fadeDur / 2;
        const staticVideoInputs = project.beats.flatMap((beat, idx) => {
          const clipDur =
            idx === 0 || idx === project.beats.length - 1
              ? beat.durationSec + halfFade
              : beat.durationSec + fadeDur;
          return ['-loop', '1', '-framerate', '30', '-t', clipDur.toFixed(3), '-i', beatImagePaths[idx]];
        });
        const concatAudioInputs = beatAudioPaths.flatMap((p) => ['-i', p]);

        const scaleFilters = project.beats.map((_, idx) =>
          buildStaticVideoScaleFilter(`[${idx}:v]`, `[v${idx}]`)
        );

        let cumulativeBoundary = 0;
        const xfadeFilters: string[] = [];
        let prevLabel = '[v0]';
        for (let i = 0; i < project.beats.length - 1; i++) {
          cumulativeBoundary += project.beats[i].durationSec;
          const offset = Number((cumulativeBoundary - halfFade).toFixed(3));
          const nextOut = i === project.beats.length - 2 ? '[vfaded]' : `[vx${i + 1}]`;
          xfadeFilters.push(
            `${prevLabel}[v${i + 1}]xfade=transition=fade:duration=${fadeDur.toFixed(2)}:offset=${offset}${nextOut}`
          );
          prevLabel = nextOut;
        }

        const aRefs = beatAudioPaths
          .map((_, i) => `[${project.beats.length + i}:a]`)
          .join('');
        const filterComplex = [
          ...scaleFilters,
          ...xfadeFilters,
          `[vfaded]ass='${escapedAssPath}'[vout]`,
          `${aRefs}concat=n=4:v=0:a=1[aout]`,
        ].join(';');

        await execFileAsync('ffmpeg', [
          '-y',
          ...staticVideoInputs,
          ...concatAudioInputs,
          '-filter_complex',
          filterComplex,
          '-map',
          '[vout]',
          '-map',
          '[aout]',
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-movflags',
          '+faststart',
          '-t',
          '30.00',
          finalMp4,
        ]);
      } else {
        const concatVideoInputs = clipVideoPaths.flatMap((p) => ['-i', p]);
        const concatAudioInputs = beatAudioPaths.flatMap((p) => ['-i', p]);

        const vRefs = clipVideoPaths.map((_, i) => `[${i}:v]`).join('');
        const aRefs = beatAudioPaths
          .map((_, i) => `[${clipVideoPaths.length + i}:a]`)
          .join('');

        const filterComplex = `${vRefs}concat=n=4:v=1:a=0,ass='${escapedAssPath}'[vout];${aRefs}concat=n=4:v=0:a=1[aout]`;

        await execFileAsync('ffmpeg', [
          '-y',
          ...concatVideoInputs,
          ...concatAudioInputs,
          '-filter_complex',
          filterComplex,
          '-map',
          '[vout]',
          '-map',
          '[aout]',
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-movflags',
          '+faststart',
          '-t',
          '30.00',
          finalMp4,
        ]);
      }
      emitStage('rendering', 'done', '영상·음성·자막 인코딩 완료');

      // Stage 5: EXPORT VERIFICATION
      emitStage('export', 'running', '최종 MP4 파일의 스트림과 30초 길이를 검증하고 있습니다.');
      const { stdout: probeJson } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,codec_name:format=duration',
        '-of',
        'json',
        finalMp4,
      ]);
      const parsedProbe = JSON.parse(probeJson) as {
        streams?: Array<{ codec_type?: string }>;
        format?: { duration?: string };
      };
      const hasVideoStream = parsedProbe.streams?.some((s) => s.codec_type === 'video');
      const hasAudioStream = parsedProbe.streams?.some((s) => s.codec_type === 'audio');
      const actualDurationSec = Number(
        (parseFloat(parsedProbe.format?.duration || '0') || 0).toFixed(2)
      );

      if (!hasVideoStream || !hasAudioStream || actualDurationSec < 29.0) {
        throw new Error(
          `내보낸 MP4 검증에 실패했습니다 (비디오=${Boolean(hasVideoStream)}, 오디오=${Boolean(hasAudioStream)}, 길이=${actualDurationSec}s).`
        );
      }

      emitStage('export', 'done', `MP4 검증 완료 (${actualDurationSec.toFixed(2)}초)`);

      const payload = {
        exportId,
        videoUrl: `/api/exports/${exportId}.mp4`,
        downloadUrl: `/api/exports/${exportId}.mp4?download=1`,
        actualDurationSec,
        mode,
        fallbackReason,
        cues: allCues,
        beatAudioDurations,
      };

      if (useStream) {
        res.write(JSON.stringify({ type: 'complete', data: payload }) + '\n');
        res.end();
      } else {
        res.json(payload);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '30초 영상 생성 중 오류가 발생했습니다.';
      if (useStream) {
        res.write(
          JSON.stringify({
            type: 'error',
            failedStage: currentStage,
            error: message,
          }) + '\n'
        );
        res.end();
      } else {
        res.status(500).json({ failedStage: currentStage, error: message });
      }
    } finally {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Festival Stand server listening on http://localhost:${port}`);
  });
}

startServer();
