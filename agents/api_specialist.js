/**
 * API Specialist Agent
 * 
 * This agent ensures API calls are correct, properly error-handled,
 * and follow best practices.
 */

const APISpecialist = {
  name: 'API Specialist',
  description: 'Reviews and optimizes API integrations and error handling',
  
  async analyzeAPICall(apiCall) {
    const issues = []
    const improvements = []
    const bestPractices = {
      hasErrorHandling: false,
      hasTimeout: false,
      hasRetry: false,
      hasLogging: false,
      hasValidation: false,
      hasAuthentication: false,
      hasRateLimiting: false,
    }
    
    // Check for error handling
    if (apiCall.includes('try') && apiCall.includes('catch')) {
      bestPractices.hasErrorHandling = true
    } else {
      issues.push('Missing proper error handling')
      improvements.push('Wrap API calls in try-catch blocks')
    }
    
    // Check for timeout configuration
    if (apiCall.includes('timeout') || apiCall.includes('AbortController')) {
      bestPractices.hasTimeout = true
    } else {
      improvements.push('Add timeout configuration to prevent hanging requests')
    }
    
    // Check for retry logic
    if (apiCall.includes('retry') || apiCall.includes('attempts')) {
      bestPractices.hasRetry = true
    } else {
      improvements.push('Implement retry logic for transient failures')
    }
    
    // Check for request/response validation
    if (apiCall.includes('validate') || apiCall.includes('schema')) {
      bestPractices.hasValidation = true
    } else {
      issues.push('No input/output validation detected')
      improvements.push('Add validation for API request and response data')
    }
    
    // Check for authentication headers
    if (apiCall.includes('Authorization') || apiCall.includes('Bearer') || apiCall.includes('apiKey')) {
      bestPractices.hasAuthentication = true
    } else if (apiCall.includes('/api/')) {
      issues.push('API call may need authentication')
      improvements.push('Ensure proper authentication headers are included')
    }
    
    return {
      issues,
      improvements,
      bestPractices,
      score: Object.values(bestPractices).filter(Boolean).length / Object.keys(bestPractices).length * 100,
    }
  },
  
  async generateAPIEndpointSpec(endpoint) {
    return {
      endpoint,
      method: endpoint.includes('POST') ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${token}',
      },
      requestSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      responseSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
        },
      },
      errorCodes: [
        { code: 400, description: 'Bad Request - Invalid input' },
        { code: 401, description: 'Unauthorized - Invalid authentication' },
        { code: 403, description: 'Forbidden - Insufficient permissions' },
        { code: 404, description: 'Not Found - Resource does not exist' },
        { code: 429, description: 'Too Many Requests - Rate limit exceeded' },
        { code: 500, description: 'Internal Server Error' },
      ],
      rateLimiting: {
        requests: 100,
        window: '1m',
      },
    }
  },
  
  async reviewAPIIntegration(apiCalls) {
    const reports = []
    
    for (const apiCall of apiCalls) {
      const analysis = await this.analyzeAPICall(apiCall.code)
      const spec = await this.generateAPIEndpointSpec(apiCall.endpoint)
      
      reports.push({
        endpoint: apiCall.endpoint,
        analysis,
        specification: spec,
        recommendations: [
          ...analysis.improvements,
          'Document API endpoints with OpenAPI/Swagger',
          'Implement request caching where appropriate',
          'Use environment variables for API endpoints',
          'Add request/response interceptors for common logic',
        ],
      })
    }
    
    return {
      agent: this.name,
      reports,
      overallScore: reports.reduce((acc, r) => acc + r.analysis.score, 0) / reports.length,
      globalRecommendations: [
        'Create a centralized API client/service',
        'Implement global error handling',
        'Add request/response logging for debugging',
        'Use TypeScript for type-safe API contracts',
        'Implement API versioning strategy',
      ],
    }
  },
}

module.exports = APISpecialist