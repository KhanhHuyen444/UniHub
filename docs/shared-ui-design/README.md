# UniHub — Bàn giao nền tảng giao diện từ Figma

Ngày đọc: 25/10/2026. File: `6lTZvLvJfeOhz6D8QltvMe`; trang nguồn: [24:2](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=24-2) — Page 3.

## 1. Phạm vi và cách dùng

Tài liệu phục vụ phiên Codex repository triển khai các phần dùng chung Public, Student và Admin. Chỉ đọc Figma và xuất tài liệu/asset; không sửa thiết kế, không triển khai hoặc chỉnh sửa code.

**[ĐỌC TRỰC TIẾP]** là thuộc tính node do Figma Plugin API trả về. **[TÍNH TỪ THÔNG SỐ]** là phép tính hình học được ghi rõ. **[CHƯA XÁC NHẬN]** là phần chưa có bằng chứng trong phạm vi khảo sát, không đồng nghĩa toàn bộ file không có.

Đơn vị hình học và typography là px; số thập phân hiển thị làm tròn 2 chữ số. Màu HEX chuyển từ RGB 0–1 của Figma sang 8-bit và ghi opacity riêng. Padding ghi theo thứ tự trên / phải / dưới / trái. Border chỉ tồn tại khi có stroke paint; các giá trị strokeWeight mặc định trên node không có stroke không được coi là viền hiển thị.

Không đọc toàn bộ chi tiết 63 frame. Đã kiểm kê tên, ID, kích thước của tất cả frame cấp cao nhất, đọc sâu 3 mẫu chính và đọc giới hạn một số control/state bổ sung. Page 3 hiện có **63 frame**, khác con số 61 trong mô tả ban đầu; ngoài ra có một text rời `26:83`.

## 2. Frame đại diện và bằng chứng hình ảnh


| Khu vực | Frame nguồn | Kích thước thực | Lý do chọn |
| --- | --- | --- | --- |
| Public | [24:1632](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=24-1632) — UniHub — Trang chủ (Guest) | 1280 × 2823.25 | Navbar Guest, footer, màu thương hiệu, typography, CTA, card và badge |
| Student | [301:382](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=301-382) — Cơ hội dành cho bạn | 1280 × 1411.25 | Navbar đã đăng nhập, avatar/thông báo, bố cục 2 cột, card và footer |
| Admin | [166:940](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=166-940) — Dashboard_Mặc định | 1280 × 1024 | Sidebar, nav active/inactive, vùng nội dung, card, refresh và footer Admin |


Lưu ý trực tiếp từ nội dung: Dashboard_Mặc định vẫn hiển thị “Đồng bộ dữ liệu một phần” và “Lỗi tải dữ liệu”. Không dùng tên frame làm bằng chứng đây là trạng thái thành công hoàn toàn.

- [Public — PNG](screenshots/public.png)
- [Student — PNG](screenshots/student.png)
- [Admin — PNG](screenshots/admin.png)

Screenshot Student do công cụ trả về có vùng render 1296 × 1419 (metadata original 1296 × 1418), lớn hơn bounds frame 1280 × 1411.25; ảnh giữ nguyên kết quả xuất mặc định, gồm phần tràn/biên ngoài. Không dùng kích thước bitmap này làm viewport chuẩn.

## 3. Layout và shell dùng chung — [ĐỌC TRỰC TIẾP]


