const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const { dashboardFilterQuerySchema } = require('../validators/dashboardAndSettingsValidator');

const router = express.Router();

router.use(authenticate, authorize('dashboard', 'read'));

/**
 * @openapi
 * /dashboard/kpis:
 *   get:
 *     summary: Retorna KPIs consolidados via função PostgreSQL fn_get_dashboard_kpis
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: KPIs do dashboard }
 */
router.get('/kpis', validate(dashboardFilterQuerySchema, 'query'), dashboardController.kpis);

/**
 * @openapi
 * /dashboard/analytics:
 *   get:
 *     summary: Retorna dados de gráficos (departamento, status de vagas, evolução 30d, etapas e top 5 empresas)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Séries analíticas }
 */
router.get('/analytics', validate(dashboardFilterQuerySchema, 'query'), dashboardController.analytics);

/**
 * @openapi
 * /dashboard/critical-processes:
 *   get:
 *     summary: Retorna vagas abertas > 30 dias e processos parados > 15 dias via fn_get_critical_processes
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Alertas operacionais críticos }
 */
router.get(
  '/critical-processes',
  validate(dashboardFilterQuerySchema, 'query'),
  dashboardController.criticalProcesses,
);

module.exports = router;
