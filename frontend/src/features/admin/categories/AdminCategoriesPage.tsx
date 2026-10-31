import { getAuthSnapshot, subscribeToAuth } from '../../auth/auth-state';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import {
  Button,
  Badge,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
} from '../../../components/ui';
import {
  createAdminCategory,
  renameAdminCategory,
  setAdminCategoryStatus,
} from './api';
import {
  parseCreatedAt,
  type AdminCategory,
  type CategoryType,
} from './contracts';
import {
  categoryError,
  useAdminCategories,
  type CategoryError,
} from './useAdminCategories';
import { CategoryDialog } from './CategoryDialog';

const createdAtFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});
function CategoryCreatedAt({ value }: { value: string | null }) {
  const valid = parseCreatedAt(value);
  return valid ? (
    <time dateTime={valid}>{createdAtFormatter.format(new Date(valid))}</time>
  ) : (
    <span aria-label="Ngày tạo chưa có thông tin">—</span>
  );
}

export interface AdminCategoriesPageProps {
  accessToken: string | null;
  role: 'Admin' | 'Student' | null;
}
const messages: Record<string, string> = {
  DUPLICATE_CATEGORY: 'Tên danh mục đã tồn tại trong loại này.',
  LAST_ACTIVE_CATEGORY:
    'Không thể đóng danh mục Active cuối cùng của loại này.',
  VALIDATION_ERROR:
    'Dữ liệu không hợp lệ: tên 1–100 ký tự, lý do tối đa 500 ký tự.',
  INVALID_REQUEST: 'Dữ liệu yêu cầu không hợp lệ.',
  INVALID_ID: 'Mã danh mục không hợp lệ.',
  INVALID_QUERY: 'Bộ lọc danh mục không hợp lệ.',
  NOT_FOUND: 'Danh mục không còn tồn tại. Hãy tải lại danh sách.',
  UNAUTHORIZED:
    'Phiên đăng nhập không hợp lệ hoặc hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Chỉ Admin được quản lý danh mục.',
  SERVICE_UNAVAILABLE: 'Dịch vụ chưa sẵn sàng. Vui lòng thử lại.',
  NETWORK_ERROR:
    'Không kết nối được máy chủ. Với thao tác lưu, hãy tải lại danh sách để kiểm tra kết quả trước khi gửi lại.',
  INVALID_RESPONSE:
    'Dữ liệu trả về không đúng hợp đồng. Hãy tải lại danh sách để kiểm tra kết quả.',
};
const message = (error: CategoryError) =>
  messages[error.code] ??
  'Thao tác chưa thành công. Vui lòng tải lại để kiểm tra kết quả.';
const authError = (error: CategoryError | null) =>
  error?.httpStatus === 401 || error?.httpStatus === 403;
type Edit = { category: AdminCategory; kind: 'rename' | 'status' };

export function AdminCategoriesPage({
  accessToken,
  role,
}: AdminCategoriesPageProps) {
  const auth = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthSnapshot,
  );
  if (!accessToken?.trim() || role === null || auth.status !== 'authenticated')
    return (
      <ErrorState
        title="Cần đăng nhập Admin"
        description="Đăng nhập bằng tài khoản Admin để quản lý danh mục."
      />
    );
  if (role !== 'Admin' || auth.user?.role !== 'Admin')
    return (
      <ErrorState
        title="Không có quyền quản trị"
        description="Student không được quản lý danh mục."
      />
    );
  // Reset on identity changes; token rotation preserves drafts.
  return <AdminCategoriesWorkspace key={auth.user.id} token={accessToken} />;
}

