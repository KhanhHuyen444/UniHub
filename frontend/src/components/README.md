# Component dùng chung

Các primitive nằm trong `frontend/src/components/ui/` và được export từ `components/ui`. Chúng chỉ giữ cấu trúc, accessibility cơ bản và token; component đặc thù của feature vẫn nằm trong thư mục feature tương ứng.

```tsx
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
} from '../../components/ui';

<FormField id="category" label="Danh mục" hint="Chọn một mục." required>
  <Select>
    <option value="">Chọn danh mục</option>
  </Select>
</FormField>;
```

`FormField` tự nối label, required, hint và lỗi với control con; dùng đúng một `Input` hoặc `Select` làm child. Khi có lỗi, control nhận `aria-invalid`/`aria-describedby`, còn thông báo lỗi có `role="alert"`. `LoadingState` phát thông báo `role="status"`; `EmptyState` mô tả dữ liệu rỗng; `ErrorState` dùng `role="alert"` và có thể nhận `onRetry` nếu feature thực sự có thao tác thử lại. Không dùng state gallery thay cho kiểm tra API.

`Button` có primary/outline/text/neutral/danger, disabled và loading. Mọi nút có `type="button"` mặc định; form submit phải đặt `type="submit"` rõ ràng. `Select` dùng control native để hỗ trợ bàn phím. `Badge` hỗ trợ info/success/warning/neutral/error. `Card` là section bề mặt dùng chung.

## Hướng dẫn cho TV1–TV5

- **TV1:** duy trì tokens, primitive, `/_dev/ui` và ba layout; review thay đổi dùng chung. Không đưa nghiệp vụ cơ hội vào showcase.
- **TV2:** dùng `FormField`, `Input`, `Button`, `ErrorState` cho auth/profile; chốt label/validation/error với TV1 trước khi thay shared component. Preview Student không có auth.
- **TV3:** dùng `Badge`, `Card`, `LoadingState`, `EmptyState` và `ErrorState` cho guidance/recommendations; không giả dữ liệu từ component preview.
- **TV4:** dùng field/control cho event forms; các state reminder/notification phải gắn API feature thật, không dùng nút preview.
- **TV5:** dùng cùng FormField/button/state cho forum/moderation; destructive action phải do feature xác nhận, shared component chỉ cung cấp biến thể `danger`.

Khi gọi API, dùng `frontend/src/lib/api.ts`; component UI không được fetch, lưu JWT hoặc quyết định quyền. Route guard cũng không thay kiểm tra backend. Design source, asset trace và phần tạm/chưa xác nhận nằm trong [ghi nhận thiết kế](../../../docs/shared-ui-design/implementation.md); screenshot/evidence chỉ nằm trong `docs/shared-ui-design/`, không đưa vào public hoặc bundle.
