import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-insecure-secret-change-me";
const TOKEN_TTL = "7d";

export interface AppTokenPayload {
  userId: string;
}

/** Issues a short-lived app session JWT wrapping `{ userId }`. */
export function issueToken(payload: AppTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Verifies and decodes an app session JWT. Throws if invalid/expired. */
export function verifyToken(token: string): AppTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === "string" || !("userId" in decoded)) {
    throw new Error("Malformed token payload");
  }
  return { userId: (decoded as jwt.JwtPayload & AppTokenPayload).userId };
}
