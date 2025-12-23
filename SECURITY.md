# Varnostne funkcije PrHran aplikacije

## 1. Email Verification (Potrditev emaila)

### Kako deluje:
- Ko se uporabnik registrira, mora potrditi svoj email naslov
- Pošlje se verification link (trenutno se izpiše v logih - potrebna je integracija z email servisom)
- Dokler email ni potrjen, uporabnik ne more uporabljati aplikacije
- Po potrditvi se avtomatsko prijavi

### Nastavitve:
```typescript
emailAndPassword: {
  requireEmailVerification: true,  // Obvezna verifikacija
  sendVerificationOnSignUp: true,  // Pošlji ob registraciji
  autoSignInAfterVerification: true, // Avtomatska prijava po verifikaciji
}
```

### TODO - Email Integration:
Za produkcijo je potrebno integrirati email servis (Resend, SendGrid, Mailgun):
1. Dodaj API key za email servis v `.env`
2. Implementiraj `sendVerificationEmail` funkcijo v `convex/auth.ts`
3. Stil email template za slovenščino

## 2. Session Management (Upravljanje sej)

### Aktivne seje:
- **Maksimalno 2 aktivni seji** na uporabnika naenkrat
- Če se uporabnik prijavi na 3. napravi, se najstarejša seja avtomatsko zaključi
- Seje trajajo **7 dni** (lahko se spremeni)
- Sledenje aktivnosti vsake 5 minut

### Funkcionalnosti:
- `getActiveSessions()` - Prikaže vse aktivne seje uporabnika
- `terminateSession()` - Zaključi specifično sejo
- `terminateAllOtherSessions()` - Zaključi vse seje razen trenutne

### Podatki o seji:
- IP naslov
- Device info (naprava, OS, browser)
- Lokacija (opcijsko - če je GEO API integriran)
- Čas kreiranja in zadnje aktivnosti

## 3. IP Tracking & GEO-Locking

### Sledenje IP naslovom:
- Vsaka seja beleži IP naslov
- Primerja se z zadnjim znanim IP naslovom
- Če pride do velike spremembe (različna država/regija), se označi kot sumljivo

### Detekcija sumljive aktivnosti:
```typescript
// Če se spremeni prva dva okteta IP naslova
// Primer: 192.168.x.x → 91.185.x.x = SUMLJIVO
if (oldIpParts[0] !== newIpParts[0] || oldIpParts[1] !== newIpParts[1]) {
  suspicious = true;
}
```

### Opozorila:
Ko je zaznana sumljiva aktivnost:
> "Zaznan je bil poskus dostopa iz neobičajne lokacije. Če to niste bili vi, takoj spremenite geslo!"

### GEO Locking:
Trenutno implementacija:
- Sledenje IP sprememb
- Označevanje sumljive aktivnosti
- Uporabnik lahko ročno zaključi sumljive seje

Za napredne funkcije (blokiraj dostop iz drugih držav):
1. Integracija z IP Geolocation API (ipapi.co, ip-api.com)
2. Nastavitev dovoljenih držav/regij v user profile
3. Avtomatsko blokiraj prijave iz nedovoljenih lokacij

## 4. Rate Limiting

### Zaščita pred zlorabo:
- **IP Rate Limit**: Max 20 zahtevkov/minuto na IP naslov
- **Session Rate Limit**: Max 10 zahtevkov/minuto na sejo
- Preprečuje brute-force napade na prijavo

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

## 5. Uporabniški vmesnik za upravljanje sej

### V profilu dodaj:
```typescript
// Prikaži aktivne seje
const sessions = useQuery(api.security.getActiveSessions);

// Zaključi sejo
const terminateSession = useMutation(api.security.terminateSession);

// Zaključi vse druge seje
const terminateAllOthers = useMutation(api.security.terminateAllOtherSessions);
```

### UI elementi:
- Seznam aktivnih naprav/sej
- Gumb "Odjavi to napravo"
- Gumb "Odjavi vse druge naprave"
- Prikaz lokacije in časa zadnje aktivnosti
- Opozorilo če je zaznana sumljiva aktivnost

## 6. Priporočila za produkcijo

### Email Service:
**Resend** (priporočilo):
```bash
npm install resend
```

```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'PrHran <noreply@prhran.si>',
  to: user.email,
  subject: 'Potrdite vaš email naslov',
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
2. Sistem pošlje verification email (trenutno log)
3. Uporabnik klikne link
4. Email je potrjen, avtomatska prijava

### Scenario 2: Več naprav
1. Prijava na telefon 1 ✅
2. Prijava na telefon 2 ✅
3. Prijava na telefon 3 ✅ (telefon 1 se avtomatsko odjavi)

### Scenario 3: Sumljiva aktivnost
1. Prijava iz Slovenije (IP: 91.x.x.x)
2. Prijava iz tujine (IP: 45.x.x.x)
3. Opozorilo: "Zaznan poskus iz neobičajne lokacije"
4. Uporabnik lahko zaključi sumljivo sejo

## 8. Cenovni model (povezano z varnostjo)

### Free plan:
- 2 aktivni seji
- Osnovna IP sledenje
- 3 iskanja/dan

### Premium plan:
- Neomejeno sej
- Napredna GEO zaščita
- Neomejeno iskanj
- 2FA (opcijsko)

## Implementacijski status

✅ Email verification - Konfiguriran (potrebna email integracija)
✅ Session management - Implementiran (max 2 seji)
✅ IP tracking - Implementiran
✅ Suspicious activity detection - Implementiran
⏳ GEO API integration - TODO
⏳ Email sending - TODO
⏳ UI za session management - TODO
⏳ Push notifications za suspicious activity - TODO
