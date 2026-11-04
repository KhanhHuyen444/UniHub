import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. 12 Synthetic Student Authors
const authors = [
  {
    email: 'nguyen.hoang.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-01',
    full_name: 'Nguyễn Hoàng',
    avatar_url: null,
    role: 'Student',
    major_name: 'Kỹ thuật phần mềm',
    academic_year: 3,
    career_goal: 'Kỹ sư phát triển phần mềm Backend / Fullstack',
  },
  {
    email: 'tran.mai.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-02',
    full_name: 'Trần Mai',
    avatar_url: null,
    role: 'Student',
    major_name: 'Công nghệ thông tin',
    academic_year: 3,
    career_goal: 'Kỹ sư giải pháp đám mây và hệ thống thông tin',
  },
  {
    email: 'le.tri.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-03',
    full_name: 'Lê Trí',
    avatar_url: null,
    role: 'Student',
    major_name: 'Hệ thống thông tin',
    academic_year: 3,
    career_goal: 'Chuyên viên phân tích dữ liệu và thiết kế cơ sở dữ liệu',
  },
  {
    email: 'pham.quynh.anh.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-04',
    full_name: 'Phạm Quỳnh Anh',
    avatar_url: null,
    role: 'Student',
    major_name: 'Marketing',
    academic_year: 2,
    career_goal: 'Chuyên viên Digital Marketing và Growth Communications',
  },
  {
    email: 'vu.hoang.long.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-05',
    full_name: 'Vũ Hoàng Long',
    avatar_url: null,
    role: 'Student',
    major_name: 'Khoa học máy tính',
    academic_year: 4,
    career_goal: 'Kỹ sư Trí tuệ nhân tạo và xử lý ngôn ngữ tự nhiên',
  },
  {
    email: 'doan.khanh.linh.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-06',
    full_name: 'Đoàn Khánh Linh',
    avatar_url: null,
    role: 'Student',
    major_name: 'Tài chính',
    academic_year: 3,
    career_goal: 'Chuyên viên phân tích tài chính doanh nghiệp và đầu tư',
  },
  {
    email: 'bui.van.dat.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-07',
    full_name: 'Bùi Văn Đạt',
    avatar_url: null,
    role: 'Student',
    major_name: 'Khoa học dữ liệu',
    academic_year: 2,
    career_goal: 'Data Scientist / Machine Learning Engineer',
  },
  {
    email: 'hoang.thu.thao.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-08',
    full_name: 'Hoàng Thu Thảo',
    avatar_url: null,
    role: 'Student',
    major_name: 'Quản trị kinh doanh',
    academic_year: 4,
    career_goal: 'Quản trị viên tập sự và phát triển sản phẩm công nghệ',
  },
  {
    email: 'dang.tuan.kiet.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-09',
    full_name: 'Đặng Tuấn Kiệt',
    avatar_url: null,
    role: 'Student',
    major_name: 'An toàn thông tin',
    academic_year: 3,
    career_goal: 'Chuyên viên bảo mật ứng dụng và kiểm thử an ninh mạng',
  },
  {
    email: 'nguyen.ngoc.anh.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-10',
    full_name: 'Nguyễn Ngọc Ánh',
    avatar_url: null,
    role: 'Student',
    major_name: 'Kế toán',
    academic_year: 2,
    career_goal: 'Kiểm toán viên và tư vấn quản trị tài chính nội bộ',
  },
  {
    email: 'tran.quoc.bao.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-11',
    full_name: 'Trần Quốc Bảo',
    avatar_url: null,
    role: 'Student',
    major_name: 'Trí tuệ nhân tạo',
    academic_year: 3,
    career_goal: 'Nghiên cứu viên AI và kỹ sư thị giác máy tính',
  },
  {
    email: 'phan.thanh.ha.demo@student.unihub.invalid',
    google_sub: 'demo-forum-student-12',
    full_name: 'Phan Thanh Hà',
    avatar_url: null,
    role: 'Student',
    major_name: 'Kinh doanh số và trí tuệ nhân tạo',
    academic_year: 4,
    career_goal: 'Product Owner và tư vấn chuyển đổi số doanh nghiệp',
  },
];

// Helper to select author email by index or name
const authorMap = {
  hoang: 'nguyen.hoang.demo@student.unihub.invalid',
  mai: 'tran.mai.demo@student.unihub.invalid',
  tri: 'le.tri.demo@student.unihub.invalid',
  quynhanh: 'pham.quynh.anh.demo@student.unihub.invalid',
  long: 'vu.hoang.long.demo@student.unihub.invalid',
  linh: 'doan.khanh.linh.demo@student.unihub.invalid',
  dat: 'bui.van.dat.demo@student.unihub.invalid',
  thao: 'hoang.thu.thao.demo@student.unihub.invalid',
  kiet: 'dang.tuan.kiet.demo@student.unihub.invalid',
  ngocanh: 'nguyen.ngoc.anh.demo@student.unihub.invalid',
  bao: 'tran.quoc.bao.demo@student.unihub.invalid',
  ha: 'phan.thanh.ha.demo@student.unihub.invalid',
};

