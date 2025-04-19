/**
 * EEG 3D Renderer
 * Handles THREE.js based 3D visualization of EEG data and brain models
 */
import { markRaw } from 'vue';
import { THREE, OrbitControls, OBJLoader, Stats } from '../threeHelper.js';

export default class Eeg3dRenderer {
  constructor(store) {
    this.store = store;
    this.threeObjects = null;
    this.animationId = null;
    this.drawCounter = 0;
  }

  /**
   * Initialize THREE.js objects for 3D visualization
   * @param {HTMLElement} container - DOM element to render into
   */
  initialize(container) {
    if (!container) {
      console.error('Container element is required');
      return false;
    }
    
    if (window.appLogger) window.appLogger.info('Initializing EEG 3D visualization');
    
    try {
      // Only initialize once
      if (this.threeObjects) {
        this.cleanup();
      }
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // Store the container reference
      this.store.eegPlot.container = container;
      
      // Initialize THREE objects with markRaw to prevent reactivity issues
      this.threeObjects = markRaw({
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(50, width / height, 0.1, 1000), // Reduced FOV from 75 to 50
        renderer: new THREE.WebGLRenderer({ 
          antialias: true, 
          alpha: true,
          preserveDrawingBuffer: true 
        }),
        object3D: null,
        brainModel: null,
        electrodes: {},
        stats: new Stats(),
        // Add the loaders to the threeObjects for easy access
        loaders: {
          objLoader: new OBJLoader()
        }
      });
      
      // Setup scene
      this.threeObjects.scene.background = new THREE.Color(0x222222);
      
      // Position camera farther back for better viewing
      this.threeObjects.camera.position.z = 8; // Increased from 5 to 8
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
      const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
      this.threeObjects.scene.add(ambientLight);
      
      // Add directional lights from multiple angles
      const createDirLight = (color, intensity, position) => {
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(...position);
        return light;
      };
      
      this.threeObjects.scene.add(createDirLight(0xffffff, 0.6, [1, 1, 1]));
      this.threeObjects.scene.add(createDirLight(0xffffff, 0.4, [-1, 0.5, 0.5]));
      this.threeObjects.scene.add(createDirLight(0xffffff, 0.3, [0, -1, 1]));
      
      // Add electrode positions without creating a simple brain model
      this.addElectrodeHelpers();
      
      return true;
    } catch (err) {
      console.error('Failed to initialize THREE.js:', err);
      if (window.appLogger) window.appLogger.error('THREE.js initialization error: ' + err.message);
      return false;
    }
  }
  
  /**
   * Add electrode visualization for the 10-20 system
   */
  addElectrodeHelpers() {
    // Define the 10-20 system electrode positions
    // The coordinates use spherical mapping where:
    // - x: left (-) to right (+)
    // - y: inferior (-) to superior (+)
    // - z: posterior (-) to anterior (+)
    const electrodePositions = {
      // Frontal pole
      'Fp1': [-0.8, 1.3, 0.3],
      'Fpz': [0, 1.4, 0.4],
      'Fp2': [0.8, 1.3, 0.3],
      
      // Frontal
      'F7': [-1.3, 0.7, 0.3],
      'F3': [-0.8, 1.0, 0.7],
      'Fz': [0, 1.1, 0.8],
      'F4': [0.8, 1.0, 0.7],
      'F8': [1.3, 0.7, 0.3]
    };
    
    // Also include modern nomenclature alternatives
    const modernNames = {
      'T3': 'T7',
      'T4': 'T8',
      'T5': 'P7',
      'T6': 'P8'
    };
    
    // Create electrode spheres
    const electrodeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    
    // Start with neutral colors that will be updated by heatmap in animation loop
    for (const [name, position] of Object.entries(electrodePositions)) {
      const electrodeMaterial = new THREE.MeshPhongMaterial({
        color: 0xaaaaaa,  // Neutral gray color initially
        emissive: 0x333333,
        specular: 0xffffff,
        shininess: 50
      });
      
      const electrode = new THREE.Mesh(electrodeGeometry, electrodeMaterial);
      electrode.position.set(...position);
      
      // Store with both traditional and modern names if applicable
      const electrodeKey = name.toLowerCase();
      this.threeObjects.electrodes[electrodeKey] = electrode;
      
      // Also add the modern name reference if it exists
      if (modernNames[name]) {
        this.threeObjects.electrodes[modernNames[name].toLowerCase()] = electrode;
      }
      
      this.threeObjects.scene.add(electrode);
      
      // Add label - use both naming systems where applicable
      const labelText = modernNames[name] ? `${name}/${modernNames[name]}` : name;
      const textSprite = this.createTextSprite(labelText);
      textSprite.position.set(position[0], position[1] + 0.2, position[2]);
      this.threeObjects.scene.add(textSprite);
    }
    
    // Add reference electrodes (earlobes)
    const referencePositions = {
      'A1': [-1.5, 0, -0.3], // Left earlobe
      'A2': [1.5, 0, -0.3]   // Right earlobe
    };
    
    const referenceMaterial = new THREE.MeshPhongMaterial({
      color: 0xffcc00,  // Yellow for reference electrodes
      emissive: 0x333300,
      specular: 0xffffff,
      shininess: 50
    });
    
    for (const [name, position] of Object.entries(referencePositions)) {
      const electrode = new THREE.Mesh(electrodeGeometry, referenceMaterial);
      electrode.position.set(...position);
      
      this.threeObjects.electrodes[name.toLowerCase()] = electrode;
      this.threeObjects.scene.add(electrode);
      
      // Add label
      const textSprite = this.createTextSprite(name);
      textSprite.position.set(position[0], position[1] + 0.2, position[2]);
      this.threeObjects.scene.add(textSprite);
    }
    
    // Add visual connection lines to illustrate the 10-20 system grid
    this.addElectrodeConnectionLines(electrodePositions);
    
    console.log('Electrode helpers added for 10-20 system');
  }

