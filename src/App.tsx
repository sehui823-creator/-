/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { INITIAL_PROJECT } from './data/initialProject';
import {
  ExportVideoResponse,
  ExpressionItem,
  PipelineStage,
  ProjectState,
  StageProgressMap,
  StageStatus,
  StoryboardBeat,
} from './types/storyboard';

const INITIAL_STAGE_PROGRESS: StageProgressMap = {
  images: 'idle',
  speech: 'idle',
  subtitles: 'idle',
  rendering: 'idle',
  export: 'idle',
};
import { validateProject } from './utils/validation';
import { TopBar, StudioTab } from './components/TopBar';
import { ValidationBanner } from './components/ValidationBanner';
import { ExpressionsAndSettingsPanel } from './components/ExpressionsAndSettingsPanel';
import { StoryboardPanel } from './components/StoryboardPanel';
import { VideoStudioPanel } from './components/VideoStudioPanel';
import { QuizPanel } from './components/QuizPanel';

export default function App() {
  const [project, setProject] = useState<ProjectState>(() => INITIAL_PROJECT);
  const [activeTab, setActiveTab] = useState<StudioTab>('storyboard');
  const [showKorean, setShowKorean] = useState<boolean>(true);

  const [regeneratingBeatIndex, setRegeneratingBeatIndex] = useState<number | null>(null);
  const [regeneratingImageIndex, setRegeneratingImageIndex] = useState<number | null>(null);
  const [beatError, setBeatError] = useState<string | null>(null);

  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [stageProgress, setStageProgress] = useState<StageProgressMap>(INITIAL_STAGE_PROGRESS);
  const [stageDetail, setStageDetail] = useState<string | null>(null);
  const [failedStage, setFailedStage] = useState<PipelineStage | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportVideoResponse | null>(null);

  const validation = useMemo(() => validateProject(project), [project]);

  const handleUpdateProjectField = <K extends keyof ProjectState>(
    key: K,
    value: ProjectState[K]
  ) => {
    setProject((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddExpression = () => {
    setProject((prev) => ({
      ...prev,
      expressions: [
        ...prev.expressions,
        {
          id: `exp-${Date.now()}`,
          expression: '',
          meaning: '',
          movie: '',
        },
      ],
    }));
  };

  const handleUpdateExpression = (id: string, patch: Partial<ExpressionItem>) => {
    setProject((prev) => ({
      ...prev,
      expressions: prev.expressions.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  };

  const handleRemoveExpression = (id: string) => {
    setProject((prev) => ({
      ...prev,
      expressions: prev.expressions.filter((item) => item.id !== id),
    }));
  };

  const handleUpdateBeat = (beatIndex: number, updated: StoryboardBeat) => {
    setProject((prev) => ({
      ...prev,
      beats: prev.beats.map((b, idx) => (idx === beatIndex ? updated : b)),
    }));
  };

  const handleResetProject = () => {
    setProject(INITIAL_PROJECT);
    setBeatError(null);
    setGenerationError(null);
  };

  const handleRegenerateBeatAi = async (beatIndex: number, instruction: string) => {
    setBeatError(null);
    setRegeneratingBeatIndex(beatIndex);
    try {
      const response = await fetch('/api/regenerate-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, beatIndex, instruction }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '장면 다시 쓰기에 실패했습니다.');
      }
      handleUpdateBeat(beatIndex, data.beat);
    } catch (err) {
      setBeatError(
        err instanceof Error ? err.message : '장면 다시 쓰기 중 오류가 발생했습니다.'
      );
    } finally {
      setRegeneratingBeatIndex(null);
    }
  };

  const handleRegenerateBeatImage = async (beatIndex: number) => {
    setBeatError(null);
    setRegeneratingImageIndex(beatIndex);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, beatIndex }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '이미지 생성에 실패했습니다.');
      }
      const target = project.beats[beatIndex];
      handleUpdateBeat(beatIndex, {
        ...target,
        imageUrl: data.imageUrl,
        customImageBase64: undefined,
      });
    } catch (err) {
      setBeatError(
        err instanceof Error ? err.message : '이미지 생성 중 오류가 발생했습니다.'
      );
    } finally {
      setRegeneratingImageIndex(null);
    }
  };

  const handleGenerateVideo = async (
    modePreference: 'slideshow' | 'ai-video' = 'slideshow'
  ) => {
    setActiveTab('video');
    setGenerationError(null);
    setFailedStage(null);
    setStageDetail(null);
    setStageProgress({ ...INITIAL_STAGE_PROGRESS });
    setIsGeneratingVideo(true);

    try {
      const response = await fetch('/api/generate-video?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, modePreference }),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as {
          error?: string;
          failedStage?: PipelineStage;
        };
        if (errData.failedStage) {
          setFailedStage(errData.failedStage);
          setStageProgress((prev) => ({ ...prev, [errData.failedStage!]: 'error' }));
        }
        throw new Error(errData.error || '30초 영상 합성에 실패했습니다.');
      }

      if (!response.body) {
        const data = (await response.json()) as ExportVideoResponse;
        setExportResult(data);
        setStageProgress({
          images: 'done',
          speech: 'done',
          subtitles: 'done',
          rendering: 'done',
          export: 'done',
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completedPayload: ExportVideoResponse | null = null;

      const processLine = (rawLine: string) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return;
        const event = JSON.parse(trimmed) as
          | { type: 'stage'; stage: PipelineStage; status: StageStatus; detail?: string }
          | { type: 'complete'; data: ExportVideoResponse }
          | { type: 'error'; failedStage: PipelineStage; error: string };

        if (event.type === 'stage') {
          setStageProgress((prev) => ({ ...prev, [event.stage]: event.status }));
          if (event.detail) {
            setStageDetail(event.detail);
          }
        } else if (event.type === 'complete') {
          completedPayload = event.data;
          setExportResult(event.data);
          setStageDetail('모든 단계가 완료되었습니다. 재생과 다운로드를 이용해 보세요.');
        } else if (event.type === 'error') {
          setFailedStage(event.failedStage);
          setStageProgress((prev) => ({ ...prev, [event.failedStage]: 'error' }));
          setStageDetail(null);
          throw new Error(event.error || '30초 영상 생성 중 오류가 발생했습니다.');
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx = buffer.indexOf('\n');
        while (nlIdx !== -1) {
          const line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          processLine(line);
          nlIdx = buffer.indexOf('\n');
        }
      }
      if (buffer.trim()) {
        processLine(buffer);
      }
      if (!completedPayload) {
        throw new Error('영상 생성 스트림이 완료 신호 없이 종료되었습니다.');
      }
    } catch (err) {
      setGenerationError(
        err instanceof Error ? err.message : '영상 생성 요청 중 오류가 발생했습니다.'
      );
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1F2421] flex flex-col pb-20 md:pb-10">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onQuickBuildVideo={() => handleGenerateVideo('slideshow')}
        isGeneratingVideo={isGeneratingVideo}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 space-y-6">
        <ValidationBanner
          projectTitle={project.title || '제목 없음'}
          validation={validation}
          showKorean={showKorean}
          onToggleKorean={() => setShowKorean((v) => !v)}
          onResetProject={handleResetProject}
        />

        {activeTab === 'storyboard' && (
          <StoryboardPanel
            project={project}
            showKorean={showKorean}
            onUpdateBeat={handleUpdateBeat}
            onRegenerateBeatAi={handleRegenerateBeatAi}
            onRegenerateBeatImage={handleRegenerateBeatImage}
            regeneratingBeatIndex={regeneratingBeatIndex}
            regeneratingImageIndex={regeneratingImageIndex}
            beatError={beatError}
            onDismissBeatError={() => setBeatError(null)}
          />
        )}

        {activeTab === 'setup' && (
          <ExpressionsAndSettingsPanel
            project={project}
            validation={validation}
            onUpdateProjectField={handleUpdateProjectField}
            onAddExpression={handleAddExpression}
            onUpdateExpression={handleUpdateExpression}
            onRemoveExpression={handleRemoveExpression}
          />
        )}

        {activeTab === 'video' && (
          <VideoStudioPanel
            project={project}
            validation={validation}
            showKorean={showKorean}
            isGenerating={isGeneratingVideo}
            stageProgress={stageProgress}
            stageDetail={stageDetail}
            failedStage={failedStage}
            generationError={generationError}
            exportResult={exportResult}
            onGenerateVideo={handleGenerateVideo}
          />
        )}

        {activeTab === 'quiz' && <QuizPanel project={project} />}
      </main>
    </div>
  );
}
