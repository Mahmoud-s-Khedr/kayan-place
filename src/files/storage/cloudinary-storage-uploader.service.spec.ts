import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { CloudinaryStorageUploaderService } from './cloudinary-storage-uploader.service';

class TestCloudinaryStorageUploaderService extends CloudinaryStorageUploaderService {
  constructor(configService: ConfigService, private readonly nowMs: number) {
    super(configService as any);
  }

  protected now(): number {
    return this.nowMs;
  }
}

describe('CloudinaryStorageUploaderService', () => {
  it('returns signed direct upload intent metadata', async () => {
    const fixedNowMs = Date.UTC(2030, 0, 1, 0, 0, 0);
    const service = new TestCloudinaryStorageUploaderService(
      {
        get: jest.fn().mockReturnValue({
          cloudinaryCloudName: 'demo-cloud',
          cloudinaryApiKey: '123456789012345',
          cloudinaryApiSecret: 'cloud-secret',
        }),
      } as unknown as ConfigService,
      fixedNowMs,
    );

    const result = await service.createUploadIntent({
      objectKey: 'products/1/a.jpg',
      mimeType: 'image/jpeg',
      expiresInSeconds: 120,
    });

    const timestamp = String(Math.floor(fixedNowMs / 1000));
    const expectedSignature = createHash('sha1')
      .update(`public_id=products/1/a.jpg&timestamp=${timestamp}cloud-secret`)
      .digest('hex');

    expect(result).toMatchObject({
      method: 'POST',
      url: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      fields: {
        api_key: '123456789012345',
        public_id: 'products/1/a.jpg',
        timestamp,
        signature: expectedSignature,
      },
    });
    expect(result.expiresAt).toBe(new Date(fixedNowMs + 120_000).toISOString());
  });

  it('uses raw uploads for documents and video uploads for audio', async () => {
    const service = new TestCloudinaryStorageUploaderService(
      {
        get: jest.fn().mockReturnValue({
          cloudinaryCloudName: 'demo-cloud', cloudinaryApiKey: 'key', cloudinaryApiSecret: 'secret',
        }),
      } as unknown as ConfigService,
      Date.UTC(2030, 0, 1),
    );

    await expect(service.createUploadIntent({ objectKey: 'product/1/manual.pdf', mimeType: 'application/pdf', expiresInSeconds: 60 }))
      .resolves.toMatchObject({ url: 'https://api.cloudinary.com/v1_1/demo-cloud/raw/upload' });
    await expect(service.createUploadIntent({ objectKey: 'message/1/note', mimeType: 'audio/mpeg', expiresInSeconds: 60 }))
      .resolves.toMatchObject({ url: 'https://api.cloudinary.com/v1_1/demo-cloud/video/upload' });
  });

  it('verifies the expected asset server-to-server without frontend response fields', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ public_id: 'product/1/manual.pdf', resource_type: 'raw' }),
    } as unknown as Response);
    const service = new TestCloudinaryStorageUploaderService(
      { get: jest.fn().mockReturnValue({ cloudinaryCloudName: 'demo-cloud', cloudinaryApiKey: 'key', cloudinaryApiSecret: 'secret' }) } as unknown as ConfigService,
      Date.UTC(2030, 0, 1),
    );

    await expect(service.verifyUploadedObject({ objectKey: 'product/1/manual.pdf', mimeType: 'application/pdf' })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/demo-cloud/raw/explicit',
      expect.objectContaining({ method: 'POST' }),
    );
    fetchMock.mockRestore();
  });
});
