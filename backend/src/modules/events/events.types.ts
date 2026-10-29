import type { PrismaClient } from '../../generated/prisma/client.js';
import type { VerifiedAuthIdentity } from '../auth/access-token.js';

export type EventStatus = 'Upcoming' | 'Completed' | 'Overdue';

export interface EventDto {
  id: number;
  title: string;
  dueDate: string;
  remindBefore: number;
  notes: string | null;
  status: EventStatus;
  remindedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  dueDate: Date;
  remindBefore: number;
  notes: string | null;
}

export interface PatchEventInput {
  title?: string;
  dueDate?: Date;
  remindBefore?: number;
  notes?: string | null;
}

export type EventPrismaClient =
  | PrismaClient
  | {
      event: any;
      notification?: any;
      authSession?: any;
      $transaction?: any;
    };

export interface EventsRouterDependencies {
  getPrismaClient?: () => EventPrismaClient;
  getEvaluatedAt?: () => Date;
  verifyToken?: (token: string) => Promise<VerifiedAuthIdentity>;
  now?: () => Date;
}
