import QRCode from 'qrcode';

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  // Check for explicitly set base URL first
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // Render provides this automatically
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  
  // Vercel provides this
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Default to localhost for development
  return 'http://localhost:3000';
}

/**
 * Generate the access URL for a card
 */
export function generateAccessUrl(cardId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/access/${encodeURIComponent(cardId)}`;
}

/**
 * Generate a QR code as a data URL (base64 PNG)
 */
export async function generateQRCodeDataUrl(cardId: string): Promise<string> {
  const accessUrl = generateAccessUrl(cardId);
  
  const dataUrl = await QRCode.toDataURL(accessUrl, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 2,
    color: {
      dark: '#f97316',
      light: '#ffffff',
    },
  });
  
  return dataUrl;
}

/**
 * Generate a QR code as a Buffer (PNG image)
 */
export async function generateQRCodeBuffer(cardId: string): Promise<Buffer> {
  const accessUrl = generateAccessUrl(cardId);
  
  const buffer = await QRCode.toBuffer(accessUrl, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 300,
    margin: 2,
    color: {
      dark: '#f97316',
      light: '#ffffff',
    },
  });
  
  return buffer;
}

/**
 * Generate a QR code as an SVG string
 */
export async function generateQRCodeSvg(cardId: string): Promise<string> {
  const accessUrl = generateAccessUrl(cardId);
  
  const svg = await QRCode.toString(accessUrl, {
    errorCorrectionLevel: 'M',
    type: 'svg',
    width: 300,
    margin: 2,
    color: {
      dark: '#f97316',
      light: '#ffffff',
    },
  });
  
  return svg;
}

/**
 * Extract card ID from an access URL
 */
export function extractCardIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const accessIndex = pathParts.indexOf('access');
    
    if (accessIndex !== -1 && pathParts.length > accessIndex + 1) {
      return decodeURIComponent(pathParts[accessIndex + 1]);
    }
    
    return null;
  } catch {
    return null;
  }
}
