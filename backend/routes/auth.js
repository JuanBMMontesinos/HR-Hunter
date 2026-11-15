const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validationMiddleware');
const { loginLimiter } = require('../middleware/rateLimiter');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidator');
const { verifyAccessToken } = require('../utils/tokenUtils');

const router = express.Router();

function optionalAuthenticate(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const decoded = verifyAccessToken(authHeader.slice(7).trim());
      req.user = { id: Number(decoded.sub), email: decoded.email, role: decoded.role };
    } catch {
      // Ignore expired/invalid bearer tokens on logout so cookie revocation still proceeds
    }
  }
  next();
}

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentica usuário com email e senha emitindo JWT + cookie HttpOnly de refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login realizado com sucesso }
 *       401: { description: Credenciais inválidas }
 *       423: { description: Conta bloqueada temporariamente }
 *       429: { description: Limite de tentativas excedido }
 */
router.post('/login', loginLimiter, validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     summary: Rotaciona refresh token (HttpOnly cookie) e emite novo access token JWT
 *     tags: [Auth]
 *     responses:
 *       200: { description: Token renovado com sucesso }
 *       401: { description: Refresh token ausente, inválido ou expirado }
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoga refresh token ativo e registra logout em login_history e audit_log
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logout realizado }
 */
router.post('/logout', optionalAuthenticate, authController.logout);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Gera token único temporário para redefinição de senha
 *     tags: [Auth]
 *     responses:
 *       200: { description: Solicitação processada }
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Redefine senha usando token válido atendendo à política de senha forte
 *     tags: [Auth]
 *     responses:
 *       200: { description: Senha redefinida }
 *       400: { description: Token inválido/expirado ou senha fora da política }
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/**
 * @openapi
 * /auth/permissions:
 *   get:
 *     summary: Lista permissões efetivas do usuário autenticado (com cache TTL 5 min)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de permissões efetivas }
 *       401: { description: Não autenticado }
 */
router.get('/permissions', authenticate, authController.getPermissions);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Retorna perfil e permissões do usuário autenticado
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dados do usuário autenticado }
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;
