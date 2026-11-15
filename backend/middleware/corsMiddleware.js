const cors = require('cors');
const env = require('../config/env');

const allowedOrigins = env.frontendUrl
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin denied: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

module.exports = corsMiddleware;
