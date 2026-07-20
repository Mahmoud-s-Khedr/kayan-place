import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { resolveCloudinaryResourceType } from './cloudinary-resource-type';

@Injectable()
export class FileReadUrlService {
  constructor(
    private readonly configService: ConfigService<{ app: AppConfig }, true>,
  ) {}

  buildReadUrl(objectKey: string, mimeType: string): string {
    const resourceType = resolveCloudinaryResourceType(mimeType);
    const format = this.resolveFormat(mimeType);
    const publicIdWithOptionalFormat = resourceType === 'raw'
      ? this.appendFormatIfMissing(objectKey, format)
      : (format ? `${objectKey}.${format}` : objectKey);

    const cloudName = this.configService.get('app', { infer: true }).cloudinaryCloudName;
    return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicIdWithOptionalFormat}`;
  }

  private resolveFormat(mimeType: string): string | null {
    if (!mimeType) {
      return null;
    }

    const subtype = mimeType.split('/')[1]?.split('+')[0]?.toLowerCase();
    if (!subtype) return null;
    if (subtype === 'jpeg') return 'jpg';
    if (subtype === 'mpeg') return 'mp3';
    if (subtype === 'plain') return 'txt';
    if (subtype === 'msword') return 'doc';
    if (subtype === 'vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (subtype === 'vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
    if (subtype === 'vnd.ms-excel') return 'xls';
    if (subtype === 'vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
    if (subtype === 'vnd.ms-powerpoint') return 'ppt';

    return subtype;
  }

  private appendFormatIfMissing(objectKey: string, format: string | null): string {
    if (!format) {
      return objectKey;
    }

    return objectKey.toLowerCase().endsWith(`.${format}`) ? objectKey : `${objectKey}.${format}`;
  }
}
