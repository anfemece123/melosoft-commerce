import QRCode from 'qrcode';

/** Generates a printable QR code for `text` as a PNG data URL, fully
 * client-side (no external QR-generation service). */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
