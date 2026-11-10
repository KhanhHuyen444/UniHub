# Lịch Sinh viên — Ngọc Tuyền

`/calendar` dùng guard Student, StudentLayout, phông Inter được đóng gói, các điều
khiển dùng chung và `protectedApiRequest`, bao gồm cả refresh. Tính năng sử dụng
cả sáu endpoint Events. Backend là nơi có thẩm quyền xác định quyền sở hữu;
frontend không gửi owner ID hoặc giá trị trạng thái tùy ý.

Lưới tháng từ thứ Hai đến Chủ nhật có 28–42 ngày, bao gồm ngày thuộc tháng liền
kề. Request dùng toàn bộ lưới làm khoảng nửa mở, bắt đầu từ nửa đêm theo giờ Việt
Nam rồi chuyển sang UTC. Thống kê và danh sách chỉ bao phủ khoảng này, không bao
gồm toàn bộ lịch sử sự kiện. Trạng thái lấy từ backend và chỉ có thể chuyển sang
hoàn tất một chiều. Các trường nhập luôn dùng giờ Việt Nam, bất kể múi giờ trình
duyệt. Khi sửa, giữ nguyên phần giây và bỏ qua các trường không đổi, kể cả hạn
đã qua nhưng không đổi. Thao tác không làm thay đổi dữ liệu sẽ không gửi PATCH.

Khi đổi khoảng thời gian, request danh sách cũ sẽ bị hủy. Thay đổi danh tính,
vai trò, trạng thái xác thực và việc unmount sẽ hủy các thao tác phiên đang chờ;
guard và nội dung gắn với người dùng loại bỏ dữ liệu/hộp thoại cũ. Refresh token
bình thường của cùng Student vẫn giữ nguyên biểu mẫu.

## Quyết định thiết kế

Đặc tả thiết kế lịch trên máy tính và tài liệu tham khảo bố cục đã được đối
chiếu. Khung dùng chung và tài nguyên hiện có được tái sử dụng mà không chỉnh
sửa. Tỷ lệ cột, chiều cao ô, khoảng cách, chiều rộng hộp thoại tạo/xóa, ký tự
trang trí và điểm ngắt dự phòng để xếp chồng là các ước lượng từ ảnh chụp màn
hình, không phải số đo từ Figma. Biểu mẫu tạo/sửa dùng các trường ngày/giờ riêng
để thể hiện múi giờ rõ ràng. Hộp thoại modal gốc của trình duyệt hỗ trợ giữ tiêu
điểm, phím Escape và khôi phục tiêu điểm. Khi thao tác đang chờ, không thể đóng
hộp thoại hoặc gửi lặp lại.

Trạng thái rỗng mô tả khoảng thời gian hiện tại. Không bổ sung các thiết lập
thông báo chưa được hỗ trợ, cam kết email, đồng bộ, nhập dữ liệu, bộ lọc danh
mục hoặc dữ liệu học kỳ. Chuông thông báo hiện có nhưng đang tắt không bị thay
đổi. Kiểm tra cục bộ hiển thị lỗi cạnh trường; lỗi máy chủ hiển thị ở cấp biểu
mẫu và giữ lại nội dung đã nhập. API client dùng chung không giữ lại
`fieldErrors`; phần này không thay đổi.

Các thay đổi ở tệp dùng chung gắn `/calendar` trong `app/router.tsx` và thêm liên
kết điều hướng hiện có vào `PublicLayout` chỉ dành cho Student đã xác thực; Khánh Huyền
cần review cả hai khi tích hợp. Guest và vai trò khác vẫn dùng điều hướng công
khai. Request chi tiết đang chờ sẽ vô hiệu hóa thao tác xung đột và bị bỏ qua nếu
ngữ cảnh lịch thay đổi. Tên truy cập được của nút ngày có kèm số sự kiện đã tải.
Không chỉnh sửa backend, schema, dependency hoặc contract.

## Kiểm chứng và giới hạn

Review gần nhất: ngày 31/10/2026, bắt đầu từ head `2cd7788`, vốn đã chứa
`origin/main=df6a277`. Không phát hiện hoặc sửa lỗi hồi quy trong ứng dụng
Calendar.

- Cả sáu endpoint Events đều dùng `protectedApiRequest`/refresh hiện có; backend
  thực thi quyền sở hữu. Không gửi owner ID hoặc trạng thái tùy ý.
- Người dùng đăng nhập Google Student thật, Express thực tế và một MySQL 8.4.13
  mới có guard cùng các migration hiện có: luồng giao diện tạo → lưu qua F5 →
  sửa → hoàn tất → xóa đã chạy và đạt. Lần chạy trình duyệt này không dùng HTTP/
  auth mock, sao chép token, token giả hoặc đổi vai trò.
- Ảnh chụp ở 1280x1000: Calendar được tạo/hoàn tất, lưu cục bộ tại
  `.cache/tv4/33-calendar-*.png`. Không khẳng định khớp từng pixel khi chưa so
  sánh thiết kế.
- Các kiểm tra đầy đủ: typecheck/build/format/diff-check đều đạt. Frontend đạt
  85, bỏ qua 32; backend đạt 133, bỏ qua 17; không có lỗi. Playwright harness
  tùy chọn và các bộ kiểm thử DB không có test URL cụ thể vẫn bị bỏ qua. Unit
  test HTTP Calendar hiện có dùng response giả lập, khác với lần chạy trình
  duyệt thực tế.
- Môi trường chạy: Windows, Node 24.22.1 / npm 11.19.1. Không thay đổi
  dependency/lockfile.
- Một lần chạy dev server gặp lỗi Vite dependency-cache 504 sau các SSR test.
  Khởi động lại đúng checkout sau khi test đã khắc phục lỗi. Một selector tự
  động ban đầu chọn nút Delete phía sau thay vì nút trong modal; sau khi sửa
  selector, toàn bộ luồng giao diện thực tế đã đạt. Không trường hợp nào cần
  thay đổi ứng dụng.
- #33 và #35 vẫn xung đột với nhau trong `frontend/src/app/router.tsx`, không
  xung đột với main hiện tại. Khi tích hợp cần giữ cả route Student Calendar và
  Admin Dashboard cùng các route auth/Guidance/Opportunities hiện có. Dashboard
  không được chép vào PR này để che giấu xung đột.
- Checkout này không có scheduler hoặc implementation Notifications. Chưa khẳng
  định đã kiểm thử luồng reminder/chuông xuyên PR và giao diện Admin Google.
- Chỉ sử dụng database tạm chuyên biệt; không dùng database cá nhân/nhóm và
  không thay đổi schema/migration hoặc quyền SQL.
