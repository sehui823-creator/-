import React from 'react';
import { AlertTriangle, CheckCircle2, Languages, RotateCcw } from 'lucide-react';
import { ValidationSummary } from '../types/storyboard';

interface ValidationBannerProps {
  projectTitle: string;
  validation: ValidationSummary;
  showKorean: boolean;
  onToggleKorean: () => void;
  onResetProject: () => void;
}

export function ValidationBanner({
  projectTitle,
  validation,
  showKorean,
  onToggleKorean,
  onResetProject,
}: ValidationBannerProps) {
  const hasWarnings =
    !validation.hasMinExpressions ||
    !validation.hasMinMovies ||
    !validation.isWordCountInRange ||
    !validation.allExpressionsCovered;

  return (
    <section
      aria-label="프로젝트 상태 및 검증"
      className="bg-white border border-[#E6DFD5] rounded-2xl p-4 sm:p-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2421] tracking-tight">
            {projectTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5B635E] font-mono-nums">
            <span>
              표현{' '}
              <strong
                className={
                  validation.hasMinExpressions ? 'text-[#2D6A4F]' : 'text-[#C2410C]'
                }
              >
                {validation.expressionCount}개
              </strong>{' '}
              (최소 5개)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              영화{' '}
              <strong
                className={validation.hasMinMovies ? 'text-[#2D6A4F]' : 'text-[#C2410C]'}
              >
                {validation.distinctMovies.length}편
              </strong>{' '}
              (최소 2편)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              대본 포함{' '}
              <strong
                className={
                  validation.allExpressionsCovered ? 'text-[#2D6A4F]' : 'text-[#C2410C]'
                }
              >
                {validation.coveredExpressionIds.length}/{validation.expressionCount}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              단어 수{' '}
              <strong
                className={
                  validation.isWordCountInRange ? 'text-[#2D6A4F]' : 'text-[#C2410C]'
                }
              >
                {validation.totalWords}단어
              </strong>{' '}
              (목표 60–70)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleKorean}
            aria-pressed={showKorean}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              showKorean
                ? 'bg-[#ECF5EE] border-[#A7D3B7] text-[#1F4E38]'
                : 'bg-[#FBF9F5] border-[#DED6CA] text-[#454D48] hover:bg-[#F3EFE8]'
            }`}
          >
            <Languages className="w-4 h-4 shrink-0" />
            <span>한국어 번역 {showKorean ? '켜짐' : '꺼짐'}</span>
          </button>

          <button
            type="button"
            onClick={onResetProject}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#DED6CA] bg-white hover:bg-[#F7F3EC] text-[#454D48] text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>초기 작품으로 되돌리기</span>
          </button>
        </div>
      </div>

      {/* Explicit non-hue-only validation summary */}
      <div className="mt-4 pt-3.5 border-t border-[#EFEAE2] flex flex-col gap-1.5 text-sm">
        {!hasWarnings ? (
          <div className="flex items-center gap-2 text-[#2D6A4F] font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              모든 검증 통과: 목표 표현 100% 포함, 영화 {validation.distinctMovies.length}편 이상, 30초 분량({validation.totalWords}단어) 준비 완료!
            </span>
          </div>
        ) : (
          <div className="space-y-1.5 text-[#B45309]">
            {!validation.hasMinExpressions && (
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>표현이 5개 미만입니다. 표현·설정 탭에서 최소 5개 이상 입력해 주세요.</span>
              </div>
            )}
            {!validation.hasMinMovies && (
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>서로 다른 영화가 2편 미만입니다. 최소 2편 이상의 영화 출처를 입력해 주세요.</span>
              </div>
            )}
            {!validation.allExpressionsCovered && (
              <div className="flex items-start gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  대본에서 누락된 표현({validation.missingExpressions.length}개):{' '}
                  {validation.missingExpressions.map((m) => `"${m.expression}"`).join(', ')}
                </span>
              </div>
            )}
            {!validation.isWordCountInRange && (
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  현재 총 {validation.totalWords}단어입니다. 30초 자연스러운 말하기 속도를 위해 60–70단어를 권장합니다.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
