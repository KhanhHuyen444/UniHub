import { Prisma } from '../../generated/prisma/client.js';

const TARGET_BY_ACTION = {
  APPROVE_OPPORTUNITY: 'Opportunity',
  REJECT_OPPORTUNITY: 'Opportunity',
  DELETE_POST: 'ForumPost',
  DELETE_COMMENT: 'Comment',
  CREATE_CATEGORY: 'Category',
  RENAME_CATEGORY: 'Category',
  CLOSE_CATEGORY: 'Category',
  REOPEN_CATEGORY: 'Category',
  CHANGE_ROLE: 'User',
} as const;
const REASON_REQUIRED_ACTIONS = new Set<ActivityAction>([
  'REJECT_OPPORTUNITY',
  'DELETE_POST',
  'DELETE_COMMENT',
]);

export type ActivityAction = keyof typeof TARGET_BY_ACTION;
export type ActivityTarget = (typeof TARGET_BY_ACTION)[ActivityAction];

export interface ActivityLogInput {
  adminId: number;
  action: ActivityAction;
  targetId: number;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  createdAt?: Date;
}

function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const serialized = JSON.stringify(value);
  if (serialized === undefined || [...serialized].length > 500) {
    throw new RangeError('Activity log value exceeds the 500 character limit.');
  }
  return serialized;
}

/** Append one audit record inside the owning feature's transaction. */
export async function writeActivityLog(
  transaction: Prisma.TransactionClient,
  input: ActivityLogInput,
): Promise<void> {
  const targetType = TARGET_BY_ACTION[input.action];
  const reason = input.reason ?? null;
  if (
    (REASON_REQUIRED_ACTIONS.has(input.action) && !reason?.trim()) ||
    (reason !== null && [...reason].length > 500)
  ) {
    throw new RangeError(
      'Activity log reason exceeds the 500 character limit.',
    );
  }

  await transaction.activityLog.create({
    data: {
      admin_id: input.adminId,
      action_type: input.action,
      target_type: targetType,
      target_id: input.targetId,
      old_value: serializeValue(input.oldValue),
      new_value: serializeValue(input.newValue),
      reason,
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    },
  });
}
