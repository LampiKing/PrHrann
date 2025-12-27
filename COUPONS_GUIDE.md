# 🎟️ Sistem kuponov - Navodila za uporabo

## ✅ Kaj je implementirano

### Avtomatska optimizacija kuponov
Košarica **samodejno izbere najboljši kupon** za vsako trgovino, ki uporabniku prinese **največji prihranek**.

### Tipi kuponov
1. **percentage_total** - Odstotek na celoten nakup
   - Primer: "10% popust na celoten nakup nad 20€"
   
2. **percentage_single_item** - Odstotek na en izdelek
   - Samodejno izbere **najdražji** izdelek za maksimalni prihranek
   - Primer: "25% popust na en izdelek"
   
3. **fixed** - Fiksni popust v EUR
   - Primer: "5€ popust pri nakupu nad 40€"
   
4. **category_discount** - Popust na kategorijo
   - Primer: "15% popust na mlečne izdelke"

### Pogoji za uporabo
- **minPurchase** - Minimalni znesek nakupa
- **validDays** - Dnevi veljavnosti (0=nedelja, 1=ponedeljek, ..., 6=sobota)
- **validFrom/validUntil** - Časovno obdobje veljavnosti
- **excludeSaleItems** - Ali izključuje akcijske izdelke
- **requiresLoyaltyCard** - Ali zahteva kartico zvestobe
- **isPremiumOnly** - Ali je samo za premium uporabnike
- **applicableCategories** - Za katera kategorija velja (pri category_discount)

### Pametna optimizacija
Sistem **primerja vse veljavne kupone** in izbere tistega z največjim prihrankom:

**Primer 1:**
- Kupon A: 25% na en izdelek (izdelek stane 10€) → prihranek **2.50€**
- Kupon B: 10% na celoten nakup (košarica 40€) → prihranek **4.00€**
- ✅ **Izbere Kupon B** (večji prihranek)

**Primer 2:**
- Kupon A: 25% na en izdelek (najdražji izdelek 20€) → prihranek **5.00€**
- Kupon B: 10% na celoten nakup (košarica 30€) → prihranek **3.00€**
- ✅ **Izbere Kupon A** + pokaže da se uporablja na izdelek X

## 🚀 Kako dodati kupone

### 1. SPAR tedenski kuponi (PRIPOROČENO)
SPAR ima tedenski sistem kuponov. Posodabljaj jih vsako nedeljo:

```typescript
// V Convex dashboard:
await ctx.runMutation(api.seedCoupons.updateSparWeeklyCoupons, {});
```

**Vir:** https://www.spar.si/promocije-in-projekti/aktualne-promocije  
**Navodila:** Glej [SPAR_WEEKLY_COUPONS.md](SPAR_WEEKLY_COUPONS.md)

**Primer trenutnega SPAR kupona:**
```typescript
{
  code: "SPARPLUS-W52",
  description: "-25% na en izdelek po izbiri",
  couponType: "percentage_single_item",
  discountValue: 25,
  validDays: [1, 2, 3], // Ponedeljek-Sreda
  requiresLoyaltyCard: true, // SPAR plus kartica!
  maxUsesPerUser: 1, // ENKRAT
  excludedProducts: ["postreženo meso"],
  additionalNotes: "Kupona ni mogoče unovčiti na postreženo meso nekaterih franšiz.",
  weekNumber: 52,
  isActive: true,
}
```

### 2. Preko Convex Dashboard
```typescript
// V Convex dashboard konzoli:
await ctx.runMutation(api.seedCoupons.seedCoupons);
```

### 2. Ročno dodajanje kupona
```typescript
await ctx.db.insert("coupons", {
  storeId: "trgovina_id",
  code: "KUPONKODA",
  description: "Opis kupona",
  couponType: "percentage_total", // ali "percentage_single_item", "fixed", "category_discount"
  discountValue: 10, // 10% ali 10€
  minPurchase: 20, // opcijsko - minimalni znesek
  validUntil: Date.now() + 30*24*60*60*1000, // 30 dni
  excludeSaleItems: false,
  requiresLoyaltyCard: false,
  canCombine: false,
  isPremiumOnly: false,
});
```

