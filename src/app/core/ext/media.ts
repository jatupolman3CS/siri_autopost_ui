import type { MediaRecord } from './lib/shared.js';

// File handling of the extension's settings page (client/dashboard.js processImage), so media
// added on the web is stored exactly like media added in the extension.

/** The extension stores videos up to this size. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Photos over 2.5 MB are scaled to 2048 px JPEG (Facebook resizes anyway); videos are kept as they are.
 * Throws for a video over 200 MB or a file that is neither an image nor a video.
 */
export async function processMedia(file: File): Promise<MediaRecord> {
  let type = file.type || 'image/jpeg';
  let name = file.name || 'image.jpg';
  if (type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error('video-too-big');
    return { name, type, data: await readAsDataURL(file) };
  }
  if (!type.startsWith('image/')) throw new Error('not-media');
  let data = await readAsDataURL(file);
  if (file.size > 2.5 * 1024 * 1024 && /^image\/(jpeg|png|webp|bmp)$/.test(type)) {
    const img = await loadImage(data);
    const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    data = canvas.toDataURL('image/jpeg', 0.9);
    type = 'image/jpeg';
    name = name.replace(/\.[^.]+$/, '') + '.jpg';
  }
  return { name, type, data };
}

/** A data URL as a Blob (for object URLs of freshly added media). */
export function dataUrlToBlob(data: string): Blob {
  const [head, body] = data.split(',', 2);
  const type = /^data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** 20261003-1542 */
export function fileStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export const safeFileName = (s: string) =>
  String(s || 'campaign')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .slice(0, 40);
