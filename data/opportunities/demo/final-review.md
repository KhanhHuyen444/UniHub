> Báo cáo lịch sử trước khi sửa mapping. Kết quả cập nhật: [mapping-fix-review.md](mapping-fix-review.md). Hash và số liệu bên dưới thuộc phiên bản cũ.

# Final review — 100 DEMO Opportunities — 02/11/2026

**NOT READY để phê duyệt import.** Chỉ đọc dữ liệu và chạy focused tests; không sửa
batch, scenarios, generator, trạng thái phê duyệt, Recommendations, schema hay UI.
Báo cáo này là file mới duy nhất của lượt review.

## PASS/FAIL từng hạng mục

| Hạng mục                                        | Kết quả       | Bằng chứng / giới hạn                                                                                                                     |
| ----------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Đủ 100; 40 Thực tập / 35 Việc làm / 25 Học bổng | PASS          | Kiểm tra toàn bộ batch                                                                                                                    |
| Unique review_id, title, source_url             | PASS          | 100 giá trị riêng biệt mỗi loại                                                                                                           |
| Major/Skill Active                              | PASS          | SELECT MySQL hiện tại: 117 Major, 328 Skill Active; toàn bộ 117 Major + 188 Skill được dùng đều tồn tại và Active                         |
| Mapping đúng ý nghĩa nghề                       | FAIL          | Các liên kết phụ được thêm theo nhóm rộng; các bộ Skill bị cắt theo chỉ số, có trường hợp lệch nghề bên dưới                              |
| 117 Major được liên kết có ý nghĩa              | FAIL          | Đủ số lượng nhưng chưa đủ căn cứ nghiệp vụ cho cả 17 Major phụ                                                                            |
| Nhãn DEMO, publisher giả định, nguồn demo       | PASS          | Tất cả có DEMO/SYNTHETIC; URL chỉ thuộc unihub-demo.invalid, không dùng tên doanh nghiệp thật                                             |
| 25 học bổng                                     | PASS cấu trúc | Cả 25 là chương trình đề án giả lập, mức hỗ trợ giả lập rõ ràng, academic_years=[] và không có thu phí; DEMO-084 cần sửa mapping          |
| 20 deadline NULL                                | PASS          | Cả deadline_source_date/timezone đều NULL; source_status=open ghi rõ là trạng thái kịch bản, không phải nguồn thật                        |
| 80 deadline có ngày                             | PASS          | Còn tương lai tại thời điểm review; đúng cutoff ngày kế tiếp UTC+07                                                                       |
| Scenarios — phép tính/threshold                 | PASS          | 1.0 / 0.8 / 0.3 / 1.0 / 0.7 theo 40/30/30; threshold 0.5; học bổng có Year=0                                                              |
| Scenario nhiều Major — ý nghĩa nghề             | FAIL          | DEMO-003 dùng Kỹ thuật hệ thống công nghiệp cho vị trí thiết kế điện, bộ Skill trộn Lean/Six Sigma; toán đúng nhưng chưa phải case hợp lý |
| Không tự duyệt                                  | PASS          | 100 Pending, is_verified=false, reviewer/time NULL; proposal/category/link đều needs_review                                               |
| Database demo riêng được xác minh               | FAIL          | Runtime kết nối unihub_dev, có 11 cơ hội không thuộc batch DEMO; chưa xác minh DB demo riêng                                              |

Kiểm tra Active bằng dữ liệu MySQL thật, không chỉ dùng snapshot catalog trong repo.
Không truy vấn hồ sơ cá nhân hoặc in mật khẩu/connection string.

## Nguồn gốc mapping sai

[build-demo.mjs:39](build-demo.mjs:39) lấy 100 Major đầu làm vị trí chính rồi thêm
17 Major còn lại vào tin có cùng nhóm ngành bằng `target.majors.push` ở dòng 44.
Đây là bằng chứng trực tiếp việc tối ưu coverage thay vì kiểm tra phù hợp nghề.
Cùng nhóm rộng không đủ chứng minh một Major phù hợp vị trí cụ thể.

Sau đó [build-demo.mjs:63](build-demo.mjs:63) lấy 2–3 coreSkills theo `i % 2` và một
advantageSkill tùy `i % 3`, rồi hợp các kỹ năng của cả hai nghề. Điều này có thể
vừa bỏ Skill cốt lõi của nghề chính vừa bắt ứng viên có Skill thuộc nghề phụ.
Việc copy các tên Major/Skill này vào requirements không phải bằng chứng độc lập.
Tests trước đây xác nhận tính toàn vẹn tham chiếu và công thức, không xác nhận
ý nghĩa của toàn bộ mapping. Không nên dùng nhãn PASS kỹ thuật để kết luận READY
về nghiệp vụ.

## Rà soát đủ 17 liên kết Major phụ

