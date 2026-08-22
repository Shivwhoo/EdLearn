import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../lib/db';
import { generateToken } from '../lib/auth';

// Only register the Google strategy if all required env vars are present.
// This prevents a hard crash at import time when the server starts without
// Google OAuth configured (e.g. local dev without credentials).
const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL;

if (clientID && clientSecret && callbackURL) {
    try {
        passport.use(
            new GoogleStrategy(
                {
                    clientID,
                    clientSecret,
                    callbackURL,
                },
                async (accessToken, refreshToken, profile, done) => {
                    try {
                        const email = profile.emails?.[0]?.value;
                        if (!email) {
                            return done(new Error('No email found from Google'));
                        }

                        const displayName = profile.displayName || '';
                        const givenName = profile.name?.givenName || '';
                        const fullName = displayName || givenName || 'Google User';

                        console.log('📧 Google Profile - Email:', email);
                        console.log('👤 Google Profile - Name:', fullName);

                        // Find or create user
                        let user = await db.user.findUnique({
                            where: { email },
                            include: { profile: true },
                        });

                        if (!user) {
                            // Create user WITH a profile so fetchCurrentUser works correctly
                            user = await db.user.create({
                                data: {
                                    email: email,
                                    passwordHash: '', // Google users don't have passwords
                                    credits: 15,
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
                            console.log('✅ New Google user created:', user.email);
                        } else {
                            console.log('✅ Existing user found:', user.email);
                        }

                        // Generate JWT token
                        const token = generateToken({ id: user.id, email: user.email });
                        console.log('🔑 Token generated for:', user.email);

                        // Return both user and token
                        return done(null, {
                            user: {
                                id: user.id,
                                email: user.email,
                                fullName: user.profile?.fullName || fullName,
                            },
                            token,
                        });
                    } catch (error: any) {
                        // Distinguish Prisma/DB failures from other exceptions during
                        // user lookup/create. Never logs credentials or connection
                        // strings — only the error class/code, e.g. P1001 (can't reach
                        // DB), P2002 (unique constraint), P2025 (record not found).
                        console.error('❌ Google auth error (user lookup/create):', {
                            name: error?.name,
                            message: error?.message,
                            prismaErrorCode: error?.code,
                        });
                        return done(error as Error);
                    }
                }
            )
        );
        console.log('[Auth] Google OAuth strategy registered successfully');
    } catch (err) {
        console.error('[Auth] Failed to register Google OAuth strategy:', err);
    }
} else {
    console.warn(
        '[Auth] Google OAuth NOT configured — missing env vars:',
        !clientID ? 'GOOGLE_CLIENT_ID' : '',
        !clientSecret ? 'GOOGLE_CLIENT_SECRET' : '',
        !callbackURL ? 'GOOGLE_CALLBACK_URL' : ''
    );
}

export default passport;