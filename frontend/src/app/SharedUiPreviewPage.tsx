import { Link, useSearchParams } from 'react-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
} from '../components/ui';
import { AdminLayout } from '../layouts/AdminLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { StudentLayout } from '../layouts/StudentLayout';
import { previewTarget, type ShellArea } from '../layouts/navigation';

const areas: Array<{ key: ShellArea; label: string }> = [
  { key: 'public', label: 'Public' },
  { key: 'student', label: 'Student' },
  { key: 'admin', label: 'Admin' },
];

const defaultActive: Record<ShellArea, string> = {
  public: 'home',
  student: 'recommendations',
  admin: 'dashboard',
};

function isShellArea(value: string | null): value is ShellArea {
  return value === 'public' || value === 'student' || value === 'admin';
}

function PreviewNotice({ area }: { area: ShellArea }) {
  return (
    <section
      aria-labelledby="preview-title"
      className="mb-8 rounded-card border border-brand/20 bg-white p-6 shadow-soft"
    >
      <p className="type-caption font-semibold uppercase tracking-wide text-brand">
        UniHub · Shared UI preview
      </p>
      <h1 id="preview-title" className="mt-2 type-heading text-navy">
        Xem trước component và layout {area}
      </h1>
      <p className="mt-2 max-w-3xl type-label text-muted">
        Trang kỹ thuật để kiểm tra giao diện dùng chung. Không có đăng nhập, dữ
        liệu nghiệp vụ hoặc kết nối API cho các control minh họa. Preview
        Student và Admin không xác thực quyền truy cập.
      </p>
      <nav
        aria-label="Chọn shell xem trước"
        className="mt-4 flex flex-wrap gap-2"
      >
        {areas.map((item) => (
          <Link
            key={item.key}
            to={previewTarget(item.key, defaultActive[item.key])}
            aria-current={area === item.key ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center rounded-control border px-4 py-2 type-label font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${area === item.key ? 'border-brand bg-brand text-white' : 'border-control bg-white text-secondary hover:bg-page'}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function ComponentGallery() {
  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <h2 className="type-title text-navy">Buttons</h2>
        <p className="mt-1 type-label text-muted">
          Các nút mẫu chỉ thể hiện kiểu dáng; chưa gắn hành động nghiệp vụ.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button">Primary</Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
          <Button type="button" variant="text">
            Text action
          </Button>
          <Button type="button" variant="neutral">
            Neutral
          </Button>
          <Button type="button" variant="danger">
            Danger
          </Button>
          <Button type="button" disabled>
            Disabled
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="type-title text-navy">Form controls</h2>
        <div className="mt-4 grid max-w-2xl grid-cols-2 gap-6">
          <FormField
            id="preview-search"
            label="Trường nhập mẫu"
            hint="Chỉ dùng để xem kiểu chữ, viền và trạng thái focus."
            required
          >
            <Input placeholder="Nhập nội dung minh họa" />
          </FormField>
          <FormField id="preview-select" label="Danh sách chọn mẫu">
            <Select defaultValue="">
              <option value="" disabled>
                Chọn một mục
              </option>
              <option value="option-a">Tùy chọn A</option>
              <option value="option-b">Tùy chọn B</option>
            </Select>
          </FormField>
          <FormField
            id="preview-error"
            label="Trạng thái lỗi mẫu"
            error="Đây là thông báo lỗi minh họa."
          >
            <Input defaultValue="Giá trị mẫu" />
          </FormField>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="type-title text-navy">Badges</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="info">Thông tin</Badge>
          <Badge variant="success">Thành công</Badge>
          <Badge variant="warning">Cảnh báo</Badge>
          <Badge variant="neutral">Trung tính</Badge>
          <Badge variant="error">Lỗi</Badge>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="type-title text-navy">Loading, empty và error states</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <LoadingState
            title="Đang tải mẫu"
            description="Spinner chỉ để xem trạng thái chờ."
          />
          <EmptyState
            title="Chưa có mục mẫu"
            description="Đây là trạng thái rỗng tĩnh trong preview."
          />
          <ErrorState
            title="Lỗi minh họa"
            description="Thông báo này không đến từ API hoặc dữ liệu thật."
          />
        </div>
      </Card>
    </div>
  );
}

export function SharedUiPreviewPage() {
  const [searchParams] = useSearchParams();
  const queryArea = searchParams.get('area');
  const area: ShellArea = isShellArea(queryArea) ? queryArea : 'public';
  const activeKey = searchParams.get('active') ?? defaultActive[area];
  const preview = <ComponentGallery />;

  if (area === 'student') {
    return (
      <StudentLayout activeKey={activeKey} previewNavigation>
        <PreviewNotice area={area} />
        {preview}
      </StudentLayout>
    );
  }

  if (area === 'admin') {
    return (
      <AdminLayout activeKey={activeKey} previewNavigation>
        <PreviewNotice area={area} />
        {preview}
      </AdminLayout>
    );
  }

  return (
    <PublicLayout activeKey={activeKey} previewNavigation>
      <PreviewNotice area={area} />
      {preview}
    </PublicLayout>
  );
}
