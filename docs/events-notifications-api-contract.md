# Hợp đồng API sự kiện, nhắc hạn và thông báo

> **Contract: leader đã duyệt. Event/notification routes và bell scheduler đã merge tại main `c310a4c`; email đang ở nhánh phát triển.** Student là người sở hữu dữ liệu; không tự purge thông báo theo tuổi. Chính sách xóa Reminder khi sửa/xóa event vẫn giữ nguyên.

## Hợp đồng thời gian và response dùng chung

API trao đổi instant ISO 8601 có Z; DB/session UTC; UI hiển thị Asia/Ho_Chi_Minh. Response event:

```json
{
  "id": 5,
  "title": "Hạn nộp báo cáo",
  "dueDate": "2026-11-05T17:00:00Z",
  "remindBefore": 24,
  "notes": null,
  "status": "Upcoming",
  "remindedAt": null,
  "createdAt": "2026-10-28T00:00:00Z",
  "updatedAt": "2026-10-28T00:00:00Z"
}
```

Ví dụ giả. Fields tương ứng events.event_id, title, due_date, remind_before, notes, status, reminded_at, created_at, updated_at; không trả user_id. Mọi ID lấy từ JWT hoặc path.

## Sự kiện cá nhân

Mọi route dưới đây yêu cầu Student access JWT. Guest → 401 UNAUTHORIZED; Admin → 403 FORBIDDEN. Ownership kiểm tra ở backend; event không tồn tại và event của người khác cùng 404 NOT_FOUND.

| Method/path                         | Request                                                                                                                                                                                                                                                                                                    | Success                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/events?from={utc}&to={utc} | from và to bắt buộc, mỗi tham số đúng một lần; không body, pagination hoặc query lạ. Hai instant Z phải đúng nửa đêm địa phương theo quy tắc bên dưới.                                                                                                                                                     | HTTP 200 `{ "items": [{ "id": 5, "title": "Hạn nộp báo cáo", "dueDate": "2026-11-05T17:00:00Z", "remindBefore": 24, "notes": null, "status": "Upcoming", "remindedAt": null, "createdAt": "2026-10-28T00:00:00Z", "updatedAt": "2026-10-28T00:00:00Z" }] }`; mỗi phần tử có đúng 9 field/type như Event DTO ở đầu tài liệu. Không phân trang; sort `dueDate ASC, id ASC`. |
| POST /api/events                    | JSON chính xác {"title":"Ôn thi","dueDate":"2026-11-05T17:00:00Z","remindBefore":24,"notes":null}. title trim, 1–255 ký tự; dueDate ISO UTC hợp lệ và > evaluatedAt; remindBefore optional nonnegative integer, default 24; notes optional/null, tối đa 1000 ký tự. Không nhận owner/status/remindedAt/ID. | HTTP 201; body có key `event` với object gồm đúng các field của Event DTO đã định nghĩa ở đầu tài liệu; `status=Upcoming`, `remindedAt=null`.                                                                                                                                                                                                                             |
| GET /api/events/:id                 | ID path là số nguyên dương; không body/query.                                                                                                                                                                                                                                                              | HTTP 200; body có key `event` với object gồm đúng các field của Event DTO đã định nghĩa ở đầu tài liệu.                                                                                                                                                                                                                                                                   |
| PATCH /api/events/:id               | JSON patch phải có ít nhất một field trong `title`, `dueDate`, `remindBefore`, `notes`; ví dụ chính xác `{"notes":"Ghi chú mới"}`. Field lạ/owner/status/remindedAt bị từ chối. Quy tắc từng field như POST; nếu dueDate được đổi thì phải > evaluatedAt; chỉ sửa nội dung được giữ hạn cũ đã qua.         | HTTP 200; body có key `event` với object gồm đúng các field của Event DTO đã định nghĩa ở đầu tài liệu.                                                                                                                                                                                                                                                                   |
| PATCH /api/events/:id/status        | JSON chính xác {"status":"Completed"}. Student chỉ được chọn Completed; không nhận Upcoming/Overdue.                                                                                                                                                                                                       | HTTP 200; body có key `event` với object gồm đúng các field của Event DTO đã định nghĩa ở đầu tài liệu; Completed hiện có trả 200 không đổi.                                                                                                                                                                                                                              |
| DELETE /api/events/:id              | ID path hợp lệ; không body/query. Owner only.                                                                                                                                                                                                                                                              | 204 không body. Xóa event vật lý; FK cascade xóa Reminder rows liên quan.                                                                                                                                                                                                                                                                                                 |

