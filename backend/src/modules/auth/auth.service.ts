import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, query } from "../../db/mysql.js";
import { ensureReferralSchemaExists } from "../mlm/schema.service.js";
import { grantWelcomeBonusIfNeeded } from "../mlm/commission.service.js";
import { createReferralProfileForNewCustomer, type RegisterReferralInput } from "../referral/referral.service.js";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  role: "user" | "admin";
  is_active: number;
  created_at: string;
  updated_at: string;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

function slugToJwtRole(slug: string): "user" | "admin" {
  return slug === "admin" ? "admin" : "user";
}

async function getCustomerRoleId(): Promise<number | null> {
  const rows = await query<{ id: number }[]>(
    `SELECT id FROM roles WHERE slug = ? LIMIT 1`,
    ["customer"]
  );
  return rows[0]?.id ?? null;
}

async function rowFromDb(id: number): Promise<UserRow | null> {
  const rows = await query<
    Array<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
      phone: string | null;
      role_slug: string;
      is_active: number;
      created_at: Date | string;
      updated_at: Date | string;
    }>
  >(
    `SELECT u.id, u.name, u.email, u.password_hash, u.phone, u.is_active, u.created_at, u.updated_at,
            r.slug AS role_slug
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    password_hash: r.password_hash,
    phone: r.phone,
    role: slugToJwtRole(r.role_slug),
    is_active: r.is_active,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  };
}

/** Schema is provisioned by existing migrations / `initDB`; nothing to create here for Vivan. */
export async function initAuthTables() {
  /* no-op */
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<
    Array<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
      phone: string | null;
      role_slug: string;
      is_active: number;
      created_at: Date | string;
      updated_at: Date | string;
    }>
  >(
    `SELECT u.id, u.name, u.email, u.password_hash, u.phone, u.is_active, u.created_at, u.updated_at,
            r.slug AS role_slug
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE LOWER(TRIM(u.email)) = ?
     LIMIT 1`,
    [email.toLowerCase().trim()]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    password_hash: r.password_hash,
    phone: r.phone,
    role: slugToJwtRole(r.role_slug),
    is_active: r.is_active,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  };
}

export async function findUserById(id: number): Promise<UserRow | null> {
  return rowFromDb(id);
}

export function signAccessToken(user: Pick<UserRow, "id" | "name" | "email" | "role">) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing");
  }

  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    jwtSecret,
    {
      expiresIn: "7d"
    }
  );
}

export async function registerUser(input: RegisterInput) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new Error("Email already registered");
  }

  const customerRoleId = await getCustomerRoleId();
  if (!customerRoleId) {
    throw new Error("Roles not seeded (missing customer role)");
  }

  await ensureReferralSchemaExists();

  const passwordHash = await bcrypt.hash(input.password, 10);

  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [ins]: any = await c.query(
      `INSERT INTO users (role_id, email, password_hash, name, phone, is_active, accepted_terms)
       VALUES (?, ?, ?, ?, ?, 1, 1)`,
      [
        customerRoleId,
        input.email.toLowerCase().trim(),
        passwordHash,
        input.name.trim(),
        input.phone?.trim() || null
      ]
    );
    const userId = Number(ins.insertId);

    const referralInput: RegisterReferralInput = {};
    await createReferralProfileForNewCustomer(c, userId, referralInput);
    await grantWelcomeBonusIfNeeded(c, userId);

    await c.commit();

    const user = await findUserById(userId);
    if (!user) {
      throw new Error("Failed to create user");
    }

    const token = signAccessToken(user);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function loginUser(input: LoginInput) {
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.is_active) {
    throw new Error("User account is inactive");
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = signAccessToken(user);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    }
  };
}
