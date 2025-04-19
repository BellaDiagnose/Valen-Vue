/**
 * Mock implementation of bellaBridge for testing without the C++ backend
 */

// Mock data stores
const mockData = {
  patients: [],
  diagnoses: [],
  predictions: [] // Add predictions array to store mock prediction data
};

// Mock handlers that will be called when "responses" come back from the "backend"
const mockHandlers = {
  updatePatientData: null,
  updateDiagnosisData: null,
  updateDiagnosisList: null,
  updatePredictionData: null // Add handler for prediction data
};

// Initialize bellaBridge if it doesn't exist
if (!window.bellaBridge) {
  window.bellaBridge = {
    // Mock calls to C++ backend
    calls: {
      cppBackend: (type, params) => {
        console.log(`Mock cppBackend called with type: ${type}, params:`, params);
        
        if (type === 'record') {
          const { table, operation, data } = params;
          
          // Handle patient operations
          if (table === 'patient') {
            return handlePatientOperation(operation, data);
          }
          // Handle diagnosis operations
          else if (table === 'diagnosis') {
            return handleDiagnosisOperation(operation, data);
          }
          // Handle prediction operations
          else if (table === 'prediction') {
            return handlePredictionOperation(operation, data);
          }
        }
        else if (type === 'sensor') {
          const { sensor, action } = params;
          
          // Handle EEG sensor operations
          if (sensor === 'ads1299') {
            return handleEEGSensorOperation(action, params);
          }
        }
        
        return false;
      }
    },
    
    // Register handlers that will be called by the "backend"
    handlers: {
      updatePatientData: (data) => {
        console.log('Mock updatePatientData handler called with data:', data);
        if (mockHandlers.updatePatientData) {
          mockHandlers.updatePatientData(data);
        }
      },
      updateDiagnosisData: (data) => {
        console.log('Mock updateDiagnosisData handler called with data:', data);
        if (mockHandlers.updateDiagnosisData) {
          // Ensure the handler function is called with the correct data
          mockHandlers.updateDiagnosisData(data);
        } else {
          console.warn('No handler registered for updateDiagnosisData');
        }
      },
      updatePredictionData: (data) => {
        console.log('Mock updatePredictionData handler called with data:', data);
        if (mockHandlers.updatePredictionData) {
          mockHandlers.updatePredictionData(data);
        } else {
          console.warn('No handler registered for updatePredictionData');
        }
      },
      // Add handler registration function
      registerHandler: (handlerName, handlerFn) => {
        if (typeof handlerFn === 'function') {
          mockHandlers[handlerName] = handlerFn;
          console.log(`Registered mock handler: ${handlerName}`);
          return true;
        }
        console.warn(`Failed to register handler: ${handlerName} is not a function`);
        return false;
      }
    }
  };
  
  // Register default handlers for important data updates
  // This avoids the need to register handlers in component files
  window.bellaBridge.handlers.registerHandler('updateDiagnosisData', (data) => {
    console.log('Default mock diagnosis data handler called with data:', data); 
    // If using a store in this context, would need to import it
    // Otherwise this will be handled by component-level registration
    if (window.diagnosisStore) {
      window.diagnosisStore.diagnoses = Array.isArray(data) ? data : [];
    }
  });

  // Register default handler for prediction data
  window.bellaBridge.handlers.registerHandler('updatePredictionData', (data) => {
    console.log('Default mock prediction data handler called with data:', data);
    // If using a store in this context, would need to import it
    if (window.predictionStore) {
      if (Array.isArray(data)) {
        window.predictionStore.predictions = data;
      } else if (data && typeof data === 'object') {
        // Single prediction or response
        if (window.predictionStore.updatePredictionData) {
          window.predictionStore.updatePredictionData(data);
        }
      }
    }
  });
}

// Remove mock EEG data handler
if (window.bellaBridge.handlers.updateEEGData) {
  delete window.bellaBridge.handlers.updateEEGData;
}

// Handle EEG sensor operations
function handleEEGSensorOperation(action, params) {
  console.log(`Mock EEG sensor operation: ${action}`, params);
  
  switch(action) {
    case 'start':
      startMockEEGData(params);
      return true;
    case 'stop':
      stopMockEEGData();
      return true;
    case 'evaluate':
      mockEEGEvaluation(params);
      return true;
    default:
      console.warn(`Unhandled EEG sensor action: ${action}`);
      return false;
  }
}

