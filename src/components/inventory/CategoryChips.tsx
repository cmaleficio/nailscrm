"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type CategoryChipsProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: "category" | "subcategory";
  placeholder?: string;
  disabled?: boolean;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function CategoryChips({ label, value, onChange, type, placeholder, disabled }: CategoryChipsProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    fetch("/api/inventory/items/categories")
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setSubcategories(data.subcategories ?? []);
      })
      .catch(() => {});
  }, []);

  const suggestions = type === "category" ? categories : subcategories;

  const normalizedFilter = filterText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const filteredSuggestions = suggestions.filter((s) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedFilter)
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setFilterText(newValue);
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (filterText.trim()) setShowSuggestions(true);
  };

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setFilterText(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={inputCls}
        autoComplete="off"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-pink-50 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}