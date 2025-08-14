/**
 * Kill Switch & Maintenance Mode
 * Provides emergency shutdown and safe maintenance capabilities
 */

// Global state (in production, use Redis or similar)
let KILL_SWITCH_ACTIVE = false;
let MAINTENANCE_MODE = false;
let MAINTENANCE_MESSAGE = 'We are currently performing maintenance. Please check back shortly.';
let ALLOWED_IPS = [];
let EMERGENCY_CONTACTS = [];

// Check environment for initial state
if (process.env.MAINTENANCE_MODE === 'true') {
  MAINTENANCE_MODE = true;
}

if (process.env.KILL_SWITCH === 'true') {
  KILL_SWITCH_ACTIVE = true;
}

if (process.env.MAINTENANCE_MESSAGE) {
  MAINTENANCE_MESSAGE = process.env.MAINTENANCE_MESSAGE;
}

if (process.env.ALLOWED_IPS) {
  ALLOWED_IPS = process.env.ALLOWED_IPS.split(',').map(ip => ip.trim());
}

/**
 * Activate kill switch (emergency shutdown)
 * @param {string} reason - Reason for activation
 * @returns {boolean} - Success status
 */
export function activateKillSwitch(reason = 'Emergency shutdown') {
  console.error(`[KILL SWITCH] ACTIVATED: ${reason}`);
  
  KILL_SWITCH_ACTIVE = true;
  
  // Log to monitoring
  logEmergency('kill_switch_activated', { reason, timestamp: new Date().toISOString() });
  
  // Notify emergency contacts
  notifyEmergencyContacts(`Kill switch activated: ${reason}`);
  
  return true;
}

/**
 * Deactivate kill switch
 * @param {string} authorizedBy - Who authorized the deactivation
 * @returns {boolean} - Success status
 */
export function deactivateKillSwitch(authorizedBy) {
  if (!authorizedBy) {
    console.error('[KILL SWITCH] Deactivation requires authorization');
    return false;
  }
  
  console.warn(`[KILL SWITCH] Deactivated by ${authorizedBy}`);
  
  KILL_SWITCH_ACTIVE = false;
  
  // Log to monitoring
  logEmergency('kill_switch_deactivated', { 
    authorizedBy, 
    timestamp: new Date().toISOString() 
  });
  
  return true;
}

/**
 * Check if kill switch is active
 * @returns {boolean} - Whether kill switch is active
 */
export function isKillSwitchActive() {
  return KILL_SWITCH_ACTIVE;
}

/**
 * Enable maintenance mode
 * @param {object} options - Maintenance options
 * @returns {boolean} - Success status
 */
export function enableMaintenanceMode(options = {}) {
  const {
    message = MAINTENANCE_MESSAGE,
    allowedIPs = [],
    estimatedDuration = null
  } = options;
  
  MAINTENANCE_MODE = true;
  MAINTENANCE_MESSAGE = message;
  
  if (allowedIPs.length > 0) {
    ALLOWED_IPS = allowedIPs;
  }
  
  console.warn('[MAINTENANCE] Mode enabled');
  console.warn(`[MAINTENANCE] Message: ${message}`);
  console.warn(`[MAINTENANCE] Allowed IPs: ${ALLOWED_IPS.join(', ') || 'none'}`);
  
  if (estimatedDuration) {
    console.warn(`[MAINTENANCE] Estimated duration: ${estimatedDuration}`);
  }
  
  // Log to monitoring
  logEmergency('maintenance_enabled', { 
    message,
    allowedIPs: ALLOWED_IPS,
    estimatedDuration,
    timestamp: new Date().toISOString()
  });
  
  return true;
}

/**
 * Disable maintenance mode
 * @returns {boolean} - Success status
 */
export function disableMaintenanceMode() {
  MAINTENANCE_MODE = false;
  ALLOWED_IPS = [];
  
  console.warn('[MAINTENANCE] Mode disabled');
  
  // Log to monitoring
  logEmergency('maintenance_disabled', { 
    timestamp: new Date().toISOString()
  });
  
  return true;
}

/**
 * Check if in maintenance mode
 * @param {string} clientIP - Client IP address
 * @returns {object} - { inMaintenance: boolean, allowed: boolean, message: string }
 */
export function checkMaintenanceMode(clientIP) {
  if (!MAINTENANCE_MODE) {
    return { inMaintenance: false, allowed: true };
  }
  
  // Check if IP is allowed
  const allowed = ALLOWED_IPS.length === 0 || 
                  ALLOWED_IPS.includes(clientIP) ||
                  (clientIP === '127.0.0.1' || clientIP === '::1'); // Always allow localhost
  
  return {
    inMaintenance: true,
    allowed,
    message: MAINTENANCE_MESSAGE
  };
}

