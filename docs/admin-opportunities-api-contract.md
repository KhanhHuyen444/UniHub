# Hợp đồng Admin duyệt cơ hội

> **Contract: leader đã duyệt theo Chương 3 UC-10. Backend implementation đã merge vào `main` qua PR #24; frontend và auth UI cũng đã có trên `main` và nhánh tài liệu hiện tại.** Tab Tin chờ thẩm định nằm tại `/admin/moderation`; route `/admin/opportunities` được giữ để chuyển hướng tương thích. Public GET opportunities giữ nguyên. Không thêm API tạo/sửa/xóa cơ hội, Admin source fetch, hoặc seed dữ liệu.

## Quyền và response item

Tất cả endpoint yêu cầu access JWT hợp lệ và requireRole(Admin) ở backend. Guest → 401 UNAUTHORIZED; Student → 403 FORBIDDEN. Public UI guard không phải authorization. Queue/detail là chỉ đọc; chỉ POST approve/reject thay đổi dữ liệu.

AdminOpportunity là một DTO đầy đủ gồm đúng các field sau; ví dụ dùng dữ liệu hư cấu. `type` theo `opportunity_type` trong database và có thể là `Thực tập`, `Việc làm`, `Học bổng` hoặc `Bài viết định hướng`. Queue Admin giữ mọi bản ghi Pending thuộc cả bốn loại; frontend không lọc loại để tránh làm sai `total` hoặc phân trang. `deadline` theo deadline object/null trong opportunities contract. Không trả `reviewedBy`, submitter identity/profile, JWT hoặc session data.

```json
{
  "id": 41,
  "type": "Thực tập",
  "title": "Cơ hội minh họa",
  "publisher": "Đơn vị minh họa",
  "descriptionText": "Mô tả văn bản",
  "requirementsText": "Yêu cầu văn bản",
  "workFormat": "Hybrid",
  "location": "Thành phố Hồ Chí Minh",
  "deadline": {
    "precision": "date",
    "date": "2026-11-05",
    "sourceTimeZone": null,
    "instant": "2026-11-05T17:00:00Z",
    "state": "open"
  },
  "isVerified": false,
  "sourceUrl": "https://example.invalid/opportunity",
  "majors": [{ "id": 12, "name": "Kỹ thuật phần mềm" }],
  "skills": [{ "id": 33, "name": "TypeScript" }],
  "eligibleAcademicYears": [2, 3],
  "createdAt": "2026-10-28T00:00:00Z",
  "status": "Pending",
  "reviewedAt": null
}
```

`publisher`, `descriptionText`, `requirementsText`, `workFormat`, `location`, `deadline`, `sourceUrl` và `reviewedAt` theo nullability của schema/DTO; `publisher` có thể là `null` trong response dù quy tắc duyệt vẫn yêu cầu giá trị để approve. `majors`, `skills` và `eligibleAcademicYears` luôn là mảng. Detail trả status Pending/Approved/Rejected. Bản ghi `Bài viết định hướng` vẫn thuộc phạm vi đọc/hiển thị của Admin; API Public vẫn chỉ công khai Approved thuộc ba loại cơ hội. `isVerified` độc lập với Approved.

## Endpoints

