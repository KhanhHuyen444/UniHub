import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useSkillOptions, type SkillOptionsRole } from './useSkillOptions';
import { categorizeSkills } from './major-skill-mapping';

export interface SkillOptionsFieldProps {
  accessToken: string | null;
  role: SkillOptionsRole;
  selectedIds: readonly number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  selectedMajorName?: string | null;
  selectedCareerName?: string | null;
}

export function SkillOptionsField({
  accessToken,
  role,
  selectedIds,
  onChange,
  disabled = false,
  selectedMajorName = null,
  selectedCareerName = null,
}: SkillOptionsFieldProps) {
  const { state, retry } = useSkillOptions(accessToken, role);
  const [searchQuery, setSearchQuery] = useState('');

  let content;
  if (state.status === 'unauthenticated')
    content = (
      <ErrorState
        title="Cần đăng nhập Student"
        description="Đăng nhập để tải danh sách kỹ năng."
      />
    );
  else if (state.status === 'forbidden')
    content = (
      <ErrorState
        title="Không có quyền chọn kỹ năng"
        description="Danh sách này chỉ dành cho Student."
      />
    );
  else if (state.status === 'loading')
    content = <LoadingState title="Đang tải kỹ năng" />;
  else if (state.status === 'error')
    content = (
      <ErrorState
        title="Không tải được kỹ năng"
        description={
          state.httpStatus === 401
            ? 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
            : state.httpStatus === 403
              ? 'Tài khoản không có quyền truy cập Skill Options.'
              : `Vui lòng thử lại. Mã lỗi: ${state.code}`
        }
        onRetry={retry}
      />
    );
  else if (state.status === 'success' && state.options.length === 0)
    content = (
      <EmptyState
        title="Chưa có kỹ năng khả dụng"
        description="Hiện không có kỹ năng Active để chọn."
      />
    );
  else if (state.status === 'success') {
    const {
      core,
      advantage,
      suggested,
      other,
      matchedCareer,
      hasSuggestionsForMajor,
      hasCareerGoal,
    } = categorizeSkills(
      state.options,
      selectedMajorName,
      selectedCareerName,
      searchQuery,
    );

    const toggleSkill = (optionId: number, checked: boolean) => {
      // Preserve unlisted existing IDs (e.g. Closed Profile links).
      onChange(
        checked
          ? [...selectedIds, optionId]
          : selectedIds.filter((id) => id !== optionId),
      );
    };

    content = (
      <div className="grid gap-4">
        {/* Search input & counter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-2.5 text-muted"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="search"
              aria-label="Tìm kiếm kỹ năng"
              placeholder="Tìm kiếm kỹ năng trong danh mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-control border border-line bg-white py-2 pl-9 pr-8 text-sm text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-sm text-muted hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-xs text-muted whitespace-nowrap">
            Đã chọn:{' '}
            <strong className="font-semibold text-brand">
              {selectedIds.length}
            </strong>{' '}
            kỹ năng
          </span>
        </div>

        {/* Suggestion Section: Only shown after target career has been entered/selected */}
        {!hasCareerGoal ? (
          <div className="flex items-center gap-2.5 rounded-card border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900">
            <span className="text-sm font-bold text-brand">💡</span>
            <span>
              Vui lòng chọn hoặc nhập{' '}
              <strong>Vị trí nghề nghiệp mục tiêu</strong> ở mục trên để xem
              danh sách kỹ năng gợi ý tương ứng.
            </span>
          </div>
        ) : matchedCareer ? (
          /* 1. Target Career Match: Core & Advantage Skills */
          <div className="grid gap-4 rounded-card border border-brand/20 bg-brand/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  ★
                </span>
                <h4 className="text-sm font-semibold text-navy">
                  Gợi ý cho vị trí: {matchedCareer.name}
                </h4>
              </div>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                {matchedCareer.evidenceStatus === 'verified'
                  ? 'JD đã xác minh'
                  : 'JD ứng viên đề xuất'}
              </span>
            </div>

            {/* Core Skills */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-navy">
                  Kỹ năng cốt lõi ({core.length})
                </span>
                <span className="text-[11px] text-muted">
                  Năng lực trọng yếu của vị trí
                </span>
              </div>
              {core.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {core.map((option) => {
                    const isChecked = selectedIds.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 type-label transition-colors ${
                          isChecked
                            ? 'border-brand bg-white font-medium text-brand shadow-xs'
                            : 'border-brand/20 bg-white/80 text-secondary hover:border-brand/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={isChecked}
                          onChange={(event) =>
                            toggleSkill(option.id, event.currentTarget.checked)
                          }
                        />
                        <span>{option.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs italic text-muted">
                  Không tìm thấy kỹ năng cốt lõi khớp từ khóa.
                </p>
              )}
            </div>

            {/* Advantage Skills */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  Kỹ năng lợi thế ({advantage.length})
                </span>
                <span className="text-[11px] text-muted">
                  Điểm cộng khi ứng tuyển
                </span>
              </div>
              {advantage.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {advantage.map((option) => {
                    const isChecked = selectedIds.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 type-label transition-colors ${
                          isChecked
                            ? 'border-emerald-500 bg-white font-medium text-emerald-900 shadow-xs'
                            : 'border-slate-200 bg-white/80 text-secondary hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-600"
                          checked={isChecked}
                          onChange={(event) =>
                            toggleSkill(option.id, event.currentTarget.checked)
                          }
                        />
                        <span>{option.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs italic text-muted">
                  Không tìm thấy kỹ năng lợi thế khớp từ khóa.
                </p>
              )}
            </div>
          </div>
        ) : hasSuggestionsForMajor ? (
          /* 2. Major Suggestion for Custom Career Goal */
          <div className="rounded-card border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  ✓
                </span>
                <h4 className="text-sm font-semibold text-emerald-950">
                  Kỹ năng gợi ý cho ngành {selectedMajorName} (Mục tiêu:{' '}
                  {selectedCareerName})
                </h4>
              </div>
              <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {suggested.length} gợi ý
              </span>
            </div>
            {suggested.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {suggested.map((option) => {
                  const isChecked = selectedIds.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 type-label transition-colors ${
                        isChecked
                          ? 'border-emerald-500 bg-emerald-50/90 font-medium text-emerald-950'
                          : 'border-emerald-200 bg-white text-secondary hover:border-emerald-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-600"
                        checked={isChecked}
                        onChange={(event) =>
                          toggleSkill(option.id, event.currentTarget.checked)
                        }
                      />
                      <span>{option.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs italic text-muted">
                Không có kỹ năng gợi ý nào khớp với từ khóa tìm kiếm.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-card border border-slate-200 bg-surface p-3 text-xs text-muted">
            Chuyên ngành này chưa có danh sách gợi ý riêng. Bạn có thể tìm và
            chọn từ toàn bộ danh mục bên dưới.
          </div>
        )}

        {/* 3. Other / All Skills Section */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-secondary">
            <span>
              {hasCareerGoal && (matchedCareer || suggested.length > 0)
                ? `Kỹ năng khác trong danh mục (${other.length})`
                : `Toàn bộ danh mục kỹ năng (${other.length})`}
            </span>
            {searchQuery && (
              <span className="font-normal text-muted">
                Khớp từ khóa: &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>

          {other.length > 0 ? (
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {other.map((option) => {
                const isChecked = selectedIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 type-label transition-colors ${
                      isChecked
                        ? 'border-brand bg-brand/5 font-medium text-ink'
                        : 'border-line bg-white text-secondary hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={isChecked}
                      onChange={(event) =>
                        toggleSkill(option.id, event.currentTarget.checked)
                      }
                    />
                    <span>{option.name}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted">
              {searchQuery
                ? `Không tìm thấy kỹ năng nào khớp với "${searchQuery}".`
                : 'Không có kỹ năng nào khả dụng.'}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <fieldset disabled={disabled} className="grid gap-3">
      <legend className="mb-1 type-label font-medium text-secondary">
        Kỹ năng
      </legend>
      <p className="type-caption text-muted">
        Chọn kỹ năng đang hoạt động cho hồ sơ của bạn.
      </p>
      {content}
    </fieldset>
  );
}
