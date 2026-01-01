
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";


// ============================================
// 📦 PODATKI ZA VNOS
// ============================================

// 🏪 TRGOVINE - Spremeni logo URL-je ko imas prave slike
export const STORES_DATA = [
  { name: "Spar", color: "#FDB913", logo: "", isPremium: false }, // Rumeno-rdeč
  { name: "Mercator", color: "#E31E24", logo: "", isPremium: false }, // Belo-rdeč
  { name: "Tus", color: "#1B5E20", logo: "", isPremium: false }, // Temno zelen
];

// 🛒 IZDELKI - Dodaj svoje izdelke tukaj
// Kategorije: "Mlecni izdelki", "Pijace", "Meso", "Sadje in zelenjava", "Kruh in pecivo", "Zamrznjeno", "cistila", "Osebna nega", "Prigrizki", "Osnovne zivila"
export const PRODUCTS_DATA = [
  // Mlecni izdelki
  { name: "Alpsko mleko 3.5%", category: "Mlecni izdelki", unit: "1L", imageUrl: "" },
  { name: "Jogurt Activia naravni", category: "Mlecni izdelki", unit: "150g", imageUrl: "" },
  { name: "Sir Edamec", category: "Mlecni izdelki", unit: "250g", imageUrl: "" },
  { name: "Maslo Ljubljanske mlekarne", category: "Mlecni izdelki", unit: "250g", imageUrl: "" },
  { name: "Skuta", category: "Mlecni izdelki", unit: "250g", imageUrl: "" },
  
  // Pijace
  { name: "Coca-Cola", category: "Pijace", unit: "1.5L", imageUrl: "" },
  { name: "Radenska Classic", category: "Pijace", unit: "1.5L", imageUrl: "" },
  { name: "Pomarancni sok Fructal", category: "Pijace", unit: "1L", imageUrl: "" },
  { name: "Pivo Union", category: "Pijace", unit: "0.5L", imageUrl: "" },
  { name: "Voda Zala", category: "Pijace", unit: "1.5L", imageUrl: "" },
  
  // Meso
  { name: "Piscancja prsa", category: "Meso", unit: "1kg", imageUrl: "" },
  { name: "Mleto mesano meso", category: "Meso", unit: "500g", imageUrl: "" },
  { name: "Kranjska klobasa", category: "Meso", unit: "300g", imageUrl: "" },
  { name: "Prsut", category: "Meso", unit: "100g", imageUrl: "" },
  { name: "Svinjski zrezki", category: "Meso", unit: "500g", imageUrl: "" },
  
  // Sadje in zelenjava
  { name: "Banane", category: "Sadje in zelenjava", unit: "1kg", imageUrl: "" },
  { name: "Jabolka", category: "Sadje in zelenjava", unit: "1kg", imageUrl: "" },
  { name: "Paradiznik", category: "Sadje in zelenjava", unit: "1kg", imageUrl: "" },
  { name: "Krompir", category: "Sadje in zelenjava", unit: "2kg", imageUrl: "" },
  { name: "Solata", category: "Sadje in zelenjava", unit: "1kos", imageUrl: "" },
  
  // Kruh in pecivo
  { name: "Beli kruh", category: "Kruh in pecivo", unit: "500g", imageUrl: "" },
  { name: "Polnozrnati kruh", category: "Kruh in pecivo", unit: "500g", imageUrl: "" },
  { name: "zemlje", category: "Kruh in pecivo", unit: "6kos", imageUrl: "" },
  { name: "Rogljicki", category: "Kruh in pecivo", unit: "4kos", imageUrl: "" },
  
  // Osnovne zivila
  { name: "Jajca M", category: "Osnovne zivila", unit: "10kos", imageUrl: "" },
  { name: "Moka tip 500", category: "Osnovne zivila", unit: "1kg", imageUrl: "" },
  { name: "Sladkor", category: "Osnovne zivila", unit: "1kg", imageUrl: "" },
  { name: "Olje soncnicno", category: "Osnovne zivila", unit: "1L", imageUrl: "" },
  { name: "Riz", category: "Osnovne zivila", unit: "1kg", imageUrl: "" },
  { name: "Testenine spageti", category: "Osnovne zivila", unit: "500g", imageUrl: "" },
  
  // Prigrizki
  { name: "cips Chio", category: "Prigrizki", unit: "150g", imageUrl: "" },
  { name: "cokolada Milka", category: "Prigrizki", unit: "100g", imageUrl: "" },
  { name: "Keksi Petit Beurre", category: "Prigrizki", unit: "200g", imageUrl: "" },
  
  // cistila
  { name: "Pralni prasek Persil", category: "cistila", unit: "2.5kg", imageUrl: "" },
  { name: "Detergent za posodo Jar", category: "cistila", unit: "500ml", imageUrl: "" },
  { name: "cistilo za WC Domestos", category: "cistila", unit: "750ml", imageUrl: "" },
  
  // Osebna nega
  { name: "Zobna pasta Colgate", category: "Osebna nega", unit: "75ml", imageUrl: "" },
  { name: "sampon Head & Shoulders", category: "Osebna nega", unit: "400ml", imageUrl: "" },
  { name: "Toaletni papir Paloma", category: "Osebna nega", unit: "10kos", imageUrl: "" },
];

