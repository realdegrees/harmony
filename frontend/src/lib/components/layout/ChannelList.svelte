<script lang="ts">
  import { goto } from '$app/navigation';
  import { channels } from '$lib/stores/channels.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
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
    channels.setActiveChannel(channel.id);
    if (type === ChannelType.TEXT) {
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
          class="w-full flex items-center gap-1.5 px-2 py-1 mx-2 rounded transition-colors text-left
            {activeChannelId === channel.id
              ? 'bg-bg-active text-text-primary'
              : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'}"
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
          {#if channel.unreadCount > 0}
            <span
              class="min-w-[18px] h-[18px] px-1 bg-danger text-white text-[11px] font-bold rounded-full flex items-center justify-center shrink-0"
              aria-label="{channel.unreadCount} unread"
            >
              {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
            </span>
          {/if}
        </button>

        <!-- Voice channel participants -->
        {#if type === ChannelType.VOICE && participants.length > 0}
          <ul class="ml-6 list-none p-0 mt-0.5">
            {#each participants as p (p.userId)}
              <li class="flex items-center gap-1.5 px-2 py-0.5 text-xs text-text-muted">
                <Avatar username={p.userId} size="xs" status={presence.getPresence(p.userId)} />
                <span class="truncate">{p.userId}</span>
                {#if p.voiceState?.muted}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-danger shrink-0" aria-label="Muted" aria-hidden="true">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </li>
  {/each}
</ul>
