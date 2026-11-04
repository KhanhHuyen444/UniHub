import fs from 'node:fs';

// Helper to format academic years in Vietnamese
function formatAcademicYears(years) {
  if (!years || years.length === 0) {
    return 'Sinh viên các năm học hoặc cử nhân mới tốt nghiệp';
  }
  return `Sinh viên năm ${years.join(', năm ')}`;
}

// Generate realistic data for all 100 items
export function generateRealisticMetadata(item, mapping) {
  const { review_id } = item;
  const { opportunity_type, location, work_format } = item.opportunity;
  const { major_names, skill_names } = mapping;
  const yearsText = formatAcademicYears(item.relations.academic_years);
  const locText = location
    ? `tại khu vực ${location}`
    : 'theo hình thức linh hoạt';

  const idNum = parseInt(review_id.replace('DEMO-', ''), 10);

  return buildOpportunityContent(
    idNum,
    opportunity_type,
    major_names,
    skill_names,
    yearsText,
    locText,
    work_format,
  );
}

function buildOpportunityContent(
  id,
  type,
  majors,
  skills,
  yearsText,
  locText,
  workFormat,
) {
  if (type === 'Thực tập') {
    return buildInternshipContent(
      id,
      majors,
      skills,
      yearsText,
      locText,
      workFormat,
    );
  }
  if (type === 'Học bổng') {
    return buildScholarshipContent(id, majors, skills, yearsText, locText);
  }
  return generateDynamicRealisticContent(
    id,
    type,
    majors,
    skills,
    yearsText,
    locText,
    workFormat,
  );
}

