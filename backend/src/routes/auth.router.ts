/**
 * Auth Router — /api/auth/*
 *
 * Covers: signup, login (with optional 2FA), logout, refresh-token rotation,
 * forgot-password (OTP), reset-password, change-password, /me,
 * and all 2FA (TOTP) management endpoints.
 *
 * Every mutating route is protected by the `validate()` Zod middleware so
 * malformed input is rejected before any business logic runs.
 */

import { Router, Request, Response } from 'express';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateRefreshToken,
  hashToken,
  generateTokenFamily,
  generateOtp,
  hashOtp,
} from '../lib/auth';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  SignupSchema,
  LoginSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  RefreshTokenSchema,
  TotpEnableSchema,
  TotpDisableSchema,
} from '../schemas/auth.schemas';
import { sendPasswordResetEmail } from '../lib/email';
import {
  generateTotpSecret,
  generateQrCodeDataUrl,
  verifyTotpToken,
  generateBackupCodes,
  verifyBackupCode,
} from '../lib/totp';
import db from '../lib/db';
import { redisCache } from '../lib/redis';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

async function issueRefreshToken(userId: string, family?: string): Promise<string> {
  const raw = generateRefreshToken();
  const hashed = hashToken(raw);
  const tokenFamily = family ?? generateTokenFamily();

  await db.refreshToken.create({
    data: {
      userId,
      token: hashed,
      family: tokenFamily,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 86400 * 1000),
    },
  });

  return raw;
}

// ─── Signup ───────────────────────────────────────────────────────────────────

router.post('/signup', validate(SignupSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, fullName } = req.body;
    const emailLower = email.toLowerCase().trim();

    const existingUser = await db.user.findUnique({ where: { email: emailLower } });
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email address already exists.' });
    }

    const hashedPassword = hashPassword(password);
    const user = await db.user.create({
      data: {
        email: emailLower,
        passwordHash: hashedPassword,
        profile: {
          create: {
            fullName,
            careerGoal: '',
            currentSkills: [],
            availableTime: 45,
            difficulty: 'Intermediate',
          },
        },
      },
      include: { profile: true },
    });

    const token = generateToken({ id: user.id, email: user.email });
    const refreshToken = await issueRefreshToken(user.id);

    return res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || fullName,
      },
    });
  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({ error: 'Internal Server Error during registration.' });
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────

router.post('/login', validate(LoginSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, totpToken } = req.body;
    const emailLower = email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email: emailLower },
      include: {
        profile: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ── 2FA check ──
    if (user.twoFactorSecret?.enabled) {
      if (!totpToken) {
        // Signal to frontend that 2FA is required
        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          message: 'Please enter your 2FA code.',
        });
      }

      const secret = user.twoFactorSecret.secret;
      const isValidTotp = verifyTotpToken(String(totpToken), secret);

      if (!isValidTotp) {
        // Try backup code
        const matchIdx = verifyBackupCode(
          String(totpToken),
          user.twoFactorSecret.backupCodes,
        );
        if (matchIdx === -1) {
          return res.status(401).json({ error: 'Invalid 2FA code or backup code.' });
        }

        // Consume the backup code (remove from list)
        const remaining = [...user.twoFactorSecret.backupCodes];
        remaining.splice(matchIdx, 1);
        await db.twoFactorSecret.update({
          where: { userId: user.id },
          data: { backupCodes: remaining },
        });
      }
    }

    const token = generateToken({ id: user.id, email: user.email });
    const refreshToken = await issueRefreshToken(user.id);

    return res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || 'Student',
        twoFactorEnabled: user.twoFactorSecret?.enabled ?? false,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Internal Server Error during login.' });
  }
});

// ─── Refresh token rotation ───────────────────────────────────────────────────

