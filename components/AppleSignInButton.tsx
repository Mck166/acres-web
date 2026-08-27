"use client";

type AppleSignInButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export default function AppleSignInButton({
  onClick,
  loading = false,
  disabled = false,
  label = "Continue with Apple",
  className,
}: AppleSignInButtonProps) {
  const isInactive = disabled || loading;

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={isInactive}
      aria-label={label}
      aria-busy={loading}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="19"
        viewBox="0 0 16 19"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M13.31 10.05c-.02-2.13 1.74-3.15 1.82-3.2-1-1.46-2.55-1.66-3.1-1.68-1.32-.13-2.58.78-3.25.78-.67 0-1.71-.76-2.81-.74-1.45.02-2.78.84-3.53 2.14-1.5 2.61-.38 6.47 1.08 8.58.72 1.03 1.57 2.19 2.69 2.15 1.08-.04 1.49-.7 2.8-.7 1.31 0 1.68.7 2.82.68 1.17-.02 1.9-1.05 2.61-2.09.82-1.2 1.16-2.36 1.18-2.42-.03-.01-2.26-.87-2.31-3.5zM11.04 3.44c.6-.72 1-1.73.89-2.73-.86.03-1.89.57-2.51 1.3-.55.64-1.04 1.67-.91 2.65 1.02.08 2.06-.52 2.53-1.22z"
        />
      </svg>
      {loading ? "Continuing…" : label}
    </button>
  );
}
