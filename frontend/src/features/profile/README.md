# profile

Frontend hồ sơ học thuật tại `/profile`, chỉ Student qua `RequireRole`. Dùng GET/PUT theo [contract đã duyệt](../../../../docs/profile-api-contract.md), `protectedApiRequest` và refresh hiện có. Profile giữ state riêng, không mở rộng AuthProvider.

Phụ trách theo phân công mới nhất: **TV2**, cả frontend và backend tương ứng. Chưa gán tên người hoặc deadline.

Tái sử dụng trực tiếp `SkillOptionsField` của TV3. Form khởi tạo từ toàn bộ Skill IDs, giữ Closed trừ khi bấm Gỡ. Major Closed hiện tại được giữ; options mới chỉ lấy Active qua API Major. Đổi identity remount editor; request bị abort khi unmount và response muộn bị bỏ qua.

Test `profile.test.mjs` dùng fetch doubles cho API/validation/Auth; `profile-page.test.mjs` dùng trình duyệt với HTTP intercepted, báo SKIP nếu thiếu Playwright. Không xác nhận MySQL, Google login thật hoặc end-to-end. UI dùng shell/token hiện có, chưa đối chiếu Figma.
