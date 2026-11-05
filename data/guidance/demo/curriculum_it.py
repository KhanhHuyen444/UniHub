# -*- coding: utf-8 -*-
"""
curriculum_it.py
Kho dữ liệu định hướng 4 giai đoạn chi tiết từ A-Z cho 30 bài viết Công nghệ thông tin & Tính toán.
Bao gồm: CNTT (4), KHMT (4), KTPM (4), HTTT (4), KHDL (4), AI (4), ATTT (4), Hardware & Network (2).
"""

from domains_it import IT_ARTICLES

CURRICULUM_IT = dict(IT_ARTICLES)

# ---------------- KHDL (Khoa học dữ liệu) ----------------
CURRICULUM_IT["guidance-khdl-y1"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình làm chủ toán học nền tảng, xác suất thống kê ứng dụng và lập trình phân tích dữ liệu với Python dành cho sinh viên khoa học dữ liệu năm nhất.",
    "p1": "Khoa học dữ liệu (Data Science) là ngành khoa học liên ngành kết hợp giữa toán học thống kê, khoa học máy tính và tri thức chuyên ngành để khai phóng những hiểu biết sâu sắc từ khối lượng dữ liệu khổng lồ. Năm thứ nhất là thời điểm quyết định để sinh viên xây dựng trực giác số học vững vàng: hiểu rõ bản chất của các phân phối xác suất, kỳ vọng toán học, phương sai và làm quen với ngôn ngữ Python trong việc biến các con số thô thành biểu đồ có khả năng kể chuyện.",
    "p2": "Đối với người mới bắt đầu, thách thức lớn nhất là vượt qua nỗi sợ các công thức toán trừu tượng. Lộ trình dưới đây giúp bạn liên kết trực tiếp giữa các định lý thống kê và việc viết mã trực quan hóa số liệu thực tế, biến toán học thành công cụ tư duy khám phá đầy thú vị.",
    "roles": [
        ("Thực tập sinh phân tích dữ liệu (Data Analyst Intern)", "Thực hiện thu thập dữ liệu, làm sạch số liệu cơ bản và xây dựng các biểu đồ phân tích mô tả."),
        ("Cộng tác viên thống kê & Báo cáo", "Hỗ trợ lập các báo cáo thống kê định kỳ và tính toán các chỉ số đo lường hiệu suất (KPI) doanh nghiệp."),
        ("Trợ lý nghiên cứu dữ liệu (Data Research Assistant)", "Thu thập các tập dữ liệu mở, chuẩn hóa định dạng CSV/JSON và thực hiện tiền xử lý ban đầu.")
    ],
    "stages": [
        ("Giai đoạn 1: Toán giải tích nhiều biến, đại số tuyến tính & Xác suất thống kê mô tả", [
            "Nắm vững các phép toán vector, ma trận: tích vô hướng, ma trận chuyển vị, định thức và tìm hiểu ý nghĩa hình học của phép biến đổi tuyến tính.",
            "Làm chủ thống kê mô tả: các đại lượng đo lường trung tâm (Mean, Median, Mode) và độ phân tán (Variance, Standard Deviation, Interquartile Range IQR).",
            "Hiểu bản chất các phân phối xác suất kinh điển: Phân phối chuẩn (Gaussian/Normal Distribution), Phân phối nhị thức và Định lý giới hạn trung tâm (CLT).",
            "Ứng dụng công thức Bayes để giải quyết các bài toán suy luận xác suất có điều kiện trong chẩn đoán y khoa và lọc thư rác."
        ]),
        ("Giai đoạn 2: Lập trình xử lý dữ liệu với Python, NumPy & Thao tác bảng biểu Pandas", [
            "Thành thạo cấu trúc mảng đa chiều NumPy: chỉ mục boolean (Boolean Indexing), phép toán Broadcasting và tối ưu hóa tính toán vector.",
            "Làm chủ thư viện Pandas: thao tác với cấu trúc Series và DataFrame, đọc ghi các tệp dữ liệu CSV, Excel, Parquet.",
            "Xử lý dữ liệu thực tế: kỹ thuật xử lý giá trị khuyết thiếu (Imputation với dropna/fillna), loại bỏ dữ liệu trùng lặp và chuyển đổi kiểu dữ liệu.",
            "Thực hiện bài tập lớn: Phân tích tập dữ liệu hành khách tàu Titanic, trích xuất 10 thông tin thống kê quan trọng về tỷ lệ sống sót."
        ]),
        ("Giai đoạn 3: Phân tích dữ liệu khám phá (EDA) & Trực quan hóa dữ liệu với Seaborn", [
            "Thực hành quy trình Phân tích dữ liệu khám phá (Exploratory Data Analysis - EDA): phân tích đơn biến, hai biến và đa biến.",
            "Sử dụng Matplotlib và Seaborn để trực quan hóa: biểu đồ phân phối Histogram, biểu đồ phân tán Scatter Plot, Boxplot phát hiện điểm dị biệt (Outliers).",
            "Phân tích hệ số tương quan Pearson và Spearman, vẽ biểu đồ nhiệt tương quan (Correlation Heatmap) để tìm mối liên hệ giữa các biến số.",
            "Thực hiện kiểm định giả thuyết thống kê cơ bản: kiểm định Student's t-test để so sánh giá trị trung bình giữa hai nhóm khách hàng."
        ]),
        ("Giai đoạn 4: Kể chuyện dữ liệu (Data Storytelling) & Đồ án phân tích dữ liệu đầu tay", [
            "Rèn luyện kỹ năng Kể chuyện dữ liệu (Data Storytelling): chuyển hóa các biểu đồ phân tích thành các thông điệp kinh doanh có giá trị hành động.",
            "Xây dựng Dashboard phân tích trực quan tương tác bằng Streamlit hoặc Jupyter Notebook trình bày báo cáo chuyên nghiệp.",
            "Đóng gói toàn bộ mã nguồn phân tích lên GitHub với tài liệu hướng dẫn và diễn giải kết luận chi tiết.",
            "Bảo vệ đồ án phân tích dữ liệu trước nhóm chuyên môn và hoàn thành bài kiểm tra đánh giá năng lực tư duy thống kê thực tế."
        ])
    ],
    "reqs": [
        "Kiến thức toán học đại số và giải tích ở trình độ trung học phổ thông.",
        "Máy tính cài đặt môi trường Anaconda hoặc Jupyter Notebook và ngôn ngữ Python 3.10+.",
        "Sự tò mò khoa học và tính cẩn trọng, trung thực khi làm việc với số liệu."
    ]
}

CURRICULUM_IT["guidance-khdl-y2"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình khai phá dữ liệu với SQL nâng cao, kỹ nghệ đặc trưng và làm chủ các thuật toán học máy kinh điển dành cho sinh viên khoa học dữ liệu năm hai.",
    "p1": "Năm thứ hai là bước chuyển mình từ việc mô tả dữ liệu quá khứ sang dự báo xu hướng tương lai bằng sức mạnh của các mô hình Học máy (Machine Learning). Một chuyên viên dữ liệu chuyên nghiệp cần thành thạo việc trích xuất và biến đổi dữ liệu trực tiếp từ các kho dữ liệu doanh nghiệp bằng SQL nâng cao, đồng thời hiểu sâu sắc nguyên lý hoạt động của các thuật toán phân loại và hồi quy kinh điển.",
    "p2": "Để xây dựng được các mô hình có độ tin cậy cao, khâu kỹ nghệ đặc trưng (Feature Engineering) chiếm đến 80% thành công của một dự án dữ liệu. Lộ trình dưới đây trang bị cho bạn tư duy tinh chỉnh dữ liệu sắc bén và kỹ năng huấn luyện mô hình chuẩn mực.",
    "roles": [
        ("Chuyên viên khoa học dữ liệu tập sự (Junior Data Scientist)", "Tham gia xây dựng các mô hình dự báo hành vi khách hàng và tối ưu hóa chuyển đổi số."),
        ("Kỹ sư trích xuất dữ liệu (Data Extraction Engineer)", "Viết các câu truy vấn SQL phức tạp, trích xuất dữ liệu từ Data Warehouse và phục vụ phân tích."),
        ("Chuyên viên phân tích kinh doanh thông minh (BI Analyst)", "Thiết kế các mô hình dữ liệu báo cáo và xây dựng bảng điều khiển trực quan trên Power BI/Tableau.")
    ],
    "stages": [
        ("Giai đoạn 1: Truy vấn SQL nâng cao cho phân tích dữ liệu & Tối ưu hóa truy vấn", [
            "Thành thạo các hàm cửa sổ (Window Functions): ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD() và tính toán lũy kế.",
            "Áp dụng biểu thức bảng chung (Common Table Expressions - CTE) và đệ quy CTE để phân tích cấu trúc phân cấp và cây dữ liệu.",
            "Thực hiện phân tích giỏ hàng (Cohort Analysis) và tính toán tỷ lệ giữ chân người dùng (Retention Rate) hoàn toàn bằng câu lệnh SQL.",
            "Tối ưu hóa thời gian thực thi câu truy vấn trên tập dữ liệu hàng triệu dòng bằng cách phân tích Execution Plan và đánh chỉ mục."
        ]),
        ("Giai đoạn 2: Kỹ nghệ đặc trưng (Feature Engineering) & Tiền xử lý dữ liệu chuẩn", [
            "Kỹ thuật mã hóa biến định loại: One-Hot Encoding, Label Encoding, Target Encoding và xử lý biến thứ bậc.",
            "Chuẩn hóa dữ liệu số: phân biệt giữa Min-Max Scaling, Standard Scaling (Z-score) và Robust Scaling khi có nhiều điểm dị biệt.",
            "Xử lý mất cân bằng dữ liệu (Imbalanced Data) bằng kỹ thuật tái lấy mẫu SMOTE (Synthetic Minority Over-sampling) và Random Under-sampling.",
            "Áp dụng phương pháp phân tích thành phần chính (PCA) để giảm chiều dữ liệu và loại bỏ hiện tượng đa cộng tuyến."
        ]),
        ("Giai đoạn 3: Huấn luyện các mô hình Machine Learning có giám sát kinh điển", [
            "Nắm vững nguyên lý và cài đặt thuật toán Cây quyết định (Decision Tree): chỉ số vẩn đục Gini, Entropy và Information Gain.",
            "Huấn luyện các mô hình tập hợp (Ensemble Methods): Rừng ngẫu nhiên (Random Forest) và Tăng cường độ dốc (Gradient Boosting với XGBoost, LightGBM).",
            "Hiểu sâu thuật toán Máy vector hỗ trợ (Support Vector Machine - SVM) và cơ chế hàm nhân (Kernel Trick) trong phân loại phi tuyến.",
            "Đánh giá mô hình toàn diện: Ma trận nhầm lẫn (Confusion Matrix), Precision, Recall, F1-score, đường cong ROC và chỉ số AUC."
        ]),
        ("Giai đoạn 4: Học không giám sát, giải thích mô hình & Báo cáo dự báo kinh doanh", [
            "Áp dụng các thuật toán phân cụm không giám sát: K-Means Clustering (xác định K bằng phương pháp Elbow) và Phân cụm phân cấp (Hierarchical Clustering).",
            "Giải thích mô hình hộp đen (Explainable AI) bằng thư viện SHAP (Shapley Additive Explanations) để hiểu mức độ đóng góp của từng đặc trưng.",
            "Xây dựng mô hình hoàn chỉnh dự báo khả năng rời bỏ của khách hàng (Customer Churn Prediction) cho công ty viễn thông.",
            "Viết báo cáo đánh giá tác động kinh doanh: lượng hóa giá trị tiết kiệm được từ việc can thiệp giữ chân khách hàng kịp thời."
        ])
    ],
    "reqs": [
        "Đã hoàn thành các học phần Toán nền tảng, Xác suất thống kê và Python căn bản.",
        "Cài đặt hệ quản trị PostgreSQL và các thư viện Scikit-learn, XGBoost, LightGBM, SHAP.",
        "Khả năng liên hệ giữa các chỉ số toán học và bài toán kinh doanh thực tế."
    ]
}

