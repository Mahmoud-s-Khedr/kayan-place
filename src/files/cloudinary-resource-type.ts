export type CloudinaryResourceType = 'image' | 'video' | 'raw';

/** Keep Cloudinary upload and delivery resource types in sync. */
export function resolveCloudinaryResourceType(mimeType: string): CloudinaryResourceType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'video';
  return 'raw';
}

export function cloudinaryPublicIdIncludesExtension(mimeType: string): boolean {
  return resolveCloudinaryResourceType(mimeType) === 'raw';
}
