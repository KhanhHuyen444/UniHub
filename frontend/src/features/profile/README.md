# Student Profile — Task 2

`/profile` chỉ dành cho Student qua `RequireRole`. GET/PUT dùng [Profile contract](../../../../docs/profile-api-contract.md) và `protectedApiRequest` của Auth. Profile giữ state nghiệp vụ riêng; không mở rộng AuthProvider.

## Thay đổi sau review PR #36

- Bố cục theo ảnh “Tạo hồ sơ”: tiêu đề Hồ sơ cá nhân, card Google/account và học thuật bên trái, card trạng thái/lưu/để sau bên phải; một cột ở màn hình nhỏ. Dùng header/footer và design tokens chung.
- Tên/email chỉ đọc từ Auth. `UserAvatar` hiển thị initials khi thiếu ảnh hoặc tải ảnh lỗi. Menu tài khoản Student có Profile, Recommendations và logout, được dùng trên Student shell và Hub công khai.
- Tái sử dụng trực tiếp `SkillOptionsField`; thêm tùy chọn `searchable` (mặc định false, không đổi consumer cũ). Tìm kiếm chỉ lọc hiển thị, không thay selected IDs. Không nhập kỹ năng tự do.
- Khởi tạo toàn bộ Skill IDs gồm Closed, bảo toàn trừ khi chủ động gỡ; Major Closed hiện tại vẫn là lựa chọn hợp lệ. Major/Skill mới lấy API Active, không hardcode dữ liệu.
- Badge phản ánh `isComplete` đã lưu từ server; checklist phản ánh form đang nhập và có ghi chú chỉ cập nhật sau khi lưu. Lỗi tải không trở thành hồ sơ rỗng, lỗi lưu giữ form. Đổi identity remount; abort và kiểm tra session loại response cũ.
- Skills/Recommendations chuyển sang `protectedApiRequest`: Auth state là nguồn token chính; tham số token giữ tương thích để gate caller. Không tạo refresh riêng, không sửa thuật toán.
- Recommendations → Profile mang `returnTo`; “Để sau” dùng `safeReturnPath`, không gửi PUT. Có đường quay lại Recommendations.

## Bằng chứng kiểm thử ngày 31/10/2026

- Frontend: **93 pass, 0 fail, 32 skip** (`npm run test --workspace @unihub/frontend`).
- Backend: **140 pass, 0 fail, 17 skip** (`npm test`, backend cũng build trước test).
- `npm run build`, `npm run typecheck`, `npm run format:check`, `git diff --check`: pass.
- Test mới: Skills/Recommendations 401 → một refresh → retry với token mới; refresh 401 → Guest và không loop. Navigation Student/Guest/Admin, avatar thiếu ảnh, returnTo được kiểm tra bằng unit/SSR. Không dùng SSR để khẳng định giao diện trình duyệt.
- Browser fixture runner chưa cài Playwright; các ca tùy chọn bị SKIP. Các harness đã đồng bộ token fixture vào Auth state chung nhưng chưa chạy trình duyệt trong lượt này.
- Computer Use đã bị chặn vì không xác minh được URL Chrome. Không có ảnh desktop/mobile sau sửa; chưa nghiệm thu độ tương đồng pixel, overflow, console, avatar onError hoặc giữ form qua refresh bằng browser.
- Không mở/ghi database, không thay .env/quyền/schema/migration. MySQL riêng trước đó bị lỗi xác thực; chưa thử lại trong lượt review này. Không coi fixture rollback/concurrent closure là chứng minh MySQL locking thực tế.

## Ma trận TC01–TC08

| Ca                     | Trạng thái E2E | Bằng chứng và giới hạn                                                                                                              |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| TC01 Login/Profile     | NOT RUN        | Người dùng đã xác nhận login trước đây; chưa kiểm chứng phiên Google thật sau sửa. SSR xác nhận fallback khi không có ảnh.          |
| TC02 UI desktop/mobile | BLOCKED        | Code có layout responsive; Computer Use bị chặn. Chưa có screenshot, chưa xác nhận console/overflow.                                |
| TC03 Form/validation   | NOT RUN        | Unit/fixture pass về validation, fetch/save, lỗi; UI tương tác/search/empty chưa chạy browser.                                      |
| TC04 Save/reload MySQL | BLOCKED        | Backend fixture save/ownership pass; chưa có test DB riêng hoạt động và dữ liệu Major/Skill local.                                  |
| TC05 Closed            | BLOCKED        | Unit/backend fixture bảo toàn, gỡ, từ chối Closed mới pass; chưa kiểm tra MySQL/browser thật.                                       |
| TC06 Recommendations   | BLOCKED        | Service đọc users.major_id/academic_year/user_skills, trả 409 khi thiếu; fixture pass. Chưa kiểm chứng liên module trên MySQL thật. |
| TC07 Refresh           | NOT RUN        | Bốn regression fetch-double pass cho hai API; giữ form qua token refresh chưa được chứng minh bằng browser.                         |
| TC08 Quyền/returnTo    | NOT RUN        | Backend fixture Guest401/Admin403/ownership và unit/SSR role/menu/returnTo pass; chưa chạy browser thật.                            |

## Phạm vi và phối hợp review

- Huyền: router, Student/Public layout, footer responsive, `StudentAccountMenu`, `UserAvatar`; không sửa code Auth/backend hay Activity Log Writer.
- Quyên: thay client ở `categories/api.ts`, `recommendations/api.ts`; tùy chọn tìm kiếm trong chính `SkillOptionsField`; cập nhật API tests và browser harness theo Auth state. Không copy component, không sửa thuật toán Recommendations.
- Task 2: `ProfilePage`, README, test navigation. Backend Profile được review, không sửa trong lần bổ sung này. Transaction khóa users FOR UPDATE, categories theo ID tăng dần FOR SHARE, isolation ReadCommitted; rollback và cạnh tranh hiện mới có bằng chứng fixture.
- Không phát hiện blocker nội bộ qua test chạy được. Việc nghiệm thu UI/browser vẫn chưa hoàn thành. Cần Huyền/Quyên review phần chung và cung cấp dữ liệu/quyền môi trường test hợp lệ để kiểm tra E2E trước nghiệm thu toàn luồng.
- Khác mockup: options Active hiện là checkbox có tìm kiếm của component chung; footer dùng asset/spacing hiện có, header dùng menu account, không tự bịa “Sinh viên Năm 3 • CNTT”. Không có dữ liệu mẫu trong product.
