import nodemailer from 'nodemailer';

// Helper function to get transporter (creates new one each time to ensure env vars are loaded)
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is incomplete. Missing SMTP_HOST, SMTP_USER, or SMTP_PASS');
  }
  
  // Strip quotes from values if present (dotenv sometimes includes them)
  const cleanHost = host.replace(/^["']|["']$/g, '');
  const cleanUser = user.replace(/^["']|["']$/g, '');
  const cleanPass = pass.replace(/^["']|["']$/g, '');
  
  return nodemailer.createTransport({
    host: cleanHost,
    port: port,
    secure: port === 465, // Use SSL only for port 465
    auth: {
      user: cleanUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    },
    // Force IPv4 if hostname resolution causes IPv6 issues
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export async function sendEmail({ to, subject, text, html, attachments }: EmailContent) {
  try {
    // Log email configuration (without sensitive data)
    console.log('Email configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT === '465',
      from: process.env.SMTP_FROM,
      to
    });

    // Create transporter with current env vars (ensures fresh config)
    const transporter = getTransporter();

    // Verify transporter configuration
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || text,
      attachments,
    });
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('SMTP configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT === '465',
      hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS)
    });
    return false;
  }
}

export function generateActionEmail(userEmail: string, userName: string, actions: Array<{type: string; amount?: number}>) {
  let subject = 'Michael Account Update Notification';
  let actionDescriptions = actions.map(action => {
    switch (action.type) {
      case 'reset_password':
        return 'Your password has been reset to "shenkar"';
      case 'add_balance':
        return `${action.amount} tokens have been added to your balance`;
      case 'reduce_balance':
        return `${action.amount} tokens have been deducted from your balance`;
      case 'set_balance':
        return `Your balance has been set to ${action.amount} tokens`;
      default:
        return '';
    }
  }).filter(desc => desc);

  const text = `
Dear ${userName},

This is to notify you that the following changes have been made to your account:

${actionDescriptions.map(desc => `- ${desc}`).join('\n')}

If you have any questions, please contact support.

Best regards,
Michael Team
  `.trim();

  return {
    to: userEmail,
    subject,
    text,
  };
}
