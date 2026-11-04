# forum

Đã triển khai các endpoint đọc công khai:

- `GET /api/forum/posts`: danh sách bài viết công khai, lọc theo topic, phân trang.
- `GET /api/forum/posts/:id`: chi tiết bài viết công khai chưa bị xóa mềm.
- `GET /api/forum/posts/:id/comments`: danh sách bình luận công khai theo bài viết cha.

Đã triển khai API ghi cho Student theo UC-08/UC-09:

- `POST /api/forum/posts`: tạo bài viết, validate chủ đề/tiêu đề/nội dung và lấy tác giả từ JWT.
- `POST /api/forum/posts/:id/comments`: tạo bình luận sau khi xác nhận bài viết cha còn công khai.

Các endpoint ghi dùng auth/session middleware chung; Guest nhận 401, Admin nhận 403. Nội dung được lưu dạng plain text sau khi chuẩn hóa newline, loại bỏ control character và trim; client phải render bằng text node.

Admin moderation được mount riêng tại `/api/admin/moderation/forum`:

- `GET /api/admin/moderation/forum`: queue bài viết/bình luận chưa xóa, sort và phân trang theo contract.
- `POST /api/admin/moderation/forum/posts/:id/remove`: xóa mềm bài viết.
- `POST /api/admin/moderation/forum/comments/:id/remove`: xóa mềm bình luận.

Mỗi thao tác remove soft-delete, ghi Activity Log và tạo Violation notification trong cùng Prisma transaction. Target đã gỡ trả 409; không có hard delete hoặc khóa tài khoản.

Contract: [forum-api-contract.md](../../../../docs/forum-api-contract.md).

Phụ trách: **TV5**. Theo [quy trình nhóm](../../../../docs/team-workflow.md) và [quy ước API](../../../../docs/api-conventions.md).
