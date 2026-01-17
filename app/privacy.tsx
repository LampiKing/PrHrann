import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import FloatingBackground from "../lib/FloatingBackground";

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBackground variant="minimal" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Politika Zasebnosti</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lastUpdated}>Nazadnje posodobljeno: 17. januar 2026</Text>

          <Text style={styles.intro}>
            <Text style={styles.bold}>PrHran cenimo vašo zasebnost.</Text> Ta politika opisuje, kako
            zbiramo, uporabljamo in varujemo vaše osebne podatke v skladu z GDPR in slovensko
            zakonodajo.
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
            Plačilne podatke procesira <Text style={styles.bold}>Stripe</Text> (tretja oseba). <Text
            style={styles.bold}>MI NE SHRANJUJEMO</Text> podatkov o kreditnih karticah. Shranjujemo
            samo ID naročnine za upravljanje premium dostopa.
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
            <Text style={styles.bold}>Uporabljamo najsodobnejše tehnične in organizacijske ukrepe</Text>
            {" "}za zaščito vaših osebnih podatkov:
          </Text>
          <Text style={styles.paragraph}>
            • <Text style={styles.bold}>Šifriranje:</Text> VSI podatki so šifrirani med prenosom
            (TLS/HTTPS) in v mirovanju (AES-256).{"\n"}
            • <Text style={styles.bold}>Varna Avtentikacija:</Text> Gesla so hashirana z
            industrijskim standardom bcrypt. <Text style={styles.bold}>NIKOLI</Text> ne shranjujemo
            gesel v čitljivi obliki.{"\n"}
            • <Text style={styles.bold}>Redne Kopije:</Text> Avtomatsko varnostno kopiranje vsakih
            24 ur z šifriranim shranjevanjem.{"\n"}
            • <Text style={styles.bold}>Omejen Dostop:</Text> Samo pooblaščeno in usposobljeno
            osebje ima dostop do podatkov po principu "need-to-know".{"\n"}
            • <Text style={styles.bold}>Varnostno Spremljanje:</Text> 24/7 spremljanje sistemov za
            zaznavanje sumljivih aktivnosti.{"\n"}
            • <Text style={styles.bold}>Redne Varnostne Revizije:</Text> Izvajamo redne notranje
            preglede in posodabljamo varnostne protokole.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>OPOZORILO:</Text> Kljub našim naporom za zaščito podatkov
            noben sistem ni 100% varen. V primeru varnostnega incidenta vas bomo obvestili v <Text
            style={styles.bold}>72 urah</Text> skladno z GDPR.
          </Text>

          <Text style={styles.sectionTitle}>5. Vaše Pravice po GDPR</Text>
          <Text style={styles.paragraph}>
            Skladno z EU Splošno Uredbo o Varstvu Podatkov (GDPR) imate naslednje pravice:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>5.1. Pravica do Dostopa:</Text> Lahko zahtevate kopijo vseh
            vaših osebnih podatkov, ki jih hranimo. Posredovali vam bomo jasno strukturiran izvoz
            vaših podatkov v elektronski obliki (JSON ali CSV format).{"\n"}
            {"\n"}
            <Text style={styles.bold}>5.2. Pravica do Popravka:</Text> Podatke lahko kadarkoli
            uredite v nastavitvah profila. Če želite popraviti podatke, ki jih ne morete spreminjati
            sami, nas kontaktirajte.{"\n"}
            {"\n"}
            <Text style={styles.bold}>5.3. Pravica do Izbrisa ("Pozaba"):</Text> Račun lahko
            kadarkoli izbrišete v nastavitvah profila. <Text style={styles.bold}>VSI VAŠI OSEBNI
            PODATKI</Text> bodo trajno izbrisani v roku 30 dni. Hranili bomo samo minimalne podatke,
            ki so potrebni za zakonske obveznosti (plačilni podatki - 5 let).{"\n"}
            {"\n"}
            <Text style={styles.bold}>5.4. Pravica do Prenosljivosti Podatkov:</Text> Lahko
            zahtevate izvoz vaših podatkov v strojno berljivi obliki (JSON/CSV), kar vam omogoča
            prenos podatkov k drugemu ponudniku storitev.{"\n"}
            {"\n"}
            <Text style={styles.bold}>5.5. Pravica do Omejitve Obdelave:</Text> Lahko zahtevate, da
            začasno omejimo obdelavo vaših podatkov v določenih okoliščinah (npr. dokler preverimo
            točnost podatkov).{"\n"}
            {"\n"}
            <Text style={styles.bold}>5.6. Pravica do Ugovora:</Text> Lahko ugovarjate obdelavi
            vaših podatkov za nekatere namene (npr. marketing, profiliranje). Upoštevali bomo vaš
            ugovor, razen če imamo legitimen razlog za nadaljnjo obdelavo.{"\n"}
            {"\n"}
            <Text style={styles.bold}>5.7. Pravica do Preklica Soglasja:</Text> Če ste podali
            soglasje za obdelavo podatkov, ga lahko kadarkoli prekličete. Preklic ne vpliva na
            zakonitost obdelave pred preklicem.{"\n"}
            {"\n"}
            <Text style={styles.bold}>5.8. Pravica do Pritožbe:</Text> Če menite, da kršimo vaše
            pravice do varstva podatkov, lahko vložite pritožbo pri Informacijskem pooblaščencu
            Republike Slovenije (www.ip-rs.si).
          </Text>

          <Text style={styles.sectionTitle}>6. Piškotki in Sledenje</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Uporabljamo minimalne piškotke</Text> in tehnologije sledenja
            za naslednje namene:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>6.1. Nujno potrebni piškotki:</Text>{"\n"}
            • <Text style={styles.bold}>Avtentikacija:</Text> Shranjevanje seje prijave (session
            token) za varno identificiranje uporabnika.{"\n"}
            • <Text style={styles.bold}>Nastavitve:</Text> Zapomnitev vaših preferenc (jezik,
            prikazne nastavitve).{"\n"}
            • <Text style={styles.bold}>Varnost:</Text> Zaščita pred CSRF napadi in preverjanje
            avtentičnosti zahtev.{"\n"}
            {"\n"}
            <Text style={styles.bold}>6.2. Analitični piškotki:</Text>{"\n"}
            • <Text style={styles.bold}>Uporaba aplikacije:</Text> Zbiranje anonimiziranih podatkov
            o uporabi funkcij (število iskanj, klikov, navigacija).{"\n"}
            • <Text style={styles.bold}>Tehnična analitika:</Text> Spremljanje tehničnih težav,
            napak in zmogljivosti aplikacije.{"\n"}
            • <Text style={styles.bold}>Izboljšave:</Text> Razumevanje, katere funkcije so najbolj
            uporabljene, da lahko izboljšamo uporabniško izkušnjo.{"\n"}
            {"\n"}
            <Text style={styles.bold}>KAJ NE UPORABLJAMO:</Text>{"\n"}
            • <Text style={styles.bold}>NE uporabljamo</Text> piškotkov tretjih oseb za
            oglaševanje.{"\n"}
            • <Text style={styles.bold}>NE prodajamo</Text> podatkov o sledenju oglaševalskim
            omrežjem.{"\n"}
            • <Text style={styles.bold}>NE delimo</Text> vaših osebnih podatkov s socialnimi
            omrežji.{"\n"}
            {"\n"}
            <Text style={styles.bold}>Upravljanje piškotkov:</Text> Nujno potrebne piškotke ne
            morete izklopiti, ker so bistveni za delovanje aplikacije. Analitične piškotke lahko
            onemogočite v nastavitvah naprave ali brskalnika, vendar to lahko vpliva na delovanje
            nekaterih funkcij.
          </Text>

          <Text style={styles.sectionTitle}>7. Otroci</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Storitev ni namenjena otrokom mlajšim od 13 let.</Text> Zavestno
            ne zbiramo osebnih podatkov otrok. Če odkrijemo, da je otrok oddal podatke, jih bomo
            <Text style={styles.bold}> takoj trajno izbrisali</Text> in obvestili starše/skrbnike.
            {"\n\n"}
            Če ste starš ali skrbnik in menite, da je vaš otrok posredoval osebne podatke brez
            vašega soglasja, nas nemudoma kontaktirajte na support@prhran.com.
          </Text>

          <Text style={styles.sectionTitle}>8. Mednarodne Prenose Podatkov</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Primarna lokacija podatkov:</Text> Vaši osebni podatki so
            shranjeni na strežnikih v <Text style={styles.bold}>Evropski Uniji</Text> (Convex -
            Frankfurt, Nemčija), kar zagotavlja polno skladnost z GDPR.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Prenosi izven EU:</Text> V določenih primerih lahko vaši
            podatki preidejo izven Evropskega gospodarskega prostora (EGP):{"\n"}
            {"\n"}
            • <Text style={styles.bold}>Stripe (plačila):</Text> Stripe ima strežnike v EU, vendar
            lahko nekateri podatki prehajajo v ZDA. Stripe je certificiran po standardnih pogodbenih
            klavzulah (SCC) in zagotavlja ustrezno raven varstva.{"\n"}
            {"\n"}
            • <Text style={styles.bold}>Resend (e-pošta):</Text> Storitev za pošiljanje e-pošte
            lahko uporablja strežnike v ZDA. Uporabljamo SCC za zaščito prenosa podatkov.{"\n"}
            {"\n"}
            <Text style={styles.bold}>Zaščitni ukrepi:</Text> Pri vseh prenosih podatkov izven EU
            uporabljamo ustrezne zaščitne ukrepe:{"\n"}
            • Standardne pogodbene klavzule (SCC), ki jih odobri Evropska komisija{"\n"}
            • Preverjanje, da ponudniki storitev zagotavljajo ustrezno raven varstva podatkov{"\n"}
            • Šifriranje vseh podatkov med prenosom (TLS/SSL){"\n"}
            {"\n"}
            <Text style={styles.bold}>Vaše pravice:</Text> Ne glede na lokacijo obdelave podatkov
            ohranjate vse pravice po GDPR. Lahko zahtevate informacije o tem, kje se obdelujejo vaši
            podatki.
          </Text>

          <Text style={styles.sectionTitle}>9. Hramba Podatkov</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Hranimo vaše podatke samo toliko časa, kolikor je nujno
            potrebno</Text> za namene, za katere smo jih zbrali, ali za izpolnjevanje zakonskih
            obveznosti.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>9.1. Aktivni Računi:</Text>{"\n"}
            • <Text style={styles.bold}>Osebni podatki:</Text> Se hranijo, dokler je vaš račun
            aktiven ali dokler aktivno uporabljate storitev.{"\n"}
            • <Text style={styles.bold}>Zgodovina iskanj:</Text> Shranjujemo zadnjih 90 dni
            zgodovine iskanj za izboljšanje personalizacije.{"\n"}
            • <Text style={styles.bold}>Računi in prihranki:</Text> Se hranijo dokler jih aktivno
            uporabljate ali dokler ne izbrišete računa.{"\n"}
            {"\n"}
            <Text style={styles.bold}>9.2. Neaktivni Računi:</Text>{"\n"}
            • Če se v aplikacijo ne prijavite <Text style={styles.bold}>2 leti</Text>, vas bomo
            opozorili po e-pošti.{"\n"}
            • Če po opozorilu ne potrdite nadaljnje uporabe v <Text style={styles.bold}>60 dneh
            </Text>, bomo račun avtomatsko izbrisali.{"\n"}
            {"\n"}
            <Text style={styles.bold}>9.3. Izbrisani Računi:</Text>{"\n"}
            • Ko izbrišete račun, se <Text style={styles.bold}>VSI OSEBNI PODATKI trajno izbrišejo v
            30 dneh</Text>.{"\n"}
            • Anonimni statistični podatki (brez osebnih identifikatorjev) se lahko ohranijo za
            analizo.{"\n"}
            • <Text style={styles.bold}>POMEMBNO:</Text> Izbris je nepovraten - po izbrisu ne moremo
            obnoviti vaših podatkov.{"\n"}
            {"\n"}
            <Text style={styles.bold}>9.4. Zakonske Zahteve in Obveznosti:</Text>{"\n"}
            • <Text style={styles.bold}>Plačilni podatki:</Text> Zaradi davčnih predpisov in
            računovodskih zahtev Republike Slovenije moramo podatke o plačilih (fakture, transakcije)
            hraniti <Text style={styles.bold}>5 let</Text> po koncu koledarskega leta.{"\n"}
            • <Text style={styles.bold}>Komunikacija s podporo:</Text> Hranimo do <Text
            style={styles.bold}>2 leti</Text> za reševanje morebitnih sporov.{"\n"}
            • <Text style={styles.bold}>Varnostni incidenti:</Text> Podatki o varnostnih incidentih
            se hranijo <Text style={styles.bold}>3 leta</Text> za zagotavljanje varnosti.{"\n"}
            {"\n"}
            <Text style={styles.bold}>9.5. Varnostne Kopije:</Text>{"\n"}
            Avtomatsko ustvarjamo varnostne kopije vsakih 24 ur. Podatki v varnostnih kopijah se
            hranijo do 90 dni. Ko izbrišete podatke, se ti odstranijo tudi iz varnostnih kopij ob
            naslednji rotaciji.
          </Text>

          <Text style={styles.sectionTitle}>10. Pravica do Sprememb Politike Zasebnosti</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>PRIDRŽUJEMO SI PRAVICO</Text> do spremembe te politike
            zasebnosti kadarkoli in brez predhodnega obvestila, da lahko prilagodimo naše prakse
            varstva podatkov spremembam v zakonodaji, tehnologiji ali poslovnih potrebah.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Obveščanje o spremembah:</Text>{"\n"}
            V primeru pomembnih sprememb te politike bodo uporabniki obveščeni preko:{"\n"}
            • E-pošte na registrirani e-poštni naslov{"\n"}
            • Push obvestila v aplikaciji{"\n"}
            • Obvestilo ob naslednji prijavi v aplikacijo{"\n"}
            {"\n"}
            Pomembne spremembe vključujejo (vendar niso omejene na):{"\n"}
            • Spremembe pri zbiranju novih vrst osebnih podatkov{"\n"}
            • Spremembe namena uporabe podatkov{"\n"}
            • Spremembe pri deljenju podatkov s tretjimi osebami{"\n"}
            • Spremembe lokacije shranjevanja podatkov{"\n"}
            • Spremembe vaših pravic do zasebnosti
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>OBVEZNOST PONOVNEGA STRINJANJA:</Text> V primeru pomembnih
            sprememb, ki vplivajo na način obdelave vaših osebnih podatkov, boste ob naslednji prijavi
            pozvani, da ponovno preberete in sprejmete posodobljeno politiko. Brez ponovnega
            strinjanja nadaljnja uporaba aplikacije ne bo mogoča.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Manjše spremembe:</Text> Manjše spremembe (popravki tipkarskih
            napak, razjasnitve formulacij, posodobitve kontaktnih podatkov) ne zahtevajo ponovnega
            strinjanja. Vseeno vas bomo obvestili o teh spremembah.
          </Text>
          <Text style={styles.paragraph}>
            Z nadaljevanjem uporabe aplikacije po objavi sprememb se strinjate z novo politiko
            zasebnosti. Če se z novimi pogoji ne strinjate, lahko kadarkoli prenehate uporabljati
            aplikacijo in izbrišete svoj račun v nastavitvah profila.
          </Text>

          <Text style={styles.sectionTitle}>11. Kontakt in Podpora</Text>
          <Text style={styles.paragraph}>
            Za vprašanja, zahteve ali pritožbe glede varstva podatkov in zasebnosti nas kontaktirajte
            na:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>E-pošta za zasebnost:</Text> support@prhran.com{"\n"}
            <Text style={styles.bold}>Splošna podpora:</Text> support@prhran.com{"\n"}
            {"\n"}
            <Text style={styles.bold}>Odzivni čas:</Text> Odgovorili bomo v <Text style={styles.bold}>
            5 delovnih dneh</Text>.{"\n"}
            {"\n"}
            <Text style={styles.bold}>Pravice uporabnikov:</Text> Če želite uveljavljati svoje
            pravice po GDPR (dostop, popravek, izbris, prenos podatkov itd.), nas kontaktirajte na
            zgornji e-naslov. Vaše zahteve bomo obdelali v roku <Text style={styles.bold}>30 dni
            </Text> od prejema zahteve.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Podjetje:</Text> Pr'Hran, Slovenija{"\n"}
            <Text style={styles.bold}>Pristojni nadzorni organ:</Text> Informacijski pooblaščenec
            Republike Slovenije (www.ip-rs.si)
          </Text>

          <Text style={styles.sectionTitle}>12. GDPR Skladnost in Pravne Podlage</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>PrHran je v celoti skladen z EU Splošno Uredbo o Varstvu
            Podatkov (GDPR)</Text> in slovenske zakone o varstvu osebnih podatkov (ZVOP-2).
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Pravne podlage za obdelavo podatkov:</Text>
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>12.1. Izvajanje Pogodbe (člen 6(1)(b) GDPR):</Text>{"\n"}
            Obdelujemo podatke, ki so potrebni za izvajanje storitve, ki ste jo naročili (iskanje cen,
            upravljanje profila, shranjevanje nakupovalnih seznamov).{"\n"}
            {"\n"}
            <Text style={styles.bold}>12.2. Zakonita Obveznost (člen 6(1)(c) GDPR):</Text>{"\n"}
            Obdelujemo podatke za izpolnjevanje zakonskih obveznosti (davčni predpisi, računovodstvo,
            varstvo pravic potrošnikov).{"\n"}
            {"\n"}
            <Text style={styles.bold}>12.3. Vaše Soglasje (člen 6(1)(a) GDPR):</Text>{"\n"}
            Za določene vrste obdelave (npr. marketing po e-pošti, analitika) pridobimo vaše
            izrecno soglasje, ki ga lahko kadarkoli prekličete.{"\n"}
            {"\n"}
            <Text style={styles.bold}>12.4. Legitimen Interes (člen 6(1)(f) GDPR):</Text>{"\n"}
            Za izboljšanje storitve, preprečevanje goljufij in zagotavljanje varnosti imamo
            legitimen interes obdelovati nekatere podatke.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Naša zaveza:</Text>{"\n"}
            • Vaše podatke obdelujemo <Text style={styles.bold}>zakonito, pošteno in pregledno</Text>
            {"\n"}
            • Zbiramo samo podatke, ki so <Text style={styles.bold}>nujno potrebni</Text> za nudenje
            storitve{"\n"}
            • Shranjujemo podatke samo <Text style={styles.bold}>toliko časa, kot je potrebno</Text>
            {"\n"}
            • Uporabljamo ustrezne <Text style={styles.bold}>tehnične in organizacijske ukrepe</Text>
            za varnost{"\n"}
            • Spoštujemo <Text style={styles.bold}>vse vaše pravice</Text> po GDPR
          </Text>

          <Text style={styles.sectionTitle}>13. Viri Podatkov o Cenah in Izdelkih</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Pr'Hran je agregator cen</Text>, ki zbira javno dostopne podatke
            o cenah izdelkov iz naslednjih virov:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>13.1. Viri Podatkov:</Text>{"\n"}
            • <Text style={styles.bold}>Spar Slovenija</Text> (spar.si) - javno dostopni podatki o
            cenah in izdelkih{"\n"}
            • <Text style={styles.bold}>Mercator</Text> (mercator.si) - javno dostopni podatki o cenah
            in izdelkih{"\n"}
            • <Text style={styles.bold}>Tuš</Text> (tus.si) - javno dostopni podatki o cenah in
            izdelkih
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>13.2. Slike Izdelkov:</Text>{"\n"}
            Slike izdelkov, prikazane v aplikaciji, so last posameznih trgovin ali proizvajalcev
            izdelkov. Pr'Hran jih prikazuje izključno v informativne namene za lažjo identifikacijo
            izdelkov. <Text style={styles.bold}>Ne shranjujemo slik na lastnih strežnikih</Text>, ampak
            jih povezujemo neposredno iz virov trgovin.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>13.3. Blagovne Znamke:</Text>{"\n"}
            Imena trgovin (Spar, Mercator, Tuš), njihovi logotipi in blagovne znamke so last
            posameznih podjetij. Pr'Hran <Text style={styles.bold}>NI povezan, podprt ali odobren
            </Text> s strani teh trgovin. Uporaba njihovih imen služi izključno za identifikacijo
            virov podatkov.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>13.4. Točnost Podatkov:</Text>{"\n"}
            Podatki o cenah so informativne narave in se lahko razlikujejo od dejanskih cen v
            trgovinah. Pr'Hran <Text style={styles.bold}>ne jamči</Text> za popolno točnost,
            ažurnost ali razpoložljivost prikazanih cen in izdelkov.
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