function buildInternshipContent(
  id,
  majors,
  skills,
  yearsText,
  locText,
  workFormat,
) {
  const majorsList = majors.join(', ');
  const skillsList = skills.join('; ');

  switch (id) {
    case 1:
      return {
        title:
          'Trợ lý Tuyển dụng & Thu hút Nhân tài (Talent Acquisition Assistant)',
        publisher: 'Công ty Cổ phần Giải pháp Nhân sự TalentBridge',
        description: `## Mô tả thực tập\nTalentBridge là đối tác cung ứng giải pháp quản trị nhân sự và tuyển dụng chiến lược cho các tập đoàn đa quốc gia. Chương trình thực tập mang đến cơ hội trải nghiệm thực chiến toàn bộ quy trình thu hút nhân tài từ tiếp nhận yêu cầu tuyển dụng đến đón tiếp nhân sự mới.\n\nTrách nhiệm chính:\n- Hỗ trợ xây dựng bản mô tả công việc (JD) chuẩn hóa và đăng tải tin tuyển dụng trên các kênh nghề nghiệp, mạng xã hội chuyên nghiệp.\n- Thực hiện sàng lọc hồ sơ ứng viên, liên hệ xếp lịch phỏng vấn và gửi thư phản hồi chuyên nghiệp, chu đáo.\n- Sử dụng Microsoft Excel để thống kê, theo dõi tiến độ tuyển dụng (hiring funnel) và quản trị cơ sở dữ liệu ứng viên nội bộ.\n- Phối hợp cùng đội ngũ HR tổ chức các ngày hội việc làm (Job Fair) và chương trình liên kết hướng nghiệp với các trường đại học.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 3.500.000 VNĐ đến 5.000.000 VNĐ/tháng, hỗ trợ chi phí gửi xe và cơm trưa văn phòng.\n- Được hướng dẫn 1-1 bởi Trưởng nhóm Tuyển dụng, tích lũy kinh nghiệm quản trị nhân sự và phỏng vấn hành vi thực tế.\n- Hỗ trợ dấu mộc tròn doanh nghiệp và chứng nhận hoàn thành thực tập phục vụ báo cáo tốt nghiệp.\n- Cơ hội ưu tiên xét tuyển lên vị trí Chuyên viên Nhân sự chính thức sau khi tốt nghiệp.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Có định hướng phát triển lâu dài trong lĩnh vực Quản trị nhân sự và Tuyển dụng doanh nghiệp.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững quy trình tuyển dụng và sàng lọc hồ sơ ứng viên cơ bản.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Giao tiếp tự tin, văn phong chuẩn mực, bảo mật thông tin nhân sự và có tinh thần trách nhiệm cao.`,
      };

    case 2:
      return {
        title:
          'Kỹ sư Vận hành Mạng & Hạ tầng Cloud Tập sự (Network & Cloud Trainee)',
        publisher: 'Công ty TNHH Dịch vụ Công nghệ & Hạ tầng Số NetCore',
        description: `## Mô tả thực tập\nNetCore là đơn vị tiên phong cung cấp giải pháp hạ tầng mạng, bảo mật và điện toán đám mây cho doanh nghiệp vừa và lớn. Vị trí kỹ sư tập sự giúp bạn làm chủ môi trường vận hành máy chủ thực tế, từ cấu hình dịch vụ mạng đến trực ban giám sát hệ thống NOC 24/7.\n\nTrách nhiệm chính:\n- Hỗ trợ cài đặt, cấu hình và quản trị cơ bản các máy chủ chạy hệ điều hành Linux (Ubuntu Server, Rocky Linux).\n- Tham gia giám sát hoạt động hệ thống mạng nội bộ, phân tích lưu lượng định tuyến TCP/IP và kiểm tra kết nối văn phòng.\n- Ghi nhận, phân loại và hỗ trợ xử lý các sự cố mạng và dịch vụ tầng ứng dụng theo quy trình chuẩn NOC.\n- Lập tài liệu hướng dẫn kỹ thuật, sơ đồ topo mạng và cấu hình thiết bị phòng lab nghiên cứu thử nghiệm.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập cạnh tranh theo năng lực, hỗ trợ máy tính làm việc cấu hình cao và thiết bị thực hành phòng lab Cisco/MikroTik.\n- Trải nghiệm mô hình làm việc kết hợp (Hybrid) linh hoạt, chủ động sắp xếp lịch học ở trường.\n- Được cấp chứng nhận thực tập và bảo trợ dự án đồ án tốt nghiệp chuyên ngành CNTT.\n- Cơ hội ký hợp đồng kỹ sư chính thức sau kỳ thực tập với lộ trình thăng tiến rõ ràng.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Có định hướng phát triển trong lĩnh vực quản trị hệ thống, hạ tầng mạng hoặc DevOps.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kiến thức mạng máy tính, mô hình OSI và giao thức mạng TCP/IP; có hiểu biết về quản trị hệ thống Linux.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy logic tốt, đam mê tìm hiểu công nghệ hạ tầng mạng và tính kỷ luật cao trong xử lý sự cố.`,
      };

    case 3:
      return {
        title: 'Kỹ sư Thiết kế Mạch Điện & Tự động hóa Công nghiệp Tập sự',
        publisher: 'Công ty Cổ phần Kỹ thuật Điện & Tự động hóa ElectroTech',
        description: `## Mô tả thực tập\nChương trình thực tập trực tuyến tại ElectroTech mở ra cơ hội cho sinh viên trên cả nước tham gia trực tiếp vào các dự án thiết kế và mô phỏng mạch điện công nghiệp, tủ bảng điện điều khiển và tích hợp thiết bị đo lường thông minh.\n\nTrách nhiệm chính:\n- Phối hợp cùng kỹ sư thiết kế để đọc và phân tích sơ đồ nguyên lý mạch điện, bản vẽ kỹ thuật điện tử và sơ đồ đấu nối tủ điện.\n- Thực hiện thiết kế mạch điện và mô phỏng hoạt động của các khối cấp nguồn, bảo vệ mạch trên phần mềm chuyên dụng.\n- Đánh giá các tiêu chuẩn an toàn điện và tương thích điện từ cho thiết bị theo quy chuẩn kỹ thuật quốc gia và IEC.\n- Báo cáo tiến độ thiết kế định kỳ qua các buổi đánh giá kỹ thuật trực tuyến cùng chuyên gia.\n\n## Quyền lợi và hỗ trợ\n- Linh hoạt hoàn toàn về địa điểm làm việc (Online), hỗ trợ sinh viên các tỉnh thành tiếp cận dự án công nghiệp thực tế.\n- Hỗ trợ học bổng thực tập dự án dựa trên kết quả hoàn thành các mô-đun thiết kế.\n- Cơ hội ký hợp đồng kỹ sư chính thức tại văn phòng chi nhánh sau khi hoàn thành chương trình đào tạo.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sở hữu máy tính cá nhân đáp ứng yêu cầu cài đặt phần mềm mô phỏng mạch điện; mong muốn tích lũy kinh nghiệm thiết kế phần cứng.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Khả năng đọc bản vẽ kỹ thuật và sơ đồ đấu nối mạch điện công nghiệp; hiểu biết các quy tắc an toàn điện và bảo vệ quá tải.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tính kỷ luật cao trong môi trường làm việc từ xa, cẩn trọng và tỉ mỉ trong từng chi tiết kỹ thuật.`,
      };

    case 4:
      return {
        title: 'Nghiên cứu viên Phân tích Thuật toán & Mô hình Toán học Tập sự',
        publisher: 'Viện Toán ứng dụng & Trí tuệ Nhân tạo VinaMath',
        description: `## Mô tả thực tập\nVinaMath là tổ chức nghiên cứu và ứng dụng toán học vào các bài toán kinh tế, logistics và dữ liệu lớn. Vị trí thực tập tập trung vào việc mô hình hóa các bài toán thực tiễn và kiểm thử thuật toán tính toán số.\n\nTrách nhiệm chính:\n- Nghiên cứu tài liệu và xây dựng mô hình hóa toán học cho các bài toán phân bổ nguồn lực và chuỗi cung ứng.\n- Lập trình hiện thực hóa các thuật toán số học và giải thuật tối ưu trên nền tảng Python và MATLAB.\n- Phân tích sai số, đánh giá hiệu năng thuật toán và trực quan hóa kết quả mô phỏng dữ liệu.\n- Trình bày kết quả nghiên cứu trước hội đồng khoa học định kỳ của Viện.\n\n## Quyền lợi và hỗ trợ\n- Học bổng nghiên cứu hàng tháng và tài trợ kinh phí tham gia các hội nghị khoa học sinh viên.\n- Được các chuyên gia đầu ngành hướng dẫn trực tiếp phương pháp nghiên cứu toán ứng dụng hiện đại.\n- Cung cấp môi trường máy chủ tính toán hiệu năng cao phục vụ chạy thử nghiệm thuật toán phức tạp.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Điểm học phần các môn Giải tích, Đại số tuyến tính và Xác suất thống kê đạt mức khá/giỏi trở lên; đam mê chiều sâu học thuật.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Năng lực tư duy mô hình hóa toán học và phân tích định lượng xuất sắc; thành thạo Python hoặc MATLAB.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Khả năng đọc hiểu tài liệu học thuật tiếng Anh chuyên ngành, kiên trì và tỉ mỉ khi xử lý dữ liệu phức tạp.`,
      };

    case 5:
      return {
        title:
          'Chuyên viên Phân tích Thương mại Quốc tế & Dữ liệu Vĩ mô Tập sự',
        publisher: 'Trung tâm Tư vấn Xúc tiến Thương mại & Đầu tư GlobalTrade',
        description: `## Mô tả thực tập\nGlobalTrade hỗ trợ các doanh nghiệp xuất nhập khẩu nắm bắt diễn biến thị trường và rào cản thương mại quốc tế. Thực tập sinh sẽ tham gia vào các báo cáo nghiên cứu ngành hàng và phân tích xu hướng thương mại khu vực.\n\nTrách nhiệm chính:\n- Thu thập và chuẩn hóa dữ liệu hải quan, kim ngạch xuất nhập khẩu và biểu thuế quan quốc tế.\n- Ứng dụng các mô hình kinh tế lượng để phân tích tác động của các hiệp định thương mại tự do (FTA).\n- Trực quan hóa dữ liệu thương mại quốc tế và soạn thảo bản tin tổng hợp thị trường định kỳ.\n- Phối hợp cùng chuyên viên tư vấn chuẩn bị tài liệu hội thảo xúc tiến doanh nghiệp xuất khẩu.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập cạnh tranh và thưởng theo đóng góp trong các dự án tư vấn quốc tế.\n- Rèn luyện kỹ năng phân tích dữ liệu kinh tế vĩ mô và nắm bắt nghiệp vụ ngoại thương thực tế.\n- Môi trường làm việc năng động, linh hoạt kết hợp giữa trực tiếp và trực tuyến (Hybrid).`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Có kết quả tốt trong các môn học Kinh tế lượng, Thương mại quốc tế; định hướng làm việc trong các tổ chức xúc tiến thương mại hoặc phòng xuất nhập khẩu.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Hiểu biết vững về các nghiệp vụ thương mại quốc tế, biểu thuế XNK và chính sách ngoại thương.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy phản biện, kỹ năng viết báo cáo rõ ràng, mạch lạc và sử dụng thành thạo tiếng Anh thương mại.`,
      };

    case 6:
      return {
        title:
          'Trợ lý Biên tập & Hiệu đính Bản thảo Tiếng Anh (English Editorial Assistant)',
        publisher: 'Tổ chức Giáo dục & Xuất bản Quốc tế Translingo',
        description: `## Mô tả thực tập\nTranslingo chuyên sản xuất và biên tập các ấn phẩm học thuật, tài liệu đào tạo quốc tế. Chúng tôi tìm kiếm các bạn sinh viên xuất sắc về ngôn ngữ tham gia đội ngũ biên tập nội dung số và dịch thuật bản thảo chuyên ngành.\n\nTrách nhiệm chính:\n- Biên dịch các tài liệu chuyên ngành, bài viết công nghệ và ấn phẩm giáo dục từ tiếng Anh sang tiếng Việt và ngược lại.\n- Biên tập nội dung tiếng Anh, kiểm tra ngữ pháp, văn phong và tính nhất quán của thuật ngữ học thuật.\n- Hỗ trợ xây dựng bộ từ điển thuật ngữ đối chiếu phục vụ dự án xuất bản điện tử.\n- Phối hợp cùng ban biên tập hoàn thiện các bài đăng trên cổng thông tin tri thức trực tuyến.\n\n## Quyền lợi và hỗ trợ\n- Làm việc hoàn toàn từ xa (Online), tự chủ thời gian làm việc phù hợp với lịch học ở trường.\n- Nhuận bút hấp dẫn tính theo khối lượng sản phẩm biên dịch và biên tập đạt tiêu chuẩn chất lượng.\n- Được đào tạo kỹ năng sử dụng các công cụ hỗ trợ dịch thuật hiện đại (CAT Tools).`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Trình độ tiếng Anh tương đương IELTS 6.5+ hoặc C1; yêu thích công việc biên dịch và sáng tạo ngôn ngữ.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Kỹ năng dịch thuật chuẩn xác, diễn đạt tiếng Việt tự nhiên, giàu vốn từ vựng học thuật.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Kỹ năng tra cứu, đối chiếu thuật ngữ chuyên ngành; có tinh thần trách nhiệm cao về deadline và sự cẩn trọng.`,
      };

    case 7:
      return {
        title: 'Trợ lý Nghiên cứu & Phát triển Chương trình Khảo thí Sư phạm',
        publisher: 'Viện Đổi mới Giáo dục & Đào tạo Edulab',
        description: `## Mô tả thực tập\nEdulab là tổ chức tiên phong trong nghiên cứu các phương pháp sư phạm hiện đại và đánh giá năng lực học sinh. Vị trí thực tập sinh mang lại trải nghiệm thực tế trong thiết kế bài giảng tương tác và khảo sát chuẩn hóa kết quả giáo dục.\n\nTrách nhiệm chính:\n- Hỗ trợ thiết kế bài giảng tương tác theo định hướng phát triển phẩm chất và năng lực người học hiện đại.\n- Xây dựng bộ công cụ đánh giá kết quả học tập, ma trận đề kiểm tra và thang đo rubric cho khóa học thử nghiệm.\n- Tiến hành phỏng vấn và khảo sát ý kiến giáo viên, phụ huynh về trải nghiệm chương trình đào tạo mới.\n- Tổng hợp số liệu khảo sát, phân tích phản hồi định tính/định lượng và đề xuất cải tiến nội dung giảng dạy.\n\n## Quyền lợi và hỗ trợ\n- Hỗ trợ kinh phí thực tập hàng tháng, cấp thư giới thiệu thực tập chuẩn sư phạm từ Viện trưởng.\n- Cơ hội làm việc cùng các chuyên gia hàng đầu về phương pháp giảng dạy tích cực và EdTech.\n- Môi trường làm việc mở, khuyến khích các sáng kiến đổi mới phương pháp giáo dục.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Đam mê nâng cao chất lượng giáo dục và phát triển phương pháp sư phạm; định hướng làm chuyên gia phát triển chương trình.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Kỹ năng thiết kế bài giảng sinh động, nắm vững các bước triển khai kế hoạch bài dạy và phương pháp đánh giá.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tác phong sư phạm chuẩn mực, giao tiếp khéo léo, đồng cảm và thấu hiểu tâm lý học sinh.`,
      };

    case 8:
      return {
        title:
          'Kỹ sư Nông học Hiện trường - Quản lý Cây trồng & Dịch hại Sinh học',
        publisher: 'Trung tâm Nghiên cứu Nông nghiệp Công nghệ cao AgriTech',
        description: `## Mô tả thực tập\nAgriTech đang triển khai các đề tài nghiên cứu về bảo vệ cây trồng sinh học và phát triển nông nghiệp tuần hoàn. Kỹ sư tập sự sẽ tham gia chăm sóc mô hình đồng ruộng thực nghiệm, theo dõi dịch hại và áp dụng các giải pháp nông nghiệp hữu cơ.\n\nTrách nhiệm chính:\n- Tham gia thiết kế thí nghiệm đồng ruộng, bố trí các ô công thức nghiệm thức theo khối ngẫu nhiên chuẩn hóa.\n- Quan sát, điều tra mật độ sâu hại và triển khai các biện pháp quản lý dịch hại tổng hợp (IPM) thân thiện môi trường.\n- Thu thập mẫu cây trồng, đo đếm các chỉ tiêu sinh trưởng và ghi chép nhật ký nông vụ khoa học.\n- Hỗ trợ tổng hợp dữ liệu nghiên cứu khoa học phục vụ báo cáo nghiệm thu đề tài cấp cơ sở.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập và hỗ trợ lưu trú, phụ cấp xăng xe tại trạm thực nghiệm nông học công nghệ cao.\n- Được tài trợ kinh phí thực hiện đề tài khóa luận tốt nghiệp nông nghiệp gắn liền với đề tài thực tế.\n- Học hỏi trực tiếp từ các kỹ sư nông học giàu kinh nghiệm thực tế trên đồng ruộng.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sẵn sàng làm việc thực địa tại khu thí nghiệm nhà màng và đồng ruộng mở; yêu thích nông nghiệp xanh.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Hiểu biết phương pháp thiết kế thí nghiệm nông nghiệp và thu thập số liệu trắc lượng sinh trưởng cây trồng.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Chăm chỉ, kiên trì, quan sát thực tế nhạy bén và có tinh thần trách nhiệm với công việc thực địa.`,
      };

    case 9:
      return {
        title:
          'Cộng tác viên Nghiên cứu Y học Lâm sàng & Đánh giá Y văn Thực chứng',
        publisher: 'Viện Nghiên cứu & Đào tạo Y sinh Á Châu',
        description: `## Mô tả thực tập\nChương trình thực tập trực tuyến dành cho sinh viên Y khoa yêu thích công tác nghiên cứu khoa học y học và tổng thuật y văn. Bạn sẽ tham gia vào các dự án rà soát chứng cứ y khoa dựa trên y học thực chứng (Evidence-Based Medicine).\n\nTrách nhiệm chính:\n- Tra cứu, tổng thuật và đọc hiểu tài liệu y khoa từ các cơ sở dữ liệu quốc tế uy tín (PubMed, Cochrane, Embase).\n- Phân tích các ca bệnh lâm sàng điển hình, đối chiếu với hướng dẫn chẩn đoán và điều trị của Bộ Y tế và quốc tế.\n- Hỗ trợ xây dựng tài liệu tham khảo về khám lâm sàng cơ bản cho các bác sĩ trẻ và sinh viên thực tập.\n- Tham gia các buổi thảo luận ca bệnh trực tuyến hàng tuần do Hội đồng Khoa học Viện chủ trì.\n\n## Quyền lợi và hỗ trợ\n- Tham gia từ xa (Online), linh hoạt sắp xếp thời gian theo các đợt đi viện lâm sàng tại bệnh viện trường.\n- Học hỏi kỹ năng nghiên cứu tổng quan hệ thống (Systematic Review) và phân tích dữ liệu lâm sàng.\n- Ghi nhận đóng góp tên tác giả trong các ấn phẩm nghiên cứu xuất bản trên tạp chí y khoa đối tác.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Có nền tảng kiến thức bệnh học nội - ngoại - sản - nhi vững vàng; định hướng kết hợp lâm sàng và nghiên cứu y học.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Khả năng đọc hiểu tài liệu y khoa tiếng Anh chuyên ngành thành thạo; nắm vững các bước khám lâm sàng cơ bản.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Đạo đức y khoa nghiêm cẩn, cẩn trọng trong từng nhận định chuyên môn và bảo mật thông tin ca bệnh.`,
      };

    case 10:
      return {
        title:
          'Brand Identity & Visual Designer Trainee (Thiết kế Bộ nhận diện Thương hiệu)',
        publisher: 'Studio Sáng tạo & Truyền thông Thị giác ArtVision',
        description: `## Mô tả thực tập\nArtVision là studio thiết kế chuyên xây dựng bộ nhận diện thương hiệu và ấn phẩm truyền thông số cho các nhãn hàng sáng tạo. Vị trí thiết kế tập sự là nơi bạn biến các ý tưởng hình ảnh độc đáo thành tác phẩm thị giác chạm đến cảm xúc khách hàng.\n\nTrách nhiệm chính:\n- Thiết kế các ấn phẩm truyền thông mạng xã hội, banner số, poster sự kiện trên Figma và Adobe Photoshop.\n- Nghiên cứu và áp dụng chặt chẽ các nguyên lý bố cục, phân cấp thị giác và typography vào từng thiết kế thương hiệu.\n- Hỗ trợ dàn trang brand guideline, catalogue, brochure và tài liệu truyền thông thương hiệu cho đối tác.\n- Tham gia vào các buổi thảo luận brainstorm ý tưởng thị giác cùng giám đốc sáng tạo.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập hàng tháng từ 4.000.000 VNĐ đến 6.000.000 VNĐ, thưởng dự án hoàn thành xuất sắc.\n- Được đào tạo nâng cao kỹ năng thiết kế đồ họa chuyên nghiệp và xây dựng portfolio chuẩn mực quốc tế.\n- Môi trường làm việc trẻ trung, sáng tạo, trang bị đầy đủ máy trạm iMac và bảng vẽ Wacom hiện đại.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Đính kèm link Portfolio các sản phẩm đồ họa cá nhân đã từng thực hiện; định hướng trở thành Visual / Brand Designer.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Sử dụng thành thạo phần mềm thiết kế chuyên dụng: Figma, Adobe Photoshop; hiểu biết sâu về nguyên lý phối màu và typography.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Gu thẩm mỹ hiện đại, khả năng tiếp thu góp ý thiết kế và cởi mở thử nghiệm phong cách mới.`,
      };

    case 11:
      return {
        title:
          'Management Trainee — Khối Kế hoạch Chiến lược & Vận hành Doanh nghiệp',
        publisher: 'Tập đoàn Đầu tư & Quản lý Chiến lược Cát Tường Holdings',
        description: `## Mô tả thực tập\nChương trình Management Trainee tại Cát Tường Holdings là bệ phóng phát triển đội ngũ lãnh đạo trẻ tiềm năng. Bạn sẽ tham gia trực tiếp vào việc lập kế hoạch kinh doanh và phân tích hiệu quả hoạt động các đơn vị thành viên.\n\nTrách nhiệm chính:\n- Tham gia khảo sát thị trường, thu thập dữ liệu ngành và đối thủ cạnh tranh nhằm phục vụ xây dựng kế hoạch kinh doanh.\n- Ứng dụng Microsoft Excel nâng cao để xây dựng mô hình dự báo doanh thu, chi phí và phân tích chỉ số tài chính hoạt động.\n- Theo dõi tiến độ thực hiện mục tiêu OKRs/KPIs của các phòng ban và soạn thảo báo cáo tổng hợp định kỳ.\n- Tham gia các buổi họp chiến lược và hỗ trợ ban điều hành chuẩn bị tài liệu thuyết trình báo cáo hội đồng quản trị.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập 4.500.000 VNĐ/tháng, phụ cấp ăn trưa và thưởng hiệu quả công việc theo quý.\n- Được cố vấn trực tiếp bởi Giám đốc Kế hoạch Chiến lược, rèn luyện tư duy kinh doanh và kỹ năng lãnh đạo.\n- Chương trình đào tạo Fast-Track xét lên vị trí Chuyên viên Quản lý Vận hành sau 6 tháng thực tập.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên có thành tích học tập tốt, năng động, đam mê giải quyết bài toán quản trị và phát triển doanh nghiệp.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kiến thức lập kế hoạch kinh doanh, mô hình phân tích SWOT, 5 Forces; thành thạo Microsoft Excel nâng cao.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy logic sắc bén, kỹ năng giao tiếp và thuyết trình tự tin, khả năng thích ứng linh hoạt trong môi trường doanh nghiệp.`,
      };

    case 12:
      return {
        title:
          'C++ Systems Software Engineer Trainee (Phát triển Hệ thống Hiệu năng cao)',
        publisher: 'Công ty Cổ phần Công nghệ & Giải pháp Số TechNova',
        description: `## Mô tả thực tập\nTechNova phát triển các nền tảng xử lý dữ liệu lớn thời gian thực và kiến trúc phần mềm hiệu năng cao. Vị trí C++ Trainee trực tuyến mở cơ hội cho sinh viên công nghệ cọ xát với code base phân tán quy mô lớn.\n\nTrách nhiệm chính:\n- Phát triển các mô-đun phần mềm lõi sử dụng ngôn ngữ C++ (chuẩn C++17/20), áp dụng chặt chẽ các mẫu thiết kế OOP.\n- Tối ưu hóa thuật toán, cấu trúc dữ liệu và quản lý bộ nhớ nhằm đạt tốc độ thực thi và độ trễ tối thiểu.\n- Sử dụng Git để quản lý mã nguồn, tạo pull request, thực hiện code review và viết kiểm thử đơn vị (Unit Test).\n- Phối hợp cùng kỹ sư trưởng để dò lỗi (debugging) và kiểm thử khả năng chịu tải của các dịch vụ hệ thống.\n\n## Quyền lợi và hỗ trợ\n- Làm việc hoàn toàn trực tuyến (Online), thời gian làm việc linh hoạt, hỗ trợ máy chủ ảo (VPS) phục vụ build dự án.\n- Hỗ trợ học bổng thực tập kỹ thuật từ 5.000.000 VNĐ/tháng theo các mốc hoàn thành sprint phần mềm.\n- Cơ hội tuyển dụng chính thức trở thành Software Engineer sau kỳ thực tập với mức đãi ngộ hấp dẫn.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Yêu thích lập trình tầng thấp, thuật toán, tối ưu hiệu năng và phát triển phần mềm hệ thống quy mô lớn.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững ngôn ngữ C++, tư duy lập trình hướng đối tượng (OOP), cấu trúc dữ liệu và giải thuật; thành thạo Git.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy giải quyết vấn đề độc lập, kỹ năng đọc hiểu tài liệu kỹ thuật tiếng Anh và tinh thần kỷ luật khi làm việc từ xa.`,
      };

    case 13:
      return {
        title:
          'Kỹ sư Thiết kế Bo mạch Phần cứng & Xử lý Tín hiệu Tập sự (Hardware R&D)',
        publisher: 'Công ty Kỹ thuật & Công nghệ Điện tử Việt Cơ Điện',
        description: `## Mô tả thực tập\nViệt Cơ Điện chuyên nghiên cứu và chế tạo các thiết bị điện tử viễn thông, IoT công nghiệp và bo mạch nhúng chuyên dụng. Kỹ sư tập sự sẽ tham gia chu trình nghiên cứu phát triển phần cứng từ thiết kế schematic đến hàn lắp mạch mẫu.\n\nTrách nhiệm chính:\n- Nghiên cứu yêu cầu kỹ thuật và tham gia vẽ sơ đồ nguyên lý mạch điện (schematic) cho bo mạch điện tử viễn thông.\n- Thực hiện layout thiết kế PCB đa lớp trên phần mềm Altium Designer, đảm bảo toàn vẹn tín hiệu và giảm nhiễu EMI.\n- Hỗ trợ kiểm thử các khối mạch xử lý tín hiệu số, đo kiểm dạng sóng trên máy hiện sóng (Oscilloscope) và logic analyzer.\n- Lập tài liệu danh mục linh kiện (BOM) và quy trình lắp ráp, kiểm tra mạch mẫu phòng thí nghiệm.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.500.000 VNĐ/tháng, trang bị đầy đủ bàn làm việc và trạm hàn khò, thiết bị đo kiểm chuyên dụng.\n- Được hướng dẫn trực tiếp bởi Kỹ sư trưởng Phần cứng có hơn 12 năm kinh nghiệm trong ngành viễn thông.\n- Tài trợ 100% kinh phí gia công bo mạch thử nghiệm phục vụ đồ án tốt nghiệp kỹ sư.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên định hướng phát triển trong lĩnh vực thiết kế phần cứng điện tử, IoT hoặc viễn thông công nghệ cao.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kiến thức thiết kế mạch điện tử, thiết kế bo mạch PCB và lý thuyết xử lý tín hiệu số.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Kỹ năng hàn linh kiện dán (SMD) cơ bản, cẩn thận, tỉ mỉ và tuân thủ nghiêm ngặt quy định chống tĩnh điện (ESD).`,
      };

    case 14:
      return {
        title:
          'Quantitative Analyst Trainee — Mô hình hóa Dữ liệu & Tính toán Tối ưu',
        publisher:
          'Viện Nghiên cứu Khoa học Dữ liệu & Toán ứng dụng Đại Dương Xanh',
        description: `## Mô tả thực tập\nĐại Dương Xanh là trung tâm tư vấn mô hình định lượng và giải pháp tối ưu hóa vận hành cho các tổ chức tài chính và chuỗi cung ứng. Vị trí Quantitative Analyst Trainee giúp bạn đưa toán học ứng dụng vào giải quyết bài toán lớn.\n\nTrách nhiệm chính:\n- Tham gia nghiên cứu và xây dựng mô hình toán học giải quyết bài toán phân bổ chi phí và lộ trình vận chuyển tối ưu.\n- Ứng dụng lý thuyết tối ưu hóa quy hoạch tuyến tính và phi tuyến để tìm lời giải hiệu quả cho mô hình kinh tế.\n- Xử lý số liệu lớn, kiểm định giả thuyết thống kê và lập trình mô phỏng kịch bản trên Python/R.\n- Viết báo cáo đánh giá độ nhạy của mô hình và trình bày kết quả trước nhóm chuyên gia tư vấn.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp nghiên cứu từ 4.000.000 VNĐ đến 6.000.000 VNĐ/tháng, làm việc theo mô hình kết hợp (Hybrid) hiện đại.\n- Học hỏi phương pháp nghiên cứu định lượng chuẩn quốc tế từ các tiến sĩ toán học và chuyên gia tài chính.\n- Cấp chứng nhận thực tập xuất sắc và thư giới thiệu học bổng sau đại học uy tín.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên có kết quả xuất sắc các môn Giải tích số, Tối ưu hóa, Xác suất thống kê; tư duy định lượng tốt.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Thành thạo kỹ năng mô hình hóa toán học, giải thuật tối ưu hóa và thống kê ứng dụng trên Python hoặc R.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Khả năng tư duy trừu tượng kết hợp với thực tiễn, tính kiên nhẫn khi xử lý các tập dữ liệu phức tạp.`,
      };

    case 15:
      return {
        title:
          'Trợ lý Nghiên cứu Kinh tế Phát triển & Đánh giá Tác động Chính sách',
        publisher: 'Tổ chức Tư vấn Phát triển & Phân tích Chiến lược Ascend',
        description: `## Mô tả thực tập\nAscend là viện nghiên cứu chính sách độc lập thực hiện các dự án đánh giá tác động phát triển kinh tế vùng và an sinh xã hội. Thực tập sinh trực tuyến sẽ tham gia tổng hợp dữ liệu khảo sát và chạy mô hình kinh tế lượng.\n\nTrách nhiệm chính:\n- Thu thập và làm sạch các bộ dữ liệu khảo sát mức sống dân cư và số liệu phát triển kinh tế - xã hội các địa phương.\n- Ứng dụng phần mềm Stata/R để ước lượng các mô hình kinh tế lượng đánh giá hiệu quả của chính sách công.\n- Tham gia soạn thảo các chương tổng quan tài liệu và báo cáo phân tích định lượng phục vụ báo cáo khuyến nghị chính sách.\n- Hỗ trợ tổ chức các tọa đàm tham vấn chuyên gia và đối tác phát triển quốc tế qua nền tảng trực tuyến.\n\n## Quyền lợi và hỗ trợ\n- Tham gia nghiên cứu hoàn toàn từ xa (Online), chủ động sắp xếp thời gian làm việc phù hợp với lịch học ở trường.\n- Phụ cấp nghiên cứu hàng tháng và tài trợ chi phí tham gia các khóa tập huấn nâng cao phương pháp kinh tế lượng.\n- Được đồng đứng tên tác giả trong các báo cáo chuyên đề và ấn phẩm nghiên cứu chính sách của Viện.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Định hướng nghề nghiệp trong các tổ chức phi chính phủ, viện nghiên cứu chính sách hoặc các cơ quan hoạch định phát triển.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kiến thức kinh tế phát triển, phân tích chính sách công và thành thạo kỹ thuật phân tích dữ liệu kinh tế lượng.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Kỹ năng viết luận văn học thuật rõ ràng, khả năng đọc hiểu tài liệu nghiên cứu quốc tế bằng tiếng Anh.`,
      };

    case 16:
      return {
        title:
          'Biên phiên dịch Tiếng Trung Thương mại & Hợp tác Đối ngoại (HSK 5+)',
        publisher: 'Tổ chức Dịch thuật & Giao thương Quốc tế Á Âu Bridge',
        description: `## Mô tả thực tập\nÁ Âu Bridge là cầu nối xúc tiến thương mại và hợp tác sản xuất giữa các doanh nghiệp Việt Nam và đối tác quốc tế. Vị trí thực tập sinh biên phiên dịch giúp bạn trau dồi vốn từ chuyên ngành kinh tế và rèn luyện kỹ năng dịch thuật chuyên nghiệp.\n\nTrách nhiệm chính:\n- Biên dịch các tài liệu thương mại, hợp đồng mua bán quốc tế, hồ sơ sản phẩm và tài liệu kỹ thuật từ tiếng Trung sang tiếng Việt và ngược lại.\n- Hỗ trợ phiên dịch nối tiếp trong các cuộc họp trực tuyến, buổi tiếp đón đối tác và đàm phán hợp đồng thương mại.\n- Soạn thảo thư tín thương mại, công văn và biên tập nội dung bản tin giao thương song ngữ Trung - Việt.\n- Chuẩn hóa kho thuật ngữ chuyên ngành thương mại, xuất nhập khẩu và logistics của công ty.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.000.000 VNĐ đến 5.500.000 VNĐ/tháng, phụ cấp phiên dịch hiện trường khi tham gia sự kiện.\n- Môi trường làm việc đa ngôn ngữ chuyên nghiệp, thường xuyên tiếp xúc trực tiếp với các chuyên gia và đối tác quốc tế.\n- Hỗ trợ đóng dấu mộc thực tập và thư giới thiệu việc làm tại các doanh nghiệp FDI lớn sau tốt nghiệp.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Trình độ tiếng Trung tương đương HSK 5 hoặc HSK 6; phát âm chuẩn, tác phong giao tiếp chuyên nghiệp.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Kỹ năng biên dịch chính xác, phiên dịch lưu loát; nắm vững các kỹ năng: Tiếng Trung, Phiên dịch, Biên tập nội dung đa ngôn ngữ.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Am hiểu văn hóa kinh doanh Á Đông, tác phong nhanh nhẹn, bảo mật tuyệt đối các thông tin đàm phán hợp đồng.`,
      };

    case 17:
      return {
        title:
          'Trợ giảng Sư phạm Toán học & Phát triển Tư duy Khoa học Tự nhiên',
        publisher:
          'Hệ thống Giáo dục Thực nghiệm & Bồi dưỡng Năng khiếu Sao Việt',
        description: `## Mô tả thực tập\nSao Việt là hệ thống trường liên cấp và trung tâm bồi dưỡng tư duy toán học cho học sinh phổ thông. Trợ giảng sư phạm sẽ đồng hành cùng giáo viên chủ nhiệm trong việc tổ chức các tiết học trải nghiệm và theo sát sự tiến bộ của học sinh.\n\nTrách nhiệm chính:\n- Hỗ trợ giáo viên xây dựng kế hoạch giảng dạy, chuẩn bị học liệu số và soạn giáo án dạy học toán theo định hướng phát triển tư duy.\n- Quan sát, quản lý lớp học và trợ giúp học sinh giải quyết các bài tập toán học ứng dụng trong giờ thực hành.\n- Tham gia chấm bài tập về nhà, đánh giá kết quả học tập định kỳ và gửi nhận xét cá nhân hóa đến phụ huynh học sinh.\n- Phối hợp tổ chức các sân chơi câu lạc bộ toán học vui và ngày hội STEAM trường học.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp trợ giảng từ 3.500.000 VNĐ đến 5.000.000 VNĐ/tháng theo số tiết đứng lớp thực tế, thưởng chuyên cần.\n- Được đào tạo bài bản về phương pháp dạy học tích cực, kỹ năng quản lý lớp học và tâm lý lứa tuổi học sinh.\n- Được cấp dấu mộc thực tập sư phạm chính quy và cơ hội tuyển dụng làm giáo viên chính thức sau khi tốt nghiệp.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên năm 3, năm 4 chuyên ngành Sư phạm Toán học; tâm huyết với nghề dạy học và yêu mến học sinh.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kiến thức toán phổ thông, kỹ năng xây dựng kế hoạch giảng dạy, soạn giáo án và đánh giá kết quả học tập.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Giọng nói truyền cảm, chữ viết chuẩn mực, tác phong sư phạm gương mẫu và khả năng xử lý tình huống lớp học khéo léo.`,
      };

    case 18:
      return {
        title:
          'Kỹ thuật viên Nuôi cấy Mô Thực vật & Vi nhân giống Phòng Lab Tập sự',
        publisher:
          'Viện Công nghệ Sinh học Ứng dụng & Giống Cây trồng GreenField',
        description: `## Mô tả thực tập\nGreenField chuyên nghiên cứu nhân giống vô tính in-vitro các giống cây lâm nghiệp và hoa cao cấp sạch bệnh. Kỹ thuật viên tập sự sẽ được làm việc trực tiếp trong hệ thống phòng thí nghiệm nuôi cấy mô đạt chuẩn an toàn sinh học.\n\nTrách nhiệm chính:\n- Thực hiện pha chế môi trường dinh dưỡng nuôi cấy mô (MS) và vận hành quy trình hấp khử trùng thiết bị nồi hấp autoclave.\n- Thực hiện thao tác cấy chuyển đỉnh sinh trưởng, nhân nhanh chồi và tạo rễ trong tủ cấy vô trùng (Laminar Flow Hood).\n- Theo dõi, ghi chép tỷ lệ tái sinh mẫu, kiểm soát hiện tượng nhiễm nấm khuẩn và chăm sóc cây mô trong phòng nuôi cây.\n- Tham gia thiết kế các nghiệm thức thí nghiệm điều hòa sinh trưởng và xử lý số liệu sinh học phân tử cơ bản.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.000.000 VNĐ/tháng, trang bị đầy đủ áo blouse phòng lab và đồ bảo hộ an toàn sinh học.\n- Được hướng dẫn thao tác vô trùng chuẩn xác bởi các nhà nghiên cứu công nghệ sinh học giàu kinh nghiệm.\n- Cung cấp nguyên vật liệu và buồng nuôi cây miễn phí để sinh viên thực hiện đề tài đồ án tốt nghiệp.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên có tính cẩn thận, kỷ luật cao, đam mê công việc thao tác phòng thí nghiệm công nghệ sinh học thực vật.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ thuật nuôi cấy mô thực vật, nguyên lý sinh học phân tử và kỹ năng thiết kế thí nghiệm sinh học.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Thao tác vô trùng chuẩn xác, tỉ mỉ, kiên nhẫn và tuân thủ nghiêm ngặt quy chế an toàn phòng xét nghiệm/lab.`,
      };

    case 19:
      return {
        title:
          'Bác sĩ Lâm sàng Tập sự — Thực hành Chăm sóc & Bệnh học Nội khoa Tổng quát',
        publisher: 'Bệnh viện Đa khoa & Viện Nghiên cứu Y sinh Tâm An Health',
        description: `## Mô tả thực tập\nTâm An Health là hệ thống bệnh viện đa khoa tư nhân trang bị trang thiết bị chẩn đoán hiện đại. Vị trí thực hành lâm sàng giúp sinh viên y khoa tiếp cận quy trình thăm khám bệnh nhân thực tế dưới sự kèm cặp sát sao của các bác sĩ chuyên khoa.\n\nTrách nhiệm chính:\n- Hỗ trợ bác sĩ điều trị hỏi bệnh sử, thực hiện khám lâm sàng cơ bản cho bệnh nhân nội trú khoa Nội tổng quát.\n- Tham gia ghi chép bệnh án điện tử, theo dõi các chỉ số sinh tồn và diễn biến triệu chứng bệnh học nội khoa hàng ngày.\n- Thực hành giao tiếp với người bệnh và thân nhân, giải thích chu đáo quy trình khám chữa bệnh và chăm sóc sức khỏe.\n- Tham gia các buổi giao ban chuyên môn bệnh viện và thảo luận chuyên đề chẩn đoán hình ảnh, xét nghiệm ca bệnh khó.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp hỗ trợ học tập và trực viện từ 3.500.000 VNĐ/tháng, cấp đồng phục blouse và suất ăn ca trực bệnh viện.\n- Được bác sĩ chuyên khoa II trực tiếp hướng dẫn kỹ năng biện luận chẩn đoán và chỉ định cận lâm sàng hợp lý.\n- Hỗ trợ cấp giấy xác nhận thời gian thực hành lâm sàng theo quy định của Luật Khám bệnh, chữa bệnh.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên y đa khoa năm 3, năm 4; đã hoàn thành các học phần giải phẫu, sinh lý và tiền lâm sàng.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững quy trình khám lâm sàng cơ bản, kiến thức bệnh học nội khoa và kỹ năng giao tiếp y khoa đồng cảm với người bệnh.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Y đức chuẩn mực, tôn trọng quyền riêng tư bệnh nhân, bình tĩnh và có tinh thần trách nhiệm cao trong phiên trực.`,
      };

    case 20:
      return {
        title: 'Concept Artist & Thiết kế Mỹ thuật Không gian Đô thị Tập sự',
        publisher:
          'Công ty Thiết kế Kiến trúc Cảnh quan & Nghệ thuật Không gian Vạn Xuân',
        description: `## Mô tả thực tập\nVạn Xuân chuyên thiết kế cảnh quan đô thị, công viên chủ đề và các công trình nghệ thuật công cộng. Concept Artist tập sự sẽ tham gia vào khâu trực quan hóa ý tưởng không gian từ các bản phác thảo tay đến tranh diễn họa kỹ thuật số.\n\nTrách nhiệm chính:\n- Thực hiện vẽ tay và phác thảo ý tưởng tạo hình cảnh quan, tượng đài và các điểm nhấn mỹ thuật không gian đô thị.\n- Sử dụng phần mềm đồ họa chuyên dụng để số hóa bản vẽ, phối màu và hoàn thiện tranh phối cảnh concept 2D/3D.\n- Nghiên cứu áp dụng các nguyên lý bố cục và typography vào các biển hiệu nhận diện và đồ họa định hướng không gian (Wayfinding).\n- Tham gia các buổi thuyết trình ý tưởng thiết kế cảnh quan cùng kiến trúc sư chủ trì dự án.\n\n## Quyền lợi và hỗ trợ\n- Làm việc trực tuyến (Online) linh hoạt, hỗ trợ chi phí bản quyền phần mềm đồ họa và bảng vẽ sáng tác kỹ thuật số.\n- Học bổng thực tập sáng tạo từ 4.000.000 VNĐ/tháng dựa trên các concept thiết kế được duyệt vào dự án thực tế.\n- Được các nghệ sĩ thị giác và kiến trúc sư cảnh quan hàng đầu kèm cặp phát triển phong cách nghệ thuật cá nhân.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên ngành mỹ thuật đô thị, hội họa hoặc thiết kế cảnh quan; có portfolio minh chứng năng lực vẽ tay và số hóa.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ năng: Thiết kế đồ họa, Vẽ tay và phác thảo ý tưởng, Bố cục và typography; khả năng cảm thụ không gian và màu sắc tốt.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy sáng tạo độc đáo, tiếp thu nhanh các góp ý thẩm mỹ và có niềm say mê với nghệ thuật không gian công cộng.`,
      };

    case 21:
      return {
        title:
          'B2B Business Development Trainee — Khối Phát triển Khách hàng Doanh nghiệp',
        publisher:
          'Công ty Cổ phần Thương mại & Công nghệ Doanh nghiệp Apex Global',
        description: `## Mô tả thực tập\nApex Global cung cấp các giải pháp chuyển đổi số và dịch vụ thương mại cho hơn 500 khách hàng doanh nghiệp. B2B Trainee sẽ được đào tạo bài bản kỹ năng tiếp cận khách hàng tiềm năng, đàm phán giải pháp và quản trị chu kỳ bán hàng doanh nghiệp.\n\nTrách nhiệm chính:\n- Thực hiện nghiên cứu thị trường mục tiêu, xác định danh sách khách hàng doanh nghiệp tiềm năng (lead generation).\n- Tiếp cận khách hàng qua điện thoại, email và mạng xã hội B2B nhằm giới thiệu giải pháp công nghệ và đặt lịch hẹn tư vấn.\n- Tham gia chuẩn bị báo giá, soạn thảo đề xuất giải pháp thương mại và hỗ trợ chuyên viên cao cấp trong các buổi gặp gỡ khách hàng.\n- Cập nhật tiến độ đàm phán và quản trị quan hệ khách hàng trên hệ thống CRM doanh nghiệp.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập cứng 4.500.000 VNĐ/tháng + hoa hồng hấp dẫn theo doanh thu hợp đồng ký kết thành công.\n- Đào tạo chuyên sâu về kỹ năng thương lượng B2B, kỹ năng tiếp thị số và nghệ thuật thuyết phục khách hàng cấp cao (C-level).\n- Được trang bị máy tính xách tay làm việc và điện thoại công vụ phục vụ công tác.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Đam mê kinh doanh B2B, năng động, thích chinh phục mục tiêu doanh số và mở rộng mối quan hệ xã hội.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Hiểu biết về nghiên cứu thị trường, tiếp thị số (Digital Marketing) và có kỹ năng thuyết phục, thương lượng cơ bản.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Giao tiếp hoạt bát, tự tin, khả năng lắng nghe và đồng cảm với nhu cầu của đối tác khách hàng.`,
      };

    case 22:
      return {
        title:
          'Flutter Mobile App Developer Trainee (Lập trình Ứng dụng Di động Đa nền tảng)',
        publisher: 'Công ty Cổ phần Giải pháp Phần mềm Di động InnoCloud',
        description: `## Mô tả thực tập\nInnoCloud là đơn vị phát triển các ứng dụng di động thương mại điện tử và dịch vụ số phục vụ hàng triệu người dùng. Vị trí Flutter Trainee giúp bạn tiếp cận quy trình phát triển sản phẩm di động chuẩn Agile/Scrum từ mã nguồn đến phát hành lên store.\n\nTrách nhiệm chính:\n- Tham gia lập trình các mô-đun giao diện người dùng (UI/UX) và tính năng mới bằng framework Flutter (Dart) cho cả iOS và Android.\n- Tích hợp các dịch vụ backend RESTful API và quản lý luồng trạng thái ứng dụng sử dụng Bloc hoặc Riverpod.\n- Sử dụng Git để cộng tác mã nguồn nhóm, xử lý xung đột code và tuân thủ các quy chuẩn code clean architecture.\n- Tìm và khắc phục các lỗi giao diện, tối ưu tốc độ cuộn trang và giảm mức tiêu thụ pin của ứng dụng di động.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.500.000 VNĐ đến 6.500.000 VNĐ/tháng theo năng lực lập trình, thưởng hoàn thành dự án.\n- Trải nghiệm văn hóa làm việc kết hợp (Hybrid) hiện đại, hỗ trợ thiết bị smartphone kiểm thử đa dạng cấu hình.\n- Được hướng dẫn trực tiếp bởi Mobile Tech Lead, học hỏi kinh nghiệm tối ưu ứng dụng di động thực tế.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Định hướng trở thành Mobile Developer chuyên nghiệp; đã từng có sản phẩm ứng dụng demo hoặc đồ án phần mềm di động.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Thành thạo lập trình di động với framework Flutter, nắm vững kiến thức lập trình hướng đối tượng và sử dụng tốt Git.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy logic tốt, chú trọng trải nghiệm người dùng mượt mà và chủ động học hỏi công nghệ di động mới.`,
      };

    case 23:
      return {
        title:
          'Kỹ sư Thiết kế Cơ khí & Mô phỏng Kết cấu 3D Tập sự (Mechanical R&D)',
        publisher:
          'Nhà máy Cơ khí Chính xác & Chế tạo Thiết bị Công nghiệp Tân Phát',
        description: `## Mô tả thực tập\nTân Phát chuyên gia công cơ khí chính xác và chế tạo các cụm máy móc tự động hóa cho các nhà máy công nghiệp. Kỹ sư tập sự sẽ tham gia thiết kế mô hình 3D, bóc tách bản vẽ chế tạo và trực tiếp theo dõi quá trình gia công chi tiết máy.\n\nTrách nhiệm chính:\n- Sử dụng phần mềm SolidWorks để thiết kế mô hình 3D chi tiết máy, đồ gá (jig) và cụm kết cấu máy cơ khí.\n- Bóc tách bản vẽ kỹ thuật 2D, ghi kích thước dung sai chế tạo và độ nhám bề mặt theo tiêu chuẩn TCVN/ISO.\n- Kiểm tra tính lắp ghép của cụm cơ cấu, mô phỏng động học chuyển động và hỗ trợ phân tích độ bền ứng suất.\n- Theo dõi tiến độ gia công cắt gọt kim loại tại phân xưởng máy phay/tiện CNC và đối chiếu kích thước chi tiết sau gia công.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập 4.500.000 VNĐ/tháng, phụ cấp ăn trưa miễn phí tại nhà ăn công ty và cấp đầy đủ đồ bảo hộ lao động.\n- Cơ hội trực tiếp vận hành và theo dõi các dây chuyền gia công CNC hiện đại hàng đầu khu vực miền Trung.\n- Được hướng dẫn bởi các kỹ sư cơ khí kỳ cựu và hỗ trợ số liệu làm đồ án tốt nghiệp thiết kế máy.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên chuyên ngành cơ khí chế tạo máy; mong muốn tích lũy kinh nghiệm thực tế tại phân xưởng sản xuất cơ khí hiện đại.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Sử dụng thành thạo phần mềm SolidWorks; nắm vững kỹ năng thiết kế cơ khí và đọc bản vẽ kỹ thuật chính xác.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tác phong kỷ luật an toàn lao động nghiêm ngặt, cẩn thận, đo đạc tỉ mỉ và có khả năng chịu được môi trường nhà xưởng.`,
      };

    case 24:
      return {
        title:
          'Data Analyst Trainee — Phân tích Thống kê Dữ liệu & Xây dựng Mô hình Dự báo',
        publisher: 'Trung tâm Phân tích Định lượng & Khoa học Dữ liệu DigiCore',
        description: `## Mô tả thực tập\nDigiCore là trung tâm chuyên nghiên cứu phân tích dữ liệu lớn và giải pháp Business Intelligence cho các doanh nghiệp bán lẻ và viễn thông. Vị trí Data Analyst Trainee trực tuyến giúp bạn làm chủ quy trình khai phá dữ liệu từ xử lý thô đến trực quan hóa chuyên sâu.\n\nTrách nhiệm chính:\n- Thu thập, trích xuất và làm sạch các bộ dữ liệu giao dịch quy mô lớn từ cơ sở dữ liệu quan hệ.\n- Sử dụng ngôn ngữ R và các thư viện thống kê để phân tích mô tả, kiểm định giả thuyết và phân tích hồi quy tương quan.\n- Xây dựng các mô hình dự báo xu hướng tiêu dùng, phân nhóm khách hàng và dự báo biến động chỉ số kinh doanh.\n- Thiết kế các dashboard báo cáo trực quan hóa dữ liệu sinh động nhằm hỗ trợ các nhà quản trị ra quyết định.\n\n## Quyền lợi và hỗ trợ\n- Làm việc trực tuyến (Online) hoàn toàn, thời gian biểu linh hoạt, cung cấp quyền truy cập hạ tầng cloud server phân tích dữ liệu.\n- Phụ cấp hỗ trợ học tập và nghiên cứu từ 4.500.000 VNĐ/tháng theo các gói phân tích dữ liệu hoàn thành.\n- Được đào tạo 1-1 bởi Senior Data Analyst và cơ hội chuyển tiếp lên vị trí Chuyên viên Dữ liệu chính thức.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên có nền tảng toán thống kê vững vàng; yêu thích khám phá các quy luật ẩn sâu trong các con số và tập dữ liệu lớn.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững các kỹ năng: Thống kê ứng dụng, ngôn ngữ lập trình R, kỹ thuật phân tích và trực quan hóa dữ liệu.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy logic nhạy bén, khả năng diễn giải ý nghĩa số liệu thống kê thành thông điệp kinh doanh rõ ràng.`,
      };

    case 25:
      return {
        title:
          'Corporate Finance Analyst Trainee (Thẩm định Dự án & Báo cáo Tài chính)',
        publisher:
          'Công ty Quản lý Quỹ Đầu tư & Tư vấn Tài chính Bảo An Capital',
        description: `## Mô tả thực tập\nBảo An Capital chuyên quản lý quỹ đầu tư và tư vấn mua bán sáp nhập doanh nghiệp (M&A). Thực tập sinh phân tích tài chính sẽ tham gia thẩm định các báo cáo tài chính doanh nghiệp và hỗ trợ xây dựng mô hình định giá dòng tiền.\n\nTrách nhiệm chính:\n- Thu thập, bóc tách và phân tích các chỉ số tài chính từ báo cáo tài chính kiểm toán của các doanh nghiệp mục tiêu.\n- Ứng dụng Microsoft Excel để xây dựng mô hình tài chính dự phóng kết quả kinh doanh và dòng tiền chiết khấu (DCF).\n- Hỗ trợ chuyên viên cao cấp trong công tác thẩm định tài chính dự án (financial due diligence) và định giá doanh nghiệp.\n- Soạn thảo các bản tóm tắt phân tích ngành và báo cáo thẩm định đầu tư phục vụ hội đồng đầu tư của quỹ.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.500.000 VNĐ đến 6.000.000 VNĐ/tháng cùng thưởng dự án M&A hoàn tất.\n- Rèn luyện tác phong tài chính chuyên nghiệp, tiếp cận phương pháp thẩm định đầu tư chuẩn quốc tế (CFA).\n- Cơ hội ưu tiên tuyển dụng vào chương trình Chuyên viên Phân tích Đầu tư sau kỳ thực tập.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên tài chính - ngân hàng có thành tích học tập xuất sắc; có định hướng thi chứng chỉ CFA là lợi thế lớn.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững các kỹ năng: Phân tích báo cáo tài chính, Định giá doanh nghiệp và thành thạo Microsoft Excel nâng cao.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Độ nhạy bén cao với các con số tài chính, tính bảo mật thông tin tuyệt đối và tinh thần trách nhiệm trong công việc.`,
      };

    case 26:
      return {
        title:
          'Biên phiên dịch Tiếng Nhật Thương mại (JLPT N2+) kiêm Trợ lý Cầu nối Dự án',
        publisher:
          'Công ty Dịch thuật & Cung ứng Nhân lực Quốc tế Đông Đô Horizon',
        description: `## Mô tả thực tập\nĐông Đô Horizon là đối tác chiến lược về xúc tiến đầu tư và chuyển giao kỹ thuật giữa Việt Nam và các tập đoàn Nhật Bản. Vị trí thực tập sinh biên phiên dịch giúp bạn rèn luyện khả năng giao tiếp tiếng Nhật thương mại và hiểu sâu về văn hóa doanh nghiệp Nhật Bản.\n\nTrách nhiệm chính:\n- Biên dịch các tài liệu quy trình sản xuất, hợp đồng nguyên tắc, tài liệu hướng dẫn kỹ thuật và email thương mại Nhật - Việt.\n- Hỗ trợ phiên dịch trực tiếp và dịch cabin/nối tiếp trong các cuộc họp điều hành định kỳ với các chuyên gia Nhật Bản.\n- Soạn thảo biên bản cuộc họp, theo dõi các hạng mục hành động (action items) và hỗ trợ điều phối dự án hợp tác song phương.\n- Biên tập và chuẩn hóa các nội dung truyền thông đa ngôn ngữ của công ty trên các ấn phẩm quảng bá thị trường Nhật.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập 5.000.000 VNĐ/tháng, phụ cấp chuyên cần và hỗ trợ chi phí đi lại làm việc tại văn phòng.\n- Môi trường làm việc chuẩn Nhật Bản (Ho-Ren-So), được rèn luyện phong thái làm việc chuyên nghiệp, chu đáo.\n- Cơ hội được tiến cử phỏng vấn visa kỹ sư làm việc tại Nhật Bản sau khi hoàn thành tốt kỳ thực tập.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Trình độ tiếng Nhật tương đương JLPT N2 hoặc N1; phát âm tự nhiên, yêu thích văn hóa và tác phong làm việc Nhật Bản.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ năng: Tiếng Nhật thương mại, Phiên dịch hội thoại và Biên tập nội dung đa ngôn ngữ chuẩn xác.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tác phong đúng giờ nghiêm ngặt, cẩn trọng, tỉ mỉ trong từng câu chữ và tuân thủ quy tắc ứng xử công sở.`,
      };

    case 27:
      return {
        title:
          'Giáo viên Tiểu học Tập sự — Phương pháp Dạy học Tích cực & Ứng dụng STEAM',
        publisher:
          'Hệ thống Trường Phổ thông Liên cấp Trải nghiệm Tương Lai Xanh',
        description: `## Mô tả thực tập\nTương Lai Xanh là hệ thống giáo dục tiên phong áp dụng mô hình dạy học tích cực và tích hợp STEAM ở bậc tiểu học. Giáo viên tập sự sẽ tham gia vào môi trường sư phạm đổi mới, học cách tổ chức lớp học tương tác và khơi dậy niềm đam mê học tập cho học sinh.\n\nTrách nhiệm chính:\n- Tham gia xây dựng kế hoạch giảng dạy các môn học tiểu học theo định hướng đổi mới chương trình GDPT 2018.\n- Hỗ trợ giáo viên chủ nhiệm trong việc quản lý nền nếp lớp học, hướng dẫn học sinh làm việc nhóm và thực hành dự án học tập.\n- Ứng dụng các công cụ sư phạm số để thiết kế trò chơi học tập tương tác và bài giảng điện tử sinh động.\n- Quan sát, ghi chép sự tiến bộ của từng học sinh và tham gia hỗ trợ các em học sinh có khó khăn trong học tập.\n\n## Quyền lợi và hỗ trợ\n- Làm việc trực tuyến kết hợp dự giờ (Online/Hybrid), hỗ trợ kinh phí thực tập sư phạm 3.500.000 VNĐ/tháng.\n- Được đào tạo các chứng chỉ nội bộ về phương pháp dạy học tích cực, giáo dục cảm xúc xã hội (SEL) và ứng dụng STEAM.\n- Hỗ trợ đầy đủ hồ sơ, chữ ký và con dấu chứng nhận thực tập tốt nghiệp cử nhân sư phạm tiểu học.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên chuyên ngành Giáo dục Tiểu học; có tình yêu thương trẻ nhỏ, đam mê đổi mới phương pháp sư phạm hiện đại.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ năng xây dựng kế hoạch giảng dạy, kỹ năng quản lý lớp học tiểu học và nghệ thuật giao tiếp sư phạm khéo léo.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Giọng nói chuẩn, rõ ràng, chữ viết đẹp, tác phong kiên nhẫn, thấu hiểu tâm lý lứa tuổi tiểu học.`,
      };

    case 28:
      return {
        title:
          'Kỹ sư Bảo vệ Thực vật & Kiểm định An toàn Sinh học Nông sản Tập sự',
        publisher:
          'Trung tâm Nghiên cứu Bảo vệ Cây trồng & Nông nghiệp An toàn Delta Agri',
        description: `## Mô tả thực tập\nDelta Agri chuyên nghiên cứu các chế phẩm bảo vệ thực vật sinh học và quy trình kiểm định dư lượng hóa chất trên nông sản xuất khẩu. Kỹ sư tập sự sẽ tham gia các thử nghiệm hiệu lực thuốc và thanh tra quy trình an toàn sinh học đồng ruộng.\n\nTrách nhiệm chính:\n- Tham gia thiết kế và bố trí các ô thí nghiệm khảo nghiệm hiệu lực phòng trừ sâu bệnh của các hoạt chất sinh học.\n- Thực hiện pha chế và hướng dẫn quy trình sử dụng thuốc bảo vệ thực vật an toàn theo nguyên tắc 4 đúng.\n- Theo dõi, thu thập mẫu bệnh hại trên cây trồng và giám sát quy trình quản lý sản xuất nông nghiệp đạt chuẩn VietGAP/GlobalGAP.\n- Hỗ trợ tổng hợp dữ liệu nghiên cứu khoa học, phân tích thống kê hiệu lực thuốc và lập báo cáo thử nghiệm hiện trường.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.000.000 VNĐ/tháng, phụ cấp công tác thực địa và trang bị đầy đủ thiết bị bảo hộ an toàn hóa chất.\n- Được đào tạo bài bản về quy trình khảo nghiệm thuốc BVTV theo tiêu chuẩn của Cục Bảo vệ thực vật.\n- Hỗ trợ trọn gói kinh phí vật tư và địa bàn thực nghiệm để hoàn thành đề tài khóa luận tốt nghiệp kỹ sư.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên ngành Bảo vệ thực vật hoặc Nông học; sẵn sàng làm việc tại các vùng trồng thực nghiệm nông nghiệp công nghệ cao.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ năng: Sử dụng thuốc bảo vệ thực vật an toàn, Thiết kế thí nghiệm đồng ruộng, Quản lý sản xuất nông nghiệp và Nghiên cứu khoa học.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Kỷ luật an toàn lao động cao, cẩn trọng khi tiếp xúc hóa chất, có sức khỏe tốt và tinh thần trách nhiệm với nông dân.`,
      };

    case 29:
      return {
        title:
          'Dược sĩ Kiểm nghiệm Thuốc & Phân tích Sắc ký HPLC Phòng Lab Tập sự',
        publisher:
          'Trung tâm Nghiên cứu Phát triển & Kiểm định Dược phẩm VinaPharma Care',
        description: `## Mô tả thực tập\nVinaPharma Care là trung tâm nghiên cứu và kiểm định chất lượng dược phẩm đạt chuẩn GLP/ISO 17025. Vị trí thực tập sinh kiểm nghiệm giúp sinh viên ngành Dược làm chủ kỹ thuật phân tích hiện đại trên các hệ thống thiết bị sắc ký tiên tiến.\n\nTrách nhiệm chính:\n- Thực hiện chuẩn bị mẫu, pha chế dung dịch chuẩn, dung dịch thử và các hệ dung môi pha động phục vụ phân tích.\n- Vận hành hệ thống sắc ký lỏng hiệu năng cao (HPLC) và sắc ký khí (GC) để định tính, định lượng hoạt chất trong dược phẩm.\n- Tuân thủ nghiêm ngặt các quy định an toàn hóa chất, an toàn cháy nổ và bảo quản hóa chất độc hại trong phòng thí nghiệm.\n- Ghi chép sổ tay phân tích kiểm nghiệm theo quy chuẩn GLP và tham gia thẩm định phương pháp phân tích dược liệu/thuốc.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.500.000 VNĐ/tháng, cấp đồng phục bảo hộ phòng kiểm nghiệm và trang thiết bị chuyên dụng.\n- Được kèm cặp trực tiếp bởi Dược sĩ Chuyên khoa I về kỹ thuật vận hành máy sắc ký và xử lý sắc ký đồ.\n- Được sử dụng hệ thống máy kiểm nghiệm hiện đại phục vụ số liệu cho khóa luận tốt nghiệp Dược sĩ đại học.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên Dược học năm 3, năm 4; có điểm số các môn Hóa phân tích, Kiểm nghiệm thuốc đạt khá/giỏi.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững các kỹ năng: Kiểm nghiệm dược phẩm, Kỹ thuật sắc ký (HPLC/GC) và Quy tắc an toàn hóa chất phòng lab.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Thao tác phân tích tỉ mỉ, trung thực với số liệu thực nghiệm, tính kỷ luật cao và tuân thủ quy trình thao tác chuẩn (SOP).`,
      };

    case 30:
      return {
        title:
          'Trợ lý Thiết kế Kiến trúc Nội thất & Diễn họa Phối cảnh 3D Không gian',
        publisher:
          'Studio Thiết kế Sáng tạo & Diễn họa Kiến trúc Đại Dương Xanh',
        description: `## Mô tả thực tập\nĐại Dương Xanh là studio chuyên thiết kế nội thất căn hộ cao cấp, villa nghỉ dưỡng và không gian làm việc sáng tạo. Vị trí trợ lý thiết kế trực tuyến mang lại cơ hội cọ xát với các dự án thực tế từ khâu lên concept đến bóc tách bản vẽ kỹ thuật chi tiết.\n\nTrách nhiệm chính:\n- Sử dụng phần mềm Revit và 3ds Max/Sketchup để dựng mô hình 3D không gian nội thất công trình theo ý tưởng thiết kế.\n- Thực hiện render và diễn họa nội thất phối cảnh ánh sáng, vật liệu chân thực phục vụ hồ sơ thuyết trình khách hàng.\n- Hỗ trợ khai triển bản vẽ kỹ thuật chi tiết đồ gỗ, bố trí điện nước nội thất và bảng chỉ định vật liệu hoàn thiện.\n- Tìm kiếm và cập nhật xu hướng vật liệu mới (gỗ, đá, vải, kim loại) và tham gia các buổi review đồ án thiết kế trực tuyến.\n\n## Quyền lợi và hỗ trợ\n- Làm việc trực tuyến (Online) linh hoạt, hỗ trợ bản quyền phần mềm thiết kế và kho thư viện 3D nội thất chuyên nghiệp.\n- Phụ cấp thực tập từ 4.000.000 VNĐ đến 5.500.000 VNĐ/tháng theo các gói bản vẽ và phối cảnh hoàn thiện đạt yêu cầu.\n- Được Kiến trúc sư Nội thất chủ trì kèm cặp kỹ năng xử lý không gian, ánh sáng và tư duy vật liệu thực tế.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên ngành Thiết kế nội thất; có portfolio sản phẩm 3D đã thực hiện; đam mê tạo dựng không gian sống tinh tế.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Sử dụng thành thạo Revit, kỹ năng Dựng mô hình 3D và Diễn họa nội thất chân thực, thẩm mỹ.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy hình khối không gian tốt, cảm thụ màu sắc và vật liệu tinh tế, cầu tiến và tiếp thu nhanh các góp ý chuyên môn.`,
      };

    case 31:
      return {
        title:
          'Quality Assurance / Quality Control (QA/QC) Trainee — Khối Quản trị Hệ thống Chất lượng',
        publisher:
          'Tổ chức Giám định Tiêu chuẩn & Quản lý Chất lượng Hoa Sen Partners',
        description: `## Mô tả thực tập\nHoa Sen Partners chuyên cung cấp dịch vụ đánh giá chứng nhận hệ thống quản lý chất lượng (ISO 9001, HACCP) và tư vấn cải tiến năng suất doanh nghiệp. QA/QC Trainee sẽ được tiếp cận quy trình kiểm soát chất lượng từ phân tích dữ liệu lỗi đến audit hệ thống.\n\nTrách nhiệm chính:\n- Hỗ trợ rà soát quy trình vận hành tiêu chuẩn (SOP), bảng kiểm tra chất lượng (Checklist) và hồ sơ lưu trữ chất lượng.\n- Thu thập dữ liệu lỗi sản phẩm, áp dụng kỹ thuật Phân tích nguyên nhân gốc (RCA) bằng sơ đồ xương cá và biểu đồ Pareto.\n- Tham gia cùng chuyên gia đánh giá hiện trường trong các đợt kiểm tra kiểm soát chất lượng (QC) và đánh giá nội bộ (QA).\n- Đề xuất các biện pháp khắc phục phòng ngừa (CAPA) và soạn thảo báo cáo tổng hợp chất lượng định kỳ.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập 4.500.000 VNĐ/tháng, phụ cấp công tác đánh giá doanh nghiệp và tài trợ tham gia khóa học chứng chỉ Lead Auditor.\n- Nắm vững phương pháp quản trị chất lượng hiện đại (Lean Six Sigma, 5S, Kaizen) từ các chuyên gia hàng đầu.\n- Cơ hội được giữ lại làm Chuyên viên Đánh giá Hệ thống Chất lượng chính thức sau kỳ thực tập.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên có định hướng phát triển sự nghiệp trong lĩnh vực quản lý chất lượng sản phẩm và kiểm định tiêu chuẩn công nghiệp.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kiến thức và kỹ năng: Đảm bảo chất lượng (QA), Kiểm soát chất lượng (QC) và Phân tích nguyên nhân gốc (RCA).\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy logic, tính chính xác, không khoan nhượng với sai lỗi chất lượng và kỹ năng làm việc nhóm hiệu quả.`,
      };

    case 32:
      return {
        title:
          'Database Administrator (DBA) Trainee — Quản trị & Tối ưu Cơ sở Dữ liệu',
        publisher:
          'Tập đoàn Hạ tầng Điện toán Đám mây & Giải pháp Dữ liệu DataSphere',
        description: `## Mô tả thực tập\nDataSphere vận hành các hệ thống cụm cơ sở dữ liệu lớn phục vụ khách hàng tài chính và thương mại điện tử. DBA Trainee sẽ tham gia vào các quy trình bảo trì, giám sát hiệu năng truy vấn và thiết kế kiến trúc lưu trữ dữ liệu an toàn.\n\nTrách nhiệm chính:\n- Viết và tối ưu hóa các câu lệnh truy vấn SQL phức tạp, thiết lập chỉ mục (index) và phân tích kế hoạch thực thi (Execution Plan).\n- Tham gia thiết kế cấu trúc cơ sở dữ liệu quan hệ (ERD), chuẩn hóa dữ liệu và xây dựng các thủ tục lưu trữ (Stored Procedure).\n- Thực hiện theo dõi hiệu năng hệ quản trị CSDL (PostgreSQL, MySQL), giám sát dung lượng ổ đĩa và tiến trình kết nối.\n- Hỗ trợ thiết lập lịch sao lưu dữ liệu (backup), kiểm tra quy trình phục hồi thảm họa (disaster recovery) và bảo mật phân quyền.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.500.000 VNĐ đến 6.500.000 VNĐ/tháng, làm việc mô hình kết hợp (Hybrid) hiện đại.\n- Được làm việc trực tiếp trên hệ thống máy chủ CSDL quy mô terabyte với hàng nghìn giao dịch mỗi giây (TPS).\n- Được Lead DBA hướng dẫn tận tình và cơ hội chuyển tiếp lên vị trí Kỹ sư Quản trị Dữ liệu chính thức.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên yêu thích cơ sở dữ liệu, kiến trúc dữ liệu và tối ưu hiệu năng hệ thống backend.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Thành thạo ngôn ngữ truy vấn SQL; nắm vững nguyên lý thiết kế cơ sở dữ liệu quan hệ và các nguyên tắc quản trị dữ liệu.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Cẩn trọng tuyệt đối khi thao tác dữ liệu, tư duy phân tích hệ thống tốt và tinh thần trách nhiệm cao.`,
      };

    case 33:
      return {
        title:
          'Kỹ sư Thiết kế Cơ điện tử & Robot Công nghiệp Tập sự (Mechatronics R&D)',
        publisher: 'Công ty Công nghệ Kỹ thuật & Tự động hóa Hải Phong Tech',
        description: `## Mô tả thực tập\nHải Phong Tech chuyên thiết kế các hệ thống cánh tay robot công nghiệp, xe tự hành AGV và dây chuyền đóng gói thông minh. Kỹ sư tập sự sẽ tham gia vào quá trình tích hợp giữa cơ cấu chấp hành cơ khí, mạch điều khiển và cảm biến đo lường.\n\nTrách nhiệm chính:\n- Sử dụng AutoCAD và SolidWorks để thiết kế mô hình 3D và bóc tách bản vẽ cơ khí cho cánh tay robot và cơ cấu gắp đặt.\n- Tính toán chọn động cơ servo, hộp giảm tốc, cảm biến hành trình và các thiết bị truyền động cơ khí chính xác.\n- Phối hợp với kỹ sư điều khiển để mô phỏng động học và kiểm tra độ va chạm của hệ cơ điện tử trên phần mềm chuyên dụng.\n- Lập tài liệu thông số kỹ thuật, hướng dẫn bảo dưỡng cơ khí và hỗ trợ lắp ráp cơ cấu tại xưởng thử nghiệm.\n\n## Quyền lợi và hỗ trợ\n- Làm việc trực tuyến (Online) linh hoạt, hỗ trợ máy trạm từ xa và tài trợ kinh phí linh kiện làm đồ án tốt nghiệp.\n- Hỗ trợ học bổng thực tập kỹ thuật từ 4.500.000 VNĐ/tháng dựa trên các mô-đun thiết kế cơ cấu hoàn thành.\n- Được tiếp cận công nghệ robot công nghiệp tiên tiến và hướng dẫn bởi các kỹ sư R&D hàng đầu.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên cơ điện tử hoặc tự động hóa; đam mê chế tạo robot và cơ cấu máy thông minh.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ năng thiết kế cơ khí; thành thạo phần mềm SolidWorks và AutoCAD; hiểu biết về cơ cấu truyền động cơ điện tử.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy hình học không gian xuất sắc, đam mê sáng tạo kỹ thuật và có tinh thần tự học nghiên cứu công nghệ mới.`,
      };

    case 34:
      return {
        title:
          'Kỹ thuật viên Hóa phân tích & Quản lý An toàn Phòng Thí nghiệm Tập sự',
        publisher:
          'Trung tâm Nghiên cứu & Giám định Hóa học Môi trường Đại Dương Xanh',
        description: `## Mô tả thực tập\nĐại Dương Xanh chuyên thực hiện các phân tích mẫu môi trường (nước, không khí, đất) và phân tích thành phần hóa học vật liệu. Kỹ thuật viên tập sự sẽ được đào tạo thao tác phân tích công cụ và kiểm soát an toàn phòng thí nghiệm.\n\nTrách nhiệm chính:\n- Chuẩn bị dụng cụ thủy tinh, pha chế các dung dịch chuẩn độ, dung dịch đệm và hóa chất thuốc thử phục vụ phân tích.\n- Thực hiện các phép phân tích hóa lý cơ bản: chuẩn độ thể tích, đo quang phổ hấp thụ phân tử (UV-Vis), đo pH và độ dẫn điện.\n- Tuân thủ nghiêm ngặt các quy tắc an toàn hóa chất, thu gom phân loại chất thải nguy hại và xử lý sự cố tràn đổ hóa chất.\n- Ghi chép số liệu đo lường, tính toán sai số, giới hạn phát hiện (LOD/LOQ) và lập báo cáo kết quả phân tích theo tiêu chuẩn ISO 17025.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.000.000 VNĐ/tháng, cấp đồng phục phòng thí nghiệm, kính bảo hộ và găng tay chuyên dụng.\n- Được đào tạo bài bản về quản lý chất lượng phòng thí nghiệm và quy trình an toàn hóa chất chuẩn quốc gia.\n- Cung cấp hóa chất và thiết bị phân tích miễn phí để sinh viên thực hiện đề tài nghiên cứu khoa học hoặc khóa luận tốt nghiệp.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên ngành Hóa học; có niềm say mê với công việc phân tích thực nghiệm và nghiên cứu hóa học ứng dụng.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững các kỹ năng: Phân tích hóa học, Thiết kế thí nghiệm, Quản lý chất lượng phòng thí nghiệm và Quy tắc an toàn hóa chất.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Thao tác cân đong chuẩn xác, tính cẩn thận, trung thực với kết quả đo và tôn trọng các quy chuẩn an toàn lao động.`,
      };

    case 35:
      return {
        title:
          'Fintech Product & Quantitative Data Trainee — Khối Công nghệ Tài chính',
        publisher:
          'Công ty Cổ phần Công nghệ Tài chính & Phân tích Dữ liệu VinaFintech',
        description: `## Mô tả thực tập\nVinaFintech là công ty khởi nghiệp công nghệ tài chính cung cấp các giải pháp thanh toán số và chấm điểm tín dụng tự động. Vị trí Fintech Trainee giúp bạn ứng dụng khoa học dữ liệu và lập trình vào các sản phẩm dịch vụ tài chính hiện đại.\n\nTrách nhiệm chính:\n- Sử dụng Python và thư viện Pandas/NumPy để làm sạch và xử lý dữ liệu lớn về hành vi giao dịch và thanh toán số.\n- Viết các truy vấn SQL nâng cao để trích xuất dữ liệu từ các kho dữ liệu (Data Warehouse) phục vụ xây dựng mô hình rủi ro.\n- Tham gia phân tích hành vi người dùng, đánh giá các chỉ số chuyển đổi sản phẩm tài chính và hỗ trợ đội ngũ Product Manager.\n- Xây dựng các script tự động hóa kiểm tra dữ liệu và theo dõi biến động các chỉ số vận hành giao dịch ví điện tử.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập hấp dẫn từ 5.000.000 VNĐ đến 7.000.000 VNĐ/tháng theo năng lực lập trình và phân tích.\n- Môi trường làm việc Fintech năng động, làm việc theo mô hình Hybrid linh hoạt giữa văn phòng và từ xa.\n- Được tiếp cận các công nghệ tài chính tiên tiến: Machine Learning trong Credit Scoring, Open Banking API.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên ngành Công nghệ tài chính, Khoa học dữ liệu hoặc Hệ thống thông tin; đam mê đổi mới sáng tạo trong ngành tài chính.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Thành thạo lập trình Python và truy vấn SQL; nắm vững kiến thức về sản phẩm tài chính số và phương pháp phân tích dữ liệu.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tư duy logic nhạy bén, khả năng tự nghiên cứu công nghệ mới nhanh chóng và có tinh thần trách nhiệm cao.`,
      };

    case 36:
      return {
        title:
          'Biên dịch viên Tiếng Hàn Thương mại (TOPIK 5+) & Điều phối Dự án Đa ngữ',
        publisher:
          'Trung tâm Hợp tác Đào tạo & Dịch thuật Quốc tế GlobalBridge',
        description: `## Mô tả thực tập\nGlobalBridge là đơn vị chuyên dịch thuật hồ sơ thương mại, bản địa hóa phần mềm và kết nối doanh nghiệp Việt - Hàn. Vị trí biên dịch viên trực tuyến mở cơ hội cho các bạn sinh viên tiếng Hàn rèn giũa ngòi bút dịch thuật chuyên nghiệp.\n\nTrách nhiệm chính:\n- Biên dịch các tài liệu kinh doanh, hợp đồng thương mại, tài liệu giới thiệu sản phẩm và quy trình kỹ thuật Hàn - Việt - Hàn.\n- Kiểm tra tính nhất quán của thuật ngữ chuyên ngành kinh tế và văn phong tiếng Hàn thương mại trên các bản thảo dịch.\n- Hỗ trợ điều phối tiến độ các dự án dịch thuật đa ngôn ngữ, phân chia công việc cho cộng tác viên và tổng hợp sản phẩm.\n- Tham gia xây dựng cơ sở dữ liệu thuật ngữ chuyên ngành (Termbase) và bộ nhớ dịch (Translation Memory).\n\n## Quyền lợi và hỗ trợ\n- Làm việc hoàn toàn trực tuyến (Online), tự chủ thời gian làm việc phù hợp với lịch học đại học.\n- Nhuận bút thực tập hấp dẫn từ 4.500.000 VNĐ đến 6.000.000 VNĐ/tháng theo khối lượng bản dịch hoàn thành đạt chuẩn.\n- Được đào tạo kỹ năng sử dụng thành thạo các phần mềm hỗ trợ dịch thuật hiện đại (Trados, MemoQ).`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Trình độ tiếng Hàn tương đương TOPIK 5 hoặc TOPIK 6; văn phong tiếng Việt trôi chảy, trong sáng.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Thành thạo kỹ năng: Tiếng Hàn, Phiên dịch/Biên dịch và Biên tập nội dung đa ngôn ngữ chính xác, tự nhiên.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tính cẩn trọng cao, tôn trọng hạn chót bàn giao tài liệu và bảo mật thông tin kinh doanh của đối tác.`,
      };

    case 37:
      return {
        title:
          'Giáo viên Mầm non Tập sự — Phương pháp Tiếp cận Trẻ sớm Montessori & Reggio Emilia',
        publisher: 'Hệ thống Trường Mầm non Quốc tế Thực nghiệm Tương Lai Xanh',
        description: `## Mô tả thực tập\nTương Lai Xanh xây dựng môi trường mầm non theo triết lý tôn trọng sự phát triển tự nhiên của trẻ nhỏ kết hợp các phương pháp giáo dục sớm quốc tế. Giáo viên tập sự sẽ được trực tiếp chăm sóc và hướng dẫn trẻ học tập qua vui chơi.\n\nTrách nhiệm chính:\n- Tham gia xây dựng kế hoạch giảng dạy tuần/tháng tích hợp các hoạt động trải nghiệm giác quan và vận động tinh.\n- Hỗ trợ giáo viên chính quản lý lớp học mầm non, tổ chức các giờ học theo góc hoạt động (Montessori/Reggio Emilia).\n- Quan sát, ghi chép nhật ký phát triển tâm lý, ngôn ngữ và thể chất của từng trẻ theo các mốc phát triển chuẩn.\n- Phối hợp chăm sóc nền nếp sinh hoạt, giờ ăn, giấc ngủ trưa và đảm bảo môi trường an toàn tuyệt đối cho trẻ nhỏ.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 3.500.000 VNĐ đến 4.800.000 VNĐ/tháng, phụ cấp ăn trưa miễn phí tại trường mầm non.\n- Được tham gia các khóa đào tạo chuyên sâu về phương pháp giáo dục sớm quốc tế có cấp chứng chỉ nội bộ.\n- Hỗ trợ đóng dấu mộc thực tập chuẩn sư phạm và cơ hội ký hợp đồng giáo viên chính thức sau khi tốt nghiệp.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên ngành Giáo dục Mầm non; có tình yêu thương trẻ thơ sâu sắc, tính kiên nhẫn và tác phong dịu dàng.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ năng xây dựng kế hoạch giảng dạy mầm non, kỹ năng quản lý lớp học và quan sát đánh giá sự phát triển của trẻ.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Giọng nói truyền cảm, có năng khiếu múa hát hoặc làm đồ chơi mầm non sáng tạo; luôn chu đáo và có tinh thần trách nhiệm cao.`,
      };

    case 38:
      return {
        title:
          'Kỹ sư Chăn nuôi Kỹ thuật cao & Quản lý An toàn Sinh học Trang trại Tập sự',
        publisher:
          'Tập đoàn Nông nghiệp & Trang trại Thực phẩm Sạch Nhiệt Đới Xanh',
        description: `## Mô tả thực tập\nNhiệt Đới Xanh sở hữu chuỗi trang trại chăn nuôi khép kín công nghệ cao theo tiêu chuẩn 3F (Feed - Farm - Food). Kỹ sư tập sự sẽ tham gia kiểm soát quy trình an toàn sinh học, dinh dưỡng vật nuôi và giám sát chất lượng sản xuất tại trang trại.\n\nTrách nhiệm chính:\n- Theo dõi và thực hiện nghiêm ngặt các quy định an toàn sinh học tại cổng trang trại, khu chuồng nuôi và khu sát trùng.\n- Tham gia kiểm soát khẩu phần thức ăn, theo dõi mức độ tiêu thụ thức ăn (FCR) và tốc độ tăng trọng định kỳ của đàn vật nuôi.\n- Hỗ trợ kỹ thuật viên thú y trong công tác tiêm phòng vắc-xin, theo dõi sức khỏe tổng quát và phòng ngừa dịch bệnh.\n- Thực hiện kiểm soát chất lượng (QC) nguồn nước uống, không khí chuồng trại và quy trình thu gom xử lý chất thải biogas.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.500.000 VNĐ/tháng, cung cấp chỗ ở và suất ăn miễn phí tại ký túc xá khu phức hợp trang trại.\n- Được hướng dẫn trực tiếp bởi Giám đốc Kỹ thuật Trang trại có hơn 15 năm kinh nghiệm chăn nuôi công nghiệp quy mô lớn.\n- Tài trợ số liệu và hỗ trợ hoàn thiện đề tài khóa luận tốt nghiệp kỹ sư chăn nuôi.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên chuyên ngành Chăn nuôi hoặc Chăn nuôi - Thú y; sẵn sàng làm việc tại khu liên hợp trang trại công nghệ cao.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Nắm vững kỹ năng: An toàn sinh học trang trại, Kiểm soát chất lượng (QC) chuồng trại và Quản lý sản xuất nông nghiệp.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Sức khỏe tốt, tính kỷ luật cao, không ngại công việc thực địa chuồng trại và có tinh thần gắn bó với ngành nông nghiệp.`,
      };

    case 39:
      return {
        title:
          'Điều dưỡng viên Lâm sàng Tập sự — Thực hành Chăm sóc Bệnh nhân & Y tế Dự phòng',
        publisher:
          'Hệ thống Phòng khám & Chăm sóc Y tế Gia đình Phương Đông Health',
        description: `## Mô tả thực tập\nPhương Đông Health cung cấp dịch vụ y tế gia đình và chăm sóc bệnh nhân toàn diện. Vị trí tập sự giúp sinh viên điều dưỡng rèn luyện kỹ năng lâm sàng chuẩn y khoa, giao tiếp đồng cảm và theo dõi diễn biến người bệnh từ xa và tại cơ sở y tế.\n\nTrách nhiệm chính:\n- Thực hành các kỹ thuật điều dưỡng cơ bản: đo dấu hiệu sinh tồn, thay băng, rửa vết thương và chăm sóc người bệnh nội/ngoại trú.\n- Tham gia xây dựng kế hoạch chăm sóc điều dưỡng cá nhân hóa cho người bệnh mắc bệnh mạn tính (tăng huyết áp, đái tháo đường).\n- Hướng dẫn người bệnh và người nhà thực hiện đúng y lệnh thuốc, chế độ dinh dưỡng và các biện pháp phục hồi chức năng.\n- Hỗ trợ ghi chép hồ sơ điều dưỡng, theo dõi phản ứng sau điều trị và hỗ trợ tư vấn y tế dự phòng trực tuyến.\n\n## Quyền lợi và hỗ trợ\n- Làm việc kết hợp từ xa và tại phòng khám (Online/Hybrid), phụ cấp thực tập từ 3.500.000 VNĐ đến 5.000.000 VNĐ/tháng.\n- Được hướng dẫn 1-1 bởi Điều dưỡng trưởng giàu kinh nghiệm, rèn luyện kỹ năng thực hành lâm sàng chuẩn Bộ Y tế.\n- Cấp giấy xác nhận hoàn thành thực tập điều dưỡng lâm sàng phục vụ hoàn thiện hồ sơ xin cấp chứng chỉ hành nghề.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên Điều dưỡng năm 3, năm 4; có thái độ ân cần, yêu nghề chăm sóc sức khỏe và tinh thần phục vụ người bệnh.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Thành thạo các kỹ năng: Thực hành điều dưỡng cơ bản, Kỹ thuật chăm sóc người bệnh và Kỹ năng giao tiếp điều dưỡng.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tác phong nhẹ nhàng, lắng nghe đồng cảm, cẩn trọng trong từng thủ thuật y tế và tôn trọng y đức.`,
      };

    case 40:
      return {
        title:
          'Hospitality Management Trainee — Tiền sảnh (Front Office) & Trải nghiệm Du khách',
        publisher:
          'Tập đoàn Khách sạn & Khu Nghỉ dưỡng Cao cấp Đại Nam Heritage',
        description: `## Mô tả thực tập\nĐại Nam Heritage quản lý chuỗi khách sạn và resort 5 sao mang đậm bản sắc văn hóa di sản. Management Trainee sẽ được luân chuyển và đào tạo thực tế tại bộ phận Tiền sảnh (Front Office), rèn luyện kỹ năng cung ứng dịch vụ hiếu khách chuẩn mực quốc tế.\n\nTrách nhiệm chính:\n- Thực hành vận hành phần mềm quản lý khách sạn chuyên dụng (PMS: Opera/Smile) để thực hiện thủ tục Check-in, Check-out.\n- Tiếp nhận, xử lý các yêu cầu đặt phòng (reservation), điều phối sắp xếp phòng theo sở thích đặc biệt của khách hàng.\n- Chào đón, hướng dẫn thông tin du lịch địa phương và giải quyết linh hoạt các yêu cầu phát sinh của du khách trong kỳ nghỉ.\n- Phối hợp chặt chẽ với bộ phận Buồng phòng (Housekeeping) và Ẩm thực (F&B) nhằm đảm bảo tiêu chuẩn dịch vụ hoàn hảo.\n\n## Quyền lợi và hỗ trợ\n- Phụ cấp thực tập từ 4.000.000 VNĐ đến 6.000.000 VNĐ/tháng + thưởng phí dịch vụ (service charge) hàng tháng.\n- Được cấp đồng phục cao cấp, hỗ trợ 02 bữa ăn/ca làm việc tại nhà hàng nhân viên và hỗ trợ chỗ ở tại khu nghỉ dưỡng.\n- Cơ hội được ký hợp đồng chính thức vào vị trí Chuyên viên Tiền sảnh hoặc Trợ lý Quản lý Ca sau kỳ thực tập.`,
        requirements: `## Đối tượng thực tập\n- ${yearsText} chuyên ngành ${majorsList}.\n- Sinh viên ngành Quản trị khách sạn; ngoại hình chỉn chu, tươi tắn, có định hướng trở thành nhà quản lý khách sạn chuyên nghiệp.\n- Sẵn sàng học hỏi, có tinh thần cầu tiến và tinh thần trách nhiệm trong công việc.\n\n## Yêu cầu\n- Sử dụng thành thạo phần mềm quản lý khách sạn (PMS), tiếng Anh giao tiếp lưu loát, kỹ năng quản lý đặt phòng và dịch vụ khách hàng.\n- Có kỹ năng thực hành và kiến thức chuyên môn: ${skillsList}.\n- Tác phong hiếu khách, nụ cười thân thiện, khả năng xử lý tình huống khéo léo và chịu được áp lực mùa cao điểm du lịch.`,
      };

    default:
      throw new Error(`Unexpected internship ID: ${id}`);
  }
}

