import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { pool, isDbLive, isSupabaseMode, memoryDb } from '../db/connection';
import { User, Domain, ShortLink, ClickEvent, ApiKey } from '../types';
import { SecurityService } from './securityService';
import { SupabaseService } from './supabaseService';

function seedMockData() {
  const demoUserId = 'usr_demo12345';
  memoryDb.users.set(demoUserId, {
    id: demoUserId,
    email: 'demo@example.com',
    password_hash: bcrypt.hashSync('Password123!', 10),
    status: 'active',
    created_at: new Date()
  });

  const domain1Id = 'dom_go_orfa_dev';
  memoryDb.domains.set(domain1Id, {
    id: domain1Id,
    user_id: demoUserId,
    hostname: 'go.example.com',
    verification_token: 'shortlink-verification=demo_token_123',
    verification_status: 'active',
    ssl_status: 'active',
    created_at: new Date()
  });

  const domain2Id = 'dom_link_company_com';
  memoryDb.domains.set(domain2Id, {
    id: domain2Id,
    user_id: demoUserId,
    hostname: 'link.company.com',
    verification_token: 'shortlink-verification=demo_token_456',
    verification_status: 'active',
    ssl_status: 'active',
    created_at: new Date()
  });

  const link1Id = 'lnk_github';
  memoryDb.shortLinks.set(link1Id, {
    id: link1Id,
    user_id: demoUserId,
    domain_id: domain1Id,
    slug: 'github',
    destination_url: 'https://github.com/torvalds/linux',
    redirect_type: 302,
    is_active: true,
    created_at: new Date()
  });

  const link2Id = 'lnk_twitter';
  memoryDb.shortLinks.set(link2Id, {
    id: link2Id,
    user_id: demoUserId,
    domain_id: domain1Id,
    slug: 'twitter',
    destination_url: 'https://twitter.com/openai',
    redirect_type: 301,
    is_active: true,
    created_at: new Date()
  });

  const link3Id = 'lnk_docs';
  memoryDb.shortLinks.set(link3Id, {
    id: link3Id,
    user_id: demoUserId,
    domain_id: domain2Id,
    slug: 'docs',
    destination_url: 'https://docs.example.com/api',
    redirect_type: 302,
    is_active: true,
    created_at: new Date()
  });

  const demoApiKeyHash = SecurityService.hashApiKey('sl_live_demo1234567890abcdef');
  memoryDb.apiKeys.set('key_demo123', {
    id: 'key_demo123',
    user_id: demoUserId,
    name: 'Production CLI Key',
    key_hash: demoApiKeyHash,
    expires_at: new Date(Date.now() + 90 * 86400000),
    created_at: new Date(Date.now() - 10 * 86400000)
  });
}

export class DataService {
  static clearMockData(): void {
    memoryDb.clear();
  }

  static reseedMockData(): void {
    memoryDb.clear();
    seedMockData();
  }

  // --- USER OPERATIONS ---
  static async createUser(email: string, passwordHash: string): Promise<User> {
    const id = `usr_${uuidv4().substring(0, 8)}`;
    const now = new Date();

    if (isSupabaseMode()) {
      return await SupabaseService.createUser(id, email, passwordHash);
    } else if (isDbLive()) {
      const res = await pool.query(
        `INSERT INTO users (id, email, password_hash, status, created_at)
         VALUES ($1, $2, $3, 'active', $4) RETURNING *`,
        [id, email, passwordHash, now]
      );
      return res.rows[0];
    } else {
      const user: User = { id, email, password_hash: passwordHash, status: 'active', created_at: now };
      memoryDb.users.set(id, user);
      memoryDb.saveToDisk();
      return user;
    }
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    if (isSupabaseMode()) {
      return await SupabaseService.findUserByEmail(email);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
      return res.rows[0] || null;
    } else {
      for (const u of memoryDb.users.values()) {
        if (u.email.toLowerCase() === email.toLowerCase()) return u;
      }
      return null;
    }
  }

  static async findUserById(id: string): Promise<User | null> {
    if (isSupabaseMode()) {
      return await SupabaseService.findUserById(id);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
      return res.rows[0] || null;
    } else {
      return memoryDb.users.get(id) || null;
    }
  }

