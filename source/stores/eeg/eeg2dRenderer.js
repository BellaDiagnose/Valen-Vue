/**
 * EEG 2D Renderer
 * Handles canvas-based 2D visualization of EEG data
 */
import { markRaw } from 'vue';
import { Stats } from '../threeHelper.js';
import { mockEEG } from '../../mock.js';

export default class Eeg2dRenderer {
  constructor(store) {
    this.store = store;
    this.canvasObjects = null;
    this.animationId = null;
    this.drawCounter = 0;
    this.debug = false; // Enabling debug mode to trace the issue
  }

  /**
   * Initialize canvas objects
   * @param {HTMLElement} container - DOM element to render into
   */
  initialize(container) {
    if (!container) {
      console.error('Container element is required');
      return false;
    }
    
    if (window.appLogger) window.appLogger.info('Initializing EEG 2D visualization');
    
    try {
      // Only initialize once
      if (this.canvasObjects) {
        this.cleanup();
      }
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // Store the container reference
      this.store.eegPlot.container = container;
      
      // Create main canvas element
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      container.appendChild(canvas);
      
      // Setup Three.js Stats for performance monitoring
      const stats = new Stats();
      stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
      container.appendChild(stats.dom);
      
      // Initialize canvas objects with markRaw to prevent reactivity issues
      this.canvasObjects = markRaw({
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        stats: stats,
        width: width,
        height: height,
        // Channel colors for visualization
        colors: {
          fp1: '#FF0000', // Red
          fpz: '#00FF00', // Green
          fp2: '#0000FF', // Blue
          background: '#222222',
          grid: '#444444',
          text: '#FFFFFF'
        },
        // Scale factors for visualization
        scale: {
          amplitude: height / 4, // Scale factor for amplitude
          timeScale: width / this.store.buffer.displayPoints // Horizontal scale
        }
      });
      
      // Setup initial canvas state
      const ctx = this.canvasObjects.ctx;
      ctx.font = '12px monospace';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      
      // Add debug indicator if in debug mode
      if (this.debug) {
        console.log('EEG 2D Renderer initialized with:', {
          containerSize: { width, height },
          storeState: {
            active: this.store.eegPlot.active,
            visualizationMode: this.store.eegPlot.visualizationMode,
            isMockMode: this.store.isMockMode,
            channels: this.store.sensorData.channels
          }
        });
      }
      
      return true;
    } catch (err) {
      console.error('Failed to initialize Canvas:', err);
      if (window.appLogger) window.appLogger.error('Canvas initialization error: ' + err.message);
      return false;
    }
  }
  
  /**
   * Toggle between different stats panels
   * Cycles through FPS, MS, and MB
   */
  toggleStatsPanel() {
    if (!this.canvasObjects?.stats) return;
    
    // Get current panel and cycle to next
    const currentPanel = this.canvasObjects.stats.currentPanel || 0;
    const nextPanel = (currentPanel + 1) % 3; // Cycle through 0, 1, 2
    
    this.canvasObjects.stats.showPanel(nextPanel);
    this.canvasObjects.stats.currentPanel = nextPanel;
    
    // Return panel name for UI feedback
    const panels = ['FPS', 'MS', 'MB'];
    return panels[nextPanel];
  }
  
  /**
   * Start canvas animation loop for 2D visualization
   */
  startAnimationLoop(dataProcessor) {
    // Add debug log for animation start
    if (this.debug) {
      console.log('Starting EEG 2D animation loop with dataProcessor:', dataProcessor);
    }
    
    const animate = (timestamp) => {
      this.animationId = requestAnimationFrame(animate);
      
      try {
        if (!this.canvasObjects?.canvas || 
            !this.canvasObjects?.ctx) {
          if (this.debug) console.warn('Canvas objects not available, skipping animation frame');
          return;
        }
        
        // Start stats measurement
        if (this.canvasObjects.stats) {
          this.canvasObjects.stats.begin();
        }
        
        // Calculate FPS
        this.calculateFPS(timestamp);
        
        // Process incoming buffer - add to main data every 4th frame (60Hz / 4 = 15Hz)
        // This allows the UI to remain smooth while processing data in chunks
        this.drawCounter++;
        if (this.drawCounter % 4 === 0) {
          dataProcessor.processIncomingBuffer();
          
          // Debug log for buffer processing
          if (this.debug && this.drawCounter % 60 === 0) {
            const { buffer } = this.store;
            console.log('Processed incoming buffer:', {
              hasIncomingData: Object.values(buffer.incoming).some(arr => arr && arr.length > 0),
              bufferStats: {
                fp1Length: buffer.circular.fp1?.length || 0,
                fpzLength: buffer.circular.fpz?.length || 0,
                fp2Length: buffer.circular.fp2?.length || 0,
                writeIndexFp1: buffer.writeIndex.fp1,
                writeIndexFpz: buffer.writeIndex.fpz,
                writeIndexFp2: buffer.writeIndex.fp2
              },
              channels: this.store.sensorData.channels,
              hasData: buffer.hasNewData
            });
          }
          
          // If in mock mode, initialize with mock data to ensure we see something
          if (this.store.isMockMode && this.drawCounter <= 20) {
            // For newly started mock mode, ensure we have data immediately
            this.ensureDataIsAvailable();
          }
        }
        
        // Always force hasNewData to true if in mock mode to ensure continuous updating
        if (this.store.isMockMode) {
          this.store.buffer.hasNewData = true;
        }
        
        // Draw the EEG visualization
        this.drawEEGVisualization();
        
        // End stats measurement
        if (this.canvasObjects.stats) {
          this.canvasObjects.stats.end();
        }
        
      } catch (err) {
        console.error('Animation error:', err);
        cancelAnimationFrame(this.animationId);
      }
    };
    
    // Always ensure data is available at the start if in mock mode
    if (this.store.isMockMode) {
      this.ensureDataIsAvailable();
    }
    
    animate();
  }
  
