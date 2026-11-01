# Login — đối chiếu thiết kế 31/10/2026

Nguồn: ảnh người dùng cung cấp `Đăng nhập (1).png`, 1280×1204. Handoff hiện có liệt kê frame `152:11244` và trạng thái processing/error; bảng controls xác nhận Google CTA thiết kế 270×48, error radius 10/padding 12×16. Handoff chưa có toàn bộ số đo chi tiết hai cột, nên những số đo dưới đây được **ước lượng/đối chiếu từ ảnh**, không tuyên bố pixel-perfect.

## Bố cục và phạm vi

- Header cao 80, logo/wordmark dùng Brand hiện có, bốn link từ publicNavigation. Biểu tượng tài khoản là anchor có chức năng tới/focus vùng đăng nhập, không phải nút giả.
- Desktop 1280, zoom 100%: cột trái x=88 rộng 624; khoảng cách 48; thẻ phải x=760 rộng 432, y=208 cao khoảng 630 khi không có lỗi; footer tại y=903. Chiều cao là kết quả nội dung/padding, không đặt height cố định cho card.
- Hai cột, nhãn giới thiệu, ba lợi ích; thẻ chứa logo, slogan, Google GIS thật, trạng thái và privacy. Logo dùng nguyên asset `logo-student-40.svg`, footer giữ asset PNG 180, Inter và các token sẵn có. Shield dùng icon chung; các symbol outline nhỏ còn thiếu asset riêng được thể hiện bằng SVG nét, không emoji. Không vẽ lại logo.
- LoginLayout riêng chỉ bọc `/login`. PublicLayout, SiteFooter, Brand, Calendar/Guidance/Admin layout không sửa. Footer dùng SiteFooter với selector `.login-shell` và label overrides riêng. Body class `unihub-login` chỉ hạ min-width trong lúc Login mount và được gỡ khi rời trang.
- Màn hẹp ≤760 px thành một cột; header wrap, footer hai cột. Không line-clamp/overflow hidden/height cố định làm cắt nội dung lỗi.

## Chức năng giữ nguyên

Callback Google, chống gửi lặp bằng ref, loginWithGoogleIdToken, refresh/me/logout, role guard và return-path không thay đổi. LoginPage chỉ thay phần trình bày; khi khôi phục phiên/đang submit, vùng GIS dùng inert theo cơ chế hiện có.

GoogleIdentityButton thêm width (default vẫn 320 cho consumer cũ, riêng Login chọn 270), đo vùng chứa bằng ResizeObserver/resize và gọi renderButton bằng width được hỗ trợ. Không sửa DOM/style bên trong iframe Google, không overlay nút giả. Resize chỉ render lại khi width thay đổi, không initialize lại SDK cho từng lần resize. Cleanup hủy observer/listener và bỏ callback đến muộn như trước.

Privacy dùng câu đúng backend: UniHub dùng mã định danh Google, email, họ tên và ảnh đại diện để tạo/cập nhật tài khoản. Không hứa chỉ lấy email hoặc thêm cam kết về email/password/chính sách chưa xác minh. Điều khoản/bảo mật ở footer vẫn là chữ theo contract khi chưa có route. Link trang chủ vẫn `/`, hiện chuyển tới `/_dev/health`; không tự triển khai home/forum.

## Kiểm tra thực tế trên Windows/Chrome

Nhánh `fix/login-design`, nền `5adb56f`; Opportunities được bảo toàn trong stash `0474f32fa947bdf4211c5e300d6296bc81a24a2e` (bản cũ vẫn giữ), Dashboard trong stash riêng. Không commit/push/merge/deploy.

Frontend Vite chạy từ checkout này ở 127.0.0.1:5173. Express app/auth thật ở cổng 3001 dùng cấu hình cá nhân hiện có thông qua launcher local ngoài Git; **không start scheduler**, không seed/ghi fixture vào database. Không sửa backend/schema/dependency/.env. Phiên Chrome review riêng bắt đầu Guest. Không sao chép/in token, không chọn tài khoản hay nhập credential.

### Browser thật, không mock

