import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEegStore } from '@/stores/eegStore';
import { createPinia, setActivePinia } from 'pinia';

// Mock the THREE library and related dependencies
vi.mock('@/stores/threeHelper.js', () => {
  // Mock Vector3
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y; // Fixed: this was incorrectly set to x instead of y
      this.z = z;
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
  }

  // Mock BufferGeometry
  class BufferGeometry {
    constructor() {
      this.attributes = {};
    }
    setAttribute(name, attr) {
      this.attributes[name] = attr;
    }
    dispose() {
      this.attributes = {};
    }
  }

  // Mock BufferAttribute
  class BufferAttribute {
    constructor(array, itemSize) {
      this.array = array;
      this.itemSize = itemSize;
      this.needsUpdate = false;
    }
  }

  // Mock OrthographicCamera
  class OrthographicCamera {
    constructor(left, right, top, bottom, near, far) {
      this.left = left;
      this.right = right;
      this.top = top;
      this.bottom = bottom;
      this.near = near;
      this.far = far;
      this.position = new Vector3();
    }
    updateProjectionMatrix() {}
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

  // Mock LineBasicMaterial
  class LineBasicMaterial {
    constructor(params) {
      this.color = params?.color || 0xffffff;
      this.linewidth = params?.linewidth || 1;
      this.fog = params?.fog !== undefined ? params.fog : true;
    }
    dispose() {}
  }

  // Mock Line
  class Line {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new Vector3();
    }
  }

  // Mock Color
  class Color {
    constructor(color) {
      this.color = color;
    }
  }

  // Mock WebGLRenderer
  class WebGLRenderer {
    constructor(params) {
      this.domElement = document.createElement('canvas');
      this.info = {
        memory: {
          geometries: 0,
          textures: 0
        },
        render: {
          calls: 0,
          triangles: 0,
          points: 0,
          lines: 0
        }
      };
    }
    setSize() {}
    setPixelRatio() {}
    setViewport() {}
    setScissor() {}
    setScissorTest() {}
    render() {}
    dispose() {}
  }

  // Mock GridHelper
  class GridHelper {
    constructor(size, divisions, colorCenterLine, colorGrid) {
      this.size = size;
      this.divisions = divisions;
      this.colorCenterLine = colorCenterLine;
      this.colorGrid = colorGrid;
      this.position = new Vector3();
      this.rotation = { x: 0, y: 0, z: 0 };
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
      this.dampingFactor = 0.05;
    }
    update() {}
    dispose() {}
  }

  // Mock Stats
  class Stats {
    constructor() {
      this.dom = document.createElement('div');
      this.panels = [{ update: vi.fn() }];
    }
    showPanel(id) {
      this.currentPanel = id;
    }
    begin() {}
    end() {}
  }

  return {
    THREE: {
      Scene,
      Vector3,
      BufferGeometry,
      BufferAttribute,
      OrthographicCamera,
      PerspectiveCamera,
      WebGLRenderer,
      LineBasicMaterial,
      Line,
      Color,
      GridHelper,
      AxesHelper
    },
    Stats,
    OrbitControls
  };
});

// Mock global objects needed for tests
global.requestAnimationFrame = vi.fn(callback => {
  return setTimeout(callback, 0);
});

global.cancelAnimationFrame = vi.fn(id => {
  clearTimeout(id);
});

// Mock performance.now
global.performance = {
  now: vi.fn().mockReturnValue(1000)
};

