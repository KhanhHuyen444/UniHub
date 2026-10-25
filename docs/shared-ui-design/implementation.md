# Ghi nhận triển khai shared UI từ Figma Page 3

## Nguồn và kiểm tra gói bàn giao

Nguồn là file Figma `6lTZvLvJfeOhz6D8QltvMe`, node `24:2` (Page 3), được nhóm xuất trong `UniHub-design-handoff.zip`. Bản README nguồn, manifest, toàn bộ evidence JSON và ba screenshot được lưu tại thư mục này; ZIP không được commit. Tám asset hình từ Figma cần cho shell được chép vào `frontend/src/assets/`; Google G được bổ sung riêng từ FirebaseUI và Inter từ nguồn chính thức. Vite chỉ đưa asset đã import vào build.

Đã kiểm tra ZIP CRC, parse bảy JSON (manifest và sáu evidence), và đối chiếu danh mục frame: README liệt kê 63 ID duy nhất; `inventory.json` có đúng 63 frame; hai danh sách khớp hoàn toàn. Manifest có 11 asset: 10 SVG và một PNG; mọi tệp được liệt kê đều tồn tại. Screenshot Public là 1280×2824 (frame 1280×2823.25, làm tròn khi raster hóa), Student là 1296×1419 trong khi bounds frame là 1280×1411.25, Admin là 1280×1024. Vì vậy screenshot Student chỉ dùng so sánh hình thức, không dùng bitmap của nó làm kích thước chuẩn.

Ba frame đại diện:

| Khu vực | Frame                                                                                                                | Kích thước/bằng chứng chính                                |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Public  | [24:1632 — UniHub — Trang chủ (Guest)](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=24-1632) | 1280×2823.25; header 72 px, footer 301.25 px               |
| Student | [301:382 — Cơ hội dành cho bạn](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=301-382)        | 1280×1411.25; header 64 px, 2 cột 832/360 px với gap 24 px |
| Admin   | [166:940 — Dashboard_Mặc định](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=166-940)         | 1280×1024; sidebar 260 px, content 1020 px                 |

Screenshot Admin có trạng thái “Đồng bộ dữ liệu một phần” và “Lỗi tải dữ liệu”. Preview chỉ dùng nó làm nguồn shell/sidebar; không sao chép KPI, tên quản trị viên hay lỗi giả thành dữ liệu chức năng.

## Thông số Figma đọc trực tiếp

- Font Inter; các weight quan sát được 400, 500, 600, 700. Typography mẫu: 32/40 display, 24/32 heading, 18/28 title, 16/24 body, 14/20 label, 12/16 caption. Số đầu là font-size, số sau là line-height px.
- Màu: brand `#0077B6`, navy `#03045E`, cyan `#CAF0F8`, nền `#F8FAFC`, footer/surface `#F1F5F9`, chữ `#0F172A`, `#334155`, `#475569`, `#64748B`, placeholder `#94A3B8`, viền `#E2E8F0`/`#CBD5E1`.
- Trạng thái: info `#E0F2FE`/`#075985`, success `#DCFCE7`/`#166534`, warning `#FFFBEB`/`#92400E`, error `#FEF2F2`/`#FCA5A5`/`#B91C1C`.
- Control phổ biến cao 40 px; input/select trắng, border 1 px `#CBD5E1`, radius 10 px; nút primary `#0077B6`, chữ trắng, radius 10 px. Disabled trong frame có nền `#CBD5E1`, chữ `#64748B`; input error có border 2 px đỏ.
- Radius đọc được: control 10 px, nút compact 8 px, card/dialog 12 px, badge/avatar 9999 px. Shadow được ghi theo từng node trong README bàn giao và JSON nguồn.
- Public header 1280×72, nền trắng opacity 90%; Student header 1280×64, nền trắng opacity 95%. Public/Student có footer nền `#F1F5F9`, border trên 1 px `#E2E8F0`, frame cao 301.25 px. Admin sidebar rộng 260 px, gradient ba stop `#E0F2FE` → `#EBF7FD` → `#F0F9FF`; Admin footer cao 52 px.
- Nav labels theo nguồn: Public có Trang chủ, Hub cơ hội, Lộ trình kỹ năng, Diễn đàn và CTA đăng nhập Google; Student thêm Cơ hội dành cho bạn, Lịch & Deadline, chuông và cụm tài khoản; Admin gồm Dashboard thống kê, Kiểm duyệt nội dung, Quản lý danh mục, Tài khoản & Phân quyền.

