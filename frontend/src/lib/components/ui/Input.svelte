<script lang="ts">
  interface Props {
    type?: 'text' | 'password' | 'email' | 'search' | 'url' | 'number';
    placeholder?: string;
    value?: string;
    disabled?: boolean;
    error?: string;
    label?: string;
    id?: string;
    autocomplete?: import('svelte/elements').HTMLInputAttributes['autocomplete'];
    class?: string;
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onchange?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onkeydown?: (e: KeyboardEvent) => void;
  }

  let {
    type = 'text',
    placeholder = '',
    value = $bindable(''),
    disabled = false,
    error = '',
    label = '',
    id = '',
    autocomplete = 'off',
    class: className = '',
    oninput,
    onchange,
    onkeydown,
  }: Props = $props();
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#if label}
    <label
      for={id}
      class="text-xs font-semibold uppercase tracking-wide text-text-secondary"
    >
      {label}
    </label>
  {/if}

  <input
    {id}
    {type}
    {placeholder}
    {disabled}
    {autocomplete}
    bind:value
    class="
      w-full rounded px-3 py-2 text-sm
      bg-bg-input text-text-primary placeholder:text-text-muted
      border border-transparent
      transition-colors duration-150
      focus:outline-none focus:border-brand focus:ring-0
      disabled:opacity-50 disabled:cursor-not-allowed
      {error ? 'border-danger focus:border-danger' : ''}
    "
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error && id ? `${id}-error` : undefined}
    {oninput}
    {onchange}
    {onkeydown}
  />

  {#if error}
    <p id="{id}-error" class="text-xs text-danger" role="alert">{error}</p>
  {/if}
</div>
