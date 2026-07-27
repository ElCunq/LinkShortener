import request from 'supertest';
import app from '../src/app';
import { RedirectService } from '../src/services/redirectService';
import { SecurityService } from '../src/services/securityService';
import { DataService } from '../src/services/dataService';

describe('Link Shortener API & Service Test Suite', () => {
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let domainId: string;
  let linkId: string;
  let apiKey: string;
  const testHost = `go_${Date.now()}.orfa.dev`;

  let testEmail: string;
  const testPassword = 'Password123!';

  beforeAll(() => {
    testEmail = `test_${Date.now()}_${Math.floor(Math.random()*1000)}@orfa.dev`;
    DataService.clearMockData();
    RedirectService.clearCache();
  });

  describe('1. Security Service Unit Tests', () => {
    test('Validates legitimate HTTP and HTTPS URLs', () => {
      expect(SecurityService.validateDestinationUrl('https://example.com/long/path').valid).toBe(true);
      expect(SecurityService.validateDestinationUrl('http://github.com/repo').valid).toBe(true);
    });

    test('Blocks forbidden schemes and SSRF targets', () => {
      expect(SecurityService.validateDestinationUrl('javascript:alert(1)').valid).toBe(false);
      expect(SecurityService.validateDestinationUrl('data:text/html,test').valid).toBe(false);
      expect(SecurityService.validateDestinationUrl('http://localhost:8080').valid).toBe(false);
      expect(SecurityService.validateDestinationUrl('http://127.0.0.1/admin').valid).toBe(false);
      expect(SecurityService.validateDestinationUrl('http://192.168.1.1/router').valid).toBe(false);
    });

    test('Generates valid random verification tokens and slugs', () => {
      const token = SecurityService.generateVerificationToken();
      expect(token).toContain('shortlink-verification=');
      const slug = SecurityService.generateRandomSlug(6);
      expect(slug).toHaveLength(6);
    });

    test('Generates live API key format and hashes correctly', () => {
      const { apiKey: key, keyHash } = SecurityService.generateApiKey();
      expect(key.startsWith('sl_live_')).toBe(true);
      expect(SecurityService.hashApiKey(key)).toEqual(keyHash);
    });
  });

  describe('2. Auth Endpoints', () => {
    test('POST /api/v1/auth/register - registers new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.tokens).toHaveProperty('access_token');
      expect(res.body.tokens).toHaveProperty('refresh_token');

      userId = res.body.user.id;
      accessToken = res.body.tokens.access_token;
      refreshToken = res.body.tokens.refresh_token;
    });

    test('POST /api/v1/auth/register - rejects duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(409);
    });

    test('POST /api/v1/auth/login - logs in user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveProperty('access_token');
    });

    test('POST /api/v1/auth/refresh - refreshes access token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveProperty('access_token');
    });
  });

  describe('3. API Key Management', () => {
    test('POST /api/v1/api-keys - generates new live API key', async () => {
      const res = await request(app)
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'CI/CD Pipeline Key', expires_in_days: 30 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('api_key');
      expect(res.body.api_key.startsWith('sl_live_')).toBe(true);

      apiKey = res.body.api_key;
    });

    test('GET /api/v1/domains using API Key authentication', async () => {
      const res = await request(app)
        .get('/api/v1/domains')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('4. Domain Management Endpoints', () => {
    test('POST /api/v1/domains - registers custom domain and returns CNAME & TXT records', async () => {
      const res = await request(app)
        .post('/api/v1/domains')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ hostname: testHost });

      expect(res.status).toBe(201);
      expect(res.body.hostname).toBe(testHost);
      expect(res.body.status).toBe('pending');
      expect(res.body.dns_records).toHaveLength(2);
      expect(res.body.dns_records[0].type).toBe('CNAME');
      expect(res.body.dns_records[1].type).toBe('TXT');

      domainId = res.body.id;
    });

    test('GET /api/v1/domains - lists user domains', async () => {
      const res = await request(app)
        .get('/api/v1/domains')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].hostname).toBe(testHost);
    });
  });

  describe('5. Short Link Management Endpoints', () => {
    test('POST /api/v1/links - creates a short link with custom slug github', async () => {
      const res = await request(app)
        .post('/api/v1/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          domain_id: domainId,
          destination_url: 'https://github.com/torvalds/linux',
          custom_slug: 'github',
          redirect_type: 302
        });

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('github');
      expect(res.body.destination_url).toBe('https://github.com/torvalds/linux');
      expect(res.body.short_url).toContain(`://${testHost}/github`);

      linkId = res.body.id;
    });

    test('POST /api/v1/links - rejects duplicate slug on same domain', async () => {
      const res = await request(app)
        .post('/api/v1/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          domain_id: domainId,
          destination_url: 'https://example.com',
          custom_slug: 'github'
        });

      expect(res.status).toBe(409);
    });

    test('POST /api/v1/links - rejects invalid target URL (e.g. javascript scheme)', async () => {
      const res = await request(app)
        .post('/api/v1/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          domain_id: domainId,
          destination_url: 'javascript:alert("hacked")',
          custom_slug: 'exploit'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('6. Redirect Engine & Click Analytics', () => {
    test('GET /github with Host: go.orfa.dev redirects with 302', async () => {
      const res = await request(app)
        .get('/github')
        .set('Host', testHost)
        .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        .set('Referer', 'https://twitter.com');

      expect(res.status).toBe(302);
      expect(res.header.location).toBe('https://github.com/torvalds/linux');
    });

    test('GET /nonexistent with Host: go.orfa.dev returns 404', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .set('Host', testHost);

      expect(res.status).toBe(404);
    });

    test('GET /api/v1/links/:id/analytics - returns click statistics', async () => {
      // Allow async click logger event loop turn to record event
      await new Promise(r => setTimeout(r, 100));

      const res = await request(app)
        .get(`/api/v1/links/${linkId}/analytics`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.link_id).toBe(linkId);
      expect(res.body.total_clicks).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/v1/links/:id/qrcode - returns QR code data URL', async () => {
      const res = await request(app)
        .get(`/api/v1/links/${linkId}/qrcode`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.link_id).toBe(linkId);
      expect(res.body.qr_code).toContain('data:image/png;base64,');
    });
  });
});
