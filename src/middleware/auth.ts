import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DataService } from '../services/dataService';
import { User } from '../types';
import { SecurityService } from '../services/securityService';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Authorization header format must be: Bearer <token>' });
    return;
  }

  const token = parts[1];

  // Check if API key (starts with sl_live_)
  if (token.startsWith('sl_live_')) {
    const keyHash = SecurityService.hashApiKey(token);
    const apiKey = await DataService.findApiKeyByHash(keyHash);

    if (!apiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      res.status(401).json({ error: 'API key has expired' });
      return;
    }

    const user = await DataService.findUserById(apiKey.user_id);
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'User account is inactive or missing' });
      return;
    }

    req.user = user;
    next();
    return;
  }

  // Otherwise, verify as JWT Token
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await DataService.findUserById(decoded.userId);

    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'User account is inactive or not found' });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