// Function to generate dynamic, realistic, tailored content for IDs 41-75 (Jobs)
function generateDynamicRealisticContent(
  id,
  type,
  majors,
  skills,
  yearsText,
  locText,
  workFormat,
) {
  const majorsList = majors.join(', ');
  const skillsList = skills.join('; ');
  const primaryMajor = majors[0];

  let publisher = 'Tổ chức Phát triển Tri thức & Hợp tác Doanh nghiệp';
  let title = '';
  let intro = '';
  let resp = '';
  let ben = '';

  const level = id % 2 === 0 ? 'Junior' : 'Fresher';
  if (
    primaryMajor.includes('Kinh tế') ||
    primaryMajor.includes('Kinh doanh') ||
    primaryMajor.includes('Quản trị') ||
    primaryMajor.includes('Tài chính') ||
    primaryMajor.includes('Marketing') ||
    primaryMajor.includes('Kiểm toán') ||
    primaryMajor.includes('Logistics')
  ) {
    publisher = `Tập đoàn Dịch vụ Thương mại & Tài chính ${pickName(id, ['Việt Á Fin', 'Hải Đăng Commerce', 'Thịnh Vượng Corp', 'Đông Dương Logistics', 'An Phát Group'])}`;
    title = `Nhân viên ${getRoleName(primaryMajor, skills, id)} (${level})`;
  } else if (
    primaryMajor.includes('thông tin') ||
    primaryMajor.includes('phần mềm') ||
    primaryMajor.includes('máy tính') ||
    primaryMajor.includes('Dữ liệu') ||
    primaryMajor.includes('Trí tuệ nhân tạo') ||
    primaryMajor.includes('An toàn thông tin')
  ) {
    publisher = `Công ty Cổ phần Giải pháp Công nghệ & An ninh mạng ${pickName(id, ['NetShield', 'DataMind', 'SoftVina', 'CloudNexus', 'CyberSafe', 'AiTech'])}`;
    title = `Kỹ sư ${getRoleName(primaryMajor, skills, id)} (${level})`;
  } else if (
    primaryMajor.includes('điện') ||
    primaryMajor.includes('Cơ khí') ||
    primaryMajor.includes('Tự động') ||
    primaryMajor.includes('Xây dựng') ||
    primaryMajor.includes('Ô tô') ||
    primaryMajor.includes('Môi trường') ||
    primaryMajor.includes('Địa chất')
  ) {
    publisher = `Công ty Cổ phần Xây dựng & Kỹ thuật Công nghiệp ${pickName(id, ['Bình Minh Engineering', 'Nam Việt Tech', 'Cơ điện Đông Á', 'Việt Hàn Industrial', 'Hạ tầng Thăng Long'])}`;
    title = `Kỹ sư ${getRoleName(primaryMajor, skills, id)} (${level})`;
  } else if (
    primaryMajor.includes('Y') ||
    primaryMajor.includes('Dược') ||
    primaryMajor.includes('Sinh học') ||
    primaryMajor.includes('Thú y')
  ) {
    publisher = `Trung tâm Nghiên cứu Y Dược & Chẩn đoán Kỹ thuật cao ${pickName(id, ['BioMed Hải Ngoại', 'Việt Đức Lab', 'Hoàn Mỹ Diagnostics', 'Tân Dược Biotech'])}`;
    title = `Kỹ thuật viên ${getRoleName(primaryMajor, skills, id)} (${level})`;
  } else if (
    primaryMajor.includes('Sư phạm') ||
    primaryMajor.includes('Báo chí') ||
    primaryMajor.includes('Truyền thông') ||
    primaryMajor.includes('Văn học') ||
    primaryMajor.includes('Triết học')
  ) {
    publisher = `Tổ chức Truyền thông, Đào tạo & Xuất bản ${pickName(id, ['Bút Vàng Media', 'Văn Hóa Mới', 'Phương Nam Communications', 'Học viện Tương Lai'])}`;
    title = `Chuyên viên ${getRoleName(primaryMajor, skills, id)} (${level})`;
  } else {
    publisher = `Công ty Dịch vụ Doanh nghiệp & Phát triển Nguồn lực ${pickName(id, ['Nam Á', 'Đông Đô', 'Vạn Phát', 'Thái Dương'])}`;
    title = `Chuyên viên ${getRoleName(primaryMajor, skills, id)} (${level})`;
  }

  intro = `Chúng tôi đang mở rộng đội ngũ và tìm kiếm nhân sự cấp độ ${level} nhiệt huyết cho vị trí chuyên trách ngành ${majorsList}. Ứng viên sẽ trực tiếp đảm nhận các nhiệm vụ chuyên môn và tham gia các dự án phát triển của công ty ${locText}.`;
  resp = `- Thực hiện các công việc chuyên môn hằng ngày theo quy chuẩn hoạt động của phòng ban.
- Ứng dụng thành thạo: ${skillsList} nhằm tối ưu hóa năng suất và chất lượng công việc.
- Phối hợp liên phòng ban để giải quyết các vấn đề phát sinh và cải tiến quy trình.
- Lập báo cáo tiến độ và tham gia các buổi đánh giá định kỳ cùng quản lý trực tiếp.`;
  ben = `- Mức lương cạnh tranh theo năng lực, chế độ thưởng hiệu quả công việc và tháng lương thứ 13.
- Đầy đủ chế độ bảo hiểm theo quy định pháp luật và gói bảo hiểm chăm sóc sức khỏe.
- Lộ trình thăng tiến rõ ràng, được tài trợ các khóa đào tạo nâng cao chuyên môn.`;

  return {
    title,
    publisher,
    description: `## Mô tả công việc
${intro}

Nhiệm vụ và trách nhiệm chính:
${resp}

## Quyền lợi và đãi ngộ
${ben}`,
    requirements: `## Yêu cầu kinh nghiệm
- Cấp độ vị trí: ${level}. ${level === 'Fresher' ? 'Chào đón sinh viên năm cuối hoặc cử nhân mới tốt nghiệp có nền tảng vững chắc.' : 'Yêu cầu từ 1 năm kinh nghiệm làm việc thực tế hoặc hoàn thành xuất sắc các dự án/đồ án chuyên ngành.'}
- Có kinh nghiệm tham gia các dự án thực tế hoặc đồ án tốt nghiệp chuyên ngành ${primaryMajor}.

## Yêu cầu ứng viên
- Tốt nghiệp đại học chuyên ngành ${majorsList} (${yearsText}).
- Thành thạo hoặc có kinh nghiệm ứng dụng thực tế các kỹ năng: ${skillsList}.
- Nắm vững kiến thức chuyên môn, có khả năng làm việc độc lập và phối hợp liên phòng ban tốt.
- Tác phong chuyên nghiệp, kỷ luật và tinh thần trách nhiệm cao trong công việc.`,
  };
}