router.post('/refresh', validate(RefreshTokenSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body;
    const hashed = hashToken(refreshToken);

    const storedToken = await db.refreshToken.findUnique({
      where: { token: hashed },
      include: { user: true },
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    // Token already revoked — reuse attack: revoke the entire family
    if (storedToken.revokedAt) {
      await db.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revokedAt: new Date() },
      });
      return res.status(401).json({ error: 'Refresh token reuse detected. Please log in again.' });
    }

    if (storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token has expired. Please log in again.' });
    }

    // Rotate: revoke old, issue new in same family
    await db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const { user } = storedToken;
    const newAccessToken = generateToken({ id: user.id, email: user.email });
    const newRefreshToken = await issueRefreshToken(user.id, storedToken.family);

    return res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal Server Error during token refresh.' });
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.post('/logout', validate(RefreshTokenSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body;
    const hashed = hashToken(refreshToken);

    await db.refreshToken.updateMany({
      where: { token: hashed, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal Server Error during logout.' });
  }
});

// ─── Forgot password (OTP) ────────────────────────────────────────────────────

router.post('/forgot-password', validate(ForgotPasswordSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    const emailLower = email.toLowerCase().trim();

    // Always respond 200 to prevent email enumeration
    const user = await db.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists for this email, an OTP has been sent.',
      });
    }

    // Invalidate any existing unused tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    await sendPasswordResetEmail(emailLower, otp);

    return res.json({
      success: true,
      message: 'If an account exists for this email, an OTP has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal Server Error during password reset request.' });
  }
});

// ─── Reset password ───────────────────────────────────────────────────────────

router.post('/reset-password', validate(ResetPasswordSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, otp, newPassword } = req.body;
    const emailLower = email.toLowerCase().trim();

    const user = await db.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid OTP or email.' });
    }

    const otpHash = hashOtp(otp);

    const resetToken = await db.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        otpHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'OTP is invalid or has expired.' });
    }

    // Mark token used and update password atomically
    await db.$transaction([
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(newPassword) },
      }),
      // Revoke all refresh tokens on password change (security hygiene)
      db.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return res.json({ success: true, message: 'Password updated successfully. Please log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal Server Error during password reset.' });
  }
});

// ─── Change password (authenticated) ─────────────────────────────────────────

router.post(
  '/change-password',
  authenticate,
  validate(ChangePasswordSchema),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req as AuthenticatedRequest).user?.id;

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const isMatch = verifyPassword(currentPassword, user.passwordHash);
      if (!isMatch) return res.status(400).json({ error: 'Incorrect current password.' });

      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: { passwordHash: hashPassword(newPassword) },
        }),
        // Revoke all refresh tokens (force re-login on other devices)
        db.refreshToken.updateMany({
          where: { userId: userId!, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);

      return res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
      console.error('Change Password Error:', error);
      return res.status(500).json({ error: 'Internal Server Error updating password.' });
    }
  },
);

// ─── Get current user (/me) ──────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { profile: true, twoFactorSecret: { select: { enabled: true } } },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Retrieve active roadmap (optimized via Redis)
    let activeRoadmap = null;
    try {
      const cachedRoadmapId = await redisCache.getCache(`active_roadmap:${userId}`);
      if (cachedRoadmapId) {
        activeRoadmap = await db.roadmap.findUnique({
          where: { id: cachedRoadmapId },
          include: { days: { include: { topics: true } } },
        });
      }
      if (!activeRoadmap) {
        activeRoadmap = await db.roadmap.findFirst({
          where: { userId },
          include: { days: { include: { topics: true } } },
          orderBy: { createdAt: 'desc' },
        });
        if (activeRoadmap) {
          await redisCache.setCache(`active_roadmap:${userId}`, activeRoadmap.id, 2592000);
        }
      }
    } catch (cacheErr) {
      console.warn('Redis active roadmap fetch warning:', cacheErr);
    }

    const resolvedProfile = user.profile
      ? {
          fullName: user.profile.fullName || 'Student',
          careerGoal: user.profile.careerGoal || activeRoadmap?.title || 'Learning',
          currentSkills: user.profile.currentSkills || [],
          availableTime: user.profile.availableTime || 60,
          difficulty: user.profile.difficulty || 'Intermediate',
        }
      : activeRoadmap
      ? {
          fullName: user.email.split('@')[0],
          careerGoal: activeRoadmap.title,
          currentSkills: [],
          availableTime: 60,
          difficulty: 'Intermediate',
        }
      : null;

    const [completedProgress, userBadges] = await Promise.all([
      db.progress.findMany({ where: { userId }, distinct: ['dayId'], select: { dayId: true } }),
      db.badge.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    ]);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || user.email.split('@')[0],
        profile: resolvedProfile,
        activeRoadmap,
        completedDayIds: completedProgress.map((p) => p.dayId),
        badges: userBadges,
        twoFactorEnabled: user.twoFactorSecret?.enabled ?? false,
        xp: user.xp,
        streakCount: user.streakCount,
      },
    });
  } catch (error) {
    console.error('Fetch Current User Error:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// ─── 2FA — Setup ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/2fa/setup
 * Generates a new TOTP secret and returns QR code + backup codes.
 * The secret is persisted as disabled until /enable is called.
 */
router.post('/2fa/setup', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const secret = generateTotpSecret();
    const qrCodeDataUrl = await generateQrCodeDataUrl(user.email, secret);
    const { plain: backupCodesPlain, hashed: backupCodesHashed } = generateBackupCodes();

    // Upsert (allow re-setup if not yet enabled)
    await db.twoFactorSecret.upsert({
      where: { userId },
      create: {
        userId,
        secret,
        backupCodes: backupCodesHashed,
        enabled: false,
      },
      update: {
        secret,
        backupCodes: backupCodesHashed,
        enabled: false,
        verifiedAt: null,
      },
    });

    return res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      backupCodes: backupCodesPlain, // Only shown once — user must save these
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ error: 'Failed to set up 2FA.' });
  }
});

