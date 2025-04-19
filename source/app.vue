<template>
  <div id="app">
    <div class="top-navigation" v-if="!isHomePage">
      <div class="nav-container">
        <router-link to="/" class="nav-logo">Valen</router-link>
        
        <div class="nav-links">
          <router-link to="/" class="nav-item">
            <img src="./assets/icons/home.png" alt="Home" class="nav-icon">
            <span>{{ $t('routes.home') }}</span>
          </router-link>
          
          <router-link to="/patient" class="nav-item">
            <img src="./assets/icons/patient.png" alt="Patient" class="nav-icon">
            <span>{{ $t('routes.patient') }}</span>
          </router-link>
          <router-link to="/diagnosis" class="nav-item">
            <img src="./assets/icons/diagnosis.png" alt="Diagnosis" class="nav-icon">
            <span>{{ $t('routes.diagnosis') }}</span>
          </router-link>
          <router-link to="/survey" class="nav-item">
            <img src="./assets/icons/survey.png" alt="Survey" class="nav-icon">
            <span>{{ $t('routes.survey') }}</span>
          </router-link>
          <router-link to="/predict" class="nav-item">
            <img src="./assets/icons/predict.png" alt="Report" class="nav-icon">
            <span>{{ $t('routes.report') }}</span>
          </router-link>

          <!-- Sensor dropdown -->
          <div class="nav-item dropdown" @click="toggleSensorDropdown" ref="sensorDropdown">
            <img src="./assets/icons/sensor.png" alt="Sensor" class="nav-icon">
            <span>{{ $t('routes.sensor') }}</span>
            <img src="./assets/icons/dropdown.png" alt="Dropdown" class="dropdown-icon" :class="{ 'dropdown-open': sensorOpen }">
            
            <!-- Dropdown menu -->
            <div class="dropdown-menu" v-show="sensorOpen">
              <router-link to="/eeg" class="dropdown-item">
                <img src="./assets/icons/eeg.png" alt="EEG" class="nav-icon">
                <span>{{ $t('routes.eeg') }}</span>
              </router-link>
              <router-link to="/imu" class="dropdown-item">
                <img src="./assets/icons/imu.png" alt="IMU" class="nav-icon">
                <span>{{ $t('routes.imu') }}</span>
              </router-link>
              <router-link to="/heart" class="dropdown-item">
                <img src="./assets/icons/heart.png" alt="Heart" class="nav-icon">
                <span>{{ $t('routes.heart') }}</span>
              </router-link>
            </div>
          </div>
          
          <!-- Settings dropdown -->
          <div class="nav-item dropdown" @click="toggleSettingsDropdown" ref="settingsDropdown">
            <img src="./assets/icons/setting.png" alt="Setting" class="nav-icon">
            <span>{{ $t('routes.setting') }}</span>
            <img src="./assets/icons/dropdown.png" alt="Dropdown" class="dropdown-icon" :class="{ 'dropdown-open': settingsOpen }">
            
            <!-- Dropdown menu -->
            <div class="dropdown-menu" v-show="settingsOpen">
              <router-link to="/account" class="dropdown-item">
                <img src="./assets/icons/account.png" alt="Account" class="nav-icon">
                <span>{{ $t('routes.account') }}</span>
              </router-link>
              <router-link to="/bluetooth" class="dropdown-item">
                <img src="./assets/icons/bluetooth.png" alt="Bluetooth" class="nav-icon">
                <span>{{ $t('routes.bluetooth') }}</span>
              </router-link>
              <router-link to="/music" class="dropdown-item">
                <img src="./assets/icons/audio.png" alt="Music" class="nav-icon">
                <span>{{ $t('routes.audio') }}</span>
              </router-link>
              <router-link to="/usb" class="dropdown-item">
                <img src="./assets/icons/usb.png" alt="USB" class="nav-icon">
                <span>{{ $t('routes.usb') }}</span>
              </router-link>
            </div>
          </div>

          <router-link to="/about" class="nav-item">
            <img src="./assets/icons/about.png" alt="About" class="nav-icon">
            <span>{{ $t('routes.about') }}</span>
          </router-link>
        </div>
      </div>
    </div>
    
    <router-view :class="{ 'home-page': isHomePage, 'content-with-nav': !isHomePage }" />
    <LogOverlay ref="logOverlay" />
    
    <!-- ESP System Status Panel (visible on click) -->
    <div class="esp-system-panel" :class="{ 'esp-panel-open': espPanelOpen }">
      <div class="esp-panel-header">
        <h3>ESP32 System Status</h3>
        <button class="esp-panel-close" @click="toggleEspPanel">×</button>
      </div>
      <div class="esp-panel-content">
        <div class="esp-status-row">
          <span class="esp-status-label">WiFi Status:</span>
          <span class="esp-status-value" :class="{ 'connected': espStore.wifiConnected }">
            {{ espStore.systemStatus.wifi_status || 'Unknown' }}
          </span>
        </div>
        
        <div class="esp-status-row">
          <span class="esp-status-label">Wi-Fi Signal Strength:</span>
          <div class="esp-signal-meter">
            <div class="esp-signal-bar" :style="{ width: espStore.wifiSignalStrength + '%' }"></div>
            <span>{{ espStore.wifiSignalStrength }}%</span>
          </div>
        </div>


        <div class="esp-status-row">
          <span class="esp-status-label">Bluetooth:</span>
          <span class="esp-status-value" :class="{ 'connected': espStore.bluetoothConnected }">
            {{ espStore.systemStatus.bluetooth_status || 'Unknown' }}
          </span>
        </div>
        
        
        <div class="esp-status-row">
          <span class="esp-status-label">Heap Usage:</span>
          <div class="esp-memory-meter">
            <div class="esp-memory-bar" :style="{ width: espStore.heapUsagePercent + '%' }"></div>
            <span>{{ Math.round(espStore.heapUsagePercent) }}%</span>
          </div>
        </div>
        
        <div class="esp-status-row">
          <span class="esp-status-label">PSRAM Usage:</span>
          <div class="esp-memory-meter">
            <div class="esp-memory-bar" :style="{ width: espStore.psramUsagePercent + '%' }"></div>
            <span>{{ Math.round(espStore.psramUsagePercent) }}%</span>
          </div>
        </div>
        
        <div class="esp-status-row">
          <span class="esp-status-label">Uptime:</span>
          <span class="esp-status-value">{{ espStore.uptimeFormatted }}</span>
        </div>
        
        <div class="esp-status-row">
          <span class="esp-status-label">Last Update:</span>
          <span class="esp-status-value">{{ espStore.lastUpdateFormatted }}</span>
        </div>
      </div>
    </div>
    
    <div class="bottom-bar">
      <div class="left-section">
        <button @click="toggleLogs" class="log-button">
          <img src="./assets/icons/log.png" alt="Logs" class="log-icon">
          <span>{{ logsVisible ? $t('common.hideLog') : $t('common.showLog') }}</span>
        </button>
      </div>
      
      <div class="version-info">
        <p>{{ $t('home.version', { version: appVersion }) }} {{ copyright }}</p>
      </div>
      
      <div class="status-indicators">
        <div class="status-indicator" @click="toggleEspPanel">
          <img :src="espStore.isConnected ? './assets/icons/esp-on.png' : './assets/icons/esp-off.png'" 
               :title="`ESP32 ${espStore.isConnected ? 'Connected' : 'Disconnected'}`" 
               alt="ESP32" class="status-icon">
        </div>
        
        <div class="status-indicator">
          <img :src="bluetoothConnected ? './assets/icons/bluetooth-on.png' : './assets/icons/bluetooth-off.png'" alt="Bluetooth" class="status-icon">
        </div>
        
        <div class="status-indicator">
          <img :src="espStore.wifiConnected ? './assets/icons/wifi-on.png' : './assets/icons/wifi-off.png'" 
               :title="`WiFi ${espStore.wifiConnected ? 'Connected' : 'Disconnected'}`" 
               alt="WiFi" class="status-icon">
        </div>
        
        <div class="status-indicator">
          <img :src="mqttConnected ? './assets/icons/mqtt-on.png' : './assets/icons/mqtt-off.png'" 
               alt="MQTT" class="status-icon">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LogOverlay from './views/log.vue';
