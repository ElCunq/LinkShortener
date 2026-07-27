import crypto from 'crypto';
import { URL } from 'url';

export class SecurityService {
  /**
   * Validates target URL against SSRF and open redirect vulnerabilities.
   * Only http:// and https:// URLs targeting valid public hosts are allowed.
   */
  static validateDestinationUrl(destinationUrl: string): { valid: boolean; reason?: string } {
    if (!destinationUrl) {
      return { valid: false, reason: 'Destination URL is required' };
    }

    let parsed: URL;
    try {
      parsed = new URL(destinationUrl);
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Only HTTP and HTTPS URLs are permitted' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost, loopback, private IPv4/v6 ranges
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    ) {
      return { valid: false, reason: 'Destinations on local or internal networks are forbidden' };
    }

    return { valid: true };
  }

  /**
   * Generates a random verification token for domain ownership (TXT record verification)
   */
  static generateVerificationToken(): string {
    return 'shortlink-verification=' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generates a random slug for short links (e.g. "aB32x")
   */
  static generateRandomSlug(length: number = 6): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Generates a secure live API key format (e.g. sl_live_...) and its SHA-256 hash.
   */
  static generateApiKey(): { apiKey: string; keyHash: string } {
    const rawKey = 'sl_live_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return { apiKey: rawKey, keyHash };
  }

  /**
   * Hashes raw API key for database query lookup
   */
  static hashApiKey(rawApiKey: string): string {
    return crypto.createHash('sha256').update(rawApiKey).digest('hex');
  }

  /**
   * Anonymizes IP address for GDPR compliance
   */
  static hashIpAddress(ip: string): string {
    return crypto.createHash('sha256').update(ip + '_salt_shortlink').digest('hex');
  }

  /**
   * Simple user agent parser for device analytics
   */
  static parseUserAgent(ua: string | undefined): { browser: string; os: string; device: string } {
    if (!ua) {
      return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
    }

    let device = 'Desktop';
    if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
      device = 'Mobile';
    } else if (/tablet|ipad/i.test(ua)) {
      device = 'Tablet';
    }

    let browser = 'Other';
    if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/edg/i.test(ua)) browser = 'Edge';

    let os = 'Other';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

    return { browser, os, device };
  }
}
