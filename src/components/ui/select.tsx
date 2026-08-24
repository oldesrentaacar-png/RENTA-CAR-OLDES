import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
};

export function Select({
  label,
  error,
  options,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-medium text-zinc-700">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
          error && "border-red-500",
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
