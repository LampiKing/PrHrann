# PrHran - Navodila za objavo na App Store in Google Play

## Pregled

Ta dokument vsebuje vse korake za objavo aplikacije PrHran na Apple App Store in Google Play Store.

---

## 1. Predpogoji

### Računi (enkratna nastavitev)

| Platforma | Strošek | Čas odobritve |
|-----------|---------|---------------|
| [Apple Developer Program](https://developer.apple.com/programs/) | 99 €/leto | 24-48 ur |
| [Google Play Console](https://play.google.com/console) | 25 $ enkrat | Takoj |
| [Expo Account](https://expo.dev/signup) | Brezplačno | Takoj |

### Potrebna orodja
```bash
# Namesti EAS CLI
npm install -g eas-cli

# Preveri namestitev
eas --version
```

---

## 2. Nastavitev Expo projekta

### 2.1 Prijava v Expo
```bash
eas login
```

### 2.2 Inicializacija EAS projekta
```bash
eas init
```
To bo ustvarilo Project ID in ga dodalo v app.json.

### 2.3 Posodobi app.json
Zamenjaj placeholder vrednosti:
- `TVOJ_EAS_PROJECT_ID` → dejanski Project ID iz Expo dashboard

---

## 3. Apple App Store

### 3.1 Ustvari App Store Connect aplikacijo

1. Pojdi na [App Store Connect](https://appstoreconnect.apple.com)
2. Klikni "My Apps" → "+" → "New App"
3. Izpolni:
   - Platform: iOS
   - Name: PrHran - Primerjava cen
   - Primary Language: Slovenian
   - Bundle ID: com.prhran.app
   - SKU: prhran-ios-001

### 3.2 Ustvari certifikate

```bash
# EAS bo avtomatsko ustvaril certifikate
eas credentials
```

### 3.3 Build za iOS
```bash
# Production build
eas build --platform ios --profile production
```

### 3.4 Objava na App Store
```bash
eas submit --platform ios
```

### 3.5 Izpolni App Store metadata
- Uporabi vsebino iz `store-listing/app-store-listing-sl.md`
- Naloži screenshots (glej `store-listing/SCREENSHOTS-README.md`)
- Nastavi ceno: Brezplačno
- Izberi državo: Slovenija (lahko dodaš več)

### 3.6 Pošlji v pregled
- App Review traja običajno 24-48 ur
- Ob zavrnitvi popraviš navedene težave in ponovno pošlješ

---

## 4. Google Play Store

### 4.1 Ustvari Google Play aplikacijo

1. Pojdi na [Google Play Console](https://play.google.com/console)
2. Klikni "Create app"
3. Izpolni:
   - App name: PrHran - Primerjava cen
   - Default language: Slovenščina
   - App or game: App
   - Free or paid: Free

### 4.2 Ustvari Service Account za avtomatsko objavo

1. Pojdi na [Google Cloud Console](https://console.cloud.google.com)
2. Ustvari nov projekt ali uporabi obstoječega
3. Enable "Google Play Android Developer API"
4. Ustvari Service Account z vlogo "Service Account User"
5. Prenesi JSON ključ in ga shrani kot `google-play-service-account.json`
6. V Play Console → Settings → API access → poveži Service Account

### 4.3 Build za Android
```bash
# Production build (AAB format)
eas build --platform android --profile production
```

### 4.4 Objava na Play Store
```bash
eas submit --platform android
```

ALI ročno:
1. Prenesi .aab datoteko iz EAS
2. V Play Console → Production → Create new release
3. Naloži .aab datoteko
4. Dodaj release notes

### 4.5 Izpolni Store Listing
- Uporabi vsebino iz `store-listing/play-store-listing-sl.md`
- Naloži screenshots
- Naloži Feature Graphic (1024 x 500 px)

### 4.6 Izpolni Content Rating
- Izpolni vprašalnik za IARC rating
- PrHran naj dobi oceno "Everyone" (E)

### 4.7 Nastavi Data Safety
- Personal info: Ne zbiramo
- Location: Opcijsko (za najbližje trgovine)
- Financial info: Ne
- Data shared: Ne

---

## 5. Hitri ukazi

```bash
# === DEVELOPMENT ===
eas build --platform all --profile development

# === PREVIEW (interno testiranje) ===
eas build --platform all --profile preview

# === PRODUCTION ===
eas build --platform all --profile production

# === SUBMIT ===
eas submit --platform ios
eas submit --platform android

# === OTA UPDATE (brez novega builda) ===
eas update --branch production --message "Bug fixes"
```

---

## 6. Checklist pred objavo

### Splošno
- [ ] Vsi placeholder-ji v app.json zamenjani
- [ ] EAS Project ID nastavljen
- [ ] Privacy Policy URL dostopen javno
- [ ] Terms of Service URL dostopen javno
- [ ] Ikona 1024x1024 px pripravljena
- [ ] Screenshots pripravljeni za obe platformi

### iOS
- [ ] Apple Developer račun aktiven
- [ ] App Store Connect aplikacija ustvarjena
- [ ] Certifikati ustvarjeni (eas credentials)
- [ ] TestFlight testiranje opravljeno

### Android
- [ ] Google Play Console račun aktiven
- [ ] Service Account nastavljen
- [ ] Content Rating izpolnjen
- [ ] Data Safety izpolnjen
- [ ] Internal testing opravljeno

---

## 7. Po objavi

### Monitoring
- Spremljaj ocene in komentarje
- Odgovarjaj na vprašanja uporabnikov
- Spremljaj crash reports

### Updates
```bash
# Nova verzija
# 1. Posodobi version v app.json
# 2. Build
eas build --platform all --profile production
# 3. Submit
eas submit --platform all
```

### OTA Updates (brez App Store review)
```bash
# Manjše popravke lahko objaviš takoj
eas update --branch production --message "Fixed search bug"
```

---

## 8. Pomoč in podpora

- [Expo Documentation](https://docs.expo.dev)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Play Store Policy](https://play.google.com/about/developer-content-policy/)

---

## 9. Pomembne povezave za PrHran

| Kaj | URL |
|-----|-----|
| Privacy Policy | https://prhran.si/zasebnost |
| Terms of Service | https://prhran.si/pogoji |
| Support | https://prhran.si/podpora |
| Website | https://prhran.si |

**OPOMBA:** Te URL-je moraš ustvariti pred objavo! Lahko uporabiš:
- GitHub Pages (brezplačno)
- Vercel (brezplačno)
- Netlify (brezplačno)
- Ali svojo domeno

---

*Zadnja posodobitev: Januar 2026*