  // --- DOMAIN OPERATIONS ---
  static async createDomain(userId: string, hostname: string, verificationToken: string): Promise<Domain> {
    const id = `dom_${uuidv4().substring(0, 8)}`;
    const now = new Date();
    const cleanHost = hostname.split(':')[0].toLowerCase();

    const domain: Domain = {
      id,
      user_id: userId,
      hostname: cleanHost,
      verification_token: verificationToken,
      verification_status: 'pending',
      ssl_status: 'pending',
      created_at: now
    };

    if (isSupabaseMode()) {
      return await SupabaseService.createDomain(domain);
    } else if (isDbLive()) {
      const res = await pool.query(
        `INSERT INTO domains (id, user_id, hostname, verification_token, verification_status, ssl_status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', 'pending', $5) RETURNING *`,
        [id, userId, cleanHost, verificationToken, now]
      );
      return res.rows[0];
    } else {
      memoryDb.domains.set(id, domain);
      memoryDb.saveToDisk();
      return domain;
    }
  }

  static async listDomainsByUserId(userId: string): Promise<Domain[]> {
    if (isSupabaseMode()) {
      return await SupabaseService.listDomainsByUserId(userId);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM domains WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
      return res.rows;
    } else {
      return Array.from(memoryDb.domains.values()).filter(d => d.user_id === userId);
    }
  }

