# Hợp đồng API diễn đàn và kiểm duyệt

> **Contract: leader đã duyệt. Implementation: forum/moderation routes và frontend đã có trên `main` và nhánh tài liệu hiện tại.** Backend mount `/api/forum` và `/api/admin/moderation/forum`; frontend có Hub/detail và tab Giám sát cộng đồng tại `/admin/moderation`. Phạm vi Chương 3 UC-08–UC-11: đọc public, Student đăng bài/bình luận, Admin xóa mềm nội dung vi phạm. Không có edit post, student-delete, rich HTML hoặc account lock.

## Chuẩn hóa và pagination

Guest/Student đọc nội dung public. Chỉ Student tạo post/comment; Guest nhận 401 UNAUTHORIZED, Admin nhận 403 FORBIDDEN. Admin moderation yêu cầu access token và requireRole(Admin). Query page mặc định là 1, pageSize mặc định là 20; pageSize từ 1–100, page tối đa 1,000,000; mỗi query chỉ xuất hiện một lần; query lạ/bị lặp/sai trả 400 INVALID_QUERY. totalPages=ceil(total/pageSize), bằng 0 khi total=0; page vượt phạm vi trả items=[] cùng total thực.

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

Ví dụ là dữ liệu hư cấu. Endpoint public không trả ID/email/google_sub của tác giả, nội dung đã xóa, lý do xóa, dữ liệu activity hoặc metadata reviewer/Admin. Khi bài đăng cha bị xóa, các bình luận của bài đó cũng không xuất hiện trong kết quả đọc public, kể cả khi comment.is_deleted=false.

Lỗi: ID sai định dạng → 400 INVALID_ID; query không hỗ trợ/bị lặp → 400 INVALID_QUERY; JSON sai → 400 `INVALID_JSON`; body sai cấu trúc/có field thừa → 400 `INVALID_REQUEST`; giá trị field không hợp lệ → 400 `VALIDATION_ERROR`; bài đăng không tồn tại/đã xóa → 404 NOT_FOUND; Guest khi ghi → 401 UNAUTHORIZED; Admin khi thực hiện thao tác dành cho Student → 403 FORBIDDEN; DB không khả dụng → 503 SERVICE_UNAVAILABLE; lỗi ngoài dự kiến → 500 INTERNAL_ERROR. Danh sách rỗng trả 200 với items rỗng; lỗi database không được xem là danh sách rỗng.

## Admin kiểm duyệt cộng đồng

Mọi endpoint đều yêu cầu Admin. Hàng đợi hiển thị bài đăng/bình luận mục tiêu chưa bị xóa, mới nhất trước. Pagination dùng cùng quy tắc 1/20/max100/page tối đa 1,000,000; không có search/filter/body. Thứ tự hàng đợi hợp nhất là created_at DESC, targetType ASC (Comment đứng trước Post theo thứ tự từ điển), rồi target id ASC.

| Method/path                                          | Request                                                                        | Success                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/admin/moderation/forum?page=1&pageSize=20   | Admin access JWT; no other query/body. Returns undeleted post/comment targets. | 200 {"items":[{"targetType":"Post","id":7,"title":"Cách ôn môn cơ sở dữ liệu","topic":"Học tập","content":"Nội dung dạng văn bản.","author":{"id":12,"fullName":"Sinh viên minh họa","avatarUrl":null},"createdAt":"2026-10-28T00:00:00Z"},{"targetType":"Comment","id":18,"post":{"id":7,"title":"Cách ôn môn cơ sở dữ liệu"},"content":"Bình luận dạng văn bản.","author":{"id":13,"fullName":"Sinh viên khác","avatarUrl":null},"createdAt":"2026-10-28T00:00:00Z"}],"meta":{"page":1,"pageSize":20,"total":2,"totalPages":1}}. |
| POST /api/admin/moderation/forum/posts/:id/remove    | ID dương; JSON chính xác {"reason":"Lý do vi phạm"}; trim, 1–500 ký tự.        | 200 {"removed":{"targetType":"Post","id":7,"isDeleted":true,"deletedAt":"2026-10-28T00:00:00Z"}}.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| POST /api/admin/moderation/forum/comments/:id/remove | ID dương; JSON chính xác {"reason":"Lý do vi phạm"}; trim, 1–500 ký tự.        | 200 {"removed":{"targetType":"Comment","id":18,"isDeleted":true,"deletedAt":"2026-10-28T00:00:00Z"}}.                                                                                                                                                                                                                                                                                                                                                                                                                              |

Hàng đợi Admin không để lộ email, google_sub, dữ liệu session hoặc thông tin định danh cá nhân tài khoản khác. Với bình luận, title/id của bài đăng cha được đưa vào để làm ngữ cảnh. Xóa mềm bài đăng sẽ ẩn công khai mọi bình luận của bài đó, nhưng không xóa cứng hoặc ghi lại các hàng bình luận.

Lỗi: ID không hợp lệ → 400 INVALID_ID; reason sai định dạng/rỗng/quá dài → 400 VALIDATION_ERROR kèm fieldErrors; Guest 401; Student 403; không tìm thấy mục tiêu → 404 NOT_FOUND; mục tiêu bị xóa đồng thời sau khi tải hàng đợi → 409 CONTENT_ALREADY_REMOVED; DB không khả dụng → 503 SERVICE_UNAVAILABLE; lỗi ngoài dự kiến → 500 INTERNAL_ERROR. “Giữ lại” chỉ là thao tác UI: không gửi request và không ghi log.

## Dữ liệu, transaction, kiểm thử và trạng thái

Đọc public chỉ truy vấn forum_posts/comments/users. Khi tạo, hệ thống ghi hàng mục tiêu với author_id lấy từ JWT. Kiểm duyệt bài đăng/bình luận diễn ra trong một transaction: xóa mềm có điều kiện (is_deleted=true, deleted_at, deleted_reason), thêm hàng activity_logs chỉ ghi nối tiếp (DELETE_POST/DELETE_COMMENT, chỉ lưu is_deleted cũ/mới) và tạo thông báo Violation cho tác giả của mục tiêu, kèm lý do. Nếu bất kỳ thao tác ghi nào lỗi, cả ba đều rollback. Notification event_id=NULL; đích UI là route chung /forum đã được duyệt. Schema hiện tại không có deep link tới bài đăng/bình luận. activity_logs trong runtime chỉ được SELECT/INSERT.

Database PK/FK/NOT NULL/TEXT length do not enforce role, allowed topic, visibility, reason, author privacy, or transaction; backend enforces them.

Ma trận test: Guest/Student/Admin theo từng route; biên query/body/độ dài; enum topic; phân biệt danh sách rỗng với lỗi DB; thứ tự và trường hợp trùng trang; field tác giả public chỉ gồm fullName/avatarUrl; hiển thị plain text; parent không tồn tại/đã xóa; bình luận thuộc bài bị xóa được ẩn khi đọc public; field và thứ tự hàng đợi Admin; trim reason và biên 1/500; xóa đồng thời; audit payload ≤500; nội dung/reason và đích của Violation; rollback transaction nếu thao tác ghi audit hoặc notification lỗi; không xóa cứng hoặc khóa tài khoản.
