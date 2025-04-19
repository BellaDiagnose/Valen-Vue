// filepath: /Users/dark/Development/Valen-GTK4/interface/source/views/music.vue
<template>
  <div class="audio-page">
    <div class="current-track-info" v-if="musicStore.currentTrack">
      <img :src="musicStore.currentTrack.cover" :alt="musicStore.currentTrack.title" class="track-cover">
      <div class="track-details">
        <h3>{{ musicStore.currentTrack.title }}</h3>
        <p>{{ musicStore.currentTrack.artist }}</p>
        <p class="file-name">{{ musicStore.currentTrack.fileName }}</p>
      </div>
    </div>
    
    <div v-if="musicStore.currentTrack" class="player-container">
      <div class="player-controls">
        <div class="control-buttons">
          <button @click="togglePlay" class="control-button play-button">
            {{ musicStore.isPlaying ? '⏸️ ' + $t('audio.controls.pause') : '▶️ ' + $t('audio.controls.play') }}
          </button>
          <button @click="stopAudio" class="control-button stop-button">
            ⏹️ {{ $t('audio.controls.stop') }}
          </button>
        </div>
        
        <div class="progress-container">
          <div class="progress-bar" @click="seekAudio">
            <div 
              class="progress-indicator" 
              :style="{ width: `${musicStore.audioProgress}%` }"
            ></div>
          </div>
        </div>
        
        <div class="time-display">
          {{ musicStore.formattedCurrentTime }} / {{ musicStore.formattedDuration }}
        </div>
        
        <div class="volume-control">
          <label for="volume" class="volume-label">{{ $t('audio.volume', { volume: musicStore.volume }) }}</label>
          <input 
            id="volume" 
            type="range" 
            min="0" 
            max="100" 
            :value="musicStore.volume" 
            @input="onVolumeChange"
            class="volume-slider"
          >
        </div>
      </div>
    </div>
    
    <div class="playlist-section">
      <h3>{{ $t('audio.playlist') }}</h3>
      <ul class="track-list">
        <li 
          v-for="track in localizedPlaylist" 
          :key="track.id"
          @click="playSelectedTrack(track.id)"
          :class="{ active: musicStore.currentTrack && musicStore.currentTrack.id === track.id }"
        >
          <span class="track-title">{{ track.title }}</span>
          <span class="track-artist">{{ track.artist }}</span>
        </li>
      </ul>
    </div>
    
    <div v-if="musicStore.lastError" class="error-message">
      {{ musicStore.lastError }}
    </div>
  </div>
</template>

<script>
import { useMusicStore } from '../stores/musicStore';
import logger from '../utils/logger';
import { useI18n } from 'vue-i18n';
import { computed, ref } from 'vue';

