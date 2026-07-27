import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { DataService } from '../services/dataService';
import { SecurityService } from '../services/securityService';
import { RedirectService } from '../services/redirectService';
import bcrypt from 'bcryptjs';

const router = Router();

router.use(authenticateToken);

// POST /api/v1/links
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { domain_id, destination_url, custom_slug, redirect_type, expires_at, password } = req.body;
    const userId = req.user!.id;

    if (!domain_id || !destination_url) {
      res.status(400).json({ error: 'domain_id and destination_url are required' });
      return;
    }

    // Validate domain belongs to user
    const domain = await DataService.findDomainById(domain_id);
    if (!domain || domain.user_id !== userId) {
      res.status(404).json({ error: 'Domain not found or unauthorized' });
      return;
    }

    // Validate URL security (anti-SSRF, protocols http/https)
    const urlValidation = SecurityService.validateDestinationUrl(destination_url);
    if (!urlValidation.valid) {
      res.status(400).json({ error: urlValidation.reason });
      return;
    }

    // Handle slug
    let slug = custom_slug ? custom_slug.trim() : SecurityService.generateRandomSlug();
    
    // Check slug format if custom
    if (custom_slug) {
      if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
        res.status(400).json({ error: 'Custom slug can only contain letters, numbers, underscores, and hyphens' });
        return;
      }
    }

    // Check slug uniqueness for domain (UNIQUE constraint: domain_id + slug)
    const existing = await DataService.findLinkByDomainAndSlug(domain.hostname, slug);
    if (existing) {
      res.status(409).json({ error: `Slug '${slug}' is already taken for domain ${domain.hostname}` });
      return;
    }

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const redirectTypeNum = redirect_type === 301 ? 301 : 302;
    const parsedExpiresAt = expires_at ? new Date(expires_at) : null;

    const link = await DataService.createShortLink({
      userId,
      domainId: domain.id,
      slug,
      destinationUrl: destination_url,
      redirectType: redirectTypeNum,
      expiresAt: parsedExpiresAt,
      passwordHash
    });

    RedirectService.invalidateCache(domain.hostname, link.slug);

    const protocol = domain.ssl_status === 'active' ? 'https' : 'http';
    const shortUrl = `${protocol}://${domain.hostname}/${link.slug}`;

    res.status(201).json({
      id: link.id,
      short_url: shortUrl,
      destination_url: link.destination_url,
      domain_id: domain.id,
      hostname: domain.hostname,
      slug: link.slug,
      redirect_type: link.redirect_type,
      is_active: link.is_active,
      expires_at: link.expires_at,
      created_at: link.created_at
    });
  } catch (err: any) {
    console.error('Create link error:', err);
    res.status(500).json({ error: 'Internal server error creating short link' });
  }
});

// GET /api/v1/links
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const domainId = req.query.domain_id as string | undefined;
    let links = await DataService.listLinksByUserId(req.user!.id);
    if (domainId) {
      links = links.filter(l => l.domain_id === domainId);
    }
    res.status(200).json(links);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error listing short links' });
  }
});

// GET /api/v1/links/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const link = await DataService.findLinkById(id);
    if (!link || link.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Short link not found' });
      return;
    }

    res.status(200).json(link);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error fetching short link' });
  }
});

// PATCH /api/v1/links/:id
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const link = await DataService.findLinkById(id);
    if (!link || link.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Short link not found' });
      return;
    }

    const { destination_url, redirect_type, is_active, expires_at } = req.body;

    if (destination_url) {
      const urlValidation = SecurityService.validateDestinationUrl(destination_url);
      if (!urlValidation.valid) {
        res.status(400).json({ error: urlValidation.reason });
        return;
      }
    }

    const domain = await DataService.findDomainById(link.domain_id);

    if (destination_url) link.destination_url = destination_url;
    if (redirect_type === 301 || redirect_type === 302) link.redirect_type = redirect_type;
    if (typeof is_active === 'boolean') link.is_active = is_active;
    if (expires_at !== undefined) link.expires_at = expires_at ? new Date(expires_at) : null;

    if (domain) {
      RedirectService.invalidateCache(domain.hostname, link.slug);
    }

    res.status(200).json(link);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error updating short link' });
  }
});

// DELETE /api/v1/links/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const link = await DataService.findLinkById(id);
    if (!link || link.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Short link not found' });
      return;
    }

    const domain = await DataService.findDomainById(link.domain_id);
    await DataService.deleteShortLink(link.id);

    if (domain) {
      RedirectService.invalidateCache(domain.hostname, link.slug);
    }

    res.status(200).json({ message: 'Short link deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error deleting short link' });
  }
});

// GET /api/v1/links/:id/analytics
router.get('/:id/analytics', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const link = await DataService.findLinkById(id);
    if (!link || link.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Short link not found' });
      return;
    }

    const analytics = await DataService.getLinkAnalytics(link.id);
    res.status(200).json({
      link_id: link.id,
      slug: link.slug,
      ...analytics
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error fetching analytics' });
  }
});

// GET /api/v1/links/:id/qrcode
router.get('/:id/qrcode', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const link = await DataService.findLinkById(id);
    if (!link || link.user_id !== req.user!.id) {
      res.status(404).json({ error: 'Short link not found' });
      return;
    }

    const domain = await DataService.findDomainById(link.domain_id);
    const hostname = domain ? domain.hostname : 'go.orfa.dev';
    const protocol = domain?.ssl_status === 'active' ? 'https' : 'http';
    const shortUrl = `${protocol}://${hostname}/${link.slug}`;

    const { QrService } = await import('../services/qrService');
    const qrDataUrl = await QrService.generateDataUrl(shortUrl);

    res.status(200).json({
      link_id: link.id,
      short_url: shortUrl,
      qr_code: qrDataUrl
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error generating QR code' });
  }
});

export default router;
