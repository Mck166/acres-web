import type { Property } from "@/lib/api";
import { getPublishedPostBySlug } from "@/lib/blog";
import {
  field,
  formatDetailValue,
  getBaths,
  getBeds,
  getLivingArea,
  getPropertyAddress,
  getPropertyDescription,
  getPropertyPhotos,
  getPropertyPrice,
  getPropertyShareUrl,
  truncateDescription,
} from "@/lib/properties";
import { SITE_NAME, getSiteUrl } from "@/lib/site";

export type ParsedCivicAddress = {
  street: string;
  city: string | null;
  region: string;
  country: string;
  postalCode: string | null;
};

const REGION_TOKENS = new Set(["ns", "n.s.", "n.s", "nova scotia"]);
const COUNTRY_TOKENS = new Set(["ca", "canada"]);

const CITY_GUIDES: { pattern: RegExp; slug: string }[] = [
  { pattern: /\bdartmouth\b/i, slug: "dartmouth-real-estate" },
  { pattern: /\bbedford\b/i, slug: "bedford-real-estate" },
  { pattern: /\bsackville\b/i, slug: "sackville-nova-scotia-homes" },
  { pattern: /\bcole harbour\b|\beastern passage\b/i, slug: "cole-harbour-eastern-passage-homes" },
  { pattern: /\bhalifax\b/i, slug: "halifax-real-estate-guide" },
  { pattern: /\btruro\b|\bcolchester\b/i, slug: "truro-colchester-real-estate" },
  { pattern: /\bpictou\b|\bnew glasgow\b|\bstellarton\b/i, slug: "pictou-county-real-estate" },
  { pattern: /\bantigonish\b/i, slug: "antigonish-real-estate" },
  { pattern: /\byarmouth\b/i, slug: "yarmouth-southwest-nova-scotia-real-estate" },
  { pattern: /\bbaddeck\b|\bsydney\b|\bglace bay\b|\bcape breton\b/i, slug: "cape-breton-real-estate" },
  { pattern: /\blunenburg\b|\bchester\b|\bmahone\b|\bliverpool\b|\bsouth shore\b/i, slug: "south-shore-nova-scotia-homes" },
  { pattern: /\bwolfville\b|\bkentville\b|\bannapolis\b|\bgreenwood\b/i, slug: "annapolis-valley-real-estate" },
  { pattern: /\bsheet harbour\b|\bmusquodoboit\b|\beastern shore\b/i, slug: "eastern-shore-nova-scotia-real-estate" },
];

