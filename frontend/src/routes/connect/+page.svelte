<script lang="ts">
  import { goto } from '$app/navigation';
  import { setServerUrl } from '$lib/utils/tauri';

  let serverUrl = $state('');
  let error = $state('');
  let isChecking = $state(false);

  async function handleConnect() {
    const raw = serverUrl.trim();
    if (!raw) {
      error = 'Please enter a server URL.';
      return;
    }

    // Ensure it starts with http:// or https://
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    isChecking = true;
    error = '';

    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
    } catch (err) {
      error = `Could not reach the server. Check the URL and try again.\n(${err instanceof Error ? err.message : 'Network error'})`;
      isChecking = false;
      return;
    }

    setServerUrl(url);
    goto('/login');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleConnect();
  }
</script>

<div class="min-h-screen bg-bg-primary flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <!-- Logo / wordmark -->
    <div class="flex flex-col items-center mb-8">
      <div class="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mb-4 shadow-lg">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-text-primary">Harmony</h1>
      <p class="text-text-muted text-sm mt-1">Connect to your server</p>
    </div>

    <!-- Form card -->
    <div class="bg-bg-secondary rounded-xl p-6 shadow-xl">
      <label for="server-url" class="block text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
        Server URL
      </label>
      <input
        id="server-url"
        type="url"
        placeholder="https://harmony.example.com"
        bind:value={serverUrl}
        onkeydown={handleKeydown}
        class="
          w-full px-3 py-2.5 rounded-md bg-bg-input border border-divider
          text-text-primary placeholder:text-text-muted text-sm
          focus:outline-none focus:border-brand transition-colors
        "
        autocomplete="url"
        spellcheck="false"
      />

      {#if error}
        <p class="mt-2 text-xs text-danger whitespace-pre-line">{error}</p>
      {/if}

      <button
        onclick={handleConnect}
        disabled={isChecking}
        class="
          mt-4 w-full py-2.5 rounded-md bg-brand text-white font-semibold text-sm
          hover:bg-brand-hover active:bg-brand-active transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
        "
      >
        {#if isChecking}
          <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Connecting...
        {:else}
          Connect
        {/if}
      </button>
    </div>

    <p class="mt-4 text-center text-xs text-text-muted">
      You can change this later in Settings.
    </p>
  </div>
</div>
