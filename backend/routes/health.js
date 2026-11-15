const express = require('express');
const { healthCheck } = require('../config/database');

const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Verifica saúde da API e conexão com o Supabase PostgreSQL
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API e banco de dados operacionais
 *       503:
 *         description: Banco de dados indisponível
 */
router.get('/', async (_req, res) => {
  try {
    const db = await healthCheck();
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'hr-hunter-backend',
        database: 'connected',
        latencyMs: db.latencyMs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SRV_002',
        message: 'Banco de dados indisponível',
        details: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
