<script lang="ts">
  import Button from './Button.svelte';
  import Input from './Input.svelte';

  interface Props {
    open: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    confirmLabel?: string;
    initialValue?: string;
    onconfirm: (value: string) => void;
    oncancel: () => void;
  }

  let {
    open,
    title,
    description = '',
    placeholder = '',
    confirmLabel = 'Create',
    initialValue = '',
    onconfirm,
    oncancel,
  }: Props = $props();

  let value = $state('');
  let errorMessage = $state('');

  // Reset value and error whenever the modal opens
  $effect(() => {
    if (open) { value = initialValue; errorMessage = ''; }
  });

  export function setError(msg: string) {
    errorMessage = msg;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); oncancel(); }
  }

  function handleConfirm() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onconfirm(trimmed);
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) oncancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center p-4"
    onclick={handleBackdrop}
  >
    <div class="absolute inset-0 bg-black/60 backdrop-blur-md"></div>

    <div
      class="relative z-10 w-full max-w-sm rounded-2xl
             bg-white/[0.07] backdrop-blur-2xl
             border border-white/[0.10]
             shadow-[0_32px_80px_rgba(0,0,0,0.6)]
             flex flex-col gap-5 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-modal-title"
    >
      <div class="flex flex-col gap-1">
        <h2 id="prompt-modal-title" class="text-lg font-bold text-text-primary">{title}</h2>
        {#if description}
          <p class="text-sm text-text-muted">{description}</p>
        {/if}
      </div>

      <Input
        {placeholder}
        bind:value
        autofocus
        error={errorMessage}
        onkeydown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
      />

      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onclick={oncancel}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!value.trim()}
          onclick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </div>
{/if}
