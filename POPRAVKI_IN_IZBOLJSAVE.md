# 🇸🇮 PRHRAN - POPRAVKI IN IZBOLJŠAVE

## ✅ OPRAVLJENI POPRAVKI

### 1. **PROFIL - ADMIN NALAGANJE** ✅
**Problem:** Ko je admin kliknil na profil, se je prikazalo samo "Nalaganje profila" brez konca.

**Rešitev:**
- Popravljena logika nalaganja v `profile.tsx`
- Ločena tri stanja: `isLoading` (avtentifikacija), `!isAuthenticated` (ni prijave), `!hasResolvedProfile` (profil se naloža)
- Skrajšan timeout za retry s 8 sekund na 5 sekund
- Profil se sedaj takoj prikaže ko je dostopen

**Datoteke:**
- `app/(tabs)/profile.tsx` - Popravljena logika nalaganja

---

### 2. **PROFILNA SLIKA - SHRANJEVANJE** ✅
**Problem:** Profilna slika se ni shranila v bazo in ni ostala.

**Rešitev:**
- Popravljena `updateProfilePicture` funkcija v `convex/userProfiles.ts`
- Dodana validacija: preveri ali je URL prazen
- Dodana verifikacija: preveri ali je bila slika uspešno shranjena
- Vrne napako če shranjevanje ni uspelo
- Slika se sedaj pravilno shrani in ostane

**Datoteke:**
- `convex/userProfiles.ts` - Popravljena `updateProfilePicture` mutacija

---

### 3. **IZDELKI - PRIKAZ V VSEH 3 TRGOVINAH** ✅
**Problem:** Isti izdelek se je prikazal samo v eni trgovini, ne v vseh 3.

**Rešitev:**
- Ustvarjena nova verzija scrapera: `initial_scrape_fixed.py`
- Pravilna deduplikacija po imenu + kategoriji
- Isti izdelek se sedaj prikaže v VSEH 3 trgovinah (če obstaja)
- Pravilna struktura: `products` tabela (osnovni podatki) + `prices` tabela (cene po trgovinah)
- Kombinira podatke iz vseh trgovin za isti izdelek

**Ključne spremembe:**
```python
# Stara struktura: Eno ceno na izdelek
# Nova struktura: Isti izdelek + več cen (po trgovinah)

# Primer:
# Izdelek: "Mleko Alpsko 1L"
# Cene:
#   - Spar: 1.29€
#   - Tuš: 1.35€
#   - Mercator: 1.39€
```

**Datoteke:**
- `automated_scraper/initial_scrape_fixed.py` - Nova verzija s pravilno deduplikacijo
- `automated_scraper/daily_update.py` - Popravljena dnevna posodobitev

---

## 📊 KAKO DELUJE NOVI SCRAPER

### FAZA 1 - Začetno pobiranje (enkrat)
```bash
python initial_scrape_fixed.py
```

1. **Bot pobere VSE izdelke** iz spletnih trgovin (Mercator, Spar, Tuš)
2. **Shrani:** ime, ceno, trgovino, datum, kategorijo
3. **Deduplikacija:** Isti izdelek iz različnih trgovin se kombinira
4. **Rezultat:** Isti izdelek se prikaže v VSEH 3 trgovinah

### FAZA 2 - Redno posodabljanje (dnevno)
```bash
python daily_update.py
```

1. **Bot NE pobira več** iz spletnih trgovin
2. **Namesto tega:** Gleda samo spremembe cen
3. **Posodobi:** Samo sprenjene cene v bazi
4. **Rezultat:** Hitro in učinkovito

---

## 🗄️ STRUKTURA BAZE

### Products tabela (osnovni podatki)
```
_id: ID
name: "Mleko Alpsko 1L"
category: "Mlečni izdelki"
unit: "1L"
imageUrl: optional
```

### Prices tabela (cene po trgovinah)
```
_id: ID
productId: ID (reference na products)
storeId: ID (reference na stores)
price: 1.29
originalPrice: 1.49 (če je na akciji)
isOnSale: true
lastUpdated: timestamp
```

### Stores tabela (trgovine)
```
_id: ID
name: "Spar" | "Mercator" | "Tuš"
color: "#8b5cf6"
isPremium: false
```

---

## 🔍 PRIMERI DEDUPLIKACIJE

### Primer 1: Isti izdelek v vseh 3 trgovinah
```
Vhod (raw data):
- Spar: "Mleko Alpsko 1L" - 1.29€
- Tuš: "Mleko Alpsko 1L" - 1.35€
- Mercator: "Mleko Alpsko 1L" - 1.39€

Izhod (baza):
- Product: "Mleko Alpsko 1L"
  - Price (Spar): 1.29€
  - Price (Tuš): 1.35€
  - Price (Mercator): 1.39€
```

### Primer 2: Izjeme (samo v eni trgovini)
```
Vhod:
- Spar: "ŠPAR Mleko 3.5% 1L" - 1.29€
- Tuš: (ni)
- Mercator: (ni)

Izhod:
- Product: "ŠPAR Mleko 3.5% 1L"
  - Price (Spar): 1.29€
```

---

## 📋 CHECKLIST - KAJ JE POTREBNO NAREDITI

### Pred prvim zagonom:
- [ ] Preveriti `.env` datoteko (PRHRAN_INGEST_URL, PRHRAN_INGEST_TOKEN)
- [ ] Preveriti `credentials.json` za Google Sheets dostop
- [ ] Testirati scraper na manjšem vzorcu

### Prvi zagon:
```bash
cd automated_scraper
python initial_scrape_fixed.py
```

### Dnevna posodobitev (cron job):
```bash
# Vsak dan ob 21:00
0 21 * * * cd /path/to/PrHran/automated_scraper && python daily_update.py
```

---

## 🐛 ZNANI PROBLEMI IN REŠITVE

### Problem: Mercator scraper počasen
**Rešitev:** Mercator ima dinamično nalaganje - scraper scrollira dokler se ne pojavijo novi izdelki

### Problem: Duplikati v bazi
**Rešitev:** Deduplikacija po `name.lower() + category.lower()`

### Problem: Cene se ne posodabljajo
**Rešitev:** Preveriti `PRHRAN_INGEST_URL` in `PRHRAN_INGEST_TOKEN`

---

## 📞 KONTAKT

Če imate vprašanja ali probleme, kontaktirajte razvojni tim.

---

**Zadnja posodobitev:** 2026-01-XX
**Verzija:** 2.0 (s pravilno deduplikacijo)
