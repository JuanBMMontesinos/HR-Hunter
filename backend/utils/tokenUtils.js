const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const REFRESH_COOKIE_NAME = 'hr_refresh_token';

function parseDurationToMs(durationStr, fallbackMs = 7 * 24 * 60 * 60 * 1000) {
  if (typeof durationStr === 'number' && Number.isFinite(durationStr)) {
    return durationStr * 1000;
  }
  const match = String(durationStr || '').trim().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (multipliers[unit] || 1000);
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      issuer: 'hr-hunter-api',
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    issuer: 'hr-hunter-api',
  });
}

function generateOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function getRefreshCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/api/v1/auth',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

module.exports = {
  REFRESH_COOKIE_NAME,
  parseDurationToMs,
  signAccessToken,
  verifyAccessToken,
  generateOpaqueToken,
  hashToken,
  getRefreshCookieOptions,
};
