import type { SessionUser } from '@job-finder/shared';
import type { Request } from 'express';

export const SESSION_COOKIE = 'sid';

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
  cookies: Record<string, string | undefined>;
}
