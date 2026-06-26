import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const databaseService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const appConfig = {
    jwtAccessSecret: 'access',
    jwtRefreshSecret: 'refresh',
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '30d',
    storageSigningSecret: 'secret',
    otpSigningSecret: 'otp-secret',
    otpProvider: 'console' as const,
    otpDevMode: true,
    otpTtlMinutes: 10,
    adminEmails: [],
  };

  const configService = {
    get: jest.fn().mockImplementation(() => appConfig),
  } as unknown as ConfigService;

  const authStateStore = {
    saveRefreshTokenJti: jest.fn().mockResolvedValue(undefined),
    consumeRefreshTokenJti: jest.fn().mockResolvedValue(1),
    revokeRefreshTokenJti: jest.fn().mockResolvedValue(undefined),
  };

  const otpVerificationProvider = {
    startVerification: jest.fn(),
    checkVerification: jest.fn(),
  };

  const service = new AuthService(
    databaseService as any,
    jwtService,
    configService as any,
    authStateStore as any,
    otpVerificationProvider as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('rejects duplicate email/phone on registration OTP request', async () => {
    databaseService.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });

    await expect(
      service.requestRegistrationOtp({
        name: 'User',
        email: 'user@example.com',
        phone: '+201000000001',
        password: 'abc12345',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects duplicate phone on registration OTP request', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ email: 'another@example.com', phone: '+201000000001' }] });

    await expect(
      service.requestRegistrationOtp({
        name: 'User',
        email: 'user@example.com',
        phone: '+201000000001',
        password: 'abc12345',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects login for non-active users', async () => {
    databaseService.query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          id: 1,
          email: 'user@example.com',
          password_hash: '$2b$12$UOnNZ9OeWkCpW0fQ8LQXbu0Y8i2JYtrrSIRB2x00D1B5wYAkqM8Fi',
          status: 'banned',
          token_version: 0,
        },
      ],
    });

    await expect(service.login({ email: 'user@example.com', password: 'abc12345' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects password reset token issuance for non-active users', async () => {
    otpVerificationProvider.checkVerification.mockResolvedValue({});

    const client = {
      query: jest.fn().mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, email: 'user@example.com', status: 'banned', token_version: 0 }],
      }),
    };
    databaseService.withTransaction.mockImplementation((callback: any) => callback(client));

    await expect(
      service.resetPassword({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'abc12345',
        confirmPassword: 'abc12345',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns OTP in response when verification provider provides one', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 77 }] });
    otpVerificationProvider.startVerification.mockResolvedValue({ otp: '123456' });

    const response = await service.requestRegistrationOtp({
      name: 'User',
      email: 'user@example.com',
      phone: '+201000000001',
      password: 'abc12345',
    });

    expect(otpVerificationProvider.startVerification).toHaveBeenCalledWith({
      email: 'user@example.com',
      purpose: 'registration',
      userId: null,
    });
    expect(response).toMatchObject({ message: 'OTP sent', otp: '123456' });
  });

  it('hides otp in response when verification provider does not return one', async () => {
    databaseService.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });
    otpVerificationProvider.startVerification.mockResolvedValue({});

    const response = await service.requestPasswordResetOtp({ email: 'user@example.com' });

    expect(response).toMatchObject({ message: 'OTP sent' });
    expect(response).not.toHaveProperty('otp');
  });

  it('calls otp verification before registration completion', async () => {
    otpVerificationProvider.checkVerification.mockResolvedValue({});

    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ name: 'User', phone: '+201000000001', password_hash: 'hash', email: 'user@example.com' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 11, name: 'User', phone: '+201000000001', email: 'user@example.com', status: 'active' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
    };
    databaseService.withTransaction.mockImplementation((callback: any) => callback(client));
    jwtService.signAsync = jest.fn().mockResolvedValueOnce('access').mockResolvedValueOnce('refresh') as any;

    const response = await service.verifyRegistrationOtp({ email: 'user@example.com', otp: '123456' });

    expect(otpVerificationProvider.checkVerification).toHaveBeenCalledWith({
      email: 'user@example.com',
      code: '123456',
      purpose: 'registration',
    });
    expect(response).toMatchObject({ user: { id: 11, email: 'user@example.com' } });
  });

  it('throws UnauthorizedException when refresh token has no jti', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 1,
      email: 'user@example.com',
      isAdmin: false,
      tokenVersion: 0,
    });

    await expect(service.refresh({ refreshToken: 'no-jti-token' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects resetPassword when confirmPassword does not match', async () => {
    await expect(
      service.resetPassword({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'abc12345',
        confirmPassword: 'different1',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
