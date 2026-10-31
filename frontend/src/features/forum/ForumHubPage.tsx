import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ApiError } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
} from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { PublicLayout } from '../../layouts/PublicLayout';
import {
  FORUM_TOPICS,
  formatForumDate,
  type ForumListResponse,
  type ForumPost,
  type ForumTopic,
} from './contracts';
import { createForumPost, getForumPosts } from './api';

interface CreatePostDraft {
  topic: string;
  title: string;
  content: string;
}

type CreatePostField = keyof CreatePostDraft;
type CreatePostErrors = Partial<Record<CreatePostField, string>>;

const emptyDraft: CreatePostDraft = { topic: '', title: '', content: '' };

function validateCreatePost(draft: CreatePostDraft): CreatePostErrors {
  const errors: CreatePostErrors = {};
  if (!FORUM_TOPICS.includes(draft.topic as ForumTopic)) {
    errors.topic = 'Vui lòng chọn chủ đề cho câu hỏi của bạn.';
  }

  const title = draft.title.trim();
  const titleLength = [...title].length;
  if (!title) {
    errors.title = 'Tiêu đề không được để trống.';
  } else if (titleLength < 10) {
    errors.title = 'Tiêu đề cần có ít nhất 10 ký tự.';
  } else if (titleLength > 255) {
    errors.title = 'Tiêu đề không được vượt quá 255 ký tự.';
  }

  const content = draft.content.trim();
  if (!content) {
    errors.content = 'Nội dung câu hỏi không được để trống.';
  } else if (new TextEncoder().encode(content).byteLength > 65_535) {
    errors.content = 'Nội dung không được vượt quá 65.535 byte.';
  }
  return errors;
}

function createPostErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại rồi thử gửi.';
    }
    if (error.status === 403) {
      return 'Chỉ sinh viên mới có thể đăng câu hỏi.';
    }
    if (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_REQUEST') {
      return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường trước khi gửi.';
    }
    if (error.code === 'TIMEOUT') {
      return 'Gửi câu hỏi mất quá nhiều thời gian. Vui lòng thử lại.';
    }
  }
  return 'Không thể đăng câu hỏi lúc này. Dữ liệu đã nhập được giữ lại, vui lòng thử lại.';
}

type RequestState<T> =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'success'; data: T };

const requestTimeoutMs = 12_000;

function errorCode(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

function listErrorCopy(code: string): { title: string; description: string } {
  if (code === 'INVALID_QUERY') {
    return {
      title: 'Tham số bộ lọc không hợp lệ',
      description: 'Vui lòng kiểm tra lại bộ lọc chủ đề hoặc trang truy vấn.',
    };
  }
  if (code === 'TIMEOUT') {
    return {
      title: 'Tải diễn đàn mất quá nhiều thời gian',
      description: 'Kết nối máy chủ chưa phản hồi. Bạn có thể thử tải lại.',
    };
  }
  return {
    title: 'Chưa thể tải danh sách bài viết',
    description: 'Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại sau.',
  };
}

function topicBadgeVariant(topic: ForumTopic): 'info' | 'success' | 'warning' {
  switch (topic) {
    case 'Học tập':
      return 'info';
    case 'Thực tập':
      return 'success';
    case 'Kinh nghiệm phỏng vấn':
      return 'warning';
  }
}

function AuthorAvatar({
  fullName,
  avatarUrl,
}: {
  fullName: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  const initial = fullName.trim().charAt(0).toUpperCase() || 'U';
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan font-bold text-navy text-sm"
    >
      {initial}
    </div>
  );
}

function ForumPostCard({ item }: { item: ForumPost }) {
  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <article
        aria-labelledby={`post-${item.id}-title`}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={topicBadgeVariant(item.topic)}>{item.topic}</Badge>
          <time
            dateTime={item.createdAt}
            className="type-caption text-subtle text-xs"
          >
            {formatForumDate(item.createdAt)}
          </time>
        </div>

        <div>
          <h2
            id={`post-${item.id}-title`}
            className="text-lg font-bold leading-snug text-ink hover:text-brand"
          >
            <Link
              to={`/forum/${item.id}`}
              className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {item.title}
            </Link>
          </h2>
          <p className="mt-2 line-clamp-3 type-body text-secondary">
            {item.content}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <div className="flex items-center gap-2.5">
            <AuthorAvatar
              fullName={item.author.fullName}
              avatarUrl={item.author.avatarUrl}
            />
            <span className="type-label font-medium text-ink">
              {item.author.fullName}
            </span>
          </div>

          <Link
            to={`/forum/${item.id}`}
            className="type-label text-sm font-semibold text-brand hover:underline"
          >
            Xem chi tiết &rarr;
          </Link>
        </div>
      </article>
    </Card>
  );
}

