# notifications

Student notification panel theo [contract đã duyệt](../../../../docs/events-notifications-api-contract.md).

- `NotificationBell` dùng trong StudentLayout và phần tài khoản Student của PublicLayout, vì các trang live hiện tại dùng PublicLayout. Preview/Guest/Admin không gọi API.
- Native modal dialog có tên truy cập, Escape, focus containment/restoration; panel dùng shared loading/empty/error states, phân trang và global unread count từ API.
- Mỗi lần mở tải lại danh sách qua `protectedApiRequest`; không polling, không lưu token/dữ liệu thông báo vào storage. Đóng panel, unmount hoặc đổi identity/role/auth status hủy request và bỏ kết quả muộn.
- Click đánh dấu đọc bằng PATCH không body/query; lỗi giữ panel để thử lại. Violation đi `/forum` theo contract; route forum chưa có trên nhánh này.
- Nhánh này chưa có Calendar page/route. Reminder mở chi tiết event thật trong panel qua `GET /api/events/:id`, không tạo route Calendar giả. Tích hợp điều hướng Calendar cần phối hợp TV4/TV1 khi Calendar được đưa vào nhánh. Event bị xóa hoặc không thuộc owner trả lỗi API, không dùng nội dung giả.
- Tests `frontend/test/notifications.test.mjs`: DTO/empty/error validation, phân trang, Bearer/request shape, idempotent read response, refresh, event detail và bell role/preview semantics qua server rendering. Chưa có interactive browser QA hoặc FR–BK–MySQL test cho panel.

Không triển khai Scheduler hoặc Violation writer; backend tiếp tục quyết định quyền owner.

Phụ trách dự kiến: **TV4**, cả frontend và backend tương ứng. Chưa gán tên người hoặc deadline.

Chỉ thêm component, hook và lời gọi API khi bắt đầu chức năng. Đọc [quy trình nhóm](../../../../docs/team-workflow.md); không tạo route giả hoặc dữ liệu cá nhân để giữ chỗ.
