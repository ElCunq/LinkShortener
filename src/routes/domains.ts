import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { DataService } from '../services/dataService';
import { SecurityService } from '../services/securityService';
import { DnsService } from '../services/dnsService';

const router = Router();

const CNAME_TARGET = process.env.CNAME_TARGET || 'domains.shortlink-service.com';

// Require authentication for all domain management endpoints
router.use(authenticateToken);

// POST /api/v1/domains
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { hostname } = req.body;
    const userId = req.user!.id;

    if (!hostname || typeof hostname !== 'string') {
      res.status(400).json({ error: 'Valid hostname is required' });
      return;
    }

    const cleanHost = hostname.trim().toLowerCase();

    // Check if domain already registered
    const existing = await DataService.findDomainByHostname(cleanHost);
    if (existing) {
      res.status(409).json({ error: 'Domain is already registered in the system' });
      return;
    }

    const verificationToken = SecurityService.generateVerificationToken();
    const domain = await DataService.createDomain(userId, cleanHost, verificationToken);

    // Extract subdomain / name for DNS record guide
    const hostParts = cleanHost.split('.');
    const nameRecord = hostParts.length > 2 ? hostParts[0] : '@';
    const txtRecordName = `_shortlink-verification.${cleanHost}`;

    res.status(201).json({
      id: domain.id,
      hostname: domain.hostname,
      status: domain.verification_status,
      ssl_status: domain.ssl_status,
      dns_records: [
        {
          type: 'CNAME',
          name: nameRecord,
          value: CNAME_TARGET
        },
        {
          type: 'TXT',
          name: txtRecordName,
          value: verificationToken
        }
      ],
      created_at: domain.created_at
    });
  } catch (err: any) {
    console.error('Create domain error:', err);
    res.status(500).json({ error: 'Internal server error creating domain' });
  }
});

// GET /api/v1/domains
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const domains = await DataService.listDomainsByUserId(req.user!.id);
    res.status(200).json(domains);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error listing domains' });
  }
});

// GET /api/v1/domains/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const domain = await DataService.findDomainById(id);
    if (!domain || domain.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    res.status(200).json(domain);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error fetching domain' });
  }
});

// POST /api/v1/domains/:id/verify
router.post('/:id/verify', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const domain = await DataService.findDomainById(id);
    if (!domain || domain.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    const verificationResult = await DnsService.verifyDomain(domain.hostname, domain.verification_token);

    if (verificationResult.verified) {
      const updated = await DataService.updateDomainStatus(domain.id, 'active', 'active');
      res.status(200).json({
        id: updated?.id,
        hostname: updated?.hostname,
        status: updated?.verification_status,
        ssl_status: updated?.ssl_status,
        verified: true,
        verification_message: verificationResult.message
      });
    } else {
      res.status(200).json({
        id: domain.id,
        hostname: domain.hostname,
        status: domain.verification_status,
        ssl_status: domain.ssl_status,
        verified: false,
        verification_message: verificationResult.message,
        error: verificationResult.message
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error verifying domain' });
  }
});

// DELETE /api/v1/domains/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const domain = await DataService.findDomainById(id);
    if (!domain || domain.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Domain not found or unauthorized' });
      return;
    }

    const deleted = await DataService.deleteDomain(id);
    if (!deleted) {
      res.status(404).json({ error: 'Domain not found or unauthorized' });
      return;
    }
    res.status(200).json({ message: 'Domain deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting domain:', err);
    res.status(500).json({ error: 'Internal server error deleting domain' });
  }
});

export default router;
