# events

Đã triển khai: **Backend CRUD Calendar Events (FR-04.1)** theo [hợp đồng API](../../../../docs/events-notifications-api-contract.md).

Phụ trách: **TV4**.

## Các endpoint đã triển khai

| Method/Path                           | Vai trò | Mô tả                                                                                                                                                                                                            |
| :------------------------------------ | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/events?from={utc}&to={utc}` | Student | Lấy danh sách sự kiện cá nhân trong khoảng lịch tối đa 42 ngày (biên nửa đêm theo múi giờ `Asia/Ho_Chi_Minh`), sắp xếp `dueDate ASC, id ASC`.                                                                    |
| `POST /api/events`                    | Student | Tạo sự kiện cá nhân mới (`status: Upcoming`, `remindedAt: null`, `remindBefore: 24`, hạn tương lai `> evaluatedAt`).                                                                                             |
| `GET /api/events/:id`                 | Student | Lấy chi tiết sự kiện theo ID; cách ly quyền sở hữu (event không tồn tại hoặc của người khác cùng trả 404 `NOT_FOUND`).                                                                                           |
| `PATCH /api/events/:id`               | Student | Cập nhật thông tin/hạn sự kiện. Chuyển trạng thái `Upcoming`/`Overdue` (hoặc giữ `Completed`). Giao dịch nguyên tử reset `reminded_at = null` và xóa Reminder notifications cũ khi đổi `dueDate`/`remindBefore`. |
| `PATCH /api/events/:id/status`        | Student | Đánh dấu sự kiện hoàn thành (`status: Completed`), có tính idempotent.                                                                                                                                           |
| `DELETE /api/events/:id`              | Student | Xóa sự kiện vật lý (HTTP 204); FK cascade tự động xóa các Reminder notifications liên quan.                                                                                                                      |

## Bảo mật và phân quyền

- Mọi route đều yêu cầu Student JWT (`requireAuth` + `requireRole('Student')`).
- Guest nhận 401 `UNAUTHORIZED`.
- Admin nhận 403 `FORBIDDEN`.
- Quyền sở hữu được kiểm tra chặt chẽ trên backend; không để lộ thông tin của người dùng khác.

## Phần chưa triển khai trong module này

- `GET /api/notifications` và `PATCH /api/notifications/:id/read` (FR-04.2 / Notification routes).
- Cronjob Reminder Scheduler chạy ngầm mỗi phút phát thông báo nhắc hạn.