  static async findDomainById(id: string): Promise<Domain | null> {
    if (isSupabaseMode()) {
      return await SupabaseService.findDomainById(id);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM domains WHERE id = $1`, [id]);
      return res.rows[0] || null;
    } else {
      return memoryDb.domains.get(id) || null;
    }
  }

  static async findDomainByHostname(hostname: string): Promise<Domain | null> {
    const cleanHost = hostname.split(':')[0].toLowerCase();
    if (isSupabaseMode()) {
      return await SupabaseService.findDomainByHostname(cleanHost);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM domains WHERE hostname = $1`, [cleanHost]);
      return res.rows[0] || null;
    } else {
      for (const d of memoryDb.domains.values()) {
        if (d.hostname.toLowerCase() === cleanHost) return d;
      }
      return null;
    }
  }

  static async updateDomainStatus(id: string, status: 'pending' | 'active' | 'failed', sslStatus: 'pending' | 'active' | 'failed'): Promise<Domain | null> {
    if (isSupabaseMode()) {
      return await SupabaseService.updateDomainStatus(id, status, sslStatus);
    } else if (isDbLive()) {
      const res = await pool.query(
        `UPDATE domains SET verification_status = $1, ssl_status = $2 WHERE id = $3 RETURNING *`,
        [status, sslStatus, id]
      );
      return res.rows[0] || null;
    } else {
      const domain = memoryDb.domains.get(id);
      if (!domain) return null;
      domain.verification_status = status;
      domain.ssl_status = sslStatus;
      memoryDb.saveToDisk();
      return domain;
    }
  }

  static async deleteDomain(id: string): Promise<boolean> {
    if (isSupabaseMode()) {
      return await SupabaseService.deleteDomain(id);
    } else if (isDbLive()) {
      const res = await pool.query(`DELETE FROM domains WHERE id = $1`, [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const deleted = memoryDb.domains.delete(id);
      memoryDb.saveToDisk();
      return deleted;
    }
  }

  // --- SHORT LINK OPERATIONS ---
  static async createShortLink(data: {
    userId: string;
    domainId: string;
    slug: string;
    destinationUrl: string;
    redirectType?: number;
    expiresAt?: Date | null;
    passwordHash?: string | null;
  }): Promise<ShortLink> {
    const id = `lnk_${uuidv4().substring(0, 8)}`;
    const now = new Date();
    const redirectType = data.redirectType || 302;

    const link: ShortLink = {
      id,
      user_id: data.userId,
      domain_id: data.domainId,
      slug: data.slug,
      destination_url: data.destinationUrl,
      redirect_type: redirectType,
      is_active: true,
      expires_at: data.expiresAt || null,
      password_hash: data.passwordHash || null,
      created_at: now
    };

    if (isSupabaseMode()) {
      return await SupabaseService.createShortLink(link);
    } else if (isDbLive()) {
      const res = await pool.query(
        `INSERT INTO short_links (id, user_id, domain_id, slug, destination_url, redirect_type, is_active, expires_at, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9) RETURNING *`,
        [id, data.userId, data.domainId, data.slug, data.destinationUrl, redirectType, data.expiresAt || null, data.passwordHash || null, now]
      );
      return res.rows[0];
    } else {
      memoryDb.shortLinks.set(id, link);
      memoryDb.saveToDisk();
      return link;
    }
  }

  static async findLinkByDomainAndSlug(hostname: string, slug: string): Promise<{ link: ShortLink; domain: Domain } | null> {
    const cleanHost = hostname.split(':')[0].toLowerCase();

    if (isSupabaseMode()) {
      return await SupabaseService.findLinkByDomainAndSlug(cleanHost, slug);
    } else if (isDbLive()) {
      const res = await pool.query(
        `SELECT l.*, d.hostname, d.verification_status, d.ssl_status 
         FROM short_links l
         JOIN domains d ON l.domain_id = d.id
         WHERE d.hostname = $1 AND l.slug = $2 AND l.is_active = TRUE`,
        [cleanHost, slug]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        link: row,
        domain: {
          id: row.domain_id,
          user_id: row.user_id,
          hostname: row.hostname,
          verification_token: '',
          verification_status: row.verification_status,
          ssl_status: row.ssl_status,
          created_at: row.created_at
        }
      };
    } else {
      const domain = await this.findDomainByHostname(cleanHost);
      if (!domain) return null;

      for (const l of memoryDb.shortLinks.values()) {
        if (l.domain_id === domain.id && l.slug === slug && l.is_active) {
          return { link: l, domain };
        }
      }
      return null;
    }
  }

  static async listLinksByUserId(userId: string): Promise<ShortLink[]> {
    if (isSupabaseMode()) {
      return await SupabaseService.listLinksByUserId(userId);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM short_links WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
      return res.rows;
    } else {
      return Array.from(memoryDb.shortLinks.values()).filter(l => l.user_id === userId);
    }
  }

  static async findLinkById(id: string): Promise<ShortLink | null> {
    if (isSupabaseMode()) {
      return await SupabaseService.findLinkById(id);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM short_links WHERE id = $1`, [id]);
      return res.rows[0] || null;
    } else {
      return memoryDb.shortLinks.get(id) || null;
    }
  }

  static async deleteShortLink(id: string): Promise<boolean> {
    if (isSupabaseMode()) {
      return await SupabaseService.deleteShortLink(id);
    } else if (isDbLive()) {
      const res = await pool.query(`DELETE FROM short_links WHERE id = $1`, [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const deleted = memoryDb.shortLinks.delete(id);
      memoryDb.saveToDisk();
      return deleted;
    }
  }

  // --- CLICK EVENTS & ANALYTICS ---
  static async recordClickEvent(event: Omit<ClickEvent, 'id' | 'created_at'>): Promise<void> {
    const id = `clk_${uuidv4().substring(0, 8)}`;
    const now = new Date();

    const fullEvent: ClickEvent = {
      id,
      short_link_id: event.short_link_id,
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      referrer: event.referrer,
      country: event.country,
      device_type: event.device_type,
      browser: event.browser,
      created_at: now
    };

    if (isSupabaseMode()) {
      await SupabaseService.recordClickEvent(fullEvent);
    } else if (isDbLive()) {
      await pool.query(
        `INSERT INTO click_events (id, short_link_id, ip_address, user_agent, referrer, country, device_type, browser, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, event.short_link_id, event.ip_address, event.user_agent, event.referrer, event.country, event.device_type, event.browser, now]
      );
    } else {
      memoryDb.clickEvents.set(id, fullEvent);
      memoryDb.saveToDisk();
    }
  }

  static async getLinkAnalytics(linkId: string): Promise<{ total_clicks: number; devices: any[]; browsers: any[]; referrers: any[] }> {
    if (isSupabaseMode()) {
      return await SupabaseService.getLinkAnalytics(linkId);
    } else if (isDbLive()) {
      const totalRes = await pool.query(`SELECT COUNT(*) FROM click_events WHERE short_link_id = $1`, [linkId]);
      const totalClicks = parseInt(totalRes.rows[0].count, 10);

      const deviceRes = await pool.query(
        `SELECT device_type AS device, COUNT(*) AS count FROM click_events WHERE short_link_id = $1 GROUP BY device_type`,
        [linkId]
      );

      const browserRes = await pool.query(
        `SELECT browser, COUNT(*) AS count FROM click_events WHERE short_link_id = $1 GROUP BY browser`,
        [linkId]
      );

      const referrerRes = await pool.query(
        `SELECT referrer, COUNT(*) AS count FROM click_events WHERE short_link_id = $1 GROUP BY referrer`,
        [linkId]
      );

      return {
        total_clicks: totalClicks,
        devices: deviceRes.rows,
        browsers: deviceRes.rows,
        referrers: referrerRes.rows
      };
    } else {
      const events = Array.from(memoryDb.clickEvents.values()).filter(e => e.short_link_id === linkId);
      const total_clicks = events.length;

      const deviceMap: Record<string, number> = {};
      const browserMap: Record<string, number> = {};
      const referrerMap: Record<string, number> = {};

      events.forEach(e => {
        const dev = e.device_type || 'Desktop';
        const br = e.browser || 'Unknown';
        const ref = e.referrer || 'Direct';
        deviceMap[dev] = (deviceMap[dev] || 0) + 1;
        browserMap[br] = (browserMap[br] || 0) + 1;
        referrerMap[ref] = (referrerMap[ref] || 0) + 1;
      });

      return {
        total_clicks,
        devices: Object.entries(deviceMap).map(([device, count]) => ({ device, count })),
        browsers: Object.entries(browserMap).map(([browser, count]) => ({ browser, count })),
        referrers: Object.entries(referrerMap).map(([referrer, count]) => ({ referrer, count }))
      };
    }
  }

  // --- API KEY OPERATIONS ---
  static async createApiKey(userId: string, name: string, expiresInDays: number = 90): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const id = `key_${uuidv4().substring(0, 8)}`;
    const { apiKey: rawKey, keyHash } = SecurityService.generateApiKey();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 86400000);

    const apiKey: ApiKey = {
      id,
      user_id: userId,
      name,
      key_hash: keyHash,
      expires_at: expiresAt,
      created_at: now
    };

    if (isSupabaseMode()) {
      const created = await SupabaseService.createApiKey(apiKey);
      return { apiKey: created, rawKey };
    } else if (isDbLive()) {
      const res = await pool.query(
        `INSERT INTO api_keys (id, user_id, name, key_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, userId, name, keyHash, expiresAt, now]
      );
      return { apiKey: res.rows[0], rawKey };
    } else {
      memoryDb.apiKeys.set(id, apiKey);
      memoryDb.saveToDisk();
      return { apiKey, rawKey };
    }
  }

  static async findApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    if (isSupabaseMode()) {
      return await SupabaseService.findApiKeyByHash(keyHash);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM api_keys WHERE key_hash = $1`, [keyHash]);
      return res.rows[0] || null;
    } else {
      for (const k of memoryDb.apiKeys.values()) {
        if (k.key_hash === keyHash) return k;
      }
      return null;
    }
  }

  static async listApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    if (isSupabaseMode()) {
      return await SupabaseService.listApiKeysByUserId(userId);
    } else if (isDbLive()) {
      const res = await pool.query(`SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
      return res.rows;
    } else {
      return Array.from(memoryDb.apiKeys.values()).filter(k => k.user_id === userId);
    }
  }

  static async deleteApiKey(id: string): Promise<boolean> {
    if (isSupabaseMode()) {
      return await SupabaseService.deleteApiKey(id);
    } else if (isDbLive()) {
      const res = await pool.query(`DELETE FROM api_keys WHERE id = $1`, [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const deleted = memoryDb.apiKeys.delete(id);
      memoryDb.saveToDisk();
      return deleted;
    }
  }
}
