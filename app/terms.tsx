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
            <Text style={[styles.sectionTitle, { fontSize: 14, color: "#60a5fa" }]}>đź‡Şđź‡ş GDPR - Varstvo podatkov</Text>
            <Text style={[styles.sectionText, { fontSize: 13 }]}>
              Ta aplikacija upoĹˇteva SploĹˇno uredbo o varstvu podatkov (GDPR) in slovensko Zakon o varstvu osebnih podatkov (ZVOP-2). 
              VaĹˇe pravice vkljuÄŤujejo dostop, popravek, izbris in prenos podatkov. VeÄŤ v razdelku 6.
            </Text>
          </View>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. SploĹˇne doloÄŤbe in identifikacija</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>1.1 Ponudnik storitve</Text>{"\n"}
              Pr'Hran je demonstracijska aplikacija za primerjavo cen. 
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>1.2 Sprejemanje pogojev</Text>{"\n"}
              Z uporabo aplikacije se strinjate s temi pogoji. ÄŚe se ne strinjate, aplikacije ne smete uporabljati.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>1.3 Starostna omejitev</Text>{"\n"}
              Aplikacija je namenjena uporabnikom, starim 16 let ali veÄŤ, skladno z GDPR.
            </Text>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Opis storitve in pravna opozorila</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>2.1 Storitve</Text>{"\n"}
              â€˘ Primerjava cen Ĺľivilskih izdelkov{"\n"}
              â€˘ Prikaz aktivnih kuponov in akcij{"\n"}
              â€˘ Nakupovalni seznami{"\n"}
              â€˘ IzraÄŤun prihrankov{"\n"}
              â€˘ AI razpoznava izdelkov (Premium){"\n"}
              â€˘ Premium funkcije za naroÄŤnike
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>2.2 Omejitev odgovornosti za cene</Text>{"\n"}
              Prikazane cene so informativne narave. Ne odgovarjamo za toÄŤnost cen ali njihovo aktualnost. Dejanske cene v trgovinah se lahko razlikujejo. Uporabnik sam preveri ceno pred nakupom.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>2.3 Blagovne znamke</Text>{"\n"}
              Vsi logotipi, imena trgovin in izdelkov so last njihovih lastnikov. Uporaba je v informativne namene skladno s ÄŤlenom 52 Zakona o industrijski lastnini (ZIL-1).
            </Text>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. UporabniĹˇki raÄŤun in varnost</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>3.1 Registracija</Text>{"\n"}
              Odgovorni ste za:
              {"\n"}
              â€˘ Varovanje prijavnih podatkov{"\n"}
              â€˘ Vse aktivnosti pod raÄŤunom{"\n"}
              â€˘ TakojĹˇnje obvestilo o nepooblaĹˇÄŤeni uporabi
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>3.2 Gostovni naÄŤin</Text>{"\n"}
              Gostje imajo omejen dostop (1 izdelek, 4-urna omejitev). Za polno funkcionalnost potrebujete raÄŤun.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>3.3 Prepoved zlorabe</Text>{"\n"}
              Prepovedano je:
              {"\n"}
              â€˘ Ustvarjanje veÄŤ raÄŤunov za izogibanje omejitvam{"\n"}
              â€˘ Avtomatsko pridobivanje podatkov (scraping){"\n"}
              â€˘ Manipulacija z GEO-lock varnostjo{"\n"}
              â€˘ Deljena uporaba PrHran Family izven druĹľine
            </Text>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Premium naroÄŤnina in plaÄŤila</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>4.1 Cenovna plana</Text>{"\n"}
              â€˘ PrHran Plus: 1,99â‚¬/mesec (1 uporabnik){"\n"}
              â€˘ {PLAN_PLUS}: 1,99â‚¬/mesec (1 uporabnik){"\n"}
              â€˘ {PLAN_FAMILY}: 2,99â‚¬/mesec (do 3 uporabnikov){"\n"}
              â€˘ DDV je vkljuÄŤen v ceno (22% v Sloveniji)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>4.2 ObraÄŤunavanje</Text>{"\n"}
              â€˘ MeseÄŤno obraÄŤunavanje{"\n"}
              {"\n"}
              <Text style={{ fontWeight: "700" }}>4.3 Kaj vkljuÄŤujejo paketi</Text>{"\n"}
              â€˘ {PLAN_FREE}: {" "}3 brezplaÄŤna iskanja na dan{"\n"}
              â€˘ {PLAN_PLUS}: {" "}neomejeno iskanje, slikanje izdelkov, ekskluzivni kuponi, obvestila o cenah, sledenje prihrankom, prednostna podpora{"\n"}
              â€˘ {PLAN_FAMILY}: {" "}vse iz {PLAN_PLUS} + do 3 uporabniki in deljenje seznamov v Ĺľivo{"\n"}
              â€˘ Samodejno podaljĹˇanje razen ÄŤe prekliÄŤete{"\n"}
              â€˘ Prvi zaseg ob naroÄŤilu, nato meseÄŤno{"\n"}
              â€˘ RaÄŤun je dosegljiv v aplikaciji
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>4.3 Pravica do odstopa (ZVPS-1)</Text>{"\n"}
              Skladno z Zakonom o varstvu potroĹˇnikov (ZVPS-1) imate pravico do odstopa od pogodbe v 14 dneh brez navedbe razloga. Za vraÄŤilo poĹˇljite zahtevo na support@prhran.com.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>4.4 Preklic naroÄŤnine</Text>{"\n"}
              Kadarkoli v Nastavitvah {">"} Premium {">"} PrekliÄŤi. Dostop ostane do konca obraÄŤunskega obdobja.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. ToÄŤnost podatkov in odgovornost</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>5.1 Prikazane cene</Text>{"\n"}
              Cene so informativne narave in pridobljene iz javnih virov. Ne jamÄŤimo za:
              {"\n"}
              â€˘ Popolno toÄŤnost prikazanih cen{"\n"}
              â€˘ Aktualnost podatkov{"\n"}
              â€˘ RazpoloĹľljivost izdelkov
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>5.2 Opozorilo potroĹˇnikom</Text>{"\n"}
              Dejanske cene v trgovinah se lahko razlikujejo. Vedno preverite ceno pred nakupom. Ne prevzemamo odgovornosti za razlike med prikazanimi in dejanskimi cenami.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>5.3 Kuponi</Text>{"\n"}
              Veljavnost in pogoji kuponov se lahko spremenijo. Kuponi so last trgovin in podvrĹľeni njihovim pogojem uporabe.
            </Text>
          </View>

          {/* Section 6 - GDPR Compliant */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Varstvo osebnih podatkov (GDPR/ZVOP-2)</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>6.1 Upravljavec podatkov</Text>{"\n"}
              Za demonstracijske namene - kontakt: support@prhran.com
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.2 Zbrani podatki</Text>{"\n"}
              â€˘ E-poĹˇtni naslov (prijava){"\n"}
              â€˘ Nakupovalni seznami{"\n"}
              â€˘ Podatki o uporabi (analytics){"\n"}
              â€˘ IP naslov in naprava (varnost){"\n"}
              â€˘ Lojalnostne kartice (opcijsko)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.3 Namen obdelave</Text>{"\n"}
              â€˘ Zagotavljanje storitve{"\n"}
              â€˘ Personalizacija izkuĹˇnje{"\n"}
              â€˘ Varnostno spremljanje{"\n"}
              â€˘ Premium funkcionalnosti{"\n"}
              â€˘ PoĹˇiljanje obvestil o cenah
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.4 Pravna podlaga</Text>{"\n"}
              â€˘ Pogodba (izvajanje storitve){"\n"}
              â€˘ Privolitev (marketing){"\n"}
              â€˘ Zakonite koristi (varnost)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.5 VaĹˇe pravice po GDPR</Text>{"\n"}
              â€˘ Dostop do podatkov (ÄŤlen 15){"\n"}
              â€˘ Popravek podatkov (ÄŤlen 16){"\n"}
              â€˘ Izbris podatkov - "pravica do pozabe" (ÄŤlen 17){"\n"}
              â€˘ Prenos podatkov (ÄŤlen 20){"\n"}
              â€˘ Ugovor obdelavi (ÄŤlen 21){"\n"}
              â€˘ PritoĹľba pri IP RS (Informacijski pooblaĹˇÄŤenec)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.6 Hramba podatkov</Text>{"\n"}
              â€˘ Aktivni raÄŤuni: dokler uporabljate storitev{"\n"}
              â€˘ Izbrisani raÄŤuni: 30 dni (backup){"\n"}
              â€˘ PlaÄŤilni podatki: 5 let (davÄŤna zakonodaja)
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>6.7 Tretje osebe</Text>{"\n"}
              Podatke delimo samo z:
              {"\n"}
              â€˘ Convex (backend hosting - EU streĹľniki){"\n"}
              â€˘ Better Auth (avtentikacija){"\n"}
              â€˘ PlaÄŤilni procesorji (Stripe/podobno)
              {"\n"}
              Ne prodajamo vaĹˇih podatkov.
            </Text>
          </View>

          {/* Section 7 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Intelektualna lastnina in blagovne znamke</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>7.1 NaĹˇa vsebina</Text>{"\n"}
              Aplikacija, logotip Pr'Hran, koda in original grafike so zaĹˇÄŤiteni z avtorskimi pravicami.
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>7.2 Blagovne znamke trgovin</Text>{"\n"}
              Vsi logotipi, imena in znamke trgovin (Spar, Mercator, TuĹˇ, Hofer, Lidl, Jager) so last njihovih imetnikov. Uporaba v aplikaciji je:
              {"\n"}
              â€˘ V informativne namene (primerjava cen){"\n"}
              â€˘ Skladno s ÄŤlenom 52 ZIL-1 (uporaba za identifikacijo){"\n"}
              â€˘ Brez namena zavajanja potroĹˇnikov{"\n"}
              â€˘ Brez trditve o povezavi ali sponzorstvu
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
              V najveÄŤji meri dovoljeni z zakonom:
              {"\n"}
              â€˘ Ne jamÄŤimo za neprekinjeno delovanje{"\n"}
              â€˘ Ne odgovarjamo za netoÄŤne podatke tretjih oseb{"\n"}
              â€˘ Ne odgovarjamo za posredno Ĺˇkodo{"\n"}
              â€˘ NaĹˇa odgovornost je omejena na plaÄŤano naroÄŤnino
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>8.2 IzkljuÄŤitev odgovornosti</Text>{"\n"}
              Ne odgovarjamo za:
              {"\n"}
              â€˘ Razlike med prikazanimi in dejanskimi cenami{"\n"}
              â€˘ Neveljavne kupone ali akcije{"\n"}
              â€˘ Izgubo dobiÄŤka zaradi uporabe aplikacije{"\n"}
              â€˘ OdloÄŤitve o nakupu na podlagi naĹˇih podatkov
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>8.3 Varovanje potroĹˇnikov</Text>{"\n"}
              Ta omejitev ne vpliva na vaĹˇe zakonske pravice po ZVPS-1.
            </Text>
          </View>

          {/* Section 9 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Spremembe pogojev</Text>
            <Text style={styles.sectionText}>
              O bistvenih spremembah vas bomo obvestili:
              {"\n\n"}
              â€˘ Preko e-poĹˇte (30 dni vnaprej){"\n"}
              â€˘ Z obvestilom v aplikaciji{"\n"}
              â€˘ Posodobljen datum na vrhu dokumenta
              {"\n\n"}
              Nadaljnja uporaba po spremembah pomeni strinjanje. ÄŚe se ne strinjate, lahko prekliÄŤete raÄŤun.
            </Text>
          </View>

          {/* Section 10 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. ReĹˇevanje sporov in pravo</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>10.1 Veljavno pravo</Text>{"\n"}
              Za te pogoje velja pravo Republike Slovenije in EU direktive (vkljuÄŤno z GDPR).
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>10.2 Pristojnost</Text>{"\n"}
              Morebitne spore bomo reĹˇevali sporazumno. ÄŚe to ni mogoÄŤe:
              {"\n"}
              â€˘ PotroĹˇniki: sodiĹˇÄŤe po vaĹˇem prebivaliĹˇÄŤu (ZVPS-1){"\n"}
              â€˘ Poslovni uporabniki: sodiĹˇÄŤe v Ljubljani
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>10.3 Izvensodno reĹˇevanje</Text>{"\n"}
              PotroĹˇniki lahko uporabite platformo ODR (Online Dispute Resolution):
              {"\n"}
              https://ec.europa.eu/consumers/odr
              {"\n\n"}
              Ali kontaktirate Varuh pravic potroĹˇnikov RS:
              {"\n"}
              https://www.gov.si/drzavni-organi/organi-v-sestavi/varuh-pravic-potrosnikov/
            </Text>
          </View>

          {/* Section 11 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Kontaktni podatki</Text>
            <Text style={styles.sectionText}>
              <Text style={{ fontWeight: "700" }}>SploĹˇna vpraĹˇanja:</Text>{"\n"}
              E-poĹˇta: support@prhran.com
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>GDPR zahteve (dostop, izbris, itd.):</Text>{"\n"}
              E-poĹˇta: support@prhran.com
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>PlaÄŤila in naroÄŤnine:</Text>{"\n"}
              E-poĹˇta: support@prhran.com
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>Pravne zadeve:</Text>{"\n"}
              E-poĹˇta: support@prhran.com
              {"\n\n"}
              <Text style={{ fontWeight: "700" }}>ÄŚas odziva:</Text> 48 ur (2 delovna dneva)
            </Text>
          </View>

          {/* Section 12 - Compliance Summary */}
          <View style={[styles.section, { backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.3)", borderRadius: 12, padding: 16 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 14, color: "#10b981" }]}>âś… Skladnost z zakoni</Text>
            <Text style={[styles.sectionText, { fontSize: 12 }]}>
              Ta dokument je skladen z:
              {"\n"}
              â€˘ GDPR (EU 2016/679) - varstvo podatkov{"\n"}
              â€˘ ZVOP-2 - slovenski zakon o varstvu podatkov{"\n"}
              â€˘ ZVPS-1 - zakon o varstvu potroĹˇnikov{"\n"}
              â€˘ ZIL-1 - zakon o industrijski lastnini{"\n"}
              â€˘ ZEKom-1 - zakon o elektronskem poslovanju{"\n"}
              â€˘ Direktiva o pravicah potroĹˇnikov (2011/83/EU)
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              âš–ď¸Ź Z uporabo aplikacije Pr'Hran potrjujete, da ste prebrali, razumeli in se strinjate s temi Pogoji uporabe.
              {"\n\n"}
              VaĹˇe pravice kot potroĹˇnika so zaĹˇÄŤitene z zakoni Republike Slovenije in EU.
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

