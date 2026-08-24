import type { Metadata } from "next";
import PropertyMap from "@/components/PropertyMap";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Explore Nova Scotia listings on a map. Zoom in to see property lots outlined in blue for homes that are for sale and red for homes that have recently sold, with price pins on anything listed or updated in the last 24 hours (excluding recently sold properties).",
};

export default function MapPage() {
  return <PropertyMap />;
}
