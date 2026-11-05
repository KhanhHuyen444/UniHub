# 100 Opportunities DEMO/SYNTHETIC

> **Cập nhật bàn giao 06/11/2026:** Batch JSON hiện có metadata `leader_approved`; mô tả Pending/needs_review, dry-run và NOT READY bên dưới phản ánh giai đoạn review trước, không chứng minh trạng thái database hiện tại. Cài mới theo [hướng dẫn canonical](../../../docs/LOCAL-SETUP-UNIHUB-DEMO.md#7-nạp-dữ-liệu-đã-được-duyệt), dùng `unihub_demo`, validation/dry-run lại ở thời điểm nhập. Không chạy generator để ghi đè batch đã duyệt hoặc tự gia hạn deadline. Import tạo Pending; Admin duyệt riêng để xuất bản.

Chỉ dùng demo/kiểm thử. Không phải tin tuyển dụng hay học bổng thật; publisher là
đơn vị giả lập và tất cả URL thuộc `unihub-demo.invalid`, cố ý không hoạt động.
Không gửi hồ sơ, thu phí hoặc truy cập URL để xác minh tin thật.

## Phân bố

| Loại                    | Số tin |
| ----------------------- | -----: |
| Thực tập                |     40 |
| Việc làm Fresher/Junior |     35 |
| Học bổng                |     25 |
| Tổng                    |    100 |

| Nhóm ngành chính                    | Số tin |
| ----------------------------------- | -----: |
| Kinh tế, quản trị và truyền thông   |     12 |
| CNTT và công nghệ số                |     11 |
| Kỹ thuật và công nghiệp             |     12 |
| Khoa học tự nhiên và sự sống        |     11 |
| Kinh tế, kinh doanh và luật         |     11 |
| Ngôn ngữ, xã hội và nhân văn        |     11 |
| Giáo dục                            |      8 |
| Nông nghiệp, môi trường và thủy sản |      9 |
| Y dược và sức khỏe                  |      9 |
| Thiết kế và dịch vụ                 |      6 |

Nhóm chính dùng để thống kê, không thay thế Category trong MySQL. Batch dùng đủ
**101 Major** và **179/328 Skill Active**, không tạo Category. Có 2 tin nhiều Major
với nhiệm vụ liên ngành cụ thể, 20 tin deadline NULL và 80 tin có hạn tương lai. Các hạn có
ngày dùng cutoff đầu ngày kế tiếp tại UTC+07. Cả 25 học bổng không giới hạn năm học,
nên `academic_years: []`. Việc làm nhắm sinh viên năm 4/người mới tốt nghiệp; thực
tập có các tập năm 3–4 hoặc 2–4. Mapping cố định theo từng tin tại `reviewed-mapping.json`, có nhiệm vụ và lý do. Không ghép ngành để tăng coverage hoặc chọn Skill theo chỉ số; đây vẫn là kịch bản giả lập, không phải JD doanh nghiệp xác minh.

## Files

- `batch-proposal.json`: importer v2 proposal; Pending, is_verified=false,
  reviewed_by/reviewed_at=null; proposal/category/link đều needs_review.
- `coverage.json`: nhóm chính và bối cảnh nghề của từng tin.
- `scenarios.json`: hồ sơ giả lập theo tên danh mục; không phải tài khoản để seed.
- `report.json`: số lượng, độ phủ và kế hoạch read-only.
- `dry-run-result.json`: kết quả chạy importer CLI thực tế.
- `reviewed-mapping.json`: 100 mapping cố định, nhiệm vụ và lý do cho từng tin; không phải phê duyệt của leader.
- `build-demo.mjs`, `demo.test.mjs`: đồng bộ mapping và kiểm tra tập demo.
- `mapping-fix-review.md`: kết quả sửa 23 mapping sau final review.

## Recommendations

Không sửa công thức 40% Major + 30% Year + 30% Skill hoặc threshold 0.5.
Các scenario bao gồm 100%, khớp Skill một phần, khác ngành không trùng Skill,
nhiều Major/Skill, NULL deadline và học bổng. Học bổng không lọc năm vẫn có
`yearMatch=0` theo contract, nên khớp Major và tất cả Skill cho điểm **0.7**, không
phải 1.0. Khác ngành không có nghĩa tự động bị loại; tùy Year/Skill theo contract.

Tất cả tin vẫn Pending, vì vậy **chưa xuất hiện trên Public Hub/Recommendations**.
Điểm kỳ vọng trong scenario là tính toán cho tình huống giả định tin đã được duyệt
riêng trong môi trường demo. Không tạo profile, tự gán Skill hoặc bỏ qua auth/RBAC.

## Validation và điểm dừng

Đã đọc catalog Active trực tiếp bằng SELECT từ MySQL: 117 Major + 328 Skill.
Validation độc lập kiểm tra đủ 100 tin, tỷ lệ 40/35/25, duplicate ID/title/source,
Major/Skill Active, năm học, deadline/metadata, nhãn synthetic và trạng thái review.
Read-only `planImport` trả **100 planned creates, 280 category reuses, 0 category
creates, blocked=false, writes=0**. Đây không phải kết quả importer-approved.

Importer `--dry-run` thực tế dừng với exit 1: **Invalid import batch: leader
approval**. Nó dừng trước validation từng item vì batch chưa được duyệt. Không đổi
needs_review thành leader_approved để vượt gate; không sửa importer contract.

**READY về mapping để leader review; NOT READY để import.** Database demo riêng vẫn chưa được xác minh; target đã kiểm tra trước đó là `unihub_dev`, không dùng để import demo. Bước còn lại là leader duyệt
batch demo, danh mục và mapping, đồng thời xác nhận môi trường demo đích. Sau đó
mới có thể cập nhật bằng chứng phê duyệt và chạy lại dry-run; apply và duyệt cơ hội
là các thao tác riêng chưa được thực hiện hoặc cho phép trong nhiệm vụ này.

## Chạy lại từ gốc repository

```powershell
node --env-file=backend/.env data/opportunities/demo/build-demo.mjs
node --test data/opportunities/demo/demo.test.mjs backend/test/catalog-import.test.mjs backend/test/recommendations.test.mjs
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --dry-run
```

Cần backend đã build. Generator chỉ SELECT catalog/cơ hội và ghi các file demo;
nó từ chối nếu catalog thay đổi, có mapping không hợp lệ hoặc trùng cơ hội đã có
trong MySQL. Chạy lại chỉ đồng bộ mapping/mô tả/scenarios/report; giữ nguyên ID, title, publisher, type, URL, location, năm học và deadline. Deadline hết hạn sẽ làm validation fail, không được âm thầm gia hạn.
Không chạy lại để ghi đè batch đã được review mà không xem diff.

Kiểm tra trên Windows Node 24.22.1: **27/27 focused tests đạt**, gồm dữ liệu demo,
importer và Recommendations service. Tests dùng fixture, không ghi database thật.
Không thực hiện UI test, import hay kiểm thử Recommendations xuyên MySQL/UI.

Quy trình tạo database cô lập và cấu hình riêng (chưa thực thi): [database-setup.md](database-setup.md). Catalog seed chỉ type/name: [catalog.json](catalog.json).
