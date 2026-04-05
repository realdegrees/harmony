<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { api } from '$lib/api/client';
  import { voice } from '$lib/stores/voice.svelte';
  import { getAudioInputDevices, getAudioOutputDevices } from '$lib/voice/streaming';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { isTauri, getServerUrl, clearServerUrl } from '$lib/utils/tauri';

  interface Props {
    onclose?: () => void;
  }

  let { onclose }: Props = $props();

  type Section = 'profile' | 'account' | 'appearance' | 'voice' | 'notifications' | 'server';

  const showServerSection = isTauri();

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

  // Admin token claim
  let adminToken = $state('');
  let adminClaimStatus = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let adminClaimError = $state('');

  async function claimAdmin() {
    if (!adminToken.trim()) return;
    adminClaimStatus = 'loading';
    adminClaimError = '';
    try {
      await api.post('/auth/claim-admin', { token: adminToken.trim() });
      adminClaimStatus = 'success';
      adminToken = '';
    } catch (err) {
      adminClaimStatus = 'error';
      adminClaimError = err instanceof Error ? err.message : 'Failed to claim admin.';
    }
  }

  // Notifications section
  let pushEnabled = $state(false);
  let soundEnabled = $state(true);

  // Voice & Audio section
  let micDevices = $state<MediaDeviceInfo[]>([]);
  let speakerDevices = $state<MediaDeviceInfo[]>([]);
  let audioDevicesError = $state('');
  let testingMic = $state(false);
  let micTestLevel = $state(0);
  let micTestInterval: ReturnType<typeof setInterval> | null = null;

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

  // Load audio devices when the voice section becomes active
  $effect(() => {
    if (activeSection === 'voice') {
      loadAudioDevices();
    } else {
      stopMicTest();
    }
  });

  async function loadAudioDevices() {
    audioDevicesError = '';
    micDevices = [];
    speakerDevices = [];

    // We must get a real stream first — without it, Chrome returns devices with
    // empty labels and empty deviceIds (privacy protection). Stop the stream
    // immediately after; we only needed the permission grant.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        audioDevicesError =
          'Microphone access was denied. Click the lock/camera icon in your address bar, allow the microphone, then come back here.';
      } else if (name === 'NotFoundError') {
        audioDevicesError = 'No microphone found. Connect a microphone and try again.';
      } else {
        audioDevicesError = 'Could not access microphone. Make sure no other application has it locked.';
      }
      return;
    }
    stream.getTracks().forEach(t => t.stop());

    const [inputs, outputs] = await Promise.all([
      getAudioInputDevices(),
      getAudioOutputDevices(),
    ]);

    // Filter out the "default" alias Chrome adds — it duplicates the real device.
    // Keep it only if there are no other options.
    const filterDefault = (list: MediaDeviceInfo[]) =>
      list.filter(d => d.deviceId !== 'default').length > 0
        ? list.filter(d => d.deviceId !== 'default')
        : list;

    micDevices = filterDefault(inputs);
    speakerDevices = filterDefault(outputs);
  }

  function stopMicTest() {
    if (micTestInterval) { clearInterval(micTestInterval); micTestInterval = null; }
    testingMic = false;
    micTestLevel = 0;
  }

  async function toggleMicTest() {
    if (testingMic) { stopMicTest(); return; }
    testingMic = true;
    micTestLevel = 0;
    audioDevicesError = '';
    try {
      const constraints: MediaStreamConstraints = {
        audio: voice.preferredMicrophoneId
          ? { deviceId: { exact: voice.preferredMicrophoneId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      // Route mic audio back to speakers so user can hear themselves
      src.connect(ctx.destination);
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      micTestInterval = setInterval(() => {
        if (!testingMic) {
          stream.getTracks().forEach(t => t.stop());
          ctx.close();
          return;
        }
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        micTestLevel = Math.min(Math.sqrt(sum / data.length) / 128, 1);
      }, 50);
    } catch (err: unknown) {
      testingMic = false;
      const name = (err as { name?: string }).name;
      audioDevicesError = name === 'NotAllowedError'
        ? 'Microphone access denied. Check your browser permissions.'
        : 'Could not open microphone for test.';
    }
  }

  async function testSpeaker() {
    // Generate a short 440 Hz beep as a WAV data URI and play it through
    // the selected output device via setSinkId (Chrome/Edge).
    try {
      // Build a minimal PCM WAV in memory: 44100 Hz, mono, 16-bit, 0.4 s
      const sampleRate = 44_100;
      const duration = 0.4;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);
      const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
      writeStr(0, 'RIFF'); view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      writeStr(36, 'data'); view.setUint32(40, numSamples * 2, true);
      for (let i = 0; i < numSamples; i++) {
        // 440 Hz sine wave with a short fade-out
        const fade = 1 - i / numSamples;
        view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0x7fff * 0.4 * fade), true);
      }
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);

      // Route to selected output device if the browser supports setSinkId
      const sinkId = voice.preferredSpeakerId;
      if (sinkId && typeof (audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function') {
        await (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
      }

      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // Silently swallow — user-gesture timing issues can cause play() to throw
    }
  }

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
    // Only shown when running as a Tauri desktop app
    ...(showServerSection
      ? [{ id: 'server' as Section, label: 'Server', icon: 'M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-.83 0-1.5-.67-1.5-1.5S6.17 16 7 16s1.5.67 1.5 1.5S7.83 19 7 19zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-.83 0-1.5-.67-1.5-1.5S6.17 6 7 6s1.5.67 1.5 1.5S7.83 9 7 9z' }]
      : []),
  ];
