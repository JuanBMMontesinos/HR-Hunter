const express = require('express');
const companyController = require('../controllers/companyController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validationMiddleware');
const {
  listCompaniesQuerySchema,
  createCompanySchema,
  updateCompanySchema,
} = require('../validators/companyValidator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /companies:
 *   get:
 *     summary: Lista empresas paginadas (máx. 20/pág) com filtros por nome, status, setor e CNPJ
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista paginada de empresas }
 */
router.get(
  '/',
  authorize('companies', 'read'),
  validate(listCompaniesQuerySchema, 'query'),
  companyController.list,
);

/**
 * @openapi
 * /companies:
 *   post:
 *     summary: Cadastra nova empresa validando CNPJ único
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Empresa criada }
 *       409: { description: CNPJ duplicado }
 */
router.post(
  '/',
  authorize('companies', 'create'),
  validate(createCompanySchema),
  companyController.create,
);

/**
 * @openapi
 * /companies/{id}:
 *   get:
 *     summary: Retorna detalhes da empresa e estatísticas de vagas/candidatos
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Dados da empresa }
 *       404: { description: Empresa não encontrada }
 */
router.get('/:id', authorize('companies', 'read'), companyController.getById);

/**
 * @openapi
 * /companies/{id}:
 *   put:
 *     summary: Atualiza dados cadastrais da empresa
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Empresa atualizada }
 *       404: { description: Empresa não encontrada }
 */
router.put(
  '/:id',
  authorize('companies', 'update'),
  validate(updateCompanySchema),
  companyController.update,
);

/**
 * @openapi
 * /companies/{id}:
 *   delete:
 *     summary: Inativa empresa (soft delete), bloqueando se houver vagas abertas ou em progresso
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Empresa inativada }
 *       409: { description: Empresa possui vagas abertas ou em progresso }
 */
router.delete('/:id', authorize('companies', 'delete'), companyController.remove);

module.exports = router;
