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

`admin_id` lấy từ middleware identity, không từ request. `target_id` là scalar logical target; schema không tạo FK theo target_type. Các thao tác cần log là Admin-only. `activity_logs` append-only: backend không sửa/xóa log; runtime GRANT hiện chỉ SELECT/INSERT. Nội dung chỉ lưu `old_value`, `new_value`, `reason` tối đa 500 ký tự, không lưu token, Google claims, bí mật, PII không cần thiết hoặc toàn bộ row.

## Transaction boundary

Mỗi feature sở hữu transaction cùng với log: approve/reject opportunity + log; soft-delete forum content + log + Violation notification; category change + log; role update + log. Tất cả thành công hoặc rollback cùng nhau. Phương án chờ leader duyệt: `old_value`/`new_value` là JSON compact với key ổn định theo action. Timestamp UTC. `reason` bắt buộc khi REJECT_OPPORTUNITY, DELETE_POST, DELETE_COMMENT theo Chương 3; các thao tác Category reason chỉ khi có nhập theo use case.

Database CHECK giới hạn action_type/target_type, FK admin_id và giới hạn cột; nó không xác minh caller là Admin, target/action pair đúng, tính append-only ở API hay atomicity. Backend phải enforce role, action-target mapping và transaction. Dashboard views không tạo audit log; không có GET log trong Chương 3. Tests ở từng module phải inject log failure và chứng minh rollback; runtime account không được UPDATE/DELETE.
