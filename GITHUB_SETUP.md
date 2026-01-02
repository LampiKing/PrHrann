# 🔧 GitHub Secrets Setup - Avtomatski Dnevni Scraper

> **Za lastnike repozitorija:** Navodila za nastavitev avtomatskega dnevnega scraper-ja

---

## 📋 Potrebni GitHub Secrets

Pojdi na **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 1. GOOGLE_CREDENTIALS

**Kje najdeš:** `automated_scraper/credentials.json`

**Kako dodaš:**
1. Odpri `automated_scraper/credentials.json`
2. Kopiraj **CELOTNO VSEBINO** datoteke (vključno z `{` in `}`)
3. V GitHubu ustvari secret z imenom: `GOOGLE_CREDENTIALS`
4. Prilepi JSON vsebino

**Primer:**
```json
{
  "type": "service_account",
  "project_id": "prhran-...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  ...
}
```

---

### 2. CONVEX_DEPLOYMENT

**Kje najdeš:** `.env.local` datoteka

**Primer vrednosti:**
```
prod:prhran-123:abc456def
```

**Kako dodaš:**
1. Odpri `.env.local`
2. Najdi vrstico ki se začne z `CONVEX_DEPLOYMENT=`
3. Kopiraj vrednost BREZ `CONVEX_DEPLOYMENT=`
4. V GitHubu ustvari secret z imenom: `CONVEX_DEPLOYMENT`
5. Prilepi vrednost

---

### 3. CONVEX_INGEST_TOKEN

**Kje najdeš:** Convex Dashboard

**Kako dobiš:**
1. Pojdi na [https://dashboard.convex.dev](https://dashboard.convex.dev)
2. Izberi svoj projekt (PrHran)
3. Settings → **Deployment Settings**
4. Poišči **HTTP Actions** → **Ingest Token**
5. Kopiraj token

**Kako dodaš:**
1. V GitHubu ustvari secret z imenom: `CONVEX_INGEST_TOKEN`
2. Prilepi token

---

### 4. CONVEX_DEPLOY_KEY (Opcijsko)

**Kje najdeš:** Convex Dashboard

**Kako dobiš:**
1. Pojdi na [https://dashboard.convex.dev](https://dashboard.convex.dev)
2. Settings → **Deploy Keys**
3. Ustvari nov key (če še nima š)
4. Kopiraj

**Kako dodaš:**
1. V GitHubu ustvari secret z imenom: `CONVEX_DEPLOY_KEY`
2. Prilepi key

---

## ✅ Preverjanje

Ko dodaš vse secrete, lahko preveriš:

1. **Actions** tab → **Dnevni Scraper - Posodobitev Cen**
2. Klikni **Run workflow** → **Run workflow**
3. Če vse dela pravilno, bi moral videti zeleno ✓

---

## 📅 Urnik

GitHub Actions bo avtomatsko zagnal scraper **vsak dan ob 06:00 CET** (05:00 UTC).

**Ročni zagon:**
- Actions → Dnevni Scraper → Run workflow

---

## 🐛 Troubleshooting

### Napaka: "GOOGLE_CREDENTIALS not found"
- Secret `GOOGLE_CREDENTIALS` ni nastavljen ali je prazen
- Preveri da si kopiral **CELOTEN JSON** iz `credentials.json`

### Napaka: "CONVEX upload failed"
- Preveri `CONVEX_INGEST_TOKEN` - mora biti pravilen token
- Preveri `CONVEX_DEPLOYMENT` - mora biti pravilen deployment ID

### Scraper se ne zažene
- Preveri Actions tab → mora biti zeleno vklopljeno
- Preveri da je workflow file prisoten: `.github/workflows/daily-scraper.yml`

---

## 📞 Pomoč

Če imaš težave:
1. Preveri Actions logs (klikni na failed job → razširi steps)
2. Kontaktiraj support

---

**Avtor:** PrHran Team
**Datum:** 2. januar 2026
