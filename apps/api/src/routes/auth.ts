import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { toJson } from "../lib/json";
import { issueToken } from "../auth/jwt";
import { requireAuth, AUTH_COOKIE_NAME } from "../middleware/requireAuth";
import { getGoogleAuthUrl, handleGoogleCallback } from "../auth/google";
import { getLarkAuthUrl, handleLarkCallback } from "../auth/lark";

export const authRouter = Router();

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

/**
 * Upserts a local User row for an OAuth profile (matched by email) and the
 * CalendarAccount linking that provider identity to it.
 */
async function linkProviderAccount(params: {
  provider: "google" | "lark";
  providerAccountId: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string[];
}) {
  const email = params.email ?? `${params.provider}-${params.providerAccountId}@no-email.luna`;
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, displayName: params.displayName, avatarUrl: params.avatarUrl },
    update: { displayName: params.displayName, avatarUrl: params.avatarUrl ?? undefined },
  });

  await prisma.calendarAccount.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId: user.id,
        provider: params.provider,
        providerAccountId: params.providerAccountId,
      },
    },
    create: {
      userId: user.id,
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt: params.expiresAt,
      scopeJson: toJson(params.scope),
      targetCalendarId: params.provider === "google" ? "primary" : undefined,
    },
    update: {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? undefined,
      expiresAt: params.expiresAt,
      scopeJson: toJson(params.scope),
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
    },
  });

  return user;
}

authRouter.get("/google/start", (req, res) => {
  res.redirect(getGoogleAuthUrl());
});

authRouter.get("/google/callback", async (req, res) => {
  const code = req.query.code;
  if (typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }
  try {
    const result = await handleGoogleCallback(code);
    const user = await linkProviderAccount({
      provider: "google",
      providerAccountId: result.profile.providerAccountId,
      email: result.profile.email,
      displayName: result.profile.displayName,
      avatarUrl: result.profile.avatarUrl,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scope: result.scope,
    });
    const token = issueToken({ userId: user.id });
    setSessionCookie(res, token);
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    res.status(502).json({ error: "Google authentication failed", detail: String(err) });
  }
});

authRouter.get("/lark/start", (req, res) => {
  res.redirect(getLarkAuthUrl());
});

authRouter.get("/lark/callback", async (req, res) => {
  const code = req.query.code;
  if (typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }
  try {
    const result = await handleLarkCallback(code);
    const user = await linkProviderAccount({
      provider: "lark",
      providerAccountId: result.profile.providerAccountId,
      email: result.profile.email,
      displayName: result.profile.displayName,
      avatarUrl: result.profile.avatarUrl,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scope: result.scope,
    });
    const token = issueToken({ userId: user.id });
    setSessionCookie(res, token);
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    res.status(502).json({ error: "Lark authentication failed", detail: String(err) });
  }
});

const devLoginSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
});

/**
 * Dev-only escape hatch: upserts a local User by email and returns a session
 * JWT, with no real OAuth round-trip. This exists because this sandboxed
 * environment cannot obtain real Google Cloud / Lark Open Platform developer
 * credentials, so it lets the mobile app (and reviewers) exercise the whole
 * app — auth, events, lunar conversion — end-to-end without them. Disabled
 * whenever NODE_ENV === "production".
 */
authRouter.post("/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = devLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, displayName } = parsed.data;
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, displayName },
    update: { displayName },
  });
  const token = issueToken({ userId: user.id });
  setSessionCookie(res, token);
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? undefined,
    timeZone: user.timeZone,
    calendarDisplay: user.calendarDisplay,
  });
});