// Variables to track the mock EEG data simulation
let mockEEGInterval = null;
let mockEEGContainer = null;
let isSimulationActive = false;
let mockUpdateFrequency = 100; // Generate data every 100ms for smooth visualization
let debug = false; // Enable for debugging

/**
 * Initialize EEG data buffers with sine wave patterns if no data exists
 * Creates a visual baseline for the EEG visualization
 * 
 * @param {Object} eegStore - Reference to the EEG store
 * @returns {boolean} - True if initialization was performed, false if data already existed
 */
function initializeEmptyEEGBuffers(eegStore) {
  const { buffer, sensorData, isMockMode } = eegStore;
  
  if (!isMockMode) return false;
  
  // Check if we have any data in the circular buffers yet
  const hasData = ['fp1', 'fpz', 'fp2'].some(ch => {
    return buffer.circular[ch] && buffer.circular[ch].some(v => v !== 0);
  });
  
  if (!hasData) {
    console.warn('No EEG data available yet in mock mode, initializing with demo data');
    
    // Set default channels if not set
    if (!sensorData.channels || sensorData.channels.length === 0) {
      sensorData.channels = ['fp1', 'fpz', 'fp2', 'snr'];
      console.log('Set default channels:', sensorData.channels);
    }
    
    // Initialize with some simple sine wave data for visual feedback
    const length = buffer.maxPoints || 1000;
    
    for (const channel of ['fp1', 'fpz', 'fp2']) {
      if (!buffer.circular[channel]) {
        buffer.circular[channel] = new Array(length).fill(0);
        console.log(`Created circular buffer for ${channel} with length ${length}`);
      }
      
      // Different frequencies for each channel
      const freq = channel === 'fp1' ? 0.05 : 
                  channel === 'fpz' ? 0.03 : 0.04;
      
      // Fill with sine waves
      for (let i = 0; i < length; i++) {
        buffer.circular[channel][i] = Math.sin(i * freq) * 0.5;
      }
      
      // Initialize write index
      buffer.writeIndex[channel] = length - 1;
    }
    
    // Set SNR values
    sensorData.data.snr = {
      fp1: 15.0,
      fpz: 14.5,
      fp2: 15.2
    };
    
    console.log('Initialized mock data:', {
      channels: sensorData.channels,
      snr: sensorData.data.snr,
      writeIndices: buffer.writeIndex
    });
    
    buffer.hasNewData = true;
    return true;
  } else if (debug) {
    console.log('Mock data already initialized');
  }
  
  return false;
}

/**
 * Generate mock EEG data for simulation mode
 * @param {Object} eegStore - Reference to the EEG store
 */
function generateMockEEGData(eegStore) {
  const { buffer, sensorData } = eegStore;
  const now = Date.now() / 1000;
  
  // Generate more points for smoother visualization (10-15ms worth at 250Hz)
  const newPoints = Math.floor(mockUpdateFrequency / 40) * 10; // ~10 points per 40ms
  
  // Make sure channels are defined
  if (!sensorData.channels || sensorData.channels.length === 0) {
    sensorData.channels = ['fp1', 'fpz', 'fp2', 'snr'];
  }
  
  // Generate data for each channel
  for (const channel of sensorData.channels) {
    if (channel === 'snr') {
      // Update SNR values with some variation
      sensorData.data.snr = {
        fp1: 15.2 + Math.sin(now * 0.1) * 1.5,
        fpz: 14.8 + Math.sin(now * 0.15) * 1.2,
        fp2: 15.5 + Math.sin(now * 0.12) * 1.3
      };
      continue;
    }
    
    // Initialize incoming buffer if needed
    if (!buffer.incoming[channel]) {
      buffer.incoming[channel] = [];
    }
    
    // Different frequencies for each channel to make them look distinct
    const alphaFreq = { 
      fp1: 10, 
      fpz: 11, 
      fp2: 9 
    };
    
    const betaFreq = { 
      fp1: 20, 
      fpz: 22, 
      fp2: 18 
    };
    
    // Generate new points
    for (let i = 0; i < newPoints; i++) {
      // Time for this sample (now + i/250) for 250Hz
      const t = now + i/250;
      
      // Alpha wave component (8-13 Hz)
      const alpha = Math.sin(t * alphaFreq[channel] * 2 * Math.PI) * 0.5;
      
      // Beta wave component (13-30 Hz)
      const beta = Math.sin(t * betaFreq[channel] * 2 * Math.PI) * 0.2;
      
      // Add some random noise
      const noise = (Math.random() - 0.5) * 0.1;
      
      // Calculate point value with more dynamic changes to make it obvious
      let pointValue = alpha + beta + noise;
      
      // Add channel-specific variations
      if (channel === 'fp1') {
        pointValue += Math.sin(t * 0.5) * 0.3; // Slower modulation with higher amplitude
      } else if (channel === 'fpz') {
        pointValue += Math.sin(t * 0.7) * 0.25;
      } else if (channel === 'fp2') {
        pointValue += Math.sin(t * 0.3) * 0.35;
      }
      
      // Add to incoming buffer
      buffer.incoming[channel].push(pointValue);
    }
  }
  
  if (debug) {
    console.log(`Generated ${newPoints} mock data points per channel`);
  }
  
  // Set the hasNewData flag to true to trigger visualization update
  buffer.hasNewData = true;
  buffer.lastMockUpdateTime = performance.now();
}

