export type SharedCorsOptions = {
  origin: true | string[];
  credentials: boolean;
};

export function buildSharedCorsOptions(corsOrigins: string[]): SharedCorsOptions | null {
  if (corsOrigins.length === 0) {
    return null;
  }

  if (corsOrigins.includes('*')) {
    return {
      origin: true,
      credentials: false,
    };
  }

  return {
    origin: corsOrigins,
    credentials: true,
  };
}
