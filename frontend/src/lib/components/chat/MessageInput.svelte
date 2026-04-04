<script lang="ts">
  import { ws } from '$lib/api/ws';
  import { api } from '$lib/api/client';
  import { messages } from '$lib/stores/messages.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import EmojiPicker from '$lib/components/chat/EmojiPicker.svelte';
  import GifPicker from '$lib/components/chat/GifPicker.svelte';
  import Tooltip from '$lib/components/ui/Tooltip.svelte';
  import type { Message } from '@harmony/shared/types/message';
  import type { CustomEmoji } from '@harmony/shared/types/emoji';
  import type { GiphyGif } from '@harmony/shared/types/api';

  interface Props {
    channelId: string;
    placeholder?: string;
  }

  let { channelId, placeholder = 'Message...' }: Props = $props();

  const MAX_LENGTH = 2000;

  let content = $state('');
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let isTyping = $state(false);
  let sending = $state(false);
  let dragOver = $state(false);
  let emojiPickerOpen = $state(false);
  let gifPickerOpen = $state(false);

  function handleEmojiSelect(emoji: { unicode?: string; custom?: CustomEmoji }) {
    if (emoji.unicode) {
      content += emoji.unicode;
    } else if (emoji.custom) {
      content += `:${emoji.custom.name}:`;
    }
    emojiPickerOpen = false;
    textareaEl?.focus();
  }

  async function handleGifSelect(gif: GiphyGif) {
    gifPickerOpen = false;
    sending = true;
    try {
      await messages.sendMessage(channelId, gif.url, ui.replyingTo?.id);
      ui.clearReply();
    } catch (err) {
      console.error('Failed to send GIF:', err);
    } finally {
      sending = false;
      textareaEl?.focus();
    }
  }

  const replyingTo = $derived(ui.replyingTo);
  const charCount = $derived(content.length);
  const nearLimit = $derived(charCount > MAX_LENGTH * 0.8);
  const overLimit = $derived(charCount > MAX_LENGTH);
  const canSend = $derived(content.trim().length > 0 && !overLimit && !sending);

  function autoGrow() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 200) + 'px';
  }

  function sendTypingStart() {
    if (!isTyping) {
      isTyping = true;
      ws.send({ type: 'typing:start', data: { channelId } });
    }
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(sendTypingStop, 3000);
  }

  function sendTypingStop() {
    if (isTyping) {
      isTyping = false;
      ws.send({ type: 'typing:stop', data: { channelId } });
    }
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  async function handleSend() {
    if (!canSend) return;
    const text = content.trim();
    content = '';
    autoGrow();
    sendTypingStop();
    sending = true;
    try {
      await messages.sendMessage(channelId, text, replyingTo?.id);
      ui.clearReply();
    } catch (err) {
      content = text;
      console.error('Failed to send message:', err);
    } finally {
      sending = false;
      textareaEl?.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    sendTypingStart();
  }

  function handleInput() {
    autoGrow();
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    sending = true;
    try {
      const attachmentIds: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const result = await api.upload<{ id: string }>('/attachments', fd);
        attachmentIds.push(result.id);
      }
      await messages.sendMessage(channelId, content.trim(), replyingTo?.id, attachmentIds);
      content = '';
      autoGrow();
      ui.clearReply();
    } catch (err) {
      console.error('Failed to upload files:', err);
    } finally {
      sending = false;
      textareaEl?.focus();
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    handleFileSelect(e.dataTransfer?.files ?? null);
  }

  function handlePaste(e: ClipboardEvent) {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      handleFileSelect(files);
    }
  }
</script>

<div class="px-4 pb-4 shrink-0">
  <!-- Reply bar -->
  {#if replyingTo}
    <div class="flex items-center gap-2 px-3 py-1.5 mb-1 bg-white/[0.04] backdrop-blur-sm rounded-t-xl border border-b-0 border-white/[0.08] text-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted shrink-0" aria-hidden="true">
        <polyline points="9 17 4 12 9 7"></polyline>
        <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
      </svg>
      <span class="text-text-muted">Replying to</span>
      <span class="font-semibold text-text-secondary">
        {replyingTo.author.displayName || replyingTo.author.username}
      </span>
      <span class="flex-1 truncate text-text-muted text-xs">{replyingTo.content}</span>
      <button
        class="ml-auto text-text-muted hover:text-text-primary transition-all p-0.5 rounded-lg hover:bg-white/[0.08] shrink-0"
        onclick={() => ui.clearReply()}
        aria-label="Cancel reply"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Input box -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex items-center gap-2 bg-white/[0.05] backdrop-blur-sm border border-white/[0.08] px-3 py-2 transition-all duration-150
      {dragOver ? 'ring-2 ring-brand/60 border-brand/40' : ''}
      {replyingTo ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'}"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => (dragOver = false)}
    ondrop={handleDrop}
  >
    <!-- Attachment button -->
    <Tooltip text="Add Attachment" position="top">
      <label
        class="inline-flex items-center justify-center p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.08] transition-all duration-100 cursor-pointer shrink-0"
        aria-label="Add attachment"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <input
          type="file"
          class="sr-only"
          multiple
          onchange={(e) => handleFileSelect((e.currentTarget as HTMLInputElement).files)}
          aria-label="Upload file"
        />
      </label>
    </Tooltip>

    <!-- GIF button -->
    <Tooltip text="Send a GIF" position="top">
      <div class="relative shrink-0">
        <button
          class="p-1.5 rounded-lg transition-all duration-100 text-xs font-bold leading-none
            {gifPickerOpen
              ? 'text-text-primary bg-white/[0.12]'
              : 'text-text-muted hover:text-text-primary hover:bg-white/[0.08]'}"
          onclick={() => { gifPickerOpen = !gifPickerOpen; if (gifPickerOpen) emojiPickerOpen = false; }}
          aria-label="Send a GIF"
          aria-pressed={gifPickerOpen}
        >
          GIF
        </button>
        {#if gifPickerOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="fixed inset-0 z-40" onclick={() => (gifPickerOpen = false)}></div>
          <div class="absolute bottom-10 left-0 z-50">
            <GifPicker
              onselect={handleGifSelect}
              onclose={() => (gifPickerOpen = false)}
            />
          </div>
        {/if}
      </div>
    </Tooltip>

    <!-- Textarea -->
    <textarea
      bind:this={textareaEl}
      bind:value={content}
      {placeholder}
      rows="1"
      maxlength={MAX_LENGTH + 100}
      class="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-sm resize-none focus:outline-none leading-relaxed"
      style="min-height: 24px; max-height: 200px;"
      onkeydown={handleKeydown}
      oninput={handleInput}
      onpaste={handlePaste}
      aria-label="Message input"
      aria-multiline="true"
      disabled={sending}
    ></textarea>

    <!-- Right side buttons -->
    <div class="flex items-center gap-1 shrink-0">
      <!-- Character count near limit -->
      {#if nearLimit}
        <span
          class="text-xs font-mono tabular-nums
            {overLimit ? 'text-danger' : 'text-warning'}"
          aria-live="polite"
        >
          {MAX_LENGTH - charCount}
        </span>
      {/if}

      <!-- Emoji button + picker -->
      <div class="relative">
        <Tooltip text="Add Emoji" position="top">
          <button
            class="p-1.5 rounded-lg transition-all duration-100
              {emojiPickerOpen
                ? 'text-text-primary bg-white/[0.12]'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.08]'}"
            onclick={() => { emojiPickerOpen = !emojiPickerOpen; if (emojiPickerOpen) gifPickerOpen = false; }}
            aria-label="Add emoji"
            aria-pressed={emojiPickerOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
              <line x1="9" y1="9" x2="9.01" y2="9"></line>
              <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
          </button>
        </Tooltip>
        {#if emojiPickerOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="fixed inset-0 z-40" onclick={() => (emojiPickerOpen = false)}></div>
          <div class="absolute bottom-10 right-0 z-50">
            <EmojiPicker
              onselect={handleEmojiSelect}
              onclose={() => (emojiPickerOpen = false)}
            />
          </div>
        {/if}
      </div>

      <!-- Send button -->
      <Tooltip text="Send (Enter)" position="top">
        <button
          class="p-1.5 rounded-lg transition-all duration-100
            {canSend
              ? 'text-brand hover:text-brand-hover hover:bg-brand/15 shadow-[0_0_12px_rgba(92,110,240,0.2)]'
              : 'text-text-muted opacity-40 cursor-not-allowed'}"
          onclick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </Tooltip>
    </div>
  </div>
</div>
