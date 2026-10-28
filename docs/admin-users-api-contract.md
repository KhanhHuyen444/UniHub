# Hợp đồng API Admin tài khoản và phân quyền

> **Trạng thái: draft chờ leader review theo UC-14; chưa có endpoint quản trị tài khoản trên main.** TV2 triển khai sau khi leader duyệt. Không thêm khóa tài khoản, password login hoặc chỉnh schema ở đây.

## Nguồn và ranh giới

Chương 3 UC-14/BR-14.1–14.7 yêu cầu Admin đọc danh sách tài khoản và đổi Student/Admin; cấm tự hạ quyền; role mới có hiệu lực khi cấp token kế tiếp; đổi role và activity_logs phải cùng transaction. UC-11 BR-11.7 loại khóa/vô hiệu hóa khỏi phạm vi.

### GET /api/admin/users (đề xuất)

Admin only; xác thực và requireRole('Admin') ở backend. Query pagination/search/order chưa được Chương 3 chốt; đề xuất page=1, pageSize=20 tối đa 100, q optional trên full_name/email, sort full_name ASC,user_id ASC, để list tải ổn định. Query lặp/lạ hoặc sai → 400 INVALID_QUERY.

200 minh họa, dữ liệu giả:

    {"items":[{"id":12,"fullName":"Nguyễn An","email":"an@example.invalid","major":{"id":4,"name":"Khoa học dữ liệu"},"academicYear":2,"role":"Student"}],"meta":{"page":1,"pageSize":20,"total":1,"totalPages":1}}

Không trả google_sub, session, JWT, địa chỉ/phone/CCCD hoặc log. Chương 3 yêu cầu họ tên/email/Major/năm/role. DB reads users/categories; no write. Guest 401, Student 403, DB unavailable 503.

### PATCH /api/admin/users/:id/role (đề xuất)

Admin only. Path ID positive integer; JSON chỉ { "role": "Student" | "Admin" }; không nhận adminId, old role, reason hoặc token. Sai body/ID → 400 INVALID_REQUEST/INVALID_ID; missing account → 404; unsupported role → 400. Role trùng hiện tại trả 200 { "changed": false, "user": {"id":12,"role":"Student"} }, không ghi D1/D5 theo UC-14. Từ chối tự hạ role của người gọi bằng 403 SELF_DEMOTION_FORBIDDEN.

Khi đổi thật, cùng transaction cập nhật users.role và INSERT append-only activity_logs với CHANGE_ROLE, target_type=User, target_id, old_value, new_value, admin_id, timestamp UTC. 200 { "changed": true, "user": {"id":12,"role":"Admin"} }. Log failure → rollback user update. Không revoke session/access token: old JWT role snapshot giữ nguyên; login/refresh cấp token kế tiếp đọc role mới theo BR-14.5.

Frontend reloads /api/auth/me or session state after role update; do not claim active token changed. Tests: Guest/Student/Admin; missing/invalid ID, unknown role, no-op, self-demotion; audit exact old/new; rollback on audit failure; old token still carries old role and next issuance new role; no account-lock API/UI.
