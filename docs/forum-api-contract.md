# Hợp đồng API diễn đàn và kiểm duyệt

> **Trạng thái: public author fields đã được leader chốt; toàn bộ endpoint/forum moderation draft chờ leader review.** Chưa có endpoint forum/moderation trên `main`. TV5 triển khai sau khi leader duyệt; phạm vi chỉ đọc, đăng bài, bình luận và Admin xóa mềm nội dung vi phạm theo UC-08–UC-11.

## Forum public/Student

Đề xuất endpoints:

| Method/path                        | Quyền                                                                                                                                        | Request/query và response                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/forum/posts               | Public Guest/Student. Query topic optional, page=1/pageSize=20 max100 đề xuất; sort created_at DESC,post_id DESC.                            | 200 `{"items":[],"meta":{"page":1,"pageSize":20,"total":0,"totalPages":0}}`; chỉ is_deleted=false. Topic chỉ Học tập/Thực tập/Kinh nghiệm phỏng vấn. |
| GET /api/forum/posts/:id           | Public.                                                                                                                                      | 200 object có `post` và `comments`, hoặc `GET comments` riêng nếu quá dài; chỉ bài chưa xóa và bình luận chưa xóa. Không công khai nội dung đã gỡ.   |
| POST /api/forum/posts              | Student only; Guest 401, Admin 403. JSON: topic/title/content; title 1–255, content required; trim, không rỗng. Field lạ bị từ chối.         | 201 object có `post`; author_id từ JWT; backend sanitize plain text trước lưu.                                                                       |
| GET /api/forum/posts/:id/comments  | Public; page=1/pageSize=20 max100 đề xuất; sort created_at ASC,comment_id ASC để hội thoại ổn định.                                          | 200 `{"items":[],"meta":{"page":1,"pageSize":20,"total":0,"totalPages":0}}`; bài không tồn tại/đã gỡ cùng 404.                                       |
| POST /api/forum/posts/:id/comments | Student only; Guest 401, Admin 403. JSON `{ "content": "Nội dung văn bản" }` required, nonblank, sanitized. Bài cha phải tồn tại và chưa gỡ. | 201 object có `comment`; author_id từ JWT. Admin 403.                                                                                                |

Example fabricated post response: `{ "post": {"id": 7, "title": "Cách học SQL", "topic": "Học tập", "content": "Nội dung văn bản", "author": {"fullName":"Sinh viên minh họa","avatarUrl":null}, "createdAt":"2026-10-28T00:00:00Z"} }`. **Quyết định đã duyệt:** public author object chỉ gồm `fullName` và `avatarUrl`; tuyệt đối không trả email, `userId` hoặc Google sub. `author_id` vẫn là khóa nội bộ để ghi nhận actor và không được serialize ra response.

No edit or student-delete operations are in source; do not add them. 400 `INVALID_REQUEST`/`VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 503 `SERVICE_UNAVAILABLE`, 500 `INTERNAL_ERROR`. `topic` domain is backend checked; Ch4 CHECK does not enforce it. Error envelope shared. Empty list returns 200 with [] and meta; DB failure remains error.

Đề xuất chờ leader review: nội dung forum là plain text, không hỗ trợ HTML tùy ý; backend lưu/serialize an toàn và frontend render như text. Không dùng nội dung người dùng như HTML tin cậy.

Tables: forum_posts, comments, users. Reads/writes use authenticated actor IDs. DB PK/FK and length/null constraints are structural; backend enforces role, non-empty sanitized text, allowed topic, visibility and ownership.

## Admin community moderation

Proposed `GET /api/admin/moderation/forum` returns undeleted posts/comments newest first (tie by IDs); `POST /api/admin/moderation/forum/posts/:id/remove` and `/comments/:id/remove` accept `{ "reason": "..." }`. Admin only via backend. Reject blank/whitespace; max 500 to fit deleted_reason/activity_logs.reason. No edit-content operation. A non-violation “keep” does not write log. Missing/deleted target → 404/409 and refresh queue; repeated moderation is not a second action.

On delete, one DB transaction sets is_deleted/deleted_at/deleted_reason; inserts append-only activity_logs with DELETE_POST/DELETE_COMMENT, target_type/target_id, reason; creates Violation notification for the content author with content explaining moderation and reason, is_read=false, event_id=NULL. Any failure rolls back all. Soft-deleted post hides all its comments even if comment.is_deleted=false. No PII or deleted content is public after moderation.

Current notifications schema cannot identify a post/comment destination; see [events-notifications-api-contract.md](events-notifications-api-contract.md). **Quyết định đã duyệt:** Violation notification dùng đích chung `/forum`; không deep-link đến post/comment. A direct resource link would require schema/report review. Ch3 does not require user lock; no lock behavior or Admin content editing.

Tests: Guest/Student/Admin permissions; response author contains only fullName/avatarUrl (no email/userId/Google sub); pagination/sort and topic validation; removed post/comments hidden; cannot comment on missing/deleted post; sanitize; deleted parent suppresses comments; Admin keep has no writes; reason required/length; concurrent double moderation; audit+notification exact payload; rollback when either insert fails; generic destination limitation; no user lock.
