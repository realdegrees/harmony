<script lang="ts">
  import { EmbedType } from '@harmony/shared/types/message';
  import type { Embed } from '@harmony/shared/types/message';

  interface Props {
    embed: Embed;
  }

  let { embed }: Props = $props();

  function getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
</script>

<div class="mt-1 max-w-[400px]">
  {#if embed.type === EmbedType.IMAGE}
    <!-- svelte-ignore a11y_img_redundant_alt -->
    <img
      src={embed.url}
      alt={embed.title ?? 'Embedded image'}
      class="max-w-full max-h-[300px] rounded object-contain bg-bg-tertiary"
      loading="lazy"
    />

  {:else if embed.type === EmbedType.GIF}
    <!-- svelte-ignore a11y_img_redundant_alt -->
    <img
      src={embed.url}
      alt={embed.title ?? 'GIF'}
      class="max-w-full max-h-[300px] rounded object-contain"
      loading="lazy"
    />

  {:else if embed.type === EmbedType.VIDEO}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      src={embed.url}
      controls
      class="max-w-full max-h-[300px] rounded bg-black"
      preload="metadata"
    >
      Your browser does not support the video tag.
    </video>

  {:else}
    <!-- Link card -->
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      class="flex gap-3 p-3 rounded bg-bg-tertiary border-l-4 border-brand hover:bg-bg-accent transition-colors no-underline block"
      aria-label="Open link: {embed.title || embed.url}"
    >
      {#if embed.thumbnailUrl}
        <!-- svelte-ignore a11y_img_redundant_alt -->
        <img
          src={embed.thumbnailUrl}
          alt=""
          class="w-16 h-16 rounded object-cover shrink-0 bg-bg-accent"
        />
      {/if}
      <div class="flex-1 min-w-0">
        <p class="text-xs text-text-muted mb-0.5">{getDomain(embed.url)}</p>
        {#if embed.title}
          <p class="text-sm font-semibold text-text-link truncate">{embed.title}</p>
        {/if}
        {#if embed.description}
          <p class="text-xs text-text-secondary mt-0.5 line-clamp-2">{embed.description}</p>
        {/if}
      </div>
    </a>
  {/if}
</div>