### 3. Primer več kuponov za eno trgovino
```typescript
// Spar kuponi
{
  code: "SPAR10",
  description: "10% popust na celoten nakup",
  couponType: "percentage_total",
  discountValue: 10,
  minPurchase: 20,
}

{
  code: "SPARDRAGI",
  description: "25% popust na najdražji izdelek",
  couponType: "percentage_single_item",
  discountValue: 25,
  excludeSaleItems: true, // NE velja na akcijske izdelke
}

{
  code: "SPARMLEKO",
  description: "15% na mlečne izdelke s kartico",
  couponType: "category_discount",
  discountValue: 15,
  applicableCategories: ["Mlečni izdelki", "Mleko"],
  requiresLoyaltyCard: true,
}
```

## 📊 Kako deluje v košarici

### Prikaz kupona
Za vsako trgovino se prikaže:
- 🎟️ **Koda kupona** (npr. SPAR10)
- 📝 **Opis** (10% popust na celoten nakup)
- ✅ **Uporabljen na** (celoten nakup ali konkretni izdelek)
- 💰 **Prihranek** (-2.45€)

### Skupni prihranek
V Summary Card:
- "Prihranek s kuponi: -8.50€"
- Originalna cena prečrtana
- **Nova cena** poudarjena

## 🎯 Primeri strategij

### Strategija 1: Maksimalni popust na en izdelek
```typescript
{
  code: "MEGA30",
  couponType: "percentage_single_item",
  discountValue: 30,
  // Sistem bo avtomatsko izbral najdražji izdelek
}
```

### Strategija 2: Popust na velik nakup
```typescript
{
  code: "VELIK20",
  couponType: "percentage_total",
  discountValue: 20,
  minPurchase: 50, // Samo za nakupe nad 50€
}
```

### Strategija 3: Kategorični popust za loyalty člane
```typescript
{
  code: "LOYALTYCHEESE",
  couponType: "category_discount",
  discountValue: 15,
  applicableCategories: ["Siri", "Mlečni izdelki"],
  requiresLoyaltyCard: true,
}
```

### Strategija 4: Premium kuponi
```typescript
{
  code: "PREMIUM50",
  couponType: "percentage_single_item",
  discountValue: 50, // 50% popust!
  isPremiumOnly: true, // Samo za premium
  excludeSaleItems: true, // Ne velja na akcije
}
```

## 🧪 Testiranje

### Seed sample kuponi
```bash
# V Convex dashboard:
await ctx.runMutation(api.seedCoupons.seedCoupons);
```

To doda primerne kupone za vse trgovine.

### Clear kupone
```bash
await ctx.runMutation(api.seedCoupons.clearAllCoupons);
```

## 💡 Najboljše prakse

1. **Ne prekombiniraj** - Eden kupon na trgovino prinaša najboljši rezultat
2. **Testiraj edge case-e** - Kaj če so vsi izdelki na akciji in kupon izključuje akcije?
3. **Raznolikost** - Imej različne tipe kuponov (%, €, kategorije)
4. **Loyalty bonus** - Večji popusti za člane zvestobe
5. **Premium value** - Premium kuponi morajo biti res vredni nadgradnje

## 🎨 UI elementi

### V košarici
- Zelena badge za kupon
- Ikona pricetag
- Koda in opis kupona
- Kjer je uporabljen
- Znesek prihrankov

### V Summary Card
- Dodatna vrstica za skupni prihranek
- Originalna cena prečrtana
- Nova cena poudarjena (zlata za premium)

## 🔮 Prihodnje izboljšave

Že pripravljeno za:
- Kombiniranje kuponov (canCombine: true)
- Time-limited kuponi (flash sales)
- User-specific kuponi (personalizirani)
- Referral kuponi
- Birthday kuponi (s birth_date iz profila)

---

**Avtomatsko optimizacija deluje! 🎉**
Uporabnik ne potrebuje izbirati - sistem izbere najboljši kupon za maksimalni prihranek.
