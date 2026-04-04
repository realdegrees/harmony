<script lang="ts">
  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    options: Option[];
    selected?: string;
    onchange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    id?: string;
    class?: string;
  }

  let {
    options,
    selected = $bindable(''),
    onchange,
    placeholder = 'Select an option',
    disabled = false,
    label = '',
    id = '',
    class: className = '',
  }: Props = $props();

  let open = $state(false);
  let containerEl = $state<HTMLDivElement | null>(null);

  const selectedLabel = $derived(
    options.find((o) => o.value === selected)?.label ?? ''
  );

  function selectOption(value: string) {
    selected = value;
    open = false;
    onchange?.(value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = options.findIndex((o) => o.value === selected);
      const next = options[idx + 1];
      if (next && !next.disabled) selectOption(next.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = options.findIndex((o) => o.value === selected);
      const prev = options[idx - 1];
      if (prev && !prev.disabled) selectOption(prev.value);
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="flex flex-col gap-1.5 {className}" bind:this={containerEl}>
  {#if label}
    <label
      for={id}
      class="text-xs font-semibold uppercase tracking-wide text-text-secondary"
    >
      {label}
    </label>
  {/if}

  <div class="relative" onkeydown={handleKeydown} role="none">
    <button
      {id}
      type="button"
      {disabled}
      class="
        w-full flex items-center justify-between gap-2
        bg-bg-input text-text-primary
        rounded px-3 py-2 text-sm
        border border-transparent
        transition-colors duration-150
        hover:border-bg-hover
        focus:outline-none focus:border-brand
        disabled:opacity-50 disabled:cursor-not-allowed
        {open ? 'border-brand' : ''}
      "
      aria-haspopup="listbox"
      aria-expanded={open}
      onclick={() => { if (!disabled) open = !open; }}
    >
      <span class={selectedLabel ? 'text-text-primary' : 'text-text-muted'}>
        {selectedLabel || placeholder}
      </span>
      <svg
        class="w-4 h-4 text-text-muted shrink-0 transition-transform duration-150 {open ? 'rotate-180' : ''}"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    {#if open}
      <ul
        class="
          absolute z-50 top-full left-0 right-0 mt-1
          bg-bg-floating border border-white/5
          rounded-md shadow-2xl py-1
          max-h-60 overflow-y-auto
        "
        role="listbox"
        aria-label={label || placeholder}
      >
        {#each options as option (option.value)}
          <li
            class="
              flex items-center gap-2 px-3 py-1.5
              text-sm cursor-pointer
              transition-colors duration-100
              {option.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand hover:text-white'}
              {selected === option.value ? 'text-text-primary font-medium' : 'text-text-secondary'}
            "
            role="option"
            aria-selected={selected === option.value}
            aria-disabled={option.disabled}
            onclick={() => { if (!option.disabled) selectOption(option.value); }}
            onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !option.disabled) selectOption(option.value); }}
          >
            {#if selected === option.value}
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            {:else}
              <span class="w-3.5"></span>
            {/if}
            {option.label}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