function buildScholarshipContent(id, majors, skills, yearsText, locText) {
  const majorsList = majors.join(', ');
  const skillsList = skills.join('; ');

  switch (id) {
    case 76:
      return {
        title:
          'Chương trình Tài trợ Sáng kiến Đổi mới Phương pháp Giảng dạy Tin học Phổ thông',
        publisher: 'Quỹ Đổi mới Giáo dục & Công nghệ Học đường EduNext',
        description: `## Giới thiệu học bổng
Chương trình tài trợ thường niên của Quỹ EduNext nhằm khuyến khích sinh viên ngành ${majorsList} nghiên cứu và thử nghiệm các phương pháp sư phạm hiện đại. Chương trình tập trung thúc đẩy việc ứng dụng ngôn ngữ lập trình trực quan và nền tảng công nghệ giáo dục vào trường phổ thông, giúp học sinh tiếp cận tư duy máy tính một cách hào hứng và hiệu quả.

Sinh viên nhận học bổng sẽ được tham gia chuỗi hội thảo chuyên đề về chuyển đổi số giáo dục và kết nối cùng các chuyên gia sư phạm hàng đầu.

## Giá trị học bổng
- Mức tài trợ học tập và phát triển dự án: 15.000.000 VNĐ/suất trao trực tiếp cho sinh viên.
- Tài trợ 100% kinh phí tham gia khóa bồi dưỡng nghiệp vụ sư phạm số và phương pháp giảng dạy tích hợp STEAM.
- Cơ hội được quỹ bảo trợ kinh phí triển khai thử nghiệm giáo án số tại các trường trung học cơ sở đối tác.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList} tại các trường đại học sư phạm trên toàn quốc.
- Điểm trung bình tích lũy học tập (GPA) từ 2.8/4.0 trở lên tính đến học kỳ gần nhất.
- Có năng lực và sản phẩm minh chứng về: ${skillsList}.
- Ưu tiên ứng viên có đề xuất sáng kiến hoặc bài giảng mẫu ứng dụng công nghệ tương tác trong lớp học.

## Hồ sơ cần chuẩn bị
- Đơn xin cấp học bổng theo mẫu trực tuyến của Quỹ EduNext, nêu rõ định hướng nghề nghiệp giáo viên.
- Bảng điểm học tập chính thức có xác nhận của phòng đào tạo nhà trường.
- Đề cương tóm tắt sáng kiến hoặc kế hoạch bài dạy môn Tin học (không quá 3 trang A4).
- Bản sao thẻ sinh viên và căn cước công dân còn thời hạn hiệu lực.

## Hướng dẫn đăng ký
- Bước 1: Hoàn thiện hồ sơ điện tử định dạng PDF và nộp qua cổng tiếp nhận của chương trình học bổng.
- Bước 2: Ban chuyên môn sư phạm tiến hành thẩm định kế hoạch bài giảng và phỏng vấn trực tuyến ứng viên vòng 2.
- Bước 3: Công bố danh sách sinh viên được trao học bổng trên bản tin học đường và tổ chức lễ trao giải thường niên.`,
      };

    case 77:
      return {
        title:
          'Học bổng Hỗ trợ Nghiên cứu Địa tin học & Số hóa Dữ liệu Đất đai',
        publisher: 'Viện Địa chính Ứng dụng & Phát triển Không gian GeoLand',
        description: `## Giới thiệu học bổng
Học bổng GeoLand được thành lập nhằm bồi dưỡng các chuyên gia tương lai trong lĩnh vực quản lý tài nguyên và quy hoạch sử dụng đất. Chương trình hướng tới việc thúc đẩy sinh viên làm chủ công nghệ không gian địa lý (GIS/QGIS), phục vụ số hóa bản đồ địa chính, giám sát biến động tài nguyên và xây dựng cơ sở dữ liệu đất đai đa mục tiêu.

Các sinh viên được chọn sẽ có cơ hội tiếp cận kho tư liệu viễn thám thực tế và tham gia dự án thực địa cùng đội ngũ kỹ sư quy hoạch của Viện.

## Giá trị học bổng
- Học bổng tài trợ sinh hoạt phí và học phí trị giá 12.000.000 VNĐ/suất.
- Cấp quyền truy cập 1 năm vào thư viện dữ liệu bản đồ chuyên đề và ảnh viễn thám độ phân giải cao phục vụ đồ án.
- Tài trợ chi phí in ấn bản đồ khổ lớn và kinh phí khảo sát thực địa trong giai đoạn thực hiện khóa luận tốt nghiệp.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} theo học chính quy ngành ${majorsList} hoặc Địa chính - Quản lý tài nguyên.
- Điểm học phần các môn Trắc địa, Hệ thống thông tin địa lý và Quy hoạch đất đai đạt loại Khá trở lên.
- Thành thạo công cụ phân tích không gian và phần mềm chuyên môn: ${skillsList}.
- Có tinh thần nghiên cứu nghiêm túc, trung thực và đam mê ứng dụng công nghệ vào quản lý công.

## Hồ sơ cần chuẩn bị
- Sơ yếu lý lịch học thuật kèm tóm tắt quá trình học tập và kỹ năng phần mềm bản đồ.
- Bảng điểm tích lũy có dấu mộc xác nhận của trường đại học đang theo học.
- Một sản phẩm bản đồ chuyên đề hoặc bài tập lớn phân tích dữ liệu không gian do chính sinh viên thực hiện.
- Thư giới thiệu của giảng viên hướng dẫn chuyên ngành.

## Hướng dẫn đăng ký
- Ứng viên nộp toàn bộ hồ sơ bản mềm kèm file dự án bản đồ qua cổng học bổng trực tuyến.
- Hội đồng khoa học đánh giá năng lực xử lý dữ liệu không gian và tính ứng dụng của đề tài sinh viên.
- Lễ trao học bổng và tiếp nhận đề tài nghiên cứu được tổ chức tại văn phòng đại diện của Viện GeoLand.`,
      };

    case 78:
      return {
        title:
          'Chương trình Học bổng Nâng cao Năng lực Kỹ thuật Chẩn đoán Hình ảnh Y khoa',
        publisher: 'Quỹ Phát triển Kỹ thuật Y tế Lâm sàng MediScan',
        description: `## Giới thiệu học bổng
Quỹ MediScan đồng hành cùng các trường đại học y dược trong sứ mệnh nâng cao chất lượng nhân lực y tế kỹ thuật cao. Chương trình học bổng này hướng tới sinh viên ngành ${majorsList} có đạo đức nghề nghiệp tốt, nắm vững quy chuẩn an toàn bức xạ và mong muốn nâng cao tay nghề thực hành cận lâm sàng tại các bệnh viện tuyến đầu.

Sinh viên nhận học bổng được cố vấn trực tiếp bởi các kỹ thuật viên hình ảnh trưởng và bác sĩ chuyên khoa chẩn đoán hình ảnh.

## Giá trị học bổng
- Suất học bổng chuyên môn trị giá 18.000.000 VNĐ cho mỗi sinh viên được chọn.
- Bảo trợ toàn bộ chi phí thực tập lâm sàng, đo liều kế cá nhân và đồng phục y tế tại các cơ sở thực hành.
- Ưu tiên xét tuyển tham gia các khóa đào tạo chuyển giao kỹ thuật cộng hưởng từ (MRI) và cắt lớp vi tính (CT) nâng cao.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} đang theo học ngành ${majorsList} hệ chính quy tại các trường đại học y dược.
- Điểm trung bình các học phần giải phẫu, bệnh học và kỹ thuật tạo ảnh y học đạt loại Giỏi hoặc Khá cao.
- Nắm vững kiến thức chuyên môn cốt lõi: ${skillsList}.
- Có phẩm chất đạo đức y đức chuẩn mực, tôn trọng quyền riêng tư của bệnh nhân và tuân thủ kỷ luật phòng bệnh.

## Hồ sơ cần chuẩn bị
- Phiếu đăng ký học bổng kèm thư trình bày nguyện vọng theo đuổi chuyên ngành kỹ thuật y học lâm sàng.
- Bảng điểm quá trình học tập có xác nhận của phòng đào tạo trường y.
- Bản sao chứng chỉ an toàn bức xạ y tế hoặc xác nhận hoàn thành học phần liên quan (nếu có).
- Nhận xét đánh giá ý thức học tập và tác phong lâm sàng từ giảng viên phụ trách bộ môn.

## Hướng dẫn đăng ký
- Ứng viên gửi hồ sơ qua hệ thống tiếp nhận trực tuyến của Quỹ MediScan theo hướng dẫn quy chuẩn.
- Ban chuyên môn tổ chức vòng phỏng vấn tình huống lâm sàng và kiểm tra nhận thức an toàn bức xạ y tế.
- Quyết định cấp học bổng được công bố công khai và gửi thông báo trực tiếp đến khoa chuyên môn của ứng viên.`,
      };

    case 79:
      return {
        title:
          'Quỹ Học bổng Tài năng Trẻ Kiểm toán & Chuẩn mực Kế toán Doanh nghiệp',
        publisher: 'Hiệp hội Đào tạo Nghề nghiệp & Kiểm toán Thực hành AccoPro',
        description: `## Giới thiệu học bổng
AccoPro là tổ chức nghề nghiệp chuyên hỗ trợ sinh viên kế toán - kiểm toán tiếp cận chuẩn mực thực hành doanh nghiệp. Chương trình học bổng được thiết kế nhằm khích lệ tinh thần học tập gương mẫu, tính cẩn trọng và tư duy phân tích số liệu tài chính của sinh viên ngành ${majorsList}, chuẩn bị nền tảng vững chắc cho lộ trình trở thành kế toán viên công chứng.

Bên cạnh hỗ trợ tài chính, sinh viên còn được tham gia sinh hoạt chuyên môn định kỳ với các kiểm toán viên hành nghề.

## Giá trị học bổng
- Mức học bổng khuyến học trị giá 10.000.000 VNĐ/suất hỗ trợ học tập.
- Tài trợ 100% học phí khóa bồi dưỡng thực hành lập báo cáo tài chính theo Chuẩn mực kế toán Việt Nam (VAS).
- Suất thực tập ưu tiên tại các doanh nghiệp đối tác hàng đầu trong mạng lưới của Hiệp hội AccoPro.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Kế toán - Kiểm toán hoặc Kế toán doanh nghiệp.
- Điểm học phần Nguyên lý kế toán và Kế toán tài chính đạt từ 7.5/10 (hoặc tương đương điểm B+) trở lên.
- Nắm chắc kiến thức và kỹ năng thực hành: ${skillsList}.
- Đức tính trung thực, tính kỷ luật cao, tư duy số liệu cẩn trọng và tỉ mỉ.

## Hồ sơ cần chuẩn bị
- Đơn xin xét cấp học bổng theo mẫu phát hành của Hiệp hội AccoPro.
- Bảng điểm học tập các kỳ gần nhất có dấu xác nhận của trường đại học.
- Một bài viết ngắn (dưới 800 từ) chia sẻ góc nhìn về đạo đức nghề nghiệp của người làm kế toán trong bối cảnh số hóa.
- Bản sao các chứng chỉ ngoại ngữ hoặc tin học văn phòng đã đạt được (nếu có).

## Hướng dẫn đăng ký
- Ứng viên hoàn thiện hồ sơ và gửi về ban tuyển chọn qua hòm thư điện tử chính thức của Quỹ.
- Hội đồng xét duyệt kiểm tra hồ sơ và đánh giá qua bài kiểm tra trắc nghiệm tình huống chuẩn mực kế toán ngắn.
- Lễ công bố và vinh danh học bổng được tổ chức trang trọng tại ngày hội nghề nghiệp thường niên.`,
      };

    case 80:
      return {
        title:
          'Chương trình Tài trợ Thiết kế Phần cứng & Hệ thống Nhúng Năng lượng Thấp',
        publisher: 'Trung tâm Nghiên cứu Vi mạch & Phần cứng Nhúng EmbeddedLab',
        description: `## Giới thiệu học bổng
Chương trình tài trợ EmbeddedLab nhằm hỗ trợ sinh viên ngành ${majorsList} phát triển các dự án phần cứng thực chiến, từ thiết kế schematic, layout bo mạch in đến xây dựng hệ điều hành nhúng tối ưu. Chương trình hướng tới các ý tưởng thiết bị biên thông minh, cảm biến công nghiệp và giải pháp tiết kiệm năng lượng.

Sinh viên được nhận tài trợ sẽ được làm việc trực tiếp tại lab phần cứng với đầy đủ thiết bị đo kiểm cao cấp.

## Giá trị học bổng
- Gói tài trợ kinh phí đồ án và học bổng khuyến khích trị giá 20.000.000 VNĐ/dự án.
- Tài trợ chi phí gia công PCB nhiều lớp, hàn linh kiện dán (SMD) và linh kiện bán dẫn mẫu thử.
- Cấp quyền truy cập hệ thống máy chủ biên Linux và không gian làm việc kỹ thuật cao tại lab nghiên cứu.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} ngành ${majorsList} hoặc Kỹ thuật điện tử máy tính đang thực hiện đề tài tốt nghiệp hoặc NCKH.
- Có điểm số học phần Kiến trúc máy tính và Hệ thống nhúng đạt kết quả tốt.
- Thành thạo kiến thức kỹ thuật: ${skillsList}.
- Có khả năng đọc hiểu tài liệu datasheet bán dẫn bằng tiếng Anh và tự chủ nghiên cứu thử nghiệm.

## Hồ sơ cần chuẩn bị
- Bản đề xuất đề tài/dự án phần cứng nhúng (mục tiêu kỹ thuật, sơ đồ khối, giải pháp linh kiện và dự toán).
- Sơ yếu lý lịch học thuật kèm danh sách các dự án mạch hoặc code nguồn đã từng thực hiện trên GitHub.
- Bảng điểm tích lũy học tập do trường đại học cấp.
- Ý kiến bảo trợ hoặc nhận xét ngắn của giảng viên hướng dẫn chuyên môn.

## Hướng dẫn đăng ký
- Nộp hồ sơ và đề cương dự án định dạng PDF qua cổng đăng ký tài trợ của EmbeddedLab.
- Ban chuyên gia kỹ thuật mời các nhóm ứng viên đạt yêu cầu tham gia buổi thuyết trình bảo vệ phương án kỹ thuật.
- Ký hợp đồng tài trợ và giải ngân theo từng mốc tiến độ hoàn thành mạch mẫu thử nghiệm.`,
      };

    case 81:
      return {
        title:
          'Giải thưởng Khuyến khích Đề tài Nghiên cứu Hóa học Phân tích & Tách chiết',
        publisher: 'Viện Nghiên cứu Hóa chất Ứng dụng & Dược liệu VinaChem',
        description: `## Giới thiệu học bổng
Giải thưởng VinaChem được tổ chức nhằm tôn vinh và tiếp sức cho các sinh viên ${majorsList} có niềm say mê nghiên cứu trong lĩnh vực hóa phân tích, tổng hợp hữu cơ và kỹ thuật chiết tách hoạt chất sinh học. Chương trình tạo điều kiện tối đa cho sinh viên hoàn thiện các đề tài có tiềm năng ứng dụng trong sản xuất công nghiệp và kiểm nghiệm chất lượng.

Đề tài đạt giải có cơ hội được hỗ trợ hoàn thiện quy trình để đăng ký bằng độc quyền giải pháp hữu ích.

## Giá trị học bổng
- Giải thưởng tài trợ nghiên cứu và khuyến khích học tập trị giá 14.000.000 VNĐ/suất.
- Hỗ trợ toàn bộ hóa chất tinh khiết và chi phí phân tích sắc ký HPLC, GC-MS tại trung tâm phân tích của Viện.
- Cơ hội được nhận làm trợ lý nghiên cứu có hưởng lương tại các đề tài cấp Bộ do Viện chủ trì.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Hóa học ứng dụng hoặc Kỹ thuật chế biến dầu khí.
- Điểm trung bình tích lũy đạt từ Khá trở lên, hoàn thành tốt các học phần thực hành thí nghiệm hóa phân tích.
- Nắm vững các kỹ năng thực hành và vận hành thiết bị: ${skillsList}.
- Tuân thủ nghiêm ngặt quy chế an toàn hóa chất phòng thí nghiệm và tác phong làm việc khoa học.

## Hồ sơ cần chuẩn bị
- Thuyết minh tóm tắt đề tài nghiên cứu (nêu rõ tính cấp thiết, phương pháp thực nghiệm và thiết bị cần dùng).
- Bảng điểm đại học chính quy cập nhật đến kỳ học gần nhất.
- Báo cáo kết quả thử nghiệm sơ bộ hoặc nhật ký phòng thí nghiệm liên quan đến đề tài.
- Thư nhận xét và bảo trợ của trưởng nhóm nghiên cứu hoặc giảng viên trực tiếp hướng dẫn.

## Hướng dẫn đăng ký
- Ứng viên gửi thuyết minh đề tài và hồ sơ học vụ về hội đồng xét tuyển của Viện VinaChem.
- Hội đồng các nhà khoa học đánh giá phản biện hồ sơ và phỏng vấn trực tiếp phương pháp luận thực nghiệm.
- Trao giải thưởng và ký biên bản cam kết hỗ trợ trang thiết bị phân tích tại lễ kỷ niệm thành lập Viện.`,
      };

    case 82:
      return {
        title:
          'Học bổng Nghiên cứu Sinh viên về Vật liệu Tiên tiến & Cấu trúc Nano',
        publisher: 'Quỹ Đổi mới Vật liệu Mới & Công nghệ Tương lai NanoMat',
        description: `## Giới thiệu học bổng
Quỹ NanoMat hướng tới ươm mầm các nhà khoa học trẻ đam mê khám phá thế giới vật liệu mới, vật liệu bán dẫn và màng mỏng cấu trúc nano. Học bổng giúp sinh viên trang trải sinh hoạt phí để tập trung toàn thời gian cho việc thí nghiệm, xử lý dữ liệu và công bố các kết quả nghiên cứu trên các ấn phẩm khoa học uy tín.

Sinh viên nhận tài trợ được hòa mình vào mạng lưới học giả trẻ nghiên cứu vật liệu tại Việt Nam và khu vực.

## Giá trị học bổng
- Suất học bổng nghiên cứu trị giá 16.000.000 VNĐ/năm học hỗ trợ trực tiếp cho sinh viên.
- Tài trợ kinh phí đo đặc trưng vật liệu chuyên sâu (SEM, TEM, XRD, AFM) tại các cơ sở kiểm định quốc gia.
- Tài trợ kinh phí đi lại và lệ phí tham dự Hội nghị Khoa học Vật liệu Toàn quốc cho đề tài được chọn báo cáo.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} đại học chính quy chuyên ngành ${majorsList}, Vật lý chất rắn hoặc Công nghệ màng mỏng.
- Đang tham gia tích cực vào một nhóm nghiên cứu khoa học tại trường hoặc viện nghiên cứu.
- Nắm vững phương pháp luận và kỹ năng nghiên cứu: ${skillsList}.
- Kỹ năng đọc hiểu tài liệu nghiên cứu quốc tế tốt, có tinh thần kiên trì và tư duy phản biện khoa học.

## Hồ sơ cần chuẩn bị
- Báo cáo tiến độ đề tài nghiên cứu kèm kết quả phân tích cấu trúc vật liệu đã thu nhận được.
- Bảng điểm học tập đại học có xác nhận của phòng đào tạo.
- Kế hoạch nghiên cứu chi tiết cho 6 tháng tiếp theo kèm mục tiêu bài báo khoa học.
- Thư giới thiệu chi tiết về năng lực nghiên cứu của giáo sư phụ trách phòng thí nghiệm.

## Hướng dẫn đăng ký
- Nộp hồ sơ nghiên cứu trực tuyến tại trang thông tin của Quỹ Đổi mới NanoMat.
- Hội đồng xét giải tiến hành bình duyệt nội dung khoa học và phỏng vấn các phát hiện mới của đề tài.
- Công bố quyết định tài trợ và tổ chức lễ vinh danh các nhà nghiên cứu trẻ tiêu biểu.`,
      };

    case 83:
      return {
        title:
          'Chương trình Hỗ trợ Nghiên cứu Chính sách Công & Đánh giá Tác động Xã hội',
        publisher:
          'Trung tâm Nghiên cứu Quản trị Nhà nước & Chính sách Phát triển GovPol',
        description: `## Giới thiệu học bổng
GovPol là trung tâm độc lập chuyên nghiên cứu và cung cấp luận cứ khoa học cho việc hoạch định chính sách công. Chương trình hỗ trợ nghiên cứu sinh viên nhằm bồi dưỡng thế hệ chuyên viên phân tích chính sách có tư duy dựa trên dữ liệu bằng chứng, am hiểu quy trình quản trị nhà nước và nhạy bén với các thách thức phúc lợi xã hội đương đại.

Sinh viên sẽ được tiếp cận nguồn dữ liệu khảo sát thực chứng và tham gia các tọa đàm chuyên gia chính sách.

## Giá trị học bổng
- Học bổng hỗ trợ kinh phí nghiên cứu trị giá 12.000.000 VNĐ/suất trao một lần.
- Được cung cấp không gian học thuật, máy tính làm việc và tài liệu chuyên sâu tại thư viện nghiên cứu của GovPol.
- Cơ hội được đồng hành cùng các chuyên gia trong các chuyến khảo sát đánh giá tác động chính sách tại cơ sở.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} đang theo học ngành ${majorsList}, Chính sách công hoặc Quản trị văn phòng hệ đại học chính quy.
- Điểm trung bình học tập tích lũy từ 3.0/4.0 trở lên, hoàn thành tốt các môn kinh tế học công cộng và luật hành chính.
- Năng lực ứng dụng kiến thức vào thực tiễn: ${skillsList}.
- Quan tâm sâu sắc đến các vấn đề dân sinh, dịch vụ công trực tuyến và cải cách hành chính nhà nước.

## Hồ sơ cần chuẩn bị
- Bài luận trình bày ý tưởng phân tích một chính sách công cụ thể tại địa phương (độ dài 1.000 - 1.500 từ).
- Bảng điểm kết quả học tập có chứng nhận của cơ sở đào tạo đại học.
- Đơn đề nghị hỗ trợ nghiên cứu theo biểu mẫu chuẩn của Trung tâm GovPol.
- Bản sao các bài viết tham luận hoặc giải thưởng nghiên cứu khoa học sinh viên (nếu có).

## Hướng dẫn đăng ký
- Ứng viên gửi toàn bộ hồ sơ bản số hóa qua hệ thống tuyển chọn của Trung tâm GovPol.
- Hội đồng chuyên gia thẩm định chất lượng bài luận chính sách và mời các ứng viên xuất sắc tham vấn ý kiến.
- Lễ trao quyết định cấp học bổng diễn ra trong khuôn khổ Diễn đàn Quản trị Công thường niên.`,
      };

    case 84:
      return {
        title: 'Quỹ Học bổng Đồng hành vì Sức khỏe Tâm thần & Tâm lý Học đường',
        publisher: 'Quỹ Sáng kiến Sức khỏe Tinh thần Cộng đồng MindCare',
        description: `## Giới thiệu học bổng
Chương trình học bổng của Quỹ MindCare ra đời với tâm nguyện tiếp sức cho các bạn sinh viên ngành ${majorsList} có tinh thần phụng sự và khát khao nâng cao sức khỏe tinh thần cho cộng đồng. Chương trình đặc biệt chú trọng bồi dưỡng năng lực thực hành đạo đức nghề nghiệp, kỹ năng tham vấn cá nhân và phát triển các mô hình hỗ trợ tâm lý học đường bền vững.

Ứng viên nhận học bổng sẽ được tham gia chuỗi giờ giám sát lâm sàng chuyên môn định kỳ do các chuyên gia cao cấp hướng dẫn.

## Giá trị học bổng
- Mức học bổng khuyến khích và hỗ trợ duy trì học tập trị giá 15.000.000 VNĐ/suất.
- Tài trợ 100% kinh phí 30 giờ giám sát chuyên môn thực hành tham vấn từ chuyên gia tâm lý lâm sàng.
- Ưu tiên tham gia các dự án hỗ trợ sức khỏe tâm thần lưu động tại các trường học vùng khó khăn do Quỹ bảo trợ.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Tâm lý học giáo dục hoặc Tâm lý học lâm sàng từ năm thứ 2 trở lên.
- Đã hoàn thành các học phần Tâm lý học đại cương, Tâm lý học phát triển và Kỹ năng tham vấn với kết quả Khá trở lên.
- Nắm vững và thực hành nghiêm túc: ${skillsList}.
- Tác phong điềm đạm, lắng nghe thấu cảm, bảo mật thông tin tuyệt đối và có tinh thần trách nhiệm với thân chủ.

## Hồ sơ cần chuẩn bị
- Thư trình bày lý tưởng nghề nghiệp và trải nghiệm cá nhân thúc đẩy theo đuổi ngành tâm lý (dưới 1.200 từ).
- Bảng điểm học tập chính thức có xác nhận của khoa hoặc phòng đào tạo.
- Báo cáo phân tích một ca tham vấn giả định minh chứng hiểu biết về đạo đức nghề nghiệp và ranh giới tâm lý.
- Thư nhận xét về đạo đức và thái độ học tập từ một giảng viên bộ môn tâm lý.

## Hướng dẫn đăng ký
- Nộp hồ sơ trực tuyến tại cổng thông tin nhân ái của Quỹ Sức khỏe Tinh thần MindCare.
- Vòng phỏng vấn sâu với hội đồng chuyên môn nhằm đánh giá phẩm chất đạo đức, động lực nghề nghiệp và sự thấu cảm.
- Công bố danh sách học bổng và lễ trao quyết định bảo trợ thực hành tâm lý học đường.`,
      };

    case 85:
      return {
        title:
          'Chương trình Hỗ trợ Dự án Nâng cao Chuỗi Giá trị Nông sản Bền vững',
        publisher:
          'Tổ chức Hỗ trợ Nông nghiệp Sinh thái & Thương mại Nông thôn AgriValue',
        description: `## Giới thiệu học bổng
AgriValue tài trợ cho các đề tài và sáng kiến của sinh viên ${majorsList} hướng đến việc gia tăng giá trị kinh tế cho bà con nông dân và thúc đẩy chuỗi cung ứng nông sản tuần hoàn. Học bổng khuyến khích các phân tích số liệu thực tế về chi phí, lợi nhuận, cấu trúc liên kết hợp tác xã và giải pháp tiêu thụ nông sản bền vững trước biến đổi khí hậu.

Sinh viên được hỗ trợ sẽ có dịp đi thực tế các vùng trồng chuyên canh và làm việc với các nhà thu mua nông sản lớn.

## Giá trị học bổng
- Học bổng tài trợ sinh hoạt phí và dự án nghiên cứu nông thôn trị giá 13.000.000 VNĐ/suất.
- Hỗ trợ toàn bộ chi phí lưu trú, đi lại trong các đợt điều tra nông hộ tại các tỉnh nông nghiệp trọng điểm.
- Cơ hội được chuyên gia chuỗi cung ứng nông sản cố vấn hoàn thiện mô hình tài chính nông hộ.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} hệ đại học chính quy ngành ${majorsList} hoặc Kinh tế phát triển nông thôn.
- Điểm trung bình các môn Kinh tế vi mô, Phân tích dự án nông nghiệp và Thống kê kinh tế đạt Khá trở lên.
- Sử dụng thành thạo các kỹ năng phân tích và công cụ chuyên môn: ${skillsList}.
- Sẵn sàng tham gia các chuyến công tác điền dã thực địa, không ngại khó khăn tại các vùng sản xuất nông thôn.

## Hồ sơ cần chuẩn bị
- Bản đề cương đề tài nghiên cứu phân tích một chuỗi nông sản đặc thù tại địa phương (khoảng 3 - 5 trang).
- Bảng điểm học tập tích lũy được trường đại học chứng thực.
- File bảng tính Excel mô phỏng dòng tiền hoặc dự toán chi phí sản xuất của mô hình nông sản mẫu.
- Thư giới thiệu của giảng viên bộ môn Kinh tế nông nghiệp.

## Hướng dẫn đăng ký
- Gửi hồ sơ đăng ký qua biểu mẫu trực tuyến của Tổ chức AgriValue trước thời hạn quy định.
- Hội đồng chuyên gia thẩm định tính khả thi của đề cương chuỗi giá trị và tổ chức phỏng vấn trực tiếp.
- Ký thỏa thuận cấp học bổng và triển khai khảo sát thực địa cùng cán bộ dự án của AgriValue.`,
      };

    case 86:
      return {
        title:
          'Học bổng Nghiên cứu Thực nghiệm Dinh dưỡng Lâm sàng & Tiết chế Bệnh viện',
        publisher: 'Viện Dinh dưỡng Lâm sàng & An toàn Bữa ăn NutriLife',
        description: `## Giới thiệu học bổng
Học bổng NutriLife được sáng lập nhằm hỗ trợ sinh viên ngành ${majorsList} có khát vọng cống hiến cho công tác tiết chế dinh dưỡng điều trị tại các bệnh viện và cơ sở y tế. Chương trình chú trọng phát triển kỹ năng xây dựng thực đơn bệnh lý cá thể hóa, phòng ngừa suy dinh dưỡng trong điều trị và nâng cao quy chuẩn vệ sinh an toàn thực phẩm bếp ăn bán trú, bệnh viện.

Sinh viên nhận học bổng được tham gia trực tiếp vào các buổi hội chẩn dinh dưỡng cùng bác sĩ lâm sàng.

## Giá trị học bổng
- Mức học bổng chuyên khoa trị giá 14.000.000 VNĐ hỗ trợ học phí và tài liệu chuyên khảo.
- Tài trợ kinh phí thực hành phần mềm tính khẩu phần dinh dưỡng chuyên dụng và tài liệu tiết chế chuẩn quốc tế.
- Được ưu tiên bố trí thực tập tiết chế lâm sàng tại mạng lưới bệnh viện đa khoa liên kết của Viện NutriLife.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} đại học chính quy ngành ${majorsList} (Dinh dưỡng lâm sàng hoặc Dinh dưỡng cộng đồng).
- Điểm trung bình các môn Dinh dưỡng người, Hóa sinh học và Dinh dưỡng bệnh lý đạt kết quả Khá trở lên.
- Thành thạo kiến thức và kỹ năng giao tiếp y khoa: ${skillsList}.
- Thể hiện sự kiên nhẫn, thái độ ân cần, y đức chuẩn mực và tác phong nghiêm túc khi tiếp xúc người bệnh.

## Hồ sơ cần chuẩn bị
- Đơn xin xét cấp học bổng nêu rõ định hướng phát triển trong lĩnh vực dinh dưỡng điều trị bệnh viện.
- Bảng điểm học tập tích lũy có chứng thực của trường đại học đào tạo khối ngành sức khỏe.
- Bài tập phân tích một thực đơn tiết chế mẫu cho bệnh nhân mắc bệnh mạn tính (đái tháo đường, suy thận, hoặc tăng huyết áp).
- Bản sao giấy chứng nhận khám sức khỏe đáp ứng điều kiện thực hành y tế.

## Hướng dẫn đăng ký
- Ứng viên nộp hồ sơ qua hệ thống tiếp nhận học bổng của Viện NutriLife.
- Hội đồng giám khảo tổ chức phỏng vấn tình huống tư vấn dinh dưỡng và giao tiếp ứng xử y tế.
- Trao học bổng chính thức và phân công người hướng dẫn chuyên môn cho sinh viên trong suốt năm học.`,
      };

    case 87:
      return {
        title:
          'Giải thưởng Tài năng Trẻ về Mô hình Hóa Tài chính & Phân tích Định lượng',
        publisher: 'Quỹ Phát triển Năng lực Phân tích Tài chính QuantFin',
        description: `## Giới thiệu học bổng
Giải thưởng thường niên QuantFin tôn vinh các sinh viên ${majorsList} - Ngân hàng có năng lực xuất sắc trong việc phân tích báo cáo tài chính doanh nghiệp, định giá tài sản và lập mô hình tài chính động. Chương trình hướng tới việc chuẩn bị nguồn nhân lực tài chính chuyên nghiệp, có tư duy logic sắc bén, phản xạ thị trường chuẩn xác và tác phong làm việc chuẩn mực quốc tế.

Các ứng viên xuất sắc nhất sẽ được kết nối cố vấn nghề nghiệp cùng các chuyên gia phân tích đầu tư cấp cao.

## Giá trị học bổng
- Giải thưởng tài trợ học tập trị giá 20.000.000 VNĐ tiền mặt trao trực tiếp cho sinh viên đạt giải.
- Tài trợ 100% chi phí tham gia khóa đào tạo chuyên sâu về mô hình tài chính nâng cao (Financial Modeling).
- Cơ hội đặc cách tham gia chương trình thực tập phân tích cổ phiếu tại các công ty quản lý quỹ đối tác.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Tài chính doanh nghiệp hoặc Phân tích đầu tư tài chính.
- Điểm trung bình tích lũy học tập GPA đạt từ 3.2/4.0 trở lên tính đến học kỳ gần nhất.
- Làm chủ công cụ xử lý số liệu và kiến thức cốt lõi: ${skillsList}.
- Khả năng tư duy phản biện cao, nhạy bén với các chỉ số kinh tế vĩ mô và thị trường vốn.

## Hồ sơ cần chuẩn bị
- Sơ yếu lý lịch chuyên nghiệp (CV) nêu rõ kết quả học tập và các thành tích/cuộc thi học thuật tài chính.
- Bảng điểm học tập đại học chính thức có dấu xác nhận của phòng đào tạo.
- Một file mô hình tài chính Excel định giá một doanh nghiệp niêm yết do sinh viên tự xây dựng.
- Bản sao các chứng chỉ nghề nghiệp quốc tế (CFA, ACCA) hoặc chứng chỉ tiếng Anh (nếu có).

## Hướng dẫn đăng ký
- Ứng viên hoàn tất thông tin và đính kèm file mô hình Excel tại cổng dự thi học bổng QuantFin.
- Hội đồng giám khảo đánh giá cấu trúc mô hình tài chính và mời top ứng viên vào vòng bảo vệ giả định định giá.
- Lễ trao giải và vinh danh sinh viên tài năng tài chính được tổ chức tại đêm gala tài chính cuối năm.`,
      };

    case 88:
      return {
        title:
          'Chương trình Tài trợ Sáng kiến Tăng trưởng Doanh số & Tối ưu Trải nghiệm E-Commerce',
        publisher: 'Mạng lưới Doanh nghiệp Thương mại Điện tử Trẻ VinaEcom',
        description: `## Giới thiệu học bổng
VinaEcom là liên minh các doanh nghiệp bán lẻ số thành lập nhằm ươm mầm thế hệ trẻ làm chủ các nền tảng thương mại điện tử. Học bổng nhằm tài trợ cho các đề tài, dự án khởi nghiệp sinh viên có ứng dụng kỹ thuật phân tích hành vi người tiêu dùng qua Google Analytics 4, chiến lược tối ưu hóa công cụ tìm kiếm (SEO) và hoàn thiện quy trình vận hành đơn hàng đa kênh.

Sinh viên nhận tài trợ được cấp ngân sách thực nghiệm để chạy các chiến dịch thương mại điện tử thực tế.

## Giá trị học bổng
- Mức học bổng tài trợ dự án kinh doanh số trị giá 15.000.000 VNĐ/suất.
- Cấp tài khoản sử dụng các công cụ phân tích từ khóa SEO và dữ liệu sàn thương mại điện tử bản quyền trong 1 năm.
- Được đồng hành cố vấn 1-1 bởi các Giám đốc Tăng trưởng (Growth Director) từ các thương hiệu bán lẻ số lớn.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} đại học chính quy ngành ${majorsList}, Marketing số hoặc Kinh doanh trực tuyến.
- Đang triển khai một dự án kinh doanh thử nghiệm hoặc khóa luận nghiên cứu về hành vi mua sắm trực tuyến.
- Nắm vững các công cụ và kỹ năng vận hành: ${skillsList}.
- Tinh thần đổi mới sáng tạo, tư duy dựa trên dữ liệu số và đam mê kinh doanh công nghệ.

## Hồ sơ cần chuẩn bị
- Bản kế hoạch dự án kinh doanh số hoặc nghiên cứu tối ưu chuyển đổi sàn thương mại điện tử (dưới 7 trang).
- Bảng điểm học tập tích lũy do trường đại học cấp.
- Ảnh chụp màn hình báo cáo dữ liệu phân tích GA4 hoặc thứ hạng từ khóa SEO của dự án thực tế (nếu có).
- Video ngắn (2 phút) tự giới thiệu bản thân và ý tưởng tăng trưởng thương mại điện tử.

## Hướng dẫn đăng ký
- Ứng viên gửi hồ sơ và video dự thi qua trang đăng ký trực tuyến của Mạng lưới VinaEcom.
- Ban chuyên môn sàng lọc hồ sơ và mời ứng viên tham gia buổi thuyết trình mô hình trước hội đồng doanh nghiệp.
- Công bố danh sách trao tài trợ và tiến hành giải ngân kinh phí thử nghiệm chiến dịch theo giai đoạn.`,
      };

    case 89:
      return {
        title:
          'Quỹ Hỗ trợ Đồ án Chế tạo Vật liệu Thân thiện Môi trường & Tái chế Xanh',
        publisher:
          'Trung tâm Kỹ thuật Vật liệu Xanh & Tiết kiệm Tài nguyên EcoMaterial',
        description: `## Giới thiệu học bổng
Quỹ EcoMaterial tập trung khuyến khích sinh viên ngành ${majorsList} tham gia giải quyết bài toán phát triển bền vững thông qua việc chế tạo các dòng vật liệu tái chế, vật liệu composite xanh từ phụ phẩm công nghiệp và nông nghiệp. Chương trình cung cấp kinh phí thực nghiệm giúp các bạn sinh viên tự tin hiện thực hóa các ý tưởng vật liệu xanh từ quy mô phòng thí nghiệm.

Các đồ án có tiềm năng ứng dụng cao sẽ được giới thiệu kết nối với các doanh nghiệp bao bì và sản xuất xanh.

## Giá trị học bổng
- Mức học bổng tài trợ nghiên cứu và chế tạo mẫu trị giá 18.000.000 VNĐ cho mỗi đề tài được chọn.
- Tài trợ kinh phí đo đạc cơ lý tính (kéo nén uốn, độ bền nhiệt, phân hủy sinh học) tại trung tâm kiểm định độc lập.
- Cấp giấy chứng nhận thành tựu sáng tạo vật liệu xanh và hỗ trợ chi phí viết bài báo khoa học.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} đang theo học ngành ${majorsList}, Công nghệ vật liệu hoặc Kỹ thuật cơ học vật liệu.
- Đang trong giai đoạn chuẩn bị hoặc thực hiện đề tài tốt nghiệp, nghiên cứu khoa học về vật liệu sinh thái/tái chế.
- Nắm chắc phương pháp nghiên cứu chuyên môn: ${skillsList}.
- Có tính cẩn trọng, kiên trì, chấp hành nghiêm quy tắc an toàn lao động trong xưởng chế tạo vật liệu.

## Hồ sơ cần chuẩn bị
- Thuyết minh đề tài đồ án chế tạo vật liệu (mục tiêu sản phẩm, phương pháp phối trộn, quy trình tạo mẫu và chỉ tiêu cơ lý).
- Bảng điểm quá trình học tập đại học có xác nhận của phòng đào tạo.
- Bảng dự toán chi tiết các chi phí nguyên vật liệu, khuôn mẫu và chi phí thử nghiệm cần tài trợ.
- Ý kiến đồng ý hướng dẫn và bảo trợ học thuật từ giảng viên phụ trách đồ án.

## Hướng dẫn đăng ký
- Nộp hồ sơ thuyết minh đề tài qua cổng tiếp nhận của Trung tâm Kỹ thuật EcoMaterial.
- Hội đồng giám khảo khoa học phản biện phương án chế tạo và thẩm định tính khả thi của vật liệu mới.
- Ký cam kết bảo trợ và bàn giao kinh phí tài trợ theo từng mốc kiểm tra mẫu vật liệu thực tế.`,
      };

    case 90:
      return {
        title:
          'Chương trình Học bổng Năng lực Kiểm nghiệm Vi sinh & Quản lý An toàn Thực phẩm',
        publisher: 'Viện Tiêu chuẩn Chất lượng & Vi sinh Thực phẩm FoodSafe',
        description: `## Giới thiệu học bổng
Học bổng FoodSafe được thành lập nhằm bồi dưỡng thế hệ kỹ sư ${majorsList} có năng lực kiểm soát rủi ro an toàn sinh học và quản lý chuỗi cung ứng thực phẩm đạt chuẩn quốc tế. Chương trình chú trọng đào tạo thực hành các kỹ thuật phân tích vi sinh chỉ thị vệ sinh, phát hiện vi sinh vật gây bệnh và áp dụng các tiêu chuẩn quản lý chất lượng tiên tiến như ISO 22000, HACCP.

Sinh viên được học bổng sẽ được tham quan và trải nghiệm thực tế tại các nhà máy chế biến thực phẩm xuất khẩu.

## Giá trị học bổng
- Học bổng khuyến học trị giá 15.000.000 VNĐ/suất hỗ trợ học phí và sinh hoạt phí.
- Tài trợ 100% lệ phí khóa đào tạo và cấp chứng chỉ Đánh giá viên nội bộ hệ thống quản lý an toàn thực phẩm ISO 22000.
- Được thực hành tại phòng thí nghiệm vi sinh thực phẩm đạt chuẩn ISO 17025 dưới sự kèm cặp của chuyên gia.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} đại học chính quy chuyên ngành ${majorsList} hoặc Đảm bảo chất lượng & An toàn thực phẩm.
- Điểm trung bình các môn Vi sinh thực phẩm, Phân tích thực phẩm và Quản lý chất lượng đạt từ Khá trở lên.
- Nắm vững kiến thức và kỹ năng thực hành lab: ${skillsList}.
- Tác phong kỷ luật cao, tuân thủ nghiêm ngặt quy trình vô trùng và an toàn sinh học phòng xét nghiệm.

## Hồ sơ cần chuẩn bị
- Đơn xin xét học bổng nêu rõ định hướng làm việc trong bộ phận Quản lý chất lượng (QA/QC) thực phẩm.
- Bảng điểm học tập tích lũy có dấu xác nhận của trường đại học.
- Một bài phân tích tình huống kiểm soát mối nguy vi sinh trong một dây chuyền chế biến thực phẩm cụ thể (khoảng 3 trang).
- Giấy chứng nhận tham gia hoạt động ngoại khóa hoặc các chứng chỉ kỹ năng bổ trợ (nếu có).

## Hướng dẫn đăng ký
- Ứng viên hoàn tất hồ sơ điện tử và nộp qua cổng tiếp nhận của Viện Tiêu chuẩn FoodSafe.
- Hội đồng tuyển chọn chấm bài tập tình huống và mời phỏng vấn kỹ thuật trực tuyến.
- Công bố quyết định cấp học bổng và tổ chức lễ trao chứng nhận tại hội thảo an toàn thực phẩm quốc gia.`,
      };

    case 91:
      return {
        title:
          'Quỹ Khuyến khích Nghiên cứu Pháp luật Thực định & Trợ giúp Pháp lý Cộng đồng',
        publisher: 'Trung tâm Nghiên cứu & Thực hành Pháp luật Justitia',
        description: `## Giới thiệu học bổng
Trung tâm Justitia trao học bổng thường niên cho các sinh viên ngành ${majorsList} có tinh thần thượng tôn pháp luật, đam mê nghiên cứu án lệ và tích cực tham gia các hoạt động trợ giúp pháp lý cho người yếu thế. Chương trình giúp sinh viên trui rèn kỹ năng tranh biện, phương pháp tra cứu văn bản quy phạm pháp luật phức tạp và chuẩn mực soạn thảo văn bản pháp lý chuyên nghiệp.

Sinh viên nhận học bổng được tham gia các phiên tư vấn pháp luật lưu động cùng các luật sư uy tín.

## Giá trị học bổng
- Mức học bổng khuyến học trị giá 12.000.000 VNĐ/suất hỗ trợ học tập.
- Được bảo trợ thực tập tại các văn phòng luật sư đối tác và trung tâm trợ giúp pháp lý nhà nước.
- Cấp tài khoản tra cứu cơ sở dữ liệu văn bản pháp luật và bản án trực tuyến có bản quyền trong 1 năm.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Luật Dân sự hoặc Luật Hình sự tại các trường đại học chuyên ngành luật.
- Điểm học phần Lý luận nhà nước và pháp luật, Luật Dân sự đạt kết quả từ Khá trở lên.
- Năng lực thao tác kỹ năng thực hành nghề luật: ${skillsList}.
- Phẩm chất đạo đức trong sáng, chính trực, có tinh thần bảo vệ lẽ phải và trách nhiệm xã hội.

## Hồ sơ cần chuẩn bị
- Bản tự thuật về động lực học luật và mục tiêu hành nghề luật sư hoặc chuyên viên pháp lý tương lai.
- Bảng điểm học tập tích lũy các học kỳ do phòng đào tạo trường đại học cấp.
- Một bản phân tích bình luận bản án hoặc một bản hợp đồng mẫu do sinh viên tự nghiên cứu soạn thảo.
- Thư giới thiệu của giảng viên bộ môn hoặc luật sư hướng dẫn thực hành.

## Hướng dẫn đăng ký
- Ứng viên nộp hồ sơ bản scan qua trang xét tuyển học bổng của Trung tâm Justitia.
- Vòng thẩm định hồ sơ và kiểm tra năng lực lập luận pháp lý qua tình huống thực tế.
- Trao học bổng và tiếp nhận sinh viên vào nhóm nghiên cứu trợ giúp pháp lý cộng đồng.`,
      };

    case 92:
      return {
        title:
          'Chương trình Tài trợ Khảo sát Xã hội học Đô thị & Phân tích Dữ liệu Định lượng',
        publisher: 'Viện Nghiên cứu Xã hội Học & Dân số Đô thị SociaMetric',
        description: `## Giới thiệu học bổng
Chương trình tài trợ SociaMetric hướng đến việc nâng cao năng lực nghiên cứu thực chứng cho sinh viên ngành ${majorsList}. Chương trình khuyến khích các đề tài khảo sát đời sống cư dân đô thị, biến đổi việc làm thanh niên và tác động của mạng xã hội đến giới trẻ, sử dụng phương pháp chọn mẫu khoa học và kỹ thuật xử lý dữ liệu điều tra định lượng bằng phần mềm SPSS.

Sinh viên nhận tài trợ được hướng dẫn bởi các chuyên gia điều tra xã hội học giàu kinh nghiệm thực địa.

## Giá trị học bổng
- Học bổng tài trợ sinh hoạt phí và chi phí khảo sát thực địa trị giá 13.000.000 VNĐ/suất.
- Được đài thọ kinh phí in ấn bảng hỏi, quà tặng người trả lời phỏng vấn và thù lao điều tra viên thực địa.
- Cơ hội được bảo trợ công bố kết quả nghiên cứu trên tạp chí khoa học chuyên ngành xã hội học.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} hệ chính quy ngành ${majorsList} hoặc Nhân khẩu học đô thị.
- Đã hoàn thành các học phần Xã hội học đại cương, Phương pháp nghiên cứu xã hội học và Thống kê xã hội.
- Nắm vững các kỹ năng phân tích dữ liệu điều tra: ${skillsList}.
- Kỹ năng giao tiếp thực địa tốt, kiên nhẫn, trung thực trong thu thập và làm sạch số liệu điều tra.

## Hồ sơ cần chuẩn bị
- Thuyết minh đề cương nghiên cứu khảo sát xã hội học (nêu rõ câu hỏi nghiên cứu, mẫu khảo sát và bảng hỏi dự kiến).
- Bảng điểm kết quả học tập có chứng nhận của trường đại học.
- Một file output chạy dữ liệu SPSS (kèm file dữ liệu mô phỏng) chứng minh năng lực phân tích thống kê.
- Thư nhận xét và giới thiệu của giảng viên hướng dẫn nghiên cứu khoa học.

## Hướng dẫn đăng ký
- Gửi hồ sơ bản mềm đến ban điều hành học bổng Viện SociaMetric qua hòm thư điện tử.
- Hội đồng khoa học thẩm định tính chuẩn mực của phương pháp chọn mẫu và bảng câu hỏi.
- Phê duyệt cấp học bổng và ký biên bản cam kết chuẩn mực đạo đức trong nghiên cứu xã hội.`,
      };

    case 93:
      return {
        title:
          'Giải thưởng Khuyến khích Nghiên cứu Kinh tế Ứng dụng & Dự báo Chu kỳ Ngành',
        publisher: 'Viện Nghiên cứu Kinh tế Phát triển & Dự báo Vĩ mô EcoTrend',
        description: `## Giới thiệu học bổng
EcoTrend trao giải thưởng học thuật hàng năm nhằm phát hiện và khích lệ các sinh viên ngành ${majorsList} có năng lực nghiên cứu ứng dụng vượt trội. Đề tài xét duyệt tập trung vào các vấn đề chuyển dịch cơ cấu kinh tế, dự báo xu hướng thị trường lao động và năng suất ngành, sử dụng công cụ thống kê toán học để giải quyết các bài toán kinh tế thực tiễn.

Sinh viên nhận giải có cơ hội tham gia các hội thảo phản biện chính sách kinh tế vĩ mô do Viện tổ chức.

## Giá trị học bổng
- Giải thưởng khuyến học và tài trợ nghiên cứu trị giá 16.000.000 VNĐ/suất.
- Cấp quyền truy cập hệ thống cơ sở dữ liệu kinh tế vĩ mô và chỉ số giá ngành chuyên sâu của Viện EcoTrend.
- Được các chuyên gia kinh tế trưởng cố vấn hoàn thiện bài viết để dự thi các giải thưởng nghiên cứu sinh viên toàn quốc.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Kinh tế học hoặc Kinh tế đầu tư.
- Điểm trung bình các học phần Kinh tế vi mô, Kinh tế vĩ mô và Thống kê kinh tế đạt từ Khá trở lên.
- Nắm vững công cụ phân tích và phương pháp định lượng: ${skillsList}.
- Tư duy logic mạch lạc, có khả năng diễn giải ý nghĩa kinh tế từ các mô hình thống kê phức tạp.

## Hồ sơ cần chuẩn bị
- Toàn văn bài báo cáo nghiên cứu hoặc đề cương khóa luận kinh tế ứng dụng (độ dài tối đa 15 trang).
- Bảng điểm học tập tích lũy đại học có dấu xác nhận của trường.
- Tóm tắt ý tưởng nghiên cứu bằng tiếng Anh (dưới 300 từ).
- Thư giới thiệu của giảng viên hướng dẫn thuộc bộ môn Kinh tế học.

## Hướng dẫn đăng ký
- Ứng viên nộp hồ sơ bài nghiên cứu qua cổng tiếp nhận của Viện EcoTrend.
- Hội đồng các nhà nghiên cứu kinh tế tiến hành phản biện độc lập và chấm điểm theo thang chuẩn mực học thuật.
- Lễ trao giải thưởng được tổ chức trang trọng nhân dịp Diễn đàn Kinh tế Sinh viên thường niên.`,
      };

    case 94:
      return {
        title:
          'Chương trình Ươm mầm Dự án Tự động hóa IoT & Thiết bị Đo kiểm Thông minh',
        publisher:
          'Phòng Nghiên cứu Sáng chế Thiết bị Thông minh SmartTech Lab',
        description: `## Giới thiệu học bổng
SmartTech Lab tài trợ cho các ý tưởng sáng tạo phần cứng của sinh viên ngành ${majorsList}. Chương trình tập trung thúc đẩy các dự án chế tạo thiết bị đo kiểm tự động, trạm quan trắc môi trường thông minh và giải pháp giám sát không dây ứng dụng Arduino và vi điều khiển chuyên dụng, từ giai đoạn lên sơ đồ mạch đến khi đóng gói sản phẩm hoàn thiện.

Các nhóm đề tài được hỗ trợ sẽ có không gian thực nghiệm và trang thiết bị đo kiểm hiện đại tại lab.

## Giá trị học bổng
- Gói tài trợ kinh phí đồ án và học bổng khuyến khích trị giá 17.000.000 VNĐ/dự án.
- Tài trợ kinh phí mua cảm biến, bo mạch vi xử lý, phụ kiện in 3D vỏ thiết bị và linh kiện điện tử chuyên dụng.
- Nhận sự hỗ trợ kỹ thuật trực tiếp từ các kỹ sư phần cứng giàu kinh nghiệm chế tạo sản phẩm thương mại.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList} hoặc Kỹ thuật điều khiển - tự động hóa.
- Đang thực hiện đồ án môn học chuyên ngành hoặc khóa luận tốt nghiệp về thiết bị nhúng IoT.
- Thành thạo kiến thức chế tạo phần cứng: ${skillsList}.
- Kỹ năng hàn mạch, lắp ráp cơ khí chính xác và đam mê sáng tạo thiết bị công nghệ hữu ích.

## Hồ sơ cần chuẩn bị
- Bản thuyết minh sáng kiến kỹ thuật (sơ đồ nguyên lý mạch, giải thuật điều khiển và dự toán kinh phí linh kiện).
- Bảng điểm học tập tích lũy tại trường đại học kỹ thuật.
- Video ngắn (1-2 phút) quay lại hoạt động của mạch mẫu thử nghiệm trên testboard hoặc mô phỏng.
- Bản sao thẻ sinh viên và thư nhận xét của giảng viên bộ môn kỹ thuật máy tính.

## Hướng dẫn đăng ký
- Ứng viên đăng ký thông tin đề tài trực tuyến qua trang tuyển chọn của SmartTech Lab.
- Hội đồng kỹ thuật đánh giá tính sáng tạo, mức độ hoàn thiện của sơ đồ mạch và tính an toàn của thiết bị.
- Ký thỏa thuận tài trợ chế tạo và phân bổ kinh phí theo các mốc hoàn thiện sản phẩm.`,
      };

    case 95:
      return {
        title:
          'Học bổng Tài trợ Ý tưởng Chế tạo Thiết bị Y tế Cá nhân & Theo dõi Sức khỏe',
        publisher: 'Quỹ Sáng tạo Kỹ thuật Y Sinh & Thiết bị Y tế BioMedTech',
        description: `## Giới thiệu học bổng
Quỹ BioMedTech ra đời với sứ mệnh chắp cánh cho các phát minh kỹ thuật y sinh phục vụ chăm sóc sức khỏe cộng đồng. Học bổng hướng đến việc khuyến khích sinh viên ngành ${majorsList} nghiên cứu chế tạo các thiết bị theo dõi sinh hiệu tại nhà (nhịp tim, nồng độ oxy SpO2, nhiệt độ cơ thể), đòi hỏi sự kết hợp nhuần nhuyễn giữa kiến thức y học và kỹ năng thiết kế mạch điện xử lý tín hiệu sinh học.

Sinh viên nhận học bổng được cố vấn kỹ thuật bởi các bác sĩ lâm sàng và chuyên gia thiết bị y tế hàng đầu.

## Giá trị học bổng
- Mức tài trợ học bổng và kinh phí chế tạo thiết bị trị giá 22.000.000 VNĐ/suất.
- Tài trợ kinh phí hiệu chuẩn thiết bị y tế và đo lường độ chính xác tại viện trang thiết bị y tế chuyên ngành.
- Cơ hội được quỹ kết nối với các vườn ươm khởi nghiệp công nghệ y tế (MedTech Incubator).`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} ngành ${majorsList} hoặc Điện tử y sinh tại các trường đại học kỹ thuật, y dược.
- Điểm trung bình các học phần Xử lý tín hiệu sinh học, Dụng cụ y khoa và Điện tử y sinh đạt loại Khá trở lên.
- Năng lực chuyên môn vững vàng: ${skillsList}.
- Ý thức sâu sắc về độ tin cậy, độ an toàn điện sinh học và tiêu chuẩn cách ly y tế của thiết bị chăm sóc sức khỏe.

## Hồ sơ cần chuẩn bị
- Thuyết minh đề tài thiết bị y sinh (nguyên lý đo tín hiệu, sơ đồ khối mạch khuếch đại sinh học và phương án an toàn).
- Bảng điểm học tập đại học có chứng nhận của nhà trường.
- Bản tóm tắt các tài liệu y khoa quốc tế đã tham khảo phục vụ thiết kế thông số thiết bị.
- Thư giới thiệu của giảng viên phụ trách phòng thí nghiệm kỹ thuật y sinh.

## Hướng dẫn đăng ký
- Nộp hồ sơ thuyết minh dự án trực tuyến qua cổng xét duyệt của Quỹ BioMedTech.
- Vòng phản biện khoa học trước hội đồng gồm các kỹ sư y sinh và bác sĩ chuyên khoa.
- Lễ công bố tài trợ và ký kết kế hoạch chế tạo thiết bị y sinh phục vụ cộng đồng.`,
      };

    case 96:
      return {
        title:
          'Quỹ Hỗ trợ Đồ án Nghiên cứu Sản phẩm Thực phẩm Giàu Hoạt tính Sinh học',
        publisher:
          'Trung tâm Nghiên cứu & Phát triển Thực phẩm Chức năng BioFood R&D',
        description: `## Giới thiệu học bổng
Trung tâm BioFood R&D tài trợ cho các đề tài khóa luận tốt nghiệp của sinh viên ngành ${majorsList} tập trung vào việc nghiên cứu, trích ly các hợp chất chống oxy hóa, polyphenol và hoạt chất sinh học tự nhiên để ứng dụng vào chế biến thực phẩm bảo vệ sức khỏe. Chương trình hỗ trợ toàn diện từ kinh phí nguyên liệu đến phân tích kiểm nghiệm chất lượng sản phẩm.

Sản phẩm đồ án hoàn thiện có cơ hội được hỗ trợ đánh giá cảm quan chuyên nghiệp tại phòng Lab Sensory của Trung tâm.

## Giá trị học bổng
- Học bổng tài trợ đồ án tốt nghiệp trị giá 16.000.000 VNĐ/suất.
- Tài trợ toàn bộ chi phí sử dụng hệ thống thiết bị cô quay chân không, sấy thăng hoa và quang phổ UV-Vis.
- Cố vấn trực tiếp bởi các chuyên gia R&D thực phẩm có hơn 15 năm kinh nghiệm trong ngành hàng FMCG.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Dinh dưỡng và ẩm thực học đang làm đồ án tốt nghiệp.
- Điểm các học phần Hóa sinh thực phẩm, Phân tích thực phẩm và Công nghệ chế biến đạt từ Khá trở lên.
- Thành thạo phương pháp luận nghiên cứu: ${skillsList}.
- Tác phong làm việc khoa học, tỉ mỉ, trung thực trong ghi nhận số liệu và tuân thủ vệ sinh an toàn thực phẩm.

## Hồ sơ cần chuẩn bị
- Đề cương chi tiết đồ án nghiên cứu phát triển sản phẩm thực phẩm mới.
- Bảng điểm kết quả học tập đại học chính thức do trường cấp.
- Bản dự toán chi tiết hóa chất, nguyên liệu và dụng cụ phòng thí nghiệm cần hỗ trợ.
- Giấy xác nhận đề tài tốt nghiệp có chữ ký của giảng viên hướng dẫn.

## Hướng dẫn đăng ký
- Ứng viên nộp đề cương đồ án qua hệ thống tiếp nhận học bổng của Trung tâm BioFood R&D.
- Hội đồng chuyên gia R&D đánh giá tính khả thi, giá trị dinh dưỡng và tiềm năng thị trường của sản phẩm.
- Trao tài trợ và đồng hành theo dõi tiến độ hoàn thành mẫu thực phẩm thử nghiệm.`,
      };

    case 97:
      return {
        title:
          'Học bổng Phát triển Năng lực Pháp lý Hợp đồng Thương mại & Quản trị Rủi ro Doanh nghiệp',
        publisher:
          'Viện Đào tạo Luật sư Thương mại & Pháp chế Doanh nghiệp LexCorp',
        description: `## Giới thiệu học bổng
LexCorp trao học bổng nhằm thúc đẩy năng lực thực hành pháp lý doanh nghiệp cho sinh viên chuyên ngành ${majorsList}. Chương trình chú trọng đào tạo chuyên sâu về kỹ năng thẩm định điều khoản hợp đồng mua bán hàng hóa, sáp nhập doanh nghiệp (M&A) và xây dựng quy chế quản trị nội bộ tuân thủ pháp luật, chuẩn bị cho vị trí chuyên viên pháp chế doanh nghiệp (In-house Legal Counsel).

Sinh viên nhận học bổng sẽ được tham gia các buổi mô phỏng đàm phán hợp đồng thương mại quốc tế (Moot Court).

## Giá trị học bổng
- Suất học bổng khuyến học trị giá 15.000.000 VNĐ hỗ trợ tài liệu và học phí.
- Tài trợ 100% học phí khóa học Kỹ năng rà soát và soạn thảo hợp đồng thương mại nâng cao do các luật sư hàng đầu giảng dạy.
- Cơ hội được nhận thực tập trực tiếp tại phòng pháp chế của các tập đoàn sản xuất, thương mại lớn.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} theo học hệ chính quy chuyên ngành ${majorsList}, Luật Thương mại quốc tế.
- Điểm học phần Luật Doanh nghiệp, Luật Thương mại và Kỹ năng tư vấn pháp lý đạt loại Khá hoặc Giỏi.
- Nắm vững kiến thức và kỹ năng áp dụng thực tiễn: ${skillsList}.
- Tư duy phân tích sắc bén, logic lập luận chuẩn xác và khả năng diễn đạt văn bản quy chuẩn.

## Hồ sơ cần chuẩn bị
- Sơ yếu lý lịch học thuật (CV) nêu bật các thành tích học tập và trải nghiệm thực hành pháp lý.
- Bảng điểm học tập tích lũy được cơ sở đào tạo chứng thực.
- Bản phân tích rủi ro pháp lý của một điều khoản hợp đồng thương mại mẫu do sinh viên tự thực hiện (dưới 4 trang).
- Thư giới thiệu của giảng viên bộ môn Luật Kinh tế.

## Hướng dẫn đăng ký
- Ứng viên gửi hồ sơ qua biểu mẫu trực tuyến trên website của Viện LexCorp.
- Hội đồng giám khảo chấm bản phân tích rủi ro hợp đồng và tổ chức phỏng vấn trực tiếp tình huống pháp chế.
- Công bố danh sách sinh viên được nhận học bổng và lễ ký kết bảo trợ nghề nghiệp.`,
      };

    case 98:
      return {
        title:
          'Quỹ Hỗ trợ Sáng kiến Can thiệp Xã hội & Đồng hành cùng Nhóm Yếu thế',
        publisher: 'Tổ chức Phát triển Cộng đồng & Phúc lợi Xã hội HopeBridge',
        description: `## Giới thiệu học bổng
Tổ chức HopeBridge thành lập quỹ hỗ trợ nhằm khuyến khích sinh viên ngành ${majorsList} phát huy tinh thần dấn thân, xây dựng các sáng kiến trợ giúp xã hội thiết thực cho các đối tượng có hoàn cảnh khó khăn (trẻ em cơ nhỡ, người khuyết tật, người cao tuổi neo đơn). Chương trình tài trợ trực tiếp cho quá trình thực địa, đánh giá nhu cầu thân chủ và lập kế hoạch quản lý ca can thiệp bền vững.

Sinh viên được nhận tài trợ sẽ được làm việc cùng mạng lưới nhân viên xã hội chuyên nghiệp tại các trung tâm bảo trợ.

## Giá trị học bổng
- Mức học bổng khuyến khích và tài trợ kế hoạch can thiệp trị giá 12.000.000 VNĐ/suất.
- Hỗ trợ thêm kinh phí hoạt động trực tiếp 10.000.000 VNĐ cho các hoạt động hỗ trợ thân chủ của kế hoạch can thiệp.
- Được chuyên gia giám sát ca công tác xã hội hỗ trợ tư vấn chuyên môn định kỳ hàng tháng.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList} hoặc Xã hội học ứng dụng tại các trường đại học.
- Điểm các học phần Công tác xã hội cá nhân, Công tác xã hội nhóm và Phát triển cộng đồng đạt Khá trở lên.
- Nắm chắc phương pháp nghiệp vụ: ${skillsList}.
- Có lòng nhân ái, sự nhạy cảm văn hóa, tôn trọng quyền tự quyết của thân chủ và cam kết trách nhiệm xã hội cao.

