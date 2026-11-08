# Báo cáo rà soát quy trình bàn giao UniHub

Ngày rà soát: **07/11/2026**. Nhánh `docs/unihub-fresh-install-handoff`, nền `origin/main` tại `93a904e`. Đã fetch trước khi tạo nhánh, working tree ban đầu sạch. Không đọc file `.env` thật, không kết nối/ghi/reset database hiện có; không sửa production code, schema, migration, dependency hoặc dữ liệu fixture.

## 1. Vấn đề và cách xử lý

| Phát hiện từ source/tài liệu                                                                                                               | Xử lý                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| README dài, seed/Google/bootstrap và bước phụ thuộc phân tán                                                                               | Viết lại Quick Start theo chuỗi schema/user → env → migration → GRANT → build → server → Google/Student → bootstrap → seed → nghiệm thu               |
| Mở `.env.demo` dễ bị hiểu là npm dev đang dùng file đó; lỗi HTTP sai cổng bị nhầm lỗi DB                                                   | Bảng consumer env thực tế, file mặc định, ưu tiên biến shell, kiểm tra listener/PID và proxy, giữ mặc định 3001/5173                                  |
| Catalog cơ bản không đủ cho demo, operator phải tự suy lệnh cho ba file tiếp                                                               | Liệt kê đủ bốn file với dry-run/apply riêng, kỳ vọng 445 reuse và 117 Major/328 Skill                                                                 |
| README Cơ hội còn mô tả approval lỗi/NOT READY lịch sử dù JSON đã leader_approved                                                          | Thay bằng trạng thái hiện tại, phân biệt approval nhập batch với Pending xuất bản; giữ artifact cũ và không sửa trạng thái/deadline                   |
| Importer Catalog/Cơ hội không guard schema; Guidance/Forum chỉ kiểm tra tên DB                                                             | Ghi rõ phạm vi guard; xác minh đích và quyền trước truy cập, review dry-run rồi operator xác nhận apply từng bộ; không thêm coordinator ghi hàng loạt |
| Seed cũ có update/xóa quan hệ/đặt trạng thái, không phù hợp cài mới bảo toàn dữ liệu                                                       | Danh sách script ngoài Quick Start, không chạy hoặc tự sửa chúng trong đợt tài liệu                                                                   |
| `verify-reproducible-seed.mjs` dùng `{ dryRun: false, strict: true }` với API importer hiện nhận `{ apply }`, đọc env riêng và gọi seed cũ | Ghi rõ không dùng script này làm bằng chứng tái lập cài mới; giữ luồng lệnh đã đối chiếu trực tiếp                                                    |
| Guidance/Forum plan trước transaction và verify sau commit, không phải đồng bộ hoàn toàn                                                   | Hướng dẫn không chạy đồng thời, không hiểu verify lỗi là rollback, mô tả reuse/collision/soft-delete và giới hạn verify                               |
| Bootstrap cần Google sub thật và từ chối khi đã có Admin                                                                                   | Hướng dẫn Client ID/origin, login, SQL SELECT đúng user, PROMOTE, điều kiện từ chối và login lại; không UPDATE role bằng SQL                          |
| Chưa có checklist ghi nhận riêng chức năng thực tế/Activity Log                                                                            | Tạo checklist Guest/Student/Admin với NOT RUN mặc định và truy vấn log chỉ đọc; không thêm API/UI log                                                 |

Phần tài liệu vận hành chung ảnh hưởng cách cài máy của cả nhóm; đề nghị TV1 review chuỗi cấu hình/import/auth, TV3 review catalog/Guidance, TV5 review Forum/Activity Log, TV4 review lịch/notification/checklist. Đây là yêu cầu review trong PR, không khẳng định đã được các thành viên review.

## 2. Kiểm tra thực tế

Môi trường chạy lệnh: Windows/PowerShell của phiên Codex tại checkout hiện có; Node **24.22.1**, npm **11.19.1** (trong engines). Dependency đã có, không chạy lại `npm ci` và không coi đây là cài dependency trên máy sạch.

