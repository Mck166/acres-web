import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPropertyById } from "@/lib/api";
import {
  field,
  formatBathLabel,
  formatBedLabel,
  formatDetailValue,
  getBaths,
  getBeds,
  getLivingArea,
  getPropertyAddress,
  getPropertyPhotos,
  getPropertyPrice,
} from "@/lib/properties";
import PropertyFavoriteButton from "@/components/PropertyFavoriteButton";
import PropertyGallery from "@/components/PropertyGallery";
import { SITE_NAME } from "@/lib/site";
import styles from "./page.module.css";

type PropertyPageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 60;

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params;
  const property = await fetchPropertyById(decodeURIComponent(id));
  if (!property) {
    return { title: "Property not found" };
  }

  const address = getPropertyAddress(property);
  const price = getPropertyPrice(property);
  const photos = getPropertyPhotos(property);
  const description = `${address} listed at ${price} on ${SITE_NAME}.`;

  return {
    title: address,
    description,
    openGraph: {
      type: "article",
      title: `${address} | ${SITE_NAME}`,
      description,
      images: photos[0] ? [{ url: photos[0], alt: address }] : undefined,
    },
  };
}

function DetailSection({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: unknown; suffix?: string }[];
}) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <div className={styles.row} key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {formatDetailValue(row.value)}
              {row.suffix && formatDetailValue(row.value) !== "Not specified" ? row.suffix : ""}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params;
  const property = await fetchPropertyById(decodeURIComponent(id));
  if (!property) notFound();

  const address = getPropertyAddress(property);
  const price = getPropertyPrice(property);
  const photos = getPropertyPhotos(property);
  const beds = getBeds(property);
  const baths = getBaths(property);
  const livingArea = getLivingArea(property);
  const listingUrl = field(property, "url");
  const listedAt = property.date_added
    ? new Date(String(property.date_added)).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <article className={styles.page}>
      <Link href="/properties" className={styles.back}>
        Back to listings
      </Link>

      <div className={styles.layout}>
        <PropertyGallery photos={photos} alt={address} />

        <header className={styles.header}>
          <div>
            <h1>{price}</h1>
            <p className={styles.address}>{address}</p>
            <div className={styles.badges}>
              {beds ? <span className={styles.badge}>{formatBedLabel(beds)}</span> : null}
              {baths ? <span className={styles.badge}>{formatBathLabel(baths)}</span> : null}
              {livingArea ? <span className={styles.badge}>{livingArea}</span> : null}
            </div>
          </div>
          <PropertyFavoriteButton property={property} />
        </header>

        <div className={styles.sections}>
          <DetailSection
            title="Property Details"
            rows={[
              { label: "Property ID", value: field(property, "PID") },
              { label: "Type", value: field(property, "TYPE") },
              { label: "Building Style", value: field(property, "BUILDING STYLE") },
              { label: "Building Dimensions", value: field(property, "BUILDING DIMENSIONS") },
              { label: "Age", value: field(property, "AGE"), suffix: " years" },
              { label: "Total Living Area", value: field(property, "TOTAL LIVING AREA", "MAIN LIVING AREA") },
              { label: "Lot Dimensions", value: field(property, "LOT DIMENSIONS") },
              { label: "Lot Fees", value: field(property, "LOT FEES") },
            ]}
          />

          <DetailSection
            title="Building Features"
            rows={[
              { label: "Roof", value: field(property, "ROOF") },
              { label: "Exterior", value: field(property, "EXTERIOR") },
              { label: "Foundation", value: field(property, "FOUNDATION") },
              { label: "Basement", value: field(property, "BASEMENT") },
              { label: "Flooring", value: field(property, "FLOORING") },
              { label: "Heating/Cooling", value: field(property, "HEATING/COOLING") },
              { label: "Fuel Supply", value: field(property, "FUEL SUPPLY") },
            ]}
          />

          <DetailSection
            title="Utilities & Services"
            rows={[
              { label: "Drinking Water", value: field(property, "DRINKING WATER") },
              { label: "Sewer", value: field(property, "SEWER") },
              { label: "Utilities", value: field(property, "UTILITIES") },
            ]}
          />

          <DetailSection
            title="Parking & Features"
            rows={[
              { label: "Has Garage", value: field(property, "HAS GARAGE") },
              { label: "Parking", value: field(property, "PARKING") },
              { label: "Waterfront", value: field(property, "WATERFRONT") },
              { label: "Land Features", value: field(property, "LAND FEATURES") },
              { label: "Property Features", value: field(property, "PROPERTY FEATURES") },
            ]}
          />

          <DetailSection
            title="Appliances & Inclusions"
            rows={[
              { label: "Appliances Included", value: field(property, "APPLIANCES INCL.") },
              { label: "Inclusions", value: field(property, "INCLUSIONS") },
              { label: "Exclusions", value: field(property, "EXCLUSIONS") },
            ]}
          />

          <section className={styles.section}>
            <h2>Additional Information</h2>
            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt>Listed By</dt>
                <dd>{formatDetailValue(field(property, "LISTED BY"))}</dd>
              </div>
              <div className={styles.row}>
                <dt>Status</dt>
                <dd>{formatDetailValue(field(property, "Status", "STATUS"))}</dd>
              </div>
              {listedAt ? (
                <div className={styles.row}>
                  <dt>Listed</dt>
                  <dd>{listedAt}</dd>
                </div>
              ) : null}
              {listingUrl ? (
                <div className={styles.row}>
                  <dt>Original listing</dt>
                  <dd>
                    <a
                      className={styles.external}
                      href={String(listingUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View source listing
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>
      </div>
    </article>
  );
}
