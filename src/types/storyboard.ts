export type VisualStyle = '2d-animation' | 'clay' | 'watercolor' | 'live-action';

export type PipelineStage = 'images' | 'speech' | 'subtitles' | 'rendering' | 'export';
export type StageStatus = 'idle' | 'running' | 'done' | 'error';
export type StageProgressMap = Record<PipelineStage, StageStatus>;

export interface ExpressionItem {
  id: string;
  expression: string;
  meaning: string;
  movie: string;
}

export interface DialogueLine {
  id: string;
  speaker: 'A' | 'B';
  text: string;
  ko: string;
}

export interface StoryboardBeat {
  id: string;
  label: string;
  labelKo: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  sceneDescription: string;
  sceneDescriptionKo: string;
  dialogue: DialogueLine[];
  expressions: string[];
  sourceFilms: string[];
  imageUrl: string;
  customImageBase64?: string;
}

export interface ProjectState {
  title: string;
  setting: string;
  characters: string;
  situation: string;
  style: VisualStyle;
  authorName: string;
  expressions: ExpressionItem[];
  beats: StoryboardBeat[];
}

export interface SubtitleCue {
  id: string;
  beatIndex: number;
  speaker: 'A' | 'B';
  startSec: number;
  endSec: number;
  lines: string[];
  fullText: string;
}

export interface ValidationSummary {
  expressionCount: number;
  hasMinExpressions: boolean;
  distinctMovies: string[];
  hasMinMovies: boolean;
  totalWords: number;
  isWordCountInRange: boolean;
  coveredExpressionIds: string[];
  missingExpressions: ExpressionItem[];
  allExpressionsCovered: boolean;
}

export interface QuizQuestion {
  id: string;
  promptKo: string;
  contextEn: string;
  options: string[];
  correctIndex: number;
  explanationKo: string;
  movie: string;
}

export interface ExportVideoResponse {
  exportId: string;
  videoUrl: string;
  downloadUrl: string;
  actualDurationSec: number;
  mode: 'ai-video' | 'slideshow-fallback';
  fallbackReason?: string;
  cues: SubtitleCue[];
  beatAudioDurations: number[];
}
