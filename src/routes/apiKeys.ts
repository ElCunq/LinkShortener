import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { DataService } from '../services/dataService';

const router = Router();

router.use(authenticateToken);

// POST /api/v1/api-keys
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, expires_in_days } = req.body;
    const userId = req.user!.id;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Key name is required' });
      return;
    }

    const { apiKey, rawKey } = await DataService.createApiKey(userId, name, expires_in_days || 90);

    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      api_key: rawKey, // Raw key returned ONCE to user
      expires_at: apiKey.expires_at,
      created_at: apiKey.created_at
    });
  } catch (err: any) {
    console.error('Create API key error:', err);
    res.status(500).json({ error: 'Internal server error creating API key' });
  }
});

// GET /api/v1/api-keys
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const keys = await DataService.listApiKeysByUserId(req.user!.id);
    res.status(200).json(keys);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error listing API keys' });
  }
});

// DELETE /api/v1/api-keys/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const apiKey = await DataService.findApiKeyByHash(id); // Check or list keys
    const deleted = await DataService.deleteApiKey(id);
    if (!deleted) {
      res.status(404).json({ error: 'API key not found or unauthorized' });
      return;
    }
    res.status(200).json({ message: 'API key revoked successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error revoking API key' });
  }
});

export default router;