export default {
  name: 'MusicPlayerView',
  
  setup() {
    const { t, locale } = useI18n({ useScope: 'global' });
    // Use the musicStore from pinia
    const musicStore = useMusicStore();
    
    // Generate localized playlist with translated titles
    const localizedPlaylist = computed(() => {
      return musicStore.playlist.map(track => ({
        ...track,
        title: t(track.titleKey),
        artist: t(track.artistKey)
      }));
    });
    
    return { 
      musicStore, 
      localizedPlaylist
    };
  },
  
  data() {
    return {
      previousVolume: null
    };
  },
  
  mounted() {
    // Listen for keyboard controls
    document.addEventListener('keydown', this.handleKeyboardControls);
  },
  
  beforeUnmount() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyboardControls);
    
    // Stop audio if it's playing
    if (this.musicStore.isPlaying) {
      this.stopAudio();
    }
  },
  
  methods: {
    playSelectedTrack(trackId) {
      logger.info(`Attempting to play track: ${trackId}`);
      
      // Use the store to handle track selection and playback through C++ backend
      this.musicStore.playTrack(trackId);
    },
    
    togglePlay() {
      // If no track is selected, default to first track in playlist
      if (!this.musicStore.currentTrack) {
        if (this.musicStore.playlist.length > 0) {
          this.playSelectedTrack(this.musicStore.playlist[0].id);
        }
      } else if (!this.musicStore.isPlaying) {
        // If a track is loaded but not playing, resume playback
        this.musicStore.resumeMusic();
      } else {
        // Otherwise, pause playback
        this.musicStore.pauseMusic();
      }
    },
    
    stopAudio() {
      this.musicStore.stopMusic();
    },
    
    onVolumeChange(event) {
      const volume = parseInt(event.target.value);
      
      // Update volume in the store which will send it to C++ backend
      this.musicStore.setVolume(volume);
    },
    
    seekAudio(event) {
      if (!this.musicStore.audioTotalDuration) return;
      
      // Calculate click position as percentage of progress bar width
      const progressBar = event.currentTarget;
      const clickPosition = (event.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth;
      
      // Calculate the new time position
      const newTime = clickPosition * this.musicStore.audioTotalDuration;
      
      // Call seek method in store which will communicate with C++ backend
      this.musicStore.seekToPosition(newTime);
    },
    
    handleKeyboardControls(event) {
      // Only respond to keyboard events when this view is mounted
      if (!this.musicStore.currentTrack) return;
      
      switch(event.code) {
        case 'Space':
          // Toggle play/pause with space bar
          this.togglePlay();
          event.preventDefault();
          break;
        case 'KeyM':
          // Mute/unmute with M key
          if (this.musicStore.volume > 0) {
            this.previousVolume = this.musicStore.volume;
            this.onVolumeChange({ target: { value: 0 } });
          } else {
            this.onVolumeChange({ target: { value: this.previousVolume || 50 } });
          }
          event.preventDefault();
          break;
        case 'ArrowLeft':
          // Rewind 5 seconds
          // Make sure we don't go below 0
          const rewindTime = Math.max(0, this.musicStore.audioCurrentTime - 5);
          this.musicStore.seekToPosition(rewindTime);
          event.preventDefault();
          break;
        case 'ArrowRight':
          // Forward 5 seconds
          // Make sure we don't go beyond duration
          const forwardTime = Math.min(this.musicStore.audioTotalDuration, this.musicStore.audioCurrentTime + 5);
          this.musicStore.seekToPosition(forwardTime);
          event.preventDefault();
          break;
        case 'ArrowUp':
          // Increase volume
          const newVolumeUp = Math.min(100, this.musicStore.volume + 5);
          this.onVolumeChange({ target: { value: newVolumeUp } });
          event.preventDefault();
          break;
        case 'ArrowDown':
          // Decrease volume
          const newVolumeDown = Math.max(0, this.musicStore.volume - 5);
          this.onVolumeChange({ target: { value: newVolumeDown } });
          event.preventDefault();
          break;
      }
    }
  }
}
</script>

<style scoped>
.audio-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.current-track-info {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.track-cover {
  width: 80px;
  height: 80px;
  object-fit: cover;
  margin-right: 20px;
  border-radius: 4px;
}

.track-details {
  flex: 1;
}

.track-details h3 {
  margin: 0 0 8px;
  font-size: 1.2rem;
}

.track-details p {
  margin: 0;
  color: #666;
}

.file-name {
  font-size: 0.8rem;
  color: #888;
  margin-top: 4px;
  font-family: monospace;
}

.player-container {
  margin: 20px 0;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.player-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.control-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  color: white;
}

.play-button {
  background-color: #42b983;
}

.play-button:hover {
  background-color: #3da876;
}

.stop-button {
  background-color: #e74c3c;
}

.stop-button:hover {
  background-color: #c0392b;
}

.progress-container {
  margin: 10px 0;
}

.progress-bar {
  height: 8px;
  background-color: #ddd;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
}

.progress-bar:hover .progress-indicator {
  background-color: #3da876;
}

.progress-indicator {
  height: 100%;
  background-color: #42b983;
  transition: width 0.1s linear;
}

.time-display {
  font-size: 0.8rem;
  color: #666;
  text-align: right;
}

.volume-control {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 10px;
}

.volume-label {
  font-size: 0.8rem;
  color: #666;
}

.volume-slider {
  width: 100%;
}

.playlist-section {
  margin-top: 30px;
}

.playlist-section h3 {
  margin-bottom: 15px;
  font-size: 1.1rem;
}

.track-list {
  list-style: none;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
}

.track-list li {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  background-color: white;
}

.track-list li:last-child {
  border-bottom: none;
}

.track-list li:hover {
  background-color: #f5f5f5;
}

.track-list li.active {
  background-color: rgba(66, 185, 131, 0.1);
}

.track-title {
  font-weight: 500;
}

.track-artist {
  color: #666;
  font-size: 0.9rem;
}

.error-message {
  margin-top: 20px;
  padding: 10px 15px;
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  border-radius: 4px;
  border-left: 4px solid #e74c3c;
}
</style>