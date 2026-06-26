import { PoolClient } from 'pg';

export const ADMIN_PHONE_REGEX = /^\+?[1-9]\d{7,15}$/;
export const ADMIN_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const ADMIN_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AdminSeedInput = {
  email: string;
  phone: string | null;
  password: string;
};

export function parseAdminSeedInput(env: NodeJS.ProcessEnv): AdminSeedInput {
  const phone = (env.ADMIN_PHONE ?? '').trim();
  const email = (env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? '';

  if (!email) {
    throw new Error('ADMIN_EMAIL is required');
  }
  if (!ADMIN_EMAIL_REGEX.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }
  if (phone && !ADMIN_PHONE_REGEX.test(phone)) {
    throw new Error('ADMIN_PHONE must be a valid E.164-like phone number');
  }
  if (!password) {
    throw new Error('ADMIN_PASSWORD is required');
  }
  if (password.length < 8 || password.length > 64) {
    throw new Error('ADMIN_PASSWORD must be between 8 and 64 characters');
  }
  if (!ADMIN_PASSWORD_REGEX.test(password)) {
    throw new Error('ADMIN_PASSWORD must contain letters and numbers');
  }

  return { email, phone: phone || null, password };
}

export async function seedAdminUser(
  client: Pick<PoolClient, 'query'>,
  input: Pick<AdminSeedInput, 'email' | 'phone'>,
  passwordHash: string,
) : Promise<{ id: number; email: string; phone: string | null; created: boolean }> {
  const { email, phone } = input;
  const existing = await client.query<{ id: number; email: string | null; phone: string | null }>(
    `SELECT id, email, phone
     FROM users
     WHERE LOWER(email) = LOWER($1) OR ($2::text IS NOT NULL AND phone = $2)
     ORDER BY id ASC
     LIMIT 2`,
    [email, phone],
  );

  if ((existing.rowCount ?? 0) > 1) {
    throw new Error('Seed conflict: multiple users matched ADMIN_EMAIL/ADMIN_PHONE');
  }

  if (!existing.rowCount && phone) {
    const phoneOwner = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE phone = $1 AND (email IS NULL OR LOWER(email) <> LOWER($2)) LIMIT 1`,
      [phone, email],
    );
    if (phoneOwner.rowCount) {
      throw new Error('Seed conflict: ADMIN_PHONE belongs to another user');
    }
  }

  let created = false;
  let targetId: number;
  if (!existing.rowCount) {
    created = true;
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO users (name, phone, email, password_hash, status, is_admin)
       VALUES ($1, $2, LOWER($3), $4, 'active', true)
       RETURNING id`,
      ['Primary Admin', phone, email, passwordHash],
    );
    if (!inserted.rowCount) {
      throw new Error('Failed to create admin user');
    }
    targetId = inserted.rows[0].id;
  } else {
    targetId = existing.rows[0].id;
  }

  const updated = await client.query<{ id: number; email: string; phone: string | null }>(
    `UPDATE users
     SET password_hash = $1,
         status = 'active',
         is_admin = true,
         email = LOWER($2),
         phone = COALESCE($3, phone),
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, email, phone`,
    [passwordHash, email, phone, targetId],
  );

  if (!updated.rowCount) {
    throw new Error('Failed to seed admin user');
  }

  return {
    id: updated.rows[0].id,
    email: updated.rows[0].email,
    phone: updated.rows[0].phone,
    created,
  };
}
