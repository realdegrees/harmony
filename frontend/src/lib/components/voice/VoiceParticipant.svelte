<script lang="ts">
  import type { VoiceParticipant } from '@harmony/shared/types/voice';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  interface Props {
    participant: VoiceParticipant;
    speaking?: boolean;
  }

  let { participant, speaking = false }: Props = $props();

  const vs = $derived(participant.voiceState);
  const user = $derived(participant.user);
</script>

<div class="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors duration-100">
  <!-- Avatar with speaking indicator -->
  <div class="relative shrink-0">
    <div
      class="
        rounded-full transition-all duration-150
        {speaking ? 'ring-2 ring-success ring-offset-2 ring-offset-bg-primary' : ''}
      "
    >
      <Avatar src={user.avatarPath} username={user.username} size="md" />
    </div>

    <!-- Speaking pulse animation -->
    {#if speaking}
      <span
        class="absolute inset-0 rounded-full ring-2 ring-success animate-ping opacity-50"
        aria-hidden="true"
      ></span>
    {/if}
  </div>

  <!-- User info -->
  <div class="flex-1 min-w-0">
    <p class="text-sm font-medium text-text-primary truncate">
      {user.displayName || user.username}
    </p>
    {#if speaking}
      <p class="text-xs text-success">Speaking</p>
    {/if}
  </div>

  <!-- Status icons -->
  <div class="flex items-center gap-1.5 shrink-0">
    {#if vs.muted || vs.serverMuted}
      <span
        title={vs.serverMuted ? 'Server muted' : 'Muted'}
        class="{vs.serverMuted ? 'text-danger' : 'text-text-muted'}"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Muted">
          <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
        </svg>
      </span>
    {/if}

    {#if vs.deafened || vs.serverDeafened}
      <span
        title={vs.serverDeafened ? 'Server deafened' : 'Deafened'}
        class="{vs.serverDeafened ? 'text-danger' : 'text-text-muted'}"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Deafened">
          <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
        </svg>
      </span>
    {/if}

    {#if vs.streaming}
      <span title="Streaming" class="text-brand">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Streaming">
          <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/>
        </svg>
      </span>
    {/if}
  </div>
</div>
