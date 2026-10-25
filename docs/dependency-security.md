# Bản sửa dependency CSS — 25/10/2026

## Advisory và cây dependency

Đã đọc [GHSA-rj75-hqrm-r3gf / CVE-2026-104844](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) trên GitHub Advisory Database và [changelog chính thức 7.1.6](https://github.com/postcss/postcss-selector-parser/blob/7.1.6/CHANGELOG.md). Advisory đánh giá Moderate (CVSS 5.9), ảnh hưởng `postcss-selector-parser <7.1.6`, bản vá đầu tiên là **7.1.6**.

Lỗi làm việc phân tích selector phẳng có độ phức tạp bậc hai, có thể chiếm CPU khi nhận selector không tin cậy. Advisory phân biệt việc xử lý đầu vào từ bên ngoài trong request với việc build từ mã nguồn tin cậy. UniHub hiện dùng parser trong công cụ build CSS, chưa có API nhận CSS/selector do người dùng gửi.

Cây thực tế trước sửa, từ `npm ls` và `npm explain`:

```text
@unihub/frontend
└── tailwindcss@3.4.19
    ├── postcss-selector-parser@6.1.5       (yêu cầu ^6.1.2)
    └── postcss-nested@6.2.0
        └── postcss-selector-parser@6.1.5   (yêu cầu ^6.1.1, deduped)
```

Audit trước sửa báo **3 mục Moderate**: parser và hai gói chịu ảnh hưởng gián tiếp là postcss-nested/Tailwind. Đây là một advisory gốc được lan truyền trong cây dependency, không phải ba lỗi độc lập. Không có cảnh báo Prisma trong kết quả audit này.

## Bản sửa và phạm vi override

Giữ Tailwind **3.4.19**, Prisma CLI và @prisma/client **7.10.1**, npm **11.9.0**. Các bản Tailwind 3 đã kiểm tra trên npm registry vẫn yêu cầu parser dòng 6; không có bản vá parser dòng 6 trong danh sách phiên bản đã kiểm tra. Không dùng `audit fix --force` hoặc nâng major Tailwind/Prisma.

Root package.json đặt override:

```json
{
  "overrides": {
    "tailwindcss@3.4.19": {
      "postcss-selector-parser": "7.1.6"
    }
  }
}
```

Override chỉ áp dụng cho parser nằm dưới Tailwind 3.4.19, gồm cả đường qua postcss-nested. Không áp dụng toàn cục cho mọi consumer của parser hoặc thay dependency backend. Nếu đổi phiên bản Tailwind sau này, phải review lại vì điều kiện phiên bản này sẽ không còn khớp.

Đây là thay đổi vượt khoảng semver gốc của hai consumer. Changelog 7.0.0 thay đổi hành vi chèn node khi duyệt cây; 7.1.6 sửa thuật toán bằng Set. Vì vậy không coi việc audit hết cảnh báo là bằng chứng đủ về tương thích. Đã kiểm tra CommonJS/API parser mà Tailwind dùng, đường import nội bộ `dist/util/unesc`, build thực tế và các trường hợp CSS bên dưới. Chọn đúng bản vá đầu tiên 7.1.6 để giới hạn thay đổi; không tự chọn latest 7.1.7, vốn có thêm thay đổi xử lý escape/whitespace.

Lockfile được npm sinh lại từ các manifest trong thư mục tạm vì chạy install/update với lockfile cũ không áp dụng override mới trong lần thử này; không sửa tay nội dung package-lock. Đã so tập hợp tên/phiên bản của toàn bộ dependency: **chỉ parser đổi 6.1.5 → 7.1.6**. Npm có sắp xếp lại vị trí các bản chokidar/readdirp/jiti/glob-parent đã tồn tại; không nâng phiên bản các gói đó. Repository vẫn có một lockfile gốc.

## Kiểm tra và cảnh báo còn lại

Kiểm tra trên Codex/Linux, Node 24.19.0 và npm 11.9.0:

- `npm ci` từ lockfile mới: đạt; parser cài thực tế là 7.1.6 ở cả hai đường dependency.
- `npm audit --json`: **0 lỗ hổng** ở mọi mức; ba mục Moderate liên quan advisory đã hết tại thời điểm kiểm tra. Đây không phải bảo đảm rằng sẽ không có advisory mới sau này.
- Typecheck và build hai workspace: đạt. CSS production trước/sau giống từng byte, SHA-256 `f61b8fc05e6e18f7d0424bee0491938239387f68d28a0646b772ee0799c45e23`.
- Test: **10/10 đạt**, gồm 7 HTTP/config và 3 test CSS. Test CSS bao phủ responsive/hover, group/peer, arbitrary selector/value, data attribute, nesting với selector nhóm, @apply, prefix và important selector. Cả ba test đã chạy đạt trước và sau thay parser. Test nesting dùng entry point của Tailwind để kiểm tra postcss-nested; không bật thêm plugin nesting trong cấu hình ứng dụng.
- Prisma validate/generate 7.10.1: đạt; không kết nối hoặc thay đổi database.
- Prettier format check và kiểm tra diff: đạt.

**Còn chẩn đoán `npm ls`:** lệnh trả exit 1 / `ELSPROBLEMS`, đánh dấu parser 7.1.6 là invalid so với `^6.1.2`/`^6.1.1` của các gói cha trong workspace này, kể cả khi đọc lockfile. Không ghi nhận `npm ls` là đạt và không che cảnh báo bằng tùy chọn bỏ qua. Đã kiểm tra parser cài thực tế, `npm ci`, audit và hành vi CSS riêng như trên. Đây là chẩn đoán cây dependency còn lại; audit không báo thêm lỗ hổng tương ứng. Chưa tự nâng npm hoặc sửa manifest của gói trong node_modules để loại bỏ chẩn đoán.

Các test chỉ xác minh các trường hợp đã chạy và CSS hiện tại, chưa chứng minh mọi plugin/selector hoặc máy Windows đều tương thích. Khi thêm plugin hay đổi Tailwind, chạy lại test, audit và review override. Có thể bỏ override khi upstream Tailwind 3/consumer công bố dependency đã vá phù hợp, sau khi kiểm tra lại.

## Kiểm tra trên Windows

Sau khi lấy commit mới về, chạy tại **gốc UniHub**, nơi có lockfile:

```powershell
npm.cmd ci
npm.cmd audit
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run format:check
```

Không chạy `audit fix --force`. Nếu cảnh báo thay đổi, ghi lại advisory và cây dependency mới trước khi chọn bản sửa tiếp theo.