CURRICULUM_IT["guidance-khdl-y3"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình nghiên cứu học sâu (Deep Learning), xử lý dữ liệu lớn với Apache Spark và tối ưu hóa mô hình quy mô công nghiệp.",
    "p1": "Bước vào năm thứ ba, sinh viên khoa học dữ liệu đối mặt với hai thách thức lớn nhất của ngành công nghiệp hiện đại: dữ liệu phi cấu trúc (hình ảnh, văn bản, âm thanh) và dữ liệu quy mô khổng lồ (Big Data) vượt quá khả năng xử lý của một máy tính đơn lẻ. Sự kết hợp giữa kiến trúc mạng nơ-ron sâu và các hệ thống tính toán phân tán là chìa khóa để giải quyết các bài toán trí tuệ nhân tạo quy mô lớn.",
    "p2": "Lộ trình này giúp bạn chuyển từ việc chạy các thuật toán trên máy cá nhân sang việc làm chủ hạ tầng phân tán với PySpark, hiểu rõ cơ chế hoạt động của GPU trong huấn luyện mạng nơ-ron và áp dụng các kỹ thuật nén mô hình để triển khai trong thực tế.",
    "roles": [
        ("Kỹ sư dữ liệu lớn tập sự (Junior Big Data Engineer)", "Xây dựng các luồng xử lý dữ liệu phân tán, viết job tính toán Spark và tối ưu hóa truy vấn trên Data Lake."),
        ("Kỹ sư học sâu thực tập (Deep Learning Intern)", "Huấn luyện và tinh chỉnh các kiến trúc mạng nơ-ron cho thị giác máy tính hoặc xử lý ngôn ngữ tự nhiên."),
        ("Chuyên viên nghiên cứu giải pháp AI doanh nghiệp", "Khảo sát và ứng dụng các mô hình học sâu hiện đại vào quy trình tự động hóa của doanh nghiệp.")
    ],
    "stages": [
        ("Giai đoạn 1: Mạng nơ-ron truyền thẳng (MLP) & Huấn luyện với PyTorch", [
            "Hiểu bản chất toán học của nơ-ron nhân tạo: hàm kích hoạt (ReLU, Sigmoid, Softmax) và thuật toán lan truyền ngược (Backpropagation) với quy tắc chuỗi.",
            "Làm chủ framework PyTorch: cấu trúc Tensor, tính năng tự động tính đạo hàm Autograd, xây dựng mô hình với torch.nn.Module.",
            "Thiết lập vòng lặp huấn luyện chuẩn: nạp dữ liệu với Dataset/DataLoader, tối ưu hóa với hàm mất mát CrossEntropyLoss và thuật toán Adam.",
            "Áp dụng các kỹ thuật chống Overfitting trong Deep Learning: Dropout, Batch Normalization và Learning Rate Schedulers."
        ]),
        ("Giai đoạn 2: Xử lý dữ liệu lớn phân tán với Apache Spark & PySpark", [
            "Nắm vững kiến trúc Master-Worker của Apache Spark, khái niệm RDD (Resilient Distributed Datasets) và cơ chế thực thi lười (Lazy Evaluation).",
            "Thành thạo PySpark DataFrame API: đọc ghi dữ liệu từ HDFS/S3, thực hiện các phép biến đổi (Transformation) và hành động (Action) phân tán.",
            "Tối ưu hóa hiệu năng tính toán Spark: xử lý hiện tượng lệch dữ liệu (Data Skewness), sử dụng Broadcast Variables và kỹ thuật Partitioning.",
            "Xây dựng đường ống xử lý dữ liệu lớn (ETL Pipeline) xử lý 10 triệu bản ghi nhật ký giao dịch ngân hàng theo thời gian thực."
        ]),
        ("Giai đoạn 3: Mạng nơ-ron tích chập (CNN) & Mạng tuần hoàn (RNN/LSTM) ứng dụng", [
            "Nghiên cứu nguyên lý tích chập 2D, các tầng Pooling và các kiến trúc kinh điển trong thị giác máy tính (ResNet, EfficientNet).",
            "Huấn luyện mô hình phân loại bệnh học qua ảnh X-quang phổi sử dụng kỹ thuật học chuyển giao (Transfer Learning) với mô hình tiền huấn luyện.",
            "Tiếp cận kiến trúc mạng hồi quy LSTM và GRU để xử lý dữ liệu chuỗi thời gian (Time-Series Forecasting) và dữ liệu văn bản.",
            "Dự báo biến động chỉ số tài chính dựa trên dữ liệu chuỗi thời gian lịch sử kết hợp kỹ thuật cửa sổ trượt (Sliding Window)."
        ]),
        ("Giai đoạn 4: Tinh chỉnh siêu tham số, đóng gói mô hình & Thử nghiệm tải quy mô lớn", [
            "Tự động hóa tìm kiếm siêu tham số tối ưu bằng thuật toán Bayesian Optimization với thư viện Optuna.",
            "Nén và tối ưu hóa kích thước mô hình học sâu: kỹ thuật lượng tử hóa (Quantization) và tỉa thưa trọng số (Pruning) để giảm độ trễ suy luận.",
            "Đóng gói mô hình học sâu vào Docker container và xây dựng dịch vụ API suy luận tốc độ cao với FastAPI.",
            "Thực hiện kiểm thử tải hệ thống suy luận mô hình và đo lường thông số độ trễ xử lý (Latency P99) dưới 50ms."
        ])
    ],
    "reqs": [
        "Đã nắm chắc lập trình Python, đại số ma trận và các thuật toán học máy kinh điển.",
        "Máy tính có card đồ họa GPU NVIDIA hoặc tài khoản sử dụng Google Colab / Kaggle GPU.",
        "Kiến thức cơ bản về hệ điều hành Linux và Docker."
    ]
}

CURRICULUM_IT["guidance-khdl-y4"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình hoàn thiện khóa luận tốt nghiệp khoa học dữ liệu, thực hành đạo đức dữ liệu và chinh phục vị trí Data Scientist chính thức.",
    "p1": "Năm thứ tư là thời điểm khẳng định bản lĩnh của một nhà khoa học dữ liệu: khả năng giải quyết độc lập một bài toán thực tế có độ phức tạp cao, từ khâu xác định vấn đề nghiệp vụ, thu thập dữ liệu thô, xây dựng mô hình dự báo đến việc triển khai vào sản xuất và giải trình tác động kinh tế. Bên cạnh kỹ năng kỹ thuật, sự am hiểu sâu sắc về Đạo đức dữ liệu (Data Ethics) và quyền riêng tư (GDPR, bảo vệ dữ liệu cá nhân) là tiêu chuẩn đạo đức bắt buộc của một chuyên gia.",
    "p2": "Lộ trình này sẽ đồng hành cùng bạn hoàn thành một công trình khóa luận chất lượng xuất sắc, đồng thời trang bị kỹ năng phỏng vấn tình huống dữ liệu (Data Case Interview) để bạn tự tin gia nhập các tập đoàn công nghệ hàng đầu.",
    "roles": [
        ("Nhà khoa học dữ liệu chính thức (Junior Data Scientist)", "Chịu trách nhiệm thiết kế, huấn luyện và duy trì các mô hình học máy phục vụ sản phẩm cốt lõi."),
        ("Kỹ sư học máy (Machine Learning Engineer)", "Xây dựng hạ tầng đưa mô hình AI/ML từ môi trường nghiên cứu vào dây chuyền vận hành production."),
        ("Chuyên viên tư vấn phân tích dữ liệu nâng cao", "Cung cấp giải pháp phân tích dữ liệu chuyên sâu cho khách hàng tài chính, bán lẻ và sản xuất.")
    ],
    "stages": [
        ("Giai đoạn 1: Xác định đề tài khóa luận thực tiễn & Thiết kế kiến trúc giải pháp", [
            "Lựa chọn bài toán nghiên cứu gắn liền với thách thức thực tế của ngành: Hệ thống gợi ý cá nhân hóa (Recommendation System), Phát hiện gian lận tài chính (Fraud Detection), hoặc Phân tích văn bản y sinh.",
            "Thu thập và kiểm tra tính hợp lệ của tập dữ liệu: rà soát nguy cơ thiên vị dữ liệu (Data Bias) và rủi ro vi phạm quyền riêng tư người dùng.",
            "Xây dựng ma trận đánh giá giải pháp: xác định chỉ số kỹ thuật (AUC, RMSE, F1) song hành cùng chỉ số kinh doanh (LTV, ROI, Churn Reduction).",
            "Bảo vệ thành công đề cương khóa luận tốt nghiệp trước hội đồng khoa học chuyên môn."
        ]),
        ("Giai đoạn 2: Hiện thực hóa mô hình chuyên sâu & Tối ưu hóa hiệu năng", [
            "Xây dựng đường ống dữ liệu hoàn chỉnh từ tiền xử lý, trích xuất đặc trưng đến huấn luyện mô hình theo chuẩn End-to-End.",
            "Áp dụng các kỹ thuật học sâu tiên tiến nhất phù hợp với bài toán: mô hình Graph Neural Network (GNN) cho mạng quan hệ hoặc Transformer cho chuỗi sự kiện.",
            "Tiến hành kiểm thử chéo nghiêm ngặt trên nhiều tập dữ liệu độc lập để đảm bảo mô hình không bị quá khớp với dữ liệu huấn luyện.",
            "Lượng hóa độ không chắc chắn (Uncertainty Estimation) trong các dự báo của mô hình để đảm bảo an toàn khi ra quyết định tự động."
        ]),
        ("Giai đoạn 3: Đạo đức dữ liệu, tuân thủ pháp lý & Báo cáo khóa luận tốt nghiệp", [
            "Đánh giá tính công bằng của mô hình (Model Fairness) trên các nhóm người dùng khác nhau và loại bỏ các yếu tố phân biệt đối xử tiềm ẩn.",
            "Soạn thảo báo cáo khóa luận tốt nghiệp theo cấu trúc chuẩn học thuật: tổng quan bài toán, cơ sở lý thuyết, phân tích thực nghiệm và đánh giá hạn chế.",
            "Thiết kế slide thuyết trình trực quan, sử dụng biểu đồ và số liệu dẫn chứng sinh động để làm nổi bật tính mới và giá trị thực tiễn của đề tài.",
            "Thực hiện quay video demo quy trình hoạt động của mô hình và giao diện tương tác phục vụ hội đồng chấm khóa luận."
        ]),
        ("Giai đoạn 4: Hoàn thiện Portfolio dữ liệu, luyện phỏng vấn Case Study & Nhận việc", [
            "Xây dựng Portfolio khoa học dữ liệu chuyên nghiệp trên GitHub: mã nguồn rõ ràng, tài liệu tái lập kết quả và bài viết phân tích chuyên sâu trên blog cá nhân.",
            "Luyện tập phỏng vấn tình huống dữ liệu (Data Science Case Interview): phân tích bài toán kinh doanh, đề xuất giải pháp kỹ thuật và xử lý các câu hỏi số học trực tiếp.",
            "Chuẩn bị kỹ năng trả lời phỏng vấn hành vi và làm rõ đóng góp cá nhân trong các dự án nhóm.",
            "Ứng tuyển chính thức vào các vị trí Data Scientist/ML Engineer tại các công ty công nghệ, ngân hàng và viện nghiên cứu uy tín."
        ])
    ],
    "reqs": [
        "Hoàn thành toàn bộ chương trình đào tạo chuyên ngành Khoa học dữ liệu.",
        "Có ít nhất 1 dự án nghiên cứu hoặc đồ án học máy hoàn chỉnh có mã nguồn công khai.",
        "Tư duy đạo đức nghề nghiệp vững vàng và cam kết bảo vệ dữ liệu người dùng."
    ]
}

