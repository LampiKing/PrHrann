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
            <Text style={styles.updateText}>Zadnja posodobitev: 24. december 2024</Text>
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
              Naročnina se obračunava mesečno. Preklic je mogoč kadarkoli in velja do konca
              obračunskega obdobja. Cene so navedene z DDV.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Vsebina in omejitve</Text>
            <Text style={styles.sectionText}>
              Prikazane cene so informativne narave. Ne jamcimo za popolno tocnost ali
              razpoložljivost izdelkov. Uporabnik naj cene preveri tudi v trgovini.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Varstvo podatkov</Text>
            <Text style={styles.sectionText}>
              Shranjujemo e-naslov, vzdevek, podatke o uporabi in račune, kadar jih uporabnik doda.
              Podatkov ne prodajamo tretjim osebam. Vec informacij je na voljo pri podpori.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Kontakt</Text>
            <Text style={styles.sectionText}>
              Vprasanja in zahteve: support@prhran.com
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
});
