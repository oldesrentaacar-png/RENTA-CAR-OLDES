import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterBar, FilterField } from "@/components/shared/filter-bar";

type ListFiltersProps = {
  q?: string;
  status?: string;
  published?: string;
  statusOptions?: Array<{ value: string; label: string }>;
  showPublished?: boolean;
  searchPlaceholder?: string;
};

export function ListFilters({
  q = "",
  status = "",
  published = "",
  statusOptions = [],
  showPublished = false,
  searchPlaceholder = "Buscar…",
}: ListFiltersProps) {
  return (
    <FilterBar>
      <FilterField label="Buscar" className="min-w-[200px] flex-[2]">
        <Input name="q" defaultValue={q} placeholder={searchPlaceholder} />
      </FilterField>
      {statusOptions.length > 0 ? (
        <FilterField label="Estado">
          <Select
            name="status"
            defaultValue={status}
            options={[{ value: "", label: "Todos" }, ...statusOptions]}
          />
        </FilterField>
      ) : null}
      {showPublished ? (
        <FilterField label="Publicado web">
          <Select
            name="published"
            defaultValue={published}
            options={[
              { value: "", label: "Todos" },
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ]}
          />
        </FilterField>
      ) : null}
      <div className="flex items-end">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Filtrar
        </button>
      </div>
    </FilterBar>
  );
}
