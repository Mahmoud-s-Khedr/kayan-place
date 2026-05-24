import { ServiceUnavailableException } from '@nestjs/common';
import { ResendOtpSender } from './resend-otp.sender';

describe('ResendOtpSender', () => {
  const configService = {
    get: jest.fn().mockReturnValue({
      resendApiKey: 'key',
      resendFromEmail: 'no-reply@example.com',
      resendOtpSubject: 'Code',
      otpTtlMinutes: 10,
    }),
  };

  const consoleOtpSender = {
    startVerification: jest.fn().mockResolvedValue({ otp: '123456' }),
    checkVerification: jest.fn().mockResolvedValue({ localOtpId: 1 }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('sends OTP through resend', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true } as Response);

    const sender = new ResendOtpSender(configService as any, consoleOtpSender as any);
    const result = await sender.startVerification({ email: 'user@example.com', purpose: 'registration', userId: null });

    expect(result).toEqual({ otp: '123456' });
  });

  it('throws when resend API fails', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: false, statusText: 'bad', text: async () => 'bad' } as Response);

    const sender = new ResendOtpSender(configService as any, consoleOtpSender as any);

    await expect(
      sender.startVerification({ email: 'user@example.com', purpose: 'registration', userId: null }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
