import nodemailer from 'nodemailer';

export function emailDeliveryConfigured() {
  return Boolean(smtpHost() && mailFrom());
}

export async function sendPasswordResetEmail({ user, token, resetUrl = '', expiresMinutes = 30 }) {
  if (!emailDeliveryConfigured()) {
    return { delivered: false, configured: false };
  }
  const transporter = nodemailer.createTransport({
    host: smtpHost(),
    port: smtpPort(),
    secure: smtpSecure(),
    auth: smtpAuth(),
  });
  const from = mailFrom();
  const subject = 'Recuperação de senha - Runalith RPG';
  const text = passwordResetText({ token, resetUrl, expiresMinutes });
  const html = passwordResetHtml({ token, resetUrl, expiresMinutes });
  const info = await transporter.sendMail({
    from,
    to: user.email,
    subject,
    text,
    html,
  });
  return { delivered: true, configured: true, messageId: info.messageId || '' };
}

function passwordResetText({ token, resetUrl, expiresMinutes }) {
  return [
    'Runalith RPG',
    '',
    'Recebemos uma solicitação para recuperar sua senha.',
    resetUrl
      ? `Abra este link para definir uma nova senha: ${resetUrl}`
      : 'Use o botão "Tenho token" na tela de acesso e informe o token abaixo.',
    '',
    `Token: ${token}`,
    `Validade: ${expiresMinutes} minutos.`,
    '',
    'Se você não pediu esta recuperação, ignore este email.',
  ].join('\n');
}

function passwordResetHtml({ token, resetUrl, expiresMinutes }) {
  const safeToken = escapeHtml(token);
  const action = resetUrl
    ? `<p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#655ca3;color:#fff;text-decoration:none;font-weight:700">Definir nova senha</a></p>`
    : '<p>Use o botão <strong>Tenho token</strong> na tela de acesso.</p>';
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f0eff6;color:#150f21;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:28px">
      <h1 style="margin:0 0 10px;font-size:26px">Runalith RPG</h1>
      <p>Recebemos uma solicitação para recuperar sua senha.</p>
      ${action}
      <p style="margin-top:18px">Token de recuperação:</p>
      <p style="padding:14px 16px;border-radius:8px;background:#e0dfec;font-size:18px;font-weight:700;letter-spacing:1px">${safeToken}</p>
      <p>Este token expira em ${Number(expiresMinutes) || 30} minutos.</p>
      <p style="color:#544884">Se você não pediu esta recuperação, ignore este email.</p>
    </div>
  </body>
</html>`;
}

function smtpHost() {
  return process.env.SMTP_HOST || process.env.MAIL_HOST || '';
}

function smtpPort() {
  return Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
}

function smtpSecure() {
  const value = String(process.env.SMTP_SECURE || process.env.MAIL_SECURE || '').toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return smtpPort() === 465;
}

function smtpAuth() {
  const user = process.env.SMTP_USER || process.env.MAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.MAIL_PASS || '';
  return user || pass ? { user, pass } : undefined;
}

function mailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || process.env.MAIL_USER || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
