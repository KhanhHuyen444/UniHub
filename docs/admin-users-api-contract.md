# Hợp đồng API Admin tài khoản và phân quyền

> **Contract: leader đã duyệt theo UC-14. Implementation: chưa có trên `main`.** TV2 triển khai sau khi auth/RBAC dùng chung sẵn sàng. Không thêm nghiệp vụ khóa/vô hiệu hóa tài khoản, password login hoặc trường schema mới.

## Nguồn và quyền

Chương 3 UC-14/BR-14.1–14.7 yêu cầu Admin đọc danh sách tài khoản và đổi Student/Admin; chỉ Admin gọi `/api/admin/*`; cấm tự hạ quyền; role mới có hiệu lực khi phát token kế tiếp; role update và `activity_logs` cùng transaction. UC-11 BR-11.7 loại khóa/vô hiệu hóa khỏi phạm vi. Mọi endpoint yêu cầu access JWT hợp lệ và `requireRole('Admin')`; Guest 401 `UNAUTHORIZED`, Student 403 `FORBIDDEN`.

## `GET /api/admin/users`

- **Request:** query tùy chọn `page` (mặc định 1, số nguyên 1–1,000,000), `pageSize` (mặc định 20, số nguyên 1–100), `q` (trim; tối đa 100 Unicode code point; tìm không phân biệt hoa/thường theo collation hiện hành trong `full_name` hoặc `email`). Mỗi query tối đa một lần. Không nhận body, userId, `sort`, role/status filter hoặc query lạ.
- **Sort:** `full_name ASC, user_id ASC`; cùng predicate cho count và trang. `totalPages=ceil(total/pageSize)`, bằng 0 khi total 0. Page vượt phạm vi trả 200 items rỗng, total thực.
- **200 response:**

```json
{
  "items": [
    {
      "id": 12,
      "fullName": "Nguyễn An",
      "email": "an@example.invalid",
      "major": { "id": 4, "name": "Khoa học dữ liệu" },
      "academicYear": 2,
      "role": "Student"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

Ví dụ hư cấu. `major` có thể null. Không trả `google_sub`, session, JWT, phone/CCCD/địa chỉ hoặc activity log. Đọc `users` và `categories`, không ghi.

- **Errors:** query thiếu hợp lệ/sai/lặp/lạ → 400 `INVALID_QUERY`; Guest → 401; Student → 403; DB unavailable → 503 `SERVICE_UNAVAILABLE`; unexpected → 500 `INTERNAL_ERROR`.
- **Frontend:** giữ trạng thái query/paging; lỗi tải có retry, không chuyển thành danh sách rỗng.

## `PATCH /api/admin/users/:id/role`

- **Request:** `:id` là ID số nguyên dương; JSON chính xác `{"role":"Student"}` hoặc `{"role":"Admin"}`. Không nhận actor, role cũ, reason, token hay field thừa.
- **Validation/response:** role ngoài enum → 400 `VALIDATION_ERROR`; ID sai → 400 `INVALID_ID`; user không tồn tại → 404 `NOT_FOUND`. Nếu Admin gọi đổi chính tài khoản đang dùng từ Admin xuống Student, trả 403 `SELF_DEMOTION_FORBIDDEN` (BR-14.4). Nếu role đã bằng giá trị yêu cầu, 200 `{"changed":false,"user":{"id":12,"role":"Student"}}`, không ghi D1/D5.
- **Thay đổi thành công:** 200 `{"changed":true,"user":{"id":12,"role":"Admin"}}`. Trong một transaction cập nhật `users.role` và INSERT append-only `activity_logs` với `CHANGE_ROLE`, `target_type=User`, `target_id`, `admin_id` từ JWT, old/new JSON `{"role":"Student"}`/`{"role":"Admin"}`, UTC timestamp. Log failure rollback user update.
- **Token behavior:** không revoke session hoặc rewrite JWT hiện hành. Access JWT cũ tiếp tục dùng role đã ký; lần cấp token kế tiếp (login/refresh) đọc role hiện tại và ký role mới theo BR-14.5. Frontend có thể refresh hiển thị role, không tuyên bố token cũ đổi quyền tức thời.
- **Errors:** 400 `INVALID_ID`/`VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`/`SELF_DEMOTION_FORBIDDEN`; 404 `NOT_FOUND`; 503 `SERVICE_UNAVAILABLE`; 500 `INTERNAL_ERROR`.

## Dữ liệu, kiểm thử và trạng thái

Các cột được đọc là `users.user_id`, `full_name`, `email`, `major_id`, `academic_year`, `role` cùng `categories.category_id/name`; write chỉ `users.role` và audit row. Không có API lock/status hay account delete. Test: role matrix, pagination/query boundary, q escaping/collation, tie ordering, empty/out-of-range page, ID/body/role sai, missing user, no-op không audit, self-demotion, audit payload, rollback, token role snapshot cũ so với token kế tiếp, DB lỗi không lộ chi tiết. **Contract đã duyệt; API chưa triển khai.**