# ---------------- AI (Trí tuệ nhân tạo) ----------------
CURRICULUM_IT["guidance-ai-y1"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình xây dựng nền tảng toán giải tích nhiều biến, đại số ma trận và lập trình khoa học Python dành cho sinh viên ngành trí tuệ nhân tạo năm nhất.",
    "p1": "Trí tuệ nhân tạo (Artificial Intelligence) là đỉnh cao của sự giao thoa giữa toán học và khoa học máy tính, với mục tiêu kiến tạo các hệ thống có khả năng nhận thức, suy luận và tự học hỏi. Năm thứ nhất là giai đoạn đặt những viên gạch nền móng quan trọng nhất: làm chủ ngôn ngữ toán học của AI (gradient, không gian vector nhiều chiều, tối ưu hóa vi tích phân) và sử dụng thành thạo Python để hiện thực hóa các phép toán số học phức tạp.",
    "p2": "Đừng vội vàng lao vào gọi các hàm thư viện học sâu khi chưa hiểu đạo hàm riêng hay phép nhân ma trận vận hành ra sao. Lộ trình dưới đây sẽ giúp bạn xây dựng trực giác toán học sâu sắc và nền tảng lập trình khoa học vững vàng.",
    "roles": [
        ("Thực tập sinh lập trình khoa học Python", "Hiện thực hóa các thuật toán toán học cơ bản và viết mã xử lý dữ liệu ma trận."),
        ("Trợ lý nghiên cứu tính toán số (Numerical Computing Assistant)", "Hỗ trợ chạy các thử nghiệm số học và trực quan hóa hàm số nhiều biến."),
        ("Cộng tác viên lập trình thuật toán AI cơ sở", "Viết mã các thuật toán tìm kiếm kinh điển và giải quyết các bài toán logic.")
    ],
    "stages": [
        ("Giai đoạn 1: Toán giải tích nhiều biến & Phép tính vi phân hàm ma trận", [
            "Làm chủ đạo hàm riêng (Partial Derivatives), đạo hàm theo hướng (Directional Derivatives) và gradient của hàm số nhiều biến.",
            "Hiểu ý nghĩa hình học của mặt phẳng tiếp xúc, điểm yên ngựa (Saddle Points) và cực trị hàm nhiều biến.",
            "Áp dụng quy tắc chuỗi ma trận (Matrix Chain Rule) trong việc tính toán đạo hàm của các hàm hợp phức tạp.",
            "Thực hành viết chương trình Python tính toán gradient giải tích và so sánh sai số với đạo hàm xấp xỉ số trị."
        ]),
        ("Giai đoạn 2: Đại số tuyến tính tính toán & Phân tích không gian vector", [
            "Hiểu sâu không gian vector, cơ sở (Basis), số chiều (Dimension) và phép biến đổi tuyến tính qua ma trận.",
            "Nắm vững các phép phân rã ma trận kinh điển: Phân tích trị riêng - vector riêng (Eigendecomposition) và Phân rã giá trị suy biến (Singular Value Decomposition - SVD).",
            "Lập trình với NumPy: tối ưu hóa các phép tính ma trận không dùng vòng lặp (Vectorization) để tăng tốc độ tính toán lên 100 lần.",
            "Thực hiện bài tập lớn: Ứng dụng phân tích SVD trong việc nén kích thước ảnh số xám mà vẫn giữ được độ sắc nét cơ bản."
        ]),
        ("Giai đoạn 3: Thuật toán tối ưu hóa & Phương pháp Gradient Descent", [
            "Hiểu bản chất tối ưu hóa lồi (Convex Optimization) và vai trò của hàm mất mát lồi trong việc tìm điểm cực tiểu toàn cục.",
            "Tự cài đặt từ đầu thuật toán Gradient Descent cơ bản, Gradient Descent theo lô nhỏ (Mini-batch SGD) và Momentum.",
            "Thực hành trực quan hóa đường đi của thuật toán tối ưu hóa trên các bề mặt hàm số phức tạp (hàm Rosenbrock, hàm Rastrigin).",
            "Phân tích hiện tượng bùng nổ gradient (Exploding Gradients) và triệt tiêu gradient (Vanishing Gradients) qua các thí nghiệm số."
        ]),
        ("Giai đoạn 4: Thuật toán tìm kiếm thông minh & Đồ án trí tuệ nhân tạo đầu tay", [
            "Nghiên cứu các thuật toán tìm kiếm kinh điển trong không gian trạng thái: Tìm kiếm theo chiều rộng (BFS), chiều sâu (DFS) và tìm kiếm A* với hàm Heuristic.",
            "Lập trình giải bài toán Trò chơi 8 ô (8-puzzle problem) sử dụng thuật toán A* với hàm Heuristic khoảng cách Manhattan.",
            "Áp dụng thuật toán Minimax kết hợp tỉa nhánh Alpha-Beta để xây dựng trò chơi cờ Caro hoặc cờ Othello tự đấu với người.",
            "Hoàn thành báo cáo đánh giá thuật toán và tự kiểm tra kiến thức qua bài thi toán học và lập trình khoa học toàn diện."
        ])
    ],
    "reqs": [
        "Kiến thức toán học phổ thông xuất sắc, đặc biệt là hình học không gian và giải tích.",
        "Máy tính cài đặt môi trường Python 3.11+ và thư viện NumPy, SciPy, Matplotlib.",
        "Tư duy trừu tượng toán học cao và tính kiên trì trong việc tìm tòi bản chất vấn đề."
    ]
}

