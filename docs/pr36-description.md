## Student Profile và tích hợp Recommendations

Triển khai GET/PUT `/api/users/me/profile` và `/profile` chỉ dành cho Student theo contract. Hồ sơ gồm Major, năm học 1–4, Skills và careerGoal tùy chọn; giữ Closed đang liên kết, chỉ chọn mới Active, validate và cập nhật transaction. Form phân biệt loading/error/retry, giữ dữ liệu khi lỗi và bỏ response cũ khi đổi identity. Theo UC-05, lưu thành công về Trang chủ `/` kèm thông báo; “Để sau” cũng về `/`, không gửi PUT. Student sau Google Login được kiểm tra GET Profile: chưa đầy đủ → `/profile`; đầy đủ → `/` hoặc safe explicit returnTo. Có loading/error/retry và không thêm completeness guard toàn cục. Admin không gọi API Profile.

Mount `/recommendations` qua RequireRole Student; 409 PROFILE_INCOMPLETE hiển thị hướng dẫn và chuyển tới `/profile`. Recommendations dùng `protectedApiRequest` chung: refresh/retry 401 với token hiện tại, kết thúc phiên khi refresh/retry bị từ chối, không kẹt vòng Login ↔ Recommendations. Không đổi thuật toán gợi ý hoặc tạo cơ chế auth mới.

Không có searchable Skills. API Skills vẫn theo main, chưa dùng shared refresh. Avatar fallback chỉ có trong nội dung Profile; StudentAccountMenu chưa mount vào shell. PublicLayout thêm liên kết Profile cho Student; không claim đã sửa header avatar, responsive toàn trang hoặc E2E.

## Tích hợp và review

Nhánh local đã tích hợp main `5adb56f` bằng merge commit có sẵn `6ef07f6`, giữ dashboard/calendar/notifications cùng Profile/Recommendations. Cần Huyền review app/router, API client PUT/fieldErrors và Quyên review tích hợp Recommendations/test harness. Không sửa database/schema/migrations, dữ liệu, Activity Log hoặc business scoring.

AGENTS cập nhật số bảng 13 theo mô hình đã chốt. Hai sai lệch UC-05 về login/save/defer đã sửa theo Chương 3–4. `/` tạm redirect tới Health theo hành vi nhóm đã xác nhận; Home là external dependency, không chặn merge PR #36. Navigation UC-05 vẫn dùng `/`, không triển khai Home trong PR. Khác biệt sitemap Admin còn ngoài scope và được ghi trong [biên bản review](pr36-review-fix.md).

## Validation trên snapshot chỉ chứa PR

- HEAD `6ef07f6` + đúng 20 file/hunk PR, không có Login UI riêng, `.env` hoặc node_modules lấy từ checkout. `npm.cmd ci --offline` cài dependency riêng theo lockfile thành công.
- Windows PowerShell, Node 24.22.1/npm 11.19.1: typecheck, build và format check PASS; checkout diff check PASS.
- Frontend chạy tuần tự: **154 pass, 0 fail, 4 skip MySQL**, gồm đủ **38 browser fixture tests** trên Edge headless. Backend: **196 pass, 0 fail, 21 skip MySQL**.
- Lượt chạy song song `npm.cmd test` với bộ browser khác có timeout; chạy lại toàn bộ frontend với `--test-concurrency=1` đạt. Không claim lượt mặc định đó PASS.
- Recommendations API regression 11 pass; các browser tests bao phủ UC-05 login/save/defer, retry, Closed links, session change/abort và refresh/navigation.
- Không tuyên bố Google thật, backend/MySQL E2E, UI pixel-perfect hoặc NFR pass. 5 test Login UI riêng không thuộc snapshot PR.

Mô tả này là nguồn cập nhật PR #36 khi publish bản sửa đã kiểm tra. PR giữ trạng thái mở; việc review và merge vào main do người dùng thực hiện.

## Merge readiness và acceptance readiness

**Merge: READY** về scope/build/code tích hợp: hunk UC-05 đã tách khỏi UI, snapshot độc lập qua checks. Home/Health là external dependency đã được nhóm chấp thuận, không chặn merge. Đề xuất vẫn review app/router bởi Huyền và Recommendations bởi Quyên theo workflow.

**Acceptance: NOT READY** cho nghiệm thu đầy đủ MySQL Profile save/reload/Closed/rollback/concurrency. Chưa có dedicated MySQL Profile integration test; không đồng nhất khoảng trống nghiệm thu với merge readiness. Không triển khai Home ngoài scope và không sửa schema/database.
