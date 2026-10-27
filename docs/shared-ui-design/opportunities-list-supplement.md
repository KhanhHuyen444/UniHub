# Bổ sung thiết kế danh sách Hub cơ hội

Nguồn là ZIP `UniHub-Public-supplement-PARTIAL.zip` và ảnh `Hub cơ hội-V2.png` do nhóm cung cấp ngày 27/10/2026. ZIP giữ bằng chứng đọc trực tiếp nhưng không có screenshot hoặc SVG/PNG mới; README ghi Figma MCP đã chạm giới hạn Starter. PNG đính kèm được dùng làm tham chiếu hình ảnh, không được đưa vào `public/` hoặc bundle.

## Bằng chứng trực tiếp trong ZIP

| Vùng             | Nguồn Figma                                                | Kích thước/đọc được                                                 |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Trang Hub        | `36:39 — Hub cơ hội-V2`                                    | 1280 × 1643.25                                                      |
| Navbar Guest     | `36:377`                                                   | 1280 × 81; khác navbar 72 px của trang chủ Public                   |
| Main content     | `36:40`                                                    | 1280 × 1251.5                                                       |
| Hero             | `36:41`                                                    | 1216 × 134; badge `36:42` là 268 × 26                               |
| Filter card/form | `36:51`, `36:52`                                           | 1216 × 188; form 1166 × 130                                         |
| Bốn field        | `36:53`–`36:85`                                            | Controls grid 1166 × 66; mỗi field 279.5 × 66, control 279.5 × 40   |
| Nút lọc          | `36:91`–`36:94`                                            | Action row 1166 × 48; reset 104 × 40; search 125 × 40               |
| Tổng kết quả     | `36:99`                                                    | 1216 × 35.5                                                         |
| Grid thẻ         | `36:104`                                                   | 1216 × 598; tên node mô tả 3 cột và có 6 thẻ mẫu                    |
| Thẻ              | `36:105`, `36:142`, `36:179`, `36:216`, `36:251`, `36:286` | Mỗi thẻ rộng 389.33; cao lần lượt 267, 291, 289, 291, 289, 289      |
| Pagination       | `36:321`–`36:334`                                          | Vùng 1216 × 120; Previous 83 × 38, năm nút số 40 × 40, Next 73 × 38 |
| Footer           | `113:2`                                                    | 1280 × 301.25                                                       |

Text/label đọc trực tiếp: “Cổng thông tin tuyển dụng & học bổng”, “Khám phá Cơ hội”, mô tả giới thiệu, Từ khóa, Chuyên ngành, Loại cơ hội, Hình thức làm việc, Xóa bộ lọc, Tìm kiếm và “Xem chi tiết”. Placeholder là “Nhập tiêu đề, đơn vị đăng hoặc kỹ năng...”. Giá trị đang chọn, 28 kết quả, tên công ty/cơ hội, kỹ năng, ngày hạn và số trang trong ảnh là nội dung mẫu, không phải dữ liệu hoặc mặc định cần hardcode.

Thông số style trong `hub-controls-2026-10-25.json` được đánh dấu **đọc trực tiếp cũ**: chưa xác nhận lại ngày 27/10. Chúng ghi input/select cao 40 px, radius 10, viền `#CBD5E1`, chữ Inter 14/20; search có padding trái 36 px, outline button 104 × 40 và primary 125 × 40. Dùng lại component/tokens hiện có, không ghi các style này thành xác nhận mới của toàn frame.

## Ước lượng và lựa chọn triển khai

Các mục dưới đây là tính từ bounds/ước lượng theo PNG, không phải thuộc tính Figma được đọc trực tiếp:

- Ở 1280 px, lề trong 32 px tạo nội dung rộng 1216 px; ở 1920 px giữ rộng 1216 px và căn giữa. Navbar Hub dùng cao 81 px theo frame `36:377`.
- Bốn field 279.5 px vừa form 1166 px với ba khoảng 16 px: `(1166 - 4 × 279.5) / 3 = 16`.
- Grid 1216 px với ba card 389.33 px để lại tổng 48 px cho hai khoảng ngang, tương đương 24 px mỗi khoảng nếu không có padding. Khoảng dọc 16 px là phép tính phù hợp với grid 598 px và hai hàng cao tối đa 291 px; Figma chưa trả itemSpacing.
- Padding card 20 px, khoảng cách nội bộ, font/line-height của nội dung card, màu/viền/radius/shadow card được căn theo PNG hoặc token có sẵn. ZIP chưa có các property này.
- Để dùng được response summary chưa có skills và giữ tổng chiều cao grid gần bounds trực tiếp 598 px, implementation chọn card min-height 289 px và row-gap 20 px. Đây là ước lượng theo năm thẻ cao khoảng 289–291 px trong frame; thẻ mẫu đầu tiên trực tiếp chỉ cao 267 px nên không thể khớp biến thiên chính xác nếu không có skills/spacing đầy đủ.
- Lề 58 px sau pagination được chọn để đưa footer gần vị trí nhìn thấy trong PNG. Đây là ước lượng bố cục tổng thể, chưa phải padding đọc từ Figma. Footer dùng logo 180 × 180 theo frame/assets có sẵn; hai cột điều hướng được chia 280 px theo bố cục PNG.
- Số trang hiển thị lấy từ `meta.totalPages`, không cố định năm trang. API mặc định `pageSize=20`; ảnh mẫu có sáu thẻ và 28 kết quả nên không khớp pageSize mặc định. UI dùng toàn bộ `items` API trả về, không cắt còn sáu.
- API summary chưa trả mảng `skills`, dù tìm kiếm phía server có xét kỹ năng. Vì vậy không tạo hàng kỹ năng bằng request detail riêng cho từng thẻ; hàng đó tạm thời không render cho đến khi nhóm thống nhất thay đổi API nếu cần.
- Ảnh mẫu dùng cách ghi số ngày còn lại. API trả deadline state/ngày nhưng không trả số ngày đếm ngược; UI dùng state và ngày do backend cung cấp, không tự tính “còn N ngày”. `unknown`/`null` không hiển thị nhãn deadline theo contract.
- Vì API không cho biết số ngày còn lại, bản hiện tại hiển thị deadline `open` bằng ngày nguồn thuần; deadline `expired` có nhãn hết hạn. Cách nhấn màu cho hạn sắp tới trong PNG chưa thể tái tạo chính xác nếu không đổi contract.
- Icon briefcase/building trong trang được dựng inline ở kích thước nhỏ vì ZIP không xuất SVG ứng viên `36:43`/`36:117`. Hình dạng hiện tại là lựa chọn gần ảnh, chưa được xác nhận là asset Figma.
- Mũi tên của `<select>` là chevron CSS màu slate để gần hình trong PNG; lựa chọn vẫn là native `<select>` hỗ trợ bàn phím. ZIP không xuất được các asset ứng viên `36:69`, `36:78`, `36:87` nên chưa xác nhận đây là icon gốc.

Loading, empty, error, timeout, `INVALID_FILTER`, lọc Major, tìm kiếm và phân trang được xử lý theo contract/API đang có, không lấy trạng thái dữ liệu mẫu trong ảnh làm quy tắc. Endpoint Major của TV3 chưa có trong backend hiện tại nên select bị khóa và báo/thử lại theo trạng thái API.

## Bổ sung nguồn thiết kế chi tiết Public

Gói handoff ban đầu xác nhận `131:7557 — Chi tiết_Guest` là **chi tiết bài viết diễn đàn**: có “Quay lại Diễn đàn”, Article Body và Comments. Không dùng frame đó làm chi tiết cơ hội. `171:2628` vẫn là khu vực Admin. Sau gói handoff, nhóm đã cung cấp ba ảnh Public detail (`hbong.png`, `job work.png`, `intern (v3).png`); page chung `/opportunities/:id` đang được triển khai trên `feat/opportunities-frontend`. Ước lượng bố cục và cách ánh xạ theo Chương 3 được ghi tại [opportunities-detail-ui.md](../opportunities-detail-ui.md). Không coi các ước lượng này là số đo Figma trực tiếp.

Ở trang danh sách, các thông số còn thiếu chặn việc đối chiếu pixel và hành vi là style chi tiết bên trong card; khoảng cách chính xác giữa các hàng/thẻ và pagination; trạng thái disabled/hover/focus của pagination; asset gốc cho icon Hero và Hình thức; và cách trình bày kỹ năng/countdown tương ứng API. Chúng không chặn kết nối API, tìm kiếm, bộ lọc, phân trang động hoặc xử lý các trạng thái đã có trong contract.