- `/login` render GIS native thật: SDK tải, iframe xuất hiện; click nút native mở popup accounts.google.com. **Dừng tại bước Google cần người dùng chọn tài khoản; chưa kết luận Google login end-to-end đạt.**
- Anchor tài khoản focus `login-panel`; Tab tới phần tử focusable, focus-visible có outline. Link về home hoạt động theo route hiện có.
- Guest truy cập Calendar chuyển tới `/login?returnTo=%2Fcalendar`, giữ returnTo. Return-path/Admin/Student destination vẫn được suite auth cũ kiểm tra; không có phiên Admin/Student thật mới để kết luận ma trận đăng nhập live.
- Login 390 px không tràn ngang. Khi rời Login tới Hub, Guidance và Admin shell preview, body class được gỡ, login-shell không còn; min-width/layout gốc được khôi phục. Admin shell chỉ preview, không phải test quyền Admin thật. Calendar authenticated UI chưa kiểm tra ở nhiệm vụ này.

### Mock được ghi rõ

Fixture `frontend/test-support/login-fixture.html` dùng LoginPresentation/LoginLayout/GIS component thật nhưng SDK Google double, không token/API/database. Đã kiểm tra restoring/loading/error dài/unavailable, inert khi disabled, callback không có credential báo lỗi. Width 320: GIS nhận width 215 trong vùng card, không tràn card; 390: width 270. CDP tab bị hidden nên test gửi resize event sau đổi viewport để đảm bảo delivery; không suy việc đó thành test mọi thiết bị.

Chặn URL SDK Google qua CDP Network để kiểm tra lỗi tải dịch vụ trên route thật: thông báo rõ, không hiện nút giả. Đây là **mock lỗi mạng**, không phải lỗi Google đang xảy ra ở sản phẩm. Thiếu client ID được kiểm tra bằng SSR define trong test, không sửa .env.

Ảnh/báo cáo nằm ngoài Git trong `.cache/login-review/`:

- `before-1280.png`, `after-1280.png`: cùng viewport 1280×1204, deviceScaleFactor/zoom 1, Guest + GIS thật.
- `real-login-390.png`: giao diện live hẹp.
- `mock-restoring-1280.png`, `mock-loading-1280.png`, `mock-error-1280.png`, `mock-unavailable-1280.png`, `mock-default-320.png`, `mock-default-390.png`, `mock-long-error-320.png`: UI/GIS mock có watermark; screenshot viewport có thể cần scroll để xem phần dưới trang dài.
- `mock-gsi-load-error-1280.png`: SDK network bị chặn có chủ đích.
- `shared-opportunities-1280.png`, `shared-roadmaps-1280.png`, `shared-ui-area-admin-1280.png`.
- `desktop.json`, `browser-report.json`, `google-check.json`: kết quả đã loại token/credential; không lưu dữ liệu tài khoản.

## Chênh lệch/giới hạn còn lại

- GIS native `large` render chiều cao khoảng 40 px, viền/chữ theo Google, khác CTA vẽ 48 px trong ảnh. Vùng chứa dành 48 px; không ép iframe/che bằng nút tự vẽ.
- Asset student SVG chứa raster nhỏ theo manifest handoff, nên logo khi phóng lớn mềm hơn ảnh thiết kế; cần asset gốc độ phân giải cao/transparent từ nhóm để cải thiện. Không tự tái tạo logo.
- Copy quyền riêng tư và lợi ích được chỉnh cho đúng hành vi hiện tại, không sao chép cam kết quá mức từ ảnh. Spacing breakpoint/gradient và các icon thiếu asset gốc là ước lượng từ ảnh.

## Kiểm tra tự động

Root typecheck/build/format:check và git diff --check đạt. Frontend suite (ngoài sandbox để tránh lỗi hệ thống tsx): **105 pass, 32 skip, 0 fail**, gồm 5 test mới cho cấu trúc Login, trạng thái, shell, GIS inert và thiếu cấu hình; auth/returnTo/refresh/guard và layout-related suites hiện có giữ nguyên. Các test skip không được tính là đã chạy UI/SQL. Sau thay đổi cuối về resize GIS, chạy lại auth/Login/admin-opportunities API & return-path: **24 pass, 0 fail/skip**; frontend typecheck/build và format/diff-check đạt.
