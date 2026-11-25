import React from 'react';
import { BookOpen, Clapperboard, Film, HelpCircle } from 'lucide-react';

export type StudioTab = 'storyboard' | 'setup' | 'video' | 'quiz';

interface TopBarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onQuickBuildVideo: () => void;
  isGeneratingVideo: boolean;
}

const NAV_ITEMS: Array<{ id: StudioTab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'storyboard', label: '스토리보드', Icon: Clapperboard },
  { id: 'setup', label: '표현·설정', Icon: BookOpen },
  { id: 'video', label: '영상 제작', Icon: Film },
  { id: 'quiz', label: '표현 퀴즈', Icon: HelpCircle },
];

export function TopBar({
  activeTab,
  onSelectTab,
  onQuickBuildVideo,
  isGeneratingVideo,
}: TopBarProps) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-md border-b border-[#E6DFD5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onSelectTab('storyboard')}
            className="text-lg sm:text-xl font-bold tracking-tight text-[#1F2421] whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D95F38]"
          >
            Festival Stand
          </button>

          <nav
            aria-label="주요 메뉴"
            className="hidden md:flex items-center gap-6"
          >
            {NAV_ITEMS.map(({ id, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  className={`py-2 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#D95F38] border-[#D95F38]'
                      : 'text-[#5B635E] border-transparent hover:text-[#1F2421] hover:border-[#D6CFC5]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onQuickBuildVideo}
              disabled={isGeneratingVideo}
              className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#E86A42] hover:bg-[#D55932] active:scale-[0.98] disabled:opacity-60 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer shadow-sm"
            >
              {isGeneratingVideo ? '영상 만드는 중...' : '30초 영상 만들기'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom thumb-zone navigation */}
      <nav
        aria-label="모바일 하단 메뉴"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#E6DFD5]"
      >
        <div className="grid grid-cols-4 h-14">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  isActive ? 'text-[#D95F38]' : 'text-[#5B635E]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
