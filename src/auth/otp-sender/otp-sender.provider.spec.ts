import { resolveOtpVerificationProvider } from './otp-sender.provider';

describe('resolveOtpVerificationProvider', () => {
  it('returns resend sender when provider is resend', () => {
    const consoleSender = { startVerification: jest.fn(), checkVerification: jest.fn() };
    const resendSender = { startVerification: jest.fn(), checkVerification: jest.fn() };

    const sender = resolveOtpVerificationProvider(
      { otpProvider: 'resend' } as any,
      consoleSender as any,
      resendSender as any,
    );

    expect(sender).toBe(resendSender);
  });

  it('returns console sender when provider is console', () => {
    const consoleSender = { startVerification: jest.fn(), checkVerification: jest.fn() };
    const resendSender = { startVerification: jest.fn(), checkVerification: jest.fn() };

    const sender = resolveOtpVerificationProvider(
      { otpProvider: 'console' } as any,
      consoleSender as any,
      resendSender as any,
    );

    expect(sender).toBe(consoleSender);
  });
});
