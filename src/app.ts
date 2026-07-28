import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import authRoutes from './routes/auth';
import domainRoutes from './routes/domains';
import linkRoutes from './routes/links';
import apiKeyRoutes from './routes/apiKeys';
import { RedirectService } from './services/redirectService';
import { DataService } from './services/dataService';

const app = express();

// ─── APP_MODE: "admin" (full dashboard + API) or "shortener" (redirects only) ───
const APP_MODE = process.env.APP_MODE || 'admin';

// Trust reverse proxy headers (Cloudflare, Nginx, Traefik, Caddy)
app.set('trust proxy', true);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());

// System Health Check (both modes)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', mode: APP_MODE, db_host: process.env.DB_HOST || 'localhost' });
});

// ════════════════════════════════════════════════════════════
// ADMIN MODE: Full dashboard, API endpoints, static files
// ════════════════════════════════════════════════════════════
if (APP_MODE === 'admin') {
  // Serve static Web Dashboard UI
  app.use(express.static(path.join(__dirname, '../public')));

  // Rate limiter for API
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use('/api/', apiLimiter);

  // Mount REST API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/domains', domainRoutes);
  app.use('/api/v1/links', linkRoutes);
  app.use('/api/v1/api-keys', apiKeyRoutes);

  // Config endpoint: frontend reads system_domain from shortener's domain
  app.get('/api/v1/config', (req: Request, res: Response) => {
    const rawShortener = process.env.SYSTEM_DOMAIN || process.env.SHORTENER_FQDN || process.env.SERVICE_FQDN_SHORTENER_ENGINE || process.env.SERVICE_FQDN_LINK_SHORTENER || '';
    const cleanShortener = rawShortener.split(',').map(d => d.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean)[0];

    res.status(200).json({
      admin_domain: req.get('host')?.split(':')[0] || 'localhost',
      system_domain: cleanShortener || 'localhost',
    });
  });

  // Caddy On-Demand TLS authorization check endpoint
  app.get('/internal/domain-check', async (req: Request, res: Response): Promise<void> => {
    try {
      const rawDomain = req.query.domain || req.query.domain_name || req.query.host || '';
      const domainName = String(rawDomain).trim().toLowerCase().split(':')[0];
      if (!domainName) {
        res.sendStatus(400);
        return;
      }

      // 1. Check if domain is registered in database
      const domain = await DataService.findDomainByHostname(domainName);
      if (domain) {
        res.sendStatus(200);
        return;
      }

      // 2. Allow system shortener domain, admin domain & localhost
      const sysDomain = (process.env.SYSTEM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
      const adminDomain = (process.env.ADMIN_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
      if (domainName === sysDomain || domainName === adminDomain || domainName === 'localhost') {
        res.sendStatus(200);
        return;
      }

      res.sendStatus(403);
    } catch (err) {
      console.error('Error checking domain for Caddy TLS:', err);
      res.sendStatus(500);
    }
  });

  // Root serves admin panel
  app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// ════════════════════════════════════════════════════════════
// SHORTENER MODE: Only redirects, root returns 404
// ════════════════════════════════════════════════════════════
if (APP_MODE === 'shortener') {
  // Root handler: If root URL (without slug) is visited, redirect to admin domain or display helpful service info
  app.get('/', (req: Request, res: Response) => {
    const adminFqdn = process.env.ADMIN_DOMAIN || process.env.SERVICE_FQDN_ADMIN_PANEL || '';
    const cleanAdmin = adminFqdn.replace(/^https?:\/\//, '').replace(/\/$/, '').split(',')[0].trim();
    if (cleanAdmin && cleanAdmin !== 'localhost') {
      res.redirect(302, `https://${cleanAdmin}`);
      return;
    }
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Link Kısaltma Servisi</title>
        <style>
          body { font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; margin: 0; background: #0b0f19; color: #f8fafc; text-align: center; }
          h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #3b82f6; }
          p { color: #94a3b8; font-size: 1.1rem; }
        </style>
      </head>
      <body>
        <div>
          <h1>Link Kısaltma Servisi</h1>
          <p>Yönlendirilecek geçerli bir kısa bağlantı adresi giriniz (örnek: /slug).</p>
        </div>
      </body>
      </html>
    `);
  });
}

// ════════════════════════════════════════════════════════════
// REDIRECT ENGINE (both modes)
// ════════════════════════════════════════════════════════════
app.get('/:slug', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawSlug = req.params.slug;
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : (rawSlug || '');
    const rawHost = req.get('host') || req.headers.host || req.hostname || 'localhost';
    const hostname = Array.isArray(rawHost) ? rawHost[0] : rawHost;

    // Ignore requests to static files or API routes
    if (
      !slug || 
      slug.startsWith('api') || 
      slug === 'health' || 
      slug === 'favicon.ico' || 
      slug === 'style.css' || 
      slug === 'app.js' || 
      slug === 'index.html'
    ) {
      next();
      return;
    }

    const redirectResult = await RedirectService.resolveRedirect(hostname, slug, {
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer || req.headers.referrer as string,
      clientIp: req.ip || req.socket.remoteAddress
    });

    if (!redirectResult) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <title>404 - Bağlantı Bulunamadı</title>
          <style>
            body { font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; margin: 0; background: #0b0f19; color: #f8fafc; text-align: center; }
            h1 { font-size: 3.5rem; margin-bottom: 0.5rem; color: #f43f5e; }
            p { color: #94a3b8; font-size: 1.1rem; }
          </style>
        </head>
        <body>
          <div>
            <h1>404</h1>
            <p>Erişmeye çalıştığınız kısa bağlantı bulunamadı veya süresi doldu.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    res.redirect(redirectResult.redirectType, redirectResult.destinationUrl);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).send('Internal Server Error processing redirect');
  }
});

// Fallback 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;
