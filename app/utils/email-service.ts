import nodemailer from 'nodemailer';

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: EmailContent) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html: html || text,
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
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
