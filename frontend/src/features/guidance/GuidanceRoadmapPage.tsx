import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PublicLayout } from '../../layouts/PublicLayout';
import { StudentLayout } from '../../layouts/StudentLayout';
import { useAuth } from '../auth/AuthProvider';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { getMajorOptions } from '../opportunities/api';
import { getGuidanceList } from './api';
import { isGuidanceId } from './contracts';
import { useGuidanceRequest } from './useGuidanceRequest';

function majorFromSearch(search: string): number | undefined {
  const query = new URLSearchParams(search);
  const values = query.getAll('majorId');
  if (
    [...query.keys()].some((key) => key !== 'majorId') ||
    values.length > 1 ||
    (values.length === 1 &&
      (!/^\d+$/.test(values[0]) || !isGuidanceId(Number(values[0]))))
  ) {
    throw new ApiError('Tham số chuyên ngành không hợp lệ.', {
      code: 'INVALID_QUERY',
      kind: 'request',
      status: 400,
    });
  }
  return values.length ? Number(values[0]) : undefined;
}

export function GuidanceRoadmapPage() {
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const load = useCallback(
    (signal: AbortSignal) =>
      getGuidanceList({ majorId: majorFromSearch(search), signal }),
    [search],
  );
  // The loader can reject synchronously when the URL is invalid.
  const safeLoad = useCallback(
    async (signal: AbortSignal) => load(signal),
    [load],
  );
  const roadmap = useGuidanceRequest(search, safeLoad);
  const majors = useGuidanceRequest('major-options', getMajorOptions);
  const rawMajor = params.get('majorId');
  const requestedMajor =
    rawMajor !== null &&
    /^\d+$/.test(rawMajor) &&
    isGuidanceId(Number(rawMajor))
      ? String(Number(rawMajor))
      : rawMajor;
  const selectedId =
    requestedMajor ??
    (roadmap.state.status === 'success'
      ? String(roadmap.state.data.selectedMajor?.id ?? '')
      : '');
  const options = majors.state.status === 'success' ? majors.state.data : [];
  const unavailable =
    selectedId !== '' &&
    !options.some((major) => String(major.id) === selectedId);
  const returnTo = `/roadmaps${search ? `?${search}` : ''}`;
  const auth = useAuth();
  const isStudent =
    auth.status === 'authenticated' && auth.user?.role === 'Student';
  const Layout = isStudent ? StudentLayout : PublicLayout;

  return (
    <Layout activeKey="roadmaps">
      <div className="grid gap-6">
        <h1 className="type-heading text-navy">
          Lộ trình kỹ năng &amp; Định hướng
        </h1>
        <div className="grid gap-2">
          <label htmlFor="guidance-major" className="type-label text-secondary">
            Chuyên ngành
          </label>
          <Select
            id="guidance-major"
            value={selectedId}
            disabled={majors.state.status !== 'success' || options.length === 0}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) next.set('majorId', event.target.value);
              else next.delete('majorId');
              setParams(next);
            }}
          >
            <option value="">Chuyên ngành mặc định</option>
            {unavailable && (
              <option value={selectedId} disabled>
                Chuyên ngành đã chọn không có trong danh sách Active
              </option>
            )}
            {options.map((major) => (
              <option key={major.id} value={major.id}>
                {major.name}
              </option>
            ))}
          </Select>
          {majors.state.status === 'loading' && (
            <LoadingState title="Đang tải chuyên ngành" />
          )}
          {majors.state.status === 'error' && (
            <ErrorState
              title="Không thể tải chuyên ngành"
              description="Danh sách lựa chọn chưa tải được. Vui lòng thử lại."
              onRetry={majors.retry}
            />
          )}
          {majors.state.status === 'success' && options.length === 0 && (
            <p className="type-label text-muted">
              Chưa có chuyên ngành Active để lựa chọn.
            </p>
          )}
        </div>
        {roadmap.state.status === 'loading' && (
          <LoadingState title="Đang tải lộ trình" />
        )}
        {roadmap.state.status === 'error' && (
          <ErrorState
            title={
              roadmap.state.code === 'INVALID_FILTER'
                ? 'Chuyên ngành không còn khả dụng'
                : 'Không thể tải dữ liệu lộ trình'
            }
            description={`Vui lòng thử lại.${roadmap.state.httpStatus ? ` HTTP ${roadmap.state.httpStatus}.` : ''} Mã lỗi: ${roadmap.state.code}.`}
            onRetry={roadmap.retry}
          >
            {search && (
              <Button variant="outline" onClick={() => setParams({})}>
                Xóa lựa chọn
              </Button>
            )}
          </ErrorState>
        )}
        {roadmap.state.status === 'success' &&
          (roadmap.state.data.selectedMajor === null ? (
            <EmptyState
              title="Chưa có chuyên ngành khả dụng"
              description="Chưa có chuyên ngành Active để hiển thị lộ trình."
            />
          ) : roadmap.state.data.stages.length === 0 ? (
            <EmptyState
              title="Lộ trình cho chuyên ngành này đang được biên soạn"
              description="Bạn có thể chọn chuyên ngành khác."
            />
          ) : (
            <div className="grid gap-6">
              <h2 className="type-title text-navy">
                {roadmap.state.data.selectedMajor.name}
              </h2>
              {roadmap.state.data.stages.map((stage) => (
                <Card key={stage.academicYear} className="grid gap-4 p-6">
                  <h2 className="type-title text-navy">
                    Năm {stage.academicYear}
                  </h2>
                  <ul className="grid gap-4">
                    {stage.items.map((item) => (
                      <li key={item.id} className="grid gap-2">
                        <Link
                          className="type-title text-brand underline"
                          to={`/roadmaps/${item.id}`}
                          state={{ returnTo }}
                        >
                          {item.title}
                        </Link>
                        {item.requiredSkills.length > 0 && (
                          <ul
                            aria-label={`Kỹ năng yêu cầu: ${item.title}`}
                            className="flex flex-wrap gap-2"
                          >
                            {item.requiredSkills.map((skill) => (
                              <li key={skill.id}>
                                <Badge>{skill.name}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          ))}
      </div>
    </Layout>
  );
}
