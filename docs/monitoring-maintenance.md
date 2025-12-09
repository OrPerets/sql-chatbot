# Monitoring and Maintenance Guide

## Overview

This document provides comprehensive guidance for monitoring and maintaining the forgot password feature and overall system health. The monitoring system tracks performance metrics, security events, and system health indicators.

## Monitoring Features

### 1. Real-time Metrics Collection

The system automatically collects the following metrics:

- **Password Reset Requests**: Total number of password reset requests
- **Success Rate**: Percentage of successful password resets
- **Email Delivery Rate**: Percentage of successfully delivered emails
- **Response Time**: Average API response time
- **Error Rate**: Percentage of failed requests
- **Rate Limit Violations**: Number of rate limit violations
- **Suspicious Activities**: Number of detected suspicious activities

### 2. Alert System

The system automatically creates alerts when:

- Error rate exceeds 5%
- Average response time exceeds 5 seconds
- Rate limit violations exceed 50 per hour
- Suspicious activities exceed 10 per hour
- Email delivery failures exceed 10 per hour

### 3. Security Event Logging

All security-related events are logged including:

- Login attempts (successful and failed)
- Password reset requests
- Rate limit violations
- Suspicious activity detection
- Email delivery events

## Monitoring Dashboard

### Accessing the Dashboard

The monitoring dashboard is available at `/admin/monitoring` for administrators.

### Dashboard Features

1. **Summary Cards**: Key metrics at a glance
2. **Active Alerts**: Current system alerts with severity levels
3. **Recommendations**: Automated recommendations based on metrics
4. **Performance Charts**: Visual representation of system performance
5. **Real-time Updates**: Auto-refresh every 30 seconds

### Alert Management

- **Acknowledge**: Mark alerts as acknowledged
- **Resolve**: Mark alerts as resolved
- **Severity Levels**: Critical, High, Medium, Low

## Maintenance Tasks

### Automated Maintenance

The system includes several automated maintenance tasks:

1. **Metrics Collection**: Collects and stores performance metrics
2. **Alert Checking**: Monitors metrics and creates alerts
3. **Token Cleanup**: Removes expired password reset tokens
4. **Rate Limit Cleanup**: Removes expired rate limit entries
5. **Security Event Cleanup**: Removes old security events (30+ days)
6. **Monitoring Data Cleanup**: Removes old metrics and resolved alerts
7. **Security Analysis**: Analyzes security patterns
8. **Rate Limiter Cleanup**: Cleans up rate limiter data

### Running Maintenance

#### Run All Maintenance Tasks
```bash
npm run maintenance
```

#### List Available Tasks
```bash
npm run maintenance:list
```

#### Run Specific Task
```bash
npm run maintenance:task "Cleanup Expired Tokens"
```

### Manual Maintenance Commands

#### Database Setup
```bash
npm run setup-database
```

#### Deployment Verification
```bash
npm run verify-deployment
```

#### Token Cleanup
```bash
npm run cleanup-tokens
```

#### View Statistics
```bash
npm run cleanup-stats
```

## Monitoring API

### Endpoints

#### Get Monitoring Report
```http
GET /api/admin/monitoring?hours=24&type=summary
```

Parameters:
- `hours`: Time window for metrics (default: 24)
- `type`: Report type (summary, metrics, alerts, current)

#### Acknowledge Alert
```http
POST /api/admin/monitoring
Content-Type: application/json

{
  "action": "acknowledge",
  "alertId": "alert_id_here"
}
```

#### Resolve Alert
```http
POST /api/admin/monitoring
Content-Type: application/json

{
  "action": "resolve",
  "alertId": "alert_id_here"
}
```

#### Run Cleanup
```http
POST /api/admin/monitoring
Content-Type: application/json

{
  "action": "cleanup"
}
```

## Database Collections

### Monitoring Collections

1. **monitoring_metrics**: Stores performance metrics over time
2. **alerts**: Stores system alerts and their status
3. **security_events**: Stores security-related events
4. **rate_limits**: Stores rate limiting data
5. **ip_rate_limits**: Stores IP-based rate limiting data
6. **password_reset_tokens**: Stores password reset tokens

### Indexes

All collections have appropriate indexes for:
- Time-based queries
- Email lookups
- IP address lookups
- Token lookups
- TTL (Time To Live) for automatic cleanup

## Performance Optimization

### Database Optimization

1. **TTL Indexes**: Automatic cleanup of expired data
2. **Compound Indexes**: Optimized for common query patterns
3. **Collection Validation**: Data integrity enforcement

### Rate Limiting

1. **User-based Limits**: 3 password resets per hour per email
2. **IP-based Limits**: 5 password resets per hour per IP
3. **Automatic Cleanup**: Expired rate limit entries are removed

### Email Optimization