import logger from './utils/logger';
import eventBus from './utils/eventBus';
import { useI18n } from 'vue-i18n';
import { computed, ref, onMounted, onBeforeMount, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useEspStore } from './stores/espStore.js';

export default {
  name: 'App',
  components: {
    LogOverlay
  },
  
  setup() {
    const route = useRoute();
    const appVersion = ref('1.0.0');
    const wifiConnected = ref(false);
    const mqttConnected = ref(false);
    const bluetoothConnected = ref(false);
    const copyright = ref('');
    const settingsOpen = ref(false);
    const settingsDropdown = ref(null);
    const sensorOpen = ref(false);
    const sensorDropdown = ref(null);
    const logsVisible = ref(false);
    const espPanelOpen = ref(false);
    const espStore = useEspStore();
    
    const isHomePage = computed(() => {
      return route.path === '/' || route.path === '/home';
    });
    
    const toggleSettingsDropdown = () => {
      settingsOpen.value = !settingsOpen.value;
      if (settingsOpen.value && sensorOpen.value) {
        sensorOpen.value = false;
      }
    };
    
    const toggleSensorDropdown = () => {
      sensorOpen.value = !sensorOpen.value;
      if (sensorOpen.value && settingsOpen.value) {
        settingsOpen.value = false;
      }
    };
    
    const toggleLogs = () => {
      logger.toggle();
      logsVisible.value = !logsVisible.value;
      
      if (logsVisible.value) {
        logger.info('Logs visible');
      }
    };
    
    const toggleEspPanel = () => {
      espPanelOpen.value = !espPanelOpen.value;
      
      if (espPanelOpen.value) {
        logger.info('ESP32 system status panel opened');
      } else {
        logger.info('ESP32 system status panel closed');
      }
    };
    
    // Format bytes to human-readable format
    const formatBytes = (bytes) => {
      if (bytes === 0 || !bytes) return '0 B';
      
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    // Close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (settingsDropdown.value && !settingsDropdown.value.contains(event.target)) {
        settingsOpen.value = false;
      }
      if (sensorDropdown.value && !sensorDropdown.value.contains(event.target)) {
        sensorOpen.value = false;
      }
    };
    
    onMounted(() => {
      document.addEventListener('click', handleClickOutside);
      
      checkConnectionStatus();
      
      // Check connectivity status every 10 seconds
      setInterval(checkConnectionStatus, 10000);
      
      // Subscribe to connectivity events
      eventBus.on('wifi-status-change', (status) => {
        wifiConnected.value = status;
      });
      
      eventBus.on('mqtt-status-change', (status) => {
        mqttConnected.value = status;
      });
      
      eventBus.on('bluetooth-status-change', (status) => {
        bluetoothConnected.value = status;
      });
      
      // Listen for ESP system updates
      eventBus.on('esp-system-updated', (data) => {
        logger.debug('ESP system status updated in app.vue');
        
        // Automatically show the ESP panel when new data is received
        // but only if it's not already open
        if (!espPanelOpen.value && espStore.isConnected) {
          espPanelOpen.value = true;
          logger.info('ESP32 system status panel automatically opened due to data update');
          
          // Auto-hide after 5 seconds
          setTimeout(() => {
            if (espPanelOpen.value) {
              espPanelOpen.value = false;
              logger.debug('ESP32 system status panel auto-hidden after timeout');
            }
          }, 5000);
        }
      });
      
      // Update copyright at startup
      window.i18n.global.updateCopyright();
      
      // Set up annual copyright update (when app stays open through year change)
      const checkYearChange = () => {
        const currentYear = new Date().getFullYear();
        const copyrightYear = parseInt(copyright.value.match(/\d{4}/)[0]);
        
        if (currentYear > copyrightYear) {
          window.i18n.global.updateCopyright();
        }
      };
      
      // Check for year change daily at midnight
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const timeUntilMidnight = tomorrow - now;
      setTimeout(() => {
        checkYearChange();
        // After first check at midnight, check daily
        setInterval(checkYearChange, 24 * 60 * 60 * 1000);
      }, timeUntilMidnight);
    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside);
    });
    
    onBeforeMount(() => {
      // Set initial copyright value using i18n global instance
      copyright.value = window.i18n.global.getCopyrightYear();
      
      // Listen for copyright updates
      eventBus.on('copyright-updated', (newCopyright) => {
        copyright.value = newCopyright;
      });
      
      // Update copyright when language changes
      eventBus.on('language-changed', () => {
        copyright.value = window.i18n.global.getCopyrightYear();
      });
    });
    
    const checkConnectionStatus = () => {
      // Use ESP store's wifi status if available
      if (espStore.systemStatus.wifi_status) {
        wifiConnected.value = espStore.wifiConnected;
      } else {
        // Fallback to random simulation if no ESP data
        wifiConnected.value = Math.random() > 0.3; // 70% chance of being connected
      }
      
      // Use ESP store's bluetooth status if available
      if (espStore.systemStatus.bluetooth_status) {
        bluetoothConnected.value = espStore.bluetoothConnected;
        
        // Debug the Bluetooth status change
        logger.debug(`Bluetooth status from ESP: ${espStore.systemStatus.bluetooth_status}, connected: ${espStore.bluetoothConnected}`);
      } else {
        // Fallback to random simulation if no ESP data
        bluetoothConnected.value = Math.random() > 0.5; // 50% chance of being connected
      }
      
      mqttConnected.value = Math.random() > 0.4; // 60% chance of being connected
      
      // Check if ESP data hasn't been updated in 30 seconds, mark as disconnected
      if (espStore.systemStatus.lastUpdate) {
        const now = new Date();
        const lastUpdate = new Date(espStore.systemStatus.lastUpdate);
        const diffSeconds = (now - lastUpdate) / 1000;
        
        if (diffSeconds > 30 && espStore.isConnected) {
          logger.warn('ESP32 connection timed out, no data received in the last 30 seconds');
          espStore.recordConnectionLoss('timeout');
        }
      }
    };
    
    return {
      isHomePage,
      appVersion,
      wifiConnected,
      mqttConnected,
      bluetoothConnected,
      copyright,
      settingsOpen,
      settingsDropdown,
      toggleSettingsDropdown,
      sensorOpen,
      sensorDropdown,
      toggleSensorDropdown,
      logsVisible,
      toggleLogs,
      espStore,
      espPanelOpen,
      toggleEspPanel,
      formatBytes
    };
  },
  
  mounted() {
    // Set up event listener for log events using the new eventBus
    eventBus.on('log', (message) => {
      logger.info(message);
    });
    
    // Make eventBus globally available for components
    window.eventBus = eventBus;
    
    // Add some initial logs
    setTimeout(() => {
      logger.info('Application initialized');
      logger.info('Logging system ready');
    }, 200);
  },
  
  beforeUnmount() {
    // Clean up global references
    if (window.eventBus === eventBus) {
      delete window.eventBus;
    }
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  padding-bottom: 60px; /* Space for bottom bar */
}

