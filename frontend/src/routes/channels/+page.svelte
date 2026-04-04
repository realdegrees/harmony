<script lang="ts">
  import { channels } from '$lib/stores/channels.svelte';
  import { goto } from '$app/navigation';

  // Auto-navigate to the first text channel if available
  $effect(() => {
    const first = channels.textChannels[0];
    if (first) {
      goto(`/channels/${first.id}`);
    }
  });
</script>

<div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-bg-primary">
  <div class="max-w-sm">
    <svg
      width="72"
      height="72"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1"
      class="mx-auto mb-4 text-text-muted opacity-30"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    <h2 class="text-xl font-semibold text-text-primary mb-2">Welcome to Harmony</h2>
    <p class="text-text-muted text-sm">
      Select a channel from the sidebar to start chatting, or create a new one with the + button.
    </p>
  </div>
</div>
