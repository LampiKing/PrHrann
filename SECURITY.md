# Varnostne funkcije PrHran aplikacije

## 1. Email Verification (Potrditev emaila)

### Kako deluje:
- Ko se uporabnik registrira, mora potrditi svoj email naslov
- PoĹˇlje se verification link (trenutno se izpiĹˇe v logih - potrebna je integracija z email servisom)
- Dokler email ni potrjen, uporabnik ne more uporabljati aplikacije
- Po potrditvi se avtomatsko prijavi

### Nastavitve:
```typescript
emailAndPassword: {
  requireEmailVerification: true,  // Obvezna verifikacija
  sendVerificationOnSignUp: true,  // PoĹˇlji ob registraciji
  autoSignInAfterVerification: true, // Avtomatska prijava po verifikaciji
}
```

### TODO - Email Integration:
Za produkcijo je potrebno integrirati email servis (Resend, SendGrid, Mailgun):
1. Dodaj API key za email servis v `.env`
2. Implementiraj `sendVerificationEmail` funkcijo v `convex/auth.ts`
3. Stil email template za slovenĹˇÄŤino

## 2. Session Management (Upravljanje sej)

### Aktivne seje:
- **Maksimalno 2 aktivni seji** na uporabnika naenkrat
- ÄŚe se uporabnik prijavi na 3. napravi, se najstarejĹˇa seja avtomatsko zakljuÄŤi
- Seje trajajo **7 dni** (lahko se spremeni)
- Sledenje aktivnosti vsake 5 minut

### Funkcionalnosti:
- `getActiveSessions()` - PrikaĹľe vse aktivne seje uporabnika
- `terminateSession()` - ZakljuÄŤi specifiÄŤno sejo
- `terminateAllOtherSessions()` - ZakljuÄŤi vse seje razen trenutne

### Podatki o seji:
- IP naslov
- Device info (naprava, OS, browser)
- Lokacija (opcijsko - ÄŤe je GEO API integriran)
- ÄŚas kreiranja in zadnje aktivnosti

## 3. IP Tracking & GEO-Locking

### Sledenje IP naslovom:
- Vsaka seja beleĹľi IP naslov
- Primerja se z zadnjim znanim IP naslovom
- ÄŚe pride do velike spremembe (razliÄŤna drĹľava/regija), se oznaÄŤi kot sumljivo

### Detekcija sumljive aktivnosti:
```typescript
// ÄŚe se spremeni prva dva okteta IP naslova
// Primer: 192.168.x.x â†’ 91.185.x.x = SUMLJIVO
if (oldIpParts[0] !== newIpParts[0] || oldIpParts[1] !== newIpParts[1]) {
  suspicious = true;
}
```

### Opozorila:
Ko je zaznana sumljiva aktivnost:
> "Zaznan je bil poskus dostopa iz neobiÄŤajne lokacije. ÄŚe to niste bili vi, takoj spremenite geslo!"

### GEO Locking:
Trenutno implementacija:
- Sledenje IP sprememb
- OznaÄŤevanje sumljive aktivnosti
- Uporabnik lahko roÄŤno zakljuÄŤi sumljive seje

Za napredne funkcije (blokiraj dostop iz drugih drĹľav):
1. Integracija z IP Geolocation API (ipapi.co, ip-api.com)
2. Nastavitev dovoljenih drĹľav/regij v user profile
3. Avtomatsko blokiraj prijave iz nedovoljenih lokacij

## 4. Rate Limiting

### ZaĹˇÄŤita pred zlorabo:
- **IP Rate Limit**: Max 20 zahtevkov/minuto na IP naslov
- **Session Rate Limit**: Max 10 zahtevkov/minuto na sejo
- PrepreÄŤuje brute-force napade na prijavo

### Nastavitve:
```typescript
rateLimit: {
  enabled: true,
  window: 60,  // 60 sekund
  max: 10,     // 10 zahtevkov
}

ipRateLimit({
  window: 60,
  max: 20,
  storage: "memory",
})
```

## 5. UporabniĹˇki vmesnik za upravljanje sej

### V profilu dodaj:
```typescript
// PrikaĹľi aktivne seje
const sessions = useQuery(api.security.getActiveSessions);

// ZakljuÄŤi sejo
const terminateSession = useMutation(api.security.terminateSession);

// ZakljuÄŤi vse druge seje
const terminateAllOthers = useMutation(api.security.terminateAllOtherSessions);
```

### UI elementi:
- Seznam aktivnih naprav/sej
- Gumb "Odjavi to napravo"
- Gumb "Odjavi vse druge naprave"
- Prikaz lokacije in ÄŤasa zadnje aktivnosti
- Opozorilo ÄŤe je zaznana sumljiva aktivnost

## 6. PriporoÄŤila za produkcijo

### Email Service:
**Resend** (priporoÄŤilo):
```bash
npm install resend
```

```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'PrHran <noreply@prhran.com>',
  to: user.email,
  subject: 'Potrdite vaĹˇ email naslov',
  html: emailTemplate(url),
});
```

### IP Geolocation:
**ipapi.co** (free tier 1000 requests/day):
```typescript
const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
const data = await response.json();
// { country, city, latitude, longitude, ... }
```

### Dodatne varnosti:
1. **2FA (Two-Factor Authentication)** - Better Auth ima plugin
2. **Device Fingerprinting** - Prepoznava naprav
3. **Suspicious Login Alerts** - Email/push notification
4. **Account Activity Log** - Zgodovina vseh akcij

## 7. Testiranje

### Scenario 1: Registracija
1. Uporabnik vnese email in geslo
2. Sistem poĹˇlje verification email (trenutno log)
3. Uporabnik klikne link
4. Email je potrjen, avtomatska prijava

### Scenario 2: VeÄŤ naprav
1. Prijava na telefon 1 âś…
2. Prijava na telefon 2 âś…
3. Prijava na telefon 3 âś… (telefon 1 se avtomatsko odjavi)

### Scenario 3: Sumljiva aktivnost
1. Prijava iz Slovenije (IP: 91.x.x.x)
2. Prijava iz tujine (IP: 45.x.x.x)
3. Opozorilo: "Zaznan poskus iz neobiÄŤajne lokacije"
4. Uporabnik lahko zakljuÄŤi sumljivo sejo

## 8. Cenovni model (povezano z varnostjo)

### Free plan:
- 2 aktivni seji
- Osnovna IP sledenje
- 3 iskanja/dan

### Premium plan:
- Neomejeno sej
- Napredna GEO zaĹˇÄŤita
- Neomejeno iskanj
- 2FA (opcijsko)

## Implementacijski status

âś… Email verification - Konfiguriran (potrebna email integracija)
âś… Session management - Implementiran (max 2 seji)
âś… IP tracking - Implementiran
âś… Suspicious activity detection - Implementiran
âŹł GEO API integration - TODO
âŹł Email sending - TODO
âŹł UI za session management - TODO
âŹł Push notifications za suspicious activity - TODO