/**
 * Start mock/simulation mode for EEG data
 * Generate simulated EEG data when no real hardware is connected
 */
function startMockEEGData(params = {}) {
  if (isSimulationActive) {
    console.log('EEG simulation already running');
    return;
  }
  
  isSimulationActive = true;
  console.log('Starting EEG mock data simulation with params:', params);
  
  // Get the EEG store if it's available in the window object
  const eegStore = window.storeReferences?.eegStore;
  if (!eegStore) {
    console.error('EEG store not found in global references');
    return;
  }
  
  // Setup the window.bellaBridge for mock mode instead of directly setting on store
  window.bellaBridge.isMockMode = true;
  
  // Initialize the buffer and channels if needed
  if (!eegStore.buffer.circular?.fp1) {
    eegStore.initializeBuffers();
  }
  
  // Setup default channels if not set
  if (!eegStore.sensorData.sensor) {
    eegStore.sensorData.sensor = 'simulated';
    eegStore.sensorData.channels = ['fp1', 'fpz', 'fp2', 'snr'];
  }
  
  // Find the container element
  mockEEGContainer = eegStore.eegPlot.container;
  
  // Add simulation indicator if container exists
  if (mockEEGContainer) {
    addSimulationIndicator(mockEEGContainer);
  }
  
  // Set diagnosis ID and stage from parameters
  eegStore.sensorData.diagnosisId = params.diagnosis_id || 0;
  eegStore.sensorData.diagnosisStage = params.diagnosis_stage || 1;
  
  // Generate initial batch of data
  generateMockEEGData(eegStore);
  eegStore.buffer.hasNewData = true;
  eegStore.buffer.lastMockUpdateTime = performance.now();
  
  // Set up a dedicated interval for mock data generation for consistent updates
  mockEEGInterval = setInterval(() => {
    if (!eegStore) return;
    
    generateMockEEGData(eegStore);
  }, mockUpdateFrequency); // Generate data every 100ms
  
  console.log('Mock EEG data generation started');
}

/**
 * Add a visual indicator for simulation mode to the container
 */
function addSimulationIndicator(container) {
  // Don't add if already exists
  if (document.getElementById('sim-indicator')) return;
  
  // Add a visual indicator for simulation mode
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
  simText.textContent = 'SIMULATION';
  
  container.appendChild(simText);
}

/**
 * Stop mock/simulation mode for EEG data
 */
function stopMockEEGData() {
  if (!isSimulationActive) return;
  
  if (mockEEGInterval) {
    clearInterval(mockEEGInterval);
    mockEEGInterval = null;
  }
  
  // Remove simulation indicator if it exists
  const simIndicator = document.getElementById('sim-indicator');
  if (simIndicator && simIndicator.parentNode) {
    simIndicator.parentNode.removeChild(simIndicator);
  }
  
  // Update the mock mode flag on bellaBridge instead of eegStore
  if (window.bellaBridge) {
    window.bellaBridge.isMockMode = false;
  }
  
  isSimulationActive = false;
  console.log('Stopped EEG mock data simulation');
}