CURRICULUM_IT["guidance-ai-y2"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình làm chủ kiến trúc mạng nơ-ron sâu (Deep Learning) và huấn luyện mô hình với PyTorch dành cho sinh viên trí tuệ nhân tạo năm hai.",
    "p1": "Năm thứ hai đánh dấu bước chân chính thức vào kỷ nguyên Học sâu (Deep Learning) - công nghệ nền tảng tạo nên những đột phá kỳ diệu của AI hiện đại từ xe tự hành đến xử lý hình ảnh y khoa. Sinh viên cần chuyển từ việc hiểu toán học thuần túy sang năng lực thiết kế, hiện thực hóa và huấn luyện các kiến trúc mạng nơ-ron phức tạp trên nền tảng PyTorch.",
    "p2": "Huấn luyện một mạng nơ-ron sâu là sự kết hợp giữa kiến thức khoa học và nghệ thuật thực nghiệm: bạn cần biết cách khởi tạo trọng số hợp lý, lựa chọn hàm kích hoạt phù hợp, quản lý tài nguyên GPU hiệu quả và chẩn đoán chính xác nguyên nhân khi mô hình không hội tụ.",
    "roles": [
        ("Kỹ sư học sâu tập sự (Junior Deep Learning Engineer)", "Huấn luyện và tinh chỉnh các kiến trúc mạng nơ-ron tích chập và mạng tuần hoàn."),
        ("Kỹ sư thị giác máy tính tập sự (Junior Computer Vision Engineer)", "Xây dựng các module phát hiện vật thể, phân đoạn ảnh và theo dõi chuyển động."),
        ("Trợ lý nghiên cứu trí tuệ nhân tạo", "Thực hiện các thí nghiệm huấn luyện trên máy chủ GPU và thống kê các chỉ số đo lường học thuật.")
    ],
    "stages": [
        ("Giai đoạn 1: Nền tảng kiến trúc mạng nơ-ron & Làm chủ PyTorch Framework", [
            "Hiểu rõ kiến trúc Multi-Layer Perceptron (MLP), hàm mất mát CrossEntropy, MSE và cơ chế tự động tính đạo hàm Autograd.",
            "Làm chủ quy trình xây dựng mô hình trên PyTorch: cấu trúc torch.nn.Module, kế thừa lớp, định nghĩa forward pass.",
            "Xây dựng đường ống nạp dữ liệu chuyên nghiệp với Dataset và DataLoader tùy biến, áp dụng tăng cường dữ liệu (Data Augmentation).",
            "Thực hành huấn luyện mạng nơ-ron phân loại ảnh hoa quả trên tập dữ liệu tự thu thập đạt độ chính xác trên 90%."
        ]),
        ("Giai đoạn 2: Mạng nơ-ron tích chập (CNN) & Thị giác máy tính nâng cao", [
            "Nghiên cứu sâu cơ chế tích chập: kích thước Kernel, Stride, Padding, Receptive Field và vai trò trích xuất đặc trưng không gian.",
            "Tìm hiểu sự tiến hóa của các kiến trúc CNN kinh điển: VGG, Inception, ResNet (cơ chế Residual Connection giải quyết triệt tiêu gradient) và MobileNet.",
            "Áp dụng kỹ thuật học chuyển giao (Transfer Learning) và tinh chỉnh mô hình (Fine-tuning) với mô hình ResNet-50 tiền huấn luyện.",
            "Xây dựng ứng dụng hoàn chỉnh: Nhận diện người đeo khẩu trang y tế theo thời gian thực từ luồng Webcam máy tính."
        ]),
        ("Giai đoạn 3: Phát hiện vật thể (Object Detection) & Phân đoạn ảnh (Image Segmentation)", [
            "Phân biệt rõ ràng giữa các bài toán thị giác máy tính: Classification, Object Detection, Semantic Segmentation và Instance Segmentation.",
            "Nắm vững nguyên lý hoạt động của các kiến trúc phát hiện vật thể một giai đoạn (YOLOv8) và hai giai đoạn (Faster R-CNN).",
            "Hiểu các khái niệm cốt lõi: Hộp bao (Bounding Box), chỉ số giao trên hợp (IoU), triệt tiêu các điểm cực đại (Non-Maximum Suppression - NMS) và mAP.",
            "Huấn luyện mô hình YOLOv8 trên tập dữ liệu biển báo giao thông Việt Nam và đánh giá độ trễ xử lý khung hình (FPS)."
        ]),
        ("Giai đoạn 4: Quản lý thí nghiệm học sâu, chẩn đoán mô hình & Đồ án thực chiến", [
            "Sử dụng công cụ theo dõi thí nghiệm chuyên nghiệp (Weights & Biases hoặc TensorBoard) để giám sát hàm mất mát và độ chính xác.",
            "Rèn luyện kỹ năng chẩn đoán lỗi mô hình: phân tích biểu đồ sai số (Error Analysis), phát hiện rò rỉ dữ liệu (Data Leakage) và mất cân bằng lớp.",
            "Đóng gói mô hình học sâu thành dịch vụ suy luận thời gian thực với TorchScript hoặc định dạng ONNX Runtime.",
            "Bảo vệ đồ án thị giác máy tính trước hội đồng và hoàn thành báo cáo kỹ thuật theo chuẩn hội thảo học thuật."
        ])
    ],
    "reqs": [
        "Đã hoàn thành các học phần Toán giải tích, Đại số tuyến tính và Python khoa học.",
        "Máy tính cá nhân có GPU NVIDIA chuyên dụng hoặc khả năng sử dụng các dịch vụ đám mây (Google Colab Pro, Kaggle).",
        "Kỹ năng lập trình hướng đối tượng vững vàng và tinh thần kiên trì trong các thí nghiệm học sâu."
    ]
}

CURRICULUM_IT["guidance-ai-y3"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình nghiên cứu mô hình ngôn ngữ lớn (LLM), xử lý ngôn ngữ tự nhiên (NLP) và xây dựng đường ống MLOps công nghiệp.",
    "p1": "Năm thứ ba đưa sinh viên tiếp cận tuyến đầu của cuộc cách mạng trí tuệ nhân tạo toàn cầu: Xử lý ngôn ngữ tự nhiên hiện đại và các Mô hình ngôn ngữ lớn (Large Language Models - LLM). Hiểu được bản chất của kiến trúc Transformer, cơ chế tự chú ý (Self-Attention) và phương pháp tinh chỉnh mô hình mở ra cơ hội xây dựng những ứng dụng đột phá thay đổi phương thức con người tương tác với tri thức.",
    "p2": "Đồng thời, để các mô hình AI không chỉ dừng lại ở bài báo cáo thực nghiệm mà vận hành ổn định trong dây chuyền sản xuất của doanh nghiệp, kỹ năng MLOps (Machine Learning Operations) - tự động hóa vòng đời huấn luyện, kiểm thử và giám sát mô hình là năng lực cạnh tranh tối thượng của kỹ sư AI.",
    "roles": [
        ("Kỹ sư xử lý ngôn ngữ tự nhiên (NLP Engineer)", "Xây dựng các giải pháp phân tích văn bản, trích xuất thông tin, dịch máy và chatbot nghiệp vụ."),
        ("Kỹ sư MLOps tập sự (Junior MLOps Engineer)", "Thiết lập đường ống tự động hóa huấn luyện mô hình, theo dõi trôi dữ liệu và triển khai suy luận."),
        ("Kỹ sư giải pháp trí tuệ nhân tạo tạo sinh (GenAI Solutions Engineer)", "Phát triển các ứng dụng dựa trên LLM, hệ thống RAG và tinh chỉnh mô hình ngôn ngữ.")
    ],
    "stages": [
        ("Giai đoạn 1: Biểu diễn ngôn ngữ, kiến trúc Transformer & Cơ chế Self-Attention", [
            "Hiểu sự phát triển của biểu diễn từ ngữ: từ Bag-of-Words, TF-IDF đến các không gian nhúng từ dày đặc (Word2Vec, FastText).",
            "Nghiên cứu bài báo kinh điển 'Attention Is All You Need', hiểu cặn kẽ công thức Scaled Dot-Product Attention và Multi-Head Attention.",
            "Phân tích kiến trúc mã hóa - giải mã (Encoder-Decoder), cơ chế mã hóa vị trí (Positional Encoding) và chuẩn hóa tầng (Layer Normalization).",
            "Tự cài đặt một khối Transformer Encoder đơn giản từ đầu bằng PyTorch để hiểu rõ luồng tính toán bên trong ma trận trọng số."
        ]),
        ("Giai đoạn 2: Tinh chỉnh mô hình ngôn ngữ lớn (LLM Fine-tuning) & Hugging Face", [
            "Sử dụng thành thạo hệ sinh thái Hugging Face: Transformers, Datasets, Tokenizers và Evaluate.",
            "Hiểu các họ mô hình ngôn ngữ lớn: mô hình chuyên mã hóa (BERT, RoBERTa), mô hình chuyên giải mã (GPT, LLaMA, Mistral).",
            "Áp dụng các kỹ thuật tinh chỉnh tham số hiệu quả (PEFT): LoRA (Low-Rank Adaptation) và QLoRA để huấn luyện LLM trên GPU phổ thông.",
            "Huấn luyện mô hình phân tích sắc thái cảm xúc (Sentiment Analysis) trên tập đánh giá sản phẩm thương mại điện tử tiếng Việt."
        ]),
        ("Giai đoạn 3: Hệ thống tìm kiếm tăng cường tạo sinh (RAG) & Vector Database", [
            "Hiểu rõ hạn chế về hiện tượng ảo giác (Hallucination) của LLM và nguyên lý giải quyết bằng kiến trúc Retrieval-Augmented Generation (RAG).",
            "Làm chủ quy trình RAG: phân đoạn văn bản (Text Chunking), tính toán vector nhúng với embedding models và lưu trữ trên Vector DB (Chroma, Qdrant).",
            "Tích hợp các khung làm việc chuyên dụng: LangChain hoặc LlamaIndex để xây dựng luồng truy vấn thông tin thông minh.",
            "Xây dựng ứng dụng Chatbot hỏi đáp trợ lý học tập: tự động tra cứu quy chế đào tạo sinh viên và trả lời trích dẫn nguồn chính xác."
        ]),
        ("Giai đoạn 4: Thiết lập đường ống MLOps công nghiệp với MLflow, DVC & Docker", [
            "Quản trị phiên bản dữ liệu và mô hình bằng công cụ DVC (Data Version Control) liên kết với lưu trữ đám mây S3.",
            "Theo dõi vòng đời thí nghiệm, so sánh độ chính xác và quản lý kho mô hình (Model Registry) với MLflow.",
            "Xây dựng dịch vụ phục vụ mô hình suy luận độ trễ thấp bằng vLLM hoặc Ollama và đóng gói container với Docker.",
            "Giám sát hiện tượng trôi dữ liệu (Data Drift) và trôi khái niệm (Concept Drift) trong môi trường vận hành thực tế bằng Evidently AI."
        ])
    ],
    "reqs": [
        "Đã hoàn thành các học phần Mạng nơ-ron sâu và có kinh nghiệm thực hành với PyTorch.",
        "Hiểu biết cơ bản về ngôn ngữ học tính toán và ngữ pháp tiếng Việt / tiếng Anh.",
        "Khả năng làm việc trên môi trường dòng lệnh Linux và công nghệ ảo hóa Docker."
    ]
}

