import { Platform, PostPlatform } from './models';

/**
 * Name and icon of what the dashboard posts to: Facebook groups and pages, and LINE Official Account customer chats
 * (the key is what the API sends on a post and on an account). The landing page lists Facebook only.
 */
export const PLATFORMS: Record<PostPlatform, Platform> = {
  fb: { name: 'Facebook', icon: 'ph-facebook-logo' },
  line: { name: 'LINE OA', icon: 'ph-chat-circle-text' },
};

/** The icon of a link by what it points to: a Facebook group, a Facebook page or a LINE customer chat (Phosphor classes). */
export const LINK_KIND_ICONS = {
  group: 'ph-users-three',
  page: 'ph-flag',
  chat: 'ph-chat-circle-text',
} as const;
