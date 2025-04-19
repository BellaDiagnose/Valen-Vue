import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { THREE, Stats, OrbitControls } from './threeHelper.js';
import { useEegStore } from './eegStore';
import logger from '../utils/logger.js';


export const useImuStore = defineStore('imu', {
  state: () => ({
    // Sensor data - using only the new IMU structure
    sensorData: {
      sensor: '',
      channels: [],
      data: {
        x: [],
        y: [],
        z: [],
        temperature: 0
      }
    },
    
    // Visualization state
    imuPlot: {
      active: false,
      container: null,
      visualizationMode: 'brain', // Changed from 'cube' to 'brain'
      fps: 0,
      diagnosisInfo: {
        diagnosis_id: 1,
        diagnosis_stage: 2
      }
    },
    
    // THREE.js objects - using markRaw to prevent reactivity issues
    threeObjects: null,
    
    // Animation control
    animationId: null,
    dataUpdateInterval: null,
    
    // Local non-reactive tracking
    _objectRotation: { x: 0, y: 0, z: 0 },
    lastFrameTime: 0,
    frameCount: 0
  }),
  
  getters: {
    isActive: (state) => state.imuPlot.active,
    currentMode: (state) => state.imuPlot.visualizationMode
  },
  
  actions: {
    /**
     * Initialize THREE.js objects
     * @param {HTMLElement} container - DOM element to render into
     */
    initializeThreeJs(container) {
      if (!container) {
        logger.error('Container element is required');
        return false;
      }
      
      logger.info('Initializing IMU visualization');
      
      try {
        // Only initialize once
        if (this.threeObjects) {
          this.cleanupObjects();
        }
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Store the container reference
        this.imuPlot.container = container;
        
        // Initialize THREE objects with markRaw to prevent reactivity issues
        this.threeObjects = markRaw({
          scene: new THREE.Scene(),
          camera: new THREE.PerspectiveCamera(75, width / height, 0.1, 1000),
          renderer: new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            preserveDrawingBuffer: true 
          }),
          object3D: null,
          brainModel: null,
          electrodes: {},
          stats: new Stats()
        });
        
        // Setup scene
        this.threeObjects.scene.background = new THREE.Color(0x222222);  // Changed from 0xf0f0f0 to 0x222222
        this.threeObjects.camera.position.z = 5;
        
        // Setup renderer
        this.threeObjects.renderer.setSize(width, height);
        this.threeObjects.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.threeObjects.renderer.domElement);
        
        // Setup stats if needed
        this.threeObjects.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        container.appendChild(this.threeObjects.stats.dom);
        
        // Add optional orbit controls for interactive rotation
        this.threeObjects.controls = new OrbitControls(
          this.threeObjects.camera, 
          this.threeObjects.renderer.domElement
        );
        this.threeObjects.controls.enableDamping = true;
        
        // Enhanced lighting setup for better visibility
        // Ambient light for overall scene brightness
        const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
        this.threeObjects.scene.add(ambientLight);
        
        // Directional lights from multiple angles for better coverage
        const createDirLight = (color, intensity, position) => {
          const light = new THREE.DirectionalLight(color, intensity);
          light.position.set(...position);
          return light;
        };
        
        // Add directional lights from multiple angles
        this.threeObjects.scene.add(createDirLight(0xffffff, 0.6, [1, 1, 1]));
        this.threeObjects.scene.add(createDirLight(0xffffff, 0.4, [-1, 0.5, 0.5]));
        this.threeObjects.scene.add(createDirLight(0xffffff, 0.3, [0, -1, 1]));
        
        // Create brain visualization instead of cube
        this.createBrainModel();
        
        return true;
      } catch (err) {
        logger.error({
          title: 'Initialization Error',
          message: `Failed to initialize THREE.js: ${err.message}`
        });
        return false;
      }
    },
    
    /**
     * Start or stop IMU visualization
     */
    toggleIMUVisualization() {
      if (this.imuPlot.active) {
        this.stopIMUVisualization();
      } else {
        this.startIMUVisualization();
      }
    },
    
    /**
     * Start IMU visualization and data collection
     */
    startIMUVisualization() {
      if (this.imuPlot.active) return;
      
      this.imuPlot.active = true;
      
      logger.info('Starting IMU visualization');
      
      // Start collecting data from native bridge
      if (window.bellaBridge?.calls) {
        window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "qmi8658a",
          action: "start",
          diagnosis_id: this.imuPlot.diagnosisInfo.diagnosis_id,
          diagnosis_stage: this.imuPlot.diagnosisInfo.diagnosis_stage,
        });
        
        // Start simulation anyway as fallback if no real data arrives
        setTimeout(() => {
          if (this.imuPlot.active && 
              this.sensorData.data.x.length === 0 && 
              this.sensorData.data.y.length === 0 && 
              this.sensorData.data.z.length === 0) {
            logger.warn('No IMU data received, falling back to simulation');
            this.startSimulation();
          }
        }, 2000); // Wait 2 seconds for real data before using simulation
      } else {
        logger.warn('bellaBridge not available, using simulation mode');
        this.startSimulation();
      }
      
      // Start animation loop
      this.startAnimationLoop();
    },
    
    /**
     * Stop IMU visualization and data collection
     */
    stopIMUVisualization() {
      if (!this.imuPlot.active) return;
      
      this.imuPlot.active = false;
      
      logger.info('Stopping IMU visualization');
      
      // Stop native data collection
      if (window.bellaBridge?.calls) {
        window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "qmi8658a",
          action: "stop",
          diagnosis_id: this.imuPlot.diagnosisInfo.diagnosis_id,
          diagnosis_stage: this.imuPlot.diagnosisInfo.diagnosis_stage
        });
      }
      
      // Stop simulation
      if (this.dataUpdateInterval) {
        clearInterval(this.dataUpdateInterval);
        this.dataUpdateInterval = null;
      }
      
      // Stop animation loop
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    },

    /**
     * Create a brain model visualization instead of a cube
     */
    createBrainModel() {
      try {
        // Create a simplified brain model (sphere)
        const brainGeometry = new THREE.SphereGeometry(1.5, 32, 32);
        const brainMaterial = new THREE.MeshPhongMaterial({ 
          color: 0xdddddd, 
          transparent: true,
          opacity: 0.7,
          wireframe: false
        });
        
        const brainMesh = new THREE.Mesh(brainGeometry, brainMaterial);
        
        // Add an axis helper to the brain to help with orientation
        const axisHelper = new THREE.AxesHelper(2);
        brainMesh.add(axisHelper);
        
        this.threeObjects.brainModel = brainMesh;
        this.threeObjects.object3D = brainMesh;
        this.threeObjects.scene.add(brainMesh);
        
        // Create electrodes at approximate 10-20 system locations
        const electrodePositions = {
          fp1: [0.8, 1.3, 0.3],
          fpz: [0, 1.4, 0.4],
          fp2: [-0.8, 1.3, 0.3]
        };
        
        // Create electrode spheres
        const electrodeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        this.threeObjects.electrodes = {};
        
        // Define default colors if EEG store colors aren't available
        const defaultColors = {
          fp1: 0xFF0000, // Red
          fpz: 0x00FF00, // Green
          fp2: 0x0000FF  // Blue
        };
        
        for (const [name, position] of Object.entries(electrodePositions)) {
          const electrodeMaterial = new THREE.MeshPhongMaterial({
            color: defaultColors[name]
          });
          
          const electrode = new THREE.Mesh(electrodeGeometry, electrodeMaterial);
          electrode.position.set(...position);
          
          this.threeObjects.electrodes[name] = electrode;
          this.threeObjects.scene.add(electrode);
          
          // Add label
          const textSprite = this.createTextSprite(name.toUpperCase());
          textSprite.position.set(position[0], position[1] + 0.2, position[2]);
          this.threeObjects.scene.add(textSprite);
        }
        
        // Log success
        logger.info('Brain visualization created successfully');
      } catch (err) {
        logger.error({
          title: 'Visualization Error',
          message: `Error creating brain: ${err.message}`
        });
      }
    },
    
    /**
     * Create a text sprite for labels
     */
    createTextSprite(text) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 128;
      canvas.height = 64;
      
      context.font = '24px Arial';
      context.fillStyle = 'white';
      context.textAlign = 'center';
      context.fillText(text, 64, 32);
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.5, 0.25, 1);
      
      return sprite;
    },
    
    /**
     * Create a simple colored sprite
     */
    createColoredSprite(color) {
      try {
        const spriteMaterial = new THREE.SpriteMaterial({ color });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.5, 0.5, 0.5);
        return sprite;
      } catch (err) {
        logger.error({
          title: 'Visualization Error',
          message: `Error creating sprite: ${err.message}`
        });
        return null;
      }
    },
    
    /**
     * Start animation loop
     */
    startAnimationLoop() {
      const animate = (timestamp) => {
        this.animationId = requestAnimationFrame(animate);
        
        try {
          if (!this.threeObjects?.scene || 
              !this.threeObjects?.camera || 
              !this.threeObjects?.renderer || 
              !this.threeObjects?.object3D) {
            return;
          }
          
          // Start stats measurement
          if (this.threeObjects.stats) {
            this.threeObjects.stats.begin();
          }
          
          // Calculate FPS
          this.calculateFPS(timestamp);
          
          // Update orbit controls if they exist
          if (this.threeObjects.controls) {
            this.threeObjects.controls.update();
          }
          
          // Apply rotation from IMU sensor data
          if (this.sensorData.data.x.length > 0) {
            // Get latest values from arrays
            const xLen = this.sensorData.data.x.length;
            const yLen = this.sensorData.data.y.length;
            const zLen = this.sensorData.data.z.length;
            
            const lastX = this.sensorData.data.x[xLen - 1] || 0;
            const lastY = this.sensorData.data.y[yLen - 1] || 0;
            const lastZ = this.sensorData.data.z[zLen - 1] || 0;
            
            // Calculate rotation rate from the last two values
            let rotX = 0, rotY = 0, rotZ = 0;
            if (xLen > 1 && yLen > 1 && zLen > 1) {
              rotX = (this.sensorData.data.x[xLen - 1] - this.sensorData.data.x[xLen - 2]) * 0.1;
              rotY = (this.sensorData.data.y[yLen - 1] - this.sensorData.data.y[yLen - 2]) * 0.1;
              rotZ = (this.sensorData.data.z[zLen - 1] - this.sensorData.data.z[zLen - 2]) * 0.1;
            }
            
            // Update rotation
            this._objectRotation.x += rotX;
            this._objectRotation.y += rotY;
            this._objectRotation.z += rotZ;
            
            this.threeObjects.object3D.rotation.set(
              this._objectRotation.x,
              this._objectRotation.y,
              this._objectRotation.z
            );
          }
          
          // Update electrode visualization based on EEG data if available
          this.updateElectrodeVisualization();
          
          // Render the scene
          this.threeObjects.renderer.render(
            this.threeObjects.scene,
            this.threeObjects.camera
          );
          
          // End stats measurement
          if (this.threeObjects.stats) {
            this.threeObjects.stats.end();
          }
        } catch (err) {
          logger.error({
            title: 'Animation Error',
            message: `Animation error: ${err.message}`
          });
          cancelAnimationFrame(this.animationId);
        }
      };
      
      animate();
    },
    
    /**
     * Calculate frames per second
     */
    calculateFPS(timestamp) {
      this.frameCount++;
      
      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      } else if (timestamp - this.lastFrameTime >= 1000) {
        this.imuPlot.fps = Math.round(this.frameCount * 1000 / (timestamp - this.lastFrameTime));
        this.frameCount = 0;
        this.lastFrameTime = timestamp;
      }
    },
    
    /**
     * Start simulated IMU data updates
     */
    startSimulation() {
      // Check if simulation is already running
      if (this.dataUpdateInterval) {
        clearInterval(this.dataUpdateInterval);
      }
      
      logger.info('Starting IMU data simulation');
      
      // Add a visual indicator for simulation mode
      if (this.threeObjects?.scene) {
        // Add a small "SIM" text to the scene
        const simText = document.createElement('div');
        simText.id = 'sim-indicator';
        simText.style.position = 'absolute';
        simText.style.top = '10px';
        simText.style.right = '10px';
        simText.style.background = 'rgba(255, 0, 0, 0.7)';
        simText.style.color = 'white';
        simText.style.padding = '5px';
        simText.style.borderRadius = '3px';
        simText.style.fontFamily = 'monospace';
        simText.style.fontSize = '12px';
        simText.style.pointerEvents = 'none';
        simText.textContent = window.i18n.global.t('imu.simulation');
        
        if (this.imuPlot.container) {
          this.imuPlot.container.appendChild(simText);
        }
      }
      
      // Use more prominent motion in simulation mode
      this.dataUpdateInterval = setInterval(() => {
        const now = Date.now() / 1000;
        
        // Update sensor info for simulation
        this.sensorData.sensor = "simulated";
        this.sensorData.channels = ["x", "y", "z", "temperature"];
        
        // Generate arrays of simulated data
        const dataPoints = 10; // Number of historical points to keep
        
        // Generate new data point
        const newX = Math.sin(now * 0.8) * 3;
        const newY = Math.sin(now * 1.2) * 3;
        const newZ = 9.8 + Math.sin(now * 0.6) * 2;
        
        // Manage the data arrays (add new, remove old if needed)
        this.sensorData.data.x.push(newX);
        this.sensorData.data.y.push(newY);
        this.sensorData.data.z.push(newZ);
        
        // Keep arrays at fixed length
        if (this.sensorData.data.x.length > dataPoints) {
          this.sensorData.data.x.shift();
          this.sensorData.data.y.shift();
          this.sensorData.data.z.shift();
        }
        
        // Simulated temperature with slight variations
        this.sensorData.data.temperature = 25 + Math.sin(now * 0.1) * 1.5;
      }, 16); // ~60Hz updates for smoother motion
    },
    
    /**
     * Update IMU data from an external source (native bridge)
     */
    updateIMUData(imuData) {
      // Sensor data - using only the new IMU structure sensorData:
      const newSensorData = imuData.sensorData;
      if (!newSensorData) {
        logger.warn("IMU update failed: sensorData is missing");
        return false;
      }
      
      // Update the store's sensorData with new values
      this.sensorData.sensor = newSensorData.sensor || "";
      this.sensorData.channels = newSensorData.channels || [];
      this.sensorData.data.x = Array.isArray(newSensorData.data.x) ? newSensorData.data.x : [];
      this.sensorData.data.y = Array.isArray(newSensorData.data.y) ? newSensorData.data.y : [];
      this.sensorData.data.z = Array.isArray(newSensorData.data.z) ? newSensorData.data.z : [];
      this.sensorData.data.temperature = typeof newSensorData.data.temperature === "number" ? newSensorData.data.temperature : 0;
      
      return true;
    },
    
    /**
     * Update electrode visualization based on EEG data
     */
    updateElectrodeVisualization() {
      if (!this.threeObjects?.electrodes) return;
      
      try {
        // Get EEG store to access its data
        const eegStore = useEegStore();
        
        // Skip if EEG store isn't active or doesn't have data
        if (!eegStore.isActive) return;
        
        // Update each electrode based on the latest EEG values
        for (const channel of Object.keys(this.threeObjects.electrodes)) {
          if (eegStore.hasData(channel)) {
            const electrode = this.threeObjects.electrodes[channel];
            
            // Get the latest value for this channel
            const value = eegStore.getLatestValue(channel);
            
            // Scale the electrode based on signal intensity
            const scale = 1 + Math.abs(value) * 0.5;
            electrode.scale.set(scale, scale, scale);
            
            // Color intensity based on SNR
            const snr = eegStore.sensorData.data.snr[channel] || 0;
            const normalizedSnr = Math.min(Math.max(snr / 20, 0), 1); // 0-1 range
            
            // Update electrode material color (more intense for higher SNR)
            const baseColor = new THREE.Color(electrode.material.color.getHex());
            const hsl = baseColor.getHSL({});
            const newColor = new THREE.Color().setHSL(
              hsl.h,
              hsl.s,
              0.3 + normalizedSnr * 0.7 // Brightness based on SNR
            );
            
            electrode.material.color = newColor;
            
            // Pulse effect based on signal activity
            electrode.material.emissive = newColor;
            electrode.material.emissiveIntensity = Math.abs(value) * 0.5;
          }
        }
      } catch (err) {
        logger.error({
          title: 'Visualization Error',
          message: `Error updating electrodes: ${err.message}`
        });
      }
    },
    
    /**
     * Reset orientation to default
     */
    resetOrientation() {
      if (this.threeObjects?.object3D) {
        this.threeObjects.object3D.rotation.set(0, 0, 0);
        this.threeObjects.object3D.quaternion.set(0, 0, 0, 1);
      }
      
      this._objectRotation = { x: 0, y: 0, z: 0 };
      
      // Reset sensor data to empty values
      this.sensorData = {
        sensor: '',
        channels: [],
        data: {
          x: [],
          y: [],
          z: [],
          temperature: 0
        }
      };
    },
    
    /**
     * Handle window resize
     */
    handleResize() {
      if (!this.threeObjects?.camera || 
          !this.threeObjects?.renderer || 
          !this.imuPlot.container) {
        return;
      }
      
      const width = this.imuPlot.container.clientWidth;
      const height = this.imuPlot.container.clientHeight;
      
      this.threeObjects.camera.aspect = width / height;
      this.threeObjects.camera.updateProjectionMatrix();
      this.threeObjects.renderer.setSize(width, height);
    },
    
    /**
     * Clean up a single THREE.js object
     */
    cleanupObject(object) {
      if (!object) return;
      
      if (object.geometry) {
        object.geometry.dispose();
      }
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
      
      if (object.children && object.children.length > 0) {
        for (let i = object.children.length - 1; i >= 0; i--) {
          this.cleanupObject(object.children[i]);
        }
      }
    },
    
    /**
     * Clean up all THREE.js objects
     */
    cleanupObjects() {
      if (!this.threeObjects) return;
      
      // Stop animation loop first
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      
      // Clean up orbit controls if they exist
      if (this.threeObjects.controls) {
        this.threeObjects.controls.dispose();
      }
      
      // Remove stats DOM element if it exists
      if (this.threeObjects.stats && 
          this.threeObjects.stats.dom && 
          this.threeObjects.stats.dom.parentNode) {
        this.threeObjects.stats.dom.parentNode.removeChild(this.threeObjects.stats.dom);
      }
      
      // Clean up renderer
      if (this.threeObjects.renderer) {
        this.threeObjects.renderer.dispose();
        this.threeObjects.renderer.forceContextLoss();
        if (this.threeObjects.renderer.domElement && 
            this.threeObjects.renderer.domElement.parentNode) {
          this.threeObjects.renderer.domElement.parentNode.removeChild(
            this.threeObjects.renderer.domElement
          );
        }
        this.threeObjects.renderer.domElement = null;
      }
      
      // Clean up 3D object
      if (this.threeObjects.object3D) {
        this.cleanupObject(this.threeObjects.object3D);
      }
      
      // Clear scene
      if (this.threeObjects.scene) {
        this.threeObjects.scene.clear();
      }
      
      // Remove simulation indicator if it exists
      const simIndicator = document.getElementById('sim-indicator');
      if (simIndicator && simIndicator.parentNode) {
        simIndicator.parentNode.removeChild(simIndicator);
      }
      
      // Clear all references
      this.threeObjects = null;
    }
  }
});