// 2. 24 Forum Posts (8 per topic)
// Ordered such that POST 1, POST 9 (study), POST 17 (internship) have the most recent timestamps!
const posts = [
  // --- TOPIC: Kinh nghiệm phỏng vấn (8 posts) ---
  {
    id_key: 'post-interview-01',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh viên năm 3',
    author_email: authorMap.hoang,
    relative_hours: 2, // 2 hours ago (Matches Homepage Card 1)
    content: `Chào mọi người, mình vừa hoàn thành đợt phỏng vấn vị trí Software Engineering Intern tại một công ty công nghệ ở TP.HCM và nhận được offer. Mình viết bài này để chia sẻ lại toàn bộ quy trình và một số lưu ý quan trọng cho các bạn sinh viên năm 3 đang chuẩn bị rải CV:

1. Vòng hồ sơ (CV Screening):
- Tập trung vào các dự án cá nhân hoặc đồ án môn học có deploy thật, có link GitHub chỉn chu và README mô tả rõ tech stack, kiến trúc và vai trò của bản thân.
- Không liệt kê quá nhiều công nghệ mà bản thân chỉ mới biết sơ sơ. Nhà tuyển dụng sẽ hỏi rất sâu vào bất kỳ keyword nào bạn ghi trong CV.

2. Vòng Technical Online Test:
- Làm trong 60-90 phút trên HackerRank/Coderbyte. Đa phần là 2-3 bài LeetCode ở mức Easy và Medium cơ bản (Array, String, Hash Map, Two Pointers).
- Lời khuyên là nên luyện khoảng 75 bài LeetCode kinh điển (Blind 75 hoặc NeetCode 150) là đủ tự tin vượt qua vòng này.

3. Vòng Phỏng vấn kỹ thuật (Live Coding & Core Knowledge):
- Không chỉ gõ code mà quan trọng nhất là "Think Out Loud" – vừa suy nghĩ vừa giải thích hướng tiếp cận cho anh interviewer nghe. Hỏi kỹ về edge cases trước khi bắt đầu code.
- Kiến thức nền tảng hay bị hỏi sâu: OOP (4 tính chất và ứng dụng thực tế), cơ chế Index trong MySQL, Transaction isolation level, vòng đời HTTP Request, và RESTful API design.

4. Vòng Culture Fit & HR:
- Sử dụng mô hình STAR (Situation, Task, Action, Result) khi trả lời các câu hỏi tình huống: xung đột nhóm khi làm đồ án, cách xử lý khi trễ deadline, động lực học hỏi công nghệ mới.
- Chuẩn bị sẵn 2-3 câu hỏi chất lượng để hỏi ngược lại công ty ở cuối buổi.

Chúc các bạn năm 3 ôn luyện thật tốt và sớm có kết quả như ý nhé!`,
  },
  {
    id_key: 'post-interview-02',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Tổng hợp các câu hỏi phỏng vấn vị trí Business Analyst (BA) Intern thường gặp nhất',
    author_email: authorMap.linh,
    relative_hours: 75,
    content: `Mình vừa trải qua 3 vòng phỏng vấn vị trí Business Analyst Intern tại một ngân hàng thương mại cổ phần và công ty Fintech. Mình tổng hợp lại các nhóm câu hỏi trọng tâm để các bạn ngành Hệ thống thông tin, Kinh doanh số cùng tham khảo:

1. Kiến thức phân tích nghiệp vụ cơ bản:
- Phân biệt sự khác nhau giữa Functional Requirement (Yêu cầu chức năng) và Non-functional Requirement (Yêu cầu phi chức năng). Cho ví dụ thực tế.
- Khác biệt giữa User Story và Use Case Specification? Khi nào nên áp dụng tiêu chuẩn INVEST?
- Cách bạn vẽ BPMN hoặc Flowchart mô tả quy trình đặt hàng và thanh toán trực tuyến.

2. Kỹ năng xử lý tình huống nghiệp vụ:
- Nếu Product Owner và Tech Lead có mâu thuẫn về một tính năng gấp, bạn sẽ đứng ở giữa thu thập dữ liệu và thuyết phục các bên như thế nào?
- Khi tiếp nhận một yêu cầu rất mơ hồ từ khách hàng: "Tôi muốn hệ thống chạy mượt hơn và giao diện hiện đại hơn", bạn sẽ đặt những câu hỏi làm rõ (clarification questions) gì?

3. Bài test Case Study tại chỗ:
- Thường cho một bài toán nhỏ: "Đề xuất tính năng giữ chân người dùng cho ứng dụng tích điểm". Bạn có 15 phút chuẩn bị slide ngắn và trình bày hướng giải quyết.

Các bạn nhớ ôn kỹ cả SQL cơ bản nhé, vì nhiều nơi BA cũng cần tự viết SELECT JOIN để kiểm tra dữ liệu đối soát!`,
  },
  {
    id_key: 'post-interview-03',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Kinh nghiệm vượt qua vòng Live Coding và System Design cơ bản cho Fresher',
    author_email: authorMap.long,
    relative_hours: 98,
    content: `Nhiều bạn sinh viên năm cuối chuẩn bị tốt nghiệp thường rất sợ vòng Live Coding vì tâm lý áp lực khi có người quan sát từng dòng gõ code. Mình xin đúc kết vài kinh nghiệm thực chiến giúp các bạn giữ bình tĩnh:

1. Quy tắc 5 phút đầu tiên: Tuyệt đối không gõ code ngay khi đọc xong đề bài! Hãy lặp lại đề bài theo cách hiểu của bạn với interviewer, xác nhận các trường hợp biên (input null, mảng rỗng, số âm, trùng lặp).
2. Trình bày phương án Brute Force trước: Đừng ngại nói về cách giải đơn giản nhất O(N^2), sau đó phân tích điểm nghẽn và đưa ra phương án tối ưu O(N) hoặc O(N log N) dùng Hash Map / Two Pointers.
3. Về System Design mức Fresher: Người ta không đòi hỏi bạn thiết kế hệ thống phân tán cỡ triệu RPS như Senior, nhưng bạn cần nắm vững:
- Thiết kế Schema database hợp lý (chuẩn hóa 3NF, đặt Foreign Key, chọn DataType).
- Khi nào dùng Cache (Redis) và chiến lược vô hiệu hóa cache.
- Cơ chế Stateless Session với JWT.
- Đánh giá khả năng mở rộng (Scale vertically vs Horizontally).

Quan trọng nhất là thái độ cầu thị, biết lắng nghe gợi ý (hints) của interviewer khi bị tắc đường đi.`,
  },
  {
    id_key: 'post-interview-04',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Cách trả lời câu hỏi "Hãy giới thiệu về bản thân" và "Điểm yếu của bạn là gì" một cách tự nhiên',
    author_email: authorMap.quynhanh,
    relative_hours: 122,
    content: `Hai câu hỏi mở đầu kinh điển trong hầu hết mọi buổi phỏng vấn tưởng chừng đơn giản nhưng lại là yếu tố quyết định 50% ấn tượng đầu tiên của nhà tuyển dụng.

1. "Hãy giới thiệu về bản thân bạn trong 1-2 phút":
- Đừng đọc lại CV! Nhà tuyển dụng đã có CV trước mặt rồi.
- Hãy dùng công thức Hiện tại - Quá khứ - Tương lai (Present - Past - Future):
  + Hiện tại: Sinh viên năm mấy, chuyên ngành gì tại trường, đam mê theo đuổi lĩnh vực cụ thể nào.
  + Quá khứ: Điểm sáng về 1-2 dự án tiêu biểu hoặc kinh nghiệm thực chiến đã làm được.
  + Tương lai: Vì sao bạn chọn ứng tuyển vào công ty này và kỳ vọng đóng góp gì trong giai đoạn tới.

2. "Điểm yếu lớn nhất của bạn là gì?":
- Tránh câu trả lời sáo rỗng: "Em là người quá cầu toàn" hoặc "Em quá đam mê công việc".
- Công thức an toàn và chân thành: Chọn một kỹ năng thật mà bạn còn thiếu kinh nghiệm nhưng KHÔNG PHẢI là kỹ năng sống còn bắt buộc của vị trí, đồng thời nêu rõ GIẢI PHÁP bạn đang thực hiện để khắc phục nó.
- Ví dụ: "Trước đây em thường khá lúng túng khi thuyết trình trước đám đông. Để cải thiện, em đã chủ động nhận làm trưởng nhóm trong 2 đồ án gần nhất và tham gia câu lạc bộ học thuật để rèn luyện kỹ năng trình bày".`,
  },
  {
    id_key: 'post-interview-05',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Trải nghiệm phỏng vấn chương trình Quản trị viên tập sự (Management Trainee) mùa 2026',
    author_email: authorMap.thao,
    relative_hours: 145,
    content: `Mùa tuyển dụng MT năm nay đang bắt đầu sôi động. Vừa qua mình có cơ hội tiến vào vòng Assessment Center của một tập đoàn tiêu dùng đa quốc gia (FMCG). Mình chia sẻ lại trải nghiệm để các bạn khối ngành kinh tế có thêm góc nhìn:

Quy trình thi tuyển gồm 4 vòng chính:
1. Online Test: Gồm 3 phần: Numerical Reasoning (tính toán nhanh bảng biểu số liệu), Logical Reasoning (hình khối, quy luật), và English Test (đọc hiểu văn bản thương mại).
2. Video Interview: Trả lời câu hỏi tự động qua màn hình trong 60 giây, kiểm tra phản xạ tiếng Anh và phong thái tự tin.
3. Assessment Center / Group Discussion: 6-8 ứng viên cùng giải quyết một Business Case thực tế trong 45 phút, sau đó thuyết trình và trả lời chất vấn từ Ban Giám khảo.
- Lưu ý: Giám khảo không chỉ tìm người nói nhiều nhất, mà tìm người biết lắng nghe, tóm tắt ý kiến nhóm, định hướng thời gian và đưa ra giải pháp có số liệu chứng minh khả thi.
4. Final Interview với General Manager / Functional Director: Hỏi rất sâu về định hướng nghề nghiệp, giá trị cá nhân và độ phù hợp với văn hóa doanh nghiệp.

Lời khuyên: Hãy trau dồi tiếng Anh giao tiếp lưu loát và đọc nhiều case study kinh doanh từ các nguồn uy tín như McKinsey, HBR nhé!`,
  },
  {
    id_key: 'post-interview-06',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Nên đặt những câu hỏi nào cho nhà tuyển dụng ở cuối buổi phỏng vấn để ghi điểm?',
    author_email: authorMap.bao,
    relative_hours: 170,
    content: `Cuối mỗi buổi phỏng vấn, khi người phỏng vấn hỏi: "Em có câu hỏi nào dành cho anh/chị không?", việc bạn trả lời "Dạ em không có câu hỏi nào ạ" là một sự lãng phí rất lớn!

Đặt câu hỏi thông minh giúp bạn:
1. Thể hiện sự hứng thú và tìm hiểu nghiêm túc về công ty.
2. Đánh giá xem môi trường và người quản lý trực tiếp có phù hợp với định hướng của bản thân hay không.

Một số câu hỏi được đánh giá rất cao:
- Về công việc thực tế: "Trong 3 tháng thực tập đầu tiên, mục tiêu hoặc tiêu chí thành công cụ thể nhất dành cho vị trí này là gì ạ?"
- Về văn hóa và đào tạo: "Team mình hiện tại có quy trình review code và chia sẻ kiến thức (knowledge sharing) định kỳ như thế nào ạ?"
- Về người phỏng vấn: "Điều gì khiến anh/chị gắn bó nhất với công ty trong suốt thời gian qua?"
- Về bước tiếp theo: "Sau buổi phỏng vấn hôm nay, quy trình đánh giá tiếp theo sẽ diễn ra trong khoảng bao lâu để em có thể chủ động theo dõi ạ?"

Nên tránh hỏi ngay về mức trợ cấp hay giờ giấc làm việc ở những câu đầu tiên nếu chưa được nhà tuyển dụng đề cập nhé!`,
  },
  {
    id_key: 'post-interview-07',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Kinh nghiệm phỏng vấn vị trí Data Analyst Intern: Những case study thực tế cần chuẩn bị',
    author_email: authorMap.dat,
    relative_hours: 195,
    content: `Các bạn sinh viên hướng tới vị trí Data Analyst (DA) thường băn khoăn nhà tuyển dụng sẽ hỏi gì ngoài việc gõ SQL. Mình xin chia sẻ từ đợt phỏng vấn gần đây tại một công ty thương mại điện tử:

1. Kỹ năng SQL thực chiến:
- Đừng chỉ dừng lại ở GROUP BY hay HAVING. Hãy luyện rất kỹ Window Functions (ROW_NUMBER, RANK, DENSE_RANK, LEAD, LAG) và CTE (Common Table Expressions).
- Bài toán kinh điển: "Tìm top 3 khách hàng chi tiêu nhiều nhất mỗi tháng", "Tính tỷ lệ giữ chân người dùng (Retention Rate) sau 7 ngày".

2. Tư duy phân tích số liệu (Business Sense & Case Study):
- Câu hỏi thường gặp: "Nếu tuần vừa rồi doanh thu của sàn giảm 15% so với tuần trước, bạn sẽ phân rã vấn đề và tìm nguyên nhân gốc rễ (root cause) như thế nào?"
- Hướng giải quyết: Phân rã công thức Doanh thu = Traffic * Conversion Rate * AOV (Giá trị đơn hàng trung bình). Sau đó kiểm tra xem tỷ lệ nào sụt giảm, phân tích theo phân khúc: thiết bị (iOS/Android/Web), khu vực địa lý, kênh marketing, hay do lỗi kỹ thuật cổng thanh toán.

3. Kỹ năng Dashboard & Data Visualization:
- Nắm vững khi nào dùng Bar Chart, Line Chart, Heatmap, Scatter Plot. Tránh lạm dụng Pie Chart khi có quá nhiều danh mục.

Chuẩn bị sẵn 1 project phân tích dữ liệu thực tế trên GitHub có báo cáo trực quan sẽ là điểm cộng cực lớn!`,
  },
  {
    id_key: 'post-interview-08',
    topic: 'Kinh nghiệm phỏng vấn',
    title:
      'Làm gì sau khi nhận được lời từ chối (Rejection Letter) từ nhà tuyển dụng mà mình rất mong muốn?',
    author_email: authorMap.kiet,
    relative_hours: 220,
    content: `Nhận email cảm ơn kèm lời từ chối ("Rất tiếc hồ sơ của bạn chưa phù hợp...") là trải nghiệm mà bất kỳ ai khi đi xin việc cũng phải trải qua vài lần. Bản thân mình từng trượt 4 công ty trước khi nhận được lời mời thực tập ưng ý.

Dưới đây là cách mình biến những lần bị từ chối thành cơ hội học hỏi:

1. Cho phép bản thân nghỉ ngơi 1 ngày: Đừng quá tự ti hay nghi ngờ năng lực bản thân. Việc chưa được chọn đôi khi đơn giản là do thời điểm, ngân sách tuyển dụng thay đổi, hoặc công ty tìm kiếm một ứng viên có kỹ năng ngách khác.

2. Gửi một bức thư cảm ơn phản hồi (Thank-you Follow-up):
- Thể hiện sự chuyên nghiệp và cảm ơn anh/chị đã dành thời gian phỏng vấn.
- Khéo léo xin góp ý: "Nếu có thể, em rất mong nhận được 1-2 lời khuyên từ anh/chị về điểm em cần cải thiện để hoàn thiện hơn trong tương lai".
- Giữ kết nối trên LinkedIn với người phỏng vấn và HR.

3. Tự làm Review chi tiết:
- Ghi lại ngay những câu hỏi phỏng vấn mà mình trả lời chưa tốt, các câu hỏi kỹ thuật bị lúng túng.
- Dành thời gian nghiên cứu và tìm hiểu câu trả lời chuẩn xác cho từng câu đó ngay trong tuần.

Mỗi buổi phỏng vấn, dù đỗ hay trượt, đều là một buổi luyện tập miễn phí với các chuyên gia có kinh nghiệm trong ngành!`,
  },

  // --- TOPIC: Học tập (8 posts) ---
  {
    id_key: 'post-study-01',
    topic: 'Học tập',
    title:
      'Cách phân bổ thời gian ôn thi chứng chỉ TOEIC và đồ án chuyên ngành hiệu quả',
    author_email: authorMap.mai,
    relative_hours: 24, // 1 day ago (Matches Homepage Card 2)
    content: `Xin chào mọi người! Kỳ này mình vừa hoàn thành mục tiêu TOEIC 850 vừa bảo vệ xong đồ án môn học Chuyên ngành đạt điểm A. Trước đây mình từng rất stress vì dồn cả hai việc vào cùng một lúc, nên muốn chia sẻ phương pháp quản lý thời gian mà mình đã áp dụng thành công:

1. Nguyên tắc chia khối thời gian (Time-blocking):
- Buổi sáng sớm (6h30 - 8h00): Não bộ tỉnh táo nhất, mình dành 90 phút này cho việc luyện nghe Listening TOEIC (Part 2, Part 3) và học 30 từ vựng chuyên đề qua Flashcard Anki.
- Buổi chiều/tối (14h00 - 17h30 & 19h30 - 22h00): Tập trung toàn bộ sức lực cho đồ án chuyên ngành: đọc tài liệu nghiên cứu, thiết kế cơ sở dữ liệu và triển khai code tính năng.

2. Lộ trình ôn TOEIC cấp tốc trong 8 tuần:
- 4 tuần đầu: Củng cố chắc ngữ pháp trọng tâm (mệnh đề quan hệ, câu điều kiện, giới từ, thì) và luyện phương pháp nghe bắt từ khóa (Keywords & Paraphrasing).
- 4 tuần sau: Giải đề bấm giờ nghiêm túc theo format đề ETS (mỗi tuần 2 đề full). Sau mỗi đề dành ít nhất 2 tiếng để chữa thật kỹ từng câu sai và nghe lại Transcript.

3. Quản lý tiến độ đồ án theo tuần (Milestone Planning):
- Chia nhỏ đồ án thành các Sprint nhỏ 1 tuần trên Trello/Notion. Không bao giờ để dồn code vào 2 tuần cuối trước ngày nộp báo cáo.
- Họp nhanh nhóm (Daily Standup 10 phút) vào đầu tuần để chốt việc của từng bạn, tránh tình trạng ỷ lại hoặc chồng chéo công việc.

Các bạn có đang gặp khó khăn gì trong việc cân bằng giữa học chứng chỉ và bài tập trên lớp thì bình luận bên dưới nhé, mình sẽ hỗ trợ giải đáp!`,
  },
  {
    id_key: 'post-study-02',
    topic: 'Học tập',
    title:
      'Kinh nghiệm tự học SQL và Database Design từ con số 0 cho người mới bắt đầu',
    author_email: authorMap.tri,
    relative_hours: 245,
    content: `Cơ sở dữ liệu (Database) là nền tảng cốt lõi của mọi ứng dụng phần mềm cũng như phân tích dữ liệu. Mình thấy nhiều bạn năm nhất, năm hai rất ngại môn này vì vướng phần Chuẩn hóa dữ liệu (Normal Forms) và viết truy vấn phức tạp.

Lộ trình tự học mình thấy hiệu quả nhất:
1. Giai đoạn 1: Nắm chắc cú pháp SQL căn bản (1-2 tuần):
- Học qua trang tương tác SQLBolt và W3Schools: SELECT, WHERE, ORDER BY, GROUP BY, HAVING, INNER/LEFT/RIGHT JOIN.
- Thực hành ngay trên LeetCode SQL 50 (bắt đầu từ các bài Easy).

2. Giai đoạn 2: Thiết kế lược đồ thực thể quan hệ (ERD) và Chuẩn hóa (2 tuần):
- Học cách xác định Thực thể (Entity), Thuộc tính (Attribute) và Mối quan hệ (1-1, 1-N, N-N).
- Hiểu bản chất của 1NF, 2NF, 3NF: Tại sao phải tách bảng? Tách bảng để tránh dư thừa dữ liệu (redundancy) và dị thường cập nhật (update anomalies) như thế nào.

3. Giai đoạn 3: Tối ưu hóa và Hiệu năng (Index & Transaction):
- Tìm hiểu cơ chế B-Tree Index: Khi nào nên đánh index, khi nào không nên?
- Khái niệm ACID trong Transaction.

Công cụ thực hành khuyên dùng: DBeaver kết nối MySQL/PostgreSQL cục bộ qua Docker hoặc XAMPP.`,
  },
  {
    id_key: 'post-study-03',
    topic: 'Học tập',
    title:
      'Phương pháp đọc tài liệu kỹ thuật tiếng Anh chuyên ngành hiệu quả cho sinh viên năm nhất, năm hai',
    author_email: authorMap.ha,
    relative_hours: 270,
    content: `Nhiều bạn sinh viên năm đầu thường có thói quen tìm kiếm tài liệu lập trình hoặc sách chuyên ngành bằng tiếng Việt. Tuy nhiên, công nghệ cập nhật liên tục và tài liệu tiếng Việt thường cũ hơn hoặc dịch thiếu chính xác.

Cách mình rèn luyện thói quen đọc tài liệu tiếng Anh mỗi ngày:

1. Đừng dịch từng từ một:
- Đọc lướt qua một lượt toàn bộ đoạn văn (Skimming) để nắm ý chính (Overview).
- Các thuật ngữ chuyên ngành (như Thread-safe, Asynchronous, Encapsulation, Overhead, Deprecated...) không nên dịch thô ra tiếng Việt mà hãy hiểu ngữ cảnh kỹ thuật của nó.

2. Cài đặt tiện ích tra từ thông minh:
- Dùng tiện ích mở rộng như eJOY English hoặc Google Translate dạng Popup để click đúp vào từ vựng mới xem nghĩa nhanh mà không làm đứt mạch đọc.
- Lưu lại những cụm từ hay gặp vào sổ tay cá nhân.

3. Bắt đầu từ Official Documentation chính thức:
- Khi học một framework/ngôn ngữ mới, hãy bắt đầu từ trang hướng dẫn "Getting Started" của trang chủ (như react.dev, docs.nestjs.com, python.org). Tài liệu chính thống luôn chuẩn mực và có code mẫu cập nhật nhất.`,
  },
  {
    id_key: 'post-study-04',
    topic: 'Học tập',
    title:
      'Nên chọn đề tài nghiên cứu khoa học sinh viên hay tập trung làm đồ án ứng dụng thực tế?',
    author_email: authorMap.long,
    relative_hours: 295,
    content: `Đây là băn khoăn của rất nhiều bạn sinh viên năm 2 và năm 3 khi đứng trước ngưỡng cửa chọn hướng đi học thuật. Mình xin đưa ra một số so sánh khách quan từ trải nghiệm bản thân:

1. Hướng Nghiên cứu khoa học (NCKH):
- Đặc điểm: Đọc nhiều bài báo khoa học (Papers trên IEEE, ACM, Springer), tập trung vào thuật toán mới, cải tiến mô hình, phân tích toán học và viết bài báo bằng tiếng Anh.
- Phù hợp với: Các bạn có định hướng học lên Thạc sĩ/Tiến sĩ, săn học bổng du học, hoặc muốn ứng tuyển vào các Lab R&D chuyên sâu về AI, An ninh mạng, Xử lý tín hiệu.
- Đòi hỏi: Sự kiên trì đọc tài liệu học thuật rất lớn và người thầy hướng dẫn tận tâm.

2. Hướng Đồ án ứng dụng thực tế (Product/Engineering):
- Đặc điểm: Xây dựng một sản phẩm hoàn chỉnh giải quyết nhu cầu đời sống (web app, mobile app, hệ thống quản lý), áp dụng các công nghệ phổ biến trên thị trường.
- Phù hợp với: Các bạn muốn đi làm kỹ sư phần mềm, lập trình viên tại doanh nghiệp ngay sau khi tốt nghiệp. Sản phẩm có thể đem đi thi các cuộc thi Hackathon và đưa thẳng vào CV xin việc.

Mỗi hướng đi đều có giá trị riêng, quan trọng là bạn xác định rõ mục tiêu nghề nghiệp sau khi tốt nghiệp của mình là gì!`,
  },
  {
    id_key: 'post-study-05',
    topic: 'Học tập',
    title:
      'Lộ trình ôn thi chứng chỉ AWS Cloud Practitioner / Solutions Architect Associate trong 3 tháng',
    author_email: authorMap.hoang,
    relative_hours: 320,
    content: `Điện toán đám mây (Cloud Computing) đang là kỹ năng cực kỳ sáng giá trên CV của sinh viên ngành CNTT và Phần mềm. Mình vừa pass kỳ thi AWS Certified Solutions Architect - Associate (SAA-C03) với điểm số 840/1000 sau 3 tháng ôn luyện.

Tài nguyên và lộ trình mình đã dùng:

1. Khóa học lý thuyết:
- Khóa học "Ultimate AWS Certified Solutions Architect Associate" của Stephane Maarek trên Udemy. Thầy giảng rất dễ hiểu, có bài tập thực hành theo từng bài.
- Sử dụng tài khoản AWS Free Tier để tự tay tạo máy ảo EC2, cấu hình VPC, tạo S3 bucket, cài đặt RDS và cấu hình Application Load Balancer. Không gì dễ nhớ bằng việc tự làm!

2. Giai đoạn luyện đề (1 tháng cuối):
- Mua bộ đề Mock Exam của Jon Bonso (Tutorials Dojo). Đây là bộ đề sát với format thi thật nhất hiện nay.
- Làm đề lần 1 ghi chú lại toàn bộ các câu hỏi sai. Đọc kỹ phần giải thích chi tiết vì sao đáp án A đúng, vì sao đáp án B/C/D sai.
- Đạt điểm đều đặn trên 80% ở các đề thi thử là có thể tự tin đặt lịch thi thật tại trung tâm khảo thí hoặc thi online tại nhà.`,
  },
  {
    id_key: 'post-study-06',
    topic: 'Học tập',
    title:
      'Cách ghi chú bài giảng bằng Notion và Obsidian để ôn thi cuối kỳ không bị quá tải',
    author_email: authorMap.ngocanh,
    relative_hours: 345,
    content: `Trước đây mỗi mùa thi cuối kỳ đến là mình ngập trong đống vở viết tay lộn xộn hoặc hàng chục file Word lưu rải rác trên máy tính. Từ khi chuyển sang xây dựng hệ thống ghi chú cá nhân bằng Notion và Obsidian, việc ôn tập trở nên nhẹ nhàng hơn rất nhiều.

Một số kinh nghiệm mình áp dụng:

1. Sử dụng Notion cho quản lý lịch trình môn học:
- Tạo một Database tổng hợp tất cả các môn trong học kỳ: thời khóa biểu, tiêu chí đánh giá điểm (% chuyên cần, % giữa kỳ, % cuối kỳ), link tài liệu bài giảng và hạn nộp bài tập lớn.
- Sử dụng Kanban Board để theo dõi bài tập theo trạng thái: Cần làm -> Đang làm -> Đã nộp.

2. Sử dụng Obsidian cho ghi chú kiến thức liên kết:
- Áp dụng phương pháp Zettelkasten: Viết các mẩu ghi chú ngắn gọn (Atomic Notes) về từng định nghĩa hoặc công thức.
- Tận dụng tính năng Backlink [[Tên khái niệm]] để liên kết các bài học lại với nhau. Khi xem đồ thị liên kết (Graph View), bạn sẽ thấy các môn học bổ trợ cho nhau rất rõ ràng.

Nhờ hệ thống này mà trước kỳ thi mình chỉ cần mở các trang tổng hợp ra ôn lại là nắm chắc 80% kiến thức trọng tâm!`,
  },
  {
    id_key: 'post-study-07',
    topic: 'Học tập',
    title:
      'Sinh viên ngành kinh tế/kinh doanh số cần trang bị những kỹ năng phân tích dữ liệu nào?',
    author_email: authorMap.ha,
    relative_hours: 370,
    content: `Trong thời đại kinh tế số, nhà tuyển dụng các ngành Marketing, Tài chính, Chuỗi cung ứng ngày càng ưu tiên những ứng viên có tư duy dựa trên dữ liệu (Data-driven mindset) thay vì chỉ dựa vào cảm tính.

Các bạn sinh viên kinh tế nên ưu tiên học những công cụ sau:

1. Microsoft Excel mức độ nâng cao:
- Không chỉ dừng lại ở SUM, AVERAGE. Hãy làm chủ VLOOKUP/XLOOKUP, INDEX-MATCH, Pivot Table và đặc biệt là công cụ Power Query để tự động hóa việc dọn dẹp số liệu.

2. SQL căn bản:
- Biết viết các câu lệnh SELECT lọc dữ liệu, JOIN nhiều bảng để tự trích xuất dữ liệu bán hàng hoặc thông tin khách hàng từ hệ thống mà không cần phụ thuộc vào IT.

3. Công cụ trực quan hóa (PowerBI / Tableau):
- Biết cách kết nối nguồn dữ liệu, xây dựng các biểu đồ KPI tương tác và tạo báo cáo kinh doanh trực quan giúp ban lãnh đạo dễ dàng đưa ra quyết định.

Chỉ cần trang bị tốt 3 kỹ năng này, cơ hội nhận offer thực tập của bạn sẽ cao hơn rất nhiều so với mặt bằng chung!`,
  },
  {
    id_key: 'post-study-08',
    topic: 'Học tập',
    title:
      'Kinh nghiệm xin học bổng khuyến khích học tập kỳ vừa rồi và chiến lược duy trì GPA trên 3.6',
    author_email: authorMap.linh,
    relative_hours: 395,
    content: `Kỳ vừa rồi mình may mắn nhận được Học bổng Khuyến khích học tập loại Xuất sắc của trường. Mình xin chia sẻ một số bí quyết giúp giữ vững phong độ điểm số trong suốt các học kỳ:

1. Chiến lược đăng ký tín chỉ:
- Không nên đăng ký quá nhiều môn nặng trong cùng một kỳ. Cân đối giữa các môn đại cương/lý thuyết với các môn thực hành/đồ án.
- Tìm hiểu trước giảng viên bộ môn và format đề thi của các khóa trước để có sự chuẩn bị tâm lý phù hợp.

2. Tối đa hóa điểm thành phần (Điểm quá trình):
- Điểm chuyên cần, bài tập trên lớp và điểm giữa kỳ thường chiếm từ 40% đến 50% tổng điểm môn học. Đây là phần điểm bạn hoàn toàn có thể kiểm soát và đạt điểm 9-10 nếu đi học đầy đủ và nộp bài đúng hạn.
- Đạt điểm quá trình cao sẽ giúp bạn giảm bớt áp lực rất nhiều khi bước vào kỳ thi cuối kỳ.

3. Điểm rèn luyện (ĐRL):
- Để xét học bổng, ĐRL tối thiểu phải từ loại Tốt trở lên (≥ 80 điểm).
- Hãy tích cực tham gia các buổi hội thảo học thuật, ngày hội việc làm, hoạt động tình nguyện do Đoàn - Hội sinh viên tổ chức để tích lũy đủ minh chứng ngay từ đầu kỳ!`,
  },

  // --- TOPIC: Thực tập (8 posts) ---
  {
    id_key: 'post-intern-01',
    topic: 'Thực tập',
    title: 'Nên chuẩn bị gì trước kỳ thực tập doanh nghiệp đầu tiên?',
    author_email: authorMap.tri,
    relative_hours: 48, // 2 days ago (Matches Homepage Card 3)
    content: `Chào mọi người! Tuần sau nhiều bạn sinh viên năm 3 bắt đầu bước vào kỳ thực tập doanh nghiệp đầu tiên. Lần đầu đi làm trong môi trường công sở chắc chắn ai cũng có cảm giác bỡ ngỡ và lo lắng. Dưới đây là 5 điều cốt lõi mình đúc kết được sau kỳ thực tập vừa rồi:

1. Kỹ năng giao tiếp và tác phong làm việc:
- Đi làm đúng giờ (tốt nhất nên đến trước 10-15 phút trong tuần đầu).
- Luôn kiểm tra kỹ email và tin nhắn công việc trên Slack/Teams/Zalo. Tập thói quen phản hồi tin nhắn (dù chỉ là thả icon xác nhận đã đọc) để đồng đội biết bạn đã nắm thông tin.

2. Quy chuẩn kỹ thuật (Git Workflow):
- Đọc kỹ quy định commit message của dự án (Conventional Commits: feat, fix, docs, refactor...).
- Luôn tạo branch riêng khi làm task, tuyệt đối không commit thẳng lên main/develop. Kéo code mới nhất về trước khi tạo Pull Request để giải quyết xung đột (conflict) từ sớm.

3. Văn hóa đặt câu hỏi thông minh:
- Áp dụng quy tắc 15-30 phút: Khi gặp lỗi hoặc vướng mắc, hãy tự tra cứu tài liệu, Google và debug trong 15-30 phút trước.
- Nếu vẫn bế tắc, hãy hỏi mentor với cấu trúc rõ ràng: "Em đang làm tính năng A, gặp lỗi B, em đã thử cách C và D nhưng kết quả ra E. Anh/chị gợi ý giúp em hướng xử lý tiếp theo với ạ".

4. Luôn mang theo sổ tay hoặc mở sẵn app ghi chú:
- Mỗi khi mentor hoặc sếp hướng dẫn công việc, hãy ghi chép cẩn thận. Tránh để người khác phải nhắc lại một hướng dẫn giống nhau đến lần thứ ba.

5. Tinh thần chủ động và trung thực:
- Nếu làm xong task sớm, hãy chủ động báo với mentor để nhận thêm việc hoặc hỗ trợ đồng nghiệp. Nếu cảm thấy task quá khó hoặc có nguy cơ trễ hạn, hãy thông báo sớm nhất có thể chứ đừng giấu giếm đến sát giờ nộp.

Chúc tất cả các bạn có một kỳ thực tập bổ ích và học hỏi được thật nhiều kinh nghiệm thực tế nhé!`,
  },
  {
    id_key: 'post-intern-02',
    topic: 'Thực tập',
    title:
      'Làm thế nào để viết CV ứng tuyển thực tập khi chưa có kinh nghiệm làm việc thực tế?',
    author_email: authorMap.quynhanh,
    relative_hours: 420,
    content: `Một trong những rào cản lớn nhất của sinh viên khi tìm kỳ thực tập đầu đời là: "Nhà tuyển dụng đòi kinh nghiệm, nhưng không ai nhận thực tập thì lấy đâu ra kinh nghiệm?".

Thực tế, với vị trí Intern, các nhà tuyển dụng không kỳ vọng bạn đã từng đi làm full-time ở đâu cả. Họ đánh giá tiềm năng qua các yếu tố sau:

1. Làm nổi bật các Đồ án môn học & Dự án cá nhân (Projects):
- Mô tả dự án theo cấu trúc: Bài toán cần giải quyết -> Công nghệ sử dụng -> Kết quả đạt được (nếu có số liệu đo lường cụ thể thì càng tốt).
- Kèm link demo chạy thử hoặc link GitHub sạch đẹp.

2. Hoạt động ngoại khóa và Câu lạc bộ:
- Tham gia ban tổ chức sự kiện, ban truyền thông, hay làm trưởng nhóm bài tập lớn đều chứng minh bạn có kỹ năng làm việc nhóm, kỹ năng giao tiếp và khả năng quản lý thời gian.

3. Kỹ năng phù hợp với bản mô tả công việc (Job Description):
- Đọc kỹ các yêu cầu trong JD của công ty và điều chỉnh từ khóa trong CV sao cho tương thích.

4. Hình thức trình bày CV:
- Giữ CV trong đúng 1 trang A4 duy nhất. Sử dụng font chữ chuyên nghiệp, căn lề thẳng hàng, không có lỗi chính tả tiếng Việt hoặc ngữ pháp tiếng Anh!`,
  },
  {
    id_key: 'post-intern-03',
    topic: 'Thực tập',
    title:
      'Sự khác biệt giữa thực tập tại Startup và Tập đoàn lớn: Sinh viên nên chọn môi trường nào?',
    author_email: authorMap.thao,
    relative_hours: 445,
    content: `Khi nhận được lời mời thực tập từ cả một công ty Startup quy mô nhỏ và một Tập đoàn đa quốc gia lớn, bạn nên cân nhắc những yếu tố nào?

1. Môi trường Startup (Quy mô 10 - 50 người):
- Ưu điểm: Tốc độ phát triển cực nhanh, bạn được tham gia trực tiếp vào sản phẩm thật ngay từ tuần đầu, được tiếp xúc thường xuyên với Founder/CTO, công việc đa dạng không bị gò bó.
- Nhược điểm: Quy trình làm việc chưa chuẩn hóa, ít tài liệu hướng dẫn bài bản, mentor có thể rất bận rộn nên bạn phải có tính tự học và thích nghi cực cao.
- Phù hợp với: Các bạn năng động, thích thử thách, chịu được áp lực cao và muốn trải nghiệm toàn diện quy trình làm ra sản phẩm.

2. Môi trường Tập đoàn lớn (Corporation):
- Ưu điểm: Tên tuổi thương hiệu uy tín làm đẹp CV, quy trình làm việc chuyên nghiệp chuẩn quốc tế, có lộ trình đào tạo bài bản cho thực tập sinh, chế độ phúc lợi rõ ràng.
- Nhược điểm: Phạm vi công việc thường chuyên biệt hóa sâu, quy trình phê duyệt nhiều cấp bậc nên đôi khi tốc độ ra mắt tính năng chậm hơn.
- Phù hợp với: Các bạn muốn học hỏi quy trình chuẩn mực, xây dựng mạng lưới quan hệ rộng và hướng tới sự ổn định lâu dài.

Tùy vào tính cách và mục tiêu nghề nghiệp ở từng giai đoạn mà các bạn hãy đưa ra quyết định phù hợp nhất nhé!`,
  },
  {
    id_key: 'post-intern-04',
    topic: 'Thực tập',
    title:
      'Kinh nghiệm xin dấu thực tập tốt nghiệp và cách hoàn thiện báo cáo thực tập đạt điểm cao',
    author_email: authorMap.ngocanh,
    relative_hours: 470,
    content: `Cuối kỳ thực tập tốt nghiệp, hai nỗi lo lớn nhất của sinh viên là: xin dấu mộc xác nhận của công ty và viết cuốn Báo cáo thực tập nộp cho khoa.

Một số lưu ý quan trọng để không bị trừ điểm oan:

1. Quy tắc bảo mật thông tin doanh nghiệp (NDA):
- Tuyệt đối không đưa số liệu tài chính nhạy cảm, mã nguồn mật, thông tin khách hàng hoặc mật khẩu hệ thống vào báo cáo thực tập.
- Hãy chủ động gửi bản thảo báo cáo cho mentor hoặc phòng Nhân sự duyệt qua trước khi in ấn nộp cho trường.

2. Cấu trúc báo cáo chuẩn mực:
- Chương 1: Giới thiệu tổng quan về đơn vị thực tập (lịch sử, cơ cấu tổ chức, lĩnh vực hoạt động).
- Chương 2: Nội dung công việc thực tế được phân công và quy trình thực hiện.
- Chương 3: Kết quả đạt được, bài học kinh nghiệm và đề xuất giải pháp cải tiến cho doanh nghiệp.

3. Giữ mối quan hệ tốt với người hướng dẫn tại cơ sở:
- Khi gửi phiếu đánh giá thực tập để mentor chấm điểm và ký tên, hãy chuẩn bị trước các thông tin cần thiết, gửi kèm lời cảm ơn chân thành vì sự giúp đỡ của anh/chị trong suốt thời gian qua.`,
  },
  {
    id_key: 'post-intern-05',
    topic: 'Thực tập',
    title:
      'Có nên nhận offer thực tập không lương hoặc hỗ trợ thấp để đổi lấy kinh nghiệm không?',
    author_email: authorMap.dat,
    relative_hours: 495,
    content: `Vấn đề thực tập không lương (Unpaid Internship) luôn là chủ đề gây nhiều tranh luận trong cộng đồng sinh viên. Mình xin chia sẻ góc nhìn cá nhân để các bạn cân nhắc khi đứng trước quyết định này:

Khi nào có thể tạm chấp nhận hỗ trợ thấp/không lương:
- Công ty có chương trình đào tạo cực kỳ bài bản, cam kết mentor kèm 1:1 hàng ngày và nội dung học tập tương đương một khóa đào tạo chuyên nghiệp.
- Bạn chưa có bất kỳ dự án thực tế nào và đang cần một bước đệm đầu tiên để tích lũy kinh nghiệm trong thời gian ngắn (1-2 tháng).

Dấu hiệu cảnh báo (Red Flags) cần tránh xa:
- Giao khối lượng công việc tương đương một nhân viên chính thức nhưng không có bất kỳ khoản phụ cấp nào (kể cả tiền gửi xe, ăn trưa).
- Không có ai hướng dẫn chuyên môn, bị giao những việc vặt không liên quan đến ngành học (pha trà, in tài liệu, chạy việc vặt cá nhân).
- Kéo dài thời gian thực tập không lương quá 3 tháng mà không có cam kết đánh giá lên chính thức.

Hãy luôn nhớ rằng chất xám và thời gian của sinh viên cũng xứng đáng được tôn trọng và đền đáp công bằng!`,
  },
  {
    id_key: 'post-intern-06',
    topic: 'Thực tập',
    title:
      'Cách tạo ấn tượng tốt trong tuần đầu tiên Onboarding tại doanh nghiệp công nghệ',
    author_email: authorMap.kiet,
    relative_hours: 520,
    content: `Tuần đầu tiên đi làm (Onboarding) là thời điểm vàng để bạn định hình hình ảnh chuyên nghiệp trong mắt đồng nghiệp và quản lý.

Checklist những việc nên làm trong 5 ngày đầu:

1. Ngày 1 & 2: Thiết lập môi trường làm việc:
- Hoàn tất cài đặt các công cụ, phần mềm cần thiết theo tài liệu hướng dẫn Onboarding của team.
- Đọc kỹ tài liệu kiến trúc hệ thống (Architecture documentation) và các quy chuẩn code (Coding guidelines).
- Nếu tài liệu có chỗ nào bị out-of-date (cũ, chạy lỗi), hãy ghi chú lại và chủ động đề xuất cập nhật tài liệu. Đây là điểm cộng rất lớn!

2. Ngày 3 & 4: Chủ động kết nối:
- Đi ăn trưa cùng mọi người trong team để hiểu thêm về văn hóa công ty ngoài công việc.
- Lên danh sách những câu hỏi thắc mắc về luồng nghiệp vụ của sản phẩm để xin một buổi trao đổi 30 phút với mentor.

3. Ngày 5: Tổng kết tuần đầu tiên:
- Gửi một email hoặc tin nhắn ngắn cho mentor tóm tắt những việc bạn đã hoàn thành trong tuần và kế hoạch công việc cho tuần tiếp theo.`,
  },
  {
    id_key: 'post-intern-07',
    topic: 'Thực tập',
    title:
      'Xử lý thế nào khi mentor quá bận và không có thời gian hướng dẫn công việc cho thực tập sinh?',
    author_email: authorMap.bao,
    relative_hours: 545,
    content: `Thực tế tại các công ty là các anh chị Senior/Lead vừa phải gánh deadline dự án căng thẳng, vừa phải tham gia nhiều cuộc họp nên đôi khi không thể ngồi kèm bạn từng chút một. Nếu rơi vào hoàn cảnh này, bạn nên xử lý thế nào để không bị "bỏ rơi"?

1. Tôn trọng thời gian của mentor:
- Thay vì cứ 15 phút lại quay sang hỏi một câu lắt nhắt làm đứt mạch làm việc của anh/chị, hãy gom các câu hỏi lại vào một file ghi chú và hẹn một khung giờ cố định (ví dụ 16h30 mỗi ngày) để hỏi một lượt.

2. Luôn mang theo phương án khi hỏi:
- Đừng hỏi câu hỏi mở: "Anh ơi em phải làm thế nào?". Hãy hỏi: "Em thấy bài toán này có 2 hướng giải quyết A và B. Em thấy hướng A tối ưu hơn về mặt tốc độ nhưng hướng B dễ bảo trì hơn, theo anh em nên triển khai theo hướng nào ạ?".

3. Tìm kiếm sự trợ giúp từ các đồng nghiệp khác:
- Trong team thường có các anh chị Junior hoặc bạn thực tập sinh vào trước, họ có thể giải đáp rất nhanh những thắc mắc cơ bản về môi trường hoặc quy trình nộp task.`,
  },
  {
    id_key: 'post-intern-08',
    topic: 'Thực tập',
    title:
      'Bí quyết chuyển từ vị trí Intern lên Chính thức (Full-time) sau kỳ thực tập 3 tháng',
    author_email: authorMap.hoang,
    relative_hours: 570,
    content: `Mục tiêu lớn nhất của hầu hết các bạn sinh viên khi đi thực tập là được giữ lại làm nhân viên chính thức (hoặc Fresher). Sau 3 tháng thực tập và vừa nhận được offer Full-time, mình xin rút ra 4 bài học quan trọng:

1. Thể hiện quyền sở hữu công việc (Ownership):
- Đừng làm việc như một người được bảo gì làm nấy. Hãy chủ động theo dõi tính năng mình làm từ lúc bắt đầu code, kiểm thử, deploy lên môi trường staging, cho đến khi chạy ổn định trên production.
- Nếu phát hiện bug tiềm ẩn, hãy chủ động báo cáo và đề xuất giải pháp xử lý.

2. Chủ động xin Feedback định kỳ:
- Đừng đợi đến ngày cuối cùng của kỳ thực tập mới hỏi xem mình làm việc thế nào. Sau mỗi tháng, hãy chủ động xin 15 phút trao đổi với mentor: "Anh thấy trong tháng vừa qua em làm tốt điểm nào và có điểm nào cần cải thiện thêm không ạ?". Việc này giúp bạn sửa sai kịp thời.

3. Đóng góp tích cực cho văn hóa team:
- Tham gia đầy đủ các buổi họp retro, chia sẻ kiến thức (Tech Talk) và không ngại nhận những công việc khó mà người khác còn e ngại.

4. Đề xuất nguyện vọng rõ ràng:
- Trước khi kết thúc thực tập 3-4 tuần, hãy chủ động trao đổi với quản lý về mong muốn gắn bó lâu dài cùng công ty để họ kịp thời chuẩn bị ngân sách và thủ tục tuyển dụng!`,
  },
];

