import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useSkillOptions, type SkillOptionsRole } from './useSkillOptions';

export interface SkillOptionsFieldProps {
  accessToken: string | null;
  role: SkillOptionsRole;
  selectedIds: readonly number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}

export function SkillOptionsField({
  accessToken,
  role,
  selectedIds,
  onChange,
  disabled = false,
}: SkillOptionsFieldProps) {
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
        {state.options.map((option) => (
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
      {content}
    </fieldset>
  );
}
