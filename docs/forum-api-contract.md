# Hợp đồng API diễn đàn và kiểm duyệt

> **Contract: leader đã duyệt. Implementation: chưa có forum/moderation routes trên main.** Phạm vi Chương 3 UC-08–UC-11: đọc public, Student đăng bài/bình luận, Admin xóa mềm nội dung vi phạm. Không có edit post, student-delete, rich HTML hoặc account lock.

## Chuẩn hóa và pagination

Guest/Student đọc public. Chỉ Student tạo post/comment; Guest 401 UNAUTHORIZED, Admin 403 FORBIDDEN. Admin moderation yêu cầu access token + requireRole(Admin). Query page mặc định 1, pageSize mặc định 20, pageSize 1–100, page tối đa 1,000,000; mỗi query đúng một lần; query lạ/lặp/sai → 400 INVALID_QUERY. totalPages=ceil(total/pageSize), bằng 0 nếu total=0; page ngoài phạm vi trả items=[] cùng total thực.

Topic hợp lệ chính xác: Học tập, Thực tập, Kinh nghiệm phỏng vấn. Title trim, 1–255 ký tự. Content/comment trim, không rỗng, tối đa 65,535 UTF-8 bytes theo giới hạn MySQL TEXT; JSON sai cú pháp trả 400 `INVALID_JSON`; body sai shape/field thừa trả 400 `INVALID_REQUEST`; giá trị field không hợp lệ trả 400 `VALIDATION_ERROR` với `error.fieldErrors` tùy chọn. Content là text, không nhận HTML tin cậy; server lưu plain text, client render bằng text node/escaping, không dùng innerHTML. Author public chỉ gồm fullName và avatarUrl; không trả email, userId hoặc Google sub.

## API public

| Method/path                                             | Query/body                                                                                                                                                | Response                                                                                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/forum/posts?page=1&pageSize=20&topic=Học%20tập | page/pageSize tùy chọn; topic tùy chọn, chỉ một lần và thuộc enum. Không body.                                                                            | HTTP 200; `items` là mảng Post DTO đầy đủ được định nghĩa ngay dưới bảng, `meta` gồm `page`, `pageSize`, `total`, `totalPages`; chỉ post chưa xóa. Sort `created_at DESC, post_id DESC`.                              |
| GET /api/forum/posts/:id                                | ID số nguyên dương; không query/body. Trả post chưa xóa. Không nhúng comments; comments có endpoint riêng.                                                | HTTP 200; body key `post` có object đúng toàn bộ Post DTO được định nghĩa ngay dưới bảng.                                                                                                                             |
| POST /api/forum/posts                                   | JSON chính xác {"topic":"Học tập","title":"Cách ôn môn cơ sở dữ liệu","content":"Nội dung dạng văn bản."}. Chỉ Student; author_id lấy từ JWT.             | HTTP 201; body key `post` có object đúng toàn bộ Post DTO được định nghĩa ngay dưới bảng.                                                                                                                             |
| GET /api/forum/posts/:id/comments?page=1&pageSize=20    | ID parent dương; page/pageSize như trên; không query khác/body. Parent không tồn tại/đã xóa → 404.                                                        | HTTP 200; `items` là mảng Comment DTO đầy đủ được định nghĩa ngay dưới bảng, `meta` gồm `page`, `pageSize`, `total`, `totalPages`; chỉ comment chưa xóa thuộc post còn public. Sort `created_at ASC, comment_id ASC`. |
| POST /api/forum/posts/:id/comments                      | ID parent dương; JSON chính xác {"content":"Nội dung bình luận."}. Chỉ Student; không nhận author_id/post_id ngoài path. Parent phải tồn tại và chưa xóa. | HTTP 201; body key `comment` có object đúng toàn bộ Comment DTO được định nghĩa ngay dưới bảng.                                                                                                                       |

Post response shape:

```json
{
  "id": 7,
  "title": "Cách ôn môn cơ sở dữ liệu",
  "topic": "Học tập",
  "content": "Nội dung dạng văn bản.",
  "author": { "fullName": "Sinh viên minh họa", "avatarUrl": null },
  "createdAt": "2026-10-28T00:00:00Z"
}
```

Comment response shape:

```json
{
  "id": 18,
  "content": "Bình luận dạng văn bản.",
  "author": { "fullName": "Sinh viên minh họa", "avatarUrl": null },
  "createdAt": "2026-10-28T00:00:00Z"
}
```

