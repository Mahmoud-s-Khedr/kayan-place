import { FileReadUrlService } from './file-read-url.service';

describe('FileReadUrlService', () => {
  const service = new FileReadUrlService({
    get: jest.fn().mockReturnValue({ cloudinaryCloudName: 'demo-cloud' }),
  } as any);

  it('keeps document extensions for raw Cloudinary URLs', () => {
    const url = service.buildReadUrl('product/9/1700000000-manual.pdf', 'application/pdf');

    expect(url).toBe('https://res.cloudinary.com/demo-cloud/raw/upload/product/9/1700000000-manual.pdf');
  });

  it('appends a document extension when the object key does not already contain it', () => {
    const url = service.buildReadUrl('product/9/1700000000-manual', 'application/pdf');

    expect(url).toBe('https://res.cloudinary.com/demo-cloud/raw/upload/product/9/1700000000-manual.pdf');
  });

  it('uses the video delivery type for audio files', () => {
    expect(service.buildReadUrl('message/9/voice-note', 'audio/mpeg'))
      .toBe('https://res.cloudinary.com/demo-cloud/video/upload/message/9/voice-note.mp3');
  });
});
