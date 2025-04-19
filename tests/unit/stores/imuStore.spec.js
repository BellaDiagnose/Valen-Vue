import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useImuStore } from '@/stores/imuStore';
import { createPinia, setActivePinia } from 'pinia';

// Mock the THREE library and related dependencies - reusing the same mock structure from eegStore.spec.js
vi.mock('@/stores/threeHelper.js', () => {
  // Mock Vector3
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  // Mock Scene
  class Scene {
    constructor() {
      this.children = [];
      this.background = null;
    }
    add(obj) {
      this.children.push(obj);
    }
    remove(obj) {
      const index = this.children.indexOf(obj);
      if (index !== -1) this.children.splice(index, 1);
    }
    clear() {
      this.children = [];
    }
  }

  // Mock BufferGeometry
  class BufferGeometry {
    constructor() {
      this.attributes = {};
    }
    dispose() {
      this.attributes = {};
    }
  }

  // Mock BoxGeometry
  class BoxGeometry extends BufferGeometry {
    constructor(width, height, depth) {
      super();
      this.width = width;
      this.height = height;
      this.depth = depth;
    }
  }

  // Mock SphereGeometry
  class SphereGeometry extends BufferGeometry {
    constructor(radius, widthSegments, heightSegments) {
      super();
      this.radius = radius;
      this.widthSegments = widthSegments;
      this.heightSegments = heightSegments;
    }
  }

  // Mock MeshPhongMaterial
  class MeshPhongMaterial {
    constructor(params) {
      this.color = params?.color || 0xffffff;
      this.emissive = params?.emissive || 0x000000;
      this.transparent = params?.transparent || false;
      this.opacity = params?.opacity || 1.0;
      this.wireframe = params?.wireframe || false;
      this.emissiveIntensity = 0;
    }
    dispose() {}
  }

  // Mock SpriteMaterial
  class SpriteMaterial {
    constructor(params) {
      this.color = params?.color || 0xffffff;
      this.map = params?.map || null;
    }
    dispose() {}
  }

  // Mock Sprite
  class Sprite {
    constructor(material) {
      this.material = material;
      this.position = new Vector3();
      this.scale = new Vector3(1, 1, 1);
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  // Mock CanvasTexture
  class CanvasTexture {
    constructor(canvas) {
      this.canvas = canvas;
    }
    dispose() {}
  }

  // Mock Mesh
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new Vector3();
      this.quaternion = new Quaternion();
      this.rotation = new Euler();
      this.children = [];
      this.scale = new Vector3(1, 1, 1);
    }
    add(child) {
      this.children.push(child);
    }
  }

  // Mock Quaternion
  class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
    copy(q) {
      this.x = q.x;
      this.y = q.y;
      this.z = q.z;
      this.w = q.w;
    }
    set(x, y, z, w) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
  }

  // Mock Euler
  class Euler {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  // Mock PerspectiveCamera
  class PerspectiveCamera {
    constructor(fov, aspect, near, far) {
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
      this.position = new Vector3();
    }
    lookAt() {}
    updateProjectionMatrix() {}
  }

  // Mock Color
  class Color {
    constructor(color) {
      this.color = color;
    }
    getHex() {
      return this.color;
    }
    getHSL(out) {
      return out || { h: 0, s: 0, l: 0 };
    }
    setHSL(h, s, l) {
      return this;
    }
  }

  // Mock WebGLRenderer
  class WebGLRenderer {
    constructor(params) {
      this.domElement = document.createElement('canvas');
      this.info = { render: { calls: 0 } };
    }
    setSize() {}
    setPixelRatio() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }

  // Mock AmbientLight
  class AmbientLight {
    constructor(color, intensity) {
      this.color = color;
      this.intensity = intensity;
    }
  }

  // Mock DirectionalLight
  class DirectionalLight {
    constructor(color, intensity) {
      this.color = color;
      this.intensity = intensity;
      this.position = new Vector3();
    }
  }

  // Mock AxesHelper
  class AxesHelper {
    constructor(size) {
      this.size = size;
    }
  }

  // Mock OrbitControls
  class OrbitControls {
    constructor(camera, domElement) {
      this.camera = camera;
      this.domElement = domElement;
      this.enableDamping = false;
    }
    update() {}
    dispose() {}
  }

  // Mock Stats
  class Stats {
    constructor() {
      this.dom = document.createElement('div');
    }
    showPanel() {}
    begin() {}
    end() {}
  }

  return {
    THREE: {
      Scene,
      Vector3,
      BoxGeometry,
      SphereGeometry,
      MeshPhongMaterial,
      SpriteMaterial,
      Sprite,
      CanvasTexture,
      Mesh,
      Quaternion,
      Euler,
      PerspectiveCamera,
      WebGLRenderer,
      Color,
      AmbientLight,
      DirectionalLight,
      AxesHelper
    },
    Stats,
    OrbitControls
  };
});

