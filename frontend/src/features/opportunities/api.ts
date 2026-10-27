import { apiRequest } from '../../lib/api';
import {
  parseMajorOptions,
  parseOpportunityDetail,
  parseOpportunityList,
  type MajorOption,
  type OpportunityDetailResponse,
  type OpportunityListResponse,
} from './contracts';

export async function getOpportunityList(
  query: URLSearchParams,
  signal: AbortSignal,
): Promise<OpportunityListResponse> {
  const value = await apiRequest<unknown>('/api/opportunities', {
    query,
    signal,
  });
  return parseOpportunityList(value);
}

export async function getOpportunityDetail(
  id: string,
  signal: AbortSignal,
): Promise<OpportunityDetailResponse> {
  const value = await apiRequest<unknown>(
    `/api/opportunities/${encodeURIComponent(id)}`,
    { signal },
  );
  return parseOpportunityDetail(value);
}

export async function getMajorOptions(
  signal: AbortSignal,
): Promise<MajorOption[]> {
  const query = new URLSearchParams({ type: 'Major' });
  const value = await apiRequest<unknown>('/api/categories', {
    query,
    signal,
  });
  return parseMajorOptions(value);
}