## Hồ sơ cần chuẩn bị
- Bản đề xuất kế hoạch can thiệp hoặc sáng kiến hỗ trợ một nhóm đối tượng yếu thế cụ thể tại địa bàn thực tập.
- Bảng điểm học tập tích lũy có dấu xác nhận của trường đại học.
- Bản tự thuật về quá trình tham gia các hoạt động tình nguyện hoặc dự án cộng đồng trước đây.
- Thư giới thiệu của giảng viên hướng dẫn thực hành công tác xã hội.

## Hướng dẫn đăng ký
- Ứng viên nộp hồ sơ kế hoạch can thiệp qua cổng tiếp nhận của Tổ chức HopeBridge.
- Hội đồng chuyên gia phúc lợi xã hội đánh giá tính nhân văn, tính khả thi và đạo đức nghề nghiệp của kế hoạch.
- Lễ trao quyết định cấp học bổng và ký biên bản cam kết giải ngân kinh phí can thiệp xã hội.`,
      };

    case 99:
      return {
        title:
          'Chương trình Khuyến khích Ứng dụng Trí tuệ Nhân tạo trong Tối ưu Hóa Quy trình Kinh doanh',
        publisher:
          'Học viện Chuyển đổi Số & Kinh doanh Tương lai DigitalBiz Hub',
        description: `## Giới thiệu học bổng