function AdminCategoriesWorkspace({ token }: { token: string }) {
  const [type, setType] = useState<CategoryType>('Major');
  const { state, reload } = useAdminCategories(token, type);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [editName, setEditName] = useState('');
  const [editReason, setEditReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CategoryError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<Partial<Record<CategoryType, number>>>(
    {},
  );
  useEffect(() => {
    if (state.status === 'success')
      setCounts((value) => ({ ...value, [type]: state.items.length }));
  }, [state, type]);
  const pending = useRef<AbortController | null>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const refresh = () => {
    setError(null);
    setEdit(null);
    setNotice(null);
    reload();
  };
  const save = async (
    action: (signal: AbortSignal) => Promise<{ changed?: boolean }>,
    afterSave?: () => void,
  ) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action(controller.signal);
      if (controller.signal.aborted) return;
      setNotice(
        result.changed === false ? 'Không có thay đổi.' : 'Đã lưu danh mục.',
      );
      afterSave?.();
      setCreating(false);
      setEdit(null);
      reload();
    } catch (failure) {
      if (!controller.signal.aborted) setError(categoryError(failure));
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  };
  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    void save(
      async (signal) => {
        await createAdminCategory(token, type, name, reason || null, signal);
        return {};
      },
      () => {
        setName('');
        setReason('');
      },
    );
  };
  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!edit) return;
    void save((signal) =>
      edit.kind === 'rename'
        ? renameAdminCategory(
            token,
            edit.category.id,
            editName,
            editReason || null,
            signal,
          )
        : setAdminCategoryStatus(
            token,
            edit.category.id,
            edit.category.status === 'Active' ? 'Closed' : 'Active',
            editReason || null,
            signal,
          ),
    );
  };
  const denied = authError(error)
    ? error
    : state.status === 'error' && authError(state.error)
      ? state.error
      : null;
  const locked = busy || state.status !== 'success';
  const label = type === 'Major' ? 'chuyên ngành' : 'kỹ năng';
  const filtered =
    state.status === 'success'
      ? state.items.filter(
          (item) =>
            type !== 'Skill' ||
            item.name
              .toLocaleLowerCase('vi-VN')
              .includes(query.trim().toLocaleLowerCase('vi-VN')),
        )
      : [];
  const pages =
    type === 'Skill' ? Math.max(1, Math.ceil(filtered.length / 8)) : 1;
  const currentPage = Math.min(page, pages);
  useEffect(() => {
    // Persist the clamped page only after a successful load, not during reload.
    if (state.status === 'success' && page !== currentPage)
      setPage(currentPage);
  }, [state.status, page, currentPage]);
  const rows =
    type === 'Skill'
      ? filtered.slice((currentPage - 1) * 8, currentPage * 8)
      : filtered;
  const closeDialog = () => {
    setCreating(false);
    setEdit(null);
    setError(null);
  };
  if (denied)
    return (
      <ErrorState
        title="Không được truy cập danh mục Admin"
        description={message(denied)}
        onRetry={refresh}
      />
    );
  return (
    <section className="grid gap-6" aria-label="Quản lý danh mục">
      <header>
        <h1 className="type-display text-navy">Quản lý danh mục</h1>
        <p className="mt-2 type-body text-muted">
          Quản lý các danh mục dùng chung của hệ thống: chuyên ngành và kỹ năng.
        </p>
      </header>
      <div className="flex items-center justify-between gap-4 border-b border-line">
        <div className="flex gap-8" aria-label="Loại danh mục">
          {(['Major', 'Skill'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              disabled={busy}
              className={`border-b-2 px-0 py-4 type-label font-medium ${type === value ? 'border-brand text-brand' : 'border-transparent text-muted'}`}
              onClick={() => {
                setType(value);
                setEdit(null);
                setCreating(false);
                setError(null);
                setNotice(null);
                setName('');
                setReason('');
                setQuery('');
                setPage(1);
              }}
            >
              {value === 'Major' ? 'Chuyên ngành' : 'Kỹ năng'}
              {counts[value] !== undefined ? ` (${counts[value]})` : ''}
            </button>
          ))}
        </div>
        <Button
          disabled={locked}
          onClick={(event) => {
            dialogTrigger.current = event.currentTarget;
            closeDialog();
            setName('');
            setReason('');
            setCreating(true);
          }}
        >
          ＋ Thêm {label}
        </Button>
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-control bg-success-surface px-4 py-3 type-label text-success"
        >
          {notice}
        </p>
      )}
      {error && !creating && !edit && (
        <ErrorState
          title="Không lưu được danh mục"
          description={message(error)}
          onRetry={refresh}
        />
      )}
      {type === 'Skill' && (
        <div className="flex items-center justify-between gap-4">
          <div className="w-full max-w-md">
            <label htmlFor="category-search" className="sr-only">
              Tìm kỹ năng
            </label>
            <Input
              id="category-search"
              type="search"
              placeholder="Tìm kiếm theo tên kỹ năng..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              disabled={busy}
            />
          </div>
          {state.status === 'success' && (
            <p className="type-caption text-muted">
              Hiển thị {filtered.length === 0 ? 0 : (currentPage - 1) * 8 + 1}–
              {(currentPage - 1) * 8 + rows.length} / {filtered.length} kỹ năng
            </p>
          )}
        </div>
      )}
      {state.status === 'loading' && <LoadingState title="Đang tải danh mục" />}
      {state.status === 'error' && (
        <ErrorState
          title="Không tải được danh mục"
          description={message(state.error)}
          onRetry={busy ? undefined : reload}
        />
      )}
      {state.status === 'success' &&
        (filtered.length === 0 ? (
          <EmptyState
            title={query.trim() ? 'Không tìm thấy kỹ năng' : 'Chưa có danh mục'}
            description={
              query.trim()
                ? 'Thử tìm bằng tên khác.'
                : `Chưa có ${label}. Bạn có thể tạo danh mục mới.`
            }
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left type-label">
                <caption className="sr-only">Danh sách {label}</caption>
                <thead className="bg-surface font-normal text-secondary">
                  <tr>
                    <th scope="col" className="w-[40%] px-6 py-4 font-medium">
                      TÊN MỤC
                    </th>
                    <th scope="col" className="w-[20%] px-6 py-4 font-medium">
                      TRẠNG THÁI
                    </th>
                    <th scope="col" className="w-[20%] px-6 py-4 font-medium">
                      NGÀY TẠO
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-right font-medium"
                    >
                      THAO TÁC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((category) => (
                    <tr
                      key={category.id}
                      className={`border-t border-line ${category.status === 'Closed' ? 'bg-page text-muted' : 'text-ink'}`}
                    >
                      <td className="break-words px-6 py-3">{category.name}</td>
                      <td className="px-6 py-3">
                        <Badge
                          variant={
                            category.status === 'Active' ? 'success' : 'neutral'
                          }
                        >
                          <span
                            aria-hidden="true"
                            className="mr-2 h-2 w-2 rounded-full bg-current"
                          />
                          {category.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-muted">
                        <CategoryCreatedAt value={category.createdAt} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right">
                        {(['rename', 'status'] as const).map((kind, index) => (
                          <span key={kind}>
                            {index > 0 && (
                              <span
                                aria-hidden="true"
                                className="mx-3 text-line"
                              >
                                ·
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded type-caption font-medium text-brand disabled:text-muted"
                              aria-label={`${kind === 'rename' ? 'Đổi tên' : category.status === 'Active' ? 'Đóng' : 'Mở lại'} ${category.name}`}
                              onClick={(event) => {
                                dialogTrigger.current = event.currentTarget;
                                setCreating(false);
                                setEdit({ category, kind });
                                setEditName(category.name);
                                setEditReason('');
                                setError(null);
                                setNotice(null);
                              }}
                            >
                              {kind === 'rename'
                                ? 'Đổi tên'
                                : category.status === 'Active'
                                  ? 'Đóng'
                                  : 'Mở lại'}
                            </button>
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {type === 'Skill' && (
              <nav
                aria-label="Phân trang kỹ năng"
                className="flex items-center justify-between border-t border-line px-6 py-4"
              >
                <p className="type-caption text-muted">
                  Trang {currentPage} / {pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="neutral"
                    size="compact"
                    disabled={busy || currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Trước
                  </Button>
                  {Array.from({ length: pages }, (_, index) => index + 1)
                    .filter(
                      (value) =>
                        value === 1 ||
                        value === pages ||
                        Math.abs(value - currentPage) <= 1,
                    )
                    .map((value) => (
                      <Button
                        key={value}
                        size="compact"
                        variant={value === currentPage ? 'primary' : 'text'}
                        disabled={busy}
                        aria-current={
                          value === currentPage ? 'page' : undefined
                        }
                        onClick={() => setPage(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  <Button
                    variant="neutral"
                    size="compact"
                    disabled={busy || currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Tiếp
                  </Button>
                </div>
              </nav>
            )}
          </div>
        ))}
      <aside className="flex items-start gap-3 rounded-control border border-line bg-surface p-4 type-label font-medium text-ink">
        <span aria-hidden="true" className="text-brand">
          ⓘ
        </span>
        <p>
          Quy tắc quản lý danh mục học thuật: Danh mục chỉ được đóng, không xóa,
          để bảo toàn dữ liệu hồ sơ và tin bài đang tham chiếu. Mỗi loại danh
          mục phải luôn còn ít nhất một mục Active.
        </p>
      </aside>
      <div>
        <Button variant="text" disabled={busy} onClick={refresh}>
          Tải lại danh sách
        </Button>
      </div>
      {(creating || edit) && (
        <CategoryDialog
          title={
            creating
              ? `Thêm ${label}`
              : edit?.kind === 'rename'
                ? `Đổi tên ${label}`
                : `${edit?.category.status === 'Active' ? 'Đóng' : 'Mở lại'} ${label}?`
          }
          busy={busy}
          returnFocus={dialogTrigger.current}
          onClose={closeDialog}
        >
          <form
            aria-label={creating ? 'Tạo danh mục' : 'Chỉnh sửa danh mục'}
            onSubmit={creating ? submitCreate : submitEdit}
          >
            <fieldset disabled={locked} className="grid gap-4">
              {creating || edit?.kind === 'rename' ? (
                <>
                  <FormField
                    id={
                      creating ? 'category-create-name' : 'category-edit-name'
                    }
                    label={creating ? `Tên ${label}` : 'Tên mới'}
                    required
                  >
                    <Input
                      autoFocus
                      placeholder={`Nhập tên ${label}...`}
                      value={creating ? name : editName}
                      onChange={(event) =>
                        creating
                          ? setName(event.target.value)
                          : setEditName(event.target.value)
                      }
                    />
                  </FormField>
                  <details className="type-caption text-muted">
                    <summary className="cursor-pointer">
                      Thêm lý do (tùy chọn)
                    </summary>
                    <div className="mt-2">
                      <FormField
                        id={
                          creating
                            ? 'category-create-reason'
                            : 'category-edit-reason'
                        }
                        label={
                          creating
                            ? 'Lý do tạo (tùy chọn)'
                            : 'Lý do đổi tên (tùy chọn)'
                        }
                      >
                        <Input
                          value={creating ? reason : editReason}
                          onChange={(event) =>
                            creating
                              ? setReason(event.target.value)
                              : setEditReason(event.target.value)
                          }
                        />
                      </FormField>
                    </div>
                  </details>
                </>
              ) : (
                <>
                  <p className="rounded-control border border-line bg-page px-4 py-3 type-label font-semibold">
                    {type === 'Major' ? 'Chuyên ngành' : 'Kỹ năng'}:{' '}
                    {edit?.category.name}
                  </p>
                  <p className="type-label text-muted">
                    {edit?.category.status === 'Active'
                      ? 'Mục đã đóng sẽ không xuất hiện khi tạo hồ sơ hoặc tin mới; dữ liệu cũ được giữ nguyên.'
                      : 'Mục mở lại sẽ xuất hiện trong danh sách lựa chọn đang hoạt động.'}
                  </p>
                  <label
                    className="grid gap-2 type-label text-secondary"
                    htmlFor="category-edit-reason"
                  >
                    Lý do (không bắt buộc)
                    <textarea
                      id="category-edit-reason"
                      rows={2}
                      placeholder={`Nhập lý do ${edit?.category.status === 'Active' ? 'đóng' : 'mở lại'} ${label} (nếu có)...`}
                      className="w-full resize-y rounded-control border border-control bg-white px-3 py-2 type-label text-ink"
                      value={editReason}
                      onChange={(event) => setEditReason(event.target.value)}
                    />
                  </label>
                </>
              )}
              {error && (
                <ErrorState
                  title="Không lưu được danh mục"
                  description={message(error)}
                />
              )}
              <footer className="mt-3 flex justify-end gap-3 border-t border-line pt-4">
                <Button variant="neutral" disabled={busy} onClick={closeDialog}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  loading={busy}
                  variant={
                    edit?.kind === 'status' && edit.category.status === 'Active'
                      ? 'danger'
                      : 'primary'
                  }
                >
                  {creating
                    ? 'Lưu'
                    : edit?.kind === 'rename'
                      ? 'Lưu thay đổi'
                      : edit?.category.status === 'Active'
                        ? 'Đóng'
                        : 'Mở lại'}
                </Button>
              </footer>
            </fieldset>
          </form>
        </CategoryDialog>
      )}
    </section>
  );
}
