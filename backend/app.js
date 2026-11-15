const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

const corsMiddleware = require('./middleware/corsMiddleware');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const env = require('./config/env');
const swaggerSpec = require('./config/swagger');
const apiRoutes = require('./routes');

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: env.cookieSecure ? {} : { 'upgrade-insecure-requests': null },
    },
  }),
);
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/v1', apiLimiter, apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'RES_001',
      message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    },
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

module.exports = app;