// 💰 CENE - Tukaj vnesi prave cene za vsak izdelek v vsaki trgovini
// Format: "Ime izdelka": { "Ime trgovine": { price: cena, originalPrice?: prvotna_cena, isOnSale: true/false } }
export const PRICES_DATA: Record<string, Record<string, { price: number; originalPrice?: number; isOnSale: boolean }>> = {
  // Mlecni izdelki
  "Alpsko mleko 3.5%": {
    "Spar": { price: 1.29, isOnSale: false },
    "Mercator": { price: 1.35, isOnSale: false },
    "Tus": { price: 1.25, originalPrice: 1.39, isOnSale: true },
  },
  "Jogurt Activia naravni": {
    "Spar": { price: 0.89, isOnSale: false },
    "Mercator": { price: 0.95, isOnSale: false },
    "Tus": { price: 0.85, isOnSale: false },
  },
  "Sir Edamec": {
    "Spar": { price: 2.49, isOnSale: false },
    "Mercator": { price: 2.59, originalPrice: 2.99, isOnSale: true },
    "Tus": { price: 2.55, isOnSale: false },
  },
  "Maslo Ljubljanske mlekarne": {
    "Spar": { price: 2.99, isOnSale: false },
    "Mercator": { price: 3.15, isOnSale: false },
    "Tus": { price: 2.89, isOnSale: false },
  },
  "Skuta": {
    "Spar": { price: 1.79, isOnSale: false },
    "Mercator": { price: 1.89, isOnSale: false },
    "Tus": { price: 1.75, isOnSale: false },
  },
  
  // Pijace
  "Coca-Cola": {
    "Spar": { price: 1.89, isOnSale: false },
    "Mercator": { price: 1.95, isOnSale: false },
    "Tus": { price: 1.79, originalPrice: 2.09, isOnSale: true },
  },
  "Radenska Classic": {
    "Spar": { price: 0.99, isOnSale: false },
    "Mercator": { price: 1.05, isOnSale: false },
    "Tus": { price: 0.95, isOnSale: false },
  },
  "Pomarancni sok Fructal": {
    "Spar": { price: 2.29, originalPrice: 2.69, isOnSale: true },
    "Mercator": { price: 2.49, isOnSale: false },
    "Tus": { price: 2.35, isOnSale: false },
  },
  "Pivo Union": {
    "Spar": { price: 1.19, isOnSale: false },
    "Mercator": { price: 1.25, isOnSale: false },
    "Tus": { price: 1.15, isOnSale: false },
  },
  "Voda Zala": {
    "Spar": { price: 0.49, isOnSale: false },
    "Mercator": { price: 0.55, isOnSale: false },
    "Tus": { price: 0.45, isOnSale: false },
  },
  
  // Meso
  "Piscancja prsa": {
    "Spar": { price: 8.99, isOnSale: false },
    "Mercator": { price: 9.49, isOnSale: false },
    "Tus": { price: 8.79, originalPrice: 9.99, isOnSale: true },
  },
  "Mleto mesano meso": {
    "Spar": { price: 4.49, isOnSale: false },
    "Mercator": { price: 4.79, isOnSale: false },
    "Tus": { price: 4.39, isOnSale: false },
  },
  "Kranjska klobasa": {
    "Spar": { price: 3.99, originalPrice: 4.49, isOnSale: true },
    "Mercator": { price: 4.29, isOnSale: false },
    "Tus": { price: 4.15, isOnSale: false },
  },
  "Prsut": {
    "Spar": { price: 2.99, isOnSale: false },
    "Mercator": { price: 3.19, isOnSale: false },
    "Tus": { price: 2.89, isOnSale: false },
  },
  "Svinjski zrezki": {
    "Spar": { price: 5.99, isOnSale: false },
    "Mercator": { price: 6.29, originalPrice: 6.99, isOnSale: true },
    "Tus": { price: 5.89, isOnSale: false },
  },
  
  // Sadje in zelenjava
  "Banane": {
    "Spar": { price: 1.49, isOnSale: false },
    "Mercator": { price: 1.59, isOnSale: false },
    "Tus": { price: 1.45, isOnSale: false },
  },
  "Jabolka": {
    "Spar": { price: 1.99, originalPrice: 2.29, isOnSale: true },
    "Mercator": { price: 2.19, isOnSale: false },
    "Tus": { price: 2.09, isOnSale: false },
  },
  "Paradiznik": {
    "Spar": { price: 2.49, isOnSale: false },
    "Mercator": { price: 2.69, isOnSale: false },
    "Tus": { price: 2.39, originalPrice: 2.79, isOnSale: true },
  },
  "Krompir": {
    "Spar": { price: 1.79, isOnSale: false },
    "Mercator": { price: 1.89, isOnSale: false },
    "Tus": { price: 1.69, isOnSale: false },
  },
  "Solata": {
    "Spar": { price: 0.99, isOnSale: false },
    "Mercator": { price: 1.09, originalPrice: 1.29, isOnSale: true },
    "Tus": { price: 0.95, isOnSale: false },
  },
  
  // Kruh in pecivo
  "Beli kruh": {
    "Spar": { price: 1.29, isOnSale: false },
    "Mercator": { price: 1.39, isOnSale: false },
    "Tus": { price: 1.25, isOnSale: false },
  },
  "Polnozrnati kruh": {
    "Spar": { price: 1.79, originalPrice: 2.09, isOnSale: true },
    "Mercator": { price: 1.99, isOnSale: false },
    "Tus": { price: 1.85, isOnSale: false },
  },
  "zemlje": {
    "Spar": { price: 1.49, isOnSale: false },
    "Mercator": { price: 1.59, isOnSale: false },
    "Tus": { price: 1.45, isOnSale: false },
  },
  "Rogljicki": {
    "Spar": { price: 1.99, isOnSale: false },
    "Mercator": { price: 2.19, isOnSale: false },
    "Tus": { price: 1.89, isOnSale: false },
  },
  
  // Osnovne zivila
  "Jajca M": {
    "Spar": { price: 2.99, isOnSale: false },
    "Mercator": { price: 3.19, isOnSale: false },
    "Tus": { price: 2.89, originalPrice: 3.29, isOnSale: true },
  },
  "Moka tip 500": {
    "Spar": { price: 0.99, isOnSale: false },
    "Mercator": { price: 1.09, isOnSale: false },
    "Tus": { price: 0.95, isOnSale: false },
  },
  "Sladkor": {
    "Spar": { price: 1.29, originalPrice: 1.49, isOnSale: true },
    "Mercator": { price: 1.39, isOnSale: false },
    "Tus": { price: 1.25, isOnSale: false },
  },
  "Olje soncnicno": {
    "Spar": { price: 2.49, isOnSale: false },
    "Mercator": { price: 2.69, isOnSale: false },
    "Tus": { price: 2.39, isOnSale: false },
  },
  "Riz": {
    "Spar": { price: 1.79, isOnSale: false },
    "Mercator": { price: 1.89, isOnSale: false },
    "Tus": { price: 1.69, isOnSale: false },
  },
  "Testenine spageti": {
    "Spar": { price: 1.29, isOnSale: false },
    "Mercator": { price: 1.39, originalPrice: 1.59, isOnSale: true },
    "Tus": { price: 1.25, isOnSale: false },
  },
  
  // Prigrizki
  "cips Chio": {
    "Spar": { price: 2.49, originalPrice: 2.99, isOnSale: true },
    "Mercator": { price: 2.69, isOnSale: false },
    "Tus": { price: 2.55, isOnSale: false },
  },
  "cokolada Milka": {
    "Spar": { price: 1.49, isOnSale: false },
    "Mercator": { price: 1.59, isOnSale: false },
    "Tus": { price: 1.45, originalPrice: 1.69, isOnSale: true },
  },
  "Keksi Petit Beurre": {
    "Spar": { price: 1.79, isOnSale: false },
    "Mercator": { price: 1.89, isOnSale: false },
    "Tus": { price: 1.75, isOnSale: false },
  },
  
  // cistila
  "Pralni prasek Persil": {
    "Spar": { price: 12.99, isOnSale: false },
    "Mercator": { price: 13.49, originalPrice: 14.99, isOnSale: true },
    "Tus": { price: 12.79, isOnSale: false },
  },
  "Detergent za posodo Jar": {
    "Spar": { price: 2.99, isOnSale: false },
    "Mercator": { price: 3.19, isOnSale: false },
    "Tus": { price: 2.89, isOnSale: false },
  },
  "cistilo za WC Domestos": {
    "Spar": { price: 2.79, originalPrice: 3.19, isOnSale: true },
    "Mercator": { price: 2.99, isOnSale: false },
    "Tus": { price: 2.85, isOnSale: false },
  },
  
  // Osebna nega
  "Zobna pasta Colgate": {
    "Spar": { price: 2.49, isOnSale: false },
    "Mercator": { price: 2.69, isOnSale: false },
    "Tus": { price: 2.39, originalPrice: 2.79, isOnSale: true },
  },
  "sampon Head & Shoulders": {
    "Spar": { price: 5.99, originalPrice: 6.99, isOnSale: true },
    "Mercator": { price: 6.29, isOnSale: false },
    "Tus": { price: 5.89, isOnSale: false },
  },
  "Toaletni papir Paloma": {
    "Spar": { price: 4.99, isOnSale: false },
    "Mercator": { price: 5.29, isOnSale: false },
    "Tus": { price: 4.79, isOnSale: false },
  },
};

