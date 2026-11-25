import React from 'react';
import { AlertCircle, Check, Plus, Trash2 } from 'lucide-react';
import { STYLE_OPTIONS } from '../data/initialProject';
import { ExpressionItem, ProjectState, ValidationSummary, VisualStyle } from '../types/storyboard';

interface ExpressionsAndSettingsPanelProps {
  project: ProjectState;
  validation: ValidationSummary;
  onUpdateProjectField: <K extends keyof ProjectState>(key: K, value: ProjectState[K]) => void;
  onAddExpression: () => void;
  onUpdateExpression: (id: string, patch: Partial<ExpressionItem>) => void;
  onRemoveExpression: (id: string) => void;
}

export function ExpressionsAndSettingsPanel({
  project,
  validation,
  onUpdateProjectField,
  onAddExpression,
  onUpdateExpression,
  onRemoveExpression,
}: ExpressionsAndSettingsPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* F2: Place, Characters, Situation & Style */}
      <section className="lg:col-span-5 bg-white border border-[#E6DFD5] rounded-2xl p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1F2421]">
            1. 배경 · 캐릭터 · 화면 스타일 설정
          </h2>
          <p className="text-sm text-[#5B635E] mt-1">
            장소와 등장인물, 상황, 애니메이션 스타일을 자유롭게 수정할 수 있어요.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[#1F2421]">작품 제목 (Title)</span>
            <input
              type="text"
              value={project.title}
              onChange={(e) => onUpdateProjectField('title', e.target.value)}
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#DED6CA] bg-[#FBF9F5] text-[#1F2421] text-base focus:outline-none focus:border-[#E86A42]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[#1F2421]">장소 / 배경 (Place)</span>
            <textarea
              rows={2}
              value={project.setting}
              onChange={(e) => onUpdateProjectField('setting', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED6CA] bg-[#FBF9F5] text-[#1F2421] text-sm leading-relaxed focus:outline-none focus:border-[#E86A42]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[#1F2421]">
              등장인물 설정 (Characters)
            </span>
            <textarea
              rows={3}
              value={project.characters}
              onChange={(e) => onUpdateProjectField('characters', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED6CA] bg-[#FBF9F5] text-[#1F2421] text-sm leading-relaxed focus:outline-none focus:border-[#E86A42]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[#1F2421]">상황 줄거리 (Situation)</span>
            <textarea
              rows={3}
              value={project.situation}
              onChange={(e) => onUpdateProjectField('situation', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED6CA] bg-[#FBF9F5] text-[#1F2421] text-sm leading-relaxed focus:outline-none focus:border-[#E86A42]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[#1F2421]">
              크레딧 작성자 이름 (마지막 1초 표시)
            </span>
            <input
              type="text"
              value={project.authorName}
              onChange={(e) => onUpdateProjectField('authorName', e.target.value)}
              placeholder="김세희"
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#DED6CA] bg-[#FBF9F5] text-[#1F2421] text-base focus:outline-none focus:border-[#E86A42]"
            />
          </label>

          <div className="space-y-2">
            <span className="block text-sm font-semibold text-[#1F2421]">
              화면 스타일 (Style)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STYLE_OPTIONS.map((opt) => {
                const selected = project.style === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateProjectField('style', opt.id as VisualStyle)}
                    className={`p-3.5 min-h-[68px] rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      selected
                        ? 'bg-[#FFF3EC] border-[#E86A42] text-[#1F2421]'
                        : 'bg-[#FBF9F5] border-[#E6DFD5] text-[#454D48] hover:bg-[#F5EFE6]'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{opt.labelKo}</div>
                      <div className="text-xs text-[#5B635E] mt-0.5 leading-snug">
                        {opt.descKo}
                      </div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-[#D95F38] shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* F1: Editable Expressions, Meanings, Movies */}
      <section className="lg:col-span-7 bg-white border border-[#E6DFD5] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2421]">
              2. 수업 영어 표현 목록 ({validation.expressionCount}개)
            </h2>
            <p className="text-sm text-[#5B635E] mt-1">
              최소 5개 이상의 표현과 2편 이상의 서로 다른 영화 출처가 필요합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddExpression}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[46px] rounded-xl bg-[#2D6A4F] hover:bg-[#23543E] text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>표현 추가하기</span>
          </button>
        </div>

        {(!validation.hasMinExpressions || !validation.hasMinMovies) && (
          <div className="p-4 rounded-xl bg-[#FFF7ED] border border-[#FDBA74] text-[#9A3412] flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {!validation.hasMinExpressions && (
                <p className="font-semibold">
                  경고: 현재 표현이 {validation.expressionCount}개입니다. 5개 이상 입력해 주세요.
                </p>
              )}
              {!validation.hasMinMovies && (
                <p className="font-semibold">
                  경고: 현재 고유 영화가 {validation.distinctMovies.length}편({validation.distinctMovies.join(', ') || '없음'})입니다. 2편 이상으로 구성해 주세요.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {project.expressions.map((item, idx) => {
            const isCovered = validation.coveredExpressionIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E6DFD5] space-y-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#5B635E]">
                  <div className="flex items-center gap-2 font-mono-nums">
                    <span className="font-bold text-[#1F2421]">#{idx + 1}</span>
                    <span aria-hidden="true">·</span>
                    <span className={isCovered ? 'text-[#2D6A4F] font-semibold' : 'text-[#C2410C] font-semibold'}>
                      {isCovered ? '대본에 포함됨' : '대본에서 누락됨'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveExpression(item.id)}
                    aria-label={`${idx + 1}번 표현 삭제`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg text-[#B91C1C] hover:bg-[#FEE2E2] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#454D48]">영어 표현</span>
                    <input
                      type="text"
                      value={item.expression}
                      onChange={(e) =>
                        onUpdateExpression(item.id, { expression: e.target.value })
                      }
                      placeholder="예: It looks like rain."
                      className="w-full px-3 py-2 min-h-[44px] rounded-lg border border-[#DED6CA] bg-white text-sm font-medium text-[#1F2421] focus:outline-none focus:border-[#E86A42]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#454D48]">한국어 뜻</span>
                    <input
                      type="text"
                      value={item.meaning}
                      onChange={(e) =>
                        onUpdateExpression(item.id, { meaning: e.target.value })
                      }
                      placeholder="예: 비가 올 것 같아."
                      className="w-full px-3 py-2 min-h-[44px] rounded-lg border border-[#DED6CA] bg-white text-sm text-[#1F2421] focus:outline-none focus:border-[#E86A42]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#454D48]">출처 영화 · 패턴</span>
                    <input
                      type="text"
                      value={item.movie}
                      onChange={(e) =>
                        onUpdateExpression(item.id, { movie: e.target.value })
                      }
                      placeholder="예: Minari"
                      className="w-full px-3 py-2 min-h-[44px] rounded-lg border border-[#DED6CA] bg-white text-sm text-[#1F2421] focus:outline-none focus:border-[#E86A42]"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