// Helper to generate comments
// Post 1 (id_key: 'post-interview-01') must have EXACTLY 18 comments.
// Post 9 (id_key: 'post-study-01') must have EXACTLY 32 comments.
// Post 17 (id_key: 'post-intern-01') must have EXACTLY 14 comments.
// All other 21 posts must have 1-5 comments.

const comments = [
  // ==========================================
  // POST 1: Software Intern Interview (18 COMMENTS)
  // ==========================================
  {
    post_key: 'post-interview-01',
    author_email: authorMap.long,
    minutes_after: 5,
    content:
      'Bài viết rất chi tiết và bổ ích! Bạn cho mình hỏi thêm là lúc phỏng vấn Live Coding thì phía công ty cho dùng ngôn ngữ tự chọn (Java/C++/JavaScript/Python) hay bắt buộc phải dùng đúng ngôn ngữ của dự án tuyển dụng vậy bạn?',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.hoang,
    minutes_after: 10,
    content:
      '@Vũ Hoàng Long Hầu hết các vòng Live Coding thuật toán đều cho phép ứng viên tự chọn ngôn ngữ mà mình tự tin nhất bạn nhé. Mình dùng TypeScript vì đã quen thuộc với cú pháp, interviewer chủ yếu đánh giá tư duy thuật toán và cách bạn tổ chức code chứ không bắt bẻ ngôn ngữ đâu.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.mai,
    minutes_after: 16,
    content:
      'Chúc mừng Hoàng nhé! Cho mình hỏi phần câu hỏi về Index trong MySQL họ thường hỏi sâu đến mức nào thế bạn? Có hỏi về Composite Index hay B-Tree không?',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.hoang,
    minutes_after: 22,
    content:
      '@Trần Mai Họ hỏi nguyên lý B-Tree Index hoạt động thế nào, tại sao đánh index giúp tăng tốc SELECT nhưng lại làm chậm INSERT/UPDATE, và quy tắc Leftmost Prefix trong Composite Index đó bạn.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.dat,
    minutes_after: 29,
    content:
      'Cảm ơn anh đã chia sẻ. Cho em hỏi sinh viên năm 2 đang muốn đi thực tập sớm thì có bị rào cản nhiều về mặt kiến thức so với năm 3 không ạ?',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.tri,
    minutes_after: 35,
    content:
      'Mình thấy năm 2 nếu bạn đã nắm chắc OOP và có 1-2 dự án web/mobile hoàn chỉnh thì hoàn toàn tự tin nộp đơn được rồi Đạt ơi. Nhiều công ty rất thích các bạn năm 2 có tinh thần chủ động học hỏi sớm.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.kiet,
    minutes_after: 42,
    content:
      'Về phần RESTful API design họ có bắt thiết kế chuẩn status code hay xử lý Authentication/Authorization không Hoàng ơi?',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.hoang,
    minutes_after: 48,
    content:
      '@Đặng Tuấn Kiệt Có bạn nhé! Họ đưa ra một bài toán thiết kế API cho hệ thống giỏ hàng, hỏi sự khác nhau giữa PUT và PATCH, khi nào trả 401 Unauthorized và khi nào trả 403 Forbidden.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.linh,
    minutes_after: 55,
    content:
      'Bài viết truyền cảm hứng rất nhiều cho các bạn chuẩn bị đi thực tập. Chúc bạn có một kỳ thực tập thật rực rỡ và sớm lên chính thức nhé!',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.quynhanh,
    minutes_after: 61,
    content:
      'Kỹ thuật STAR trả lời phỏng vấn HR công nhận hiệu quả thật sự, mình bên ngành Marketing áp dụng thấy nhà tuyển dụng gật gù lắng nghe hẳn.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.bao,
    minutes_after: 68,
    content:
      'Cho mình hỏi lúc làm bài test HackerRank thì điểm số tầm bao nhiêu phần trăm test cases pass là được qua vòng vậy bạn?',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.hoang,
    minutes_after: 74,
    content:
      '@Trần Quốc Bảo Đợt mình thi có 3 bài, mình pass full 2 bài đầu còn bài cuối bị dính Time Limit Exceeded mất 3 test cases biên, nhưng tổng quan vẫn được khoảng 85% điểm là được liên hệ vào vòng tiếp theo rồi bạn.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.ha,
    minutes_after: 80,
    content:
      'Bạn Hoàng ôn LeetCode trong bao lâu trước khi bắt đầu nộp CV thế?',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.hoang,
    minutes_after: 85,
    content:
      '@Phan Thanh Hà Mình duy trì thói quen mỗi ngày giải 1-2 bài trong khoảng 2 tháng bạn ạ. Quan trọng là hiểu rõ bản chất của từng dạng bài (Sliding Window, Binary Search, DFS/BFS) chứ không cần cày số lượng quá nhiều.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.thao,
    minutes_after: 92,
    content:
      'Ghi chú lại ngay để chuẩn bị cho đợt tuyển dụng sắp tới. Cảm ơn bạn vì bài chia sẻ rất có tâm!',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.ngocanh,
    minutes_after: 98,
    content:
      'Chúc mừng bạn nhé, đọc bài viết thấy bạn chuẩn bị kỹ lưỡng như vậy thì việc đỗ offer là hoàn toàn xứng đáng!',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.long,
    minutes_after: 104,
    content:
      'Đồng ý với quan điểm "Think Out Loud". Lúc mình làm interviewer phụ, những bạn biết giải thích mạch lạc suy nghĩ luôn tạo thiện cảm hơn hẳn những bạn chỉ cắm đầu gõ code trong im lặng.',
  },
  {
    post_key: 'post-interview-01',
    author_email: authorMap.hoang,
    minutes_after: 110,
    content:
      'Cảm ơn mọi người nhiều nhé! Hy vọng những chia sẻ này giúp các bạn tự tin hơn khi bước vào phòng phỏng vấn.',
  },

  // ==========================================
  // POST 9: TOEIC & Graduation Project (32 COMMENTS)
  // ==========================================
  {
    post_key: 'post-study-01',
    author_email: authorMap.hoang,
    minutes_after: 15,
    content:
      'Khâm phục Mai quá! Mình đang làm đồ án chuyên ngành mà nhiều hôm thức đến 2h sáng nên sáng hôm sau không thể dậy nổi để học tiếng Anh.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 25,
    content:
      '@Nguyễn Hoàng Trước đây mình cũng hay thức khuya lắm, nhưng sau đó nhận ra thức khuya code dễ sinh bug mà hôm sau người lờ đờ cả ngày. Chuyển sang ngủ trước 23h30 rồi dậy lúc 6h thấy năng lượng học tập khác hẳn luôn ấy.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.tri,
    minutes_after: 35,
    content:
      'Bạn dùng app Anki để học từ vựng TOEIC theo bộ flashcard nào thế Mai? Có thể chia sẻ link hoặc tên bộ từ vựng cho mình xin với được không?',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 45,
    content:
      '@Lê Trí Mình học bộ "600 Essential Words for the TOEIC" có sẵn trên AnkiWeb, kết hợp tự tạo thêm các từ vựng mới rút ra từ các câu làm sai trong đề ETS bạn nhé.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.linh,
    minutes_after: 55,
    content:
      'TOEIC 850 là điểm số mơ ước của sinh viên khối ngành tụi mình luôn á! Ngưỡng mộ bạn ghê.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.dat,
    minutes_after: 68,
    content:
      'Cho em hỏi phần Listening Part 3 và Part 4 có mẹo gì để vừa nghe vừa đọc trước câu hỏi kịp không chị?',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 78,
    content:
      '@Bùi Văn Đạt Mẹo quan trọng nhất là tận dụng thời gian băng đọc phần hướng dẫn (Directions) để đọc lướt trước câu hỏi và các phương án lựa chọn của 3 câu đầu tiên. Khi người ta đọc đến câu hỏi nào là tay phải đánh dấu xong đáp án câu đó và mắt bắt đầu chuyển sang đọc trước cụm câu hỏi tiếp theo rồi.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.quynhanh,
    minutes_after: 90,
    content:
      'Cách chia Sprint đồ án theo tuần trên Trello hay thật, nhóm mình kỳ này cũng đang bị chậm tiến độ vì không phân chia deadline rõ ràng.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.thao,
    minutes_after: 105,
    content:
      'Đồng ý với Mai, họp Daily Standup 10 phút đầu tuần giải quyết được bao nhiêu sự cố hiểu lầm giữa các thành viên trong nhóm luôn.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.long,
    minutes_after: 120,
    content:
      'Đề ETS gần đây có nhiều bẫy từ đồng nghĩa (Paraphrasing) trong Part 7 không bạn?',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 135,
    content:
      '@Vũ Hoàng Long Rất nhiều luôn bạn ơi! Hầu như các câu hỏi suy luận đều dùng từ đồng nghĩa chứ không bao giờ lặp lại y nguyên từ xuất hiện trong bài đọc đâu, nên việc tích lũy cụm từ vựng tương đương là chìa khóa then chốt.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.kiet,
    minutes_after: 150,
    content:
      'Bài viết chia sẻ rất khoa học. Chúc mừng bạn đã đạt kết quả xuất sắc cả hai mục tiêu!',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.ngocanh,
    minutes_after: 165,
    content:
      'Mình đang định thi TOEIC vào tháng tới, bài viết này đúng lúc tiếp thêm nhiều động lực cho mình luôn.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.ha,
    minutes_after: 180,
    content:
      'Lúc làm đề bấm giờ full 2 tiếng bạn có cảm thấy bị mỏi mắt hay đuối sức ở những bài đọc cuối cùng không?',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 195,
    content:
      '@Phan Thanh Hà Những lần đầu giải đề mình cũng bị đau đầu và mất tập trung ở 20 câu cuối lắm. Nhưng luyện khoảng 4-5 đề full là não bộ quen với cường độ tập trung 120 phút liên tục, đi thi thật sẽ thấy rất bình thường.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.bao,
    minutes_after: 210,
    content:
      'Cảm ơn bạn Mai nhiều nhé. Phương pháp Pomodoro kết hợp Time-blocking này mình sẽ thử áp dụng ngay từ tuần này.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.hoang,
    minutes_after: 225,
    content:
      'Một kinh nghiệm rất đáng giá cho các bạn sinh viên chuẩn bị ra trường cần chuẩn đầu ra ngoại ngữ.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.linh,
    minutes_after: 240,
    content:
      'Nhóm bạn Mai làm đồ án về đề tài gì thế? Có áp dụng công nghệ mới nào không?',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 255,
    content:
      '@Đoàn Khánh Linh Nhóm mình làm về hệ thống quản lý học tập kết hợp theo dõi lộ trình kỹ năng cho sinh viên, dùng React, Node.js và MySQL đó bạn.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.tri,
    minutes_after: 270,
    content: 'Nghe đề tài hấp dẫn và thực tế quá, bảo sao thầy cô chấm điểm A!',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.dat,
    minutes_after: 290,
    content:
      'Chị Mai ơi, tài liệu ETS 2024 có khác nhiều so với các bộ ETS trước không ạ?',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 305,
    content:
      '@Bùi Văn Đạt Giọng đọc trong ETS mới có thêm nhiều ngữ điệu đa dạng hơn (giọng Anh, Úc, Mỹ) và các chủ đề công sở hiện đại hơn (làm việc từ xa, họp trực tuyến), em nên ưu tiên luyện bộ ETS mới nhất nhé.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.quynhanh,
    minutes_after: 325,
    content: 'Cảm ơn bài viết bổ ích của Mai, mình đã bookmark lại rồi.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.long,
    minutes_after: 345,
    content:
      'Kỷ luật bản thân là yếu tố quan trọng nhất. Nhìn lịch trình của bạn Mai là thấy tính tự giác rất cao rồi.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.thao,
    minutes_after: 365,
    content:
      'Các bạn sinh viên năm 3 rất nên đọc bài này để tránh tình trạng "nước đến chân mới nhảy".',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.kiet,
    minutes_after: 385,
    content:
      'Mong bạn chia sẻ thêm nhiều bài viết về phương pháp tự học trong thời gian tới nhé!',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.ngocanh,
    minutes_after: 405,
    content:
      'Rất ngưỡng mộ bạn Mai, bài viết được viết rất chỉn chu và tâm huyết.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.ha,
    minutes_after: 425,
    content:
      'Mình vừa tải app Anki về theo gợi ý của bạn, hy vọng cải thiện được vốn từ vựng tiếng Anh.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.bao,
    minutes_after: 445,
    content: 'Một bài viết xuất sắc cho cộng đồng sinh viên UniHub!',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.linh,
    minutes_after: 465,
    content:
      'Chúc Mai tiếp tục gặt hái thêm nhiều thành công trong kỳ thực tập sắp tới nhé.',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.tri,
    minutes_after: 485,
    content: 'Cảm ơn bạn đã truyền cảm hứng học tập cho mọi người!',
  },
  {
    post_key: 'post-study-01',
    author_email: authorMap.mai,
    minutes_after: 505,
    content:
      'Cảm ơn tất cả mọi người đã quan tâm và để lại những lời động viên ý nghĩa! Chúc cả nhà cùng nhau vượt qua mùa thi cử và đồ án thật thành công rực rỡ!',
  },

  // ==========================================
  // POST 17: Internship Preparation (14 COMMENTS)
  // ==========================================
  {
    post_key: 'post-intern-01',
    author_email: authorMap.hoang,
    minutes_after: 20,
    content:
      'Bài viết rất đúng thực tế! Đặc biệt là phần quy tắc 15-30 phút tự tìm hiểu trước khi hỏi mentor. Nhiều bạn mới vào cứ hễ gặp lỗi là gọi mentor ngay khiến người hướng dẫn rất dễ mất tập trung.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.tri,
    minutes_after: 35,
    content:
      '@Nguyễn Hoàng Đúng rồi bạn, hỏi có chọn lọc và mang theo các giải pháp mình đã thử nghiệm luôn được các anh chị Senior đánh giá rất cao về tinh thần chủ động.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.mai,
    minutes_after: 50,
    content:
      'Cho mình hỏi về trang phục đi làm ở các công ty công nghệ thì thế nào Trí ơi? Có cần mặc sơ mi quần tây nghiêm túc không hay mặc áo thun quần jeans lịch sự là được?',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.tri,
    minutes_after: 65,
    content:
      '@Trần Mai Ở hầu hết các công ty công nghệ hiện nay văn hóa trang phục khá thoải mái (Smart Casual), bạn chỉ cần mặc áo thun có cổ hoặc không cổ nhưng lịch sự, quần jeans và mang giày thể thao là hoàn toàn phù hợp. Riêng ngày đầu tiên thì nên mặc áo có cổ để tạo ấn tượng chỉn chu nhé!',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.linh,
    minutes_after: 80,
    content:
      'Bên khối ngành Tài chính - Ngân hàng của tụi mình thì quy định trang phục nghiêm ngặt hơn, nam sơ mi cà vạt còn nữ mặc công sở trang nhã.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.quynhanh,
    minutes_after: 100,
    content:
      'Cái vụ sổ tay ghi chép chuẩn không cần chỉnh luôn! Lúc mới vào việc gì cũng mới, không ghi lại là đến chiều quên sạch sẽ ngay.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.long,
    minutes_after: 120,
    content:
      'Lưu ý thêm các bạn là nhớ đọc kỹ quy định bảo mật thông tin (NDA) của dự án nhé. Tuyệt đối không chụp ảnh màn hình code công ty đăng lên mạng xã hội hay copy code dự án ra USB cá nhân.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.dat,
    minutes_after: 140,
    content:
      'Anh Trí cho em hỏi nếu tuần đầu tiên mentor chưa giao task gì nhiều mà chỉ bảo ngồi đọc tài liệu thì mình nên làm gì để không bị chán ạ?',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.tri,
    minutes_after: 160,
    content:
      '@Bùi Văn Đạt Em hãy tận dụng thời gian này để tìm hiểu thật sâu luồng nghiệp vụ của hệ thống, clone source code về máy chạy thử, đọc các commit gần nhất xem cách các anh chị giải quyết bug thế nào. Khi nắm vững bối cảnh dự án thì đến lúc nhận task thật em sẽ làm rất nhanh.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.kiet,
    minutes_after: 180,
    content:
      'Về Git Workflow, khuyên các bạn nên nắm vững lệnh git rebase và cách giải quyết merge conflicts trước khi đi làm, đỡ bỡ ngỡ rất nhiều.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.thao,
    minutes_after: 200,
    content:
      'Tinh thần chịu học hỏi và lắng nghe góp ý (Feedback) là phẩm chất số 1 mà các nhà quản lý tìm kiếm ở một bạn thực tập sinh.',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.bao,
    minutes_after: 220,
    content:
      'Tuần sau mình cũng bắt đầu đi thực tập ở QTSC, đọc được bài này cảm thấy tự tin hơn hẳn. Cảm ơn Trí nhé!',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.ha,
    minutes_after: 240,
    content:
      'Chúc tất cả các bạn sinh viên có một kỳ thực tập an toàn, thuận lợi và tích lũy được nhiều kinh nghiệm thực tế quý giá!',
  },
  {
    post_key: 'post-intern-01',
    author_email: authorMap.tri,
    minutes_after: 260,
    content:
      'Cảm ơn mọi người nhiều! Cứ tự tin, chăm chỉ và giữ thái độ tích cực là chắc chắn sẽ hoàn thành xuất sắc kỳ thực tập thôi các bạn ơi!',
  },

  // ==========================================
  // OTHER 21 POSTS (1-5 COMMENTS EACH)
  // ==========================================

  // Post 2: BA Intern Interview (3 comments)
  {
    post_key: 'post-interview-02',
    author_email: authorMap.ha,
    minutes_after: 30,
    content:
      'Bài tổng hợp câu hỏi BA rất chi tiết! Cho mình hỏi phần bài test Case Study tại chỗ họ thường cho thời gian chuẩn bị bao lâu vậy bạn?',
  },
  {
    post_key: 'post-interview-02',
    author_email: authorMap.linh,
    minutes_after: 45,
    content:
      '@Phan Thanh Hà Thường là 15-20 phút bạn nhé. Người ta chuẩn bị sẵn giấy bút hoặc laptop cho mình phác thảo nhanh mô hình và giải pháp, sau đó trình bày trong 5-7 phút.',
  },
  {
    post_key: 'post-interview-02',
    author_email: authorMap.tri,
    minutes_after: 60,
    content:
      'Sinh viên Hệ thống thông tin chuẩn bị phỏng vấn BA rất nên lưu bài này lại. Cảm ơn Linh nhiều!',
  },

  // Post 3: Live Coding & System Design (4 comments)
  {
    post_key: 'post-interview-03',
    author_email: authorMap.hoang,
    minutes_after: 25,
    content:
      'Kinh nghiệm chuẩn hóa 3NF và Stateless Session rất thực tế. Nhiều bạn mới hay quên tính toán trường hợp database bị nghẽn I/O khi query nhiều bảng.',
  },
  {
    post_key: 'post-interview-03',
    author_email: authorMap.long,
    minutes_after: 40,
    content:
      '@Nguyễn Hoàng Đúng vậy, việc hiểu rõ khi nào nên denormalize để tăng tốc độ đọc cũng là điểm cộng lớn trong mắt interviewer.',
  },
  {
    post_key: 'post-interview-03',
    author_email: authorMap.bao,
    minutes_after: 60,
    content:
      'Anh Long cho em hỏi có nguồn nào đọc System Design cơ bản dễ hiểu cho người mới không ạ?',
  },
  {
    post_key: 'post-interview-03',
    author_email: authorMap.long,
    minutes_after: 80,
    content:
      '@Trần Quốc Bảo Em tìm đọc cuốn "System Design Interview" của Alex Xu nhé, có hình minh họa rất trực quan và giải thích từng bước rất dễ theo dõi.',
  },

  // Post 4: Self-Intro & Weaknesses (5 comments)
  {
    post_key: 'post-interview-04',
    author_email: authorMap.linh,
    minutes_after: 20,
    content:
      'Công thức Hiện tại - Quá khứ - Tương lai áp dụng chuẩn thật sự luôn, vừa gãy gọn vừa đủ ý.',
  },
  {
    post_key: 'post-interview-04',
    author_email: authorMap.thao,
    minutes_after: 35,
    content:
      'Cực kỳ thích cách Quỳnh Anh hướng dẫn trả lời điểm yếu. Thừa nhận thiếu sót kèm hành động sửa đổi luôn tạo cảm giác chín chắn và chân thành.',
  },
  {
    post_key: 'post-interview-04',
    author_email: authorMap.quynhanh,
    minutes_after: 50,
    content:
      '@Hoàng Thu Thảo Cảm ơn chị Thảo! Nhiều bạn sợ nói điểm yếu thật sẽ bị đánh trượt, nhưng nói dối hoặc văn mẫu thì HR nhận ra ngay.',
  },
  {
    post_key: 'post-interview-04',
    author_email: authorMap.ngocanh,
    minutes_after: 70,
    content:
      'Ghi lại để chuẩn bị cho đợt phỏng vấn tuần sau của mình. Cảm ơn bạn!',
  },
  {
    post_key: 'post-interview-04',
    author_email: authorMap.dat,
    minutes_after: 90,
    content:
      'Bài viết rất hữu ích cho sinh viên năm 2 mới bắt đầu tập đi phỏng vấn như em ạ.',
  },

  // Post 5: Management Trainee (3 comments)
  {
    post_key: 'post-interview-05',
    author_email: authorMap.quynhanh,
    minutes_after: 30,
    content:
      'Vòng Group Discussion đúng là áp lực nhất luôn, nhiều bạn cố gắng tranh nói để thể hiện khiến nhóm bị mất thời gian.',
  },
  {
    post_key: 'post-interview-05',
    author_email: authorMap.thao,
    minutes_after: 45,
    content:
      '@Phạm Quỳnh Anh Đúng rồi em, giám khảo họ quan sát kỹ năng làm việc nhóm và cách xử lý xung đột chứ không chọn người độc chiếm diễn đàn.',
  },
  {
    post_key: 'post-interview-05',
    author_email: authorMap.ha,
    minutes_after: 75,
    content:
      'Cảm ơn chia sẻ quý báu từ chị Thảo, một bài viết rất có chiều sâu cho các bạn thi MT!',
  },

  // Post 6: Questions for Interviewer (2 comments)
  {
    post_key: 'post-interview-06',
    author_email: authorMap.hoang,
    minutes_after: 25,
    content:
      'Câu hỏi về tiêu chí thành công trong 3 tháng đầu là câu mình luôn hỏi nhà tuyển dụng, giúp định hình kỳ vọng công việc rất rõ ràng.',
  },
  {
    post_key: 'post-interview-06',
    author_email: authorMap.bao,
    minutes_after: 40,
    content:
      '@Nguyễn Hoàng Chuẩn luôn bạn, hỏi câu đó chứng tỏ mình sẵn sàng bắt tay vào làm việc nghiêm túc.',
  },

  // Post 7: Data Analyst Interview Case Study (4 comments)
  {
    post_key: 'post-interview-07',
    author_email: authorMap.tri,
    minutes_after: 20,
    content:
      'Window Functions như RANK và DENSE_RANK đúng là hay gặp nhất trong các bài test SQL của Data Analyst.',
  },
  {
    post_key: 'post-interview-07',
    author_email: authorMap.dat,
    minutes_after: 35,
    content:
      '@Lê Trí Đúng rồi anh, luyện chắc mấy hàm đó là tự tin pass 80% vòng SQL.',
  },
  {
    post_key: 'post-interview-07',
    author_email: authorMap.long,
    minutes_after: 55,
    content:
      'Case metric drop của Đạt phân tích rất chuẩn tư duy MECE (Mutually Exclusive, Collectively Exhaustive).',
  },
  {
    post_key: 'post-interview-07',
    author_email: authorMap.dat,
    minutes_after: 75,
    content: 'Dạ em cảm ơn anh Long nhiều ạ!',
  },

  // Post 8: Rejection Letter Handling (3 comments)
  {
    post_key: 'post-interview-08',
    author_email: authorMap.hoang,
    minutes_after: 30,
    content:
      'Viết Thank-you letter sau khi bị từ chối đôi khi mang lại cơ hội bất ngờ đó các bạn. Đợt trước mình trượt một vị trí nhưng HR ấn tượng thái độ nên 2 tháng sau có dự án mới đã chủ động gọi lại mời mình phỏng vấn.',
  },
  {
    post_key: 'post-interview-08',
    author_email: authorMap.kiet,
    minutes_after: 45,
    content:
      '@Nguyễn Hoàng Trải nghiệm thực tế quá hay! Giữ thái độ chuyên nghiệp luôn mang lại giá trị lâu dài.',
  },
  {
    post_key: 'post-interview-08',
    author_email: authorMap.ngocanh,
    minutes_after: 65,
    content:
      'Bài viết xoa dịu tâm lý rất nhiều cho những ai vừa nhận email từ chối. Cảm ơn Kiệt!',
  },

  // Post 10: Learn SQL & DB from Scratch (3 comments)
  {
    post_key: 'post-study-02',
    author_email: authorMap.mai,
    minutes_after: 25,
    content:
      'Trang SQLBolt đúng là kinh điển cho người mới bắt đầu, bài tập ngắn gọn và trực quan.',
  },
  {
    post_key: 'post-study-02',
    author_email: authorMap.tri,
    minutes_after: 40,
    content:
      '@Trần Mai Đúng vậy Mai, học xong bên đó sang làm LeetCode là bắt nhịp rất mượt mà.',
  },
  {
    post_key: 'post-study-02',
    author_email: authorMap.dat,
    minutes_after: 65,
    content:
      'Em đang học môn Cơ sở dữ liệu kỳ này, may quá đọc được bài của anh Trí!',
  },

  // Post 11: Reading English Tech Docs (2 comments)
  {
    post_key: 'post-study-03',
    author_email: authorMap.long,
    minutes_after: 30,
    content:
      'Đọc Official Doc là thói quen bắt buộc của kỹ sư phần mềm. Nhiều bài viết dịch trên mạng bị thiếu hoặc sai lệch nghiêm trọng.',
  },
  {
    post_key: 'post-study-03',
    author_email: authorMap.ha,
    minutes_after: 50,
    content:
      '@Vũ Hoàng Long Đồng ý với anh Long, tài liệu gốc bao giờ cũng đầy đủ cảnh báo và best practices nhất.',
  },

  // Post 12: Scientific Research vs Practical Projects (4 comments)
  {
    post_key: 'post-study-04',
    author_email: authorMap.bao,
    minutes_after: 20,
    content:
      'Mình theo hướng NCKH từ năm 2, công nhận đọc papers rất vất vả nhưng rèn luyện tư duy phản biện cực kỳ tốt.',
  },
  {
    post_key: 'post-study-04',
    author_email: authorMap.long,
    minutes_after: 35,
    content:
      '@Trần Quốc Bảo Chuẩn đó Bảo, sinh viên có bài báo khoa học lúc nộp học bổng du học là hồ sơ sáng rực luôn.',
  },
  {
    post_key: 'post-study-04',
    author_email: authorMap.hoang,
    minutes_after: 55,
    content:
      'Còn mình theo hướng làm đồ án ứng dụng, xây dựng sản phẩm đưa vào CV đi xin việc thấy rất thực tế và nhanh chóng.',
  },
  {
    post_key: 'post-study-04',
    author_email: authorMap.long,
    minutes_after: 70,
    content:
      '@Nguyễn Hoàng Đúng vậy, tùy mục tiêu của mỗi bạn mà chọn con đường phù hợp nhất.',
  },

  // Post 13: AWS Certification Roadmap (5 comments)
  {
    post_key: 'post-study-05',
    author_email: authorMap.tri,
    minutes_after: 25,
    content:
      'Chúc mừng Hoàng nhé! Điểm 840/1000 cho chứng chỉ SAA là rất cao đó.',
  },
  {
    post_key: 'post-study-05',
    author_email: authorMap.hoang,
    minutes_after: 40,
    content:
      '@Lê Trí Cảm ơn Trí, bộ đề của Tutorials Dojo hỗ trợ mình rất nhiều trong việc hiểu bản chất các dịch vụ.',
  },
  {
    post_key: 'post-study-05',
    author_email: authorMap.kiet,
    minutes_after: 60,
    content: 'Sinh viên có được giảm giá lệ phí thi AWS không Hoàng?',
  },
  {
    post_key: 'post-study-05',
    author_email: authorMap.hoang,
    minutes_after: 75,
    content:
      '@Đặng Tuấn Kiệt Bạn có thể đăng ký tài khoản qua chương trình AWS Academy của trường để được voucher giảm 50% lệ phí thi nhé.',
  },
  {
    post_key: 'post-study-05',
    author_email: authorMap.bao,
    minutes_after: 95,
    content: 'Thông tin voucher quá hữu ích! Cảm ơn bạn nhiều.',
  },

  // Post 14: Note-taking with Notion & Obsidian (3 comments)
  {
    post_key: 'post-study-06',
    author_email: authorMap.ha,
    minutes_after: 30,
    content:
      'Obsidian kết hợp vẽ sơ đồ liên kết Graph View nhìn trực quan và tạo cảm hứng học bài thật sự.',
  },
  {
    post_key: 'post-study-06',
    author_email: authorMap.ngocanh,
    minutes_after: 45,
    content:
      '@Phan Thanh Hà Đúng rồi Hà, mỗi lần liên kết được 2 khái niệm ở 2 môn khác nhau là hiểu bài sâu hơn hẳn.',
  },
  {
    post_key: 'post-study-06',
    author_email: authorMap.quynhanh,
    minutes_after: 70,
    content:
      'Mình cũng đang dùng Notion để quản lý deadline bài tập, đỡ quên việc hẳn.',
  },

  // Post 15: Data Skills for Business Students (2 comments)
  {
    post_key: 'post-study-07',
    author_email: authorMap.linh,
    minutes_after: 25,
    content:
      'Power Query trong Excel công nhận thần thánh thật, ngày xưa mất cả buổi dọn file thì nay bấm Refresh là xong.',
  },
  {
    post_key: 'post-study-07',
    author_email: authorMap.ha,
    minutes_after: 45,
    content:
      '@Đoàn Khánh Linh Chuẩn luôn Linh, tự động hóa được bao nhiêu thao tác lặp đi lặp lại.',
  },

  // Post 16: GPA & Study Scholarships (4 comments)
  {
    post_key: 'post-study-08',
    author_email: authorMap.quynhanh,
    minutes_after: 20,
    content:
      'Chiến lược giữ điểm quá trình thật sự là chìa khóa vàng, cuối kỳ đỡ áp lực bao nhiêu.',
  },
  {
    post_key: 'post-study-08',
    author_email: authorMap.mai,
    minutes_after: 35,
    content:
      'Chúc mừng Linh nhé! Điểm rèn luyện trên 80 đôi khi sinh viên hay quên tham gia hoạt động nên bị hụt học bổng rất tiếc.',
  },
  {
    post_key: 'post-study-08',
    author_email: authorMap.linh,
    minutes_after: 50,
    content:
      '@Trần Mai Đúng vậy Mai, nhiều bạn GPA 3.8 nhưng ĐRL có 78 điểm là trượt học bổng tiếc hùi hụi luôn.',
  },
  {
    post_key: 'post-study-08',
    author_email: authorMap.ngocanh,
    minutes_after: 75,
    content:
      'Bài viết rất thiết thực cho các bạn sinh viên muốn săn học bổng trường.',
  },

  // Post 18: Resume Writing for Beginners (4 comments)
  {
    post_key: 'post-intern-02',
    author_email: authorMap.hoang,
    minutes_after: 25,
    content:
      'Đồng ý với Quỳnh Anh, CV sinh viên giữ trong 1 trang là đẹp nhất, người duyệt hồ sơ chỉ lướt 10-15 giây thôi.',
  },
  {
    post_key: 'post-intern-02',
    author_email: authorMap.quynhanh,
    minutes_after: 40,
    content:
      '@Nguyễn Hoàng Đúng rồi anh, viết dài dòng 2-3 trang vừa loãng vừa không làm nổi bật được thế mạnh.',
  },
  {
    post_key: 'post-intern-02',
    author_email: authorMap.dat,
    minutes_after: 60,
    content:
      'Cho em hỏi đồ án môn học mình có nên để link source code GitHub vào CV không ạ?',
  },
  {
    post_key: 'post-intern-02',
    author_email: authorMap.quynhanh,
    minutes_after: 75,
    content:
      '@Bùi Văn Đạt Rất nên em nhé! Nhưng nhớ viết README hướng dẫn cài đặt và kèm vài ảnh chụp màn hình ứng dụng để người xem không cần tải code về vẫn thấy được sản phẩm.',
  },

  // Post 19: Startup vs Corporation (5 comments)
  {
    post_key: 'post-intern-03',
    author_email: authorMap.hoang,
    minutes_after: 20,
    content:
      'Mình từng thực tập ở cả 2 môi trường này. Ở Startup học được sự linh hoạt và tính chủ động cực cao, còn Tập đoàn giúp mình hiểu thế nào là quy trình chuẩn mực.',
  },
  {
    post_key: 'post-intern-03',
    author_email: authorMap.thao,
    minutes_after: 35,
    content:
      '@Nguyễn Hoàng Chính xác luôn Hoàng, mỗi môi trường đem lại một trải nghiệm bổ trợ cho nhau.',
  },
  {
    post_key: 'post-intern-03',
    author_email: authorMap.tri,
    minutes_after: 55,
    content:
      'Năm 3 vào Startup va chạm thực tế trước, năm 4 vào Tập đoàn lớn hoàn thiện quy trình là lộ trình khá lý tưởng.',
  },
  {
    post_key: 'post-intern-03',
    author_email: authorMap.linh,
    minutes_after: 75,
    content: 'Phân tích rất đa chiều và công tâm của chị Thảo. Cảm ơn chị!',
  },
  {
    post_key: 'post-intern-03',
    author_email: authorMap.dat,
    minutes_after: 95,
    content:
      'Bài viết giúp em giải tỏa được nhiều phân vân khi lựa chọn công ty thực tập.',
  },

  // Post 20: Graduation Internship Report (3 comments)
  {
    post_key: 'post-intern-04',
    author_email: authorMap.mai,
    minutes_after: 30,
    content:
      'Vấn đề bảo mật NDA cực kỳ quan trọng! Kỳ trước trường mình có bạn đưa mã hợp đồng thật của công ty vào báo cáo bị công ty phản ánh về trường suýt không được tốt nghiệp.',
  },
  {
    post_key: 'post-intern-04',
    author_email: authorMap.ngocanh,
    minutes_after: 45,
    content:
      '@Trần Mai Nghe sợ quá, bài học cảnh tỉnh đắt giá cho sinh viên khi làm báo cáo tốt nghiệp.',
  },
  {
    post_key: 'post-intern-04',
    author_email: authorMap.thao,
    minutes_after: 70,
    content:
      'Luôn gửi bản thảo cho mentor duyệt trước khi đóng bìa nộp trường là nguyên tắc an toàn nhất.',
  },

  // Post 21: Unpaid Internships (4 comments)
  {
    post_key: 'post-intern-05',
    author_email: authorMap.hoang,
    minutes_after: 25,
    content:
      'Quan điểm rất rõ ràng! Công ty bắt làm việc như nhân viên chính thức mà không có một đồng phụ cấp hỗ trợ nào thì nên tránh xa.',
  },
  {
    post_key: 'post-intern-05',
    author_email: authorMap.dat,
    minutes_after: 40,
    content:
      '@Nguyễn Hoàng Em đồng ý với anh, ít nhất cũng phải có phụ cấp đi lại và ăn trưa để hỗ trợ sinh viên.',
  },
  {
    post_key: 'post-intern-05',
    author_email: authorMap.quynhanh,
    minutes_after: 60,
    content:
      'Nhiều nơi lợi dụng danh nghĩa thực tập để bóc lột sức lao động của các bạn mới ra trường, sinh viên cần tỉnh táo nhận diện.',
  },
  {
    post_key: 'post-intern-05',
    author_email: authorMap.tri,
    minutes_after: 80,
    content:
      'Thời gian thực tập quý giá nhất là học được gì và người hướng dẫn có tận tâm hay không.',
  },

  // Post 22: First Week Onboarding (2 comments)
  {
    post_key: 'post-intern-06',
    author_email: authorMap.long,
    minutes_after: 30,
    content:
      'Chủ động cập nhật tài liệu Onboarding bị lỗi là một hành động ghi điểm tuyệt đối trong mắt Tech Lead luôn!',
  },
  {
    post_key: 'post-intern-06',
    author_email: authorMap.kiet,
    minutes_after: 50,
    content:
      '@Vũ Hoàng Long Dạ đúng rồi anh, làm việc đó vừa giúp bản thân hiểu sâu vừa giúp các bạn vào sau cài cắm nhanh hơn.',
  },

  // Post 23: When Mentor is Busy (3 comments)
  {
    post_key: 'post-intern-07',
    author_email: authorMap.hoang,
    minutes_after: 25,
    content:
      'Kỹ năng gom câu hỏi hỏi một lượt vào cuối ngày là kỹ năng vàng khi đi làm công sở.',
  },
  {
    post_key: 'post-intern-07',
    author_email: authorMap.bao,
    minutes_after: 45,
    content:
      '@Nguyễn Hoàng Chuẩn luôn bạn, mentor bận mấy cũng sẽ sẵn sàng dành 15-20 phút nếu mình chuẩn bị sẵn danh sách rõ ràng.',
  },
  {
    post_key: 'post-intern-07',
    author_email: authorMap.ha,
    minutes_after: 70,
    content:
      'Đưa ra sẵn 2 phương án khi hỏi vừa giúp tiết kiệm thời gian vừa chứng minh mình có tư duy suy nghĩ.',
  },

  // Post 24: Transition Intern to Full-time (4 comments)
  {
    post_key: 'post-intern-08',
    author_email: authorMap.long,
    minutes_after: 20,
    content:
      'Chúc mừng Hoàng đã chính thức lên Full-time nhé! Tinh thần Ownership là thứ phân biệt một thực tập sinh xuất sắc với phần còn lại.',
  },
  {
    post_key: 'post-intern-08',
    author_email: authorMap.hoang,
    minutes_after: 35,
    content:
      '@Vũ Hoàng Long Em cảm ơn anh Long nhiều ạ! Học hỏi được từ các anh chị đi trước rất nhiều.',
  },
  {
    post_key: 'post-intern-08',
    author_email: authorMap.tri,
    minutes_after: 55,
    content:
      'Chủ động xin feedback sau mỗi tháng để sửa đổi kịp thời là bài học quá hay.',
  },
  {
    post_key: 'post-intern-08',
    author_email: authorMap.linh,
    minutes_after: 75,
    content:
      'Chúc Hoàng tiếp tục phát triển mạnh mẽ trên nấc thang sự nghiệp tiếp theo nhé!',
  },
];