/**
 * Generate a mock EEG evaluation result
 */
function mockEEGEvaluation(params) {
  console.log('Generating mock EEG evaluation result:', params);
  
  // Extract parameters
  const diagnosis_id = params.diagnosis_id || 0;
  const diagnosis_stage = params.diagnosis_stage || 1;
  
  // Create a fake prediction result with random values
  const mockPrediction = {
    label: ['Normal', 'Abnormal', 'Inconclusive'][Math.floor(Math.random() * 3)],
    probability: Math.random() * 0.5 + 0.5, // Random value between 0.5 and 1.0
    raw_output: [Math.random(), Math.random(), Math.random()].map(v => v * 0.8 + 0.1) // 3 random values
  };
  
  // Normalize raw_output to sum to 1.0
  const sum = mockPrediction.raw_output.reduce((a, b) => a + b, 0);
  mockPrediction.raw_output = mockPrediction.raw_output.map(v => v / sum);
  
  // Create mock evaluation result
  const mockResult = {
    diagnosis_id,
    diagnosis_stage,
    prediction_id: Math.floor(Math.random() * 1000) + 1,
    prediction: mockPrediction,
    num_records: Math.floor(Math.random() * 50) + 10,
    timestamp: Math.floor(Date.now() / 1000)
  };
  
  // Also add this result to the mock predictions for consistency
  mockData.predictions.push({
    prediction_id: mockResult.prediction_id,
    diagnosis_id: mockResult.diagnosis_id,
    raw_output: mockResult.prediction.raw_output,
    created_at: mockResult.timestamp
  });
  
  // Delay the response to simulate processing time
  setTimeout(() => {
    const eegStore = window.storeReferences?.eegStore;
    if (eegStore && eegStore.processEvaluationResults) {
      eegStore.processEvaluationResults(mockResult);
    } else if (window.bellaBridge?.handlers?.displayEEGEvaluation) {
      window.bellaBridge.handlers.displayEEGEvaluation(mockResult);
    } else {
      console.error('No handler found to process EEG evaluation results');
    }
  }, 1200); // Simulate a delay for "processing"
  
  return true;
}

// Helper function to handle patient operations
function handlePatientOperation(operation, data) {
  switch (operation) {
    case 'add':
      return handleAddPatient(data);
    case 'update':
      return handleUpdatePatientStatus(data);
    case 'read':
      return handleReadPatients(data);
    default:
      console.error(`Unknown patient operation: ${operation}`);
      return false;
  }
}

// Helper function to handle diagnosis operations
function handleDiagnosisOperation(operation, data) {
  switch (operation) {
    case 'create':
      return handleCreateDiagnosis(data);
    case 'read':
      return handleReadDiagnoses(data);
    default:
      console.error(`Unknown diagnosis operation: ${operation}`);
      return false;
  }
}

// Handle prediction operations
function handlePredictionOperation(operation, data) {
  switch (operation) {
    case 'add':
      return handleAddPrediction(data);
    case 'read':
      if (data.prediction_id) {
        return handleGetPredictionById(data);
      } else if (data.diagnosis_id) {
        return handleGetPredictionsByDiagnosis(data);
      } else {
        console.error('Missing prediction_id or diagnosis_id for read operation');
        return false;
      }
    default:
      console.error(`Unknown prediction operation: ${operation}`);
      return false;
  }
}

// Handle adding a new prediction
function handleAddPrediction(data) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Make sure raw_output is in the correct format
  let rawOutput = data.raw_output;
  if (typeof rawOutput === 'string') {
    try {
      rawOutput = rawOutput.split(',').map(Number);
    } catch (e) {
      console.error('Failed to parse raw_output string to array', e);
      rawOutput = [0.7, 0.2, 0.1]; // Default if parsing fails
    }
  } else if (!Array.isArray(rawOutput)) {
    rawOutput = [0.7, 0.2, 0.1]; // Default if not provided or invalid
  }
  
  const newPrediction = {
    prediction_id: mockData.predictions.length + 1,
    diagnosis_id: parseInt(data.diagnosis_id) || 0,
    raw_output: rawOutput,
    created_at: timestamp
  };
  
  mockData.predictions.push(newPrediction);
  console.log('Added mock prediction:', newPrediction);
  
  // Simulate async response
  setTimeout(() => {
    window.bellaBridge.handlers.updatePredictionData({
      success: true,
      prediction_id: newPrediction.prediction_id
    });
  }, 300);
  
  return true;
}

