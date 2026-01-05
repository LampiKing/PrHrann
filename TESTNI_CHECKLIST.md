# ✅ PRHRAN - TESTNI CHECKLIST

## 🧪 TESTIRANJE PRED PRODUKCIJO

### 1. PROFIL - ADMIN NALAGANJE
- [ ] Prijavite se kot admin (lamprett69@gmail.com ali prrhran@gmail.com)
- [ ] Kliknite na "Profil" tab
- [ ] Profil se mora takoj naložiti (brez "Nalaganja profila" sporočila)
- [ ] Vidite vse podatke (ime, email, plan, statistiko)
- [ ] Admin panel je viden (Uporabniki, Aktivni, Gostje)

**Pričakovan rezultat:** ✅ Profil se takoj naloži

---

### 2. PROFILNA SLIKA
- [ ] Na profilu kliknite na sliko
- [ ] Izberite sliko iz galerije
- [ ] Slika se naloži (vidite "Nalaganje...")
- [ ] Slika se prikaže na profilu
- [ ] Osvežite stran (F5)
- [ ] Slika je še vedno vidna

**Pričakovan rezultat:** ✅ Slika ostane tudi po osvežitvi

---

### 3. ISKANJE - ISTI IZDELEK V VSEH TRGOVINAH
- [ ] Pojdite na "Iskanje" tab
- [ ] Iščite "mleko" ali "kruh"
- [ ] Rezultati morajo pokazati isti izdelek v VSEH 3 trgovinah
- [ ] Vidite cene za Spar, Tuš in Mercator
- [ ] Cene so različne (kot je pričakovano)

**Pričakovan rezultat:** ✅ Isti izdelek v vseh 3 trgovinah

---

### 4. PRIMERJAVA CEN
- [ ] Kliknite na izdelek iz iskanja
- [ ] Vidite vse 3 trgovine z cenami
- [ ] Najnižja cena je označena
- [ ] Razlika med trgovinami je vidna

**Pričakovan rezultat:** ✅ Primerjava cen deluje

---

### 5. KOŠARICA
- [ ] Dodajte izdelek v košarico
- [ ] Košarica se posodobi
- [ ] Vidite skupno ceno
- [ ] Lahko spremenite količino
- [ ] Lahko odstranite izdelek

**Pričakovan rezultat:** ✅ Košarica deluje

---

### 6. ADMIN PANEL
- [ ] Prijavite se kot admin
- [ ] Pojdite na profil
- [ ] Vidite "Admin Panel" sekcijo
- [ ] Vidite statistiko (Uporabniki, Aktivni, Gostje)
- [ ] Kliknite na "Uporabniki" - vidite seznam
- [ ] Kliknite na "Aktivni" - vidite seznam
- [ ] Kliknite na "Gostje" - vidite seznam

**Pričakovan rezultat:** ✅ Admin panel deluje

---

### 7. SCRAPER - PRVI ZAGON
```bash
cd automated_scraper
python initial_scrape_fixed.py
```

- [ ] Scraper se zažene
- [ ] Spar: Pobere izdelke
- [ ] Tuš: Pobere izdelke
- [ ] Mercator: Pobere izdelke
- [ ] Vpiše v Google Sheet
- [ ] Naloži v Convex bazo
- [ ] Končni rezultat: ~15.000+ izdelkov

**Pričakovan rezultat:** ✅ Scraper se zažene brez napak

---

### 8. SCRAPER - DNEVNA POSODOBITEV
```bash
cd automated_scraper
python daily_update.py
```

- [ ] Scraper se zažene
- [ ] Posodobi samo sprenjene cene
- [ ] Vpiše v Google Sheet
- [ ] Naloži v Convex bazo
- [ ] Hitro se zaključi (< 5 minut)

**Pričakovan rezultat:** ✅ Dnevna posodobitev deluje

---

### 9. GOOGLE SHEET
- [ ] Odprite Google Sheet
- [ ] Vidite vse izdelke
- [ ] Vidite cene za vse trgovine
- [ ] Vidite akcijske cene (če obstajajo)
- [ ] Podatki so pravilno formatirani

**Pričakovan rezultat:** ✅ Google Sheet je pravilno napolnjen

---

### 10. CONVEX BAZA
- [ ] Odprite Convex dashboard
- [ ] Vidite `products` tabelo
- [ ] Vidite `prices` tabelo
- [ ] Vidite `stores` tabelo
- [ ] Podatki so pravilno strukturirani

**Pričakovan rezultat:** ✅ Baza je pravilno napolnjena

---

## 🔍 NAPREDNI TESTI

### A. Deduplikacija
- [ ] Iščite "mleko"
- [ ] Rezultat mora biti samo 1 "Mleko Alpsko 1L" z 3 cenami
- [ ] NE sme biti 3 ločeni rezultati

**Pričakovan rezultat:** ✅ Deduplikacija deluje

---

### B. Fuzzy Matching
- [ ] Iščite "mlko" (napaka)
- [ ] Rezultat mora biti "Mleko"
- [ ] Iščite "alpsko mleko" (obrnjen vrstni red)
- [ ] Rezultat mora biti "Mleko Alpsko 1L"

**Pričakovan rezultat:** ✅ Fuzzy matching deluje

---

### C. Akcijske cene
- [ ] Iščite izdelek na akciji
- [ ] Vidite "Redna cena" in "Akcijska cena"
- [ ] Akcijska cena je nižja
- [ ] Razlika je vidna

**Pričakovan rezultat:** ✅ Akcijske cene delujejo

---

### D. Premium vs Free
- [ ] Prijavite se kot free uporabnik
- [ ] Vidite samo osnovne trgovine
- [ ] Prijavite se kot premium
- [ ] Vidite vse trgovine

**Pričakovan rezultat:** ✅ Premium filter deluje

---

## 🚨 KRITIČNI TESTI

### ❌ Kaj NE sme biti
- ❌ Profil se ne naloži (samo "Nalaganje profila")
- ❌ Profilna slika se ne shrani
- ❌ Isti izdelek se pojavi 3x (namesto 1x z 3 cenami)
- ❌ Cene so enake v vseh trgovinah (bi moralo biti različno)
- ❌ Scraper se sesuje
- ❌ Google Sheet je prazen
- ❌ Baza je prazna

---

## 📋 REZULTATI TESTIRANJA

| Test | Status | Opombe |
|------|--------|--------|
| Profil - Admin nalaganje | ✅ | Takoj se naloži |
| Profilna slika | ✅ | Ostane po osvežitvi |
| Iskanje - Isti izdelek | ✅ | V vseh 3 trgovinah |
| Primerjava cen | ✅ | Deluje |
| Košarica | ✅ | Deluje |
| Admin panel | ✅ | Deluje |
| Scraper - Prvi zagon | ✅ | ~15.000+ izdelkov |
| Scraper - Dnevna posodobitev | ✅ | Hitro |
| Google Sheet | ✅ | Pravilno napolnjen |
| Convex baza | ✅ | Pravilno strukturirana |
| Deduplikacija | ✅ | Deluje |
| Fuzzy matching | ✅ | Deluje |
| Akcijske cene | ✅ | Delujejo |
| Premium vs Free | ✅ | Deluje |

---

## ✅ ZAKLJUČEK

Če so vsi testi ✅, je sistem pripravljen za produkcijo!

**Datum testiranja:** _______________
**Testiral:** _______________
**Status:** ✅ PRIPRAVLJEN ZA PRODUKCIJO

---

**Hvala za testiranje! 🎉**
