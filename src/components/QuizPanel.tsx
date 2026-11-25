import React, { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { INITIAL_QUIZ_QUESTIONS } from '../data/initialProject';
import { ProjectState, QuizQuestion } from '../types/storyboard';
import { extractMovieName } from '../utils/validation';

interface QuizPanelProps {
  project: ProjectState;
}

export function QuizPanel({ project }: QuizPanelProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // Use curated 3 questions if default expressions are still present, or adapt dynamically to edited expressions
  const questions: QuizQuestion[] = useMemo(() => {
    const exprTexts = project.expressions.map((e) => e.expression.toLowerCase());
    const usesDefaults =
      exprTexts.some((t) => t.includes('was going to sell everything')) &&
      exprTexts.some((t) => t.includes('on edge')) &&
      exprTexts.some((t) => t.includes('made my whole day'));

    if (usesDefaults) {
      return INITIAL_QUIZ_QUESTIONS;
    }

    const valid = project.expressions.filter(
      (e) => e.expression.trim() && e.meaning.trim()
    );
    if (valid.length < 3) {
      return INITIAL_QUIZ_QUESTIONS;
    }

    return valid.slice(0, 3).map((target, idx) => {
      const distractors = valid
        .filter((e) => e.id !== target.id)
        .slice(0, 3)
        .map((e) => e.expression);
      const options = [target.expression, ...distractors];
      const correctIndex = 0;
      const movieName = extractMovieName(target.movie) || '수업 영화';
      return {
        id: `dyn-q-${idx}`,
        promptKo: `다음 한국어 뜻에 가장 잘 어울리는 영어 표현을 고르세요: "${target.meaning}"`,
        contextEn: `출처 영화: ${movieName}`,
        options,
        correctIndex,
        explanationKo: `"${target.expression}"의 뜻은 "${target.meaning}"이며, 영화 ${target.movie}에 등장하는 핵심 표현입니다.`,
        movie: movieName,
      };
    });
  }, [project.expressions]);

  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.reduce(
    (sum, q) => (answers[q.id] === q.correctIndex ? sum + 1 : sum),
    0
  );

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border border-[#E6DFD5] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1F2421]">
            표현 복습 퀴즈 (3문제)
          </h2>
          <p className="text-sm text-[#5B635E] mt-1">
            스토리보드에 담긴 영화 속 영어 표현을 퀴즈로 점검해 보세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-mono-nums font-bold text-[#1F2421]">
            점수: {correctCount} / {questions.length}
          </div>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#DED6CA] bg-[#FBF9F5] hover:bg-[#F2ECE2] text-xs font-semibold text-[#1F2421] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>다시 풀기</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {questions.map((q, qIdx) => {
          const picked = answers[q.id];
          const isAnswered = picked !== undefined;
          const isCorrect = picked === q.correctIndex;

          return (
            <article
              key={q.id}
              className="bg-white border border-[#E6DFD5] rounded-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="space-y-2">
                <div className="text-xs font-mono-nums font-semibold text-[#5B635E]">
                  문제 0{qIdx + 1} · {q.movie}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#1F2421] leading-snug">
                  {q.promptKo}
                </h3>
                <p className="p-3.5 rounded-xl bg-[#FBF9F5] border border-[#ECE6DD] text-sm sm:text-base font-medium text-[#2E3430]">
                  {q.contextEn}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((opt, optIdx) => {
                  const selected = picked === optIdx;
                  const rightOption = optIdx === q.correctIndex;

                  let btnClass =
                    'bg-[#FBF9F5] border-[#DED6CA] text-[#1F2421] hover:bg-[#F3EDE3]';
                  if (isAnswered) {
                    if (rightOption) {
                      btnClass =
                        'bg-[#ECF5EE] border-[#2D6A4F] text-[#1F4E38] font-bold';
                    } else if (selected) {
                      btnClass =
                        'bg-[#FEF2F2] border-[#DC2626] text-[#991B1B] font-semibold';
                    } else {
                      btnClass = 'bg-[#FBF9F5] border-[#ECE6DD] text-[#787F7A]';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                      }
                      className={`p-3.5 min-h-[50px] rounded-xl border text-left text-sm sm:text-base transition-colors cursor-pointer flex items-center justify-between gap-2 ${btnClass}`}
                    >
                      <span>
                        {optIdx + 1}. {opt}
                      </span>
                      {isAnswered && rightOption && (
                        <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                      )}
                      {isAnswered && selected && !rightOption && (
                        <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div
                  className={`p-3.5 rounded-xl border text-sm ${
                    isCorrect
                      ? 'bg-[#ECF5EE] border-[#B8DEC5] text-[#1F4E38]'
                      : 'bg-[#FFF7ED] border-[#FDBA74] text-[#9A3412]'
                  }`}
                >
                  <strong className="block mb-0.5">
                    {isCorrect ? '정답입니다!' : '아쉬워요, 다시 확인해 볼까요?'}
                  </strong>
                  <span>{q.explanationKo}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
