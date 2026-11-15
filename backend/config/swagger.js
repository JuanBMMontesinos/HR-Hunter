const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'HR Hunter API',
      version: '2.0.0',
      description: 'API RESTful do HR Hunter integrada ao Supabase (PostgreSQL).',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [path.resolve(__dirname, '../routes/*.js').replace(/\\/g, '/')],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
