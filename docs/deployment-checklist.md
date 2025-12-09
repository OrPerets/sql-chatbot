# Forgot Password Feature - Deployment Checklist

## Pre-Deployment Verification

### 1. Environment Variables Configuration
- [ ] `MONGODB_URI` - MongoDB connection string
- [ ] `DB_USERNAME` - Database username
- [ ] `DB_PASSWORD` - Database password
- [ ] `DB_NAME` - Database name
- [ ] `SMTP_HOST` - SMTP server host
- [ ] `SMTP_PORT` - SMTP server port (587 for TLS, 465 for SSL)
- [ ] `SMTP_USER` - SMTP username
- [ ] `SMTP_PASS` - SMTP password
- [ ] `SMTP_FROM` - From email address
- [ ] `NEXT_PUBLIC_BASE_URL` - Public application URL

### 2. Database Setup
- [ ] MongoDB connection is working
- [ ] Required collections exist:
  - [ ] `users` - User accounts
  - [ ] `password_reset_tokens` - Password reset tokens
  - [ ] `rate_limits` - Rate limiting data
  - [ ] `ip_rate_limits` - IP-based rate limiting
  - [ ] `security_events` - Security event logs
- [ ] Database indexes are created for performance
- [ ] Database backup is configured

### 3. Email Service Configuration
- [ ] SMTP credentials are valid and working
- [ ] Email service connection test passes
- [ ] Email templates are properly formatted
- [ ] Email rate limiting is configured
- [ ] Email security features are enabled

### 4. API Routes Verification
- [ ] `/api/auth/forgot-password` - Password reset request
- [ ] `/api/auth/reset-password/validate` - Token validation
- [ ] `/api/auth/reset-password` - Password reset completion
- [ ] All routes handle errors gracefully
- [ ] All routes have proper security measures

### 5. Frontend Components
- [ ] Login page has "Forgot Password" link
- [ ] Forgot password modal works correctly
- [ ] Reset password page loads and functions
- [ ] All Hebrew text displays correctly
- [ ] Responsive design works on mobile devices
- [ ] Loading states and error handling work

### 6. Security Features
- [ ] Rate limiting is active
- [ ] IP-based rate limiting is configured
- [ ] Suspicious activity detection is working
- [ ] Password strength validation is enforced
- [ ] Security event logging is active
- [ ] Email validation and sanitization work

### 7. Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] End-to-end tests pass
- [ ] Security tests pass
- [ ] Performance tests pass

## Deployment Steps

### 1. Code Deployment
```bash
# Build the application
npm run build

# Run tests
npm test

# Deploy to production
npm run deploy
```

### 2. Database Migration
```bash
# Run database setup script
npm run setup-database

# Verify collections exist
npm run verify-database
```

### 3. Environment Configuration
```bash
# Set production environment variables
export MONGODB_URI="your-production-mongodb-uri"
export SMTP_HOST="your-production-smtp-host"
export SMTP_USER="your-production-smtp-user"
export SMTP_PASS="your-production-smtp-password"
export NEXT_PUBLIC_BASE_URL="https://your-production-domain.com"
```

### 4. Service Verification
```bash
# Test email service
npm run test-email

# Test database connection
npm run test-database

# Test API endpoints
npm run test-api
```

## Post-Deployment Verification

### 1. Functional Testing
- [ ] Can request password reset with valid email
- [ ] Can request password reset with invalid email (returns success)
- [ ] Rate limiting works correctly
- [ ] Email is sent successfully
- [ ] Reset link works and expires correctly
- [ ] Password can be reset successfully
- [ ] Confirmation email is sent
- [ ] All error cases are handled properly

### 2. Security Testing
- [ ] Rate limiting prevents abuse
- [ ] Suspicious activity is detected and logged
- [ ] Weak passwords are rejected
- [ ] Invalid tokens are rejected
- [ ] Expired tokens are rejected
- [ ] Used tokens are rejected
- [ ] Security events are logged

### 3. Performance Testing
- [ ] API response times are acceptable (< 2 seconds)
- [ ] Database queries are optimized
- [ ] Email sending doesn't block requests
- [ ] Rate limiting doesn't impact legitimate users
- [ ] Memory usage is stable

### 4. Monitoring Setup
- [ ] Application logs are being collected
- [ ] Error tracking is configured
- [ ] Performance monitoring is active
- [ ] Security event alerts are set up
- [ ] Database monitoring is configured

## Production Configuration

