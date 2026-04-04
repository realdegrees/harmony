<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // TODO: Check auth state and redirect
    goto('/login');
  });
</script>

<div class="flex items-center justify-center h-screen bg-bg-primary">
  <p class="text-text-muted">Loading...</p>
</div>
