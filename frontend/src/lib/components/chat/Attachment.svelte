<script lang="ts">
  import type { Attachment } from '@harmony/shared/types/message';
  import { resolveUploadUrl } from '$lib/utils/tauri';

  interface Props {
    attachment: Attachment;
  }

  let { attachment }: Props = $props();

  const isImage = $derived(attachment.mimeType.startsWith('image/'));
  const isVideo = $derived(attachment.mimeType.startsWith('video/'));
  const isGif = $derived(attachment.mimeType === 'image/gif');

  const url = $derived(resolveUploadUrl(attachment.url) ?? attachment.url);

  let lightboxOpen = $state(false);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

{#if isImage || isGif}
  <!-- Image / GIF preview -->
  <div class="mt-1 inline-block max-w-full">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <img
      src={url}
      alt={attachment.filename}
      class="max-w-[400px] max-h-[300px] rounded cursor-pointer object-contain bg-bg-tertiary"
      loading="lazy"
      onclick={() => (lightboxOpen = true)}
    />
  </div>

  <!-- Lightbox -->
  {#if lightboxOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
      onclick={() => (lightboxOpen = false)}
    >
      <img
        src={url}
        alt={attachment.filename}
        class="max-w-full max-h-full object-contain rounded shadow-2xl"
      />
      <button
        class="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full p-2 transition-colors"
        onclick={() => (lightboxOpen = false)}
        aria-label="Close image"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  {/if}

{:else if isVideo}
  <!-- Video player -->
  <div class="mt-1">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      src={url}
      controls
      class="max-w-[400px] max-h-[300px] rounded bg-black"
      preload="metadata"
    >
      Your browser does not support the video tag.
    </video>
  </div>

{:else}
  <!-- Generic file -->
  <div class="mt-1 flex items-center gap-3 p-3 rounded bg-bg-tertiary border border-divider max-w-xs">
    <div class="w-10 h-10 rounded bg-bg-accent flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted" aria-hidden="true">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm text-text-primary truncate">{attachment.filename}</p>
      <p class="text-xs text-text-muted">{formatSize(attachment.size)}</p>
    </div>
    <a
      href={url}
      download={attachment.filename}
      class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
      aria-label="Download {attachment.filename}"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    </a>
  </div>
{/if}
