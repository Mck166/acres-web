import styles from "@/components/PropertyGrid.module.css";

export default function PropertyListFallback() {
  return (
    <div className={styles.section} aria-hidden="true">
      <div className={styles.summarySkeleton} />
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.cardSkeleton} />
        ))}
      </div>
    </div>
  );
}
