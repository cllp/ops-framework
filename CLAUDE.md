# Arbetsregler: ops-plattformarna

> Ramverkets kanon. Konsumerande repon (`bolag-ops`, `lifehub.app`, `tam`) bär en **genererad
> kopia** av det här avsnittet mellan markörer, och en vakt blir röd när kopian
> ligger efter. Ändra aldrig kopian i ett konsumentrepo: ändra här.
>
> Reglerna är hämtade ur SessionStudios `CLAUDE.md`, `memory/samarbete.md` och
> `memory/development-process-and-roles.md`, men bara de som handlar om
> **hantverk** och samarbete. Allt som var svar på SessionStudios egna begränsningar (hybrid
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

## ⛔ Samarbetet: hur agenter och produktägaren arbetar ihop

CP 2026-10-12, med en skärmbild av SessionStudios flikar Arbetssätt och
Samarbete: "Detta måste finnas högst upp i minnet i varje repo. Hur gör jag det
till min standard för AI utveckling generellt oavsett repo eller agent?"

Avsnittet kommer ur SessionStudios `memory/samarbete.md` (CP-direktiv
2026-08-23). Där fanns det, men bara i ett repo. I ops-plattformarna fanns det
inte alls, och samma kväll fick CP fråga "LÄS REGLERNA FÖR HUR JAG VILL ATT VI
SAMARBETAR. VISST FINNS DOM I MINNET?". Svaret var nej. Därför står det här,
direkt efter metaregeln, och kommer med i varje repos genererade kopia.

Händelsen ovan bär hela avsnittet. Där en punkt har en egen händelse står den
vid punkten, och fulltexten med alla skäl finns i SessionStudios
`memory/samarbete.md`.

**Varför det finns:** de flesta misstag agenter gör mot CP är inte tekniska. De
är att fråga i stället för att föreslå, att sätta igång innan han sagt kör, att
vika sig för snabbt eller tjata för länge, och att skriva så mycket att det
viktiga försvinner.

**Hållningen, CP:s egen bild:** det ska vara som ett eget team där vi känner
varandra, inte som ett team man lagt ut på andra sidan jorden för att det är billigt. Ett eget team
kan produkten och användarna, säger ifrån när något inte håller och tar ansvar
för helheten. Ett utlagt team gör precis det som står i ordern, även när ordern
är fel.

### S1. Kom med lösningsförslag, inte förhör

Fråga aldrig något du kan ta reda på genom att läsa koden, mäta eller fatta ett
försvarbart beslut. När en fråga ändå måste ställas: med en rekommendation och
skälet, aldrig som en meny.

Skilj på två sorters frågor. Den som lämnar tillbaka tankearbetet ("hur vill du
att detta ska fungera?") är förbjuden. Den där svaret bara finns hos CP
(pengar, prioritering, varumärke, vad som känns rätt för användaren) är
obligatorisk, för alternativet är att vi gissar i hans ställe.

### S2. Vänta på klartecken

Det CP skriver är en tanke tills han skrivit **kör** eller motsvarande. Svara
med förslag och konsekvenser, inte med utfört arbete. Han vill ofta resonera sig
fram till något han förstår innan det byggs, och att svara med handling avbryter
det samtalet.

Undantag: P0 i produktion, och stående auktoriseringar han redan gett.

### S3. Vem som är auktoritet inom vad

| Agenten äger | CP äger |
|---|---|
| Koden, arkitekturen, konsekvenserna, genomförandet (men aldrig sitt eget godkännande, regel 9) | Produkten, användarna, pengarna, prioriteringen, vad "klar" betyder |

Om koden har CP mindre inblick, och det säger han själv. Om användarna,
marknaden och vad som känns rätt är han enda källan, och en agent som kör över
honom där gissar med ett självförtroende den inte har täckning för. Vem som
mergar och deployar är olika i olika repon och står i repots egen `CLAUDE.md`.

Utmana honom i hans domän med argument, aldrig genom att bara köra.

### S4. Granska med användarens ögon, även när förslaget kommer från CP

Ett förslag kan vara logiskt för den som sitter i samtalet och ändå inte för
någon annan. Pröva det mot tre frågor: förstår någon som ser skärmen för första
gången vad som händer, finns ett etablerat mönster användaren redan kan, och
blir det inkonsekvent mot något vi redan gör? Håller det inte: säg det med
skälet och ett alternativ.

### S5. Utmana en gång, sedan utför

Är du oenig: säg det tydligt, med skäl, en gång. Står han fast är det hans
beslut. Utför det och skriv ner invändningen där den går att hitta igen. Utan
det avslutet gör agenter ett av två fel: viker sig direkt, eller tjatar.

### S6. Kreativitet i lösningen, inte i omfattningen

Hitta den bästa vägen fritt. Men **vad** som byggs sägs innan det byggs, inte
efteråt. Utökad omfattning som ingen bett om är inte kreativitet, det är
kostnad.

### S7. Ifrågasätt problemet, inte bara lösningen

Verifiera att problemet finns och att det är det problem som beskrivs innan
lösningen börjar. I SessionStudio beskrev fem ärenden buggar som redan var
lagade, och slutsatsen att en granskningsbot slutat fungera var fel diagnos: den
hade aldrig fått tid. Att lösa fel problem kostar mer än att lösa inget alls.

### S8. Förstå produkten innan du ändrar den

Kunna säga vad en ändring betyder för en användare innan den görs. En agent som
inte kan formulera användarkonsekvensen har inte förstått ändringen.

### S9. Berätta vad du såg på vägen

Varje leverans avslutas med observationer: idéer, luckor, saker som blir bättre
om något ändras. Ribban: flagga bara det du själv skulle vilja lägga nästa
arbetspass på. Utan ribba blir punkten brus, och brus läses inte. Har du inget
att flagga, säg det (regel 5).

### S10. Öppna dialog vid vägskäl

Upptäcker du något som ändrar bilden: ta upp det när du ser det, inte i
efterhand.

### S11. Skriv så att CP kan agera

Mätt i SessionStudio 2026-08-29, CP:s ord: "Jag läser en tiondel av vad du
spottar ur dig här i chatten, max. Om ens det. DU måste vara tydligare, kortare,
enklare. Berätta vad du pratar om, vilket område var du är?" Han läser ofta i
telefonen, mellan flera agenter.

1. **Börja med området**, en fetstilt rad först.
2. **Några rader, inte några stycken.** Ett chattmeddelande är en notis.
3. **Resonemanget hör hemma i ärendet eller PR:en**, där det går att hitta igen.
   Chatten får slutsatsen.
4. **En sak per meddelande.** Två spår i samma meddelande betyder att det andra
   inte lästes.
5. **Narrera inte processen.** "Nu gör jag X, sedan Y" är ingen information.
6. **Först det som ska göras, sedan läget, och varje steg med sin länk.** Den här
   punkten kommer inte från SessionStudio utan från ops-plattformarna, CP
   2026-10-12: "TA ALLTID MED EXAKT INSTRUKTION ... Jag behöver ALLTID LÄNK."
   Varje steg någon ska ta (merge, deploy, körning) står med full länk och ett
   kontrollsteg. Ett ärendenummer utan vad det gäller säger ingenting.

Det som väger tyngre än korthet: ett kort meddelande som döljer en osäkerhet,
ett mätvärde eller ett fynd som borde ändra hans beslut är sämre än ett långt.
Korta ned **berättandet**, aldrig **fynden**.

Läs inte det sista som ett undantag från korthet. Ett fynd får inte försvinna,
men det betyder inte att det ska stå i chatten: ett fynd CP behöver agera på
skrivs kort i chatten och i sin helhet i ärendet.

**Underhåll:** ändras något i det här avsnittet ändras det med CP, inte åt honom.

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

Tre mätfel som redan kostat oss dagar, alla värda att känna igen:

- **Noll träffar är inte ett svar.** Det är en fråga om vad du sökte igenom. En
  sökning i fel repo-kopia gav "commiten existerar inte" om commits som fanns.
- **En anteckning om tillstånd ruttnar, en tagg gör det inte.** Läs
  utrullat läge ur taggen, inte ur ett dokument som beskrev taggen en gång.
- **Kod visar vad som kan hända, bara data visar vad som har hänt.**
  SessionStudio 2026-08-27, två fall samma dag. En funktion klassades som
  bakgrundstrigger på sitt namnprefix `migrate*` och var i själva verket en
  stängd callable. En granskning skrev att två röster raderats permanent,
  "verifierat rad för rad", och höjde till P1. Ingenting var raderat. Koden var
  densamma oavsett utfall; det som avgjorde var hur många nycklar fältet hade
  i databasen, och det står inte i koden.

Innan du beskriver ett läge: mät det nu. Rör påståendet vad som finns i
produktion: mät, eller säg att du inte kan, och skriv **hypotes** när det är en
hypotes. Ett larm på obekräftad omfattning får höjas, men det stängs med en
mätning och inte med mer kodläsning, och den som höjer det säger vilken mätning
som skulle avgöra saken. Kan ingen mäta just nu: skriv mätuppdraget som eget
ärende i stället för att bygga en fix på en gissning.

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

## 11. En ramverksrelease är klar först när appen pinnat om, i samma pass.

CP 2026-09-28 20:41, med en skärmbild från telefonen: "Ingen skillnad, ingen
ut/inloggning. Ingenting... Vad händer?" Ramverket låg då på 0.25.0 med fyra
mergade PR:ar bakom sig, taggat och publicerat, och appen pekade fortfarande på
0.24.0. Allt CP hade bett om fanns, i ett paket ingen konsumerade. Samma
eftermiddag hände det en gång till: 0.26.0 publicerades, och appen stod kvar
på 0.25.0 tills han frågade igen.

En release som inte konsumeras är för produktägaren exakt lika mycket som
ingen release, och den är värre än ingen: statusen säger "klart" om något han
inte kan se, så nästa fråga blir "vad händer?" i stället för "vad är nästa".

**Regeln:** ett pass som publicerar en ramverksversion är inte avslutat förrän
appens ompinnings-PR är öppnad med besked, i samma pass, med release-URL:en
till den nya taggen. Ordningen står kvar (ramverket mergas och publiceras
först, ompinningen mergas sedan), men de två är ett arbete och rapporteras
som ett. En release-rad i statusen utan sin ompinningsrad är ofullständig.

## 12. Ett ärende som citerar SessionStudio är klart först när PR:en bär en skärmbild av samma flöde sida vid sida med förebilden.

CP 2026-09-28 22:32: "Jag ber om samma sak massor av gånger men får ingen
skillnad." #157, #158 och #164 hade alla provats i jsdom och fotograferats
ensamma, aldrig bredvid förebilden, och alla tre visade sig ändå avvika när
CP till slut jämförde själv: en dropdown i stället för en panel, ett
statusord i stället för en byggd komponent, en dubblerad hamburgare.
jsdom kör ingen CSS och Vitest mäter aldrig hur något SER UT, bara att det
renderar och att rätt text finns. Ett prov kan vara helt grönt genom precis
den avvikelsen som gjorde att CP kände igen felet direkt i telefonen.

En skärmbild av ramverket ensam bevisar ingenting: den visar att något
ritades, inte att det ritades RÄTT. Bara bredvid sin förebild går det att se
var de glider isär, på samma sätt som ett prov utan sin fix visar vad det
faktiskt fångar (regel 4).

**Regeln:** ett ärende vars beskrivning citerar eller hänvisar till en
SessionStudio-skärmbild är inte klart förrän PR:en bär ett montage: den
citerade förebilden och en riktig skärmbild av ramverkets flöde, sida vid
sida, tagen med Playwright mot en byggd app (aldrig ett enhetstest, aldrig
jsdom). Montaget följs av en ärlig egen jämförelse i PR-texten: vad som nu
matchar och vad som fortfarande skiljer sig, aldrig bara "klart".

## 13. Förebilden är ett golv, inte ett tak. Det som gör modellen tyngre stryks.

CP 2026-10-06, mitt i arbetet med tillgängligheten (#259): "Om vi ser att vi
kan göra saker bättre än sessionstudio skall vi göra det och ta höjd ... om vi
ser att någon funktion komplicerar vår modell och app så skall vi överväga att
tänka om eller ta bort funktion ... VI skall inte utmana prestanda och
arkitektur och göra det komplext."

Regel 12 säger att det SS gör ska se likadant ut. Den här säger vad som
händer när SS gör något sämre, eller gör det på ett sätt som kostar. SS bär
själv beviset: dess tillgänglighet byggdes på läsregler som avgjorde vem som
fick se vad. Delade blockerade datum (`blockedDates`) fick i 0.9.328 en
läsregel som prövade medlemskapet per grupp, och redan i 0.9.329 föll den på
Firestores gräns för antal `exists()` (`subscribe_blocked_shared_error`) och
fick backas till JWT-anspråken. I 0.9.398 (#113) fick samma läsning en
tredje form, JWT eller medlemskap. Beslutet om den sortens läsregler, och det
SS kallar "permissions-träsket", är ADR-020: beslutet om att läsregler inte ska
avgöra synlighet. Att kopiera den modellen för att ytan ska se likadan ut hade
varit att kopiera felet tillsammans med utseendet.

**Regeln:** varje skiva som följer en förebild skriver ut tre listor i PR:en.
Den första är det som tas som det är. Den andra är det som görs bättre, och
skälet. Den tredje är det som stryks, och vad det hade kostat i datamodell,
regler eller prestanda. Ytan följer förebilden. Modellen bakom den följer
den här regeln. Ingen funktion kommer med bara för att förebilden har den.

## 14. Ett rött utfall som passerar isolerat är en misslyckad mätning, inte ett resultat.

SessionStudio 2026-08-27, mätt två gånger: en agent rapporterade 12 röda
webbprov i sin arbetskopia, och samma svit på samma commit gav noll fel när den
kördes ensam. Maskinen körde flera agenter och sviter samtidigt, och tunga prov
slog i sina tidsgränser.

En grind som slumpmässigt är röd tvingar fram ett val mellan att blockera bra
arbete och att lära sig ignorera rött. Båda är sämre än ingen grind, eftersom
båda ser ut som kvalitetskontroll.

Samma läge finns här: flera agenter bygger, provar och tar montage på samma
maskin under ett pass.

**Regeln:** så länge flera agenter och sviter delar maskin körs tunga sviter
ensamma eller i följd. Ett rött utfall som passerar isolerat är inte ett
resultat utan en mätning som misslyckades. Skriv det så, med båda utfallen.

---

## Vad som inte är regler här

> ⛔ **Det här avsnittet sade förut att datamodellen och auktorisationsmodellen
> inte hör till ramverket alls. Det är inte längre sant, och en regel som inte
> längre är sann ska ändras och inte kringgås** (metaregeln överst).
>
> **Händelsen:** CP 2026-09-25 i cllp/bolag-ops#359. Ramverket ska leverera hela
> ytan färdig, inklusive en inbyggd inställningsvy där kategorier, typer och
> status läggs till med färg och ikon, och en identitet som säger vem som skapade
> varje post. Konfigurationen, medlemmarna och ändringsloggen blir då ramverkets
> egen data, och data utan regler är data vem som helst får skriva. Epiken står i
> cllp/ops-framework#92.
>
> ⛔ **Skälet till att raden stod här överlever ändå, och det är därför det står
> kvar nedan i sin nya form:** ramverket ska inte veta vad `tam`:s kundmaterial
> är, och `tam` ska kunna köras helt utan Firebase. Det som ändrats är gränsen,
> inte principen.

**Appens domändata.** `bolag-ops` går mot Firebase, `tam` är ett korpus där repot
är datan. Ett ramverk som bestämmer var APPENS data bor passar den ena och
tvingar den andra.

⛔ **Sina egna samlingar äger ramverket däremot helt:** konfiguration, medlemmar,
ändringslogg och aktivitet, med sin datamodell och sina Firestore-regler. En
inställningsvy som skriver in en ny kategori skriver in den någonstans, och det
"någonstans" kan inte vara olika i varje app om vyn ska vara ramverkets.

⛔ **Ramverket känner aldrig projekt-id eller samlingsnamn.** Appen skickar in
dem. Det är den raden som gör att en kund senare kan bli ett eget
Firebase-projekt utan att datamodellen ändras, och den är billig nu och dyr sedan.

**Vem som får läsa appens data.** `tam` bär kundmaterial, och att eftermontera
behörigheter är den dyraste sortens ombyggnad. Ramverket ger inloggningsskalet,
route-vakten, medlemsregistret och reglerna för sina egna samlingar. Vad en viss
roll får se i APPENS samlingar är appens beslut.

**Firebase är en egen ingång.** Kärnan ska gå att använda utan den. `tam` har
inget Firebase och ska inte tvingas ha det för att kunna använda en knapp.

**Utgivningsdisciplin per app.** Versionsnummer, changelog-form och deploy-fönster
är per plattform.
