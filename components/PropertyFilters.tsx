"use client";

import { useEffect, useRef } from "react";
import {
  BATH_OPTIONS,
  BED_OPTIONS,
  PLACE_OPTIONS,
  PRICE_OPTIONS,
  type PropertyListFilters,
} from "@/lib/propertyFilters";
import styles from "@/components/PropertyFilters.module.css";

type PropertyFiltersProps = {
  filters: PropertyListFilters;
  resultLabel: string;
  detail: string;
  loading: boolean;
  onChange: (filters: PropertyListFilters) => void;
  onClear: () => void;
};

type ChipOption = {
  id: string;
  label: string;
};

function ChipRow({
  label,
  anyLabel,
  options,
  value,
  onSelect,
}: {
  label: string;
  anyLabel: string;
  options: ChipOption[];
  value: string | null;
  onSelect: (id: string | null) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const frame = frameRef.current;
    if (!scroller || !frame) return;

    const update = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      if (max <= 2) {
        frame.dataset.overflow = "none";
        return;
      }
      const atStart = scroller.scrollLeft <= 2;
      const atEnd = scroller.scrollLeft >= max - 2;
      if (!atStart && !atEnd) frame.dataset.overflow = "both";
      else if (atStart) frame.dataset.overflow = "end";
      else frame.dataset.overflow = "start";
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [options.length]);

  return (
    <div className={styles.group}>
      <span className={styles.label} id={`${label}-label`}>
        {label}
      </span>
      <div className={styles.frame} ref={frameRef}>
      <div className={styles.scroller} ref={scrollerRef} role="group" aria-labelledby={`${label}-label`}>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={value === null}
          onClick={() => onSelect(null)}
        >
          {anyLabel}
        </button>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.chip}
            aria-pressed={value === option.id}
            onClick={() => onSelect(value === option.id ? null : option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

export default function PropertyFilters({
  filters,
  resultLabel,
  detail,
  loading,
  onChange,
  onClear,
}: PropertyFiltersProps) {
  const active = Boolean(filters.place || filters.beds || filters.baths || filters.price);

  const setFilter = (key: keyof PropertyListFilters, id: string | null) => {
    onChange({ ...filters, [key]: id });
  };

  return (
    <section className={styles.panel} aria-label="Filter listings">
      <div className={styles.summary}>
        <div>
          <p className={styles.count} aria-live="polite">
            {loading ? "Updating listings…" : resultLabel}
          </p>
          {detail ? <p className={styles.detail}>{detail}</p> : null}
        </div>
        {active ? (
          <button type="button" className={styles.clear} onClick={onClear}>
            Clear filters
          </button>
        ) : null}
      </div>

      <ChipRow
        label="Place"
        anyLabel="Anywhere"
        options={PLACE_OPTIONS}
        value={filters.place}
        onSelect={(id) => setFilter("place", id)}
      />

      <div className={styles.rows}>
        <ChipRow
          label="Bedrooms"
          anyLabel="Any"
          options={BED_OPTIONS}
          value={filters.beds}
          onSelect={(id) => setFilter("beds", id)}
        />
        <ChipRow
          label="Bathrooms"
          anyLabel="Any"
          options={BATH_OPTIONS}
          value={filters.baths}
          onSelect={(id) => setFilter("baths", id)}
        />
        <ChipRow
          label="Price"
          anyLabel="Any"
          options={PRICE_OPTIONS}
          value={filters.price}
          onSelect={(id) => setFilter("price", id)}
        />
      </div>
    </section>
  );
}
