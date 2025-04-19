// filepath: /Users/dark/Development/Valen-GTK4/interface/source/stores/musicStore.js
import { defineStore } from 'pinia';
import logger from '../utils/logger.js';
import { useI18n } from 'vue-i18n';

export const useMusicStore = defineStore('music', {
  state: () => ({
    volume: 50,
    currentTrack: null,  // Start with null, set a track when playing
    playlist: [
      {
        fileName: 'bp1.ogg',
        titleKey: 'audio.tracks.relaxing_melody',
        artistKey: 'audio.artist',
        cover: 'assets/icons/music.png',
        id: 'bp1'
      },
      {
        fileName: 'bp2.ogg',
        titleKey: 'audio.tracks.calm_waters',
        artistKey: 'audio.artist',
        cover: 'assets/icons/music.png',
        id: 'bp2'
      },
      {
        fileName: 'bp3.ogg',
        titleKey: 'audio.tracks.peaceful_mind',
        artistKey: 'audio.artist',
        cover: 'assets/icons/music.png',
        id: 'bp3'
      },
      {
        fileName: 'bp4.ogg',
        titleKey: 'audio.tracks.peaceful_mind',
        artistKey: 'audio.artist',
        cover: 'assets/icons/music.png',
        id: 'bp4'
      }
    ],
    audioProgress: 0,
    audioCurrentTime: 0,
    audioTotalDuration: 0,
    isPlaying: false,
    lastError: null,
    userInitiatedPlay: false  // New flag to track if play was initiated by user clicking a track
  }),
  
  getters: {
    formattedCurrentTime: (state) => {
      if (!state.audioCurrentTime) return '0:00';
      const minutes = Math.floor(state.audioCurrentTime / 60);
      const seconds = Math.floor(state.audioCurrentTime % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    
    formattedDuration: (state) => {
      if (!state.audioTotalDuration) return '0:00';
      const minutes = Math.floor(state.audioTotalDuration / 60);
      const seconds = Math.floor(state.audioTotalDuration % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  },
  
  actions: {
    playTrack(trackId, isUserInitiated = true) {
      const i18n = window.i18n.global;
      logger.info(`Attempting to play track with id: ${trackId}`);
      
      // Only proceed if this was directly initiated by a user action on a track
      // or if the userInitiatedPlay flag is explicitly provided
      this.userInitiatedPlay = isUserInitiated;
      
      if (!this.userInitiatedPlay) {
        logger.info('Ignoring automatic play attempt - user must click play explicitly');
        return null;
      }
      
      const track = this.playlist.find(t => t.id === trackId);
      if (!track) {
        const errorMsg = i18n.t('audio.errors.not_found');
        logger.error(`Track with id ${trackId} not found in playlist`);
        this.lastError = errorMsg;
        return null;
      }
      
      // Log the path to help debug
      logger.info(`Preparing to play audio file: ${track.fileName}`);
      
      // Update the store state
      this.currentTrack = { 
        ...track,
        title: i18n.t(track.titleKey),
        artist: i18n.t(track.artistKey)
      };
      this.isPlaying = true;
      this.lastError = null;
      
      // Call C++ backend to play the track through MusicManager
      window.bellaBridge.calls.cppBackend('device', {
        function: "music",
        operation: "play",
        filename: track.fileName
      });
      
      logger.info(`Playing track: ${i18n.t(track.titleKey)}`);
      return this.currentTrack;
    },
    
    pauseMusic() {
      const i18n = window.i18n.global;
      if (this.isPlaying) {
        this.isPlaying = false;
        logger.info(i18n.t('audio.messages.audio_paused'));
        
        // Call C++ backend to pause music
        window.bellaBridge.calls.cppBackend('device', {
          function: "music",
          operation: "pause"
        });
      }
    },
    
    resumeMusic() {
      const i18n = window.i18n.global;
      if (this.currentTrack && !this.isPlaying) {
        this.isPlaying = true;
        logger.info(i18n.t('audio.messages.audio_resumed'));
        
        // Call C++ backend to resume music
        window.bellaBridge.calls.cppBackend('device', {
          function: "music",
          operation: "resume"
        });
      }
    },
    
    stopMusic() {
      const i18n = window.i18n.global;
      this.isPlaying = false;
      this.audioProgress = 0;
      this.audioCurrentTime = 0;
      logger.info(i18n.t('audio.messages.audio_stopped'));
      
      // Call C++ backend to stop music
      window.bellaBridge.calls.cppBackend('device', {
        function: "music",
        operation: "stop"
      });
    },
    
    setVolume(volume) {
      const i18n = window.i18n.global;
      this.volume = parseInt(volume) || 0;
      logger.info(i18n.t('audio.messages.volume_set', { volume: this.volume }));
      
      // Call C++ backend to set volume
      window.bellaBridge.calls.cppBackend('device', {
        function: "music",
        operation: "volume",
        volume: this.volume
      });
    },
    
    seekToPosition(position) {
      const i18n = window.i18n.global;
      if (!this.audioTotalDuration) return;
      
      logger.info(i18n.t('audio.messages.seeking', { position: position.toFixed(2) }));
      
      // Call C++ backend to seek
      window.bellaBridge.calls.cppBackend('device', {
        function: "music",
        operation: "seek",
        position: position
      });
    },
    
    updateProgress({ currentTime, duration }) {
      if (typeof currentTime !== 'number' || typeof duration !== 'number') {
        logger.warn(`Invalid progress values received - currentTime: ${currentTime}, duration: ${duration}`);
        return;
      }
      
      if (duration > 0) {
        this.audioProgress = (currentTime / duration) * 100;
        this.audioCurrentTime = currentTime;
        this.audioTotalDuration = duration;
        
        // Debug logging
        logger.debug(`Audio progress updated in store: ${this.audioProgress.toFixed(2)}%`);
      } else {
        logger.warn('Received zero or negative duration in updateProgress');
      }
    },

    // New methods to handle C++ bridge callbacks
    
    /**
     * Handle music progress updates from the C++ backend
     * @param {number} progress - Playback progress percentage
     * @param {number} currentTime - Current playback position in seconds
     * @param {number} duration - Total duration of track in seconds
     * @returns {Object} Result of the operation
     */
    handleMusicProgress(progress, currentTime, duration) {
      try {
        // Update the progress in the store
        this.updateProgress({ currentTime, duration });
        //logger.debug(`Audio progress updated - Current: ${currentTime}s, Total: ${duration}s, Progress: ${progress}%`);
        return { success: true };
      } catch (err) {
        logger.error({
          title: 'Music Error',
          message: `Error handling music progress: ${err.message}`
        });
        return { success: false, error: err.message };
      }
    },
    
    /**
     * Handle music playback status updates from the C++ backend
     * @param {string} status - 'playing', 'paused', 'stopped', or 'error'
     * @param {string|null} error - Error message if status is 'error'
     * @returns {Object} Result of the operation
     */
    handleMusicStatus(status, error = null) {
      logger.info(`Handling music status update: ${status}`);
      
      try {
        // Update the status in the store
        switch (status) {
          case 'playing':
            this.isPlaying = true;
            break;
          case 'paused':
            this.isPlaying = false;
            break;
          case 'stopped':
            this.isPlaying = false;
            this.audioProgress = 0;
            this.audioCurrentTime = 0;
            break;
          case 'error':
            this.isPlaying = false;
            this.lastError = error || 'Unknown error during playback';
            break;
          default:
            logger.warn(`Unknown music status: ${status}`);
        }
        
        return { success: true };
      } catch (err) {
        logger.error({
          title: 'Music Error',
          message: `Error handling music status: ${err.message}`
        });
        return { success: false, error: err.message };
      }
    },
    
    /**
     * Handle track changes from the C++ backend
     * @param {string} trackId - ID of the track to set as current
     * @returns {Object} Result of the operation
     */
    handleMusicTrack(trackId) {
      logger.info(`Handling music track update: ${trackId}`);
      
      try {
        const i18n = window.i18n?.global;
        
        if (trackId && i18n) {
          const track = this.playlist.find(t => t.id === trackId);
          if (track) {
            this.currentTrack = { 
              ...track,
              title: i18n.t(track.titleKey),
              artist: i18n.t(track.artistKey)
            };
          }
        } else {
          this.currentTrack = null;
        }
        
        return { success: true };
      } catch (err) {
        logger.error({
          title: 'Music Error',
          message: `Error handling music track update: ${err.message}`
        });
        return { success: false, error: err.message };
      }
    }
  }
});

// Export the store definition only, not an instance
export default useMusicStore;