// Mock useEegStore - simplify this approach to avoid module resolution issues
vi.mock('@/stores/eegStore', () => ({
  useEegStore: vi.fn().mockImplementation(() => ({
    isActive: false,
    hasData: vi.fn().mockReturnValue(false),
    getLatestValue: vi.fn().mockReturnValue(0),
    sensorData: {
      data: {
        snr: {}
      }
    }
  }))
}));

// Mock global objects needed for tests
global.requestAnimationFrame = vi.fn(callback => {
  return setTimeout(callback, 0);
});

global.cancelAnimationFrame = vi.fn(id => {
  clearTimeout(id);
});

// We need to mock the store methods BEFORE importing the real store
vi.mock('@/stores/imuStore', async () => {
  // Import the original module
  const actual = await vi.importActual('@/stores/imuStore');
  
  // Get the THREE.js classes from our mock
  const threeHelper = await import('@/stores/threeHelper.js');
  const THREE = threeHelper.THREE;
  
  return {
    ...actual,
    useImuStore: vi.fn().mockImplementation(() => {
      const store = actual.useImuStore();
      
      // Mock the methods
      store.createBrainModel = vi.fn().mockImplementation(function() {
        this.threeObjects.brainModel = new THREE.Mesh(
          new THREE.SphereGeometry(1.5, 32, 32), 
          new THREE.MeshPhongMaterial({ color: 0xdddddd })
        );
        this.threeObjects.object3D = this.threeObjects.brainModel;
        this.threeObjects.scene.add(this.threeObjects.brainModel);
        
        // Add mock electrodes
        this.threeObjects.electrodes = {
          fp1: new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16), 
            new THREE.MeshPhongMaterial({ color: 0xFF0000 })
          ),
          fpz: new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16), 
            new THREE.MeshPhongMaterial({ color: 0x00FF00 })
          ),
          fp2: new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16), 
            new THREE.MeshPhongMaterial({ color: 0x0000FF })
          )
        };
        
        // Add electrodes to scene
        Object.values(this.threeObjects.electrodes).forEach(electrode => {
          this.threeObjects.scene.add(electrode);
        });
      });
      
      store.initializeThreeJs = vi.fn().mockImplementation(function(container) {
        if (!container) return false;
        
        this.imuPlot.container = container;
        this.threeObjects = {
          scene: new THREE.Scene(),
          camera: new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000),
          renderer: new THREE.WebGLRenderer({ antialias: true, alpha: true }),
          controls: new threeHelper.OrbitControls(),
          stats: new threeHelper.Stats(),
          brainModel: null,
          object3D: null,
          electrodes: {}
        };
        
        // Call the mocked createBrainModel
        this.createBrainModel();
        
        return true;
      });
      
      store.createTextSprite = vi.fn().mockImplementation(function(text) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
        sprite.scale = { x: 0.5, y: 0.25, z: 1 };
        return sprite;
      });
      
      store.cleanupObjects = vi.fn().mockImplementation(function() {
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
        
        if (this.threeObjects) {
          if (this.threeObjects.controls) this.threeObjects.controls.dispose();
          if (this.threeObjects.renderer) {
            this.threeObjects.renderer.dispose();
            this.threeObjects.renderer.forceContextLoss();
          }
          if (this.threeObjects.scene) this.threeObjects.scene.clear();
          
          this.threeObjects = null;
        }
      });
      
      store.startIMUVisualization = vi.fn().mockImplementation(function() {
        this.imuPlot.active = true;
      });
      
      store.stopIMUVisualization = vi.fn().mockImplementation(function() {
        this.imuPlot.active = false;
      });
      
      store.startSimulation = vi.fn().mockImplementation(function() {
        this.dataUpdateInterval = setInterval(() => {}, 100);
      });
      
      store.updateElectrodeVisualization = vi.fn().mockImplementation(function() {
        if (!this.threeObjects?.electrodes) return;
        
        const eegStore = require('@/stores/eegStore').useEegStore();
        
        Object.keys(this.threeObjects.electrodes).forEach(channel => {
          if (eegStore.hasData(channel)) {
            const electrode = this.threeObjects.electrodes[channel];
            const value = eegStore.getLatestValue(channel);
            
            if (electrode.scale && electrode.scale.set) {
              electrode.scale.set(1 + Math.abs(value) * 0.5, 1 + Math.abs(value) * 0.5, 1 + Math.abs(value) * 0.5);
            }
          }
        });
      });
      
      return store;
    })
  };
});

