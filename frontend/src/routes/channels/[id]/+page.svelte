<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/stores';
  import { channels } from '$lib/stores/channels.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import { messages as messagesStore } from '$lib/stores/messages.svelte';
  import { api } from '$lib/api/client';
  import { ChannelType } from '@harmony/shared/types/channel';
  import Header from '$lib/components/layout/Header.svelte';
  import MemberList from '$lib/components/layout/MemberList.svelte';
  import MessageList from '$lib/components/chat/MessageList.svelte';
  import MessageInput from '$lib/components/chat/MessageInput.svelte';
  import VoiceChannelView from '$lib/components/voice/VoiceChannelView.svelte';
  import type { User } from '@harmony/shared/types/user';

  const channelId = $derived($page.params.id);

  let members = $state<User[]>([]);
  let acknowledgedChannelId = $state<string | null>(null);

  const activeChannel = $derived(channels.activeChannel);
  const isVoice = $derived(activeChannel?.type === ChannelType.VOICE);

  $effect(() => {
    const id = channelId;
    untrack(() => {
      channels.setActiveChannel(id);
      channels.clearUnread(id);
      acknowledgedChannelId = null;
      fetchMembers(id);
    });
  });

  $effect(() => {
    const id = channelId;
    const msgs = messagesStore.getMessages(id);
    if (msgs.length > 0 && acknowledgedChannelId !== id) {
      const lastId = msgs[msgs.length - 1].id;
      untrack(() => {
        acknowledgedChannelId = id;
        notifications.acknowledgeChannel(id, lastId).catch(() => {});
      });
    }
  });

  async function fetchMembers(id: string) {
    try {
      members = await api.get<User[]>(`/channels/${id}/members`);
    } catch {
      members = [];
    }
  }
</script>

<div class="flex flex-1 min-w-0 overflow-hidden h-full">
  <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
    <Header channel={activeChannel} />

    {#if channelId}
      {#if isVoice}
        <!--
          Voice channel: split layout.
          Top half — participant cards + stream focus view (VoiceChannelView).
          Bottom half — text chat for this channel (same as a text channel).
          The split uses a flex column with the voice area growing to fill
          available space and the chat pinned to the bottom.
        -->
        <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
          <!-- Voice participant area -->
          <div class="flex flex-col overflow-hidden min-h-[200px] max-h-[55%]" style="flex: 1 1 0;">
            <VoiceChannelView
              {channelId}
              channelName={activeChannel?.name ?? 'Voice Channel'}
            />
          </div>

          <div class="shrink-0 border-t border-divider"></div>

          <!-- Chat section -->
          <div class="flex flex-col overflow-hidden min-h-[220px]" style="height: 45%;">
            <MessageList {channelId} />
            <MessageInput
              {channelId}
              placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Message...'}
            />
          </div>
        </div>
      {:else}
        <!-- Text channel: full-height chat -->
        <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
          <MessageList {channelId} />
          <MessageInput
            {channelId}
            placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Message...'}
          />
        </div>
      {/if}
    {:else}
      <div class="flex-1 flex items-center justify-center text-text-muted">
        Select a channel to start chatting
      </div>
    {/if}
  </div>

  <!-- Member list (only for text channels; voice has its own participant cards) -->
  {#if !isVoice}
    <MemberList {members} />
  {/if}
</div>

