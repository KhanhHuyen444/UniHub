# Quy ước ghi Activity Logs

> **Trạng thái: dự thảo quy tắc nội bộ chung theo Chương 3 UC-10–14, chờ leader review; chưa có API xem log và không đề xuất thêm endpoint.** TV5 triển khai shared helper theo contract sau khi được duyệt.

## Các hành động có căn cứ

| Action                                                            | target_type | Module / sự kiện |
| ----------------------------------------------------------------- | ----------- | ---------------- |
| APPROVE_OPPORTUNITY, REJECT_OPPORTUNITY                           | Opportunity | TV1 UC-10        |
| DELETE_POST                                                       | ForumPost   | TV5 UC-11        |
| DELETE_COMMENT                                                    | Comment     | TV5 UC-11        |
| CREATE_CATEGORY, RENAME_CATEGORY, CLOSE_CATEGORY, REOPEN_CATEGORY | Category    | TV3 UC-13        |
| CHANGE_ROLE                                                       | User        | TV2 UC-14        |

`admin_id` lấy từ middleware identity, không từ request. `target_id` là scalar logical target; schema không tạo FK theo target_type. Các thao tác cần log là Admin-only. `activity_logs` append-only: backend không sửa/xóa log; runtime GRANT hiện chỉ SELECT/INSERT. `old_value`, `new_value` và `reason` là `VARCHAR(500)` trong Prisma schema và initial migration (`schema.prisma` `ActivityLog`, migration `activity_logs`).

## Payload tối thiểu theo action — đã được duyệt

`old_value`/`new_value` là JSON compact chỉ chứa field bị action thay đổi, với key ổn định; không chứa toàn bộ row, nội dung bài viết/bình luận, token, Google claims, bí mật hoặc PII không cần thiết. `reason` được lưu riêng, không lặp lại trong JSON. Ví dụ dưới đây biểu thị giá trị thực ngay trước/sau thao tác, không phải chuỗi template được lưu nguyên văn.

| Action                | `old_value` tối thiểu                                            | `new_value` tối thiểu                                                      | Quy tắc bổ sung                                                                      |
| --------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `APPROVE_OPPORTUNITY` | `{"status":"Pending","is_verified":false}` (đọc giá trị cũ thật) | `{"status":"Approved","is_verified":true}` hoặc `false` theo request Admin | Chỉ hai field bị đổi; `is_verified` vẫn độc lập về nghĩa với trạng thái Approved.    |
| `REJECT_OPPORTUNITY`  | `{"status":"Pending","is_verified":false}` (đọc giá trị cũ thật) | `{"status":"Rejected","is_verified":false}`                                | `reason` riêng, bắt buộc theo UC-10.                                                 |
| `DELETE_POST`         | `{"is_deleted":false}`                                           | `{"is_deleted":true}`                                                      | Lưu soft-delete state; `reason` riêng, bắt buộc; không lưu title/body.               |
| `DELETE_COMMENT`      | `{"is_deleted":false}`                                           | `{"is_deleted":true}`                                                      | Lưu soft-delete state; `reason` riêng, bắt buộc; không lưu comment body.             |
| `CREATE_CATEGORY`     | `NULL`                                                           | `{"type":"Major","name":"...","status":"Active"}`                          | Chỉ các giá trị cần nhận diện category mới; tên bị giới hạn theo schema (100 ký tự). |
| `RENAME_CATEGORY`     | `{"name":"Tên cũ"}`                                              | `{"name":"Tên mới"}`                                                       | Ghi tên cũ/mới, không ghi toàn bộ category row.                                      |
| `CLOSE_CATEGORY`      | `{"status":"Active"}`                                            | `{"status":"Closed"}`                                                      | Không có lý do tùy ý trong JSON.                                                     |
| `REOPEN_CATEGORY`     | `{"status":"Closed"}`                                            | `{"status":"Active"}`                                                      | Không có lý do tùy ý trong JSON.                                                     |
| `CHANGE_ROLE`         | `{"role":"Student"}`                                             | `{"role":"Admin"}`                                                         | Chỉ role cũ/mới; actor, target và thời điểm đã có cột riêng.                         |

Các enum/giá trị trong ví dụ cần lấy từ row thật/request đã validate; không giả định giá trị cũ nếu DB trả khác. `target_id`, `admin_id`, `action_type`, `target_type`, `created_at` tiếp tục ở cột riêng.

Trước khi ghi, backend phải serialize compact rồi kiểm tra độ dài từng chuỗi không vượt 500 ký tự; nếu không phù hợp thì từ chối action trước khi commit hoặc rollback toàn bộ transaction. **Không cắt chuỗi/JSON tùy ý** vì sẽ làm payload không hợp lệ hoặc mất nghĩa. Các payload trên được thiết kế ngắn; reason tối đa 500 ký tự được validate riêng. Không thay schema hay kích thước cột.

## Transaction boundary

Mỗi feature sở hữu transaction cùng với log: approve/reject opportunity + log; soft-delete forum content + log + Violation notification; category change + log; role update + log. Tất cả thành công hoặc rollback cùng nhau. Timestamp UTC. `reason` bắt buộc khi REJECT_OPPORTUNITY, DELETE_POST, DELETE_COMMENT theo Chương 3; các thao tác Category reason chỉ khi có nhập theo use case.

Database CHECK giới hạn action_type/target_type, FK admin_id và giới hạn cột; nó không xác minh caller là Admin, target/action pair đúng, tính append-only ở API hay atomicity. Backend phải enforce role, action-target mapping và transaction. Dashboard views không tạo audit log; không có GET log trong Chương 3. **Ma trận kiểm thử dự kiến:** payload action đúng key/value và chỉ chứa field tối thiểu; reason nằm riêng; mọi serialized value ≤500 ký tự; payload vượt giới hạn bị từ chối hoặc rollback mà không bị cắt; lỗi ghi activity log rollback thay đổi nghiệp vụ và Violation notification cùng transaction; runtime account bị từ chối UPDATE/DELETE. Runtime account vẫn chỉ SELECT/INSERT trên activity_logs.