// Handle getting a prediction by ID
function handleGetPredictionById(data) {
  // Make sure we're using an integer for comparison
  const predictionId = parseInt(data.prediction_id);
  const prediction = mockData.predictions.find(p => p.prediction_id === predictionId);
  
  if (prediction) {
    console.log('Found prediction by ID:', prediction);
    
    // Simulate async response
    setTimeout(() => {
      window.bellaBridge.handlers.updatePredictionData(prediction);
    }, 300);
    
    return true;
  } else {
    console.error(`Prediction with ID ${predictionId} not found`);
    
    // Simulate async error response
    setTimeout(() => {
      window.bellaBridge.handlers.updatePredictionData({
        success: false,
        message: `Prediction with ID ${predictionId} not found`
      });
    }, 300);
    
    return false;
  }
}

// Handle getting predictions by diagnosis ID
function handleGetPredictionsByDiagnosis(data) {
  // Make sure we're using an integer for comparison
  const diagnosisId = parseInt(data.diagnosis_id);
  
  // Get all predictions for this diagnosis and ensure they're ordered by created_at (newest first)
  const predictions = mockData.predictions
    .filter(p => p.diagnosis_id === diagnosisId)
    .sort((a, b) => b.created_at - a.created_at);
  
  console.log(`Found ${predictions.length} predictions for diagnosis ID ${diagnosisId}`);
  
  // Simulate async response
  setTimeout(() => {
    window.bellaBridge.handlers.updatePredictionData(predictions);
  }, 300);
  
  return true;
}

// Mock functions for patient operations
function handleAddPatient(data) {
  const timestamp = Math.floor(Date.now() / 1000);
  const newPatient = {
    patient_id: mockData.patients.length + 1,
    raw_data: data.raw_data || '{}',
    active_status: data.status !== undefined ? data.status : true,
    created_at: timestamp
  };
  
  mockData.patients.push(newPatient);
  console.log('Added mock patient:', newPatient);
  
  // Simulate async response
  setTimeout(() => {
    window.bellaBridge.handlers.updatePatientData({
      success: true,
      patient_id: newPatient.patient_id
    });
  }, 300);
  
  return true;
}

function handleUpdatePatientStatus(data) {
  const { patient_id, status } = data;
  const patientIndex = mockData.patients.findIndex(p => p.patient_id === patient_id);
  
  if (patientIndex >= 0) {
    mockData.patients[patientIndex].active_status = status;
    console.log(`Updated patient ${patient_id} status to ${status}`);
    
    // Simulate async response
    setTimeout(() => {
      window.bellaBridge.handlers.updatePatientData({
        success: true,
        patient_id,
        status
      });
    }, 300);
    
    return true;
  } else {
    console.error(`Patient with ID ${patient_id} not found`);
    
    setTimeout(() => {
      window.bellaBridge.handlers.updatePatientData({
        success: false,
        error: `Patient with ID ${patient_id} not found`
      });
    }, 300);
    
    return false;
  }
}

function handleReadPatients(data) {
  // Filter active patients if status is specified as active
  let patientsToReturn = mockData.patients;
  if (data && data.status === 'active') {
    patientsToReturn = mockData.patients.filter(p => p.active_status);
  }
  
  console.log('Reading patients:', patientsToReturn);
  
  // Simulate async response
  setTimeout(() => {
    window.bellaBridge.handlers.updatePatientData(patientsToReturn);
  }, 300);
  
  return true;
}