| Method/path                                       | Request                                                                                                                                              | Success                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/opportunities?page=1&pageSize=20` | Query `page` optional (mặc định 1, integer 1–1,000,000), `pageSize` optional (mặc định 20, integer 1–100); không body, status, search hoặc query lạ. | HTTP 200; response object có `items` là array gồm 0..n DTO đầy đủ đã định nghĩa phía trên và `meta` chính xác gồm integer `page`, `pageSize`, `total`, `totalPages`. `totalPages=0` nếu total=0; trang vượt phạm vi trả `items: []` cùng total thật. Queue lọc Pending; sort `created_at ASC, item_id ASC`. |
| `GET /api/admin/opportunities/:id`                | `:id` số nguyên dương; không query/body.                                                                                                             | HTTP 200; response envelope có key `item`, value đúng toàn bộ field và type của `AdminOpportunity` đã định nghĩa phía trên, kể cả khi trạng thái hiện tại đã là Approved hoặc Rejected.                                                                                                                     |
| `POST /api/admin/opportunities/:id/approve`       | JSON chính xác `{"verified":true}` hoặc `{"verified":false}`; chỉ Pending transition. Không nhận reviewer, status, reviewedAt hoặc reason.           | HTTP 200 `{"item":{"id":41,"status":"Approved","isVerified":true,"reviewedAt":"2026-10-28T00:00:00Z"}}`; item mutation chỉ gồm bốn field này.                                                                                                                                                               |
| `POST /api/admin/opportunities/:id/reject`        | JSON chính xác `{"reason":"Nguồn không xác minh được"}`; trim, 1–500 ký tự. Chỉ Pending transition.                                                  | HTTP 200 `{"item":{"id":41,"status":"Rejected","isVerified":false,"reviewedAt":"2026-10-28T00:00:00Z"}}`; item mutation chỉ gồm bốn field này.                                                                                                                                                              |

## Quy tắc rà soát, lỗi và transaction

Trước khi duyệt, Admin kiểm tra thủ công nguồn, các phần nội dung theo BR-01.8, đơn vị đăng và địa điểm đối với hình thức Offline/Hybrid. Backend kiểm tra `descriptionText`, `requirementsText` và `publisher` có nội dung khác khoảng trắng, xác thực `sourceUrl` là URL tuyệt đối dùng http hoặc https, đồng thời yêu cầu `location` không rỗng với Offline/Hybrid. Admin vẫn là người quyết định các phần nội dung có đáp ứng BR-01.8 hay không; API không phân tích hoặc suy đoán tiêu đề mục. API không truy cập nguồn, không theo chuyển hướng và không xác nhận nguồn bên ngoài còn khả dụng. Nguồn hoặc địa điểm/nội dung bắt buộc bị thiếu/không đạt sẽ trả 422 OPPORTUNITY_NOT_REVIEWABLE. Cờ Verified chỉ bật khi Admin chọn; mục Approved vẫn có thể có isVerified=false. Khi từ chối, cần có lý do.

ID path sai định dạng → 400 INVALID_ID; JSON sai → 400 `INVALID_JSON`; body sai cấu trúc/có field thừa → 400 `INVALID_REQUEST`; giá trị field không hợp lệ → 400 `VALIDATION_ERROR` kèm fieldErrors; không tìm thấy mục đã hợp lệ → 404 NOT_FOUND; trạng thái hiện tại không còn Pending → 409 OPPORTUNITY_NOT_PENDING; mục không đủ điều kiện review → 422 OPPORTUNITY_NOT_REVIEWABLE; DB không khả dụng → 503 SERVICE_UNAVAILABLE; lỗi ngoài dự kiến → 500 INTERNAL_ERROR. Lỗi dùng envelope chung, không làm lộ SQL/stack.

Transaction approve kiểm tra có điều kiện trạng thái hiện tại là Pending, cập nhật status=Approved, is_verified theo request, reviewed_by từ auth context đã xác minh, reviewed_at theo UTC, rồi thêm activity_logs APPROVE_OPPORTUNITY với target Opportunity/item_id và old/new status/is_verified dạng gọn. Reject thực hiện tương tự với Rejected/false/reviewer/time và REJECT_OPPORTUNITY; reason bắt buộc chỉ được lưu trong activity_logs.reason. Nếu ghi audit lỗi, cập nhật status/reviewer sẽ rollback. Cập nhật có điều kiện ngăn review hai lần; request thứ hai trong tình huống tranh chấp trả 409. Không sửa các field dữ liệu public.

Dữ liệu được truy cập: opportunities và activity_logs; các quan hệ được đọc từ opportunities, opportunity_majors/skills/years và categories. DB constraint không đảm bảo quyền Admin, chuyển trạng thái workflow, chính sách Verified, tính hợp lệ của source hoặc tính nguyên tử của audit; backend phải thực thi. Không gọi mạng tới source URL.

## Frontend và ma trận test

Admin UI tải hàng đợi Pending rồi mới tải chi tiết; cần xác nhận trước khi thay đổi; biểu mẫu reject yêu cầu reason. Xung đột do dữ liệu cũ sẽ tải lại hàng đợi/chi tiết; 401/403 được phân biệt với lỗi API. Thao tác “giữ lại” hoặc hủy không làm gì sẽ không gửi request và không ghi log.

Test bao gồm: Guest/Student/Admin; pagination/thứ tự; chỉ Pending; chi tiết không tìm thấy và trạng thái đã review; body/ID không hợp lệ; approve với verified true/false; reason reject rỗng/chỉ khoảng trắng/1/500/501 ký tự; source, nội dung và địa điểm bắt buộc thiếu/không hợp lệ mà không truy cập nguồn từ server; chỉ hiển thị công khai sau khi duyệt; isVerified độc lập; race khi review hai lần; audit old/new chính xác; kích thước activity payload; rollback nếu thêm audit lỗi; API public không có field reviewer. Unit test dùng Prisma test double; MySQL test tùy chọn bao phủ phân quyền, hàng đợi Pending, approve/reject, ghi audit, review đồng thời và hiển thị public. Bài MySQL Admin chỉ đọc `TEST_ADMIN_OPPORTUNITIES_DATABASE_URL`, yêu cầu URL loopback và tên database bắt đầu bằng `unihub_admin_opportunities_test`, và skip nếu thiếu biến đó; bộ này tách biệt với suite Public dùng `TEST_DATABASE_URL`. Trên Windows, sau khi áp dụng các migration hiện có vào database test cục bộ cô lập, chạy:

```powershell
$env:TEST_ADMIN_OPPORTUNITIES_DATABASE_URL = 'mysql://user:password@127.0.0.1:3306/unihub_admin_opportunities_test_local'
npm.cmd run build --workspace @unihub/backend
node --test backend/test/admin-opportunities-mysql.test.mjs
Remove-Item Env:TEST_ADMIN_OPPORTUNITIES_DATABASE_URL
```

Implementation backend nằm trên `main` qua PR #24. Frontend Admin và shared auth UI cũng đã tích hợp trên `main` và nhánh tài liệu hiện tại. `AdminModerationPage` chứa chức năng review cơ hội; các tham chiếu cũ `feat/admin-opportunities-frontend` và `feat/auth-frontend` là lịch sử phát triển, không phải dependency đang chờ. Việc tích hợp source không chứng minh có kết quả test UI/MySQL thực tế mới.