| Nhóm | Thông số | Nguồn frame → node |
| --- | --- | --- |
| Public main | Main 1280 × 2522; padding top 72, trái/phải 40. Container 1200; padding 24/32/24/32; gap dọc 48. Section hero rộng 1136, cao 456, padding 48. | 24:1632 → 24:1633, 24:1634, 24:1635 |
| Public navbar | 1280 × 72; nền trắng opacity 90%; padding ngang 40; container 1200 với padding ngang 32. Brand 148 × 48; nav 415 × 28, gap 32; Google CTA 270 × 48. | 24:1632 → 24:2069, 24:2070, 36:441, 24:2071, 49:1680 |
| Public nav active | Chữ #0077B6; underline phía dưới 1 px, padding bottom 4; link 68 × 25. Inactive chữ #334155. | 24:1632 → 24:2074, 24:2075, 24:2077 |
| Student main | Padding top 64. Content Container 1280; padding 40/32/40/32; gap 32. Hàng 2 cột rộng 1216, gap 24; cột phải 360, cột trái 832. | 301:382 → 301:383, 301:384, 301:394, 301:395, 301:597 |
| Student navbar | 1280 × 64; nền trắng opacity 95%. Brand 138 × 40; nhóm trái rộng 838, gap 32. Nav rộng 668, gap 24. Nhóm thông tin người dùng rộng 222.99 × 36. | 301:382 → 303:11, 303:13, 303:14, 303:19, 303:32 |
| Student active/avatar | Active #0077B6, underline dưới 2 px. Avatar 36 × 36, radius 9999, nền #CAF0F8; chữ viết tắt 14/20 weight 700 #03045E. Logo 40 × 40; icon chuông có bounds 16 × 20. | 301:382 → 303:24, 303:45, 303:47, 303:16, 303:36 |
| Public/Student footer | Cao 301.25, rộng 1280; padding top 48, bottom 32; nền #F1F5F9, border top 1 #E2E8F0. Grid nội dung 1216 × 188.25; bố cục thương hiệu, khám phá, hỗ trợ. Logo footer 180 × 180. | 24:1632 → 49:1758, 49:1760; 301:382 → 303:48, 303:50, 303:53 |
| Admin sidebar | 260 × 1024; border phải 1 #E2E8F0; gradient #E0F2FE (0) → #EBF7FD (0.5) → #F0F9FF (1). Nav padding 16, gap 6. Logo 36 × 36. | 166:940 → 166:941, 166:948, 166:945 |
| Admin nav | Mục active 227 × 46.5, padding 12/16/12/16, gap 12, radius 8, nền #0077B6, chữ trắng. Mục inactive cùng bounds, nền không fill, chữ #03045E. Mục Tài khoản & Phân quyền thực tế cao 57. | 166:940 → 166:949, 166:954, 166:964 |
| Admin account block | 259 × 122.75, padding 20, gap 12; nền trắng opacity 60%, border top 1 #E2E8F0, background blur 4. Đăng xuất chữ #B91C1C. | 166:940 → 166:969, 166:980 |
| Admin content | Main rộng 1020 tại x=260. Container padding 32, gap 32; hàng tiêu đề rộng 956, border bottom 1 #E2E8F0. | 166:940 → 166:981, 166:982, 166:983 |
| Admin footer | 1020 × 52 tại y=972 trong main; padding 15/32/16/32, trắng; border top 1 #E2E8F0. Chữ 14/20 weight 400 #64748B. | 166:940 → 166:1106, 166:1108 |


**[TÍNH TỪ THÔNG SỐ]** Public: 1280 − 2×40 = container 1200; 1200 − 2×32 = nội dung section 1136. Student: 1280 − 2×32 = 1216; 1216 − 360 − 24 = 832. Admin: 1280 − 260 = 1020; 1020 − 2×32 = 956.

Public nav có Trang chủ, Hub cơ hội, Lộ trình kỹ năng, Diễn đàn và CTA Google. Student thêm Cơ hội dành cho bạn, Lịch & Deadline và cụm tài khoản. Admin dùng sidebar 4 mục: Dashboard thống kê, Kiểm duyệt nội dung, Quản lý danh mục, Tài khoản & Phân quyền.

**[CHƯA XÁC NHẬN]** Tên layer “Responsive Layout” chỉ là tên. Chưa có phép đo breakpoint, max-width CSS, quy tắc collapse nav/sidebar hoặc viewport mobile từ các frame đã chọn. Khoảng gap lớn do auto-layout phân bố ở viewport này không phải spacing token dùng cho mọi chiều rộng.

## 4. Typography — [ĐỌC TRỰC TIẾP]

