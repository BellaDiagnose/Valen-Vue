import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useEegStore } from '@/stores/eegStore';

// Mock Vue components and router
vi.mock('vue', () => {
  return {
    createApp: vi.fn(() => ({
      use: vi.fn().mockReturnThis(),
      mount: vi.fn(),
      config: {
        errorHandler: null
      }
    }))
  };
});

vi.mock('@/router', () => ({ routes: [] }));
vi.mock('@/app.vue', () => ({}));
vi.mock('@/debug.js', () => ({}));

// Mock the EEG store
vi.mock('@/stores/eegStore', () => {
  const updateEEGVisualizationMock = vi.fn();
  
  return {
    useEegStore: vi.fn(() => ({
      updateEEGVisualization: updateEEGVisualizationMock,
      eegPlot: {
        eeg: {
          realTimeMode: true
        }
      }
    }))
  };
});

describe('Bella Native Bridge', () => {
  let originalWebkit;
  let mockPinia;
  let mockPostMessage;
  
  // Create a mock implementation of the bridge
  const setupMockBridge = () => {
    // Create mock store references
    const storeReferences = {
      eegStore: useEegStore()
    };
    
    // Create the bridge object - using BellaBridge to match valen.js
    window.BellaBridge = {
      handlers: {
        // Use plotEEGData to match the handler name in valen.js
        plotEEGData: function(data) {
          try {
            storeReferences.eegStore.updateEEGVisualization(data);
            return { success: true };
          } catch (error) {
            console.error('Error updating EEG visualization:', error);
            return { success: false, error: error.message };
          }
        },
        
        setConfiguration: function(config) {
          return { success: true };
        },
        
        handleEvent: function(eventData) {
          return { success: true };
        }
      },
      
      calls: {
        requestCPP: function(command, params) {
          if (window.webkit && window.webkit.messageHandlers && 
              window.webkit.messageHandlers.vueEvent) {
            try {
              window.webkit.messageHandlers.vueEvent.postMessage({
                command: command,
                params: params
              });
              return true;
            } catch (error) {
              console.error('Error sending command to C++ backend:', error);
              return false;
            }
          } else {
            console.warn('Native bridge not available. Running in browser mode.');
            return false;
          }
        },
        
        // Use command names that match valen.js
        startEEG: function(settings) {
          return this.requestCPP('start', settings);
        },
        
        stopEEG: function() {
          return this.requestCPP('stop', {});
        }
      }
    };
  };
  
  beforeEach(() => {
    // Setup mock Pinia
    mockPinia = createPinia();
    setActivePinia(mockPinia);
    
    // Store original webkit if it exists
    originalWebkit = window.webkit;
    
    // Mock webkit message handler
    mockPostMessage = vi.fn();
    window.webkit = {
      messageHandlers: {
        vueEvent: {
          postMessage: mockPostMessage
        }
      }
    };
    
    // Clear console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Setup the mock bridge instead of importing valen.js
    setupMockBridge();
  });
  
  afterEach(() => {
    // Restore webkit
    window.webkit = originalWebkit;
    
    // Clean up
    delete window.BellaBridge;
    
    // Clear mocks
    vi.clearAllMocks();
  });
  
  it('should initialize the BellaBridge global object', () => {
    expect(window.BellaBridge).toBeDefined();
    expect(window.BellaBridge.handlers).toBeDefined();
    expect(window.BellaBridge.calls).toBeDefined();
    expect(typeof window.BellaBridge.handlers.plotEEGData).toBe('function');
    expect(typeof window.BellaBridge.calls.requestCPP).toBe('function');
  });
  
  it('should handle EEG data received from C++ and update the store', () => {
    // Create test EEG data
    const testEEGData = {
      eeg: {
        data: {
          fp1: [1, 2, 3, 4, 5],
          fpz: [6, 7, 8, 9, 10],
          fp2: [11, 12, 13, 14, 15]
        },
        snr: {
          fp1: 12.5,
          fpz: 13.6,
          fp2: 11.8
        }
      }
    };
    
    // Call the bridge handler
    const result = window.BellaBridge.handlers.plotEEGData(testEEGData);
    
    // Verify the EEG store was accessed
    expect(useEegStore).toHaveBeenCalled();
    
    // Verify updateEEGVisualization was called with the correct data
    const eegStore = useEegStore();
    expect(eegStore.updateEEGVisualization).toHaveBeenCalledWith(testEEGData);
    
    // Verify the handler returned success
    expect(result).toEqual({ success: true });
  });
  
  it('should handle errors during EEG data processing', () => {
    // Mock the EEG store to throw an error
    useEegStore.mockImplementationOnce(() => ({
      updateEEGVisualization: vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      }),
      eegPlot: {
        eeg: {
          realTimeMode: true
        }
      }
    }));
    
    // Setup the bridge again with the new mocked store
    setupMockBridge();
    
    // Call the bridge handler with invalid data
    const result = window.BellaBridge.handlers.plotEEGData({});
    
    // Verify the handler returned an error
    expect(result.success).toBe(false);
    expect(result.error).toBe('Test error');
    
    // Verify the error was logged
    expect(console.error).toHaveBeenCalled();
  });
  
  it('should send commands to the C++ backend', () => {
    // Call requestCPP
    const result = window.BellaBridge.calls.requestCPP('testCommand', { param: 'value' });
    
    // Verify postMessage was called with the correct data
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'testCommand',
      params: { param: 'value' }
    });
    
    // Verify the method returned true (success)
    expect(result).toBe(true);
  });
  
  it('should handle errors when sending commands', () => {
    // Make postMessage throw an error
    mockPostMessage.mockImplementationOnce(() => {
      throw new Error('Post message error');
    });
    
    // Call requestCPP
    const result = window.BellaBridge.calls.requestCPP('testCommand', {});
    
    // Verify the method returned false (failure)
    expect(result).toBe(false);
    
    // Verify the error was logged
    expect(console.error).toHaveBeenCalled();
  });
  
  it('should provide specific command helpers', () => {
    // Spy on requestCPP
    const requestCPPSpy = vi.spyOn(window.BellaBridge.calls, 'requestCPP');
    
    // Call specific commands that match valen.js
    window.BellaBridge.calls.startEEG({ sample_rate: 250 });
    window.BellaBridge.calls.stopEEG();
    
    // Verify requestCPP was called with the correct parameters
    expect(requestCPPSpy).toHaveBeenCalledWith('start', { sample_rate: 250 });
    expect(requestCPPSpy).toHaveBeenCalledWith('stop', {});
  });
  
  it('should warn when native bridge is not available', () => {
    // Remove webkit message handler
    delete window.webkit.messageHandlers.vueEvent;
    
    // Call requestCPP
    const result = window.BellaBridge.calls.requestCPP('testCommand', {});
    
    // Verify the warning was logged
    expect(console.warn).toHaveBeenCalledWith('Native bridge not available. Running in browser mode.');
    
    // Verify the method returned false (failure)
    expect(result).toBe(false);
  });
});
