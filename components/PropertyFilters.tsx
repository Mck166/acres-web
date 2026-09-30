"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  BATH_PRESETS,
  BED_PRESETS,
  PRICE_PRESETS,
  SORT_OPTIONS,
  activeFilterSummary,
  browseFiltersActive,
  type PropertyBrowseFilters,
  type PropertySort,
} from "@/lib/propertyBrowse";
import styles from "@/components/PropertyFilters.module.css";

type PropertyFiltersProps = {
  filters: PropertyBrowseFilters;
  resultLabel: string;
  searching?: boolean;
  onChange: (next: PropertyBrowseFilters) => void;
  onClear: () => void;
};

export default function PropertyFilters({
  filters,
  resultLabel,
  searching = false,
  onChange,
  onClear,
}: PropertyFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const active = browseFiltersActive(filters);
  const summary = activeFilterSummary(filters);

  const readQuery = () => {
    const field = formRef.current?.elements.namedItem("q");
    if (field && field instanceof HTMLInputElement) return field.value.trim();
    return filters.q.trim();
  };

  const setPrice = (minPrice: number | null, maxPrice: number | null) => {
    onChange({ ...filters, q: readQuery(), minPrice, maxPrice });
  };

  return (
    <div className={styles.wrap}>
      <form
        ref={formRef}
        className={styles.panel}
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ ...filters, q: readQuery() });
        }}
      >
        <label className={styles.search}>
          <span className="sr-only">Search by city, address, or PID</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            key={filters.q}
            placeholder="City, address, or PID"
            autoComplete="off"
          />
          <button type="submit" className={styles.searchSubmit}>
            Search
          </button>
        </label>

        <div className={styles.groups} role="group" aria-label="Listing filters">
          <div className={styles.group}>
            <p className={styles.groupLabel}>Price</p>
            <div className={styles.chips}>
              {PRICE_PRESETS.map((preset) => {
                const selected =
                  filters.minPrice === preset.minPrice && filters.maxPrice === preset.maxPrice;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.chip}${selected ? ` ${styles.chipActive}` : ""}`}
                    aria-pressed={selected}
                    onClick={() => setPrice(preset.minPrice, preset.maxPrice)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Beds</p>
            <div className={styles.chips}>
              {BED_PRESETS.map((preset) => {
                const selected = filters.minBeds === preset.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.chip}${selected ? ` ${styles.chipActive}` : ""}`}
                    aria-pressed={selected}
                    onClick={() => onChange({ ...filters, q: readQuery(), minBeds: preset.value })}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Baths</p>
            <div className={styles.chips}>
              {BATH_PRESETS.map((preset) => {
                const selected = filters.minBaths === preset.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.chip}${selected ? ` ${styles.chipActive}` : ""}`}
                    aria-pressed={selected}
                    onClick={() => onChange({ ...filters, q: readQuery(), minBaths: preset.value })}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </form>

      <div className={styles.toolbar}>
        <div className={styles.meta}>
          <p className={styles.count} aria-live="polite">
            {searching ? "Searching…" : resultLabel}
          </p>
          {summary.length > 0 ? (
            <p className={styles.summary}>{summary.join(" · ")}</p>
          ) : (
            <p className={styles.summary}>All current listings</p>
          )}
        </div>

        <div className={styles.toolbarActions}>
          <label className={styles.sort}>
            <span>Sort</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                onChange({ ...filters, q: readQuery(), sort: event.target.value as PropertySort })
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Link href="/map" className={styles.mapLink}>
            Map view
          </Link>

          {active ? (
            <button type="button" className={styles.clear} onClick={onClear}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
