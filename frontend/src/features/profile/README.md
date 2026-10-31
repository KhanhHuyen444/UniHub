# Student Profile — PR #36

`/profile` chỉ dành cho Student qua `RequireRole`. GET/PUT dùng [Profile contract](../../../../docs/profile-api-contract.md) và `protectedApiRequest` chung. Profile giữ state riêng, không mở rộng AuthProvider.

- Ba trường bắt buộc: Major, năm 1–4, ít nhất một Skill; careerGoal tùy chọn, tối đa 200 ký tự. Tên/email lấy từ Auth và chỉ đọc.
- Options mới chỉ lấy Active. Closed đang liên kết được hiển thị và gửi lại để giữ; gỡ Skill có nghĩa bỏ liên kết trong replace semantics.
- Form có loading/error/retry/save, giữ dữ liệu khi lưu lỗi, bỏ response cũ khi đổi identity. Theo UC-05, lưu thành công và “Để sau” đều về `/` (Trang chủ); “Để sau” không gửi PUT. Thông báo lưu thành công được giữ qua redirect tạm từ `/` sang health.
- Không có searchable Skills. Dùng SkillOptionsField nguyên bản; API Skills vẫn theo main và chưa dùng protectedApiRequest. Không tuyên bố đã sửa refresh cho Skills.
- Avatar fallback chỉ dùng trong nội dung Profile; StudentAccountMenu chưa được mount trong shell. PublicLayout có liên kết Profile dành cho Student; giữ nguyên shell/footer từ main.
- `/recommendations` được bảo vệ bằng RequireRole Student. API Recommendations dùng protectedApiRequest chung để refresh/retry 401; 409 PROFILE_INCOMPLETE dẫn tới `/profile`. Không thay đổi thuật toán hoặc backend Recommendations.

Phần dùng chung cần Huyền/Quyên review: app/router, API client PUT/fieldErrors, tích hợp Recommendations và test harness. Không sửa schema/migration, dữ liệu, quyền hoặc Activity Log.

Kết quả và giới hạn của lần sửa review: [biên bản PR #36](../../../../docs/pr36-review-fix.md). Unit/fetch doubles/SSR không thay thế browser E2E hoặc MySQL thật.

Sau Google Login hoặc khôi phục phiên tại `/login`, chỉ Student được kiểm tra completeness qua GET Profile dùng protectedApiRequest. Thiếu hồ sơ → `/profile`; đầy đủ → Trang chủ `/` hoặc safe returnTo đã yêu cầu. Lỗi GET không được coi là đầy đủ: hiển thị lỗi/retry. Không thêm completeness guard toàn cục, nên “Để sau” vẫn cho dùng chức năng công khai. Admin giữ routing riêng và không gọi API Profile.