CURRICULUM_IT["guidance-ai-y4"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình thực hiện đồ án nghiên cứu trí tuệ nhân tạo chuyên sâu, đạo đức AI và tuyển dụng kỹ sư trí tuệ nhân tạo chất lượng cao.",
    "p1": "Năm cuối cùng của ngành Trí tuệ nhân tạo là thời điểm sinh viên chứng minh năng lực sáng tạo học thuật hoặc giải quyết trọn vẹn một bài toán công nghệ đột phá cho doanh nghiệp. Khác với việc chỉ dừng lại ở người sử dụng mô hình có sẵn, một kỹ sư AI thực thụ cần sở hữu tư duy đánh giá phản biện, nhận thức sâu sắc về rủi ro đạo đức (an toàn AI, thiên vị thuật toán, sở hữu trí tuệ) và năng lực tối ưu hóa mô hình ở quy mô công nghiệp.",
    "p2": "Lộ trình này sẽ đồng hành cùng bạn từ khâu nghiên cứu phát triển đề tài khóa luận xuất sắc đến việc xây dựng Portfolio ấn tượng và vượt qua các vòng phỏng vấn chuyên sâu tại các trung tâm AI hàng đầu.",
    "roles": [
        ("Kỹ sư trí tuệ nhân tạo chính thức (AI Engineer)", "Thiết kế, xây dựng và đưa các giải pháp trí tuệ nhân tạo vào hệ sinh thái sản phẩm của doanh nghiệp."),
        ("Nghiên cứu viên trí tuệ nhân tạo (AI Research Scientist)", "Tham gia các đề tài nghiên cứu công nghệ lõi, phát triển thuật toán mới và công bố bài báo quốc tế."),
        ("Kỹ sư giải pháp AI đám mây (Cloud AI Solutions Architect)", "Tư vấn và thiết kế kiến trúc AI trên nền tảng đám mây lớn (AWS Bedrock, Azure AI, GCP Vertex AI).")
    ],
    "stages": [
        ("Giai đoạn 1: Xác định đề tài nghiên cứu AI đột phá & Đề cương khóa luận", [
            "Lựa chọn đề tài khóa luận thuộc các hướng nghiên cứu hiện đại: Mô hình đa phương thức (Multimodal AI), Học tăng cường (Reinforcement Learning), AI trong y tế hoặc An toàn AI.",
            "Tổng quan y văn chuyên sâu: phân tích các bài báo học thuật mới nhất tại các hội nghị đỉnh cao (CVPR, ICCV, ACL, EMNLP, NeurIPS).",
            "Thiết kế khung phương pháp luận nghiên cứu và xây dựng giả thuyết khoa học có thể kiểm chứng bằng số liệu định lượng.",
            "Bảo vệ thành công đề cương nghiên cứu khóa luận tốt nghiệp trước hội đồng chuyên môn."
        ]),
        ("Giai đoạn 2: Phát triển mô hình AI cốt lõi & Tối ưu hóa suy luận (Inference Optimization)", [
            "Hiện thực hóa thuật toán đề xuất, tiến hành thử nghiệm đối sánh với ít nhất 3 mô hình Baseline hiện đại nhất trên các tập dữ liệu Benchmark.",
            "Tối ưu hóa tốc độ suy luận mô hình AI: áp dụng TensorRT hoặc ONNX để tăng thông lượng xử lý trên phần cứng chuyên dụng.",
            "Tiến hành phân tích đóng góp thành phần (Ablation Study) để chứng minh tính hiệu quả của các cải tiến kỹ thuật đề xuất.",
            "Lượng hóa chi phí tính toán: đo lường thông số FLOPs, dung lượng bộ nhớ GPU tiêu thụ và thời gian xử lý trên mỗi truy vấn."
        ]),
        ("Giai đoạn 3: Đạo đức AI, trách nhiệm giải trình & Hoàn thiện báo cáo khoa học", [
            "Rà soát đạo đức AI theo các chuẩn mực quốc tế: tính công bằng (Fairness), trách nhiệm giải trình (Accountability) và tính minh bạch (Transparency - FAT AI).",
            "Đánh giá tính dễ bị tấn công của mô hình trước các cuộc tấn công đối kháng (Adversarial Attacks) hoặc kỹ thuật Jailbreaking đối với LLM.",
            "Viết báo cáo khóa luận tốt nghiệp theo cấu trúc bài báo khoa học quốc tế đầy đủ và chỉn chu.",
            "Thiết kế slide thuyết trình ấn tượng, chuẩn bị hệ thống demo trực tiếp và tự tin bảo vệ khóa luận trước hội đồng chấm thi."
        ]),
        ("Giai đoạn 4: Xây dựng thương hiệu kỹ sư AI, phỏng vấn chuyên môn & Tuyển dụng", [
            "Xây dựng Portfolio AI chuyên nghiệp: công bố mã nguồn mở kèm tài liệu tái lập kết quả, viết bài giải thích kỹ thuật trên Medium hoặc LinkedIn.",
            "Luyện tập phỏng vấn kỹ thuật AI: giải trình thuật toán, thiết kế hệ thống AI quy mô lớn và trả lời các câu hỏi tình huống chuyên sâu.",
            "Chuẩn bị kỹ năng trình bày tư duy giải quyết vấn đề và năng lực cập nhật công nghệ mới với tốc độ phát triển chóng mặt của ngành AI.",
            "Ứng tuyển vào các viện nghiên cứu AI (VinAI, Viettel AI, FPT AI), các tập đoàn công nghệ lớn hoặc các công ty khởi nghiệp AI toàn cầu."
        ])
    ],
    "reqs": [
        "Hoàn thành toàn bộ chương trình cử nhân ngành Trí tuệ nhân tạo với kết quả học thuật tốt.",
        "Năng lực tự đọc hiểu và hiện thực hóa các bài báo khoa học quốc tế bằng tiếng Anh.",
        "Tư duy đạo đức trách nhiệm cao và nhận thức rõ rệt về tác động xã hội của công nghệ AI."
    ]
}

# ---------------- ATTT (An toàn thông tin) ----------------
CURRICULUM_IT["guidance-attt-y1"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình làm chủ kiến trúc máy tính an toàn, quản trị hệ điều hành Linux và phân tích gói tin mạng TCP/IP dành cho sinh viên an toàn thông tin năm nhất.",
    "p1": "An toàn thông tin (Information Security / Cybersecurity) là ngành khoa học bảo vệ thông tin, hạ tầng mạng và các hệ thống số trước những truy cập trái phép, sự phá hoại hoặc gián đoạn hoạt động. Để trở thành một chuyên gia bảo mật xuất sắc, sinh viên cần hiểu rõ rằng an toàn thông tin không bắt đầu từ việc học hack hay sử dụng các công cụ có sẵn, mà bắt đầu từ việc hiểu sâu sắc cách máy tính lưu trữ dữ liệu, cách hệ điều hành quản lý phân quyền và cách từng gói tin nhị phân di chuyển trên đường truyền mạng.",
    "p2": "Nếu bạn không hiểu cách thức một gói tin TCP được đóng gói và bắt tay kết nối, bạn sẽ không thể phân tích được các cuộc tấn công từ chối dịch vụ (DDoS). Lộ trình dưới đây sẽ đồng hành cùng bạn xây dựng nền móng kỹ thuật an toàn vững chắc từ gốc rễ.",
    "roles": [
        ("Kỹ thuật viên an ninh mạng cơ sở", "Hỗ trợ cấu hình thiết bị mạng, quản trị người dùng và giám sát nhật ký truy cập hệ thống."),
        ("Trợ lý quản trị hệ thống Linux an toàn", "Cài đặt và thiết lập phân quyền tệp, cấu hình dịch vụ mạng và cập nhật bản vá bảo mật trên Linux."),
        ("Cộng tác viên hỗ trợ kỹ thuật bảo mật", "Tiếp nhận thông báo sự cố mã độc ban đầu, cách ly máy tính nhiễm và thu thập mẫu tệp khả nghi.")
    ],
    "stages": [
        ("Giai đoạn 1: Kiến trúc máy tính an toàn, thanh ghi CPU & Cơ chế bộ nhớ", [
            "Nắm vững kiến trúc máy tính Von Neumann: chu trình thực thi lệnh của CPU, các thanh ghi mục đích chung (General-purpose Registers).",
            "Hiểu cách tổ chức bộ nhớ tiến trình trong Linux: phân đoạn mã (Text), dữ liệu (Data/BSS), vùng nhớ Heap và khung ngăn xếp (Stack Frame).",
            "Nhận diện các lỗ hổng cơ bản ở tầng bộ nhớ: bản chất của hiện tượng tràn bộ đệm (Buffer Overflow) và cách mã độc ghi đè địa chỉ trả về (Return Address).",
            "Thực hành viết chương trình C đơn giản, biên dịch với cờ an toàn (Stack Canaries, ASLR) và phân tích luồng thực thi bằng GDB."
        ]),
        ("Giai đoạn 2: Quản trị hệ điều hành Linux chuyên sâu & Thiết lập phân quyền an toàn", [
            "Thành thạo quản trị dòng lệnh Linux (Ubuntu/Debian): quản lý tiến trình (ps, top, kill), kiểm tra cổng mạng (netstat, ss, lsof).",
            "Thiết lập cơ chế phân quyền tệp tin nghiêm ngặt: quyền đọc/ghi/thực thi (chmod), sở hữu tệp (chown) và các cờ đặc biệt (SUID, SGID, Sticky Bit).",
            "Cấu hình tường lửa cá nhân trên Linux bằng iptables hoặc UFW: thiết lập quy tắc chặn lọc gói tin theo địa chỉ IP và số hiệu cổng.",
            "Thực hành rà soát hệ thống (System Hardening): vô hiệu hóa các dịch vụ không cần thiết, đổi cổng SSH mặc định và thiết lập xác thực bằng khóa SSH Key."
        ]),
        ("Giai đoạn 3: Phân tích kiến trúc mạng máy tính & Giao thức truyền thông TCP/IP", [
            "Hiểu rõ chức năng các tầng trong mô hình OSI và TCP/IP: giao thức IP, ARP, ICMP, TCP, UDP và DNS.",
            "Nghiên cứu cơ chế bắt tay 3 bước của TCP (SYN -> SYN-ACK -> ACK) và cơ chế ngắt kết nối (FIN/RST), cấu trúc TCP Header và cờ điều khiển.",
            "Sử dụng công cụ Wireshark và tcpdump để bắt và phân tích luồng gói tin thực tế trên mạng cục bộ LAN.",
            "Nhận diện các dấu hiệu bất thường trên lưu lượng mạng: rà quét cổng bí mật (SYN Stealth Scan) và tấn công giả mạo địa chỉ ARP (ARP Spoofing)."
        ]),
        ("Giai đoạn 4: Thiết lập phòng thí nghiệm an ninh mạng ảo & Đồ án thực hành đầu tay", [
            "Xây dựng phòng thí nghiệm an toàn mạng cá nhân sử dụng phần mềm ảo hóa VirtualBox: thiết lập mạng nội bộ ảo Host-only an toàn.",
            "Cài đặt máy trạm tấn công Kali Linux và các máy mục tiêu dễ bị tổn thương (Metasploitable, DVWA) để thực hành độc lập.",
            "Thực hành rà quét cấu hình mạng phòng lab bằng công cụ Nmap: phát hiện cổng mở, xác định phiên bản dịch vụ và hệ điều hành.",
            "Viết báo cáo đánh giá hiện trạng an toàn mạng phòng lab và đề xuất các biện pháp cấu hình bảo mật phòng thủ."
        ])
    ],
    "reqs": [
        "Máy tính cá nhân có khả năng chạy máy ảo (tối thiểu RAM 16GB, CPU 4 nhân, ổ cứng SSD trống 50GB).",
        "Tư duy logic tốt, ý thức tuân thủ pháp luật và đạo đức nghề nghiệp an toàn thông tin nghiêm ngặt.",
        "Cam kết chỉ thực hành các kỹ thuật bảo mật trên môi trường phòng thí nghiệm ảo tự tạo."
    ]
}