.top-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000; /* Increased z-index to ensure it stays on top */
  height: 70px; /* Explicit height to ensure consistency */
}

.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  max-width: 1200px;
  margin: 0 auto;
  height: 70px; /* Increased from 60px to 70px */
}

.nav-logo {
  font-size: 24px;
  font-weight: bold;
  color: #42b983;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 15px;
  align-items: center;
}

.nav-item {
  text-decoration: none;
  color: #2c3e50;
  font-weight: 500;
  transition: all 0.3s;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: 4px;
}

.nav-item:hover {
  color: #42b983;
  background-color: rgba(66, 185, 131, 0.1);
}

.nav-item.router-link-active {
  color: #42b983;
  background-color: rgba(66, 185, 131, 0.15);
}

.nav-icon {
  width: 20px;
  height: 20px;
}

.home-page {
  margin-top: 0;
  padding-top: 0;
}

.content-with-nav {
  margin-top: 0;
  padding-top: 90px; /* Increased from 70px to give more breathing room */
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #ffffff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 20px; /* Reduced from 10px to 5px */
  z-index: 100;
  height: 40px; /* Added explicit height */
}

.left-section {
  flex: 1;
  display: flex;
  align-items: center;
}

.log-button {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  color: #666;
  padding: 5px;
  border-radius: 4px;
}

