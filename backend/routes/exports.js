const express = require('express');
const exportController = require('../controllers/exportController');
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const { exportLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(authenticate, requireAdmin, exportLimiter);

/**
 * @openapi
 * /exports/unauthorized-access-logs/csv:
 *   get:
 *     summary: Exporta logs de acesso não autorizado em CSV UTF-8 (delimitador ";")
 *     tags: [Exports]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Arquivo CSV }
 */
router.get('/unauthorized-access-logs/csv', exportController.exportUnauthorizedLogsCsv);

/**
 * @openapi
 * /exports/unauthorized-access-logs/pdf:
 *   get:
 *     summary: Exporta relatório de acessos não autorizados em PDF
 *     tags: [Exports]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Arquivo PDF }
 */
router.get('/unauthorized-access-logs/pdf', exportController.exportUnauthorizedLogsPdf);

/**
 * @openapi
 * /exports/security-alerts/csv:
 *   get:
 *     summary: Exporta alertas de segurança em CSV UTF-8 (delimitador ";")
 *     tags: [Exports]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Arquivo CSV }
 */
router.get('/security-alerts/csv', exportController.exportSecurityAlertsCsv);

module.exports = router;
