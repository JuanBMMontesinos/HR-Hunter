const authService = require('../services/authService');
const permissionService = require('../services/permissionService');
const { extractRequestMeta } = require('../middleware/auditMiddleware');
const { REFRESH_COOKIE_NAME, getRefreshCookieOptions } = require('../utils/tokenUtils');

async function login(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      ipAddress,
      userAgent,
    });

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      getRefreshCookieOptions(result.refreshMaxAgeMs),
    );

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
        permissions: result.permissions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || null;
    const result = await authService.refreshSession({
      rawRefreshToken,
      ipAddress,
      userAgent,
    });

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      getRefreshCookieOptions(result.refreshMaxAgeMs),
    );

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
        permissions: result.permissions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || null;

    await authService.logout({
      rawRefreshToken,
      userId: req.user?.id || null,
      ipAddress,
      userAgent,
    });

    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      data: { message: 'Logout realizado com sucesso.' },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const data = await authService.forgotPassword({ email: req.body.email });
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const data = await authService.resetPassword({
      token: req.body.token,
      newPassword: req.body.newPassword,
      ipAddress,
      userAgent,
    });

    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function getPermissions(req, res, next) {
  try {
    const permissions = await permissionService.getRolePermissions(req.user.role);
    res.status(200).json({
      success: true,
      data: {
        role: req.user.role,
        permissions: permissions.map((p) => p.key),
        details: permissions,
        ttlSeconds: Math.floor(permissionService.CACHE_TTL_MS / 1000),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const permissions = await permissionService.getRolePermissions(req.user.role);
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
        permissions: permissions.map((p) => p.key),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getPermissions,
  getMe,
};
