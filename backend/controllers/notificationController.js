const notificationService = require('../services/notificationService');

async function listNotifications(req, res, next) {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const data = await notificationService.listUserNotifications(Number(req.user.id), {
      unreadOnly,
      page: req.query.page,
      limit: req.query.limit,
    });

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const data = await notificationService.markAsRead(
      Number(req.params.id),
      Number(req.user.id),
    );

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const data = await notificationService.markAllAsRead(Number(req.user.id));
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead,
};
