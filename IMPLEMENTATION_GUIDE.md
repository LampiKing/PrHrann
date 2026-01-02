# 🚀 PrHran - Vodič za Implementacijo

> **Datum:** 2. januar 2026
> **Status:** ✅ Backend pripravljen, plačila potrebujejo integracijo

---

## 📋 PREGLED

Ta dokument vsebuje **popolna navodila** za dokončanje PrHran aplikacije za produkcijo.

### ✅ ŠE IMPLEMENTIRANO

1. ✅ **Device Fingerprinting & Anti-Abuse System**
2. ✅ **Family Plan Management Backend**
3. ✅ **Multi-Session Tracking**
4. ✅ **Leaderboard & Sezonske Nagrade**
5. ✅ **Shopping Cart & Coupons**
6. ✅ **Receipt Upload (OpenAI integration ready)**

### ⚠️ POTREBUJE IMPLEMENTACIJO

1. ❌ **Stripe Payment Integration** (KRITIČNO!)
2. ⚠️ **Device Management UI** (Backend ready)
3. ⚠️ **Family Plan UI** (Backend ready)
4. ⚠️ **Email Notifications** (Resend integration ready)

---

## 🔐 1. DEVICE FINGERPRINTING & ANTI-ABUSE

### Kako deluje

**Backend:**
- `convex/deviceManagement.ts` - Nove funkcije
- `convex/schema.ts` - Nove tabele: `deviceFingerprints`, `registeredDevices`

**Omejitve:**
- **Max 3 registracije** iz iste naprave
- **Max 5 naprav** na uporabnika
- **Device Lock** - samo 1 uporabnik lahko uporablja napravo hkrati
- **Avtomatska blokada** pri sumljivi aktivnosti

### Integracija v Aplikacijo

#### 1.1. Zbiranje Device Info (app/auth.tsx)

Dodaj v registracijo in prijavo:

