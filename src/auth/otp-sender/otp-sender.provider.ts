import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { ConsoleOtpSender } from './console-otp.sender';
import { OTP_VERIFICATION_PROVIDER, OtpVerificationProvider } from './otp-sender.interface';
import { ResendOtpSender } from './resend-otp.sender';

export function resolveOtpVerificationProvider(
  appConfig: AppConfig,
  consoleOtpSender: OtpVerificationProvider,
  resendOtpSender: OtpVerificationProvider,
): OtpVerificationProvider {
  return appConfig.otpProvider === 'resend' ? resendOtpSender : consoleOtpSender;
}

export const otpVerificationProvider: Provider = {
  provide: OTP_VERIFICATION_PROVIDER,
  inject: [ConfigService, ConsoleOtpSender, ResendOtpSender],
  useFactory: (
    configService: ConfigService<{ app: AppConfig }, true>,
    consoleOtpSender: ConsoleOtpSender,
    resendOtpSender: ResendOtpSender,
  ) => {
    const appConfig = configService.get('app', { infer: true });
    return resolveOtpVerificationProvider(appConfig, consoleOtpSender, resendOtpSender);
  },
};
