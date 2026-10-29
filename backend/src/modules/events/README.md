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

## Deadline Reminders (Task 2)

Nhánh `feat/event-reminders` thêm scheduler chạy ngay sau khi HTTP server bắt đầu
nghe, sau đó mỗi 60 giây. Mỗi tiến trình chỉ chạy một lượt tại một thời điểm;
khi shutdown, scheduler không thể khởi động lại, ngừng nhận lượt mới và chờ
transaction hiện tại trước khi đóng Prisma. Deadline 30 giây bao phủ HTTP,
scheduler và đóng pool. Nếu quá hạn, tiến trình thoát với mã 1, không gọi
Prisma disconnect trên transaction còn chạy; MySQL xử lý kết nối bị đóng.
Không thể khẳng định kết quả của commit đang diễn ra khi bị buộc thoát.
Không có endpoint kích hoạt, dependency cron, purge hoặc thay đổi schema.

`reminders.service.ts` dùng SQL có tham số để chọn Upcoming đã hết hạn hoặc chưa
nhắc và đang trong ngưỡng remind_before, sắp due_date ASC/event_id ASC, tối đa
100 event mỗi tick. Cursor trong bộ nhớ tiếp tục sau từng event đã thử, kể cả lỗi;
watermark ID cố định cho mỗi vòng để insert mới không kéo dài vòng vô hạn.
Hết vòng thì quay về đầu để thử lại lỗi và event đổi hạn về trước cursor; ID mới
được xét ở vòng tiếp theo. Restart tạo vòng mới, không lưu cursor vào DB.
Các caller chạy nhiều tick dùng chung `scanState`, như scheduler hiện tại.
Không mở transaction cho
Upcoming ngoài ngưỡng hoặc đã nhắc mà chưa hết hạn. SQL vẫn có thể cần quét/sort
nhiều row ở DB vì schema hiện tại không có index dành cho scheduler; chưa benchmark.
Mỗi event được đọc lại trong
transaction Serializable, claim bằng conditional update và tạo Reminder cùng
transaction. Event quá hạn chuyển Overdue, không tạo thông báo; Completed/Overdue
không được nhắc. Conflict P2034 thử tối đa 3 lần, đọc lại dữ liệu và clock;
lỗi khác thử lại ở vòng quét sau. Lỗi riêng lẻ không ngăn event kế tiếp; sau 3 lỗi
liên tiếp thì dừng tick và tick sau tiếp tục sau event lỗi cuối, tránh chặn backlog.
Lỗi quét/DB được
ghi thông báo chung, không log exception có dữ liệu nhạy cảm.

Không có shared Notification writer hỗ trợ transaction hiện tại, nên Reminder
được ghi trực tiếp bằng `tx.notification.create`. API list/read, bell UI và
Violation thuộc Vy, không nằm trong Task 2. Review phần server lifecycle với TV1
và transaction liên module với Vy trước khi tích hợp.

Kiểm thử unit: `backend/test/reminders.test.mjs`. Kiểm thử MySQL:
`backend/test/reminders-mysql.test.mjs`, chỉ bật khi `TEST_REMINDERS_DATABASE_URL`
được cấp riêng tới MySQL loopback, database tên `unihub_reminders_test` hoặc
`unihub_reminders_test_<suffix chữ/số>`, đã áp dụng migration hiện có. Tuyệt đối
không trỏ tới DB phát triển/production. Test chỉ tạo/xóa dữ liệu của user test
riêng, không tự migrate, không đọc `.env`, không dùng fallback `DATABASE_URL`.
Nếu không cấp DB này, test MySQL bị skip và concurrency chưa được xác minh thực tế.

`remindBefore=0` không nhắc theo công thức approved. Không cam kết chính xác từng
giây: lượt chạy dài bỏ qua tick chồng, event mới qua ngưỡng được xử lý ở lượt sau.