DigitalBiz Hub trao học bổng thường niên nhằm thúc đẩy sinh viên tiên phong ứng dụng trí tuệ nhân tạo (AI) vào việc tái thiết kế quy trình kinh doanh, tự động hóa dịch vụ khách hàng và phân tích dữ liệu thị trường số. Học bổng tạo bệ phóng giúp sinh viên hoàn thiện các bản tài liệu đặc tả yêu cầu nghiệp vụ (BRD) và xây dựng mô hình kinh doanh số ứng dụng AI có khả năng triển khai thực tế.

Sinh viên được nhận học bổng sẽ được cấp quyền truy cập tài nguyên điện toán đám mây và các API AI hiện đại.

## Giá trị học bổng
- Suất học bổng công nghệ và kinh doanh trị giá 18.000.000 VNĐ trao trực tiếp cho sinh viên.
- Tài trợ gói tín dụng dịch vụ đám mây (Cloud AI Credits) trị giá 1.000 USD phục vụ phát triển sản phẩm mô phỏng.
- Cơ hội được huấn luyện 1-1 bởi các chuyên gia tư vấn chuyển đổi số doanh nghiệp (Digital Transformation Consultant).`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}, Trí tuệ nhân tạo ứng dụng trong kinh doanh hoặc Hệ thống thông tin quản lý.
- Điểm trung bình tích lũy đạt từ Khá trở lên, hoàn thành tốt các môn Phân tích nghiệp vụ và Chuyển đổi số.
- Thành thạo kiến thức và kỹ năng liên ngành: ${skillsList}.
- Tư duy đổi mới sáng tạo, năng lực kết nối giữa nhu cầu nghiệp vụ thực tế và năng lực của công nghệ AI.

## Hồ sơ cần chuẩn bị
- Bản đề xuất ý tưởng ứng dụng AI giải quyết một bài toán cụ thể trong bán lẻ trực tuyến hoặc chăm sóc khách hàng.
- Bảng điểm học tập tích lũy có chứng thực của trường đại học.
- Một bản đặc tả yêu cầu nghiệp vụ (BRD/User Stories) mẫu kèm sơ đồ quy trình do sinh viên tự xây dựng.
- Video ngắn (3 phút) thuyết minh về giải pháp và tính đột phá của ý tưởng kinh doanh số.

## Hướng dẫn đăng ký
- Ứng viên nộp hồ sơ và video dự thi qua cổng xét tuyển của Học viện DigitalBiz Hub.
- Hội đồng ban giám khảo đánh giá tính khả thi thương mại và chiều sâu ứng dụng công nghệ của giải pháp.
- Lễ vinh danh và trao học bổng được tổ chức tại Hội nghị Thượng đỉnh Đổi mới Sáng tạo Số.`,
      };

    case 100:
      return {
        title:
          'Giải thưởng Sáng kiến Xanh về Xử lý Nước thải Công nghiệp & Tuần hoàn Nước',
        publisher: 'Mạng lưới Kỹ sư Môi trường & Năng lượng Sạch AquaGreen',
        description: `## Giới thiệu học bổng
AquaGreen là mạng lưới kỹ sư môi trường chuyên hỗ trợ các sáng kiến bảo vệ tài nguyên nước và phát triển mô hình kinh tế tuần hoàn. Giải thưởng thường niên nhằm khích lệ sinh viên ngành ${majorsList} nghiên cứu thiết kế các công trình xử lý nước thải công nghiệp tiên tiến, ứng dụng bản vẽ kỹ thuật AutoCAD và công nghệ bản đồ số GIS để tối ưu hóa mạng lưới thu gom và tái sử dụng nước sau xử lý.

Đề tài đạt giải được hỗ trợ chế tạo mô hình pilot và đo đạc các chỉ tiêu hóa lý môi trường tại phòng thí nghiệm chuyên sâu.

## Giá trị học bổng
- Giải thưởng khuyến học và tài trợ mô hình trị giá 20.000.000 VNĐ/suất.
- Tài trợ kinh phí đo đạc các chỉ tiêu BOD, COD, N-P và kim loại nặng tại phòng kiểm định môi trường đạt chuẩn VILAS.
- Được các kỹ sư trưởng thiết kế công trình xử lý môi trường cố vấn kỹ thuật và nhận xét bản vẽ trực tiếp.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList} hoặc Quản lý môi trường đang chuẩn bị làm đồ án xử lý nước thải.
- Điểm các học phần Kỹ thuật xử lý nước thải, Công nghệ sinh học môi trường và Hóa học môi trường đạt Khá trở lên.
- Nắm vững công cụ thiết kế kỹ thuật và kỹ năng chuyên ngành: ${skillsList}.
- Tinh thần trách nhiệm với môi trường sống, tác phong làm việc khoa học, tỉ mỉ và tôn trọng dữ liệu thực nghiệm.

## Hồ sơ cần chuẩn bị
- Thuyết minh sơ bộ phương án công nghệ xử lý nước thải (sơ đồ dây chuyền công nghệ, tính toán sơ bộ công trình đơn vị).
- Bảng điểm kết quả học tập đại học chính thức do trường cấp.
- Bản vẽ kỹ thuật mặt bằng hoặc mặt cắt công trình xử lý nước thải vẽ bằng phần mềm AutoCAD.
- Thư giới thiệu của giảng viên hướng dẫn bộ môn Công nghệ môi trường.

## Hướng dẫn đăng ký
- Ứng viên gửi thuyết minh công nghệ và bản vẽ AutoCAD qua trang xét thưởng của Mạng lưới AquaGreen.
- Hội đồng các chuyên gia kỹ thuật môi trường phản biện công nghệ và phỏng vấn giải pháp kỹ thuật.
- Lễ trao giải thưởng được tổ chức trang trọng nhân Ngày Nước Thế giới (World Water Day).`,
      };

    default:
      return {
        title: `Học bổng Phát triển Năng lực Chuyên sâu ${majorsList}`,
        publisher: 'Quỹ Hỗ trợ Tài năng Học thuật & Sáng tạo Trẻ',
        description: `## Giới thiệu học bổng
Chương trình học bổng chuyên ngành dành cho sinh viên xuất sắc khối ngành ${majorsList}.

## Giá trị học bổng
- Mức học bổng khuyến học trị giá 15.000.000 VNĐ/suất.`,
        requirements: `## Đối tượng và điều kiện xét tuyển
- ${yearsText} chuyên ngành ${majorsList}.
- Nắm vững kiến thức và kỹ năng: ${skillsList}.

## Hồ sơ cần chuẩn bị
- Đơn xin cấp học bổng theo mẫu.
- Bảng điểm học tập tích lũy.

## Hướng dẫn đăng ký
- Ứng viên nộp hồ sơ qua cổng học bổng trực tuyến.`,
      };
  }
}

