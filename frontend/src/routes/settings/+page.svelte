<script lang="ts">
  import { goto } from '$app/navigation';
  import Settings from '$lib/components/user/Settings.svelte';

  function handleClose() {
    goto('/');
  }
</script>

<svelte:head>
  <title>Settings — Harmony</title>
</svelte:head>

<div class="fixed inset-0 z-50 bg-bg-primary">
  <!-- Close shortcut hint -->
  <div class="absolute top-4 right-4 z-10">
    <button
      onclick={handleClose}
      class="
        flex items-center gap-2 px-3 py-1.5 rounded
        bg-bg-secondary text-text-muted hover:text-text-primary
        text-sm transition-colors duration-100
      "
      title="Close settings (Esc)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
      <kbd class="font-mono text-xs">Esc</kbd>
    </button>
  </div>

  <Settings onclose={handleClose} />
</div>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') handleClose();
  }}
/>
