import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AppConfig } from '../config/configuration';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetOtpDto } from './dto/request-password-reset-otp.dto';
import { RequestRegistrationOtpDto } from './dto/request-registration-otp.dto';
import { ResendRegistrationOtpDto } from './dto/resend-registration-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';
import {
  OTP_VERIFICATION_PROVIDER,
  OtpVerificationProvider,
  StartVerificationResult,
} from './otp-sender/otp-sender.interface';
import { AuthStateStore } from './auth-state.store';
import { LogoutDto } from './dto/logout.dto';
import {
  BCRYPT_ROUNDS,
  REFRESH_TTL_FALLBACK_SECONDS,
} from '../common/constants';
import { mapToAppUser } from '../common/mappers/app-user.mapper';

type UserRow = {
  id: number;
  name: string;
  phone: string | null;
  email: string;
  password_hash: string;
  status: 'active' | 'paused' | 'banned';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<{ app: AppConfig }, true>,
    private readonly authStateStore: AuthStateStore,
    @Inject(OTP_VERIFICATION_PROVIDER) private readonly otpVerificationProvider: OtpVerificationProvider,
  ) {}

  async requestRegistrationOtp(dto: RequestRegistrationOtpDto): Promise<Record<string, unknown>> {
    const existingUser = await this.databaseService.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2 LIMIT 1',
      [dto.email, dto.phone],
    );
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      throw new ConflictException('Email or phone already exists');
    }

    const existingPending = await this.databaseService.query<{ email: string; phone: string }>(
      'SELECT email, phone FROM pending_registrations WHERE LOWER(email) = LOWER($1) OR phone = $2 LIMIT 1',
      [dto.email, dto.phone],
    );
    if (existingPending.rowCount && existingPending.rowCount > 0) {
      const row = existingPending.rows[0];
      if (row.email.toLowerCase() !== dto.email.toLowerCase()) {
        throw new ConflictException('Email or phone already exists');
      }
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    try {
      await this.databaseService.query(
        `INSERT INTO pending_registrations (email, phone, name, address, password_hash, expires_at)
         VALUES (LOWER($1), $2, $3, $4, $5, NOW() + ($6::text || ' minutes')::interval)
         ON CONFLICT (email) DO UPDATE
           SET phone         = EXCLUDED.phone,
               name          = EXCLUDED.name,
               address       = EXCLUDED.address,
               password_hash = EXCLUDED.password_hash,
               expires_at    = EXCLUDED.expires_at,
               created_at    = NOW()`,
        [dto.email, dto.phone, dto.name, dto.address ?? null, passwordHash, this.appConfig.otpTtlMinutes],
      );
    } catch {
      throw new ConflictException('Email or phone already exists');
    }

    const verificationResult = await this.otpVerificationProvider.startVerification({
      email: dto.email,
      purpose: 'registration',
      userId: null,
    });
    return this.buildOtpSentResponse(verificationResult);
  }

  async resendRegistrationOtp(dto: ResendRegistrationOtpDto): Promise<Record<string, unknown>> {
    const pending = await this.databaseService.query(
      `SELECT id FROM pending_registrations WHERE LOWER(email) = LOWER($1) AND expires_at > NOW()`,
      [dto.email],
    );
    if (!pending.rowCount) {
      throw new BadRequestException('No pending registration found for this email');
    }

    const verificationResult = await this.otpVerificationProvider.startVerification({
      email: dto.email,
      purpose: 'registration',
      userId: null,
    });
    return this.buildOtpSentResponse(verificationResult);
  }

  async verifyRegistrationOtp(dto: VerifyRegistrationOtpDto): Promise<Record<string, unknown>> {
    await this.otpVerificationProvider.checkVerification({
      email: dto.email,
      code: dto.otp,
      purpose: 'registration',
    });

    return this.databaseService.withTransaction(async (client) => {
      const pendingQuery = await client.query<{ name: string; phone: string; address: string | null; password_hash: string; email: string }>(
        `SELECT name, phone, address, password_hash, email
         FROM pending_registrations
         WHERE LOWER(email) = LOWER($1) AND expires_at > NOW()
         FOR UPDATE`,
        [dto.email],
      );

      if (!pendingQuery.rowCount) {
        throw new BadRequestException('Registration session expired or not found');
      }

      const pending = pendingQuery.rows[0];

      let createdUser!: { id: number; name: string; phone: string | null; email: string; status: string };
      try {
        const insertUser = await client.query<{
          id: number;
          name: string;
          phone: string | null;
          email: string;
          status: string;
        }>(
          `INSERT INTO users (name, phone, email, address, password_hash)
           VALUES ($1, $2, LOWER($3), $4, $5)
           RETURNING id, name, phone, email, status`,
          [pending.name, pending.phone, pending.email, pending.address ?? null, pending.password_hash],
        );
        createdUser = insertUser.rows[0];
      } catch {
        throw new ConflictException('Email or phone already exists');
      }

      await client.query('DELETE FROM pending_registrations WHERE LOWER(email) = LOWER($1)', [dto.email]);

      const tokens = await this.generateTokens(createdUser.id, createdUser.email, false, 0, client);

      return { user: mapToAppUser(createdUser),
        ...tokens,
      };
    });
  }

  async login(dto: LoginDto): Promise<Record<string, unknown>> {
    const query = await this.databaseService.query<UserRow & { is_admin: boolean; token_version: number }>(
      'SELECT id, name, phone, email, password_hash, status, is_admin, token_version FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
      [dto.email],
    );

    if (!query.rowCount) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = query.rows[0];

    if (user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.is_admin, user.token_version);
    return { user: mapToAppUser(user),
      ...tokens,
    };
  }

  async requestPasswordResetOtp(dto: RequestPasswordResetOtpDto): Promise<Record<string, unknown>> {
    const userQuery = await this.databaseService.query<{ id: number }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
      [dto.email],
    );

    if (!userQuery.rowCount) {
      return { message: 'If this email is registered, an OTP has been sent' };
    }

    const verificationResult = await this.otpVerificationProvider.startVerification({
      email: dto.email,
      purpose: 'password_reset',
      userId: userQuery.rows[0].id,
    });
    return this.buildOtpSentResponse(verificationResult);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<Record<string, unknown>> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    await this.otpVerificationProvider.checkVerification({
      email: dto.email,
      code: dto.otp,
      purpose: 'password_reset',
    });

    return this.databaseService.withTransaction(async (client) => {
      const account = await client.query<{ id: number; email: string; status: UserRow['status']; is_admin: boolean; token_version: number }>(
        'SELECT id, email, status, is_admin, token_version FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
        [dto.email],
      );

      if (!account.rowCount) {
        throw new BadRequestException('User not found');
      }

      const user = account.rows[0];
      if (user.status !== 'active') {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS);
      const updatedUser = await client.query<{ id: number; email: string }>(
        `UPDATE users
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, email`,
        [passwordHash, user.id],
      );

      if (!updatedUser.rowCount) {
        throw new BadRequestException('User not found');
      }

      const tokens = await this.generateTokens(
        updatedUser.rows[0].id,
        updatedUser.rows[0].email,
        user.is_admin,
        user.token_version,
        client,
      );
      return { message: 'Password reset successfully',
        ...tokens,
      };
    });
  }

  async refresh(dto: RefreshTokenDto): Promise<Record<string, unknown>> {
    let payload: { sub: number; email: string; isAdmin: boolean; tokenVersion: number; jti: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.appConfig.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) throw new UnauthorizedException('Invalid refresh token');
    const storedUserId = await this.authStateStore.consumeRefreshTokenJti(payload.jti);
    if (!storedUserId || storedUserId !== payload.sub) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.databaseService.query<{ id: number; email: string; status: UserRow['status']; is_admin: boolean; token_version: number }>(
      'SELECT id, email, status, is_admin, token_version FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [payload.sub],
    );

    if (!user.rowCount || user.rows[0].status !== 'active' || user.rows[0].token_version !== payload.tokenVersion) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(
      user.rows[0].id,
      user.rows[0].email,
      user.rows[0].is_admin,
      user.rows[0].token_version,
    );
    return { ...tokens };
  }

  async logout(dto: LogoutDto): Promise<Record<string, unknown>> {
    try {
      const payload: { jti?: string } = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.appConfig.jwtRefreshSecret,
      });
      if (payload.jti) {
        await this.authStateStore.revokeRefreshTokenJti(payload.jti);
      }
    } catch {
      // Token invalid or already expired — treat as successfully logged out
    }
    return {};
  }

  private get appConfig(): AppConfig {
    return this.configService.get('app', { infer: true });
  }

  private buildOtpSentResponse(result: StartVerificationResult): Record<string, unknown> {
    return { message: 'OTP sent',
      ...(result.otp ? { otp: result.otp } : {}),
    };
  }

  private parseTtlSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return REFRESH_TTL_FALLBACK_SECONDS;
    const val = parseInt(match[1], 10);
    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return val * units[match[2]];
  }

  private async generateTokens(
    userId: number,
    email: string,
    isAdmin: boolean,
    tokenVersion: number,
    queryRunner?: PoolClient,
  ): Promise<Record<string, string>> {
    const jti = randomBytes(16).toString('hex');
    const basePayload = { sub: userId, email, isAdmin, tokenVersion };
    const refreshPayload = { ...basePayload, jti };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(basePayload, {
        secret: this.appConfig.jwtAccessSecret,
        expiresIn: this.appConfig.jwtAccessTtl as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.appConfig.jwtRefreshSecret,
        expiresIn: this.appConfig.jwtRefreshTtl as any,
      }),
    ]);

    const ttlSeconds = this.parseTtlSeconds(this.appConfig.jwtRefreshTtl);
    await this.authStateStore.saveRefreshTokenJti(jti, userId, ttlSeconds, queryRunner);

    return {
      accessToken,
      refreshToken,
    };
  }
}