evaluatedAt là một instant UTC cho validation của mỗi request. Với PATCH: Completed giữ nguyên status; event chưa hoàn thành với dueDate tương lai thành Upcoming; dueDate đã qua hoặc bằng now thành Overdue, đúng UC-07 flow 3a3. Body không cho Student tự đặt Overdue hoặc mở lại Completed. ID sai → 400 `INVALID_ID`; JSON sai cú pháp → 400 `INVALID_JSON`; body sai shape/field thừa → 400 `INVALID_REQUEST`; giá trị field sai hoặc transition không hợp lệ → 400 `VALIDATION_ERROR` với `fieldErrors` tùy chọn; DB unavailable → 503 SERVICE_UNAVAILABLE; lỗi bất ngờ → 500 INTERNAL_ERROR.

### Khoảng ngày lịch cho GET /api/events — quyết định kỹ thuật đã duyệt

Giới hạn 42 ngày lịch (sáu tuần), khoảng **[from,to)**, là quyết định kỹ thuật; không phải số đo Figma. Figma handoff chưa cho thấy lưới/ngày kề để suy ra số đo trực tiếp. Frontend gửi ngày đầu và ngày sau ngày cuối của toàn bộ grid đang hiển thị, gồm ngày thuộc tháng trước/sau nếu grid có. from và to phải là ISO instant với Z, mỗi instant sau khi đổi sang Asia/Ho_Chi_Minh phải trùng 00:00. DB query dùng due_date >= from AND due_date < to; from inclusive, to exclusive; độ dài giữa hai local dates không vượt 42 ngày.

Ví dụ grid hiển thị 26/10 đến hết 06/12/2026: from=2026-10-25T17:00:00Z, to=2026-12-06T17:00:00Z (to là 00:00 ngày 07/12 Việt Nam). Range ngược, thiếu/lặp/không hỗ trợ query, biên không phải nửa đêm Việt Nam hoặc range >42 ngày → 400 INVALID_QUERY. Không phân trang vì lịch cần toàn bộ event trong khoảng.

## Transaction của event và Reminder

POST tạo một event; DB ghi user_id từ JWT và status Upcoming. PATCH ownership + update trong một transaction. Nếu dueDate hoặc remindBefore đổi, cùng transaction đặt reminded_at=NULL và xóa tất cả notification type=Reminder cũ của event. Nếu một thao tác lỗi thì rollback cả update, reset và delete. Chỉ sửa title/notes thì không reset Reminder. PATCH status chỉ thay status; không tạo hoặc xóa notification. DELETE event dựa trên notifications.event_id ON DELETE CASCADE; không thay thành manual hard-delete thông báo khác.

Database CHECK giới hạn status và remindBefore; FK kiểm tra cấu trúc. Backend kiểm tra owner, thời gian tương lai, patch shape, transitions, reset/deletion semantics, và transaction.

### Scheduler nội bộ (không phải HTTP endpoint)

Cấu hình vận hành đã chọn: scheduler chạy mỗi phút. Đây không phải cam kết mọi Reminder được phát đúng từng giây; thời gian thực tế phụ thuộc chu kỳ chạy và tải. Mỗi lượt lấy Upcoming event: nếu due_date > now, due_date - now <= remind_before giờ và reminded_at IS NULL, tạo một Reminder cho owner và cập nhật reminded_at trong cùng transaction. Khi dueDate đã qua, scheduler chuyển event chưa hoàn thành sang Overdue. Không nhắc Completed/Overdue; Student không được gửi status Overdue. UC-07 edit flow cũng có thể khiến backend đặt Overdue trong transaction PATCH.

Concurrent worker phải khóa/conditional-update để không tạo trùng. Lỗi rollback notification/reminded_at cả hai; thử lại ở chu kỳ sau. Scheduler không chạy purge/retention. Không có endpoint gọi scheduler.

### Email Reminder nội bộ — phần mở rộng đã duyệt

Không thay request/response hoặc thêm endpoint. Khi email tắt (mặc định), scheduler
giữ bell-only và không truy cập outbox. Khi bật, cùng transaction Serializable phải
commit cả reminded_at, bell Reminder và job `event_reminder_emails` dùng notification
ID làm PK/FK cascade. Recipient/payload/insert lỗi thì rollback cả ba, báo lỗi đã che
dữ liệu, không có bell-only fallback. P2034 vẫn tối đa 3 lần; cursor có thể phải wrap
mới quay lại Event lỗi, không bảo đảm ngay tick sau.

Payload sender/recipient/subject/HTML/text và idempotency key được freeze khi enqueue.
Title/notes sửa sau đó giữ nguyên job/content; deadline/remindBefore đổi xóa Reminder
và cascade job. Completion khiến job chưa gửi mất eligibility, Event delete cascade.
Worker revalidate quan hệ Notification/Event/User, owner Student, recipient, status,
deadline và cửa sổ nhắc trước mỗi send; không gửi Violation/Completed/Overdue/zero lead.