// ─── 2FA — Enable ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/2fa/enable
 * Activates 2FA by verifying the user scanned the QR code correctly.
 */
router.post('/2fa/enable', authenticate, validate(TotpEnableSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { token } = req.body;

    const twoFa = await db.twoFactorSecret.findUnique({ where: { userId } });
    if (!twoFa) {
      return res.status(400).json({ error: 'Please call /2fa/setup first.' });
    }
    if (twoFa.enabled) {
      return res.status(400).json({ error: '2FA is already enabled.' });
    }

    if (!verifyTotpToken(token, twoFa.secret)) {
      return res.status(400).json({ error: 'Invalid TOTP code. Please check your authenticator app.' });
    }

    await db.twoFactorSecret.update({
      where: { userId },
      data: { enabled: true, verifiedAt: new Date() },
    });

    return res.json({ success: true, message: '2FA has been enabled successfully.' });
  } catch (error) {
    console.error('2FA enable error:', error);
    return res.status(500).json({ error: 'Failed to enable 2FA.' });
  }
});

// ─── 2FA — Disable ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/2fa/disable
 * Disables 2FA after verifying either a valid TOTP or backup code.
 */
router.post('/2fa/disable', authenticate, validate(TotpDisableSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { token } = req.body;

    const twoFa = await db.twoFactorSecret.findUnique({ where: { userId } });
    if (!twoFa || !twoFa.enabled) {
      return res.status(400).json({ error: '2FA is not currently enabled.' });
    }

    const validTotp = verifyTotpToken(token, twoFa.secret);
    const backupIdx = validTotp ? -1 : verifyBackupCode(token, twoFa.backupCodes);

    if (!validTotp && backupIdx === -1) {
      return res.status(400).json({ error: 'Invalid TOTP code or backup code.' });
    }

    await db.twoFactorSecret.delete({ where: { userId } });

    return res.json({ success: true, message: '2FA has been disabled.' });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ error: 'Failed to disable 2FA.' });
  }
});

// ─── 2FA — Verify standalone ─────────────────────────────────────────────────

/**
 * POST /api/auth/2fa/verify
 * Standalone 2FA code check (used by frontend login flow after receiving requiresTwoFactor).
 */
router.post('/2fa/verify', validate(TotpEnableSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { token, email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required.' });

    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { twoFactorSecret: true, profile: true },
    });

    if (!user || !user.twoFactorSecret?.enabled) {
      return res.status(400).json({ error: 'Invalid request.' });
    }

    const isValid = verifyTotpToken(token, user.twoFactorSecret.secret);
    if (!isValid) {
      const backupIdx = verifyBackupCode(token, user.twoFactorSecret.backupCodes);
      if (backupIdx === -1) {
        return res.status(401).json({ error: 'Invalid 2FA code.' });
      }
      // Consume backup code
      const remaining = [...user.twoFactorSecret.backupCodes];
      remaining.splice(backupIdx, 1);
      await db.twoFactorSecret.update({
        where: { userId: user.id },
        data: { backupCodes: remaining },
      });
    }

    const accessToken = generateToken({ id: user.id, email: user.email });
    const refreshToken = await issueRefreshToken(user.id);

    return res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName || 'Student',
        twoFactorEnabled: true,
      },
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    return res.status(500).json({ error: 'Failed to verify 2FA.' });
  }
});

export default router;
