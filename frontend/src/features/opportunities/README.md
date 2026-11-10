# Hub cơ hội — trạng thái triển khai

## Đã có

- Route `/opportunities` dùng `PublicLayout`, các primitive dùng chung và API client `frontend/src/lib/api.ts`.
- Danh sách đọc `GET /api/opportunities`; query đang áp dụng nằm trong URL để tải lại trang và dùng Back/Forward. Gửi tìm kiếm mới sẽ đặt `page=1`; thao tác bấm Tìm kiếm khi chưa có từ khóa/bộ lọc chỉ hiện lời nhắc và không gửi request.
- `GET /api/categories?type=Major` thuộc provider danh mục dùng chung. Consumer gửi đúng path/query, parse đúng shape; kiểm thử tích hợp đã xác nhận chỉ Major Active xuất hiện. Danh sách rỗng thành công và lỗi tải có trạng thái UI riêng, không có Major giả. Nếu API cơ hội trả `INVALID_FILTER` cho `majorId`, giao diện giữ query và cho người dùng xóa bộ lọc. Xem [opportunities-api-contract.md](../../../../docs/opportunities-api-contract.md).
- Response được kiểm tra shape tại feature. Loading, lỗi/retry, feed rỗng, không có kết quả, trang ngoài phạm vi, `INVALID_QUERY` và `INVALID_FILTER` có trạng thái riêng. Bộ lọc Major chỉ bị xóa sau thao tác rõ ràng của người dùng.
- Thẻ hiển thị loại, tiêu đề, publisher, hình thức, deadline và Verified nếu API có giá trị. Không render location/skills trong danh sách hiện tại: ảnh Public không có hàng location, còn API summary chưa trả skills. Deadline lấy ngày/trạng thái từ backend; legacy `unknown` không hiện ngày hoặc nhãn, và UI không tự tính số ngày còn lại.
- Route `/opportunities/:id` đọc `GET /api/opportunities/:id` qua API client/parser hiện có. Một page dùng chung cho Thực tập, Việc làm và Học bổng; tiêu đề và thứ tự mục theo BR-01.8 Chương 3. Text được render an toàn như văn bản thường.
- Trang chi tiết dùng `majors`, `skills` và `eligibleAcademicYears` trong response, không gọi endpoint options Major/Skill. Năm học rỗng không tạo mục năm học. Deadline lấy ngày/trạng thái từ API, không countdown; deadline `null` và `unknown` đều không hiện dòng hạn. Verified, nguồn tin và địa điểm chỉ xuất hiện khi API cho phép.
- Link loại cơ hội khác đi về danh sách với query `type` tương ứng; loại hiện tại được đánh dấu nhưng không là tab. Card lưu query danh sách trong router state. Link quay lại chỉ chấp nhận `/opportunities` nội bộ; truy cập trực tiếp hoặc state không hợp lệ fallback về `/opportunities`.
- Chi tiết không có chức năng nộp hồ sơ. 404 không phân biệt cơ hội không tồn tại với cơ hội không công khai; ID sai có trạng thái riêng; lỗi API có nút thử lại.

## Ghi chú thiết kế và Giao diện

- Bố cục danh sách và chi tiết cơ hội đã được hoàn thiện chuẩn hóa theo thiết kế thống nhất cho Học bổng, Việc làm và Thực tập.
- List API trả về danh sách đầy đủ kèm `skills: {id,name}[]` và nhãn Verified chứng thực khi được Quản trị viên duyệt.
- Hỗ trợ đầy đủ bộ lọc kết hợp đa tiêu chí (Ngành học, Loại cơ hội, Hình thức làm việc) và tìm kiếm từ khóa với xử lý phân trang tự động.

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

Mở `http://127.0.0.1:5173/opportunities`. Nếu API chạy ở host/port khác, đặt `API_PROXY_TARGET` trong terminal frontend trước khi chạy Vite. Để bộ lọc Major tải dữ liệu, backend phải chạy từ nhánh có API categories Major hoặc sau khi PR API được merge; nếu route chưa có, giao diện giữ error/retry state riêng.

Chọn thẻ để mở `/opportunities/:id`, hoặc thay `:id` bằng ID cơ hội Approved thực có trên API. Nếu database chưa có cơ hội công khai, danh sách trả rỗng và chi tiết trả 404 theo contract; không cần tạo dữ liệu hoặc đổi trạng thái trên database nhóm để demo.

Kiểm tra từ gốc repository:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
```

Các lời gọi danh sách và danh mục dùng API thật qua proxy. `frontend/test/opportunities-api.test.mjs` kiểm tra Major consumer gửi đúng request và nhận đúng response shape; test này không chứng minh endpoint/backend/MySQL đang hoạt động.

## Kiểm tra

Kết quả kiểm thử tự động toàn diện được duy trì và thực thi tại gốc repository thông qua lệnh chuẩn: `npm test`.
