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

const app = express();

// Trust reverse proxy headers (Cloudflare, Nginx, Traefik, Caddy)
app.set('trust proxy', true);

app.use(helmet({
  contentSecurityPolicy: false // Allow custom domain redirects and UI inline assets
}));
app.use(cors());
app.use(express.json());

// Serve static Web Dashboard UI from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Global Rate Limiter for security
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per 15 minutes
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

// System Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'Link Shortener API', db_host: process.env.DB_HOST || 'db.orfa.dev' });
});

// Explicit root route for Web Dashboard UI with Shlink-Style Domain Isolation Security
app.get('/', (req: Request, res: Response) => {
  const rawHost = req.get('host') || req.headers.host || req.hostname || 'localhost';
  const cleanHost = rawHost.split(':')[0].toLowerCase();
  const systemDomain = (process.env.SYSTEM_DOMAIN || 'short.orfa.dev').toLowerCase();
  const configuredAdminDomains = (process.env.ADMIN_DOMAINS || 'localhost,127.0.0.1,short.orfa.dev,db.orfa.dev').toLowerCase().split(',');

  // Check if accessing via authorized Admin / Dashboard domain
  const isAdminDomain = configuredAdminDomains.some(d => cleanHost === d.trim() || cleanHost.includes(d.trim()) || cleanHost === systemDomain);

  if (isAdminDomain) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    // Shlink Privacy & Security Model: Custom shortener domains entered empty do NOT expose the admin portal
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>404 - Bulunamadı</title>
        <style>
          body { font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; margin: 0; background: #0b0f19; color: #64748b; text-align: center; }
          h1 { font-size: 3.5rem; margin-bottom: 0.5rem; color: #334155; }
          p { color: #64748b; font-size: 1.1rem; }
        </style>
      </head>
      <body>
        <div>
          <h1>404</h1>
          <p>İstenen sayfa veya bağlantı bulunamadı.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Short Link Wildcard Redirect Service Router (Catch-all for custom domains and short URLs)
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
            a { color: #6366f1; text-decoration: underline; margin-top: 1rem; display: inline-block; font-weight: 600; }
          </style>
        </head>
        <body>
          <div>
            <h1>404</h1>
            <p>Erişmeye çalıştığınız kısa bağlantı bulunamadı veya süresi doldu.</p>
            <a href="/">Ana Sayfaya Dön</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Perform HTTP 301 or 302 redirect
    res.redirect(redirectResult.redirectType, redirectResult.destinationUrl);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).send('Internal Server Error processing redirect');
  }
});

// Fallback 404 handler for unmatched routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;
