import { z } from 'zod';

// ─── Auth schemas ─────────────────────────────────────────────────────────────

export const SignupSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
  fullName: z
    .string()
    .min(1, 'Full name is required.')
    .max(100, 'Full name is too long.')
    .trim(),
});

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  totpToken: z.string().optional(), // supplied if 2FA is enabled
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters.')
    .max(128, 'New password is too long.'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits.')
    .regex(/^\d{6}$/, 'OTP must contain only digits.'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters.')
    .max(128, 'New password is too long.'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
});

export const TotpVerifySchema = z.object({
  token: z
    .string()
    .length(6, 'TOTP code must be exactly 6 digits.')
    .regex(/^\d{6}$/, 'TOTP code must contain only digits.'),
});

export const TotpEnableSchema = z.object({
  token: z
    .string()
    .length(6, 'TOTP code must be exactly 6 digits.')
    .regex(/^\d{6}$/, 'TOTP code must contain only digits.'),
});

export const TotpDisableSchema = z.object({
  token: z
    .string()
    .min(1, 'TOTP code or backup code is required.'),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type TotpVerifyInput = z.infer<typeof TotpVerifySchema>;
