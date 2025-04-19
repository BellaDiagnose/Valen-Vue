<template>
  <div class="imu-page">
    
    <div class="imu-visualization">
      <div class="controls">
        <button @click="toggleIMUVisualization">
          {{ imuPlot.active ? $t('imu.controls.stopRecording') : $t('imu.controls.startRecording') }}
        </button>
        <button @click="resetOrientation">{{ $t('imu.controls.resetOrientation') }}</button>
      </div>
      
      <div ref="sceneContainer" class="scene-container">
        <!-- Stats overlay panel that will be positioned in top left of scene -->
        <div class="stats-overlay" v-if="imuPlot.active">
          <div class="stats-header">{{ $t('imu.stats.title') }}</div>
          <div class="stats-metrics">
            <div class="stats-metric">
              <div class="stats-metric-label">{{ $t('imu.stats.xAxis') }}</div>
              <div class="stats-metric-value" v-if="sensorData.data.x.length > 0">
                {{ sensorData.data.x[sensorData.data.x.length - 1].toFixed(2) }}
                <div class="stats-metric-bar" :style="{width: getBarWidth('x') + '%'}"></div>
              </div>
            </div>
            <div class="stats-metric">
              <div class="stats-metric-label">{{ $t('imu.stats.yAxis') }}</div>
              <div class="stats-metric-value" v-if="sensorData.data.y.length > 0">
                {{ sensorData.data.y[sensorData.data.y.length - 1].toFixed(2) }}
                <div class="stats-metric-bar" :style="{width: getBarWidth('y') + '%'}"></div>
              </div>
            </div>
            <div class="stats-metric">
              <div class="stats-metric-label">{{ $t('imu.stats.zAxis') }}</div>
              <div class="stats-metric-value" v-if="sensorData.data.z.length > 0">
                {{ sensorData.data.z[sensorData.data.z.length - 1].toFixed(2) }}
                <div class="stats-metric-bar" :style="{width: getBarWidth('z') + '%'}"></div>
              </div>
            </div>
            <div class="stats-metric">
              <div class="stats-metric-label">{{ $t('imu.stats.temp') }}</div>
              <div class="stats-metric-value">
                {{ sensorData.data.temperature.toFixed(1) }}°C
                <div class="stats-metric-bar" :style="{width: getTempBarWidth() + '%'}"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useImuStore } from '@/stores/imuStore';
import { mapState, mapActions } from 'pinia';

export default {
  name: 'ImuVisualization',
  
  data() {
    return {
      diagnosisInfo: {
        diagnosis_id: 1,
        diagnosis_stage: 2
      }
    };
  },

  computed: {
    ...mapState(useImuStore, ['sensorData', 'imuPlot']),
  },
  
  methods: {
    ...mapActions(useImuStore, [
      'toggleIMUVisualization', 
      'resetOrientation',
      'handleResize',
      'cleanupObjects',
      'startSimulation',
      'toggleStatsPanel'
    ]),
    
    // Calculate percentage width for the value bars (normalized between -10 and 10)
    getBarWidth(axis) {
      if (!this.sensorData.data[axis] || this.sensorData.data[axis].length === 0) {
        return 0;
      }
      
      const value = this.sensorData.data[axis][this.sensorData.data[axis].length - 1];
      // Normalize to 0-100% (assuming typical range between -10 and 10)
      const normalized = Math.min(Math.max((value + 10) / 20 * 100, 0), 100);
      return normalized;
    },
    
    // Calculate temperature bar width (normalized between 0 and 50°C)
    getTempBarWidth() {
      const temp = this.sensorData.data.temperature;
      // Normalize to 0-100% (assuming typical range between 0 and 50°C)
      return Math.min(Math.max((temp / 50) * 100, 0), 100);
    },

    cycleStatsPanel() {
      const store = useImuStore();
      this.currentStatsPanel = store.toggleStatsPanel() || 'FPS';
    }
  },
  
  mounted() {
    const store = useImuStore();
    
    // Initialize visualization after the DOM is ready
    this.$nextTick(() => {
      store.initializeThreeJs(this.$refs.sceneContainer);
    });
    
    // Add resize listener
    window.addEventListener('resize', this.handleResize);
  },
  
  beforeUnmount() {
    // Stop visualization if active
    const store = useImuStore();
    if (store.imuPlot.active) {
      store.stopIMUVisualization();
    }
    
    // Remove resize listener
    window.removeEventListener('resize', this.handleResize);
    
    // Clean up THREE.js resources
    this.cleanupObjects();
  }
};
</script>

<style scoped>
.imu-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.imu-visualization {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.controls {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.controls button, .controls select {
  padding: 8px 12px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}


.controls button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.controls select {
  background-color: #2c3e50;
}

.metrics {
  display: flex;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.metric {
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-family: monospace;
}

.scene-container {
  flex: 1;
  min-height: 500px;
  background-color: #222222;  /* Changed from #f0f0f0 to #222222 to match EEG */
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

/* Stats overlay panel styling */
.stats-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 180px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
  color: white;
  z-index: 10;
  font-family: monospace;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  pointer-events: none; /* Allow interaction with the 3D scene beneath */
}

.stats-header {
  background-color: #7742b9;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: bold;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.stats-metrics {
  padding: 10px;
}

.stats-metric {
  margin-bottom: 8px;
}

.stats-metric-label {
  font-size: 10px;
  opacity: 0.8;
  margin-bottom: 2px;
}

.stats-metric-value {
  font-size: 14px;
  position: relative;
  margin-bottom: 2px;
}

.stats-metric-bar {
  height: 3px;
  background: linear-gradient(to right, #4ECB71, #48BEFF, #FF6B6B);
  margin-top: 3px;
  border-radius: 1px;
  transition: width 0.3s ease-out;
}

.stats-panel-btn {
  background-color: #7742b9;
  font-size: 0.9em;
}
</style>
