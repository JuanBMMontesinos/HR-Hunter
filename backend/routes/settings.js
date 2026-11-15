const express = require('express');
const settingsController = require('../controllers/settingsController');
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const {
  updateSettingsSchema,
  stageSchema,
  updateStageSchema,
  funnelSchema,
  updateFunnelSchema,
  emailTemplateSchema,
  updateEmailTemplateSchema,
  emailTestSchema,
  auditLogQuerySchema,
  loginHistoryQuerySchema,
  backupSchema,
} = require('../validators/dashboardAndSettingsValidator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /settings:
 *   get:
 *     summary: Lista todas as configurações do sistema (Admin only; valores sensíveis mascarados)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Configurações agrupadas por categoria }
 */
router.get('/', requireAdmin, settingsController.getSettings);

/**
 * @openapi
 * /settings:
 *   put:
 *     summary: Atualiza configurações do sistema em transação com audit_log (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Configurações atualizadas }
 */
router.put('/', requireAdmin, validate(updateSettingsSchema), settingsController.updateSettings);

/**
 * @openapi
 * /settings/stages:
 *   get:
 *     summary: Lista templates de etapas do processo seletivo
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de etapas ordenadas }
 *   post:
 *     summary: Cria nova etapa de processo seletivo (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Etapa criada }
 */
router.get('/stages', settingsController.listStages);
router.post('/stages', requireAdmin, validate(stageSchema), settingsController.createStage);

/**
 * @openapi
 * /settings/stages/{id}:
 *   put:
 *     summary: Atualiza etapa de processo seletivo (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Etapa atualizada }
 *   delete:
 *     summary: Remove etapa caso não possua vínculos (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Etapa removida }
 */
router.put('/stages/:id', requireAdmin, validate(updateStageSchema), settingsController.updateStage);
router.delete('/stages/:id', requireAdmin, settingsController.deleteStage);

/**
 * @openapi
 * /settings/funnels:
 *   get:
 *     summary: Lista funis de etapas configurados e seus itens ordenados
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de funis }
 *   post:
 *     summary: Cria novo funil com associação ordenada de etapas (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Funil criado }
 */
router.get('/funnels', settingsController.listFunnels);
router.post('/funnels', requireAdmin, validate(funnelSchema), settingsController.createFunnel);

/**
 * @openapi
 * /settings/funnels/{id}:
 *   put:
 *     summary: Atualiza funil e composição de etapas (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Funil atualizado }
 *   delete:
 *     summary: Remove funil não padrão e sem vagas ativas (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Funil removido }
 */
router.put('/funnels/:id', requireAdmin, validate(updateFunnelSchema), settingsController.updateFunnel);
router.delete('/funnels/:id', requireAdmin, settingsController.deleteFunnel);

/**
 * @openapi
 * /settings/email-templates:
 *   get:
 *     summary: Lista templates de e-mail (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de templates }
 *   post:
 *     summary: Cria template de e-mail com sanitização HTML contra XSS (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Template criado }
 */
router.get('/email-templates', requireAdmin, settingsController.listEmailTemplates);
router.post(
  '/email-templates',
  requireAdmin,
  validate(emailTemplateSchema),
  settingsController.createEmailTemplate,
);

/**
 * @openapi
 * /settings/email-templates/{id}:
 *   put:
 *     summary: Atualiza template de e-mail com sanitização HTML (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Template atualizado }
 *   delete:
 *     summary: Remove template customizado (protege templates is_system=true com 403) (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Template removido }
 *       403: { description: Template do sistema protegido }
 */
router.put(
  '/email-templates/:id',
  requireAdmin,
  validate(updateEmailTemplateSchema),
  settingsController.updateEmailTemplate,
);
router.delete('/email-templates/:id', requireAdmin, settingsController.deleteEmailTemplate);

/**
 * @openapi
 * /settings/email-test:
 *   post:
 *     summary: Dispara e-mail de teste usando configuração SMTP ou modo simulado (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resultado do disparo de teste }
 */
router.post('/email-test', requireAdmin, validate(emailTestSchema), settingsController.sendTestEmail);

/**
 * @openapi
 * /settings/audit-log:
 *   get:
 *     summary: Lista audit_log paginado com filtros por usuário, ação, tabela e período (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Registros de auditoria }
 */
router.get('/audit-log', requireAdmin, validate(auditLogQuerySchema, 'query'), settingsController.listAuditLog);

/**
 * @openapi
 * /settings/login-history:
 *   get:
 *     summary: Lista histórico de logins paginado com filtros por usuário, sucesso e período (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Histórico de autenticação }
 */
router.get(
  '/login-history',
  requireAdmin,
  validate(loginHistoryQuerySchema, 'query'),
  settingsController.listLoginHistory,
);

/**
 * @openapi
 * /settings/backup:
 *   post:
 *     summary: Gera snapshot lógico auditado (JSON ou SQL) das tabelas de negócio (Admin only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Snapshot lógico gerado }
 */
router.post('/backup', requireAdmin, validate(backupSchema), settingsController.backup);

module.exports = router;
