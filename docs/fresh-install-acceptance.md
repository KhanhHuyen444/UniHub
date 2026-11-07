# Checklist nghiệm thu UniHub trên máy sạch

Dùng sau [Quick Start](../README.md) và [seed](demo-seed-workflow.md). Ghi máy/OS, Node/npm/MySQL, commit, ngày chạy, cổng/origin (không ghi URL DB chứa credentials), người thực hiện và dữ liệu đã apply. Không dùng kết quả máy nhóm cho máy mới.

`PASS`: đã thực hiện và đúng kỳ vọng; `FAIL`: đã thực hiện nhưng sai; `SKIP`: chủ động bỏ qua, ghi lý do; `NOT RUN`: chưa thực hiện. Các mục bên dưới mặc định **NOT RUN**, không phải kết quả kiểm thử có sẵn. Nếu thiếu OAuth/DB/browser, giữ NOT RUN hoặc ghi SKIP với lý do, không coi build/unit test là PASS UI.

| Mục                                  | Cách thực hiện / kỳ vọng                                                                                                                      | Kết quả |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Môi trường                           | Node/npm đúng engines, MySQL Server 8.4 thực sự chạy; `npm.cmd ci` thành công trên checkout mới                                               | NOT RUN |
| DB mới                               | DBA xác minh schema/user mới thuộc người nhận; không có bước reset/drop/copy dữ liệu riêng tư                                                 | NOT RUN |
| Migration                            | `db:migrate:deploy`, status up to date; 13 bảng nghiệp vụ + bảng migration                                                                    | NOT RUN |
| Quyền                                | Runtime có quyền đúng từng bảng; activity_logs chỉ SELECT/INSERT, không DDL; kiểm tra bằng SHOW GRANTS, không thử ghi trái quyền trên DB demo | NOT RUN |
| Kết nối                              | Health ok; ready available trực tiếp backend và qua Vite proxy                                                                                | NOT RUN |
| Catalog                              | Sau bốn bộ: snapshot 445 reuse, không blocked; mới hoàn toàn 117 Major/328 Skill Active                                                       | NOT RUN |
| Cơ hội                               | Dry-run hợp lệ tại thời điểm chạy, apply mới 100 Pending; dry-run lại skip_existing, không update                                             | NOT RUN |
| Guidance                             | 146 bài, verify đạt; 100 Major có bài và 17 empty state                                                                                       | NOT RUN |
| Forum                                | 12 tác giả/24 bài/136 bình luận; dry-run lại 0 tạo mới                                                                                        | NOT RUN |
| Guest — trang chủ `/`                | Nội dung tải, điều hướng Hub/Roadmaps/Forum/Login hoạt động; không có lỗi API ngoài dự kiến                                                   | NOT RUN |
| Guest — Hub `/opportunities`         | Sau Admin duyệt tin: danh sách/detail/filter đúng; Pending/Rejected không công khai, empty state hợp lệ khi chưa duyệt                        | NOT RUN |
| Guest — lộ trình `/roadmaps`         | Chọn ngành có bài, xem giai đoạn/detail; ngành chủ động để trống trả empty state đúng                                                         | NOT RUN |
| Guest — diễn đàn `/forum`            | Đọc danh sách/detail/bình luận; thao tác cần đăng nhập được chặn/chuyển login                                                                 | NOT RUN |
| Guest — đăng nhập `/login`           | Nút GIS tải với Client ID thật; chưa đăng nhập không vào Admin                                                                                | NOT RUN |
| Student — Google Login               | Backend tạo/tìm đúng tài khoản Google thật, role Student; fixture không thay tài khoản thật                                                   | NOT RUN |
| Student — phiên                      | Reload, refresh sau access hết hạn và logout; cookie được lưu/gửi; logout không dùng lại phiên đã revoke                                      | NOT RUN |
| Student — hồ sơ `/profile`           | Chọn Major/năm/Skill Active, lưu rồi tải lại; dữ liệu đúng chủ sở hữu                                                                         | NOT RUN |
| Student — gợi ý `/recommendations`   | Dùng hồ sơ khớp một tin đã duyệt/còn hạn; kiểm tra kết quả/empty state; chưa đủ hồ sơ có hướng dẫn phù hợp                                    | NOT RUN |
| Student — lịch `/calendar`           | Tạo sự kiện thử với hạn tương lai, sửa/hoàn tất/xóa theo UI; kiểm tra chỉ sự kiện của mình                                                    | NOT RUN |
| Student — nhắc hạn                   | Tạo sự kiện thử có remind-before phù hợp, chờ scheduler và kiểm tra Notification Bell; không kỳ vọng email                                    | NOT RUN |
| Student — forum                      | Đăng bài/bình luận thử bằng tài khoản thật; kiểm tra nội dung tải lại; dùng nội dung nghiệm thu riêng                                         | NOT RUN |
| Student — RBAC                       | Bị chặn Admin; dùng tài khoản Student riêng, không dùng tài khoản đã bootstrap để kết luận                                                    | NOT RUN |
| Admin — bootstrap                    | Đúng Google sub, xác nhận PROMOTE; login lại, truy cập `/admin/dashboard`; chạy lại bootstrap bị từ chối vì đã có Admin                       | NOT RUN |
| Admin — dashboard                    | Số liệu/trạng thái tải từ DB, phản ánh nội dung demo và thay đổi nghiệp vụ liên quan                                                          | NOT RUN |
| Admin — thẩm định                    | Tab cơ hội `/admin/moderation`: duyệt một tin, từ chối tin thử khác có lý do; Public Hub phản ánh quyền/trạng thái đúng                       | NOT RUN |
| Admin — forum                        | Tab cộng đồng: xóa mềm bài/bình luận thử với lý do; nội dung biến mất công khai, thông báo vi phạm gửi đúng người                             | NOT RUN |
| Admin — danh mục `/admin/categories` | Tạo/đổi tên/đóng/mở danh mục thử theo rule; không đổi catalog fixture cần giữ để ép seed chạy lại                                             | NOT RUN |
| Admin — tài khoản `/admin/users`     | Kiểm tra phân quyền trên tài khoản thử đã đăng nhập thật; lần cấp token tiếp theo phản ánh role mới; không hạ Admin duy nhất                  | NOT RUN |
| Activity Log                         | Dùng truy vấn chỉ đọc dưới đây đối chiếu thao tác Admin, target và lý do; không cần trang/API xem log                                         | NOT RUN |