1. **Rate Limiting**: 10 emails per hour, 50 per day per email
2. **Content Sanitization**: Prevents malicious content
3. **Domain Filtering**: Blocks temporary email domains

## Security Monitoring

### Suspicious Activity Detection

The system monitors for:

1. **Multiple IPs**: Same email from different IPs
2. **Rapid Requests**: Multiple password resets in short time
3. **Failed Logins**: Multiple failed login attempts
4. **Rate Limit Violations**: Repeated rate limit violations
5. **Suspicious User Agents**: Bot-like user agents

### Risk Scoring

Activities are scored based on:
- Number of different IPs used
- Frequency of requests
- Failed attempts
- User agent patterns

### Automatic Responses

- **Low Risk (0-30)**: Logged for monitoring
- **Medium Risk (31-50)**: Logged with increased attention
- **High Risk (51-70)**: Logged and may trigger additional monitoring
- **Critical Risk (71+)**: Blocked automatically

## Troubleshooting

### Common Issues

#### High Error Rate
1. Check email service configuration
2. Verify database connectivity
3. Review rate limiting settings
4. Check for suspicious activity

#### Slow Response Times
1. Check database performance
2. Review query optimization
3. Check network connectivity
4. Monitor resource usage

#### Email Delivery Issues
1. Verify SMTP credentials
2. Check email service status
3. Review rate limiting
4. Check blocked domains

#### High Rate Limit Violations
1. Review rate limit settings
2. Check for automated attacks
3. Consider adjusting limits
4. Monitor IP patterns

### Debug Commands

#### Check System Health
```bash
npm run verify-deployment
```

#### View Current Statistics
```bash
npm run cleanup-stats
```

#### Test Email Service
```bash
# Check email service in monitoring dashboard
```

#### Review Security Events
```bash
# Use monitoring dashboard to view recent events
```

## Best Practices

### Monitoring

1. **Regular Review**: Check monitoring dashboard daily
2. **Alert Response**: Acknowledge and resolve alerts promptly
3. **Trend Analysis**: Monitor trends over time
4. **Capacity Planning**: Use metrics for capacity planning

### Maintenance

1. **Scheduled Runs**: Run maintenance tasks regularly
2. **Cleanup**: Ensure cleanup tasks run daily
3. **Backup**: Regular database backups
4. **Updates**: Keep system components updated

### Security

1. **Review Alerts**: Check security alerts daily
2. **Investigate Suspicious Activity**: Follow up on high-risk activities
3. **Update Rules**: Adjust security rules based on patterns
4. **Documentation**: Document security incidents

## Automation

### Cron Jobs

Set up cron jobs for regular maintenance:

```bash
# Daily cleanup at 2 AM
0 2 * * * cd /path/to/app && npm run maintenance

# Hourly metrics collection
0 * * * * cd /path/to/app && npm run maintenance:task "Collect Metrics"

# Weekly security analysis
0 3 * * 0 cd /path/to/app && npm run maintenance:task "Security Analysis"
```

### Monitoring Alerts

Configure external monitoring to check:

1. **API Health**: Regular health checks
2. **Email Delivery**: Monitor email service status
3. **Database Health**: Check database connectivity
4. **Response Times**: Monitor API response times

## Scaling Considerations

### High Volume

For high-volume deployments:

1. **Database Sharding**: Consider sharding for large datasets
2. **Caching**: Implement Redis for rate limiting
3. **Load Balancing**: Distribute load across multiple instances
4. **Monitoring**: Enhanced monitoring for distributed systems

### Performance Tuning

1. **Connection Pooling**: Optimize database connections
2. **Index Optimization**: Regular index analysis
3. **Query Optimization**: Monitor and optimize slow queries
4. **Resource Monitoring**: Monitor CPU, memory, and disk usage

## Support and Maintenance

### Regular Tasks

#### Daily
- [ ] Check monitoring dashboard
- [ ] Review active alerts
- [ ] Monitor error rates
- [ ] Check email delivery rates

#### Weekly
- [ ] Review security events
- [ ] Analyze performance trends
- [ ] Check rate limit violations
- [ ] Review recommendations

#### Monthly
- [ ] Performance analysis
- [ ] Security review
- [ ] Capacity planning
- [ ] System updates

### Emergency Procedures

#### High Error Rate
1. Check system health
2. Review recent changes
3. Check external dependencies
4. Implement temporary fixes
5. Escalate if needed

#### Security Incident
1. Review security events
2. Identify affected users
3. Implement additional monitoring
4. Document incident
5. Update security rules

#### Performance Issues
1. Check resource usage
2. Review database performance
3. Check network connectivity
4. Optimize queries
5. Scale resources if needed

## Conclusion

The monitoring and maintenance system provides comprehensive oversight of the forgot password feature and overall system health. Regular monitoring, proactive maintenance, and prompt response to alerts ensure optimal system performance and security.

For additional support or questions, refer to the system documentation or contact the development team.
