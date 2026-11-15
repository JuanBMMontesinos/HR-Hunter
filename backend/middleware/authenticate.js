const { query } = require('../config/database');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const { mapRow } = require('../utils/dbMapper');
const { verifyAccessToken } = require('../utils/tokenUtils');

async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Token de autenticação não fornecido.', 401, ErrorCodes.UNAUTHORIZED);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Token de autenticação inválido.', 401, ErrorCodes.UNAUTHORIZED);
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Sessão expirada. Renove seu token.', 401, ErrorCodes.TOKEN_EXPIRED);
      }
      throw new AppError('Token de autenticação inválido.', 401, ErrorCodes.UNAUTHORIZED);
    }

    const userRes = await query(
      `SELECT id, email, full_name, phone, role, department, manager_id, is_active, preferred_language
       FROM users
       WHERE id = $1`,
      [Number(decoded.sub)],
    );

    if (userRes.rows.length === 0) {
      throw new AppError('Usuário não encontrado.', 401, ErrorCodes.UNAUTHORIZED);
    }

    const user = mapRow(userRes.rows[0]);
    if (!user.isActive) {
      throw new AppError('Conta de usuário desativada.', 403, ErrorCodes.FORBIDDEN);
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authenticate;
