# events

## Review Reminders 31/10/2026 — PR #26

Đã cập nhật nhánh bằng `origin/main=df6a277` (merge sạch, không conflict thực tế); không đưa Calendar, Notifications hoặc Dashboard đang mở vào PR này. Không phát hiện regression cần sửa trong Reminder service tại head `006f810`; giữ nguyên logic production.

Đã chạy lại **19/19 test MySQL thật, 0 skip/0 fail** trên MySQL 8.4.13 mới hoàn toàn, cổng/datadir/UUID riêng đã xác minh, migrations hiện có. Bao gồm hai worker không trùng, rollback/retry, race deadline/remindBefore/Completed/DELETE, no-op, DATETIME(0), batch/cursor và event quá hạn. Runner Windows: `node backend/test/run-reminders-mysql.mjs --run-isolated` sau build. Không nạp `.env`, không dùng database cá nhân/nhóm, không thay quyền SQL hoặc schema/migration. Các ghi nhận cũ “chưa có MySQL” không còn đúng với lần chạy có guard này.

Root typecheck/build đạt. Root tests: frontend 78 pass / 31 skip, backend 164 pass / 18 skip, 0 fail; các integration không cấu hình test URL vẫn skip trong root run, khác với 19 test đã chạy bằng runner riêng. Không thêm endpoint kích hoạt scheduler. Notifications API/bell và Calendar UI vẫn ở PR riêng; chưa có checkout tích hợp nên không kết luận chuỗi xuyên PR đã đạt.

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
được ghi trực tiếp bằng `tx.notification.create`. Tuyen phụ trách Notifications API
(list/read) và bell UI; Vy điều phối chức năng thông báo Violation. Task 2 phụ trách
Reminder Service và scheduler 60 giây. Review phần server lifecycle với TV1
và transaction liên module với Tuyen và Vy trước khi tích hợp.

Kiểm thử unit: `backend/test/reminders.test.mjs`. Kiểm thử MySQL:
`backend/test/reminders-mysql.test.mjs`, chỉ bật khi `TEST_REMINDERS_DATABASE_URL`
được cấp riêng tới MySQL loopback, database tên `unihub_reminders_test` hoặc
`unihub_reminders_test_<suffix chữ/số>`, đã áp dụng migration hiện có. Tuyệt đối
không trỏ tới DB phát triển/production. Test chỉ tạo/xóa dữ liệu của user test
riêng, không tự migrate, không đọc `.env`, không dùng fallback `DATABASE_URL`.
Nếu không cấp DB này, test MySQL bị skip và lần chạy đó không xác minh concurrency thực tế.

Đã chạy kiểm thử tích hợp trên database MySQL 8.4.13 riêng biệt, đã áp dụng đủ
3 Prisma migration hiện có. Lệnh `node --test test/reminders-mysql.test.mjs`
(tại thư mục `backend`): **19 test passed, 0 failed, 0 skipped**, khoảng 5,16 giây.
Phạm vi gồm chống trùng, rollback/retry, race với `dueDate`/`remindBefore`/
`Completed`/`DELETE`, biên `DATETIME(0)` và quét theo batch.

`remindBefore=0` không nhắc theo công thức approved. Không cam kết chính xác từng
giây: lượt chạy dài bỏ qua tick chồng, event mới qua ngưỡng được xử lý ở lượt sau.
