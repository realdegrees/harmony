<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import { messages } from '$lib/stores/messages.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Reply from './Reply.svelte';
  import Reaction from './Reaction.svelte';
  import Attachment from './Attachment.svelte';
  import Embed from './Embed.svelte';
  import type { Message } from '@harmony/shared/types/message';

  interface Props {
    message: Message;
    isCompact?: boolean;
    isHighlighted?: boolean;
    onScrollTo?: (id: string) => void;
  }

  let { message, isCompact = false, isHighlighted = false, onScrollTo }: Props = $props();

  let hovered = $state(false);
  let editing = $state(false);
  let editContent = $state('');

  const isOwn = $derived(auth.user?.id === message.authorId);

  const formattedTime = $derived(
    new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const formattedFullTime = $derived(
    new Date(message.createdAt).toLocaleString()
  );

  function startEdit() {
    editing = true;
    editContent = message.content;
  }

  async function submitEdit(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editContent.trim() && editContent !== message.content) {
        await messages.editMessage(message.id, editContent.trim());
      }
      editing = false;
    }
    if (e.key === 'Escape') {
      editing = false;
    }
  }

  async function deleteMsg() {
    if (confirm('Delete this message?')) {
      await messages.deleteMessage(message.id);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const items = [
      {
        label: 'Reply',
        action: () => ui.setReplyTo(message),
      },
    ];
    if (isOwn) {
      items.push({ label: 'Edit Message', action: startEdit });
    }
    items.push({ label: '', action: () => {}, divider: true } as any);
    items.push({
      label: 'Copy Message',
      action: () => navigator.clipboard.writeText(message.content),
    });
    if (isOwn) {
      items.push({
        label: 'Delete Message',
        danger: true,
        action: deleteMsg,
      } as any);
    }
    ui.showContextMenu(e.clientX, e.clientY, items as any);
  }

  // Render content with @mention highlighting
  function renderContent(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/@(\w+)/g, '<span class="bg-brand/20 text-brand rounded px-0.5 hover:bg-brand/30 cursor-pointer">@$1</span>')
      .replace(/\n/g, '<br>');
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group relative flex gap-3 px-4 py-0.5 transition-colors rounded
    {isHighlighted ? 'bg-warning/10' : 'hover:bg-bg-hover/50'}
    {isCompact ? 'py-0.5' : 'pt-2'}"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  oncontextmenu={handleContextMenu}
  data-message-id={message.id}
  role="article"
  aria-label="Message from {message.author.displayName || message.author.username}"
>
  {#if isCompact}
    <!-- Compact mode: timestamp on hover in the left gutter -->
    <div class="w-10 shrink-0 flex items-center justify-end">
      <time
        class="text-[10px] text-text-muted leading-none opacity-0 group-hover:opacity-100 transition-opacity select-none"
        datetime={message.createdAt}
        title={formattedFullTime}
      >
        {formattedTime}
      </time>
    </div>
  {:else}
    <!-- Full mode: avatar -->
    <div class="shrink-0 w-10">
      <Avatar
        src={message.author.avatarPath}
        username={message.author.displayName || message.author.username}
        size="md"
      />
    </div>
  {/if}

  <div class="flex-1 min-w-0">
    <!-- Reply reference -->
    {#if message.replyTo && !isCompact}
      <Reply replyTo={message.replyTo} {onScrollTo} />
    {/if}

    <!-- Header (only in full mode) -->
    {#if !isCompact}
      <div class="flex items-baseline gap-2 mb-0.5">
        <span class="font-semibold text-text-primary text-sm leading-none">
          {message.author.displayName || message.author.username}
        </span>
        <time
          class="text-xs text-text-muted"
          datetime={message.createdAt}
          title={formattedFullTime}
        >
          {formattedFullTime}
        </time>
      </div>
    {/if}

    <!-- Content -->
    {#if editing}
      <div class="mt-1">
        <textarea
          class="w-full bg-bg-input text-text-primary rounded px-3 py-2 text-sm resize-none border border-brand focus:outline-none"
          rows="3"
          bind:value={editContent}
          onkeydown={submitEdit}
          aria-label="Edit message"
          autofocus
        ></textarea>
        <p class="text-xs text-text-muted mt-1">
          <kbd class="font-mono">Enter</kbd> to save · <kbd class="font-mono">Esc</kbd> to cancel
        </p>
      </div>
    {:else}
      <p
        class="text-sm text-text-primary break-words leading-relaxed"
        role="none"
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html renderContent(message.content)}
        {#if message.editedAt}
          <span class="text-[10px] text-text-muted ml-1">(edited)</span>
        {/if}
      </p>
    {/if}

    <!-- Attachments -->
    {#if message.attachments?.length > 0}
      <div class="flex flex-col gap-1 mt-1">
        {#each message.attachments as attachment (attachment.id)}
          <Attachment {attachment} />
        {/each}
      </div>
    {/if}

    <!-- Embeds -->
    {#if message.embeds && message.embeds.length > 0}
      <div class="flex flex-col gap-1 mt-1">
        {#each message.embeds as embed, i (i)}
          <Embed {embed} />
        {/each}
      </div>
    {/if}

    <!-- Reactions -->
    {#if message.reactions?.length > 0}
      <div class="flex flex-wrap gap-1 mt-1">
        {#each message.reactions as reaction, i (reaction.emojiId ?? reaction.emojiUnicode ?? i)}
          <Reaction {reaction} messageId={message.id} />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Hover action bar -->
  {#if hovered && !editing}
    <div
      class="absolute right-4 -top-3 flex items-center gap-0.5 bg-bg-secondary border border-divider rounded shadow-lg px-1 py-0.5 z-10"
      role="toolbar"
      aria-label="Message actions"
    >
      <!-- Reply -->
      <button
        class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        onclick={() => ui.setReplyTo(message)}
        aria-label="Reply"
        title="Reply"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9 17 4 12 9 7"></polyline>
          <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
        </svg>
      </button>

      <!-- React -->
      <button
        class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Add reaction"
        title="Add Reaction"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
          <line x1="9" y1="9" x2="9.01" y2="9"></line>
          <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
      </button>

      <!-- Edit (own message only) -->
      {#if isOwn}
        <button
          class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          onclick={startEdit}
          aria-label="Edit message"
          title="Edit Message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>

        <!-- Delete -->
        <button
          class="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          onclick={deleteMsg}
          aria-label="Delete message"
          title="Delete Message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>
        </button>
      {/if}
    </div>
  {/if}
</div>
