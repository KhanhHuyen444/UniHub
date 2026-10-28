# Hợp đồng API hồ sơ Student

> **Trạng thái: policy lưu hồ sơ đã được leader chốt; chi tiết HTTP còn là dự thảo kỹ thuật để TV2 và leader review.** Chưa có endpoint hồ sơ trên `main`; tài liệu này không triển khai API hay thay đổi schema.

## Nguồn và quyết định

Nguồn chính là Chương 3 UC-04, UC-05, BR-05.1–05.4 và Chương 4 §4.3.2.1/§4.3.2.10. Chỉ Student dùng hồ sơ cá nhân; Admin nhận 403. `user_id` luôn lấy từ JWT đã xác minh. Major và Skill mới chọn phải Active; giá trị đã liên kết được giữ lại dù sau đó Closed. **Policy đã duyệt:** hồ sơ đầy đủ có Major, năm học 1–4 và ít nhất một Skill; PUT chỉ lưu khi đủ ba điều kiện. Student được bỏ qua toàn bộ bước thiết lập; không gửi PUT trong trường hợp này và GET trả hồ sơ chưa thiết lập với `isComplete: false`. `career_goal` không bắt buộc. Không thu thập phone/CCCD/địa chỉ.

### GET /api/users/me/profile — đề xuất path

| Thuộc tính                   | Hợp đồng dự thảo                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quyền                        | Student; Guest → 401, Admin → 403.                                                                                                                                                                         |
| Request                      | Không body/query. ID lấy từ token; không nhận userId.                                                                                                                                                      |
| 200 hồ sơ đã thiết lập       | `{"profile":{"major":{"id":12,"name":"Kỹ thuật phần mềm","status":"Closed"},"academicYear":3,"skills":[{"id":31,"name":"TypeScript","status":"Active"}],"careerGoal":null},"isComplete":true}`. Ví dụ giả. |
| 200 đã bỏ qua/chưa thiết lập | `{"profile":{"major":null,"academicYear":null,"skills":[],"careerGoal":null},"isComplete":false}`. Không đồng nghĩa lỗi API.                                                                               |
| Dữ liệu                      | Chỉ đọc users và user_skills join categories; giữ tên Major/Skill Closed để không làm mất dữ liệu cũ. Không trả google_sub hoặc session fields.                                                            |
| Frontend                     | Dùng response làm trạng thái hồ sơ; không suy ra role/userId từ form. Hồ sơ rỗng/incomplete khác với API lỗi.                                                                                              |

### PUT /api/users/me/profile — đề xuất path/replace semantics

| Thuộc tính  | Hợp đồng dự thảo                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quyền       | Student; Guest → 401, Admin → 403.                                                                                                                                                                                                                                                                                                                                      |
| Request     | JSON { "majorId": 12, "academicYear": 3, "skillIds": [31, 32], "careerGoal": null }. Chỉ các field này; careerGoal nullable, tối đa 200 ký tự theo schema, field thừa bị từ chối.                                                                                                                                                                                       |
| Validation  | `majorId`, `academicYear` và `skillIds` đều bắt buộc để lưu; Major phải đúng type, Major mới chọn và từng Skill mới chọn phải Active; `academicYear` integer 1–4; `skillIds` không rỗng, không lặp; trim `careerGoal`; không chấp nhận ID/role người dùng do client gửi. Hồ sơ từng phần không được lưu bằng PUT. Để sau nghĩa là bỏ qua bước thiết lập, không gửi PUT. |
| 200         | `{"profile":{"major":{"id":12,"name":"Kỹ thuật phần mềm","status":"Active"},"academicYear":3,"skills":[{"id":31,"name":"TypeScript","status":"Active"}],"careerGoal":null},"isComplete":true}`. Cùng shape GET.                                                                                                                                                         |
| Lỗi         | 400 INVALID_REQUEST/VALIDATION_ERROR; 401 UNAUTHORIZED; 403 FORBIDDEN; 404 CATEGORY_NOT_FOUND; 409 CATEGORY_CLOSED nếu danh mục đổi trạng thái đồng thời; 503 SERVICE_UNAVAILABLE.                                                                                                                                                                                      |
| Transaction | Đọc/xác minh category IDs và cập nhật users.major_id, academic_year, career_goal cùng thay thế tập user_skills trong một transaction. Không xóa liên kết Closed đang giữ nếu client gửi lại đúng giá trị hiện tại; các link mới phải Active. Chưa có audit log cho cập nhật hồ sơ trong Chương 3.                                                                       |
| Frontend    | Giữ form khi validation/network lỗi; sau thành công đồng bộ profile state. Student chưa hoàn chỉnh có thể bỏ qua thiết lập theo UC-05.                                                                                                                                                                                                                                  |

### Ràng buộc và test cần có

DB: users.major_id FK, year CHECK 1–4, unique (user_id, skill_id); FK không xác nhận category type/status, không bảo đảm hồ sơ đủ. Backend: Student ownership, Major/Skill đúng type, trạng thái Active cho lựa chọn mới, tính completeness. Test: Guest/Admin, own user only, year boundaries, wrong type/Closed, closed value retained, duplicate skills, transaction rollback, empty/incomplete GET, không lộ google_sub.

**Đã chốt:** complete-only PUT và được bỏ qua toàn bộ setup. **Cần TV2/leader review:** path chính thức, exact error code/field-level validation response và cách điều hướng UI sau khi người dùng chọn “Để sau”. Schema hiện tại không lưu lịch sử trạng thái Major/Skill; Closed link vẫn được định danh qua `category_id`.
