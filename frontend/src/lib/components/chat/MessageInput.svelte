<script lang="ts">
  import { ws } from '$lib/api/ws';
  import { api } from '$lib/api/client';
  import { messages } from '$lib/stores/messages.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import type { Message } from '@harmony/shared/types/message';

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
      // Restore content on failure
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
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    try {
      const result = await api.upload<{ attachmentIds: string[] }>(
        `/channels/${channelId}/attachments`,
        formData
      );
      // After upload, send a message with attachment IDs
      await api.post(`/channels/${channelId}/messages`, {
        content: content.trim() || '',
        attachmentIds: result.attachmentIds,
        replyToId: replyingTo?.id,
      });
      content = '';
      ui.clearReply();
    } catch (err) {
      console.error('Failed to upload files:', err);
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
    <div class="flex items-center gap-2 px-3 py-1.5 mb-1 bg-bg-secondary/60 rounded-t-lg border border-b-0 border-divider text-sm">
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
        class="ml-auto text-text-muted hover:text-text-primary transition-colors p-0.5 rounded hover:bg-bg-hover shrink-0"
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
    class="flex items-end gap-2 bg-bg-input rounded-lg px-3 py-2 transition-colors
      {dragOver ? 'ring-2 ring-brand' : ''}
      {replyingTo ? 'rounded-t-none' : ''}"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => (dragOver = false)}
    ondrop={handleDrop}
  >
    <!-- Attachment button -->
    <label
      class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer shrink-0"
      aria-label="Add attachment"
      title="Add Attachment"
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

      <!-- Emoji button -->
      <button
        class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Add emoji"
        title="Add Emoji"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
          <line x1="9" y1="9" x2="9.01" y2="9"></line>
          <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
      </button>

      <!-- Send button -->
      <button
        class="p-1.5 rounded transition-colors
          {canSend
            ? 'text-brand hover:text-brand-hover hover:bg-brand/10'
            : 'text-text-muted opacity-50 cursor-not-allowed'}"
        onclick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        title="Send Message (Enter)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>
</div>
