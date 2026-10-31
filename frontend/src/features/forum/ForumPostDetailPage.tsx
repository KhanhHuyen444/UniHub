import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { PublicLayout } from '../../layouts/PublicLayout';
import {
  formatForumDate,
  type CommentListResponse,
  type ForumComment,
  type ForumPost,
  type ForumTopic,
} from './contracts';
import { createForumComment, getForumPost, getPostComments } from './api';

type PostState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'not-found' }
  | { status: 'success'; postId: string; post: ForumPost };

type CommentsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; data: CommentListResponse };

const requestTimeoutMs = 12_000;
const commentsPageSize = 20;

function isValidId(value: string | undefined): boolean {
  if (!value || !/^[1-9]\d*$/.test(value)) return false;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647;
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
  size = 'md',
}: {
  fullName: string;
  avatarUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base',
  }[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        className={`${sizeClasses} rounded-full object-cover`}
      />
    );
  }

  const initial = fullName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <div
      aria-hidden="true"
      className={`flex ${sizeClasses} items-center justify-center rounded-full bg-cyan font-bold text-navy`}
    >
      {initial}
    </div>
  );
}

function CommentItem({ comment }: { comment: ForumComment }) {
  return (
    <li className="flex gap-3.5 border-b border-line pb-4 last:border-b-0 last:pb-0">
      <AuthorAvatar
        fullName={comment.author.fullName}
        avatarUrl={comment.author.avatarUrl}
        size="sm"
      />

      <div className="flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="type-label font-semibold text-ink">
            {comment.author.fullName}
          </span>

          <time
            dateTime={comment.createdAt}
            className="type-caption text-subtle text-xs"
          >
            {formatForumDate(comment.createdAt)}
          </time>
        </div>

        <p className="mt-1 whitespace-pre-wrap type-body text-secondary text-sm">
          {comment.content}
        </p>
      </div>
    </li>
  );
}