Các text đã khảo sát dùng **Inter**; weight quan sát 400 (Regular), 500 (Medium), 600 (Semi Bold), 700 (Bold). Line-height là PIXELS. Letter-spacing trong các style của 3 mẫu chính là 0 px. Không xuất file font; lựa chọn cách cung cấp/license font cần quyết định ở repository.


| Vai trò mẫu | Size / line-height / weight | Màu | Frame → text node |
| --- | --- | --- | --- |
| Public hero H1 | 32 / 40 / 700 | #03045E | 24:1632 → 24:1642 |
| Public H2 | 24 / 32 / 600 | #03045E | 24:1632 → 24:1698 |
| Public tile H3 | 18 / 28 / 600 | #0F172A | 24:1632 → 24:1709 |
| Public body hero | 16 / 24 / 400 | #334155 | 24:1632 → 24:1644 |
| Public supporting body | 14 / 20 / 400 | #475569 | 24:1632 → 24:1700 |
| CTA/link | 14 / 20 / 500 | #FFFFFF hoặc #0077B6 | 24:1632 → 24:1647, 24:1649 |
| Badge | 12 / 16 / 600 | #075985 hoặc #166534 | 24:1632 → 24:1671, 26:17 |
| Student page title | 24 / 32 / 600 | #03045E | 301:382 → 301:391 |
| Student title card | 16 / 24 / 500 | #0F172A | 301:382 → 301:415 |
| Student subtitle | 14 / 20 / 500 | #334155 | 301:382 → 301:393 |
| Student hint | 12 / 16 / 400 | #475569 | 301:382 → 301:405 |
| Student user name | 14 / 20 / 600 | #0F172A | 301:382 → 303:42 |
| Admin H1 / KPI | 32 / 40 / 700 | #03045E | 166:940 → 166:986, 166:1004 |
| Admin H2 | 24 / 32 / 600 | #03045E | 166:940 → 166:1030 |
| Admin menu | 14 / 20 / 500 | #FFFFFF active, #03045E inactive | 166:940 → 166:953, 166:958 |
| Admin metadata | 12 / 16 / 400 | #334155 | 166:940 → 166:989 |
| Brand wordmark | 24 / 32 / 700 | Có mixed segment xanh đậm + #2563EB | 24:1632 → 36:444; 301:382 → 303:18; 166:940 → 166:947 |


Danh sách đầy đủ các tổ hợp typography đo trong từng mẫu (có source text ID và màu) nằm trong JSON bằng chứng, tránh ép các vai trò khác nhau về cùng một token khi Figma đang khác.

## 5. Bảng màu dùng chung — [ĐỌC TRỰC TIẾP]


| Vai trò mô tả theo vị trí sử dụng | Màu | Nguồn frame → node |
| --- | --- | --- |
| Primary, active, CTA | #0077B6 | 24:1632 → 24:1646; 166:940 → 166:949 |
| Heading/brand navy | #03045E | 24:1632 → 24:1642; 166:940 → 166:986 |
| Cyan surface | #CAF0F8 | 24:1632 → 24:1635; 301:382 → 303:45 |
| Page surface | #F8FAFC | 24:1632 → 24:1633; 301:382 → 301:383 |
| Secondary surface/footer | #F1F5F9 | 24:1632 → 49:1758; 301:382 → 303:48 |
| Card / input | #FFFFFF | 301:382 → 301:598; 36:39 → 36:58 |
| Text chính/phụ | #0F172A / #334155 / #475569 / #64748B / #94A3B8 | 24:1632 → 24:1709, 24:1644, 24:1700; 166:940 → 166:1108, 166:1047 |
| Divider / input border | #E2E8F0 / #CBD5E1 | 166:940 → 166:941; 36:39 → 36:58 |
| Success badge | #DCFCE7 nền, #166534 chữ | 24:1632 → 26:16, 26:17 |
| Info badge | #E0F2FE nền, #075985 chữ | 24:1632 → 24:1670, 24:1671 |
| Error | #FEF2F2 nền, #FCA5A5 border, #B91C1C chữ | 124:2752 → 124:3002, 124:3006 |
| Warning | #FFFBEB nền; #92400E text hoặc #B45309 Admin | 24:1632 → 24:1966, 24:1967; 166:940 → 166:993 |


