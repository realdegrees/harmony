<script lang="ts">
  import type { VoiceParticipant } from '@harmony/shared/types/voice';
  import { StreamType } from '@harmony/shared/types/voice';

  interface StreamEntry {
    participant: VoiceParticipant;
    stream: MediaStream;
  }

  interface Props {
    streams: StreamEntry[];
    onclose?: () => void;
  }

  let { streams, onclose }: Props = $props();

  let activeIndex = $state(0);
  let isFullscreen = $state(false);
  let containerEl = $state<HTMLDivElement | undefined>(undefined);
  let videoEl = $state<HTMLVideoElement | undefined>(undefined);

  const activeStream = $derived(streams[activeIndex]);

  $effect(() => {
    if (videoEl && activeStream?.stream) {
      videoEl.srcObject = activeStream.stream;
    }
  });

  async function toggleFullscreen() {
    if (!containerEl) return;
    if (!document.fullscreenElement) {
      await containerEl.requestFullscreen();
      isFullscreen = true;
    } else {
      await document.exitFullscreen();
      isFullscreen = false;
    }
  }

  function getStreamTypeLabel(type: StreamType | null | undefined): string {
    switch (type) {
      case StreamType.SCREEN: return 'Screen';
      case StreamType.WINDOW: return 'Window';
      case StreamType.CAMERA: return 'Camera';
      default: return 'Stream';
    }
  }
</script>

{#if streams.length > 0}
  <div
    bind:this={containerEl}
    class="relative flex flex-col bg-bg-floating rounded-lg overflow-hidden shadow-2xl"
    style="min-width: 320px; min-height: 240px;"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 bg-bg-tertiary/80 backdrop-blur-sm z-10">
      <div class="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="text-brand" aria-hidden="true">
          <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12z"/>
        </svg>
        {#if activeStream}
          <span class="text-sm font-medium text-text-primary">
            {activeStream.participant.user.displayName || activeStream.participant.user.username}
            &rsquo;s {getStreamTypeLabel(activeStream.participant.voiceState.streamType)}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-1">
        <!-- Fullscreen toggle -->
        <button
          onclick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {#if isFullscreen}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          {/if}
        </button>
        <!-- Close -->
        {#if onclose}
          <button
            onclick={onclose}
            title="Close stream view"
            class="p-1.5 rounded text-text-muted hover:text-danger hover:bg-bg-hover transition-colors"
            aria-label="Close stream view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <!-- Video area -->
    <div class="relative flex-1 bg-black flex items-center justify-center" style="min-height: 200px;">
      {#if activeStream}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={videoEl}
          autoplay
          playsinline
          muted
          class="w-full h-full object-contain"
        ></video>
      {:else}
        <div class="flex flex-col items-center gap-2 text-text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12z"/>
          </svg>
          <p class="text-sm">Connecting to stream...</p>
        </div>
      {/if}
    </div>

    <!-- Stream tabs (multiple streams) -->
    {#if streams.length > 1}
      <div class="flex items-center gap-1 px-2 py-1.5 bg-bg-tertiary/80 backdrop-blur-sm overflow-x-auto">
        {#each streams as entry, i (entry.participant.userId)}
          <button
            onclick={() => activeIndex = i}
            class="
              flex items-center gap-1.5 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors
              {activeIndex === i
                ? 'bg-brand text-white'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}
            "
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2z"/>
            </svg>
            {entry.participant.user.displayName || entry.participant.user.username}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
