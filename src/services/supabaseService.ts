import dotenv from 'dotenv';
import { User, Domain, ShortLink, ClickEvent, ApiKey } from '../types';

dotenv.config();

const SUPABASE_BASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const SUPABASE_API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function supabaseFetch<T = any>(path: string, options: RequestInit = {}, retries = 2): Promise<T> {
  const url = `${SUPABASE_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'apikey': SUPABASE_API_KEY,
    'Authorization': `Bearer ${SUPABASE_API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Connection': 'close',
    ...(options.headers as Record<string, string> || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errorText = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(errorText); } catch {}
      const msg = parsed?.message || parsed?.error || errorText || `Supabase REST request failed (${res.status})`;
      throw new Error(msg);
    }

    const text = await res.text();
    if (!text || !text.trim() || res.status === 204) {
      return [] as unknown as T;
    }

    return JSON.parse(text) as T;
  } catch (err: any) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 250));
      return supabaseFetch<T>(path, options, retries - 1);
    }
    throw err;
  }
}

export class SupabaseService {
  // --- USERS ---
  static async findUserByEmail(email: string): Promise<User | null> {
    const users = await supabaseFetch<User[]>(`/users?email=eq.${encodeURIComponent(email)}&select=*`);
    return users.length > 0 ? users[0] : null;
  }

  static async findUserById(id: string): Promise<User | null> {
    const users = await supabaseFetch<User[]>(`/users?id=eq.${encodeURIComponent(id)}&select=*`);
    return users.length > 0 ? users[0] : null;
  }

  static async createUser(id: string, email: string, passwordHash: string): Promise<User> {
    const users = await supabaseFetch<User[]>('/users', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        id,
        email,
        password_hash: passwordHash,
        status: 'active',
        created_at: new Date().toISOString()
      })
    });
    return users[0];
  }

  // --- DOMAINS ---
  static async listDomainsByUserId(userId: string): Promise<Domain[]> {
    return await supabaseFetch<Domain[]>(`/domains?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  }

  static async findDomainById(id: string): Promise<Domain | null> {
    const domains = await supabaseFetch<Domain[]>(`/domains?id=eq.${encodeURIComponent(id)}&select=*`);
    return domains.length > 0 ? domains[0] : null;
  }

  static async findDomainByHostname(hostname: string): Promise<Domain | null> {
    const cleanHost = hostname.split(':')[0].toLowerCase();
    const domains = await supabaseFetch<Domain[]>(`/domains?hostname=eq.${encodeURIComponent(cleanHost)}&select=*`);
    return domains.length > 0 ? domains[0] : null;
  }

  static async createDomain(domain: Domain): Promise<Domain> {
    const domains = await supabaseFetch<Domain[]>('/domains', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(domain)
    });
    return domains[0];
  }

  static async updateDomainStatus(id: string, status: string, sslStatus: string): Promise<Domain | null> {
    const updated = await supabaseFetch<Domain[]>(`/domains?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ verification_status: status, ssl_status: sslStatus })
    });
    return updated.length > 0 ? updated[0] : null;
  }

  static async deleteDomain(id: string): Promise<boolean> {
    try {
      // 1. Delete associated click_events for all short links in this domain
      const links = await supabaseFetch<ShortLink[]>(`/short_links?domain_id=eq.${encodeURIComponent(id)}&select=id`);
      for (const l of links) {
        try {
          await supabaseFetch(`/click_events?short_link_id=eq.${encodeURIComponent(l.id)}`, {
            method: 'DELETE'
          });
        } catch {}
      }
      // 2. Delete short links for this domain
      await supabaseFetch(`/short_links?domain_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch {}

    // 3. Delete the domain
    await supabaseFetch(`/domains?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return true;
  }

  // --- SHORT LINKS ---
  static async listLinksByUserId(userId: string): Promise<ShortLink[]> {
    return await supabaseFetch<ShortLink[]>(`/short_links?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  }

  static async findLinkById(id: string): Promise<ShortLink | null> {
    const links = await supabaseFetch<ShortLink[]>(`/short_links?id=eq.${encodeURIComponent(id)}&select=*`);
    return links.length > 0 ? links[0] : null;
  }

  static async findLinkByDomainAndSlug(hostname: string, slug: string): Promise<{ link: ShortLink; domain: Domain } | null> {
    let domain = await this.findDomainByHostname(hostname);
    if (!domain) {
      // Fallback: search for link by slug across all active links
      const links = await supabaseFetch<ShortLink[]>(`/short_links?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*`);
      if (links.length === 0) return null;
      const foundLink = links[0];
      const linkDomain = await this.findDomainById(foundLink.domain_id);
      return {
        link: foundLink,
        domain: linkDomain || {
          id: foundLink.domain_id,
          user_id: foundLink.user_id,
          hostname: hostname,
          verification_token: '',
          verification_status: 'active',
          ssl_status: 'active',
          created_at: foundLink.created_at
        }
      };
    }

    const links = await supabaseFetch<ShortLink[]>(`/short_links?domain_id=eq.${encodeURIComponent(domain.id)}&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*`);
    if (links.length === 0) return null;

    return { link: links[0], domain };
  }

  static async createShortLink(link: ShortLink): Promise<ShortLink> {
    const links = await supabaseFetch<ShortLink[]>('/short_links', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(link)
    });
    return links[0];
  }

  static async deleteShortLink(id: string): Promise<boolean> {
    try {
      // Delete associated click_events first to satisfy FK constraint
      await supabaseFetch(`/click_events?short_link_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch {}

    await supabaseFetch(`/short_links?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return true;
  }

  // --- CLICK EVENTS & ANALYTICS ---
  static async recordClickEvent(event: ClickEvent): Promise<void> {
    const payload: Record<string, any> = {
      id: event.id,
      short_link_id: event.short_link_id,
      user_agent: event.user_agent,
      referrer: event.referrer,
      country: event.country,
      device_type: event.device_type,
      browser: event.browser
    };

    await supabaseFetch('/click_events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  static async getLinkAnalytics(linkId: string): Promise<{ total_clicks: number; devices: any[]; browsers: any[]; referrers: any[] }> {
    const events = await supabaseFetch<ClickEvent[]>(`/click_events?short_link_id=eq.${encodeURIComponent(linkId)}&select=*`);
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

  // --- API KEYS ---
  static async findApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    const keys = await supabaseFetch<ApiKey[]>(`/api_keys?key_hash=eq.${encodeURIComponent(keyHash)}&select=*`);
    return keys.length > 0 ? keys[0] : null;
  }

  static async listApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    return await supabaseFetch<ApiKey[]>(`/api_keys?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  }

  static async createApiKey(apiKey: ApiKey): Promise<ApiKey> {
    const keys = await supabaseFetch<ApiKey[]>('/api_keys', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(apiKey)
    });
    return keys[0];
  }

  static async deleteApiKey(id: string): Promise<boolean> {
    await supabaseFetch(`/api_keys?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return true;
  }
}
