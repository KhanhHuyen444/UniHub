import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useSkillOptions, type SkillOptionsRole } from './useSkillOptions';

export interface SkillOptionsFieldProps {
  accessToken: string | null;
  role: SkillOptionsRole;
  selectedIds: readonly number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  searchable?: boolean;
}

export function SkillOptionsField({
  accessToken,
  role,
  selectedIds,
  onChange,
  disabled = false,
  searchable = false,
}: SkillOptionsFieldProps) {
  const [search, setSearch] = useState('');
  const { state, retry } = useSkillOptions(accessToken, role);
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
  else if (state.status === 'success')
    content = (
      <div className="grid gap-2 sm:grid-cols-2">
        {state.options
          .filter(
            (option) =>
              !searchable ||
              option.name
                .toLocaleLowerCase('vi-VN')
                .includes(search.trim().toLocaleLowerCase('vi-VN')),
          )
          .map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-3 rounded-control border border-line bg-white p-3 type-label text-secondary"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={selectedIds.includes(option.id)}
                onChange={(event) => {
                  // Preserve unlisted existing IDs (e.g. Closed Profile links). The Profile
                  // owner renders/manages those separately; options never silently erase them.
                  onChange(
                    event.currentTarget.checked
                      ? [...selectedIds, option.id]
                      : selectedIds.filter((id) => id !== option.id),
                  );
                }}
              />
              <span>{option.name}</span>
            </label>
          ))}
      </div>
    );
  return (
    <fieldset disabled={disabled} className="grid gap-3">
      <legend className="mb-3 type-label font-medium text-secondary">
        Kỹ năng
      </legend>
      <p className="type-caption text-muted">
        Chọn kỹ năng đang hoạt động cho hồ sơ của bạn.
      </p>
      {searchable && (
        <label className="grid gap-2 text-sm">
          <span className="sr-only">Tìm kiếm kỹ năng</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm kiếm kỹ năng có sẵn (ví dụ: Python, ReactJS, SQL...)"
            className="w-full rounded-control border border-line p-3"
          />
        </label>
      )}
      {content}
      {searchable &&
        state.status === 'success' &&
        state.options.length > 0 &&
        !state.options.some((option) =>
          option.name
            .toLocaleLowerCase('vi-VN')
            .includes(search.trim().toLocaleLowerCase('vi-VN')),
        ) && (
          <p role="status" className="text-sm text-muted">
            Không tìm thấy kỹ năng phù hợp.
          </p>
        )}
    </fieldset>
  );
}
