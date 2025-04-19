// This file imports assets for webpack to process

// The brain model path is resolved by webpack
import brainModel from '../assets/model/brain.obj';

// Export the assets for use in components and stores
export const brainStore = {
  models: {
    brain: brainModel
  }
};
