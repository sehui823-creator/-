import {
  DialogueLine,
  ExpressionItem,
  ProjectState,
  StoryboardBeat,
  SubtitleCue,
  ValidationSummary,
} from '../types/storyboard';

/**
 * Counts whitespace-separated words, keeping contractions like "I'm" or "You've" as 1 word.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function getBeatSpokenWordCount(beat: StoryboardBeat): number {
  return beat.dialogue.reduce((sum, line) => sum + countWords(line.text), 0);
}

export function getTotalProjectWordCount(beats: StoryboardBeat[]): number {
  return beats.reduce((sum, beat) => sum + getBeatSpokenWordCount(beat), 0);
}

/**
 * Extracts clean movie title before ';' (e.g. "Notting Hill; course pattern..." -> "Notting Hill").
 */
export function extractMovieName(rawMovie: string): string {
  return rawMovie.split(';')[0].trim();
}

export function extractDistinctMovies(expressions: ExpressionItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of expressions) {
    const clean = extractMovieName(item.movie);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, clean);
    }
  }
  return Array.from(seen.values());
}

/**
 * Normalizes text for expression matching so trailing punctuation differences still match cleanly.
 */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[.,!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function doesTextContainExpression(text: string, expression: string): boolean {
  const normExpr = normalizeForMatch(expression);
  if (!normExpr) return false;
  const normText = normalizeForMatch(text).replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ');
  const cleanExpr = normExpr.replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
  return normText.includes(cleanExpr);
}

export function validateProject(project: ProjectState): ValidationSummary {
  const validExpressions = project.expressions.filter((e) => e.expression.trim().length > 0);
  const distinctMovies = extractDistinctMovies(validExpressions);
  const fullScript = project.beats
    .flatMap((b) => b.dialogue.map((d) => d.text))
    .join(' ');

  const coveredExpressionIds: string[] = [];
  const missingExpressions: ExpressionItem[] = [];

  for (const exp of validExpressions) {
    if (doesTextContainExpression(fullScript, exp.expression)) {
      coveredExpressionIds.push(exp.id);
    } else {
      missingExpressions.push(exp);
    }
  }

  const totalWords = getTotalProjectWordCount(project.beats);

  return {
    expressionCount: validExpressions.length,
    hasMinExpressions: validExpressions.length >= 5,
    distinctMovies,
    hasMinMovies: distinctMovies.length >= 2,
    totalWords,
    isWordCountInRange: totalWords >= 60 && totalWords <= 70,
    coveredExpressionIds,
    missingExpressions,
    allExpressionsCovered: missingExpressions.length === 0 && validExpressions.length > 0,
  };
}

export interface HighlightSegment {
  text: string;
  matchedExpression?: ExpressionItem;
}

/**
 * Splits a dialogue string into plain text and clickable highlighted ExpressionItem segments.
 */
export function highlightDialogueSegments(
  text: string,
  expressions: ExpressionItem[]
): HighlightSegment[] {
  const active = expressions
    .map((exp) => ({
      exp,
      clean: exp.expression.trim().replace(/[.,!?;:]+$/g, ''),
    }))
    .filter((item) => item.clean.length > 0)
    .sort((a, b) => b.clean.length - a.clean.length);

  if (active.length === 0 || !text) {
    return [{ text }];
  }

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${active.map((a) => escapeRegex(a.clean) + '[.,!?]?').join('|')})`,
    'gi'
  );

  const parts = text.split(pattern);
  const segments: HighlightSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    const matched = active.find(
      (a) =>
        normalizeForMatch(part) === normalizeForMatch(a.clean) ||
        normalizeForMatch(part).startsWith(normalizeForMatch(a.clean))
    );
    if (matched) {
      segments.push({ text: part, matchedExpression: matched.exp });
    } else {
      segments.push({ text: part });
    }
  }

  return segments;
}

/**
 * Wraps a chunk of words into at most 2 lines of <= maxCharsPerLine characters.
 * Splits long dialogue into sequential subtitle cues so every cue stays <= 2 lines.
 */
export function splitTextIntoTwoLineCues(
  text: string,
  maxCharsPerLine = 38
): string[][] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const cues: string[][] = [];
  let currentLines: string[] = [''];

  for (const word of words) {
    const lineIdx = currentLines.length - 1;
    const candidate = currentLines[lineIdx]
      ? `${currentLines[lineIdx]} ${word}`
      : word;

    if (candidate.length <= maxCharsPerLine) {
      currentLines[lineIdx] = candidate;
    } else if (currentLines.length < 2) {
      currentLines.push(word);
    } else {
      cues.push(currentLines);
      currentLines = [word];
    }
  }

  if (currentLines.some((l) => l.length > 0)) {
    cues.push(currentLines);
  }

  return cues;
}

/**
 * Generates preview subtitle cues for a beat (distributed smoothly across beat duration).
 */
export function buildPreviewCuesForBeat(
  beat: StoryboardBeat,
  beatIndex: number
): SubtitleCue[] {
  const allLineCues: Array<{ line: DialogueLine; lines: string[]; weight: number }> = [];

  for (const d of beat.dialogue) {
    const split = splitTextIntoTwoLineCues(d.text, 38);
    for (const twoLines of split) {
      const joined = twoLines.join(' ');
      allLineCues.push({
        line: d,
        lines: twoLines,
        weight: Math.max(4, joined.length),
      });
    }
  }

  if (allLineCues.length === 0) return [];

  const leadPad = 0.35;
  const tailPad = 0.45;
  const usable = Math.max(1, beat.durationSec - leadPad - tailPad);
  const totalWeight = allLineCues.reduce((s, c) => s + c.weight, 0);

  let cursor = beat.startSec + leadPad;
  return allLineCues.map((c, idx) => {
    const dur = (c.weight / totalWeight) * usable;
    const startSec = Number(cursor.toFixed(2));
    const endSec = Number((cursor + dur).toFixed(2));
    cursor += dur;
    return {
      id: `${beat.id}-cue-${idx}`,
      beatIndex,
      speaker: c.line.speaker,
      startSec,
      endSec,
      lines: c.lines,
      fullText: c.lines.join(' '),
    };
  });
}
