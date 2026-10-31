# Student Profile — Task 2

`/profile` chỉ dành cho Student qua `RequireRole`. GET/PUT dùng [Profile contract](../../../../docs/profile-api-contract.md) và `protectedApiRequest` của Auth. Profile giữ state nghiệp vụ riêng, không mở rộng AuthProvider.

## Phạm vi sau khi thu hồi thay đổi ngoài Task 2

- Các file Categories/Recommendations, test và browser harness của Quyên được khôi phục nguyên nội dung `origin/main`. Không bổ sung tìm kiếm hoặc sửa refresh trong module của Quyên.
- Profile dùng trực tiếp `SkillOptionsField` gốc, không truyền prop `searchable`. Toàn bộ Skill IDs gồm Closed vẫn được khởi tạo và gửi lại trừ khi người dùng chủ động gỡ. Major Closed hiện tại được giữ; options mới chỉ lấy Active từ API.
- Bố cục ba card, tên/email từ Auth, validation, loading/error/retry/save, badge `isComplete` và checklist được giữ. Form không bị xóa khi lưu lỗi; đổi identity remount và bỏ qua response cũ.
- `UserAvatar` và `StudentAccountMenu` thuộc riêng `features/profile`; avatar fallback và menu chỉ dùng trong trang Profile. Test của Bình giữ lại, cập nhật đường dẫn import.
- StudentLayout và SiteFooter khôi phục nguyên bản main. PublicLayout chỉ thêm liên kết `/profile` cho Student; giữ tên tài khoản và logout gốc.
- Những phần chung bắt buộc còn giữ: backend app mount Profile; router tích hợp Profile/Recommendations và RequireRole; API client hỗ trợ PUT/fieldErrors cùng test tương thích. Cần Huyền review các điểm tích hợp này.
- Không sửa Backend Profile, Auth, Activity Log, schema/migration, contract, database hay cấu hình local trong lần khắc phục.

## Tác động cần phối hợp

- Tìm kiếm Skills không còn trong bản này vì component gốc chỉ có checkbox. Nếu cần, Quyên bổ sung trong module của mình.
- Hai API Skills/Recommendations trở về cách dùng token của main; bản sửa tự refresh trong commit 80dbfe5 đã được thu hồi. Lỗi token hết hạn cần Quyên phối hợp với Huyền sửa riêng. GET/PUT Profile vẫn dùng refresh chung.
- Header avatar và responsive shell/footer trở về hành vi của main. Không tuyên bố đã khắc phục lỗi ảnh/header hoặc overflow toàn trang.
- “Để sau” dùng returnTo an toàn, không gửi PUT. Recommendations có callback tới Profile; thuật toán Recommendations không đổi.

## Kiểm thử và giới hạn

Sau khôi phục: frontend **89 pass, 0 fail, 32 skip**; backend **140 pass, 0 fail, 17 skip**. Số frontend pass giảm 4 vì thu hồi các test refresh thêm vào file của Quyên, không phải test bị lỗi. Unit/fixture/SSR không thay thế browser E2E hoặc MySQL thật.

Browser tests phụ thuộc Playwright; integration tests phụ thuộc database test riêng hợp lệ. Chưa có screenshot desktop/mobile và chưa kiểm chứng save/reload, rollback hoặc concurrency trên MySQL thật trong lần khắc phục. Không chạy test phá hủy trên database nhóm.

## Danh sách khôi phục từ origin/main

- `frontend/src/features/categories/SkillOptionsField.tsx`
- `frontend/src/features/categories/api.ts`
- `frontend/src/features/recommendations/api.ts`
- `frontend/test-support/recommendations-browser.mjs`
- `frontend/test/recommendations-api.test.mjs`
- `frontend/test/recommendations-page.test.mjs`
- `frontend/test/skill-options-api.test.mjs`
- `frontend/test/skill-options-field.test.mjs`
- `frontend/test/skill-options-integration.test.mjs`
- `frontend/src/layouts/StudentLayout.tsx`
- `frontend/src/layouts/SiteFooter.tsx`

Chín file đầu thuộc Quyên; hai layout cuối thuộc shell chung. Nội dung được đối chiếu bằng byte với `origin/main`. Các thay đổi khắc phục hiện chỉ nằm ở working tree, chưa commit/push; PR #36 trên GitHub vẫn chứa commit 80dbfe5 cho đến khi người dùng cho phép cập nhật.
