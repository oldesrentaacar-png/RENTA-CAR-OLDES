import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export function Textarea({
  label,
  error,
  className,
  id,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name;
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={textareaId} className="block text-sm font-medium text-zinc-700">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        className={cn(
          "min-h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
          error && "border-red-500",
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
