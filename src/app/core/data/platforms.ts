import { Platform, PlatformKey } from './models';

/**
 * Name and icon of each platform the dashboard knows (the design's values; the API only sends the key).
 * Only Facebook posts through the extension today, the others are sample accounts.
 */
export const PLATFORMS: Record<PlatformKey, Platform> = {
  fb: { name: 'Facebook', icon: 'ph-facebook-logo' },
  x: { name: 'X', icon: 'ph-x-logo' },
  ig: { name: 'Instagram', icon: 'ph-instagram-logo' },
  tt: { name: 'TikTok', icon: 'ph-tiktok-logo' },
  line: { name: 'LINE OA', icon: 'ph-chat-circle-dots' },
  th: { name: 'Threads', icon: 'ph-threads-logo' },
};
