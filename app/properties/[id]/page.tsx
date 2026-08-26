import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fetchFeed, fetchPropertyById } from "@/lib/api";
import PropertyBackLink from "@/components/PropertyBackLink";
import PropertyFavoriteButton from "@/components/PropertyFavoriteButton";
import PropertyShareButton from "@/components/PropertyShareButton";
import PropertyGallery from "@/components/PropertyGallery";
import { SITE_NAME } from "@/lib/site";
import {
  field,
  formatBathLabel,
  formatBedLabel,
  formatDetailValue,
  formatEventDate,
  getBaths,
  getBeds,
  getLivingArea,
  getPropertyAddress,
  getPropertyDescription,
  getPropertyHref,
  getPropertyId,
  getPropertyPhotos,
  getPropertyPrice,
  getPropertyShareUrl,
} from "@/lib/properties";
import {
  getListingPhrase,
  getPropertyJsonLd,
  getPropertyLastModified,
  getPropertySeoDescription,
  getPropertySeoTitle,
  getPropertySummary,
  getPropertyTypeLabel,
  getRelatedPropertyGuides,
  parseCivicAddress,
  stringifyJsonLd,
} from "@/lib/propertySeo";
import styles from "./page.module.css";

type PropertyPageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const feed = await fetchFeed({ limit: 100, revalidate: 3600 });
    return feed.properties
      .map((property) => getPropertyId(property))
      .filter(Boolean)
      .map((id) => ({ id }));
  } catch (error) {
    console.error("Could not pre-render property pages:", error);
    return [];
  }
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params;
  const property = await fetchPropertyById(decodeURIComponent(id));
  if (!property) {
    return {
      title: "Property not found",
      robots: { index: false, follow: false },
    };
  }

  const address = getPropertyAddress(property);
  const photos = getPropertyPhotos(property);
  const title = getPropertySeoTitle(property);
  const description = getPropertySeoDescription(property);
  const href = getPropertyHref(property);
  const canonical = getPropertyShareUrl(property);
  const modified = getPropertyLastModified(property);
  const listedTime = property.listed_on ? new Date(String(property.listed_on)) : null;
  const publishedTime =
    listedTime && !Number.isNaN(listedTime.getTime()) ? listedTime.toISOString() : undefined;
  const ogImages = photos[0]
    ? [{ url: photos[0], alt: `${address} in Nova Scotia` }]
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: href,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "article",
      locale: "en_CA",
      title: `${title} | ${SITE_NAME}`,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: ogImages,
      publishedTime,
      modifiedTime: modified.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: photos[0] ? [photos[0]] : undefined,
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
  const visible = rows.filter((row) => formatDetailValue(row.value) !== "Not specified");
  if (visible.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <dl className={styles.rows}>
        {visible.map((row) => (
          <div className={styles.row} key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {formatDetailValue(row.value)}
              {row.suffix ? row.suffix : ""}
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
  const parsedAddress = parseCivicAddress(address);
  const price = getPropertyPrice(property);
  const photos = getPropertyPhotos(property);
  const beds = getBeds(property);
  const baths = getBaths(property);
  const livingArea = getLivingArea(property);
  const listingUrl = field(property, "url");
  const listedAt = formatEventDate(property.listed_on);
  const priceChangedAt = formatEventDate(property.price_changed_on);
  const pendingAt = formatEventDate(property.pending_on);
  const soldAt = formatEventDate(property.sold_on);
  const listedBy = field(property, "LISTED BY");
  const status = field(property, "Status", "STATUS");
  const propertyType = getPropertyTypeLabel(property);
  const listingPhrase = getListingPhrase(property);

  const propertyId = getPropertyId(property);
  const shareUrl = getPropertyShareUrl(property);
  const shareText = `${address} listed at ${price} on ${SITE_NAME}.`;
  const listingDescription = getPropertyDescription(property);
  const summary = getPropertySummary(property);
  const relatedGuides = getRelatedPropertyGuides(property);
  const galleryAlt = parsedAddress.city
    ? `${address} ${listingPhrase} in ${parsedAddress.city}, Nova Scotia`
    : `${address} ${listingPhrase} in Nova Scotia`;

  const extraRows = [
    listedBy ? { label: "Listed By", value: String(listedBy) } : null,
    status ? { label: "Status", value: String(status) } : null,
    listedAt ? { label: "Listed", value: listedAt } : null,
    priceChangedAt ? { label: "Price changed", value: priceChangedAt } : null,
    pendingAt ? { label: "Pending", value: pendingAt } : null,
    soldAt ? { label: "Sold", value: soldAt } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  return (
    <article className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(getPropertyJsonLd(property)) }}
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/properties">Properties</Link>
          </li>
          <li aria-current="page">{address}</li>
        </ol>
      </nav>

      <Suspense fallback={<span className={styles.back}>Back to listings</span>}>
        <PropertyBackLink propertyId={propertyId} />
      </Suspense>

      <div className={styles.layout}>
        <PropertyGallery photos={photos} alt={galleryAlt} />

        <header className={styles.header}>
          <div>
            <h1>{address}</h1>
            <p className={styles.price}>{price}</p>
            <p className={styles.listingMeta}>
              {listingPhrase.charAt(0).toUpperCase() + listingPhrase.slice(1)}
              {parsedAddress.city ? ` in ${parsedAddress.city}, Nova Scotia` : " in Nova Scotia"}
            </p>
            <div className={styles.badges}>
              {beds ? <span className={styles.badge}>{formatBedLabel(beds)}</span> : null}
              {baths ? <span className={styles.badge}>{formatBathLabel(baths)}</span> : null}
              {livingArea ? <span className={styles.badge}>{livingArea}</span> : null}
              {propertyType ? <span className={styles.badge}>{propertyType}</span> : null}
            </div>
          </div>
          <div className={styles.headerActions}>
            <PropertyShareButton url={shareUrl} title={`${address} | ${SITE_NAME}`} text={shareText} />
            <PropertyFavoriteButton property={property} />
          </div>
        </header>

        <p className={styles.summary}>{summary}</p>

        <div className={styles.sections}>
          {listingDescription ? (
            <section className={styles.section}>
              <h2>About {address}</h2>
              <p className={styles.description}>{listingDescription}</p>
            </section>
          ) : null}

          <DetailSection
            title="Property Details"
            rows={[
              { label: "Address", value: address },
              { label: "City", value: parsedAddress.city },
              { label: "Province", value: "Nova Scotia" },
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

          {extraRows.length > 0 || listingUrl ? (
            <section className={styles.section}>
              <h2>Additional Information</h2>
              <dl className={styles.rows}>
                {extraRows.map((row) => (
                  <div className={styles.row} key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
                {listingUrl ? (
                  <div className={styles.row}>
                    <dt>Original listing</dt>
                    <dd>
                      <a
                        className={styles.external}
                        href={String(listingUrl)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        View source listing
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {relatedGuides.length > 0 ? (
            <nav className={styles.related} aria-labelledby="related-guides-heading">
              <h2 id="related-guides-heading">
                {parsedAddress.city
                  ? `Buying in ${parsedAddress.city}`
                  : "Buying in Nova Scotia"}
              </h2>
              <ul>
                {relatedGuides.map((guide) => (
                  <li key={guide.href}>
                    <Link href={guide.href}>{guide.title}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </article>
  );
}
