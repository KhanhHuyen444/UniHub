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

Email outbox: `EVENT_REMINDER_EMAIL_ENABLED` mặc định `false`; khi tắt,
scheduler giữ bell-only và không đọc/ghi bảng email. Khi bật (`true`), cần
`EMAIL_FROM` là một địa chỉ email không có display name,
`EMAIL_IDEMPOTENCY_NAMESPACE` ổn định theo môi trường/database (1–64 ký tự
`[a-z0-9-]`) và `APP_BASE_URL` là origin HTTPS (chỉ cho HTTP loopback ngoài
production). Cấu hình bật nhưng không hợp lệ làm scheduler khởi tạo thất bại,
không tự chuyển bell-only. Chỉ bật sau khi migration và quyền runtime sẵn sàng.

Cùng transaction Serializable, scheduler cập nhật `reminded_at`, tạo bell Reminder
và tạo một email job có PK/FK là notification ID. Owner phải là Student và recipient
phải hợp lệ; lỗi payload/insert rollback toàn bộ, được báo bằng lỗi vận hành đã che
dữ liệu tại scheduler. P2034 vẫn thử tối đa 3 lần; lỗi khác được xét lại ở vòng quét
sau, có thể cần cursor wrap chứ không bảo đảm ngay tick kế tiếp.

Payload JSON giữ nguyên sender/recipient/subject/HTML/text và deadline giờ Việt Nam,
link `/calendar` dùng xác thực ứng dụng; key cố định theo namespace + notification ID.
Sửa title/notes không đổi snapshot; đổi deadline/remindBefore hoặc xóa Event giữ
nguyên logic xóa Reminder và FK cascade. Test enqueue mock riêng:
`backend/test/reminder-email.test.mjs`; không thay thế kiểm chứng MySQL thực tế.

Phase 3 bổ sung worker và Resend HTTP adapter, dùng cùng cờ bật email. Worker poll
mỗi 5 giây, tối đa 2 send slot trên mỗi backend instance; claim bằng transaction
READ COMMITTED, `FOR UPDATE SKIP LOCKED`, lease 60 giây và UUID mới mỗi claim.
Attempt tăng ngay khi claim commit, kể cả crash trước request. Mỗi claim tối đa một
HTTP request timeout 10 giây; không gọi provider trong transaction. Không dùng SDK
retry. Server dừng poll/abort request khi shutdown và chờ tác vụ settle trước khi
disconnect Prisma (giữ giới hạn shutdown hiện có).

State: Pending/Retry -> Processing -> Accepted/Retry/Cancelled/Dead. Terminal state
không tự mở lại. Recovery tối đa 20 lease hết hạn mỗi tick; mọi write kiểm tra state,
attempt, token và lease bằng giờ DB. Recovery giữ nguyên attempt và backoff từ thời
điểm lease hết hạn. Lỗi DB/commit không rõ kết quả để lease recovery xử lý, không
gọi provider lại trong cùng claim.

Tối đa 6 claim; backoff sau lỗi lần 1–5: 30 giây, 2 phút, 10 phút, 30 phút, 2 giờ.
429 dùng giá trị lớn hơn giữa backoff và Retry-After; nếu provider yêu cầu hơn 6 giờ
thì Dead, không gửi sớm hơn yêu cầu. 408/network/timeout/5xx và idempotency đang xử
lý được retry; 4xx vĩnh viễn hoặc cùng key khác body thành Dead. Không gửi nếu
request timeout có thể vượt deadline hoặc `first_attempt_at + 23 giờ`. Resend giữ
key 24 giờ; biên 23 giờ là khoảng an toàn cục bộ, không phải bảo đảm exactly-once.

Claim/preflight/recovery đọc Notification -> Event và User của Notification; backend
kiểm tra Event/Notification cùng owner Student, Upcoming, deadline tương lai, marker
đã nhắc, remindBefore > 0 và đang trong cửa sổ nhắc. Recipient hiện tại phải giống
recipient trong payload. Payload/key đã lưu được gửi nguyên byte; không đọc lại
sender/template/base URL để render. Title/notes không tham gia eligibility.
Completed/Overdue/recipient đổi/mất eligibility -> Cancelled; xóa Reminder/Event
thì cascade job. Accepted chỉ là provider nhận xử lý, không xác nhận inbox delivery.

