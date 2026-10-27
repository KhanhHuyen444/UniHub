# Ghi nhận giao diện chi tiết cơ hội

## Nguồn và mức độ chắc chắn

Nhóm cung cấp ba ảnh làm căn cứ hình thức cho trang Public detail:

| Loại cơ hội | Ảnh nguồn         |
| ----------- | ----------------- |
| Học bổng    | `hbong.png`       |
| Việc làm    | `job work.png`    |
| Thực tập    | `intern (v3).png` |

Ảnh tham khảo bố cục và phân cấp thị giác; nội dung ví dụ trong ảnh không được chép vào ứng dụng. Không dùng frame diễn đàn `131:7557` hoặc frame kiểm duyệt Admin `171:2628` làm thiết kế thay thế. Ba ảnh chưa cung cấp số đo Figma trực tiếp. Các số dưới đây là **ước lượng từ ảnh ở viewport 1280 px**, không phải thuộc tính được đọc từ Figma:

| Thuộc tính                | Ước lượng để triển khai                         |
| ------------------------- | ----------------------------------------------- |
| Khung nội dung chi tiết   | Khoảng 1104 px, căn giữa                        |
| Tỷ lệ hai cột             | Cột nội dung chính xấp xỉ gấp đôi cột thông tin |
| Khe giữa hai cột          | Khoảng 24 px                                    |
| Khe giữa các thẻ nội dung | Khoảng 20 px                                    |
| Padding bên trong thẻ     | Khoảng 20–24 px                                 |

Font Inter, màu, radius, border và shadow dùng lại tokens/component hiện có; không khai báo hệ token mới từ ảnh. Cỡ chữ, spacing và các vị trí cụ thể trong ảnh vẫn chỉ là tham chiếu trực quan. Không tuyên bố trang đã khớp số đo Figma trực tiếp.

## Cấu trúc và dữ liệu hiển thị

`/opportunities/:id` dùng một page chung và gọi API client hiện có `GET /api/opportunities/:id`. Trang gồm hàng quay lại/chọn loại, breadcrumb và header cơ hội ở cột chính; các section nội dung nằm dưới header. Cột phải có thông tin cơ hội, nguồn gốc nếu có và thẻ Verified chỉ khi `isVerified === true`. Dùng `PublicLayout`, Inter và component chung hiện có.

Nội dung description/requirements là text thuần. Renderer tách các dòng bắt đầu bằng `## ` và sắp section theo BR-01.8 trong Chương 3:

| Loại     | Thứ tự heading                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Thực tập | Mô tả thực tập → Đối tượng thực tập → Yêu cầu → Quyền lợi và hỗ trợ                                                |
| Việc làm | Mô tả công việc → Yêu cầu kinh nghiệm → Yêu cầu ứng viên → Quyền lợi và đãi ngộ                                    |
| Học bổng | Giới thiệu học bổng → Đối tượng và điều kiện xét tuyển → Giá trị học bổng → Hồ sơ cần chuẩn bị → Hướng dẫn đăng ký |

Heading không nhận diện được vẫn được giữ nguyên tên và nội dung, đặt sau các heading đã biết để không âm thầm làm mất dữ liệu. Nếu trường có text nhưng không chứa heading, dùng heading đầu vào tương ứng với `description` hoặc `requirements` theo loại cơ hội; đây là fallback tối thiểu vì text không cho biết cách chia mục. Nội dung được React render dưới dạng text, không diễn giải HTML.

`majors`, `skills` và `eligibleAcademicYears` được lấy trực tiếp từ response. Chuyên ngành/năm học gắn với mục đối tượng; kỹ năng gắn với mục yêu cầu. Khi cần tạo mục chỉ để đặt các metadata này, heading dùng quy tắc BR-01.8 theo loại. `eligibleAcademicYears: []` không tạo hàng năm học. Tên Major/Skill từ API vẫn được giữ, kể cả category Closed; trang chi tiết không gọi API options.

