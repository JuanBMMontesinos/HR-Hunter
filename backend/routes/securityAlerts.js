const express = require('express');
const securityAlertController = require('../controllers/securityAlertController');
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const { resolveAlertSchema } = require('../validators/securityValidator');

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * @openapi
 * /security-alerts:
 *   get:
 *     summary: Lista alertas de segurança com paginação e filtros (Admin)
 *     tags: [Security]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de alertas }
 */
router.get('/', securityAlertController.listAlerts);

/**
 * @openapi
 * /security-alerts/stats:
 *   get:
 *     summary: Estatísticas de alertas ativos, severidades e tentativas não autorizadas (Admin)
 *     tags: [Security]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Estatísticas consolidadas }
 */
router.get('/stats', securityAlertController.getStats);

/**
 * @openapi
 * /security-alerts/{id}/resolve:
 *   put:
 *     summary: Marca alerta de segurança como RESOLVED ou DISMISSED (Admin)
 *     tags: [Security]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Alerta atualizado }
 */
router.put('/:id/resolve', validate(resolveAlertSchema), securityAlertController.resolveAlert);

module.exports = router;