// Mock functions for diagnosis operations
function handleCreateDiagnosis(data) {
  const { admin_id, patient_id } = data;
  
  // Check if these values are valid
  if (!admin_id || !patient_id) {
    console.error("Invalid admin_id or patient_id for diagnosis creation:", data);
    
    // Return failure response asynchronously
    setTimeout(() => {
      window.bellaBridge.handlers.updateDiagnosisData({
        success: false,
        error: "Invalid admin_id or patient_id"
      });
    }, 300);
    
    return false;
  }
  
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Make sure we use integers for IDs and generate a unique diagnosis_id
  const newDiagnosis = {
    diagnosis_id: mockData.diagnoses.length + 1,
    admin_id: parseInt(admin_id),
    patient_id: parseInt(patient_id),
    active_status: true,
    created_at: timestamp,
    is_valid: true
  };
  
  mockData.diagnoses.push(newDiagnosis);
  console.log('Created mock diagnosis:', newDiagnosis);
  
  // Format exactly matches what diagnosisStore.updateDiagnosisData expects
  // by checking the C++ implementation in diagnosis_module.cpp
  setTimeout(() => {
    const response = {
      success: true,
      diagnosis_id: newDiagnosis.diagnosis_id,
      patient_id: newDiagnosis.patient_id,
      admin_id: newDiagnosis.admin_id,
      active_status: newDiagnosis.active_status,
      created_at: newDiagnosis.created_at
    };
    
    // Log the response for debugging
    console.log('Sending diagnosis creation response:', response);
    
    // Ensure handler is called with the correct response
    window.bellaBridge.handlers.updateDiagnosisData(response);
  }, 300);
  
  return true;
}

function handleReadDiagnoses(data) {
  const { patient_id } = data;
  // Ensure patient_id is parsed as integer for comparison
  const patientIdInt = parseInt(patient_id);
  
  // Get all diagnoses for this patient
  const patientDiagnoses = mockData.diagnoses.filter(d => d.patient_id === patientIdInt);
  
  console.log(`Reading diagnoses for patient ${patientIdInt}:`, patientDiagnoses);
  
  setTimeout(() => {
    // Modified: Send the diagnoses array directly instead of wrapping it in a records property
    // This matches what the diagnosisStore in the frontend is expecting
    const diagnosisArray = patientDiagnoses.map(d => ({
      diagnosis_id: d.diagnosis_id,
      admin_id: d.admin_id,
      patient_id: d.patient_id,
      active_status: d.active_status,
      created_at: d.created_at,
      is_valid: d.is_valid
    }));
    
    console.log('Sending diagnosis data to frontend with corrected format:', diagnosisArray);
    window.bellaBridge.handlers.updateDiagnosisData(diagnosisArray);
  }, 300);
  
  return true;
}