  /**
   * Make sure we have some data to display in mock mode
   * This helps ensure the visualization appears even if the mock data hasn't been processed yet
   */
  ensureDataIsAvailable() {
    // We've moved the implementation to mock.js and now just delegate to it
    if (this.store.isMockMode) {
      // Use the mock.js function to initialize empty buffers if needed
      if (mockEEG.initializeEmptyBuffers(this.store) && this.debug) {
        console.log('Initialized mock data buffers from mockEEG helper');
      } else if (this.debug) {
        console.log('Mock data already available');
      }
    }
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
   * Draw the EEG visualization on the canvas
   */
  drawEEGVisualization() {
    const { ctx, width, height, colors, scale } = this.canvasObjects;
    const { buffer, sensorData } = this.store;
    
    // Debug once every few seconds to see what data we're working with
    if (this.debug && this.drawCounter % 300 === 0) {
      console.log('Drawing with data:', {
        channels: sensorData.channels,
        hasNewData: buffer.hasNewData,
        buffer: {
          fp1Length: buffer.circular.fp1?.length || 0,
          fpzLength: buffer.circular.fpz?.length || 0,
          fp2Length: buffer.circular.fp2?.length || 0
        }
      });
    }
    
    // Clear the canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    this.drawGrid();
    
    // Calculate channel height (divide canvas height by number of channels)
    const channels = sensorData.channels?.filter(ch => ch !== 'snr') || ['fp1', 'fpz', 'fp2'];
    const numChannels = channels.length || 3; // Default to 3 if no channels found
    const channelHeight = height / numChannels;
    
    // Calculate vertical scale based on data amplitude
    let maxAmplitude = 0;
    for (const channel of channels) {
      // Find max amplitude across all channels
      const circularData = buffer.circular[channel];
      if (circularData && circularData.length > 0) {
        const channelMax = Math.max(...circularData.map(Math.abs));
        maxAmplitude = Math.max(maxAmplitude, channelMax);
      }
    }
    
    // Ensure we have a reasonable scale (default if no data yet)
    const amplitudeScale = maxAmplitude > 0 ? 
      (channelHeight * 0.4) / maxAmplitude : // Use 40% of channel height
      channelHeight * 0.4 / 0.5; // Default scale for amplitude around 0.5
    
    // Draw each channel
    let channelIndex = 0;
    for (const channel of channels) {
      // Use circular buffer data for rendering
      const circularData = buffer.circular[channel];
      const writeIndex = buffer.writeIndex[channel];
      
      if (!circularData || circularData.length === 0) {
        if (this.debug) console.warn(`No circular data for channel ${channel}`);
        channelIndex++;
        continue;
      }
      
      // Calculate how many points to display (up to displayPoints)
      const numPoints = Math.min(circularData.length, buffer.displayPoints);
      
      // Calculate y-position for this channel (center of channel)
      const yPos = channelHeight * (channelIndex + 0.5);
      
      // Draw the channel label with SNR
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left';
      ctx.fillText(
        `${channel.toUpperCase()} ${sensorData.data.snr && sensorData.data.snr[channel] ? 
          `SNR: ${sensorData.data.snr[channel].toFixed(1)} dB` : ''}`, 
        10, 
        yPos - channelHeight * 0.35
      );
      
      // Draw horizontal zero-line for this channel
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(width, yPos);
      ctx.stroke();
      
      // Draw the EEG line
      ctx.strokeStyle = colors[channel] || '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      // Only display 20% of points (1 in every 5) to improve performance
      // The step value determines how many points to skip
      const samplingStep = 5; // Display 20% (1/5) of points
      
      let firstPoint = true;
      
      // Draw points from circular buffer with sampling step
      for (let i = 0; i < numPoints; i += samplingStep) {
        // Calculate the correct index in the circular buffer (latest points first)
        const bufferIndex = (writeIndex - numPoints + i + circularData.length) % circularData.length;
        
        if (bufferIndex < 0 || bufferIndex >= circularData.length) {
          if (this.debug && this.drawCounter % 300 === 0) {
            console.warn(`Invalid buffer index ${bufferIndex} for channel ${channel}`);
          }
          continue;
        }
        
        const x = (i / numPoints) * width;
        
        // Scale the value using our calculated amplitude scale
        // and invert it (positive up) since canvas Y is inverted
        const value = circularData[bufferIndex];
        const y = yPos - (value * amplitudeScale);
        
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
      channelIndex++;
    }
    
    // Draw scale indicator
    this.drawScaleIndicator(amplitudeScale, maxAmplitude);
  }
  
  /**
   * Draw scale indicator to show voltage scale
   */
  drawScaleIndicator(amplitudeScale, maxAmplitude) {
    const { ctx, width, colors } = this.canvasObjects;
    
    // Calculate a nice round value for the scale bar (e.g., 50μV, 100μV)
    const scaleValues = [10, 20, 50, 100, 200, 500, 1000, 2000];
    let scaleValue = 50; // Default scale (50μV)
    
    // Find appropriate scale value based on max amplitude
    if (maxAmplitude > 0) {
      for (const value of scaleValues) {
        if (value * amplitudeScale > 20) { // At least 20 pixels high
          scaleValue = value;
          break;
        }
      }
    }
    
    // Draw scale bar in bottom right corner
    const barHeight = scaleValue * amplitudeScale;
    const barWidth = 20;
    const margin = 20;
    const x = width - margin - barWidth;
    const y = this.canvasObjects.height - margin - barHeight;
    
    // Draw vertical bar
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + barHeight);
    ctx.stroke();
    
    // Draw horizontal caps
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x - 5, y + barHeight);
    ctx.lineTo(x + 5, y + barHeight);
    ctx.stroke();
    
    // Label the scale
    ctx.fillStyle = colors.text;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${scaleValue}μV`, x, y - 5);
  }
  
  /**
   * Draw grid on the canvas
   */
  drawGrid() {
    const { ctx, width, height, colors } = this.canvasObjects;
    const { buffer, sensorData } = this.store;
    
    // Draw vertical time grid lines (every 100ms)
    const timeInterval = 100; // ms
    const pixelsPerMs = width / (buffer.displayPoints * 4); // 250Hz = 4ms per point
    const pixelsPerTimeInterval = timeInterval * pixelsPerMs;
    
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    
    // Vertical lines (time)
    for (let x = 0; x < width; x += pixelsPerTimeInterval) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal lines (per channel and amplitude)
    const numChannels = sensorData.channels.filter(ch => ch !== 'snr').length || 3;
    const channelHeight = height / numChannels;
    
    // Draw channel dividers
    for (let i = 1; i < numChannels; i++) {
      const y = i * channelHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw zero line for each channel
    for (let i = 0; i < numChannels; i++) {
      const y = (i + 0.5) * channelHeight;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Reset line width
    ctx.lineWidth = 1.5;
  }
  
  /**
   * Handle canvas resize
   */
  handleResize() {
    if (!this.canvasObjects?.canvas || 
        !this.store.eegPlot.container) {
      return;
    }
    
    const width = this.store.eegPlot.container.clientWidth;
    const height = this.store.eegPlot.container.clientHeight;
    
    // Update canvas size
    this.canvasObjects.canvas.width = width;
    this.canvasObjects.canvas.height = height;
    this.canvasObjects.width = width;
    this.canvasObjects.height = height;
    
    // Update scale factors
    this.canvasObjects.scale.amplitude = height / 4;
    this.canvasObjects.scale.timeScale = width / this.store.buffer.displayPoints;
    
    // Reset context properties after resize
    const ctx = this.canvasObjects.ctx;
    ctx.font = '12px monospace';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
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
    
    // Remove canvas from DOM
    if (this.canvasObjects?.canvas && 
        this.canvasObjects.canvas.parentNode) {
      this.canvasObjects.canvas.parentNode.removeChild(this.canvasObjects.canvas);
    }
    
    // Remove stats DOM element if it exists
    if (this.canvasObjects?.stats && 
        this.canvasObjects.stats.dom && 
        this.canvasObjects.stats.dom.parentNode) {
      this.canvasObjects.stats.dom.parentNode.removeChild(this.canvasObjects.stats.dom);
    }
    
    // Clear all references
    this.canvasObjects = null;
  }
}
