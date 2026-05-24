export type AuthUser = {
  sub: number;
  phone?: string;
  email?: string;
  isAdmin: boolean;
  tokenVersion?: number;
};
