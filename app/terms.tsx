import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { PLAN_FREE, PLAN_PLUS, PLAN_FAMILY } from "@/lib/branding";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function TermsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pogoji uporabe</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Last Updated */}
          <View style={styles.updateBadge}>
            <Ionicons name="time-outline" size={14} color="#9ca3af" />
            <Text style={styles.updateText}>Zadnja posodobitev: 24. december 2024</Text>
          </View>

          {/* GDPR Notice */}
          <View style={[styles.section, { backgroundColor: "rgba(59, 130, 246, 0.1)", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.3)" }]}>
            <Text style={[styles.sectionTitle, { fontSize: 14, color: "#60a5fa" }]}>🇪🇺 GDPR - Varstvo podatkov</Text>
            <Text style={[styles.sectionText, { fontSize: 13 }]}>
              Ta aplikacija upošteva Splošno uredbo o varstvu podatkov (GDPR) in slovensko Zakon o varstvu osebnih podatkov (ZVOP-2). 
              Vaše pravice vključujejo dostop, popravek, izbris in prenos podatkov. Več v razdelku 6.
            </Text>
          </View>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Splošne določbe in identifikacija</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>1.1 Ponudnik storitve</Text>{"\n"}
              Pr'Hran je demonstracijska aplikacija za primerjavo cen. 
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>1.2 Sprejemanje pogojev</Text>{"\n"}
              Z uporabo aplikacije se strinjate s temi pogoji. Če se ne strinjate, aplikacije ne smete uporabljati.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>1.3 Starostna omejitev</Text>{"\n"}
              Aplikacija je namenjena uporabnikom, starim 16 let ali več, skladno z GDPR.
            </Text>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Opis storitve in pravna opozorila</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>2.1 Storitve</Text>{"\n"}
              • Primerjava cen živilskih izdelkov{"\n"}
              • Prikaz aktivnih kuponov in akcij{"\n"}
              • Nakupovalni seznami{"\n"}
              • Izračun prihrankov{"\n"}
              • AI razpoznava izdelkov (Premium){"\n"}
              • Premium funkcije za naročnike
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>2.2 Omejitev odgovornosti za cene</Text>{"\n"}
              Prikazane cene so informativne narave. Ne odgovarjamo za točnost cen ali njihovo aktualnost. Dejanske cene v trgovinah se lahko razlikujejo. Uporabnik sam preveri ceno pred nakupom.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>2.3 Blagovne znamke</Text>{"\n"}
              Vsi logotipi, imena trgovin in izdelkov so last njihovih lastnikov. Uporaba je v informativne namene skladno s členom 52 Zakona o industrijski lastnini (ZIL-1).
            </Text>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Uporabniški račun in varnost</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>3.1 Registracija</Text>{"\n"}
              Odgovorni ste za:
              {"\n"}
              • Varovanje prijavnih podatkov{"\n"}
              • Vse aktivnosti pod računom{"\n"}
              • Takojšnje obvestilo o nepooblaščeni uporabi
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>3.2 Gostovni način</Text>{"\n"}
              Gostje imajo omejen dostop (1 izdelek, 4-urna omejitev). Za polno funkcionalnost potrebujete račun.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>3.3 Prepoved zlorabe</Text>{"\n"}
              Prepovedano je:
              {"\n"}
              • Ustvarjanje več računov za izogibanje omejitvam{"\n"}
              • Avtomatsko pridobivanje podatkov (scraping){"\n"}
              • Manipulacija z GEO-lock varnostjo{"\n"}
              • Deljena uporaba PrHran Family izven družine
            </Text>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Premium naročnina in plačila</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>4.1 Cenovna plana</Text>{"\n"}
              • PrHran Plus: 1,99€/mesec (1 uporabnik){"\n"}
              • {PLAN_PLUS}: 1,99€/mesec (1 uporabnik){"\n"}
              • {PLAN_FAMILY}: 2,99€/mesec (do 3 uporabnikov){"\n"}
              • DDV je vključen v ceno (22% v Sloveniji)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>4.2 Obračunavanje</Text>{"\n"}
              • Mesečno obračunavanje{"\n"}
              {"\n"}
              <Text style={{ fontWeight: "700" }}>4.3 Kaj vključujejo paketi</Text>{"\n"}
              • {PLAN_FREE}: {" "}3 brezplačna iskanja na dan{"\n"}
              • {PLAN_PLUS}: {" "}neomejeno iskanje, slikanje izdelkov, ekskluzivni kuponi, obvestila o cenah, sledenje prihrankom, prednostna podpora{"\n"}
              • {PLAN_FAMILY}: {" "}vse iz {PLAN_PLUS} + do 3 uporabniki in deljenje seznamov v živo{"\n"}
              • Samodejno podaljšanje razen če prekličete{"\n"}
              • Prvi zaseg ob naročilu, nato mesečno{"\n"}
              • Račun je dosegljiv v aplikaciji
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>4.3 Pravica do odstopa (ZVPS-1)</Text>{"\n"}
              Skladno z Zakonom o varstvu potrošnikov (ZVPS-1) imate pravico do odstopa od pogodbe v 14 dneh brez navedbe razloga. Za vračilo pošljite zahtevo na support@prhran.si.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>4.4 Preklic naročnine</Text>{"\n"}
              Kadarkoli v Nastavitvah {">"} Premium {">"} Prekliči. Dostop ostane do konca obračunskega obdobja.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Točnost podatkov in odgovornost</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>5.1 Prikazane cene</Text>{"\n"}
              Cene so informativne narave in pridobljene iz javnih virov. Ne jamčimo za:
              {"\n"}
              • Popolno točnost prikazanih cen{"\n"}
              • Aktualnost podatkov{"\n"}
              • Razpoložljivost izdelkov
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>5.2 Opozorilo potrošnikom</Text>{"\n"}
              Dejanske cene v trgovinah se lahko razlikujejo. Vedno preverite ceno pred nakupom. Ne prevzemamo odgovornosti za razlike med prikazanimi in dejanskimi cenami.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>5.3 Kuponi</Text>{"\n"}
              Veljavnost in pogoji kuponov se lahko spremenijo. Kuponi so last trgovin in podvrženi njihovim pogojem uporabe.
            </Text>
          </View>

          {/* Section 6 - GDPR Compliant */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Varstvo osebnih podatkov (GDPR/ZVOP-2)</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>6.1 Upravljavec podatkov</Text>{"\n"}
              Za demonstracijske namene - kontakt: support@prhran.si
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.2 Zbrani podatki</Text>{"\n"}
              • E-poštni naslov (prijava){"\n"}
              • Nakupovalni seznami{"\n"}
              • Podatki o uporabi (analytics){"\n"}
              • IP naslov in naprava (varnost){"\n"}
              • Lojalnostne kartice (opcijsko)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.3 Namen obdelave</Text>{"\n"}
              • Zagotavljanje storitve{"\n"}
              • Personalizacija izkušnje{"\n"}
              • Varnostno spremljanje{"\n"}
              • Premium funkcionalnosti{"\n"}
              • Pošiljanje obvestil o cenah
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.4 Pravna podlaga</Text>{"\n"}
              • Pogodba (izvajanje storitve){"\n"}
              • Privolitev (marketing){"\n"}
              • Zakonite koristi (varnost)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.5 Vaše pravice po GDPR</Text>{"\n"}
              • Dostop do podatkov (člen 15){"\n"}
              • Popravek podatkov (člen 16){"\n"}
              • Izbris podatkov - "pravica do pozabe" (člen 17){"\n"}
              • Prenos podatkov (člen 20){"\n"}
              • Ugovor obdelavi (člen 21){"\n"}
              • Pritožba pri IP RS (Informacijski pooblaščenec)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.6 Hramba podatkov</Text>{"\n"}
              • Aktivni računi: dokler uporabljate storitev{"\n"}
              • Izbrisani računi: 30 dni (backup){"\n"}
              • Plačilni podatki: 5 let (davčna zakonodaja)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.7 Tretje osebe</Text>{"\n"}
              Podatke delimo samo z:
              {"\n"}
              • Convex (backend hosting - EU strežniki){"\n"}
              • Better Auth (avtentikacija){"\n"}
              • Plačilni procesorji (Stripe/podobno)
              {"\n"}
              Ne prodajamo vaših podatkov.
            </Text>
          </View>

          {/* Section 7 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Intelektualna lastnina in blagovne znamke</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>7.1 Naša vsebina</Text>{"\n"}
              Aplikacija, logotip Pr'Hran, koda in original grafike so zaščiteni z avtorskimi pravicami.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>7.2 Blagovne znamke trgovin</Text>{"\n"}
              Vsi logotipi, imena in znamke trgovin (Spar, Mercator, Tuš, Hofer, Lidl, Jager) so last njihovih imetnikov. Uporaba v aplikaciji je:
              {"\n"}
              • V informativne namene (primerjava cen){"\n"}
              • Skladno s členom 52 ZIL-1 (uporaba za identifikacijo){"\n"}
              • Brez namena zavajanja potrošnikov{"\n"}
              • Brez trditve o povezavi ali sponzorstvu
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>7.3 Izjava o nepovezanosti</Text>{"\n"}
              Pr'Hran NI povezan z navedenimi trgovinami in ne zastopa njihovih interesov. Smo neodvisna primerjalna platforma.
            </Text>
          </View>

          {/* Section 8 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Omejitev odgovornosti</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>8.1 Zagotovljeno "kot je"</Text>{"\n"}
              V največji meri dovoljeni z zakonom:
              {"\n"}
              • Ne jamčimo za neprekinjeno delovanje{"\n"}
              • Ne odgovarjamo za netočne podatke tretjih oseb{"\n"}
              • Ne odgovarjamo za posredno škodo{"\n"}
              • Naša odgovornost je omejena na plačano naročnino
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>8.2 Izključitev odgovornosti</Text>{"\n"}
              Ne odgovarjamo za:
              {"\n"}
              • Razlike med prikazanimi in dejanskimi cenami{"\n"}
              • Neveljavne kupone ali akcije{"\n"}
              • Izgubo dobička zaradi uporabe aplikacije{"\n"}
              • Odločitve o nakupu na podlagi naših podatkov
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>8.3 Varovanje potrošnikov</Text>{"\n"}
              Ta omejitev ne vpliva na vaše zakonske pravice po ZVPS-1.
            </Text>
          </View>

          {/* Section 9 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Spremembe pogojev</Text>
            <Text style={styles.sectionText}>
              O bistvenih spremembah vas bomo obvestili:
              {"\n\n"}
              • Preko e-pošte (30 dni vnaprej){"\n"}
              • Z obvestilom v aplikaciji{"\n"}
              • Posodobljen datum na vrhu dokumenta
              {"\n\n"}
              Nadaljnja uporaba po spremembah pomeni strinjanje. Če se ne strinjate, lahko prekličete račun.
            </Text>
          </View>

          {/* Section 10 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Reševanje sporov in pravo</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>10.1 Veljavno pravo</Text>{"\n"}
              Za te pogoje velja pravo Republike Slovenije in EU direktive (vključno z GDPR).
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>10.2 Pristojnost</Text>{"\n"}
              Morebitne spore bomo reševali sporazumno. Če to ni mogoče:
              {"\n"}
              • Potrošniki: sodišče po vašem prebivališču (ZVPS-1){"\n"}
              • Poslovni uporabniki: sodišče v Ljubljani
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>10.3 Izvensodno reševanje</Text>{"\n"}
              Potrošniki lahko uporabite platformo ODR (Online Dispute Resolution):
              {"\n"}
              https://ec.europa.eu/consumers/odr
              {"\n\n"}
              Ali kontaktirate Varuh pravic potrošnikov RS:
              {"\n"}
              https://www.gov.si/drzavni-organi/organi-v-sestavi/varuh-pravic-potrosnikov/
            </Text>
          </View>

          {/* Section 11 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Kontaktni podatki</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>Splošna vprašanja:</Text>{"\n"}
              E-pošta: podpora@prhran.si
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>GDPR zahteve (dostop, izbris, itd.):</Text>{"\n"}
              E-pošta: gdpr@prhran.si
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>Plačila in naročnine:</Text>{"\n"}
              E-pošta: billing@prhran.si
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>Pravne zadeve:</Text>{"\n"}
              E-pošta: legal@prhran.si
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>Čas odziva:</Text> 48 ur (2 delovna dneva)
            </Text>
          </View>

          {/* Section 12 - Compliance Summary */}
          <View style={[styles.section, { backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.3)", borderRadius: 12, padding: 16 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 14, color: "#10b981" }]}>✅ Skladnost z zakoni</Text>
            <Text style={[styles.sectionText, { fontSize: 12 }]}>
              Ta dokument je skladen z:
              {"\n"}
              • GDPR (EU 2016/679) - varstvo podatkov{"\n"}
              • ZVOP-2 - slovenski zakon o varstvu podatkov{"\n"}
              • ZVPS-1 - zakon o varstvu potrošnikov{"\n"}
              • ZIL-1 - zakon o industrijski lastnini{"\n"}
              • ZEKom-1 - zakon o elektronskem poslovanju{"\n"}
              • Direktiva o pravicah potrošnikov (2011/83/EU)
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ⚖️ Z uporabo aplikacije Pr'Hran potrjujete, da ste prebrali, razumeli in se strinjate s temi Pogoji uporabe.
              {"\n\n"}
              Vaše pravice kot potrošnika so zaščitene z zakoni Republike Slovenije in EU.
            </Text>
          </View>

          <View style={{ height: 40 }} />
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  updateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  updateText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 22,
  },
  footer: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  footerText: {
    fontSize: 13,
    color: "#a78bfa",
    textAlign: "center",
    lineHeight: 20,
  },
});
