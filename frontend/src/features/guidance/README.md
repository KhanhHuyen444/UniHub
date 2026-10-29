# Guidance — nền tảng tích hợp API (TV3)

Hợp đồng [guidance-api-contract.md](../../../../docs/guidance-api-contract.md) đã
được duyệt. Phần này triển khai types, runtime response parsers và API functions;
chưa có trang React, hook, route hoặc giao diện Roadmap/detail.

## Đã triển khai

- `contracts.ts`: `GuidanceListResponse`, `GuidanceDetailResponse`, `GuidanceMajor`,
  `GuidanceSkill`, `GuidanceCategoryLink`, `GuidanceSummary`, `GuidanceStage`,
  `GuidanceDetail`, `GuidanceAcademicYear` và `GuidanceCategoryStatus`.
- `parseGuidanceList` / `parseGuidanceDetail` xác thực response từ `unknown`: ID
  nguyên dương trong giới hạn MySQL INT, năm 1–4, UTC ISO timestamp hợp lệ, Major
  type, Active/Closed và các trường nullable. Không tự sửa/sắp xếp dữ liệu, không
  suy diễn năm học, không bỏ liên kết Closed hoặc đổi response sai thành rỗng.
  Chỉ ánh xạ field đã khai báo; field ngoài hợp đồng không được đưa vào DTO.
- Response `selectedMajor:null, stages:[]`, Major có `stages:[]` và detail có
  `academicYears:[]` được giữ nguyên. Văn bản giữ nguyên để consumer render dưới
  dạng text; parser không chuyển nội dung thành HTML.
- Dữ liệu response sai ném `GuidanceContractError` với `code=INVALID_RESPONSE`,
  `kind=response`, tương tự pattern parser Opportunities.
- `api.ts` tái sử dụng `apiRequest`; không tạo HTTP client hoặc fallback riêng:
  - `getGuidanceList({ majorId?, signal? } = {})` → `GET /api/guidance`, chỉ thêm
    query `majorId` khi được cung cấp.
  - `getGuidanceDetail(id, signal?)` → `GET /api/guidance/:id`.
  - ID request nhận number; sai giá trị bị chặn trước fetch bằng `ApiError`,
    `kind=request`, code `INVALID_QUERY` hoặc `INVALID_ID` tương ứng.
  - HTTP status/code/message, lỗi mạng và AbortError đi qua cơ chế chung.

## Kiểm tra (PowerShell tại gốc repository)

```powershell
node --test frontend/test/guidance-contracts.test.mjs frontend/test/guidance-api.test.mjs
npm.cmd run typecheck --workspace @unihub/frontend
npm.cmd run build --workspace @unihub/frontend
npx.cmd --no-install prettier --check frontend/src/features/guidance/contracts.ts frontend/src/features/guidance/api.ts frontend/src/features/guidance/README.md frontend/test/guidance-contracts.test.mjs frontend/test/guidance-api.test.mjs
git diff --check
```

Contracts tests dùng payload fixture chỉ trong test. API tests dùng Vite SSR load
module thật và fetch test double; chúng kiểm tra query, signal, parser và truyền lỗi,
không gọi backend/MySQL/Google thật và không xác nhận UI hoặc NFR.

## Còn chờ và phụ thuộc

- Trang `/roadmaps`, `/roadmaps/:id`, chọn Major, loading/empty/error/retry,
  navigation và tích hợp layout chưa triển khai. Handoff UI chi tiết cần được xác
  minh trước khi dựng giao diện; không suy ra từ contract API.
- Backend Guidance đã có trên nhánh backend trong workflow này; deployment/merge
  và HTTP end-to-end phải kiểm tra riêng. HTTP Guest có thể chạy độc lập Auth.
- Hai hàm hiện gọi public API, không tự lấy/lưu/gắn token, refresh hoặc đọc Profile.
  Luồng Student ưu tiên Major hồ sơ cần cơ chế Auth/session frontend dùng chung
  của TV2 và backend cấu hình hợp lệ; không tự xây cơ chế JWT thứ hai.
- Major options cho UI tương lai dùng API Categories public hiện có; không dùng
  Skill Options Active để lọc/xóa các liên kết Skill Closed của nội dung Guidance.
- Không có mock API/dữ liệu production, dependency mới, schema hoặc môi trường mới.
