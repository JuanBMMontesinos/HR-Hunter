const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const permissionRoutes = require('./permissions');
const securityAlertRoutes = require('./securityAlerts');
const notificationRoutes = require('./notifications');
const exportRoutes = require('./exports');
const analyticsRoutes = require('./analytics');
const retentionRoutes = require('./retention');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/permissions', permissionRoutes);
router.use('/security-alerts', securityAlertRoutes);
router.use('/notifications', notificationRoutes);
router.use('/exports', exportRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/retention', retentionRoutes);

module.exports = router;
