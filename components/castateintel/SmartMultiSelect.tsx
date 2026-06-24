"use client";
// components/castateintel/SmartMultiSelect.tsx
// Reusable multi-select filter with:
// - Record counts per option
// - Greyed-out (disabled) options with 0 available records
// - Search within long lists
// - Active pill display
// - OR within field, AND across fields

import { useState, useEffect, useRef } from "react";

export interface FilterOption {
  value: string;
  label?: string;        // display label (defaults to value)
  count: number;         // records available with current filters
  totalCount: number;    // records without any filter (for display)
}

interface SmartMultiSelectProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  colorClass?: string;   // pill color when active
}

export function SmartMultiSelect({
  label, options, selected, onChange, placeholder = "All", colorClass = "bg-indigo-100 text-indigo-700"
}: SmartMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);

  const filtered = options.filter(o =>
    (o.label || o.value).toLowerCase().includes(search.toLowerCase())
  );

  const displayText =
    selected.length === 0 ? placeholder
    : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label || selected[0])
    : `${selected.length} selected`;

  const hasActiveSelections = selected.length > 0;
  const availableCount = options.filter(o => o.count > 0 || selected.includes(o.value)).length;

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center justify-between gap-2 border rounded-xl px-3.5 py-2.5 text-sm bg-white min-w-[148px] text-left transition-all ${
            hasActiveSelections
              ? "border-indigo-400 text-indigo-700 font-semibold shadow-sm shadow-indigo-100"
              : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
        >
          <span className="truncate max-w-[160px]">{displayText}</span>
          <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-2 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-100/80 min-w-[250px] max-h-80 flex flex-col overflow-hidden">
            {options.length > 8 && (
              <div className="p-2 border-b border-slate-100 flex-shrink-0">
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 flex-shrink-0">
              <span className="text-xs text-slate-400">
                {availableCount} available · {options.length} total
              </span>
              {hasActiveSelections && (
                <button onClick={() => { onChange([]); setSearch(""); }}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                  Clear
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">No results</div>
              ) : filtered.map(opt => {
                const isSelected = selected.includes(opt.value);
                const isUnavailable = opt.count === 0 && !isSelected;
                return (
                  <button
                    key={opt.value}
                    onClick={() => !isUnavailable && toggle(opt.value)}
                    disabled={isUnavailable}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                      isUnavailable
                        ? "opacity-35 cursor-not-allowed text-slate-400"
                        : isSelected
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center text-[10px] font-bold transition-colors ${
                        isSelected ? "bg-indigo-600 border-indigo-600 text-white"
                        : isUnavailable ? "border-slate-200" : "border-slate-300"
                      }`}>
                        {isSelected ? "✓" : ""}
                      </span>
                      <span className="truncate">{opt.label || opt.value}</span>
                    </div>
                    <span className={`text-xs flex-shrink-0 font-semibold px-1.5 py-0.5 rounded-md ${
                      isSelected ? "bg-indigo-100 text-indigo-600"
                      : isUnavailable ? "text-slate-300"
                      : "bg-slate-100 text-slate-500"
                    }`}>
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper: build FilterOption arrays with counts from a dataset ───────────────
// Given a list of items and active filters (excluding this field's own filter),
// compute how many items each option value would match.

export function buildOptions<T>(
  allItems: T[],
  getField: (item: T) => string | string[],  // field to build options for
  otherFilters: ((item: T) => boolean)[],     // other active filters (AND)
  allValues: string[],                        // all possible values (for ordering)
  getLabel?: (value: string) => string
): FilterOption[] {
  // Items that pass all OTHER filters (not this field's own filter)
  const passOthers = allItems.filter(item => otherFilters.every(f => f(item)));

  return allValues.map(value => {
    const count = passOthers.filter(item => {
      const v = getField(item);
      return Array.isArray(v) ? v.includes(value) : v === value;
    }).length;
    const totalCount = allItems.filter(item => {
      const v = getField(item);
      return Array.isArray(v) ? v.includes(value) : v === value;
    }).length;
    return { value, label: getLabel ? getLabel(value) : value, count, totalCount };
  }).sort((a, b) => {
    // Selected/available first, then by count desc
    if (a.count > 0 && b.count === 0) return -1;
    if (a.count === 0 && b.count > 0) return 1;
    return b.count - a.count;
  });
}

// ── Active filter pills component ─────────────────────────────────────────────
export function FilterPills({
  groups
}: {
  groups: {
    values: string[];
    onRemove: (v: string) => void;
    getLabel?: (v: string) => string;
    colorClass: string;
    prefix?: string;
  }[]
}) {
  const allPills = groups.flatMap(g =>
    g.values.map(v => ({
      display: (g.prefix ? g.prefix + " " : "") + (g.getLabel ? g.getLabel(v) : v),
      key: g.prefix + v,
      onRemove: () => g.onRemove(v),
      colorClass: g.colorClass,
    }))
  );
  if (allPills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {allPills.map(pill => (
        <span key={pill.key}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${pill.colorClass}`}>
          {pill.display}
          <button onClick={pill.onRemove} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
        </span>
      ))}
    </div>
  );
}