// 🎟️ KUPONI - Dodaj svoje kupone tukaj
export const COUPONS_DATA = [
  // Spar kuponi
  {
    storeName: "Spar",
    code: "SPAR10",
    description: "10% popust na celoten nakup nad 30€",
    couponType: "percentage_total" as const,
    discountValue: 10,
    minPurchase: 30,
    validDays: [0, 1, 2, 3, 4, 5, 6], // Vsak dan
    validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 dni
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: false,
    isPremiumOnly: false,
  },
  {
    storeName: "Spar",
    code: "SPAR25",
    description: "25% popust na en artikel",
    couponType: "percentage_single_item" as const,
    discountValue: 25,
    validDays: [4, 5, 6, 0], // cetrtek do nedelja
    validUntil: Date.now() + 14 * 24 * 60 * 60 * 1000,
    excludeSaleItems: true,
    requiresLoyaltyCard: false,
    canCombine: true,
    isPremiumOnly: false,
  },
  
  // Mercator kuponi
  {
    storeName: "Mercator",
    code: "MERC10",
    description: "10% popust na celoten nakup nad 30€ (zahteva M kartico)",
    couponType: "percentage_total" as const,
    discountValue: 10,
    minPurchase: 30,
    validDays: [0, 1, 2, 3, 4, 5, 6],
    validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
    excludeSaleItems: false,
    requiresLoyaltyCard: true,
    canCombine: false,
    isPremiumOnly: false,
  },
  {
    storeName: "Mercator",
    code: "MERCVIKEND",
    description: "20% popust na najdrazji artikel (petek in sobota)",
    couponType: "percentage_single_item" as const,
    discountValue: 20,
    validDays: [5, 6], // Petek in sobota
    validUntil: Date.now() + 14 * 24 * 60 * 60 * 1000,
    excludeSaleItems: true,
    requiresLoyaltyCard: true,
    canCombine: true,
    isPremiumOnly: false,
  },
  
  // Tus kuponi
  {
    storeName: "Tus",
    code: "TUS10",
    description: "10% popust na celoten nakup nad 25€",
    couponType: "percentage_total" as const,
    discountValue: 10,
    minPurchase: 25,
    validDays: [0, 1, 2, 3, 4, 5, 6],
    validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: false,
    isPremiumOnly: false,
  },
  {
    storeName: "Tus",
    code: "TUSMLEKO",
    description: "15% popust na mlecne izdelke",
    couponType: "category_discount" as const,
    discountValue: 15,
    validDays: [0, 1, 2, 3, 4, 5, 6],
    validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: true,
    applicableCategories: ["Mlecni izdelki"],
    isPremiumOnly: false,
  },
  
  // Premium kuponi
  {
    storeName: "Spar",
    code: "PREMIUM15",
    description: "15% popust za premium uporabnike",
    couponType: "percentage_total" as const,
    discountValue: 15,
    minPurchase: 20,
    validDays: [0, 1, 2, 3, 4, 5, 6],
    validUntil: Date.now() + 60 * 24 * 60 * 60 * 1000,
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: false,
    isPremiumOnly: true,
  },
  {
    storeName: "Mercator",
    code: "PREMIUM15",
    description: "15% popust za premium uporabnike",
    couponType: "percentage_total" as const,
    discountValue: 15,
    minPurchase: 20,
    validDays: [0, 1, 2, 3, 4, 5, 6],
    validUntil: Date.now() + 60 * 24 * 60 * 60 * 1000,
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: false,
    isPremiumOnly: true,
  },
  {
    storeName: "Tus",
    code: "PREMIUM15",
    description: "15% popust za premium uporabnike",
    couponType: "percentage_total" as const,
    discountValue: 15,
    minPurchase: 20,
    validDays: [0, 1, 2, 3, 4, 5, 6],
    validUntil: Date.now() + 60 * 24 * 60 * 60 * 1000,
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: false,
    isPremiumOnly: true,
  },
];

