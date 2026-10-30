import { protectedApiRequest } from '../../auth/auth-api';
import {
  parseAdminOpportunityResponse,
  parseAdminOpportunityMutation,
  parsePendingOpportunities,
  type AdminOpportunityMutation,
  type PendingOpportunitiesResponse,
} from './contracts';

export async function getPendingOpportunities(
  page: number,
  signal: AbortSignal,
): Promise<PendingOpportunitiesResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  const value = await protectedApiRequest<unknown>(
    `/api/admin/opportunities?${query.toString()}`,
    { signal },
  );
  return parsePendingOpportunities(value);
}

export async function getAdminOpportunity(id: string, signal: AbortSignal) {
  const value = await protectedApiRequest<unknown>(
    `/api/admin/opportunities/${encodeURIComponent(id)}`,
    { signal },
  );
  return parseAdminOpportunityResponse(value);
}

export async function approveAdminOpportunity(
  id: number,
  verified: boolean,
): Promise<AdminOpportunityMutation> {
  const value = await protectedApiRequest<unknown>(
    `/api/admin/opportunities/${id}/approve`,
    { method: 'POST', body: { verified } },
  );
  return parseAdminOpportunityMutation(value);
}

export async function rejectAdminOpportunity(
  id: number,
  reason: string,
): Promise<AdminOpportunityMutation> {
  const value = await protectedApiRequest<unknown>(
    `/api/admin/opportunities/${id}/reject`,
    { method: 'POST', body: { reason } },
  );
  return parseAdminOpportunityMutation(value);
}