CURRICULUM_IT["guidance-attt-y2"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình làm chủ mật mã học cơ sở, an toàn ứng dụng Web và phân tích rủi ro bảo mật theo danh mục OWASP Top 10.",
    "p1": "Năm thứ hai đưa sinh viên an toàn thông tin tiếp cận hai lĩnh vực cốt lõi nhất của ngành: Mật mã học (Cryptography) - nền tảng toán học bảo vệ tính bí mật và toàn vẹn dữ liệu, và An toàn ứng dụng Web - mặt trận tấn công và phòng thủ sôi động nhất hiện nay. Hiểu rõ cách thức hoạt động của các thuật toán mã hóa và cơ chế hoạt động của trình duyệt là tiền đề bắt buộc để bảo vệ hệ thống trước tin tặc.",
    "p2": "Sinh viên cần chuyển từ tư duy của người lập trình web thông thường sang tư duy của người thẩm định an ninh: luôn giả định mọi dữ liệu đầu vào từ người dùng đều tiềm ẩn nguy hiểm và áp dụng triệt để nguyên lý phòng thủ theo chiều sâu (Defense-in-Depth).",
    "roles": [
        ("Chuyên viên kiểm thử bảo mật ứng dụng Web (Junior Web Security Tester)", "Thực hiện kiểm thử an toàn ứng dụng web theo danh mục OWASP Top 10 và đề xuất giải pháp vá lỗi."),
        ("Chuyên viên phân tích lỗ hổng mã nguồn (Code Security Analyst)", "Rà soát mã nguồn phần mềm bằng công cụ SAST/DAST để phát hiện các lỗ hổng bảo mật sớm."),
        ("Cộng tác viên điều phối ứng cứu sự cố Web", "Hỗ trợ ghi nhận cảnh báo tấn công trang web và thu thập log web phục vụ điều tra.")
    ],
    "stages": [
        ("Giai đoạn 1: Mật mã học cơ sở, hàm băm & Chữ ký số điện tử", [
            "Phân biệt rõ ràng giữa Mã hóa đối xứng (AES, DES) và Mã hóa bất đối xứng (RSA, Đường cong Elliptic ECC).",
            "Nắm vững nguyên lý và ứng dụng của hàm băm một chiều (SHA-256): tính kháng tiền ảnh, kháng va chạm và ứng dụng lưu trữ mật khẩu an toàn với muối (Salt) và Bcrypt.",
            "Hiểu cơ chế xác thực toàn vẹn thông điệp bằng mã xác thực HMAC và chữ ký số điện tử (Digital Signatures).",
            "Phân tích cấu trúc hạ tầng khóa công khai (PKI), cơ chế hoạt động của chứng chỉ số X.509 và quy trình bắt tay bảo mật HTTPS/TLS."
        ]),
        ("Giai đoạn 2: Cơ chế bảo mật trình duyệt & Giao thức truyền thông Web", [
            "Hiểu rõ chính sách cùng nguồn gốc (Same-Origin Policy - SOP) của trình duyệt và cơ chế nới lỏng an toàn bằng CORS (Cross-Origin Resource Sharing).",
            "Phân tích cơ chế lưu trữ bảo mật trên trình duyệt: Cookies với các cờ an toàn HttpOnly, Secure, SameSite, và phân biệt với LocalStorage/SessionStorage.",
            "Cấu hình các tiêu đề bảo mật HTTP (Security Headers) quan trọng: Content-Security-Policy (CSP), X-Frame-Options, Strict-Transport-Security (HSTS).",
            "Sử dụng công cụ kiểm duyệt Burp Suite Community để bắt chặn, phân tích và chỉnh sửa các yêu cầu/phản hồi HTTP giữa trình duyệt và máy chủ."
        ]),
        ("Giai đoạn 3: Phân tích & Khai thác các lỗ hổng web theo OWASP Top 10", [
            "Nghiên cứu cơ chế và thực hành khai thác lỗ hổng tiêm mã SQL Injection (SQLi) trên môi trường thử nghiệm: phân loại In-band, Blind, Time-based SQLi và cách phòng chống bằng Parameterized Queries.",
            "Làm chủ lỗ hổng Cross-Site Scripting (XSS): phân biệt Stored, Reflected và DOM-based XSS, cách đánh cắp phiên làm việc và kỹ thuật làm sạch dữ liệu đầu ra (Output Encoding).",
            "Thực hành phát hiện các lỗ hổng kiểm soát truy cập hỏng (Broken Access Control): phân loại IDOR (Insecure Direct Object References) và leo thang đặc quyền.",
            "Nghiên cứu các lỗ hổng xác thực, giải tuần tự hóa không an toàn (Insecure Deserialization) và giả mạo yêu cầu từ phía máy chủ (SSRF)."
        ]),
        ("Giai đoạn 4: Đánh giá an toàn ứng dụng Web hoàn chỉnh & Lập báo cáo khắc phục", [
            "Thực hiện kiểm thử an toàn toàn diện cho một ứng dụng web thương mại điện tử thử nghiệm bằng phương pháp hộp xám (Gray-box Testing).",
            "Đo lường mức độ rủi ro của từng lỗ hổng phát hiện được theo Hệ thống tính điểm lỗ hổng chung CVSS v3.1.",
            "Soạn thảo Báo cáo thẩm định an toàn thông tin chuyên nghiệp: mô tả chi tiết các bước tái hiện lỗ hổng (PoC), phân tích tác động và hướng dẫn chi tiết cách vá mã nguồn.",
            "Tự xây dựng một ứng dụng web nhỏ có áp dụng đầy đủ các biện pháp phòng thủ OWASP Top 10 và bảo vệ trước nhóm học tập."
        ])
    ],
    "reqs": [
        "Đã nắm chắc kiến thức lập trình Web Backend (Node.js/PHP/Python) và cơ sở dữ liệu SQL.",
        "Cài đặt công cụ Burp Suite, môi trường máy ảo DVWA hoặc tài khoản thực hành PortSwigger Web Security Academy.",
        "Tính kỷ luật đạo đức cao, tuyệt đối không thử nghiệm tấn công các hệ thống thực tế khi chưa có văn bản ủy quyền."
    ]
}

CURRICULUM_IT["guidance-attt-y3"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình kiểm thử xâm nhập thực chiến (Penetration Testing), giám sát an toàn thông tin và quản trị hệ thống SIEM dành cho sinh viên năm ba.",
    "p1": "Năm thứ ba đánh dấu sự phân nhánh rõ rệt giữa hai chiến tuyến lớn của an toàn thông tin: Đội đỏ (Red Team) - thực hiện kiểm thử xâm nhập thực chiến để tìm ra các điểm yếu trước khi kẻ xấu phát hiện, và Đội xanh (Blue Team) - thiết lập hệ thống giám sát an ninh mạng liên tục để phát hiện, phân tích và ngăn chặn các cuộc tấn công tinh vi. Một kỹ sư bảo mật toàn diện cần thấu hiểu tư duy của cả hai phía.",
    "p2": "Lộ trình này sẽ trang bị cho bạn phương pháp luận kiểm thử xâm nhập chuẩn quốc tế (PTES, NIST SP 800-115) song hành cùng kỹ năng vận hành các trung tâm điều hành an ninh mạng (SOC) và hệ thống quản lý thông tin sự kiện an ninh (SIEM).",
    "roles": [
        ("Chuyên viên kiểm thử xâm nhập thực tập (Penetration Tester Intern)", "Thực hiện tấn công thử nghiệm vào hạ tầng mạng và ứng dụng theo phạm vi hợp đồng ủy quyền."),
        ("Kỹ sư phân tích giám sát an ninh SOC Tier 1", "Theo dõi cảnh báo an ninh thời gian thực trên màn hình giám sát, phân loại mối nguy và leo thang sự cố."),
        ("Chuyên viên săn lùng mối đe dọa (Threat Hunter Trainee)", "Chủ động phân tích dữ liệu log hệ thống để tìm kiếm các dấu hiệu tấn công tiềm ẩn chưa bị phát hiện.")
    ],
    "stages": [
        ("Giai đoạn 1: Phương pháp luận kiểm thử xâm nhập & Thu thập thông tin tình báo (OSINT)", [
            "Nắm vững các bước trong tiêu chuẩn thực thi kiểm thử xâm nhập (PTES): Giao ước trước tương tác, Thu thập thông tin, Mô hình hóa mối đe dọa, Phân tích lỗ hổng, Khai thác, Hậu khai thác và Báo cáo.",
            "Thực hành thu thập thông tin tình báo nguồn mở (OSINT): sử dụng Google Dorking, Shodan, Censys, Whois và theHarvester để vẽ bản đồ bề mặt tấn công của mục tiêu.",
            "Rà quét mạng chủ động: sử dụng Nmap với các kỹ thuật quét nâng cao, phát hiện tường lửa và sử dụng Nmap Scripting Engine (NSE) để quét lỗ hổng.",
            "Xây dựng ma trận phân tích rủi ro và xác định phạm vi kiểm thử (Scope of Work - SOW) rõ ràng, có chữ ký thỏa thuận pháp lý."
        ]),
        ("Giai đoạn 2: Khai thác lỗ hổng hạ tầng mạng & Kỹ thuật leo thang đặc quyền", [
            "Sử dụng khung làm việc Metasploit Framework: tìm kiếm module khai thác (exploit), lựa chọn mã tải (payload) và thiết lập trình lắng nghe (listener).",
            "Khai thác các dịch vụ mạng lỗi thời hoặc có cấu hình yếu: dịch vụ chia sẻ tệp SMB, FTP không an toàn, dịch vụ đăng nhập SSH/RDP dùng mật khẩu yếu.",
            "Thực hành kỹ thuật leo thang đặc quyền trên Linux (Linux Privilege Escalation): khai thác tệp SUID, sudoers cấu hình sai, cron job không an toàn và lỗ hổng Kernel.",
            "Tiếp cận kỹ thuật duy trì quyền truy cập (Persistence) và xóa dấu vết cơ bản (Log Cleaning) trong môi trường phòng thí nghiệm mô phỏng."
        ]),
        ("Giai đoạn 3: Giám sát an toàn thông tin & Quản trị hệ thống SIEM (Wazuh/Splunk)", [
            "Hiểu cấu trúc hoạt động của Trung tâm điều hành an ninh mạng (SOC) và vai trò của các cấp phân tích (Tier 1, Tier 2, Tier 3).",
            "Cài đặt và cấu hình giải pháp SIEM mã nguồn mở Wazuh hoặc Splunk: cài đặt Agent trên máy trạm Windows và Linux để thu thập nhật ký tập trung.",
            "Viết các quy tắc phát hiện cảnh báo (Correlation Rules) theo chuẩn MITRE ATT&CK: phát hiện hành vi quét cổng Nmap, đăng nhập sai nhiều lần và tạo người dùng trái phép.",
            "Phân tích gói tin và phát hiện xâm nhập mạng với hệ thống IDS/IPS Snort hoặc Suricata."
        ]),
        ("Giai đoạn 4: Đồ án diễn tập an ninh mạng (CTF / Red-Blue Defense) & Báo cáo chuyên nghiệp", [
            "Tham gia giải các bài thi diễn tập tấn công - phòng thủ Capture The Flag (CTF) trên các nền tảng Hack The Box hoặc TryHackMe.",
            "Thực hiện bài tập diễn tập phòng thủ: một nhóm đóng vai trò tấn công thâm nhập và một nhóm đóng vai trò giám sát phát hiện và ngăn chặn trên SIEM.",
            "Soạn thảo Báo cáo kiểm thử thâm nhập theo chuẩn doanh nghiệp gồm: Bản tóm tắt cho ban lãnh đạo (Executive Summary) và Báo cáo kỹ thuật chi tiết.",
            "Rèn luyện kiến thức và chuẩn bị cho các kỳ thi lấy chứng chỉ thực chiến uy tín: CompTIA Security+, CEH Practical hoặc eJPT."
        ])
    ],
    "reqs": [
        "Đã nắm chắc kiến thức mạng máy tính, quản trị Linux và bảo mật web năm hai.",
        "Tài khoản thực hành trên các nền tảng huấn luyện an ninh mạng như Hack The Box hoặc TryHackMe.",
        "Tư duy nhạy bén trong điều tra số và khả năng chịu áp lực cao khi xử lý cảnh báo khẩn cấp."
    ]
}

