# opportunities

Đã triển khai API đọc công khai:

- `GET /api/opportunities` — tìm kiếm, lọc, phân trang và sắp xếp theo contract.
- `GET /api/opportunities/:id` — chi tiết Approved thuộc ba loại cơ hội công khai.

Hợp đồng, trường trả về, deadline, query và mã lỗi được ghi trong [opportunities-api-contract.md](../../../../docs/opportunities-api-contract.md). API đọc tự kiểm tra `majorId` qua bảng `categories`; endpoint danh sách Major do TV3 sở hữu vẫn là phần triển khai riêng. Module không tạo Prisma Client/pool mới theo request; nó dùng client dùng chung trong `backend/src/lib/prisma.ts`.

Admin tạo/duyệt/từ chối, xác thực, Skill API, gợi ý và giao diện chưa triển khai. Database development cần có các migration hiện hành; nếu chưa có cơ hội Approved thuộc ba loại được công khai, danh sách rỗng HTTP 200 là kết quả đúng. Không cần sửa dữ liệu thật để demo.

Để chạy trên Windows PowerShell tại gốc repository, cần cấu hình `backend/.env` bằng database phát triển riêng đã áp dụng migrations, sau đó chạy:

```powershell
npm.cmd ci
npm.cmd run dev:backend
```

Mở `http://127.0.0.1:3001/api/opportunities` để xem danh sách. Có thể thử lọc `http://127.0.0.1:3001/api/opportunities?type=Th%E1%BB%B1c%20t%E1%BA%ADp&page=1&pageSize=20`. Thay `41` bằng ID thực khi kiểm tra `http://127.0.0.1:3001/api/opportunities/41`; nếu ID không tồn tại hoặc không công khai, HTTP 404 là đúng. Không yêu cầu fixture/seed hoặc thay trạng thái trên database thật.

Test nghiệp vụ cần MySQL tạm cô lập: đặt `TEST_DATABASE_URL` tới schema loopback riêng bắt đầu bằng `unihub_opportunity_test` sau khi áp dụng migrations. Không trỏ biến này tới database nhóm. Khi không có `TEST_DATABASE_URL`, các test MySQL được skip; test health/readiness vẫn chạy. Xem hướng dẫn Windows runtime trong [database-runtime.md](../../../../docs/database-runtime.md).

Để chạy các kiểm tra repository trên Windows, dùng `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test` và `npm.cmd run format:check` tại gốc. `npm.cmd test` chạy cả test frontend/backend; test MySQL cơ hội chỉ chạy khi có `TEST_DATABASE_URL` trỏ tới database thử nghiệm loopback riêng đã migrate.

Phụ trách nhóm theo kế hoạch: **TV2**. Tài liệu cộng tác: [quy trình nhóm](../../../../docs/team-workflow.md) và [quy ước API](../../../../docs/api-conventions.md).
