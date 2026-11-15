const express = require('express');
const permissionController = require('../controllers/permissionController');
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const { updateRolePermissionsSchema } = require('../validators/securityValidator');

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * @openapi
 * /permissions/matrix:
 *   get:
 *     summary: Retorna matriz completa de recursos, ações e permissões por role (Admin)
 *     tags: [Permissions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Matriz de permissões }
 *       403: { description: Acesso negado }
 */
router.get('/matrix', permissionController.getMatrix);

/**
 * @openapi
 * /permissions/roles/{role}:
 *   put:
 *     summary: Atualiza permissões de uma role em transação com audit_log (Admin bloqueada para edição)
 *     tags: [Permissions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Permissões atualizadas }
 *       403: { description: Admin protegido ou usuário não autorizado }
 */
router.put(
  '/roles/:role',
  validate(updateRolePermissionsSchema),
  permissionController.updateRolePermissions,
);

/**
 * @openapi
 * /permissions/audit-log:
 *   get:
 *     summary: Lista histórico de alterações de permissões e segurança no audit_log (Admin)
 *     tags: [Permissions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Logs paginados }
 */
router.get('/audit-log', permissionController.getAuditLog);

module.exports = router;