export function ForumHubPage() {
  const { status: authStatus, role } = useAuth();
  const routerLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<CreatePostDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<CreatePostErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [state, setState] = useState<RequestState<ForumListResponse>>({
    status: 'loading',
  });

  const currentTopic = searchParams.get('topic') ?? '';
  const currentPage = Number(searchParams.get('page')) || 1;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);

    const query = new URLSearchParams(
      routerLocation.search.startsWith('?')
        ? routerLocation.search.slice(1)
        : routerLocation.search,
    );

    setState({ status: 'loading' });
    getForumPosts(query, controller.signal)
      .then((data) => {
        if (active) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (controller.signal.aborted && !timedOut) return;
        setState({
          status: 'error',
          code: timedOut ? 'TIMEOUT' : errorCode(error),
        });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [routerLocation.search, revision]);

  function handleTopicChange(topic: string) {
    const next = new URLSearchParams(searchParams);
    if (topic) {
      next.set('topic', topic);
    } else {
      next.delete('topic');
    }
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) {
      next.delete('page');
    } else {
      next.set('page', String(page));
    }
    setSearchParams(next);
  }

  function openCreatePost() {
    setLoginPrompt(false);
    if (authStatus !== 'authenticated' || role !== 'Student') {
      if (authStatus === 'guest') setLoginPrompt(true);
      return;
    }
    setDraft(emptyDraft);
    setFieldErrors({});
    setSubmitError(null);
    setIsCreateOpen(true);
  }

  function closeCreatePost() {
    if (isSubmitting) return;
    setIsCreateOpen(false);
    setDraft(emptyDraft);
    setFieldErrors({});
    setSubmitError(null);
  }

  function updateDraft(field: CreatePostField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  async function submitCreatePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authStatus !== 'authenticated' || role !== 'Student' || isSubmitting) {
      return;
    }

    const errors = validateCreatePost(draft);
    setFieldErrors(errors);
    setSubmitError(
      Object.keys(errors).length > 0
        ? 'Vui lòng kiểm tra và điền đầy đủ thông tin bắt buộc trước khi gửi.'
        : null,
    );
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const created = await createForumPost({
        topic: draft.topic,
        title: draft.title.trim(),
        content: draft.content.trim(),
      });
      setIsCreateOpen(false);
      setDraft(emptyDraft);
      setFieldErrors({});
      setSubmitError(null);
      setSuccessMessage('Câu hỏi của bạn đã được đăng thành công.');

      const next = new URLSearchParams(searchParams);
      next.set('topic', created.post.topic);
      next.delete('page');
      if (next.toString() === searchParams.toString()) {
        setRevision((current) => current + 1);
      } else {
        setSearchParams(next);
      }
    } catch (error) {
      setSubmitError(createPostErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canCreatePost = authStatus === 'guest' || role === 'Student';

  return (
    <PublicLayout activeKey="forum">
      <main className="mx-auto w-full max-w-public px-8 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-card bg-gradient-to-r from-navy to-brand px-6 py-8 text-white shadow-soft md:px-10">
          <div>
            <Badge variant="info" className="mb-2 border border-white/20 bg-white/10 text-white">
              Diễn đàn cộng đồng UniHub
            </Badge>
            <h1 className="type-display text-white">Diễn đàn sinh viên</h1>
            <p className="mt-1 max-w-[672px] type-body text-white/85">
              Chia sẻ kiến thức, hỏi đáp và trao đổi kinh nghiệm học tập, thực tập và định hướng nghề nghiệp.
            </p>
          </div>
          {canCreatePost && (
            <Button
              variant="neutral"
              onClick={openCreatePost}
              loading={authStatus === 'loading'}
              className="shrink-0 bg-white text-navy hover:bg-cyan"
            >
              + Đặt câu hỏi mới
            </Button>
          )}
        </header>

        {loginPrompt && (
          <div role="status" className="mb-5 rounded-control border border-brand/20 bg-cyan/40 px-4 py-3 type-label text-navy">
            Vui lòng đăng nhập với Google ở đầu trang để đặt câu hỏi.
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-5 flex items-center justify-between gap-4 rounded-control border border-green-200 bg-green-100 px-4 py-3 type-label text-green-800"
          >
            <span>{successMessage}</span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => setSuccessMessage(null)}
              className="rounded-sm px-2 text-lg leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              ×
            </button>
          </div>
        )}

        {/* Filter bar */}
        <section aria-label="Bộ lọc diễn đàn" className="mb-6">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label
                  htmlFor="forum-topic-filter"
                  className="type-label font-medium text-secondary whitespace-nowrap"
                >
                  Chủ đề thảo luận:
                </label>
                <div className="w-56">
                  <Select
                    id="forum-topic-filter"
                    value={currentTopic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                  >
                    <option value="">Tất cả chủ đề</option>
                    {FORUM_TOPICS.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {currentTopic && (
                <Button
                  variant="outline"
                  onClick={() => handleTopicChange('')}
                  className="type-label text-xs"
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </Card>
        </section>

        {/* Content area */}
        {state.status === 'loading' && (
          <LoadingState
            title="Đang tải danh sách bài viết"
            description="Vui lòng chờ trong giây lát..."
          />
        )}

        {state.status === 'error' && (
          <ErrorState
            title={listErrorCopy(state.code).title}
            description={listErrorCopy(state.code).description}
            onRetry={() => setRevision((rev) => rev + 1)}
          />
        )}

        {state.status === 'success' && state.data.items.length === 0 && (
          <EmptyState
            title="Chưa có bài viết nào"
            description={
              currentTopic
                ? `Hiện chưa có bài viết nào thuộc chủ đề "${currentTopic}".`
                : 'Diễn đàn hiện chưa có bài viết nào.'
            }
          >
            {currentTopic && (
              <Button variant="outline" onClick={() => handleTopicChange('')}>
                Xem tất cả chủ đề
              </Button>
            )}
            {canCreatePost && (
              <Button onClick={openCreatePost} loading={authStatus === 'loading'}>
                Đặt câu hỏi mới
              </Button>
            )}
          </EmptyState>
        )}

        {state.status === 'success' && state.data.items.length > 0 && (
          <section aria-label="Danh sách bài viết" className="grid gap-4">
            <div className="grid gap-4">
              {state.data.items.map((post) => (
                <ForumPostCard key={post.id} item={post} />
              ))}
            </div>

            {/* Pagination */}
            {state.data.meta.totalPages > 1 && (
              <nav
                aria-label="Phân trang diễn đàn"
                className="mt-6 flex items-center justify-between border-t border-line pt-4"
              >
                <Button
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  &larr; Trang trước
                </Button>

                <span className="type-label text-secondary">
                  Trang {state.data.meta.page} / {state.data.meta.totalPages} (
                  {state.data.meta.total} bài viết)
                </span>

                <Button
                  variant="outline"
                  disabled={currentPage >= state.data.meta.totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Trang sau &rarr;
                </Button>
              </nav>
            )}
          </section>
        )}
      </main>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/55 px-4 py-6 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-forum-post-title"
            className="my-auto w-full max-w-xl rounded-card bg-white p-6 shadow-[0_20px_60px_rgba(3,4,94,0.2)] sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="create-forum-post-title" className="type-title text-navy">
                  Đặt câu hỏi mới
                </h2>
                <p className="mt-1 type-caption text-muted">
                  Chia sẻ rõ chủ đề và nội dung để mọi người có thể hỗ trợ bạn.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={isSubmitting}
                onClick={closeCreatePost}
                className="rounded-control px-2 text-xl text-secondary hover:bg-surface disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {submitError && (
              <div
                role="alert"
                className="mb-5 rounded-control border border-danger-line bg-danger-surface px-4 py-3 text-danger"
              >
                <p className="type-label font-semibold">Thông tin chưa hợp lệ</p>
                <p className="mt-1 type-caption">{submitError}</p>
              </div>
            )}

            <form onSubmit={(event) => void submitCreatePost(event)} noValidate>
              <div className="grid gap-5">
                <FormField id="forum-post-topic" label="Chủ đề" required error={fieldErrors.topic}>
                  <Select
                    autoFocus
                    value={draft.topic}
                    disabled={isSubmitting}
                    onChange={(event) => updateDraft('topic', event.target.value)}
                  >
                    <option value="">-- Chọn chủ đề thảo luận --</option>
                    {FORUM_TOPICS.map((topic) => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  id="forum-post-title"
                  label="Tiêu đề câu hỏi"
                  hint="Tối thiểu 10 ký tự, tối đa 255 ký tự."
                  required
                  error={fieldErrors.title}
                >
                  <Input
                    value={draft.title}
                    maxLength={1020}
                    disabled={isSubmitting}
                    placeholder="Ví dụ: Xin kinh nghiệm chuẩn bị hồ sơ phỏng vấn..."
                    onChange={(event) => updateDraft('title', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="forum-post-content"
                  label="Nội dung chi tiết"
                  hint="Mô tả câu hỏi, bối cảnh và những gì bạn đã thử. Hỗ trợ Markdown cơ bản."
                  required
                  error={fieldErrors.content}
                >
                  <textarea
                    id="forum-post-content"
                    required
                    aria-invalid={Boolean(fieldErrors.content)}
                    aria-describedby={fieldErrors.content ? 'forum-post-content-error' : 'forum-post-content-hint'}
                    value={draft.content}
                    disabled={isSubmitting}
                    rows={5}
                    placeholder="Mô tả chi tiết câu hỏi, bối cảnh và những gì bạn đã thử..."
                    onChange={(event) => updateDraft('content', event.target.value)}
                    className="w-full resize-y rounded-control border border-control bg-white px-3 py-3 text-sm leading-5 text-ink placeholder:text-placeholder focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger"
                  />
                </FormField>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={closeCreatePost}
                >
                  Hủy
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isSubmitting ? 'Đang gửi…' : 'Gửi'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </PublicLayout>
  );
}
