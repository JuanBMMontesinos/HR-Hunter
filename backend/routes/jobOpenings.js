const express = require('express');
const jobOpeningController = require('../controllers/jobOpeningController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const {
  listJobOpeningsQuerySchema,
  createJobOpeningSchema,
  updateJobOpeningSchema,
} = require('../validators/jobOpeningValidator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /job-openings:
 *   get:
 *     summary: Lista vagas com filtros por empresa, status, nível, departamento, contrato e busca
 *     tags: [Job Openings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista paginada de vagas com contadores }
 */
router.get(
  '/',
  authorize('job_openings', 'read'),
  validate(listJobOpeningsQuerySchema, 'query'),
  jobOpeningController.list,
);

/**
 * @openapi
 * /job-openings:
 *   post:
 *     summary: Cria nova vaga (normaliza salaryMin/minSalary, salaryMax/maxSalary, companyId, funnelId e openedAt)
 *     tags: [Job Openings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Vaga criada }
 */
router.post(
  '/',
  authorize('job_openings', 'create'),
  validate(createJobOpeningSchema),
  jobOpeningController.create,
);

/**
 * @openapi
 * /job-openings/{id}:
 *   get:
 *     summary: Retorna detalhes da vaga, etapas do funil e indicadores
 *     tags: [Job Openings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Detalhes da vaga }
 */
router.get('/:id', authorize('job_openings', 'read'), jobOpeningController.getById);

/**
 * @openapi
 * /job-openings/{id}/candidates:
 *   get:
 *     summary: Lista candidatos e processos vinculados à vaga
 *     tags: [Job Openings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Candidatos da vaga }
 */
router.get('/:id/candidates', authorize('job_openings', 'read'), jobOpeningController.getCandidates);

/**
 * @openapi
 * /job-openings/{id}/analytics:
 *   get:
 *     summary: Retorna funil por etapa e métricas analíticas da vaga
 *     tags: [Job Openings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Analytics da vaga }
 */
router.get('/:id/analytics', authorize('job_openings', 'read'), jobOpeningController.getAnalytics);

/**
 * @openapi
 * /job-openings/{id}:
 *   put:
 *     summary: Atualiza vaga (bloqueia edição caso status seja Preenchida)
 *     tags: [Job Openings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vaga atualizada }
 *       409: { description: Vaga já preenchida não pode ser editada }
 */
router.put(
  '/:id',
  authorize('job_openings', 'update'),
  validate(updateJobOpeningSchema),
  jobOpeningController.update,
);

/**
 * @openapi
 * /job-openings/{id}:
 *   delete:
 *     summary: Remove ou cancela vaga (impede exclusão se houver processos ativos)
 *     tags: [Job Openings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vaga removida ou cancelada }
 *       409: { description: Possui processos ativos }
 */
router.delete('/:id', authorize('job_openings', 'delete'), jobOpeningController.remove);

module.exports = router;