// Validate counts
function validateData() {
  console.log('Validating forum demo data...');
  assert.equal(authors.length, 12, 'Must have exactly 12 authors');
  assert.equal(posts.length, 24, 'Must have exactly 24 posts');

  const topicCounts = {
    'Học tập': 0,
    'Thực tập': 0,
    'Kinh nghiệm phỏng vấn': 0,
  };
  for (const p of posts) {
    assert.ok(topicCounts[p.topic] !== undefined, `Unknown topic ${p.topic}`);
    topicCounts[p.topic]++;
  }
  assert.equal(topicCounts['Học tập'], 8, 'Học tập must have 8 posts');
  assert.equal(topicCounts['Thực tập'], 8, 'Thực tập must have 8 posts');
  assert.equal(
    topicCounts['Kinh nghiệm phỏng vấn'],
    8,
    'Kinh nghiệm phỏng vấn must have 8 posts',
  );

  // Validate the 3 mandatory posts
  const post1 = posts.find((p) => p.id_key === 'post-interview-01');
  assert.ok(post1, 'Mandatory post 1 exists');
  assert.equal(
    post1.title,
    'Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh viên năm 3',
  );
  assert.equal(post1.topic, 'Kinh nghiệm phỏng vấn');

  const post2 = posts.find((p) => p.id_key === 'post-study-01');
  assert.ok(post2, 'Mandatory post 2 exists');
  assert.equal(
    post2.title,
    'Cách phân bổ thời gian ôn thi chứng chỉ TOEIC và đồ án chuyên ngành hiệu quả',
  );
  assert.equal(post2.topic, 'Học tập');

  const post3 = posts.find((p) => p.id_key === 'post-intern-01');
  assert.ok(post3, 'Mandatory post 3 exists');
  assert.equal(
    post3.title,
    'Nên chuẩn bị gì trước kỳ thực tập doanh nghiệp đầu tiên?',
  );
  assert.equal(post3.topic, 'Thực tập');

  // Validate comment counts
  const commentsByPost = {};
  for (const c of comments) {
    commentsByPost[c.post_key] = (commentsByPost[c.post_key] || 0) + 1;
  }

  assert.equal(
    commentsByPost['post-interview-01'],
    18,
    'Post 1 must have exactly 18 comments',
  );
  assert.equal(
    commentsByPost['post-study-01'],
    32,
    'Post 2 must have exactly 32 comments',
  );
  assert.equal(
    commentsByPost['post-intern-01'],
    14,
    'Post 3 must have exactly 14 comments',
  );

  for (const p of posts) {
    const count = commentsByPost[p.id_key] || 0;
    if (p.id_key === 'post-interview-01') {
      assert.equal(count, 18);
    } else if (p.id_key === 'post-study-01') {
      assert.equal(count, 32);
    } else if (p.id_key === 'post-intern-01') {
      assert.equal(count, 14);
    } else {
      assert.ok(
        count >= 1 && count <= 5,
        `Post ${p.id_key} should have 1-5 comments, got ${count}`,
      );
    }
  }

  console.log(`Validation passed! Total comments: ${comments.length}`);
}

async function main() {
  validateData();
  await mkdir(__dirname, { recursive: true });

  await writeFile(
    join(__dirname, 'authors-fixture.json'),
    JSON.stringify(authors, null, 2),
    'utf-8',
  );
  await writeFile(
    join(__dirname, 'posts-fixture.json'),
    JSON.stringify(posts, null, 2),
    'utf-8',
  );
  await writeFile(
    join(__dirname, 'comments-fixture.json'),
    JSON.stringify(comments, null, 2),
    'utf-8',
  );

  console.log(
    'Successfully wrote authors-fixture.json, posts-fixture.json, comments-fixture.json',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
