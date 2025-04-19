<template>
  <div class="log-overlay" :class="{ 'is-visible': isVisible }">
    <div class="log-header">
      <div class="log-controls">
        <button @click="clearLogs">Clear</button>
        <button @click="toggleVisibility">{{ isVisible ? 'Hide' : 'Show' }} Logs</button>
      </div>
    </div>
    <div class="log-content" ref="logContent">
      <div v-for="(log, index) in logs" :key="index" class="log-entry" :class="log.level">
        <span class="log-time">{{ log.time }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
    
    <!-- Always visible tab to show logs when collapsed -->
    <div class="log-tab" v-if="!isVisible" @click="toggleVisibility">
      <span>Show Logs ({{logs.length}})</span>
    </div>
  </div>
</template>

<script>
import logger from '../utils/logger';

export default {
  name: 'LogOverlay',
  
  data() {
    return {
      logs: [],
      isVisible: false, // Make initially hidden
      maxLogs: 100 // Limit to prevent memory issues
    };
  },
  
  methods: {
    addLog(message, level = 'info') {
      const now = new Date();
      const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}.${now.getMilliseconds()}`;
      
      this.logs.push({
        time,
        message: typeof message === 'object' ? JSON.stringify(message) : message,
        level
      });
      
      // Limit the number of logs
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
      
      // Auto-scroll to bottom
      this.$nextTick(() => {
        if (this.$refs.logContent) {
          this.$refs.logContent.scrollTop = this.$refs.logContent.scrollHeight;
        }
      });
    },
    
    clearLogs() {
      this.logs = [];
    },
    
    toggleVisibility() {
      this.isVisible = !this.isVisible;
    }
  },
  
  mounted() {
    // Register this component with the logger utility
    logger.setLogComponent(this);
    
    // Set up the global appLogger reference for backward compatibility
    window.appLogger = logger;
    
    // Add a welcome log to ensure something is visible
    logger.info('Log system initialized');
    logger.info('Press Ctrl+L to toggle log visibility');
    
    // Add keyboard shortcut (Ctrl+L) to toggle logs
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.toggleVisibility();
      }
    });
  },
  
  beforeUnmount() {
    // Remove keyboard shortcut
    window.removeEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.toggleVisibility();
      }
    });
  }
};
</script>

<style scoped>
.log-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 300px;
  background-color: rgba(0, 0, 0, 0.85);
  color: #f0f0f0;
  font-family: monospace;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s ease;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
}

.log-overlay.is-visible {
  transform: translateY(0);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background-color: #333;
  border-bottom: 1px solid #555;
}

.log-header h3 {
  margin: 0;
  font-size: 14px;
}

.log-controls button {
  background: #555;
  color: white;
  border: none;
  padding: 3px 8px;
  margin-left: 5px;
  border-radius: 3px;
  cursor: pointer;
}

.log-controls button:hover {
  background: #666;
}

.log-content {
  overflow-y: auto;
  height: calc(100% - 30px);
  padding: 5px;
}

.log-entry {
  padding: 2px 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #888;
  margin-right: 10px;
}

.log-entry.info .log-message {
  color: #4CAF50;
}

.log-entry.warn {
  background-color: rgba(255, 193, 7, 0.2);
}

.log-entry.warn .log-message {
  color: #FFC107;
}

.log-entry.error {
  background-color: rgba(244, 67, 54, 0.2);
}

.log-entry.error .log-message {
  color: #F44336;
}

.log-entry.debug .log-message {
  color: #2196F3;
}

/* Add a visible tab when logs are hidden */
.log-tab {
  position: fixed;
  bottom: 0;
  right: 50px;
  background-color: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 5px 15px;
  border-radius: 5px 5px 0 0;
  cursor: pointer;
  z-index: 9999;
}

.log-tab:hover {
  background-color: #333;
}

/* Make sure initially visible */
.log-overlay.is-visible {
  transform: translateY(0);
}
</style>
