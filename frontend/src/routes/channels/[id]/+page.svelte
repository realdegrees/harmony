<script lang="ts">
  import { page } from '$app/stores';
  import { channels } from '$lib/stores/channels.svelte';
  import { api } from '$lib/api/client';
  import Header from '$lib/components/layout/Header.svelte';
  import MemberList from '$lib/components/layout/MemberList.svelte';
  import MessageList from '$lib/components/chat/MessageList.svelte';
  import MessageInput from '$lib/components/chat/MessageInput.svelte';
  import type { User } from '@harmony/shared/types/user';

  const channelId = $derived($page.params.id);

  let members = $state<User[]>([]);

  $effect(() => {
    const id = channelId;
    channels.setActiveChannel(id);
    fetchMembers(id);
    return () => {
      // Optionally clear active channel on unmount
    };
  });

  async function fetchMembers(id: string) {
    try {
      members = await api.get<User[]>(`/channels/${id}/members`);
    } catch {
      members = [];
    }
  }

  const activeChannel = $derived(channels.activeChannel);
</script>

<div class="flex flex-1 min-w-0 overflow-hidden h-full">
  <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
    <!-- Top header -->
    <Header channel={activeChannel} />

    <!-- Messages + Input -->
    {#if channelId}
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <MessageList {channelId} />
        <MessageInput
          {channelId}
          placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Message...'}
        />
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center text-text-muted">
        Select a channel to start chatting
      </div>
    {/if}
  </div>

  <!-- Member list -->
  <MemberList {members} />
</div>