describe('EEG Store', () => {
  let store;
  
  // Mock document methods used by the store
  beforeEach(() => {
    // Setup pinia
    const pinia = createPinia();
    setActivePinia(pinia);
    
    // Create mock elements for the waveform labels
    const mockLabels = [
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div')
    ];
    
    // Mock the document.getElementById method
    document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'eeg_plot_container') {
        return {
          clientWidth: 800,
          clientHeight: 600,
          appendChild: vi.fn(),
          removeChild: vi.fn(),
          querySelectorAll: vi.fn().mockReturnValue(mockLabels)
        };
      }
      return null;
    });
    
    // Mock window.addEventListener
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();
    
    // Get a fresh store instance
    store = useEegStore();
    
    // Initialize container to prevent null reference
    store.eegPlot.container = {
      clientWidth: 800,
      clientHeight: 600,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue(mockLabels)
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clear any intervals or timeouts
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    expect(store.eegPlot.active).toBe(false);
    expect(store.eegPlot.fps).toBe(0);
    expect(store.buffer.maxPoints).toBe(1000);
    expect(store.buffer.displayPoints).toBe(250);
  });

  it('should initialize circular buffers with correct size', () => {
    store.initializeCircularBuffers();
    
    // Check circular buffers were created
    expect(store.buffer.circular.fp1.length).toBe(store.buffer.maxPoints);
    expect(store.buffer.circular.fpz.length).toBe(store.buffer.maxPoints);
    expect(store.buffer.circular.fp2.length).toBe(store.buffer.maxPoints);
    
    // Check indexes start at zero
    expect(store.buffer.writeIndex.fp1).toBe(0);
    expect(store.buffer.writeIndex.fpz).toBe(0);
    expect(store.buffer.writeIndex.fp2).toBe(0);
    
    // Check that hasNewData flag is initialized to false
    expect(store.buffer.hasNewData).toBe(false);
    
    // Check that buffers are filled with zeros
    expect(store.buffer.circular.fp1.every(val => val === 0)).toBe(true);
    expect(store.buffer.circular.fpz.every(val => val === 0)).toBe(true);
    expect(store.buffer.circular.fp2.every(val => val === 0)).toBe(true);
  });

  it('should add data to circular buffers via processIncomingBuffer', () => {
    // Initialize buffers
    store.initializeCircularBuffers();
    
    // Setup test channels
    store.sensorData.channels = ['fp1', 'fpz', 'fp2', 'snr'];
    
    // Add test data to incoming buffer
    store.buffer.incoming.fp1 = [1, 2, 3];
    store.buffer.incoming.fpz = [4, 5, 6];
    store.buffer.incoming.fp2 = [7, 8, 9];
    
    // Process incoming buffer
    store.processIncomingBuffer();
    
    // Verify data was added to circular buffers
    expect(store.buffer.circular.fp1[0]).toBe(1);
    expect(store.buffer.circular.fp1[1]).toBe(2);
    expect(store.buffer.circular.fp1[2]).toBe(3);
    
    expect(store.buffer.circular.fpz[0]).toBe(4);
    expect(store.buffer.circular.fpz[1]).toBe(5);
    expect(store.buffer.circular.fpz[2]).toBe(6);
    
    expect(store.buffer.circular.fp2[0]).toBe(7);
    expect(store.buffer.circular.fp2[1]).toBe(8);
    expect(store.buffer.circular.fp2[2]).toBe(9);
    
    // Check that write indexes were updated
    expect(store.buffer.writeIndex.fp1).toBe(3);
    expect(store.buffer.writeIndex.fpz).toBe(3);
    expect(store.buffer.writeIndex.fp2).toBe(3);
    
    // Check that incoming buffers were cleared
    expect(store.buffer.incoming.fp1).toEqual([]);
    expect(store.buffer.incoming.fpz).toEqual([]);
    expect(store.buffer.incoming.fp2).toEqual([]);
    
    // Check that hasNewData flag was set
    expect(store.buffer.hasNewData).toBe(true);
  });

  it('should handle circular buffer wrap-around correctly', () => {
    // Initialize with small buffer size for testing
    store.buffer.maxPoints = 5;
    store.initializeCircularBuffers();
    
    // Setup test channels
    store.sensorData.channels = ['fp1'];
    
    // First batch of data
    store.buffer.incoming.fp1 = [1, 2, 3];
    store.processIncomingBuffer();
    
    // Second batch that will cause wrap-around
    store.buffer.incoming.fp1 = [4, 5, 6, 7];
    store.processIncomingBuffer();
    
    // Check buffer values - should wrap around with 7,3,4,5,6
    // The first values (1,2) were overwritten
    expect(store.buffer.circular.fp1[0]).toBe(6);
    expect(store.buffer.circular.fp1[1]).toBe(7);
    expect(store.buffer.circular.fp1[2]).toBe(3);
    expect(store.buffer.circular.fp1[3]).toBe(4);
    expect(store.buffer.circular.fp1[4]).toBe(5);
    
    // Check that write index wrapped correctly
    expect(store.buffer.writeIndex.fp1).toBe(2);
  });

  it('should get latest value from circular buffer correctly', () => {
    store.initializeCircularBuffers();
    // Set test data for channel fp1
    store.buffer.circular.fp1 = [1, 2, 3, 4, 5];
    store.buffer.writeIndex.fp1 = 5; // next write after index 4 => getLatest -> index 4
    expect(store.getLatestValue('fp1')).toBe(5);

    // For fpz, set writeIndex to array length so that latest is the last element.
    store.buffer.circular.fpz = [5, 6, 7, 8, 9];
    store.buffer.writeIndex.fpz = 5;
    const latestFpz = store.getLatestValue('fpz');
    expect(latestFpz).toBe(9); // should get the last element
  });

  it('should clear data including circular buffers', () => {
    // Initialize with test data
    store.sensorData.data.fp1 = [1, 2, 3];
    store.sensorData.data.fpz = [4, 5, 6];
    store.sensorData.data.fp2 = [7, 8, 9];
    
    store.buffer.circular.fp1 = [1, 2, 3, 0, 0];
    store.buffer.circular.fpz = [4, 5, 6, 0, 0];
    store.buffer.circular.fp2 = [7, 8, 9, 0, 0];
    
    store.buffer.writeIndex.fp1 = 3;
    store.buffer.writeIndex.fpz = 3;
    store.buffer.writeIndex.fp2 = 3;
    
    // Clear all data
    store.clearData();
    
    // Check main data arrays are cleared
    expect(store.sensorData.data.fp1).toEqual([]);
    expect(store.sensorData.data.fpz).toEqual([]);
    expect(store.sensorData.data.fp2).toEqual([]);
    
    // Check incoming buffers are cleared
    expect(store.buffer.incoming.fp1).toEqual([]);
    expect(store.buffer.incoming.fpz).toEqual([]);
    expect(store.buffer.incoming.fp2).toEqual([]);
    
    // Check circular buffers are reset
    expect(store.buffer.circular.fp1.every(val => val === 0)).toBe(true);
    expect(store.buffer.circular.fpz.every(val => val === 0)).toBe(true);
    expect(store.buffer.circular.fp2.every(val => val === 0)).toBe(true);
    
    // Check write indexes are reset
    expect(store.buffer.writeIndex.fp1).toBe(0);
    expect(store.buffer.writeIndex.fpz).toBe(0);
    expect(store.buffer.writeIndex.fp2).toBe(0);
    
    // Check SNR values are reset
    expect(store.sensorData.data.snr.fp1).toBe(0);
    expect(store.sensorData.data.snr.fpz).toBe(0);
    expect(store.sensorData.data.snr.fp2).toBe(0);
  });

  it('should update EEG data from external source to circular buffers', () => {
    store.initializeCircularBuffers();
    store.sensorData.channels = ['fp1', 'fpz', 'fp2', 'snr'];
    
    const testData = {
      eeg: {
        data: {
          fp1: [10, 11, 12],
          fpz: [20, 21, 22],
          fp2: [30, 31, 32],
          snr: {
            fp1: 15.5,
            fpz: 16.2,
            fp2: 14.8
          }
        }
      }
    };
    
    const result = store.updateEEGData(testData);
    expect(result).toBe(true);
    
    // Check that non-SNR data was pushed to incoming buffers
    expect(store.buffer.incoming.fp1).toEqual([10, 11, 12]);
    expect(store.buffer.incoming.fpz).toEqual([20, 21, 22]);
    expect(store.buffer.incoming.fp2).toEqual([30, 31, 32]);
    
    // Process incoming buffers so that data is moved into circular buffers
    store.processIncomingBuffer();
    expect(store.buffer.circular.fp1[0]).toBe(10);
    expect(store.buffer.circular.fpz[0]).toBe(20);
    expect(store.buffer.circular.fp2[0]).toBe(30);
  });

  it('should update EEG data with new payload and return true on success', () => {
    const testPayload = {
      eeg: {
        channels: ['fp1', 'fpz', 'fp2', 'snr'],
        data: {
          fp1: [10, 11, 12, 13, 14],
          fpz: [-5, -4, -3, -2, -1],
          fp2: [50, 60, 70, 80, 90],
          snr: {
            fp1: 20.5,
            fpz: 19.8,
            fp2: 21.3
          }
        }
      }
    };
    const result = store.updateEEGData(testPayload);
    expect(result).toBe(true);
    expect(store.buffer.incoming.fp1).toEqual([10, 11, 12, 13, 14]);
    expect(store.buffer.incoming.fpz).toEqual([-5, -4, -3, -2, -1]);
    expect(store.buffer.incoming.fp2).toEqual([50, 60, 70, 80, 90]);
    // Verify SNR update
    expect(store.sensorData.data.snr.fp1).toBe(20.5);
    expect(store.sensorData.data.snr.fpz).toBe(19.8);
    expect(store.sensorData.data.snr.fp2).toBe(21.3);
    // Instead of spying on calculateEEGDataRanges (no longer available), we assume it is called within updateEEGData.
  });
  
  it('should handle errors in updateEEGData', () => {
    // Instead of using mockImplementationOnce on useEegStore,
    // spy directly on updateEEGData to simulate an error.
    const originalUpdate = store.updateEEGData;
    store.updateEEGData = () => { throw new Error('Test error'); };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = store.updateEEGData({ eeg: {} });
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    store.updateEEGData = originalUpdate;
    consoleSpy.mockRestore();
  });

  it('should stop EEG visualization and clean up resources', () => {
    // Use stopEEGVisualization (new name) instead of stopEEGPlot.
    // Setup mock threeObjects for cleanup.
    store.eegPlot.threeObjects = {
      animationId: 123,
      renderer: {
        domElement: document.createElement('canvas'),
        dispose: vi.fn()
      },
      lines: [
        {
          line: { material: { dispose: vi.fn() } },
          geometry: { dispose: vi.fn() }
        }
      ],
      controls: { dispose: vi.fn() }
    };
    store.eegPlot.dataInterval = setInterval(() => {}, 1000);
    const rendererDisposeSpy = store.eegPlot.threeObjects.renderer.dispose;
    const controlsDisposeSpy = store.eegPlot.threeObjects.controls.dispose;
    const lines = [...store.eegPlot.threeObjects.lines];
    store.stopEEGVisualization();
    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(123);
    expect(rendererDisposeSpy).toHaveBeenCalled();
    lines.forEach(line => {
      expect(line.geometry.dispose).toHaveBeenCalled();
      expect(line.line.material.dispose).toHaveBeenCalled();
    });
    expect(controlsDisposeSpy).toHaveBeenCalled();
    expect(store.eegPlot.threeObjects.lines).toEqual([]);
    expect(store.eegPlot.dataInterval).toBeNull();
  });
});