// Initialize with some mock data if needed
function initializeMockData() {
  // Add some sample patients if none exist
  if (mockData.patients.length === 0) {
    mockData.patients = [
      {
        patient_id: 1,
        raw_data: JSON.stringify({
          name: "John Doe",
          age: 45,
          gender: "male",
          notes: "Sample patient record"
        }),
        active_status: true,
        created_at: Math.floor(Date.now() / 1000) - 86400 // 1 day ago
      },
      {
        patient_id: 2,
        raw_data: JSON.stringify({
          name: "Jane Smith",
          age: 32,
          gender: "female",
          notes: "Sample patient record"
        }),
        active_status: true,
        created_at: Math.floor(Date.now() / 1000) - 43200 // 12 hours ago
      },
      {
        patient_id: 3,
        raw_data: JSON.stringify({
          name: "Robert Johnson",
          age: 58,
          gender: "male",
          notes: "High risk patient"
        }),
        active_status: true,
        created_at: Math.floor(Date.now() / 1000) - 21600 // 6 hours ago
      }
    ];
  }
  
  // Add comprehensive sample diagnoses if none exist
  if (mockData.diagnoses.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    mockData.diagnoses = [
      // Multiple diagnoses for patient 1 (John Doe)
      {
        diagnosis_id: 1,
        admin_id: 1,
        patient_id: 1,
        active_status: true,
        created_at: now - 3600 * 24, // 24 hours ago
        is_valid: true
      },
      {
        diagnosis_id: 2,
        admin_id: 1,
        patient_id: 1,
        active_status: true,
        created_at: now - 3600 * 12, // 12 hours ago
        is_valid: true
      },
      {
        diagnosis_id: 3,
        admin_id: 2, // Different admin
        patient_id: 1,
        active_status: true,
        created_at: now - 3600 * 2, // 2 hours ago
        is_valid: true
      },
      
      // Some diagnoses for patient 2 (Jane Smith)
      {
        diagnosis_id: 4,
        admin_id: 1,
        patient_id: 2,
        active_status: true,
        created_at: now - 3600 * 36, // 36 hours ago
        is_valid: true
      },
      {
        diagnosis_id: 5,
        admin_id: 1,
        patient_id: 2,
        active_status: false, // Inactive diagnosis for testing filters
        created_at: now - 3600 * 24, // 24 hours ago
        is_valid: true
      },
      
      // One diagnosis for patient 3 (Robert Johnson)
      {
        diagnosis_id: 6,
        admin_id: 2,
        patient_id: 3,
        active_status: true,
        created_at: now - 3600, // 1 hour ago
        is_valid: true
      }
    ];
    
    console.log(`Initialized ${mockData.diagnoses.length} mock diagnoses for ${mockData.patients.length} patients`);
  }

  // Add sample predictions if none exist
  if (mockData.predictions.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    mockData.predictions = [
      // Predictions for diagnosis ID 1
      {
        prediction_id: 1,
        diagnosis_id: 1,
        raw_output: [0.85, 0.1, 0.05], // Normal with high confidence
        created_at: now - 3500 // ~1 hour ago
      },
      {
        prediction_id: 2,
        diagnosis_id: 5,
        raw_output: [0.75, 0.2, 0.05], // Normal with medium confidence
        created_at: now - 3200 // A bit later
      },
      
      // Predictions for diagnosis ID 2
      {
        prediction_id: 3,
        diagnosis_id: 2,
        raw_output: [0.1, 0.8, 0.1], // Abnormal with high confidence
        created_at: now - 3000
      },
      
      // Predictions for diagnosis ID 3
      {
        prediction_id: 4,
        diagnosis_id: 3,
        raw_output: [0.3, 0.3, 0.4], // Inconclusive
        created_at: now - 2500
      },
      
      // Prediction for diagnosis ID 4
      {
        prediction_id: 5,
        diagnosis_id: 4,
        raw_output: [0.6, 0.3, 0.1], // Normal with medium confidence
        created_at: now - 2000
      }
    ];
    
    console.log(`Initialized ${mockData.predictions.length} mock predictions`);
  }
}

// Initialize mock data
initializeMockData();

/**
 * Initializes global access methods for the mock backend when running in a browser environment
 * This function is called by valen.js when in mock mode
 */
function initGlobalAccess() {
  console.log('🌐 Setting up global access methods for mock backend');
  
  // Optional: Add additional mock handlers for EEG, IMU, etc.
  window.bellaBridge.handlers.plotEEGData = (data) => {
    console.log('Mock plotEEGData handler called with data:', data);
    return { success: true };
  };
  
  window.bellaBridge.handlers.plotIMUData = (data) => {
    console.log('Mock plotIMUData handler called with data:', data);
    return { success: true };
  };
  
  window.bellaBridge.handlers.displayEEGEvaluation = (data) => {
    console.log('Mock displayEEGEvaluation handler called with data:', data);
    return { success: true };
  };
  
  window.bellaBridge.handlers.updateBluetoothDevices = (devices) => {
    console.log('Mock updateBluetoothDevices handler called with devices:', devices);
    return { success: true };
  };
  
  window.bellaBridge.handlers.updateMusicStatus = (status) => {
    console.log('Mock updateMusicStatus handler called with status:', status);
    return { success: true };
  };
  
  // Register custom mock commands
  window.mockCommands = {
    addSamplePatient: () => {
      const patientData = {
        raw_data: JSON.stringify({
          name: "Sample Patient",
          age: 35,
          gender: "female",
          notes: "Added via mock command"
        }),
        status: true
      };
      handleAddPatient(patientData);
      return "Sample patient added";
    },
    resetData: () => {
      mockData.patients = [];
      mockData.diagnoses = [];
      mockData.predictions = [];
      initializeMockData();
      return "Mock data reset to initial state";
    },
    startMockEEG: () => {
      startMockEEGData();
      return "Mock EEG data generation started";
    },
    stopMockEEG: () => {
      stopMockEEGData();
      return "Mock EEG data generation stopped";
    },
    triggerEEGEvaluation: () => {
      mockEEGEvaluation({ diagnosis_id: 1, diagnosis_stage: 1 });
      return "Mock EEG evaluation triggered";
    },
    addSamplePrediction: (diagnosisId = 1) => {
      const predictionData = {
        diagnosis_id: diagnosisId,
        raw_output: [0.7, 0.2, 0.1]
      };
      handleAddPrediction(predictionData);
      return `Sample prediction added for diagnosis ID ${diagnosisId}`;
    },
    listPredictionsByDiagnosis: (diagnosisId = 1) => {
      const predictions = mockData.predictions.filter(p => p.diagnosis_id === parseInt(diagnosisId));
      console.table(predictions);
      return `Found ${predictions.length} predictions for diagnosis ID ${diagnosisId}`;
    }
  };
  
  console.log('✅ Mock backend global access initialized successfully');
}

