# Email Service Setup Guide

## Issue Resolution

The error `connect ECONNREFUSED ::1:465` indicates that the SMTP server is not accessible or not configured correctly. This guide will help you set up the email service properly.

## Current Status

I've temporarily switched to a mock email service so you can test the forgot password functionality without SMTP configuration. The emails will be logged to the console instead of being sent.

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Email Configuration
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password-or-app-password
SMTP_FROM=your-email@example.com
```

## Common Email Provider Configurations

### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

**Important for Gmail:**
1. Enable 2-factor authentication
2. Generate an App Password (not your regular password)
3. Use the App Password in SMTP_PASS

### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM=your-email@outlook.com
```

### Yahoo
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@yahoo.com
```

## Testing Steps

### 1. Check SMTP Configuration
```bash
curl http://localhost:3000/api/test-smtp-config
```

### 2. Test Email Service
```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 3. Test Forgot Password (with mock email)
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Switching to Real Email Service

Once you have configured your SMTP settings:

1. **Update the imports** in the API routes:
   ```typescript
   // Change from:
   import { sendEmail } from '@/app/utils/mock-email-service'
   
   // To:
   import { sendEmail } from '@/app/utils/email-service'
   ```

2. **Test the real email service** using the test endpoint

3. **Verify emails are being sent** to your email address

## Troubleshooting

### Connection Refused Errors
- Check if SMTP_HOST is correct
- Verify SMTP_PORT (587 for TLS, 465 for SSL)
- Ensure your firewall allows outbound connections on the SMTP port

### Authentication Errors
- Verify SMTP_USER and SMTP_PASS are correct
- For Gmail/Yahoo, use App Passwords, not regular passwords
- Check if 2-factor authentication is enabled

### SSL/TLS Errors
- Try port 587 with TLS instead of 465 with SSL
- Check if your email provider supports the security settings

## Development vs Production

### Development
- Use mock email service for testing
- Emails are logged to console
- No SMTP configuration required

### Production
- Use real email service
- Configure proper SMTP settings
- Test email delivery thoroughly

## Security Considerations

1. **Never commit SMTP credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Use App Passwords** instead of regular passwords when possible
4. **Enable 2-factor authentication** on email accounts
5. **Use TLS/SSL** for secure email transmission

## Monitoring

The email service includes logging for:
- Email configuration (without sensitive data)
- Connection verification
- Email sending success/failure
- Error details for debugging

Check your server logs to monitor email service health.

## Next Steps

1. **Set up SMTP configuration** using the guide above
2. **Test the email service** using the test endpoints
3. **Switch to real email service** once configuration is working
4. **Test the complete forgot password flow** from the frontend
5. **Monitor email delivery** in production

## Support

If you continue to have issues:
1. Check the server logs for detailed error messages
2. Verify your email provider's SMTP settings
3. Test with a different email provider
4. Contact your email provider's support for SMTP configuration help
