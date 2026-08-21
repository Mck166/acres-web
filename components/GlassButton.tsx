import styles from "@/components/GlassButton.module.css";

type GlassButtonProps = {
  title: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
};

export default function GlassButton({
  title,
  onClick,
  loading = false,
  disabled = false,
  type = "button",
  className,
}: GlassButtonProps) {
  const isInactive = disabled || loading;

  return (
    <button
      type={type}
      className={`${styles.button}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={isInactive}
      aria-label={title}
      aria-busy={loading}
    >
      <span className={styles.background} />
      <span className={styles.overlay} />
      <span className={styles.specular} />
      <span className={styles.content}>
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : title}
      </span>
    </button>
  );
}
