<script lang="ts">
  import { goto } from '$app/navigation';
  import { channels } from '$lib/stores/channels.svelte';
  import { voice } from '$lib/stores/voice.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { ChannelType } from '@harmony/shared/types/channel';
  import type { ChannelWithUnread } from '@harmony/shared/types/channel';
  import type { VoiceParticipant } from '@harmony/shared/types/voice';
  import { presence } from '$lib/stores/presence.svelte';

  interface Props {
    items: ChannelWithUnread[];
    type: ChannelType;
    activeChannelId: string | null;
    voiceParticipants?: Map<string, VoiceParticipant[]>;
  }

  let { items, type, activeChannelId, voiceParticipants = new Map() }: Props = $props();

  function handleClick(channel: ChannelWithUnread) {
    if (type === ChannelType.TEXT) {
      channels.setActiveChannel(channel.id);
      goto(`/channels/${channel.id}`);
    } else if (type === ChannelType.VOICE) {
      // Join audio if not already in this channel
      if (voice.currentChannelId !== channel.id) {
        if (voice.currentChannelId) voice.leaveChannel();
        voice.joinChannel(channel.id);
      }
      // Always navigate so the voice channel page renders correctly
      channels.setActiveChannel(channel.id);
      goto(`/channels/${channel.id}`);
    }
  }

  function handleContextMenu(e: MouseEvent, channel: ChannelWithUnread) {
    e.preventDefault();
    ui.showContextMenu(e.clientX, e.clientY, [
      {
        label: 'Edit Channel',
        action: () => ui.openModal('editChannel', channel),
      },
      {
        label: 'Copy Channel ID',
        action: () => navigator.clipboard.writeText(channel.id),
      },
      { label: '', action: () => {}, divider: true },
      {
        label: 'Delete Channel',
        danger: true,
        action: async () => {
          if (confirm(`Delete #${channel.name}?`)) {
            await channels.deleteChannel(channel.id);
          }
        },
      },
    ]);
  }
</script>

<ul class="list-none m-0 p-0">
  {#each items as channel (channel.id)}
    {@const participants = voiceParticipants.get(channel.id) ?? []}
    <li>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="relative group"
        oncontextmenu={(e) => handleContextMenu(e, channel)}
      >
        <button
          class="w-full flex items-center gap-1.5 px-2 py-1.5 mx-2 rounded-lg transition-all duration-100 text-left
            {activeChannelId === channel.id
              ? 'bg-white/[0.10] text-text-primary shadow-sm'
              : 'text-text-muted hover:bg-white/[0.05] hover:text-text-secondary'}"
          style="width: calc(100% - 16px);"
          onclick={() => handleClick(channel)}
          aria-label="{type === ChannelType.TEXT ? '#' : '🔊'} {channel.name}"
          aria-current={activeChannelId === channel.id ? 'page' : undefined}
        >
          <!-- Channel type icon -->
          {#if type === ChannelType.TEXT}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
              <line x1="4" y1="9" x2="20" y2="9"></line>
              <line x1="4" y1="15" x2="20" y2="15"></line>
              <line x1="10" y1="3" x2="8" y2="21"></line>
              <line x1="16" y1="3" x2="14" y2="21"></line>
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          {/if}

          <span class="flex-1 truncate text-sm">{channel.name}</span>

          <!-- Unread badge -->
          <Badge count={channel.unreadCount} />

          <!-- Voice channel: text-only button (view chat without joining voice) -->
          {#if type === ChannelType.VOICE}
            <button
              class="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all duration-100
                     text-text-muted hover:text-text-primary hover:bg-white/[0.12]"
              title="View text chat (no voice)"
              aria-label="View text chat for {channel.name} without joining voice"
              onclick={(e) => {
                e.stopPropagation();
                channels.setActiveChannel(channel.id);
                goto(`/channels/${channel.id}`);
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          {/if}
        </button>

        <!-- Voice channel participants -->
        {#if type === ChannelType.VOICE && participants.length > 0}
          <ul class="ml-6 list-none p-0 mt-0.5">
            {#each participants as p (p.userId)}
              {@const vs = p.voiceState}
              {@const speaking = voice.speakingUsers.has(p.userId)}
              {@const playingClip = voice.soundboardPlayingUsers.get(p.userId)}
              <li class="flex items-center gap-1 px-2 py-0.5 text-xs text-text-muted">
                <div class="rounded-full
                  {speaking
                    ? 'ring-1 ring-success/70'
                    : playingClip
                      ? 'ring-1 ring-info/70'
                      : ''}">
                  <Avatar
                    src={p.user?.avatarPath ?? null}
                    username={p.user?.displayName || p.user?.username || p.userId}
                    size="xs"
                    status={presence.getPresence(p.userId)}
                  />
                </div>
                <span class="truncate flex-1">{p.user?.displayName || p.user?.username || p.userId}</span>
                <span class="flex items-center gap-0.5 shrink-0">
                  {#if vs?.muted || vs?.serverMuted}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="text-danger" aria-label="Muted">
                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                    </svg>
                  {/if}
                  {#if vs?.deafened || vs?.serverDeafened}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="text-danger" aria-label="Deafened">
                      <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
                      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  {/if}
                  {#if vs?.streaming}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="text-brand" aria-label="Streaming">
                      <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/>
                    </svg>
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </li>
  {/each}
</ul>
