import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type PublicImageScope = 'campus' | 'student' | 'marketplace';

const PREFIXES: Record<PublicImageScope, readonly string[]> = {
  campus: ['student-photos', 'marketplace-images', 'lost-found'],
  student: ['student-photos'],
  marketplace: ['marketplace-images'],
};

export function assertPublicImageKey(
  key: string,
  scope: PublicImageScope,
): void {
  if (typeof key !== 'string' || !key) {
    throw new BadRequestException('Image storage key is required.');
  }
  if (key === 'defaults/student-placeholder.png') return;

  // Accept canonical generated image keys only. Do not decode or normalize paths:
  // private namespaces, traversal, encoded separators and URL keys must fail closed.
  const segments = key.split('/');
  if (
    segments.length < 2 ||
    !PREFIXES[scope].includes(segments[0]) ||
    segments.some((segment) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment)) ||
    !/\.(?:png|jpe?g|webp|gif)$/i.test(key)
  ) {
    throw new ForbiddenException(
      'This object is not available through public image routes.',
    );
  }
}

export function isPublicImageContentType(contentType: string): boolean {
  return [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ].includes(contentType.toLowerCase().split(';')[0].trim());
}
