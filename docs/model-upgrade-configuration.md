# Model Upgrade Configuration Guide

This document explains how to configure and manage the model upgrades implemented for the SQL Chatbot.

## Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Model Management Feature Flags
USE_LATEST_MODEL=true        # Enable latest GPT-5-nano model
USE_GPT5_ASSISTANT=false     # Enable GPT-5 when available (requires OPENAI_ASSISTANT_ID_GPT5)

# Future GPT-5 Assistant ID (when available)
OPENAI_ASSISTANT_ID_GPT5=    # Leave empty until GPT-5 is available
```

## Implementation Summary

The model upgrade implementation includes:

### 1. Dynamic Assistant Configuration
- **File**: `app/assistant-config.ts`
- **Features**: 
  - Dynamic assistant ID selection based on feature flags
  - Support for future GPT-5 integration
  - Backward compatibility with existing assistant

### 2. Assistant Update Endpoint
- **Endpoint**: `POST /api/assistants/update`
- **Purpose**: Upgrade existing assistant to GPT-5-nano
- **Features**:
  - Preserves conversation history
  - Enhanced SQL-specific function calling
  - Improved instructions for educational context

### 3. Enhanced Function Calling
- **Endpoint**: `/api/assistants/functions/sql`
- **Functions**:
  - `execute_sql_query`: Safe SQL execution with educational context
  - `get_database_schema`: Database structure analysis
  - `analyze_query_performance`: Query optimization suggestions

### 4. Usage Monitoring
- **Endpoint**: `/api/analytics/model-usage`
- **Features**:
  - Token and cost tracking
  - Anomaly detection
  - Model performance analytics

### 5. Rollback Strategy
- **Endpoint**: `POST /api/assistants/rollback`
- **Purpose**: Emergency rollback to stable model
- **Features**:
  - Instant model reversion
  - Reason logging
  - System health checks

### 6. Testing Framework
- **Endpoint**: `/api/assistants/test`
- **Test Types**:
  - Basic functionality
  - Hebrew language support
  - Function calling
  - Complex query analysis

### 7. Admin Interface
- **Page**: `/admin/model-management`
- **Features**:
  - Visual model management
  - One-click upgrades and rollbacks
  - Test execution
  - Usage analytics dashboard

## Upgrade Process

### Step 1: Enable Latest Model
```bash
# Set in .env.local
USE_LATEST_MODEL=true
```

### Step 2: Upgrade Assistant
```bash
curl -X POST http://localhost:3000/api/assistants/update
```

### Step 3: Test Functionality
```bash
# Test basic functionality
curl -X POST http://localhost:3000/api/assistants/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "basic"}'

# Test Hebrew support
curl -X POST http://localhost:3000/api/assistants/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "hebrew"}'
```

### Step 4: Monitor Usage
Visit `/admin/model-management` to monitor performance and usage.

## Rollback Process

### Emergency Rollback
```bash
curl -X POST http://localhost:3000/api/assistants/rollback \
  -H "Content-Type: application/json" \
  -d '{"reason": "Performance issues detected"}'
```

### Environment Variable Rollback
```bash
# Set in .env.local
USE_LATEST_MODEL=false
USE_GPT5_ASSISTANT=false
```

## Future GPT-5 Integration

When GPT-5 becomes available:

1. Create new GPT-5 assistant:
```bash
curl -X POST http://localhost:3000/api/assistants/migrate
```

2. Update environment variables:
```bash
OPENAI_ASSISTANT_ID_GPT5=your_new_gpt5_assistant_id
USE_GPT5_ASSISTANT=true
```

3. Test thoroughly before production deployment

## Monitoring and Alerts

### Usage Analytics
- Track token consumption
- Monitor cost per request
- Analyze performance metrics
- Detect anomalous usage patterns

### Health Checks
- Assistant availability
- Model response quality
- Function calling success rate
- System performance metrics

## Best Practices

1. **Gradual Rollout**: Test new models thoroughly before full deployment
2. **Monitoring**: Keep track of usage patterns and performance metrics
3. **Rollback Plan**: Always have a quick rollback strategy ready
4. **Documentation**: Document any issues or optimizations discovered
5. **User Feedback**: Collect feedback on model performance and accuracy

## Troubleshooting

### Common Issues

1. **Assistant Not Found**: Check `OPENAI_ASSISTANT_ID` environment variable
2. **Function Calling Errors**: Verify function definitions in update endpoint
3. **High Token Usage**: Review query complexity and response length
4. **Hebrew Display Issues**: Check font support and character encoding

### Debug Commands

```bash
# Check current assistant status
curl http://localhost:3000/api/assistants/update

# Get usage analytics
curl http://localhost:3000/api/analytics/model-usage?timeRange=24h

# Run system health check
curl -X PATCH http://localhost:3000/api/assistants/rollback
```

## Cost Optimization

1. **Smart Routing**: Use appropriate models based on query complexity
2. **Caching**: Implement response caching for common questions
3. **Batch Processing**: Use batch API for non-urgent operations
4. **Usage Limits**: Set per-user usage quotas
5. **Model Selection**: Choose GPT-4o-mini for simpler tasks when available

## Security Considerations

1. **Function Safety**: SQL execution functions include safety checks
2. **Input Validation**: All endpoints validate input parameters
3. **Rate Limiting**: Consider implementing rate limiting for API endpoints
4. **Audit Logging**: Track all model upgrades and rollbacks
5. **Access Control**: Restrict admin endpoints to authorized users