Worker poll 5 giây, 2 send slot/instance, claim READ COMMITTED + SKIP LOCKED, lease
60 giây có UUID fencing, mỗi claim tiêu thụ 1/6 attempt. HTTP ngoài transaction,
timeout 10 giây, body/key giữ nguyên. Backoff: 30 giây/2 phút/10 phút/30 phút/2 giờ;
429 tôn trọng Retry-After, yêu cầu hơn 6 giờ thì Dead. Dừng trước deadline hoặc biên
23 giờ từ first claim; không backfill/reconcile. Accepted chỉ nghĩa provider nhận
xử lý. Race sau preflight không thu hồi được request đã phát. Không sửa activity_logs.

Phase 3 có implementation và test fake-only trên nhánh email; MySQL lock/cascade,
migration và provider thực tế chưa được kiểm chứng cho phần email.

## Notifications

Student-only: Guest → 401; Admin → 403. Không có purge theo thời hạn, không có endpoint DELETE cho người dùng; notification được giữ cho đến khi một thao tác nghiệp vụ được duyệt xóa (ví dụ Reminder cũ khi đổi dueDate/remindBefore, hoặc FK cascade khi xóa event).

| Method/path                               | Request                                                                                                                 | Success                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/notifications?page=1&pageSize=20 | page mặc định 1, integer 1–1,000,000; pageSize mặc định 20, integer 1–100. Không nhận userId, filter hoặc query lạ/lặp. | HTTP 200 `{ "items": [{ "id": 8, "type": "Reminder", "content": "Nhắc hạn sự kiện", "isRead": false, "createdAt": "2026-10-28T00:00:00Z", "eventId": 5 }], "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }, "unreadCount": 1 }`; item shape được định nghĩa ngay dưới bảng. |
| PATCH /api/notifications/:id/read         | ID số nguyên dương; body/query không được gửi. Chỉ đánh dấu row của caller.                                             | 200 {"notification":{"id":8,"isRead":true}}; idempotent nếu đã đọc.                                                                                                                                                                                                                            |

Notification response item:

```json
{
  "id": 8,
  "type": "Reminder",
  "content": "Nhắc hạn sự kiện",
  "isRead": false,
  "createdAt": "2026-10-28T00:00:00Z",
  "eventId": 5
}
```

Newest-first sort created_at DESC, notification_id DESC; unreadCount là tổng chưa đọc của user, không chỉ page hiện tại. Reminder có eventId khác null; Violation có eventId:null và UI điều hướng đích chung /forum. Không có deep link tới post/comment vì schema không lưu target. content gồm lời nhắc hoặc lý do xử lý Violation, không chứa thông tin nội bộ. Trang vượt total trả 200 items rỗng, total thật; totalPages=0 khi total=0. Lỗi page/query → 400 INVALID_QUERY; ID sai → 400 INVALID_ID; record thiếu hoặc thuộc user khác → 404 NOT_FOUND; auth 401/403; DB 503; lỗi bất ngờ 500. Lỗi không biến thành danh sách rỗng.

GET đọc notifications theo owner và count trong cùng thời điểm truy vấn; PATCH chỉ update is_read=true, không cần transaction liên module. Event update/delete và Notification row deletion theo các ranh giới giao dịch nêu trên. Không ghi activity log cho thao tác đọc notification theo Chương 3.

## Ma trận test và trạng thái

- Permission: Guest 401, Student owner-only, Admin 403; cross-owner event/notification cùng 404.
- Calendar: from inclusive/to exclusive; 42 ngày nhận; 43 ngày, range ngược, biên lệch nửa đêm, query thiếu/lặp/lạ bị từ chối; UTC↔VN ngày không lệch; sort tie theo ID.
- Event: field lengths, date future, content-only edit past, due/reminder change reset + delete Reminder atomically, Completed preserved, update past sets Overdue, status endpoint only Completed, event delete cascades Reminder and leaves unrelated notifications.
- Scheduler: threshold boundary, no duplicate under concurrency, rollback+retry, every-minute execution cadence is tested as configuration only; no exact-second SLA; no Reminder for Completed/Overdue.
- Notifications: pagination, stable newest order, total unread across pages, idempotent read, error vs empty; no purge after age; Violation eventId:null and /forum.
- DB unavailable → 503 and not empty; unexpected → 500 without internals.

**Contract đã duyệt; routes và bell scheduler đã merge. Email Phase 3 chỉ có bằng chứng kiểm thử fake, chưa xác nhận triển khai trên database/provider.**
