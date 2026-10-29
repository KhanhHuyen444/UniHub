import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

const MAX_INT = 2_147_483_647;
const MAX_COLUMN_CHARACTERS = 500;
const ALLOWED_ACTION_TARGET = {
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

type ActionType = keyof typeof ALLOWED_ACTION_TARGET;
type CategoryType = 'Major' | 'Skill';
type Role = 'Student' | 'Admin';
type OpportunityOldValue = { status: 'Pending'; is_verified: boolean };
type OpportunityApprovedValue = { status: 'Approved'; is_verified: boolean };
type OpportunityRejectedValue = {
  status: 'Rejected';
  is_verified: false;
};
type CategoryValue = {
  type: CategoryType;
  name: string;
  status: 'Active';
};
type NameValue = { name: string };
type StatusValue = { status: 'Active' | 'Closed' };
type RoleValue = { role: Role };

interface ActivityLogInputBase {
  adminId: number;
  targetId: number;
  reason?: string | null;
}

export type ActivityLogInput =
  | (ActivityLogInputBase & {
      actionType: 'APPROVE_OPPORTUNITY';
      targetType: 'Opportunity';
      oldValue: OpportunityOldValue;
      newValue: OpportunityApprovedValue;
      reason?: never;
    })
  | (ActivityLogInputBase & {
      actionType: 'REJECT_OPPORTUNITY';
      targetType: 'Opportunity';
      oldValue: OpportunityOldValue;
      newValue: OpportunityRejectedValue;
      reason: string;
    })
  | (ActivityLogInputBase & {
      actionType: 'DELETE_POST' | 'DELETE_COMMENT';
      targetType: 'ForumPost' | 'Comment';
      oldValue: { is_deleted: false };
      newValue: { is_deleted: true };
      reason: string;
    })
  | (ActivityLogInputBase & {
      actionType: 'CREATE_CATEGORY';
      targetType: 'Category';
      oldValue: null;
      newValue: CategoryValue;
    })
  | (ActivityLogInputBase & {
      actionType: 'RENAME_CATEGORY';
      targetType: 'Category';
      oldValue: NameValue;
      newValue: NameValue;
    })
  | (ActivityLogInputBase & {
      actionType: 'CLOSE_CATEGORY' | 'REOPEN_CATEGORY';
      targetType: 'Category';
      oldValue: StatusValue;
      newValue: StatusValue;
    })
  | (ActivityLogInputBase & {
      actionType: 'CHANGE_ROLE';
      targetType: 'User';
      oldValue: RoleValue;
      newValue: RoleValue;
    });

export type ActivityLogTransactionClient = Prisma.TransactionClient;
type ActivityLogCreator = Pick<PrismaClient, 'activityLog'>['activityLog'];

export class ActivityLogValidationError extends Error {
  readonly code = 'INVALID_ACTIVITY_LOG';

  constructor() {
    super('Activity log payload is invalid.');
    this.name = 'ActivityLogValidationError';
  }
}

function invalid(): never {
  throw new ActivityLogValidationError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: unknown, expected: string[]): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function withinColumnLimit(value: string): boolean {
  return Array.from(value).length <= MAX_COLUMN_CHARACTERS;
}

function containsCredential(value: string): boolean {
  return (
    /\bBearer\s+\S+/i.test(value) ||
    /(?:^|\s)[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:$|\s)/.test(
      value,
    ) ||
    /\b(?:access[_ -]?token|id[_ -]?token|refresh[_ -]?token|secret|password|authorization)\s*[:=]\s*\S+/i.test(
      value,
    ) ||
    /^[A-Za-z0-9_-]{43}$/.test(value)
  );
}

function validateReason(action: ActionType, reason: unknown): string | null {
  const required =
    action === 'REJECT_OPPORTUNITY' ||
    action === 'DELETE_POST' ||
    action === 'DELETE_COMMENT';

  if (reason === undefined || reason === null) {
    if (required) invalid();
    return null;
  }
  if (typeof reason !== 'string' || !withinColumnLimit(reason)) invalid();
  if (required && reason.trim().length === 0) invalid();
  if (containsCredential(reason)) invalid();
  return reason;
}

function validatePayload(input: ActivityLogInput): {
  oldValue: string | null;
  newValue: string;
  reason: string | null;
} {
  if (
    !Number.isSafeInteger(input.adminId) ||
    input.adminId < 1 ||
    input.adminId > MAX_INT ||
    !Number.isSafeInteger(input.targetId) ||
    input.targetId < 1 ||
    input.targetId > MAX_INT ||
    input.targetType !== ALLOWED_ACTION_TARGET[input.actionType]
  ) {
    invalid();
  }

  const keys = Object.keys(input);
  const allowedKeys = [
    'adminId',
    'actionType',
    'targetType',
    'targetId',
    'oldValue',
    'newValue',
    ...(Object.hasOwn(input, 'reason') ? ['reason'] : []),
  ];
  if (
    keys.length !== allowedKeys.length ||
    keys.some((key) => !allowedKeys.includes(key))
  ) {
    invalid();
  }

  let oldValue: Record<string, unknown> | null;
  let newValue: Record<string, unknown>;
  switch (input.actionType) {
    case 'APPROVE_OPPORTUNITY':
      if (
        !hasExactKeys(input.oldValue, ['status', 'is_verified']) ||
        input.oldValue.status !== 'Pending' ||
        typeof input.oldValue.is_verified !== 'boolean' ||
        !hasExactKeys(input.newValue, ['status', 'is_verified']) ||
        input.newValue.status !== 'Approved' ||
        typeof input.newValue.is_verified !== 'boolean'
      ) {
        invalid();
      }
      oldValue = {
        status: input.oldValue.status,
        is_verified: input.oldValue.is_verified,
      };
      newValue = {
        status: input.newValue.status,
        is_verified: input.newValue.is_verified,
      };
      break;
    case 'REJECT_OPPORTUNITY':
      if (
        !hasExactKeys(input.oldValue, ['status', 'is_verified']) ||
        input.oldValue.status !== 'Pending' ||
        typeof input.oldValue.is_verified !== 'boolean' ||
        !hasExactKeys(input.newValue, ['status', 'is_verified']) ||
        input.newValue.status !== 'Rejected' ||
        input.newValue.is_verified !== false
      ) {
        invalid();
      }
      oldValue = {
        status: input.oldValue.status,
        is_verified: input.oldValue.is_verified,
      };
      newValue = { status: input.newValue.status, is_verified: false };
      break;
    case 'DELETE_POST':
    case 'DELETE_COMMENT':
      if (
        !hasExactKeys(input.oldValue, ['is_deleted']) ||
        input.oldValue.is_deleted !== false ||
        !hasExactKeys(input.newValue, ['is_deleted']) ||
        input.newValue.is_deleted !== true
      ) {
        invalid();
      }
      oldValue = { is_deleted: false };
      newValue = { is_deleted: true };
      break;
    case 'CREATE_CATEGORY':
      if (
        input.oldValue !== null ||
        !hasExactKeys(input.newValue, ['type', 'name', 'status']) ||
        (input.newValue.type !== 'Major' && input.newValue.type !== 'Skill') ||
        typeof input.newValue.name !== 'string' ||
        input.newValue.name.trim().length === 0 ||
        Array.from(input.newValue.name).length > 100 ||
        input.newValue.status !== 'Active'
      ) {
        invalid();
      }
      oldValue = null;
      newValue = {
        type: input.newValue.type,
        name: input.newValue.name,
        status: 'Active',
      };
      break;
    case 'RENAME_CATEGORY':
      if (
        !hasExactKeys(input.oldValue, ['name']) ||
        !hasExactKeys(input.newValue, ['name']) ||
        typeof input.oldValue.name !== 'string' ||
        typeof input.newValue.name !== 'string' ||
        input.oldValue.name.trim().length === 0 ||
        input.newValue.name.trim().length === 0 ||
        Array.from(input.oldValue.name).length > 100 ||
        Array.from(input.newValue.name).length > 100 ||
        input.oldValue.name === input.newValue.name
      ) {
        invalid();
      }
      oldValue = { name: input.oldValue.name };
      newValue = { name: input.newValue.name };
      break;
    case 'CLOSE_CATEGORY':
      if (
        !hasExactKeys(input.oldValue, ['status']) ||
        input.oldValue.status !== 'Active' ||
        !hasExactKeys(input.newValue, ['status']) ||
        input.newValue.status !== 'Closed'
      ) {
        invalid();
      }
      oldValue = { status: 'Active' };
      newValue = { status: 'Closed' };
      break;
    case 'REOPEN_CATEGORY':
      if (
        !hasExactKeys(input.oldValue, ['status']) ||
        input.oldValue.status !== 'Closed' ||
        !hasExactKeys(input.newValue, ['status']) ||
        input.newValue.status !== 'Active'
      ) {
        invalid();
      }
      oldValue = { status: 'Closed' };
      newValue = { status: 'Active' };
      break;
    case 'CHANGE_ROLE':
      if (
        !hasExactKeys(input.oldValue, ['role']) ||
        !hasExactKeys(input.newValue, ['role']) ||
        (input.oldValue.role !== 'Student' &&
          input.oldValue.role !== 'Admin') ||
        (input.newValue.role !== 'Student' &&
          input.newValue.role !== 'Admin') ||
        input.oldValue.role === input.newValue.role
      ) {
        invalid();
      }
      oldValue = { role: input.oldValue.role };
      newValue = { role: input.newValue.role };
      break;
  }

  const oldValueJson = oldValue === null ? null : JSON.stringify(oldValue);
  const newValueJson = JSON.stringify(newValue);
  if (
    (oldValueJson !== null && !withinColumnLimit(oldValueJson)) ||
    !withinColumnLimit(newValueJson)
  ) {
    invalid();
  }

  return {
    oldValue: oldValueJson,
    newValue: newValueJson,
    reason: validateReason(input.actionType, input.reason),
  };
}

export async function writeActivityLog(
  transaction: ActivityLogTransactionClient,
  input: ActivityLogInput,
): Promise<void> {
  const payload = validatePayload(input);
  const activityLog = transaction.activityLog as ActivityLogCreator;
  await activityLog.create({
    data: {
      admin_id: input.adminId,
      action_type: input.actionType,
      target_type: input.targetType,
      target_id: input.targetId,
      old_value: payload.oldValue,
      new_value: payload.newValue,
      reason: payload.reason,
    },
  });
}
