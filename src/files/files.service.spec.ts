import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';

describe('FilesService', () => {
  it('creates upload intent using storage uploader', async () => {
    const databaseService = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 44 }] }),
    };

    const configService = {
      get: jest.fn().mockReturnValue({
        storageProvider: 'cloudinary',
        storageBucket: 'market-media',
        storageUploadTtlSeconds: 600,
      }),
    } as unknown as ConfigService;

    const storageUploader = {
      createUploadIntent: jest.fn().mockResolvedValue({
        method: 'POST',
        url: 'https://api.cloudinary.com/v1_1/demo-cloud/auto/upload',
        fields: {
          api_key: '123456789012345',
          timestamp: '1893456000',
          public_id: 'product/9/example',
          signature: 'abc123',
        },
        expiresAt: '2030-01-01T00:00:00.000Z',
      }),
      verifyUploadedObject: jest.fn(),
    };
    const fileReadUrlService = {
      buildReadUrl: jest.fn(),
    };

    const service = new FilesService(
      databaseService as any,
      configService as any,
      fileReadUrlService as any,
      storageUploader as any,
    );

    const result = await service.createUploadIntent(
      { sub: 7, phone: '+201000000007', isAdmin: false },
      {
        ownerType: 'product',
        ownerId: 9,
        purpose: 'product_image',
        filename: 'phone.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1000,
      },
    );

    expect(storageUploader.createUploadIntent).toHaveBeenCalledWith({
      objectKey: expect.stringMatching(/^product\/9\/.+-phone$/),
      mimeType: 'image/jpeg',
      expiresInSeconds: 600,
    });
    expect(databaseService.query).toHaveBeenCalledTimes(1);
    const insertParams = (databaseService.query as jest.Mock).mock.calls[0][1];
    expect(insertParams[4]).toBe('cloudinary');
    expect(insertParams[5]).toBeNull();

    expect(result).toMatchObject({
      file: {
        id: 44,
        objectKey: expect.stringMatching(/^product\/9\/.+-phone$/),
        status: 'pending',
      },
      upload: {
        method: 'POST',
        url: 'https://api.cloudinary.com/v1_1/demo-cloud/auto/upload',
        fields: {
          api_key: '123456789012345',
          timestamp: '1893456000',
          public_id: 'product/9/example',
          signature: 'abc123',
        },
        expiresAt: '2030-01-01T00:00:00.000Z',
      },
    });
  });

  it('confirms an uploaded file after backend storage verification without changing the client payload', async () => {
    const databaseService = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 44, uploader_user_id: 7, object_key: 'product/9/manual.pdf', mime_type: 'application/pdf', status: 'pending' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
    };
    const storageUploader = { createUploadIntent: jest.fn(), verifyUploadedObject: jest.fn().mockResolvedValue(true) };
    const service = new FilesService(databaseService as any, {} as any, { buildReadUrl: jest.fn() } as any, storageUploader as any);

    await expect(service.markUploaded(
      { sub: 7, phone: '+201000000007', isAdmin: false }, 44,
      {},
    )).resolves.toMatchObject({ file: { id: 44, status: 'uploaded' } });
    expect(storageUploader.verifyUploadedObject).toHaveBeenCalledWith({ objectKey: 'product/9/manual.pdf', mimeType: 'application/pdf' });
  });

  it('leaves the file pending when storage does not contain it', async () => {
    const databaseService = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 44, uploader_user_id: 7, object_key: 'product/9/manual.pdf', mime_type: 'application/pdf', status: 'pending' }] }),
    };
    const storageUploader = { createUploadIntent: jest.fn(), verifyUploadedObject: jest.fn().mockResolvedValue(false) };
    const service = new FilesService(databaseService as any, {} as any, { buildReadUrl: jest.fn() } as any, storageUploader as any);

    await expect(service.markUploaded(
      { sub: 7, phone: '+201000000007', isAdmin: false }, 44,
      {},
    )).rejects.toThrow('File has not been uploaded to storage');
    expect(databaseService.query).toHaveBeenCalledTimes(1);
  });
});
