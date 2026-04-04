<script lang="ts">
  import type { VoiceParticipant } from '@harmony/shared/types/voice';
  import { voice } from '$lib/stores/voice.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  interface Props {
    channel: { id: string; name: string };
    participants: VoiceParticipant[];
  }

  let { channel, participants }: Props = $props();

  const isCurrentChannel = $derived(voice.currentChannelId === channel.id);

  function handleJoin() {
    if (isCurrentChannel) return;
    voice.joinChannel(channel.id);
  }
</script>

<div class="select-none">
  <!-- Channel Row -->
  <button
    onclick={handleJoin}
    class="
      w-full flex items-center gap-1.5 px-2 py-1 rounded
      text-sm transition-colors duration-100
      {isCurrentChannel
        ? 'bg-bg-active text-text-primary'
        : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'}
    "
  >
    <!-- Speaker icon -->
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class="shrink-0 {isCurrentChannel ? 'text-brand' : 'text-channel-icon'}"
    >
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
    <span class="flex-1 text-left truncate font-medium">{channel.name}</span>

    {#if participants.length > 0}
      <span class="text-xs text-text-muted">{participants.length}</span>
    {/if}
  </button>

  <!-- Participants -->
  {#if participants.length > 0}
    <div class="pl-5 pb-1">
      {#each participants as participant (participant.userId)}
        {@const vs = participant.voiceState}
        {@const isSelf = participant.userId === auth.user?.id}
        <div
          class="
            flex items-center gap-2 px-2 py-0.5 rounded
            text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary
            transition-colors duration-100
          "
        >
          <!-- Avatar -->
          <div class="relative shrink-0">
            <Avatar
              src={participant.user.avatarPath}
              username={participant.user.username}
              size="xs"
            />
            <!-- Speaking indicator (placeholder - actual state from audio level) -->
          </div>

          <span class="flex-1 truncate {isSelf ? 'text-text-primary' : ''}">
            {participant.user.displayName || participant.user.username}
          </span>

          <!-- State icons -->
          <div class="flex items-center gap-0.5 shrink-0">
            {#if vs.muted || vs.serverMuted}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="Muted"
                class="{vs.serverMuted ? 'text-danger' : 'text-text-muted'}"
              >
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
              </svg>
            {/if}
            {#if vs.deafened || vs.serverDeafened}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="Deafened"
                class="{vs.serverDeafened ? 'text-danger' : 'text-text-muted'}"
              >
                <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
              </svg>
            {/if}
            {#if vs.streaming}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="Streaming"
                class="text-brand"
              >
                <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/>
              </svg>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