  /**
   * Add visual lines connecting electrodes to show 10-20 system grid
   * @param {Object} positions - Electrode positions
   */
  addElectrodeConnectionLines(positions) {
    // Define connections between electrodes
    const connections = [
      // Longitudinal lines (front-to-back)
      ['Fp1', 'F3', 'C3', 'P3', 'O1'],
      ['Fpz', 'Fz', 'Cz', 'Pz', 'Oz'],
      ['Fp2', 'F4', 'C4', 'P4', 'O2'],
      
      // Transverse lines (left-to-right)
      ['F7', 'F3', 'Fz', 'F4', 'F8'],
      ['T3', 'C3', 'Cz', 'C4', 'T4'],
      ['T5', 'P3', 'Pz', 'P4', 'T6'],
      ['O1', 'Oz', 'O2']
    ];
    
    // Create a line material
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.4
    });
    
    // Create line geometries for each connection
    for (const connection of connections) {
      const points = [];
      
      for (const electrodeName of connection) {
        if (positions[electrodeName]) {
          const pos = positions[electrodeName];
          points.push(new THREE.Vector3(...pos));
        }
      }
      
      if (points.length >= 2) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        this.threeObjects.scene.add(line);
        
        // Keep track of the line for potential cleanup later
        if (!this.threeObjects.electrodeLines) {
          this.threeObjects.electrodeLines = [];
        }
        this.threeObjects.electrodeLines.push(line);
      }
    }
  }

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
  }
  
  /**
   * Start THREE.js animation loop for 3D visualization
   */
  startAnimationLoop(dataProcessor) {
    const animate = (timestamp) => {
      this.animationId = requestAnimationFrame(animate);
      
      try {
        if (!this.threeObjects?.scene || 
            !this.threeObjects?.camera || 
            !this.threeObjects?.renderer) {
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
        
        // Process incoming buffer - add to main data every 4th frame
        this.drawCounter++;
        if (this.drawCounter % 4 === 0) {
          dataProcessor.processIncomingBuffer();
        }
        
        // Update electrode visualization based on latest EEG values
        this.updateElectrodeVisualization(dataProcessor);
        
        // Render the scene
        this.threeObjects.renderer.render(
          this.threeObjects.scene,
          this.threeObjects.camera
        );
        
        // Dynamically update the brain scale indicator (e.g., when zooming in/out)
        this.updateBrainScaleIndicator();
        
        // End stats measurement
        if (this.threeObjects.stats) {
          this.threeObjects.stats.end();
        }
        
      } catch (err) {
        console.error('Animation error:', err);
        cancelAnimationFrame(this.animationId);
      }
    };
    
    animate();
  }
  
  /**
   * Start animation loop for model display only (no EEG data)
   * This allows displaying the 3D model without active EEG data
   */
  startStandaloneAnimationLoop() {
    const animate = (timestamp) => {
      this.animationId = requestAnimationFrame(animate);
      
      try {
        if (!this.threeObjects?.scene || 
            !this.threeObjects?.camera || 
            !this.threeObjects?.renderer) {
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
        
        // No data processing in standalone mode
        
        // Render the scene
        this.threeObjects.renderer.render(
          this.threeObjects.scene,
          this.threeObjects.camera
        );
        
        // Dynamically update the brain scale indicator
        this.updateBrainScaleIndicator();
        
        // End stats measurement
        if (this.threeObjects.stats) {
          this.threeObjects.stats.end();
        }
        
      } catch (err) {
        console.error('Animation error:', err);
        cancelAnimationFrame(this.animationId);
      }
    };
    
    animate();
  }

  /**
   * Calculate frames per second
   */
  calculateFPS(timestamp) {
    const store = this.store;
    store.frameCount++;
    
    if (!store.lastFrameTime) {
      store.lastFrameTime = timestamp;
    } else if (timestamp - store.lastFrameTime >= 1000) {
      store.eegPlot.fps = Math.round(store.frameCount * 1000 / (timestamp - store.lastFrameTime));
      store.frameCount = 0;
      store.lastFrameTime = timestamp;
    }
  }
  
  /**
   * Update electrode visualization based on latest EEG values
   */
  updateElectrodeVisualization(dataProcessor) {
    if (!this.threeObjects?.electrodes) return;
    
    const { sensorData } = this.store;
    
    // We only care about these specific electrodes
    const targetElectrodes = ['fp1', 'fpz', 'fp2'];
    
    // Update each electrode based on the latest signal values
    for (const channel of targetElectrodes) {
      if (!this.threeObjects.electrodes[channel]) continue;
      
      if (dataProcessor.hasData(channel)) {
        const value = dataProcessor.getLatestValue(channel);
        
        // Scale the electrode based on signal intensity
        const scale = 1 + Math.abs(value) * 0.5;
        this.threeObjects.electrodes[channel].scale.set(scale, scale, scale);
        
        // Get SNR if available (or default to 0)
        const snr = (sensorData.data?.snr && sensorData.data.snr[channel]) || 0;
        const normalizedSnr = Math.min(Math.max(snr / 20, 0), 1); // 0-1 range
        
        // Normalize value for heatmap coloring (value typically between -1 and 1)
        // Convert to 0-1 range for heat mapping
        const normalizedValue = Math.min(Math.max((value + 1) / 2, 0), 1);
        
        // Get heatmap gradient color based on signal value
        const heatmapColor = this.getHeatmapColor(normalizedValue);
        
        // Apply color with SNR-based brightness
        const hsl = new THREE.Color(heatmapColor).getHSL({});
        const newColor = new THREE.Color().setHSL(
          hsl.h,
          hsl.s,
          0.3 + normalizedSnr * 0.7 // Brightness based on SNR
        );
        
        this.threeObjects.electrodes[channel].material.color = newColor;
        
        // Pulse effect based on signal activity
        this.threeObjects.electrodes[channel].material.emissive = newColor;
        this.threeObjects.electrodes[channel].material.emissiveIntensity = Math.abs(value) * 0.5;
        
        // Apply effects to brain model near this electrode, if we have a detailed model
        if (this.threeObjects.detailedBrainModel) {
          this.applyEffectToBrainModelNearElectrode(channel, value, normalizedSnr, heatmapColor);
        }
      }
    }
    
    // Update global brain activity visualization limited to our target electrodes
    this.updateBrainActivityVisualization(dataProcessor, targetElectrodes);
  }
  
  /**
   * Convert a normalized value (0-1) to a heatmap color
   * @param {number} value - Normalized value between 0 and 1
   * @returns {number} - RGB color as a number
   */
  getHeatmapColor(value) {
    // Create a heatmap gradient:
    // 0.0 = Deep blue (coolest)
    // 0.2 = Light blue
    // 0.4 = Green
    // 0.6 = Yellow
    // 0.8 = Orange
    // 1.0 = Red (hottest)
    
    let r, g, b;
    
    if (value <= 0.2) {
      // Deep blue to light blue (0.0 - 0.2)
      const normalizedValue = value / 0.2;
      r = 0;
      g = Math.round(normalizedValue * 100);
      b = Math.round(255 * (0.5 + 0.5 * normalizedValue));
    } else if (value <= 0.4) {
      // Light blue to green (0.2 - 0.4)
      const normalizedValue = (value - 0.2) / 0.2;
      r = 0;
      g = Math.round(100 + normalizedValue * 155);
      b = Math.round(255 * (1 - normalizedValue));
    } else if (value <= 0.6) {
      // Green to yellow (0.4 - 0.6)
      const normalizedValue = (value - 0.4) / 0.2;
      r = Math.round(normalizedValue * 255);
      g = 255;
      b = 0;
    } else if (value <= 0.8) {
      // Yellow to orange (0.6 - 0.8)
      const normalizedValue = (value - 0.6) / 0.2;
      r = 255;
      g = Math.round(255 * (1 - normalizedValue * 0.5));
      b = 0;
    } else {
      // Orange to red (0.8 - 1.0)
      const normalizedValue = (value - 0.8) / 0.2;
      r = 255;
      g = Math.round(255 * 0.5 * (1 - normalizedValue));
      b = 0;
    }
    
    // Convert RGB to hex color number
    return (r << 16) | (g << 8) | b;
  }
  
  /**
   * Apply visual effect to brain model near a specific electrode
   * @param {string} channel - EEG channel name
   * @param {number} value - Current EEG value
   * @param {number} normalizedSnr - Normalized SNR value (0-1)
   * @param {number} heatmapColor - The heatmap color to use
   */
  applyEffectToBrainModelNearElectrode(channel, value, normalizedSnr, heatmapColor) {
    if (!this.threeObjects?.detailedBrainModel || !this.threeObjects.electrodes[channel]) return;
    
    // Get electrode position
    const electrode = this.threeObjects.electrodes[channel];
    const electrodePosition = electrode.position.clone();
    
    // Create temporary objects for effect if they don't exist
    if (!this.threeObjects.brainActivityEffects) {
      this.threeObjects.brainActivityEffects = {};
    }
    
    if (!this.threeObjects.brainActivityEffects[channel]) {
      // Create a glow sphere at electrode position
      const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: heatmapColor,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      
      const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
      glowSphere.position.copy(electrodePosition);
      this.threeObjects.scene.add(glowSphere);
      
      this.threeObjects.brainActivityEffects[channel] = glowSphere;
      
      // For the detailed brain model - create a localized heat spot
      if (this.threeObjects.detailedBrainModel) {
        this.createLocalizedHeatSpot(channel, electrodePosition);
      }
    }
    
    // Update the glow effect
    const glowEffect = this.threeObjects.brainActivityEffects[channel];
    
    // Scale based on signal intensity
    const scale = 0.5 + Math.abs(value) * 2.0;
    glowEffect.scale.set(scale, scale, scale);
    
    // Opacity based on SNR and signal intensity
    glowEffect.material.opacity = 0.1 + (normalizedSnr * 0.3) + (Math.abs(value) * 0.2);
    
    // Apply heatmap color
    glowEffect.material.color = new THREE.Color(heatmapColor);
    
    // Modify color brightness based on SNR
    const hsl = glowEffect.material.color.getHSL({});
    glowEffect.material.color.setHSL(
      hsl.h, 
      hsl.s,
      0.4 + normalizedSnr * 0.6 // Brightness based on SNR
    );
    
    // Update the localized heat spot on the brain if it exists
    if (this.threeObjects?.heatSpots?.[channel]) {
      this.updateHeatSpot(channel, value, normalizedSnr, heatmapColor);
    }
  }

  /**
   * Create a localized heat spot on the brain model for a specific electrode
   * @param {string} channel - EEG channel name
   * @param {THREE.Vector3} position - Electrode position
   */
  createLocalizedHeatSpot(channel, position) {
    return this.manageHeatSpot('create', channel, { 
      position, 
      addMarker: true 
    });
  }

  /**
   * Add a visible marker to show exact electrode locations (for debugging)
   */
  addLocationMarkerForDebugging(channel, position) {
    // Small sphere at exact electrode location for visual debugging
    const markerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00 // Bright yellow for visibility
    });
    
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    
    this.threeObjects.scene.add(marker);
    
    // Store reference to this marker
    if (!this.threeObjects.locationMarkers) {
      this.threeObjects.locationMarkers = {};
    }
    this.threeObjects.locationMarkers[channel] = marker;
  }

  /**
   * Update a heat spot on the brain model
   * @param {string} channel - EEG channel name
   * @param {number} value - Current EEG value
   * @param {number} normalizedSnr - Normalized SNR value (0-1)
   * @param {number} heatmapColor - The heatmap color to use
   */
  updateHeatSpot(channel, value, normalizedSnr, heatmapColor) {
    return this.manageHeatSpot('update', channel, {
      value,
      normalizedSnr,
      heatmapColor
    });
  }

  /**
   * Update the brain model's overall visualization based on EEG activity
   * @param {Object} dataProcessor - Data processor with EEG data
   * @param {Array} targetElectrodes - List of electrodes to consider
   */
  updateBrainActivityVisualization(dataProcessor, targetElectrodes = ['fp1', 'fpz', 'fp2']) {
    if (!this.threeObjects?.detailedBrainModel) return;
    
    // We don't need to change the color of the entire brain model anymore
    // Instead, we're using localized heat spots at each electrode position
    
    // Just slightly adjust opacity of the whole brain model based on overall activity
    let totalActivity = 0;
    let channelCount = 0;
    
    for (const channel of targetElectrodes) {
      if (!dataProcessor.hasData(channel)) continue;
      
      const value = dataProcessor.getLatestValue(channel);
      totalActivity += Math.abs(value);
      channelCount++;
    }
    
    const avgActivity = channelCount > 0 ? totalActivity / channelCount : 0;
    
    // Apply subtle overall changes to the brain model
    this.threeObjects.detailedBrainModel.traverse(child => {
      if (child.isMesh) {
        // Only adjust opacity slightly based on overall activity
        // Keep original brain color (don't apply heatmap to entire brain)
        child.material.opacity = 0.7 + (avgActivity * 0.2);
      }
    });
  }

  /**
   * Get channel color - DEPRECATED, use getHeatmapColor instead for dynamic visualizations
   */
  getChannelColor(channel) {
    // For backward compatibility
    const channelColors = {
      fp1: 0xFF0000, // Red
      fpz: 0x00FF00, // Green
      fp2: 0x0000FF, // Blue
    };
    
    return channelColors[channel] || 0xFFFFFF;
  }
  
  /**
   * Handle THREE.js resize
   */
  handleResize() {
    if (!this.threeObjects?.renderer || 
        !this.store.eegPlot.container) {
      return;
    }
    
    const width = this.store.eegPlot.container.clientWidth;
    const height = this.store.eegPlot.container.clientHeight;
    
    // Update renderer size
    this.threeObjects.renderer.setSize(width, height);
    this.threeObjects.camera.aspect = width / height;
    this.threeObjects.camera.updateProjectionMatrix();
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Stop animation loop first
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Clean up orbit controls if they exist
    if (this.threeObjects?.controls) {
      this.threeObjects.controls.dispose();
    }
    
    // Remove stats DOM element if it exists
    if (this.threeObjects?.stats && 
        this.threeObjects.stats.dom && 
        this.threeObjects.stats.dom.parentNode) {
      this.threeObjects.stats.dom.parentNode.removeChild(this.threeObjects.stats.dom);
    }
    
    // Clean up renderer
    if (this.threeObjects?.renderer) {
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
    
    // Clear scene and dispose geometries/materials
    if (this.threeObjects?.scene) {
      this.threeObjects.scene.traverse(object => {
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
      });
      
      this.threeObjects.scene.clear();
    }
    
    // Clear all references
    this.threeObjects = null;
  }
  
  /**
   * Update brain scale indicator
   */
  updateBrainScaleIndicator() {
    if (this.threeObjects?.brainScaleIndicator && 
        this.threeObjects.detailedBrainModel && 
        this.threeObjects.camera) {
      const baseCameraDistance = 150; // baseline distance used when loading model
      // Compute effective scale based on camera distance change
      const effectiveScale = this.threeObjects.detailedBrainModel.scale.x * 
        (baseCameraDistance / this.threeObjects.camera.position.z);
      const percent = (effectiveScale * 100).toFixed(0);
      const text = `Scale: ${percent}%`;
      const tempSprite = this.createTextSprite(text);
      this.threeObjects.brainScaleIndicator.material.map = tempSprite.material.map;
      this.threeObjects.brainScaleIndicator.material.needsUpdate = true;
      this.store.brainScaleText = text;
    }
  }

  /**
   * Specialized method to load a model from a data URI safely without triggering CORS errors
   * @param {string} dataURI - The data URI containing the model
   * @returns {Promise} - Promise resolving to the loaded model object
   */
  loadDataURIModelSafely(dataURI) {
    return new Promise((resolve, reject) => {
      try {
        // Extract the base64 content from the data URI
        let objContent = '';
        
        if (dataURI.includes('base64,')) {
          // This is a base64 encoded data URI
          const contentStartIndex = dataURI.indexOf('base64,') + 7;
          if (contentStartIndex > 7) {
            const base64Content = dataURI.substring(contentStartIndex);
            
            try {
              // Decode the base64 string to get the OBJ content
              objContent = atob(base64Content);
              console.log('Successfully decoded base64 content, length:', objContent.length);
              
              // Log a small sample to verify it looks like OBJ format
              const sampleStart = objContent.substring(0, 50);
              console.log('Content starts with:', sampleStart);
              
              // Verify this looks like an OBJ file
              if (!sampleStart.includes('v ') && !sampleStart.includes('# ')) {
                console.warn('Decoded content may not be a valid OBJ file');
              }
            } catch (decodeError) {
              console.error('Error decoding base64 data:', decodeError);
              reject(new Error('Failed to decode base64 content'));
              return;
            }
          } else {
            reject(new Error('Invalid data URI format'));
            return;
          }
        } else if (dataURI.includes(',')) {
          // This is a plain text data URI
          const contentStartIndex = dataURI.indexOf(',') + 1;
          if (contentStartIndex > 1) {
            objContent = decodeURIComponent(dataURI.substring(contentStartIndex));
            console.log('Using plain text data URI content, length:', objContent.length);
          } else {
            reject(new Error('Invalid data URI format'));
            return;
          }
        } else {
          reject(new Error('Unsupported data URI format'));
          return;
        }
        
        // Validate we have content to work with
        if (!objContent || objContent.length < 10) {
          reject(new Error('Empty or invalid OBJ content'));
          return;
        }
        
        // Now load the OBJ content without network requests
        try {
          // Create a new OBJLoader instance
          const objLoader = new OBJLoader();
          
          // Parse in a separate call stack to avoid any renderer timing issues
          setTimeout(() => {
            try {
              // Parse the OBJ content directly
              const result = objLoader.parse(objContent);
              console.log('OBJ model parsed successfully from data URI');
              
              // Successfully loaded
              resolve(result);
            } catch (parseErr) {
              console.error('Error parsing in setTimeout:', parseErr);
              reject(parseErr);
            }
          }, 0);
        } catch (parseError) {
          console.error('Error parsing OBJ content:', parseError);
          reject(parseError);
        }
      } catch (error) {
        console.error('Unexpected error in data URI loading:', error);
        reject(error);
      }
    });
  }

  /**
   * Process a loaded 3D model (applies materials, adds to scene)
   * @param {Object} object - The loaded THREE.js model object
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  processLoadedModel(object, resolve, reject) {
    try {
      // Make sure the loading indicator is removed
      this.removeLoadingIndicator();
      
      // Clean up any previous heat spots
      this.manageHeatSpot('removeAll');
      
      // Set up material for the brain model
      object.traverse((child) => {
        if (child.isMesh) {
          // Use standard MeshPhongMaterial for better performance
          child.material = new THREE.MeshPhongMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: 0.5, // Reduced from 0.85 for better electrode visibility
            wireframe: false,
            shininess: 30,
            specular: 0x444444,
            side: THREE.DoubleSide,
            depthWrite: false // Prevent brain from obscuring electrodes
          });
          child.renderOrder = 10; // Render brain first, electrodes after
        }
      });
      
      // Position and scale the brain model appropriately
      object.scale.set(0.2, 0.2, 0.2);
      object.position.set(0, 0, 0);
      object.rotation.x = Math.PI / 6;
      
      // Add to scene
      this.threeObjects.scene.add(object);
      console.log('Brain model added to scene successfully');
      
      // Add a text indicator for the brain scale
      const scaleIndicator = this.createTextSprite("Scale: 10%");
      // Position the indicator slightly above the brain model
      scaleIndicator.position.set(object.position.x, object.position.y + 2, object.position.z);
      this.threeObjects.scene.add(scaleIndicator);
      this.threeObjects.brainScaleIndicator = scaleIndicator;
      
      // Add enhanced lighting for detailed model if not already added
      if (!this.threeObjects.detailedBrainLight) {
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(0, 1, 2);
        this.threeObjects.scene.add(dirLight);
        this.threeObjects.detailedBrainLight = dirLight;
        
        const ambLight = new THREE.AmbientLight(0x404040, 1);
        this.threeObjects.scene.add(ambLight);
        this.threeObjects.detailedBrainAmbientLight = ambLight;
      }
      
      // Update camera position for better view
      this.threeObjects.camera.position.set(0, 0, 150);
      this.threeObjects.camera.lookAt(0, 0, 0);
      
      this.threeObjects.detailedBrainModel = object;
      this.threeObjects.object3D = object; // Set as main object3D
      
      // Create heat spots for each electrode
      const targetElectrodes = ['fp1', 'fpz', 'fp2'];
      for (const channel of targetElectrodes) {
        if (this.threeObjects.electrodes[channel]) {
          const position = this.threeObjects.electrodes[channel].position.clone();
          this.createLocalizedHeatSpot(channel, position);
        }
      }
      
      if (window.appLogger) window.appLogger.info('Detailed brain model loaded successfully');
      
      resolve(object);
    } catch (error) {
      // Make sure to remove loading indicator on error
      this.removeLoadingIndicator();
      
      // Show the basic model as fallback
      if (this.threeObjects.brainModel) {
        this.threeObjects.brainModel.visible = true;
      }
      this.showModelLoadingError('Error processing model');
      reject(error);
    }
  }

  
  /**
   * Enhanced brain model loader 
   * @param {string} modelPath - Webpack-resolved path from assets.js
   */
  loadDetailedBrainModel(modelPath) {
    if (!modelPath) {
      console.error('No model path provided to loadDetailedBrainModel');
      return Promise.reject(new Error('No model path provided'));
    }

    // Log a truncated version of the model path
    const logPath = modelPath.startsWith('data:') 
      ? `${modelPath.substring(0, 30)}... (length: ${modelPath.length})`
      : modelPath;
    console.log('Loading detailed brain model from path:', logPath);
    
    if (!this.threeObjects?.scene) {
      const errorMsg = 'Cannot load brain model: THREE.js scene not initialized';
      console.error(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }
    
    // Skip if we already have a detailed brain model loaded
    if (this.threeObjects.detailedBrainModel) {
      console.log('Detailed brain model already loaded, removing first');
      this.removeDetailedBrainModel();
    }
    
    // Show loading indicator early to give user feedback
    this.showLoadingIndicator();
    
    console.log('Using webpack model path: data URI detected');

    // This avoids any potential network requests that could trigger CORS issues
    return new Promise((resolve, reject) => {
      // Only use a small timeout to make the UI responsive
      setTimeout(() => {
        console.log('Using direct data URI handler to avoid CORS issues');
        
        try {
          // Start with a clean slate - no detailed brain model or loading leftovers
          if (document.getElementById('brain-model-error')) {
            const errorElement = document.getElementById('brain-model-error');
            if (errorElement.parentNode) {
              errorElement.parentNode.removeChild(errorElement);
            }
          }
          
          this.loadDataURIModelSafely(modelPath)
            .then(object => {
              console.log('Successfully loaded model with direct data URI handler');
              // Ensure loading indicator is removed before processing
              this.removeLoadingIndicator();
              this.processLoadedModel(object, resolve, reject);
            })
            .catch(error => {
              console.error('Error in direct data URI handler:', error);
              
              // Remove loading indicator
              this.removeLoadingIndicator();
              
              // Make sure the basic model is visible as fallback
              if (this.threeObjects?.brainModel) {
                this.threeObjects.brainModel.visible = true;
              }
              
              // Show error to user
              this.showModelLoadingError('Failed to load detailed brain model');
              
              reject(error);
            });
        } catch (error) {
          console.error('Exception in data URI handler:', error);
          this.removeLoadingIndicator();
          reject(error);
        }
      }, 100);
    });

  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator() {
    if (!this.store.eegPlot.container) return;
    
    // Remove any existing indicators first
    this.removeLoadingIndicator();
    
    const loadingMessage = document.createElement('div');
    loadingMessage.style.position = 'absolute';
    loadingMessage.style.top = '50%';
    loadingMessage.style.left = '50%';
    loadingMessage.style.transform = 'translate(-50%, -50%)';
    loadingMessage.style.color = 'white';
    loadingMessage.style.fontSize = '16px';
    loadingMessage.style.padding = '10px';
    loadingMessage.style.backgroundColor = 'rgba(0,0,0,0.7)';
    loadingMessage.style.borderRadius = '5px';
    loadingMessage.style.zIndex = '1000';
    loadingMessage.textContent = 'Loading brain model...';
    loadingMessage.id = 'brain-model-loader';
    
    this.store.eegPlot.container.appendChild(loadingMessage);
    return loadingMessage;
  }

  /**
   * Display model loading error to the user
   * @param {string} message - Optional custom error message
   */
  showModelLoadingError(message = 'Failed to load detailed brain model') {
    if (!this.store.eegPlot.container) return;
    
    // First remove any existing error messages
    const existingError = document.getElementById('brain-model-error');
    if (existingError && existingError.parentNode) {
      existingError.parentNode.removeChild(existingError);
    }
    
    const errorMessage = document.createElement('div');
    errorMessage.style.position = 'absolute';
    errorMessage.style.top = '10px';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translateX(-50%)';
    errorMessage.style.color = 'white';
    errorMessage.style.background = 'rgba(255, 0, 0, 0.7)';
    errorMessage.style.padding = '8px 16px';
    errorMessage.style.borderRadius = '4px';
    errorMessage.style.fontFamily = 'sans-serif';
    errorMessage.style.fontSize = '14px';
    errorMessage.style.zIndex = '1000';
    errorMessage.textContent = message;
    errorMessage.id = 'brain-model-error';
    
    this.store.eegPlot.container.appendChild(errorMessage);
    
    // Remove error message after 5 seconds
    setTimeout(() => {
      const element = document.getElementById('brain-model-error');
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 5000);
  }
  
  /**
   * Remove the detailed brain model
   */
  removeDetailedBrainModel() {
    if (!this.threeObjects) return;
    
    // Remove heat spots and location markers
    this.manageHeatSpot('removeAll');
    
    // Clear region tracking
    this.originalMaterials = null;
    
    // Remove detailed model
    if (this.threeObjects.detailedBrainModel) {
      this.threeObjects.scene.remove(this.threeObjects.detailedBrainModel);
      this.threeObjects.detailedBrainModel = null;
      this.threeObjects.object3D = null; // Clear main object reference too
    }
    
    // Remove enhanced lighting
    if (this.threeObjects.detailedBrainLight) {
      this.threeObjects.scene.remove(this.threeObjects.detailedBrainLight);
      this.threeObjects.detailedBrainLight = null;
    }
    
    if (this.threeObjects.detailedBrainAmbientLight) {
      this.threeObjects.scene.remove(this.threeObjects.detailedBrainAmbientLight);
      this.threeObjects.detailedBrainAmbientLight = null;
    }
    
    // Remove brain scale indicator if present
    if (this.threeObjects.brainScaleIndicator) {
      this.threeObjects.scene.remove(this.threeObjects.brainScaleIndicator);
      this.threeObjects.brainScaleIndicator = null;
    }
  }

  /**
   * Remove loading indicator from DOM
   */
  removeLoadingIndicator() {
    // Improved indicator removal with better error handling
    try {
      const indicator = document.getElementById('brain-model-loader');
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
        console.log('Loading indicator removed successfully');
      }
      
      // Also check for any other loading indicators that might have been created
      const allLoadingIndicators = document.querySelectorAll('[id^="brain-model-loader"]');
      allLoadingIndicators.forEach(element => {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    } catch (error) {
      console.error('Error removing loading indicator:', error);
    }
  }

  /**
   * Handle heat spots on the brain model
   * @param {string} action - 'create', 'update', 'remove', or 'removeAll'
   * @param {string} channel - EEG channel name
   * @param {Object} options - Options specific to each action
   */
  manageHeatSpot(action, channel, options = {}) {
    if (!this.threeObjects) return null;
    
    // Initialize heat spots container if it doesn't exist
    if (!this.threeObjects.heatSpots) {
      this.threeObjects.heatSpots = {};
    }
    
    switch (action) {
      case 'create':
        // Remove existing heat spot if it exists
        this.manageHeatSpot('remove', channel);
        
        const { position } = options;
        if (!position) {
          console.error(`Position required to create heat spot for ${channel}`);
          return null;
        }
        
        // Define a specific radius for each electrode to ensure they're well separated
        const channelRadius = {
          fp1: 0.6,
          fpz: 0.6,
          fp2: 0.6
        };
        
        // Use the electrode position directly to ensure perfect alignment
        // Adjust slightly inward toward the brain to appear on the surface
        const brainCenter = new THREE.Vector3(0, 0, 0);
        const directionFromCenter = position.clone().sub(brainCenter).normalize();
        const surfacePosition = position.clone().sub(
          directionFromCenter.clone().multiplyScalar(0.05)
        );
        
        // Create a larger, more visible heat spot
        const radius = channelRadius[channel] || 0.6;
        const geometry = new THREE.SphereGeometry(radius, 24, 24);
        
        // Use a more vibrant material with stronger glow effect
        const material = new THREE.MeshPhongMaterial({
          color: 0xffffff, // Will be updated with heatmap color
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthTest: true,
          depthWrite: false,
          emissive: 0xffffff,
          emissiveIntensity: 0.5
        });
        
        const heatSpot = new THREE.Mesh(geometry, material);
        heatSpot.position.copy(surfacePosition);
        
        // Add the heat spot to the scene
        this.threeObjects.scene.add(heatSpot);
        this.threeObjects.heatSpots[channel] = heatSpot;
        
        // Add a visual marker to clearly identify each electrode location
        if (options.addMarker) {
          this.addLocationMarkerForDebugging(channel, position);
        }
        
        console.log(`Created heat spot for ${channel} at position:`, surfacePosition);
        return heatSpot;
        
      case 'update':
        const existingHeatSpot = this.threeObjects.heatSpots[channel];
        if (!existingHeatSpot) return null;
        
        const { value, normalizedSnr, heatmapColor } = options;
        
        // More dramatic scaling based on signal intensity for better visibility
        if (value !== undefined) {
          const scale = 1.0 + Math.abs(value) * 0.8;
          existingHeatSpot.scale.set(scale, scale, scale);
          
          // Higher base opacity for better visibility
          existingHeatSpot.material.opacity = 0.4 + Math.abs(value) * 0.6;
        }
        
        // Apply the heatmap color explicitly if provided
        if (heatmapColor !== undefined) {
          const heatColorObj = new THREE.Color(heatmapColor);
          existingHeatSpot.material.color = heatColorObj;
          
          // Strong emissive effect to make the color stand out
          existingHeatSpot.material.emissive = heatColorObj;
          
          if (value !== undefined) {
            existingHeatSpot.material.emissiveIntensity = 0.3 + Math.abs(value) * 0.7;
          }
        }
        
        // Update location marker visibility based on activity (optional)
        if (value !== undefined && this.threeObjects.locationMarkers?.[channel]) {
          this.threeObjects.locationMarkers[channel].visible = (Math.abs(value) > 0.3);
        }
        
        return existingHeatSpot;
        
      case 'remove':
        if (this.threeObjects.heatSpots[channel]) {
          const spot = this.threeObjects.heatSpots[channel];
          if (spot.parent) {
            spot.parent.remove(spot);
          }
          delete this.threeObjects.heatSpots[channel];
          
          // Also remove the location marker if it exists
          if (this.threeObjects.locationMarkers?.[channel]) {
            const marker = this.threeObjects.locationMarkers[channel];
            if (marker.parent) {
              marker.parent.remove(marker);
            }
            delete this.threeObjects.locationMarkers[channel];
          }
        }
        return null;
        
      case 'removeAll':
        if (this.threeObjects.heatSpots) {
          Object.keys(this.threeObjects.heatSpots).forEach(ch => {
            this.manageHeatSpot('remove', ch);
          });
          this.threeObjects.heatSpots = {};
        }
        
        // Clear all location markers
        if (this.threeObjects.locationMarkers) {
          Object.keys(this.threeObjects.locationMarkers).forEach(ch => {
            const marker = this.threeObjects.locationMarkers[ch];
            if (marker && marker.parent) {
              marker.parent.remove(marker);
            }
          });
          this.threeObjects.locationMarkers = {};
        }
        return null;
        
      default:
        console.error(`Unknown heat spot action: ${action}`);
        return null;
    }
  }
}