</script>

<div class="flex h-full overflow-hidden">
  <!-- Sidebar nav -->
  <nav
    class="w-56 shrink-0 bg-white/[0.03] backdrop-blur-xl border-r border-white/[0.06] flex flex-col py-4 px-2 gap-0.5"
    aria-label="Settings navigation"
  >
    <p class="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
      User Settings
    </p>
    {#each SECTIONS as section (section.id)}
      <button
        onclick={() => { activeSection = section.id; saveError = ''; saveSuccess = ''; }}
        class="
          flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium
          transition-all duration-100
          {activeSection === section.id
            ? 'bg-white/[0.10] text-text-primary shadow-sm'
            : 'text-text-muted hover:bg-white/[0.06] hover:text-text-primary'}
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
      <div class="my-2 border-t border-white/[0.07]"></div>
      <button
        onclick={() => auth.logout()}
        class="
          flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium w-full
          text-danger hover:bg-danger/10 transition-all duration-100
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
        <div class="mb-4 px-4 py-2 rounded-xl bg-success/10 text-success text-sm border border-success/20 backdrop-blur-sm">
          {saveSuccess}
        </div>
      {/if}
      {#if saveError}
        <div class="mb-4 px-4 py-2 rounded-xl bg-danger/10 text-danger text-sm border border-danger/20 backdrop-blur-sm">
          {saveError}
        </div>
      {/if}

      <!-- Profile Section -->
      {#if activeSection === 'profile'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">My Account</h1>

        <!-- Profile card preview -->
        <div class="rounded-2xl bg-white/[0.05] backdrop-blur-sm border border-white/[0.08] p-4 mb-6 relative overflow-hidden">
          <div class="h-12 bg-gradient-to-r from-brand/70 to-brand-hover/50 rounded-xl mb-8"></div>
          <div class="flex items-end gap-4 -mt-10 px-2">
            <div class="relative">
              <div class="rounded-full border-4 border-bg-primary overflow-hidden w-16 h-16 bg-white/[0.08] flex items-center justify-center">
                {#if avatarPreview}
                  <img src={avatarPreview} alt="Preview" class="w-full h-full object-cover" />
                {:else}
                  <Avatar src={auth.user?.avatarPath} username={auth.user?.username ?? ''} size="lg" />
                {/if}
              </div>
              <label
                class="
                  absolute bottom-0 right-0 w-6 h-6 rounded-full
                  bg-white/[0.15] border-2 border-bg-primary backdrop-blur-sm
                  flex items-center justify-center cursor-pointer
                  hover:bg-white/[0.25] transition-all
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

        <div class="bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/[0.07] p-5 mb-6">
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

        <!-- Admin Token -->
        <div class="mt-8 pt-6 border-t border-white/[0.07]">
          <h2 class="text-lg font-semibold text-text-primary mb-1">Claim Admin Privileges</h2>
          <p class="text-sm text-text-muted mb-4">
            Enter the admin token printed in the server console logs at startup.
            This grants your account full administrator access.
          </p>

          {#if adminClaimStatus === 'success'}
            <div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Admin privileges granted. Restart or re-login for full effect.
            </div>
          {/if}

          {#if adminClaimStatus === 'error'}
            <div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {adminClaimError}
            </div>
          {/if}

          <div class="flex gap-2">
            <Input
              placeholder="Paste admin token here"
              bind:value={adminToken}
              class="flex-1"
              onkeydown={(e) => { if (e.key === 'Enter') claimAdmin(); }}
            />
            <Button
              variant="primary"
              size="md"
              loading={adminClaimStatus === 'loading'}
              disabled={!adminToken.trim() || adminClaimStatus === 'loading'}
              onclick={claimAdmin}
            >
              Claim Admin
            </Button>
          </div>
        </div>

        <div class="mt-8 pt-6 border-t border-white/[0.07]">
          <h2 class="text-lg font-semibold text-danger mb-2">Danger Zone</h2>
          <p class="text-sm text-text-muted mb-3">Once you delete your account, there is no going back.</p>
          <Button variant="danger" size="sm" onclick={() => {}}>Delete Account</Button>
        </div>

      <!-- Appearance Section -->
      {:else if activeSection === 'appearance'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">Appearance</h1>
        <div class="bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/[0.07] p-6 text-center text-text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="mx-auto mb-3 opacity-30" aria-hidden="true">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>
          </svg>
          <p class="font-medium">Theme settings coming soon</p>
          <p class="text-sm mt-1">More customization options will be available in a future update.</p>
        </div>

      <!-- Voice & Audio Section -->
      {:else if activeSection === 'voice'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">Voice & Audio</h1>

        {#if audioDevicesError}
          <div class="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
            {audioDevicesError}
          </div>
        {/if}

        <!-- Microphone -->
        <div class="bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/[0.07] p-5 mb-4 space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Microphone</h2>

          <div class="flex flex-col gap-1.5">
            <label for="mic-select" class="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Input Device
            </label>
            <select
              id="mic-select"
              class="w-full rounded-xl px-3.5 py-2.5 text-sm bg-white/[0.05] backdrop-blur-sm text-text-primary border border-white/[0.07] focus:outline-none focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(92,110,240,0.15)] transition-all"
              value={voice.preferredMicrophoneId ?? ''}
              onchange={(e) => voice.setPreferredMicrophone((e.currentTarget as HTMLSelectElement).value || null)}
            >
              <option value="">System Default</option>
              {#each micDevices as device (device.deviceId)}
                <option value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              {/each}
            </select>
          </div>

          <!-- Mic level + test button -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Input Level</span>
              <Button
                variant={testingMic ? 'danger' : 'secondary'}
                size="sm"
                onclick={toggleMicTest}
              >
                {testingMic ? 'Stop Test' : 'Test Mic'}
              </Button>
            </div>
            <div class="h-2 rounded-full bg-bg-accent overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-75"
                style="width: {micTestLevel * 100}%; background: {micTestLevel > 0.7 ? '#da373c' : micTestLevel > 0.4 ? '#f0b232' : '#23a559'};"
              ></div>
            </div>
            {#if testingMic}
              <p class="text-xs text-text-muted">Speak into your microphone — you should see the level bar move.</p>
            {/if}
          </div>
        </div>

        <!-- Speaker -->
        <div class="bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/[0.07] p-5 space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Speaker / Headphones</h2>

          <div class="flex flex-col gap-1.5">
            <label for="speaker-select" class="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Output Device
            </label>
            {#if !('setSinkId' in HTMLAudioElement.prototype)}
              <p class="text-sm text-text-muted py-2">
                Output device selection requires Chrome or Edge. Firefox always uses the system default output device.
              </p>
            {:else if speakerDevices.length === 0}
              <p class="text-sm text-text-muted py-2">
                No output devices found yet — grant microphone access above first, then output devices will appear here.
              </p>
            {:else}
              <select
                id="speaker-select"
                class="w-full rounded-xl px-3.5 py-2.5 text-sm bg-white/[0.05] backdrop-blur-sm text-text-primary border border-white/[0.07] focus:outline-none focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(92,110,240,0.15)] transition-all"
                value={voice.preferredSpeakerId ?? ''}
                onchange={(e) => voice.setPreferredSpeaker((e.currentTarget as HTMLSelectElement).value || null)}
              >
                <option value="">System Default</option>
                {#each speakerDevices as device (device.deviceId)}
                  <option value={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                  </option>
                {/each}
              </select>
            {/if}
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Test Output</span>
            <Button variant="secondary" size="sm" onclick={testSpeaker}>
              Play Test Sound
            </Button>
          </div>
        </div>

      <!-- Notifications Section -->
      {:else if activeSection === 'notifications'}
        <h1 class="text-2xl font-bold text-text-primary mb-6">Notifications</h1>

        <div class="space-y-4">
          <!-- Push notifications -->
          <div class="bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/[0.07] p-4 flex items-start justify-between gap-4">
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
          <div class="bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/[0.07] p-4 flex items-start justify-between gap-4">
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

      <!-- ── Server (Tauri only) ── -->
      {#if activeSection === 'server' && showServerSection}
        <div class="space-y-4">
          <div>
            <h2 class="text-xl font-bold text-text-primary">Server Connection</h2>
            <p class="text-sm text-text-muted mt-1">The Harmony server this app connects to.</p>
          </div>

          <div class="bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/[0.07] p-4 space-y-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Current Server</p>
              <p class="text-sm font-mono text-text-primary break-all">{getServerUrl() ?? '—'}</p>
            </div>

            <div class="border-t border-divider pt-3">
              <p class="text-xs text-text-muted mb-3">
                To connect to a different server, disconnect and re-enter the server URL on the connect screen.
                You will be logged out.
              </p>
              <Button
                variant="danger"
                size="sm"
                onclick={() => {
                  auth.logout();
                  clearServerUrl();
                  goto('/connect');
                }}
              >
                Change Server
              </Button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
