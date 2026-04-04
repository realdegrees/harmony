<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import { api } from '$lib/api/client';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  interface Props {
    onclose?: () => void;
  }

  let { onclose }: Props = $props();

  type Section = 'profile' | 'account' | 'appearance' | 'voice' | 'notifications';

  let activeSection = $state<Section>('profile');
  let isSaving = $state(false);
  let saveError = $state('');
  let saveSuccess = $state('');

  // Profile section
  let displayName = $state(auth.user?.displayName ?? '');
  let avatarFile = $state<File | null>(null);
  let avatarPreview = $state<string | null>(null);

  // Account section
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordError = $state('');

  // Notifications section
  let pushEnabled = $state(false);
  let soundEnabled = $state(true);

  $effect(() => {
    if (auth.user) {
      displayName = auth.user.displayName;
    }
    // Load notification prefs from localStorage
    try {
      const prefs = localStorage.getItem('harmony:notification-prefs');
      if (prefs) {
        const p = JSON.parse(prefs);
        pushEnabled = p.push ?? false;
        soundEnabled = p.sound ?? true;
      }
    } catch {}
  });

  function handleAvatarChange(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    avatarFile = file;
    avatarPreview = URL.createObjectURL(file);
  }

  function clearSuccess() {
    setTimeout(() => { saveSuccess = ''; }, 3000);
  }

  async function saveProfile() {
    if (!auth.user) return;
    isSaving = true;
    saveError = '';
    saveSuccess = '';
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const res = await api.upload<{ avatarPath: string }>('/users/me/avatar', fd);
        auth.updateUser({ ...auth.user, avatarPath: res.avatarPath, displayName });
      }
      if (displayName !== auth.user.displayName) {
        const updated = await api.patch<typeof auth.user>('/users/me', { displayName });
        auth.updateUser(updated);
      }
      saveSuccess = 'Profile saved!';
      clearSuccess();
      avatarFile = null;
    } catch (e: unknown) {
      saveError = e instanceof Error ? e.message : 'Failed to save profile';
    } finally {
      isSaving = false;
    }
  }

  async function changePassword() {
    passwordError = '';
    if (newPassword !== confirmPassword) {
      passwordError = 'Passwords do not match';
      return;
    }
    if (newPassword.length < 8) {
      passwordError = 'Password must be at least 8 characters';
      return;
    }
    isSaving = true;
    saveError = '';
    saveSuccess = '';
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      saveSuccess = 'Password changed!';
      clearSuccess();
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (e: unknown) {
      passwordError = e instanceof Error ? e.message : 'Failed to change password';
    } finally {
      isSaving = false;
    }
  }

  function saveNotificationPrefs() {
    localStorage.setItem('harmony:notification-prefs', JSON.stringify({ push: pushEnabled, sound: soundEnabled }));
    saveSuccess = 'Preferences saved!';
    clearSuccess();
  }

  const SECTIONS: { id: Section; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
    { id: 'account', label: 'Account', icon: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z' },
    { id: 'appearance', label: 'Appearance', icon: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
    { id: 'voice', label: 'Voice & Audio', icon: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z' },
    { id: 'notifications', label: 'Notifications', icon: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z' },
  ];
</script>

<div class="flex h-full bg-bg-primary overflow-hidden">
  <!-- Sidebar nav -->
  <nav
    class="w-56 shrink-0 bg-bg-secondary border-r border-divider flex flex-col py-4 px-2 gap-0.5"
    aria-label="Settings navigation"
  >
    <p class="px-2 mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
      User Settings
    </p>
    {#each SECTIONS as section (section.id)}
      <button
        onclick={() => { activeSection = section.id; saveError = ''; saveSuccess = ''; }}
        class="
          flex items-center gap-2.5 px-2 py-1.5 rounded text-sm font-medium
          transition-colors duration-100
          {activeSection === section.id
            ? 'bg-bg-active text-text-primary'
            : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'}
        "
        role="tab"
        aria-selected={activeSection === section.id}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="shrink-0" aria-hidden="true">
          <path d={section.icon}/>
        </svg>
        {section.label}
      </button>
    {/each}

    <div class="mt-auto">
      <div class="my-2 border-t border-divider"></div>
      <button
        onclick={() => auth.logout()}
        class="
          flex items-center gap-2.5 px-2 py-1.5 rounded text-sm font-medium w-full
          text-danger hover:bg-danger/10 transition-colors duration-100
        "
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="shrink-0" aria-hidden="true">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
        Log Out
      </button>
    </div>
  </nav>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto px-8 py-8">
      <!-- Back button (for modal context) -->
      {#if onclose}
        <button
          onclick={onclose}
          class="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back
        </button>
      {/if}

      <!-- Success/error banner -->
      {#if saveSuccess}
        <div class="mb-4 px-4 py-2 rounded bg-success/20 text-success text-sm border border-success/30">
          {saveSuccess}
        </div>
      {/if}
      {#if saveError}
        <div class="mb-4 px-4 py-2 rounded bg-danger/20 text-danger text-sm border border-danger/30">
          {saveError}
        </div>
      {/if}

      <!-- Profile Section -->
      {#if activeSection === 'profile'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">My Account</h1>

        <!-- Profile card preview -->
        <div class="rounded-xl bg-bg-secondary p-4 mb-6 relative overflow-hidden">
          <div class="h-12 bg-gradient-to-r from-brand to-brand-hover rounded-lg mb-8"></div>
          <div class="flex items-end gap-4 -mt-10 px-2">
            <div class="relative">
              <div class="rounded-full border-4 border-bg-secondary overflow-hidden w-16 h-16 bg-bg-accent flex items-center justify-center">
                {#if avatarPreview}
                  <img src={avatarPreview} alt="Preview" class="w-full h-full object-cover" />
                {:else}
                  <Avatar src={auth.user?.avatarPath} username={auth.user?.username ?? ''} size="lg" />
                {/if}
              </div>
              <label
                class="
                  absolute bottom-0 right-0 w-6 h-6 rounded-full
                  bg-bg-accent border-2 border-bg-secondary
                  flex items-center justify-center cursor-pointer
                  hover:bg-bg-hover transition-colors
                "
                title="Change avatar"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-text-secondary" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                <input type="file" accept="image/*" class="sr-only" onchange={handleAvatarChange} />
              </label>
            </div>
            <div>
              <p class="font-bold text-text-primary">{auth.user?.displayName ?? auth.user?.username}</p>
              <p class="text-sm text-text-secondary">@{auth.user?.username}</p>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <Input
              label="Display Name"
              id="display-name"
              bind:value={displayName}
              placeholder="Your display name"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onclick={() => { displayName = auth.user?.displayName ?? ''; avatarFile = null; avatarPreview = null; }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSaving}
              onclick={saveProfile}
            >
              Save Changes
            </Button>
          </div>
        </div>

      <!-- Account Section -->
      {:else if activeSection === 'account'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">Account</h1>

        <div class="bg-bg-secondary rounded-xl p-5 mb-6">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Username</p>
              <p class="text-sm text-text-primary">@{auth.user?.username}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Account ID</p>
              <p class="text-sm text-text-primary font-mono">{auth.user?.id.slice(0, 8)}…</p>
            </div>
          </div>
        </div>

        <h2 class="text-lg font-semibold text-text-primary mb-4">Change Password</h2>
        <div class="space-y-3">
          <Input
            label="Current Password"
            id="current-password"
            type="password"
            bind:value={currentPassword}
            placeholder="Current password"
          />
          <Input
            label="New Password"
            id="new-password"
            type="password"
            bind:value={newPassword}
            placeholder="New password (min. 8 characters)"
          />
          <Input
            label="Confirm New Password"
            id="confirm-password"
            type="password"
            bind:value={confirmPassword}
            placeholder="Confirm new password"
            error={passwordError}
          />
          <div class="flex justify-end pt-2">
            <Button variant="danger" size="sm" loading={isSaving} onclick={changePassword}>
              Change Password
            </Button>
          </div>
        </div>

        <div class="mt-8 pt-6 border-t border-divider">
          <h2 class="text-lg font-semibold text-danger mb-2">Danger Zone</h2>
          <p class="text-sm text-text-muted mb-3">Once you delete your account, there is no going back.</p>
          <Button variant="danger" size="sm" onclick={() => {}}>Delete Account</Button>
        </div>

      <!-- Appearance Section -->
      {:else if activeSection === 'appearance'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">Appearance</h1>
        <div class="bg-bg-secondary rounded-xl p-6 text-center text-text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="mx-auto mb-3 opacity-30" aria-hidden="true">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>
          </svg>
          <p class="font-medium">Theme settings coming soon</p>
          <p class="text-sm mt-1">More customization options will be available in a future update.</p>
        </div>

      <!-- Voice & Audio Section -->
      {:else if activeSection === 'voice'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">Voice & Audio</h1>
        <div class="bg-bg-secondary rounded-xl p-6 text-center text-text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="mx-auto mb-3 opacity-30" aria-hidden="true">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
          <p class="font-medium">Device selection coming soon</p>
          <p class="text-sm mt-1">Microphone and speaker device selection will be available here.</p>
        </div>

      <!-- Notifications Section -->
      {:else if activeSection === 'notifications'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">Notifications</h1>

        <div class="space-y-4">
          <!-- Push notifications -->
          <div class="bg-bg-secondary rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-text-primary">Enable Push Notifications</p>
              <p class="text-xs text-text-muted mt-1">
                Receive browser notifications when you get a message or mention.
              </p>
            </div>
            <button
              onclick={() => { pushEnabled = !pushEnabled; saveNotificationPrefs(); }}
              class="
                relative inline-flex items-center w-11 h-6 rounded-full shrink-0
                transition-colors duration-200 focus:outline-none
                {pushEnabled ? 'bg-brand' : 'bg-bg-accent'}
              "
              role="switch"
              aria-checked={pushEnabled}
              aria-label="Enable push notifications"
            >
              <span
                class="
                  inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200
                  {pushEnabled ? 'translate-x-5' : 'translate-x-0.5'}
                "
              ></span>
            </button>
          </div>

          <!-- Notification sounds -->
          <div class="bg-bg-secondary rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-text-primary">Notification Sounds</p>
              <p class="text-xs text-text-muted mt-1">
                Play a sound when you receive a new message or notification.
              </p>
            </div>
            <button
              onclick={() => { soundEnabled = !soundEnabled; saveNotificationPrefs(); }}
              class="
                relative inline-flex items-center w-11 h-6 rounded-full shrink-0
                transition-colors duration-200 focus:outline-none
                {soundEnabled ? 'bg-brand' : 'bg-bg-accent'}
              "
              role="switch"
              aria-checked={soundEnabled}
              aria-label="Enable notification sounds"
            >
              <span
                class="
                  inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200
                  {soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}
                "
              ></span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
