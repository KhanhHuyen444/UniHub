# notifications

Đã triển khai backend API theo [contract đã duyệt](../../../../docs/events-notifications-api-contract.md):

- `GET /api/notifications`: Student-only, phân trang, sort `created_at DESC, notification_id DESC`, owner từ JWT, unread count toàn bộ thông báo của owner. Items và counts dùng cùng transaction RepeatableRead.
- `PATCH /api/notifications/:id/read`: Student-only, không body/query, idempotent; thiếu hoặc khác owner cùng trả 404.
- Dùng chung auth/session middleware, Prisma runtime và error envelope; không ghi activity log khi đọc.

Tests: `backend/test/notifications.test.mjs` dùng Prisma test double, không kết nối database. Kiểm tra authorization, ownership, pagination, unread count, idempotency, validation và lỗi DB. Chưa xác minh snapshot/concurrency bằng MySQL thật.

Scheduler, frontend và writer Violation chưa triển khai trong phần này; TV5 cần phối hợp writer trong transaction riêng sau.

Phụ trách: **TV4**. Chưa gán tên người hoặc deadline.

Router/service nằm trong module này. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md) và [quy ước API](../../../../docs/api-conventions.md).
