const express = require('express');
const processController = require('../controllers/processController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const {
  listProcessesQuerySchema,
  kanbanQuerySchema,
  createProcessSchema,
  updateProcessSchema,
  nextStageSchema,
  rejectProcessSchema,
  offerProcessSchema,
  updateOfferSchema,
} = require('../validators/processValidator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /processes:
 *   get:
 *     summary: Lista processos seletivos paginados com filtros por vaga, candidato, empresa, etapa e status
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista paginada de processos }
 */
router.get(
  '/',
  authorize('processes', 'read'),
  validate(listProcessesQuerySchema, 'query'),
  processController.list,
);

/**
 * @openapi
 * /processes/kanban:
 *   get:
 *     summary: Retorna colunas ordenadas do funil com processos agrupados para visão Kanban
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Quadro Kanban de processos }
 */
router.get(
  '/kanban',
  authorize('processes', 'read'),
  validate(kanbanQuerySchema, 'query'),
  processController.kanban,
);

/**
 * @openapi
 * /processes:
 *   post:
 *     summary: Inicia novo processo seletivo vinculando candidato e vaga
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Processo criado na etapa inicial }
 */
router.post(
  '/',
  authorize('processes', 'create'),
  validate(createProcessSchema),
  processController.create,
);

/**
 * @openapi
 * /processes/{id}:
 *   get:
 *     summary: Retorna detalhes do processo com histórico de etapas e propostas
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Detalhes do processo }
 */
router.get('/:id', authorize('processes', 'read'), processController.getById);

/**
 * @openapi
 * /processes/{id}:
 *   put:
 *     summary: Atualiza status ou etapa de um processo seletivo
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Processo atualizado }
 */
router.put(
  '/:id',
  authorize('processes', 'update'),
  validate(updateProcessSchema),
  processController.update,
);

/**
 * @openapi
 * /processes/{id}/next-stage:
 *   post:
 *     summary: Avança processo para próxima etapa via fn_move_to_next_stage com feedback, nota e anexos
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Processo avançado }
 */
router.post(
  '/:id/next-stage',
  authorize('processes', 'update'),
  validate(nextStageSchema),
  processController.nextStage,
);

/**
 * @openapi
 * /processes/{id}/reject:
 *   post:
 *     summary: Rejeita candidato no processo com motivo e envio opcional de e-mail template
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Processo rejeitado e encerrado }
 */
router.post(
  '/:id/reject',
  authorize('processes', 'update'),
  validate(rejectProcessSchema),
  processController.reject,
);

/**
 * @openapi
 * /processes/{id}/offer:
 *   post:
 *     summary: Registra proposta salarial e move processo para a etapa Oferta
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Oferta enviada }
 */
router.post(
  '/:id/offer',
  authorize('processes', 'update'),
  validate(offerProcessSchema),
  processController.offer,
);

/**
 * @openapi
 * /processes/{id}/offer/{offerId}:
 *   patch:
 *     summary: Atualiza status da proposta (Aceita pode concluir o processo como Contratado)
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Status da proposta atualizado }
 */
router.patch(
  '/:id/offer/:offerId',
  authorize('processes', 'update'),
  validate(updateOfferSchema),
  processController.updateOffer,
);

/**
 * @openapi
 * /processes/{id}/timeline:
 *   get:
 *     summary: Retorna linha do tempo completa do processo (etapas, propostas e auditoria)
 *     tags: [Processes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Timeline cronológica }
 */
router.get('/:id/timeline', authorize('processes', 'read'), processController.timeline);

module.exports = router;