Thông số và ID chi tiết hơn, kể cả attributes nguồn, nằm trong [README bàn giao](README.md), [inventory](evidence/inventory.json), [evidence Public](evidence/public.json), [Student](evidence/student.json), [Admin](evidence/admin.json), [controls](evidence/controls.json) và [states](evidence/states.json)/[appearance](evidence/state-appearance.json).

## Phép tính và lựa chọn triển khai (không phải variable Figma)

- Kích thước container tính từ bounds/padding: Public `1280 − 2×40 = 1200 px`; nội dung `1200 − 2×32 = 1136 px`. Student `1280 − 2×32 = 1216 px`; cột chính `1216 − 360 − 24 = 832 px`. Admin main `1280 − 260 = 1020 px`, content `1020 − 2×32 = 956 px`.
- CSS đặt public max-width 1200 px, student max-width 1280 px và sidebar Admin 260 px; ở 1920 px hai vùng nội dung căn giữa, sidebar giữ 260 px. Chỉ 1280 px có frame nguồn; max-width/căn giữa ở 1920 px là lựa chọn triển khai trong phạm vi desktop, chưa phải phép đo frame.
- CSS spacing scale 4/8/12/16/20/24/32/40/48/64 px được suy ra từ các padding/gap thường gặp. Đây là token cục bộ để nhóm dùng nhất quán, không có tên hoặc ID variable chính thức từ Figma; các gap lớn do Auto Layout tự phân bố không được dùng làm scale.
- PNG footer được xuất 180×180. Preview hiển thị ảnh ở 128×128 px để khớp tỷ lệ nhìn thấy trong screenshot; bound CSS của ảnh không được đo trực tiếp trong evidence, nên đây là giá trị suy ra từ ảnh.
- Dùng variable font Inter tự lưu, tải từ kho chính thức [rsms/inter](https://github.com/rsms/inter/tree/353b61b9f4430d5f420d56605a6e7993e0941470/docs/font-files). File nguồn `InterVariable.woff2` có SHA-256 `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`; `@font-face` khai báo dải 100–900 và `font-display: swap`, ứng dụng dùng 400/500/600/700. Giấy phép SIL Open Font License 1.1 được giữ tại `frontend/src/assets/fonts/LICENSE.txt`. ZIP không kèm font; font được bổ sung từ nguồn chính thức sau khi nhận handoff.
- Bản native `<select>` được giữ để hỗ trợ bàn phím và accessibility; kiểu mũi tên native có thể khác artwork. Focus ring 2 px màu brand là quyết định accessibility của implementation; handoff chưa xác nhận tên/trạng thái focus.
- Page 3 không trả về COMPONENT/COMPONENT_SET hoặc local variables. CSS custom properties và tên token UniHub trong code là cách tổ chức repository, không phải tên token gốc Figma.
- Không có breakpoint hoặc quy tắc mobile/collapse được xác nhận. Layout chỉ hỗ trợ desktop 1280–1920 px; body giữ min-width 1280 px.

## Footer Hỗ trợ và nội dung chưa chốt

Nhóm đã chốt giữ cột **Hỗ trợ** với “Điều khoản sử dụng” (`/terms`) và “Chính sách bảo mật” (`/privacy`). Đây là các trang nội dung tĩnh, không cần database/API riêng. Preview vẫn hiển thị chữ tĩnh đến khi nhóm cung cấp nội dung; chưa tạo trang rỗng hoặc tự soạn chính sách. Dòng copyright trong preview lặp lại chữ trong screenshot và chưa phải tuyên bố pháp lý đã được duyệt.

## Font Inter tự lưu

Font variable lấy từ kho chính thức [rsms/inter tại commit `353b61b`](https://github.com/rsms/inter/tree/353b61b9f4430d5f420d56605a6e7993e0941470), tự lưu tại `frontend/src/assets/fonts/InterVariable.woff2`. Trục weight hỗ trợ các giá trị 400, 500, 600, 700; `font-display: swap` tránh ẩn văn bản trong lúc tải. Giấy phép SIL OFL 1.1 đi kèm trong `frontend/src/assets/fonts/LICENSE.txt`. Chromium xác nhận Inter custom font được dùng cho mẫu chữ tiếng Việt và các weight này sau khi font nạp; chi tiết kiểm tra được ghi ở phần xác minh bên dưới.

## Asset dùng trong app

| Asset được import      | Node nguồn          | Dùng ở                 |
| ---------------------- | ------------------- | ---------------------- |
| `logo-student-40.svg`  | 303:16              | Public/Student navbar  |
| `logo-admin-36.svg`    | 166:945             | Admin sidebar          |
| `logo-footer-180.png`  | 303:53              | Public/Student footer  |
| `notification.svg`     | 303:36              | Student navbar         |
| `admin-dashboard.svg`  | 166:950             | Admin sidebar          |
| `admin-moderation.svg` | 166:955             | Admin sidebar          |
| `admin-categories.svg` | 166:960             | Admin sidebar          |
| `admin-accounts.svg`   | 166:965             | Admin sidebar          |
| `google-g-logo.svg`    | FirebaseUI upstream | Public sign-in preview |

Google G được chép nguyên trạng từ [FirebaseUI for Web](https://github.com/firebase/firebaseui-web/blob/91e4016cb513686bd32bc793b8efa1dbce976753/packages/core/brands/google/logo.svg), không tự vẽ hoặc đổi màu. Nguồn là SVG `viewBox="0 0 48 48"`; giữ tỷ lệ vuông và hiển thị ở 18×18 px theo frame `49:1680`, phần tử icon `152:11304` trong evidence controls. Nút nguồn là 270×48 px. Bản Apache License 2.0 của upstream được giữ tại `frontend/src/assets/GOOGLE-FIREBASEUI-LICENSE.txt`. Ảnh có `alt=""` và `aria-hidden="true"`; chỉ dòng chữ cung cấp tên cho nút preview. Đây là trạng thái đăng nhập chưa hoạt động, không gọi Google Identity Services.

`arrow-right.svg`, `edit-profile.svg` và `refresh.svg` được giữ trong tài liệu nguồn nhưng chưa cần cho shared shell/preview nên không copy vào frontend. ZIP, screenshot và evidence JSON chỉ nằm trong `docs/shared-ui-design/`, không nằm trong Vite public tree hoặc bundle.

## Route preview và ranh giới hành vi

`/_dev/ui?area=public`, `/_dev/ui?area=student`, `/_dev/ui?area=admin` xem shell tương ứng. Query `active` chỉ đổi tab đang chọn trong preview. Navbar/Footer preview trỏ lại trang preview để không gửi người xem tới trang nghiệp vụ chưa tồn tại. Login, notification, logout được hiển thị nhưng vô hiệu hóa; state/control gallery là minh họa cục bộ, không gọi API. Không có route guard; Student/Admin preview không chứng minh danh tính hoặc quyền.

`/_dev/health` vẫn hoạt động và `/` vẫn chuyển tới health. Không thêm trang Hub, hồ sơ, lịch, forum hay Admin nghiệp vụ.

## Kết quả xác minh cập nhật

- `npm test` từ gốc repository: frontend 13/13 (10 API client, 3 Tailwind compatibility), backend 13/13 (HTTP), tổng 26/26. Đính chính báo cáo trước: con số 13/13 khi ấy chỉ phản ánh suite backend; frontend suite vẫn tồn tại và chạy đủ, không có test bị mất hoặc được thêm để khớp số cũ. Báo cáo tổng 26 trước đó là đúng.
- `npm run typecheck`, `npm run build`, `npm run format:check` và `git diff --check` đều đạt. Build có asset `InterVariable` tự lưu; ZIP, screenshot và evidence không nằm trong `frontend/dist`.
- Chromium tải font từ asset cục bộ với HTTP 200; `document.fonts` báo Inter loaded và Chrome DevTools Protocol xác nhận `Inter Variable` là custom font cho tiếng Việt ở weight 400, 500, 600, 700.
- Sáu preview (Public/Student/Admin ở 1280 và 1920 px) đều render, không có lỗi runtime hoặc tràn ngang. Screenshot được xem lại sau khi font tải; nội dung tiếng Việt và footer không chồng lấn.
