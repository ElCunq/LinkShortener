import QRCode from 'qrcode';

export class QrService {
  /**
   * Generates a Data URL (PNG Base64 image) for a short URL
   */
  static async generateDataUrl(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        margin: 2,
        width: 300,
        color: {
          dark: '#6366f1', // Indigo accent
          light: '#ffffff'
        }
      });
    } catch (err: any) {
      throw new Error(`Failed to generate QR code Data URL: ${err.message}`);
    }
  }

  /**
   * Generates an SVG string for a short URL
   */
  static async generateSvg(url: string): Promise<string> {
    try {
      return await QRCode.toString(url, {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#6366f1',
          light: '#ffffff'
        }
      });
    } catch (err: any) {
      throw new Error(`Failed to generate QR code SVG: ${err.message}`);
    }
  }
}
