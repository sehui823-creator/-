import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  Film,
  ImagePlus,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  DialogueLine,
  ExpressionItem,
  ProjectState,
  StoryboardBeat,
} from '../types/storyboard';
import {
  buildPreviewCuesForBeat,
  getBeatSpokenWordCount,
  highlightDialogueSegments,
} from '../utils/validation';

interface StoryboardPanelProps {
  project: ProjectState;
  showKorean: boolean;
  onUpdateBeat: (beatIndex: number, updated: StoryboardBeat) => void;
  onRegenerateBeatAi: (beatIndex: number, instruction: string) => Promise<void>;
  onRegenerateBeatImage: (beatIndex: number) => Promise<void>;
  regeneratingBeatIndex: number | null;
  regeneratingImageIndex: number | null;
  beatError: string | null;
  onDismissBeatError: () => void;
}

export function StoryboardPanel({
  project,
  showKorean,
  onUpdateBeat,
  onRegenerateBeatAi,
  onRegenerateBeatImage,
  regeneratingBeatIndex,
  regeneratingImageIndex,
  beatError,
  onDismissBeatError,
}: StoryboardPanelProps) {
  const [selectedExpression, setSelectedExpression] = useState<{
    beatId: string;
    item: ExpressionItem;
  } | null>(null);
  const [editingBeatIndex, setEditingBeatIndex] = useState<number | null>(null);
  const [aiPromptMap, setAiPromptMap] = useState<Record<number, string>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageUpload = (
    beatIndex: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const beat = project.beats[beatIndex];
        onUpdateBeat(beatIndex, {
          ...beat,
          customImageBase64: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLineChange = (
    beatIndex: number,
    lineIndex: number,
    patch: Partial<DialogueLine>
  ) => {
    const beat = project.beats[beatIndex];
    const nextDialogue = beat.dialogue.map((d, idx) =>
      idx === lineIndex ? { ...d, ...patch } : d
    );
    onUpdateBeat(beatIndex, { ...beat, dialogue: nextDialogue });
  };

  const handleAddLine = (beatIndex: number) => {
    const beat = project.beats[beatIndex];
    const nextSpeaker = beat.dialogue.at(-1)?.speaker === 'A' ? 'B' : 'A';
    onUpdateBeat(beatIndex, {
      ...beat,
      dialogue: [
        ...beat.dialogue,
        {
          id: `${beat.id}-line-${Date.now()}`,
          speaker: nextSpeaker,
          text: '',
          ko: '',
        },
      ],
    });
  };

  const handleRemoveLine = (beatIndex: number, lineIndex: number) => {
    const beat = project.beats[beatIndex];
    if (beat.dialogue.length <= 1) return;
    onUpdateBeat(beatIndex, {
      ...beat,
      dialogue: beat.dialogue.filter((_, idx) => idx !== lineIndex),
    });
  };

  return (
    <div className="space-y-6">
      {beatError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-[#FFF7ED] border border-[#FDBA74] text-[#9A3412] flex items-start justify-between gap-3 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{beatError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissBeatError}
            aria-label="오류 안내 닫기"
            className="p-1.5 rounded-lg hover:bg-[#FFEDD5] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {project.beats.map((beat, beatIndex) => {
          const isEditing = editingBeatIndex === beatIndex;
          const isRegenerating = regeneratingBeatIndex === beatIndex;
          const isRegenImg = regeneratingImageIndex === beatIndex;
          const beatWords = getBeatSpokenWordCount(beat);
          const cues = buildPreviewCuesForBeat(beat, beatIndex);
          const imgSrc = beat.customImageBase64 || beat.imageUrl;
          const imgBroken = failedImages[beat.id] && !beat.customImageBase64;
          const activePopup =
            selectedExpression?.beatId === beat.id ? selectedExpression.item : null;

          return (
            <article
              key={beat.id}
              className="bg-white border border-[#E6DFD5] rounded-2xl overflow-hidden flex flex-col"
            >
              {/* Visual Frame 16:9 */}
              <div className="relative aspect-video bg-[#F5EFE6] border-b border-[#E6DFD5] overflow-hidden">
                {!imgBroken && imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={`${beat.labelKo} 장면 일러스트`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [beat.id]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#FFF3EC] to-[#ECF5EE]">
                    <Film className="w-8 h-8 text-[#D95F38] mb-2" />
                    <p className="text-sm font-bold text-[#1F2421]">{beat.labelKo}</p>
                    <p className="text-xs text-[#5B635E] mt-1 max-w-xs">
                      {beat.sceneDescription}
                    </p>
                  </div>
                )}

                {/* Subtle bottom gradient scrim + cue preview */}
                {cues[0] && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent pt-8 pb-3 px-4 pointer-events-none">
                    <p className="text-center text-white font-bold text-sm sm:text-base leading-snug drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]">
                      {cues[0].lines.map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          {i < cues[0].lines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4 flex-1 flex flex-col">
                {/* Unboxed clean metadata header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono-nums font-semibold text-[#5B635E]">
                      <span>
                        {beat.startSec}–{beat.endSec}s ({beat.durationSec}초)
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{beatWords}단어</span>
                      <span aria-hidden="true"> · </span>
                      <span>{beat.sourceFilms.join(', ')}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#1F2421] mt-0.5">
                      0{beatIndex + 1}. {beat.labelKo}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingBeatIndex(isEditing ? null : beatIndex)
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                        isEditing
                          ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                          : 'bg-[#FBF9F5] border-[#DED6CA] text-[#1F2421] hover:bg-[#F3EDE3]'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>편집 완료</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-4 h-4" />
                          <span>직접 수정</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Scene Description */}
                {!isEditing ? (
                  <div className="space-y-1 text-sm">
                    <p className="text-[#3C423E] leading-relaxed">
                      <span className="font-semibold text-[#1F2421]">장면 연출: </span>
                      {beat.sceneDescription}
                    </p>
                    {showKorean && beat.sceneDescriptionKo && (
                      <p className="text-[#5B635E] text-xs sm:text-sm">
                        {beat.sceneDescriptionKo}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 p-3.5 rounded-xl bg-[#FBF9F5] border border-[#E6DFD5]">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-[#454D48]">
                        장면 묘사 (영어)
                      </span>
                      <input
                        type="text"
                        value={beat.sceneDescription}
                        onChange={(e) =>
                          onUpdateBeat(beatIndex, {
                            ...beat,
                            sceneDescription: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 min-h-[42px] rounded-lg border border-[#DED6CA] bg-white text-sm text-[#1F2421]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-[#454D48]">
                        장면 묘사 (한국어)
                      </span>
                      <input
                        type="text"
                        value={beat.sceneDescriptionKo}
                        onChange={(e) =>
                          onUpdateBeat(beatIndex, {
                            ...beat,
                            sceneDescriptionKo: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 min-h-[42px] rounded-lg border border-[#DED6CA] bg-white text-sm text-[#1F2421]"
                      />
                    </label>
                  </div>
                )}

                {/* Dialogue Script with F4 Clickable Highlighted Expressions */}
                <div className="space-y-2.5 flex-1">
                  <div className="text-xs font-semibold text-[#5B635E]">
                    대사 스크립트 (노란 밑줄 표현을 누르면 뜻과 영화가 나와요)
                  </div>

                  {!isEditing ? (
                    <div className="space-y-2.5">
                      {beat.dialogue.map((line) => {
                        const segments = highlightDialogueSegments(
                          line.text,
                          project.expressions
                        );
                        const isA = line.speaker === 'A';
                        return (
                          <div
                            key={line.id}
                            className={`p-3.5 rounded-xl border ${
                              isA
                                ? 'bg-[#FFF5EE] border-[#F6D5BE]'
                                : 'bg-[#EFF7F1] border-[#C5E2CE]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${
                                  isA
                                    ? 'bg-[#E86A42] text-white'
                                    : 'bg-[#2D6A4F] text-white'
                                }`}
                              >
                                {line.speaker}
                              </span>
                              <div className="space-y-1">
                                <p className="text-[15px] leading-relaxed text-[#1F2421] font-medium">
                                  {segments.map((seg, sIdx) =>
                                    seg.matchedExpression ? (
                                      <button
                                        key={sIdx}
                                        type="button"
                                        onClick={() =>
                                          setSelectedExpression({
                                            beatId: beat.id,
                                            item: seg.matchedExpression!,
                                          })
                                        }
                                        className="inline bg-[#FEF08A] hover:bg-[#FDE047] text-[#1F2421] font-bold px-1 rounded underline decoration-[#B45309] decoration-2 underline-offset-4 cursor-pointer transition-colors text-left"
                                      >
                                        {seg.text}
                                      </button>
                                    ) : (
                                      <span key={sIdx}>{seg.text}</span>
                                    )
                                  )}
                                </p>
                                {showKorean && line.ko && (
                                  <p className="text-xs sm:text-sm text-[#5B635E]">
                                    {line.ko}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {beat.dialogue.map((line, lIdx) => (
                        <div
                          key={line.id}
                          className="p-3 rounded-xl bg-[#FBF9F5] border border-[#E6DFD5] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[#454D48]">
                                화자
                              </span>
                              <select
                                value={line.speaker}
                                onChange={(e) =>
                                  handleLineChange(beatIndex, lIdx, {
                                    speaker: e.target.value === 'B' ? 'B' : 'A',
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-[#DED6CA] bg-white text-xs font-bold"
                              >
                                <option value="A">A (주황 앞치마)</option>
                                <option value="B">B (초록 후드)</option>
                              </select>
                            </div>
                            {beat.dialogue.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(beatIndex, lIdx)}
                                className="text-xs font-semibold text-[#B91C1C] hover:underline cursor-pointer"
                              >
                                대사 삭제
                              </button>
                            )}
                          </div>
                          <textarea
                            rows={2}
                            value={line.text}
                            onChange={(e) =>
                              handleLineChange(beatIndex, lIdx, {
                                text: e.target.value,
                              })
                            }
                            placeholder="영어 대사 입력"
                            className="w-full px-3 py-2 rounded-lg border border-[#DED6CA] bg-white text-sm text-[#1F2421]"
                          />
                          <input
                            type="text"
                            value={line.ko}
                            onChange={(e) =>
                              handleLineChange(beatIndex, lIdx, {
                                ko: e.target.value,
                              })
                            }
                            placeholder="한국어 번역 입력"
                            className="w-full px-3 py-2 rounded-lg border border-[#DED6CA] bg-white text-xs text-[#5B635E]"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddLine(beatIndex)}
                        className="w-full py-2.5 min-h-[42px] rounded-xl border border-dashed border-[#C8BFB2] text-xs font-semibold text-[#454D48] hover:bg-[#F7F3EC] cursor-pointer"
                      >
                        + 대사 줄 추가
                      </button>
                    </div>
                  )}

                  {/* F4 Popover Card when user clicks a highlighted expression */}
                  {activePopup && (
                    <div className="p-3.5 rounded-xl bg-[#FEF9E7] border border-[#F3D27A] flex items-start justify-between gap-3">
                      <div className="space-y-1 text-sm">
                        <div className="font-bold text-[#1F2421]">
                          {activePopup.expression}
                        </div>
                        <div className="text-[#454D48] font-medium">
                          뜻: {activePopup.meaning}
                        </div>
                        <div className="text-xs text-[#7C5B10]">
                          출처 영화: {activePopup.movie}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedExpression(null)}
                        aria-label="표현 설명 닫기"
                        className="p-1.5 rounded-lg hover:bg-[#FCEFC7] text-[#7C5B10] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Sequential max-2-line subtitle breakdown preview */}
                <div className="pt-3 border-t border-[#EFEAE2] space-y-1.5">
                  <div className="text-xs font-semibold text-[#5B635E]">
                    자막 큐 미리보기 (최대 2줄 분할 · 총 {cues.length}개 큐)
                  </div>
                  <div className="space-y-1">
                    {cues.map((cue) => (
                      <div
                        key={cue.id}
                        className="text-xs font-mono-nums text-[#3C423E] bg-[#FBF9F5] border border-[#ECE6DD] rounded-lg px-2.5 py-1.5 flex items-start justify-between gap-2"
                      >
                        <span className="font-sans font-medium">
                          {cue.lines.join(' / ')}
                        </span>
                        <span className="text-[#787F7A] shrink-0">
                          {cue.startSec.toFixed(1)}–{cue.endSec.toFixed(1)}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* F5: Regenerate ONLY this beat + image controls */}
                <div className="pt-3 border-t border-[#EFEAE2] space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={aiPromptMap[beatIndex] || ''}
                      onChange={(e) =>
                        setAiPromptMap((prev) => ({
                          ...prev,
                          [beatIndex]: e.target.value,
                        }))
                      }
                      placeholder="예: 조금 더 유쾌한 말투로 바꿔줘 (선택)"
                      className="flex-1 px-3 py-2 min-h-[44px] rounded-xl border border-[#DED6CA] bg-[#FBF9F5] text-xs sm:text-sm text-[#1F2421] focus:outline-none focus:border-[#E86A42]"
                    />
                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={() =>
                        onRegenerateBeatAi(beatIndex, aiPromptMap[beatIndex] || '')
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#FFF3EC] hover:bg-[#FFE6D6] border border-[#F5C5A8] text-[#B84520] text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {isRegenerating ? '장면 다시 쓰는 중...' : '이 장면만 AI 다시 쓰기'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isRegenImg}
                      onClick={() => onRegenerateBeatImage(beatIndex)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[#DED6CA] bg-white hover:bg-[#F7F3EC] text-xs font-semibold text-[#454D48] cursor-pointer disabled:opacity-60"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>{isRegenImg ? '이미지 그리는 중...' : '장면 이미지 새로 그리기'}</span>
                    </button>

                    <label className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[#DED6CA] bg-white hover:bg-[#F7F3EC] text-xs font-semibold text-[#454D48] cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>내 이미지 올리기</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(beatIndex, e)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
