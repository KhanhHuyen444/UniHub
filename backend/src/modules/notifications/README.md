# notifications

Đã triển khai backend API theo [contract đã duyệt](../../../../docs/events-notifications-api-contract.md):

- `GET /api/notifications`: Student-only, phân trang, sort `created_at DESC, notification_id DESC`, owner từ JWT, unread count toàn bộ thông báo của owner. Items và counts dùng cùng transaction RepeatableRead.
- `PATCH /api/notifications/:id/read`: Student-only, không body/query, idempotent; thiếu hoặc khác owner cùng trả 404.
- Dùng chung auth/session middleware, Prisma runtime và error envelope; không ghi activity log khi đọc.

Tests: `backend/test/notifications.test.mjs` dùng Prisma test double, không kết nối database. Kiểm tra authorization, ownership, pagination, unread count, idempotency, validation và lỗi DB; không suy từ test double thành kết quả MySQL.

Review 31/10/2026: MySQL 8.4.13 mới hoàn toàn, migrations hiện có, port/datadir/UUID được runner kiểm chứng: **5 test pass, 0 fail/skip** (4 subcase và parent). Owner filter với hai Student, tie-break pagination, unreadCount toàn bộ dù pageSize=1, idempotent read chỉ đổi is_read, cross-owner 404, trang vượt phạm vi, FK cascade chỉ xóa Reminder và không tạo log đều đã chạy bằng service/Prisma/MySQL thật. Chạy sau build: `node backend/test/run-notifications-mysql.mjs --run-isolated`. Không nạp `.env`, không dùng database cá nhân/nhóm hoặc thay grants/schema. Snapshot dưới mutation đồng thời chưa được benchmark/kiểm thử race riêng.

Runtime nhánh `e3fbb3a`: Google Student thật do người dùng đăng nhập, Express/MySQL test thật: GET Notifications 200; click Reminder qua panel thực hiện PATCH không body/query, read từ false sang true và unreadCount 1→0, rồi GET Events mở chi tiết trong panel, không đổi route. Guest không token 401; PATCH có body hoặc query 400. Fixture Reminder đã có trong database test; không khẳng định một checkout đã tích hợp scheduler/bell/Calendar. Admin Google UI/API thực chưa chạy; ma trận role hiện có trong test double.

Scheduler, frontend và writer Violation chưa triển khai trong phần này; TV5 cần phối hợp writer trong transaction riêng sau.

Phụ trách: **TV4**. Chưa gán tên người hoặc deadline.

Router/service nằm trong module này. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md) và [quy ước API](../../../../docs/api-conventions.md).