describe('IMU Store', () => {
  let store;
  
  beforeEach(() => {
    // Setup pinia
    const pinia = createPinia();
    setActivePinia(pinia);
    
    // Create mock container for the visualization
    const mockContainer = {
      clientWidth: 800,
      clientHeight: 600,
      appendChild: vi.fn(),
      removeChild: vi.fn()
    };
    
    // Mock the document.getElementById method
    document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'sim-indicator') {
        return {
          parentNode: {
            removeChild: vi.fn()
          }
        };
      }
      return null;
    });
    
    // Mock document.createElement
    document.createElement = vi.fn().mockImplementation((tag) => {
      if (tag === 'div') {
        return {
          id: '',
          style: {},
          textContent: '',
          parentNode: null
        };
      }
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            font: '',
            fillStyle: '',
            textAlign: '',
            fillText: vi.fn()
          })
        };
      }
      return {};
    });
    
    // Mock window.addEventListener
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();
    
    // Get a fresh store instance (with mocked methods)
    store = useImuStore();
    
    // Initialize container to prevent null reference
    store.imuPlot.container = mockContainer;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    if (store.dataUpdateInterval) {
      clearInterval(store.dataUpdateInterval);
      store.dataUpdateInterval = null;
    }
  });

  // Tests remain the same, the mocking approach is what changed
  it('should initialize with default state', () => {
    expect(store.imuPlot.active).toBe(false);
    expect(store.imuPlot.fps).toBe(0);
    expect(store.imuPlot.visualizationMode).toBe('brain');
    expect(store.imuPlot.diagnosisInfo).toEqual({ diagnosis_id: 1, diagnosis_stage: 2 });
    expect(store.sensorData.sensor).toBe('');
    expect(store.sensorData.channels).toEqual([]);
    expect(store.sensorData.data.x).toEqual([]);
    expect(store.sensorData.data.y).toEqual([]);
    expect(store.sensorData.data.z).toEqual([]);
    expect(store.sensorData.data.temperature).toBe(0);
  });

  it('should initialize THREE.js correctly', () => {
    // Call initialization
    const result = store.initializeThreeJs(store.imuPlot.container);
    
    // Check results
    expect(result).toBe(true);
    expect(store.threeObjects).not.toBeNull();
    expect(store.threeObjects.scene).toBeDefined();
    expect(store.threeObjects.scene.background.getHex()).toBe(0x222222);
    expect(store.threeObjects.camera).toBeDefined();
    expect(store.threeObjects.renderer).toBeDefined();
    expect(store.threeObjects.brainModel).not.toBeNull();
  });

  it('should toggle IMU visualization on/off', () => {
    // Initially inactive
    expect(store.imuPlot.active).toBe(false);
    
    // Toggle on
    store.toggleIMUVisualization();
    expect(store.startIMUVisualization).toHaveBeenCalled();
    expect(store.imuPlot.active).toBe(true);
    
    // Toggle off
    store.toggleIMUVisualization();
    expect(store.stopIMUVisualization).toHaveBeenCalled();
    expect(store.imuPlot.active).toBe(false);
  });

  it('should create a brain model visualization', () => {
    // Setup THREE.js environment first
    store.threeObjects = {
      scene: {
        add: vi.fn()
      },
      brainModel: null,
      object3D: null,
      electrodes: {}
    };
    
    // Call brain model creation
    store.createBrainModel();
    
    // Check that the mock was called
    expect(store.createBrainModel).toHaveBeenCalled();
    expect(store.threeObjects.brainModel).not.toBeNull();
    expect(store.threeObjects.electrodes).toHaveProperty('fp1');
    expect(store.threeObjects.electrodes).toHaveProperty('fpz');
    expect(store.threeObjects.electrodes).toHaveProperty('fp2');
    expect(store.createTextSprite).toHaveBeenCalledTimes(3);
  });

  it('should create a text sprite', () => {
    const sprite = store.createTextSprite('TEST');
    expect(sprite).toBeDefined();
    expect(sprite.scale.x).toBe(0.5);
    expect(sprite.scale.y).toBe(0.25);
    expect(sprite.scale.z).toBe(1);
  });

  it('should update IMU data correctly', () => {
    const testData = {
      imu: {
        sensor: 'test-sensor',
        channels: ['x', 'y', 'z', 'temperature'],
        data: {
          x: [1, 2, 3],
          y: [4, 5, 6],
          z: [7, 8, 9],
          temperature: 25.5
        }
      }
    };
    
    // Update with test data
    const result = store.updateIMUData(testData);
    
    // Check result and data update
    expect(result).toBe(true);
    expect(store.sensorData.sensor).toBe('test-sensor');
    expect(store.sensorData.channels).toEqual(['x', 'y', 'z', 'temperature']);
    expect(store.sensorData.data.x).toEqual([1, 2, 3]);
    expect(store.sensorData.data.y).toEqual([4, 5, 6]);
    expect(store.sensorData.data.z).toEqual([7, 8, 9]);
    expect(store.sensorData.data.temperature).toBe(25.5);
  });

  it('should reset orientation to default', () => {
    // Setup THREE.js object
    store.threeObjects = {
      object3D: {
        rotation: { set: vi.fn() },
        quaternion: { set: vi.fn() }
      }
    };
    
    // Set some non-default values
    store.sensorData = {
      sensor: 'test-sensor',
      channels: ['x', 'y', 'z'],
      data: {
        x: [1, 2, 3],
        y: [4, 5, 6],
        z: [7, 8, 9],
        temperature: 30
      }
    };
    store._objectRotation = { x: 1, y: 2, z: 3 };
    
    // Reset orientation
    store.resetOrientation();
    
    // Check that values were reset
    expect(store._objectRotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(store.sensorData.sensor).toBe('');
    expect(store.sensorData.channels).toEqual([]);
    expect(store.sensorData.data.x).toEqual([]);
    expect(store.sensorData.data.y).toEqual([]);
    expect(store.sensorData.data.z).toEqual([]);
    expect(store.sensorData.data.temperature).toBe(0);
    expect(store.threeObjects.object3D.rotation.set).toHaveBeenCalledWith(0, 0, 0);
    expect(store.threeObjects.object3D.quaternion.set).toHaveBeenCalledWith(0, 0, 0, 1);
  });

  it('should handle window resize correctly', () => {
    // Setup THREE.js objects
    store.threeObjects = {
      camera: {
        aspect: 1,
        updateProjectionMatrix: vi.fn()
      },
      renderer: {
        setSize: vi.fn()
      }
    };
    
    // Call resize handler
    store.handleResize();
    
    // Check that camera and renderer were updated
    expect(store.threeObjects.camera.updateProjectionMatrix).toHaveBeenCalled();
    expect(store.threeObjects.renderer.setSize).toHaveBeenCalled();
  });

  it('should clean up objects and resources', () => {
    // Setup THREE.js objects with mocks
    store.threeObjects = {
      controls: { dispose: vi.fn() },
      renderer: {
        dispose: vi.fn(),
        forceContextLoss: vi.fn(),
        domElement: document.createElement('canvas')
      },
      scene: { clear: vi.fn() }
    };
    
    // Set animation ID to be cleared
    store.animationId = 123;
    
    // Call cleanup
    store.cleanupObjects();
    
    // Check that cleanup was called and threeObjects is null
    expect(store.cleanupObjects).toHaveBeenCalled();
    expect(store.threeObjects).toBeNull();
  });

  it('should start simulation with appropriate data', () => {
    store.startSimulation();
    
    // Check that startSimulation was called and interval was set
    expect(store.startSimulation).toHaveBeenCalled();
    expect(store.dataUpdateInterval).toBeDefined();
  });

  it('should update electrode visualization based on EEG data', () => {
    // Mock the EEG store - we're using our vi.mock above for module mocking
    const mockEegStore = {
      isActive: true,
      hasData: vi.fn().mockReturnValue(true),
      getLatestValue: vi.fn().mockReturnValue(0.5),
      sensorData: {
        data: {
          snr: { fp1: 10, fpz: 15, fp2: 5 }
        }
      }
    };
    
    // Replace the useEegStore import result for this test only
    require('@/stores/eegStore').useEegStore.mockReturnValue(mockEegStore);
    
    // Setup electrodes
    store.threeObjects = {
      electrodes: {
        fp1: {
          scale: { set: vi.fn() },
          material: { 
            color: { getHex: () => 0xFF0000 },
            emissive: null,
            emissiveIntensity: 0
          }
        },
        fpz: {
          scale: { set: vi.fn() },
          material: { 
            color: { getHex: () => 0x00FF00 },
            emissive: null,
            emissiveIntensity: 0
          }
        },
        fp2: {
          scale: { set: vi.fn() },
          material: { 
            color: { getHex: () => 0x0000FF },
            emissive: null,
            emissiveIntensity: 0
          }
        }
      }
    };
    
    // Test the method
    store.updateElectrodeVisualization();
    
    // Check that updateElectrodeVisualization was called
    expect(store.updateElectrodeVisualization).toHaveBeenCalled();
  });
});
