<script lang="ts">
  import { voice } from '$lib/stores/voice.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import StreamView from '$lib/components/voice/StreamView.svelte';
  import type { VoiceParticipant } from '@harmony/shared/types/voice';

  interface Props {
    channelId: string;
    channelName: string;
  }

  let { channelId, channelName }: Props = $props();

  const participants = $derived(voice.participants.get(channelId) ?? []);
  const inThisChannel = $derived(voice.currentChannelId === channelId);
  const speakingUsers = $derived(voice.speakingUsers);
  const soundboardPlayingUsers = $derived(voice.soundboardPlayingUsers);

  // Build the StreamEntry array for StreamView — one entry per streaming participant.
  // Local user's own stream comes from voice.activeStream; everyone else from remoteStreams.
  const streamEntries = $derived(
    participants
      .filter(p => p.voiceState?.streaming)
      .flatMap(p => {
        const stream = p.userId === auth.user?.id
          ? (voice as unknown as { activeStream: MediaStream | null }).activeStream
          : voice.remoteStreams.get(p.userId) ?? null;
        if (!stream) return [];
        return [{ participant: p, stream }];
      })
  );

  // Whether to show the StreamView panel (at least one stream has a MediaStream)
  const hasStreams = $derived(streamEntries.length > 0);

  // Also auto-show the stream panel when someone starts streaming even if
  // we haven't received the MediaStream yet (shows connecting state).
  const anyoneStreaming = $derived(participants.some(p => p.voiceState?.streaming));

  let streamViewOpen = $state(true);

  // Re-open panel whenever a new stream starts
  $effect(() => {
    if (anyoneStreaming) streamViewOpen = true;
  });

  function isMe(p: VoiceParticipant) {
    return p.userId === auth.user?.id;
  }

  function onParticipantContextMenu(e: MouseEvent, p: VoiceParticipant) {
    if (isMe(p)) return; // No volume control for self
    e.preventDefault();
    ui.showContextMenu(e.clientX, e.clientY, [
      {
        type: 'slider',
        label: 'Volume',
        icon: '🔊',
        min: 0,
        max: 2,
        step: 0.05,
        value: voice.getUserVolume(p.userId),
        onChange: (v) => voice.setUserVolume(p.userId, v),
      },
    ]);
  }
</script>

<div class="flex flex-col flex-1 min-h-0 overflow-hidden">

  {#if !inThisChannel}
    <!-- Not connected -->
    <div class="flex flex-col items-center justify-center gap-2 p-8 text-text-muted text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="opacity-25" aria-hidden="true">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
      <p class="text-sm font-semibold text-text-secondary">{channelName}</p>
      <p class="text-xs">Click the channel in the sidebar to join.</p>
    </div>

  {:else if participants.length === 0}
    <!-- Connected but alone -->
    <div class="flex flex-col items-center justify-center gap-2 p-8 text-text-muted text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="opacity-25" aria-hidden="true">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
      <p class="text-sm font-semibold text-text-secondary">You're the first one here</p>
      <p class="text-xs">Others will appear here when they join.</p>
    </div>

  {:else}
<div class="flex flex-col min-h-0 overflow-hidden">

      <!-- Stream view — shown when at least one participant is streaming -->
      {#if anyoneStreaming && streamViewOpen}
        <div class="flex-[0_0_auto] max-h-[55%] min-h-[200px] flex flex-col overflow-hidden">
          <StreamView
            streams={streamEntries}
            onclose={() => streamViewOpen = false}
          />
        </div>
      {/if}

      <!-- Participant card grid -->
      <div class="grid gap-3 p-4 overflow-y-auto content-start"
           style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));">

        <!-- Re-open streams button (shown when panel is closed but streams are active) -->
        {#if anyoneStreaming && !streamViewOpen}
          <button
            class="col-span-full flex items-center gap-2 px-3 py-2 mb-1 rounded-xl
                   bg-brand/10 border border-brand/25 text-brand text-xs font-semibold
                   hover:bg-brand/15 transition-all duration-100"
            onclick={() => streamViewOpen = true}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/>
            </svg>
            Show live streams ({streamEntries.length})
          </button>
        {/if}

        {#each participants as p (p.userId)}
          {@const vs = p.voiceState}
          {@const me = isMe(p)}
          {@const speaking = speakingUsers.has(p.userId)}
          {@const playingClip = soundboardPlayingUsers.get(p.userId)}
          <div
            class="flex flex-col items-center gap-2 pt-3.5 pb-2.5 px-2 rounded-2xl
                   bg-white/[0.05] backdrop-blur-sm
                   border transition-all duration-150 select-none
                   {speaking
                     ? 'border-success/60 shadow-[0_0_20px_rgba(47,182,122,0.2)]'
                     : vs?.streaming
                       ? 'border-brand/60 shadow-[0_0_16px_rgba(92,110,240,0.15)]'
                       : me
                         ? 'border-white/[0.12]'
                         : 'border-white/[0.06]'}
                   {!me ? 'cursor-context-menu' : ''}"
            oncontextmenu={(e) => onParticipantContextMenu(e, p)}
            role="group"
            aria-label="{p.user.displayName || p.user.username}"
          >
            <!-- Avatar + speaking/soundboard ring + LIVE badge -->
            <div class="relative">
              <div class="rounded-full transition-all duration-150
                {speaking
                  ? 'ring-2 ring-success ring-offset-2 ring-offset-transparent shadow-[0_0_12px_rgba(47,182,122,0.4)]'
                  : playingClip
                    ? 'ring-2 ring-info ring-offset-2 ring-offset-transparent'
                    : ''}">
                <Avatar
                  src={p.user.avatarPath}
                  username={p.user.displayName || p.user.username}
                  size="lg"
                />
              </div>
              {#if speaking}
                <span class="absolute inset-0 rounded-full ring-2 ring-success/40 animate-ping pointer-events-none" aria-hidden="true"></span>
              {/if}
              {#if vs?.streaming}
                <span class="absolute -bottom-1 left-1/2 -translate-x-1/2
                             bg-brand text-white text-[9px] font-extrabold tracking-wide
                             px-1.5 py-px rounded-sm leading-snug pointer-events-none whitespace-nowrap">
                  LIVE
                </span>
              {/if}
            </div>

            <!-- Name -->
            <span class="text-xs font-semibold text-text-primary text-center w-full truncate px-1">
              {p.user.displayName || p.user.username}{me ? ' (you)' : ''}
            </span>

            <!-- State icons -->
            <div class="flex items-center gap-1 text-text-muted min-h-[14px]">
              {#if vs?.muted || vs?.serverMuted}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                     class="{vs.serverMuted ? 'text-danger' : ''}" aria-label="Muted">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
              {/if}
              {#if vs?.deafened || vs?.serverDeafened}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                     class="{vs.serverDeafened ? 'text-danger' : ''}" aria-label="Deafened">
                  <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
                </svg>
              {/if}
              {#if vs?.streaming}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                     class="text-brand" aria-label="Streaming">
                  <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/>
                </svg>
              {/if}
            </div>
          </div>
        {/each}
      </div>

    </div>
  {/if}

</div>
