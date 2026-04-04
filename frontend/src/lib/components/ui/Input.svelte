<script lang="ts">
  interface Props {
    type?: 'text' | 'password' | 'email' | 'search' | 'url' | 'number';
    placeholder?: string;
    value?: string;
    disabled?: boolean;
    error?: string;
    label?: string;
    id?: string;
    autofocus?: boolean;
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
    autofocus = false,
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
    {autofocus}
    {autocomplete}
    bind:value
    class="
      w-full rounded-xl px-3.5 py-2.5 text-sm
      bg-white/[0.05] backdrop-blur-sm
      text-text-primary placeholder:text-text-muted
      border border-white/[0.07]
      transition-all duration-150
      focus:outline-none focus:border-brand/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(92,110,240,0.15)]
      disabled:opacity-40 disabled:cursor-not-allowed
      {error ? 'border-danger/60 focus:border-danger/60 focus:shadow-[0_0_0_3px_rgba(229,62,68,0.15)]' : ''}
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