CURRICULUM_IT["guidance-attt-y4"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình ứng cứu sự cố an ninh mạng (Incident Response), điều tra kỹ thuật số (Forensics) và đồ án kiểm toán an toàn hệ thống.",
    "p1": "Năm cuối cùng của chuyên ngành An toàn thông tin đòi hỏi sinh viên phải sở hữu bản lĩnh và kiến thức toàn diện để xử lý các cuộc khủng hoảng an ninh mạng thực tế. Khi một tổ chức bị mã độc tống tiền (Ransomware) tấn công hay bị rò rỉ cơ sở dữ liệu khách hàng, đội ngũ Ứng cứu sự cố (Incident Response) và Điều tra kỹ thuật số (Digital Forensics) chính là những chuyên gia tuyến đầu đứng ra khoanh vùng thảm họa, truy vết thủ phạm và khôi phục hệ thống an toàn.",
    "p2": "Lộ trình này sẽ trang bị cho bạn quy trình ứng cứu sự cố chuẩn mực theo NIST SP 800-61, kỹ thuật trích xuất chứng cứ điện tử có giá trị pháp lý tại tòa án và năng lực hoạch định kiến trúc phòng thủ vững chắc cho doanh nghiệp.",
    "roles": [
        ("Chuyên viên ứng cứu sự cố an ninh mạng (Incident Responder)", "Chịu trách nhiệm điều phối xử lý khi có tấn công mạng xảy ra, cô lập vùng nhiễm và khôi phục dịch vụ."),
        ("Chuyên viên điều tra kỹ thuật số (Digital Forensics Examiner)", "Thu thập, phân tích và bảo toàn chứng cứ số trên đĩa cứng và bộ nhớ RAM phục vụ điều tra."),
        ("Kỹ sư an toàn thông tin doanh nghiệp (Security Engineer)", "Thiết kế kiến trúc bảo mật toàn diện, đánh giá tuân thủ tiêu chuẩn ISO 27001 và quản lý rủi ro.")
    ],
    "stages": [
        ("Giai đoạn 1: Quy trình ứng cứu sự cố an ninh mạng theo chuẩn NIST & SANS", [
            "Làm chủ 6 bước trong quy trình ứng cứu sự cố: Chuẩn bị, Nhận diện, Khoanh vùng cách ly, Triệt tiêu mối đe dọa, Khôi phục hệ thống và Rút bài học kinh nghiệm.",
            "Xây dựng các kịch bản ứng phó sự cố (Playbooks / Runbooks) cho các tình huống điển hình: nhiễm Ransomware, tấn công lừa đảo Phishing, và rò rỉ dữ liệu.",
            "Thiết lập quy trình bảo toàn chuỗi hành trình chứng cứ (Chain of Custody) đảm bảo tính toàn vẹn và giá trị pháp lý của chứng cứ số.",
            "Tổ chức bài diễn tập bàn tròn (Tabletop Exercise) mô phỏng tình huống tấn công mạng phức tạp cho ban giám đốc và các phòng ban liên quan."
        ]),
        ("Giai đoạn 2: Điều tra kỹ thuật số trên đĩa cứng & Bộ nhớ RAM (Memory Forensics)", [
            "Sử dụng công cụ trích xuất tạo ảnh đĩa pháp y (Forensic Disk Imaging với FTK Imager, dd) để tạo bản sao bit-by-bit của ổ đĩa chứng cứ.",
            "Phân tích các dấu vết số trên hệ điều hành Windows: Registry, Event Logs, Prefetch files, Shimcache, $MFT và LNK files.",
            "Trích xuất và phân tích ảnh bộ nhớ RAM sống bằng công cụ Volatility: phát hiện tiến trình độc hại chạy ngầm, địa chỉ IP kết nối C2 và trích xuất mã độc nén trong RAM.",
            "Thực hiện điều tra một ca nhiễm mã độc thực tế: tái dựng dòng thời gian các sự kiện (Timeline Analysis) từ lúc nạn nhân bấm link độc hại đến khi máy bị chiếm quyền."
        ]),
        ("Giai đoạn 3: Phân tích mã độc cơ bản (Malware Analysis) & Đồ án tốt nghiệp ATTT", [
            "Thiết lập môi trường cô lập an toàn để phân tích mã độc: môi trường Sandbox không kết nối mạng ngoài.",
            "Thực hiện phân tích tĩnh (Static Analysis): kiểm tra mã băm tệp, trích xuất chuỗi ký tự (Strings), phân tích tiêu đề PE Header và bảng hàm nhập khẩu (Import Table).",
            "Thực hiện phân tích động (Dynamic Analysis): sử dụng Process Hacker, Procmon và Regshot để ghi nhận mọi thay đổi của mã độc trên hệ thống khi được kích hoạt.",
            "Hoàn thành toàn bộ báo cáo đồ án tốt nghiệp chuyên ngành an toàn thông tin và bảo vệ thành công trước hội đồng chuyên môn."
        ]),
        ("Giai đoạn 4: Hoàn thiện hồ sơ chuyên gia, luyện phỏng vấn an ninh & Gia nhập ngành", [
            "Xây dựng Portfolio chuyên môn: công bố các báo cáo phân tích mã độc chi tiết (Write-ups), các công cụ script tự động hóa điều tra trên GitHub.",
            "Rèn luyện kỹ năng phỏng vấn tình huống an ninh mạng (Security Scenario Questions) và giải thích tư duy phân tích chứng cứ logic.",
            "Chuẩn bị kiến thức các khung tiêu chuẩn quản trị bảo mật: ISO/IEC 27001, PCI-DSS và luật An ninh mạng Việt Nam.",
            "Ứng tuyển vào các trung tâm SOC của các tập đoàn viễn thông, ngân hàng lớn hoặc các công ty an ninh mạng hàng đầu."
        ])
    ],
    "reqs": [
        "Hoàn thành toàn bộ chương trình đào tạo chuyên ngành An toàn thông tin.",
        "Kỹ năng tư duy logic điều tra sắc bén, tính cẩn trọng tỉ mỉ và khả năng làm việc với áp lực cao.",
        "Đạo đức nghề nghiệp tuyệt đối trong sáng và tinh thần bảo vệ chủ quyền không gian mạng quốc gia."
    ]
}

