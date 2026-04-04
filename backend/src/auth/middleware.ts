import { verifyAccessToken } from './jwt';
import { error } from '../utils/response';

export interface AuthContext {
  userId: string;
}

/**
 * Extracts the Bearer token from the Authorization header and verifies it.
 * Returns the auth context on success, or null if the request is unauthenticated.
 */
export async function authenticateRequest(
  req: Request,
): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  return verifyAccessToken(token);
}

/**
 * Higher-order helper that wraps an authenticated route handler.
 * Returns a 401 response if the request is unauthenticated; otherwise
 * invokes the handler with the resolved auth context.
 */
export function withAuth(
  handler: (req: Request, ctx: AuthContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const ctx = await authenticateRequest(req);
    if (!ctx) {
      return error('Unauthorized', 401, 'UNAUTHORIZED');
    }
    return handler(req, ctx);
  };
}
