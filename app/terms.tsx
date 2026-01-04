import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { PLAN_PLUS, PLAN_FAMILY } from "@/lib/branding";
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
          <View style={styles.updateBadge}>
            <Ionicons name="time-outline" size={14} color="#9ca3af" />
            <Text style={styles.updateText}>Zadnja posodobitev: 4. januar 2026</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Osnovne informacije</Text>
            <Text style={styles.sectionText}>
              Pr'Hran je aplikacija za primerjavo cen in spremljanje prihrankov na podlagi potrjenih računov.
              Z uporabo aplikacije se strinjas s temi pogoji.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Uporabniski statusi</Text>
            <Text style={styles.sectionText}>
              Gost: 1 iskanje na dan, brez dostopa do košarice, profila, lestvice in računov.
              {"\n"}
              Free: 3 iskanja na dan, dostop do košarice, profila in skupne lestvice.
              {"\n"}
              {PLAN_PLUS}: neomejeno iskanje in slikanje izdelkov.
              {"\n"}
              {PLAN_FAMILY}: do 3 uporabniki, family lestvica, 4 računi na dan.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Prihranek in računi</Text>
            <Text style={styles.sectionText}>
              Prihranek se računa izključno iz potrjenih računov. Košarica in primerjava cen
              brez nakupa ne vplivata na letni prihranek ali lestvico.
              {"\n\n"}
              Veljaven račun mora biti dodan isti dan do 23:00, potrjen s checkboxom in ne sme
              biti duplikat (trgovina, datum, znesek).
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Plačila in naročnine</Text>
            <Text style={styles.sectionText}>
              Naročnina se obračunava mesečno in se avtomatsko podaljšuje vsak mesec,
              razen če jo ne prekličeš. Preklic je mogoč kadarkoli in velja do konca
              obračunskega obdobja. {"\n\n"}
              <Text style={styles.boldText}>POMEMBNO:</Text> Vračila plačanih naročnin niso mogoča.
              Ko kupiš Premium ali Family naročnino, je plačilo dokončno in ne moraš dobiti vračila.
              {"\n\n"}
              Naročnina se avtomatsko podaljšuje vsak mesec, dokler je ne prekličeš v nastavitvah profila.
              Če prekličeš naročnino, ostane aktivna do konca obračunskega obdobja.
              {"\n\n"}
              Cene so navedene z DDV.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Vsebina in omejitve</Text>
            <Text style={styles.sectionText}>
              Prikazane cene so informativne narave. Ne jamčimo za popolno točnost ali
              razpoložljivost izdelkov. Uporabnik naj cene preveri tudi v trgovini.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Varstvo podatkov</Text>
            <Text style={styles.sectionText}>
              Shranjujemo e-naslov, vzdevek, podatke o uporabi in račune, kadar jih uporabnik doda.
              Podatkov ne prodajamo tretjim osebam. Več informacij je na voljo pri podpori.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Pravica do sprememb pogojev</Text>
            <Text style={styles.sectionText}>
              <Text style={styles.boldText}>PRIDRŽUJEMO SI PRAVICO</Text> do spremembe teh pogojev uporabe kadarkoli in brez predhodnega obvestila.
              {"\n\n"}
              V primeru pomembnih sprememb bodo uporabniki obveščeni preko e-pošte ali push obvestila v aplikaciji.
              Pomembne spremembe vključujejo (vendar niso omejene na): spremembe cen, spremembe funkcionalnosti, spremembe pravic uporabnikov, spremembe varstva podatkov.
              {"\n\n"}
              <Text style={styles.boldText}>OBVEZNOST PONOVNEGA STRINJANJA:</Text> V primeru pomembnih sprememb boste ob naslednji prijavi pozvani, da ponovno preberete in sprejmete posodobljene pogoje. Brez ponovnega strinjanja nadaljnja uporaba aplikacije ne bo mogoča.
              {"\n\n"}
              Z nadaljevanjem uporabe aplikacije po objavi sprememb se strinjate z novimi pogoji.
              Če se z novimi pogoji ne strinjate, lahko kadarkoli prenehate uporabljati aplikacijo in izbrišete svoj račun v nastavitvah profila.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Prekinitev uporabe in izbris računa</Text>
            <Text style={styles.sectionText}>
              Uporabnik lahko kadarkoli prekine uporabo aplikacije in izbriše svoj račun v nastavitvah profila.
              {"\n\n"}
              <Text style={styles.boldText}>IZBRIS PODATKOV:</Text> Po izbrisu računa bodo vsi vaši osebni podatki (e-naslov, vzdevek, računi, prihranki) trajno odstranjeni iz naših sistemov v 30 dneh.
              Anonimni podatki o uporabi (brez osebnih podatkov) se lahko ohranijo za statistične namene.
              {"\n\n"}
              <Text style={styles.boldText}>PREKINITEV NAROČNINE:</Text> Če imate aktivno Premium ali Family naročnino, se ta ob izbrisu računa avtomatsko prekliče. Vračilo plačanih zneskov ni mogoče.
              {"\n\n"}
              Pridržujemo si pravico do prekinitve računa ali dostopa do aplikacije v primeru kršenja teh pogojev, zlorabe funkcionalnosti ali nezakonitih dejanj.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Omejitev odgovornosti</Text>
            <Text style={styles.sectionText}>
              Aplikacija Pr'Hran je zagotovljena "tak kot je" (as-is) brez kakršnih koli jamstev, izrecnih ali implicitnih.
              {"\n\n"}
              <Text style={styles.boldText}>NE JAMČIMO:</Text>
              {"\n"}- Popolne točnosti prikazanih cen in informacij o izdelkih
              {"\n"}- Neprekinjenega delovanja aplikacije
              {"\n"}- Razpoložljivosti izdelkov v trgovinah
              {"\n"}- Ujemanja cen v aplikaciji s cenami v fizičnih trgovinah
              {"\n\n"}
              <Text style={styles.boldText}>ODGOVORNOST:</Text> V največji meri, ki jo dopušča zakon, nismo odgovorni za kakršno koli škodo, izgubo dobička, izgubo podatkov ali drugo posredno škodo, ki bi nastala zaradi uporabe ali nezmožnosti uporabe aplikacije.
              {"\n\n"}
              Uporabnik je odgovoren za preverjanje cen in informacij pred nakupom v fizični trgovini.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Intelektualna lastnina</Text>
            <Text style={styles.sectionText}>
              Vsa vsebina v aplikaciji Pr'Hran (besedila, grafike, logotipi, ikone, slike, avdio ali video vsebina) je zaščitena z zakoni o avtorskih pravicah in je last Pr'Hran ali njenih dobaviteljev vsebine.
              {"\n\n"}
              Uporabnikom je dovoljeno uporabljati aplikacijo izključno za osebne, nekomercialne namene. Prepovedano je:
              {"\n"}- Kopiranje, reprodukcija ali redistribucija vsebine brez pisnega dovoljenja
              {"\n"}- Uporaba robotov, skraperjev ali avtomatiziranih sistemov za pridobivanje podatkov
              {"\n"}- Prodaja, dajanje v najem ali prenos aplikacije tretjim osebam
              {"\n"}- Spreminjanje, dekompilacija ali reverzni inženiring aplikacije
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Zakon in pristojnost</Text>
            <Text style={styles.sectionText}>
              Ti pogoji uporabe se urejajo in razlagajo v skladu z zakoni Republike Slovenije.
              {"\n\n"}
              Vsi spori, ki bi nastali v zvezi s temi pogoji ali uporabo aplikacije, se rešujejo pred pristojnimi sodišči v Sloveniji.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>12. Kontakt in podpora</Text>
            <Text style={styles.sectionText}>
              Za vprašanja, pritožbe ali zahteve glede teh pogojev ali delovanja aplikacije nas kontaktirajte na:
              {"\n\n"}
              <Text style={styles.boldText}>E-pošta:</Text> support@prhran.com
              {"\n\n"}
              <Text style={styles.boldText}>Podjetje:</Text> Pr'Hran, Slovenija
              {"\n\n"}
              Odgovorili bomo v 5 delovnih dneh.
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
    gap: 8,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
  },
  updateText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  section: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 20,
  },
  boldText: {
    fontWeight: "800",
    color: "#fbbf24",
  },
});