Vai trò trong bảng là nhãn mô tả của tài liệu, **không khẳng định tên token/variable chính thức của Figma**.

## 6. Control và trạng thái — [ĐỌC TRỰC TIẾP]


| Control/state | Thông số | Frame → node |
| --- | --- | --- |
| Primary CTA Public | 144 × 40; radius 10; fill #0077B6; padding 9.5/16/10.5/16; chữ 14/20 500 trắng; không stroke. | 24:1632 → 24:1646, 24:1647 |
| Text CTA Public | 199 × 40; radius 10; không fill/stroke; cùng padding CTA; chữ #0077B6. | 24:1632 → 24:1648, 24:1649 |
| Outline button | 104 × 40; radius 10; border 1 #0077B6; padding ngang 16; chữ 14/20 500. | 36:39 → 36:92, 36:93 |
| Search primary | 125 × 40; radius 10; fill #0077B6; padding ngang 20; gap icon/text 8; chữ trắng 14/20 500. | 36:39 → 36:94, 36:98 |
| Google default | 270 × 48; radius 10; trắng, border 1 #CBD5E1; gap 12; chữ 14/20 500. | 152:11244 → 152:11303, 152:11310 |
| Google loading | 270 × 48; radius 10; nền #E2E8F0; border 1 #0077B6; chữ #475569 14/20 500; nội dung Đang chuyển đến Google...; opacity node vẫn 1. | 152:11379 → 152:11458, 152:11463 |
| Disabled update role | 168.34 × 40; radius 8; nền #CBD5E1; chữ #64748B 14/20 500; padding ngang 16; gap 6; opacity node 1. | 189:3034 → 189:3282, 189:3286 |
| Input search | 279.5 × 40; radius 10; trắng; border 1 #CBD5E1; padding 10/12/10/36 để dành chỗ icon; chữ 14/20 400. | 36:39 → 36:58, 36:60 |
| Select đóng | 279.5 × 40; radius 10; trắng; border 1 #CBD5E1; padding 8/12/8/12; chữ 14/20 400 #1E293B. Có lựa chọn Công nghệ thông tin, Thực tập, Tất cả hình thức. | 36:39 → 36:67, 36:76, 36:85 |
| Input date/number | Date 226 × 40, number 464 × 40; radius 8; border 1 #CBD5E1; nền trắng. Padding date 7/36/7/12, number 10.5/48/10.5/12. | 124:2752 → 124:3036, 124:3077 |
| Input error | 464 × 40; radius 8; border 2 #B91C1C; padding 9.5/40/9.5/12; helper text #B91C1C 12/16 500. | 124:2752 → 124:3024, 124:3022 |
| Input có viền/ring xanh | 432 × 40; radius 10; border 1 #0077B6; shadow 0/0 blur0 spread1 cùng màu; padding 10/14/10/14; placeholder #94A3B8 14/20 400. Hình thức giống focus, tên node không xác nhận state. | 183:1304 → 183:1540, 183:1542 |
| Badge Thực tập | 69 × 20; radius 9999; padding 2/8/2/8; nền #E0F2FE; chữ #075985 12/16 600. | 24:1632 → 24:1670, 24:1671 |
| Badge Verified cyan | 76.83 × 20; radius 9999; padding 2/8/2/8; gap 2; nền #CAF0F8; chữ #03045E 12/16 600, có icon. | 24:1632 → 24:1672, 24:1675 |
| Badge Verified green | 71 × 21; radius 9999; padding 2/8/2/8; nền #DCFCE7; chữ #166534 12/16 600. | 24:1632 → 26:16, 26:17 |
| Error alert sự kiện | 464 × 46; radius 8; padding 12; gap 8; nền #FEF2F2, border 1 #FCA5A5, chữ #B91C1C 14/20 400. | 124:2752 → 124:3002, 124:3006 |
| Error alert đăng nhập | 358 × 46; radius 10; padding 12/16/12/16; gap 10; cùng màu error; chữ 14/20 500. | 152:11508 → 152:11590, 152:11596 |
| Modal sự kiện | 512 × 621, radius 12, trắng. Overlay #0F172A opacity 50%, background blur 4. Tiêu đề 24/32 600 #03045E. Nút Hủy 61 × 40, Lưu 91.5 × 40, radius 8. | 124:2752 → 124:2987, 124:2986, 124:2995, 124:3095, 124:3097 |
| Modal danh mục | 480 × 272; radius 12; nền trắng; padding 24; title 24/32 600 #0F172A. Hủy 61 × 38, Lưu 66 × 36, radius 10. | 183:1304 → 183:1529, 183:1533, 183:1545, 183:1547 |