Các liên kết dưới đây đều cần leader quyết định và có JD demo cụ thể trước khi
chấp nhận coverage. “Có thể hợp lý” chỉ là hướng xây dựng kịch bản, chưa phải duyệt.

| Tin      | Nghề chính → Major phụ                                        | Nhận định                                                                                                                             |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO-003 | Thiết kế điện → Kỹ thuật hệ thống công nghiệp                 | Không đủ căn cứ; Lean/Six Sigma không chứng minh năng lực thiết kế điện. Đổi Major phụ hoặc viết lại thành đề án phù hợp cả hai ngành |
| DEMO-004 | Mô hình hóa toán → Hải dương học                              | Có thể hợp lý nếu là mô hình hải văn; hiện không có nhiệm vụ mô hình hải văn cụ thể, bộ Skill bị ghép thêm quan trắc/đo đạc           |
| DEMO-005 | Phân tích thương mại quốc tế → Quản trị văn phòng             | Không hợp lý trong mô tả hiện tại; kỹ năng hành chính Word/Excel không thay thế nền tảng thương mại/kinh tế lượng                     |
| DEMO-006 | Biên tập nội dung tiếng Anh → Quan hệ quốc tế                 | Cần chủ đề đối ngoại/chính sách cụ thể; Phân tích chính sách công bị ghép vào yêu cầu biên tập chung                                  |
| DEMO-013 | Kỹ sư điện tử → Kỹ thuật hàng không                           | Chỉ hợp lý nếu có nhiệm vụ avionics/hệ thống điện tử hàng không; hiện không có, lại yêu cầu Khí động học                              |
| DEMO-014 | Tối ưu hóa → Địa lý tự nhiên                                  | Cần đề án tối ưu không gian/GIS cụ thể; hiện ghép ArcGIS/Viễn thám chỉ vì cùng nhóm                                                   |
| DEMO-015 | Nghiên cứu chính sách phát triển → Hệ thống thông tin quản lý | Cần nhiệm vụ dữ liệu/hệ thống hỗ trợ chính sách cụ thể; hiện yêu cầu SQL/Business Analysis không được giải thích                      |
| DEMO-016 | Đối ngoại tiếng Trung → Đông phương học                       | Có thể hợp lý nhưng cần yêu cầu tiếng Trung/nền tảng khu vực cụ thể; không thể mặc định mọi sinh viên Đông phương học phù hợp         |
| DEMO-023 | PLC Programmer → Kiến trúc                                    | Không hợp lý trong mô tả hiện tại; Revit/AutoCAD không chứng minh lập trình PLC/SCADA                                                 |
| DEMO-026 | Đối ngoại tiếng Nhật → Việt Nam học                           | Không hợp lý khi không có điều kiện tiếng Nhật; nghiệp vụ du lịch Việt Nam được ghép vào vị trí đối ngoại tiếng Nhật                  |
| DEMO-033 | Thiết kế cơ điện tử → Thiết kế công nghiệp                    | Có cơ sở CAD/thiết kế sản phẩm nhưng cần bài tập sản phẩm cụ thể và phạm vi cơ điện tử của ứng viên                                   |
| DEMO-036 | Đối ngoại tiếng Hàn → Nhân học                                | Không hợp lý khi không có điều kiện tiếng Hàn; kỹ năng nghiên cứu dân tộc học không tự đáp ứng nghiệp vụ đối ngoại                    |
| DEMO-046 | Đối ngoại tiếng Pháp → Quan hệ công chúng                     | Cần điều kiện tiếng Pháp và nhiệm vụ PR quốc tế; hiện trộn quản trị thương hiệu/khủng hoảng vào công việc chung                       |
| DEMO-056 | Chuyên viên nội dung → Truyền thông đa phương tiện            | Có thể hợp lý; cần nêu nội dung đa phương tiện và mức độ cần Figma/Dựng video, tránh mặc định bắt buộc mọi Skill của hai ngành        |
| DEMO-066 | Lưu trữ tư liệu → Thông tin - Thư viện                        | Có cơ sở với nghề lưu trữ; cần mô tả kho tư liệu/thư viện cụ thể để chứng minh bộ Skill hợp nhất                                      |
| DEMO-075 | Nghiên cứu triết học → Quản lý thông tin                      | Không hợp lý trong mô tả hiện tại; SQL/Quản trị dữ liệu không có liên hệ nhiệm vụ nghiên cứu triết học được giải thích                |
| DEMO-084 | Tham vấn tâm lý → Du lịch học                                 | Không hợp lý trong mô tả hiện tại; Thuyết minh du lịch không phù hợp chủ đề học bổng tham vấn tâm lý                                  |

## Các bộ Skill chính cần sửa/review ngoài các liên kết phụ

