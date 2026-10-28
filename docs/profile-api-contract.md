# Hợp đồng API hồ sơ Student

> **Contract: leader đã duyệt. Implementation: chưa có trên `main`.** TV2 triển khai sau khi nền auth/RBAC dùng chung được bàn giao. Tài liệu này không thay schema, migration hay dữ liệu.

## Căn cứ và quy tắc

Theo Chương 3 UC-04, UC-05, BR-05.1–05.4 và Chương 4 §4.3.2.1/§4.3.2.10, chỉ Student đọc/sửa hồ sơ của chính mình; Admin 403, Guest 401. `user_id` lấy từ JWT đã xác minh. Hồ sơ đầy đủ khi có Major, năm học 1–4 và ít nhất một Skill. Student được chọn “Để sau” và không gửi PUT; GET khi chưa thiết lập trả `isComplete:false`. `careerGoal` không bắt buộc. Không lưu phone, CCCD hoặc địa chỉ cư trú.

Danh sách lựa chọn chỉ trả Major/Skill Active qua `GET /api/categories?type=Major` và `GET /api/categories?type=Skill`. GET hồ sơ vẫn trả Major/Skill Closed đã liên kết. PUT có thể gửi lại Closed ID nếu liên kết đó đang thuộc chính hồ sơ này; ID Closed khác không được gắn. Danh sách Skill là replace semantics: ID Closed hiện tại phải được gửi lại nếu cần giữ liên kết; bỏ ID có nghĩa gỡ liên kết. Đây là quy tắc đã leader duyệt; không thêm schema để lưu lịch sử trạng thái.

## Endpoints

### `GET /api/users/me/profile`

- **Quyền:** Student; Guest → 401 `UNAUTHORIZED`; Admin → 403 `FORBIDDEN`.
- **Request:** không query/body; không nhận `userId`. `user_id` đến từ access token.
- **200 response:**

```json
{
  "profile": {
    "major": { "id": 12, "name": "Kỹ thuật phần mềm", "status": "Closed" },
    "academicYear": 3,
    "skills": [{ "id": 31, "name": "TypeScript", "status": "Active" }],
    "careerGoal": null
  },
  "isComplete": true
}
```

Ví dụ dữ liệu giả. Chưa thiết lập/đã bỏ qua: `{"profile":{"major":null,"academicYear":null,"skills":[],"careerGoal":null},"isComplete":false}`. GET chỉ đọc `users`, `user_skills`, `categories`; không trả email Google claims, `google_sub`, JWT hoặc session fields.

- **Errors:** 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 503 `SERVICE_UNAVAILABLE`; 500 `INTERNAL_ERROR`. Lỗi DB không trở thành hồ sơ rỗng.
- **Frontend:** phân biệt trạng thái hồ sơ chưa thiết lập với lỗi tải; hiển thị Closed đã liên kết nhưng không cho chọn làm liên kết mới.

### `PUT /api/users/me/profile`

- **Quyền:** Student; Guest → 401 `UNAUTHORIZED`; Admin → 403 `FORBIDDEN`.
- **Request:** JSON body phải có đúng các field sau; field thừa/thiếu bị từ chối:

```json
{ "majorId": 12, "academicYear": 3, "skillIds": [31, 32], "careerGoal": null }
```

`majorId` số nguyên dương; `academicYear` integer 1–4; `skillIds` là mảng ID số nguyên dương không trùng và không rỗng; `careerGoal` là `string|null`, trim hai đầu, chuỗi rỗng sau trim thành `null`, tối đa 200 ký tự theo schema.

- **Validation:** Major phải thuộc type Major; Skill IDs phải thuộc type Skill. ID mới chọn phải Active. Closed ID chỉ hợp lệ khi hiện đã được liên kết với cùng Student; nếu không thì bị từ chối. Không chấp nhận user ID/role từ client. Không lưu hồ sơ thiếu một trong ba trường bắt buộc. “Để sau” là không gọi endpoint này.
- **200 response:** cùng shape với GET, `isComplete:true`; trả status hiện tại của Major/Skills (có thể Closed nếu được giữ nguyên).
- **Errors:** JSON sai cú pháp → 400 `INVALID_JSON`; body sai shape/field thừa → 400 `INVALID_REQUEST`; lỗi field → 400 `VALIDATION_ERROR` với `fieldErrors` tùy chọn; Major ID sai định dạng/không tồn tại/sai type → `INVALID_CATEGORY`; Major Closed mới → `CATEGORY_NOT_ACTIVE`; Skill ID sai định dạng/không tồn tại/sai type hoặc Skill ID lặp → `INVALID_SKILL`; Skill Closed mới → `SKILL_NOT_ACTIVE`; auth → 401/403; danh mục bị đóng cạnh tranh trước khi commit → 409 `CATEGORY_CLOSED`; DB không sẵn sàng → 503 `SERVICE_UNAVAILABLE`; lỗi bất ngờ → 500 `INTERNAL_ERROR`. Response giữ error envelope chung và không yêu cầu parser đọc message tiếng Việt.
- **Dữ liệu/transaction:** một transaction xác thực category type/status/liên kết Closed hiện có, cập nhật `users.major_id`, `academic_year`, `career_goal` và replace `user_skills`. Lỗi bất kỳ rollback toàn bộ. UC-05 không yêu cầu audit log cho cập nhật hồ sơ.
- **Frontend:** giữ form khi lỗi validation/network; sau PUT thành công đồng bộ session profile state. Route chỉ điều hướng; server kiểm tra quyền.

## Ràng buộc, kiểm thử và trạng thái

Database FK, year CHECK 1–4, unique `(user_id,skill_id)` là ràng buộc cấu trúc; không tự kiểm tra category type/status, completeness hoặc ownership. Backend phải enforce các quy tắc trên trong transaction.

Ma trận test: Guest/Student/Admin; không thể đọc/sửa user khác; profile rỗng và đủ; year 0/1/4/5; Major/Skill sai type hoặc không tồn tại; Active ID mới; giữ Closed đang liên kết; từ chối Closed mới; giữ liên kết Closed khi replace; bỏ liên kết theo request; duplicate Skill IDs; rollback nếu bất kỳ write nào lỗi; response không lộ `google_sub`/session; DB error khác với hồ sơ rỗng. **Contract đã duyệt; API chưa triển khai.**
