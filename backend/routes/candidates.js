const express = require('express');
const multer = require('multer');
const candidateController = require('../controllers/candidateController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const {
  listCandidatesQuerySchema,
  createCandidateSchema,
  updateCandidateSchema,
  experienceItemSchema,
  updateExperienceSchema,
  educationItemSchema,
  updateEducationSchema,
  skillItemSchema,
  updateSkillSchema,
  importCandidatesBodySchema,
} = require('../validators/candidateValidator');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(authenticate);

/**
 * @openapi
 * /candidates:
 *   get:
 *     summary: Lista candidatos paginados com filtros por nome, email, CPF, competência e status
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista paginada de candidatos }
 */
router.get(
  '/',
  authorize('candidates', 'read'),
  validate(listCandidatesQuerySchema, 'query'),
  candidateController.list,
);

/**
 * @openapi
 * /candidates/import:
 *   post:
 *     summary: Importa candidatos em lote via upload CSV (multipart/form-data ou JSON { csv })
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resumo de importação e possíveis erros por linha }
 */
router.post(
  '/import',
  authorize('candidates', 'create'),
  upload.single('file'),
  validate(importCandidatesBodySchema),
  candidateController.importCsv,
);

/**
 * @openapi
 * /candidates:
 *   post:
 *     summary: Cria candidato em transação com CPF opcional (múltiplos NULL permitidos) e sub-recursos
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Candidato criado }
 */
router.post(
  '/',
  authorize('candidates', 'create'),
  validate(createCandidateSchema),
  candidateController.create,
);

/**
 * @openapi
 * /candidates/{id}:
 *   get:
 *     summary: Retorna perfil completo do candidato com experiências, educação, competências e processos
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Detalhes do candidato }
 */
router.get('/:id', authorize('candidates', 'read'), candidateController.getById);

/**
 * @openapi
 * /candidates/{id}:
 *   put:
 *     summary: Atualiza dados cadastrais do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Candidato atualizado }
 */
router.put(
  '/:id',
  authorize('candidates', 'update'),
  validate(updateCandidateSchema),
  candidateController.update,
);

/**
 * @openapi
 * /candidates/{id}:
 *   delete:
 *     summary: Inativa candidato (soft delete), bloqueando se houver processo seletivo ativo
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Candidato inativado }
 *       409: { description: Candidato possui processo ativo }
 */
router.delete('/:id', authorize('candidates', 'delete'), candidateController.remove);

/**
 * @openapi
 * /candidates/{id}/experience:
 *   get:
 *     summary: Lista experiências profissionais do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de experiências }
 *   post:
 *     summary: Adiciona experiência profissional ao candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Experiência criada }
 */
router.get('/:id/experience', authorize('candidates', 'read'), candidateController.experience.list);
router.post(
  '/:id/experience',
  authorize('candidates', 'update'),
  validate(experienceItemSchema),
  candidateController.experience.add,
);

/**
 * @openapi
 * /candidates/{id}/experience/{expId}:
 *   put:
 *     summary: Atualiza experiência profissional do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Experiência atualizada }
 *   delete:
 *     summary: Remove experiência profissional do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Experiência removida }
 */
router.put(
  '/:id/experience/:expId',
  authorize('candidates', 'update'),
  validate(updateExperienceSchema),
  candidateController.experience.update,
);
router.delete('/:id/experience/:expId', authorize('candidates', 'update'), candidateController.experience.remove);

/**
 * @openapi
 * /candidates/{id}/education:
 *   get:
 *     summary: Lista formações acadêmicas do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de formações }
 *   post:
 *     summary: Adiciona formação acadêmica ao candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Formação criada }
 */
router.get('/:id/education', authorize('candidates', 'read'), candidateController.education.list);
router.post(
  '/:id/education',
  authorize('candidates', 'update'),
  validate(educationItemSchema),
  candidateController.education.add,
);

/**
 * @openapi
 * /candidates/{id}/education/{eduId}:
 *   put:
 *     summary: Atualiza formação acadêmica do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Formação atualizada }
 *   delete:
 *     summary: Remove formação acadêmica do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Formação removida }
 */
router.put(
  '/:id/education/:eduId',
  authorize('candidates', 'update'),
  validate(updateEducationSchema),
  candidateController.education.update,
);
router.delete('/:id/education/:eduId', authorize('candidates', 'update'), candidateController.education.remove);

/**
 * @openapi
 * /candidates/{id}/skills:
 *   get:
 *     summary: Lista competências técnicas do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de competências }
 *   post:
 *     summary: Adiciona competência técnica ao candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Competência criada }
 */
router.get('/:id/skills', authorize('candidates', 'read'), candidateController.skills.list);
router.post(
  '/:id/skills',
  authorize('candidates', 'update'),
  validate(skillItemSchema),
  candidateController.skills.add,
);

/**
 * @openapi
 * /candidates/{id}/skills/{skillId}:
 *   put:
 *     summary: Atualiza competência técnica do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Competência atualizada }
 *   delete:
 *     summary: Remove competência técnica do candidato
 *     tags: [Candidates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Competência removida }
 */
router.put(
  '/:id/skills/:skillId',
  authorize('candidates', 'update'),
  validate(updateSkillSchema),
  candidateController.skills.update,
);
router.delete('/:id/skills/:skillId', authorize('candidates', 'update'), candidateController.skills.remove);

module.exports = router;