| Tin      | Vấn đề cần xử lý                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO-002 | Hỗ trợ hệ thống CNTT nhưng chỉ có SQL, Git, REST API; giống backend hơn hỗ trợ vận hành. Cần đổi ngữ cảnh nghề hoặc chọn Skill hỗ trợ hệ thống phù hợp trong catalog  |
| DEMO-029 | Kiểm nghiệm dược nhưng chỉ có Đọc hiểu tài liệu y khoa và GPP; chưa có Skill kiểm nghiệm/phòng thí nghiệm. Chọn lại theo nhiệm vụ kiểm nghiệm, không tự thêm Category |
| DEMO-032 | Quản trị cơ sở dữ liệu nhưng Skill là Business Analysis, UML, ERP; thiếu Skill cơ sở dữ liệu trực tiếp. Cần đổi nghề hoặc mapping                                     |
| DEMO-053 | Chẩn đoán ô tô nhưng chỉ AutoCAD/SolidWorks, thiên về thiết kế cơ khí. Cần Skill chẩn đoán phù hợp hoặc đổi chủ đề                                                    |
| DEMO-065 | Chứng từ xuất nhập khẩu nhưng chỉ Quản lý chuỗi cung ứng/Quản lý kho hàng; chưa thể hiện năng lực chứng từ. Cần mapping trực tiếp hơn                                 |
| DEMO-068 | Chuyên viên GIS môi trường nhưng không có GIS/QGIS/ArcGIS; chỉ Quản lý môi trường/Quan trắc/Pháp luật môi trường. Cần bổ sung Skill GIS có sẵn hoặc đổi tên nghề      |

Các tin còn lại đã được đọc ở mức title/Major/Skill và kiểm tra description/
requirements theo template generator; không phát hiện thêm xung đột rõ ở lượt này.
Không coi việc không có finding là xác minh JD thực tế. Toàn bộ vẫn là synthetic.

## Scenarios và database

[scenarios.json:43](scenarios.json:43) là case nhiều Major DEMO-003: expectedScore=1
đúng vì profile giả lập được gán toàn bộ Skill đã ghép. Đây là tính toán vòng khép
kín, không xác nhận sinh viên ngành phụ thật sự phù hợp nghề.

Học bổng DEMO-076 không có bộ lọc năm: majorMatch=1, yearMatch=0, skillMatch=1,
score=0.7. NULL không tạo hạn giả. 100 tin vẫn Pending nên production service phải
loại trước khi chấm điểm; các expectedVisibleAfterApproval chỉ có ý nghĩa sau một
quy trình duyệt riêng được cho phép trong môi trường demo.

Database trả về từ `SELECT DATABASE()` là **unihub_dev**. `SHOW DATABASES` bằng
runtime account chỉ thấy information_schema, performance_schema và unihub_dev.
Đây là phạm vi account được nhìn thấy, **không chứng minh không có DB demo ở nơi
khác**. Nhưng chưa có bằng chứng kết nối demo riêng; target hiện tại không đáp ứng
yêu cầu tách dữ liệu. unihub_dev đang có 11 cơ hội không mang nhãn DEMO/SYNTHETIC.
Không tạo DB, đổi kết nối, đọc/in file .env hoặc thực hiện migration/import.

## Các quyết định leader cần chốt

1. Sửa/bỏ các Major phụ không có ý nghĩa; không ép đủ 117 bằng cách ghép nhóm.
   Nếu vẫn yêu cầu coverage 117, thiết kế nhiệm vụ liên ngành cụ thể thay vì chỉ
   liệt kê tên ngành và hợp Skill.
2. Review lại các bộ Skill lệch nghề và scenario nhiều Major. Chạy lại kiểm tra
   cấu trúc/coverage/scenario sau khi sửa; không tự thay đổi công thức Recommendations.
3. Xác nhận database demo riêng cùng catalog Active/migration đã phù hợp. Không
   dùng kết nối unihub_dev hiện tại để import dataset này.
4. Sau khi hết các điểm chặn, leader mới duyệt proposal/catalog/mapping. Dry-run
   trước đó vẫn dừng ở leader approval; chưa có importer-approved dry-run toàn bộ.
   Import và Admin approval là các thao tác riêng, không thuộc review này.

Kiểm tra Windows Node 24.22.1: validation toàn bộ 100 tin với Active catalog live
PASS; 14 focused tests (demo + Recommendations) PASS; git diff --check PASS.
Không test UI hay thực hiện write/integration import vào MySQL.

Hash batch giữ nguyên:
`BDB51532A68D2C42FC1800E260BD0ABFD1F7BB25CE96B2BBC25A6CA9FD47AF9B`.
Hash scenarios giữ nguyên:
`80C04AEDE7FA22D9EDC907B8F410FD9B68AB83053E173616B9694783D6A3C99C`.