# ---------------- Cluster Hardware & Network (2) ----------------
CURRICULUM_IT["guidance-cluster-hardware-network-y1"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình làm chủ cấu trúc phần cứng máy tính, hệ điều hành Linux và kỹ thuật lập trình C cơ sở cho nhóm ngành kỹ thuật phần cứng và mạng.",
    "p1": "Nhóm ngành Phần cứng và Mạng máy tính là nền móng vật lý của toàn bộ cơ sở hạ tầng số toàn cầu. Trước khi có thể thiết lập các mạng lưới truyền thông xuyên lục địa hay điều khiển các thiết bị thông minh, sinh viên cần hiểu rõ nguyên lý hoạt động của từng linh kiện điện tử, cách dòng điện và xung nhịp đồng hồ tạo nên các bit 0 và 1, và cách ngôn ngữ lập trình C tương tác trực tiếp với các thanh ghi bộ nhớ.",
    "p2": "Lộ trình năm thứ nhất được thiết kế để đưa bạn từ việc nhìn ngắm một bo mạch chủ sang khả năng tự tay cấu hình máy chủ Linux và viết những dòng mã C điều khiển phần cứng đầu tiên.",
    "roles": [
        ("Kỹ thuật viên phần cứng & Lắp ráp máy tính", "Kiểm tra, chẩn đoán lỗi linh kiện phần cứng và lắp ráp các hệ thống máy tính chuyên dụng."),
        ("Kỹ thuật viên quản trị mạng cơ sở", "Bấm cáp mạng, cấu hình Switch/Router cơ bản và thiết lập mạng cục bộ văn phòng."),
        ("Cộng tác viên lập trình C nhúng tập sự", "Hỗ trợ viết mã các hàm giao tiếp phần cứng cơ bản và kiểm thử trên bo mạch thử nghiệm.")
    ],
    "stages": [
        ("Giai đoạn 1: Cấu trúc linh kiện máy tính, nguyên lý phần cứng & An toàn tĩnh điện", [
            "Hiểu rõ chức năng và thông số kỹ thuật của các thành phần phần cứng: CPU (Socket, Cores, Threads), RAM (DDR4/DDR5, Bus speed), Bo mạch chủ (Chipset, PCIe slots) và Bộ nguồn (Công suất thực, chuẩn 80 Plus).",
            "Nắm vững các biện pháp an toàn lao động trong phòng lab phần cứng: phòng chống phóng tĩnh điện (ESD), sử dụng vòng đeo tay chống tĩnh điện.",
            "Thực hành tháo lắp, vệ sinh và thay thế linh kiện máy tính để bàn hoàn chỉnh, bôi keo tản nhiệt CPU đúng kỹ thuật.",
            "Chẩn đoán và xử lý các lỗi phần cứng thường gặp dựa trên mã tiếng bíp của BIOS/UEFI (Beep Codes) và màn hình LED gỡ lỗi."
        ]),
        ("Giai đoạn 2: Quản trị hệ điều hành Linux máy chủ & Dòng lệnh Bash", [
            "Cài đặt hệ điều hành Linux máy chủ (Ubuntu Server / Rocky Linux) không có giao diện đồ họa (Headless Server).",
            "Làm chủ hệ thống tệp tin phân cấp trong Linux: vai trò của các thư mục cốt lõi (/etc, /var, /dev, /proc, /sys).",
            "Thành thạo cấu hình giao diện mạng từ dòng lệnh: quản lý IP tĩnh, cấu hình DNS và kiểm tra thông mạng với ping, traceroute, netstat.",
            "Viết các script Bash tự động kiểm tra dung lượng ổ đĩa, nhiệt độ CPU và gửi cảnh báo khi có thông số vượt ngưỡng."
        ]),
        ("Giai đoạn 3: Lập trình ngôn ngữ C căn bản & Thao tác con trỏ phần cứng", [
            "Làm chủ cú pháp ngôn ngữ C: các kiểu dữ liệu có dấu/không dấu, toán tử thao tác bit (AND, OR, XOR, Shift bit).",
            "Hiểu sâu bản chất con trỏ (Pointers): con trỏ cấp 1, con trỏ cấp 2, con trỏ hàm và cách con trỏ trỏ trực tiếp vào ô nhớ vật lý.",
            "Quản lý bộ nhớ động bằng malloc, calloc, realloc và thu hồi bộ nhớ bằng free để tránh rò rỉ bộ nhớ (Memory Leak).",
            "Thực hiện bài tập lớn: Xây dựng trình quản lý thiết bị phần cứng thu nhỏ bằng C có chức năng ghi nhật ký hoạt động vào tệp nhị phân."
        ]),
        ("Giai đoạn 4: Đồ án tích hợp hệ thống phần cứng mini & Đánh giá năng lực", [
            "Thiết kế và cấu hình hoàn chỉnh một máy chủ mini (Home Server / Homelab) phục vụ lưu trữ tệp tin nội bộ.",
            "Cấu hình các dịch vụ mạng cơ bản trên máy chủ Linux: dịch vụ cấp phát IP tự động DHCP, phân giải tên miền nội bộ DNS (Bind9) và chia sẻ tệp Samba.",
            "Kiểm thử khả năng chịu tải và đo lường điện năng tiêu thụ của hệ thống máy chủ trong điều kiện hoạt động liên tục 24/7.",
            "Viết tài liệu hướng dẫn vận hành hệ thống và bảo vệ đồ án tích hợp phần cứng trước giảng viên hướng dẫn."
        ])
    ],
    "reqs": [
        "Sự yêu thích thực hành tháo lắp cơ học và làm việc với các thiết bị phần cứng.",
        "Máy tính cá nhân có khả năng cài đặt máy ảo Linux hoặc một máy tính cũ để thực hành cài đặt máy chủ.",
        "Tính cẩn thận, ngăn nắp và tuân thủ các quy tắc an toàn kỹ thuật điện."
    ]
}

CURRICULUM_IT["guidance-cluster-hardware-network-y2"] = {
    "lead": "Hướng dẫn chi tiết từ A-Z lộ trình thiết kế kiến trúc giao thức mạng TCP/IP, lập trình Socket mạng và tích hợp vi điều khiển ứng dụng.",
    "p1": "Giai đoạn hai của nhóm ngành Phần cứng và Mạng máy tính nâng tầm người học từ việc kết nối cáp vật lý sang làm chủ bản chất của các giao thức truyền thông dữ liệu và lập trình điều khiển nhúng. Sự hội tụ giữa mạng máy tính và Internet vạn vật (IoT) đang tạo ra nhu cầu bùng nổ về các kỹ sư có khả năng vừa hiểu sâu về giao thức định tuyến mạng vừa biết lập trình vi điều khiển để gửi nhận dữ liệu cảm biến.",
    "p2": "Lộ trình này sẽ dẫn dắt bạn qua quy trình cấu hình các thiết bị mạng công nghiệp của Cisco, lập trình truyền tin Socket qua mạng bằng C/Python và tự tay chế tạo một thiết bị giám sát mạng nhúng hoàn chỉnh.",
    "roles": [
        ("Chuyên viên quản trị mạng tập sự (Junior Network Administrator)", "Cấu hình thiết bị Switch, Router, quản lý dải mạng VLAN và giám sát hiệu năng đường truyền."),
        ("Kỹ sư phần mềm nhúng IoT tập sự (Junior IoT/Embedded Engineer)", "Lập trình vi điều khiển ESP32/STM32, đọc cảm biến và truyền dữ liệu qua giao thức MQTT/HTTP."),
        ("Kỹ thuật viên triển khai hạ tầng mạng viễn thông", "Tham gia thi công lắp đặt tủ rack, cấu hình thiết bị định tuyến và đo kiểm suy hao đường truyền.")
    ],
    "stages": [
        ("Giai đoạn 1: Kiến trúc mạng TCP/IP chuyên sâu & Cấu hình thiết bị mạng Cisco", [
            "Hiểu cặn kẽ thuật toán chia mạng con (Subnetting) với IPv4: tính toán dải địa chỉ mạng, địa chỉ broadcast và mặt nạ mạng con (Subnet Mask / CIDR).",
            "Thực hành mô phỏng mạng trên Cisco Packet Tracer: cấu hình chia mạng LAN ảo (VLAN), cấu hình đường truyền trung kế (Trunking 802.1Q) trên Switch.",
            "Cấu hình định tuyến tĩnh (Static Route) và định tuyến động cơ bản (OSPF đơn vùng) trên thiết bị Router Cisco.",
            "Thiết lập danh sách kiểm soát truy cập (Access Control List - ACL) để lọc luồng dữ liệu mạng và cấu hình biên dịch địa chỉ mạng (NAT/PAT)."
        ]),
        ("Giai đoạn 2: Lập trình truyền thông mạng với Socket (Network Socket Programming)", [
            "Hiểu bản chất của giao diện lập trình Socket: phân biệt Stream Sockets (TCP) và Datagram Sockets (UDP).",
            "Lập trình máy chủ và máy khách TCP bằng C hoặc Python: thiết lập socket, liên kết cổng (bind), lắng nghe (listen), chấp nhận kết nối (accept) và truyền nhận dữ liệu.",
            "Xử lý kết nối đồng thời từ nhiều máy khách (Concurrent Connections) bằng kỹ thuật đa luồng (Multi-threading) hoặc cơ chế Non-blocking I/O (select/epoll).",
            "Xây dựng ứng dụng phòng chat trực tuyến nội bộ có mã hóa thông điệp đơn giản truyền qua mạng LAN."
        ]),
        ("Giai đoạn 3: Vi điều khiển nhúng, giao tiếp cảm biến & Giao thức IoT", [
            "Làm quen với kiến trúc vi điều khiển hiện đại (ESP32 hoặc STM32): các chân vào ra số (GPIO), bộ chuyển đổi tương tự-số (ADC), PWM và các chuẩn giao tiếp nối tiếp (UART, I2C, SPI).",
            "Lập trình đọc tín hiệu từ các cảm biến môi trường (nhiệt độ, độ ẩm, khói) và hiển thị thông tin lên màn hình OLED.",
            "Kết nối vi điều khiển vào mạng Wi-Fi và truyền dữ liệu lên máy chủ đám mây sử dụng giao thức nhẹ chuyên dụng cho IoT (MQTT với Mosquitto Broker).",
            "Xử lý tiết kiệm năng lượng cho vi điều khiển: các chế độ ngủ sâu (Deep Sleep) để thiết bị có thể hoạt động bằng pin trong thời gian dài."
        ]),
        ("Giai đoạn 4: Đồ án hệ thống giám sát mạng thông minh & Chuẩn bị chứng chỉ CCNA", [
            "Xây dựng đồ án tích hợp hoàn chỉnh: Thiết bị phần cứng nhúng tự động ping giám sát các máy chủ trong mạng, khi có sự cố sẽ phát còi báo động và gửi thông báo qua Telegram Bot.",
            "Thực hiện đo đạc độ trễ mạng, tỷ lệ mất gói tin (Packet Loss) và vẽ biểu đồ hiệu năng hệ thống mạng theo thời gian thực.",
            "Hệ thống hóa toàn bộ kiến thức mạng để sẵn sàng ôn luyện cho kỳ thi lấy chứng chỉ quốc tế Cisco Certified Network Associate (CCNA 200-301).",
            "Hoàn thiện hồ sơ kỹ thuật và tự tin ứng tuyển vào các vị trí kỹ sư mạng hoặc kỹ sư hệ thống tại các ISP và doanh nghiệp."
        ])
    ],
    "reqs": [
        "Đã hoàn thành các kiến thức phần cứng máy tính và lập trình C năm nhất.",
        "Có kit thực hành vi điều khiển ESP32 và một số cảm biến cơ bản hoặc phần mềm mô phỏng Wokwi.",
        "Phần mềm Cisco Packet Tracer được cài đặt sẵn trên máy tính cá nhân."
    ]
}

print(f"CURRICULUM_IT fully loaded with {len(CURRICULUM_IT)} articles.")