// This is a direct handler for 'record' operations that the C++ backend would normally handle
function record(params) {
  console.log('Mock record function called with params:', params);
  
  if (!params || typeof params !== 'object') {
    console.error('Invalid parameters passed to record function');
    return false;
  }
  
  const { table, operation, data } = params;
  
  // Route to the appropriate handler based on table and operation
  if (table === 'patient') {
    return handlePatientOperation(operation, data);
  } 
  else if (table === 'diagnosis') {
    return handleDiagnosisOperation(operation, data);
  }
  else if (table === 'prediction') {
    return handlePredictionOperation(operation, data);
  }
  
  console.warn(`Unhandled mock record operation: ${table}.${operation}`);
  return false;
}

// Export functions for external use
export const mockEEG = {
  start: startMockEEGData,
  stop: stopMockEEGData,
  evaluate: mockEEGEvaluation,
  isActive: () => isSimulationActive,
  generateMockData: (eegStore) => generateMockEEGData(eegStore),
  initializeEmptyBuffers: (eegStore) => initializeEmptyEEGBuffers(eegStore)
};

// Log that mock is active
console.log('🔧 Mock bellaBridge initialized for testing');

export default {
  isActive: true,
  mockData,
  resetMockData: initializeMockData,
  initGlobalAccess, // Export the function to be called by valen.js
  record, // Export the record function directly so it can be called by valen.js
  mockEEG
};

// Mock functions for patient operations
export function mockAddPatient(patientData) {
  const timestamp = Math.floor(Date.now() / 1000);
  const newPatient = {
    patient_id: mockData.patients.length + 1,
    raw_data: patientData.raw_data || '{}',
    active_status: patientData.status !== undefined ? patientData.status : true,
    created_at: timestamp
  };
  mockData.patients.push(newPatient);
  console.log('Added mock patient:', newPatient);
  return newPatient;
}

export function mockUpdatePatientStatus(patientId, status) {
  const patientIndex = mockData.patients.findIndex(p => p.patient_id === patientId);
  if (patientIndex >= 0) {
    mockData.patients[patientIndex].active_status = status;
    console.log(`Updated patient ${patientId} status to ${status}`);
    return true;
  }
  console.error(`Patient with ID ${patientId} not found`);
  return false;
}

export function mockFetchActivePatients() {
  return mockData.patients.filter(p => p.active_status);
}

// Mock functions for diagnosis operations
export function mockCreateDiagnosis(adminId, patientId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const newDiagnosis = {
    diagnosis_id: mockData.diagnoses.length + 1,
    admin_id: adminId,
    patient_id: patientId,
    active_status: true,
    created_at: timestamp,
    is_valid: true
  };
  mockData.diagnoses.push(newDiagnosis);
  console.log('Created mock diagnosis:', newDiagnosis);
  return newDiagnosis;
}

export function mockFetchDiagnosesForPatient(patientId) {
  return mockData.diagnoses.filter(d => d.patient_id === patientId);
}

export function mockFetchPredictionById(predictionId) {
  const id = parseInt(predictionId);
  return mockData.predictions.find(p => p.prediction_id === id);
}

export function mockFetchPredictionsByDiagnosis(diagnosisId) {
  const id = parseInt(diagnosisId);
  return mockData.predictions
    .filter(p => p.diagnosis_id === id)
    .sort((a, b) => b.created_at - a.created_at); // Newest first
}