**State có bằng chứng:** default, selected nav, input error, save/login error, Google processing, role-update disabled. Các frame riêng còn thể hiện empty, lỗi một phần/toàn bộ, dashboard loading, success và confirm/delete/reject; bảng kiểm kê cuối tài liệu cung cấp ID, nhưng không trích xuất toàn bộ chi tiết chúng.

**[CHƯA XÁC NHẬN]** Hover/pressed của từng control, dropdown menu mở và navigation bằng bàn phím, focus state được đặt tên rõ, timing spinner/transition, focus trap, quy tắc disable theo dữ liệu, tooltip, tab order. Không biến hình thức “giống focus” thành một state chính thức đã xác minh. Prototype ON_CLICK chỉ chứng minh liên kết node, không chứng minh API/route/restriction nghiệp vụ.

## 7. Border, radius và shadow

Radius trực tiếp: button/input chủ yếu 10; form sự kiện và disabled role button 8; card/modal 12; badge/avatar 9999. Có khác biệt theo khu vực, không tự đồng nhất.

Card Student `301:598`: 360 × 350, padding 20, gap 20, radius 12, trắng, không stroke. Card KPI Admin `166:1000`: 227 × 132, padding 24, gap 17, radius 12, trắng, border 1 #E2E8F0.

Các effect dưới đây ghi theo Figma: offset x/y, blur radius, spread, màu và opacity. Background blur ghi riêng; đây không phải cam kết công thức CSS blur tương đương tuyệt đối.


| Node nguồn (frame tra ở mục 3/6 hoặc JSON) | Offset x/y/blur/spread | Màu / opacity |
| --- | --- | --- |
| 24:1635 | 0 / 2 / 8 / 0 | #03045E / 7% |
| 24:1653 | 0 / 4 / 16 / 0 | #03045E / 8% |
| 24:1653 | Background blur 12 | — |
| 24:1668 | 0 / 8 / 24 / 0 | #03045E / 12% |
| 24:1685 | 0 / 4 / 16 / 0 | #03045E / 9% |
| 24:1685 | Background blur 12 | — |
| 24:1773 | 0 / 2 / 8 / 0 | #03045E / 7% |
| 24:1805 | 0 / 2 / 8 / 0 | #03045E / 7% |
| 24:1837 | 0 / 2 / 8 / 0 | #03045E / 7% |
| 24:2069 | 0 / 1 / 8 / 0 | #03045E / 6% |
| 24:2069 | Background blur 24 | — |
| 49:1680 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 301:407 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 301:475 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 301:533 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 301:598 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 303:11 | 0 / 1 / 8 / 0 | #03045E / 6% |
| 303:11 | Background blur 12 | — |
| 166:941 | 1 / 0 / 10 / 0 | #03045E / 3% |
| 166:1099 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 24:1646 | 0 / 2 / 8 / 0 | #03045E / 12% |
| 166:949 | 0 / 1 / 2 / 0 | #0077B6 / 20% |
| 166:969 | Background blur 4 | — |
| 166:1000 | 0 / 2 / 8 / 0 | #03045E / 6% |
| 36:94 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 152:11303 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 183:1540 | 0 / 0 / 0 / 1 | #0077B6 / 100% |
| 124:2986 | Background blur 4 | — |
| 124:2987 | 0 / 8 / 24 / 0 | #03045E / 18% |
| 124:3002 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 152:11458 | 0 / 1 / 2 / 0 | #000000 / 5% |
| 152:11590 | 0 / 1 / 2 / 0 | #000000 / 5% |

