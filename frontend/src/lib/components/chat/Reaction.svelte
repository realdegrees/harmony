<script lang="ts">
  import { ws } from '$lib/api/ws';
  import { auth } from '$lib/stores/auth.svelte';
  import type { MessageReaction } from '@harmony/shared/types/message';

  interface Props {
    reaction: MessageReaction;
    messageId: string;
  }

  let { reaction, messageId }: Props = $props();

  let showTooltip = $state(false);

  function toggle() {
    if (reaction.reacted) {
      ws.send({
        type: 'reaction:remove',
        data: {
          messageId,
          emojiId: reaction.emojiId ?? undefined,
          emojiUnicode: reaction.emojiUnicode ?? undefined,
        },
      });
    } else {
      ws.send({
        type: 'reaction:add',
        data: {
          messageId,
          emojiId: reaction.emojiId ?? undefined,
          emojiUnicode: reaction.emojiUnicode ?? undefined,
        },
      });
    }
  }
</script>

<div class="relative inline-flex">
  <button
    class="flex items-center gap-1 px-1.5 py-0.5 rounded text-sm transition-colors border
      {reaction.reacted
        ? 'bg-brand/20 border-brand/50 text-text-primary'
        : 'bg-bg-tertiary border-transparent hover:bg-bg-accent text-text-secondary hover:border-divider'}"
    onclick={toggle}
    onmouseenter={() => (showTooltip = true)}
    onmouseleave={() => (showTooltip = false)}
    aria-pressed={reaction.reacted}
    aria-label="{reaction.emoji} reaction, {reaction.count} {reaction.count === 1 ? 'person' : 'people'}"
  >
    <span class="text-base leading-none">{reaction.emoji}</span>
    <span class="text-xs font-medium">{reaction.count}</span>
  </button>

  {#if showTooltip}
    <div
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-bg-floating text-text-secondary text-xs rounded shadow-lg whitespace-nowrap z-50 pointer-events-none border border-white/5"
      role="tooltip"
    >
      {reaction.emoji} · {reaction.count} {reaction.count === 1 ? 'reaction' : 'reactions'}
    </div>
  {/if}
</div>
