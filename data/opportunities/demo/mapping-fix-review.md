# Mapping fix — 02/11/2026

**READY về mapping để leader review; NOT READY để import.** Vẫn cần leader phê duyệt
và xác minh database demo riêng. Không thay đổi kết nối hoặc dữ liệu MySQL.

Batch vẫn đúng 100 tin: 40 Thực tập, 35 Việc làm, 25 Học bổng; 20 deadline NULL,
80 hạn tương lai, 10 nhóm ngành. So sánh trước–sau xác nhận cả 100 tin giữ nguyên
review_id, title, publisher, type, source_url, work_format, location, năm học,
deadline/metadata và trạng thái review. Chỉ mapping, nội dung giải thích nhiệm vụ,
category proposal, scenarios và báo cáo được cập nhật.

## Thay đổi

- Coverage giảm từ 117 xuống **101 Major**; dùng **179/328 Skill Active**.
- Xử lý đủ 17 Major phụ: **bỏ 15**, **thay 1** (DEMO-003), **giữ 1 có nhiệm vụ rõ**
  (DEMO-066). Không còn ghép ngành chỉ vì nằm trong cùng nhóm.
- DEMO-003: thay Kỹ thuật hệ thống công nghiệp bằng Kỹ thuật điện tử - viễn thông,
  đi cùng Kỹ thuật điện. Nhiệm vụ mô phỏng mạch cấp nguồn, đọc sơ đồ và an toàn
  điện–điện tử; Skill: Thiết kế mạch điện, Đọc bản vẽ kỹ thuật, An toàn điện.
- DEMO-066: Lịch sử + Thông tin - Thư viện cùng thực hiện phân loại/biên mục kho tư
  liệu lịch sử giả lập. Skill: Quản lý hồ sơ và lưu trữ, Nghiên cứu tư liệu lịch sử,
  Biên mục tài liệu.
- Các tin bỏ Major phụ: DEMO-004/005/006/013/014/015/016/023/026/033/036/046/056/075/084.
  Đồng thời chọn lại Skill theo nhiệm vụ nghề chính; các vị trí đối ngoại có yêu
  cầu tiếng Trung/Nhật/Hàn/Pháp tương ứng, không tự suy ra năng lực từ ngành phụ.

Sáu bộ Skill lệch nghề đã sửa:

| Tin      | Skill mới gắn trực tiếp với nhiệm vụ                              |
| -------- | ----------------------------------------------------------------- |
| DEMO-002 | Linux; Quản trị hệ thống mạng; TCP/IP                             |
| DEMO-029 | Kiểm nghiệm dược phẩm; Sắc ký (HPLC/GC); An toàn hóa chất         |
| DEMO-032 | SQL; Thiết kế cơ sở dữ liệu; Quản trị dữ liệu                     |
| DEMO-053 | Chẩn đoán hệ thống ô tô; Điện - điện tử ô tô; Đọc bản vẽ kỹ thuật |
| DEMO-065 | Chứng từ xuất nhập khẩu; Incoterms; Xuất nhập khẩu                |
| DEMO-068 | GIS; QGIS; Phân tích dữ liệu không gian; Quản lý môi trường       |

Tổng cộng **23 tin thay đổi mapping**. Manifest `reviewed-mapping.json` ghi rõ
Major/Skill/nhiệm vụ/lý do của cả 100 tin. “Reviewed” là rà soát dữ liệu DEMO ở lượt
này, không phải leader_approved, Verified hoặc xác minh JD doanh nghiệp thật.

## Generator và scenarios

`build-demo.mjs` nay đồng bộ manifest cố định vào batch đang có, không tạo lại
100 tin. Không còn vòng ghép 17 Major dư, lựa chọn nghề bằng chỉ số hoặc cắt/hợp
Skill theo i%2/i%3. Chạy lại giữ nguyên nội dung ngoài phạm vi mapping và idempotent;
không tự gia hạn deadline. Nếu Category không Active hoặc mapping sai tham chiếu,
validation dừng trước khi ghi các file kết quả.

Scenario nhiều Major vẫn dùng DEMO-003, nhưng profile ngành Điện tử–Viễn thông và
bộ Skill hiện khớp nhiệm vụ điện–điện tử. Điểm kỳ vọng các scenario vẫn là
**1.0 / 0.8 / 0.3 / 1.0 / 0.7**. Học bổng giữ academic_years=[] và Year=0 theo
contract; 20 NULL giữ cả hai metadata NULL. Không sửa công thức/threshold/sort
Recommendations. Cả 100 tin vẫn Pending nên chưa được Public/Recommendations nhận.

## Validation

- Đọc catalog Active bằng SELECT MySQL; toàn bộ 101 Major và 179 Skill hợp lệ.
- Uniqueness, cơ cấu 40/35/25, deadline/metadata, academic_years, nguồn DEMO,
  trạng thái needs_review/Pending/false: PASS.
- So sánh với snapshot trước sửa: 100/100 tin giữ nguyên identity/type/deadline.
- **27/27 focused tests PASS**: demo, importer, Recommendations; có regression
  cho sáu nghề lệch Skill, liên kết Major, ngoại ngữ, idempotence và trường giữ nguyên.
- Read-only plan: 100 create, 280 category reuse, 0 category mới, blocked=false,
  writes=0. Không phải importer-approved dry-run.
- Importer --dry-run thực tế vẫn dừng đúng `leader approval`; không giả mạo cờ
  phê duyệt để vượt gate. Kết quả lưu tại dry-run-result.json.

Chưa tạo DB demo hoặc thay đổi target unihub_dev. Vấn đề tách database trong final
review vẫn còn và là điều kiện bắt buộc trước import. Không --apply,
stage/commit/push; không sửa API, UI, schema, migrations hoặc Recommendations.