/**
 * Create kill switch middleware
 * @returns {function} - Middleware function
 */
export function killSwitchMiddleware() {
  return (req, res, next) => {
    // Check kill switch first (highest priority)
    if (isKillSwitchActive()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'This service is temporarily unavailable. Please try again later.',
        code: 'KILL_SWITCH_ACTIVE'
      });
    }
    
    // Get client IP
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                    req.headers['x-real-ip'] ||
                    req.connection?.remoteAddress ||
                    'unknown';
    
    // Check maintenance mode
    const maintenance = checkMaintenanceMode(clientIP);
    
    if (maintenance.inMaintenance && !maintenance.allowed) {
      // Return maintenance page/message
      const isApiRequest = req.path.startsWith('/api/');
      
      if (isApiRequest) {
        return res.status(503).json({
          error: 'Maintenance Mode',
          message: maintenance.message,
          code: 'MAINTENANCE_MODE'
        });
      } else {
        // Return HTML maintenance page
        return res.status(503).send(getMaintenanceHTML(maintenance.message));
      }
    }
    
    next();
  };
}

/**
 * Get maintenance HTML page
 * @param {string} message - Maintenance message
 * @returns {string} - HTML content
 */
function getMaintenanceHTML(message) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maintenance - Coral Beach & Tennis Club</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container {
            text-align: center;
            max-width: 600px;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }
        p {
            font-size: 1.2rem;
            line-height: 1.6;
            opacity: 0.95;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔧</div>
        <h1>We'll Be Right Back</h1>
        <p>${message}</p>
        <p style="margin-top: 2rem; font-size: 1rem; opacity: 0.8;">
            Thank you for your patience.<br>
            - Coral Beach & Tennis Club
        </p>
    </div>
</body>
</html>
  `;
}

/**
 * Log emergency event
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function logEmergency(event, data) {
  const logEntry = {
    event,
    ...data,
    severity: 'EMERGENCY',
    timestamp: new Date().toISOString()
  };
  
  // In production, send to monitoring service
  console.error('[EMERGENCY]', JSON.stringify(logEntry));
  
  // Also write to file if possible
  try {
    const fs = require('fs');
    const logFile = process.env.EMERGENCY_LOG_FILE || './emergency.log';
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    // Ignore file write errors
  }
}

/**
 * Notify emergency contacts
 * @param {string} message - Emergency message
 */
function notifyEmergencyContacts(message) {
  if (EMERGENCY_CONTACTS.length === 0) {
    console.warn('[EMERGENCY] No emergency contacts configured');
    return;
  }
  
  // In production, send notifications via:
  // - Email
  // - SMS
  // - Slack/Discord
  // - PagerDuty
  
  console.error(`[EMERGENCY] Notifying ${EMERGENCY_CONTACTS.length} contacts: ${message}`);
}

/**
 * Health check that respects kill switch and maintenance
 * @returns {object} - Health status
 */
export function getHealthStatus() {
  if (isKillSwitchActive()) {
    return {
      status: 'error',
      message: 'Kill switch active',
      timestamp: new Date().toISOString()
    };
  }
  
  if (MAINTENANCE_MODE) {
    return {
      status: 'maintenance',
      message: MAINTENANCE_MESSAGE,
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString()
  };
}

/**
 * Circuit breaker for external services
 * @param {string} service - Service name
 * @param {function} operation - Operation to perform
 * @param {object} options - Circuit breaker options
 * @returns {Promise} - Operation result
 */
export async function circuitBreaker(service, operation, options = {}) {
  const {
    maxFailures = 5,
    resetTimeout = 60000,  // 1 minute
    timeout = 10000  // 10 seconds
  } = options;
  
  // Check if kill switch is active
  if (isKillSwitchActive()) {
    throw new Error('Service disabled by kill switch');
  }
  
  // Simple circuit breaker implementation
  // In production, use a library like opossum
  
  try {
    // Add timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), timeout)
    );
    
    const result = await Promise.race([
      operation(),
      timeoutPromise
    ]);
    
    return result;
  } catch (error) {
    console.error(`[CIRCUIT BREAKER] ${service} failed:`, error.message);
    throw error;
  }
}

/**
 * Export status for monitoring
 */
export function getSystemStatus() {
  return {
    killSwitch: KILL_SWITCH_ACTIVE,
    maintenance: MAINTENANCE_MODE,
    maintenanceMessage: MAINTENANCE_MESSAGE,
    allowedIPs: ALLOWED_IPS.length,
    health: getHealthStatus()
  };
}