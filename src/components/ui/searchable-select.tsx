"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Extra text used only for filtering (phone, plate, code, etc.). */
  searchText?: string;
  /** Bold first line (e.g. plate). Falls back to label. */
  primary?: string;
  /** Second line for tablet readability (e.g. brand model year). */
  secondary?: string;
};

type SearchableSelectProps = {
  label?: string;
  name?: string;
  options: SearchableSelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  onChange?: (value: string) => void;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function SearchableSelect({
  label,
  name,
  options,
  value,
  defaultValue = "",
  placeholder = "Seleccionar…",
  searchPlaceholder = "Escriba para buscar…",
  emptyMessage = "Sin coincidencias",
  error,
  required,
  disabled,
  className,
  id,
  onChange,
}: SearchableSelectProps) {
  const generatedId = useId();
  const selectId = id ?? name ?? generatedId;
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = isControlled ? value : internalValue;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue) ?? null,
    [options, selectedValue],
  );

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = normalize(
        `${option.label} ${option.primary ?? ""} ${option.secondary ?? ""} ${option.searchText ?? ""} ${option.value}`,
      );
      return haystack.includes(needle);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightIndex(0);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setHighlightIndex((index) =>
      filtered.length === 0 ? 0 : Math.min(index, filtered.length - 1),
    );
  }, [filtered.length]);

  function commit(next: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((index) =>
        filtered.length === 0 ? 0 : Math.min(index + 1, filtered.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlightIndex];
      if (option) commit(option.value);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative space-y-1", className)}>
      {label ? (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-zinc-700"
        >
          {label}
        </label>
      ) : null}

      {name ? (
        <select
          name={name}
          required={required}
          value={selectedValue}
          onChange={() => {
            /* value is driven by the searchable UI */
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
        >
          <option value="" />
          {options
            .filter((option) => option.value !== "")
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
      ) : null}

      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm text-zinc-900 outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-red-500"
            : "border-zinc-300 hover:border-zinc-400 focus:border-zinc-500",
        )}
      >
        <span className="min-w-0 flex-1">
          {selectedOption ? (
            selectedOption.primary || selectedOption.secondary ? (
              <span className="block leading-snug">
                <span className="block font-semibold text-zinc-900">
                  {selectedOption.primary || selectedOption.label}
                </span>
                {selectedOption.secondary ? (
                  <span className="mt-0.5 block text-xs text-zinc-600 sm:text-sm">
                    {selectedOption.secondary}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="block whitespace-normal break-words leading-snug">
                {selectedOption.label}
              </span>
            )
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selectedValue ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpiar selección"
              className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              onClick={(event) => {
                event.stopPropagation();
                if (disabled) return;
                commit("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronsUpDown className="h-4 w-4 text-zinc-400" />
        </span>
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              aria-autocomplete="list"
              aria-controls={listboxId}
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            className="max-h-60 overflow-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">{emptyMessage}</li>
            ) : (
              filtered.map((option, index) => {
                const selected = option.value === selectedValue;
                const highlighted = index === highlightIndex;
                return (
                  <li key={option.value || `__empty-${index}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm",
                        highlighted && "bg-zinc-100",
                        selected && "font-medium text-brand",
                        !highlighted && "hover:bg-zinc-50",
                      )}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onClick={() => commit(option.value)}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {option.primary || option.secondary ? (
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="block font-semibold">
                            {option.primary || option.label}
                          </span>
                          {option.secondary ? (
                            <span className="mt-0.5 block text-xs text-zinc-600">
                              {option.secondary}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="min-w-0 flex-1 whitespace-normal break-words">
                          {option.label}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">
            {filtered.length} de {options.length}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
