<script lang="ts">
  import type { Message } from '@harmony/shared/types/message';
  import { ws } from '$lib/api/ws';
  import EmojiPicker from './EmojiPicker.svelte';
  import type { CustomEmoji } from '@harmony/shared/types/emoji';

  interface Props {
    message: Message;
  }

  let { message }: Props = $props();

  let showFullPicker = $state(false);

  // Quick reactions - most commonly used
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

  // Also load frequently used from localStorage
  let frequentEmojis = $state<string[]>([]);
  $effect(() => {
    try {
      const stored = localStorage.getItem('harmony:frequent-emojis');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        frequentEmojis = parsed.slice(0, 3).filter(e => !QUICK_REACTIONS.includes(e));
      }
    } catch {}
  });

  const displayEmojis = $derived([...QUICK_REACTIONS, ...frequentEmojis].slice(0, 6));

  function addReaction(unicode: string) {
    ws.send({
      type: 'reaction:add',
      data: { messageId: message.id, emojiUnicode: unicode },
    });
  }

  function handlePickerSelect(emoji: {
    unicode?: string;
    custom?: CustomEmoji;
    local?: { id: string; name: string; blob: Blob };
  }) {
    if (emoji.unicode) {
      addReaction(emoji.unicode);
    } else if (emoji.custom) {
      ws.send({
        type: 'reaction:add',
        data: { messageId: message.id, emojiId: emoji.custom.id },
      });
    }
    showFullPicker = false;
  }

  function handlePickerClose() {
    showFullPicker = false;
  }
</script>

<div class="relative flex items-center gap-0.5">
  <!-- Quick reaction buttons -->
  {#each displayEmojis as emoji, i (i)}
    <button
      onclick={() => addReaction(emoji)}
      title="React with {emoji}"
      class="
        w-8 h-7 flex items-center justify-center rounded text-base
        bg-bg-floating border border-divider shadow-md
        hover:bg-bg-hover hover:scale-110 active:scale-95
        transition-all duration-100
      "
      aria-label="React with {emoji}"
    >{emoji}</button>
  {/each}

  <!-- Open full picker -->
  <button
    onclick={() => showFullPicker = !showFullPicker}
    title="More reactions"
    aria-label="More reactions"
    aria-expanded={showFullPicker}
    class="
      w-8 h-7 flex items-center justify-center rounded
      bg-bg-floating border border-divider shadow-md
      text-text-muted hover:text-text-primary hover:bg-bg-hover
      transition-colors duration-100
    "
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  </button>

  <!-- Full emoji picker popup -->
  {#if showFullPicker}
    <div class="absolute bottom-9 right-0 z-50">
      <EmojiPicker
        onselect={handlePickerSelect}
        onclose={handlePickerClose}
      />
    </div>
  {/if}
</div>
