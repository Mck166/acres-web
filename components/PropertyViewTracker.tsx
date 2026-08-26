"use client";

import { useEffect } from "react";
import { logEvent, parsePriceValue } from "@/lib/analytics";

type PropertyViewTrackerProps = {
  itemId: string;
  itemName: string;
  price?: string | null;
};

export default function PropertyViewTracker({
  itemId,
  itemName,
  price,
}: PropertyViewTrackerProps) {
  useEffect(() => {
    if (!itemId) return;
    const value = parsePriceValue(price);
    logEvent("view_item", {
      currency: "CAD",
      ...(value != null ? { value } : {}),
      items: [
        {
          item_id: itemId,
          item_name: itemName,
          ...(value != null ? { price: value } : {}),
        },
      ],
    });
  }, [itemId, itemName, price]);

  return null;
}
