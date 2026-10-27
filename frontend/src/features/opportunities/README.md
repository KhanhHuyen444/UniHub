# Hub cơ hội — trạng thái triển khai

## Đã có

- Route `/opportunities` dùng `PublicLayout`, các primitive dùng chung và API client `frontend/src/lib/api.ts`.
- Danh sách đọc `GET /api/opportunities`; query đang áp dụng nằm trong URL để tải lại trang và dùng Back/Forward. Gửi tìm kiếm mới sẽ đặt `page=1`; thao tác bấm Tìm kiếm khi chưa có từ khóa/bộ lọc chỉ hiện lời nhắc và không gửi request.
- Response được kiểm tra shape tại feature. Loading, lỗi/retry, feed rỗng, không có kết quả, trang ngoài phạm vi, `INVALID_QUERY` và `INVALID_FILTER` có trạng thái riêng. Bộ lọc Major chỉ bị xóa sau thao tác rõ ràng của người dùng.
- Thẻ hiển thị loại, tiêu đề, publisher, hình thức, deadline và Verified nếu API có giá trị. Không render location/skills trong danh sách hiện tại: ảnh Public không có hàng location, còn API summary chưa trả skills. Deadline lấy ngày/trạng thái từ backend; legacy `unknown` không hiện ngày hoặc nhãn, và UI không tự tính số ngày còn lại.
- Route `/opportunities/:id` đọc `GET /api/opportunities/:id` qua API client/parser hiện có. Một page dùng chung cho Thực tập, Việc làm và Học bổng; tiêu đề và thứ tự mục theo BR-01.8 Chương 3. Text được render an toàn như văn bản thường.
- Trang chi tiết dùng `majors`, `skills` và `eligibleAcademicYears` trong response, không gọi endpoint options Major/Skill. Năm học rỗng không tạo mục năm học. Deadline lấy ngày/trạng thái từ API, không countdown; deadline `null` và `unknown` đều không hiện dòng hạn. Verified, nguồn tin và địa điểm chỉ xuất hiện khi API cho phép.
- Link loại cơ hội khác đi về danh sách với query `type` tương ứng; loại hiện tại được đánh dấu nhưng không là tab. Card lưu query danh sách trong router state. Link quay lại chỉ chấp nhận `/opportunities` nội bộ; truy cập trực tiếp hoặc state không hợp lệ fallback về `/opportunities`.
- Chi tiết không có chức năng nộp hồ sơ. 404 không phân biệt cơ hội không tồn tại với cơ hội không công khai; ID sai có trạng thái riêng; lỗi API có nút thử lại.

## Phụ thuộc chưa hoàn thành

- `GET /api/categories?type=Major` đã có contract được duyệt nhưng chưa được TV3 triển khai trong `origin/main`. Consumer đã gọi API; trong lúc endpoint lỗi, select Major bị vô hiệu hóa và có thao tác thử lại riêng. Không có Major giả trong ứng dụng. Nếu API cơ hội trả `INVALID_FILTER` cho `majorId`, giao diện giữ query và cho người dùng xóa bộ lọc.
- Ba ảnh Public detail do nhóm cung cấp là căn cứ hình thức cho Học bổng, Việc làm và Thực tập. Không dùng frame diễn đàn `131:7557` hoặc chi tiết kiểm duyệt Admin `171:2628` làm thiết kế trang này. Kích thước suy ra từ ảnh là ước lượng, không phải số đo trực tiếp Figma; xem [ghi nhận thiết kế chi tiết](../../../docs/opportunities-detail-ui.md).
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

Chọn thẻ để mở `/opportunities/:id`, hoặc thay `:id` bằng ID cơ hội Approved thực có trên API. Nếu database chưa có cơ hội công khai, danh sách trả rỗng và chi tiết trả 404 theo contract; không cần tạo dữ liệu hoặc đổi trạng thái trên database nhóm để demo.

Kiểm tra từ gốc repository:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
```

Các lời gọi danh sách và danh mục dùng API thật qua proxy. Bài test `frontend/test/opportunities-contracts.test.mjs` chỉ kiểm tra serialization/shape bằng dữ liệu minh họa trong test; nó không chứng minh API categories hoặc MySQL đang hoạt động.

## Kiểm tra

Kết quả kiểm tra cập nhật mới nhất (typecheck, build, frontend/backend test, format và trình duyệt) được ghi trong [opportunities-detail-ui.md](../../../docs/opportunities-detail-ui.md). Kiểm thử frontend bằng fixture/mock không xác nhận API nghiệp vụ hoặc MySQL.
