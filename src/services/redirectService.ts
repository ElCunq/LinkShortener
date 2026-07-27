import { DataService } from './dataService';
import { ShortLink } from '../types';
import { SecurityService } from './securityService';

export interface CacheEntry {
  destinationUrl: string;
  redirectType: number;
  linkId: string;
  expiresAt?: Date | null;
}

export class RedirectService {
  // Ultra-fast in-memory cache for short link lookups
  private static cache: Map<string, CacheEntry> = new Map();

  /**
   * Generates key format: redirect:<hostname>:<slug>
   */
  private static getCacheKey(hostname: string, slug: string): string {
    return `redirect:${hostname.toLowerCase()}:${slug}`;
  }

  /**
   * Resolves target redirect for a request given Host header and URL slug.
   */
  static async resolveRedirect(
    hostname: string,
    slug: string,
    reqMeta: { userAgent?: string; referrer?: string; clientIp?: string }
  ): Promise<{ destinationUrl: string; redirectType: number; linkId: string } | null> {
    const cleanHost = hostname.split(':')[0].toLowerCase();
    const cacheKey = this.getCacheKey(cleanHost, slug);

    let cached = this.cache.get(cacheKey);

    if (!cached) {
      const result = await DataService.findLinkByDomainAndSlug(cleanHost, slug);

      if (!result || !result.link.is_active) {
        return null;
      }

      const link = result.link;

      // Check if expired
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return null;
      }

      cached = {
        destinationUrl: link.destination_url,
        redirectType: link.redirect_type || 302,
        linkId: link.id,
        expiresAt: link.expires_at ? new Date(link.expires_at) : null
      };

      // Set cache
      this.cache.set(cacheKey, cached);
    } else {
      // Check expiration if present in cache
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
        this.cache.delete(cacheKey);
        return null;
      }
    }

    const currentCached = cached;

    // Record click event asynchronously (non-blocking so redirect response is lightning fast)
    setImmediate(async () => {
      try {
        const { browser, device } = SecurityService.parseUserAgent(reqMeta.userAgent);
        const ipHash = reqMeta.clientIp ? SecurityService.hashIpAddress(reqMeta.clientIp) : '';

        await DataService.recordClickEvent({
          short_link_id: currentCached.linkId,
          browser,
          device_type: device,
          referrer: reqMeta.referrer || 'direct',
          ip_address: ipHash
        });
      } catch (err) {
        console.error('Failed to log click event asynchronously:', err);
      }
    });

    return {
      destinationUrl: currentCached.destinationUrl,
      redirectType: currentCached.redirectType,
      linkId: currentCached.linkId
    };
  }

  /**
   * Clears cache entry when a link is modified or deleted
   */
  static invalidateCache(hostname: string, slug: string): void {
    const cacheKey = this.getCacheKey(hostname, slug);
    this.cache.delete(cacheKey);
  }

  /**
   * Clears entire redirect cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
