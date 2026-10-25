# Ghi nhận triển khai shared UI từ Figma Page 3

## Nguồn và kiểm tra gói bàn giao

Nguồn là file Figma `6lTZvLvJfeOhz6D8QltvMe`, node `24:2` (Page 3), được nhóm xuất trong `UniHub-design-handoff.zip`. Bản README nguồn, manifest, toàn bộ evidence JSON và ba screenshot được lưu tại thư mục này; ZIP không được commit. Chỉ tám asset cần cho shell được chép vào `frontend/src/assets/`, nằm trong `src` nên Vite chỉ đưa các asset đã import vào build.

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
- Dùng `Inter` đứng đầu font stack, sau đó system sans. ZIP không có font; không tải font từ dịch vụ ngoài. Nếu máy không có Inter, trình duyệt sẽ dùng fallback, nên raster chưa thể khớp hoàn toàn typography Figma.
- Bản native `<select>` được giữ để hỗ trợ bàn phím và accessibility; kiểu mũi tên native có thể khác artwork. Focus ring 2 px màu brand là quyết định accessibility của implementation; handoff chưa xác nhận tên/trạng thái focus.
- Page 3 không trả về COMPONENT/COMPONENT_SET hoặc local variables. CSS custom properties và tên token UniHub trong code là cách tổ chức repository, không phải tên token gốc Figma.
- Không có breakpoint hoặc quy tắc mobile/collapse được xác nhận. Layout chỉ hỗ trợ desktop 1280–1920 px; body giữ min-width 1280 px.

## Footer Hỗ trợ và nội dung chưa chốt

Screenshot có cột **Hỗ trợ** với “Điều khoản sử dụng” và “Chính sách bảo mật”. Tìm kiếm repository không thấy quyết định trước đó ghi rõ hai label/URL. Preview giữ đúng cột và hai label theo screenshot, nhưng render dạng text không tương tác, không đặt `href="#"`, không viết nội dung pháp lý và không khẳng định đây là chính sách đã được nhóm duyệt. Nhóm cần xác nhận label cuối cùng, nội dung pháp lý và URL trước khi biến chúng thành link. Dòng copyright trong preview cũng chỉ lặp lại chữ trong screenshot, chưa phải tuyên bố pháp lý đã duyệt.

## Asset dùng trong app

| Asset được import      | Node nguồn | Dùng ở                |
| ---------------------- | ---------- | --------------------- |
| `logo-student-40.svg`  | 303:16     | Public/Student navbar |
| `logo-admin-36.svg`    | 166:945    | Admin sidebar         |
| `logo-footer-180.png`  | 303:53     | Public/Student footer |
| `notification.svg`     | 303:36     | Student navbar        |
| `admin-dashboard.svg`  | 166:950    | Admin sidebar         |
| `admin-moderation.svg` | 166:955    | Admin sidebar         |
| `admin-categories.svg` | 166:960    | Admin sidebar         |
| `admin-accounts.svg`   | 166:965    | Admin sidebar         |

`arrow-right.svg`, `edit-profile.svg` và `refresh.svg` được giữ trong tài liệu nguồn nhưng chưa cần cho shared shell/preview nên không copy vào frontend. ZIP, screenshot và evidence JSON chỉ nằm trong `docs/shared-ui-design/`, không nằm trong Vite public tree hoặc bundle.

## Route preview và ranh giới hành vi

`/_dev/ui?area=public`, `/_dev/ui?area=student`, `/_dev/ui?area=admin` xem shell tương ứng. Query `active` chỉ đổi tab đang chọn trong preview. Navbar/Footer preview trỏ lại trang preview để không gửi người xem tới trang nghiệp vụ chưa tồn tại. Login, notification, logout được hiển thị nhưng vô hiệu hóa; state/control gallery là minh họa cục bộ, không gọi API. Không có route guard; Student/Admin preview không chứng minh danh tính hoặc quyền.

`/_dev/health` vẫn hoạt động và `/` vẫn chuyển tới health. Không thêm trang Hub, hồ sơ, lịch, forum hay Admin nghiệp vụ.
