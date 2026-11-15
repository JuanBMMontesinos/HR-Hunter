const express = require('express');
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: Lista notificações do usuário autenticado
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista paginada e contador unreadCount }
 */
router.get('/', notificationController.listNotifications);

/**
 * @openapi
 * /notifications/read-all:
 *   put:
 *     summary: Marca todas as notificações do usuário autenticado como lidas
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notificações marcadas como lidas }
 */
router.put('/read-all', notificationController.markAllAsRead);

/**
 * @openapi
 * /notifications/{id}/read:
 *   put:
 *     summary: Marca uma notificação específica do usuário autenticado como lida
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Notificação atualizada }
 *       404: { description: Notificação não encontrada }
 */
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
