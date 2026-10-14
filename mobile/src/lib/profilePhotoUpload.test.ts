import { profilePhotoPreviewUri, readProfilePhotoBytes } from './profilePhotoUpload';

/** Minimal valid JPEG header + padding (tests assertReadableImageBytes). */
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

describe('profilePhotoUpload', () => {
  it('uses a data URI for preview when base64 is present', () => {
    expect(profilePhotoPreviewUri({ uri: 'file:///x', width: 1, height: 1, base64: 'abc' })).toBe(
      'data:image/jpeg;base64,abc'
    );
  });

  it('reads bytes from picker base64', async () => {
    const bytes = await readProfilePhotoBytes({
      uri: 'content://ignored',
      width: 1,
      height: 1,
      base64: TINY_JPEG_B64,
    });
    expect(bytes.length).toBeGreaterThan(128);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });
});
