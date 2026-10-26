import { useEffect, useState } from 'react';
import { checkBackend } from '../lib/health';

type Status = 'checking' | 'available' | 'unavailable';

const statusContent = {
  checking: {
    title: 'Đang kiểm tra kết nối…',
    description:
      'Frontend đang gửi yêu cầu đến backend. Vui lòng chờ một chút.',
    color: 'border-slate-200 bg-slate-50 text-slate-800',
  },
  available: {
    title: 'Backend hoạt động',
    description: 'Frontend đã nhận phản hồi hợp lệ từ GET /api/health.',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  unavailable: {
    title: 'Không kết nối được backend',
    description:
      'Hãy kiểm tra terminal backend, cổng PORT và API_PROXY_TARGET, rồi thử lại.',
    color: 'border-amber-200 bg-amber-50 text-amber-900',
  },
} satisfies Record<
  Status,
  { title: string; description: string; color: string }
>;

export function HealthCheckPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus('checking');
    const timeout = window.setTimeout(() => controller.abort(), 5_000);

    void checkBackend(controller.signal)
      .then(() => {
        if (active) setStatus('available');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  const content = statusContent[status];

  return (
    <main className="mx-auto max-w-5xl px-8 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
        UniHub · Môi trường phát triển
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
        Kiểm tra bộ khung dự án
      </h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
        Đây là màn hình kỹ thuật tạm thời dành cho nhóm phát triển, không phải
        giao diện chính thức của UniHub.
      </p>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Kết nối frontend → backend
        </h2>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-busy={status === 'checking'}
          className={`mt-5 rounded-xl border p-5 ${content.color}`}
        >
          <p className="text-xl font-semibold">{content.title}</p>
          <p className="mt-2 leading-7">{content.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          disabled={status === 'checking'}
          className="mt-6 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900 disabled:cursor-wait disabled:opacity-50"
        >
          Thử lại
        </button>
      </section>

      <aside className="mt-6 rounded-xl border border-slate-200 p-6 text-sm leading-7 text-slate-600">
        <h2 className="font-semibold text-slate-900">
          Giới hạn của phép kiểm tra
        </h2>
        <p>
          Kết quả chỉ xác nhận HTTP server phản hồi. MySQL, đăng nhập Google,
          JWT và các chức năng nghiệp vụ chưa được triển khai. Màn hình này chưa
          dùng thiết kế Figma và dành cho desktop 1280–1920 px.
        </p>
      </aside>
    </main>
  );
}
