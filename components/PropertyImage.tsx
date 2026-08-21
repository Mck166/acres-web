type PropertyImageProps = {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
  priority?: boolean;
};

export default function PropertyImage({
  src,
  alt,
  className,
  onError,
  priority = false,
}: PropertyImageProps) {
  return (
    // Viewpoint and similar listing CDNs 403 when the Referer is localhost or
    // another non-allowlisted site. Skip the referrer so photos can load.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={onError}
    />
  );
}
