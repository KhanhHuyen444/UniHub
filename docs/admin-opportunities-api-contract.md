# Hợp đồng Admin duyệt cơ hội

> **Contract: leader đã duyệt theo Chương 3 UC-10. Backend implementation đã merge vào `main` qua PR #24; frontend nằm trên `feat/admin-opportunities-frontend`.** Public GET opportunities giữ nguyên. Không thêm API tạo/sửa/xóa cơ hội, Admin source fetch, hoặc seed dữ liệu.

## Quyền và response item

Tất cả endpoint yêu cầu access JWT hợp lệ và requireRole(Admin) ở backend. Guest → 401 UNAUTHORIZED; Student → 403 FORBIDDEN. Public UI guard không phải authorization. Queue/detail là chỉ đọc; chỉ POST approve/reject thay đổi dữ liệu.

AdminOpportunity là một DTO đầy đủ gồm đúng các field sau; ví dụ dùng dữ liệu hư cấu. `deadline` theo deadline object/null trong opportunities contract. Không trả `reviewedBy`, submitter identity/profile, JWT hoặc session data.

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

`publisher`, `descriptionText`, `requirementsText`, `workFormat`, `location`, `deadline`, `sourceUrl` và `reviewedAt` theo nullability của schema/DTO; `publisher` có thể là `null` trong response dù quy tắc duyệt vẫn yêu cầu giá trị để approve. `majors`, `skills` và `eligibleAcademicYears` luôn là mảng. Detail trả status Pending/Approved/Rejected. Public endpoints tiếp tục chỉ trả Approved thuộc ba loại công khai; `isVerified` độc lập với Approved.

## Endpoints

| Method/path                                       | Request                                                                                                                                              | Success                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/opportunities?page=1&pageSize=20` | Query `page` optional (mặc định 1, integer 1–1,000,000), `pageSize` optional (mặc định 20, integer 1–100); không body, status, search hoặc query lạ. | HTTP 200; response object có `items` là array gồm 0..n DTO đầy đủ đã định nghĩa phía trên và `meta` chính xác gồm integer `page`, `pageSize`, `total`, `totalPages`. `totalPages=0` nếu total=0; trang vượt phạm vi trả `items: []` cùng total thật. Queue lọc Pending; sort `created_at ASC, item_id ASC`. |
| `GET /api/admin/opportunities/:id`                | `:id` số nguyên dương; không query/body.                                                                                                             | HTTP 200; response envelope có key `item`, value đúng toàn bộ field và type của `AdminOpportunity` đã định nghĩa phía trên, kể cả khi trạng thái hiện tại đã là Approved hoặc Rejected.                                                                                                                     |
| `POST /api/admin/opportunities/:id/approve`       | JSON chính xác `{"verified":true}` hoặc `{"verified":false}`; chỉ Pending transition. Không nhận reviewer, status, reviewedAt hoặc reason.           | HTTP 200 `{"item":{"id":41,"status":"Approved","isVerified":true,"reviewedAt":"2026-10-28T00:00:00Z"}}`; item mutation chỉ gồm bốn field này.                                                                                                                                                               |
| `POST /api/admin/opportunities/:id/reject`        | JSON chính xác `{"reason":"Nguồn không xác minh được"}`; trim, 1–500 ký tự. Chỉ Pending transition.                                                  | HTTP 200 `{"item":{"id":41,"status":"Rejected","isVerified":false,"reviewedAt":"2026-10-28T00:00:00Z"}}`; item mutation chỉ gồm bốn field này.                                                                                                                                                              |

## Review rules, errors and transaction

Before approval, Admin human-review checks source, content sections from BR-01.8, publisher, and location for Offline/Hybrid. Backend checks that `descriptionText`, `requirementsText`, and `publisher` contain non-whitespace text, validates `sourceUrl` as an absolute URL with http or https, and requires a non-empty `location` for Offline/Hybrid. Human review still decides whether the sections meet BR-01.8; the API does not parse or infer section headings. It does not fetch the source, follow redirects, or assert external availability. Missing/unacceptable source or required location/content returns 422 OPPORTUNITY_NOT_REVIEWABLE. The Verified flag is true only when Admin chooses it; an Approved item may have isVerified=false. Rejection requires a reason.

Malformed path ID → 400 INVALID_ID; invalid JSON → 400 `INVALID_JSON`; wrong body shape/extra field → 400 `INVALID_REQUEST`; invalid field value → 400 `VALIDATION_ERROR` with fieldErrors; valid item not found → 404 NOT_FOUND; current status no longer Pending → 409 OPPORTUNITY_NOT_PENDING; not reviewable → 422 OPPORTUNITY_NOT_REVIEWABLE; DB unavailable → 503 SERVICE_UNAVAILABLE; unexpected → 500 INTERNAL_ERROR. Errors use shared envelope, never leak SQL/stack.

Approve transaction conditionally verifies current Pending, updates status=Approved, is_verified from request, reviewed_by from verified auth context, reviewed_at UTC, then inserts activity_logs APPROVE_OPPORTUNITY with target Opportunity/item_id and compact old/new status/is_verified. Reject similarly writes Rejected/false/reviewer/time and REJECT_OPPORTUNITY, required reason stored only in activity_logs.reason. Any audit failure rolls back status/reviewer update. Conditional update prevents double review; racing second request returns 409. Do not modify public data fields.

Data touched: opportunities and activity_logs; relations are read from opportunities, opportunity_majors/skills/years and categories. DB constraints do not establish Admin authorization, workflow transition, Verified policy, source validity or audit atomicity; backend must. No network call to source URL.

## Frontend and test matrix

Admin UI loads Pending queue, then detail; confirm before mutation; reject form requires reason. Stale conflict reloads queue/detail; 401/403 is distinct from API error. No-op “keep” or cancel makes no request and no log.

Tests: Guest/Student/Admin; pagination/order; Pending only; detail not found and reviewed statuses; invalid body/ID; approve verified true/false; reject reason empty/whitespace/1/500/501; invalid/missing source, content and required location without server fetch; public visibility only after approval; isVerified independent; double review race; exact old/new audit; activity payload size; rollback if audit insert fails; no reviewer fields on public API. Unit tests use a Prisma test double; opt-in MySQL tests cover authorization, Pending queue, approval/rejection, audit writes, concurrent review and public visibility. The Admin MySQL test reads only `TEST_ADMIN_OPPORTUNITIES_DATABASE_URL`, requires a loopback URL and a database name beginning `unihub_admin_opportunities_test`, and skips when that variable is absent; it is separate from the Public suite's `TEST_DATABASE_URL`. On Windows, after applying the existing migrations to an isolated local test database, run:

```powershell
$env:TEST_ADMIN_OPPORTUNITIES_DATABASE_URL = 'mysql://user:password@127.0.0.1:3306/unihub_admin_opportunities_test_local'
npm.cmd run build --workspace @unihub/backend
node --test backend/test/admin-opportunities-mysql.test.mjs
Remove-Item Env:TEST_ADMIN_OPPORTUNITIES_DATABASE_URL
```

The backend implementation is on `main` via PR #24. The Admin frontend is being completed on `feat/admin-opportunities-frontend`; it depends on the auth UI from `feat/auth-frontend`, which is not yet on `main`.