## 8. Asset đã xuất

SVG được xuất trực tiếp bằng `exportAsync({format: SVG_STRING})`, giữ nguyên nội dung và root dimensions. Logo trong Figma dùng ảnh raster bên trong SVG; wrapper SVG **không biến logo thành vector thuần**. Không vẽ lại, không thay icon bằng thư viện khác.


| Tệp | Node nguồn | Kích thước | Tên trong Figma |
| --- | --- | --- | --- |
| [logo-student-40.svg](assets/logo-student-40.svg) | 303:16 | 40 × 40 | UniHub Logo |
| [logo-admin-36.svg](assets/logo-admin-36.svg) | 166:945 | 36 × 36 | UniHub Logo |
| [notification.svg](assets/notification.svg) | 303:36 | 16 × 20 | Icon |
| [admin-dashboard.svg](assets/admin-dashboard.svg) | 166:950 | 20 × 20 | SVG |
| [admin-moderation.svg](assets/admin-moderation.svg) | 166:955 | 20 × 20 | SVG |
| [admin-categories.svg](assets/admin-categories.svg) | 166:960 | 20 × 20 | SVG |
| [admin-accounts.svg](assets/admin-accounts.svg) | 166:965 | 19.09 × 20 | SVG |
| [refresh.svg](assets/refresh.svg) | 166:995 | 16 × 16 | SVG |
| [edit-profile.svg](assets/edit-profile.svg) | 301:635 | 13.5 × 12 | Icon |
| [arrow-right.svg](assets/arrow-right.svg) | 24:1771 | 13.33 × 13.33 | Icon |

Logo footer có thêm [logo-footer-180.png](assets/logo-footer-180.png), nguồn `303:53`, 180 × 180; đây là bản render PNG do công cụ screenshot xuất tại kích thước tự nhiên. Ảnh screenshot toàn frame là reference kiểm tra, không dùng làm background thay cho giao diện.

Bộ asset là tập con cho phần dùng chung, chưa phải toàn bộ icon của 63 màn hình. Font không nằm trong gói. Dùng `assets/manifest.json` để truy nguồn mỗi asset; không phụ thuộc URL asset Figma tạm thời.

## 9. Điểm cần quyết định trong phiên repository — [CHƯA XÁC NHẬN]

- Chưa kiểm tra repository: framework, thư viện component/icon, routing, auth, package font và quy ước token chưa được quyết định.
- Chưa xác nhận breakpoint/mobile, dark mode, grid responsive và hành vi sticky/fixed từ các thuộc tính đã đọc.
- Page 3 không có COMPONENT hoặc COMPONENT_SET theo truy vấn trực tiếp; các mẫu ở đây là frame/layer. Không suy ra toàn file không có thư viện hay variable. Chưa kiểm kê local/published variables hoặc style library.
- Không coi tên token mô tả trong tài liệu là variable/style ID chính thức.
- Không gán nghĩa API, RBAC, debounce, animation, hay kiểm tra dữ liệu từ mockup. Nội dung minh họa là dữ liệu thiết kế.
- Public/Student/Admin có header, radius input và kích thước nút khác nhau. Khi làm nền tảng nên hỗ trợ cấu hình theo shell; việc hợp nhất là quyết định triển khai, không phải thông số đọc từ Figma.
- Một số frame có nội dung tràn bounds và thông số fractional. Giữ làm bằng chứng, chưa tự sửa trong Figma hoặc “chuẩn hóa” tài liệu thành kích thước mới.

## 10. Chỉ dẫn bàn giao cho Codex repository

Đọc tài liệu này cùng ảnh reference, asset manifest và bằng chứng JSON. Trước khi triển khai, kiểm tra component/token có sẵn trong repository và đối chiếu khác biệt ở mục 9. Phạm vi khởi đầu đề xuất: PublicShell, StudentShell, AdminShell và các primitive Button, Input, Select, Badge, Card, Alert, Dialog. Đây là **đề xuất tổ chức triển khai**, không phải tên component đang có trong Figma.