### 1. Rate Limiting Configuration
```typescript
// Production rate limits
export const productionRateLimits = {
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3 // 3 requests per hour per email
  },
  ipPasswordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5 // 5 requests per hour per IP
  },
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // 5 login attempts per 15 minutes
  }
}
```

### 2. Security Configuration
```typescript
// Production security settings
export const productionSecurityConfig = {
  passwordStrength: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },
  tokenExpiration: {
    passwordReset: 60 * 60 * 1000, // 1 hour
    session: 24 * 60 * 60 * 1000 // 24 hours
  },
  suspiciousActivity: {
    riskThreshold: 70,
    maxIPsPerEmail: 3,
    maxFailedLogins: 3
  }
}
```

### 3. Email Configuration
```typescript
// Production email settings
export const productionEmailConfig = {
  maxEmailsPerHour: 10,
  maxEmailsPerDay: 50,
  blockedDomains: [
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com'
  ],
  requireVerification: true
}
```

## Monitoring and Alerts

### 1. Key Metrics to Monitor
- Password reset request rate
- Email delivery success rate
- API response times
- Error rates
- Security event frequency
- Rate limit violations

### 2. Alert Thresholds
- Email delivery failure rate > 5%
- API error rate > 1%
- Response time > 5 seconds
- Security events > 10 per hour
- Rate limit violations > 50 per hour

### 3. Log Analysis
- Monitor security events for patterns
- Track failed password reset attempts
- Analyze rate limit violations
- Review suspicious activity reports

## Maintenance Tasks

### 1. Daily Tasks
- [ ] Check error logs
- [ ] Monitor email delivery rates
- [ ] Review security events
- [ ] Verify rate limiting is working

### 2. Weekly Tasks
- [ ] Clean up expired tokens
- [ ] Review security event patterns
- [ ] Check database performance
- [ ] Update security configurations if needed

### 3. Monthly Tasks
- [ ] Review and rotate security keys
- [ ] Update email templates
- [ ] Analyze usage patterns
- [ ] Review and update rate limits

## Rollback Plan

### 1. Immediate Rollback
```bash
# Revert to previous deployment
git revert HEAD
npm run deploy

# Disable forgot password feature
export DISABLE_FORGOT_PASSWORD=true
```

### 2. Database Rollback
```bash
# Restore from backup
mongorestore --db experiment backup/

# Remove new collections if needed
mongo experiment --eval "db.password_reset_tokens.drop()"
```

### 3. Configuration Rollback
```bash
# Revert environment variables
export SMTP_HOST="previous-smtp-host"
export SMTP_USER="previous-smtp-user"
export SMTP_PASS="previous-smtp-password"
```

## Troubleshooting Guide

### Common Issues

#### 1. Email Not Sending
- Check SMTP credentials
- Verify SMTP server is accessible
- Check rate limiting settings
- Review email service logs

#### 2. Database Connection Issues
- Verify MongoDB URI
- Check network connectivity
- Review connection pool settings
- Check database permissions

#### 3. Rate Limiting Issues
- Check rate limit configuration
- Review IP-based limits
- Verify rate limit cleanup is running
- Check for IP address changes

#### 4. Security Event False Positives
- Review suspicious activity thresholds
- Adjust risk scoring parameters
- Whitelist legitimate IPs if needed
- Update user agent patterns

### Debug Commands
```bash
# Test email service
npm run test-email -- --verbose

# Test database connection
npm run test-database -- --verbose

# Check rate limits
npm run check-rate-limits

# View security events
npm run view-security-events -- --last 24h
```

## Success Criteria

The deployment is considered successful when:

1. ✅ All functional tests pass
2. ✅ Security features are working correctly
3. ✅ Performance meets requirements
4. ✅ Monitoring is active and alerting
5. ✅ Error rates are within acceptable limits
6. ✅ User experience is smooth and intuitive
7. ✅ Hebrew localization works correctly
8. ✅ Mobile responsiveness is maintained
9. ✅ Email delivery is reliable
10. ✅ Rate limiting prevents abuse

## Post-Deployment Support

### 1. User Support
- Document common issues and solutions
- Provide user guide for password reset
- Set up support ticket system
- Train support staff on new features

### 2. Technical Support
- Monitor system health
- Respond to alerts promptly
- Maintain documentation
- Plan for future enhancements

### 3. Security Support
- Review security events daily
- Investigate suspicious activity
- Update security measures as needed
- Conduct regular security audits
