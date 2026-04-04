<script lang="ts">
  import type { Message } from '@harmony/shared/types/message';
  import { ws } from '$lib/api/ws';
  import EmojiPicker from './EmojiPicker.svelte';
  import type { CustomEmoji } from '@harmony/shared/types/emoji';

  interface Props {
    message: Message;
    onclose?: () => void;
  }

  let { message, onclose }: Props = $props();

  let showFullPicker = $state(false);
  let fullPickerStyle = $state('');

  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

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
    ws.send({ type: 'reaction:add', data: { messageId: message.id, emojiUnicode: unicode } });
    onclose?.();
  }

  function openFullPicker(e: MouseEvent) {
    const btn = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pickerW = 320;
    const pickerH = 384;
    const margin = 8;

    let top = btn.top - pickerH - margin;
    if (top < margin) top = btn.bottom + margin;

    let left = btn.right - pickerW;
    if (left < margin) left = margin;
    if (left + pickerW > window.innerWidth - margin) left = window.innerWidth - pickerW - margin;

    fullPickerStyle = `top:${top}px;left:${left}px;`;
    showFullPicker = true;
  }

  function handlePickerSelect(emoji: { unicode?: string; custom?: CustomEmoji }) {
    if (emoji.unicode) {
      addReaction(emoji.unicode);
    } else if (emoji.custom) {
      ws.send({ type: 'reaction:add', data: { messageId: message.id, emojiId: emoji.custom.id } });
      onclose?.();
    }
    showFullPicker = false;
  }
</script>

<div class="flex items-center gap-0.5 bg-bg-floating border border-divider rounded-xl shadow-2xl px-1.5 py-1">
  <!-- Quick reaction buttons -->
  {#each displayEmojis as emoji, i (i)}
    <button
      onclick={() => addReaction(emoji)}
      title="React with {emoji}"
      class="
        w-8 h-7 flex items-center justify-center rounded text-base
        hover:bg-bg-hover hover:scale-110 active:scale-95
        transition-all duration-100
      "
      aria-label="React with {emoji}"
    >{emoji}</button>
  {/each}

  <!-- Open full picker -->
  <button
    onclick={openFullPicker}
    title="More reactions"
    aria-label="More reactions"
    class="
      w-8 h-7 flex items-center justify-center rounded
      text-text-muted hover:text-text-primary hover:bg-bg-hover
      transition-colors duration-100
    "
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  </button>
</div>

<!-- Full emoji picker at fixed viewport position -->
{#if showFullPicker}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[60]" onclick={() => (showFullPicker = false)}></div>
  <div class="fixed z-[70]" style={fullPickerStyle}>
    <EmojiPicker
      onselect={handlePickerSelect}
      onclose={() => (showFullPicker = false)}
    />
  </div>
{/if}