.log-button:hover {
  background-color: rgba(66, 185, 131, 0.1);
}

.log-icon {
  width: 20px;
  height: 20px;
  margin-right: 5px;
}

.version-info {
  text-align: center;
  font-size: 0.8rem;
  color: #666;
  flex: 2;
}

.status-indicators {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  flex: 1;
}

.status-indicator {
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  color: #666;
  cursor: pointer;
}

.status-icon {
  width: 24px;
  height: 24px;
  margin-right: 5px;
}

/* Dropdown styles */
.dropdown {
  position: relative;
  cursor: pointer;
}

.dropdown-icon {
  width: 12px;
  height: 12px;
  margin-left: 5px;
  transition: transform 0.3s;
}

.dropdown-open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: #ffffff;
  border: 1px solid #eaeaea;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 180px;
  z-index: 200;
  margin-top: 5px;
}

.dropdown-item {
  text-decoration: none;
  color: #2c3e50;
  font-weight: 500;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background-color: rgba(66, 185, 131, 0.1);
  color: #42b983;
}

.dropdown-item.router-link-active {
  color: #42b983;
  background-color: rgba(66, 185, 131, 0.15);
}

/* ESP System Status Panel Styles */
.esp-system-panel {
  position: fixed;
  bottom: 50px;
  right: -320px;
  width: 300px;
  background-color: white;
  border-radius: 8px 0 0 0;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  transition: right 0.3s ease;
  overflow: hidden;
}

.esp-panel-open {
  right: 0;
}

.esp-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #42b983;
  padding: 10px 15px;
  color: white;
}

.esp-panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.esp-panel-close {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0 5px;
}

.esp-panel-content {
  padding: 15px;
}

.esp-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.esp-status-label {
  font-weight: 500;
  color: #666;
}

.esp-status-value {
  color: #333;
}

.esp-status-value.connected {
  color: #42b983;
  font-weight: 500;
}

.esp-memory-meter,
.esp-signal-meter {
  width: 150px;
  height: 8px;
  background-color: #eaeaea;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  margin-left: 10px;
}

.esp-memory-bar,
.esp-signal-bar {
  height: 100%;
  background-color: #42b983;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.esp-memory-meter span,
.esp-signal-meter span {
  position: absolute;
  right: 0;
  top: -14px;
  font-size: 12px;
  color: #666;
}

.esp-memory-details {
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  flex-direction: column;
  align-items: flex-start;
}

.esp-memory-details div {
  margin-bottom: 5px;
}

.esp-memory-details div:last-child {
  margin-bottom: 0;
}
</style>