| Trường/trạng thái           | Cách hiển thị                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `workFormat` / `location`   | Hình thức ở header và thông tin bên phải; địa điểm chỉ khi Offline/Hybrid và API có giá trị.          |
| Deadline date/datetime      | Dùng ngày `date` từ API; nhãn hết hạn chỉ theo `state` do backend trả. Không tính countdown ở client. |
| Deadline `null` / `unknown` | Không hiển thị dòng hạn; `unknown` không suy ra ngày hoặc nhãn trạng thái từ instant.                 |
| `isVerified === true`       | Huy hiệu và giải thích ngắn rằng tin được gắn nhãn Verified. Khi false, cả hai phần đều vắng mặt.     |
| `sourceUrl`                 | Link trực tiếp chỉ khi parser đã chấp nhận URL HTTP/HTTPS; không lấy URL từ ảnh hoặc publisher.       |
| Thiếu/rỗng trường text      | Bỏ mục tương ứng. Không thêm lợi ích, điều kiện, hồ sơ hay hướng dẫn thay cho API.                    |

Không có hành vi nộp hồ sơ trên UniHub. Link chọn loại khác là liên kết tới danh sách với `type` tương ứng; loại hiện tại là trạng thái đang xem, không phải tab tương tác. Card danh sách giữ URL filter/page làm return state. Chỉ nhận return path nội bộ `/opportunities` cùng query; URL trực tiếp hoặc state không hợp lệ quay về `/opportunities`.

## Kiểm tra giao diện và giới hạn

Kiểm tra trên Chromium 154 headless ở zoom mặc định 100%, device scale 1, viewport 1280×1000 và 1920×1000; chờ `document.fonts.ready` và decode ảnh trước khi chụp. Font computed là Inter và `document.fonts.check` thành công cho Inter 700 với chữ tiếng Việt. `document.documentElement.scrollWidth` không vượt quá viewport; title dài tự xuống dòng, không bị cắt.

Với mock API cục bộ và fixture hư cấu, đã kiểm tra:

- Cả ba loại, thứ tự heading theo BR-01.8, link loại khác và loại hiện tại không phải link/tab.
- Scholarship date-only hiển thị ngày nguồn; Job `deadline: null` không hiện dòng hạn; Internship `unknown` không hiện ngày/nhãn. Job/Internship không Verified và không có source link; Scholarship có Verified/source link theo response.
- Nội dung thiếu, năm học `[]`, title dài, Major Closed vẫn hiện theo response, không gọi endpoint categories từ trang chi tiết.
- Luồng list → detail → back giữ query `q`, `type`, `page`, `pageSize`; truy cập chi tiết trực tiếp quay về `/opportunities`; type link mở danh sách với filter tương ứng.
- ID sai, 404, lỗi dịch vụ và thử lại sau khi mock phục hồi. Link/focus bàn phím có tên truy cập và outline hiển thị; không có hành động nộp hồ sơ.

Mock chỉ xác nhận giao diện và frontend flow. Không gọi API backend thật, MySQL hoặc database nhóm; không xác nhận SQL/collation hoặc có dữ liệu Approved trên máy thành viên. Môi trường Linux/Chromium không chứng minh cấu hình Windows hay mọi browser đã kiểm tra.

Screenshot đầy đủ được lưu trong `/tmp` và liên kết trong báo cáo hoàn tất. Các ảnh không được thêm vào `public/`, build hoặc database.

Kiểm tra repository: `npm run typecheck`, `npm run build`, `npm test`, `npm run format:check` và `git diff --check` đạt. `npm test` có 24 test frontend pass; backend 14 pass và 8 test MySQL bị skip vì không có `TEST_DATABASE_URL` (38 pass, 8 skip tổng cộng). Không chạy test nghiệp vụ trên API hoặc MySQL thật trong nhiệm vụ này.
