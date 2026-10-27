# Hub cơ hội — trạng thái triển khai

## Đã có

- Route `/opportunities` dùng `PublicLayout`, các primitive dùng chung và API client `frontend/src/lib/api.ts`.
- Danh sách đọc `GET /api/opportunities`; query đang áp dụng nằm trong URL để tải lại trang và dùng Back/Forward. Gửi tìm kiếm mới sẽ đặt `page=1`; thao tác bấm Tìm kiếm khi chưa có từ khóa/bộ lọc chỉ hiện lời nhắc và không gửi request.
- Response được kiểm tra shape tại feature. Loading, lỗi/retry, feed rỗng, không có kết quả, trang ngoài phạm vi, `INVALID_QUERY` và `INVALID_FILTER` có trạng thái riêng. Bộ lọc Major chỉ bị xóa sau thao tác rõ ràng của người dùng.
- Thẻ chỉ hiển thị loại, tiêu đề, publisher, hình thức, địa điểm, deadline và Verified nếu API có giá trị. Deadline lấy ngày/trạng thái từ backend; legacy `unknown` không hiện ngày hoặc nhãn.
- API client/parser `GET /api/opportunities/:id` đã được chuẩn bị và kiểm thử shape response, nhưng chưa gắn vào route hoặc render trang chi tiết.

## Phụ thuộc chưa hoàn thành

- `GET /api/categories?type=Major` đã có contract được duyệt nhưng chưa được TV3 triển khai trong `origin/main`. Consumer đã gọi API; trong lúc endpoint lỗi, select Major bị vô hiệu hóa và có thao tác thử lại riêng. Không có Major giả trong ứng dụng. Nếu API cơ hội trả `INVALID_FILTER` cho `majorId`, giao diện giữ query và cho người dùng xóa bộ lọc.
- Chưa nhận được screenshot/thông số trực tiếp của frame chi tiết cơ hội Guest/Student `131:7557`. `171:2628` là frame kiểm duyệt Admin và không dùng làm thiết kế Public. Vì vậy route và giao diện chi tiết chưa được dựng; link tiêu đề của thẻ đã trỏ đúng URL `/opportunities/:id` nhưng đích hiện chưa được mount. Cần bổ sung ảnh frame Public cùng các trạng thái cần thiết trước khi hoàn tất luồng.
- Handoff nhận được có inventory frame và thông số các control như search `36:58`, reset `36:92`, submit `36:94`, select `36:67`, `36:76`, `36:85`; không có screenshot Hub `36:39`. Phần bố cục tổng thể của danh sách vì vậy chưa thể xác nhận là khớp Figma. Nội dung mô tả và cách xếp bốn control là lựa chọn tối thiểu để có thể dùng danh sách, cần review với frame đầy đủ.

## Chạy trên Windows

Tại thư mục gốc repository, cài dependency và khởi động API đã cấu hình riêng cùng database phát triển theo hướng dẫn runtime. Không cần seed để mở giao diện; nếu API chưa có bản ghi Approved, danh sách hiển thị trạng thái rỗng đúng contract.

```powershell
npm.cmd ci
npm.cmd run dev:backend
```

Mở terminal PowerShell thứ hai để chạy frontend qua Vite proxy mặc định `http://127.0.0.1:3001`:

```powershell
npm.cmd run dev:frontend
```

Mở `http://127.0.0.1:5173/opportunities`. Nếu API chạy ở host/port khác, đặt `API_PROXY_TARGET` trong terminal frontend trước khi chạy Vite. API categories hiện chưa có nên bộ chọn Major sẽ tạm không dùng được; các bộ lọc loại và hình thức vẫn có thể sử dụng.

Kiểm tra từ gốc repository:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
```

Các lời gọi danh sách và danh mục dùng API thật qua proxy. Bài test `frontend/test/opportunities-contracts.test.mjs` chỉ kiểm tra serialization/shape bằng dữ liệu minh họa trong test; nó không chứng minh API categories hoặc MySQL đang hoạt động.

## Kiểm tra trình duyệt trong nhiệm vụ này

Chromium đã mở route ở 1280×900 và 1920×1080, zoom 100%; chờ `document.fonts.ready` trước khi kiểm tra/chụp. Cả hai viewport không tràn ngang; font platform xác nhận `Inter Variable` là custom font đang render. Đã kiểm tra gửi tìm kiếm, lời nhắc khi submit rỗng (không phát sinh request mới), Back khôi phục URL và input, `INVALID_QUERY`, `INVALID_FILTER` cùng thao tác gỡ Major, feed rỗng, trang vượt phạm vi, deadline unknown không có ngày/nhãn, response chậm không ghi đè kết quả mới và chuyển focus bằng Tab.

Các lần duyệt trên trình duyệt dùng mock HTTP API cô lập ở `/tmp`, không phải backend UniHub hoặc MySQL. Mock trả fixture hư cấu cho UI; endpoint categories mô phỏng 404 để kiểm tra trạng thái phụ thuộc. Ảnh tham chiếu được lưu ngoài repository ở `/tmp/unihub-opportunities-1280.png` và `/tmp/unihub-opportunities-1920.png`. Vì handoff không có screenshot của frame Hub `36:39`, đây là kiểm tra render/chức năng của implementation hiện tại, chưa phải xác nhận khớp tổng thể Figma. Chưa thể kiểm tra route chi tiết hoặc luồng danh sách → chi tiết → quay lại cho tới khi nhóm cung cấp screenshot/thông số Public detail.
