const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtpHost) return null;

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser
      ? {
          user: env.smtpUser,
          pass: env.smtpPassword,
        }
      : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const smtp = getTransporter();
  if (!smtp) {
    logger.info('SMTP not configured — simulated email dispatch', { to, subject });
    return { delivered: false, simulated: true };
  }

  const info = await smtp.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    html,
    text,
  });

  return { delivered: true, simulated: false, messageId: info.messageId };
}

async function sendPasswordResetEmail({ email, fullName, resetUrl }) {
  const safeName = fullName || 'Usuário';
  return sendMail({
    to: email,
    subject: 'HR Hunter — Redefinição de Senha',
    html: `<p>Olá ${safeName},</p><p>Recebemos uma solicitação para redefinir sua senha no HR Hunter.</p><p><a href="${resetUrl}">Clique aqui para cadastrar uma nova senha</a> (válido por 1 hora).</p>`,
    text: `Olá ${safeName}, acesse o link para redefinir sua senha no HR Hunter (válido por 1 hora): ${resetUrl}`,
  });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
};
