"use client";

import { FormEvent, useState } from "react";
import type { MapSearchFilters } from "@/lib/api";
import styles from "@/components/PropertyMap.module.css";

const EMPTY_FILTERS = {
  minPrice: "",
  maxPrice: "",
  minBeds: "",
  maxBeds: "",
  minBaths: "",
  maxBaths: "",
  minSqft: "",
  maxSqft: "",
};

const FILTER_GROUPS: {
  label: string;
  min: keyof typeof EMPTY_FILTERS;
  max: keyof typeof EMPTY_FILTERS;
  minPlaceholder: string;
  maxPlaceholder: string;
}[] = [
  { label: "Price", min: "minPrice", max: "maxPrice", minPlaceholder: "Min", maxPlaceholder: "Max" },
  { label: "Beds", min: "minBeds", max: "maxBeds", minPlaceholder: "Min", maxPlaceholder: "Max" },
  { label: "Baths", min: "minBaths", max: "maxBaths", minPlaceholder: "Min", maxPlaceholder: "Max" },
  { label: "Sqft", min: "minSqft", max: "maxSqft", minPlaceholder: "Min", maxPlaceholder: "Max" },
];

function toNumber(value: string): number | null {
  const cleaned = String(value).replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasAnyFilter(filters: typeof EMPTY_FILTERS) {
  return Object.values(filters).some((value) => value.trim());
}

type MapSearchPanelProps = {
  open: boolean;
  searching: boolean;
  active: boolean;
  empty: boolean;
  resultCount: number;
  onToggle: () => void;
  onClose: () => void;
  onSearch: (query: { q: string; filters: MapSearchFilters }) => void;
  onClear: () => void;
};

export default function MapSearchPanel({
  open,
  searching,
  active,
  empty,
  resultCount,
  onToggle,
  onClose,
  onSearch,
  onClear,
}: MapSearchPanelProps) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const term = q.trim();
    if (!term && !hasAnyFilter(filters)) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
    onSearch({
      q: term,
      filters: {
        minPrice: toNumber(filters.minPrice),
        maxPrice: toNumber(filters.maxPrice),
        minBeds: toNumber(filters.minBeds),
        maxBeds: toNumber(filters.maxBeds),
        minBaths: toNumber(filters.minBaths),
        maxBaths: toNumber(filters.maxBaths),
        minSqft: toNumber(filters.minSqft),
        maxSqft: toNumber(filters.maxSqft),
      },
    });
  };

  const handleClear = () => {
    setQ("");
    setFilters(EMPTY_FILTERS);
    onClear();
  };

  const chipLabel = empty
    ? "No matching listings"
    : `${resultCount} listing${resultCount === 1 ? "" : "s"}`;

  return (
    <div className={styles.searchDock}>
      <button
        type="button"
        className={`${styles.searchButton} ${open || active ? styles.searchButtonOpen : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="map-search-panel"
        aria-label={open ? "Close search" : "Search listings"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>Search</span>
      </button>

      {active ? (
        <button type="button" className={styles.searchChip} onClick={handleClear}>
          {chipLabel} · Clear
        </button>
      ) : null}

      {open ? (
        <form id="map-search-panel" className={styles.searchPanel} onSubmit={handleSubmit}>
          <label className={styles.searchField}>
            <span>Find a listing</span>
            <input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="PID, address, or city"
              autoComplete="off"
              autoFocus
            />
          </label>

          <div className={styles.searchFilters}>
            {FILTER_GROUPS.map((group) => (
              <div key={group.label} className={styles.searchFilterGroup}>
                <span>{group.label}</span>
                <div className={styles.searchFilterPair}>
                  <input
                    inputMode="numeric"
                    value={filters[group.min]}
                    onChange={(event) => setFilter(group.min, event.target.value)}
                    placeholder={group.minPlaceholder}
                    aria-label={`${group.label} minimum`}
                  />
                  <input
                    inputMode="numeric"
                    value={filters[group.max]}
                    onChange={(event) => setFilter(group.max, event.target.value)}
                    placeholder={group.maxPlaceholder}
                    aria-label={`${group.label} maximum`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.searchActions}>
            <button type="submit" className={styles.searchSubmit} disabled={searching}>
              {searching ? "Searching…" : "Show on map"}
            </button>
            {active ? (
              <button type="button" className={styles.searchReset} onClick={handleClear}>
                Clear
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
