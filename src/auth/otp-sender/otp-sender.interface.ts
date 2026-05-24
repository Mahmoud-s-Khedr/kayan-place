export type OtpPurpose = 'registration' | 'password_reset';

export type StartVerificationPayload = {
  email: string;
  purpose: OtpPurpose;
  userId: number | null;
};

export type StartVerificationResult = {
  otp?: string;
};

export type CheckVerificationPayload = {
  email: string;
  code: string;
  purpose: OtpPurpose;
};

export type CheckVerificationResult = {
  localOtpId?: number;
};

export interface OtpVerificationProvider {
  startVerification(payload: StartVerificationPayload): Promise<StartVerificationResult>;
  checkVerification(payload: CheckVerificationPayload): Promise<CheckVerificationResult>;
}

export const OTP_VERIFICATION_PROVIDER = Symbol('OTP_VERIFICATION_PROVIDER');
