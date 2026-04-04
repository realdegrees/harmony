<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api/client';
  import { channels } from '$lib/stores/channels.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import MessageList from '$lib/components/chat/MessageList.svelte';
  import MessageInput from '$lib/components/chat/MessageInput.svelte';
  import type { User } from '@harmony/shared/types/user';
  import type { DirectMessageChannel } from '@harmony/shared/types/channel';

  const userId = $derived($page.params.userId as string);

  let dmUser = $state<User | null>(null);
  let dmChannelId = $state<string | null>(null);
  let error = $state('');

  $effect(() => {
    const id = userId;
    void initDm(id);
  });

  async function initDm(targetUserId: string) {
    error = '';
    dmUser = null;
    dmChannelId = null;
    try {
      // Fetch target user info
      dmUser = await api.get<User>(`/users/${targetUserId}`);

      // Get or create DM channel
      const result = await api.post<{ channel: { id: string; name: string; type: string }; isNew: boolean }>('/dms', {
        userId: targetUserId,
      });

      dmChannelId = result.channel.id;
      channels.setActiveChannel(result.channel.id);

      // Make sure it's in the DM list
      const alreadyIn = channels.dmChannels.some((d) => d.channelId === result.channel.id);
      if (!alreadyIn) {
        await channels.fetchDmChannels();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to open DM';
    }
  }
</script>

<div class="flex flex-col flex-1 min-w-0 overflow-hidden h-full">
  <!-- DM header -->
  <Header dmUser={dmUser} />

  {#if error}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center text-text-muted">
        <p class="text-danger mb-2">{error}</p>
        <button
          class="text-sm text-text-link hover:underline"
          onclick={() => initDm(userId)}
        >
          Retry
        </button>
      </div>
    </div>
  {:else if dmChannelId && dmUser}
    <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <MessageList channelId={dmChannelId} />
      <MessageInput
        channelId={dmChannelId}
        placeholder="Message {dmUser.displayName || dmUser.username}"
      />
    </div>
  {:else}
    <div class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-text-muted">
        <svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <p class="text-sm">Opening conversation...</p>
      </div>
    </div>
  {/if}
</div>