// ============================================
// 🚀 FUNKCIJA ZA VNOS PODATKOV
// ============================================

export const seedDatabase = internalAction({
  args: {},
  returns: v.object({
    stores: v.number(),
    products: v.number(),
    prices: v.number(),
    coupons: v.number(),
  }),
  handler: async (ctx): Promise<{ stores: number; products: number; prices: number; coupons: number }> => {
    // Najprej pocisti obstojece podatke
    await ctx.runMutation(internal.seedHelpers.clearAllData);
    
    // Vnesi trgovine
    const storeIds = await ctx.runMutation(internal.seedHelpers.insertStores, {
      stores: STORES_DATA,
    });
    
    // Vnesi izdelke
    const productIds = await ctx.runMutation(internal.seedHelpers.insertProducts, {
      products: PRODUCTS_DATA,
    });
    
    // Vnesi cene
    const pricesCount: number = await ctx.runMutation(internal.seedHelpers.insertPrices, {
      pricesData: PRICES_DATA,
      storeIds,
      productIds,
    });
    
    // Vnesi kupone
    const couponsCount: number = await ctx.runMutation(internal.seedHelpers.insertCoupons, {
      coupons: COUPONS_DATA,
      storeIds,
    });
    
    return {
      stores: storeIds.length,
      products: productIds.length,
      prices: pricesCount,
      coupons: couponsCount,
    };
  },
});