Có race không thể loại bỏ giữa preflight commit và request: sửa/xóa/Completed sau
preflight không thu hồi được request đã phát. Fencing bảo vệ DB; idempotency bảo vệ
request lặp trong cửa sổ provider. Outcome timeout/Dead có thể đã được provider nhận.
Không backfill/reconcile/purge, không sửa activity_logs, không thêm endpoint/broker.

Rollout (không thực hiện trong Phase 3 này): giữ cờ false; người quản trị xác nhận
migration đã được duyệt/áp dụng, runtime có SELECT/INSERT/UPDATE trên bảng mới; cấu
hình sender/domain đã verify tại Resend hoặc Gmail SMTP (`EMAIL_PROVIDER=resend|gmail-smtp`),
`APP_BASE_URL` đúng origin ứng dụng, namespace ổn định và riêng cho environment/database lineage.
Sau review/test MySQL cô lập mới đặt cờ true và restart backend. Cờ true
bật cả enqueue lẫn gửi thật, không có chế độ enqueue-only. Thiếu key/config thì
khởi tạo thất bại có thông báo đã che dữ liệu, không fallback bell-only. Đặt false
và restart sẽ dừng cả worker lẫn enqueue; job cũ giữ nguyên, revalidate khi bật lại.
Không dùng key/namespace của production để gửi job từ database clone/restore.

### Cấu hình Gmail SMTP (Nodemailer) cho Demo

Hệ thống hỗ trợ gửi email trực tiếp qua Gmail SMTP bằng Google App Password:

1. `EMAIL_PROVIDER=gmail-smtp`: Kích hoạt transport SMTP thay cho Resend.
2. `GMAIL_SMTP_USER`: Tài khoản Gmail gửi thư (mặc định lấy giá trị `EMAIL_FROM` nếu để trống).
3. `GMAIL_APP_PASSWORD`: Mật khẩu ứng dụng 16 ký tự tạo tại `myaccount.google.com/apppasswords`
   (yêu cầu tài khoản Google đã bật Xác minh 2 bước; không dùng mật khẩu đăng nhập chính).
4. `EMAIL_FROM`: Địa chỉ Gmail của tài khoản gửi (ví dụ: `myaccount@gmail.com`).
5. `EMAIL_FROM_NAME`: Tên hiển thị người gửi (mặc định là `UniHub` nếu không thiết lập; khi gửi qua Nodemailer sẽ dùng định dạng `{ name: 'UniHub', address: EMAIL_FROM }`).

**Gửi thật tới các thành viên:**
Hệ thống không hardcode danh sách email nhận. Recipient được lấy động từ trường `users.email`
của tài khoản Student sở hữu Event khi đăng nhập Google. Khi 5 thành viên nhóm đăng nhập
bằng tài khoản Google cá nhân và tạo Event có đặt lịch nhắc, worker sẽ tự động gửi email nhắc hạn
tới đúng địa chỉ Gmail của từng thành viên.

**Đặc thù Idempotency & Retry trên SMTP:**
Khác với API HTTP của Resend hỗ trợ header `Idempotency-Key` phía server, giao thức SMTP tiêu chuẩn
không có cơ chế deduplication tích hợp trên máy chủ. Header `X-Idempotency-Key` được đính kèm vào email
để truy vết. Nếu xảy ra đứt kết nối mạng sau lệnh `DATA` nhưng trước khi nhận mã phản hồi `250 OK`,
lượt retry tiếp theo có thể dẫn đến việc người nhận nhận thư trùng lặp. Lỗi xác thực (535) và từ chối địa chỉ
(5xx) được đánh dấu vĩnh viễn (`Dead`, không retry) để tránh khóa tài khoản do spam đăng nhập sai.
Lỗi tạm thời (421, 450, 452) tuân thủ chính sách backoff tối đa 6 lần thử. Tuyệt đối không log thông tin
mật khẩu ứng dụng, email cá nhân hay nội dung thư.

Test fake-only (tại gốc sau backend build):
`node --test backend/test/mail-transport.test.mjs backend/test/reminder-email-worker.test.mjs backend/test/reminder-email.test.mjs backend/test/reminders.test.mjs backend/test/shutdown.test.mjs`.
SQL fake kiểm tra câu lệnh/fencing/policy và concurrency logic, không chứng minh
MySQL SKIP LOCKED/FK/transaction thực tế. Chưa chạy migration, MySQL hoặc Resend
trong Phase 3; kết quả test MySQL cũ ở trên không bao phủ email outbox mới.

Tham chiếu: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[send API](https://resend.com/docs/api-reference/emails/send-email),
[errors](https://resend.com/docs/api-reference/errors).
