# 🎟️ SPAR Tedenski Kuponi - Navodila za posodabljanje

## 📅 Kako deluje

SPAR kuponi se posodabljajo **vsak teden** na njihovi strani:
**https://www.spar.si/promocije-in-projekti/aktualne-promocije**

## 🔄 Posodabljanje kuponov

### 1. Vsako nedeljo preveri SPAR stran
- Odpri: https://www.spar.si/promocije-in-projekti/aktualne-promocije
- Poišči aktualne kupone za naslednji teden
- Zapiši si vse kupone z vsemi pogoji

### 2. Posodobi kupone v Convex Dashboard

**Odpri Convex Dashboard:**
```
https://dashboard.convex.dev/
```

**V konzoli izvedi:**
```typescript
await ctx.runMutation(api.seedCoupons.updateSparWeeklyCoupons, {});
```

To bo:
- ✅ Deaktiviralo stare kupone
- ✅ Dodalo nove kupone za trenutni teden

### 3. Ročno dodaj dodatne kupone (če potrebno)

Če SPAR ima več kuponov, dodaj jih v `convex/seedCoupons.ts` v array `newCoupons`:

```typescript
{
  storeId: sparStore._id,
  code: `SPAR-OPIS-W${currentWeek}`,
  description: "Opis kupona",
  couponType: "percentage_single_item", // ali percentage_total, fixed, category_discount
  discountValue: 25, // Procent ali €
  validFrom: weekDates.start,
  validUntil: weekDates.end,
  validDays: [1, 2, 3], // 0=ned, 1=pon, 2=tor, 3=sre, 4=čet, 5=pet, 6=sob
  requiresLoyaltyCard: true, // Ali potrebuje kartico
  maxUsesPerUser: 1, // Koliko krat lahko uporabnik uporabi
  excludedProducts: ["postreženo meso"], // Izključeni izdelki
  additionalNotes: "Dodatna opozorila",
  excludeSaleItems: false,
  canCombine: false,
  weekNumber: currentWeek,
  isActive: true,
  isPremiumOnly: false,
},
```

## 📋 Trenutni SPAR kuponi

### Teden 52/2024 (23.12 - 29.12.2024)

#### Glavni kupon: SPARPLUS-W52
- **Popust:** -25% na en izdelek po izbiri
- **Pogoji:**
  - ✅ Potrebna SPAR plus kartica
  - ✅ ENKRATNA uporaba (maxUsesPerUser: 1)
  - ✅ Velja ponedeljek-sreda (validDays: [1, 2, 3])
  - ❌ Ne velja na postreženo meso nekaterih franšiz
- **Opomba:** Kupona ni mogoče unovčiti na postreženo meso nekaterih franšiz.

#### Dodatni kuponi
_(Dodaj jih tukaj ko jih najdeš na SPAR strani)_

---

## 🔧 Tipi kuponov

### 1. `percentage_single_item` - % na en izdelek
```typescript
{
  couponType: "percentage_single_item",
  discountValue: 25, // 25%
}
```
→ Sistem avtomatsko izbere **najdražji izdelek** za maksimalni prihranek

### 2. `percentage_total` - % na celoten nakup
```typescript
{
  couponType: "percentage_total",
  discountValue: 10, // 10%
  minPurchase: 20, // Minimalni znesek
}
```

### 3. `fixed` - Fiksni popust v €
```typescript
{
  couponType: "fixed",
  discountValue: 5, // 5€ popust
  minPurchase: 40,
}
```

### 4. `category_discount` - % na kategorijo
```typescript
{
  couponType: "category_discount",
  discountValue: 20, // 20%
  applicableCategories: ["Mlečni izdelki", "Mleko", "Jogurt"],
}
```

---

## 📊 Dnevi v tednu

```
0 = Nedelja
1 = Ponedeljek
2 = Torek
3 = Sreda
4 = Četrtek
5 = Petek
6 = Sobota
```

**Primer:**
- Ponedeljek-Sreda: `validDays: [1, 2, 3]`
- Celoten teden: `validDays: [1, 2, 3, 4, 5, 6]`
- Vikend: `validDays: [0, 6]`

---

## ⚠️ Pomembne nastavitve

### `maxUsesPerUser`
Koliko krat lahko uporabnik uporabi kupon:
- `1` = ENKRAT (kot SPAR plus kupon)
- `undefined` = Neomejeno

### `requiresLoyaltyCard`
Ali zahteva loyalty kartico:
- `true` = Potrebna SPAR plus kartica
- `false` = Brez kartice

### `excludedProducts`
Array izključenih izdelkov:
```typescript
excludedProducts: ["postreženo meso", "alkohol", "tobak"]
```

### `additionalNotes`
Dodatna opozorila za uporabnika:
```typescript
additionalNotes: "Kupona ni mogoče unovčiti na postreženo meso nekaterih franšiz."
```

### `isActive`
Ali je kupon aktiven:
- `true` = Aktiven
- `false` = Deaktiviran (sistem ga ne bo prikazal)

---

## 🚀 Workflow

### Vsako nedeljo:

1. **10:00** - Preveri SPAR stran za nove kupone
2. **10:15** - Posodobi `convex/seedCoupons.ts` če so novi kuponi
3. **10:30** - Deploy Convex
   ```bash
   bunx convex dev
   ```
4. **10:35** - Izvedi update v Convex Dashboard
   ```typescript
   await ctx.runMutation(api.seedCoupons.updateSparWeeklyCoupons, {});
   ```
5. **10:40** - Preveri v aplikaciji ali so novi kuponi vidni

---

## 📝 Primer posodobitve

**SPAR stran pravi:**
> "Od ponedeljka do srede -30% na sveže sadje in zelenjavo z SPAR plus kartico"

**Dodaš v `newCoupons`:**
```typescript
{
  storeId: sparStore._id,
  code: `SPAR-SADJE-W${currentWeek}`,
  description: "-30% na sveže sadje in zelenjavo",
  couponType: "category_discount" as const,
  discountValue: 30,
  applicableCategories: ["Sadje", "Zelenjava", "Sveže sadje", "Sveža zelenjava"],
  validFrom: weekDates.start,
  validUntil: weekDates.end,
  validDays: [1, 2, 3], // Pon-Sre
  requiresLoyaltyCard: true, // SPAR plus
  weekNumber: currentWeek,
  isActive: true,
  isPremiumOnly: false,
},
```

---

## 🎯 Cilj

Vsak **ponedeljek zjutraj** naj bodo v aplikaciji že **najnovejši SPAR kuponi** za ta teden!

Uporabniki vidijo samo **AKTIVNE** kupone, ki veljajo **danes** in imajo **loyalty kartico** (če je potrebna).

---

**Vir kuponov:** https://www.spar.si/promocije-in-projekti/aktualne-promocije
**Posodobitve:** Vsako nedeljo
**Odgovoren:** Ti! 🎯
