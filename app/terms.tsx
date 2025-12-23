import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
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
            <Text style={styles.updateText}>Zadnja posodobitev: 13. december 2024</Text>
          </View>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Splošne določbe</Text>
            <Text style={styles.sectionText}>
              Ti pogoji uporabe ("Pogoji") urejajo uporabo mobilne aplikacije Pr'Hran ("Aplikacija"), ki jo upravlja podjetje Pr'Hran d.o.o. ("Mi", "Nas", "Naš").
              {"\n\n"}
              Z uporabo Aplikacije se strinjate s temi Pogoji. Če se s Pogoji ne strinjate, Aplikacije ne smete uporabljati.
            </Text>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Opis storitve</Text>
            <Text style={styles.sectionText}>
              Pr'Hran je aplikacija za primerjavo cen živilskih izdelkov v slovenskih trgovinah. Storitev vključuje:
              {"\n\n"}
              • Primerjavo cen izdelkov med trgovinami{"\n"}
              • Prikaz aktivnih kuponov in akcij{"\n"}
              • Ustvarjanje nakupovalnih seznamov{"\n"}
              • Izračun prihrankov{"\n"}
              • Premium funkcije za naročnike
            </Text>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Uporabniški račun</Text>
            <Text style={styles.sectionText}>
              Za uporabo določenih funkcij Aplikacije morate ustvariti uporabniški račun. Odgovorni ste za:
              {"\n\n"}
              • Varovanje svojih prijavnih podatkov{"\n"}
              • Vse aktivnosti, ki se izvajajo pod vašim računom{"\n"}
              • Takojšnje obvestilo o nepooblaščeni uporabi
              {"\n\n"}
              Pridržujemo si pravico do ukinitve računa v primeru kršitve teh Pogojev.
            </Text>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Premium naročnina</Text>
            <Text style={styles.sectionText}>
              Premium naročnina je plačljiva storitev, ki vključuje dodatne funkcije. Ponujamo dva plana:
              {"\n\n"}
              • Premium Solo: 1,99€ na mesec (1 uporabnik){"\n"}
              • Premium Family: 2,99€ na mesec (do 3 uporabniki){"\n"}
              • Obračunsko obdobje: mesečno{"\n"}
              • Preklic: kadarkoli, brez dodatnih stroškov{"\n"}
              • Po preklicu: dostop do konca obračunskega obdobja
              {"\n\n"}
              Plačila se izvajajo preko Apple Pay, Google Pay ali kreditne kartice. Vračilo sredstev je možno v skladu z zakonodajo o varstvu potrošnikov.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Točnost podatkov</Text>
            <Text style={styles.sectionText}>
              Cene in podatke o izdelkih pridobivamo iz javno dostopnih virov trgovin. Čeprav si prizadevamo za točnost:
              {"\n\n"}
              • Ne jamčimo za popolno točnost cen{"\n"}
              • Cene se lahko razlikujejo od dejanskih cen v trgovini{"\n"}
              • Priporočamo preverjanje cen pred nakupom{"\n"}
              • Nismo odgovorni za morebitne razlike v cenah
            </Text>
          </View>

          {/* Section 6 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Varstvo osebnih podatkov</Text>
            <Text style={styles.sectionText}>
              Vaše osebne podatke obdelujemo v skladu z Uredbo (EU) 2016/679 (GDPR) in Zakonom o varstvu osebnih podatkov (ZVOP-2). Zbiramo in obdelujemo:
              {"\n\n"}
              • E-poštni naslov (za prijavo){"\n"}
              • Podatke o nakupovalnih seznamih{"\n"}
              • Številke lojalnostnih kartic (opcijsko){"\n"}
              • Podatke o uporabi aplikacije
              {"\n\n"}
              Vaših podatkov ne prodajamo tretjim osebam. Več informacij najdete v naši Politiki zasebnosti.
            </Text>
          </View>

          {/* Section 7 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Intelektualna lastnina</Text>
            <Text style={styles.sectionText}>
              Vsa vsebina Aplikacije, vključno z logotipi, besedili, grafiko in programsko kodo, je zaščitena z avtorskimi pravicami in je last Pr'Hran d.o.o.
              {"\n\n"}
              Brez našega pisnega dovoljenja ni dovoljeno:
              {"\n\n"}
              • Kopiranje ali reproduciranje vsebine{"\n"}
              • Spreminjanje ali ustvarjanje izpeljanih del{"\n"}
              • Distribucija ali javno prikazovanje{"\n"}
              • Komercialna uporaba vsebine
            </Text>
          </View>

          {/* Section 8 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Omejitev odgovornosti</Text>
            <Text style={styles.sectionText}>
              Aplikacija je zagotovljena "takšna kot je". V največji možni meri, ki jo dovoljuje zakon:
              {"\n\n"}
              • Ne jamčimo za neprekinjeno delovanje{"\n"}
              • Ne odgovarjamo za posredno škodo{"\n"}
              • Naša odgovornost je omejena na znesek plačane naročnine
              {"\n\n"}
              Ta omejitev ne vpliva na vaše zakonske pravice kot potrošnika.
            </Text>
          </View>

          {/* Section 9 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Spremembe pogojev</Text>
            <Text style={styles.sectionText}>
              Pridržujemo si pravico do spremembe teh Pogojev. O bistvenih spremembah vas bomo obvestili:
              {"\n\n"}
              • Preko e-pošte{"\n"}
              • Z obvestilom v Aplikaciji{"\n"}
              • Najmanj 30 dni pred uveljavitvijo
              {"\n\n"}
              Nadaljnja uporaba Aplikacije po uveljavitvi sprememb pomeni strinjanje z novimi Pogoji.
            </Text>
          </View>

          {/* Section 10 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Reševanje sporov</Text>
            <Text style={styles.sectionText}>
              Za te Pogoje velja pravo Republike Slovenije. Morebitne spore bomo reševali sporazumno. Če to ni mogoče, je pristojno sodišče v Ljubljani.
              {"\n\n"}
              Kot potrošnik imate pravico do izvensodnega reševanja sporov. Več informacij: https://ec.europa.eu/odr
            </Text>
          </View>

          {/* Section 11 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Kontakt</Text>
            <Text style={styles.sectionText}>
              Za vprašanja glede teh Pogojev nas kontaktirajte:
              {"\n\n"}
              Pr'Hran d.o.o.{"\n"}
              E-pošta: podpora@prhran.si{"\n"}
              {"\n"}
              Matična številka: 12345678{"\n"}
              Davčna številka: SI12345678
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Z uporabo aplikacije Pr'Hran potrjujete, da ste prebrali, razumeli in se strinjate s temi Pogoji uporabe.
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
