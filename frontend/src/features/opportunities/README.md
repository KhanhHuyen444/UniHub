# Hub cơ hội — trạng thái triển khai

## Đã có

- Route `/opportunities` dùng `PublicLayout`, các primitive dùng chung và API client `frontend/src/lib/api.ts`.
- Danh sách đọc `GET /api/opportunities`; query đang áp dụng nằm trong URL để tải lại trang và dùng Back/Forward. Gửi tìm kiếm mới sẽ đặt `page=1`; thao tác bấm Tìm kiếm khi chưa có từ khóa/bộ lọc chỉ hiện lời nhắc và không gửi request.
- Response được kiểm tra shape tại feature. Loading, lỗi/retry, feed rỗng, không có kết quả, trang ngoài phạm vi, `INVALID_QUERY` và `INVALID_FILTER` có trạng thái riêng. Bộ lọc Major chỉ bị xóa sau thao tác rõ ràng của người dùng.
- Thẻ hiển thị loại, tiêu đề, publisher, hình thức, deadline và Verified nếu API có giá trị. Không render location/skills trong danh sách hiện tại: ảnh Public không có hàng location, còn API summary chưa trả skills. Deadline lấy ngày/trạng thái từ backend; legacy `unknown` không hiện ngày hoặc nhãn, và UI không tự tính số ngày còn lại.
- API client/parser `GET /api/opportunities/:id` đã được chuẩn bị và kiểm thử shape response, nhưng chưa gắn vào route hoặc render trang chi tiết.

## Phụ thuộc chưa hoàn thành

- `GET /api/categories?type=Major` đã có contract được duyệt nhưng chưa được TV3 triển khai trong `origin/main`. Consumer đã gọi API; trong lúc endpoint lỗi, select Major bị vô hiệu hóa và có thao tác thử lại riêng. Không có Major giả trong ứng dụng. Nếu API cơ hội trả `INVALID_FILTER` cho `majorId`, giao diện giữ query và cho người dùng xóa bộ lọc.
- ZIP bổ sung xác nhận `131:7557 — Chi tiết_Guest` là chi tiết bài viết diễn đàn (có “Quay lại Diễn đàn”, Article Body và Comments), không phải chi tiết cơ hội. `171:2628` là frame kiểm duyệt Admin. Chưa có frame/screenshot Public detail; route `/opportunities/:id` chưa được mount. CTA trong thẻ giữ URL dự kiến theo contract, nhưng không có trang chi tiết để hoàn tất luồng cho đến khi nhóm cung cấp đúng thiết kế Public.
- Nhóm đã cung cấp PNG `Hub cơ hội-V2.png`; ZIP có bounds/text/container trực tiếp cho frame `36:39`, nhưng không có screenshot/asset mới và thiếu nhiều style property. Bố cục tổng thể được đối chiếu theo PNG; các giá trị trực tiếp, phép tính và ước lượng được tách trong [ghi nhận bổ sung](../../../docs/shared-ui-design/opportunities-list-supplement.md). Padding/typography/shadow của card, spacing chính xác, trạng thái pagination và asset icon Hero/Hình thức chưa được đọc trực tiếp.
- Frame mẫu có sáu thẻ và 28 kết quả, trong khi API mặc định pageSize 20; không hardcode mẫu hoặc cắt danh sách. API summary chưa trả skills dù ảnh card có hàng này; không gửi thêm request detail cho mỗi thẻ. API cũng không trả số ngày countdown; giao diện dùng deadline state/ngày của server.

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

## Kiểm tra trong lần cập nhật này

`npm run typecheck`, `npm run build`, `npm test`, `npm run format:check` và `git diff --check` đều đạt. Test root có 20/20 frontend pass; backend 14 pass và 8 test đọc MySQL bị skip vì không cấu hình `TEST_DATABASE_URL` trong môi trường này. Chưa kiểm tra lại truy vấn nghiệp vụ trên MySQL ở lần cập nhật này.

Chromium 154 kiểm tra ở 1280×1000 và device viewport 1920×1000, zoom 100%, device scale 1; đã chờ `document.fonts.ready` và decode ảnh trước khi chụp. Font computed là Inter; `document.fonts.check` đúng cho weight 400/600 và nội dung tiếng Việt. Ở 1280, document scroll width là 1280; ở device viewport 1920, layout viewport là 1905 do thanh cuộn dọc 15 px và scroll width bằng 1905, không tràn ngang. Navbar đo 81 px; filter card 1216×188; input 279.5×40; grid 1216×598; card width 389.33; footer 301.25. Không có lỗi JavaScript, ảnh lỗi tải hoặc title overflow. Screenshot: `/tmp/unihub-opportunities-1280.png`, `/tmp/unihub-opportunities-1920.png`.

Với API mock cô lập, đã kiểm tra search và filter cập nhật query URL; page 2 giữ filter; submit rỗng hiện nhắc mà không đổi URL; filtered-empty và feed-empty; `INVALID_QUERY`, lỗi dịch vụ, loading chậm, trang ngoài phạm vi; deadline unknown ẩn ngày; danh sách Major mock; Tab keyboard tới link có tên và input/select có label. Mock chỉ trả response hư cấu trong `/tmp`; không gọi backend UniHub hoặc database. Vì vậy kiểm tra trình duyệt này xác nhận render và hành vi frontend, không xác nhận API/MySQL thật. Chưa kiểm tra route chi tiết vì chưa có frame Public detail.