Các thao tác UI ghi dữ liệu ở checklist chỉ thực hiện khi người vận hành cho phép trên database nghiệm thu của mình. Không chạy test safety/live trỏ DB đang có dữ liệu cần bảo toàn. Nếu đổi catalog hoặc soft-delete fixture trong nghiệm thu, seed lại có thể reuse/verify fail theo thiết kế; không reset để làm báo cáo đẹp.

## SQL chỉ đọc cho nghiệm thu

Chạy trong MySQL CLI/Workbench cục bộ trên đúng schema; giữ kết quả có thông tin cá nhân ngoài Git/báo cáo công khai.

```sql
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'unihub_demo' ORDER BY TABLE_NAME;

SELECT type, status, COUNT(*) AS total
FROM unihub_demo.categories GROUP BY type, status;

SELECT opportunity_type, status, COUNT(*) AS total
FROM unihub_demo.opportunities GROUP BY opportunity_type, status;

SELECT log_id, admin_id, action_type, target_type, target_id, reason, created_at
FROM unihub_demo.activity_logs ORDER BY log_id DESC LIMIT 20;
```

Activity Log chỉ ghi thao tác quản trị theo use case, không phải lịch sử mọi truy vấn/seed/login. Bootstrap đầu tiên hiện không gọi writer activity log; không suy ra phải có log bootstrap. Đối chiếu log cho các thao tác quản trị được kiểm tra qua ứng dụng, không thêm API/trang log.

## Kiểm tra source độc lập

```powershell
npm.cmd run prisma:validate
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
git diff --check
```

Ghi exit code và số tests PASS/FAIL/SKIP thực tế. Test MySQL trong npm test yêu cầu database test cô lập với guard riêng, không trỏ biến TEST\_\* sang `unihub_demo`. Checklist UI/Google/MySQL cài mới phải được thực hiện riêng ngay cả khi tất cả lệnh source đạt.
