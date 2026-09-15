# Arbetsregler: ops-plattformarna

> Ramverkets kanon. Konsumerande repon (`bolag-ops`, `tam`) bär en **genererad
> kopia** av det här avsnittet mellan markörer, och en vakt blir röd när kopian
> ligger efter. Ändra aldrig kopian i ett konsumentrepo: ändra här.
>
> Reglerna är hämtade ur SessionStudios `CLAUDE.md`, men bara de som handlar om
> **hantverk**. Allt som var svar på SessionStudios egna begränsningar (hybrid
> Postgres och Firestore, artefaktmodellen, Apple-utgivning) är medvetet utelämnat.
> Det hör till den domänen och skulle bli cargo cult här.

---

## ⛔ Varje regel bär sin händelse. Ta aldrig bort skälet.

Det här är den enda metaregeln, och den är först för att den skyddar de andra.

En regel utan sin historia är en åsikt, och en åsikt går att optimera bort av
nästa person som har bråttom. "Ingen quickfix" är ignorerbart. "Vi maskerade ett
rotfel, det tog tre dagar att hitta, så här såg det ut" är det inte.

Skriver du en ny regel: skriv vad som hände. Läser du en regel och inte förstår
varför den finns: den är antingen felskriven eller inte längre sann, och båda är
värda att ta reda på innan du bryter mot den.

---

## 1. Ingen quickfix. Ingen teknisk skuld som leverans.

Maskera aldrig ett rotfel. En env-flagga som sväljer ett byggfel, en `try/catch`
som tystar, en fallback som döljer en trasig konfiguration: alla tre är samma
sak, och alla tre gör felet dyrare nästa gång.

Innan du committar: **är det här rotorsaken eller symptomet?** Om symptom,
fortsätt.

En temporär åtgärd är tillåten bara om alla tre gäller: den är dokumenterad, den
har ett ärende, och den riktiga fixen påbörjas i samma eller nästa pass. "Sen"
betyder permanent.

## 2. En sanning per faktum.

Lagra eller skriv aldrig samma uppgift två gånger. Kan ett värde härledas ur ett
annat: härled det. Två kopior av samma regel glider isär, och då larmar den ena
på något den andra inte längre följer.

Det gäller kod, konfiguration, dokument och regler. Behöver två repon samma
sanning måste den ha **ett** hem plus en genererad kopia med vakt, aldrig två
handskrivna original.

Unikhet löses med riktiga constraints, aldrig med en extra spegelkolumn eller en
läs-sedan-skriv-kontroll.

## 3. Mät. Lita aldrig på en rapport, inte ens din egen.

En rapport är ett tips, aldrig ett bevis. Det gäller en agents sammanfattning,
en anteckning i ett dokument, och en siffra du själv skrev i går.

Två mätfel som redan kostat oss dagar, båda värda att känna igen:

- **Noll träffar är inte ett svar.** Det är en fråga om vad du sökte igenom. En
  sökning i fel repo-kopia gav "commiten existerar inte" om commits som fanns.
- **En anteckning om tillstånd ruttnar, en tagg gör det inte.** Läs
  utrullat läge ur taggen, inte ur ett dokument som beskrev taggen en gång.

Innan du beskriver ett läge: mät det nu.

## 4. Ett prov som aldrig setts falla är ingen vakt.

Varje vakt och varje prov ska bevisas i **båda** riktningarna: grönt med sin fix,
rött utan den. Skriv ut båda utfallen när du levererar.

Tre former av falsk grönhet vi har haft, alla tre lätta att missa:

- **Närvarogrep.** Ett prov som söker efter ett funktionsnamn i källan mäter inte
  beteende. Det stod grönt genom hela felet det skulle fånga.
- **Tautologisk lista.** En lista som jämförs mot den mängd den är en kopia av
  kan inte faila. Den är grön för att den inte mäter.
- **Tomt underlag.** Ett prov som blir grönt av att ingenting lästes. Ge varje
  vakt ett **golv**: minst N filer lästa, minst N poster i listan.

Vaktar du en skuld: sätt ett **tak som bara får sjunka**, inte noll. Noll gör
befintliga fall röda utan att någon lagar dem, och då stängs vakten av.

## 5. Tomhet är ett svar, inte en utelämnad rubrik.

En rapport som utelämnar en rubrik när värdet saknas gör "noll" omöjligt att
skilja från "ostält". Skriv ut raden även när den är tom, med en text som säger
vilket det är.

Samma sak i felvägar: en tyst nedsläppsväg är värre än ett fel, för den ser ut
som att allt gick bra.

## 6. Inga em-dash eller en-dash.

`—` och `–` är de tydligaste tecknen på maskinskriven text. Använd bindestreck,
komma, kolon eller punkt. Gäller chatt, kod, commit-meddelanden, PR-texter och
allt en användare ser. Svenska tecken bevaras alltid.

## 7. Committa ofta lokalt, pusha sällan, och aldrig force i en loop.

Kostnaden sitter i pushen, inte i commiten: en push startar varje kontroll som
lyssnar på grenen. Batcha ett arbetspass.

Force-push är en sista utväg med `--force-with-lease`, aldrig ett sätt att ta sig
ur en rebase man inte förstår.

**Innan du tror på ett arbetsträd du inte själv lämnade:** hämta, jämför mot
huvudgrenen, och titta efter minustecken. Ett arbete som ska läggas till lägger
till. Ett som tar bort hundratals rader är nästan alltid en gammal version av en
fil som hunnit växa.

## 8. Opushat arbete är osynligt arbete.

En gren utan PR är inte på väg någonstans och ingen vakt larmar på den. Öppna
utkastet samma dag arbetet börjar, inte när det är klart.

Det här är den dyraste lärdomen i listan: hundra commits låg opushade på en
maskin i två dygn, och under tiden analyserade någon annan problem som de redan
hade löst.

## 9. Den som skriver godkänner inte.

Den som kör ett prov godkänner inte ändringar av provet. Den som skriver en fix
är inte den som släpper in den.

Regeln kostar: en färdig och grön fix kan bli liggande för att rätt granskare
saknas. Det är rätt pris, och flaskhalsen ska då synas som en kapacitetsfråga,
inte lösas genom att någon godkänner sig själv.

## 10. Den levande statusvyn uppdateras efter varje pass.

Produktägaren ska inte behöva fråga var vi är. Efter varje pass där något
mergats, deployats, öppnats eller stängts: uppdatera statusvyn och länka den.

En rapport som slutat spegla verkligheten är **sämre än ingen rapport**, för den
ser fortfarande auktoritativ ut.

Siffror hämtas live vid varje generering. Skriv aldrig av dem från förra
versionen. Bedömningar ska märkas som bedömningar: mätt data och gissningar får
inte se likadana ut.

---

## Vad som inte är regler här

**Datamodellen.** `bolag-ops` går mot Firebase, `tam` är ett korpus där repot är
datan. Ett ramverk som bestämmer var data bor passar den ena och tvingar den
andra.

**Auktorisationsmodellen.** Inloggningsskalet och route-vakten hör hemma i
ramverket. Vem som får läsa vad gör det inte. `tam` bär kundmaterial, och att
eftermontera behörigheter är den dyraste sortens ombyggnad.

**Utgivningsdisciplin per app.** Versionsnummer, changelog-form och deploy-fönster
är per plattform.
