/**
 * Email service — Nodemailer SMTP transport.
 *
 * Configure via environment variables:
 *   SMTP_HOST     e.g. localhost (Mailpit) or smtp.sendgrid.net
 *   SMTP_PORT     e.g. 1025 (Mailpit) or 587
 *   SMTP_USER     (leave blank for Mailpit)
 *   SMTP_PASS     (leave blank for Mailpit)
 *   EMAIL_FROM    e.g. "EdLearn <no-reply@edlearn.app>"
 *
 * When SMTP_HOST is not set the service logs to console instead of sending
 * (safe dev fallback — no crashes, no silent failures).
 */

import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth:
      process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

const transporter = createTransport();
const FROM = process.env.EMAIL_FROM || 'EdLearn <no-reply@edlearn.app>';

/**
 * Send a password-reset OTP email to a user.
 * @param to  Recipient email address
 * @param otp 6-digit numeric code
 */
export async function sendPasswordResetEmail(to: string, otp: string): Promise<void> {
  const subject = 'Your EdLearn password reset code';
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#6c47ff">EdLearn — Reset Your Password</h2>
      <p>Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:2rem;letter-spacing:.4em;font-weight:700;color:#111;padding:16px 0">${otp}</div>
      <p style="color:#666;font-size:.85rem">If you did not request a password reset, you can safely ignore this email.</p>
    </div>`;

  if (!transporter) {
    console.log(`[Email DEV] Password reset OTP for ${to}: ${otp}`);
    return;
  }

  await transporter.sendMail({ from: FROM, to, subject, html });
}

/**
 * Send a generic OTP email (reusable for other flows).
 */
export async function sendOtpEmail(to: string, otp: string, purpose = 'verification'): Promise<void> {
  const subject = `Your EdLearn ${purpose} code`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#6c47ff">EdLearn — ${purpose.charAt(0).toUpperCase() + purpose.slice(1)}</h2>
      <p>Your one-time code (valid for 10 minutes):</p>
      <div style="font-size:2rem;letter-spacing:.4em;font-weight:700;color:#111;padding:16px 0">${otp}</div>
    </div>`;

  if (!transporter) {
    console.log(`[Email DEV] OTP for ${to} (${purpose}): ${otp}`);
    return;
  }

  await transporter.sendMail({ from: FROM, to, subject, html });
}

/**
 * Send a weekly progress digest email.
 */
export async function sendWeeklyDigestEmail(to: string, data: { name: string, activeStreak: number, topicsCompleted: number, nextTopics: string[] }): Promise<void> {
  const subject = 'Your EdLearn Weekly Progress Report';
  const nextTopicsList = data.nextTopics.length > 0
    ? `<ul>${data.nextTopics.map(t => `<li>${t}</li>`).join('')}</ul>`
    : '<p>You have completed all your active roadmaps! Time to start a new one.</p>';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#333;">
      <h2 style="color:#2563EB;">EdLearn Weekly Digest</h2>
      <p>Hi ${data.name}, here is your learning progress for the week:</p>

      <div style="background:#F8FAFC;padding:16px;border-radius:8px;margin:20px 0;">
        <h3 style="margin-top:0;">Your Stats</h3>
        <p>🔥 <strong>Active Streak:</strong> ${data.activeStreak} days</p>
        <p>📚 <strong>Topics Completed This Week:</strong> ${data.topicsCompleted}</p>
      </div>

      <h3>Up Next</h3>
      ${nextTopicsList}

      <p style="margin-top:30px;font-size:0.85rem;color:#666;">
        Keep up the great work! <br/>
        — The EdLearn Team
      </p>
    </div>`;

  if (!transporter) {
    console.log(`[Email DEV] Weekly Digest for ${to}: Streak ${data.activeStreak}, Topics ${data.topicsCompleted}`);
    return;
  }

  await transporter.sendMail({ from: FROM, to, subject, html });
}
