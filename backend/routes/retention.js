const express = require('express');
const retentionController = require('../controllers/retentionController');
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const {
  updateRetentionPolicySchema,
  executeRetentionSchema,
} = require('../validators/securityValidator');

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * @openapi
 * /retention/policies:
 *   get:
 *     summary: Lista políticas de retenção configuradas e contagem de registros elegíveis
 *     tags: [Retention]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de políticas }
 */
router.get('/policies', retentionController.listPolicies);

/**
 * @openapi
 * /retention/policies/{key}:
 *   put:
 *     summary: Atualiza prazo em dias de uma política de retenção
 *     tags: [Retention]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Política atualizada }
 */
router.put(
  '/policies/:key',
  validate(updateRetentionPolicySchema),
  retentionController.updatePolicy,
);

/**
 * @openapi
 * /retention/execute:
 *   post:
 *     summary: Executa limpeza de retenção (ou simulação dryRun) registrando em retention_execution_log
 *     tags: [Retention]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resumo da execução }
 */
router.post('/execute', validate(executeRetentionSchema), retentionController.executeRetention);

/**
 * @openapi
 * /retention/history:
 *   get:
 *     summary: Histórico de execuções da política de retenção
 *     tags: [Retention]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Histórico paginado }
 */
router.get('/history', retentionController.getHistory);

module.exports = router;
