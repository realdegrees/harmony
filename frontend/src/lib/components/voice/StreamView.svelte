<script lang="ts">
  import type { VoiceParticipant } from '@harmony/shared/types/voice';
  import { StreamType } from '@harmony/shared/types/voice';
  import { ui } from '$lib/stores/ui.svelte';

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
  let streamVolume = $state(1); // 0–1 for the video element

  const activeStream = $derived(streams[activeIndex] ?? streams[0] ?? null);

  // Clamp activeIndex if streams shrink
  $effect(() => {
    if (activeIndex >= streams.length && streams.length > 0) {
      activeIndex = streams.length - 1;
    }
  });

  $effect(() => {
    if (videoEl) {
      videoEl.srcObject = activeStream?.stream ?? null;
    }
  });

  $effect(() => {
    if (videoEl) videoEl.volume = streamVolume;
  });

  function onVideoContextMenu(e: MouseEvent) {
    e.preventDefault();
    ui.showContextMenu(e.clientX, e.clientY, [
      {
        type: 'slider',
        label: 'Stream Volume',
        icon: '🔊',
        min: 0,
        max: 1,
        step: 0.05,
        value: streamVolume,
        onChange: (v) => { streamVolume = v; },
      },
    ]);
  }

  // Track browser-native fullscreen exit (Esc key)
  $effect(() => {
    function onFsChange() {
      isFullscreen = !!document.fullscreenElement;
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  });

  async function toggleFullscreen() {
    if (!containerEl) return;
    if (!document.fullscreenElement) {
      await containerEl.requestFullscreen();
    } else {
      await document.exitFullscreen();
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

<div
  bind:this={containerEl}
  class="relative flex flex-col overflow-hidden h-full
         {isFullscreen ? 'bg-black' : 'bg-black/80'}"
>
  <!-- Header bar -->
  <div class="flex items-center justify-between px-3 py-2 bg-black/50 backdrop-blur-sm shrink-0 z-10">
    <div class="flex items-center gap-2 min-w-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-brand shrink-0" aria-hidden="true">
        <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12z"/>
      </svg>
      {#if activeStream}
        <span class="text-sm font-semibold text-white truncate">
          {activeStream.participant.user.displayName || activeStream.participant.user.username}&rsquo;s
          {getStreamTypeLabel(activeStream.participant.voiceState.streamType)}
        </span>
        {#if streams.length > 1}
          <span class="text-xs text-white/40 shrink-0">{activeIndex + 1}/{streams.length}</span>
        {/if}
      {:else}
        <span class="text-sm font-semibold text-white/60">Live streams</span>
      {/if}
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <!-- Fullscreen toggle -->
      <button
        onclick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        class="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all duration-100"
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
          class="p-1.5 rounded-lg text-white/50 hover:text-danger hover:bg-danger/10 transition-all duration-100"
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
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex-1 flex items-center justify-center bg-black min-h-0"
    oncontextmenu={onVideoContextMenu}
  >
    {#if activeStream?.stream}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={videoEl}
        autoplay
        playsinline
        class="w-full h-full object-contain"
      ></video>
    {:else}
      <div class="flex flex-col items-center gap-3 text-white/20 text-sm">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/>
        </svg>
        <span>Connecting to stream…</span>
      </div>
    {/if}
  </div>

  <!-- Stream tabs — shown when multiple people are streaming -->
  {#if streams.length > 1}
    <div class="flex items-center gap-1 px-2 py-1.5 bg-black/60 backdrop-blur-sm overflow-x-auto shrink-0">
      {#each streams as entry, i (entry.participant.userId)}
        <button
          onclick={() => activeIndex = i}
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition-all duration-100
            {activeIndex === i
              ? 'bg-brand text-white shadow-[0_0_10px_rgba(92,110,240,0.4)]'
              : 'text-white/50 hover:bg-white/10 hover:text-white'}"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2z"/>
          </svg>
          {entry.participant.user.displayName || entry.participant.user.username}
        </button>
      {/each}
    </div>
  {/if}
</div>
