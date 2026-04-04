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

<div class="auth-shell">
  <!-- Left: Branding panel -->
  <div class="brand-panel">
    <div class="brand-noise"></div>
    <div class="brand-glow"></div>

    <div class="brand-content">
      <div class="brand-logo">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <div class="brand-text">
        <h1 class="brand-name">Harmony</h1>
        <p class="brand-tagline">Where conversations come alive.</p>
      </div>

      <ul class="brand-features" aria-hidden="true">
        <li>
          <span class="feature-dot"></span>
          Real-time messaging
        </li>
        <li>
          <span class="feature-dot"></span>
          Voice &amp; video channels
        </li>
        <li>
          <span class="feature-dot"></span>
          Organized communities
        </li>
      </ul>
    </div>

    <div class="brand-footer">
      <p>New here? <a href="/register">Create an account</a></p>
    </div>
  </div>

  <!-- Right: Form panel -->
  <div class="form-panel">
    <div class="form-container">
      <div class="form-header">
        <h2>Welcome back</h2>
        <p>Sign in to pick up where you left off.</p>
      </div>

      {#if error}
        <div class="form-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      {/if}

      <form onsubmit={handleLogin} class="auth-form">
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
          class="w-full"
        >
          Sign In
        </Button>
      </form>

      <p class="form-footer-link">
        Don't have an account? <a href="/register">Register</a>
      </p>
    </div>
  </div>
</div>

<style>
  .auth-shell {
    display: flex;
    min-height: 100svh;
    overflow: hidden;
  }

  /* ── Brand panel ─────────────────────────────────────────────────────────── */
  .brand-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 46%;
    min-height: 100svh;
    padding: 3rem;
    background: rgba(8,9,12,0.97);
    overflow: hidden;
    flex-shrink: 0;
  }

  /* Decorative noise overlay */
  .brand-noise {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    pointer-events: none;
    z-index: 0;
  }

  /* Brand accent glow */
  .brand-glow {
    position: absolute;
    top: -120px;
    right: -80px;
    width: 480px;
    height: 480px;
    background: radial-gradient(circle, rgba(88, 101, 242, 0.22) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .brand-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    margin-top: 1rem;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 20px;
    background: linear-gradient(135deg, #5c6ef0, #8b9cf8);
    color: white;
    box-shadow:
      0 8px 32px rgba(92, 110, 240, 0.45),
      0 0 60px rgba(92, 110, 240, 0.15),
      inset 0 1px 0 rgba(255,255,255,0.15);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .brand-name {
    font-size: 2.75rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: #f2f3f5;
    line-height: 1;
    margin: 0;
  }

  .brand-tagline {
    font-size: 1.0625rem;
    color: #b5bac1;
    margin: 0;
    line-height: 1.5;
  }

  .brand-features {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    color: #949ba4;
    font-size: 0.9rem;
  }

  .brand-features li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .feature-dot {
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #5865f2;
    flex-shrink: 0;
  }

  .brand-footer {
    position: relative;
    z-index: 1;
    font-size: 0.875rem;
    color: #6d7176;
  }

  .brand-footer a {
    color: #b5bac1;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s;
  }

  .brand-footer a:hover {
    color: #f2f3f5;
  }

  /* Vertical separator */
  .brand-panel::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 1px;
    height: 100%;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(255,255,255,0.08) 20%,
      rgba(255,255,255,0.08) 80%,
      transparent 100%
    );
  }

  /* ── Form panel ──────────────────────────────────────────────────────────── */
  .form-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    background: rgba(14,15,20,0.95);
    overflow-y: auto;
  }

  .form-container {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .form-header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-header h2 {
    font-size: 1.625rem;
    font-weight: 700;
    color: #f2f3f5;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .form-header p {
    font-size: 0.9rem;
    color: #949ba4;
    margin: 0;
  }

  .form-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    background: rgba(229, 62, 68, 0.10);
    border: 1px solid rgba(229, 62, 68, 0.25);
    backdrop-filter: blur(8px);
    color: #e53e44;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-footer-link {
    font-size: 0.875rem;
    color: #6d7176;
    text-align: center;
    margin: 0;
  }

  .form-footer-link a {
    color: #00a8fc;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s;
  }

  .form-footer-link a:hover {
    color: #33bcff;
    text-decoration: underline;
  }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .auth-shell {
      flex-direction: column;
    }

    .brand-panel {
      width: 100%;
      min-height: auto;
      padding: 2rem 1.5rem 1.75rem;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 1rem;
    }

    .brand-panel::after {
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background: linear-gradient(
        to right,
        transparent 0%,
        rgba(255,255,255,0.06) 20%,
        rgba(255,255,255,0.06) 80%,
        transparent 100%
      );
    }

    .brand-content {
      flex-direction: row;
      align-items: center;
      gap: 1rem;
      margin-top: 0;
    }

    .brand-features,
    .brand-text p,
    .brand-footer {
      display: none;
    }

    .brand-name {
      font-size: 1.5rem;
    }

    .brand-logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      flex-shrink: 0;
    }

    .brand-logo svg {
      width: 24px;
      height: 24px;
    }

    .brand-glow {
      display: none;
    }

    .form-panel {
      padding: 2rem 1.5rem 3rem;
      align-items: flex-start;
    }
  }
</style>