Examples are fabricated. Public endpoints never return author ID/email/google_sub, deleted content, deleted reason, activity data, or reviewer/admin metadata. A deleted parent suppresses its comments from public reads even if comment.is_deleted=false.

Errors: malformed ID → 400 INVALID_ID; unsupported/repeated query → 400 INVALID_QUERY; invalid JSON → 400 `INVALID_JSON`; wrong body shape/extra field → 400 `INVALID_REQUEST`; invalid field value → 400 `VALIDATION_ERROR`; missing/deleted post → 404 NOT_FOUND; Guest on write → 401 UNAUTHORIZED; Admin on Student write → 403 FORBIDDEN; DB unavailable → 503 SERVICE_UNAVAILABLE; unexpected → 500 INTERNAL_ERROR. Empty lists are 200 with empty items; database errors are not empty lists.

## Admin community moderation

All endpoints require Admin. Queue shows undeleted target posts/comments, newest first. Pagination uses the same 1/20/max100/page max1,000,000 rules; no search/filter/body. Unified queue sort is created_at DESC, targetType ASC (Comment before Post by lexical order), target id ASC.

| Method/path                                          | Request                                                                        | Success                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/admin/moderation/forum?page=1&pageSize=20   | Admin access JWT; no other query/body. Returns undeleted post/comment targets. | 200 {"items":[{"targetType":"Post","id":7,"title":"Cách ôn môn cơ sở dữ liệu","topic":"Học tập","content":"Nội dung dạng văn bản.","author":{"id":12,"fullName":"Sinh viên minh họa","avatarUrl":null},"createdAt":"2026-10-28T00:00:00Z"},{"targetType":"Comment","id":18,"post":{"id":7,"title":"Cách ôn môn cơ sở dữ liệu"},"content":"Bình luận dạng văn bản.","author":{"id":13,"fullName":"Sinh viên khác","avatarUrl":null},"createdAt":"2026-10-28T00:00:00Z"}],"meta":{"page":1,"pageSize":20,"total":2,"totalPages":1}}. |
| POST /api/admin/moderation/forum/posts/:id/remove    | ID dương; JSON chính xác {"reason":"Lý do vi phạm"}; trim, 1–500 ký tự.        | 200 {"removed":{"targetType":"Post","id":7,"isDeleted":true,"deletedAt":"2026-10-28T00:00:00Z"}}.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| POST /api/admin/moderation/forum/comments/:id/remove | ID dương; JSON chính xác {"reason":"Lý do vi phạm"}; trim, 1–500 ký tự.        | 200 {"removed":{"targetType":"Comment","id":18,"isDeleted":true,"deletedAt":"2026-10-28T00:00:00Z"}}.                                                                                                                                                                                                                                                                                                                                                                                                                              |

Admin queue does not expose email, google_sub, session data or other account PII. For a comment, its parent title/id are included for context. A post soft-delete hides all its comments publicly but does not hard-delete or rewrite their rows.

Errors: invalid ID → 400 INVALID_ID; malformed/empty/too-long reason → 400 VALIDATION_ERROR with fieldErrors; Guest 401; Student 403; missing target → 404 NOT_FOUND; a target concurrently removed after queue load → 409 CONTENT_ALREADY_REMOVED; DB unavailable → 503 SERVICE_UNAVAILABLE; unexpected → 500 INTERNAL_ERROR. “Giữ lại” is a UI-only action: it makes no request and writes no log.

## Data, transaction, tests and status

Public read touches forum_posts/comments/users and is read-only. Create writes the target row with author_id from JWT. Moderation of a post/comment is a single transaction: conditional soft-delete (is_deleted=true, deleted_at, deleted_reason), append-only activity_logs row (DELETE_POST/DELETE_COMMENT, old/new is_deleted only), and Violation notification to that target's author with reason. Any write failure rolls back all three. Notification event_id=NULL; UI destination is the approved common route /forum. There is no post/comment deep link in current schema. Runtime activity_logs stays SELECT/INSERT only.

Database PK/FK/NOT NULL/TEXT length do not enforce role, allowed topic, visibility, reason, author privacy, or transaction; backend enforces them.

Test matrix: Guest/Student/Admin per route; query/body/length boundaries; topic enum; empty list vs DB error; ordering/page ties; public author fields exactly fullName/avatarUrl; plain text rendering; missing/deleted parent; comment under removed post hidden publicly; Admin queue fields and ordering; reason trim and 1/500 boundaries; concurrent removal; audit payload ≤500; Violation content/reason and destination; transaction rollback if either audit or notification write fails; no hard delete or account lock. **Contract đã duyệt; API chưa triển khai trên main.**
