import type { components } from '../../../core/http/api-schema';

// DTOs come from the generated OpenAPI types (npm run gen:api), so they follow the backend.
type Schemas = components['schemas'];

export type PostStatus = 'Draft' | 'Scheduled' | 'Published' | 'Failed';

export type Post = Omit<Schemas['PostDto'], 'status'> & { status: PostStatus };
export type CreatePostRequest = Schemas['CreatePostCommand'];
export type UpdatePostRequest = Schemas['UpdatePostRequest'];

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  Draft: 'ฉบับร่าง',
  Scheduled: 'ตั้งเวลาแล้ว',
  Published: 'เผยแพร่แล้ว',
  Failed: 'ไม่สำเร็จ',
};
