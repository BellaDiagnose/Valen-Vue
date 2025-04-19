/**
 * Centralized logging utility for the application
 * This module provides a consistent interface for logging across the app
 * and integrates with the LogOverlay component.
 */

// Log levels
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// Logger state
let logOverlayComponent = null;

// Format message consistently
function formatMessage(msg, level) {
  if (typeof msg === 'string') {
    return { title: level.toUpperCase(), message: msg };
  } else if (typeof msg === 'object' && msg !== null) {
    return {
      title: msg.title || level.toUpperCase(),
      message: msg.message || JSON.stringify(msg)
    };
  } else {
    return { title: level.toUpperCase(), message: String(msg) };
  }
}

// Logging functions
const logger = {
  /**
   * Set the log overlay component reference
   * @param {Object} component - Vue component reference to LogOverlay
   */
  setLogComponent(component) {
    logOverlayComponent = component;
  },
  
  /**
   * Log a debug message
   * @param {string|object} msg - Message to log
   */
  debug(msg) {
    const formattedMsg = formatMessage(msg, LOG_LEVELS.DEBUG);
    console.debug('%c' + formattedMsg.title + '%c ' + formattedMsg.message, 
      'background:#2196F3;color:white;padding:2px 6px;border-radius:2px;', 
      'color:#333;');
      
    if (logOverlayComponent) {
      logOverlayComponent.addLog(formattedMsg.message, LOG_LEVELS.DEBUG);
    }
  },

  /**
   * Log an info message
   * @param {string|object} msg - Message to log
   */
  info(msg) {
    const formattedMsg = formatMessage(msg, LOG_LEVELS.INFO);
    console.log('%c' + formattedMsg.title + '%c ' + formattedMsg.message, 
      'background:#4CAF50;color:white;padding:2px 6px;border-radius:2px;', 
      'color:#333;');
      
    if (logOverlayComponent) {
      logOverlayComponent.addLog(formattedMsg.message, LOG_LEVELS.INFO);
    }
  },
  
  /**
   * Log a warning message
   * @param {string|object} msg - Message to log
   */
  warn(msg) {
    const formattedMsg = formatMessage(msg, LOG_LEVELS.WARN);
    console.warn('%c' + formattedMsg.title + '%c ' + formattedMsg.message, 
      'background:#FF9800;color:white;padding:2px 6px;border-radius:2px;', 
      'color:#333;');
      
    if (logOverlayComponent) {
      logOverlayComponent.addLog(formattedMsg.message, LOG_LEVELS.WARN);
    }
  },
  
  /**
   * Log an error message
   * @param {string|object} msg - Message to log
   */
  error(msg) {
    const formattedMsg = formatMessage(msg, LOG_LEVELS.ERROR);
    console.error('%c' + formattedMsg.title + '%c ' + formattedMsg.message, 
      'background:#F44336;color:white;padding:2px 6px;border-radius:2px;', 
      'color:#333;');
      
    if (logOverlayComponent) {
      logOverlayComponent.addLog(formattedMsg.message, LOG_LEVELS.ERROR);
    }
  },
  
  /**
   * Show the log overlay
   */
  show() {
    if (logOverlayComponent) {
      logOverlayComponent.isVisible = true;
    }
  },
  
  /**
   * Hide the log overlay
   */
  hide() {
    if (logOverlayComponent) {
      logOverlayComponent.isVisible = false;
    }
  },
  
  /**
   * Toggle the log overlay visibility
   */
  toggle() {
    if (logOverlayComponent) {
      logOverlayComponent.toggleVisibility();
    }
  },
  
  /**
   * Clear all logs
   */
  clear() {
    if (logOverlayComponent) {
      logOverlayComponent.clearLogs();
    }
  },
  
  // Alias for backward compatibility
  log: function(msg) {
    this.info(msg);
  }
};

export default logger;