export function parseCivicAddress(address: string): ParsedCivicAddress {
  const formatted = address.replace(/\s+/g, " ").trim();
  const postalMatch = formatted.match(/\b([A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s?\d[A-CEGHJ-NPR-TV-Z]\d)\b/i);
  const postalCode = postalMatch
    ? postalMatch[1].toUpperCase().replace(/\s+/g, "").replace(/(.{3})(.{3})/, "$1 $2")
    : null;

  const parts = formatted
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s?\d[A-CEGHJ-NPR-TV-Z]\d$/i.test(part));

  if (parts.length && COUNTRY_TOKENS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  if (parts.length && REGION_TOKENS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }

  if (parts.length >= 2) {
    return {
      street: parts.slice(0, -1).join(", "),
      city: parts[parts.length - 1],
      region: "Nova Scotia",
      country: "CA",
      postalCode,
    };
  }

  return {
    street: parts[0] || formatted,
    city: null,
    region: "Nova Scotia",
    country: "CA",
    postalCode,
  };
}

export function parsePriceAmount(price: unknown): number | null {
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (price === null || price === undefined) return null;
  const digits = String(price).replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : null;
}

export function getPropertyCoordinates(property: Property): { latitude: number; longitude: number } | null {
  const latitude = Number(property.latitude);
  const longitude = Number(property.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function getPropertyTypeLabel(property: Property): string | null {
  const value = field(property, "TYPE");
  if (value === null || formatDetailValue(value) === "Not specified") return null;
  return String(value).trim();
}

export function getListingStatusKey(property: Property): string {
  return String(field(property, "Status", "STATUS") || "")
    .trim()
    .toUpperCase();
}

export function getListingPhrase(property: Property): string {
  const status = getListingStatusKey(property);
  if (status.includes("SOLD") && !status.includes("PENDING") && !status.includes("CONDITION")) {
    return "sold";
  }
  if (status.includes("PENDING") || status.includes("CONDITION")) return "pending sale";
  if (status.includes("EXPIRED") || status.includes("WITHDRAWN")) return "no longer listed";
  if (status.includes("SALE") || status.includes("ACTIVE") || status.includes("LIST")) return "for sale";
  return "listed";
}

export function getPropertySeoTitle(property: Property): string {
  const address = getPropertyAddress(property);
  if (!address || address === "Address not available") {
    return "Nova Scotia property listing";
  }

  const phrase = getListingPhrase(property);
  if (phrase === "for sale") return `${address} for sale`;
  if (phrase === "sold") return `${address} sold`;
  if (phrase === "pending sale") return `${address} pending sale`;
  return `${address} | Nova Scotia real estate`;
}

export function getPropertySummary(property: Property): string {
  const address = getPropertyAddress(property);
  const parsed = parseCivicAddress(address);
  const price = getPropertyPrice(property);
  const beds = getBeds(property);
  const baths = getBaths(property);
  const livingArea = getLivingArea(property);
  const type = getPropertyTypeLabel(property);
  const phrase = getListingPhrase(property);
  const location = parsed.city ? `${parsed.city}, Nova Scotia` : "Nova Scotia";

  const facts: string[] = [];
  if (beds) facts.push(`${beds}-bedroom`);
  if (baths) facts.push(`${baths}-bathroom`);
  if (type) facts.push(type.toLowerCase());

  const homePhrase = facts.length > 0 ? `a ${facts.join(", ")} home` : "a home";
  const areaPhrase = livingArea ? ` with ${livingArea} of living space` : "";

  return `${address} is ${homePhrase}${areaPhrase} ${phrase} at ${price} in ${location}. View photos, lot details, and listing information on ${SITE_NAME}.`;
}

export function getPropertySeoDescription(property: Property): string {
  const listingDescription = getPropertyDescription(property);
  const summary = getPropertySummary(property);
  if (!listingDescription) return truncateDescription(summary, 160);

  const address = getPropertyAddress(property);
  const price = getPropertyPrice(property);
  const combined = `${address} is ${getListingPhrase(property)} at ${price}. ${listingDescription}`;
  return truncateDescription(combined, 160);
}

export function getPropertyLastModified(property: Property): Date {
  const raw = property.date_updated || property.date_added || property.listed_on;
  if (!raw) return new Date();
  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getRelatedPropertyGuides(property: Property): { href: string; title: string }[] {
  const address = getPropertyAddress(property);
  const city = parseCivicAddress(address).city || "";
  const haystack = `${city} ${address}`;
  const guides: { href: string; title: string }[] = [];

  for (const guide of CITY_GUIDES) {
    if (!guide.pattern.test(haystack)) continue;
    const post = getPublishedPostBySlug(guide.slug);
    if (!post) continue;
    guides.push({ href: `/blog/${post.slug}`, title: post.title });
    if (guides.length >= 2) break;
  }

  return guides;
}

function residenceSchemaType(property: Property): string {
  const type = (getPropertyTypeLabel(property) || "").toLowerCase();
  if (type.includes("condo") || type.includes("apartment")) return "Apartment";
  if (type.includes("town")) return "Townhouse";
  if (type.includes("land") || type.includes("lot") || type.includes("acreage")) return "Residence";
  return "SingleFamilyResidence";
}

function offerAvailability(property: Property): string {
  const phrase = getListingPhrase(property);
  if (phrase === "sold") return "https://schema.org/SoldOut";
  if (phrase === "no longer listed") return "https://schema.org/Discontinued";
  if (phrase === "pending sale") return "https://schema.org/PreOrder";
  return "https://schema.org/InStock";
}

function isoDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function getPropertyJsonLd(property: Property) {
  const address = getPropertyAddress(property);
  const parsed = parseCivicAddress(address);
  const canonical = getPropertyShareUrl(property);
  const photos = getPropertyPhotos(property).slice(0, 8);
  const coordinates = getPropertyCoordinates(property);
  const beds = getBeds(property);
  const baths = getBaths(property);
  const livingArea = getLivingArea(property);
  const priceAmount = parsePriceAmount(property.price_value ?? getPropertyPrice(property));
  const siteUrl = getSiteUrl();
  const residenceId = `${canonical}#residence`;

  const postalAddress = {
    "@type": "PostalAddress",
    streetAddress: parsed.street,
    addressLocality: parsed.city || undefined,
    addressRegion: "NS",
    postalCode: parsed.postalCode || undefined,
    addressCountry: "CA",
  };

  const residence: Record<string, unknown> = {
    "@type": residenceSchemaType(property),
    "@id": residenceId,
    name: address,
    url: canonical,
    address: postalAddress,
  };

  if (photos.length > 0) residence.image = photos;
  if (coordinates) {
    residence.geo = {
      "@type": "GeoCoordinates",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  }
  if (beds && Number.isFinite(Number(beds))) {
    residence.numberOfBedrooms = Number(beds);
    residence.numberOfRooms = Number(beds);
  }
  if (baths && Number.isFinite(Number(baths))) {
    residence.numberOfBathroomsTotal = Number(baths);
  }
  if (livingArea) {
    const areaValue = Number(String(livingArea).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(areaValue) && areaValue > 0) {
      residence.floorSize = {
        "@type": "QuantitativeValue",
        value: areaValue,
        unitCode: "FTK",
      };
    }
  }

  const listing: Record<string, unknown> = {
    "@type": "RealEstateListing",
    name: getPropertySeoTitle(property),
    url: canonical,
    description: getPropertySeoDescription(property),
    datePosted: isoDate(property.listed_on || property.date_added),
    dateModified: isoDate(property.date_updated),
    image: photos.length > 0 ? photos : undefined,
    mainEntityOfPage: canonical,
    about: { "@id": residenceId },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
  };

  if (priceAmount !== null) {
    listing.offers = {
      "@type": "Offer",
      price: priceAmount,
      priceCurrency: "CAD",
      availability: offerAvailability(property),
      url: canonical,
      itemOffered: { "@id": residenceId },
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      listing,
      residence,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Properties",
            item: `${siteUrl}/properties`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: address,
            item: canonical,
          },
        ],
      },
    ],
  };
}

export function stringifyJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
