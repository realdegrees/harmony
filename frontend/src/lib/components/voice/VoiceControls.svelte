<script lang="ts">
  import { voice } from '$lib/stores/voice.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { StreamType } from '@harmony/shared/types/voice';

  // Channel name prop for display
  interface Props {
    channelName?: string;
  }

  let { channelName = 'Voice Channel' }: Props = $props();

  function handleToggleMute() {
    voice.toggleMute();
  }

  function handleToggleDeafen() {
    voice.toggleDeafen();
  }

  let streamStarting = $state(false);

  async function handleToggleStream() {
    if (voice.isStreaming) {
      voice.stopStream();
      return;
    }
    streamStarting = true;
    try {
      await voice.startStream(StreamType.SCREEN, {
        type: StreamType.SCREEN,
        maxBitrate: 2_500_000,
        maxFramerate: 30,
      });
    } catch {
      // User cancelled the picker or permission denied — do nothing
    } finally {
      streamStarting = false;
    }
  }

  function handleDisconnect() {
    voice.leaveChannel();
  }
</script>

{#if voice.currentChannelId}
  <div class="bg-white/[0.02] border-t border-white/[0.06]">
    <!-- Voice Connected banner -->
    <div class="px-2 pt-2 pb-1">
      <div class="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.07]">
        <!-- Green voice icon -->
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="text-success shrink-0"
            aria-hidden="true"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-success leading-none">Voice Connected</p>
            <p class="text-xs text-text-muted truncate mt-0.5">{channelName}</p>
          </div>
        </div>
        <!-- Disconnect button -->
        <button
          onclick={handleDisconnect}
          title="Disconnect"
          class="
            p-1 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10
            transition-all duration-100 shrink-0
          "
          aria-label="Disconnect from voice"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Control buttons -->
    <div class="flex items-center justify-around px-2 pb-2 gap-1">
      <!-- Mute -->
      <button
        onclick={handleToggleMute}
        title={voice.localMuted ? 'Unmute' : 'Mute'}
        aria-label={voice.localMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-pressed={voice.localMuted}
        class="
          flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl
          transition-all duration-100
          {voice.localMuted
            ? 'bg-danger/15 text-danger border border-danger/20 hover:bg-danger/20'
            : 'text-text-secondary hover:bg-white/[0.07] hover:text-text-primary'}
        "
      >
        {#if voice.localMuted}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
          </svg>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        {/if}
        <span class="text-[10px] font-medium">{voice.localMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      <!-- Deafen -->
      <button
        onclick={handleToggleDeafen}
        title={voice.localDeafened ? 'Undeafen' : 'Deafen'}
        aria-label={voice.localDeafened ? 'Undeafen' : 'Deafen'}
        aria-pressed={voice.localDeafened}
        class="
          flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl
          transition-all duration-100
          {voice.localDeafened
            ? 'bg-danger/15 text-danger border border-danger/20 hover:bg-danger/20'
            : 'text-text-secondary hover:bg-white/[0.07] hover:text-text-primary'}
        "
      >
        {#if voice.localDeafened}
          <!-- Deafened: headphones + diagonal slash -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        {:else}
          <!-- Undeafened: plain headphones -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
          </svg>
        {/if}
        <span class="text-[10px] font-medium">{voice.localDeafened ? 'Undeafen' : 'Deafen'}</span>
      </button>

      <!-- Screen Share -->
      <button
        onclick={handleToggleStream}
        disabled={streamStarting}
        title={voice.isStreaming ? 'Stop Sharing' : streamStarting ? 'Waiting for screen…' : 'Share Screen'}
        aria-label={voice.isStreaming ? 'Stop screen sharing' : 'Share screen'}
        aria-pressed={voice.isStreaming}
        class="
          flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl
          transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed
          {voice.isStreaming
            ? 'bg-brand/15 text-brand border border-brand/20 hover:bg-brand/20'
            : 'text-text-secondary hover:bg-white/[0.07] hover:text-text-primary'}
        "
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm8 9l-5-3 5-3v6z"/>
        </svg>
        <span class="text-[10px] font-medium">Screen</span>
      </button>
    </div>
  </div>
{/if}
