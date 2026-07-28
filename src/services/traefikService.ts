import fs from 'fs';
import path from 'path';

const DYNAMIC_PATH = process.env.TRAEFIK_DYNAMIC_PATH || '/etc/traefik/dynamic';

export class TraefikService {
  /**
   * Generates a dynamic Traefik YAML router file for custom domain SSL termination in Coolify
   */
  static syncDomain(hostname: string): boolean {
    try {
      if (!fs.existsSync(DYNAMIC_PATH)) {
        fs.mkdirSync(DYNAMIC_PATH, { recursive: true });
      }

      const cleanHost = hostname.trim().toLowerCase();
      const safeName = cleanHost.replace(/[^a-z0-9]/g, '_');
      const filePath = path.join(DYNAMIC_PATH, `domain_${safeName}.yml`);

      const yamlContent = `http:
  routers:
    shortener_${safeName}:
      rule: "Host(\`${cleanHost}\`)"
      service: "link-shortener-engine-3000@docker"
      tls:
        certResolver: "letsencrypt"
`;

      fs.writeFileSync(filePath, yamlContent, 'utf8');
      console.log(`[TraefikService] Dynamic router sync for ${cleanHost} at ${filePath}`);
      return true;
    } catch (err) {
      // Non-fatal if directory is not mounted or writable
      return false;
    }
  }

  /**
   * Removes dynamic Traefik YAML router file when domain is deleted
   */
  static removeDomain(hostname: string): boolean {
    try {
      const cleanHost = hostname.trim().toLowerCase();
      const safeName = cleanHost.replace(/[^a-z0-9]/g, '_');
      const filePath = path.join(DYNAMIC_PATH, `domain_${safeName}.yml`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[TraefikService] Dynamic router removed for ${cleanHost}`);
      }
      return true;
    } catch (err) {
      return false;
    }
  }
}
