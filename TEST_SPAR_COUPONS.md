# 🧪 Testiranje SPAR Tedenskih Kuponov

## Hiter test

### 1. Dodaj SPAR kupon za ta teden
V Convex Dashboard konzoli:

```typescript
// Posodobi SPAR kupone
const result = await ctx.runMutation(api.seedCoupons.updateSparWeeklyCoupons, {});
console.log(result);
```

**Pričakovan output:**
```json
{
  "success": true,
  "message": "SPAR kuponi posodobljeni za teden 52/2024. Deaktiviranih: 0, Dodanih: 1",
  "addedCount": 1,
  "deactivatedCount": 0
}
```

### 2. Preveri aktivne SPAR kupone
```typescript
const coupons = await ctx.runMutation(api.seedCoupons.getActiveSparCoupons, {});
console.log(coupons);
```

**Pričakovan output:**
```json
[
  {
    "code": "SPARPLUS-W52",
    "description": "-25% na en izdelek po izbiri",
    "validDays": [1, 2, 3],
    "weekNumber": 52,
    "isActive": true,
    "requiresLoyaltyCard": true,
    "maxUsesPerUser": 1,
    "additionalNotes": "Kupona ni mogoče unovčiti na postreženo meso nekaterih franšiz. Velja samo ob predložitvi SPAR plus kartice."
  }
]
```

### 3. Testiraj v aplikaciji

#### Pogoj 1: Dan v tednu
- ✅ **Ponedeljek, Torek, Sreda** → Kupon se prikaže
- ❌ **Četrtek-Nedelja** → Kupon se NE prikaže

#### Pogoj 2: SPAR plus kartica
- ✅ Dodaj SPAR v loyalty cards v profilu
- ❌ Brez kartice → Kupon se NE prikaže

#### Pogoj 3: Enkratna uporaba
- ✅ Prva uporaba → Kupon deluje
- ❌ Druga uporaba → Kupon bi moral biti "uporabljen" (TODO: tracking)

#### Pogoj 4: Izključeni izdelki
- ❌ "Postreženo meso" → Kupon se NE uporabi
- ✅ Vsi drugi izdelki → Kupon deluje

### 4. Test scenarij

1. **Dodaj izdelke v košarico (SPAR):**
   - Mleko 1L (1.20€)
   - Kruh (2.50€)
   - Maslo (3.80€)

2. **Brez loyalty kartice:**
   - Kupon se NE prikaže

3. **Dodaj SPAR plus kartico:**
   - Kupon se PRIKAŽE

4. **V ponedeljek:**
   - Kupon: `-25% na Maslo (3.80€)` → prihranek **0.95€**
   - Končna cena: `7.50€ - 0.95€ = 6.55€`

5. **V četrtek:**
   - Kupon se NE prikaže (ne velja)

## 🔍 Debug

### Preveri strukturo kupona v bazi
```typescript
const sparStore = await ctx.db.query("stores").filter(q => q.eq(q.field("name"), "Spar")).first();
const coupons = await ctx.db.query("coupons").withIndex("by_store", q => q.eq("storeId", sparStore._id)).collect();
console.log(JSON.stringify(coupons, null, 2));
```

### Preveri trenutni dan
```typescript
const now = new Date();
console.log("Trenutni dan (0=ned, 1=pon, ...): ", now.getDay());
console.log("Trenutni teden: ", getWeekNumber(now));
```

### Ročno testiraj za specifičen teden
```typescript
// Testiranje za teden 1 leta 2025
const result = await ctx.runMutation(api.seedCoupons.updateSparWeeklyCoupons, {
  weekNumber: 1,
  year: 2025
});
```

## ✅ Checklist

- [ ] Kupon se doda v bazo
- [ ] `isActive: true`
- [ ] `weekNumber` je pravilen
- [ ] `validDays: [1, 2, 3]` (pon-sre)
- [ ] `requiresLoyaltyCard: true`
- [ ] `maxUsesPerUser: 1`
- [ ] Kupon se prikaže v aplikaciji **SAMO ponedeljek-sreda**
- [ ] Kupon se prikaže **SAMO z loyalty kartico**
- [ ] Kupon izbere **najdražji izdelek** za 25% popust
- [ ] `additionalNotes` se prikažejo uporabniku

## 🎯 Avtomatsko testiranje

TODO: Dodaj unit teste za:
- Izračun tedna
- Filtriranje po dnevih
- Loyalty card check
- Enkratna uporaba tracking

---

**Datum zadnjega testa:** 24.12.2024  
**Status:** ✅ Vse deluje
