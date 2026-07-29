import fs from 'fs';
import path from 'path';
import { DataService } from './dataService';

const PRIMARY_CONFIG_PATH = process.env.TRAEFIK_CONFIG_FILE || '/data/coolify/proxy/dynamic/shortlink-domains.yml';
const FALLBACK_CONFIG_PATH = '/dynamic/shortlink-domains.yml';

export class TraefikService {
  /**
   * Syncs all active verified custom domains into Coolify's Traefik dynamic configuration file.
   * Uses atomic write (.tmp -> rename) to prevent Traefik reading partial YAML files.
   */
  static async syncAllDomains(): Promise<boolean> {
    try {
      const allDomains = await DataService.listAllActiveDomains();
      const activeHostnames = Array.from(
        new Set(
          allDomains
            .map(d => d.hostname?.trim()?.toLowerCase())
            .filter((h): h is string => Boolean(h && h.length > 0 && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h)))
        )
      );

      let targetPath = PRIMARY_CONFIG_PATH;
      let targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        try {
          fs.mkdirSync(targetDir, { recursive: true });
        } catch (e) {
          targetPath = FALLBACK_CONFIG_PATH;
          targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
        }
      }

      const tmpPath = `${targetPath}.tmp`;

      // If no active custom domains exist, clear the router rules safely
      if (activeHostnames.length === 0) {
        const emptyYaml = `http:
  routers: {}
  services: {}
`;
        fs.writeFileSync(tmpPath, emptyYaml, 'utf8');
        fs.renameSync(tmpPath, targetPath);
        console.log(`[TraefikService] Reset dynamic YAML (no active domains) at ${targetPath}`);
        return true;
      }

      const hostRules = activeHostnames.map(h => `Host(\`${h}\`)`).join(' || ');
      const targetServiceUrl = process.env.TARGET_URL || 'http://shortener-engine:3000';
      const certResolver = process.env.CERT_RESOLVER || 'letsencrypt';

      const yamlContent = `http:
  routers:
    shortlink-custom-domains:
      rule: "${hostRules}"
      entryPoints:
        - https
      service: shortlink-service
      tls:
        certResolver: "${certResolver}"

    shortlink-custom-domains-http:
      rule: "${hostRules}"
      entryPoints:
        - http
      middlewares:
        - shortlink-https-redirect
      service: shortlink-service

  middlewares:
    shortlink-https-redirect:
      redirectScheme:
        scheme: https
        permanent: true

  services:
    shortlink-service:
      loadBalancer:
        servers:
          - url: "${targetServiceUrl}"
`;

      fs.writeFileSync(tmpPath, yamlContent, 'utf8');
      fs.renameSync(tmpPath, targetPath);

      console.log(`[TraefikService] Atomically synced ${activeHostnames.length} custom domains to ${targetPath}`);
      return true;
    } catch (err: any) {
      console.error('[TraefikService] Failed to sync Traefik dynamic configuration:', err?.message || err);
      return false;
    }
  }

  /**
   * Helper called when a domain is verified or deleted
   */
  static async syncDomain(_hostname?: string): Promise<boolean> {
    return await TraefikService.syncAllDomains();
  }

  static async removeDomain(_hostname?: string): Promise<boolean> {
    return await TraefikService.syncAllDomains();
  }
}