| Lệnh / kiểm tra                                                                                                                   | Kết quả thực tế                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run prisma:validate`                                                                                                     | PASS, schema hợp lệ                                                                                                                                                              |
| `npm.cmd run typecheck`                                                                                                           | PASS cả hai workspace                                                                                                                                                            |
| `npm.cmd run build`                                                                                                               | PASS cả hai workspace; Vite cảnh báo chunk JS lớn hơn 500 kB, chưa thay đổi bundling trong phạm vi tài liệu                                                                      |
| `npm.cmd test` trong sandbox                                                                                                      | FAIL môi trường: frontend 45 file fail tại tsx `uv_os_get_passwd`/ENOMEM trước test; backend 255 PASS/23 SKIP                                                                    |
| `npm.cmd test` chạy lại ngoài sandbox                                                                                             | PASS, exit 0; frontend 273 tests: **214 PASS / 0 FAIL / 59 SKIP**; backend 278 tests: **255 PASS / 0 FAIL / 23 SKIP**                                                            |
| `node --test data/opportunities/demo/demo.test.mjs data/guidance/demo/guidance-demo.test.mjs data/forum/demo/forum-demo.test.mjs` | PASS: **13 PASS / 0 FAIL / 0 SKIP**                                                                                                                                              |
| `node data/guidance/demo/generate-guidance-demo.mjs`                                                                              | PASS offline: 146 bài, 100/117 Major có bài, 17 empty state, 154 Skill                                                                                                           |
| Validation batch thực tế + dry-run importer offline với read-only doubles                                                         | PASS tại `2026-11-07T01:28:23Z`: 100 tin, approval hợp lệ, 80 deadline/20 NULL, 0 hết hạn; kế hoạch 100 create, 280 category reuse, blocked=false, writes=0; không kết nối MySQL |
| Đối chiếu fixture Guidance với snapshot Catalog                                                                                   | PASS offline, đủ tất cả tên ngành/kỹ năng tham chiếu                                                                                                                             |
| `npm.cmd run format:check`                                                                                                        | PASS, toàn repository đúng Prettier                                                                                                                                              |
| `git diff --check` và liên kết tài liệu                                                                                           | PASS; kiểm tra 63 liên kết nội bộ trong 12 tài liệu, sửa hai anchor lịch sử không khớp tiêu đề tiếng Việt                                                                        |

Deadline cụ thể trong JSON hiện tại từ `2027-01-01T17:00:00Z` đến `2027-04-09T17:00:00Z`. Kết quả chỉ đúng tại thời điểm validation; không bảo đảm batch còn nhập được ở ngày bàn giao sau này. Dry-run offline dùng doubles chỉ kiểm tra validator/planner, **không phải dry-run MySQL**, không chứng minh collation/quyền/migration/apply/rollback trên MySQL.

## 3. Giới hạn và việc cần nghiệm thu thủ công

- **NOT RUN**: `npm ci` trên máy mới; tạo database/user/grants; migration status/deploy trên đích mới; seed dry-run/apply/verify trên MySQL thật; chạy lại seed trên dữ liệu thật. Không dùng database demo đang có của người dùng cho đợt rà soát này.
- **NOT RUN**: cấu hình Google Cloud của người nhận, Google Login thật, bootstrap thật, refresh cookie/logout trên browser, toàn bộ checklist UI Guest/Student/Admin và truy vấn Activity Log trên DB nghiệm thu. Kết quả health/ready người dùng cung cấp trước đó không thay nghiệm thu cài mới.
- **SKIP** trong npm test: các điều kiện browser/MySQL chưa có theo từng suite; không tính là PASS tính năng. Một số runner test cô lập báo inactive mà file runner vẫn PASS, không có nghĩa MySQL runner đã thực thi.
- Chỉ có tên schema guard không đủ phân biệt database mới với DB đang có dữ liệu. Các script lịch sử chưa được sửa; người nhận phải dùng danh sách lệnh canonical, không chạy toàn bộ script trong thư mục.
- Reuse Guidance không cập nhật nội dung/quan hệ; Forum có thể collision email/sub và verify fail trên fixture soft-deleted sau commit. Không chạy đồng thời hoặc dùng apply để sửa dữ liệu đã thay đổi ngoài kế hoạch.

## 4. File và nhóm commit

- Setup/vận hành: `README.md`, `docs/LOCAL-SETUP-UNIHUB-DEMO.md`, `docs/fresh-install-operations.md`, `docs/database-runtime.md`, `docs/database-migrations.md`.
- Seed workflow: `docs/demo-seed-workflow.md` và README trong bốn bộ `data/catalog`, `data/opportunities/demo`, `data/guidance/demo`, `data/forum/demo`.
- Nghiệm thu/báo cáo: `docs/fresh-install-acceptance.md`, tài liệu này.

Commit thực tế và trạng thái push/PR được ghi trong báo cáo bàn giao cuối và lịch sử nhánh; không tự merge PR. Chỉ stage các tài liệu trong danh sách, không stage `.env`, output build hoặc log cục bộ.
