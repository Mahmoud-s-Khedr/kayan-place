import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { ConsoleOtpSender } from './console-otp.sender';
import {
  CheckVerificationPayload,
  CheckVerificationResult,
  OtpVerificationProvider,
  StartVerificationPayload,
  StartVerificationResult,
} from './otp-sender.interface';

@Injectable()
export class ResendOtpSender implements OtpVerificationProvider {
  constructor(
    private readonly configService: ConfigService<{ app: AppConfig }, true>,
    private readonly consoleOtpSender: ConsoleOtpSender,
  ) {}

  async startVerification(payload: StartVerificationPayload): Promise<StartVerificationResult> {
    const result = await this.consoleOtpSender.startVerification(payload);
    const otp = result.otp;

    if (!otp) {
      throw new ServiceUnavailableException('OTP is unavailable for email delivery');
    }

    const appConfig = this.configService.get('app', { infer: true });
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appConfig.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: appConfig.resendFromEmail,
        to: [payload.email],
        subject: appConfig.resendOtpSubject,
        text: `Your verification code is: ${otp}. It expires in ${appConfig.otpTtlMinutes} minutes.`,
      }),
    });

    if (!response.ok) {
      const body = await this.safeRead(response);
      throw new ServiceUnavailableException(`Failed to send OTP email: ${body ?? response.statusText}`);
    }

    return result;
  }

  async checkVerification(payload: CheckVerificationPayload): Promise<CheckVerificationResult> {
    return this.consoleOtpSender.checkVerification(payload);
  }

  private async safeRead(response: Response): Promise<string | null> {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
}
