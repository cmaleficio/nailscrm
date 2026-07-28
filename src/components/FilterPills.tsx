"use client";

type FilterPillsProps = {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
};

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "Acrílicas", label: "Acrílicas" },
  { key: "Gel", label: "Gel" },
  { key: "Nail Art", label: "Nail Art" },
];

export function FilterPills({ activeFilter, onFilterChange }: FilterPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onFilterChange(f.key)}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
            activeFilter === f.key
              ? "bg-pink-main text-gray-900"
              : "bg-gray-soft text-gray-600 hover:bg-gray-200"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
