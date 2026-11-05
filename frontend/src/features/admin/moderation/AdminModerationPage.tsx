import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { OpportunityModerationView } from '../opportunities/AdminOpportunitiesPage';
import { ModerationQueue } from '../forum/ForumModerationPage';

function BriefcaseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function MessageSquareIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export type ModerationTabKey = 'opportunities' | 'community';

export interface AdminModerationPageProps {
  initialTab?: ModerationTabKey;
}

export function AdminModerationPage({
  initialTab,
}: AdminModerationPageProps = {}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  // If an opportunity ID is present in path (/admin/moderation/:id), we are on opportunities tab
  const rawTab = searchParams.get('tab');
  const activeTab: ModerationTabKey = id
    ? 'opportunities'
    : rawTab === 'community' || rawTab === 'forum'
      ? 'community'
      : rawTab === 'opportunities'
        ? 'opportunities'
        : (initialTab ?? 'opportunities');

  const handleSelectTab = useCallback(
    (nextTab: ModerationTabKey) => {
      if (nextTab === activeTab && !id) return;
      navigate({
        pathname: '/admin/moderation',
        search: `?tab=${nextTab}`,
      });
    },
    [activeTab, id, navigate],
  );

  const handleKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLButtonElement>,
      current: ModerationTabKey,
    ) => {
      let targetTab: ModerationTabKey | null = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        targetTab = current === 'opportunities' ? 'community' : 'opportunities';
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        targetTab = current === 'community' ? 'opportunities' : 'community';
      } else if (event.key === 'Home') {
        event.preventDefault();
        targetTab = 'opportunities';
      } else if (event.key === 'End') {
        event.preventDefault();
        targetTab = 'community';
      }

      if (targetTab && targetTab !== current) {
        handleSelectTab(targetTab);
        const button = document.getElementById(`tab-${targetTab}`);
        button?.focus();
      }
    },
    [handleSelectTab],
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Page Header */}
      <header className="rounded-xl border border-line bg-gradient-to-r from-white via-sky-50/30 to-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="type-label font-bold uppercase tracking-wider text-brand">
                Kiểm duyệt nội dung
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
              {activeTab === 'opportunities'
                ? 'Thẩm định cơ hội'
                : 'Giám sát cộng đồng'}
            </h1>
            <p className="mt-2 text-sm text-secondary">
              {activeTab === 'opportunities'
                ? 'Xem thông tin đã gửi và quyết định duyệt hoặc từ chối theo hợp đồng.'
                : 'Rà soát bài viết và bình luận trong diễn đàn sinh viên.'}
            </p>
          </div>
        </div>
      </header>

      {/* Accessible Segmented Tab Navigation */}
      <nav aria-label="Khu vực kiểm duyệt" className="w-full">
        <div
          role="tablist"
          aria-label="Khu vực kiểm duyệt"
          className="grid w-full grid-cols-2 rounded-xl border border-line/80 bg-slate-100/80 p-1.5 shadow-sm gap-2"
        >
          <button
            type="button"
            role="tab"
            id="tab-opportunities"
            aria-selected={activeTab === 'opportunities'}
            aria-controls="panel-opportunities"
            tabIndex={activeTab === 'opportunities' ? 0 : -1}
            onClick={() => handleSelectTab('opportunities')}
            onKeyDown={(e) => handleKeyDown(e, 'opportunities')}
            className={`flex w-full min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              activeTab === 'opportunities'
                ? 'bg-white text-brand shadow-[0_2px_8px_rgba(0,119,182,0.18)]'
                : 'text-secondary hover:text-navy hover:bg-white/60'
            }`}
          >
            <BriefcaseIcon
              className={`h-4 w-4 ${activeTab === 'opportunities' ? 'text-brand' : 'text-slate-400'}`}
            />
            Tin chờ thẩm định
          </button>
          <button
            type="button"
            role="tab"
            id="tab-community"
            aria-selected={activeTab === 'community'}
            aria-controls="panel-community"
            tabIndex={activeTab === 'community' ? 0 : -1}
            onClick={() => handleSelectTab('community')}
            onKeyDown={(e) => handleKeyDown(e, 'community')}
            className={`flex w-full min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              activeTab === 'community'
                ? 'bg-white text-brand shadow-[0_2px_8px_rgba(0,119,182,0.18)]'
                : 'text-secondary hover:text-navy hover:bg-white/60'
            }`}
          >
            <MessageSquareIcon
              className={`h-4 w-4 ${activeTab === 'community' ? 'text-brand' : 'text-slate-400'}`}
            />
            Giám sát cộng đồng
          </button>
        </div>
      </nav>

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id="panel-opportunities"
        aria-labelledby="tab-opportunities"
        hidden={activeTab !== 'opportunities'}
      >
        {activeTab === 'opportunities' && (
          <OpportunityModerationView
            showHeader={false}
            showNav={false}
            baseRoute="/admin/moderation"
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="panel-community"
        aria-labelledby="tab-community"
        hidden={activeTab !== 'community'}
      >
        {activeTab === 'community' && <ModerationQueue showHeader={false} />}
      </div>
    </div>
  );
}