Ánh xạ source frame/node phải được giữ khi chuyển sang token. Chỉ xây phần dùng chung; chưa triển khai toàn bộ màn hình hoặc nghiệp vụ. Khi cần thông số ngoài phạm vi tài liệu, đọc bổ sung đúng node từ Figma hoặc ghi thành quyết định triển khai; không ghi nhận suy đoán là thông số Figma.

## 11. Kiểm kê frame Page 3 — [ĐỌC TRỰC TIẾP]

Chỉ liệt kê frame cấp cao nhất; tên giữ nguyên nội dung Figma, có thể trùng nhau. Dùng ID để phân biệt.

| STT | Frame ID | Tên Figma | Rộng × cao |
| --- | --- | --- | --- |
| 1 | [24:1632](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=24-1632) | UniHub — Trang chủ (Guest) | 1280 × 2823.25 |
| 2 | [36:39](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=36-39) | Hub cơ hội-V2 | 1280 × 1643.25 |
| 3 | [47:904](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=47-904) | intern (v3) | 1280 × 2094.33 |
| 4 | [168:1274](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=168-1274) | Tin chờ thẩm định  | 1280 × 1555 |
| 5 | [49:1339](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=49-1339) | job work | 1280 × 2167.48 |
| 6 | [49:1795](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=49-1795) | hbong | 1280 × 2436.08 |
| 7 | [103:1811](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=103-1811) | Lỗi 403 | 1280 × 1114 |
| 8 | [103:1916](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=103-1916) | Lỗi 404 | 1280 × 1205 |
| 9 | [123:484](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=123-484) | Mặc định | 1280 × 1673.5 |
| 10 | [123:1119](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=123-1119) | Danh sách thông báo khi bấm chuông | 1280 × 1159.25 |
| 11 | [123:1472](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=123-1472) |  Trạng thái rỗng | 1280 × 1223.25 |
| 12 | [124:2344](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=124-2344) | Thêm sự kiện | 1280 × 1248.25 |
| 13 | [124:2752](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=124-2752) | Sửa và lỗi hợp lệ | 1280 × 1169.25 |
| 14 | [124:3162](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=124-3162) | Xóa sự kiện | 1280 × 1151.75 |
| 15 | [128:4460](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=128-4460) | Diễn đàn_Guest | 1280 × 1918.25 |
| 16 | [129:4708](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=129-4708) | Diễn đàn_Sinh viên | 1280 × 2054.75 |
| 17 | [130:4996](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=130-4996) | Chưa có bài trong chủ đề đang chọn | 1280 × 1249.25 |
| 18 | [130:6674](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=130-6674) | Đặt câu hỏi mới | 1280 × 1482.75 |
| 19 | [130:7274](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=130-7274) | Lỗi từng trường | 1280 × 897.5 |
| 20 | [131:7557](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=131-7557) | Chi tiết_Guest | 1280 × 1430.25 |
| 21 | [132:8063](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=132-8063) | Gửi bình luận thành công | 1280 × 2148.5 |
| 22 | [132:8428](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=132-8428) |  Lỗi lưu | 1280 × 1992.25 |
| 23 | [132:8943](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=132-8943) | Bài viết không còn tồn tại | 1280 × 1141.25 |
| 24 | [132:9120](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=132-9120) |  Lỗi bình luận rỗng | 1264 × 1870 |
| 25 | [138:1796](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=138-1796) | Chi tiết - Student | 1280 × 1952.33 |
| 26 | [152:11244](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-11244) | Đăng nhập | 1280 × 1204 |
| 27 | [152:11379](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-11379) | đăng nhập (đang xử lý) | 1280 × 1115 |
| 28 | [152:11508](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-11508) | đăng nhập (error) | 1280 × 867.55 |
| 29 | [152:11650](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-11650) | Tạo hồ sơ | 1280 × 1185.25 |
| 30 | [152:11846](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-11846) | Hồ sơ thiếu | 1280 × 1203.25 |
| 31 | [152:12044](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-12044) | Đang biên soạn | 1280 × 1333 |
| 32 | [152:12185](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-12185) | Không tải dữ liệu được | 1280 × 1380.26 |
| 33 | [152:12375](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-12375) | Guest | 1280 × 1460.75 |
| 34 | [152:12586](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-12586) | student | 1280 × 1460.75 |
| 35 | [152:12841](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-12841) | Guest | 1280 × 2822.5 |
| 36 | [152:13186](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-13186) | Student | 1280 × 2690.13 |
| 37 | [152:13498](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=152-13498) | Lỗi lưu | 1280 × 1261.25 |
| 38 | [165:347](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=165-347) | Dashboard_Lỗi một phần | 1280 × 1024 |
| 39 | [165:625](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=165-625) | Dashboard_ Lỗi toàn bộ | 1280 × 1024 |
| 40 | [165:792](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=165-792) | Dashboard_Đang tải | 1280 × 1024 |
| 41 | [166:940](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=166-940) | Dashboard_Mặc định | 1280 × 1024 |
| 42 | [169:1568](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=169-1568) |  Hộp xác nhận duyệt có nhãn | 1280 × 1523 |
| 43 | [171:1838](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-1838) | Hộp xác nhận duyệt không nhãn | 1280 × 1523 |
| 44 | [171:2117](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-2117) |  Modal từ chối | 1280 × 1523 |
| 45 | [171:2398](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-2398) | Thành công | 1280 × 1024 |
| 46 | [171:2554](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-2554) |  Không có tin chờ | 1280 × 1024 |
| 47 | [171:2628](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-2628) |  Chi tiết một tin HỌC BỔNG | 1280 × 1661 |
| 48 | [171:3154](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-3154) | Model lỗi từ chối | 1280 × 1523 |
| 49 | [178:4469](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=178-4469) | Giám sát cộng đồng  | 1280 × 1024 |
| 50 | [178:4637](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=178-4637) | Modal xóa bình luận | 1280 × 1119 |
| 51 | [178:4954](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=178-4954) |  Lỗi thiếu lý do | 1280 × 1024 |
| 52 | [178:5193](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=178-5193) | Modal xóa BÀI ĐĂNG | 1280 × 1024 |
| 53 | [178:5420](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=178-5420) |  Thành công | 1280 × 1174 |
| 54 | [178:5739](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=178-5739) | Không có nội dung cần xử lý | 1280 × 1024 |
| 55 | [183:1079](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=183-1079) | Tab Chuyên ngành  | 1280 × 1024 |
| 56 | [183:1304](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=183-1304) | Modal thêm mới | 1280 × 1024 |
| 57 | [183:1550](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=183-1550) |  Modal đóng mục | 1280 × 1024 |
| 58 | [183:1801](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=183-1801) | Tab Kỹ Năng | 1280 × 1024 |
| 59 | [188:2780](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=188-2780) | Hộp xác nhận đổi vai trò | 1280 × 1024 |
| 60 | [189:3034](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=189-3034) | "Cập nhật vai trò" bị vô hiệu | 1280 × 1133 |
| 61 | [189:3298](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=189-3298) | Quản lý tài khoản và phân quyền  | 1280 × 1024 |
| 62 | [296:2](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=296-2) | Mặc định_Đã có hồ sơ | 1280 × 1203.25 |
| 63 | [301:382](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=301-382) | Cơ hội dành cho bạn  | 1280 × 1411.25 |

## 12. Bằng chứng máy đọc

- [inventory.json](evidence/inventory.json): 63 frame, cấu trúc shell và kết quả tìm component trên Page 3.
- [public.json](evidence/public.json), [student.json](evidence/student.json), [admin.json](evidence/admin.json): typography, palette, cấu trúc, source IDs và một tập liên kết prototype.
- [controls.json](evidence/controls.json): phép đo chi tiết các control/layout bổ sung.
- [states.json](evidence/states.json), [state-appearance.json](evidence/state-appearance.json): nguồn state và appearance cụ thể.

Bằng chứng chỉ chứa phần đã truy vấn thành công; các truy vấn vượt giới hạn phản hồi không được dùng làm thông số. Dữ liệu không phải full Figma file export.
