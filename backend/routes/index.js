const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const permissionRoutes = require('./permissions');
const securityAlertRoutes = require('./securityAlerts');
const notificationRoutes = require('./notifications');
const exportRoutes = require('./exports');
const analyticsRoutes = require('./analytics');
const retentionRoutes = require('./retention');
const companyRoutes = require('./companies');
const jobOpeningRoutes = require('./jobOpenings');
const candidateRoutes = require('./candidates');
const processRoutes = require('./processes');
const userRoutes = require('./users');
const dashboardRoutes = require('./dashboard');
const settingsRoutes = require('./settings');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/permissions', permissionRoutes);
router.use('/security-alerts', securityAlertRoutes);
router.use('/notifications', notificationRoutes);
router.use('/exports', exportRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/retention', retentionRoutes);
router.use('/companies', companyRoutes);
router.use('/job-openings', jobOpeningRoutes);
router.use('/candidates', candidateRoutes);
router.use('/processes', processRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
