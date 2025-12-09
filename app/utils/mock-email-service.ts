interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMockEmail({ to, subject, text, html }: EmailContent) {
  try {
    // Log the email details to console instead of sending
    console.log('='.repeat(50));
    console.log('MOCK EMAIL SENT');
    console.log('='.repeat(50));
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Text:', text);
    if (html) {
      console.log('HTML:', html);
    }
    console.log('='.repeat(50));
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    console.error('Error in mock email service:', error);
    return false;
  }
}

export async function sendEmail({ to, subject, text, html }: EmailContent) {
  // Use mock email service for development/testing
  return sendMockEmail({ to, subject, text, html });
}