function pickName(id, list) {
  return list[id % list.length];
}

function getRoleName(major, skills, id) {
  // Specific checks by major first to avoid collisions
  if (major === 'An toàn thông tin') return 'An toàn Thông tin & Giám sát SOC';
  if (major === 'Mạng máy tính và truyền thông dữ liệu')
    return 'Quản trị Hạ tầng Mạng & Viễn thông';
  if (major === 'Công nghệ tài chính')
    return 'Công nghệ Tài chính (Fintech & Data)';
  if (major === 'Khoa học máy tính')
    return 'Phát triển Phần mềm C++ & Thuật toán';
  if (major === 'Logistics và Quản lý chuỗi cung ứng')
    return 'Chứng từ & Thủ tục Logistics Xuất Nhập Khẩu';
  if (major === 'Kinh doanh quốc tế')
    return 'Phát triển Thương mại & Kinh doanh Quốc tế';
  if (major === 'Sư phạm Toán học')
    return 'Giảng dạy & Phát triển Học liệu Môn Toán';
  if (major === 'Sư phạm Ngữ văn')
    return 'Biên tập Học liệu & Giảng dạy Môn Ngữ văn';
  if (major === 'Sư phạm Tiếng Anh')
    return 'Giảng dạy Tiếng Anh & Kế hoạch Bài học';
  if (major === 'Khoa học môi trường')
    return 'Đánh giá Tác động Môi trường & GIS';

  if (skills.some((s) => s.includes('Tuyển dụng')))
    return 'Tuyển dụng & Đào tạo';
  if (skills.some((s) => s.includes('Mạng') || s.includes('Linux')))
    return 'Vận hành Mạng & Hệ thống';
  if (skills.some((s) => s.includes('Mạch điện') || s.includes('PCB')))
    return 'Thiết kế Mạch Điện Tử';
  if (skills.some((s) => s.includes('Mô hình hóa') || s.includes('MATLAB')))
    return 'Mô hình hóa & Tính toán Số';
  if (
    skills.some(
      (s) => s.includes('Kinh tế lượng') || s.includes('Thương mại quốc tế'),
    )
  )
    return 'Nghiên cứu Kinh tế & Ngoại thương';
  if (skills.some((s) => s.includes('Biên dịch') || s.includes('tiếng Anh')))
    return 'Biên dịch & Biên tập Nội dung';
  if (
    skills.some(
      (s) => s.includes('Thiết kế bài giảng') || s.includes('Đánh giá kết quả'),
    )
  )
    return 'Phát triển Chương trình Giáo dục';
  if (skills.some((s) => s.includes('IPM') || s.includes('dịch hại')))
    return 'Bảo vệ Thực vật & Nông học';
  if (skills.some((s) => s.includes('lâm sàng') || s.includes('Y khoa')))
    return 'Hỗ trợ Lâm sàng & Nghiên cứu Y học';
  if (skills.some((s) => s.includes('Figma') || s.includes('Photoshop')))
    return 'Thiết kế Đồ họa & Thương hiệu';
  if (skills.some((s) => s.includes('Kế hoạch kinh doanh')))
    return 'Phát triển Kinh doanh & Kế hoạch';
  if (skills.some((s) => s.includes('C++') || s.includes('Python')))
    return 'Lập trình Thuật toán & Phần mềm';
  if (skills.some((s) => s.includes('Tối ưu hóa')))
    return 'Toán Ứng dụng & Tối ưu hóa';
  if (skills.some((s) => s.includes('Chính sách công')))
    return 'Phân tích Chính sách Phát triển';
  if (skills.some((s) => s.includes('Tiếng Trung')))
    return 'Biên phiên dịch Tiếng Trung';
  if (skills.some((s) => s.includes('Tiếng Nhật')))
    return 'Biên phiên dịch Tiếng Nhật';
  if (skills.some((s) => s.includes('Tiếng Hàn')))
    return 'Biên phiên dịch Tiếng Hàn';
  if (skills.some((s) => s.includes('Tiếng Pháp')))
    return 'Biên phiên dịch Tiếng Pháp';
  if (skills.some((s) => s.includes('Thời trang') || s.includes('rập')))
    return 'Thiết kế Rập & Mẫu Thời trang';
  if (skills.some((s) => s.includes('Rủi ro')))
    return 'Quản trị Rủi ro Doanh nghiệp';
  if (skills.some((s) => s.includes('TypeScript') || s.includes('REST API')))
    return 'Lập trình Phần mềm (Fullstack/Backend)';
  if (skills.some((s) => s.includes('PLC') || s.includes('SCADA')))
    return 'Kỹ thuật Tự động hóa & PLC';
  if (skills.some((s) => s.includes('Vật lý') || s.includes('thực nghiệm')))
    return 'Nghiên cứu Thực nghiệm Vật lý';
  if (skills.some((s) => s.includes('Tín dụng') || s.includes('Tài chính')))
    return 'Phân tích Tài chính & Tín dụng';
  if (skills.some((s) => s.includes('Dược') || s.includes('HPLC')))
    return 'Kiểm nghiệm Dược phẩm & Hóa sinh';
  if (skills.some((s) => s.includes('Revit') || s.includes('Nội thất')))
    return 'Thiết kế Kiến trúc & Nội thất';
  if (skills.some((s) => s.includes('QA') || s.includes('QC')))
    return 'Quản lý Chất lượng (QA/QC)';
  if (skills.some((s) => s.includes('SQL') || s.includes('cơ sở dữ liệu')))
    return 'Quản trị Cơ sở Dữ liệu & Hệ thống';
  if (skills.some((s) => s.includes('SolidWorks') || s.includes('Cơ điện tử')))
    return 'Thiết kế Cơ điện tử & Mô phỏng';
  if (skills.some((s) => s.includes('Công nghệ tài chính')))
    return 'Công nghệ Tài chính (Fintech)';
  if (skills.some((s) => s.includes('Mầm non') || s.includes('phát triển trẻ')))
    return 'Giáo dục Mầm non Thực nghiệm';
  if (skills.some((s) => s.includes('Chăn nuôi') || s.includes('sinh học')))
    return 'Quản lý Kỹ thuật Chăn nuôi';
  if (skills.some((s) => s.includes('Điều dưỡng')))
    return 'Chăm sóc Điều dưỡng Lâm sàng';
  if (skills.some((s) => s.includes('Khách sạn') || s.includes('PMS')))
    return 'Vận hành Dịch vụ Khách sạn';
  if (skills.some((s) => s.includes('Kiểm toán') || s.includes('VAS')))
    return 'Trợ lý Kiểm toán & Kế toán';
  if (skills.some((s) => s.includes('Wireshark') || s.includes('An ninh mạng')))
    return 'An ninh Mạng & Hạ tầng';
  if (skills.some((s) => s.includes('PCR') || s.includes('vi sinh')))
    return 'Kỹ thuật Vi sinh & Sinh học Phân tử';
  if (skills.some((s) => s.includes('Xuất nhập khẩu')))
    return 'Nghiệp vụ Xuất Nhập Khẩu';
  if (skills.some((s) => s.includes('Thú y')))
    return 'Bác sĩ Thú y & Chẩn đoán';
  if (skills.some((s) => s.includes('Y học cổ truyền')))
    return 'Bác sĩ Y học Cổ truyền';
  if (skills.some((s) => s.includes('Du lịch') || s.includes('tour')))
    return 'Điều hành & Hướng dẫn Du lịch';
  if (skills.some((s) => s.includes('Marketing') || s.includes('SEO')))
    return 'Marketing Số & Tối ưu hóa SEO';
  if (skills.some((s) => s.includes('SIEM') || s.includes('bảo mật')))
    return 'Giám sát An toàn Thông tin (SOC)';
  if (skills.some((s) => s.includes('Ô tô')))
    return 'Kỹ thuật Chẩn đoán Điện Ô tô';
  if (skills.some((s) => s.includes('Nuôi cấy mô')))
    return 'Công nghệ Sinh học & Nuôi cấy Mô';
  if (skills.some((s) => s.includes('Bán hàng') || s.includes('CRM')))
    return 'Quản lý Bán hàng & Chăm sóc Khách hàng';
  if (
    skills.some((s) => s.includes('Sáng tạo nội dung') || s.includes('Văn học'))
  )
    return 'Biên tập & Sáng tạo Nội dung';
  if (skills.some((s) => s.includes('Thủy sản')))
    return 'Kỹ thuật Nuôi trồng Thủy sản';
  if (skills.some((s) => s.includes('Y tế công cộng')))
    return 'Phân tích Số liệu Y tế Công cộng';
  if (skills.some((s) => s.includes('F&B') || s.includes('Nhà hàng')))
    return 'Quản lý Dịch vụ Ẩm thực (F&B)';
  if (skills.some((s) => s.includes('PR') || s.includes('Canva')))
    return 'Quan hệ Công chúng & Truyền thông';
  if (
    skills.some((s) => s.includes('Machine Learning') || s.includes('Power BI'))
  )
    return 'Khoa học Dữ liệu & Học máy';
  if (skills.some((s) => s.includes('AutoCAD') || s.includes('cầu đường')))
    return 'Thiết kế Kết cấu Công trình';
  if (skills.some((s) => s.includes('ArcGIS') || s.includes('Địa chất')))
    return 'Khảo sát Địa chất & Bản đồ số';
  if (skills.some((s) => s.includes('Lưu trữ') || s.includes('Thư viện')))
    return 'Lưu trữ Thông tin & Tư liệu';
  if (skills.some((s) => s.includes('Môi trường') || s.includes('ĐTM')))
    return 'Kỹ thuật Môi trường & ĐTM';
  if (skills.some((s) => s.includes('Báo chí') || s.includes('Premiere')))
    return 'Phóng viên & Biên tập Đa phương tiện';
  if (skills.some((s) => s.includes('PyTorch')))
    return 'Nghiên cứu Trí tuệ Nhân tạo (AI)';
  if (skills.some((s) => s.includes('Bất động sản')))
    return 'Phân tích Đầu tư Bất động sản';
  if (skills.some((s) => s.includes('Triết học') || s.includes('Phản biện')))
    return 'Nghiên cứu & Phê bình Học thuật';

  return `Chuyên viên ${major}`;
}

function getScholarshipField(major) {
  return `Ngành ${major}`;
}
