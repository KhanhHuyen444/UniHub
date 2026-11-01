# notifications

Student notification panel theo [contract đã duyệt](../../../../docs/events-notifications-api-contract.md).

- `NotificationBell` dùng trong StudentLayout và phần tài khoản Student của PublicLayout, vì các trang live hiện tại dùng PublicLayout. Preview/Guest/Admin không gọi API.
- Native modal dialog có tên truy cập, Escape, focus containment/restoration; panel dùng shared loading/empty/error states, phân trang và global unread count từ API.
- Mỗi lần mở tải lại danh sách qua `protectedApiRequest`; không polling, không lưu token/dữ liệu thông báo vào storage. Đóng panel, unmount hoặc đổi identity/role/auth status hủy request và bỏ kết quả muộn.
- Click đánh dấu đọc bằng PATCH không body/query; lỗi giữ panel để thử lại. Violation đi `/forum` theo contract; route forum chưa có trên nhánh này.
- Nhánh này chưa có Calendar page/route. Reminder mở chi tiết event thật trong panel qua `GET /api/events/:id`, không tạo route Calendar giả. Tích hợp điều hướng Calendar cần phối hợp TV4/TV1 khi Calendar được đưa vào nhánh. Event bị xóa hoặc không thuộc owner trả lỗi API, không dùng nội dung giả.
- Tests `frontend/test/notifications.test.mjs`: DTO/empty/error validation, phân trang, Bearer/request shape, idempotent read response, refresh, event detail và bell role/preview semantics qua server rendering; những ca này dùng HTTP/auth doubles.

## Kiểm tra lại 31/10/2026

Head application `e3fbb3a`, chứa main `df6a277`: không phát hiện regression cần đổi production code. Đã chạy browser thật với Google Student do người dùng đăng nhập, Express và MySQL 8.4.13 cô lập: mở chuông, thấy Reminder fixture, click đánh dấu đọc bằng PATCH không body/query, unreadCount 1→0, mở chi tiết event trong panel; route vẫn `/opportunities`. Không sao chép/in token hoặc đổi role. Ảnh 1280×1000 lưu cục bộ `.cache/tv4/34-notifications-unread.png`, `34-reminder-event-panel.png`; chưa đối chiếu ảnh thiết kế nên không kết luận pixel-match.

Typecheck/build/format/diff-check đạt. Root tests: frontend 86 pass/31 skip, backend 142 pass/18 skip, 0 fail. Ngoài root run, Notifications service có 5 test MySQL thật đã thực thi bằng runner riêng; các suite thiếu cấu hình vẫn skip và không được ghi PASS.

#34 và #35 vẫn conflict `backend/src/app.ts`, chưa conflict với main. Khi tích hợp giữ cả imports/dependencies/mount Notifications và Dashboard cùng các route hiện có; không kéo Dashboard vào PR này. Calendar page/scheduler vẫn ở PR khác; chỉ kiểm tra từng stage riêng, chưa có checkout đủ bốn PR để kết luận end-to-end. Violation đi `/forum` đúng contract, nhưng Forum route/UI còn phụ thuộc Vy; không triển khai hoặc giả lập Forum. Admin Google role UI chưa có fixture hợp lệ nên chưa chạy.

Không triển khai Scheduler hoặc Violation writer; backend tiếp tục quyết định quyền owner.

Phụ trách dự kiến: **TV4**, cả frontend và backend tương ứng. Chưa gán tên người hoặc deadline.

Chỉ thêm component, hook và lời gọi API khi bắt đầu chức năng. Đọc [quy trình nhóm](../../../../docs/team-workflow.md); không tạo route giả hoặc dữ liệu cá nhân để giữ chỗ.
