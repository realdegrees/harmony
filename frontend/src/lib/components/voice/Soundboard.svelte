<script lang="ts">
  import type { SoundClip } from '@harmony/shared/types/soundboard';
  import { AssetScope } from '@harmony/shared/types/emoji';
  import { api } from '$lib/api/client';
  import { ws } from '$lib/api/ws';
  import { getLocalSounds, saveLocalSound, deleteLocalSound } from '$lib/utils/local-storage';
  import { formatDuration } from '$lib/utils/format';

  interface LocalSound {
    id: string;
    name: string;
    blob: Blob;
    duration: number;
  }

  let activeTab = $state<'server' | 'my'>('server');
  let serverClips = $state<SoundClip[]>([]);
  let localSounds = $state<LocalSound[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(false);
  let isDragging = $state(false);
  let playingId = $state<string | null>(null);

  const filteredServerClips = $derived(
    serverClips.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredLocalSounds = $derived(
    localSounds.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  async function loadServerClips() {
    isLoading = true;
    try {
      const res = await api.get<SoundClip[]>('/soundboard');
      serverClips = res;
    } catch (e) {
      console.error('Failed to load soundboard clips', e);
    } finally {
      isLoading = false;
    }
  }

  async function loadLocalSounds() {
    localSounds = await getLocalSounds();
  }

  $effect(() => {
    loadServerClips();
    loadLocalSounds();
  });

  function playServerClip(clip: SoundClip) {
    playingId = clip.id;
    ws.send({ type: 'soundboard:play', data: { clipId: clip.id } });
    setTimeout(() => { if (playingId === clip.id) playingId = null; }, (clip.duration * 1000) + 500);
  }

  async function playLocalClip(sound: LocalSound) {
    playingId = sound.id;
    const url = URL.createObjectURL(sound.blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (playingId === sound.id) playingId = null;
    };

    // Also send to voice channel as base64
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      ws.send({ type: 'soundboard:play', data: { clipId: sound.id, clipData: b64 } });
    };
    reader.readAsDataURL(sound.blob);
    await audio.play();
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    await processAudioFiles(files);
  }

  async function handleFileInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    await processAudioFiles(files);
    input.value = '';
  }

  async function processAudioFiles(files: File[]) {
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue;
      const duration = await getAudioDuration(file);
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const name = file.name.replace(/\.[^.]+$/, '');
      await saveLocalSound(id, name, file, duration);
    }
    await loadLocalSounds();
  }

  function getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      };
      audio.onerror = () => resolve(0);
    });
  }

  async function deleteLocal(id: string) {
    await deleteLocalSound(id);
    await loadLocalSounds();
  }
</script>

<div class="flex flex-col h-full bg-bg-secondary">
  <!-- Header -->
  <div class="px-3 pt-3 pb-2 border-b border-divider">
    <h3 class="text-sm font-semibold text-text-primary mb-2">Soundboard</h3>

    <!-- Search -->
    <div class="relative">
      <svg
        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
      >
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <input
        type="search"
        placeholder="Search sounds..."
        bind:value={searchQuery}
        class="
          w-full pl-8 pr-3 py-1.5 rounded bg-bg-input text-sm
          text-text-primary placeholder:text-text-muted
          border border-transparent focus:border-brand focus:outline-none
        "
      />
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mt-2">
      {#each [['server', 'Server'], ['my', 'My Sounds']] as [tab, label] (tab)}
        <button
          onclick={() => activeTab = tab as 'server' | 'my'}
          class="
            px-3 py-1 rounded text-xs font-medium transition-colors
            {activeTab === tab
              ? 'bg-brand text-white'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
          "
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Content -->
  <div
    class="flex-1 overflow-y-auto p-2"
    role="region"
    aria-label="Soundboard clips"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    {#if isDragging}
      <div class="absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-brand bg-brand/10 z-10">
        <p class="text-sm font-medium text-brand">Drop audio files here</p>
      </div>
    {/if}

    {#if isLoading}
      <div class="flex items-center justify-center h-24 text-text-muted text-sm">Loading...</div>
    {:else if activeTab === 'server'}
      {#if filteredServerClips.length === 0}
        <p class="text-center text-text-muted text-sm py-8">No sounds found</p>
      {:else}
        <div class="grid grid-cols-2 gap-1.5">
          {#each filteredServerClips as clip (clip.id)}
            <button
              onclick={() => playServerClip(clip)}
              class="
                flex flex-col items-start gap-1 p-2.5 rounded bg-bg-tertiary hover:bg-bg-hover
                text-left transition-colors duration-100 group relative overflow-hidden
                {playingId === clip.id ? 'ring-2 ring-brand' : ''}
              "
            >
              <!-- Play icon -->
              <div class="flex items-center gap-1.5 w-full">
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                  class="{playingId === clip.id ? 'text-brand' : 'text-text-muted group-hover:text-text-primary'} shrink-0"
                  aria-hidden="true"
                >
                  {#if playingId === clip.id}
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                  {:else}
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  {/if}
                </svg>
                <span class="text-xs font-medium text-text-primary truncate">{clip.name}</span>
              </div>
              <span class="text-[10px] text-text-muted">{formatDuration(clip.duration)}</span>
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Upload area for local sounds -->
      <label
        class="
          flex items-center gap-2 px-3 py-2 mb-2 rounded border border-dashed border-divider
          hover:border-brand text-text-muted hover:text-brand text-xs cursor-pointer
          transition-colors duration-100
        "
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        Upload audio file
        <input
          type="file"
          accept="audio/*"
          multiple
          class="sr-only"
          onchange={handleFileInput}
        />
      </label>

      {#if filteredLocalSounds.length === 0}
        <div class="text-center py-8">
          <p class="text-text-muted text-sm">No local sounds yet</p>
          <p class="text-text-muted text-xs mt-1">Upload or drag audio files here</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-1.5">
          {#each filteredLocalSounds as sound (sound.id)}
            <div class="relative group">
              <button
                onclick={() => playLocalClip(sound)}
                class="
                  w-full flex flex-col items-start gap-1 p-2.5 rounded bg-bg-tertiary hover:bg-bg-hover
                  text-left transition-colors duration-100 overflow-hidden
                  {playingId === sound.id ? 'ring-2 ring-brand' : ''}
                "
              >
                <div class="flex items-center gap-1.5 w-full">
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                    class="{playingId === sound.id ? 'text-brand' : 'text-text-muted'} shrink-0"
                    aria-hidden="true"
                  >
                    {#if playingId === sound.id}
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                    {:else}
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    {/if}
                  </svg>
                  <span class="text-xs font-medium text-text-primary truncate">{sound.name}</span>
                </div>
                <span class="text-[10px] text-text-muted">{formatDuration(sound.duration)}</span>
              </button>
              <!-- Delete button -->
              <button
                onclick={() => deleteLocal(sound.id)}
                class="
                  absolute top-1 right-1 p-0.5 rounded
                  text-text-muted hover:text-danger hover:bg-bg-hover
                  opacity-0 group-hover:opacity-100 transition-all
                "
                aria-label="Delete {sound.name}"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>
