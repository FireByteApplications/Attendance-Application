// middleware/requireAdmin.ts
import { Request, Response, NextFunction } from 'express';

export interface AuthedRequest extends Request {
  user?: {
    email: string;
    name: string;
    id?: string;
    isAdmin?: boolean;
  };
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  req.user = req.session.user;

  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admins only' });
    return;
  } 
  next();
}