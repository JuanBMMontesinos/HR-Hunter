const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  adminResetPasswordSchema,
} = require('../validators/userValidator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Lista usuários paginados com filtros por role, departamento e status (Admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de usuários }
 *       403: { description: Acesso restrito ao perfil Admin }
 */
router.get(
  '/',
  requireAdmin,
  validate(listUsersQuerySchema, 'query'),
  userController.list,
);

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Cria novo usuário aplicando política de senha forte (Admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Usuário criado }
 */
router.post(
  '/',
  requireAdmin,
  validate(createUserSchema),
  userController.create,
);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Retorna perfil do usuário (Admin ou próprio perfil)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Perfil do usuário }
 */
router.get('/:id', userController.getById);

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Atualiza usuário (Admin altera qualquer campo; próprio usuário altera apenas nome, telefone e idioma)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Usuário atualizado }
 *       403: { description: Tentativa de alterar campo restrito ou conta de terceiros }
 */
router.put('/:id', validate(updateUserSchema), userController.update);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Desativa usuário (soft delete is_active = false) e revoga refresh tokens (Admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Usuário desativado }
 */
router.delete('/:id', requireAdmin, userController.remove);

/**
 * @openapi
 * /users/{id}/activity:
 *   get:
 *     summary: Histórico recente de logins e auditoria do usuário (Admin ou próprio usuário)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Atividade recente do usuário }
 */
router.get('/:id/activity', userController.activity);

/**
 * @openapi
 * /users/{id}/reset-password:
 *   post:
 *     summary: Redefinição administrativa de senha com marcação opcional de troca no próximo login (Admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Senha redefinida }
 */
router.post(
  '/:id/reset-password',
  requireAdmin,
  validate(adminResetPasswordSchema),
  userController.resetPassword,
);

module.exports = router;
