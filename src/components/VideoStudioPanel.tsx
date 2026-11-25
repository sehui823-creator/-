import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Film,
  Info,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  ExportVideoResponse,
  PipelineStage,
  ProjectState,
  StageProgressMap,
  ValidationSummary,
} from '../types/storyboard';

const PIPELINE_STEPS: Array<{ key: PipelineStage; num: number; label: string }> = [
  { key: 'images', num: 1, label: '이미지 확인' },
  { key: 'speech', num: 2, label: '영어 음성' },
  { key: 'subtitles', num: 3, label: '자막·크레딧' },
  { key: 'rendering', num: 4, label: '영상 합성' },
  { key: 'export', num: 5, label: 'MP4 내보내기' },
];

interface VideoStudioPanelProps {
  project: ProjectState;
  validation: ValidationSummary;
  showKorean: boolean;
  isGenerating: boolean;
  stageProgress: StageProgressMap;
  stageDetail: string | null;
  failedStage: PipelineStage | null;
  generationError: string | null;
  exportResult: ExportVideoResponse | null;
  onGenerateVideo: (modePreference: 'slideshow' | 'ai-video') => Promise<void>;
}

export function VideoStudioPanel({
  project,
  validation,
  showKorean,
  isGenerating,
  stageProgress,
  stageDetail,
  failedStage,
  generationError,
  exportResult,
  onGenerateVideo,
}: VideoStudioPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [modePreference, setModePreference] = useState<'slideshow' | 'ai-video'>('slideshow');

  const activeCue = exportResult?.cues.find(
    (c) => currentTime >= c.startSec && currentTime <= c.endSec
  );

  const activeBeatIndex =
    currentTime < 7 ? 0 : currentTime < 15 ? 1 : currentTime < 23 ? 2 : 3;

  const hasAnyProgress =
    isGenerating ||
    Boolean(generationError) ||
    Boolean(exportResult) ||
    PIPELINE_STEPS.some((s) => stageProgress[s.key] !== 'idle');

  const failedStepLabel = failedStage
    ? PIPELINE_STEPS.find((s) => s.key === failedStage)?.label || failedStage
    : null;

  return (
    <div className="space-y-6">
      {/* Control & Export Card */}
      <section className="bg-white border border-[#E6DFD5] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2421]">
              30초 영어 학습 영상 제작 및 내보내기
            </h2>
            <p className="text-sm text-[#5B635E]">
              4개 장면(7초 · 8초 · 8초 · 7초)을 합쳐 자연스러운 영어 음성, 2줄 이하 번인 자막, 마지막 1초 크레딧이 포함된 MP4 파일로 완성합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center p-1 rounded-xl bg-[#F5EFE6] border border-[#E6DFD5]">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setModePreference('slideshow')}
                className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60 ${
                  modePreference === 'slideshow'
                    ? 'bg-white text-[#1F2421] shadow-sm'
                    : 'text-[#5B635E] hover:text-[#1F2421]'
                }`}
              >
                애니메이션 슬라이드쇼 (고정·페이드)
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setModePreference('ai-video')}
                className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60 ${
                  modePreference === 'ai-video'
                    ? 'bg-white text-[#1F2421] shadow-sm'
                    : 'text-[#5B635E] hover:text-[#1F2421]'
                }`}
              >
                AI 영상 클립 (선택·유료 키)
              </button>
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onGenerateVideo(modePreference)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[#E86A42] hover:bg-[#D55932] active:scale-[0.98] disabled:opacity-60 text-white text-sm sm:text-base font-bold whitespace-nowrap cursor-pointer transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? '음성·영상 합성 중...' : '30초 MP4 영상 생성하기'}</span>
            </button>
          </div>
        </div>

        {/* Checklist before export */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
          <div className="p-3 rounded-xl bg-[#FBF9F5] border border-[#ECE6DD]">
            <div className="text-[#5B635E]">장면 구성</div>
            <div className="font-bold text-[#1F2421] font-mono-nums mt-0.5">
              7s + 8s + 8s + 7s = 30s
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#FBF9F5] border border-[#ECE6DD]">
            <div className="text-[#5B635E]">대사 단어 수</div>
            <div
              className={`font-bold font-mono-nums mt-0.5 ${
                validation.isWordCountInRange ? 'text-[#2D6A4F]' : 'text-[#C2410C]'
              }`}
            >
              {validation.totalWords}단어 (목표 60–70)
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#FBF9F5] border border-[#ECE6DD]">
            <div className="text-[#5B635E]">목표 표현 반영</div>
            <div
              className={`font-bold font-mono-nums mt-0.5 ${
                validation.allExpressionsCovered ? 'text-[#2D6A4F]' : 'text-[#C2410C]'
              }`}
            >
              {validation.coveredExpressionIds.length} / {validation.expressionCount}개
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#FBF9F5] border border-[#ECE6DD]">
            <div className="text-[#5B635E]">마지막 1초 크레딧</div>
            <div className="font-bold text-[#1F2421] truncate mt-0.5">
              Script by [{project.authorName || '김세희'}]
            </div>
          </div>
        </div>

        {/* 5-Stage Progress Stepper */}
        {hasAnyProgress && (
          <div
            aria-live="polite"
            className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E6DFD5] space-y-3"
          >
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PIPELINE_STEPS.map((step) => {
                const status = stageProgress[step.key];
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                      status === 'done'
                        ? 'bg-[#EFF7F1] border-[#C5E2CE] text-[#1F4E38]'
                        : status === 'running'
                          ? 'bg-[#FFF3EC] border-[#F3B69F] text-[#9A3412]'
                          : status === 'error'
                            ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
                            : 'bg-white border-[#ECE6DD] text-[#6B726D]'
                    }`}
                  >
                    {status === 'done' && (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2D6A4F]" />
                    )}
                    {status === 'running' && (
                      <Loader2 className="w-4 h-4 shrink-0 text-[#E86A42] animate-spin" />
                    )}
                    {status === 'error' && (
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                    )}
                    {status === 'idle' && (
                      <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center rounded-full border border-[#D6CFC5] text-[11px] font-mono-nums">
                        {step.num}
                      </span>
                    )}
                    <span className="truncate">
                      {step.num}. {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {stageDetail && !generationError && (
              <p className="text-xs sm:text-sm text-[#4A524D] font-medium">
                {stageDetail}
              </p>
            )}
          </div>
        )}

        {generationError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">
                  {failedStepLabel
                    ? `${failedStepLabel} 단계에서 오류가 발생했습니다`
                    : '영상 생성을 완료하지 못했습니다'}
                </div>
                <p>{generationError}</p>
              </div>
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onGenerateVideo(modePreference)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#991B1B] hover:bg-[#7F1D1D] text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>캐시 유지하고 다시 시도</span>
            </button>
          </div>
        )}
      </section>

      {/* Finished Export Player & Download */}
      {exportResult && (
        <section className="bg-white border border-[#E6DFD5] rounded-2xl p-5 sm:p-6 space-y-5">
          {exportResult.fallbackReason && (
            <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] flex items-start gap-3 text-sm">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">애니메이션 슬라이드쇼 모드로 완성되었습니다</div>
                <p>{exportResult.fallbackReason}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 text-[#2D6A4F]">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div className="text-sm sm:text-base font-bold text-[#1F2421] font-mono-nums">
                내보내기 검증 완료 · 실제 길이 {exportResult.actualDurationSec.toFixed(2)}초 ·{' '}
                {exportResult.mode === 'ai-video'
                  ? 'AI 생성 클립 4편 병합'
                  : '4장 고정 장면 + 페이드 전환 병합'}
              </div>
            </div>

            <a
              href={exportResult.downloadUrl}
              download="festival_stand_30s.mp4"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[#2D6A4F] hover:bg-[#23543E] text-white text-sm sm:text-base font-bold whitespace-nowrap shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>MP4 영상 다운로드</span>
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Video Player */}
            <div className="lg:col-span-7 space-y-3">
              <div className="rounded-2xl overflow-hidden bg-[#161817] border border-[#E6DFD5] aspect-video">
                <video
                  ref={videoRef}
                  src={exportResult.videoUrl}
                  controls
                  playsInline
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#FBF9F5] border border-[#E6DFD5] flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-[#5B635E] block">
                    현재 재생 자막 ({currentTime.toFixed(1)}s)
                  </span>
                  <span className="font-bold text-[#1F2421]">
                    {activeCue
                      ? activeCue.fullText
                      : currentTime >= 29
                        ? `Made with Google AI Studio · Script by [${project.authorName || '김세희'}]`
                        : '장면 전환 및 호흡 구간'}
                  </span>
                </div>
                <span className="text-xs font-mono-nums font-semibold text-[#5B635E] shrink-0">
                  장면 {activeBeatIndex + 1}/4
                </span>
              </div>
            </div>

            {/* Synchronized Script & Timing */}
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-base font-bold text-[#1F2421]">
                구간별 타임라인 및 자막 큐 ({exportResult.cues.length}개)
              </h3>
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {exportResult.cues.map((cue) => {
                  const isCurrent =
                    currentTime >= cue.startSec && currentTime <= cue.endSec;
                  const matchingBeat = project.beats[cue.beatIndex];
                  const matchingLine = matchingBeat?.dialogue.find((d) =>
                    d.text.includes(cue.lines[0])
                  );
                  return (
                    <button
                      key={cue.id}
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = cue.startSec;
                          videoRef.current.play().catch(() => {});
                        }
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#FFF3EC] border-[#E86A42]'
                          : 'bg-[#FBF9F5] border-[#E6DFD5] hover:bg-[#F4EFE7]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono-nums text-[#5B635E]">
                        <span className="font-bold text-[#1F2421]">
                          화자 {cue.speaker} · 장면 {cue.beatIndex + 1}
                        </span>
                        <span>
                          {cue.startSec.toFixed(2)}s – {cue.endSec.toFixed(2)}s
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[#1F2421] mt-1">
                        {cue.lines.map((l, idx) => (
                          <div key={idx}>{l}</div>
                        ))}
                      </div>
                      {showKorean && matchingLine?.ko && (
                        <div className="text-xs text-[#5B635E] mt-1">
                          {matchingLine.ko}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {!exportResult && !isGenerating && (
        <section className="bg-[#FBF9F5] border border-dashed border-[#D6CFC5] rounded-2xl p-8 text-center space-y-3">
          <Film className="w-10 h-10 text-[#E86A42] mx-auto" />
          <h3 className="text-base sm:text-lg font-bold text-[#1F2421]">
            아직 생성된 30초 영상이 없습니다
          </h3>
          <p className="text-sm text-[#5B635E] max-w-md mx-auto">
            상단의 <strong>30초 MP4 영상 생성하기</strong> 버튼을 누르면, 스토리보드의 영어 대사를 원어민 음성으로 합성하고 4개 장면과 자막을 하나의 MP4로 만들어 드립니다.
          </p>
          <button
            type="button"
            onClick={() => onGenerateVideo(modePreference)}
            className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[#E86A42] hover:bg-[#D55932] text-white text-sm font-bold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>지금 바로 30초 영상 만들기</span>
          </button>
        </section>
      )}
    </div>
  );
}