\`\`\`typescript
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Pri registraciji/prijavi
const deviceInfo = {
  platform: Platform.OS, // "ios", "android", "web"
  osVersion: Device.osVersion,
  deviceModel: Device.modelName,
  deviceBrand: Device.brand,
  appVersion: Constants.expoConfig?.version,
};

// Hash za fingerprint
const fingerprintHash = [
  deviceInfo.platform,
  deviceInfo.osVersion || '',
  deviceInfo.deviceModel || '',
  deviceInfo.deviceBrand || '',
  deviceInfo.appVersion || '',
].join('|');

// Device name za prikaz
const deviceName = \`\${Device.brand || ''} \${Device.modelName || 'Unknown'}\`.trim();
\`\`\`

#### 1.2. Preverjanje Eligible naprave PRED registracijo

\`\`\`typescript
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const checkEligibility = useMutation(api.deviceManagement.checkDeviceEligibility);
const registerDevice = useMutation(api.deviceManagement.registerDevice);

// PRED registration form submitom
const handleRegister = async () => {
  // 1. Preveri eligible naprave
  const eligibility = await checkEligibility(deviceInfo);

  if (!eligibility.eligible) {
    setError(eligibility.message);
    return;
  }

  // 2. Nadaljuj z registracijo
  const registerResult = await authClient.signUp.email({ ... });

  // 3. Po uspešni registraciji registriraj napravo
  if (registerResult.data) {
    await registerDevice({
      ...deviceInfo,
      deviceName,
    });
  }
};
\`\`\`

#### 1.3. Device Access Check pri prijavi

\`\`\`typescript
const checkDeviceAccess = useMutation(api.deviceManagement.checkDeviceAccess);

// Po prijavi
const handleLogin = async () => {
  const loginResult = await authClient.signIn.email({ ... });

  if (loginResult.data) {
    // Preveri access
    const access = await checkDeviceAccess({ fingerprintHash });

    if (!access.allowed) {
      // Naprava je zaklenjena za drugega uporabnika
      setError(access.message);
      await authClient.signOut();
      return;
    }

    // Update device last used
    await registerDevice({
      ...deviceInfo,
      deviceName,
    });
  }
};
\`\`\`

#### 1.4. Device Management UI (Profile Settings)

Dodaj nov screen **`app/device-management.tsx`**:

\`\`\`typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function DeviceManagementScreen() {
  const devices = useQuery(api.deviceManagement.getUserDevices);
  const lockDevice = useMutation(api.deviceManagement.lockDevice);
  const unlockDevice = useMutation(api.deviceManagement.unlockDevice);
  const removeDevice = useMutation(api.deviceManagement.removeDevice);
  const setPrimary = useMutation(api.deviceManagement.setPrimaryDevice);

  return (
    <ScrollView>
      <Text style={styles.title}>Moje Naprave</Text>

      {devices?.map((device) => (
        <View key={device.id} style={styles.deviceCard}>
          <View style={styles.deviceHeader}>
            <Ionicons
              name={device.platform === 'ios' ? 'phone-portrait' : 'phone-landscape'}
              size={24}
            />
            <Text style={styles.deviceName}>{device.deviceName}</Text>
            {device.isPrimary && <Text style={styles.primaryBadge}>Primarna</Text>}
            {device.isLocked && <Ionicons name="lock-closed" size={16} color="#fbbf24" />}
          </View>

          <Text style={styles.deviceInfo}>
            Zadnja uporaba: {new Date(device.lastUsedAt).toLocaleDateString()}
          </Text>

          <View style={styles.deviceActions}>
            {!device.isPrimary && (
              <TouchableOpacity onPress={() => setPrimary({ deviceId: device.id })}>
                <Text>Nastavi kot primarno</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => device.isLocked
                ? unlockDevice({ deviceId: device.id })
                : lockDevice({ deviceId: device.id })}
            >
              <Text>{device.isLocked ? 'Odkleni' : 'Zakleni'}</Text>
            </TouchableOpacity>

            {!device.isPrimary && (
              <TouchableOpacity
                onPress={() => removeDevice({ deviceId: device.id })}
              >
                <Text style={styles.removeText}>Odstrani</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
\`\`\`

---

## 👨‍👩‍👧 2. FAMILY PLAN MANAGEMENT

### Kako deluje

**Backend:**
- `convex/familyPlan.ts` - Nove funkcije
- `convex/schema.ts` - Nova tabela: `familyInvitations`

**Flow:**
1. Owner (s Family Premium) pošlje vabilo na email
2. Povabljeni prejme email z invite linkom
3. Povabljeni sprejme ali zavrne
4. Owner lahko odstrani člane ali prekliče vabila

### Integracija v Aplikacijo

#### 2.1. Family Management Screen

Dodaj nov screen **`app/family-plan.tsx`**:

\`\`\`typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function FamilyPlanScreen() {
  const familyData = useQuery(api.familyPlan.getFamilyMembers);
  const pendingInvites = useQuery(api.familyPlan.getPendingInvitations);
  const inviteMember = useMutation(api.familyPlan.inviteFamilyMember);
  const removeMember = useMutation(api.familyPlan.removeFamilyMember);
  const cancelInvite = useMutation(api.familyPlan.cancelInvitation);

  const [inviteEmail, setInviteEmail] = useState("");

  if (!familyData?.isOwner) {
    return <Text>Samo Family owner lahko upravlja s člani.</Text>;
  }

  const handleInvite = async () => {
    try {
      await inviteMember({ email: inviteEmail });
      setInviteEmail("");
      Alert.alert("Uspeh", "Vabilo poslano!");
    } catch (error) {
      Alert.alert("Napaka", error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Family Plan Člani</Text>
      <Text style={styles.subtitle}>
        {familyData.members.length}/{familyData.maxMembers - 1} članov
      </Text>

      {/* Trenutni člani */}
      {familyData.members.map((member) => (
        <View key={member.userId} style={styles.memberCard}>
          <View>
            <Text style={styles.memberNickname}>{member.nickname}</Text>
            <Text style={styles.memberEmail}>{member.email}</Text>
          </View>
          <TouchableOpacity
            onPress={() => removeMember({ memberUserId: member.userId })}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}

      {/* Pending invitations */}
      {pendingInvites && pendingInvites.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending Vabila</Text>
          {pendingInvites.map((invite) => (
            <View key={invite.id} style={styles.inviteCard}>
              <Text>{invite.email}</Text>
              <Text style={styles.inviteExpiry}>
                Poteče: {new Date(invite.expiresAt).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                onPress={() => cancelInvite({ invitationId: invite.id })}
              >
                <Text style={styles.cancelText}>Prekliči</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Invite new member */}
      {familyData.availableSlots > 0 && (
        <View style={styles.inviteSection}>
          <Text style={styles.sectionTitle}>Povabi novega člana</Text>
          <TextInput
            style={styles.input}
            placeholder="Email naslov"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
          />
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={handleInvite}
          >
            <Text style={styles.inviteButtonText}>Pošlji vabilo</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
\`\`\`

#### 2.2. Accept Invitation Screen

Dodaj **`app/accept-invitation.tsx`** za linke iz emailov:

\`\`\`typescript
import { useLocalSearchParams } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams();
  const acceptInvite = useMutation(api.familyPlan.acceptFamilyInvitation);
  const declineInvite = useMutation(api.familyPlan.declineFamilyInvitation);

  const handleAccept = async () => {
    try {
      const result = await acceptInvite({ inviteToken: token as string });
      Alert.alert("Uspeh!", result.message);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Napaka", error.message);
    }
  };

  const handleDecline = async () => {
    await declineInvite({ inviteToken: token as string });
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Family Plan Vabilo</Text>
      <Text>Povabljeni si v Family načrt!</Text>

      <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
        <Text>Sprejmi</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
        <Text>Zavrni</Text>
      </TouchableOpacity>
    </View>
  );
}
\`\`\`

---

## 💳 3. STRIPE PAYMENT INTEGRATION

### Trenutno Stanje

❌ **SIMULACIJA** v `app/premium.tsx` vrstica 104-105:

\`\`\`typescript
// TODO: Real payment integration
await new Promise((resolve) => setTimeout(resolve, 2000));
\`\`\`

### Potrebno za Produkcijo

#### 3.1. Setup Stripe Account

1. Pojdi na [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Ustvari account
3. Preberi API keys (Developers → API Keys):
   - **Publishable key** (pk_test_... ali pk_live_...)
   - **Secret key** (sk_test_... ali sk_live_...)

#### 3.2. Dodaj Stripe Dependencies

\`\`\`bash
npm install @stripe/stripe-react-native
npm install stripe  # For backend
\`\`\`

#### 3.3. Konfiguracija Environment Variables

Dodaj v `.env.local`:

\`\`\`env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Product/Price IDs (kreiraš v Stripe Dashboard)
STRIPE_PRICE_ID_INDIVIDUAL=price_...
STRIPE_PRICE_ID_FAMILY=price_...
\`\`\`

#### 3.4. Ustvari Stripe Products v Dashboardu

1. Pojdi na **Products** → **Add Product**
2. Ustvari:
   - **PrHran Plus Individual**
     - Cena: €1.99/mesec
     - Recurring: Monthly
     - Kopiraj Price ID

   - **PrHran Family**
     - Cena: €2.99/mesec
     - Recurring: Monthly
     - Kopiraj Price ID

#### 3.5. Backend - Ustvari Convex Action za Payment

Dodaj **`convex/payments.ts`**:

\`\`\`typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export const createCheckoutSession = action({
  args: {
    planType: v.union(v.literal("solo"), v.literal("family")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const priceId =
      args.planType === "family"
        ? process.env.STRIPE_PRICE_ID_FAMILY!
        : process.env.STRIPE_PRICE_ID_INDIVIDUAL!;

    // Ustvari Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      client_reference_id: identity.subject, // User ID
      metadata: {
        userId: identity.subject,
        planType: args.planType,
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});
\`\`\`

#### 3.6. Frontend - Integriraj Stripe

V **`app/premium.tsx`** zamenjaj simulacijo:

\`\`\`typescript
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Linking } from "react-native";

// Remove old simulation
const createCheckout = useAction(api.payments.createCheckoutSession);

const handlePayment = async () => {
  setProcessing(true);

  try {
    const result = await createCheckout({
      planType: selectedPlan === "family" ? "family" : "solo",
      successUrl: "yourapp://payment-success",
      cancelUrl: "yourapp://payment-cancel",
    });

    // Open Stripe Checkout
    if (result.url) {
      await Linking.openURL(result.url);
    }
  } catch (error) {
    console.error("Payment error:", error);
    Alert.alert("Napaka", "Plačilo ni uspelo");
  } finally {
    setProcessing(false);
  }
};
\`\`\`

#### 3.7. Webhooks za Payment Confirmation

Dodaj **`convex/http.ts`** webhook handler:

\`\`\`typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const handleStripeWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get("stripe-signature")!;
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response(\`Webhook Error: \${err.message}\`, { status: 400 });
  }

  // Handle event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    const planType = session.metadata?.planType;

    if (userId && planType) {
      // Upgrade user to premium
      await ctx.runMutation(api.userProfiles.upgradeToPremiumAfterPayment, {
        userId,
        planType: planType as "solo" | "family",
        stripeSubscriptionId: session.subscription as string,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

const http = httpRouter();
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: handleStripeWebhook,
});

export default http;
\`\`\`

#### 3.8. Posodobi Premium Upgrade Mutation

V **`convex/userProfiles.ts`** dodaj:

\`\`\`typescript
export const upgradeToPremiumAfterPayment = mutation({
  args: {
    userId: v.string(),
    planType: v.union(v.literal("solo"), v.literal("family")),
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) throw new Error("Profile not found");

    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const premiumUntil = Date.now() + oneMonth;

    await ctx.db.patch(profile._id, {
      isPremium: true,
      premiumType: args.planType,
      premiumUntil,
      stripeSubscriptionId: args.stripeSubscriptionId,
      familyOwnerId: args.planType === "family" ? args.userId : undefined,
      familyMembers: args.planType === "family" ? [] : undefined,
    });
  },
});
\`\`\`

#### 3.9. Testiraj z Test Mode

1. Uporabi Stripe test cards: `4242 4242 4242 4242`
2. Datum: Katerikoli prihodnji datum
3. CVC: Katerikoli 3 številke

---

## 📧 4. EMAIL NOTIFICATIONS

### Trenutno Stanje

Email infrastruktura je že pripravljena (Resend), samo manjkajo poslane email.

### Kdaj poslati emaile

1. **Email verification** - ✅ Že implementirano
2. **Family invitation** - ⚠️ TODO v `convex/familyPlan.ts` vrstica 101
3. **Payment confirmation** - ⚠️ Stripe bo poslal avtomatsko
4. **Device login alert** - ⚠️ Implementiraj v `convex/security.ts`

### Implementacija

Dodaj email templates in pošiljanje v Family invitations.

---

## ✅ FINALNI CHECKLIST ZA PRODUKCIJO

### KRITIČNO (Mora biti done)

- [ ] **Stripe Payment Integration** (Poglavje 3)
- [ ] **Device Management UI** (Poglavje 1.4)
- [ ] **Family Plan UI** (Poglavje 2.1)
- [ ] **Webhook handling** (Poglavje 3.7)

### POMEMBNO (Priporočeno)

- [ ] Email notifications za family invites
- [ ] Push notifications setup
- [ ] Device login alerts
- [ ] Terms of Service & Privacy Policy

### TESTIRANJE

- [ ] Registracija iz 3 različnih naprav
- [ ] Device lock functionality
- [ ] Family invite flow (send → accept)
- [ ] Stripe test payment
- [ ] Session management (logout from all devices)

---

## 🆘 POMOČ IN PODPORA

### Vprašanja?

1. **Stripe Documentation:** [https://stripe.com/docs](https://stripe.com/docs)
2. **Expo Device:** [https://docs.expo.dev/versions/latest/sdk/device/](https://docs.expo.dev/versions/latest/sdk/device/)
3. **Convex Actions:** [https://docs.convex.dev/functions/actions](https://docs.convex.dev/functions/actions)

### Trenutno Stanje Stripe

**STATUS:** ❌ DEMO MODE - vse je simulirano

Za produkcijo MORAŠ:
1. Ustvariti Stripe account
2. Dodati API keys v `.env.local`
3. Ustvariti Products in Price IDs
4. Implementirati Checkout flow (Poglavje 3.5-3.6)
5. Nastaviti Webhooks (Poglavje 3.7)

---

**Avtor:** Claude Sonnet 4.5
**Datum:** 2. januar 2026
**Verzija:** 1.0
