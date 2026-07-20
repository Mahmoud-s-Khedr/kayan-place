import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AppConfig } from '../../config/configuration';
import { resolveCloudinaryResourceType } from '../cloudinary-resource-type';
import { StorageUploader, UploadIntent } from './storage-uploader.interface';

@Injectable()
export class CloudinaryStorageUploaderService implements StorageUploader {
  constructor(private readonly configService: ConfigService<{ app: AppConfig }, true>) {}

  async createUploadIntent(params: {
    objectKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadIntent> {
    const appConfig = this.configService.get('app', { infer: true });
    const expiresInSeconds = Math.max(1, params.expiresInSeconds);
    const timestampSeconds = Math.floor(this.now() / 1000);
    const timestamp = String(timestampSeconds);
    const signedParams = {
      public_id: params.objectKey,
      timestamp,
    };
    const signature = this.signParams(signedParams, appConfig.cloudinaryApiSecret);

    return {
      method: 'POST',
      url: `https://api.cloudinary.com/v1_1/${appConfig.cloudinaryCloudName}/${resolveCloudinaryResourceType(params.mimeType)}/upload`,
      fields: {
        api_key: appConfig.cloudinaryApiKey,
        public_id: params.objectKey,
        timestamp,
        signature,
      },
      expiresAt: new Date((timestampSeconds + expiresInSeconds) * 1000).toISOString(),
    };
  }

  async verifyUploadedObject(params: { objectKey: string; mimeType: string }): Promise<boolean> {
    const appConfig = this.configService.get('app', { infer: true });
    const timestamp = String(Math.floor(this.now() / 1000));
    const signedParams = {
      public_id: params.objectKey,
      timestamp,
      type: 'upload',
    };
    const body = new URLSearchParams({
      ...signedParams,
      api_key: appConfig.cloudinaryApiKey,
      signature: this.signParams(signedParams, appConfig.cloudinaryApiSecret),
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${appConfig.cloudinaryCloudName}/${resolveCloudinaryResourceType(params.mimeType)}/explicit`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
      );
    } catch {
      throw new ServiceUnavailableException('Storage verification is unavailable');
    }

    if (response.status === 404) return false;
    if (!response.ok) throw new ServiceUnavailableException('Storage verification failed');

    const asset = await response.json() as { public_id?: string; resource_type?: string };
    return asset.public_id === params.objectKey
      && asset.resource_type === resolveCloudinaryResourceType(params.mimeType);
  }

  protected now(): number {
    return Date.now();
  }

  protected signParams(params: Record<string, string>, apiSecret: string): string {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }
}
