import type { StyleSpecification } from "maplibre-gl";

const LAND = "#c6e07c";
const WATER = "#6ec8e8";
const PARK = "#a8d65a";
const WOOD = "#96cc4e";
const GRASS = "#b7e06a";
const URBAN = "#f4f1ea";
const BUILDING = "#ebe6dc";
const ROAD = "#ffffff";
const ROAD_CASING = "#c5c5c5";
const HIGHWAY = "#d2d2d2";
const HIGHWAY_CASING = "#b4b4b4";
const LABEL = "#2c2c2c";
const WATER_LABEL = "#2f6f86";

const HIDDEN_LAYERS = new Set(["natural_earth", "building-3d"]);

const PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": LAND },
  water: { "fill-color": WATER },
  waterway_tunnel: { "line-color": WATER },
  waterway_river: { "line-color": WATER },
  waterway_other: { "line-color": WATER },
  park: { "fill-color": PARK, "fill-outline-color": "rgba(120, 160, 60, 0.35)" },
  landcover_wood: { "fill-color": WOOD },
  landcover_grass: { "fill-color": GRASS },
  landuse_residential: { "fill-color": URBAN },
  building: { "fill-color": BUILDING },
  waterway_line_label: { "text-color": WATER_LABEL },
  water_name_point_label: { "text-color": WATER_LABEL },
  water_name_line_label: { "text-color": WATER_LABEL },
};

const ROAD_CASINGS = [
  "tunnel_motorway_link_casing",
  "tunnel_link_casing",
  "tunnel_secondary_tertiary_casing",
  "tunnel_trunk_primary_casing",
  "tunnel_motorway_casing",
  "road_motorway_link_casing",
  "road_link_casing",
  "road_secondary_tertiary_casing",
  "road_trunk_primary_casing",
  "road_motorway_casing",
  "road_minor_casing",
  "road_service_track_casing",
  "bridge_motorway_link_casing",
  "bridge_link_casing",
  "bridge_secondary_tertiary_casing",
  "bridge_trunk_primary_casing",
  "bridge_motorway_casing",
  "bridge_street_casing",
];

const ROAD_FILLS = [
  "tunnel_motorway_link",
  "tunnel_link",
  "tunnel_secondary_tertiary",
  "tunnel_trunk_primary",
  "tunnel_motorway",
  "road_motorway_link",
  "road_link",
  "road_secondary_tertiary",
  "road_trunk_primary",
  "road_minor",
  "road_service_track",
  "bridge_motorway_link",
  "bridge_link",
  "bridge_secondary_tertiary",
  "bridge_trunk_primary",
  "bridge_motorway",
  "bridge_street",
];

const LABELS = [
  "label_other",
  "label_village",
  "label_town",
  "label_state",
  "label_city",
  "label_city_capital",
  "highway-name-path",
  "highway-name-minor",
  "highway-name-major",
];

export async function loadAcresMapStyle(): Promise<StyleSpecification> {
  const response = await fetch("https://tiles.openfreemap.org/styles/liberty");
  if (!response.ok) {
    throw new Error(`Could not load map style: ${response.status}`);
  }

  const style = (await response.json()) as StyleSpecification;
  style.layers = (style.layers || []).filter((layer) => !HIDDEN_LAYERS.has(layer.id));

  for (const layer of style.layers) {
    const overrides = PAINT[layer.id];
    if (overrides && "paint" in layer && layer.paint) {
      Object.assign(layer.paint, overrides);
    }
    if (ROAD_CASINGS.includes(layer.id) && "paint" in layer && layer.paint) {
      const highway = layer.id.includes("motorway") || layer.id.includes("trunk");
      Object.assign(layer.paint, { "line-color": highway ? HIGHWAY_CASING : ROAD_CASING });
    }
    if (ROAD_FILLS.includes(layer.id) && "paint" in layer && layer.paint) {
      const highway = layer.id.includes("motorway") || layer.id.includes("trunk");
      Object.assign(layer.paint, { "line-color": highway ? HIGHWAY : ROAD });
    }
    if (layer.id === "road_motorway" && "paint" in layer && layer.paint) {
      Object.assign(layer.paint, { "line-color": HIGHWAY });
    }
    if (LABELS.includes(layer.id) && "paint" in layer && layer.paint) {
      Object.assign(layer.paint, { "text-color": LABEL, "text-halo-color": "#ffffff" });
    }
  }

  return style;
}
