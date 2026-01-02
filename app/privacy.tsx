import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Politika Zasebnosti</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lastUpdated}>Nazadnje posodobljeno: 2. januar 2026</Text>

          <Text style={styles.intro}>
            PrHran cenimo vašo zasebnost. Ta politika opisuje, kako zbiramo, uporabljamo in
            varujemo vaše osebne podatke.
          </Text>

          <Text style={styles.sectionTitle}>1. Podatki, ki jih Zbiramo</Text>

          <Text style={styles.subsectionTitle}>1.1. Podatki Registracije</Text>
          <Text style={styles.paragraph}>
            • E-poštni naslov{"\n"}
            • Vzdevek (po izbiri){"\n"}
            • Geslo (šifrirano){"\n"}
            • Datum rojstva (opcijsko)
          </Text>

          <Text style={styles.subsectionTitle}>1.2. Podatki o Napravi</Text>
          <Text style={styles.paragraph}>
            • Model naprave (npr. "iPhone 16 Pro Max"){"\n"}
            • Operacijski sistem in verzija{"\n"}
            • IP naslov{"\n"}
            • Edinstveni identifikator naprave (za varnost)
          </Text>

          <Text style={styles.subsectionTitle}>1.3. Podatki o Uporabi</Text>
          <Text style={styles.paragraph}>
            • Zgodovina iskanj izdelkov{"\n"}
            • Košarica in nakupovalni seznami{"\n"}
            • Slike računov (za analizo prihrankov){"\n"}
            • Interakcije z aplikacijo (kliki, navigacija)
          </Text>

          <Text style={styles.subsectionTitle}>1.4. Plačilni Podatki</Text>
          <Text style={styles.paragraph}>
            Plačilne podatke procesira Stripe (tretja oseba). Mi ne shranjujemo podatkov o kreditnih
            karticah. Shranjujemo samo ID naročnine za upravljanje premium dostopa.
          </Text>

          <Text style={styles.sectionTitle}>2. Kako Uporabljamo Podatke</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>2.1. Nudenje Storitve:</Text>{"\n"}
            • Iskanje in primerjava cen{"\n"}
            • Upravljanje računov in profilov{"\n"}
            • Shranjevanje nakupovalnih seznamov{"\n"}
            • Procesiranje premium naročnin
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>2.2. Izboljšave Storitve:</Text>{"\n"}
            • Analiza uporabniških preferenc{"\n"}
            • Odpravljanje tehničnih težav{"\n"}
            • Razvoj novih funkcij
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>2.3. Varnost:</Text>{"\n"}
            • Preprečevanje zlorab in lažnih računov{"\n"}
            • Zaznavanje sumljivih aktivnosti{"\n"}
            • Zaščita pred prevaro
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>2.4. Komunikacija:</Text>{"\n"}
            • Pošiljanje pomembnih obvestil{"\n"}
            • Odgovori na vaša vprašanja{"\n"}
            • Obvestila o spremembah storitve
          </Text>

          <Text style={styles.sectionTitle}>3. Deljenje Podatkov</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>NE prodajamo</Text> vaših osebnih podatkov tretjim osebam.
            Podatke delimo samo:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>3.1. Stripe (Plačila):</Text> Za procesiranje premium
            naročnin. Stripe ima lastno politiko zasebnosti.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>3.2. Convex (Baza podatkov):</Text> Za shranjevanje
            aplikacijskih podatkov. Podatki so šifrirani.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>3.3. Resend (E-pošta):</Text> Za pošiljanje verifikacijskih
            e-poštnih sporočil.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>3.4. Zakonske Zahteve:</Text> Če zakon zahteva razkritje
            podatkov organom pregona.
          </Text>

          <Text style={styles.sectionTitle}>4. Varovanje Podatkov</Text>
          <Text style={styles.paragraph}>
            • <Text style={styles.bold}>Šifriranje:</Text> Vsi podatki so šifrirani med prenosom
            (HTTPS) in v mirovanju.{"\n"}
            • <Text style={styles.bold}>Varna Avtentikacija:</Text> Gesla so hashirana z bcrypt.
            {"\n"}
            • <Text style={styles.bold}>Redne Kopije:</Text> Avtomatsko varnostno kopiranje vsak
            dan.{"\n"}
            • <Text style={styles.bold}>Omejen Dostop:</Text> Samo pooblaščeno osebje ima dostop do
            podatkov.
          </Text>

          <Text style={styles.sectionTitle}>5. Vaše Pravice</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>5.1. Dostop:</Text> Lahko zahtevate kopijo vseh vaših
            podatkov.{"\n"}
            <Text style={styles.bold}>5.2. Popravek:</Text> Podatke lahko uredite v nastavitvah
            profila.{"\n"}
            <Text style={styles.bold}>5.3. Izbris:</Text> Račun lahko kadarkoli izbrišete. Vsi
            podatki bodo trajno izbrisani.{"\n"}
            <Text style={styles.bold}>5.4. Prenos:</Text> Lahko zahtevate izvoz vaših podatkov v
            strojno berljivi obliki.{"\n"}
            <Text style={styles.bold}>5.5. Ugovor:</Text> Lahko ugovarjate procesiranju vaših
            podatkov za določene namene.
          </Text>

          <Text style={styles.sectionTitle}>6. Piškotki in Sledenje</Text>
          <Text style={styles.paragraph}>
            Uporabljamo minimalne piškotke za:{"\n"}
            • Shranjevanje seje prijave{"\n"}
            • Zapomnitev nastavitev{"\n"}
            • Analizo uporabe aplikacije{"\n"}
            {"\n"}
            Ne uporabljamo piškotkov tretjih oseb za oglaševanje.
          </Text>

          <Text style={styles.sectionTitle}>7. Otroci</Text>
          <Text style={styles.paragraph}>
            Storitev ni namenjena otrokom mlajšim od 13 let. Zavestno ne zbiramo podatkov otrok. Če
            odkrijemo, da je otrok oddal podatke, jih bomo takoj izbrisali.
          </Text>

          <Text style={styles.sectionTitle}>8. Mednarodna Prenosa</Text>
          <Text style={styles.paragraph}>
            Vaši podatki so shranjeni na strežnikih v Evropski Uniji (Convex - Frankfurt, Nemčija).
            Zagotavljamo ustrezno raven varstva skladno z GDPR.
          </Text>

          <Text style={styles.sectionTitle}>9. Hranjenje Podatkov</Text>
          <Text style={styles.paragraph}>
            • <Text style={styles.bold}>Aktivni Računi:</Text> Podatki se hranijo, dokler je račun
            aktiven.{"\n"}
            • <Text style={styles.bold}>Izbrisani Računi:</Text> Podatki se trajno izbrišejo v 30
            dneh.{"\n"}
            • <Text style={styles.bold}>Zakonske Zahteve:</Text> Nekateri podatki (plačila) se
            hranijo 5 let zaradi davčnih predpisov.
          </Text>

          <Text style={styles.sectionTitle}>10. Spremembe Politike</Text>
          <Text style={styles.paragraph}>
            O pomembnih spremembah te politike vas bomo obvestili po e-pošti ali v aplikaciji.
            Nadaljnja uporaba storitve pomeni sprejetje sprememb.
          </Text>

          <Text style={styles.sectionTitle}>11. Kontakt</Text>
          <Text style={styles.paragraph}>
            Za vprašanja o zasebnosti nas kontaktirajte:{"\n"}
            E-pošta: zasebnost@prhran.si{"\n"}
            Odgovarjamo v 24-48 urah.
          </Text>

          <Text style={styles.sectionTitle}>12. GDPR Skladnost</Text>
          <Text style={styles.paragraph}>
            PrHran je skladen z EU Splošno Uredbo o Varstvu Podatkov (GDPR). Vaše podatke
            obdelujemo zakonito, pošteno in pregledno.
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Z uporabo PrHran se strinjate s to politiko zasebnosti.
            </Text>
            <Text style={styles.footerText}>PrHran © 2026. Vse pravice pridržane.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a12",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 16,
    fontStyle: "italic",
  },
  intro: {
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 22,
    marginBottom: 24,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 24,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e5e7eb",
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: "700",
    color: "#fff",
  },
  footer: {
    marginTop: 40,
    marginBottom: 60,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  footerText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 8,
  },
});
