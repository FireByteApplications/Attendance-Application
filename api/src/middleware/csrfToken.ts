import crypto from 'crypto';
import {RequestHandler} from 'express';

/** Header name */
const CSRF_HEADER = 'x-csrf-token';

/** attach req.csrfToken() and enforce on state-changing requests */
export const csrfMiddleware: RequestHandler = (req, res, next) => {
    // Ensure a token exists in the session
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomUUID();
    }

    // Expose a helper so routes (or a dedicated /csrf route) can read it
    (req as any).csrfToken = () => req.session.csrfToken;

    // For unsafe verbs, verify header or body field
    const unsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(req.method);
    if (!unsafe) return next();
    const sent =
      req.headers[CSRF_HEADER] ||
      (typeof req.body === 'object' && (req.body[CSRF_HEADER] as string));

    if (sent !== req.session.csrfToken) {
      res.status(403).json({ message: 'Invalid CSRF token' });
      return;
    }
    next();
  };
