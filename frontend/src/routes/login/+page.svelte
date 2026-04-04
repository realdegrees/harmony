<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { auth } from '$lib/stores/auth.svelte';

  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    error = '';
    loading = true;
    try {
      await auth.login(username.trim(), password);
      goto('/channels');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-bg-tertiary flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <!-- Logo / Brand -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-text-primary">Welcome back!</h1>
      <p class="text-text-secondary text-sm mt-1">We're so excited to see you again!</p>
    </div>

    <!-- Card -->
    <div class="bg-bg-secondary rounded-lg p-8 shadow-2xl">
      {#if error}
        <div class="mb-4 p-3 rounded bg-danger/10 border border-danger/30 text-danger text-sm">
          {error}
        </div>
      {/if}

      <form onsubmit={handleLogin} class="flex flex-col gap-4">
        <Input
          id="username"
          label="Username"
          placeholder="Enter your username"
          bind:value={username}
          autocomplete="username"
          disabled={loading}
        />

        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          bind:value={password}
          autocomplete="current-password"
          disabled={loading}
        />

        <Button
          type="submit"
          size="lg"
          {loading}
          disabled={loading || !username.trim() || !password}
          class="w-full mt-2"
        >
          Log In
        </Button>
      </form>

      <p class="text-text-muted text-sm mt-4 text-center">
        Need an account?
        <a href="/register" class="text-text-link hover:underline">Register</a>
      </p>
    </div>
  </div>
</div>
