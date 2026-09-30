"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BATH_OPTIONS,
  BED_OPTIONS,
  PLACE_SHORTCUTS,
  PRICE_BANDS,
  isListingFiltered,
  parseListingQuery,
  serializeListingQuery,
  type ListingQuery,
} from "@/lib/listingBrowse";
import styles from "@/components/PropertyFilters.module.css";

export default function PropertyFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseListingQuery(searchParams);
  const queryRef = useRef(query);
  const [draftQuery, setDraftQuery] = useState(query.q);
  const debounceRef = useRef<number | null>(null);

  queryRef.current = query;

  useEffect(() => {
    setDraftQuery(query.q);
  }, [query.q]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const write = (next: ListingQuery) => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const current = serializeListingQuery(queryRef.current);
    const serialized = serializeListingQuery(next);
    if (serialized === current) return;
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
  };

  const scheduleQuery = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      write({ ...queryRef.current, q: value.trim() });
    }, 350);
  };

  const selectedPlace = PLACE_SHORTCUTS.find(
    (place) => place.toLowerCase() === query.q.toLowerCase(),
  );

  return (
    <section className={styles.panel} aria-label="Filter listings">
      <form
        role="search"
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          write({ ...queryRef.current, q: draftQuery.trim() });
        }}
      >
        <label className={styles.searchLabel}>
          <span className="sr-only">Search by city, address, or PID</span>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={draftQuery}
            maxLength={80}
            placeholder="City, address, or PID"
            autoComplete="off"
            onChange={(event) => {
              const value = event.target.value;
              setDraftQuery(value);
              scheduleQuery(value);
            }}
          />
        </label>
      </form>

      <fieldset className={styles.group}>
        <legend>Place</legend>
        <div className={styles.chips} role="group" aria-label="Popular places">
          {PLACE_SHORTCUTS.map((place) => (
            <button
              key={place}
              type="button"
              className={styles.chip}
              aria-pressed={selectedPlace === place}
              onClick={() => write({ ...query, q: selectedPlace === place ? "" : place })}
            >
              {place}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Price</legend>
        <div className={styles.chips} role="group" aria-label="Price">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={query.price === null}
            onClick={() => write({ ...query, price: null })}
          >
            Any
          </button>
          {PRICE_BANDS.map((band) => (
            <button
              key={band.id}
              type="button"
              className={styles.chip}
              aria-pressed={query.price === band.id}
              onClick={() =>
                write({ ...query, price: query.price === band.id ? null : band.id })
              }
            >
              {band.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.split}>
        <fieldset className={styles.group}>
          <legend>Beds</legend>
          <div className={styles.chips} role="group" aria-label="Bedrooms">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={query.beds === null}
              onClick={() => write({ ...query, beds: null })}
            >
              Any
            </button>
            {BED_OPTIONS.map((beds) => (
              <button
                key={beds}
                type="button"
                className={styles.chip}
                aria-pressed={query.beds === beds}
                onClick={() => write({ ...query, beds: query.beds === beds ? null : beds })}
              >
                {beds}+
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Baths</legend>
          <div className={styles.chips} role="group" aria-label="Bathrooms">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={query.baths === null}
              onClick={() => write({ ...query, baths: null })}
            >
              Any
            </button>
            {BATH_OPTIONS.map((baths) => (
              <button
                key={baths}
                type="button"
                className={styles.chip}
                aria-pressed={query.baths === baths}
                onClick={() => write({ ...query, baths: query.baths === baths ? null : baths })}
              >
                {baths}+
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {isListingFiltered(query) ? (
        <div className={styles.tools}>
          <label className={styles.sort}>
            <span>Sort</span>
            <select
              value={query.sort}
              onChange={(event) =>
                write({
                  ...query,
                  sort: event.target.value === "price-asc" || event.target.value === "price-desc"
                    ? event.target.value
                    : "suggested",
                })
              }
            >
              <option value="suggested">Suggested</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              if (debounceRef.current) window.clearTimeout(debounceRef.current);
              setDraftQuery("");
              write({ q: "", price: null, beds: null, baths: null, sort: "suggested" });
            }}
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </section>
  );
}
