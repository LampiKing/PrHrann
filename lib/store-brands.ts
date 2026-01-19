/**
 * Store Brand Utilities
 * Centralizirane konstante in funkcije za prikaz trgovin
 */

export type BrandAccent = {
  color: string;
  position?: "left" | "right";
  width?: number;
};

export type BrandRing = {
  color: string;
  width?: number;
};

export type BrandLogo = "mercator";

export type StoreBrand = {
  bg: string;
  border: string;
  text: string;
  accent?: BrandAccent;
  ring?: BrandRing;
  cornerIcon?: {
    char: string;
    color: string;
    top: number;
    left: number;
    fontSize: number;
  };
  logo?: BrandLogo;
};

/**
 * Barvne sheme za vse trgovine
 */
export const STORE_BRANDS: Record<string, StoreBrand> = {
  mercator: {
    bg: "#003b7b",
    border: "#002d5f",
    text: "#fff",
    logo: "mercator",
  },
  spar: {
    bg: "#c8102e",
    border: "#a70e27",
    text: "#fff",
  },
  tus: {
    bg: "#0d8a3c",
    border: "#0b6e30",
    text: "#fff",
    cornerIcon: { char: "%", color: "#facc15", top: 2, left: 20, fontSize: 9 },
  },
  hofer: {
    bg: "#0b3d7a",
    border: "#0b3d7a",
    text: "#fff",
    ring: { color: "#fbbf24", width: 1.2 },
  },
  lidl: {
    bg: "#0047ba",
    border: "#0047ba",
    text: "#fff",
  },
  jager: {
    bg: "#1f8a3c",
    border: "#b91c1c",
    text: "#fff",
    accent: { color: "#b91c1c", position: "left", width: 4 },
  },
  eurospin: {
    bg: "#003399",
    border: "#002266",
    text: "#fff",
  },
};

/**
 * Normalizira ime trgovine za lookup v STORE_BRANDS
 */
export const normalizeStoreKey = (name?: string): string =>
  (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/**
 * Dovoljene trgovine za prikaz (samo te s primerjavo cen)
 */
export const ALLOWED_STORE_KEYS = new Set(["spar", "mercator", "tus"]);

/**
 * Vrstni red prikaza trgovin
 */
export const STORE_DISPLAY_ORDER = [
  { key: "spar", label: "Spar" },
  { key: "mercator", label: "Mercator" },
  { key: "tus", label: "Tuš" },
] as const;

/**
 * Vrne brand podatke za trgovino
 */
export const getStoreBrand = (
  name?: string,
  fallbackColor?: string
): StoreBrand => {
  const key = normalizeStoreKey(name);
  const brand = STORE_BRANDS[key];
  if (brand) return brand;

  const color = fallbackColor || "#8b5cf6";
  return { bg: color, border: color, text: "#fff" };
};

/**
 * Preveri ali je trgovina dovoljena za prikaz
 */
export const isAllowedStoreName = (name?: string): boolean => {
  if (!name) return false;
  return ALLOWED_STORE_KEYS.has(normalizeStoreKey(name));
};

/**
 * Normalizira ključ za rezultate iskanja
 */
export const normalizeResultKey = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
