# Guidance — nền tảng tích hợp API (TV3)

Hợp đồng [guidance-api-contract.md](../../../../docs/guidance-api-contract.md) đã
được duyệt. Phần này triển khai types, runtime response parsers và API functions;
đã có hai trang React với bố cục chức năng tối thiểu, chưa đăng ký routes ứng dụng
và chưa xác nhận thiết kế cuối cùng.

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

- TV1 cần đăng ký `/roadmaps` và `/roadmaps/:id` trong router ứng dụng. Chưa sửa
  router/navigation. Handoff UI chi tiết vẫn cần được xác minh trước khi hoàn thiện
  thiết kế; bố cục hiện tại chỉ phục vụ chức năng.
- Backend Guidance đã có trên nhánh backend trong workflow này; deployment/merge
  và HTTP end-to-end phải kiểm tra riêng. HTTP Guest có thể chạy độc lập Auth.
- Hai hàm hiện gọi public API, không tự lấy/lưu/gắn token, refresh hoặc đọc Profile.
  Luồng Student ưu tiên Major hồ sơ cần cơ chế Auth/session frontend dùng chung
  của TV2 và backend cấu hình hợp lệ; không tự xây cơ chế JWT thứ hai.
- Major options cho UI tương lai dùng API Categories public hiện có; không dùng
  Skill Options Active để lọc/xóa các liên kết Skill Closed của nội dung Guidance.
- Không có mock API/dữ liệu production, dependency mới, schema hoặc môi trường mới.

## Logic React Roadmap/detail

- `GuidanceRoadmapPage.tsx` dùng PublicLayout và các component chung. Tải Major
  Active bằng `getMajorOptions` hiện có (consumer Categories trong Opportunities,
  chỉ tái sử dụng, không sửa module đó). Categories có loading/error/retry riêng.
- URL `majorId` là nguồn lựa chọn; thay Select cập nhật query, Back/Forward tải lại.
  Query sai/lặp không bị tự xóa hoặc chuẩn hóa. Major không còn trong options được
  giữ dưới dạng lựa chọn disabled; nút xóa lựa chọn chỉ chạy khi người dùng bấm.
- Chỉ render stages/items/skills được backend trả, đúng thứ tự; không tạo năm hoặc
  bài giả khi dữ liệu rỗng. Không có Major và Major chưa có bài là hai empty states.
- `GuidanceDetailPage.tsx` đọc URL ID, hiển thị React text, giữ Closed cùng nhãn
  “Đã đóng”, giữ năm học rỗng. Không dùng HTML injection. Liên kết quay lại chỉ nhận
  đường dẫn nội bộ `/roadmaps` và query từ navigation state.
- `useGuidanceRequest.ts` quản lý loading/error/success, retry và AbortController.
  Query/ID đổi hoặc unmount sẽ abort; response cũ không được ghi đè state mới.
  HTTP 400/404/500/503 vẫn là error state có mã lỗi và Retry.
- Vẫn là public flow; không thêm token hoặc tích hợp Auth/Profile.

### Browser component tests

`frontend/test/guidance-pages.test.mjs` dùng Node test + Vite + Playwright/Chromium
để mount trang thật trong harness tạm ngoài repository. API được intercept chỉ
trong test; không thay router hoặc tạo endpoint production. Bao phủ trạng thái,
Select/query/history, link, Closed/plain text, Retry và abort query/ID/unmount.

```powershell
node --test frontend/test/guidance-pages.test.mjs frontend/test/guidance-api.test.mjs frontend/test/guidance-contracts.test.mjs
```

Cần Playwright sẵn có trong môi trường test và browser tương thích; không thêm
app dependency. Không tìm thấy Playwright thì browser tests báo SKIP rõ lý do,
không coi là PASS. Có thể dùng browser đã cài qua biến shell
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; không ghi đường dẫn cá nhân vào repo. Codex
có Chromium hệ thống. Tests không xác nhận backend/MySQL thật, Student session,
hiệu năng hoặc độ khớp Figma. Chạy formatting thêm cho hai page, hook và test mới.
