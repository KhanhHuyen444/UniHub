import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main>
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn này chưa có trong ứng dụng UniHub.</p>
      <p>
        <Link to="/_dev/health">Mở trang kiểm tra môi trường phát triển</Link>
      </p>
    </main>
  );
}