export function ForumPostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { status: authStatus, user, role } = useAuth();

  const [revision, setRevision] = useState(0);
  const [commentsRevision, setCommentsRevision] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotal, setCommentsTotal] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentFieldError, setCommentFieldError] = useState<string | null>(null);
  const [commentSubmitError, setCommentSubmitError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [postState, setPostState] = useState<PostState>({
    status: 'loading',
  });
  const [commentsState, setCommentsState] = useState<CommentsState>({
    status: 'loading',
  });

  // Load the post detail.
  useEffect(() => {
    if (typeof id !== 'string' || !isValidId(id)) {
      setPostState({ status: 'not-found' });
      setCommentsState({ status: 'loading' });
      setCommentsPage(1);
      return;
    }

    const postId = id;
    const controller = new AbortController();

    let active = true;
    let timedOut = false;

    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);

    setPostState({ status: 'loading' });
    setCommentsState({ status: 'loading' });
    setCommentsTotal(null);
    setCommentsPage(1);

    getForumPost(postId, controller.signal)
      .then((data) => {
        if (!active) return;

        setPostState({
          status: 'success',
          postId,
          post: data.post,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (controller.signal.aborted && !timedOut) return;

        if (error instanceof ApiError && error.status === 404) {
          setPostState({ status: 'not-found' });
        } else {
          setPostState({
            status: 'error',
            code: timedOut
              ? 'TIMEOUT'
              : error instanceof ApiError
                ? error.code
                : 'UNKNOWN_ERROR',
          });
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [id, revision]);

  // Load comments for the current page.
  useEffect(() => {
    if (
      typeof id !== 'string' ||
      !isValidId(id) ||
      postState.status !== 'success' ||
      postState.postId !== id
    ) {
      return;
    }

    const postId = id;
    const controller = new AbortController();

    let active = true;
    let timedOut = false;

    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);

    setCommentsState({ status: 'loading' });

    const query = new URLSearchParams({
      page: String(commentsPage),
      pageSize: String(commentsPageSize),
    });

    getPostComments(postId, query, controller.signal)
      .then((data) => {
        if (!active) return;

        // If comments were removed and the current page no longer exists,
        // move to the last available page.
        if (
          data.meta.totalPages > 0 &&
          commentsPage > data.meta.totalPages
        ) {
          setCommentsPage(data.meta.totalPages);
          return;
        }

        setCommentsState({
          status: 'success',
          data,
        });
        setCommentsTotal((current) => Math.max(current ?? 0, data.meta.total));
      })
      .catch(() => {
        if (!active) return;
        if (controller.signal.aborted && !timedOut) return;

        setCommentsState({ status: 'error' });
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [id, postState, commentsPage, commentsRevision]);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      typeof id !== 'string' ||
      !isValidId(id) ||
      authStatus !== 'authenticated' ||
      role !== 'Student' ||
      isSubmittingComment
    ) {
      return;
    }

    const content = commentDraft.trim();
    if (!content) {
      setCommentFieldError('Vui lòng nhập nội dung bình luận.');
      setCommentSubmitError(null);
      setCommentSuccess(null);
      return;
    }
    if (new TextEncoder().encode(content).byteLength > 65_535) {
      setCommentFieldError('Nội dung bình luận không được vượt quá 65.535 byte.');
      setCommentSubmitError(null);
      setCommentSuccess(null);
      return;
    }

    setCommentFieldError(null);
    setCommentSubmitError(null);
    setCommentSuccess(null);
    setIsSubmittingComment(true);
    try {
      const result = await createForumComment(id, content);
      const currentTotal =
        commentsTotal ??
        (commentsState.status === 'success' ? commentsState.data.meta.total : 0);
      const nextTotal = currentTotal + 1;
      const nextPage = Math.max(1, Math.ceil(nextTotal / commentsPageSize));
      const nextTotalPages = Math.ceil(nextTotal / commentsPageSize);
      setCommentsTotal(nextTotal);
      setCommentsPage(nextPage);
      setCommentsState({
        status: 'success',
        data: {
          items:
            commentsState.status === 'success' && nextPage === commentsPage
              ? [...commentsState.data.items, result.comment].slice(
                  -commentsPageSize,
                )
              : [result.comment],
          meta: {
            page: nextPage,
            pageSize: commentsPageSize,
            total: nextTotal,
            totalPages: nextTotalPages,
          },
        },
      });
      setCommentDraft('');
      setCommentSuccess('Bình luận của bạn đã được cập nhật vào diễn đàn.');
      setCommentsRevision((current) => current + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setCommentSubmitError(
          'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại rồi thử gửi.',
        );
      } else if (error instanceof ApiError && error.status === 403) {
        setCommentSubmitError('Chỉ sinh viên mới có thể gửi bình luận.');
      } else {
        setCommentSubmitError(
          'Không thể lưu bình luận, vui lòng thử lại. Nội dung đã nhập được giữ nguyên.',
        );
      }
    } finally {
      setIsSubmittingComment(false);
    }
  }

  return (
    <PublicLayout activeKey="forum">
      <main className="mx-auto w-full max-w-public px-8 py-8">
        {/* Navigation back */}
        <div className="mb-6">
          <Link
            to="/forum"
            className="type-label inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
          >
            &larr; Quay lại danh sách bài viết
          </Link>
        </div>

        {postState.status === 'loading' && (
          <LoadingState
            title="Đang tải bài viết"
            description="Vui lòng chờ trong giây lát..."
          />
        )}

        {postState.status === 'not-found' && (
          <EmptyState
            title="Không tìm thấy bài viết"
            description="Bài viết này không tồn tại hoặc đã được gỡ bỏ khỏi diễn đàn."
          >
            <Link to="/forum">
              <Button variant="primary">Về trang diễn đàn</Button>
            </Link>
          </EmptyState>
        )}

        {postState.status === 'error' && (
          <ErrorState
            title="Chưa thể tải bài viết"
            description="Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại sau."
            onRetry={() => setRevision((r) => r + 1)}
          />
        )}

        {postState.status === 'success' && postState.postId === id && (
          <div className="space-y-6">
            {/* Main Post Article */}
            <Card className="p-6 md:p-8">
              <article aria-labelledby="post-title" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
                  <Badge variant={topicBadgeVariant(postState.post.topic)}>
                    {postState.post.topic}
                  </Badge>

                  <time
                    dateTime={postState.post.createdAt}
                    className="type-caption text-subtle text-sm"
                  >
                    Đăng lúc {formatForumDate(postState.post.createdAt)}
                  </time>
                </div>

                <h1
                  id="post-title"
                  className="type-display text-ink text-2xl font-bold"
                >
                  {postState.post.title}
                </h1>

                {/* Author Info */}
                <div className="flex items-center gap-3 py-2">
                  <AuthorAvatar
                    fullName={postState.post.author.fullName}
                    avatarUrl={postState.post.author.avatarUrl}
                    size="lg"
                  />

                  <div>
                    <p className="type-label font-semibold text-ink">
                      {postState.post.author.fullName}
                    </p>
                    <p className="type-caption text-subtle text-xs">
                      Tác giả bài viết
                    </p>
                  </div>
                </div>

                {/* Post Content */}
                <div className="border-t border-line pt-6">
                  <div className="whitespace-pre-wrap type-body text-ink text-base leading-relaxed">
                    {postState.post.content}
                  </div>
                </div>
              </article>
            </Card>

            {/* Comments Section */}
            <section aria-labelledby="comments-heading">
              <Card className="p-6 md:p-8">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <h2
                    id="comments-heading"
                    className="type-title text-navy font-bold"
                  >
                    Bình luận{' '}
                    {(commentsTotal !== null || commentsState.status === 'success') && (
                      <span className="text-secondary font-normal text-base">
                        ({commentsTotal ?? (commentsState.status === 'success' ? commentsState.data.meta.total : 0)})
                      </span>
                    )}
                  </h2>
                </div>

                <div className="mt-6">
                  {commentsState.status === 'loading' && (
                    <p
                      role="status"
                      className="type-caption text-subtle text-center py-4"
                    >
                      Đang tải bình luận...
                    </p>
                  )}

                  {commentsState.status === 'error' && (
                    <div className="py-6 text-center">
                      <p className="type-caption text-danger">
                        Không thể tải danh sách bình luận.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCommentsRevision((r) => r + 1)}
                        className="mt-3 type-label font-semibold text-brand hover:underline"
                      >
                        Thử tải lại
                      </button>
                    </div>
                  )}

                  {commentsState.status === 'success' &&
                    commentsState.data.items.length === 0 && (
                      <p className="type-body text-subtle text-center py-8">
                        Chưa có bình luận nào cho bài viết này.
                      </p>
                    )}

                  {commentsState.status === 'success' &&
                    commentsState.data.items.length > 0 && (
                      <>
                        <ul
                          aria-label="Danh sách bình luận"
                          className="space-y-4"
                        >
                          {commentsState.data.items.map((comment) => (
                            <CommentItem key={comment.id} comment={comment} />
                          ))}
                        </ul>

                        {/* Comments Pagination */}
                        {commentsState.data.meta.totalPages > 1 && (
                          <nav
                            aria-label="Phân trang bình luận"
                            className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"
                          >
                            <p className="type-caption text-subtle text-sm">
                              Trang {commentsState.data.meta.page} /{' '}
                              {commentsState.data.meta.totalPages}
                            </p>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={commentsPage <= 1}
                                onClick={() =>
                                  setCommentsPage((page) =>
                                    Math.max(1, page - 1),
                                  )
                                }
                                className="rounded-lg border border-line px-4 py-2 type-label font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Trước
                              </button>

                              <button
                                type="button"
                                disabled={
                                  commentsPage >=
                                  commentsState.data.meta.totalPages
                                }
                                onClick={() =>
                                  setCommentsPage((page) => page + 1)
                                }
                                className="rounded-lg border border-line px-4 py-2 type-label font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Sau
                              </button>
                            </div>
                          </nav>
                        )}
                      </>
                    )}
                </div>

                <div className="mt-8 border-t border-line pt-6">
                  {commentSuccess && (
                    <div
                      role="status"
                      className="mb-4 flex items-center justify-between gap-4 rounded-control border border-green-200 bg-green-100 px-4 py-3 type-label text-green-800"
                    >
                      <span>
                        <strong>Đăng bình luận thành công.</strong> {commentSuccess}
                      </span>
                      <button
                        type="button"
                        aria-label="Đóng thông báo"
                        onClick={() => setCommentSuccess(null)}
                        className="rounded-sm px-2 text-lg leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {authStatus === 'loading' && (
                    <p role="status" className="type-label text-muted">
                      Đang kiểm tra phiên đăng nhập...
                    </p>
                  )}

                  {authStatus === 'guest' && (
                    <div className="rounded-card border border-line bg-surface px-5 py-6 text-center">
                      <p className="type-label font-medium text-ink">
                        Đăng nhập để tham gia bình luận.
                      </p>
                      <p className="mt-1 type-caption text-muted">
                        Hãy dùng nút Đăng nhập với Google ở đầu trang để gửi ý kiến.
                      </p>
                    </div>
                  )}

                  {authStatus === 'authenticated' && role === 'Student' && (
                    <form onSubmit={(event) => void submitComment(event)} noValidate>
                      <label
                        htmlFor="forum-comment-content"
                        className="type-label font-semibold text-ink"
                      >
                        Để lại ý kiến đóng góp của bạn
                        {user && (
                          <span className="ml-1 font-normal text-secondary">
                            (Hiển thị dưới tư cách {user.fullName})
                          </span>
                        )}
                      </label>

                      {commentSubmitError && (
                        <div
                          role="alert"
                          className="mb-3 mt-3 rounded-control border border-danger-line bg-danger-surface px-4 py-3 type-label text-danger"
                        >
                          {commentSubmitError}
                        </div>
                      )}

                      <textarea
                        id="forum-comment-content"
                        value={commentDraft}
                        disabled={isSubmittingComment}
                        rows={4}
                        aria-invalid={Boolean(commentFieldError)}
                        aria-describedby={commentFieldError ? 'forum-comment-error' : undefined}
                        placeholder="Nhập ý kiến của bạn..."
                        onChange={(event) => {
                          setCommentDraft(event.target.value);
                          setCommentFieldError(null);
                          setCommentSubmitError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        className="mt-3 w-full resize-y rounded-control border border-control bg-white px-4 py-3 type-body text-secondary placeholder:text-placeholder focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger disabled:bg-surface"
                      />

                      {commentFieldError && (
                        <p
                          id="forum-comment-error"
                          role="alert"
                          className="mt-2 type-caption font-medium text-danger"
                        >
                          {commentFieldError}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="type-caption text-muted">
                          Nhấn Shift + Enter để xuống dòng.
                        </p>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="text"
                            disabled={isSubmittingComment}
                            onClick={() => {
                              setCommentDraft('');
                              setCommentFieldError(null);
                              setCommentSubmitError(null);
                            }}
                          >
                            Hủy
                          </Button>
                          <Button type="submit" loading={isSubmittingComment}>
                            {isSubmittingComment
                              ? 'Đang gửi…'
                              : commentSubmitError
                                ? 'Gửi lại'
                                : 'Gửi phản hồi ➤'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}

                  {authStatus === 'authenticated' && role !== 'Student' && (
                    <p className="type-label text-muted">
                      Chỉ sinh viên đã đăng nhập mới có thể bình luận.
                    </p>
                  )}
                </div>
              </Card>
            </section>
          </div>
        )}
      </main>
    </PublicLayout>
  );
}
