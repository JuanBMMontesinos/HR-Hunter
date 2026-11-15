const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const { generateReportSchema } = require('../validators/securityValidator');

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * @openapi
 * /analytics/generate-report:
 *   post:
 *     summary: Calcula Risk Score (0-100) e persiste novo SecurityReport no Supabase
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Relatório gerado }
 */
router.post('/generate-report', validate(generateReportSchema), analyticsController.generateReport);

/**
 * @openapi
 * /analytics/reports:
 *   get:
 *     summary: Lista relatórios de segurança gerados
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista paginada }
 */
router.get('/reports', analyticsController.listReports);

/**
 * @openapi
 * /analytics/reports/{id}:
 *   get:
 *     summary: Obtém detalhes de um relatório de segurança específico
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Detalhes do relatório }
 *       404: { description: Relatório não encontrado }
 */
router.get('/reports/:id', analyticsController.getReportById);

module.exports = router;
