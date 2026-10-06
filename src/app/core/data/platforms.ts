import { Platform, PlatformKey } from './models';

/**
 * Name and icon of the platform the dashboard posts to (the API still sends the key, always `fb`).
 * Only Facebook groups and pages are supported for now; the other social platforms are a later phase.
 */
export const PLATFORMS: Record<PlatformKey, Platform> = {
  fb: { name: 'Facebook', icon: 'ph-facebook-logo' },
};

/** The icon of a link by what it points to: a Facebook group or a Facebook page (Phosphor classes). */
export const LINK_KIND_ICONS = {
  group: 'ph-users-three',
  page: 'ph-flag',
} as const;
