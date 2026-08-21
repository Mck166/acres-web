"use client";

import { useState } from "react";
import PropertyImage from "@/components/PropertyImage";
import styles from "@/components/PropertyGallery.module.css";

type PropertyGalleryProps = {
  photos: string[];
  alt: string;
};

export default function PropertyGallery({ photos, alt }: PropertyGalleryProps) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  if (photos.length === 0) {
    return <div className={styles.placeholder}>No photos available</div>;
  }

  const current = photos[index];
  const currentFailed = failed[index];

  return (
    <div className={styles.gallery}>
      <div className={styles.main}>
        {current && !currentFailed ? (
          <PropertyImage
            className={styles.mainImage}
            src={current}
            alt={`${alt}, photo ${index + 1} of ${photos.length}`}
            priority
            onError={() => setFailed((currentFailedMap) => ({ ...currentFailedMap, [index]: true }))}
          />
        ) : (
          <div className={styles.placeholder}>Photo unavailable</div>
        )}
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              className={`${styles.nav} ${styles.prev}`}
              onClick={() => setIndex((currentIndex) => (currentIndex - 1 + photos.length) % photos.length)}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.next}`}
              onClick={() => setIndex((currentIndex) => (currentIndex + 1) % photos.length)}
              aria-label="Next photo"
            >
              ›
            </button>
            <div className={styles.count}>
              {index + 1} / {photos.length}
            </div>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className={styles.thumbs} role="list">
          {photos.map((photo, photoIndex) => (
            <button
              key={`${photo}-${photoIndex}`}
              type="button"
              className={`${styles.thumb}${photoIndex === index ? ` ${styles.thumbActive}` : ""}`}
              onClick={() => setIndex(photoIndex)}
              aria-label={`Show photo ${photoIndex + 1}`}
              aria-current={photoIndex === index}
            >
              {failed[photoIndex] ? (
                <span className={styles.thumbPlaceholder} />
              ) : (
                <PropertyImage
                  className={styles.thumbImage}
                  src={photo}
                  alt=""
                  onError={() =>
                    setFailed((currentFailedMap) => ({ ...currentFailedMap, [photoIndex]: true }))
                  }
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
