# Ändringslogg

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/), och
versionerna är [semver](https://semver.org/lang/sv/).

⛔ **Varje tagg `vX.Y.Z` ska ha ett avsnitt här.** `check-paket` kräver att
versionen i `package.json` står i den här filen, eftersom en utgivning utan
anteckningar är en version ingen kan välja att hoppa över.

---

## Ej utgivet

- **Visionen i kanon** (`CLAUDE.md`, CP 2026-10-24): varför vi bygger, hur (agenten som
  första väg in, visuella hjälpmedel som den andra) och frågan till varje ärende: gör det
  här att någon tittar mindre på skärmen, eller mer? Följer med till konsumenternas
  kanonkopia vid nästa utgivning och ompinning.

## 0.149.0

### Taggkomponenterna följer språket, filväljaren tar flera filer, tystnad blir regel 4:s fjärde form, och en vakt mot appinnehåll

Fyra delar i ett pass. Inget är brytande: utan de nya propparna är allt som i 0.148.0.

- **Taggkomponenterna följer språket (cllp/ops-framework#444).** `OpsTaggPiller`, `OpsTaggRad` och `OpsTaggFilter` hade sina etiketter som svenska litteraler i JSX ("Ny tagg", "Förslag", "Lägg till tagg", felmeddelandena), och efter att de flyttats ur Biblioteket till Inkorgen och Ärenden (0.143.0) fick den som bytte språk i profilen svenska taggetiketter i tre vyer. `check-sprak` fångar inte litteraler i JSX. Nu finns `ORD_TAGGAR` (14 ord, svenska och engelska, bredvid komponenten och exporterad), och de tre tar `sprak` som valfri prop, annars `OpsSprakProvider`, annars svenska. Appens egna texter (`extra.rubrik`, ett fel som `onAndra` själv kastar) översätts inte. **Prov åt båda håll:** `taggar-sprak.test.jsx` (14 prov) är 12 röda mot koden utan ordboken; de 2 gröna är svenskan som ska vara oförändrad. Fyra mutationer fälldes: `sprak` ej vidare till pillren, appens `sprak` ignorerad, en engelsk text som svensk litteral i filtret och i förslagen. **Valideringsfelen följer också språket** (granskningen): `taggarFel(v, sprak?)` tar ett språk (`ORD_TAGGFEL` i `lib/bibliotek.js`, förval svenska) och raden ger det den har, så "Posten har 9 taggar. Taket är 8." och "Taggen ... går inte att spara" är inte längre svenska på engelska.
- **`OpsFilePicker` tar flera filer.** Appen behöver kvitton, och ett kvitto är ofta flera bilder ur bildbiblioteket. Ny, frivillig prop `flera`: `value` är en lista av `Bilaga` och `onChange` får hela listan; filfältet får `multiple`, inklistring tar alla filer i urklippet, och filer som dras på väljarens yta läggs till. Varje fil prövas för sig mot `maxChars` och `typer`: en avvisad fil ger ett besked med filens namn, de andra tas, och avvisas alla anropas `onChange` inte alls. Varje vald fil har en egen Ta bort. **Utan `flera` är väljaren oförändrad** (två komponenter bakom samma namn, `EnFil` och `FleraFiler`). **Prov åt båda håll:** `filvaljare-flera.test.jsx` och `filvaljare-flera-mock.test.jsx` (30 prov) är 22 röda mot koden utan `flera`; de 8 gröna är 6 prov som låser det gamla läget (ingen `multiple`, bara första filen, inget släpp, `onChange(null)` vid fel, svenska även med providern på engelska), `paste={false}` och taket `maxChars`. Sjutton mutationer fälldes. **Orden i `flera`-läget följer språket** (`ORD_OPSFILEPICKER`, `sprak` eller providern): `check-sprak` blev röd (113 mot taket 112) när det nya läget först bar `ariaLabel = "Bifoga filer"` som förval, och svaret var en ordbok och inte ett högre tak. Läget utan `flera` är oförändrat, med sina svenska förval. README: raden för `OpsFilePicker` hade engelska fältnamn (`name`, `kind`, `chars`) och `labels`-nycklar som aldrig funnits, och är rättad.
- **Regel 4 i `CLAUDE.md` får en fjärde form av falsk grönhet: tystnad (cllp/ops-framework#455, ur #104 rad D2).** En vakt som räknar felrader är grön genom ett fel som tystnar: SessionStudios deployvakt sa "ingen funktion rapporterades misslyckad" när en körning slagit i jobbets tidsgräns, elva funktioner hade börjat uppdateras, ingen bekräftades och ingen felrad skrevs. "Tre former" är "Fyra former". Följer med till konsumenternas kanonkopia vid nästa utgivning och ompinning (`check-kanon --skriv`).
- **Vakten `check-no-app-content` (cllp/ops-framework#7, förenklad enligt beslutet 2026-10-26).** Letar efter form i varje textfil: personnummer och samordningsnummer, organisationsnummer, IBAN och nyckelformat (privata nycklar, API-nycklar för GitHub, Google, AWS, Slack, Stripe, Anthropic och npm), med kontrollsiffra (Luhn, mod 97) så att löpnummer inte larmar. Tillåtlistan över filer, bankgiro, belopp och plattformsnamn ur den första skissen är strukna. Skriver aldrig ut själva uppgiften. Tystnad är inte rent: en fil som inte gick att läsa och en symbolisk länk är brott, binärt avgörs av innehållet, och golvet är 600 textfiler (786 lästa i dag). **Mot `main` gav den noll träffar**, så det finns inget tak att sätta; varje träff är röd. Ligger i `npm run check`. **Prov åt båda håll** i `test-guards`: 44 nya röda (varje form med rätt sort och fil, utskriften pekar ut rad men visar inte värdet, golv, fel sökväg, länk, oläsbar fil, text med bildändelse) och 6 gröna (dagens träd, sådant som bara liknar, sådant med EN siffra fel, binär fil, `node_modules` och `dist`). Uppgifterna byggs vid körning så att provfilen inte själv larmar. Fjorton mutationer av vakten fälldes av minst ett prov: kontrollsiffran borttagen, binärkollen borttagen, golvet borttaget, länkar tysta, värdet utskrivet, IBAN-kontrollen borttagen, `node_modules` läses, organisationsnumret smalnat, PEM-mönstret borta och läsfelet tystat, luhn med fel paritet, girig IBAN, fel norsk längd, förledet tillbaka till `\w-`, BOM-läsningen borta, textlik binär tyst och rapporten per ändelse borta.
- **Rättelser efter granskningen av PR 456.** (1) **IBAN** prövas nu per landslängd (`IBAN_LANGD`, ISO 13616) och inte med ett girigt mönster: förut gav en giltig IBAN följd av "SEK", "BIC ESSESESS" eller ett år noll träffar, eftersom den långa träffen föll på mod 97 och den riktiga aldrig prövades. Norska (15 tecken) och kortare länder nås; ett land utanför tabellen prövas inte. (2) **Kända kontrollsiffror i proven**: planterade nummer fick sin siffra av vaktens egen `luhn` (tautologisk lista, regel 4). Nu finns även publicerade exempel vars siffra är räknad för hand (testpersonnummer, samordningsnummer, ett organisationsnummer, IBAN-exempel), byggda av delar så att provfilen inte larmar på sig själv, och en `luhn` med fel paritet fäller 10 prov. (3) **`OpsFilePicker flera` utgår alltid från `value`**: väljaren hade en egen kopia av listan som sattes direkt vid ett tillägg, så filer som appen vägrat kom med i nästa `onChange`; nu utgår tillägg och borttagning från det appen gav, och omgångar läses i kö (nästa börjar när appen ritat den förra). (4) Taggfelen, se ovan. (5) **Personnummer efter bindestreck eller understreck** (`kund-...`, `id_...`) träffas nu: avgränsning mot siffror och bokstäver. (6) **NUL-byte**: UTF-16 med BOM läses, hoppade binära filer räknas upp per ändelse, och en binär fil vars ändelse också finns bland trädets textfiler (en `.md` med NUL) är ett brott. Valet och skälet: ett tak för "textliknande" hade krävt en lista över textändelser; ändelserna härleds i stället ur trädet och dagens läge är noll (bara png, jpg, woff2 och webp hoppas över). (7) `labels.laggTill` i `flera`-läget; `labels.byt` hör bara till enfilsläget. (8) Inklistringens lyssnare anropar senaste `taFiler` genom en ref och registreras bara om när `paste` ändras, så den håller inga gamla ord. (9) Regel 4: D3 (cllp/sessions-platform#3253) är också källa.

## 0.148.0

### Mejlkön kan bifoga: `bilagor: [{ filnamn, innehall, typ }]` genom byggMejl, kön, utskicket och nodemailer-adaptern

Appen behöver skicka en `.ics` (`text/calendar`) med en inbjudan till en händelse (cllp/ops-framework#453, skiva 1 av #445). Mejlkön bar bara `till`, `amne`, `text` och `html`, och `byggMejl` tappade allt annat, så lifehub.app (PR 477) bar bilagan själv som en temporär åtgärd. **Inte brytande:** ett brev utan bilagor är byte för byte det det var. Det här är bara ramverkets del; appens del står i PR-texten.

- **Formen:** `bilagor: [{ filnamn, innehall, typ }]`, ramverkets egen form (inte nodemailers `filename`, `content`, `contentType`; adaptern översätter). `byggMejl` och `createMailQueue.koa` tar den och skriver den på raden, `createMailSender` ger den till transporten, och `createNodemailerTransport` ger den vidare som `attachments`. `createMockMailTransport` antecknar den i `skickade()`.
- **Taken** (`kontrolleraMejlbilagor`, en sanning för alla led): högst 5 bilagor (`MEJL_BILAGOR_MAX`), högst 32 KiB per bilaga räknat i UTF-8-byte (`MEJL_BILAGA_MAX_BYTES`), bara `text/calendar` med eller utan parametrar (`MEJL_BILAGETYPER`), ett filnamn på 1 till 120 tecken utan sökväg, citattecken eller styrtecken, och ett icke-tomt innehåll. Ett okänt fält på en bilaga kastar, så att appens gamla `namn` eller nodemailers `content` inte tappas tyst.
- **En bilaga utanför taket ger ett fel och skickas aldrig tyst utan** (regel 5): `koa` kastar och skriver ingenting, `skicka` prövar mot raden i källan och skriver `fel` utan att anropa transporten, och transporterna (adaptern och mocken) kastar före `sendMail`.
- **Raden töms på bilagorna när brevet gått**, i samma skrivning som kvittot (`skickad`). Ett brev som inte kom fram behåller dem. `text` och `html` töms inte av ramverket.
- **Ett mejl utan bilagor är byte för byte som förut:** ingen `bilagor`-nyckel på raden (inte heller en tom lista), transporten får exakt de fyra fälten, nodemailer får inget `attachments`, och kvittot har samma fält.
- **Nya exporter i `ops-framework/node`:** `kontrolleraMejlbilagor`, `MEJL_BILAGOR_MAX`, `MEJL_BILAGA_MAX_BYTES`, `MEJL_BILAGETYPER`.
- **Prov åt båda håll:** `mejl-bilagor.test.js` (18 prov). Mot koden utan ändringen är **15 av 18 röda**; de 3 gröna är provet av att ett mejl utan bilagor är oförändrat och är gröna åt båda håll med avsikt. Med ändringen är alla 18 gröna, liksom de 28 äldre i `mejl.test.js`. Åtta mutationer fälldes av minst ett prov: tömningen borttagen, utskickets prövning borttagen, tecken i stället för byte, `attachments` borttagen, bilagenyckeln alltid på raden, bilagor alltid till transporten, okända fält tillåtna och typen oprövad.

## 0.147.0

### Panelen för en rad öppnas bara av ett tryck, knappraden får en plats för ett fel, och appens egna inställningar kan stå före kopplingarna

Två rättelser (cllp/ops-framework#451) och ett val (platsen för appens egna inställningar i modulramen). **Inte brytande:** inga props tas bort eller byter betydelse. En källa vars `onClick` inte ger ett löfte, en modul utan `ram.egnaForst` och en lista som aldrig tappar en rad är exakt som förut. En `onClick` som ger ett löfte beter sig NYTT på ett sätt som syns (panelen stänger när den lyckas, felet står i knappraden), se nedan. Det här är bara ramverkets del; appens del står i PR-texten.

- **En panel öppnas av ett tryck och av inget annat** (#451, punkt 1). `OpsEventList` och `OpsCalendar` höll id:t på raden som tryckts på i tillstånd och slog upp raden i listan vid varje ritning. När raden försvann (avbockad) blev panelen stängd men id:t låg kvar, och när raden kom tillbaka under Avklarat öppnades panelen av sig själv, med Ångra, utan att någon rört raden. Nu glöms id:t i samma ögonblick som raden inte längre finns (en effekt som nollställer det). **Samma form i `OpsCalendar` för läspanelen av en post från Apple eller Google** (`externId`), som hade exakt samma fel och inte stod i ärendet: ett tryck öppnar, en försvunnen post stänger och glöms.
- **En åtgärd i knappraden som ger ett löfte väntar, stänger när den lyckas och säger vad som gick fel** (#451, punkt 2). `Knapprad` är den yta som vet vad ett fel betyder här, så den tar hand om det: **väntar** synligt med ramverkets befintliga mönster (`OpsButton`, och åtgärdens eget verb när källan skickar `pagarEtikett`, "Bockar av…"); **stänger panelen** när löftet lyckas (`onKlar`, panelens Tillbaka); och när löftet **avslås** står texten ur avslaget i en `role="alert"` ovanför knapparna, på samma ställe som skälet till att Dela saknas, med panelen kvar och knappen tryckbar igen. Saknar avslaget en text står "Det gick inte." (`atgardFelEtikett`, på svenska och engelska). Ett nytt tryck tar bort det gamla felet medan åtgärden väntar. En åtgärd som INTE ger ett löfte gör något direkt (öppnar, kopierar) och stänger ingenting, och en med `href` är en länk: båda som förut. **Dela** får samma fel och samma väntläge men stänger inte (att dela en rad är inte att vara klar med den). Avslås löftet efter att panelen redan stängts (appen tog bort raden medan det väntade) finns ingen ruta att skriva i, och då släpps avslaget vidare som förut (`unhandledrejection`) i stället för att sväljas.
- **`pagarEtikett` på en åtgärd** (`Atgard`): verbet i pågående form medan löftet väntar. Valfri, och en tom text kastar där manifestet tas emot (`losKnapprad`).
- **`ram.egnaForst` i modulramens inställningsläge** (`OpsModulRam`, `ModulRam`): ritar avsnittet "Egna inställningar" FÖRE Kopplingar i stället för efter. För en app vars egna inställning styr vilka kopplingar som visas (Ekonomi väljer område, och området avgör vilka banker som går att koppla): raden som avgör står före raderna den avgör. Hela avsnittet flyttas (manifestets fält, appens `egna` och Spara) och det finns fortfarande bara ett. Utelämnad, eller `false`, är ordningen som förut: Allmänt, Kopplingar, Egna inställningar. Avsnitten är nu värden i `InstallningsInnehall` och ordningen är ett val i ritningen, så innehållet finns på ETT ställe (kodrörelsen i diffen är en flytt, inget i avsnitten är ändrat). Valet gäller bara standardavsnitten: `ram.kropp` ersätter dem som förut.
- **Prov åt båda håll:** `radpanel-atgard.test.jsx` (13 prov), ett nytt i `radkallor.test.js` (`pagarEtikett`) och fyra i `modulram.test.jsx` (ordningen med och utan `egnaForst`, avsnittet finns en gång, ingen tom plats, det som sparas). Mot koden utan ändringen är **13 av 43 prov röda** i de tre filerna: 11 av de 13 i `radpanel-atgard.test.jsx` (de som kräver att panelen glöms, stänger, visar felet eller verbet, i både listan och kalendern, för både radpanelen och läspanelen), `pagarEtikett`-provet och provet av `egnaForst`. De 30 gröna är dels de äldre i filerna, dels "som förut"-prov som ska vara gröna åt båda håll (en åtgärd utan löfte stänger inte, en länk har inget löfte, ordningen utan valet, det som sparas, ingen tom plats). Med ändringen är alla 43 gröna och `npm run check` är grönt (5066 prov i 258 filer). Mutationer som fälldes av minst ett prov var: effekten borttagen i listan, i kalendern och i läspanelen var för sig, `onKlar` borttagen, felraden borttagen och `pagarEtikett` borttagen.
- **Skärmbild** (Playwright mot en byggd förhandsvisning, 390 px) av knappradens felplats: `docs/bilder/0.147.0-atgardsfel/`, `scripts/atgardsfel-montage.mjs`.

## 0.146.0

### En extern svarar på en händelse från sin egen mejl och får den i sin egen kalender: gäster för en sak får funktionen `delta`

CP 2026-10-25: "Hur är det att skapa en händelse med en extern. Måste de vara med i gruppen då? ... Vill inte att det skall kännas inlåst." Måttstocken i epiken (cllp/ops-framework#445, skiva 1): den som är extern ska kunna vara med från sin egen mejl och sin egen kalender, utan konto och utan vår app. **Inte brytande:** nya valfria konfigurationer, props och exporter. En tjänst utan `delta` och en sida utan `onSvara` beter sig som förut, och en omröstnings- och en gruppinbjudan har exakt de fält de hade. Det här är bara ramverkets del; appens del (raden "Bjud in med e-post", brevet med `.ics`, när det skickas) står i PR-texten. Beslut och skäl: `docs/beslut/0014-gaster-delta.md`.

- **`delta` är en funktion för en sak, inte en ny samling** (`GASTFUNKTIONER`: `rosta`, `delta`). En gäst med `{ slag: "sak", funktion: "delta", handelseId }` ser händelsens rubrik, dag, klockslag och plats (`GASTDELTAHANDELSEFALT`) och svarar **Kommer**, **Kommer inte** eller **Kanske** (`GASTDELTASVAR`). Inget annat: ingen beskrivning, ingen grupp, inga andra gäster, ingen annan händelse. Svaret är ett fält på gästens inbjudan (`deltasvar`), skrivet av servern med villkoret `aterkallad: null`, så en återkallelse och ett svar kan inte korsa varandra. Inga nya regler (`gastregelfragment` nekar redan varje klientskrivning), och raderingen av gästen tar svaret med sig.
- **Ett omfång ger EN funktion.** `gastOmfangGer` ger en `delta`-gäst `delta` och inget annat: alla elva gruppåtgärder och appens `rosta`-väg är nej, `hamta` bygger aldrig appens `sak.bygg` åt hen, och en `rosta`- eller gruppsession är ett nej för `deltaSvara`. Anropet bär bara sessionsnyckeln och svaret: ett id, en adress eller en händelse i anropet läses aldrig.
- **`createGastService({ delta: { handelseSida } })`** slår på det och kräver `radering`. `bjud({ funktion: "delta" })` kräver en händelse med datum. **`farBjuda` får `funktion`** (omröstningens regel "bara medan datumet inte är valt" är fel för delta). Nya metoder: `deltaSvara({ sessionsnyckel, val })` och `tidAndrad({ handelseId })`; `lista` tar `funktion` och delta-rader bär `deltasvar`.
- **`byggIcs` (`ops-framework/node`) är en ren funktion** som gör en VEVENT ur en händelse: UID (`<händelse>@<domän>`), DTSTAMP, DTSTART, DTEND, SUMMARY, LOCATION och SEQUENCE. Tiderna är UTC efter appens `tidszon`, en heldag är ett datum där slutdagen är dagen efter, text escape-tecknas och långa rader viks vid 75 oktetter. Den skickar ingenting, läser ingen klocka (`stampel` är en indata) och kastar för det som inte går att skriva. Brevet är appens: `skicka` får `lankar[i].handelse` och `lankar[i].sekvens` för en delta-länk.
- **SEQUENCE stiger när tid eller plats ändrats, och bara då** (`andringsnyckel`, `nastaSekvens`; sparat på inbjudan, `GASTDELTARADFALT`), vid Bjud in igen, Skicka igen, en ny länk och `tidAndrad`. **`tidAndrad`** skickar ett brev (typ `andrad-tid`) till varje aktiv delta-gäst vars senaste brev sade något annat, sparar först när brevet gått iväg och är idempotent. **En ändrad tid eller plats nollställer gästens svar** (`deltasvar: null` i samma skrivning som höjer SEQUENCE, vid varje utskick som höjer den): ett "Jag kommer" till 18:00 är inget svar på 19:00, och SS gör samma sak (CP 2026-09-24). En ändrad rubrik rör inget. Ett brev som inte gick lämnar svaret orört. Ett brev som inte gick är ett fel med kod (`brev-misslyckades`, med `skickade` och `misslyckade`).
- **Sidan.** `OpsGastSida` får `onSvara({ sessionsnyckel, val })` och ritar själv rubrik, dag, klockslag och plats (samma rubrik som den delade händelsesidan, utbruten som `DeladRubrik`), frågan "Kommer du?", tre knappar som väntar synligt, och en rad som säger vad som svarats (eller att gästen inte svarat än). Svenska och engelska. `OpsGastLista` kallar en delta-inbjudan "Svar på händelse" (inte "Omröstning") och visar svaret som ett märke.
- **Tre svar för gästen, två för medlemmen.** `kanske` finns bara hos gästen (epikens matris säger två; se beslutet). `SVARSVAL` är orörd och `kanske` räknas inte i någon sammanställning.
- **Två rättelser i samma steg.** Gruppens svarssammanställning räknade en gäst för en sak som "har inte svarat" på varje händelse; den räknar nu bara gruppens gäster, samma mängd som `levandeGaster`. Och adressfrågan före inloggningen säger "Du är inbjuden" i stället för "Du är inbjuden att rösta": sidan vet inte vad inbjudan gäller förrän gästen loggat in (nyckelnamnen i ordboken är kvar).
- **Prov åt båda håll:** `gast-delta.test.js` (50 prov), `ics.test.js` (14), `gast-delta-vy.test.jsx` (17) och fem nya regelprov i `gaster.test.mjs` (16 i filen). Mot `origin/main` utan ändringen är 49 av de 50 tjänstproven röda (det enda gröna är provet av `gastOmfangGer`, som redan jämförde funktion mot funktion och som en mutation fäller), alla 14 ICS-prov kan inte laddas, och 15 av 17 vyprov är röda (de två gröna är de som säger "som förut": omröstningens sida och den delade händelsesidans rubrik); med ändringen är alla gröna, och `npm run check` är grönt (5043 prov i 257 filer, 221 vaktregler i `test-guards`) liksom hela regelsviten (`npm run test:rules`, 720 prov). Fjorton mutationer fälldes var och en av minst ett prov: åtta i tjänsten (skrivningen utan villkoret på `aterkallad`, `hamta` som ger delta-gästen appens `sak.bygg`, ett omfång som ger vilken funktion som helst, gruppens summa som räknar alla gäster, `tidAndrad` som sparar före brevet, Skicka igen som alltid bär SEQUENCE 0, `farBjuda` utan `funktion`, delta på en händelse utan datum), fem i vyn och en i regeln (en medlem får skriva: 4 regelprov röda). Skärmbild (Playwright mot en byggd förhandsvisning, 390 och 1280 px) med mått: `docs/bilder/0.146.0-delta/`, `scripts/delta-montage.mjs`.

## 0.145.0

### En rad, en panel: varje rad i Kalender och Idag öppnas i samma panel, med en knapprad som alltid står på samma ställe och Dela på alla rader

CP 2026-10-25 08:22, med en skärmbild av kalenderns dagruta (28 oktober, "Attest större leverantörsfakturor" och "Kolla omatchade bankrader", båda Påminnelse): "Varför kan man inte dela alla händelser? Och alla kalenderhändelser eller idag-listor kan man inte trycka på. Har inget id. Är det inte bättre att det är likadant för allt?" Appen blandar sju sorters rader i Kalender, Idag och Dagen, och bara händelsen hade en egen sida (cllp/ops-framework#446, ordningen i epiken cllp/ops-framework#445: före kalenderskiva 1). **Inte brytande:** nya valfria props, två nya exporter och en ny komponent. Inget tas bort. **Utan `radkallor` är varje rad, panel och utdata som förut** (provat: dagpanelen och Idag-listan är identiska rad för rad med och utan en manifest som inte känner raderna). Det här är bara ramverkets del; appens del (vilka källor och knappar lifehub.app skickar) står i PR-texten.

- **Radens id har formen `<källa>:<id>`**: `byggRadId(kalla, id)` bygger det och `lasRadId(radId)` läser det, exporterade. Källan är allt före FÖRSTA kolonet, så appens eget id får ha kolon (`kalender:2026-10-28:Attest`); ett id utan formen ger `null` (en rad utan källa, som förut) och `byggRadId` kastar på en källa som inte går att läsa tillbaka. Appen använder redan formen (`ical:`, `post:`, `kundfaktura:`, `inkorg:`, `issue:`), så det mesta behöver bara ett manifest.
- **Manifestet `radkallor`** tas emot av `OpsAppShell` (EN gång, delat med ytorna under skalet via `RadkallorKontext`, samma mönster som `handelsepanel`) eller av `OpsCalendar` och `OpsEventList` direkt (propen går före). `{ [källa]: { etikett, atgarder?(rad), dela?(rad) } }`; `etikett` är en text, eller en funktion av raden när Apple och Google ligger under samma källa (`(rad) => rad.kalenderNamn`). **Data och inga noder:** knappen är `{ id, etikett, ikon?, onClick | href, nyFlik? }`, så att ramverket ritar den och knappradens PLATS inte kan glida isär mellan källor; **funktioner av raden**, eftersom knapparna beror på raden (en adress, ett fakturanummer). Heter `radkallor` och inte `kallor` för att `lib/kallor.js` är modulernas källkontrakt, en annan sak. Ett trasigt manifest kastar där det tas emot.
- **Panelen `OpsRadPanel`** är `OpsHandelsePanel` i en dialog över kalendern eller listan (som `OpsExternPanel`, 0.134.0), så att urval, månad, filter och rullning står kvar och Tillbaka lämnar dem som de var. Överst rubrik, när och "Från <källa>"; i mitten raden som den ser ut i listan (typ, kalender, status, utfällningens innehåll som text); längst ned **knappraden**. En rad i Idag har bara appens ord för när ("Om 3 dagar", "Senast 28 okt"), och de står som "När" (`HandelseVy.nar`).
- **Knappraden står alltid på samma ställe** (`OpsHandelsePanel knapprad`, komponenten `Knapprad`): panelens sista element, fast i botten av ytan som rullar (`sticky bottom-0`, panelen `min-h-full`), källans knappar först och Dela sist. En kort påminnelse och en lång faktura har knapparna på samma ställe; en lång text knuffar dem inte ur bild.
- **Dela står på alla rader.** Går raden att dela är det en knapp. Går den inte det (`dela(rad)` ger `{ skal, istallet? }`) står skälet i klartext ovanför knapparna, "Går inte att dela: <skal>. Gör så här i stället: <istallet>", och **ingen död knapp ritas** (en spärrad knapp på en telefon går inte att trycka på för att få veta varför). Saknar källan `dela` helt står ramverkets förvalda skäl. Arbetsreglernas punkt 5: en knapp som saknas är ett svar ingen ser.
- **Posten från Apple eller Google** (`CalendarEntry.extern`) behåller sin läspanel (`OpsExternPanel`) och får knappraden när dess id har en källa i manifestet: källans knappar ("Öppna i Apple") och Dela, med Kopiera till… kvar under informationsrutan. Utan källa är läspanelen som förut.
- **Kalenderns dagruta, snabbtitten och Idag.** En rad med en källa i manifestet är en knapp som täcker hela kortet (`RadLank`, som `HandelseLank` men utan adress) i dagpanelen, snabbtitten och Idag-listan. En rad med `handelseId` eller `extern` går aldrig hit, också när id:t börjar med en känd källa; en rad utan källa är text som förut. Idag-radens chevron och utfällning är kvar.
- **Prov åt båda håll** (`radpanel.test.jsx`, 21 prov, och `radkallor.test.js`, 11 prov): mot `origin/main` utan ändringen är 14 av de 21 röda (de som kräver att något öppnas, att skälet står eller att skalet delar manifestet) och de 7 som säger "som förut" gröna, medan `radkallor.test.js` inte ens går att ladda; med ändringen är alla 32 gröna. Två inplanterade fel fångades: en kalender som gör varje rad öppningsbar, och en panel som ritar Dela även med ett skäl. Vakterna är oförändrade.
- **Skärmbild** (Playwright mot en byggd förhandsvisning, 390 px): `docs/bilder/0.145.0-radpanel/`.
- **`check:skalyta` mäter nu typsnittet appen ritar i, och är grön i varje miljö (cllp/ops-framework#448).** Kontrollen var grön på CI (körning 181) och röd med 9 brott i en sandlåda, av samma kod. Orsak, mätt: sidan laddade bara märkets typsnitt, så brödtexten (`--font-sans`: Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif) ritades i maskinens sans. `9+` i kalenderns räknare var 9,75 px bred i sandlådan (Inter), 8,54 px på CI och 9,48 px i Plus Jakarta Sans; 66 av 574 "mätt:"-rader skilde sig mellan miljöerna. Kontrollen bäddar nu in Plus Jakarta Sans (den latinska delen av den variabla filen, OFL, `scripts/lib/typsnitt/plus-jakarta-sans/`), monterar appen först när typsnitten är laddade och stannar om de inte blev det. Toleranserna är oförändrade. Det gjorde två verkliga brott synliga som CI:s smalare reservtypsnitt dolde, och de är lagade: räknarens ikon och siffra hade 1 px mellanrum (`gap-0` nu, innehållet 19,5 px i cirkelns 20), och raden i dagrutan hade 4 px mellan siffran och indikatorerna (2 px nu; `12|12` slutade 1,7 px utanför rutan vid 1280 px). Kontrollen läste dessutom Avbryt-knappen i skapa-panelen mitt i sin hover-övergång när pekaren hamnade över den (pekaren flyttas och övergångarna får löpa färdigt innan färgerna läses). Mätt: röd utan ändringen (10 brott med rätt typsnitt), grön med den, grön också när systemets sans satts till DejaVu Sans, och röd när räknarens text skadas (8 brott).

## 0.144.0

### Huset står kvar och lyser när man är hemma

CP 2026-10-25: "huset ska stå kvar och lysa när man är hemma, i stället för att försvinna." En knapp som byter plats eller försvinner när man kommer fram får en att undra vart den tog vägen; en som lyser visar var man är. **Inte brytande i API:** inga nya props. **Synlig ändring** för den som ritar `OpsGruppvaxlare` direkt med `oversikt.aktiv` (se nedan).

- **Hemknappen ritas också i översikten, markerad.** Före 0.144.0 ritade skalet hemknappen bara i en grupp, och i översikten var det växlarens knapp som bar huset, med `aria-current="page"` men utan att synas som aktuell. Nu är hemknappen skalets `HemKnapp` i båda lägena, på samma plats (före växlaren under `lg`, efter märket från `lg`). I översikten bär den `aria-current="page"` och lyser med ramverkets egna tokens (`text-accent` på `bg-sunken`); i en grupp är den som förut (`text-ink-secondary`, ingen markering). Ett tryck anropar `oversikt.onValj` i båda lägena: i översikten är det i vanliga fall en no-op (appen går ur gruppen, och där är den redan) och annars en väg hem för en appvy som ligger under Översikten. Det var minst kod och ingen särgren.
- **Växlaren bär inte längre huset i översikten, så det finns aldrig två.** Mätt i koden: växlarens knapp använde `HusIkon` och `data-hemikon` i översikten, så en hemknapp bredvid den hade gett två hus bredvid varandra. Växlaren visar nu vad den gör: `GruppIkon` och namnet `etikett` ("Byt grupp"), med `aria-label` "Byt grupp, nu: Översikt" så att en skärmläsare hör var man är. Inte "Ingen grupp" och inte `PersonIkon`: "Ingen grupp" (0.35.0) är personen utan grupp och är oförändrad, och den som har grupper och står hemma hade läst det som att grupperna är borta; under `md` hade en personikon dessutom stått bredvid avataren. Inte bakgrundsgruppen heller: `aktiv` är den grupp appen minns, och att visa den som vald hade sagt att man är i den. Raden Översikt i arket är kvar, vald.
- **Synlig ändring för `OpsGruppvaxlare` direkt:** med `oversikt={{ aktiv: true, ... }}` utan skalet ritades förut ett hus i knappen och namnet "Översikt"; nu ritas `GruppIkon` och "Byt grupp" (`aria-label` oförändrat "Byt grupp, nu: Översikt").
- **Breddbudgeten rörs inte.** I översikten har huvudet inga åtgärder, bara hemknapp, växlare och profil, så `ATGARDER_SMAL_HEM` gäller som förut för gruppläget (mätt av `check:hemikon`, som nu också kräver exakt en markerad hemknapp i översikten och ingen markerad i en grupp).
- **Prov åt båda håll** i `hemikon.test.jsx` och `oversikt.test.jsx`: i översikten exakt en `[data-hemikon]` med `aria-current="page"` och accentfärg, i en grupp en utan markering, och aldrig två husikoner i huvudet. Rött utan ändringen (8 prov, och `check:hemikon` med "2 husikoner i huvudet, väntat 1"), grönt med (se PR:en).

## 0.143.0

### Taggkomponenter utlyfta ur Biblioteket och dubbelriktade grupptaggar

**Inte brytande:** tre nya exporterade komponenter (`OpsTaggPiller`, `OpsTaggRad`, `OpsTaggFilter`), en valfri prop `extra` på `OpsTaggFilter` och en valfri prop `gruppTaggar` på `OpsBibliotek`. Inget tas bort.

- **`OpsTaggPiller`, `OpsTaggRad` och `OpsTaggFilter` exporterade ur huvudingången** (cllp/lifehub.app#398 (tagga ärenden och meddelanden), cllp/lifehub.app#467 (taggar i inkorgen och ärenden)): Bibliotekets taggpiller, taggrad med `+ Tagg` och förslag samt popover-filtret `Taggar` ligger nu i `src/components/OpsTaggar.jsx` och återanvänds av `OpsBibliotek` och av appens egna vyer i stället för dubbla implementationer.
- **`OpsTaggFilter extra`** (samma ärende): valfri andra sektion i samma popover (`{ rubrik, ikon?, lista, valda, onValda }`, med egen `role="menu"` och piltangenter via `menyPilar`), så att en vy som har både grupptaggar och externa etiketter (till exempel GitHub-labels) kan filtrera båda i en och samma `Taggar`-knapp. Knappen räknar summan av valda och `Rensa alla` nollar båda.
- **`OpsBibliotek gruppTaggar`** (samma ärende): valfri `string[]` med gruppens taggar från andra samlingar (Inkorgen och Ärenden). Slås ihop med `allaTaggar(poster)` utan dubbletter så att taggar som skapats i Inkorgen eller Ärenden också syns i Bibliotekets `OpsTaggFilter` (med `antal: 0` när ingen bibliotekspost bär taggen än) och i `OpsTaggRad`-förslagen.

## 0.142.0

### Val som väntar, datumväljaren öppnar där det behövs, och tipsraden syns

**Inte brytande:** två nya valfria props på `OpsDatePicker`, väntläge i tre val när `onChange` ger ett löfte, och vakten `check:vantar` utvidgad. Inget tas bort. Utan löfte och utan de nya propsen är allt som förut.

- **`OpsDatePicker oppnaPa`** (cllp/lifehub.app#450 (slutdatum och väljarens månad)). ISO-dag som anger vilken månad en TOM väljare öppnar på, också i `onManadVisas`. Med ett `value` gäller värdet. CP fick bläddra nio månader fram för att sätta ett slutdatum i juli 2027. Ett värde som inte är en ISO-dag kastar.
- **`OpsDatePicker tidigast`** (samma ärende). Dagar före den går inte att välja, så ett slutdatum före start syns redan i kalendern.
- **`OpsSwitch`, `OpsCheckbox` och `OpsSelect` väntar när `onChange` ger ett löfte** (cllp/ops-framework#440 (väntläge i reglage och väljare)). Snurra bredvid (i väljaren i pilens plats), `aria-busy`, och ett andra val når inte appen förrän löftet är klart, också två val i samma tick. Valet blir inte blekt: det var just den bleka kontrollen utan rörelse CP inte ville se. Ett avvisat löfte släpper spärren och felet går vidare till appen. Ny intern krok `useLofteVantan`.
- **Vakten `check:vantar` utvidgad** till de tre valen: regeln `valet-svaljs` (ett val vars `onChange` startar ett anrop men inte ger löftet vidare) och `val-utan-vantan` (komponenten själv lägger inte `onChange` genom kroken). Nytt golv: minst 29 val. Taket för undantag är oförändrat 8.
- **Mätt före rättelsen: tre brott i `OpsModulRam`** (På, Visa i huvudmenyn och modulens egna reglage). De ritar resultatet direkt och ställer tillbaka vid fel, men gav inte löftet vidare. Nu gör de det (`sparaListor` ger `bakgrund`s löfte, som aldrig avslås), så reglaget visar en snurra medan servern svarar.
- **Tipsraden syns** (cllp/ops-framework#439 (accentyta, ring och skugga), mergad före utgivningen): accentyta, ring och skugga i stället för en rad som knappt syntes (#438 (tipsraden syns knappt)).

## 0.141.0

### Väntläget överallt där en knapp startar ett anrop: `busyLabel`, vakten `check-vantar` och tjugo ställen där användaren väntade utan att se det

CP 2026-10-23, om en knapp som blev blek utan att något syntes medan servern svarade: "Medans man kopplar måste man få en progress. Detta glömmer vi ofta. Se till att alla ställen där användaren väntar på svar får en progress." **Inte brytande:** en ny valfri prop, en ny vakt och ett antal knappar som nu visar en snurra där de förut bara blev bleka. Inget tas bort. **Appen behöver inte göra något, men hubbens egna knappar har samma fel och rättas i en egen PR efter ompinningen (se PR-texten).**

- **Mätt först: ramverket HAR ETT gemensamt väntläge sedan 0.129.0** (`OpsButton`: ger `onClick` ett löfte är knappen upptagen, med snurra, `aria-busy` och spärr), så det byggdes inte om. Det som saknades var två saker. Dels sa väntläget inte VAD som pågick. Dels såg ingenting till att varje knapp som startar ett anrop faktiskt NÅR väntläget: det räcker att löftet svälts i en blockkropp (`onClick={() => { void spara(x); }}`), att knappen är en rå `<button>`, eller att den är en `type="submit"` i ett formulär (ingen `onClick` att läsa ett löfte ur).
- **Ny prop `OpsButton busyLabel`** ("Sparar…", "Kopplar…", "Tar bort…"). Medan knappen väntar står verbet bredvid snurran i stället för etiketten, och etiketten ligger kvar osynlig (`aria-hidden`) i samma rutnätscell så att knappen är lika bred som den bredaste av de två och ingenting intill hoppar. Namnet för en skärmläsare är verbet. En ikonknapp har ingen etikett att byta och ignorerar propen; utan propen är allt som förut. Använd i ramverket på modulramens Anslut ("Ansluter…"), Koppla från ("Kopplar från…") och Spara ("Sparar…").
- **Ny vakt `npm run check:vantar`** (`scripts/check-vantar.mjs`, `scripts/lib/vantar.mjs`, med i `npm run check`). Den parsar komponenterna (`@babel/parser`, nu ett uttryckligt devDependency) och fäller tre saker: en `OpsButton` vars `onClick` startar ett anrop men inte ger löftet vidare och som saknar `busy`; en rå `<button>` vars `onClick` startar ett anrop utan `aria-busy`; och en `type="submit"` i ett `<form>` vars `onSubmit` startar ett anrop utan `busy`/`aria-busy`. "Startar ett anrop" är `await`, `.then(`, eller ett anrop av en `on...`-prop som filens JSDoc deklarerar med `Promise` i typen (båda formerna: `@param {...} props.onX` och fält i en objekttyp), upp till fyra steg genom lokala funktioner. **Golv** (tomt underlag): minst 60 filer, 250 knappar, 60 anropande handlare och 30 löftesprops, annars röd. **Undantag** med kommentaren `vantar-ej: <skäl>` (minst 20 tecken) för det optimistiska (resultatet ritas i samma varv och ställs tillbaka vid fel) och det som har en egen statusrad. **Tak som bara får sjunka:** 8, och ett undantag som inte täcker något brott är ett fel.
- **Mätt mot origin/main före ändringen: vakten röd med 19 brott** (11 råa knappar, 6 svalda löften, 2 submit-knappar). Efter: grön, med 8 undantag och alla 19 genomgångna en och en.
  - **Rättade, de väntar nu synligt:** Anslut, Koppla från och Spara i modulramen (`bakgrund` ger nu ett löfte som är klart när anropet är klart och aldrig avslås, och knappen ger det vidare: det är här en koppling som tar tid förut bara låg stilla), Kommer/Kommer inte på en inbjudan (den tryckta knappen visar en snurra, den andra är spärrad), åtgärder i en svepad rad (en rad med snurra och åtgärdens namn medan anropet pågår, förut syntes ingenting efter att raden stängts), Ta fram ett arkiverat samtal, Lyft till minnet, Spara och Automatiskt namn på en tråd, skickaknappen i skrivfältet (snurra i stället för pilen), färgpricken i profilen, Välj fil medan filen läses, och laddningsraden under Visa arkiverade (en snurra med status i stället för tre prickar).
  - **Logga ut i menyn** (ingen knapp, så vakten ser den inte; hittad när hubben inventerades). Raden stängde menyn och körde utloggningen efteråt, flera steg i följd innan sidan byts, och inget syntes under tiden (CP 2026-10-22: "Att logga ut tar minst en halv minut"). `meny.onLoggaUt` får nu ge ett löfte: raden säger "Loggar ut…" (`meny.loggarUtEtikett`) med en snurra, är spärrad mot ett andra tryck och menyn står öppen tills löftet är klart. Ger den inget löfte är allt som förut. Ny prop `OpsPanelRow busy` (snurra i ikonens plats, `aria-busy`, spärrad) bär det.
  - **Undantag, åtta (alla med skäl i koden):** de som ritar resultatet i samma varv och ställer tillbaka det med ett fel om skrivningen faller (listans rader och tillägg i `BibliotekLista`, ordningen i `OpsApparArk`, att lägga till och ta bort en tagg i `OpsBibliotek`), och de två utskriftsknapparna i Biblioteket vars tryck byts mot en statusrad (`role="status"`) i samma varv.
- **Prov** (`src/__tests__/vakt-vantar.test.jsx`, 19 prov), bevisade åt båda hållen, se PR:en. Vakten: grön mot komponenterna, röd för sex inplanterade brott på komponenternas egen källtext (en rad tas bort och mutationen kräver att raden fanns), röd för ett undantag utan skäl, ett dött undantag och ett nionde undantag över taket, och röd under golvet. Beteendet: `busyLabel`, RSVP-knapparna, svepraden (både klar och avslagen), Anslut (med avslag) tråden (Lyft till minnet, Döp om) och Logga ut (med och utan löfte).
- **Skillen `interaktionsdesign`** har fått avsnitt 7, "Väntan: varje tryck som väntar på svar visar det", med händelsen och en rad i checklistan före varje PR med UI.

## 0.140.0

### Platsen `installningar.sektion`: en app vars enda yta är en inställningssektion går att installera

CP 2026-10-23, med en skärmbild av gruppens Appar: "Jag har slått på bokning överallt, men kan inte se den under appar att kunna installera." Under "Appar som kan läggas till" stod Ekonomi och Datumomröstning, inte Bokning. **Inte brytande:** en ny plats, en ny exporterad funktion, och inget som redan fungerar ändras. **Appen måste göra något för att få effekt, se sist.**

- **Rotorsaken (mätt i koden).** Erbjudandet under Appar läser `(m.hubb || arBaraTillagg(m)) && !arKarna(m) && !installerade.includes(m.id)` (`OpsHub.jsx`), och `arBaraTillagg` kräver minst ett tillägg. Datumomröstning har två. Bokningens manifest i lifehub.app har `hubb: null` och inga tillägg: dess enda yta är en sektion i gruppens Inställningar som appen ritar själv. Ramverket visste alltså inte att modulen hade en yta, och den kunde aldrig erbjudas.
- **Ny plats `installningar.sektion`** (`INSTALLNINGAR_PLATSER`, med i `PLATSER`). Ytan heter "Inställningar" / "Settings" i `PLATSYTOR`. En modul med bara den platsen är därmed `arBaraTillagg`, erbjuds under "Appar som kan läggas till" och står med "Syns på: Inställningar" (samma rad som Datumomröstnings "Syns på: Händelser"). `defineModule` avvisar platsen på en modul som saknar `komponent`, och en annan plats avvisas som förut.
- **Ny hjälpare `installningsSektioner({ moduler, grupp, sprak, extra })`** (`ops-framework`). Ger sektioner i `OpsInstallningar`:s form (`{ id, rubrik, innehall }`), ett per påslagen moduls tillägg på platsen, via `tillaggFor` (en avslagen modul bidrar inte, en kärnmodul är alltid på). `id` är `<modulId>.<tilläggsId>`. Komponenten får `{ ...extra, grupp }` och kan vara `lazy` (den ritas i en `Suspense`, och `OpsInstallningar` monterar bara den valda sektionen). Ikon, beskrivning och antal är appens.
- **Prov** (`src/__tests__/installningar-plats.test.jsx`), bevisade åt båda hållen, se PR:en.

**Vad appen måste göra** (platsen ritas av appen, inte av ramverket; utan steg 2 syns ingenting):

1. Pinna om till 0.140.0 och sätt `tillagg: [{ plats: "installningar.sektion", id: "installningar", etikett: { sv: "Bokning", en: "Booking" }, komponent: <den lata BokningInstallningar-omslaget> }]` på `BOKNING_MANIFEST`. `hubb` förblir `null`.
2. I `SettingsView`: ta bort den hårdkodade Bokning-sektionen (`visaBokning`, `bokningInnehall`) och lägg i stället `...installningsSektioner({ moduler, grupp: gruppRad, sprak, extra: { kanAndra } })` i sektionslistan, med `ikon` och `beskrivning` pålagda på sektionen med id `bokning.installningar`. Komponenten får `{ grupp, kanAndra }` och hämtar `groupId` ur `grupp.id`.
3. Adressen till sektionen blir `bokning.installningar` i stället för `bokning`. Länkar till den gamla adressen ska läsas som okänd sektion (listan ritas, `OpsInstallningar` gör det redan).

## 0.139.1

### `ops-framework/node`: elva namn till

cllp/ops-framework#434. **Inte brytande:** nya exporter på nodsidan. 0.139.0 byggde sin lista med 32 namn på importer som stod på en rad, och den flerradiga importen i lifehub.apps `functions/apikonfig.js` kom inte med. Appen har därför en tillfällig bro (`functions/ramverkskalendrar.js`, `import("ops-framework")`) som ska bort.

- **Elva namn exporteras ur `ops-framework/node`,** ur SAMMA källmoduler som huvudingången (ingen kopia, regel 2): `arkiveraKalender`, `byggGruppkalender`, `kalenderIdUrNamn`, `nastaOrdning`, `valjForvald` och `validateGruppkalendrar` (appens functions, alla ur `src/lib/kalendrar.js`) samt `postFel`, `olastaI`, `STANDARD_TIDSZON`, `byggMinKalender` och `INBJUDNING_GILTIGHET_DAGAR` (bara appens prov). Alla källmoduler var redan rena, och modulgrafsprovet är grönt.
- **`APPENS_NAMN` i `src/__tests__/nod-ren-ingang.test.js` har nu 43 namn,** och golvet är höjt från 32 till 43. Provet är rött för de elva utan exporten och grönt med (se PR:en).

## 0.139.0

### Prestanda skiva 1: appens funktioner läser ramverket utan React, och växlarens dubbla Översikt är borta

CP 2026-10-22: "Att logga in tar minst en halv minut ... Vi kan inte ha det så." och "Ja på allt" (prestandaplanen, cllp/lifehub.app `docs/prestanda-strategi.md`, avsnitt 3, 4 och 7 rad 1). **Inte brytande:** nya exporter på nodsidan, och en rad mindre i växlarens ark i gruppläget.

- **`ops-framework/node` har allt appens funktioner hämtar.** Mätt mot lifehub.app main: 21 filer i `functions/` importerade huvudingången `"ops-framework"` (React-bunten `dist/index.js`) för 32 namn, och det kostade 2,4 till 2,7 s och cirka 200 MB vid varje kallstart. Nodingången läses på 60 ms. 20 av namnen saknades där och är nu exporterade ur SAMMA källmodul som huvudingången (ingen kopia, regel 2): `AGENTMODELLER`, `FORVALD_AGENTMODELL`, `GRUPPIKONKATALOG`, `KALENDERFARGER`, `KALENDERIKONER`, `forvaldKalender`, `MAX_BIBLIOTEKURL`, `MAX_BIBLIOTEKUTSKRIFT`, `arLjudpost`, `arMittBibliotek`, `byggPost`, `ljudRubrik`, `utskriftFel`, `byggGrupp`, `byggMedlemskap`, `medlemskapsId`, `byggSamtal`, `byggTrad`, `epostFel` och `foreVillkor`. Varje källmodul var redan ren, så ingen fil behövde delas.
- **Mätt inläsningstid (Node 22, 3 körningar vardera, byggd dist):** `src/node/index.js` före **60, 61, 62 ms**, efter **55 till 73 ms** (7 körningar, den första kalla 90 ms), alltså oförändrat; `dist/index.js` (huvudingången) **2515 till 2559 ms**. Tidigare mätning i `src/node/index.js` (0.46 och 2026-09-25): 8 ms för en smalare nodingång, 1946 ms för huvudingången.
- **Ny vakt: `src/__tests__/nod-ren-ingang.test.js`.** Laddar nodingången i en ren Node-process med en modulhook (`scripts/nod-graf-register.mjs`, `scripts/nod-graf-krok.mjs`) som skriver upp varje import Node löser upp, och är röd om `react`, `react-dom`, `@radix-ui`, en fil under `src/components/`, `src/index.js` eller `dist/index.js` kommer med. Det är en mätning av den körande processens graf och inte en läsning av källtexten, så en sammansatt dynamisk import syns också. Golv: minst 20 moduler i `src/lib` och 40 uppslag. Samma prov kräver att var och en av de 32 namnen finns i `ops-framework/node` och är samma värde som huvudingångens. Bevisat åt båda håll: 20 rött utan exporterna; en planterad `import "react"`, en `await import("rea" + "ct-dom")`, en komponentimport och en import av huvudingången i en ren modul är alla röda, och den orörda kopian grön (se PR:en).
- **Växlarens dubbla Översikt.** Sedan 0.138.0 visar huvudet hemikonen i gruppläget, och växlaren hade då också raden "Översikt" ovanför hemgruppens egen rad: två vägar till samma plats. När skalet ritar hemikonen (`grupper.oversikt` given och inte `aktiv`) ritar växlaren inte raden. I översiktsläget är det som förut: växlarens knapp är hemikonen och raden Översikt står överst i arket, vald. `OpsGruppvaxlare` direkt, med `oversikt` given, ritar raden som förut; ändringen gäller skalet. Prov åt båda håll i `hemikon.test.jsx`.

## 0.138.0

### Hemikonen i huvudet i varje grupp

CP 2026-10-22: "det är lite svårt att navigera sig tillbaka till hemgrupp / översikt." **Inte brytande:** ingen ny prop, och utan `grupper.oversikt` ritas skalet exakt som förut.

- **Hemikon i gruppläget.** Är `grupper.oversikt` given ritar `OpsAppShell` en hemknapp (hus, 44 px) längst till vänster i huvudet, före gruppväxlaren, på alla bredder. Ett tryck gör det raden Översikt i växlaren gör: `oversikt.onValj`. Namnet är `oversikt.etikett` eller skalets ord (`ORD_OPSOVERSIKT`). Från `lg` står den efter märket och inte före det, eftersom märkesrutans vänsterkant ska ligga på gruppanelens (`check-skalyta`). På dator var Översikten annars omöjlig att nå från en grupp, eftersom gruppväxlaren inte ritas där.
- **I översikten** är växlarens knapp hemikonen, som förut, och bär nu `aria-current="page"`. Ingen andra hemikon ritas bredvid den.
- **Gruppnamnet kortas nu av (fel som fanns före).** Mellan 768 och 1023 px rann ett långt gruppnamn ut ur växlarens knapp och låg ovanpå flikarna ("Claes Philip Staiger Konsulting Aktiebolag" över "Idag"), eftersom `truncate` på namnet saknade en `min-w-0` på raden runt om. Hemikonen flyttade namnet 52 px åt höger och gjorde det värre. Rättat i `OpsGruppvaxlare`, och mätt.
- **Ny vakt `check:hemikon`** (`scripts/hemikon-montage.mjs`, med i `check:all`): ritar skalet med hemikon, ett långt gruppnamn, sex åtgärder och avatar vid 320, 360, 390, 768, 834, 1023, 1024 och 1280 px och är röd när huvudet rullar i sidled, klungan tränger in i högerpaddingen, kontroller överlappar, hemknappen är under 44 px eller namnet rinner ut. Golv: 32 mätpunkter. Bevisad åt båda hållen (se PR:en).
- **Headerbudgeten (mätt):** med hemikon bär huvudet under `md` högst TVÅ ikonåtgärder (`ATGARDER_SMAL_HEM`), inte tre. Mätt mot byggd dist med ett långt gruppnamn, sex åtgärder och avatar: med tre åtgärder och hemikon tränger klungan 12 px in i högerpaddingen vid 320 px. Åtgärderna som inte ryms är rader i bottenradens Meny som förut, ingen försvinner. Utan hemikon är budgeten tre. Siffran och tabellen står i kommentaren vid konstanten.

### Svep i datumväljaren, och `useSidsvep`

CP 2026-10-22: "Ja, kör båda." **Inte brytande:** en ny exporterad krok, och datumväljaren får ett beteende till.

- **`useSidsvep({ onForra, onNasta, minX?, inaktiv? })`** ger props att sprida på en yta. Fingret åt höger anropar `onForra`, åt vänster `onNasta`. Ett svep räknas bara när rörelsen är minst `minX` px (48) i sidled och mer än dubbelt så stor som i höjdled, så lodrät rullning aldrig utlöser något. Bara finger och penna; ett andra finger avbryter. Ett svep som börjar på `input`, `textarea`, `select`, `[contenteditable]`, `[role="slider"]`, en `OpsSvepRad` med åtgärder, ett element som rullar i sidled eller `data-ingen-sidsvep` räknas inte. Ett svep blir aldrig ett klick på raden under fingret. Propsen bär `touch-action: pan-y pinch-zoom`.
- **`OpsDatePicker`:** med kalendern öppen bläddrar ett svep åt vänster en månad framåt och åt höger en månad bakåt, samma väg som pilarna, så `onManadVisas` och prickarna följer med. Månaden är nu styrd av kalendern själv (med `onMonthChange`), vilket 0.31.0 tog bort i sin ostyrda form; pilarna och tangentbordet fungerar som förut, med och utan valt datum.
- Appen (lifehub.app) kan använda kroken i Dagen för att byta dag. Det ingår inte här.


## 0.137.0

### Datumväljaren kan visa en prick på dagar med händelser

CP vill se vilka dagar som har händelser när han väljer datum, men bara om det inte gör väljaren långsammare. **Inte brytande:** tre nya valfria props på `OpsDatePicker`, och utan dem ritar och beter sig väljaren som förut.

- **`markeradeDagar`** (`ReadonlySet<string>` eller lista av ISO-dagar, "ÅÅÅÅ-MM-DD"): de dagarna får en prick under siffran, i accentens färg (kontrastfärgen i den valda dagen). En dag som inte är en ISO-dag, eller som inte finns i kalendern (som "2026-02-30"), kastar, eftersom en felformaterad dag annars bara hade uteblivit och sett ut som en månad utan händelser.
- **`onManadVisas(forstaDag)`**: anropas med månadens första dag ("ÅÅÅÅ-MM-01") när kalendern öppnas och varje gång användaren bläddrar till en annan månad. Väljaren hämtar ingenting själv: appen räknar fram dagarna för månaden och skickar tillbaka dem som `markeradeDagar`.
- **`markeradEtikett`** (standard "har händelser"): läggs efter dagens namn för en markerad dag, så att en skärmläsare hör det pricken visar.

### Spelraden täcker inte längre mikrofonknappen

Spelraden ligger ovanför mikrofonknappens överhäng och täcker inte längre knappen (cllp/lifehub.app#417). **Inte brytande för API:t** (inga props, inga exporter ändras). **Utseende:** under 768 px står spelraden 16 px högre, med en genomskinlig remsa mellan raden och bottenmenyn där mikrofonknappen sticker upp. Från 768 px är allt som förut.

#### Händelsen

CP, cllp/lifehub.app#417: "Spelaren av ljud lägger sig över mikrofon ikonen i bottenmenyn."

**Mätt, inte antaget:** mikrofonknappen i mitten av bottenmenyn står i radens överkant och lyfts `--bottom-nav-overhang` (16 px) minus ringen, alltså sticker den upp över bottenradens överkant. Spelraden (`OpsSpelare`, 0.102.0) låg på `--bottom-nav-h` plus `--safe-bottom`, det vill säga på radens överkant, och täckte knappens övre del. Eftersom spelraden ligger senare i dokumentet än bottenmenyn (båda `--z-chrome`) hamnade den ovanpå, och ett tryck på knappens övre del träffade spelraden.

#### Ändrat

- `OpsSpelare`: spelraden är nu två rutor. Den yttre (`data-ops-spelrad-ruta`) är fast, har `pb-(--bottom-nav-overhang)` under 768 px och `pointer-events-none`, och är den som mäts till `--spelrad-h`. Den inre (`data-ops-spelrad`) är själva raden, som förut. `--spelrad-h` innehåller därmed överhänget, så `main`, `OpsMeddelanden`, `OpsToast`, `OpsTalk`, `arkOvanforRad` och `fullHeight` slutar vid spelradens överkant utan att någon av dem behövt lära sig talet. Från 768 px är utfyllnaden 0.
- `OpsFloatingSummary`: bubblan räknade förut överhänget och `--spelrad-h` var för sig. Med överhänget i `--spelrad-h` hade det blivit dubbelt, så den räknar nu med det större av dem (`max(--bottom-nav-overhang, --spelrad-h)`). Utan spelare är den oförändrad.

#### Vakt

`check-skalyta` avsnitt 24 ritade förut en EGEN fast ruta som spelrad och satte `--spelrad-h` själv, så den kunde inte se att komponenten låg fel. Den ritar nu skalets riktiga spelare (med TALK i bottenraden) och mäter att spelradens underkant ligger över mikrofonknappens överkant, att ett tryck i knappens mitt och strax under dess överkant träffar knappen, att avståndet till bottenraden är överhänget, att `--spelrad-h` är avståndet mellan spelradens och bottenradens överkant, och att ytan slutar vid spelradens överkant. På en dator (1024 px) mäts att raden ligger längst ned och att `--spelrad-h` är radens egen höjd. Golv: fem lägen. Körs ensamt med `node scripts/check-skalyta.mjs --bara-spelrad`. Röd mot 0.136.0 och grön med ändringen, se PR:en.


## 0.136.0

Typografin ritar som SessionStudio: kryssrutor, reglage, flikar, banners, tomma lägen och toasts får SS storlekar och vikter, och `body` får SS ordavstånd och kantutjämning. CP 2026-10-21 ("Känns tjockt och stort och inte snyggt och enkelt"). **Inte brytande för API:t** (inga props, inga exporter ändras). **Brytande för utseendet:** text blir mindre och lättare på de ställen som listas nedan, och en app som mätt pixlar mot 0.135 får nya mått. Dessutom en skill, `interaktionsdesign`, som följer med paketet och skrivs ut i appens `.claude/skills/`.

### Händelsen

CP 2026-10-21, med LifeHubs Inställningar (panelen API-nycklar) bredvid SessionStudios Mitt bibliotek: "Det känns som att någon skrivit över vilka typsnitt vi skall använda i appen ... Fattar inte varför vi faller tillbaka på den stora feta texten överallt."

**Mätt, inte antaget** (Playwright i Chromium, SessionStudios egen Tailwind 3-CSS och egna klasssträngar mot ramverkets riktiga komponenter, bredd 1280 och 390):

- **Typsnittet var rätt.** Plus Jakarta Sans laddas i LifeHub (Chromium `CSS.getPlatformFontsForNode` svarar `Plus Jakarta Sans`), `--font-sans` är samma som SS och skalan (`text-etikett` 14, `text-meta` 12, `text-hjalp` 11) är SS.
- **Det som skilde var vilken roll komponenterna valde.** Före och efter, ramverkets komponent mot SS:

| Element | SS | Före (0.135) | Efter (0.136) |
|---|---|---|---|
| Kryssrutans etikett (`OpsCheckbox`) | 14/400 | 16/400 | 14/400 |
| Reglagets etikett (`OpsSwitch`) | 14/400 | 16/400 | 14/400 |
| Hjälptext under en rad | 11/400 | 14/400 | 11/400 |
| Flik (`OpsTabs`) | 12/500 | 16/600 | 12/500 |
| Bannerns titel och text | 14/500 och 12/400 | 16/600 och 16/400 | 14/500 och 12/400 |
| Tomt läge, titel och text | 14/500 och 12/400 | 16/600 och 16/400 | 14/500 och 12/400 |
| `body`, ordavstånd och kantutjämning | 0.06em, antialiased | 0, auto | 0.06em, antialiased |

### Vad som ändras

- **`text-brod` (16 px) är borta ur UI-text.** Etiketter, rader, meddelanden och beskrivningar är `text-etikett` (14). 16 px finns kvar i dokumentläget (`OpsMarkdown`), utskriften i biblioteket, avatarens bokstäver och i fält på telefon, som nu skrivs `text-brod md:text-etikett` (16 px under md så att iOS inte zoomar, 14 från md).
- **`font-semibold` är rubrikens vikt.** Radnamn, pillar, taggar, märken, flikar, knappar och fältetiketter är `font-medium` (500). Rubriker (roller, `h1` till `h6`, versala etiketter, accentlänkar) behåller 600. Rubriker som förut var `text-brod font-semibold` är rollen `text-rubrik`.
- **Banner, tomt läge och toast** följer SS `ErrorBanner` och tomma läge: titeln `text-etikett font-medium`, texten under `text-meta`.
- **`OpsToggle`:** etiketten 14 px, hjälptexten under 11 px (`text-hjalp`).
- **`body`:** `word-spacing: var(--word-spacing-normal)` (0.06em, SS #2501), `-webkit-font-smoothing: antialiased`. Värdet fanns i tokens men ingenting läste det. Rubrikernas spärrning (SS `h1, h2, h3 { letter-spacing: -0.01em }`) sätts medvetet inte i `body`: den bor i de publika rollerna, och `check-brand --bevisa` blev grön trots ett inplanterat brott när en bas-regel fanns bredvid.
- **Medvetet oförändrat:** Inställningarnas lista (`OpsInstallningar`) behåller titeln 16/600 och beskrivningen 14. `check-skalyta` kräver där att beskrivningen är minst 13 px och att titeln är större (CP 2026-10-06, "texterna känns ihoptryckta"), och ramverket har ingen 13-pixelsroll. De två kraven går inte att förena med SS bibliotekrad (14/500 och 12). Att ändra den raden är CP:s beslut och en ändring av `check-skalyta`. Gruppkortets namn behåller 600 (`check-skalyta`). Kalenderns dagsiffror, och sidrubriken i `OpsViewHeader` (14/600 mot SS 20/600, CP 2026-10-13) rörs inte.

### Vakter

- **`check-typografi` (ramverksläget):** `text-brod` utan responsiv 14 px och `font-semibold` på något som inte är en rubrik fälls. Undantagen har tak med skäl per fil (`typografi.tak` i `tokens/sessionstudio-profil.json`), och taket får bara sjunka: färre träffar än taket är också rött. Mot 0.135:s komponenter: 141 brott. Mot 0.136: noll.
- **`check-typografimatning` (ny, `npm run check:typografimatning`):** ritar komponenterna i Chromium och kräver samma storlek och vikt som SS för 14 element (`typografi.element.lista`, 27 mätningar på 1280 och 390 px), plus `body`. Golv: minst 12 element. `--bevisa` kör vakten med ett inplanterat brott per påstående. Mot 0.135:s komponenter: 24 avvikelser. Mot 0.136: grön. Ligger i `check:all`, i `check.yml` och i `publish.yml`.
- **`kanon-skills`** (ny, `scripts/kanon-skills.mjs`): skriver paketets skills som har `konsument: true` till konsumentens `.claude/skills/` och vaktar att kopian är i takt. Se nedan.

### Skill: `interaktionsdesign`

`skills/interaktionsdesign/SKILL.md`, skriven för agenter som bygger vyer: en sidrubrik och få sektioner, det befintliga före det som skapas, en mening under en rubrik (resten bakom `OpsHelp`), skapa-formulär bakom en knapp i en dialog, grupperade och kompakta val, SS täthet och en checklista före varje PR med UI, med kravet på montage bredvid SS (regel 12). Skälet (CP:s ord) och API-nycklarna som motexempel står i filen.

### Så når skillen konsumenterna

Ramverket äger skillen. Konsumentens `.claude/skills/interaktionsdesign/` är en GENERERAD kopia med en rad överst som säger det, och `kanon-skills` blir röd när den ligger efter, saknas, har en kvarglömd fil eller är föräldralös. Konsumentens egna skills rörs aldrig, och en handskriven skill med samma namn skrivs aldrig över (vakten säger ifrån). Flaggan `konsument: true` står i skillen själv, så ramverkets interna skills följer inte med. `create-ops-app` lägger in `npm run kanon:skills` och `check:kanon-skills` i nya appar.

**Vid ompinning till 0.136.0, varje konsument (lifehub.app, lifehub.identity, bolag-ops, tam):**

1. `node node_modules/ops-framework/scripts/kanon-skills.mjs --skriv` och committa `.claude/skills/`.
2. Lägg `"check:kanon-skills": "node node_modules/ops-framework/scripts/kanon-skills.mjs"` i `package.json` och i kedjan `check` (och i CI).
3. **lifehub.app:** 11 `text-brod` i sju filer och 46 `font-semibold` i 19 filer ligger kvar på löptext och radnamn. De är appens, och ändras med skillens checklista. `check:typografi src` är oförändrad (app-läget).
4. **lifehub.identity:** `web/src/identity.css` har ett eget `word-spacing: 0.06em` (`--word-spacing-ui`) på `body` och formkontroller, som nu är en andra sanning bredvid ramverkets `body`. Ta bort `--word-spacing-ui` från `body` och behåll raden på `button, input, select, textarea` bara om en mätning visar att kontrollerna inte ärver. Tio egna `font-size` (0.75, 0.8, 0.85, 0.9 och 1 rem) står utanför rollskalan. Identity ligger på 0.95.1.
5. **bolag-ops:** ligger på 0.76.1, 60 versioner efter. Repinning är ett eget arbete (41 `font-semibold`).

## 0.135.0

Skaparen får ett valfritt `via`, så att det en personlig API-nyckel skriver syns som skrivet via nyckeln: "Miranda via Byggagent". cllp/lifehub.app#409, CP 2026-10-21 ("Ja på alla"). **Inte brytande för kod:** fältet är valfritt, och utan det är allt som förut. **Ändrad regeltext:** `regelfragment()` och fem andra fragment får nya villkor, så appen genererar om `firestore.rules` och deployar dem (se nedan). Appen behöver göra några saker efter ompinningen.

### Händelsen

CP 2026-10-21: en person ska kunna skapa en personlig API-nyckel för sin egen användare i en grupp, och det nyckeln skriver ska komma FRÅN personen ("ett chattmeddelande från Mirandas nyckel kommer från Miranda") men alltid synas som skrivet via nyckeln. Utan ett märke på raden går en rad från en agent som arbetar åt Miranda inte att skilja från något Miranda skrev för hand, och det är precis den skillnad ett ärende, en kommentar eller ett meddelande ska bära.

### Vad som är nytt

- **`via: { nyckelId, namn }` på skaparstämpeln** (`byggSkapare`). Valfritt. `nyckelId` är gemena hexsiffror, högst `MAX_NYCKELID` (64) tecken, `namn` högst `MAX_SKAPARNAMN` (100). `byggSkapare` kastar på fel form och på ett `via` utan `uid` (ett märke om att en nyckel skrev åt ingen pekar inte ut någon). `byggVia` och `viaFel` är samma prövning som egna funktioner.
- **`skaparensNamn(skapare, sprak)`** ger "Miranda via Byggagent", och **`namnMedVia(namn, via, sprak)`** sätter ihop ett namn vyn redan löst själv (`personnamn`, medlemslistan). Ordet "via" ligger i textlagret (`ORD_SKAPARE`, sv och en). `laesSkapare` tar med `via` och tål ett skadat (tappar det i stället för att kasta).
- **Vyerna ritar märket:** `Ursprungsrad` (händelser och ärenden, listan och panelen), `OpsBibliotek` (Skriven av), `OpsBeskrivenApp` (Skapad av), `OpsKommentarer` (tråden) och `OpsKommentarsrad` (nytt valfritt `via`, från `kommentarsrader` som bär `senaste.via`), ändringsloggen i `OpsKatalogInstallning` och chatten i `OpsMeddelanden`.
- **Chatten:** ett meddelande bär `via` (`byggMeddelande({ ..., via })`). Namnraden heter "Miranda via Byggagent" och ritas också i ett privat samtal. Mirandas eget meddelande via hennes nyckel heter "Du via Byggagent". Ett meddelande från en nyckel fortsätter aldrig personens eget inom fem minuter (annars hade märket gömts under ett namn utan märke).
- **`npm run check:skaparnamn`** blir röd när en vy läser `skapadAv.namn` rakt av, när en vy som ritar en skapare slutar gå genom funktionen, eller när chatten ritar fler direkta namn än taket.

### ⛔ Reglerna: en klient skriver aldrig `via`

- **`SKAPARFALT` är oförändrad** (de fyra fält en klient får skriva), och `via` står medvetet inte där. Regelfragmentens `hasOnly` är härledda ur den listan, så ett fält som hade lagts dit hade öppnat varje regel på en gång. `SKAPARFALT_SERVER` är samma lista plus `via`, för kod som skriver med Admin SDK.
- **Ny regelfunktion i `regelfragment()`:** `opsStampelUtanNyttVia(d, falt, fore)`. En klient får inte skriva en stämpel med `via`, och får inte heller ta bort eller byta den på en rad som redan har den. En stämpel som är OFÖRÄNDRAD släpps igenom, så att personen kan ändra en post hens nyckel skrev.
- **Bibliotek, beskrivna apparnas rader och beskrivningar** släpper in en oförändrad stämpel med `via` (`opsSkaparstampel`) och nekar allt annat. **Ändringsloggen (`av`) och kommentarerna** nekar `via` helt. **`opsHandelsefaltGiltiga`** (appens händelser) nekar ett nytt eller ändrat `via` på `skapadAv`. Chattmeddelanden, minnet (`lyftAv`) och modulinställningarna (`uppdateradAv`) nekade redan fältet (`hasOnly`), och det är nu bevisat med prov.
- **`gruppadSamling(namn, { skaparfalt: "skapadAv" })`** för appens egna samlingar med en skapare: blocket nekar då att en klient lägger till, tar bort eller byter `via` (create och update). Utan valet är texten byte för byte den förra. `gruppadSamling` prövar annars inte vad som står inuti ett fält.
- **Ändrad regeltext:** `regelfragment()` får två nya funktioner (`opsStampelUtanNyttVia`, `opsSkaparstampel`), och biblioteket, de beskrivna apparna, loggen, kommentarerna och händelsefälten ändrade villkor. Regelfixturerna följer. Biblioteket prövar ett via som inte håller i `postFel` (text) och `byggPost` (kastar).

### ⛔ Vad som medvetet inte är med

- **Gästvyerna** (`OpsGastChatt`, `OpsGastArenden`, `OpsGastGrupp`) ritar DTO:er ur `node/gast.js` som saknar `via`: en gäst ser personens namn. Att släppa ut nyckelns namn till en gäst är ett eget beslut.
- **`lyftAv` (minnet) och `uppdateradAv` (modulinställningar)** har inget `via`: de skrivs av en person i appen och aldrig av en nyckel.
- **Delningslänkarnas och gästinbjudningarnas `skapadAv`** (`node/delning.js`, `node/gast.js`) skrivs av servern som förut och får inget `via`: ingen nyckel skapar en delningslänk eller en gästinbjudan.

### ⛔ Vad appen behöver göra efter ompinningen (lifehub.app)

1. **Regeldeploy före första nyckelskrivningen.** Servern (Admin SDK) går förbi reglerna, men en person som ändrar en post eller rad hennes nyckel skrev nekas av de gamla reglerna (`hasOnly` känner inte `via`). Generera om `firestore.rules` ur de nya fragmenten och deploya dem INNAN `via` börjar skrivas.
2. **Appens egna regler** för inkorgens ärenden (och för andra egna samlingar med en skapare): ange `skaparfalt: "skapadAv"` till `gruppadSamling`, eller anropa `opsStampelUtanNyttVia(request.resource.data, 'skapadAv', fore)` i egna regler, i `create` (med `{}` som `fore`) och i `update` (med `resource.data`). Ramverket prövar inte appens egna samlingar.
3. **Servern skriver stämpeln med `byggSkapare({ uid, namn, typ: "manniska", kalla, via: { nyckelId, namn } })`**, chattmeddelandet med `byggMeddelande({ text, av, via })` och bibliotekets post med `byggPost` (som godtar `via`). Gruppnyckeln (en medlem av typen agent) skriver som sig själv, utan `via`.
4. **Appens egna vyer** som ritar en skapare (inkorgen, ärenden) ska gå genom `skaparensNamn(skapadAv, sprak)`. `kommentarsrader(...)`.senaste.via skickas vidare till `OpsKommentarsrad via={...}`.
5. **Gästernas vyer** visar fortfarande personens namn utan märke, som förut.

### Proven, båda riktningarna

Regelproven (`rules/__tests__/skapare-via.test.mjs`, 18 prov) är röda på de gamla reglerna och gröna på de nya, vyproven (`skapare-via-vyer.test.jsx`) är röda utan vyändringarna, och vakten har sin egen mutationstabell i `test-guards`. Utfallen står i PR-texten.

## 0.134.0

Kalendrarna som EN lista med ett minne, en visning per kalender (Händelser, Ram eller Båda), en läspanel för en extern händelse och "Kopiera till…" för alla händelser. cllp/lifehub.app#402, CP 2026-10-20 och 2026-10-21. Inte brytande för kod: allt nytt är valfria props och nya exporter. **Ett beteende ändras (se nedan).** PR 2 av 3 (Identity och appen görs i egna PR:er).

### Händelsen

CP 2026-10-20, med en skärmbild: "Men varför kommer dom upp som både kalendrar och kalenderlager? Kaka på kaka. Det är allvarliga saker som skall fixas." Apple och Google matades in två gånger, som kalendrar och som lager, och valet bodde på fyra ställen: en kalender kunde vara på i ett och av i ett annat, och väljarens eget val sparades inte alls. Beslut 2026-10-21: en lista som heter Kalendrar, en `OpsSwitch` per rad, ett minne per person och grupp, en visning per kalender, "utan fördröjning" (ett tryck ändrar kalendern direkt ur det som redan är laddat, tak 100 ms) och "varje händelse går att öppna".

### Vad som är nytt

- **Listan Kalendrar** i `OpsCalendar`: en rad per kalender med färgprick, namn, märke och en `OpsSwitch`. Appen skickar `sektion` och `marke` per kalender (`avFranStart` för en som är av tills personen slår på den) och valfritt `kalendersektioner` (ordning och tomtext). Ingen rå kryssruta.
- **Ett minne:** `kalenderMinne` (appens nyckel, `person:grupp`) sparar vilka kalendrar som syns och hur de visas under `ops-kalender-synlighet:<minne>`. Valet ändras i samma tryck och sparas efteråt; ingenting väntar på sparandet och ingenting hämtas om. `onSynligaKalendrar(ids)` och `useKalenderSynlighet` ger en annan vy (Idag) samma val.
- **Visning per kalender:** Händelser, Ram eller Båda (`OpsSegmented`, en utfällning under raden). Ram ritar dagens ram i kalenderns färg. Sparas i samma minne.
- **Läspanel för en extern händelse** (`CalendarEntry.extern`, utan `handelseId`): samma `OpsHandelsePanel` i en dialog över kalendern, bara för läsning, med källraden ("Från Apple, ändras i Apple", appens ord).
- **"Kopiera till…"** i `OpsHandelsePanel` för alla händelser (`kopieraTill`, `onKopiera({ handelse, malKalenderId })`, `kopierad`). Ramverket öppnar inget formulär. En kopia till en kalender som redan har en varnar först.
- `HandelseVy.kalla`, `OpsSwitch.ikon` och `filtreraPoster({ doldaKalendrar })`.
- **Snabbare:** `Dagruta` ritas om bara när den själv ändrats. Mätt i jsdom med 86 märken i 25 månader: 91 till 97 ms för ett tryck före, 35 till 64 ms efter.

### ⛔ Vad som ändras för den som redan använder det

- **Ett tryck på en kalender i väljaren betyder inte längre "visa bara denna".** Det slår AV kalendern (och på igen), och den som vill se en enda kalender slår av de andra. Provet "ett tomt kalenderurval är Alla, inte Inga" gällde det gamla valet och är ersatt: alla avslagna är en tom månad som säger det (knappen heter "Inga kalendrar"), och raden Alla kalendrar tar fram allt igen. bolag-ops får detta utan att skicka något.
- **Kalenderlagren är borta ur `OpsCalendar`** (CP 2026-10-21: "kör så"). Knappen Kalenderlager och plockarens ruta (sektionerna "Från appen" och "Externa kalendrar") finns inte längre, och **`lager`-propen KASTAR** med ett fel som pekar på `kalendrar` och `kalenderMinne`, i båda sina gamla former. Ett tyst ignorerande hade dolt en app som inte migrerat. Ärenden är en vanlig rad i listan Kalendrar (egen sektion, växel, visning och färg), och Apple och Google står bara under Från Mitt konto. `lagerNyckel` och `lasDoldaLager` finns kvar bara för appens migrering. `dagdekor` och `daglager` är oförändrade. `OpsKalenderlager` (intern) är borttagen.
- Kalenderlistan är bredare (288 px) och har en rad per kalender i stället för en knapp. `lager` i skalytans mätning är flyttad till en scenknapp utanför kalendern.

### Proven, båda riktningarna

Utfallen och mutationerna står i PR-texten.

### Kvar för appen

`lager`-propen ersätts med `kalenderMinne` och Ärenden en rad i `kalendrar` (annars kastar kalendern). Migrering av sparade val, exakt: läs `ops-kalender-lager:<person>` (`lasDoldaLager`) och märket `lifehub-arendelager-forval:<person>`; om `ops-kalender-synlighet:<person>:<grupp>` saknas, skriv den (`skrivKalenderSynlighet`) med `syns[id] = false` för varje dolt id som är en rad i gruppen och `syns[<arendenid>] = true` bara när `lager:arenden` inte är dolt och märket finns; rör inga gamla nycklar och inte `ops-kalender-dolda-appar:<grupp>` (stegen står i README, "Kalendrarna som en lista"). Idag som följer listan (`onSynligaKalendrar` eller `useKalenderSynlighet`), kopieringen (vad `onKopiera` gör, och `kopierad` ur kopians ursprung), och id:t `ical:<kalenderId>:<uid>:<start>` för en extern händelse. Dagpanelens rubriker (Grupp och Mina) räknar en kalender utan `grupp` som "Mina" också när den har en `sektion`; det ändras inte här.

## 0.133.0

En meny för alla poster, publik länk till varje typ, en delad lista som spellista, och utskriften som kan tas bort, köras om och gå i bakgrunden. lifehub.app#356 och #349, CP 2026-10-18 till 2026-10-20. Inte brytande för kod: allt nytt är valfria props och nya exporter. **En text ändras (se nedan).** Kommer efter 0.132.0 (gäster, skiva 2 och 3). Design och skäl: `docs/beslut/0013-dela-alla-typer-och-en-levande-lista.md`.

### Händelsen

CP 2026-10-18: "Vi skall ju ha en publik länk till varje artefakt med option på att den som ser kan ladda ner." Och 2026-10-20: "EN lista måste kunna delas ... det ser ut som en lista, men alla sakerna i listan delas. Som att jag vill dela en playlist för ett gig." Mätt före: "Dela länk" fanns bara på en färdig fil, en lista fick bara Byt namn och Radera, och en anteckning och en fil hade olika menyer. Samma dag: "Ändras listan kan den ju bara ändras för alla som den delas med. Om en låt tas bort kan den bara tas bort precis som för den som skapade den." Och om utskriften: "Kan man göra så att man kan ta bort transkribering på en ljudupptagning och köra om den?", som ska gå i bakgrunden och fortsätta även om man går därifrån.

### Vad som är nytt

- **En meny för fil, anteckning, länk och lista**, samma rader i samma ordning (Redigera, Byt namn, Dela länk, Visa detaljer, Lägg i lista, Kopiera länk, Flytta eller kopiera, Radera). "Lägg i lista" och "Flytta eller kopiera" finns på en lista som **avstängda rader med förklaring** (`OpsAtgardsblad`: `avstangd` och `forklaring`, `aria-disabled`, förklaringen läses med raden). `arDelbar(post)` säger vad som går att dela och delas av menyn och servern.
- **Publik länk till alla fyra typer** (`createDelningService`). Svaret bär vitlistade fält per typ (`ANTECKNINGSSVARSFALT`, `LANKSVARSFALT`, `LISTSVARSFALT`; filen oförändrad). **En lista delas hel och som en levande spegel**: servern läser listan vid varje hämtning (`losLista`), en post som tagits ur listan syns inte, en raderad post blir "Finns inte längre", ordningen följer listan, och inget av listan lagras i delningen. Tak: `MAX_DELADE_LISTPOSTER` (100) med `ejVisade`. Nedladdningsvalet gäller varje fil.
- **Den publika vyn** (`OpsDelad`) ritar anteckning, länk (en tydlig knapp, bara http och https) och lista som en spellista med EN `OpsLjudspelare` (nästa låt startar när en tar slut, och en låt som försvunnit ur listan hoppas över). `OpsLjudspelare` får `onSlut`, `onSpelstatus`, `autoSpela` och `startnummer`.
- **Utskriften kan tas bort och köras om**: `onSkrivUtIgen({ id, groupId })` och `onTaBortUtskrift({ id, groupId })` i `OpsBibliotek`, båda med fråga först, bara med utskrift och `farAndra`.
- **Utskriften går i bakgrunden, med läget på posten**: `utskriftJobb` (`{ status, startad, av, fel? }`) och `utskriftLage(post, nu)` (`ingen`, `pagar`, `fel`, `klar`; en `pagar` över 15 minuter är ett fel). Kortet och detaljen ritar läget ur posten och överlever att man går därifrån. `UTSKRIFT_FALT` är listan fält servern rensar. Uppskattningen av tiden är märkt som en bedömning. Ingen procentstapel.
- **Reglerna** nekar klienten att skriva `utskriftJobb` (skapa, ändra, ta bort), men en ändring av annat på en post med jobb går igenom.
- **Ljud: ladda upp och spela in.** "+ Ny" under fliken Ljud är en meny med "Ladda upp ljudfil" (dold filväljare, `accept` är `LJUDFIL_ACCEPT`, prövas av `ljudfilFel`, sparas av appens `onLaddaUpp`) och sedan "Spela in". Utan mottagare för inspelningar är uppladdningen en knapp direkt, utan meny. Under Alla heter raden "Spela in ljud" (förut "Röstinspelning"). `audio/aac` är ett tillåtet filformat (regler och lagringsregler följer `FILMIME`), och `audio/x-m4a`, `audio/m4a`, `audio/mp3` och `audio/x-aac` normaliseras till de vanliga namnen.
- **Rättat: en inspelning från Biblioteket sparades inte i Biblioteket.** Skalet härledde låset till modulens mål ur gruppens påslagna moduler vid varje rendering (sedan 0.105.0). Försvann modulen ur listan en stund under inspelningen föll fältet tillbaka till appens första mål, och vid Klar ritades "Vad ska hända med det du sa?" och ljudet gick aldrig till modulens `spara`. Målet fångas nu när inspelningen startar och släpps när den är över. ⛔ Mekanismen är bekräftad i en byggd app (lifehub.app PR 399: när målet tvingas bort under inspelningen visas valen och `spara` anropas aldrig), men vad som tar bort målet i produktion är INTE återskapat. Hypotesen är att `useGruppensTillganglighet` läser om och döljer appar som kan döljas medan den laddar. Rättningen gör att utlösaren, vad den än är, inte längre kan flytta ljudet.

### ⛔ Vad som ändras för den som redan använder det

- `DELNINGSFEL.saknas` är "Finns inte längre" och inte "Filen finns inte längre". Raden bär ingen typ, och en raderad post säger inte vilken av de fyra den var.
- `createDelningService.skapa` nekar `nedladdning: true` för en anteckning och en länk (förut kunde de inte delas alls).
- Rättat på vägen: en delad ljudfil bad om en ny adress (`onNyUrl`) vid första ritningen, innan något gått fel.
- ⛔ `audio/aac` i `FILMIME` ändrar de genererade reglerna och lagringsreglerna. **Deploya reglerna före klienten**, annars nekas en .aac-fil som klienten nu godtar.

### Proven, båda riktningarna

Utfallen, mutationerna och emulatorkörningarna står i PR-texten.

### Vad appen måste göra

Se README, avsnitten "Alla fyra typer delas" och "Utskriften går i bakgrunden och kan köras om", och PR-texten under "Kvar för appen".
## 0.132.0

Gäster, skiva 2 ("hela gruppen", det bantade gränssnittet) och skiva 3 (ärenden till en gäst), cllp/lifehub.app#389, och en filknapp i kommentarerna. Inte brytande: allt är nytt eller en ny valfri prop, och appen behöver inte ändra något för att ompinna (ett undantag: `OpsSvarSummor` kräver `rubrik`, men den är ny i den här versionen). Design och skäl: `docs/beslut/0012-gaster-hela-gruppen.md`.

### Händelsen

CP 2026-10-20: externa ska kunna vara med i hela projektet. Beslut på designen: (1) ägare och admin bjuder in till hela gruppen, (2) gästen ser chattens hela historik och dialogen säger det, (3) radering av en gästs uppgifter och en text om integritet är klara före första gruppgästen. Under bygget kom tre beslut till, samma dag: **gästen får skriva i gruppchatten** (designen sade "utan skrivfält"), **gästen ser inte gruppens ärenden** ("ärendelistan kan bära sådant som inte rör gästen"; skiva 3, nedan, ger hen bara de som delegerats till hen, i samma PR), och **gästen bjuds in från gruppens medlemsvy** (ett val i Roll under Bjud in), inte på en egen plats. Dessutom, ett separat beslut: kommentarens filknapp ska se ut som chattens bilaga.

### Vad som är nytt

- **Omfånget `{ slag: "grupp" }`** bredvid `{ slag: "sak", ... }`. Befintliga id ändras inte (fem fasta hashar är provade mot skiva 1). Taket är oförändrat och delas: **en person tar en plats oavsett antal omfång**.
- **Gästens API i samma tjänst** (`createGastService` med `grupp` och `radering`): `chatt` (hela historiken, 50 per sida), **`skrivChatt`**, `kalender`, `handelse`, `svara`, `rosta`, `bibliotek`, `fil` (signerad adress, 15 minuter, högst 50 per inbjudan och dygn), `raderaMig`. Allt med vitlistade fält per åtgärd, inga medlemsadresser, och en återkallad gäst nekas vid nästa anrop i varje åtgärd. **Gruppens ärendelista finns inte för en gäst**; bara de ärenden som delegerats till hen (skiva 3, nedan).
- **Gästen skriver som gäst, aldrig som medlem** (`skrivChatt`): servern skriver `{ text, av: <g_-id>, avNamn, tid }` och inget annat. Högst 1000 tecken (`GASTSKRIV_MAX_TECKEN`), 10 per inbjudan och minut (`GASTSKRIV_PER_MINUT`, i `gastraknare`), bara text, och samma krav som att läsa (återkallad, utgången och omröstningsgäst nekas). Märket **Gäst** härleds ur `av` (`arGastId`) och syns i medlemmarnas chatt (`Meddelanderader`) och i gästens. Gästens meddelanden raderas med gästen.
- **Medlemmens sida:** `lista({ groupId })` ger en rad per person, `aterkallaAlla`, `ersattAvMedlem`, `radera` (inbjudningar, sessioner, räknare, röster, svar, **meddelanden**, plats). Bara ägare eller admin bjuder in till hela gruppen, i ramverket och inte i en callback.
- **`OpsMedlemmar` med `gaster`:** "Gäst (utan konto)" är ett val i Roll under Bjud in. Med Gäst valt: "X av 5 gratis platser", ingressen, knappen "Bjud in utan konto" och en bekräftelse som säger vad gästen ser och kan (chattens hela historik och att skriva i den, kalendern och händelserna, biblioteket; inte gruppens ärenden, bara de som delegeras till hen; det går inte att ta tillbaka). Väntande gäster står bland de väntande inbjudningarna med Skicka igen och Dra tillbaka. Raden under E-post säger att en adress utan Google-konto kan bjudas in som gäst.
- **`OpsGastLista`** får `personer` (en rad per person med inbjudningarna under), `onBjudGrupp` (efter bekräftelse), `onAterkallaAlla`, `onRadera` (bekräftad) och `utanRubrik`. **`OpsGastGrupp`** (flikarna Chatt, Kalender, Bibliotek och, med minst ett delegerat ärende, Ärenden; ingen väg ut), **`OpsGastChatt`** (chattens bubblor och skrivfält utan bilagor, mikrofon och agent) ritar gästens sida; **`OpsGastSida`** får `renderGrupp`, `onRaderaMig` och en integritetstext, och **prövar alla sparade sessioner** på enheten (hålet från skiva 1: en återkallad grupp dolde en levande omröstning).
- **Återanvänt, inte nytt:** kalendern är `OpsCalendar`, händelsen `OpsHandelsePanel`, biblioteket `OpsBibliotek` med `jag: null`, `utanHubb` och **`adresserPaBegaran`** (bara den öppna filen signeras; designen antog felaktigt att listan inte hämtade adresser). `OpsSvarSummor` är gästens svarsrad (summor, inga namn). `OpsSvar` får `gaster`. `OpsTabs`: flikarna är minst 44 px och får plats i en telefon.
- **Kommentarens filknapp** (`OpsKommentarer`, `OpsFilePicker` `knappPlats`, `OpsTextarea` `bifogaPlats`): en gem i skrivrutan som heter **Bifoga**, bredvid mikrofonen, i stället för den stora knappen "Välj fil" under rutan. Förhandsvisning före sändning, Cmd+V och att filen skickas först med Skicka är oförändrat; sektionen Filer är orörd. Mikrofonens knapp och gemmen delar nu stil (`Faltknapp`).
- **Regler:** oförändrade. `rules/__tests__/gaster-grupp.test.mjs` bevisar att en klient inte kan skriva en gästs svar eller en gästs chattmeddelande, och att servern aldrig är löslare än medlemsregeln för ett svar (`svarfall.mjs`, 14 fall).

### Skiva 3: ärenden till en gäst

CP 2026-10-20 ("Lägg den i samma PR"): ett ärende kan få en gäst som ansvarig, på samma sätt som en aktiv medlem. Gästen ser bara sina egna ärenden, kan kommentera dem och markera dem klara; när inbjudan dras tillbaka försvinner ärendena ur hens vy, men delegeringen står kvar för medlemmarna. Inte brytande: allt är nytt eller valfritt (`grupp.arenden`).

- **Formen:** ärendets `mottagare` får slaget `gast`: `{ slag: "gast", gastId, namn }`. Ett hem (regel 2): `byggArendemottagare` / `byggGastMottagare` (utdelningen, prövar mot `levandeGaster`), `gastDelegerad` (serverns urval), `tolkaGastMottagare` (medlemmarnas rad). `byggMottagare` är fortfarande meddelandets och nekar `gast`: en gäst kan inte få ett privat meddelande.
- **Gästens API:** `arenden` (frågan är på gästen, `where groupId + mottagare.gastId`, och varje svarad rad prövas på nytt med `gastDelegerad` och gruppen; `GASTARENDEFALT`: rubrik, text, status, förfallodag, kommentarer; aldrig GitHub-adress), `kommenteraArende` (chattens längdtak och SAMMA takt) och `markeraArendeKlart`. Samma `nej` för allt gästen inte äger (någon annans, en person, gruppen, ingen, en annan grupp, okänt id, ett id som försöker bli en sökväg). Funktionen `arenden` finns i `GASTGRUPPFUNKTIONER` men bara när appen gett `grupp.arenden`.
- **Medlemmens sida:** `levandeGaster({ uid, groupId })` (`{ gastId, namn }`, ingen adress) och **`OpsGastMottagare`** (Gäst, eller **Gäst (inbjudan återkallad)**, härlett och aldrig lagrat). `OpsMottagare` får `gaster` (gäster med märket Gäst sist i ärendeläget; appen skickar den bara till den som får dela ut).
- **Gästens vy:** **`OpsGastArenden`** byggd av primitiver (kort per ärende, statuspiller, kommentarer, chattens skrivfält, Markera klar som frågar först). Fliken Ärenden finns bara med minst ett delegerat ärende; ett fel ger fliken med felet.
- **Radering:** `grupp.arenden.radera` krävs; `radera` svarar `arenden`. Högst `GASTARENDE_MAX` (100) ärenden visas (öppna först) och `avkortad` säger när fler fanns.
- **Datakontraktet:** `where` med ett punktat fältnamn (`{ "mottagare.gastId": id }`) går in i en karta, som Firestores fältsökvägar. Minneskällan och JSON-källan följer med; Postgres kastar. Ingen befintlig fråga ändras (ett namn utan punkt är som förut).
- **Regler:** oförändrade, och appens `mottagareGiltig` ska INTE ändras: en klient ska aldrig kunna skriva en delegering till en gäst.

### Proven, båda riktningarna

Siffrorna och mutationerna står i PR-texten. Kärnan: läckageprov med seedade medlemmar, återkallelse nekas i varje åtgärd, omröstningsgäst når inte gruppen, taket delas, signerad nedladdning (rätt fil, tak per dygn, ingen adress efter återkallelse), skrivandet (giltig session, nekad utan session, nekad efter återkallelse, takt, längdtak, bara text), och radering lämnar ingen adress, inget namn och inget meddelande. Skiva 3: gästen ser bara sina ärenden (inget av gruppens övriga, ingen GitHub-adress, inget uid), ett nej på allt gästen inte äger, återkallelse nekas i alla tre åtgärder med delegeringen orörd, takten delas med chatten, och radering tar bort kommentarer och gästens id ur ärendena.

### Vad appen måste göra

Se README, avsnittet "Gäster", och beslut 0012 ("Ompinningen i appen"). I korthet: `grupp` och `radering` i `createGastService` (och `grupp.arenden` för skiva 3, se beslut 0012, "Kvar för appen"); `/api/gast` skickar `GASTGRUPPATGARDER` (med `skrivChatt`) och `raderaMig` vidare, 429 på `for-manga`, 400 på `ogiltig-text`; `gastBjud` med `slag: "grupp"`, `gastLista` med `groupId`, nya `gastAterkallaAlla` och `gastRadera`; en brevvariant för omfånget `grupp`; `ersattAvMedlem` i växlingen; `OpsMedlemmar` med `gaster` och `/gast` med `renderGrupp` och `onRaderaMig`. Inga regler, index eller `firebase.json` ändras; deploy är bara functions.

## 0.131.0

Gäster, skiva 1 ("en sak", omröstningen först), cllp/lifehub.app#389, och ett litet tillägg i formuläret "Lägg till kategori". CP 2026-10-20: "Kör på alla 3, men sätt max 5 gäster." Inte brytande: allt är nytt eller en ny valfri prop, och appen behöver inte ändra något för att ompinna. Design och skäl: `docs/beslut/0011-gaster-en-inbjudan-och-aldrig-ett-konto.md`.

### Händelsen

Externa ska kunna rösta på ett datum utan konto (lifehub.app#383 skiva 2), och senare vara med i en hel grupp (#389). Designförslaget mätte att Identity är fel ställe: ett konto där ger gästen en katalogpost och en egen grupp att skapa, brevet blir två och målet tappas (Identity läser inte `returnTo`). CP:s beslut: **en gäst är en inbjudan, inte ett konto och inte ett medlemskap**, med en egen gästväg i appen. Skälet till "inte ett medlemskap" är mätt i förslaget: ett aktivt medlemskap provas på 55 ställen i appens regler och 25 i ramverkets fragment, så en gäst som en aktiv rad hade släppts in överallt där `aktiv` är hela provet.

### Vad som är nytt

- **`createGastService`** (`ops-framework/node`, `src/node/gast.js`): `bjud`, `aterkalla`, `skickaOm`, `lista`, `platser`, `los`, `session`, `hamta`, `sattNamn`, `nyLank`, `stadaSessioner`. Gästen når bara servern och aldrig Firestore, så ingen av appens regler eller callables släpper in en gäst.
- **Taket är 5 gratis gäster per grupp och är fem dokument** (`<grupp>|1` till `<grupp>|5`, `GAST_PLATSER_GRATIS`). Att ta en plats är `createNew`: sju samtidiga inbjudningar till sju adresser ger exakt fem platser. Samma adress till flera saker tar en plats.
- **Unikhet är id:t**: SHA-256 av (grupp, adress, omfång). `gastId` (`g_` och 40 hextecken) är härledd ur adressen och bär gästens röst.
- **Länken bär nyckeln i fragmentet** (`/gast#i=<id>&k=<nyckel>`, `gastLank`, `tolkaGastLank`): den hamnar inte i Hostings logg, inte i `Referer`, och ett mejlprograms förhandshämtning förbrukar ingenting. Nyckeln och sessionen lagras bara som hash, och nyckeln lämnar tjänsten bara genom appens `skicka`.
- **Fel adress räknas per inbjudan och per IP** (reserverade före prövningen, återlämnade vid lyckat försök). Alla nej är byte för byte lika; `aterkallad` och `utgangen` ges först när nyckeln och adressen stämde. `ip` är krävd.
- **`gastregelfragment("gastinbjudningar")`**: en aktiv medlem (en person) i gruppen läser, frågan måste begränsa `groupId`, ingen skriver. Sessioner, platser och räknare har ingen match: appens catch-all nekar dem.
- **`OpsGastLista`** (medlemmens lista med "X av 5 gratis platser", Bjud in utan konto, Skicka igen, Dra tillbaka, Bjud in igen) och **`OpsGastSida`** (gästens egen sida: adressfråga första gången, session på enheten, sakens kort via `renderSak`, ny länk, återkallelse synlig inom en minut). `PublikSprakval` är språkväljaren som `OpsDeladHandelse` hade privat, nu delad.
- **Litet tillägg, samma version:** `OpsKatalogInstallning` får den valfria `upptagnaId` (id:n appen reserverat). Ett namn som "Kvitto" ger `kvitto-2` i stället för ett id som appen pekar på. Utan propen är beteendet detsamma som förut.

### Proven, båda riktningarna

- **Vitest:** `gast.test.js` (15), `gast-tjanst.test.js` (54), `gast-vy.test.jsx` (34) och två nya prov i `katalogInstallning.test.jsx`.
- **Regelprov i emulatorn:** `rules/__tests__/gaster.test.mjs` (11).
- **Skalytan:** avsnitt 55 i `check-skalyta` mäter listan och gästens sida i en riktig webbläsare vid 390 och 1280 px (64 kontroller).
- **Rött utan:** 49 mutationer av tjänsten, lib och vyerna (alla röda, en överlevde först och fick ett eget prov), 4 av regelfragmentet och 2 av skalytan. Utfallen står i PR-texten.

### Vad appen måste göra

Se README, avsnittet "Gäster", och PR-texten. I korthet: regelfragmentet och indexen deployas FÖRE klienten, `POST /api/gast` bakom `createGastService`, ett brev via `skicka` och `gastLank`, sakens kort och röstprövningen som gäst, routen `/gast` ritad före grinden (med `noindex`), och `sammanstall` som räknar aktiva gästers röster.

## 0.130.0

"Lägg till kategori" kräver ett namn och inget mer. Ur CP:s ord 2026-10-20, med en skärmbild från lifehub.app (Inställningar, Inkorgstyper): "Jag skulle lägga till en ny ärendetyp. Det var det värsta jag gjort på länge och det funkade inte. Ett formulär värre än att gå till passpolisen. Det måste vi fixa, så kan vi inte ha det." Att det inte funkade rättas i appen (en ny sort får ett standardbeteende där); det här är formuläret och regeln bakom det. Inte brytande: ingen ny prop, och appen behöver inte ändra något. Skärmbilder före och efter, 390 och 1280 px, ligger i PR:en.

### Mätt före (check-skalyta avsnitt 54, mot origin/main, riktig webbläsare)

Inkorgens kategoriformulär, åtta texter: **20 textfält synliga, 10 obligatoriska** (nyckel, svenska namnet och åtta hjälptexter på svenska), lika vid 390 och 1280 px. Med bara ett namn ifyllt vägrade Spara med "id krävs. Det är nyckeln varje rad i databasen pekar på." En statuskatalog (färg och fas, inga texter): 4 textfält synliga, 2 obligatoriska. Efter ändringen: **2 textfält synliga (namnet och ikonsökningen), 1 obligatoriskt**, och ett namn räcker.

- **Id härleds ur namnet** (`harledKategoriId`, internt i `src/lib/katalog.js`, inte en ny publik export). Gemener, å och ä till a, ö till o (övriga accentbokstäver till sin grundbokstav), allt annat till ett bindestreck, `-2`, `-3` om id:t krockar, och arkiverade kategorier räknas eftersom de fortfarande är nyckeln raderna pekar på. Ett namn utan ett enda användbart tecken blir `kategori`. Utdata uppfyller alltid `ID_FORM`, mätt mot femton skräpiga underlag. Fältet Nyckel är borta.
- **⛔ Ett befintligt id ändras aldrig.** Id:t härleds bara när en NY kategori sparas. En omdöpning rör namnet och lämnar id:t, och provet är rött om vyn härledde det på nytt.
- **Det engelska namnet och alla texter är valfria och ligger bakom raden "Fler texter (valfritt)"**, stängd som förval (`OpsDisclosure`). ⛔ Har kategorin något ifyllt står antalet på raden också när den är stängd ("2 ifyllda"), så inget göms utan att synas. ⛔ En text med bara engelska vägras med textens namn och raden öppnas: texterna är valfria nu, och samma indata hade annars utelämnats tyst.
- **⛔ REGELÄNDRING, och den står här eftersom den kunde ha missats: kravet på de deklarerade texterna (`textnycklar`) gäller appens STANDARDVÄRDEN och inte längre raderna.** Mätt: `byggKategori` och `validateKatalog` krävde `textnycklar` överallt, i vyn, i `createCatalogSource.spara` och i `las`. Att bara göra formuläret valfritt hade därför inte räckt: källan hade vägrat raden vid spara, och en rad utan texter hade fallit i `las` och tagit hela katalogen till reserven. Nu kräver källan dem av `standard` (uppstart och seedning: en mall utan text är ett programfel hos utvecklaren) men inte av det en människa lägger till. `byggKategori` och `validateKatalog` är oförändrade och kräver fortfarande det de får `textnycklar` för; det är anropsstället som släppte kravet. En kategori utan hjälptexter ger `texten()` = tom sträng, så appens vy väljer vad som visas.
- **`onSpara` får ge ett löfte.** Spara väntar (`OpsButton` ser löftet, 0.129.0), formuläret stängs när det är klart, och ett avslag står i banderollen med formuläret kvar. Förut stängdes formuläret direkt och ett avslag blev ett obehandlat fel efteråt: en post som såg sparad ut och inte var det. Svarar löftet efter ett gruppbyte rörs inte den nya gruppens formulär.
- **Andra kataloger (händelsetyper, prioriteter, aktivitetstyper) får samma förenkling**, mätt i en statuskatalog med färg och fas, och i en sortkatalog utan båda.
- **Proven:** 34 prov röda mot origin/main och gröna med ändringen (vyn, `harledKategoriId`, katalogkällan), plus `check-skalyta` avsnitt 54 (röd mot origin/main med 18 brott, grön med ändringen). Ett prov som fanns men låste det gamla beteendet ("en ny kategori går inte att spara utan de texter katalogen kräver") är omskrivet till det motsatta. Skyddet som INTE släpptes har ett eget prov: en mall utan text vägras fortfarande vid uppstart.

### Vad appen måste göra

Ingenting i koden. Ompinna och bygg. ⛔ Har appen ett eget prov som fyller i fältet "Nyckel" i inställningsvyn finns inte fältet längre; ta bort raden. Appens egna vyer som ritar en kategoris texter ska tåla en tom text (`texten()` ger tom sträng), eftersom en kategori som läggs till i vyn nu kan sakna dem.

## 0.129.0

Tre delar i ett pass, ur CP:s beslut 2026-10-15 (kalendern väljs på ärendet), 2026-10-13 (knappar som väntar) och 2026-10-19 (skapa grupp): GitHub-etiketten ur kalendrarna (cllp/lifehub.app#303 och #307), knappar som väntar visar det (cllp/lifehub.app#217), och väntan när en grupp skapas (cllp/lifehub.app#365). ⛔ **Brytande** för del A: fyra funktioner och en konstant lämnar den publika ytan, och appen måste ta bort sina anrop av dem i samma ompinning (se "Vad appen måste göra"). Del B och C ändrar hur befintliga knappar beter sig men tar inget bort.

### A. GitHub-etiketten ut ur kalendrarna (cllp/lifehub.app#303 och #307), Claude 2026-10-20

CP 2026-10-15 20:38: etikett-till-kalender-idén i #259 var ett missförstånd, "Vi kan inte binda oss till GitHub så." Kalendern väljs i stället på ärendet. Fältet `githubEtikett` kom i 0.108.0 (cllp/ops-framework#395) och används av ingen efter lifehub.app#311, så det tas bort med allt som läste det (arbetsreglernas punkt 1 och 2: en oanvänd rad i reglerna är yta utan nytta).

- **Mätt var fältet fanns i ramverket:** modellen (`KALENDERFALT`, `byggGruppkalender`, `MAX_GITHUBETIKETT`), jämförelsen (`githubEtikettNyckel`), uppslaget (`kalenderForEtikett`), unikhetskontrollen (`kontrolleraGithubEtiketter` och dess ordbok), `createKalenderkalla().sparaGruppens` som läste gruppen före skrivning, regelfragmentet (`hasOnly` och längdvillkoret), rutan "GitHub-etikett" i `OpsKalendrar` med ordboken `ORD_OPSKALENDRAR` och hjälptexten om `due:ÅÅÅÅ-MM-DD`, och README. Ramverket ritar inga ärenden i kalendern: `due:` stod bara i hjälptexten.
- **Allt det är borta.** `sparaGruppens` läser inte längre gruppen före skrivning (den gjorde det när en rad bar en etikett). Exporterna `githubEtikettNyckel`, `kalenderForEtikett`, `kontrolleraGithubEtiketter`, `MAX_GITHUBETIKETT` och `ORD_OPSKALENDRAR` finns inte längre. `efterOrdning` finns kvar (sorteringen behövs ändå). `sparaGruppens(groupId, rader, val)` tar fortfarande ett tredje argument och ignorerar det, så att appens `(rader, sprak) => kalla.sparaGruppens(id, rader, { sprak })` fortfarande går igenom typkontrollen.
- **Mätt i appen** (`cllp/lifehub.app` origin/main e3f8530, hämtad 2026-10-20): ingenting skriver fältet utom ramverkets egen ruta (som nu är borta). Läsarna är `web/src/data/arendekalender.js` (importerar `kalenderForEtikett`, används av `ArendenFlik.jsx` och `handelseYta.jsx`), appens genererade kopia av reglerna (`firestore.rules`) och prov. `CalendarView` ritar inga ärenden sedan lifehub.app#311.
- **⛔ GAMLA RADER I PRODUKTION KAN BÄRA FÄLTET, OCH DET ÄR OMÄTT.** En kalender som sparades med en etikett under 0.108.0 till 0.128.0 har fältet kvar, och ramverket kan inte läsa appens databas. Därför är borttagningen inte ett rent strykande: `AVVECKLADE_KALENDERFALT` (ett hem, i `lib/kalendrar.js`) listar fältet, och två läsare förblir ense om den.
  - **Läsvägen släpper fältet** (`validateGruppkalendrar` via `utanAvvecklade`). Utan det kastar `byggKategori` "fälten githubEtikett känns inte igen" för en grupp med en sådan kalender, och gruppens hela kalenderlista är borta vid varje uppstart.
  - **Skrivvägen vägrar fältet** (`byggGruppkalender` kastar en mening om varför, tar inte bort det tyst). `sparaGruppens` ersätter dokumentet (`set`), så en gammal kalender blir av med fältet första gången den sparas genom ramverket. `OpsKalendrar` släpper fältet ur en rad den fått ovaliderad innan den bygger, så att Spara, Flytta och Arkivera går för en gammal rad.
  - **Regeln varken tillåter eller kräver fältet, men nekar inte en gammal rad bara för att fältet finns kvar.** Det står i `hasOnly`, men bara som en rad som REDAN bär det får skrivas om med det OFÖRÄNDRAT (`resource != null && 'githubEtikett' in resource.data && request.resource.data.githubEtikett == resource.data.githubEtikett`). Det går inte att skapa en kalender med fältet, inte att lägga till det på en rad som saknar det, och inte att ändra värdet. En skrivning utan fältet (`set`, `deleteField()`) tar bort det. Det är mätt i emulatorn (se tabellen): en uppdatering av ett annat fält på en gammal rad, och en äldre klient som skickar tillbaka raden med samma etikett, släpps in.
- **Ordningen mellan regeldeploy och klient spelar ingen roll den här gången** (mätt): en ny klient skriver aldrig fältet och de gamla reglerna släpper in en rad utan det, och en äldre klient som skriver en NY etikett mot de nya reglerna nekas, vilket är avsikten.
- **`AVVECKLADE_KALENDERFALT` är temporär, och det står som ett uppdrag och inte som en gissning (arbetsreglernas punkt 1 och 3).** Den tas bort när noll kalendrar bär fältet i produktion. Det är en mätning appen gör (en fråga som ordnar `gruppkalendrar` på `githubEtikett`, vilket bara ger rader som har fältet) och en rensning den kan göra med Admin SDK. Ramverket mätte det inte, rör ingen data, och det finns inget ärende ännu: det ska skrivas av den som kör mätningen, med utfallet.
- Ärendet cllp/ops-framework#397 (två funktioner bröt lika `ordning` olika) gällde `kalenderForEtikett` och försvinner med den.

### B. Knappar som väntar visar det (cllp/lifehub.app#217), Claude 2026-10-20

CP 2026-10-13: "Vi behöver ha en progress bar på saker och ting som dröjer, till exempel avfärda, spara, överallt, så att man vet vad som händer i appen." Grok 2026-10-15: kvar, ingen genomgång gjord.

- **Mätt först: `OpsButton` gjorde det inte.** `busy` fanns, men bara de knappar som själva skrev `busy={...}` visade väntan. Av 108 `OpsButton` i ramverket hade 31 en `busy`, 8 är `type="submit"`, 4 är länkar och 3 har ingen `onClick`. Bland resten fanns knappar vars `onClick` ger ett löfte och som saknade `busy`: Ta bort och Återkalla i medlemslistan, Ta bort i Minne, Skapa grupp (första gruppen), Arkivera i katalogen, Dölj i modultyperna, Installera i hubben, Radera i biblioteket och mer. Den som tryckte såg ingenting hända och tryckte igen.
- **Gjort en gång, i `OpsButton`.** Ger `onClick` ett löfte och `busy` inte är satt är knappen upptagen tills löftet är klart: snurra, `aria-busy`, spärr, etiketten kvar. Ett andra tryck medan det väntar startar inte handlingen igen. Spärren sitter också i en `ref`, så två tryck i samma tick (en dubbelklick) räknas som ett.
- **`busy` satt, också till `false`, är appens.** Då rör knappen inget. Det är medvetet: en spärr som knappen la ovanpå en app som styr `busy` själv hade kunnat stå kvar utan att något syntes. Följd: en flagga som är `false` mest hela tiden ska skrivas `busy={flagga || undefined}`, inte `busy={flagga}` (se OpsAgenter nedan).
- **Ett avslaget löfte sväljs inte.** Knappen blir ledig, och avslagningen når `unhandledrejection` precis som förut (knappen var aldrig den som skulle fånga felet, och den vet inte vad det betyder för just den ytan). Ett returvärde som inte är ett löfte lämnas orört.
- **Lokala rättelser där en funktion svalde löftet** (så att `OpsButton` inte kunde se det): `OpsBibliotek` Radera ger tillbaka löftet från `korRadera`, `LaggILista` från `laggI`, `OpsAgenter.kor` ger tillbaka sin kedja (Ta bort skill och minne) och de sex Spara-knapparna där skriver `busy={sparar || undefined}`, så att appens `sparar`-flagga (förval `false`) inte stänger av det automatiska, `OpsGruppHubb` ger tillbaka svaret från `onInstallera` och `onClick`. `OpsMinne` Spara är en `type="submit"` och fick en egen `sparar`.
- **Inventeringen som prov.** `knappar-vantar.test.jsx` trycker på varje knapp ovan med ett löfte som inte är klart och mäter tre saker: upptagen medan det väntar, ett andra tryck startar inget, ledig efteråt. Tabellen är alltså en lista som går att köra och som blir röd. ⛔ **Täcks av `OpsButton` men saknar eget prov:** Profilens tre bildknappar (ta bort bild, återställ, initialer; `onClick` är en `async function`), och de fem andra Spara-knapparna i `OpsAgenter` (verktyg, instruktioner, skill, minne, modell; bara identitetens är provad). De följer av samma kod som de provade, men har inte setts bli röda en och en.
- **Medvetet utan väntan (inte ändrat), och varför:** `OpsModulRam` Anslut, Koppla från och Spara inställningar (`bakgrund`: "utkastet ritas i samma varv som trycket, sparningen går i bakgrunden och ett avslag ställer tillbaka"), pilarna i `OpsApparArk` och dra, ta bort och lägg till i `ListaVisning` (samma optimistiska mönster, 0.128.0), chattens skickaknappar i `OpsMeddelanden` (egna sändningslägen). Redigeraren i `OpsKatalogInstallning` (Spara) och Byt namn i `OpsModulTyper` stänger sig direkt och läser inget returvärde; att vänta på dem kräver att man avgör vad som händer med redigeraren när sparandet faller, och det är en omgjord yta och inget en knapp kan lösa. De 284 råa `<button>` genomsöktes efter en `onClick` som nämner namnen på appens löftesfunktioner (`onSpara`, `onRadera`, `onTaBort`, `onSkapa` med flera): 15 träffar, och ingen av dem startar ett anrop man väntar på (de öppnar paneler, växlar lokalt tillstånd, tar bort en bilaga som ännu inte skickats eller är de optimistiska pilarna ovan). De rörs inte. Ikonknapparna i `OpsKalendrar` är låsta under väntan (`upptagen`) men har ingen egen snurra.

### C. Väntan när en grupp skapas (cllp/lifehub.app#365), Claude 2026-10-20

CP 2026-10-19: "Det tar tid att skapa grupp och ingen progress. Behöver snabba upp att skapa grupp, eller ha en bra progress om att grupp skapas. Alla områden som handlar om att användaren skall vänta måste ha en progress."

- **Mätt vad som tar tid, och vad som inte går att mäta härifrån.** `createGroupService.skapaGrupp` körd mot en räknande minneskälla (`mat.mjs`, anrop i följd): utan inbjudningar 2 anrop (läs användaren, en batch med gruppen, ägaren och allt som följer med: agent, kataloger och standardkalender går i SAMMA batch). Varje inbjuden adress lägger till 3 anrop i följd (läs inbjudarens medlemskap, lista inbjudningar, skriv inbjudan): 5 anrop med en adress, 11 med tre och 17 med fem, identiskt med `agent` och `standardkalender` på. Med vitlista tillkommer 1 till 2 läsningar. **Det som mättes är antal anrop, inte tid:** minneskällan svarar på under 2 ms. Tiden i produktion (kallstart av funktionen, nätet till Firestore, appens navigering och första läsning av den nya gruppen) går inte att mäta här. Att kallstarten är den största fasta delen är en hypotes.
- **`onSkapa` är ETT anrop, så ramverket kan inte visa riktiga steg.** Det ser att anropet gick iväg och att det svarade, inte vad servern gör emellan. Exempelsteget "Lägger till apparna" är dessutom inget eget steg: apparna är `moduler` på gruppens dokument i samma batch. Ingen falsk procentstapel och inga påhittade steg (arbetsreglernas punkt 3). Riktiga steg kräver att servern rapporterar dem (till exempel en callable som strömmar), och det är appens val.
- **Det som gjordes är det som går att stå för:** panelens `Spara` blir upptagen medan gruppen skapas (snurra, `aria-busy`, spärr), och en `role="status"`-rad bredvid knapparna, i den fasta knapprad som syns också när formuläret är långt, säger vad som pågår: "Skapar gruppen", eller "Skapar gruppen och skickar en inbjudan" och "... skickar 3 inbjudningar" (det som väntan faktiskt växer med), och "Sparar" i redigeringsläge. Antalet räknas ur samma lista som skickas, med en adress som står kvar i fältet (`samlaInbjudningar`). Före 0.129.0 låstes fälten och en rad "Sparar" skrevs längst ned i formuläret, men knappen stod orörd (läst i koden, inte mätt i en webbläsare).
- **Formuläret rapporterar, panelen ritar** (`useSkapaPanelStatus`, internt, ingen ny export). Utanför en `OpsSkapaPanel` skriver formuläret samma text i sin egen rad, så ett formulär som ritas för sig är inte tystare än förut. Texterna byts med `etiketter.skapar`, `skaparEnInbjudan`, `skaparFlera` (`{n}`) och `sparar`, på svenska och engelska.
- **Första gruppen** (`OpsUtanMedlemskap`) täcks av `OpsButton`: knappen väntar nu på `onSkapaGrupp`.
- **Inte gjort:** att snabba upp. De tre anropen per inbjuden adress går i följd, och att köra adresserna parallellt skulle ta 3n anrop till 3. Det är en ändring av hur inbjudningar skrivs (best effort, ett fel per adress, i ordning) och ingen CP bett om; rekommendationen är att göra det som ett eget ärende med ett prov mot ordningen i svaret. `Avbryt` och Tillbaka är orörda under väntan: lämnar man panelen medan gruppen skapas finns gruppen ändå, och ingen navigering sker.

### Prov: rött utan, grönt med (regel 4)

Grönt med allt: `npm run check:all` grön (vitest 4272 prov i 224 filer, `check-skalyta` 3107 kontroller utan brott (3091 före, 16 i avsnitt 53), `check-kontrollyta` 40 mätningar, `check-paket` och resten), och `npm run test:rules` 658 av 658 (`kalendrar.test.mjs` 35 prov). Varje rad nedan är körd en gång med rättelsen ändrad eller borttagen och de nya proven kvar.

| Ändring | Röda prov |
|---|---|
| A, modell: 0.128.0:s `kalendrar.js`, `regler.js`, `kalenderkalla.js`, `OpsKalendrar.jsx` och `index.js` | 12 av 96 (`kalendrar.test.jsx` och `kalenderhantering.test.jsx`) |
| A, modell: borttagningen utan läsvägens tolerans (`utanAvvecklade` ur `validateGruppkalendrar` och `OpsKalendrar`) | 6 av 96: en gammal rad går inte att läsa, inte att spara, inte att flytta |
| A, regel: 0.128.0:s regelfragment | 4 av 35 (`kalendrar.test.mjs` i emulatorn): ny rad med etikett, etikett på en rad som saknar den, etikettbyte på en gammal rad, och läsning och sparning genom källan |
| A, regel: fältet struket ur `hasOnly` utan undantaget för en gammal rad | 2 av 35: en uppdatering av ett annat fält på en gammal rad, och en äldre klient som skickar tillbaka raden med samma etikett |
| B: `OpsButton` som i 0.128.0 | 17 av 29 (`knappar-vantar.test.jsx`): fyra prov av `OpsButton` och tretton knappar i tabellen |
| B: de lokala rättelserna borttagna (löften som svaldes, `busy={sparar}`, Minnes Spara) men `OpsButton` kvar | 14 av 29: sex knappar och åtta prov av skapa-panelen |
| B: spärren bara i tillståndet och inte i en `ref` | 1 av 29 (två tryck i samma tick) |
| B: avslagningen sväljs (`.then(klart, klart)` i stället för `.finally`) | 1 av 29 (avslagningen når inte `unhandledrejection`) |
| B: en satt `busy` styr inte (knappen lägger sig ovanpå) | 1 av 29 |
| C: texten räknar bara adresserna i listan och inte den som står kvar i fältet | 1 av 29 |
| C: 0.128.0:s `OpsGruppFormular` och `OpsSkapaPanel`, mätt i webbläsaren (`check-skalyta --bara-grupp-vantar --dist` mot ett bygge av dem) | 2 brott av 2 kontroller: Spara blir aldrig upptagen |

Mätningen hittade tre saker i mina egna prov: `byggGruppkalender` kastade för `githubEtikett: undefined` (nyckeln fanns, värdet inte), vilket det första provet för läsvägen visade; importen av hela `index.js` i ett prov tog över fem sekunder under last och fick samma rymliga tak som `flytta-service.test.js` (regel 14); och provet för "avslagningen sväljs inte" är det enda som kräver att `unhandledRejection` fångas av provet självt, eftersom vitest annars räknar den som ett fel i sviten.

`check-skalyta` har ett nytt avsnitt 53 (Spara och statusraden medan en grupp skapas, 390 och 1280 px: upptagen, spärrad, snurra, text inom knappraden och fönstret, Spara kvar längst till höger, ingen överflödning, formulärets egen rad tyst, och ledig igen när anropet släpps) och flaggan `--bara-grupp-vantar`.

### Vad appen måste göra efter ompinningen

1. **Ta bort allt som importerar de borttagna exporterna, i samma PR som ompinningen** (annars bygger appen inte): `kalenderForEtikett` används av `web/src/data/arendekalender.js` och därigenom av `ArendenFlik.jsx` (`arendetsKalender`, `kalendrarnasNamn`) och `handelseYta.jsx` (`arendeposter`, `kalenderposterForArenden`); prov med `githubEtikett` finns i `web/src/data/__tests__/arendekalender.test.js`, `web/src/app/__tests__/arenden-flik.test.jsx` och `web/src/app/__tests__/calendar-view.test.jsx`; texten i `docs/inkorg-och-github.md` om vilken kalender en etikett hör till; kommentarer i `web/src/data/events.js`. Ärendets kalender väljs på ärendet och är appens egen ändring, inte den här.
2. **Regenerera och deploya Firestore-reglerna.** Gruppkalendrarnas block ändras (fältet står kvar i `hasOnly` men bara som oförändrat på en rad som redan har det). Ordningen mot klienten spelar ingen roll, mätt. Reglerna ska deployas för att den nya regeln ska gälla, inte för att något ska fungera.
3. **Mät hur många kalendrar i produktion som bär `githubEtikett`** och skriv resultatet i ett ärende: en fråga som ordnar `gruppkalendrar` på `githubEtikett` ger bara rader som har fältet. Noll: ta bort `AVVECKLADE_KALENDERFALT` i nästa ramverksversion. Fler än noll: en rensning med Admin SDK (`FieldValue.delete()` på fältet) som kräver CP:s uttryckliga ja, eftersom den skriver produktionsdata. Ramverket rör inget.
4. **Knapparna:** ingen ändring behövs. En app vars `onClick` ger ett löfte får snurra och spärr utan att skriva något, och en app som redan skriver `busy={flagga}` styr som förut. Skriver appen `busy={flagga}` för en flagga som mest är `false` och vill ha det automatiska: `busy={flagga || undefined}`. En app som förlitade sig på att kunna trycka två gånger på en knapp medan dess första handling väntar får ändra det; vi känner ingen.
5. **Skapa grupp:** `onSkapa` ändras inte. Vill appen ha riktiga steg måste dess callable rapportera dem, och formuläret har ingen kanal för det än.

### Gjordes inte

- Ingen kalenderväljare på ärendet (CP:s beslut 2026-10-15 20:38, appens och i en senare skiva), ingen länk mellan ärende och händelse och ingen `forfaller` på Inkorgens poster: det är appens datamodell (cllp/lifehub.app#307).
- Inget som rensar fältet ur produktionsdata, och ingen mätning av det (se A och "Vad appen måste göra", punkt 3).
- Ingen snurra på de råa `<button>`-ikonerna och ingen ändring av de optimistiska ytorna (se B).
- Ingen parallell inbjudningsloop (se C).

## 0.128.0

Fem delar i ett pass, alla ur CP:s beslut 2026-10-19 och 2026-10-20: smart länk och listor i Biblioteket (cllp/lifehub.app#378), att admin får slå av och på gruppens appar (cllp/lifehub.app#252), att mejla en delad länk (cllp/lifehub.app#356), och en notering om videospelaren. CP 2026-10-20: "Inget avancerat men smart länk. Kör!" Där det fanns ett val är den minsta formen vald, och valet står under "Gjordes inte".

### A. Smart länk i Biblioteket (cllp/lifehub.app#378), Claude 2026-10-20

- **`OpsBibliotek` tar `onLankInfo(url) => Promise<{ titel?, artist?, kalla?, bild? }>`.** Klistras en länk från Spotify, YouTube, Apple Music eller SoundCloud in i Ny länk fylls rubriken i som "Titel, Artist" (`lankRubrik`) och går att ändra. En rubrik som personen redan skrivit skrivs aldrig över, och ett svar som kommer efter att adressen bytts kastas. Faller anropet står rubrikfältet tomt och felet sägs i en rad under adressen (`role="alert"`), aldrig tyst (regel 5). Utan `onLankInfo` fylls inget i.
- **`kalla` härleds, den väljs aldrig (regel 2).** `lankKalla(url)` ger `spotify`, `youtube`, `applemusic`, `soundcloud` eller `annat` ur adressens värd, och värdlistan `LANKKALLOR` har ETT hem som modellen, Firestore-regeln (`lankkallaForm`, som blir regelns `matches()`) och nodsidans vitlista alla läser. En `kalla` som inte är den adressen ger avvisas av `inmatningsfel`, `postFel` och regeln. `kalla` i svaret från `onLankInfo` ignoreras av samma skäl. Länkar från före 0.128.0 har ingen `kalla` och härleds vid läsning, ingen migrering.
- **Posten sparar `kalla` och `bild`** (omslaget, https, högst `MAX_BIBLIOTEKURL`). Byts adressen släpps omslaget, och `bild: null` tar bort det.
- **Listan och detaljen visar källans märke och omslaget** (`LankMark`: omslaget som cirkel med märket i hörnet, och bara märket om bilden inte laddas). Märkena är fyra SVG-sökvägar ur simple-icons (CC0, licensraden står i `src/lib/kallmarken.js`), inget nytt beroende, och ritas av `KallIkon` i `icons.jsx`. Ett tryck på en musiklänk öppnar adressen direkt (`target="_blank"`, `aria-label` "Öppna X i Spotify"); detaljen når man via menyn "Visa detaljer".
- **Nodsidan: `lankInfoUrOembed(hamta, url, { tidsgransMs, maxByte })` i `ops-framework/node`.** Spotify: oEmbed plus `og:description` för artisten. YouTube: oEmbed med `author_name` (ändelsen " - Topic" bort). SoundCloud: oEmbed, med Open Graph som reserv. Apple Music: Open Graph. Bara https och bara värdarna i `LANKKALLOR`, prövat INNAN något anropas (inget SSRF); anropet får `redirect: "error"` och en `signal`; hela uppslaget har en tidsgräns (5 s, vinner också över en `hamta` som aldrig läser `signal`); varje svar läses högst 256 KiB. Varken titel eller artist hittas: det kastas med tjänstens namn. Ramverket hämtar inget på egen hand, `hamta` är appens `fetch`.
- **Rättelse under arbetet:** ett andra värdprov direkt före varje hämtning togs bort. Det kunde aldrig slå till (ändpunkterna är fasta och sidan är adressen som just prövats) och var alltså en vakt som aldrig setts falla (regel 4, se tabellen nedan). Ändpunkterna vaktas i stället av provet som kör alla fyra källor och kräver en tillåten värd för varje anrop.

### B. Listor i Biblioteket (cllp/lifehub.app#378), Claude 2026-10-20

- **Ny bibliotekstyp `lista`** (`BIBLIOTEKTYPER`, `BIBLIOTEKFLIKAR`: en flik Listor, som visas när det finns en lista) med `poster: [id, ...]` i ordning. En lista är en post i Biblioteket som pekar på andra poster: ingen ny app, ingen ny låttyp. Högst `MAX_LISTPOSTER` (200), varje id på `POSTIDFORM`, inga dubbletter (`listaFel`). En lista rymmer anteckningar, länkar och filer, men inte en annan lista.
- **Långtrycksmenyn får "Lägg i lista"** (välj en lista eller "Ny lista"; `LaggILista`). Bara listor man får ändra och som inte är fulla erbjuds (`listorAttLaggaI`, `laggTillPost`).
- **Listans detalj visar posterna i ordning** (`ListaVisning`). Ordningen ändras genom att dra i greppet (pekardrag) och med tangentbordet (upp- och nedpil på greppet), poster tas bort, och man lägger till inifrån listan (`kandidaterForLista`, `taBortPost`). Allt ritas direkt, skrivningarna går i tur och ordning, och faller en skrivning rullas listan tillbaka och felet står kvar.
- **Bara från samma plats gäller genom hur listan läses, inte genom regeln.** `losLista(lista, platsensPoster)` slår upp varje id bland platsens egna poster, och regeln kan inte pröva det (högst tio uppslag per skrivning, en lista har upp till 200 id). Regeln låser formen. **En borttagen post syns**: `losLista` ger alltid lika många rader som listan har id, och vyn skriver "Finns inte längre". Den filtreras aldrig bort tyst (regel 5).
- **Firestore-regeln (`bibliotekregelfragment`) fick typen och fältet.** Ett uttryck prövar alla id, eftersom en regel inte har någon loop och 200 `matches()` går över taket på 1000 uttryck per skrivning (mätt): listan sammanfogas med komma och matchas mot "id, följt av noll eller fler (komma, id)", antalet bärs av `size()`, och `join(',').split(',') == p` stänger de hål som sammanfogningen lämnar. MÄTT i emulatorn: `join()` gör heltal, null och sant/falskt till text (`["a", 5]`, `["a", null]`, `["a", true]` passerade mönstret), och `["a,b"]` blev två id. Utan raden med `split` blir fyra prov röda (tabellen nedan).
- En lista flyttas eller kopieras inte till en annan plats (`flyttaBibliotekspost` kastar). Regeln kan inte avgöra att id:na finns eller ligger på samma plats; det gör läsningen.

### C. Admin får slå av och på gruppens appar (cllp/lifehub.app#252), Claude 2026-10-20

- **Mätt var ramverket avgör det:** på två ställen, och de var samma beslut. `AGARGRUPPFALT` (fälten bara ägaren får ändra) hade `moduler` och `huvudmeny`, och `OpsGruppFormular` ritade modulvalet bara när `moduler.agare` var sant. En admin nekades alltså i regeln och såg inte valet, så ingen kunde ge den knappen utan att båda ändrades.
- **`moduler` och `huvudmeny` flyttade från `AGARGRUPPFALT` till `ADMINGRUPPFALT`.** Gruppens regel följer listorna (de är härledda, ingen handskriven kopia), så en admin slår av och på appar och byter ordning, och en medlem gör det inte. Ägaren behåller det som inte går att ångra eller som rör datakällor: arkivera, externa datakällor och typavvikelser. (En grupp raderas aldrig av en klient, den arkiveras.) `modulinstallningar` (appens egna inställningar) är kvar bara för ägaren.
- **`OpsGruppFormular`: `moduler.agare` heter nu `moduler.farAndra`** (ägare ELLER admin). Den gamla `agare` kastas med en text som säger vad som gäller, eftersom en prop som tyst ignorerades hade låtit admin sakna valet. Rollhjälpen i `generell.js` följer.

### D. Mejla en delad länk (cllp/lifehub.app#356), Claude 2026-10-20

- **Dialogen Dela länk (`OpsBibliotek` och `OpsHandelsePanel`) får fältet "Skicka till mejl" och knappen Skicka** när appen ger `onMejlaLank({ id, url, till })`. Fältet sitter under länkens adress, för en nyss skapad länk och för en som lever och har en adress. Utan prop syns inget fält, och `onMejlaLank` utan `onDelaLank` kastas.
- **Ramverket skickar inget.** Det prövar adressen med `epostFel` (form och spärrade domäner) INNAN appen anropas, visar "Skickat till x." och tömmer fältet, och ett kast eller `false` står kvar som fel med adressen kvar i fältet. Ett andra tryck i samma ögonblick skickar inte ett andra mejl.
- **Regel 2:** adressformen fanns i tre kopior (`createGroupService`, `OpsGruppFormular` och nu den här). `EPOSTFORM` och `epostFel` ligger i `lib/mejl.js` och alla tre läser dem.

### E. Video: telefonens egen spelare är ett medvetet undantag

CP 2026-10-20: på iPhone öppnas helskärm med rätt kontroller, så `<video controls playsinline>` i Biblioteket behåller webbläsarens egna kontroller. Det står nu som en kommentar vid elementet i `OpsBibliotek` och i README. Vakten `check-webblasarkontroller` har ingen regel mot `<video controls>` (den läser 270 filer, 0 brott), så inget undantag behövdes i listan; det som skrevs är dokumentationen i vaktens huvud, så ingen "rättar" videon senare.

### Prov: rött utan, grönt med (regel 4)

Grönt med allt: vitest 4260 prov i 223 filer, `npm run test:rules` 658 av 658 (21 nya i `bibliotek.test.mjs` och `grupper.test.mjs`).

**Hela delarna borttagna** (källfilerna från 0.127.0 tillbaka, de nya proven kvar): i de tolv provfilerna som går att ladda (tio ändrade och två nya) 68 av 458 prov röda, och de fyra nya provfilerna för `lankkalla.js`, `lankinfo.js`, `biblioteklista.js` och `MejlaLank.jsx` (94 prov) går inte att ladda alls. Det visar att proven hör till delarna, men inte vad varje prov fångar. Därför också **en rad i taget ändrad** (källan från HEAD, ett villkor borttaget, bara de berörda proven körda):

| Ändring | Röda prov |
|---|---|
| Hämtar utan `redirect: "error"` | 1 av 36 |
| En oEmbed-ändpunkt pekar på en värd utanför listan | 3 av 36 |
| Ingen prövning av adressen i början (värd) | 1 av 36 |
| Tillåter http | 1 av 36 |
| Inget tak på svarsstorlek | 2 av 36 |
| `kalla` får avvika från adressen | 1 av 16 |
| Uppslagsfel visas inte | 2 av 21 |
| Borttagen post filtreras tyst bort | 5 av 54 |
| Dubblett läggs till igen | 2 av 54 |
| Full lista tar emot fler | 1 av 54 |
| Ingen återställning när skrivningen faller | 1 av 29 |
| Uppil flyttar inte | 1 av 29 |
| Admin får inte appfälten (`ADMINGRUPPFALT` som i 0.127.0) | 2 av 257 |
| Ingen adresskontroll före mejlet | 1 av 17 |
| Två tryck i samma ögonblick skickar två mejl | 1 av 17 |
| Fältet syns utan `onMejlaLank` | 1 av 92 |
| Regeln: `split == p` borta | 4 av 52 |
| Regeln: inget tak på antal poster | 2 av 52 |
| Regeln: dubbletter tillåtna | 3 av 52 |
| Regeln: en Spotify-länk får kallas `annat` | 2 av 52 |
| Regeln: admin utan appfälten (som 0.127.0) | 3 av 176 |

Mätningen hittade två prov som inte vaktade det de påstod. Det första var det andra värdprovet i `lankInfoUrOembed` (ingen ändring kunde göra något prov rött, så det togs bort, se A). Det andra var provet för dubbeltryck på Skicka: det var grönt även utan skyddet, eftersom varje `fireEvent` ritar om och stänger knappen innan nästa tryck. Båda trycken ligger nu i ett `act`, och provet är rött utan skyddet.

`check-skalyta` var röd en gång under arbetet, och det var en riktig träff: skalyteprovets egen sida skickade fortfarande `moduler.agare` till `OpsGruppFormular`, som nu kastar, så två mätningar avbröts (2 brott av 3083). Sidan följer `farAndra`, och mätningen är grön igen (3091 kontroller, inga brott). Det är provet för att ett gammalt namn verkligen kastas och inte tyst ignoreras.

### Vad appen måste göra efter ompinningen

1. **Regenerera och deploya Firestore-reglerna FÖRE klienten** (`bibliotekregelfragment` får `lista`, `kalla`, `bild` och `poster`; gruppens regel släpper in admin på `moduler` och `huvudmeny`). En klient som skriver en lista mot gamla regler nekas. Fixturerna för "byte för byte" bytte namn till 0.128.0.
2. **`OpsGruppFormular`: `moduler={{ valbara, farAndra }}`** (ägare ELLER admin) i stället för `agare`. Ligger hubbens `kanAndra` för appar på ägaren ensam ska den följa samma regel.
3. **Smart länk:** en callable som anropar `lankInfoUrOembed(hamta, url)` ur `ops-framework/node` med appens egen `fetch` (den ska respektera `redirect` och `signal`; en `hamta` som följer omdirigeringar öppnar vitlistan igen) och skickas till `OpsBibliotek` som `onLankInfo`. Svaret är `{ titel, artist, bild }`.
4. **CSP:** `img-src` för omslagen. Värdarna är tjänsternas egna bildtjänster (till exempel `i.scdn.co`, `i.ytimg.com`, `is1-ssl.mzstatic.com` och `i1.sndcdn.com`) och är OMÄTTA här, se osäkerheter: läs dem ur ett riktigt svar innan listan skrivs.
5. **Mejla länk:** `onMejlaLank({ id, url, till })` via appens befintliga mejlväg, till `OpsBibliotek` och `OpsHandelsePanel` (som kräver `onDela` för den).
6. Använder appen `createBibliotekskalla` behövs ingen ändring för `poster` och `bild`: källan bär dem.

### Gjordes inte

- Ingen inbäddad spelare och ingen förhandsvisning utöver ikon och omslag, inga fler källor än de fyra (CP 2026-10-20).
- Ingen zip, inga avsnitt, inga anteckningar per rad, inga mallar i listor. Ingen lista i en lista.
- Regeln kontrollerar inte att id:na i en lista finns eller ligger på samma plats: det går inte inom taket på uppslag per skrivning, och läsningen är spärren. En post som tas bort lämnar sitt id kvar i listan (ingen kaskad), och visas som "Finns inte längre". En post som flyttas till en annan plats får ett nytt id, så listan pekar på "Finns inte längre" och inte på kopian.
- `modulinstallningar` är kvar för ägaren ensam. `OpsModulInstallningar` säger "ägare och admin" i sin text, så texten och regeln går redan nu isär; det är en äldre diskrepans som inte rörs här och som bör bli ett eget ärende.
- **Inte mätt, och den största osäkerheten:** nätet var stängt mot Spotify, YouTube, Apple Music och SoundCloud när det här skrevs. oEmbed- och Open Graph-formerna är skrivna efter tjänsternas dokumentation och provade mot fixturer, inte mot riktiga svar. Särskilt Apple Musics Open Graph-form och artisten ur Spotifys `og:description` är antaganden. Första riktiga körningen i appen avgör, och faller en källa visas det som raden under adressen, inte som en tom rubrik utan förklaring.
- Dragandet med pekare är provat i jsdom (pekarhändelser) men inte i en riktig webbläsare eller telefon. Tangentbordsvägen är den som alltid fungerar.
- Montage mot SessionStudio (regel 12) har inte tagits: ärendena citerar ingen SS-skärmbild i de delar som är byggda här. Skärmbilder av nya ytor tas ändå av `check-skalyta --bilder` om de läggs till där.

## 0.127.0

Två delar i ett pass (och en rättelse, C, som kom under arbetet), de två från ärenden CP ställde 2026-10-19: omröstning om datum redan i formuläret Ny händelse, ramverkets del av cllp/lifehub.app#383 (skiva 1), och video i Biblioteket, cllp/lifehub.app#358. Designen för del A står i `docs/beslut/0010-datum-ej-satt-och-tillagg-i-skapaformularet.md`. Inget är brytande: en app som inte använder något av det ritar och skriver som förut, utom att Storage-regeln och bibliotekets Firestore-regel ändras av videon (se "Vad appen måste göra"). `handelsensDagar` kan nu svara `null`, och det är det enda returvärde som ändrats i en befintlig funktion.

### A. Datumröstning i Ny händelse (cllp/lifehub.app#383, ramverkets del), Claude 2026-10-19

CP: "ja det är bättre att röstningen går till så" (svar på förslaget att välja omröstningen redan i formuläret), och beslutet "Ja, kör på de förslagen om röstning": händelsen innan datumet är satt "syns streckad på varje föreslagen dag i kalendern och flyttar till sin dag när ett datum väljs. Ingen falsk dag." Vem som helst i gruppen får föreslå, ingen bekräftelse vid val. Ramverket känner inte appen Datumomröstning: allt sker via en plats.

- **Platsen `handelse.skapa`** (`HANDELSE_PLATSER`, samma familj och samma validering som `handelse.sektion`, beslut 0003). En ruta i formuläret för en NY händelse, direkt efter "Kräv svar", bara i en gruppkalender och bara för påslagna moduler (som "Kräv svar"). Komponenten får `{ grupp, varde, onVarde }`; skalet håller `varde` per tillägg och tolkar det aldrig. Tillägget bär `skapa: { datumEjSatt(varde), fel(varde), efterSkapa({ handelseId, varde, grupp }) }`, minst en funktion, och fältet avvisas vid uppstart på alla andra platser. Formuläret får propen `tillagg = { datumEjSatt: boolean, fel: string[], efterSkapa(handelseId) }` BARA när något ritas: en app utan tillägg får exakt de props den fick förut. ⛔ `efterSkapa` anropas efter att händelsen är skriven; faller den ligger händelsen kvar och formuläret ska skriva ut felet (en skrivning efter en skrivning kan inte vara atomär i reglerna). Alla tilläggs `efterSkapa` körs även om ett faller, och felen kastas efteråt. En funktion som svarar fel typ kastar med tilläggets namn.
- **`datum` valfritt i `HANDELSEKONTRAKT`.** Listan är oförändrad; tolkningen är att läget "Datum ej satt" är att `datum` SAKNAS, utan flagga och utan falskt datum (regel 2). `handelsefel(h, { datumEjSatt: true })` släpper igenom en datumlös händelse och kräver då att `slutDatum`, `tid`, `slutTid` och `heldag` också saknas; utan valet är "Välj ett datum" kvar. Ett tomt eller `null`-datum är fortfarande ett fel. Läsarna: `handelsensDagar` ger `null` utan datum, `harPasserat` svarar falskt, `svarsrader` ger ingen rad (och kastar inte i sorteringen), `handelsetid` ger tomma delar, `OpsHandelsePanel` ritar `datumEjSattEtikett` ("Datum ej satt" / "Date not set") i stället för datumet och ingen tid. Orden bor i `DATUM_EJ_SATT` (ny export), som panelen och kalendern läser. Regelfragmentet för händelser är oförändrat.
- **`CalendarEntry.preliminar`**: en FÖRESLAGEN dag för en händelse utan datum. Appen skickar en post per föreslagen dag, med samma `handelseId` och olika `id`. Pillret (från 640 px) och dagpanelens kort ritas med streckad kant och utan fyllning i samma färg som en vanlig post av slaget (`postklasser().ring`), pricken på telefon som en ihålig ring (1 px, `prickklass`), och kortet och snabbtitten säger "Datum ej satt" (på kalenderns `locale`s språk, så appen skriver inte ordet i `not`). Ett förslag är en dag: `endDate` och `allDay` på en preliminär post kastar, och en preliminär post är aldrig ett band. Pillret är lika högt som ett vanligt, så veckans rutor inte växer.
- **Vad som redan tålde ett saknat datum, och bevisas nu:** Idag och Kommande (en rad med `daysLeft: null` är odaterad och ligger i Kommande), och den publika sidan (0009: `handelsefel(h)` utan valet ger "Välj ett datum", så en länk till en datumlös händelse svarar `handelse-saknas`). Det är spärrar och inte rättelser: gröna både före och efter. Ramverket har ingen ICS-export och OpsSok läser inget `datum` (`OpsSok` frågar modulernas källor), så de två delarna är appens.
- **Prov** (`tillagg-skapa.test.jsx` 18, `datum-ej-satt.test.jsx` 15, `kalender-preliminar.test.jsx` 9, ett ändrat i `tillagg.test.jsx`) och mätning i webbläsaren (`check-skalyta` avsnitt 50 och 51). Rött utan rättelsen (alla ändrade källfiler från origin/main, de nya proven kvar): 37 av 99 prov röda i de sex filerna, 17 av 18 i `tillagg-skapa`, 9 av 15 i `datum-ej-satt` (de sex som är gröna är spärrarna ovan), 8 av 9 i `kalender-preliminar`. Grönt med: 216 filer och 4111 prov i hela sviten. Varje beteende är dessutom mutationsprövat, och mutationerna och utfallen står i PR-texten.

### B. Video i Biblioteket (cllp/lifehub.app#358), Claude 2026-10-19

CP: "Vi behöver kunna lägga upp upp till 100mb filer. Wav är vanligt och nödvändigt. Men andra filer kan vi ha mindre storlek på." Orsaken sedan 0.126.0: `FILMIME` hade bild, ljud, pdf och text, ingen video, och listan styr både postens regel och Storage-regeln. Ljudet behåller 250 MB och övriga filer 25 MB.

- **`FILMIME` får `video/mp4` och `video/quicktime`** (iPhones .mov). `.mp4`, `.m4v` och `.mov` normaliseras när webbläsaren inte säger någon typ (`mimeUrFilnamn`), och `video/x-m4v` är `video/mp4` (`normaliseraMime`). Andra videoformat tas inte emot förrän någon ber om dem.
- **Taket, `MAX_BIBLIOTEKVIDEO` = 100 MB, har ETT hem (regel 2).** Ljudets tak stod förut som en handskriven kopia i båda reglerna (`'^audio/.*'` i `regler.js`) och som en `startsWith("audio/")` i `filTak`. Nu läser `filTak` (klienten), Firestore-regeln för posten och Storage-regeln alla `FILTAK` (en rad per familj), och regeluttrycket byggs av `filtakRegel(mime, storlek)`. Felet säger "Taket är 104857600 för video". Den genererade texten skiljer sig från 0.126.0 bara på de två video-raderna (mätt mot fixturerna, som bytt namn till 0.127.0).
- **Video spelas i detaljen med en vanlig `<video controls playsinline preload="metadata">`, utan egen spelare**, med filens länk under som utväg när webbläsaren inte kan avkoda den (en iPhone-film i HEVC). Video delas med länk som andra filer (den publika sidan hade redan `delningsTyp` "video"; bevisat med prov). Video ligger under fliken Dokument: `BIBLIOTEKFLIKAR` har samma sex som SessionStudio, och en sjunde flik för en sort ensam hade varit en funktion förebilden inte har. `filSort` ger `video` (ikon, "Video · mp4" på kortet).
- **Prov** (`bibliotek-video.test.jsx` 15, två rader i `rules/__tests__/bibliotek.test.mjs`, fyra i `lagring-bibliotek.test.mjs`) och `check-skalyta` avsnitt 52. Det centrala provet kör regeluttrycket som kod mot `filTak` för varje format i `FILMIME` på varje sida om varje gräns (150 kombinationer), så att klienten och reglerna inte kan säga olika. Rött utan rättelsen: `bibliotek-video` går inte att samla in (`byggPost` vägrar videoposten), `arendefiler` 2 av 32, emulatorn 3 av 49 (Firestore-regelns skapa-prov och två Storage-prov). Grönt med: `test:rules` 640 av 640.

### C. Dela länk från en händelses filer får rätt gruppdel, Claude 2026-10-19

- **Orsaken:** `OpsPlatsfiler` vidarebefordrade inte `delningGruppdel` till `OpsBibliotek`, och en händelses plats (`handelse~<grupp>~<händelse>`) bär inget gruppnamn. En fil som delades från händelsepanelen fick därför ramverkets reserv "grupp" som gruppdel. En gruppdel tillhör den första plats som tar den för alltid, så den första gruppen som delade en fil därifrån fick ordet och varje annan grupp fick "Gruppdelen används av en annan grupp".
- **`OpsPlatsfiler` (och `OpsHandelsefiler`) tar `delningGruppdel` och en ny `gruppnamn`** och vidarebefordrar dem. `OpsBibliotek` tar samma `gruppnamn` och använder den när `platser` och `grupper` inte ger något namn (den inbäddade vyn har ingen sådan lista). Ordningen är oförändrad: gruppens senaste gruppdel (`delningGruppdel`), annars ett förslag ur gruppens namn.
- **Reserven "grupp" är borttagen (`foreslaAdress`).** Utan både gruppdel och namn är gruppdelen nu tom: rutan visar ett tomt fält och Skapa säger "Adressen kan inte vara tom", i stället för att föreslå ett ord som är fel för nästa grupp. Sista delen behåller sin reserv (`fil`, `handelse`): den är unik bara inom gruppens egen gruppdel och löses med `-2`. Ändrat beteende för en app som aldrig gav ett namn: den får ett tomt fält där den förut fick "grupp".
- **Prov** (`platsfiler-delning.test.jsx`, 5 prov, och `foreslaAdress` i `delning-adressform.test.js`): rött med en rad ändrad i taget (vidarebefordran av `delningGruppdel`: 3 röda, av `gruppnamn`: 1, namnet i `OpsBibliotek`: 1, reserven tillbaka: 2), grönt med grenen. Tre prov i `delad-vy.test.jsx` gav förut "grupp" utan något namn och får nu gruppens namn via `platser`.

### Vad appen måste göra efter ompinningen

1. **Tillägget på `handelse.skapa`** i Datumomröstningens modul: `{ plats: "handelse.skapa", id, etikett: { sv, en }, komponent: DatumvalIFormular, skapa: { datumEjSatt: (varde) => varde?.pa === true, fel: (varde) => [...], efterSkapa: async ({ handelseId, varde }) => skriv förslagen }}`. Komponenten visar brytaren "Låt gruppen rösta om datum" och, när den är på, listan förslag (`OpsDatePicker`, `OpsTimePicker`, minst två, valfri sista svarsdag) och anropar `onVarde`. `fel` ger "minst två förslag" och dagar som saknas. Första förslaget skickar chattkortet som i dag (ett kort, inte ett per förslag).
2. **Formuläret `HandelseForm` tar `tillagg`:** döljer datum, slutdatum, från, till och heldag när `tillagg.datumEjSatt`; `saknas` får `handelsefel(h, { datumEjSatt })` och visar `tillagg.fel`; `byggHandelsefalt` utelämnar datumfälten; efter lyckad skrivning anropas `await tillagg.efterSkapa(id)`, och faller den står händelsen kvar och felet skrivs ut med en länk till panelen. `functions/handelseform.js` (delad med servern) får samma val.
3. **Kalendern:** `calendarEntries` ger för en händelse utan `datum` en post per DISTINKT föreslagen dag med `preliminar: true` och samma `handelseId` (olika `id`, två tider samma dag är en post). Ta bort `notMedMarkering` och `ejBestamt`: ramverket äger ordet. Spridningen `...handelsensDagar(h)` är säker (`null`), men plocka inte ut `date` ur den utan att pröva. `useHandelser`/`arSynlig` ska skilja "ritas med dag" från "går att öppna" så att panelen, redigeringsformuläret och `flytta.js` hittar en datumlös händelse. Idag/Kommande: `daysLeft: null` och `when: DATUM_EJ_SATT.sv` (eller `.en`). Panelen: `handelse.datum` utelämnas, `OpsHandelsePanel` säger resten.
4. **Appens regler (`firestore.rules`) för datumröstningen, enligt planen i #383:** `datum` valfritt i `create` (`hasAll` utan `datum`; utan `datum` får `tid`, `slutTid`, `heldag` och `slutDatum` inte finnas), `svarSenast` (strängen på datumform) i båda `hasOnly`-listorna och i `appHandelsefaltGiltiga`; att sätta `datum` på en händelse som saknar det får bara skaparen eller en admin; rösterna låses: skriva i `datumroster` samt skapa och radera `datumforslag` kräver att händelsen saknar `datum`. `valj` slutar radera förslagen (så "Ångra valet" går), och en "Valt datum"-vy med "Ångra valet" för skapare och admin. Ramverkets `opsHandelsefaltGiltiga` är oförändrad och kräver inte `datum`. ⛔ Ordningen mellan regler och klient är appens (regler först, klient sedan): planens avsnitt 5.
5. **Video, regenerera BÅDA reglerna:** `lagringsregelfragment({ bibliotek: ... })` (Storage) och `bibliotekregelfragment(...)` (Firestore) ger nya texter med `video/mp4`, `video/quicktime` och videons tak. Deploya reglerna FÖRE klienten som tillåter valet av en film, annars nekas uppladdningen av regeln med ett ord som inte säger varför. Klienten behöver ingen annan ändring: `OpsBibliotek` och `createBibliotekskalla` bär videon.
6. **Skicka `delningGruppdel` och `gruppnamn` till `OpsPlatsfiler`/`OpsHandelsefiler`** där filerna visas under en händelse eller ett ärende: `delningGruppdel` = `gruppdelar({ uid, groupId: objektets grupp }).senaste`, `gruppnamn` = gruppens namn (`handelse.grupp`). Utan dem är gruppdelen tom och personen skriver den själv. Ärenden och händelser delar gruppens gruppdel, inte platsens.
7. **Det som är appens och inte byggt här** (planens skiva 1): sista svarsdag och påminnelsen till skaparen, "Välj datum"-knappen med förmarkering, chattbeskedet "Datum valt", summaraden "2 Ja, 1 Kanske, 0 Nej", och gästernas personliga röstlänkar (skiva 2, efter #377).

### Gjordes inte

- Ingen egen flik för video (se B). Ingen egen videospelare (CP:s beslut), alltså webbläsarens egna kontroller i detaljen: den publika sidan (`OpsDelad`) har en egen spelare och sade i 0.119.0 att webbläsarens kontroller inte kan bära temat. De två är olika på det här sättet, och det är ett beslut för CP om de ska vara lika.
- `datum` i andra konsumenter av ramverket (`tam`) är inte mätt: `handelsensDagar` som kan svara `null` är det enda en konsument kan märka.
- Montage mot SessionStudio (regel 12): ingen av de två ärendena citerar en SS-skärmbild, så regeln utlöses inte. Skärmbilderna tas ändå av `check-skalyta --bilder`.

## 0.126.0

Nattsprint, små UI-ärenden (cllp/ops-framework#391, #403 och cllp/lifehub.app#358, #359, #326, #327). Ett ärende är ändrat i ramverket (#391). Tre är mätta som redan levererade eller som appens (#403, #326, #327), ett är appens (#359) och ett kräver ett beslut innan det byggs (cllp/lifehub.app#358). Inget är brytande.

### Röstinspelning erbjuds bara där det finns en mottagare (cllp/ops-framework#391), Claude 2026-10-19

- **Vad CP sade:** inget nytt. Ärendet kom ur granskningen av cllp/lifehub.app#272: på en apps egen adress, i en grupp som inte har appen (avinstallerad, eller dold i hubben), visade Ny post och sedan Röstinspelning ramverkets text "OpsAppShell: modulen "bibliotek" har inget mål på platsen inspelning.mal i den här gruppen ... Registrera tillägget och slå på modulen." som larm i sidan. Användaren kan inte slå på något, och för en dold app kan inte ens ägaren det.
- **Rotorsaken** är att listan erbjöd en åtgärd som kräver ett mål gruppen inte har, inte att texten var obegriplig. `OpsAppShell` svarar nu på frågan med `useKanSpelaIn()` (intern, inte exporterad ur paketet) ur SAMMA lista som `useOppnaInspelning` öppnar ur (`modulensInspelningsmal`), så frågan och åtgärden inte kan säga olika (regel 2). `OpsBibliotek` ritar varken raden Röstinspelning i Ny-menyn eller knappen Ny röstinspelning i fliken Ljud när modulen inte har någon mottagare i gruppen. Utanför ett skal (en felkoppling) ritas raden som förut och kastar tydligt vid tryck. Ett direkt anrop av `useOppnaInspelning` för en modul utan mål kastar som förut: det är ett utvecklarfel och ska synas.
- **Prov** (`bibliotek-plus.test.jsx`, fem nya): ingen rad och inget larm när modulen saknas i gruppen, ingen Ny-knapp i Ljud, raden och knappen kvar när modulen är på (och raden öppnar inspelaren), raden försvinner när gruppen tappar modulen medan listan står uppe, och det direkta anropet kastar fortfarande. Rött utan rättelsen: 3 av 16 (raden fanns kvar i menyn, knappen i Ljud, och efter att modulen tagits bort). Grönt med: 16 av 16. Det gamla provet "Röstinspelning utan modulens mål kastas" kontrollerade att utvecklartexten visades för användaren och är ersatt.
- **Inte gjort, och en fråga till CP:** ärendets förslag om en hel rad "Biblioteket finns inte i den här gruppen" med en länk till Appar för ägaren. Appens adress ritas av appen (`web/src/app/App.jsx:966`, `<Route path="/bibliotek" ...>` utan koll mot gruppens `moduler`), och vad som ska stå är CP:s beslut. Frågan står i PR-texten.

### En uppladdning som aldrig blev klar, och ett avslutande steg som föll (efterhandsgranskningen av PR 408), Claude 2026-10-19

- **`OpsBibliotek`:** en filpost med `fil.klar === false` som är äldre än 60 minuter (`UPPLADDNING_MAX_MS`, räknat på postens `skapad`; ett 250 MB-ljud på 5 Mbit/s tar drygt 6 minuter och på 1 Mbit/s drygt 33, så en pågående uppladdning stämplas aldrig som avbruten) står inte längre och hämtar för alla medlemmar. Listan och detaljen säger "Uppladdningen blev inte klar" (`lage: "avbruten"`, aldrig "Hämtar ljudet." eller "Hämtar filen."), och detaljen har en knapp Radera för den som får radera posten (samma menyrad som annars, alltså samma behörighet). Listan ritar om av sig själv när gränsen passeras, utan att något i posten ändras. En post utan heltal som `skapad` går inte att döma och räknas som pågående.
- **`createBibliotekskalla.laddaUppFil`:** det avslutande `source.update` (som sätter `klar: true`) ligger nu under samma felhantering som uppladdningen. En NY post tas tillbaka om det faller, i stället för att stå kvar som `klar: false` fast filen finns. En ERSÄTTNING (`id` given) fick förut ingen hantering alls när något föll efter att posten skrivits över; den gamla posten återställs nu till vad den var (hela `fil`-objektet, `klar` inbegripet, samt rubrik, längd, våg, taggar och utskrift när den hade dem). Faller återställningen kastas båda felen. En fil som hunnit laddas upp innan det avslutande steget föll blir kvar i lagringen utan post (en ny post tas bort, och ingen rensning av filen finns i kontraktet).
- **Prov:** `bibliotek-vy.test.jsx` (fem nya, ett av dem en vakt för att en pågående uppladdning står kvar som Hämtar) och `bibliotekkalla.test.js` (fyra nya). Rött utan rättelsen: 8 av 70 (listan sade Hämtar, detaljen saknade Radera, listan ritade inte om, en ny post blev kvar, en ersättning blev kvar med nya filens uppgifter och `klar: false`, och det andra felet kastades inte). Grönt med: 70 av 70.

### Redan levererat, mätt: en ny post i biblioteket syns direkt (cllp/ops-framework#403)

- Levererat i 0.114.0 (`createBibliotekskalla.prenumerera`, `OpsBibliotek` använder `kalla`). Appen använder det: `BibliotekView` ger `kalla` och pinnar 0.124.0, och datakällan har `subscribe` (`src/data/firestore.js`). Mätt nu: provet `bibliotek-prenumeration.test.jsx` är rött utan prenumerationen (3 av 12, när `OpsBibliotek` tvingas läsa med `las()`) och grönt med (12 av 12). Ingen kod ändrad.

### cllp/lifehub.app#358, mp4 i biblioteket: ändrat INTE, beslut behövs

- Orsaken sitter i ramverket: `FILMIME` (`src/lib/bibliotek.js`) har bild, ljud, pdf och text, ingen video, och listan styr både postens regel och Storage-regeln (`filMimeMonster`). En mp4 nekas därför med "Formatet video/mp4 går inte att lägga in". Att lägga till formatet är en rad, men det är inte en liten skiva: taket (`MAX_BIBLIOTEKFIL` är 25 MB, ljud 250 MB), spelaren (`OpsBibliotek` har ingen videovisning, `filSort` ger "dokument"), fliken, den publika delningen och iPhones `video/quicktime` följer med. Frågorna står i PR-texten.

### cllp/lifehub.app#359, Skapa app saknar ikon i Skapa-menyn: appens

- Registreringen har ikonen (`web/src/app/SkapaApp.jsx:115`, `ikon: "layers"`), men appen ger inte skalet någon `ikonRitare` i `skapa` (`web/src/app/App.jsx:742`, registreringen på `:831`), och ramverket ritar då bara ordet (`OpsSkapa`, "Utan `ikonRitare` ritas ingen ikon"). Appen har redan en ritare i `web/src/app/views/SettingsView.jsx:111` (`ritaIkon`), som inte delas. Läst i koden, inte mätt i en körning.

### cllp/lifehub.app#326, Byt ordning även i header-ikonerna: appens

- Ramverkets `huvudmenyPoster` ger redan ikonerna i gruppens ordning (`moduler`). Appen ändrar den: `web/src/app/App.jsx:360` (`huvudIkoner`) lägger Meddelanden först oavsett ordningen, och Inkorg, Sök och Fråga ligger fasta runt dem. Vad "höger till vänster" ska betyda för dem är ett beslut. Ingen ramverkskod ändrad.

### cllp/lifehub.app#327, ikonerna för nära listan och ringen runt mikrofonen: redan levererat

- Mellanrummet under filterraden i Inkorgen är appens och levererat i cllp/lifehub.app PR 339 (`web/src/app/views/InboxView.jsx:1268`, mergad 2026-10-17). Ringen runt mikrofonen är ramverkets och levererad i 0.116.0 och 0.117.0. Ingen kod ändrad här. Bilden i ärendet ligger i Inkorgen och har inte gått att öppna, så att det CP pekade på är just dessa två är en slutsats ur ärendets text.

### Vad appen måste göra efter ompinningen

Inget. `OpsBibliotek` hämtar sin besked ur skalet, så appens kod är oförändrad. (För #359 och #326 är rättelserna i appen och beskrivs ovan.)

## 0.125.0

cllp/lifehub.app#377, ramverkets del (skiva 1): en publik sida för en HÄNDELSE, delad med en länk, och en läsbar adress för både händelser och filer. Designen, valen och skälen står i `docs/beslut/0009-publik-delning-av-handelse-och-fil.md`. CP 2026-10-19: "Om jag vill att andra skall kunna ta del av resan men inte är med i gruppen? Kan vi ha en publik händelse som jag kan dela med sms eller mail och som ser ut som en bra strukturerad websida. Kan vara skyddad med en kod (optional)." Beslutet i ärendet: "Ja på båda, kör skiva 1", alltså läslänk till en händelse, valfri kod per länk, förvalt ingen gräns men alltid möjlig att återkalla.
Skrivlänken (skiva 2) är inte byggd, men raden bär `rattighet` (`las`) och `hamta` öppnar inget annat, så den kan läggas till utan att ändra modellen.

⛔ **Brytande:** `createDelningService().skapa` ger inget `token` längre och kräver en adress. En fil delas med `{ uid, postId, groupId, gruppdel, fildel, dagar, nedladdning?, kod? }` och svarar med `{ id, adress, sokvag, giltigTill, harKod, rattighet, nedladdning }`. Appens callable och `OpsBibliotek onDelaLank` byter anrop i samma ompinning (se "Vad appen måste göra"). **Gamla länkar lever kvar:** en delning från 0.119.0 till 0.124.0 har ett token, `/d/<token>` och `hamta(token)` fungerar oförändrat, och `lista`, `andraNedladdning` och `aterkalla` gör det också. De går ut senast 30 dagar efter att appen går över (giltigheten var högst 30 dagar).
Reglerna: delningssamlingen är `if false` för klienten som förut, och `delningsregelfragment(namn, { gruppdelar })` har ett valfritt andra block för gruppdelarna (utan valet byte för byte den förra texten). Inga ändringar i Storage-reglerna och inga i postens fält.

### Länken till en händelse (CP 2026-10-19, #377), Claude 2026-10-19
- **En modell för två mål (regel 2).** Delningsraden får `slag` (`post` eller `handelse`; en rad utan fältet är en filänk och läses som `post`, så inget i produktion skrivs om), `rattighet` (`las`; `hamta` öppnar bara `las` eller en rad utan fältet), `adress`, `handelseId`, `kod` och `felAntal`/`felFonster`. `giltigTill` är `null` för ingen gräns, och bara för en händelse. Exporter: `byggAdressdelning`, `adressId`, `delningsNyckel`, `nyttSlumpslut`, `hashaKod`, `kodStammer`, `DELNINGSSLAG`, `DELNINGSRATTIGHETER`, `HANDELSEDAGAR`, `FORVAL_HANDELSEDAGAR`, `DELNINGSFELKODER`.
- **Händelsens sida.** `hamta` för en händelse svarar med `HANDELSESVARSFALT` och inget annat: titel, beskrivning, plats (ur appens `handelseSida(handelse)`), datum, slutdatum, tid, sluttid och heldag (ur `HANDELSEKONTRAKT`), och händelsens filer. Inte gruppen, medlemmarna, svaren, chatten, kommentarerna eller vem som skapade händelsen. Svaret byggs fält för fält. En arkiverad, borttagen eller flyttad händelse svarar `handelse-saknas`. Filerna är färdiga filer på platsen `handelse~<grupp>~<händelse>` (aldrig anteckningar, och en borttagen finns inte), var och en med en signerad `inline`-adress (15 minuter), högst `MAX_HANDELSEFILER` (50) med `ejVisade` för resten. Varje post läses om med `read`, så appens egen läsning gäller.
- **Konfiguration.** `createDelningService({ ..., samlingar: { ..., handelser }, handelseSida, farDelaHandelse? })`. `handelser` är appens händelsesamling (inget förval) och kräver `handelseSida`; utan `handelser` går ingen händelse att dela och inget annat ändras. `farDelaHandelse({ uid, groupId, medlemskap, handelse })` är appens snävare regel och prövas EFTER medlemskapet (samma mönster som `farRedigera` i `createFlyttaService`), och måste svara exakt `true`.
- **Vem får.** `skapa` för en händelse: en aktiv medlem (inte en agent) i händelsens grupp, läst ur händelsen och aldrig ur anropet, och appens regel. `aterkalla`: den som delade (även efter att ha lämnat gruppen), admin och ägare, och den som `farDelaHandelse` släpper in. Utan appens regel stänger ingen annan medlem. `lista({ uid, groupId, handelseId })` ger en händelses länkar; `lista({ uid, groupId })` ger som förut bara filänkar.
- **Giltighet.** En händelse har förvalt ingen gräns (`null`); 1, 7 och 30 dagar går att välja. En fil har som förut 1, 7 eller 30 dagar och aldrig ingen gräns.

### En läsbar adress för både fil och händelse (CP 2026-10-19), Claude 2026-10-19
- `/g/<gruppdel>/event/<händelsedel>` och `/g/<gruppdel>/lib/<fildel>`. Prefixet `/g/` finns så att en grupps namn aldrig krockar med appens egna sökvägar. Typsegmentet är en fast lista (`ADRESSSEGMENT`) så att ett framtida mål blir ett nytt ord och inte en ny form; därför behövs inga reserverade ord i sista delen. Delarna är gemener, siffror och bindestreck, högst 40 tecken (`adressdel`, `foreslaAdress`: å/ä/ö till a/a/o, allt annat till ett bindestreck). **Punkten blir ett bindestreck** (`bubbelglasen.ver2` blir `bubbelglasen-ver2`), för att en punkt sist i en adress läses som ett filnamn av CDN-regler och som skiljetecken i ett sms.
- **Utan kod får sista delen ett slumpat slut** på åtta tecken ur a-z och 0-9 (`randomBytes`, utan modulo-skevhet) som inte går att ta bort, eftersom en läsbar adress annars kan gissas. **Med kod** är adressen exakt det personen skrev. Rutan säger det i en mening.
- **Nyckeln är SHA-256 av sökvägen**, och `createNew` på id:t avgör unikheten (ingen läs-sedan-skriv-kontroll). En upptagen adress är ett eget fel (`kod: "adress-upptagen"`) och rutan föreslår nästa (`resa`, `resa-2`). En stängd eller utgången adress blir aldrig ledig.
- ⛔ **Adressen lagras ändå i klartext på raden** (`adress`), för CP:s krav att varje aktiv länk ska stå på händelsen med sin fulla adress så att den går att klippa ur och skicka. Den som läser databasen ser alltså adresserna. Beslut 0009 har avvägningen och alternativet (visa adressen en gång).
- `delningsSokvag(adress)` och `delningsUrl(bas, sokvag)`: ramverket bygger bara sökvägen, domänen är appens (för LifeHub `https://my.life-hub.app`). `delningsNyckel(ref)` ger id:t för ett token eller en adress (och `null` för skräp), för appens uppslagsräknare.

### En gruppdel tillhör en plats, för alltid (granskningen av PR 417), Claude 2026-10-19
- Utan en spärr kunde en medlem i grupp A skapa `/g/music/event/...` fast `music` är grupp B:s gruppdel, och länken såg ut att komma från B. Nu har varje gruppdel en rad i en egen samling (`samlingar.gruppdelar`, förval `delningsgruppdelar`): id är gruppdelen, raden är `{ plats, skapad }` och skrivs med `createNew` (en riktig constraint, ingen läs-sedan-skriv). Två samtidiga första användningar från två platser ger exakt en vinnare.
- Platsen är gruppens id (eller `mitt~<uid>` för Mitt bibliotek; för en händelse eller ett ärende gruppen). Vid `skapa`, efter medlemskapet och appens regel: en gruppdel som en annan plats har ger `kod: "adress-upptagen"` med `del: "gruppdel"` och texten att namnet används av en annan grupp; en ny skapas för platsen; en egen går bra. En plats kan ha flera gruppdelar, en gruppdel byter aldrig plats och tas aldrig bort. Felet bär `del` (`gruppdel` eller `sista`): en callable som översätter felet måste föra med `del`.
- `gruppdelar({ uid, groupId })` ger `{ plats, gruppdelar, senaste }`. `OpsHandelsePanel delningGruppdel` och `OpsBibliotek delningGruppdel` föreslår `senaste` före ett namn ur gruppens namn, och en annan grupps gruppdel ger ett annat förslag i gruppdelsfältet.
- `delningsregelfragment("delningar", { gruppdelar: true })` (eller ett eget namn) lägger ett andra block `allow read, write: if false`. Provat i emulatorn.

### Valfri kod, och en egen räknare för felaktiga koder (CP 2026-10-19), Claude 2026-10-19
- Gäller både fil och händelse. `scrypt` med eget salt per länk, `timingSafeEqual`, 6 till 64 tecken (`KODLANGD`, `kodFel`). Koden sparas aldrig i klartext. En kod som är för kort är ett fel (`ogiltig-kod`) och blir aldrig en öppen länk.
- `hamta(ref, { kod })` svarar `kod-kravs` utan kod och `fel-kod` med fel kod, och inget annat om målet. Nya orsaker: `handelse-saknas`, `kod-kravs`, `fel-kod`, `for-manga` (`DELNINGSORSAKER`, `DELNINGSFEL`).
- **Hastighetsbegränsning.** Appens räknare (60 uppslag i minuten per token och 300 per IP, lifehub.app `functions/delning.js`) räknar uppslag och täcker gissning av adresser, men inte en kod: 60 i minuten mot en sexsiffrig kod är drygt tre dygn. Tjänsten har därför en EGEN räknare per länk för felaktiga koder (`FELKOD_MAX` = 5 per `FELKOD_FONSTER_MS` = 15 minuter, på raden). Försöket reserveras innan koden prövas (`updateIf`) och ges tillbaka när koden stämde. Tar försöken slut svarar länken `for-manga` även på rätt kod. Priset är att den som vet adressen kan låsa en länk genom att gissa fel.

### Den publika sidan, `OpsDeladHandelse` (CP 2026-10-19), Claude 2026-10-19
- Titeln, och direkt under den datumet stort: veckodag, datum och år (`lör 26 dec 2026`), över flera dagar från och till och antal dagar (`lör 26 dec 2026 till sön 10 jan 2027, 16 dagar`), heldag som "Heldag" och klockslagen med. Platsen på en egen rad med ikon. Beskrivningen med radbrytningar bevarade och ingen HTML tolkad, och filerna (namn, typ, storlek, en knapp som öppnar filen i en ny flik). Utan filer en rad som säger det. Namnen kommer ur `Intl` (`weekdayNames`, `monthNames`) men formen (ordning, inga punkter) sätts av ramverket (`kortDatum`, `deladTid`, `antalDagar`), eftersom `Intl`-formatet skiljer mellan versioner.
- **Eget huvud med språkväljare SV/EN.** Förvalet är webbläsarens språk (svenska om det börjar på `sv`, annars engelska), valet sparas i `localStorage` (`DELAD_SPRAKNYCKEL`, med `try/catch`), och allt ramverkets text och datumformen följer det. Händelsens egen text översätts inte. Appens logga kommer som `huvud`.
- **Kodrutan** (`OpsDeladHandelse onKod`, och nu också `OpsDelad onKod`) när orsaken är `kod-kravs`, `fel-kod` eller `for-manga`. Ett dubbeltryck skickar ett försök. Mobil först, bara ramverkets tema och de publika rollerna.

### Dela och länkarna i händelsepanelen (CP 2026-10-19), Claude 2026-10-19
- `OpsHandelsePanel` får `delningar`, `onDela` och `onAterkalla` (alla tre eller inga): sektionen "Delade länkar" med knappen Dela. **Varje aktiv länk står med sin fulla adress som text**, sin rättighet, om den har kod och när den går ut, med Kopiera (`navigator.clipboard`; faller det markeras texten och raden säger att den ska kopieras för hand; en statusrad med `role="status"` säger Kopierad) och Återkalla (raden försvinner först när servern sagt ja). Utan länkar står en rad som säger det (regel 5).
- Dela-rutan: giltighet (förval Ingen gräns), en valfri kod och adressen, föreslagen ur gruppens namn och händelsens titel och ändringsbar. Den nya länken syns direkt i listan. Ett fel visas och lämnar rutan öppen med fälten orörda; en upptagen adress ger ett annat förslag. Svenska och engelska etiketter (`ORD_HANDELSEDELNING`, `ORD_DELALANK`, `ORD_LANKRAD`).
- `OpsBibliotek`: dialogen "Dela länk" får kod och adress (samma fält), `onDelaLank` får `kod`, `gruppdel` och `fildel`, och en länk med en adress visas som text med Kopiera (`delningar[].url`).

### Vad appen måste göra efter ompinningen
1. **Callable för en händelse:** `delaHandelse({ handelseId, gruppdel, handelsedel, dagar?, kod? })` som anropar `skapa` med `uid` ur inloggningen och svarar med `{ id, url: delningsUrl(bas, svar.sokvag), giltigTill, harKod, rattighet }`. Översätt `fel.kod` (`adress-upptagen`, `ogiltig-adress`, `ogiltig-kod`, `finns-inte`, `ej-behorig`) till svar som panelen kan visa, och för `adress-upptagen` ett fel som bär `kod: "adress-upptagen"`.
2. **Callable för en fil:** `skapa` kräver `gruppdel` och `fildel` och ger ingen `token`. Byt `url: ${bas}/d/${token}` mot `delningsUrl(bas, svar.sokvag)`. `lista` ger `sokvag` (eller `null` för en gammal länk): bygg `url` av den.
3. **Listan till panelen:** `lista({ uid, groupId, handelseId })` mappad till `{ id, url, rattighet, harKod, giltigTill }` (hoppa över rader utan `sokvag`).
4. **HTTP-funktion för den publika sidan:** `/g/<gruppdel>/event/<händelsedel>` och `/g/<gruppdel>/lib/<fildel>` slår upp `hamta("<gruppdel>/<typsegment>/<sista del>", { kod })` (POST med adressen och koden i kroppen, som för `/d/`). `/d/<token>` är oförändrad. Släpp igenom `HANDELSESVARSFALT` (och `HANDELSEFILFALT` per fil) som andra lås, som `urvalSvar` gör för `DELNINGSSVARSFALT`.
5. **Räknaren:** räkna uppslag på `delningsNyckel(ref)` i stället för på `TOKENFORM`-prövningen, så att den täcker både token och adress, och så att en gissning på en adress som inte finns räknas. Tjänsten räknar felaktiga koder själv.
6. **Konfiguration:** `createDelningService` får `samlingar.handelser` (och valfritt `samlingar.gruppdelar`, förval `delningsgruppdelar`), `handelseSida` (till exempel `(h) => ({ titel: h.rubrik, beskrivning: h.text, plats: h.plats })`) och helst `farDelaHandelse` (samma regel som pennan på händelsen). ⛔ `kallaMedSokvagsprov` omsluter bara `read`: tjänsten läser därför om varje fil med `read` innan den signeras, men håll `list` i takt om sökvägsprovet ska gälla även där.
7. **Routern och sidan:** `/g/:grupp/event/:handelse` ritar `OpsDeladHandelse` (med `huvud` och `onKod`), `/g/:grupp/lib/:fil` ritar `OpsDelad` med `onKod`. Basadressen är `https://my.life-hub.app`. Hosting-omskrivningen för metataggarna (`og:`) gäller även `/g/**`.
8. **Panelen:** skicka `delningar`, `onDela` och `onAterkalla` till `OpsHandelsePanel` för den som får ändra händelsen (samma avgörande som pennan), och `delningGruppdel` (ur `gruppdelar({ uid, groupId }).senaste`, en callable) till panelen och `OpsBibliotek`. Översätt `fel.kod` och `fel.del` till svar som bär båda.
9. **Reglerna:** generera om med `delningsregelfragment("delningar", { gruppdelar: true })`. Admin SDK kringgår reglerna, så ingen deploy krävs för att tjänsten ska fungera, men blocket gör nekandet explicit och prövat.

### Gjordes inte
- Skrivlänken (skiva 2). Rättigheten `skriv` öppnas aldrig av `hamta`.
- Metataggarna (`og:`), Hosting-omskrivningen, appens callables, routern och uppslagsräknaren på adresser: appen.
- Skydd mot namn som liknar något utanför appen: en gruppdel är först till kvarn, som för en URL-förkortare. Beslut 0009 beskriver risken.
- Montage mot SessionStudio (regel 12): ärendet citerar ingen SS-skärmbild, så regeln utlöses inte, och ingen förebild följs (regel 13).

### Prov, rött utan fixen och grönt med
- Se PR-texten för utfallen. Nya: `src/__tests__/delning-adress.test.js` (tjänsten: adressen, koden, räknaren, händelsens sida, behörigheter, gamla tokenlänkar), `delning-adressform.test.js` (adressdelar, datum och språk), `delad-handelse-vy.test.jsx` (den publika sidan och kodrutan), `handelsedelning-vy.test.jsx` (länkarna i panelen och hela kedjan över den riktiga tjänsten), tillägg i `delad-vy.test.jsx` (kod och adress i Bibliotekets dialog) och `delning.test.js` (filänkar med adress).

## 0.124.0

CP 2026-10-19, "Datumomröstning finns inte". En modul som bara är ett tillägg (`hubb: null`, `nav: []`, ett tillägg på `handelse.sektion`) gick inte att installera i en grupp. Hubbens nivå sade "Grupper kan lägga till den" och under Grupper stod den som tillgänglig, men gruppens Appar erbjöd den aldrig. Appen får inga ändringar för att den ska dyka upp: efter ompinningen finns den bland apparna som kan läggas till.
Inga ändringar i manifestet, i datan eller i reglerna. ⛔ Följder att veta om: en modul utan kort OCH utan tillägg erbjuds fortfarande inte (den har ingen yta att visa), och hubbens `saknade` är oförändrad.

### Tilläggsmoduler kan installeras och syns när de är på (CP 2026-10-19), Claude 2026-10-19
- Orsaken: `OpsGruppHubb` filtrerade erbjudandet med `m.hubb && !arKarna(m) && !installerade.includes(m.id)`. `m.hubb` är `null` för en modul som bara är ett tillägg, så den kunde aldrig komma med. `hubbForGrupp` hade redan sedan 0.60.0 slutat kalla en sådan modul `inget-kort`, så en installerad tilläggsmodul var dessutom osynlig på sidan.
- Erbjudandet: `(m.hubb || arBaraTillagg(m))`. Raden saknar ikon och säger var appen syns, med tilläggets etikett och ytans namn ur samma källa som gruppens inställningar (`synsPaText` över `PLATSYTOR`): "Rösta på datum · Syns på: Händelser" / "Vote on dates · Visible in: Events". Knappen Installera och `onInstallera(id)` är de samma som för övriga appar.
- Sektionen "Tillägg i gruppen" ("Add-ons in the group") under korten: en rad per installerad tilläggsmodul med namn och var den syns, så att ägaren ser att den är på. Ingen länk och ingen ny navigation, eftersom modulen inte har någon egen sida. En grupp vars enda app är ett tillägg säger inte längre "Gruppen har inga appar ännu".
- `arBaraTillagg(m)` och `tillaggsmodulerIGrupp({ grupp, moduler })` i `hubb.js`: ett ställe för "vad är en tilläggsmodul" (regel 2). `hubbForGrupp` använder samma funktion.
- Samma fel söktes på fler ställen (`m.hubb &&`, `.hubb)`, `Boolean(m?.hubb)` i `src`). Inga fler erbjudanden: gruppens inställningar (`valbaraModuler`) visar redan alla registrerade moduler, och appark, huvudmeny och `OpsModulSida` filtrerar på `hubb` med rätta, eftersom de leder till en sida och en tilläggsmodul har ingen.

### Prov, rött utan fixen och grönt med
- Se PR-texten för utfallen. Nya prov i `src/__tests__/hubb.test.jsx` ("OpsGruppHubb: en modul som bara är ett tillägg"): erbjuds med Installera och anropar `onInstallera`, erbjuds i en tom grupp och på engelska, syns under "Tillägg i gruppen" när den är installerad, en grupp vars enda app är ett tillägg, och en modul utan kort och utan tillägg erbjuds fortfarande inte.

## 0.123.0

cllp/lifehub.app#371, ramverkets del: ändra en post i en egen kalender, och flytta en post eller en händelse till en annan kalender. Designen och valen står i `docs/beslut/0008-flytta-mellan-kalendrar.md`, CP:s beslut i https://github.com/cllp/lifehub.app/issues/371#issuecomment-6272062625. Appens delar (pennan för ägaren, redigeringshooken för poster, listan och `onFlytta` i panelen, callable som anropar tjänsten, regeldeploy behövs inte) kommer efter ompinningen.
Inga ändringar i postens fält, ingen ny samling och ingen ny typ. Kalenderregelfragmentet är byte för byte detsamma som 0.122.0. ⛔ Följder att veta om: en app som inte ger `flyttmal` märker ingenting, och `useOppnaSkapa()("handelse", { id })` med ett id som inte börjar på `post~` gör exakt det den gjorde.

### Ändra en post och flytta mellan kalendrar (CP 2026-10-19, #371), Claude 2026-10-19
CP, med en skärmbild av GSEMS-händelsen i Barnveckor: "Det går dock inte att ändra en händelse. Vidare borde det gå att flytta en händelse till en annan kalender." Efter 0.120.0 öppnades en post i detaljvyn men bara för läsning, och ingen väg fanns att byta kalender.
- Pennan för en post är panelens `onRedigera` (den fanns). Det som saknades var skalets redigeringsläge: `useOppnaSkapa()("handelse", { id: postHandelseId(post.id) })` öppnar formuläret för en post i en av mina kalendrar. Väljaren visar bara mina kalendrar, typen ritas inte, och "Blockerar tillgänglighet" fylls i ur nya `HandelseRedigering.blockerar`. Prefixet tolkas med `postIdUrHandelseId` på det ställe som redan ägde det.
- `flyttmal({ fran, mina, grupper, farRedigera?, sprak? })` (ren funktion): vart något får flyttas. En post: mina andra kalendrar (`byt`) och gruppernas kalendrar (`konvertera`). En händelse: bara sin grupps andra kalendrar (`byt`), bara när `farRedigera` är exakt `true`. Gruppkalender till egen kalender och till en annan grupp erbjuds aldrig. Arkiverade och kalendern det ligger i erbjuds inte. `postensTidsfalt(post)` är postens tid som en händelses fält, den enda omvandlingen.
- `OpsHandelsePanel` får `flyttmal` och `onFlytta`: "Flytta till kalender" under informationsrutan, bara med minst ett val. Ett byte sker direkt; en post till en gruppkalender bekräftas först med gruppens namn och att medlemmarna ser den. Faller anropet visas orsaken (`role="alert"`) och rutan står kvar; ett dubbeltryck skickar en flytt. Nya orddelar: `flyttaEtikett`, `flyttaMinaRubrik`, `bekraftaTitel`, `bekraftaText`, `bekraftaKnapp`, `avbrytEtikett`, `stangEtikett`, `flyttFelEtikett`, på svenska och engelska.
- `createFlyttaService({ kalla, samlingar, byggHandelse, farRedigera?, farSkapa?, klocka? })` (`ops-framework/node`): `flyttaPost`, `flyttaHandelse` och `goraPostTillHandelse`. Konverteringen skapar händelsen och tar bort posten i EN batch (en källa utan batch nekas när tjänsten byggs), händelsen får postens id så att unikhet är en nyckel, och tid, grupp och kalender sätts ur posten, inte av appen. Medlemskapet prövas alltid först (aktiv, inte en agent); appens snävare regler kommer efter. Felen bär `kod` (`FLYTTFELKODER`).

### Gjordes inte
- Allt i appen: pennan för ägaren, `redigera`-hooken för poster, `flyttmal` och `onFlytta` i panelen, callable som anropar tjänsten, och ompinningen.
- Flytt från en gruppkalender till en egen kalender och mellan grupper (beslutat bort, se beslut 0008). Ingen flytt av flera poster på en gång, ingen ångra efter en konvertering, och ingen aktivitetslogg över flytten.
- Montage mot SessionStudio (regel 12): ärendet citerar ingen SS-skärmbild, så regeln utlöses inte.

### Prov, rött utan fixen och grönt med
- Se PR-texten för utfallen. Nya: `src/__tests__/flytta.test.js` (listan och tidsomvandlingen), `flytta-service.test.js` (tjänsten över ett minne), `flytta-vy.test.jsx` (panelen, hela kedjan över den riktiga tjänsten), `postredigering.test.jsx` (skalets läge för en post), `rules/__tests__/postandring.test.mjs` (Firestore i emulatorn, 8 prov).

## 0.122.0

cllp/lifehub.app#366 punkt 3, ramverkets del (R1): filer på ett ärende. Designen står i `docs/beslut/0007-arendefiler-pa-arende.md`, CP:s beslut i https://github.com/cllp/lifehub.app/issues/366#issuecomment-6271704171. Appens delar (A1 till A4: datum och synlig bilaga, regeldeploy och sektionen Filer, ärendet som en post med länken nycklad på dess id, kalenderlagret) kommer efter ompinningen.
Inga ändringar i postens fält, ingen ny samling och ingen ny typ. ⛔ Följder att veta om: `OpsBibliotek` kastar nu också om en ärendeplats ges som `platser` eller `grupper`, och `flyttaBibliotekspost` kastar för en, också mellan ett ärende och en händelse. En app som inte använder ärendefiler märker ingenting, och texten för regelfragmenten är byte för byte den som 0.121.0 skrev så länge de nya valen (`arenden`, `arendefiler`) inte skickas.

### Ett ärendes filer är en plats, som en händelses (CP 2026-10-19, #366), Claude 2026-10-19
CP: biljetterna till bion ska ligga på ärendet "köpa biljetter före fredag". Ärendet i appen är inkorgsposten (GitHub-kopian är en spegel), och dess enda bilaga är en data-URL med tak 700 000 tecken, som en vanlig biljett-PDF inte ryms i. Beslutet i ramverket: ärendet bor i appen, GitHub är en spegel, och filerna får en egen plats. GitHub får aldrig filer.
- `groupId` får en fjärde form: `arende~<grupp>~<inkorgspostens id>` (`arendeBibliotek(groupId, arendeId)`, `arendedelar`, `arArendeBibliotek`, `arObjektbibliotek`, `ARENDE_PREFIX`, `ARENDEFORM`, `ARENDEIDFORM`). Id-formen är händelsens (ett Firestore-id), och formen byggs av samma funktion som händelsens, så de två inte kan glida isär. `gruppForPlats` känner nu båda, så delningen och appens servrar slår upp gruppens medlemskap för ett ärende precis som för en händelse. `postFel` godtar platsen bara för en fil (felet nämner ärendet), och `farAndra` låter gruppens roller gälla.
- Behörigheten är gruppens medlemskap, tolkat ur platsen. `bibliotekregelfragment(namn, { arenden })` (appens ärendesamling, normalt `inkorg`, inget förval) lägger till grenen: läsa kräver aktiv medlem OCH att posten finns i ärendesamlingen OCH att dess `groupId` är platsens grupp (annars läser en medlem i A ärendets filer i B genom en påhittad plats). Skapa kräver dessutom en person och `typ == "fil"`. Ändra och radera som i gruppen: författaren, ägare och admin. Ett ärende-id slås upp i ärendesamlingen och ett händelse-id i händelsesamlingen, aldrig tvärtom. `lagringsregelfragment({ bibliotek: { ..., arendefiler: true } })` släpper in platsen i Storage. De två fragmenten byggs av en konstruktion per objekt (händelse, ärende) i stället för en kopia per objekt.
- `OpsPlatsfiler` är sektionen "Filer" för ETT OBJEKT, en händelse eller ett ärende, och ersätter att kopiera `OpsHandelsefiler`. Slaget läses ur källans plats, så det finns ingen andra uppgift att hålla lika med den; `slag` är en valfri spärr som kastar när källan är av det andra slaget. `OpsHandelsefiler` är kvar som ett namn (`OpsPlatsfiler` med slaget låst till händelse, samma propar, samma `data-handelsefiler`, samma texter), och `ORD_OPSHANDELSEFILER` är kvar som alias. Ett ärende får `data-arendefiler`. `OpsBibliotek` får `tomText`, eftersom meningen under "Inga filer än." stod hårdskriven till händelsen.
- Platsen syns inte i platsväljaren och inget flyttas dit eller därifrån: en flytt är ett beslut om vem som ser filen, och ett ärendes fils synlighet är ärendets. Samma skäl som för händelsen (beslut 0006).
- `createPlatsfilerService({ kalla, samlingar: { bibliotek } })` (`ops-framework/node`): `stada({ plats, skarpt })` för hård radering av en händelse eller ett ärende med Admin SDK. Torrt som förval, rapport med alla fält också som noll. Den kastar för allt som inte är en objektplats, före något läses, eftersom en städning av gruppens egen plats hade tagit bort alla gruppens filer. `createHandelsefilerService` är kvar med samma anrop och bygger på samma tjänst. Ärendet raderas aldrig av en klient (inkorgens `update, delete: if false`), så det vanliga fallet behöver ingen städning.

### Gjordes inte
- Allt i appen (A1 till A4), regeldeployen och ompinningen.
- Spegelrader (`github_{nr}`) får inga filer: de är serverns och saknar post. Anteckningar och länkar på ett ärende (ärendets text och kommentarerna finns redan), flytt eller kopiering mellan platser, filer till GitHub.
- Storage prövar inte att ärendet finns, bara gruppens medlemskap och att posten finns med samma plats (samma val som för händelsen, beslut 0006): posten kan bara skapas under ett ärende som fanns och som hör till gruppen.
- Montage mot SessionStudio (regel 12): ärendet citerar ingen SS-skärmbild, så regeln utlöses inte, och ingen skärmbild bredvid förebilden har tagits.

### Prov, rött utan fixen och grönt med
- Se PR-texten för utfallen. Nya: `rules/__tests__/arendefiler.test.mjs` (Firestore och Storage i emulatorn, 30 prov med golv på utfallen), `arendefiler.test.js` (platsen, posten, källan, flytten, regelfragmenten byte för byte mot `rules/__fixturer__/*-0.121.0*.rules`, delningen, städningen), `arendefiler-vy.test.jsx` (sektionen, spärren mellan slagen, platsväljaren).

## 0.121.0

cllp/lifehub.app#366 punkt 2, ramverkets del: filer på en händelse. Designen och valet mot alternativet står i `docs/beslut/0006-handelsefiler-pa-handelse.md`. Appens del (kalla, inkoppling i händelsepanelen, regeldeploy, ompinning) kommer efter ompinningen.
Inga ändringar i postens fält, ingen ny samling och ingen ny typ. ⛔ En följd att veta om: `OpsBibliotek` kastar nu om `platser` eller `grupper` innehåller en händelseplats, och `flyttaBibliotekspost` kastar för en. En app som inte använder händelsefiler märker ingenting.

### En händelses filer är en plats, som Mitt bibliotek (CP 2026-10-19, #366), Claude 2026-10-19
CP: "Jag vill ta detta mail och skapa en händelse och lägga till PDF:erna, och eventuellt bilder på biljetter mm ... Detta är jätteviktigt att som i sessionstudio ha ett händelsebibliotek som bara gäller den händelsen." Händelsen hade en enda bilaga som data-URL i sitt eget dokument (0.45.0, tak 700 000 tecken), och beslut 0002 pekade ut Biblioteket som vägen för flera.
- `groupId` får en tredje form: `handelse~<grupp>~<händelse>` (`handelseBibliotek(groupId, handelseId)`, `handelsedelar`, `arHandelseBibliotek`, `gruppForPlats`, `HANDELSE_PREFIX`, `HANDELSEFORM`, `HANDELSEIDFORM`). Valet stod mellan platsen och ett fält `handelseId` på en post i gruppens plats. Platsen vann: posten är densamma, frågan är ett fält utan index, gruppens bibliotek ser aldrig händelsefilerna, och storage-sökvägen bär platsen så behörigheten är två dokument som för en grupp. Fältet hade krävt ett sammansatt index, en backfill (ett fält som saknas matchar inte `== null`) och ett tredje uppslag i storage-regeln.
- Behörigheten är gruppens medlemskap, tolkat ur platsen. `bibliotekregelfragment(namn, { handelser })` (appens händelsesamling, inget förval) lägger till grenen: läsa kräver aktiv medlem OCH att händelsen finns OCH att dess `groupId` är platsens grupp (annars läser en medlem i A händelsefilerna i B genom att skriva en påhittad plats). Skapa kräver dessutom en person och `typ == "fil"`. Ändra och radera som i gruppen: författaren, ägare och admin. `lagringsregelfragment({ bibliotek: { ..., handelsefiler: true } })` släpper in platsen i Storage. Utan `handelser` och `handelsefiler` är båda texterna byte för byte de förra (mätt).
- `farAndra` låter gruppens roller gälla på platsen, `postFel` godtar platsen men bara för en fil, och delningstjänsten slår upp medlemskapet via `gruppForPlats` så Dela länk fungerar på en händelsefil. Appens server (utskrift) ska göra samma uppslag.
- `OpsHandelsefiler` är sektionen "Filer": `OpsBibliotek` inbäddad (`inbaddad`) med rubrik, Ladda upp och valt läge, kopplad mot en `createBibliotekskalla` för platsen. `OpsHandelsePanel` får slotten `filer`, ritad efter bilagan och före svaren. Tom lista skrivs ut ("Inga filer än."). Ladda upp ritas bara när appen säger `kanLaggaTill`, samma avgörande som pennan.
- Platsen syns inte i platsväljaren och inget flyttas dit eller därifrån: `OpsBibliotek` kastar om den ges som `platser` eller `grupper`, och `flyttaBibliotekspost` kastar åt båda hållen. En flytt är ett beslut om vem som ser filen, och en händelsefils synlighet är händelsens.
- `createHandelsefilerService({ kalla, samlingar: { bibliotek } })` (`ops-framework/node`): `stada({ groupId, handelseId, skarpt })` för hård radering av en händelse med Admin SDK. Torrt som förval, rapport med alla fält också som noll. En händelse som arkiveras (det vanliga) behöver ingen städning; en borttagen händelse gör posterna osynliga för klienten direkt, och objekten tar appens `bibliotekstadning` bort.

### Gjordes inte
- Migreringen av den singulära `bilaga` till en fil (beslut 0002, steg 3): en uttalad migrering i appen. Tills dess ritar panelen båda.
- Anteckningar och länkar på en händelse (händelsens beskrivning en gång till), flytt eller kopiering mellan platser, taggar/sök/flikar i händelsens lista, röstinspelning direkt i händelsen, en `skrivvillkor`-ratt (en andra konfigurationspunkt vid sidan av händelsesamlingens egen).
- Mejl till händelse och slutdatum samma dag (andra punkter i #366).

### Prov, rött utan fixen och grönt med
- Se PR-texten för utfallen. Nya: `rules/__tests__/handelsefiler.test.mjs` (Firestore och Storage i emulatorn, 26 prov med golv på utfallen), `handelsefiler.test.js` (platsen, posten, källan, flytten, regelfragmenten, delningen, städningen), `handelsefiler-vy.test.jsx` (sektionen, platsväljaren, panelens slot).

## 0.120.0

cllp/lifehub.app#367 (P0, kalendern), ramverkets del. Appens del (skicka `standardkalender: true`, engångssteget för befintliga grupper, detaljvyn för poster, ompinning) kommer efter ompinningen.
Inga nya regler och ingen ändring av datamodellen: `gruppkalendrar` och dess regler finns sedan 0.37.0. ⛔ En följd att veta om: `postTillRad` ger nu varje post ett `handelseId`, och `OpsCalendar` kastar för en rad med `handelseId` om varken `handelsepanel` på skalet eller `onOppnaHandelse` finns. En app som ritar poster ur `postTillRad` utan någon av dem måste lägga till den.

### Varje grupp har en standardkalender, och det ersätter "gruppen är kalendern" (CP 2026-10-19, #367), Claude 2026-10-19
CP: "Skapa ny grupp, kommer inte med en default grupp kalender." Händelsen: CP:s grupp hade ingen namngiven kalender (0.37.0 seedade ingen, 0.78.2 och 0.84.0 gjorde "gruppen är kalendern" till beslut, #309) och en enda egen kalender, Barnveckor. Förvalet för en ny händelse föll på den, händelsen blev en post i `users/{uid}/kalenderposter` i stället för en händelse i gruppen, och den gick inte att öppna. Beslutet byts, det kringgås inte: ett läge utan kalender var något ramverket tillät och tre ställen i koden inte klarade av. Det uppstår nu bara om en admin arkiverar allt, och då är det ett val.
- `createGroupService({ standardkalender: true })` skriver standardkalendern (`standardGruppkalender(groupId)`) i SAMMA batch som gruppen och ägaren. Förval `false`, så en app som inte säger något beter sig som förut. Samlingens namn är `samlingar.gruppkalendrar` (förval `gruppkalendrar`, som kalenderkällan). Raden byggs av samma `byggGruppkalender` som skrivvägen, har dokumentnyckeln `groupId|kalender` och bär inte `forvald`: förvald är härledd (`forvaldKalender`), och `true` på raden hade varit två sanningar.
- Namnet och id:t är konstanter på ett ställe, `STANDARDKALENDER_ID` (`kalender`) och `STANDARDKALENDER_NAMN` (`Kalender` och `Calendar`), färg 1, ikon `kalender`, ordning 0. Claudes förslag: CP kan byta dem här. Inte gruppens namn, för det hade blivit en andra kopia som glider vid omdöpning.
- `createStandardkalenderService({ kalla, samlingar? })` (`ops-framework/node`) ger en befintlig grupp sin kalender. `sakerstallStandardkalender({ groupId, skarpt })` svarar `finns` (minst en aktiv gruppkalender), `bara_arkiverade` (rörs inte: en admin som arkiverat allt har gjort ett val), `saknas` (torrt) eller `skapad`. `sakerstallAlla({ skarpt })` går igenom grupperna en gång och rapporterar `lasta`, `finns`, `saknas`, `skapade`, `bara_arkiverade` (grupp-id) och `fel`, alla alltid, också som noll. Ett fel på en grupp stoppar inte de andra och tystas inte. Raden skrivs med `createNew` (kontraktets regel 8) och skrivs aldrig över: hinner någon skapa `kalender` först är svaret `finns`. En källa utan `createNew` nekas när tjänsten byggs.

### En ny händelse hamnar aldrig i en personlig kalender av sig själv
- `OpsAppShell`: målet från början är gruppens förvalda kalender, annars inget (då hamnar händelsen i gruppen och raden säger gruppens namn). Grenen "annars min förvalda" är borta. Min förvalda är härledd till den första egna även om personen aldrig valt någon, och den träffade därför nästan alltid.
- När gruppen saknar kalender men personen har egna får "Skapa i"-växlaren en rad för gruppen själv (`*gruppen`, som inte har id-formen och därför inte kan krocka med en kalender), så att det går att välja tillbaka efter att ha valt en egen. Med en riktig gruppkalender behövs den inte, och utan egna kalendrar finns inget att välja mellan.
- `forvaldKalenderId` tittar bara på gruppens kalendrar och svarar `""` när det inte finns någon. Filtret (`filtreraPoster`): en händelse utan `kalender` följer gruppens förvalda kalender (oförändrat). Saknas gruppkalender hör den till gruppen själv, som inte har någon knapp i filtret, och den syns alltid. Före 0.120.0 hänfördes den till MIN förvalda kalender: den syntes bara när den var vald och försvann när den valdes bort.

### En post i en egen kalender går att öppna
- `postTillRad` ger raden `handelseId: "post~<id>"` (`postHandelseId`). Prefixet har ett tecken (`~`) som inget id i ramverket kan bära (`ID_FORM`), så ett händelse-id kan inte likna det. `postIdUrHandelseId(handelseId)` är den enda platsen prefixet tolkas, och `postTillHandelse(post, kalendrar, sprak)` ger `HandelseVy` för `OpsHandelsePanel` (titel, dag, tid, kalender, plats, beskrivning, ingen typ och ingen status). Appens `handelsepanel.rita` slår upp posten med `postIdUrHandelseId` och ritar den. Konstanten `KALENDERPOST_HANDELSEPREFIX` finns också.

### Heldagsbandet har en egen yta
- `Band` i `OpsCalendar`: bandbiten är `bg-surface` med tonen (20 procent) i ett eget lager ovanpå (`[data-bandton]`). En vald ruta är inverterad (`ops-contrast-panel`), men bandet ligger som syskon till rutorna och inte som barn, så det ärvde sidans textfärg: sidans text på den inverterade ytan. Nu mäts `text-ink` alltid mot en känd yta.

### Prov, rött utan fixen och grönt med
- Se PR-texten för utfallen. Nya: `standardkalender.test.js` (batchen, idempotens, kapplöpare, rapportens golv), `kalenderpost-oppna.test.jsx` (post öppnas från dagpanel och snabbtitt), tillägg i `kalenderhantering.test.jsx` (förval, växlarraden, filtret) och `kalendrar.test.jsx` (postens id och detaljvy, standardkalenderns rad). Playwright: `check-skalyta` avsnitt 49 (`--bara-bandkontrast`) mäter bandets text mot det som ligger under i en riktig webbläsare, ljust och mörkt, 1024 och 1280 px, krav 4,5:1, golv 4 bandbitar, 12 punkter och en punkt per bit över en vald ruta.

## 0.119.0

cllp/lifehub.app#356 (publik delning av en biblioteksfil via en länk), ramverkets del. Appens del (callable, HTTP-funktion, routen `/d/:token`, metataggar) kommer efter ompinningen.
⛔ Regeländring: den nya samlingen nekas klienten (`delningsregelfragment`). Reglerna ska ut före appens funktion som skriver i den. Storage-reglerna ändras inte. Inget annat är brytande.

### Delningslänk till en biblioteksfil (CP 2026-10-19, Grok-förslaget på lifehub.app#356), Claude 2026-10-19
- `createDelningService` (`ops-framework/node`): `skapa`, `andraNedladdning`, `aterkalla`, `lista` och `hamta(token)`. Datakällan, lagringen (`signeradAdress`) och samlingsnamnen (`delningar`, `bibliotek`, inga förval) skickas in. `byggDelning` ger delningspostens form: id är SHA-256 (hex) av tokenet, tokenet är 32 slumpbyte i base64url och sparas aldrig. Fält: `postId`, `groupId`, `skapadAv` (`{ uid, namn }`), `skapad`, `giltigTill`, `aterkallad` (`null` eller tiden) och `nedladdning`.
- Vem får: en aktiv medlem delar sina egna poster, admin och ägare alla i gruppen, i `mitt~<uid>` bara ägaren. Postens egen `groupId` måste vara den angivna (IDOR). Den som delade, admin och ägare ändrar nedladdning och stänger. Stängd är slutgiltigt, och en ny delning ger ett nytt token.
- `hamta` svarar med `rubrik`, `typ`, `mime`, `storlek`, `langd`, `peaks`, `nedladdning`, `url` och `visaUrl`, och inget mer (ingen sökväg, inget grupp-id, inga taggar, ingen utskrift, ingen e-post). `url` är signerad i 15 minuter, `inline` när nedladdning är av och `attachment` när den är på. `visaUrl` (en inline-adress) finns bara för en PDF med nedladdning på, annars `null`. Ett okänt token svarar byte för byte som ett utgånget.
- Utgångstid 1, 7 eller 30 dagar, förval 7. "Ingen utgång" finns inte. Nedladdning är AV som förval.
- `delningsregelfragment("delningar")`: `allow read, write: if false`. Prövas i emulatorn (`rules/__tests__/delningar.test.mjs`) och ingår i provreglerna.
- `OpsDelad`: den publika vyn. Ljud (`OpsLjudspelare`, nu med `utanNedladdning`), bild i full bredd, PDF inbäddad, video med ramverkets egna kontroller, "Ladda ner" bara när nedladdning är på, och feltexterna "Länken har gått ut", "Länken är stängd" och "Filen finns inte längre".
- `OpsBibliotek`: "Dela länk" i postens meny (för en färdig fil som personen får ändra), en dialog med utgångstid, nedladdning, Kopiera och "Stäng länken", och markeringen "Delad" på en post med en länk som lever. Nya props `onDelaLank`, `onAndraNedladdning`, `onAterkalla` och `delningar`. `onDelaLank` kräver de två andra.
- Konstanterna och orden (`DELNINGSDAGAR`, `DELNINGSFEL`, `delningsTyp` med flera) finns i båda ingångarna.

## 0.118.0

### WAV och andra stora ljudfiler i biblioteket (CP 2026-10-18), Grok 2026-10-18
⛔ Regeländring i både Firestore och Storage: reglerna ska ut före klienten.
- Ljud (audio/*) har ett eget tak, `MAX_BIBLIOTEKLJUD` = 250 MB (262 144 000 byte), i `filInmatningsfel`, i postens regel och i lagringens regel. Bilder och dokument behåller 25 MB. CP:s fil var 64 264 206 byte.
- `audio/aiff` och `audio/flac` är nya format. `normaliseraMime` gör audio/x-wav, audio/wave och audio/vnd.wave till audio/wav, och audio/x-aiff och audio/x-flac till sina namn. `mimeUrFilnamn` tar typen ur ändelsen när webbläsaren inte säger någon.
- Firebase-lagringen laddar alltid upp återupptagbart (`uploadBytesResumable`) när SDK:n har den, också utan framsteg.
- En ljudfil över 25 MB läses aldrig hel för vågen: en WAV får längd och toppar ur bitar (`wavMetaUrBlob`, högst 48 x 64 KB), och andra format sparas utan våg. Mergad på CP:s ja 2026-10-18 08:08 ("Allt skall ut"), undantag från regel 9.

## 0.117.1

### En ny inbjudan med rollen agare nekas när den skickas (Claudes granskning av 0.117.0, CP 2026-10-18), Grok 2026-10-18
- `bjudIn` kastar för rollen `agare`, också från gruppens ägare, med felet "rollen agare går inte att bjuda in till ... Bjud in som admin.", och inget skrivs. En grupp har en ägare, och man blir ägare bara genom överlämning.
- Accepten av gamla väntande rader med rollen agare ger fortfarande admin (`rollEfterAccept`, 0.117.0).
- Proven som bjöd in som ägare bjuder nu in som admin. Mergad på CP:s ja 2026-10-18 08:08 ("Allt skall ut"), undantag från regel 9.

## 0.117.0

cllp/ops-framework#408 (ägarinbjudan ger admin, dov mikrofon, biblioteksfil med klar-markering, rubrik på röstanteckning). Mergad på CP:s ja 2026-10-18 01:04
("Du kör cloud om du kan. Sedan deploya allt som du kan."), utan separat granskning: undantag från regel 9 på CP:s ord.
⛔ Regeländring (`fil.klar`): reglerna ska ut före klienten. Inget annat är brytande.

### En ny anteckning med tom rubrik får datum och tid (CP 2026-10-18), Grok 2026-10-18
- `anteckningsrubrikNu()` ger "Anteckning 18 okt 00:47" med `formatDagOchKlockslag` (nu också exporterad) i lokal tidszon. Bibliotekets formulär använder den när rubriken på en ny anteckning är tom. En skriven eller dikterad rubrik vinner. Appens röstanteckning (TALK, Anteckning) byter i appen.

### En biblioteksfil vars uppladdning inte blev klar (CP 2026-10-18, ljudposten NewRecord.Song1.ver5 i music-producer-nl3e3o), Grok 2026-10-18
- `laddaUppFil` skriver posten med `fil.klar: false` och sätter `klar: true` (med ny `andrad`) först när byte finns. Avbryts uppladdningen (sidan stängs, mobilen somnar) säger posten själv att filen inte blev klar. Poster utan fältet räknas som klara.
- ⛔ Orsaken, mätt i lifehub-my 2026-10-18 (bara läst): posten skrevs 00:13:33 och filen fanns hel 00:13:35 (7 144 788 byte, rätt sökväg). Listan hämtade adressen under de två sekunderna, fick storage/object-not-found och sparade felet för sökvägen, så felet stod kvar fast filen kom. Nu hämtas inte en fil med `klar: false`, och "finns inte" försöks igen tre gånger (1,5, 3 och 6 s) innan den vänliga texten visas.
- `FILFALT` har `klar`, och regeln kräver att den är sant eller falskt om den finns.
- `filadressFel` gör lagringens fel till en vänlig text. Biblioteket visar "Filen finns inte. Uppladdningen blev troligen inte klar. Ladda upp filen igen." i stället för "Firebase Storage: Object ... does not exist (storage/object-not-found)".

### En gammal inbjudan med rollen agare ger admin (CP 2026-10-17, en ägare per grupp), Grok 2026-10-18
- `accepteraInbjudningar` ger rollen admin när en väntande inbjudan bär rollen agare, både för en ny medlem och för en avslutad som återaktiveras. Man blir ägare bara genom överlämning. Ny export `rollEfterAccept` i `src/node/inbjudan.js`.
- Provet "rollen ur inbjudan följer med" använder nu admin, eftersom agare inte längre följer med.

### Mikrofonen i huvudet är dov i vila (CP 2026-10-18, efter cllp/ops-framework#401 (ringen runt mikrofonen))
- `huvudTalkKlass`: en px ring i `border-line` och ikonen i `ink-muted` i vila. Hover och focus-visible ger `ink`, `bg-raised` och samma övergång som förut. `md:ml-2` ger avstånd till plusset med temats spacing. Samma storlek och ikon som plusset (`p-2.25`, `xl:p-1.75` med en px ring). Vakten i `check-skalyta` väntar nu 6 till 14 px till plusset i stället för 0 till 4.
- Prov för det aktiva läget (Claudes BÖR på cllp/ops-framework#401 (ringen runt mikrofonen)).

## 0.116.0

Kopplingens kontroll i modulens inställningar (cllp/ops-framework#406, för cllp/lifehub.app#337 (bank och Bokio som kopplingar)) och
ringen runt mikrofonen (cllp/ops-framework#401, för cllp/lifehub.app#327 (ringen runt mikrofonen)). Båda granskade och godkända av Claude 2026-10-17.
Inget är brytande: utan `ram.kopplingar.kontroll` är raden som förut.

### Kopplingens kontroll är appens (cllp/lifehub.app#337), Grok 2026-10-17

- `ram.kopplingar.kontroll`: en nod per kopplings-id som ritas där Anslut och Koppla från stod. CP 2026-10-17 om Bank och Bokio: nyckeln kopplas
  i Mitt konto, och i gruppens modul väljer man bara vilken koppling och vilka konton gruppen använder, som när man väljer repo för GitHub. Ingen
  Anslut-knapp i modulen. Noden ritas för alla som ser inställningarna, och appen avgör vad den som inte får ändra ser. Utan nyckeln är raden som förut.

### Ringen runt mikrofonen (paket 3), Grok 2026-10-17

- `huvudTalkKlass`: ringen runt mikrofonen i huvudet är två px i `border-ink-secondary` och ikonen i `text-ink`, i stället för
  avdelarfärgen `border-line` (cllp/lifehub.app#327 (ringen runt mikrofonen)). Geometrin är oförändrad, 44 px och 40 px från `xl`.

## 0.115.0

Finputs på TALK efter 0.114.0 (cllp/lifehub.app#345 och #347) och utskrift av ljud i biblioteket (cllp/lifehub.app#349). CP 2026-10-17, iPhone:
"det går snabbt och fint och texten kommer upp i realtid, även menyerna". Det fungerar, och det här är finputs.

### TALK: ljudvågor när bara igenkänningen kör (#345 a)

- På WebKit kör TALK med valen BARA igenkänningen (0.114.0), och nivåprickarna matades av en inspelare som inte finns: de stod stilla. De drivs nu av
  igenkänningens egna händelser: `onsoundstart` och `onspeechstart` ger en liten puls (det lyssnar), varje resultat med ny text en puls vars
  höjd följer hur mycket text som kom, och `onspeechend` eller en tystnad på `IGENKANNING_AVTA_MS` (400 ms) tar ned den. Samma komponent
  (`TalkPrickar`) som när inspelaren matar, så det ser likadant ut.
- ⛔ **Ingen egen mikrofonström:** striden om mikrofonen var orsaken till #253. Nivån är en uppskattning av "det pratas nu" ur text och händelser, inte en
  mätning av ljudstyrkan (igenkänningen ger text, inte decibel), och pulserna ligger därför efter talet. Ny `skapaIgenkanningsniva` i `lib/talk.js`.
- `Igenkanning.starta` tar en valfri `onLjud(typ)` med `ljud`, `tal` och `tystnad`. Den kopplas bara i en omgång utan inspelare; en omgång med inspelare
  (Chrome, låst mål, "Spela in i stället") är exakt som förut, och en egen igenkänning från appen som inte känner till `onLjud` drivs av texten ensam.
- ⛔ **`prefers-reduced-motion`:** med mindre rörelse flyttar sig inga prickar och ingen ändrar höjd; raden står stilla och blir ljusare när det pratas.
  Det gäller `TalkPrickar` överallt, också när inspelaren matar den (förut ritades höjderna oavsett inställningen).

### TALK: texten rullar med (#345 b)

- Textytan rullar till slutet när ny text kommer. Har personen själv rullat upp stannar den där, och den följer med igen när hen är längst ner
  (8 px tolerans). Det avgörs bara av rullhändelser, aldrig av att texten växer, och varje ny omgång börjar med att följa.

### TALK: Anteckning visar ett kvitto (#345 c)

- ⛔ **Bryter ett beteende, med flit:** när `onAnteckning` löst sig stängdes fältet. Nu visas kvittot "Anteckningen är sparad" som andra kvitton
  (läget `sparat`, med Stäng), tills personen stänger det. Tre prov i `talk-ingen-text.test.jsx` hävdade att fältet stängs och säger nu det motsatta.
- `onAnteckning` får lösa till `{ href?, etikett? }`: kvittot får då en länk ("Öppna anteckningen" när `etikett` saknas), så att appen kan peka på
  biblioteket. Löser det till `undefined`, ett id eller något annat än en länk visas kvittot utan länk. Ny `talkAnteckningsLank` läser svaret.
- En felformad länk (`href` som saknas eller inte är en text, en `etikett` som inte är en text, en adress som börjar med `javascript:`, `data:` eller
  `vbscript:`) rapporteras (steget `anteckning-lank`) och kvittot visas utan länk: anteckningen är redan sparad, så den blir inte osparad av ett fel i svaret.
- Nya `onLank(href, event)` på `OpsInspelning` och `OpsTalk`. Skalet ger sin `onNavigate` dit, så länken navigerar som skalets andra länkar. Fältet stängs efter trycket.
- `useTalk().kvitto` bär `lank` när kvittot har en.

### TALK: Kopiera (#347)

- En liten ikonknapp Kopiera bredvid Stäng i läget hört, när det finns text. `navigator.clipboard.writeText(text)`, sedan "Kopierat" en kort stund
  i fältet. Fältet stängs inte, och inget lämnas till appen. Faller urklippet (inget API, nekat eller ett kast) står felet i fältet, och steget
  `kopiera` går till felrapporten. Ny `useKopiera` i `components/useKopiera.js`, som biblioteket delar. Orden på svenska och engelska i `ORD_TALK`.

### Biblioteket: skriv ut ett ljud (#349)

- Ny `onSkrivUt(post) => Promise<void>` på `OpsBibliotek`: knappen "Skriv ut texten" på en ljudpost som inte har någon utskrift. Medan löftet pågår står
  "Skriver ut…" på posten. Ett fel (också ett dygnstak) står på posten och knappen finns kvar. ⛔ Texten kommer inte i svaret: servern skriver fältet
  `utskrift` på posten, och vyn läser det ur listans post (också när `vald` är en äldre kopia) och visar det under spelaren med radbrytningarna bevarade
  (`white-space: pre-wrap`), så att verser syns.
- Under texten: Kopiera (samma krok som TALK, med "Kopierat") och "Gör en anteckning av texten", som anropar nya `onAnteckningAvUtskrift(post)` och bara
  ritas när den ges. Lyckas den står "Anteckningen är sparad" en stund, faller den står felet på posten. Utan propsen ritas ingen knapp.
- ⛔ **Bryter ett API, med flit:** `onSkrivUt` löste förut till `{ text, forslag }` och vyn höll en egen kopia av texten, med knapparna "Spara som
  anteckning" och "Skapa ärende" (`onGorForslag`). Texten hör nu till posten (en sanning), och `onGorForslag` kastar ett fel som säger det. Två prov i
  `bibliotek-vy.test.jsx` om den gamla utskriften är ersatta av `bibliotek-utskrift.test.jsx`.
- Schemat och valideringen (`utskrift` på ett ljud, tak `MAX_BIBLIOTEKUTSKRIFT`) och `createBibliotekskalla` tillät redan fältet; nytt prov visar att en
  text som servern skrivit läses, behålls av en omdöpning och att en för lång syns som trasig rad. `bibliotekregelfragment` är orörd: den släpper fortfarande
  igenom en klientskrivning av fältet (högst 20 000 tecken, bara på ett ljud), och att nekan den är appens val.

## 0.114.0

Valen står alltid efter talet, Anteckning som val och orsaken mäts (cllp/ops-framework#402), och biblioteket visar en ny post
direkt (cllp/ops-framework#403). CP 2026-10-17. Dessutom `fore` och `online` på `OpsGruppSida`.

### TALK: valen efter talet står också utan text (`talk.tillText`, `talk.onAnteckning`)

- CP, med en skärmbild från iPhone: han pratade in, "Agenten arbetar…" visades, och han hamnade direkt i chatten utan att få välja.
  Rotorsaken, läst i koden: valen ritades bara när taligenkänningen gav text medan personen pratade. Utan text gick ljudet till
  `onTalk`, och appen skickade det vidare till agenten, alltså valde appen åt personen.
- Med `talk.onAgent` går fältet nu till valen även när ingen text hördes, och ljudet lämnas inte till `onTalk`, `onAgent` eller något
  annat val av sig självt. Utan `onAgent` är beteendet som förut.
- Ny valfri `talk.tillText(blob, { mimeType, sekunder }) => Promise<string>`: fältet säger "Skriver ut…" och fyller i texten när den
  svarar. Valen går att trycka under tiden, och ett val som tryckts före texten väntar på den och lämnar den en gång. Faller utskriften
  (eller ger den en tom text) står felet i fältet med valen kvar, och ett tryck på ett val skriver ut igen. Utan `tillText` säger fältet
  att ingen text kom fram.
- Ny valfri `talk.onAnteckning(text) => void | Promise<void>`: ett femte val, Anteckning, före Agent, som ritas bara när propen ges. Fältet
  säger "Sparar…" och stängs när löftet löser sig, och faller det står felet i fältet och valen kvar. Ordtabellen har svenska och
  engelska. Med fem val tar det sista hela raden.
- `useTalk` tar `onAnteckning` och `tillText` och lämnar `anteckning`, `medAnteckning`, `textVantar`, `utskriftFel` och `skrivUt`.
  `OpsInspelning` och `OpsTalk` tar `onAnteckning`, `textVantar`, `utskriftFel` och `onSkrivUt`. `talkNasta` har händelserna
  `anteckning` och `anteckningFel`.
- ⛔ **Bryter ett prov, med flit:** `talk-val.test.jsx` hävdade att ljud utan text med `onAgent` går till `onTalk`. Det är det som
  ändrats, och provet säger nu det motsatta.

### TALK på WebKit: valen kör bara igenkänningen (tar delvis tillbaka #253:s val)

- Sedan 0.110.0 (cllp/lifehub.app#253) gav `webblasarensIgenkanning` `null` på WebKit (`arWebKit`), eftersom SpeechRecognition och
  MediaRecorder slogs om mikrofonen. Följden: iPhone och iPad fick aldrig levande text, och då aldrig de snabba valen. Det är regressionen
  CP märkte.
- ⛔ **Det här tar delvis tillbaka #253:s val för TALK-valen, och skälet är att mikrofonen inte längre delas.** I TALK med valen
  (`talk.onAgent`, inget låst inspelningsmål, `igenkanning: true`) kör en omgång på WebKit nu BARA igenkänningen och startar ingen
  inspelare. Då slåss ingen om mikrofonen, texten växer fram, och valen kommer direkt vid Klar. #253:s val står kvar överallt där ljudet
  behövs.
- Faller igenkänningen (`onerror` med `not-allowed`, `service-not-allowed`, `aborted`, `audio-capture` eller omstartsslinga) eller blir
  texten tom: fältet säger det och visar knappen **Spela in i stället**. Den kör inspelningen utan igenkänning (dagens WebKit-väg) och
  sedan `tillText`. Felet rapporteras med steget `ingen-text` och felkoden (`igenkanningFelkod`), som tidigare, nu med
  `baraIgenkanning: true`. Ingen inspelning har gjorts i det läget, så inget ljud går förlorat.
- **Oförändrat:** ett låst inspelningsmål (Biblioteket, Röstinspelning) och appar utan `onAgent` behåller dagens WebKit-beteende, bara
  inspelning, för där behövs ljudet. Utanför WebKit (Chrome) körs igenkänning och inspelning samtidigt som förut.
- `webblasarensIgenkanning({ tillatWebKit: true })` ger igenkänningen också på WebKit. Förvalet är fortfarande `null` där. `useTalk`
  ber om den bara för en omgång utan inspelare. `useTalk().direkt({ laast: true })` startar en omgång låst till ett mål (skalets
  Röstinspelning gör det: målet och starten sker i samma händelse, före nästa rendering, så `onAgent` kan inte läsas ur propsen).
  `useTalk` lämnar `kanSpelaIStallet` och `spelaIStallet`; `OpsInspelning` och `OpsTalk` tar `kanSpelaIStallet` och `onSpelaIStallet`.
- På WebKit finns ingen inspelare som matar nivåprickarna i en sådan omgång, så de står stilla. Texten är det som visar att det lyssnas.

### TALK: ljud utan text mäts (`rapporteraFel`, steget `ingen-text`)

- Varför telefonens text uteblev var inte mätt, och felrapporten skickades bara när varken ljud eller text fanns. Nu går ljud utan text
  till felrapporten med `igenkanning`, `utanIgenkanning` (`avstangd`, `webkit` eller `saknas`), `igenkanningStartade`,
  `igenkanningStartHandelse`, `igenkanningFelkod` (den senaste felkoden, också `no-speech` och `aborted`), `omgang`, `standalone`,
  `userAgent`, `sekunder`, `bytes`, `medVal` och `medUtskrift`. Ingen text från personen.
- `Igenkanning.diagnos()` (valfri) ger `{ startade, startHandelse, felkod }` för omgången. Webbläsarens igenkänning nollar den vid varje
  start. Ny `talkMiljo()` läser `standalone` och `userAgent`.
- Felkoden vid ett kast i `start()` är nu kastets namn också när det inte är en `Error` i den här världen (`DOMException`).
- Safari på iOS har ingen igenkänning här (`arWebKit`), så på en iPhone är `igenkanning` `false` med `utanIgenkanning: "webkit"`.

### Gruppsidan: `fore` och `online` (`OpsGruppSida`, från granskningen av lifehub.app PR 341)

- Ny valfri `fore` (ReactNode): ritas efter snabbvalen och före medlemslistan, så att appen kan visa gruppens läge överst. `children` ligger
  kvar under som förut.
- Ny valfri `online` (`ReadonlySet<string>` av userId): en grön prick på medlemmens avatar med `aria-label` "<namn> online"
  (`etiketter.online` byter ordet), och sorteringen online först, sedan ägare, admin, medlem, sedan namn. Utan propen är ordningen och
  utseendet som förut. En mängd som inte har `has()` kastar.

### Biblioteket: en ny post syns direkt (`prenumerera`, `OpsBibliotek kalla`)

- CP: efter en röstinspelning syntes inspelningen inte förrän han laddat om. Rotorsaken: `createBibliotekskalla` hade bara `las()`, en
  engångsläsning, och listan prenumererade inte. Det gäller allt som skrivs utanför listans egen vy.
- `createBibliotekskalla` får `prenumerera(lyssnare, onFel)` när datakällan har `subscribe` (frivillig, `contract.js`). Samma svar och
  samma kontroll per rad som `las()`. Ett fel går till `onFel` och försvinner aldrig tyst. Saknas `subscribe` (eller svarar en routande
  källa nej på `canSubscribe`) finns metoden inte, och `las()` gäller som förut. Ingen polling.
- `OpsBibliotek` tar en ny valfri `kalla`. Med den läser vyn själv: `kalla.prenumerera` när den finns, annars `kalla.las()` en gång.
  `poster`, `fel`, `trasiga` och `laddar` ges då inte (vyn kastar annars). Utan `kalla` är vyn som förut.

## 0.113.0

Översikten får hemgruppens bottenrad (cllp/lifehub.app#319), Grok 2026-10-16. CP-beslut 11:14: "Översikten har samma bottenrad
som en grupp, och den hanteras som Mitt projekt."

### `grupper.oversikt.hemgrupp`

- Ny valfri `hemgrupp` (ett id i `grupper.lista`). Given: översikten ritar bottenraden som i en grupp, och `main` får bottenradens
  marginal igen. Ett tryck i bottenraden anropar `grupper.onValj(hemgrupp)` före `onNavigate`, om hemgruppen inte redan är aktiv, så Idag, Kalender och de andra
  öppnas i hemgruppen.
- Utan `hemgrupp`, eller med ett id som inte finns i listan, är översikten som i 0.112.0: ingen bottenrad.
- Huvudet är oförändrat i översikten: hemikonen till vänster, profilen till höger.
- Prov: tre nya i `src/__tests__/oversikt.test.jsx`. Trycket som väljer hemgruppen är rött utan ändringen; kontrollen (utan
  hemgrupp ingen bottenrad) är grön i båda.

## 0.112.0

Översikten som ett läge i skalet (cllp/lifehub.app#319), Grok 2026-10-16. CP 09:55 "Kör på detta", specen i
cllp/lifehub.app#319 (kommentaren med Claudes plan).

### Läget `ingenGrupp` går att välja (`grupper.oversikt`)

- `OpsAppShell` tar `grupper.oversikt: { aktiv, onValj, etikett? }`. Med `aktiv` står skalet i översikten: ingen grupp är aktiv
  (inte heller gruppnamnet under märket), och det som hör till en grupp ritas inte: flikarna, plusset, mikrofonen, `actions`,
  gruppanelen och bottenraden. Kvar är växlaren med hemikonen till vänster på alla bredder och profilen (`anvandare`) till höger.
  På dator finns hamburgaren kvar.
- `OpsGruppvaxlare` tar `oversikt`. Raden **Översikt** står överst med hemikon (`HusIkon`), och att välja den anropar
  `oversikt.onValj`, så att appen går ur gruppen. I översikten är knappen hemikonen och ingen grupprad är vald.
- Ny ordtabell `ORD_OPSOVERSIKT` (sv "Översikt", en "Overview"), exporterad.
- Utan `oversikt` är skalet och växlaren oförändrade.
- Prov: `src/__tests__/oversikt.test.jsx` (fem prov, fyra röda utan ändringen, kontrollen grön i båda).

## 0.111.0

Bygger på 0.110.0 (PR 396) och ges ut efter den.

### Spelaren kommer ihåg hastigheten på enheten (#375)

- `OpsLjudspelare` och skalets spelare börjar på den hastighet som senast valdes **på den här enheten** (`localStorage`,
  nyckeln `ops.spelare.hastighet`). Den följer inte personen mellan enheter. Ett okänt eller trasigt värde ger 1×.
- Provat på komponentnivå: båda spelarna visar den sparade hastigheten och sparar nästa steg vid tryck.

### Bläddra mellan trådens bilder (#369)

- `BilagaVisning` tar `galleri` och `galleriPlats`. Med fler än en bild finns föregående och nästa (lucide `ChevronLeft`,
  `ChevronRight`), "N av M", och piltangenterna fungerar var fokus än står i dialogen (lyssnaren sitter på dokumentet medan
  dialogen är öppen).
- Platsen anges av anroparen, så samma bild två gånger öppnas på sin egen plats. Bara kommentarstråden skickar `galleri` i dag.
## 0.110.0

Talvägen P1 (#253, #394), Grok 2026-10-15. Lagt på P3-paketets PR per CP (många ärenden per PR). Talvägen tas över av Grok (Claudes överlämning på lifehub.app#135, CP 21:34).

- **WebKit kör bara inspelning, ingen taligenkänning samtidigt (#253).** CP:s iPad föll med "aborted" i andra omgången (produktionens felkanal, Safari 26.6.1). Hypotesen är att WebKit bara ger mikrofonen till en sak i taget, så `SpeechRecognition` och `MediaRecorder` slogs om den. `arWebKit(userAgent)` känner igen Safari och alla iOS-webbläsare (AppleWebKit utan Chrome/Chromium/Edg; `jsdom` räknas inte), och `webblasarensIgenkanning` ger `null` där, så bara inspelningen körs och texten tolkas på servern. Chrome behåller den levande texten. Verifieras på CP:s iPad efter deploy.
- **300 ms paus mellan omstarterna, och ett ärligt fel vid en loop (#253).** Igenkänningen startar om sig själv när webbläsaren tar en paus; omstarten väntar nu `OMSTART_PAUS_MS` (300 ms) så att WebKit hinner släppa mikrofonen. En omstart räknas som snabb när igenkännaren levde kortare än `OMSTART_SNABB_MS` (1 s); den fjärde snabba i rad (efter tre omstarter) ger felet `omstartsslinga` i fältet (`onFel`) och en rapport, i stället för en tyst död. En lång omgång nollar räknaren (provad). Ett stopp under pausen behåller den hörda texten. Prov: falska igenkännare med inskjuten tidtagare, röda utan ändringen.
- **TALK-knappen i webben lika stor som plusset, med ram och bakgrund (#394).** CP 2026-10-15: "mikrofonen i webben borde bli lika stor som plusset." `huvudTalkKlass` ger TALK samma geometri som `huvudPlusKlass` (`size-11`, `xl:size-10`, 24 px ikon, padding 9/7 px så att kanten ryms) och en platta med kant, så tyngden är plussets utan att skrika som en andra accentcirkel. Den tänds i accent medan den lyssnar. Prov i `talk.test.jsx`, och på riktigt i `check-skalyta` avsnitt 43.
- **Tal i textfält på Safari och iOS faller tillbaka på inspelning (#264, CP 2026-10-16 07:07).** WebKit saknar pålitlig taligenkänning i webbläsaren, så ett fält med förvalt tal spelar där in och lämnar ljudet till appens utskrift, och texten skrivs in i fältet. Appen ger utskriften med den nya `OpsTranskriberingProvider` (`onTranscribe: (blob) => Promise<string>`). Utan provider och utan igenkänning har fältet ingen mikrofon, som förut. Gäller tills en egen app finns. Prov: iPhone-UA ger mikrofon med provider och ingen utan; `check-skalyta` 47 (8) mäter mikrofonen vid 390 px som iPhone.

---

## 0.109.0

Paket P3 (ramverket: vakter, prov och små UI-fixar), Grok 2026-10-15. CP-regel: många ärenden per PR.

- **`createCaseModel` på nodsidan (#279).** `ops-framework/node` exporterar samma `createCaseModel` som huvudingången, så att en server bygger inkorgsrader med formulärets `buildEntry` utan React och utan spegel. `src/lib/caseModel.js` importerar ingenting. Prov: `nod-casemodel.test.js` (rött före).
- **Regeln läser filen en gång (#312 punkt 1).** `opsMarketHarFil` läser filen med `let` i stället för `existsAfter` och två `getAfter`. `opsArAktivTyp` lämnas: den står i samtalens grundtext, som proven låser byte för byte mot 0.67.0, och en ändring där är ett eget beslut. Regelproven 556 av 556 gröna, också mutationerna i `chattbilagor.test.mjs`. Reglerna deployas före klienten som vanligt.
- **README om föräldralösa filer (#312 punkt 3):** `av` blir den som tog över filen; risken är teoretisk och står nu i README.
- **"musik" ger music först (#269 punkt 2).** Synonymlistans första ord väger tyngre (0,9) än de följande (0,85). Rött före: audio-lines först.
- **Taggförslagen med tangentbordet (#372, andra halvan).** Pil upp och ned markerar ett förslag, Enter väljer det, och fokus stannar i fältet med `aria-activedescendant` och `aria-controls`. Rött före.
- **Ratten är matt (#371).** Plan yta i stället för gradient, och skenet runt nålen är borttaget, i både ljust och mörkt tema.

- **Pilarna i Plats och Taggar (#372, första halvan).** `menyPilar` ger pil upp och ned, Home och End i båda menyerna, och slår runt. Ingen ny Radix-del: Popover, bocken och "Rensa alla" står kvar. Prov: `bibliotek-menypilar.test.jsx`.
- **Trådarnas count (#272).** Emulatorprov i `tradar.test.mjs`: aggregatfrågan går igenom för en medlem och nekas för främling, borttagen och utloggad. `antalSvar` faller tillbaka på listan med taket `sida` bara när felet är `unavailable` (offline); `permission-denied` och `failed-precondition` kastas vidare (`arNatfel`). Rött före.
- **Rullningsvakten i 22b (#269 punkt 1).** Stod ikonväljaren under fönstrets halva måste behållaren ha rullat, och märket ha flyttats, minst 48 px (`RULL_MIN`). Vakten blir inte längre grön av att sidan ovanför krymper.
- **handelsepanel.test.jsx (#269 punkt 3), delvis.** Det tyngsta provet startar i kalendern i stället för att rita översikten och klicka sig dit. Mätt ensamt: 817 till 717 ms. Roten är att provet ritar hela appen, och det står kvar; gränsen är inte höjd.
- **Ikonväljaren i katalogerna (#367).** Med `ikonRitare` väljs ikonen i ett sökbart rutnät där ikonen syns, fortfarande bara ur tillåtelselistan. Utan `ikonRitare` står rullgardinen kvar. Texterna är bara svenska än så länge.

Kvar ur P3, med skäl: #370 (fälla in tema, sök, AI och helskärm bakom en knapp i toppraden) ändrar skalets topprad och skalytevakterna, och behöver CP:s bild av knappen. #40 (nodsidans beroenden) är ett val mellan vägar som ändrar installationen för varje app. #7 (vakten mot appinnehåll) ska kalibreras mot repot innan den kopplas in. #368 är flyttad till Claude.

---

## 0.108.0

### GitHub-etiketten på gruppkalendern (cllp/lifehub.app#259, steg 3, beslut 1)

CP har sagt KÖR på beslut 1: en gruppkalender får ett fält `githubEtikett`, ett etikettnamn på GitHub som är unikt inom gruppen och jämförs
utan skiftläge. Appen (lifehub.app PR 293) har redan byggt ritningen av ärenden med `due:` i kalendern och mätte att fältet inte gick att
lägga till därifrån, av tre skäl: `byggGruppkalender` kastade på okända fält, regelfragmentet hade en stängd `hasOnly`-lista som appens
`check-regelfragment` mäter byte för byte, och `OpsKalendrar` hade ingen plats för fältet.

- **Fältet.** `byggGruppkalender` tar `githubEtikett` som ett valfritt fält: utelämnat, eller en trimmad sträng på 1 till 50 tecken
  (`MAX_GITHUBETIKETT`, GitHubs gräns). En tom sträng eller bara blanksteg betyder att fältet tas bort och lagras inte (nyckeln saknas på
  raden, aldrig `""` och aldrig `null`). `null` och allt som inte är en sträng kastar, eftersom regeln hade nekat det. `KALENDERFALT` har
  fått fältet, så `hasOnly` och byggaren läser samma lista. Mina kalendrar har det inte, och `byggMinKalender` avvisar det.
- **Jämförelsenyckeln, en sanning (regel 2).** `githubEtikettNyckel(etikett)` är trim och gemener, och `""` för allt som inte är en etikett.
  Appen använder den för att koppla ett ärendes etiketter till en kalender och skriver ingen egen jämförelse. Exporteras ur `src/index.js`.
- **Unikhet inom gruppen, utan skiftläge.** `kontrolleraGithubEtiketter(lista, { rader, sprak })` kastar en hel mening på svenska eller
  engelska ("GitHub-etiketten ... används av både ... och ...") med `kod`, `etikett` och `kalendrar` på felet. Den körs där en kalender
  skapas eller redigeras: `createKalenderkalla().sparaGruppens(groupId, rader, { sprak })` (som bara läser gruppen när en rad som skrivs
  bär en etikett och inte är arkiverad) och `OpsKalendrar`. En arkiverad kalender håller inte kvar sin etikett, men tas den fram går den
  genom samma kontroll. En dubblett som redan finns hindrar inte en ändring av en tredje kalender; den fångas när någon av de två rörs.
- **⛔ Ett fönster som står utskrivet.** Kontrollen är läs-sedan-skriv. Regel 2 vill ha en riktig constraint, men Firestore har bara
  dokumentnyckeln och en regel kan inte se en annan rad, och en nyckel härledd ur etiketten vore den spegel regeln förbjuder. Två admins
  som sparar samma etikett i samma sekund kan alltså ge två kalendrar med samma etikett. Därför kastar `validateGruppkalendrar` INTE på
  en dubblett (ett kast där hade gjort hela gruppens kalenderlista oläsbar vid varje uppstart): dubbletten ska synas, och felet kommer
  nästa gång någon av de två rörs. Vilken av två som äger etiketten avgörs av `kalenderForEtikett` (se nedan), inte av appen.
- **`kalenderForEtikett(kalendrar, etikett)` (granskningen av PR 395, BÖR 1).** Kalendern som äger en etikett: den första icke-arkiverade
  vars `githubEtikett` matchar enligt `githubEtikettNyckel`, och vid en dubblett den som står först i `ordning`, sedan `id`. Tom etikett
  eller ingen träff ger `null`; listan ändras inte. Sorteringen är `efterOrdning`, flyttad ur `kalenderkalla.js` (där den stod två gånger)
  till `kalendrar.js`, så att källans `gruppens()` och vinnaren ur en dubblett följer samma jämförelse och "första i ordningen" inte är
  en konvention som två appar kan tolka olika (regel 2). Exporteras ur `src/index.js`.
- **Språket följer med (granskningen, KAN).** `OpsKalendrar` anropar `onSparaGruppens(rader, sprak)` och `onSparaMina(rader, sprak)`, så att
  en app som sparar genom källan kan skicka vyns språk vidare (`sparaGruppens(groupId, rader, { sprak })`) och få ett eventuellt
  etikettfel på samma språk som vyn. `sparaGruppens` tål nu `null` som tredje argument. Ett befintligt `(rader) => ...` fungerar som förut.
- **Reglerna (kalenderregelfragment).** `githubEtikett` står i `hasOnly` för `gruppkalendrar`, med villkoret att fältet saknas eller är en
  sträng vars `size()` är 1 till 50. Generatorn för gruppade samlingar fick ett internt `villkor` (efter fältlistan, för både `create` och
  `update`); övriga samlingar får exakt samma text som förut (`check-regelgenerator`). ⛔ **Appen måste deploya reglerna FÖRE klienten som
  skriver fältet.** En regel i main är inte en regel i produktion: en klient som skriver `githubEtikett` mot de gamla reglerna nekas på
  `hasOnly`. `check-regelfragment` i appen blir röd tills dess fil regenererats, vilket är avsikten.
- **⛔ Längden är mätt mot emulatorn och inte antagen.** Regelns `size()` räknar UTF-16-enheter: 50 `å` släpps in och 51 nekas, men en emoji
  är två enheter (25 släpps in, 26 nekas). Klienten räknar därför med `.length`, så att den aldrig är mildare än regeln. En etikett av
  emojier får i praktiken 25 tecken, vilket är strängare än GitHubs 50 och alltså på den säkra sidan.
- **Vyn.** Gruppens redigerare i `OpsKalendrar` har en ruta "GitHub-etikett" (en: "GitHub label"), högst 50 tecken, utan tal-ingång, med
  hjälptexten "Ärenden med den här etiketten och ett datum (due:ÅÅÅÅ-MM-DD) visas i kalendern." (en: "Issues with this label and a date
  (due:YYYY-MM-DD) are shown in the calendar."). Texterna ligger i den nya ordboken `ORD_OPSKALENDRAR` (exporterad) och väljs på vyns
  språk. Personliga kalendrar har inte rutan. En upptagen etikett sparas inte och felet står i redigeraren (eller ovanför listan när det
  kom av "Ta fram"). Resten av vyns texter är fortfarande svenska och flyttas till ordboken när de rörs.
- **För appen.** Redigeraren i gruppens sektion har nu två textrutor, så ett prov som gör `getByRole("textbox")` där träffar flera:
  välj på namnet ("Namn" / "GitHub-etikett").
- **Prov.** Datamodellen och källan i `kalendrar.test.jsx` och `kalenderhantering.test.jsx`; reglerna i `rules/__tests__/kalendrar.test.mjs`
  mot Firestore-emulatorn (giltig etikett, 50 och 51, tom, tal, null, lista, bool, medlem nekas, lägga till, byta och ta bort på en
  befintlig rad, å och emoji). Rött utan fixen och grönt med den står i PR-texten.

---

## 0.107.1

Prov och en kommentar, ingen ändrad funktion. Från överlämningen till Grok 2026-10-15 14:45.

- **KAN 1 efter PR 392: registreringen av kända ämnen i `lista` har ett prov.** `chatt-nytt-amne-regler.test.jsx` räknar
  skapelserna av samtal: ett ämne som setts i `lista` (en ny källa, som efter en omladdning) skapas inte igen när man skickar i det.
  Rött när raden i `lista` tas bort, grönt med den.
- **KAN 2 efter PR 392: felraden nollas vid nästa Skicka, med prov.** Ett nekat skick ger "Meddelandet kunde inte skickas", och nästa
  Skicka som går fram tar bort raden. Rött utan `setSkickaFel(null)` i `skicka`, grönt med den.
- **#385, chattens texter på båda språken:** mätt att det redan är levererat i 0.106.0 (`ORD_MEDDELANDEN`, provet `chatt-sprak.test.jsx`).
  Den inaktuella kommentaren vid `ORD_MEDDELANDEN_TAL` som sa att resten bara fanns på svenska är rättad.
- **#391 lämnas:** texten kastas i `oppnaInspelning` (röstinspelningen) och fångas som larm av anroparen. En mening för användaren
  kräver att anroparen skiljer fallet från ett utvecklarfel, så det är inte ett rent textbyte, och det ligger på talvägen, som väntar
  på CP:s beslut.

---

## 0.107.0

### ⛔ P0: ett Nytt samtal med agenten gick inte att skicka (produktion, appen på 0.106.0)

CP 2026-10-15 i telefonen och på datorn: i ett Nytt samtal med agenten stod texten kvar efter Skicka, och under trådens huvud syntes
i Safari på Mac en röd ram utan text, på Windows "Meddelandena kunde inte hämtas. Missing or insufficient permissions." TALK:s Agent
(`oppnaAmne`) gick samma väg och föll likadant.

- **Roten, mätt mot Firestore-emulatorn med de genererade reglerna och Firestore-källan** (`rules/__tests__/amnen-kalla.test.mjs`):
  `skickaIAmne` läste samtalsdokumentet (`kalla.read`) för ett ämne som inte fanns. Läsregeln är `opsFarLasaSamtal(resource.data)`,
  och för ett dokument som inte finns är `resource` null, så läsningen nekades ("Null value error" i regeln) och varken ämnet eller
  meddelandet skrevs. Före rättelsen 2 av 4 röda (Nytt samtal och `oppnaAmne`), med den 4 av 4 gröna. Mätbygget och komponentproven
  kör minneskällan, som inte har regler, och därför såg inget prov det.
- **Rättat i klienten: samtalet läses aldrig.** Ett okänt ämne går samma väg som `oppnaPrivat`: skapa, och nekas skapelsen, hämta ur
  listan. Ett ämne som setts i en listning är känt, så ett befintligt ämne skrivs aldrig om med `setDoc`.
- **Läsregeln ändras inte, och det är ett val.** Den hade kunnat tåla ett dokument som inte finns (`resource == null` med personens uid i
  nyckeln), men då hade rättelsen krävt en regeldeploy före klienten, och en läsning som bara svarar "finns inte" behövs inte när
  skapelsen själv avgör det. En klienträttelse når produktion med ompinningen ensam.
- **Lyssnaren på meddelanden:** mätt i ett komponentprov med en källa som har reglernas krav (`chatt-nytt-amne-regler.test.jsx`):
  ett Nytt samtal som öppnas gör ingen nekad läsning och ingen prenumeration förrän första Skicka skapat ämnet (det var redan så i
  0.106.0, `OpsSamtal` med `ny`), och efter skapelsen startar prenumerationen och meddelandet syns. Rubriken CP såg på Windows,
  "Meddelandena kunde inte hämtas", stod över det nekade skicket, inte över en läsning.
- **Felraden står ovanför loggen, med egen rubrik för ett nekat skick** ("Meddelandet kunde inte skickas", `skickaFel`). Förut stod
  felet först i den rullande loggen, och i ett nytt ämne fyller den tomma vyn (`h-full`) loggen under det, så loggen blev högre än
  sin ruta och följde slutet: felet rullades ur sikte. Att det låg i loggen är mätt i koden; att det är det som syntes i WebKit är
  hypotes, eftersom provmiljön saknar WebKit (`playwright install webkit` når inte nätet här).

**TALK: felkanalen når komponenterna, och förra omgången är släppt innan nästa öppnar mikrofonen (cllp/lifehub.app#253).**

CP 2026-10-15 07:25 på iPhone, appen på ramverket 0.104.0: efter agentens svar gick det inte att spela in igen, och fältet sade
`TALK_INGET_LJUD` ("Mikrofonen gav inget ljud, och inget hördes som text"). CP: "Det är som att mikrofonen låser sig." Både ljudet
och taligenkänningens text var tomma, och diagnosen som skulle ha sagt varför nådde aldrig appen.

**Vad som är mätt och vad som är hypotes.** Mätt i koden, med prov som är röda utan rättelsen: att diagnosen inte nådde appens
mottagare, och fyra sätt koden kunde lämna något från förra omgången öppet (nedan). **Hypotes, inte mätt på en iPhone:** att WebKit
på iOS håller telefonens ljudpass medan en taligenkännare inte sagt `end`, eller medan en `AudioContext` inte stängts, och att nästa
`getUserMedia` då ger ett tyst spår. Väntan nedan tar bort de möjligheterna. **Antaget, inte mätt (KAN 1):** att väntan inte bryter
mot iOS krav på en användargest. I den vanliga vägen anropas `getUserMedia` fortfarande synkront i trycket; bara när förra
igenkännaren inte sagt `end` eller förra ljudkontexten inte stängts kommer det upp till 1 s plus 1 s senare. WebKit kräver enligt
granskarens bedömning ingen gest för `getUserMedia` själv, och `AudioContext` och `SpeechRecognition.start()` startade redan efter
mikrofonen förut. Faller `getUserMedia` av det skälet syns det som ett fel i fältet och i rapporten. ⛔ **Det rättar inte säkert CP:s fall:** i hans väg (Klar,
valen, Agent) hade förra igenkännaren redan sagt `end` när det sagda kom fram, eftersom texten annars hade varit tom
(`webblasarensIgenkanning().stoppa`). Vad som faktiskt hände avgörs av diagnosen, som nu kan nå appen. Texten i fältet när det ändå
blir tomt är oförändrad, `TALK_INGET_LJUD`.

### Tillagt: en förvald felmottagare

- `registreraFelmottagare(felmottagare)` gör mottagaren förvald: varje `rapporteraFel(fel, sammanhang)` utan eget tredje argument
  når den. **Det gäller alla komponenters rapporter, inte bara TALK:s diagnos** (granskningen av PR 392, KAN 5): också `OpsCalendar`
  (dolda lager och appar, veckonummer), `OpsMeddelanden` (`sid`, `mid` och valideringstexten för ett förslag som hoppades över),
  `useSamtal` (`groupId`, `sid`), `OpsForslag`, skalets adressläsning och taligenkänningens fel. Granskaren hittade inga
  personuppgifter i dem. Returnerar en funktion som tar bort just den registreringen, och den senast registrerade gäller.
  Kastar när mottagaren saknar `fanga` eller `satt` (KAN 3): utan `fanga` hade varje fel tappats tyst, och utan `satt` kastar
  inloggningen vid varje byte.
- **En mottagare som rapporterar sina egna fel går inte i rekursion** (BÖR 1). Medan en mottagare hanterar ett fel går ett nytt fel
  till samma mottagare bara till konsolen, med en rad som säger det. "Hanterar" är medan `fanga` körs och, om den returnerar ett
  löfte, tills löftet avgjorts. ⛔ **En mottagare som skriver asynkront ska returnera sitt löfte**, till exempel
  `fanga(fel) { return addDoc(...).catch((e) => rapporteraFel(e)) }`; en som inte gör det skyddas inte. Utan skyddet mätte granskaren
  3 809 anrop av `fanga` för ett fel, och en nekad skrivning vars fel mottagaren rapporterar loopar utan slut. ⛔ **Hållet har ett tak**,
  `FELMOTTAGARE_HALL_MS` (5 s, granskningen av PR 392 varv 2, MÅSTE 1): ett löfte som aldrig avgörs, det vanliga för `addDoc` utan
  nät, hade annars låst mottagaren för resten av sidans liv. Ett avvisat löfte släpper direkt, och ett thenable vars `then` kastar
  låser inte. Priset: ett annat fel som kommer just medan en skrivning pågår går bara till konsolen, och **räknas** (varv 2, BÖR):
  nästa fel som når mottagaren bär antalet som `tappade` i sammanhanget, så att ett bortfall går att skilja från inget fel.
  ⛔ **Gränsen, som den är** (varv 3, BÖR 1): hållet bryter en loop bara när mottagarens eget fel kommer inom `FELMOTTAGARE_HALL_MS`.
  En skrivning som faller långsammare gav 111 leveranser på 11 minuter. Därför har varje mottagare också ett **tak på takten**: en
  skur på `FELMOTTAGARE_SKUR` (10) leveranser, och sedan en per `FELMOTTAGARE_PAFYLLNING_MS` (en minut). Det bryter inte en loop men
  begränsar varje form av den, och det som inte går fram räknas i `tappade`.
- `OpsAuthProvider` och `OpsAppShell` med `felmottagare` registrerar den själva medan de är monterade. **En app ger alltså
  `felmottagare` till `OpsAuthProvider` en gång**, formen `{ fanga, satt }`, och behöver inget annat. Ramverket känner fortfarande inget
  konto och inget samlingsnamn. ⛔ Ändrat beteende: en `felmottagare` utan `fanga` eller `satt` på någon av dem kastar nu när den
  monteras, i stället för att tyst ignoreras.
- ⛔ Lämnat (KAN 2): ger en app två OLIKA mottagare, en till `OpsAuthProvider` och en till `OpsAppShell` inuti den, gäller
  inloggningens för `rapporteraFel` utan tredje argument, eftersom barnets effekt körs först och föräldern registrerar sist.
  Felgränsen ger fortfarande skalets. Ingen konsument ger två olika i dag (granskaren läste lifehub.app och bolag-ops), och att
  ändra ordningen hade krävt en prioritet mellan komponenterna för ett fall som inte finns. Ge samma mottagare till båda, eller bara
  till `OpsAuthProvider`.

### Rättat: förra omgången är släppt innan nästa öppnar mikrofonen

- **Förra igenkännaren har sagt `end` innan nästa omgång öppnar mikrofonen.** `webblasarensIgenkanning().slapp()` gör `abort()` och
  väntar på `end`, högst `IGENKANNING_SLAPP_MS` (1 s), så att en `end` som aldrig kommer inte hänger fältet. `useTalk` väntar på den
  före `getUserMedia`, och nästa igenkännare startar först när mikrofonen är öppen. Finns inget att vänta på öppnas mikrofonen i
  samma tryck som förut. Förut gjorde `kasta()` och ett `stoppa()` vars väntetid gått ut `abort()` utan att vänta.
- **Förra omgångens `AudioContext` är stängd innan nästa öppnar mikrofonen**, högst `LJUDKONTEXT_VANTA_MS` (1 s). Förut anropades
  `close()` utan att någon väntade på den. En `close()` som inte löst sig inom taket väntas inte på igen i nästa omgång (KAN 4).
- **`stoppa` hänger inte på en inspelare som redan stannat.** När ett spår tar slut stannar `MediaRecorder` av sig själv, och `stop()`
  på en inspelare som inte spelar in ger inget `stop`-event. Förut väntade `stoppa` då för evigt: fältet stod på Sparar och
  mikrofonspärren (`mikrofonenUpptagenAv`) släpptes aldrig, så ingen annan del av sidan kunde spela in. Nu svarar den direkt, och
  väntar annars högst `STOPP_VANTA_MS` (2 s). ⛔ När taket går ut nollas också `ondataavailable` (MÅSTE 1), liksom i `kasta()`: annars
  hamnade en bit som kom efter taket först i nästa omgångs ljud (granskaren mätte 8 byte i stället för 2). Genvägen tas bara när
  stop-eventet faktiskt kommit (varv 2, KAN 1): enligt specifikationen blir inspelaren `inactive` innan sista biten och `stop` kommer
  i en köad uppgift, och genvägen tappade då sista biten.
- **En start som faller efter att mikrofonen öppnats stänger den** (`new MediaRecorder` eller `start()` kastar). Förut stod strömmen
  kvar tills någon utifrån anropade `kasta()`.
- **En mikrofon som öppnas efter `kasta()` spelar inte in.** `kasta()` räknar upp försöket, så att en ström som kommer efteråt stängs
  i stället för att kopplas in.
- Igenkännaren stängs när `useTalk` avmonteras i varje läge, inte bara medan det spelas in.
- Varje omgång skapade redan en ny `SpeechRecognition` (`webblasarensIgenkanning().starta`); det är kontrollerat och oförändrat.

### Tillagt: diagnosen säger vad som hände

Blir en inspelning tom (`steg: "tomt-ljud"`) bär rapporten också `omgang` (omgångens nummer i kroken), `forraIgenkanningHann` och
`forraIgenkanningMs` (om förra igenkännaren hann säga `end`, och hur långt efter `stop()` eller `abort()`; `null` när ingen fanns),
`sparVidStart` och `sparVidStopp` (varje spårs `readyState`, `muted` och `enabled`), `ljudkontextVidStart` och `ljudkontextVidStopp`
(`AudioContext.state`, eller `"ingen"`), `forraLjudkontext` (om förra `close()` hann, och på hur många ms), `stannadeSjalv` och
`stoppetHann`. Inga personuppgifter och ingen text som personen sagt. `sparLage(strom)` i `lib/talk.js` läser spåren.

### Prov

`src/__tests__/talk-mikrofonlas.test.jsx`, 8 prov, med en falsk telefon som följer hypotesens regel (ett tyst spår och en döv
igenkännare medan en igenkännare inte sagt `end`). Varje rättelse togs bort en i taget och provet sågs rött: utan registreringen i
`OpsAuthProvider` 2 röda (diagnosen nådde inte mottagaren), utan den i `OpsAppShell` 1, utan väntan på igenkännaren 2 (omgång 2 gav
`TALK_INGET_LJUD`), utan genvägen och taket i `stoppa` 1 (löftet löstes aldrig), utan släppet vid en fallande start 1, utan
uppräkningen i `kasta` 1, utan väntan på ljudkontexten 1. Alla 8 gröna med rättelserna. `talk-tomt-ljud.test.jsx` förväntar sig
diagnosens nya fält.

Granskningen av PR 392 fann tre rättelser som aldrig setts falla: det PR:en kallade "genvägen och taket i `stoppa`" var bara
genvägen, och taket på väntan efter ljudkontexten och stängningen vid avmontering var gröna utan sig. Nya prov, en commit per fynd,
alla röda utan sin rättelse och gröna med den: taket i `stoppa` (2 röda utan taket, 1 utan nollningen i `avsluta`, 1 utan den i
`kasta`), skyddet mot rekursion i `felrapport.test.jsx` (2 röda utan skyddet, 1 utan den asynkrona delen), taket på
ljudkontexten (1), stängningen vid avmontering i lägena skickar och hört (2), kontrollen av `satt` (1) och en `close()` som
väntas på en gång (1). Varv 2: hållets tak (1 röd utan taket), avvisningsgrenen (1), ett kastande thenable (1), räknaren för
tappade fel (1) och genvägen i `stoppa` med sista biten i kö (1). Varv 3: takten (2 röda utan den), identitetskontrollen som hindrar
ett tidigare håll från att släppa ett senare (1) och nollningen av `stoppSett` i varje `starta` (1). `talk-mikrofonlas.test.jsx` har
nu 17 prov.

### Också i 0.107.0: två KAN-punkter ur granskningen av PR 387 (#389)

**Två KAN-punkter ur granskningen av PR 387: felet i läget hört har ett prov, och skalytans fokusfel är en rad och inte 5,8 MB.**
[#389](https://github.com/cllp/ops-framework/issues/389). Ingen ändring i ramverkets beteende, bara prov och ett mätmeddelande.

#### Provat

- `talkNasta` i läget `hort`: raden `return bli("hort", null, nu.fel)` behövs och har nu ett prov. Felet från `agentFel` läses av
  `OpsTalk` (`valFel`) och ska stå kvar när personen trycker Klar, Skicka, Dölj eller får ett tak, upp eller igen medan hen läser det.
  Muteras raden till `bli("hort")` blir `talk-val.test.jsx` rött (`fel: "Nej"` saknas). Förut var alla prov gröna med mutationen.

#### Rättat

- `scripts/check-skalyta.mjs`, valen efter talet: felmeddelandet för fokus skriver taggnamnet och de första 60 tecknen av texten
  (`body "Boka rep med bandet. Boka rep med bande…"`) och inte hela elementets `textContent`. På `body` var det hela dokumentet,
  inklusive den inbäddade bundlen, 5,8 MB på en rad. Sidan lämnar numera också bara 61 tecken. Raden ligger i
  `scripts/lib/fokusKort.mjs` med eget prov (`fokus-kort.test.js`).

## 0.106.0

**Chatten (#386): Meddelanden och Inkorgen är kärna, samtal per ämne med agenten, båda språken, läsa bakåt, skrivfältet på
telefon, en Mer-knapp per meddelande, en inkorg som lever utan fokus. Och tal i alla textfält, och en bild som öppnas stor.**

Epiken cllp/ops-framework#386 och gapanalysen i dess kommentar. Skissen: gruppen överst i Meddelanden, sedan agenten som en rad
("Hugo, gruppens agent", "3 samtal, senast ..."), sedan personerna, och agentens rad leder till ämnena med Nytt samtal överst.
Skärmbilder mot en byggd yta, 390 och 1280 px: `docs/jamforelser/0.106.0/` (`node scripts/check-skalyta.mjs --bara-0106 --bilder
docs/jamforelser/0.106.0`, avsnitt 47).

### Tillagt: kärnmoduler

- `defineModule({ ..., karna: true })`: modulen finns alltid i varje grupp, står aldrig bland det som kan installeras (hubben, Redigera
  grupp, Appar-arket) och dess På går inte att stänga av. `medKarna(ids, moduler)` är läsvägen: gruppens `moduler` med de kärnmoduler
  som saknas sist. Hubben, arket, huvudmenyn, tilläggen, navigationen, hjälpen och typerna läser genom den, så en grupp som sparats
  utan kärnan får tillbaka den när den läses. `arKarna(m)` och `karnmoduler(moduler)`. Hur många moduler som helst kan vara kärna.
- Appens del: `karna: true` i `meddelandenManifest()` (lifehub.app `web/src/data/samtal.jsx`). Inkorgen är i lifehub.app en fast länk
  i skalet och ingen modul, och behöver inget märke.

### Tillagt: samtal per ämne med agenten

- Ett ämne är ett eget agentsamtal med en fjärde del i nyckeln, `<groupId>|<a>|<b>|<ämnesid>`. Det befintliga agentsamtalet står kvar
  som det första ämnet, utan migrering. `samtalsnyckel({ ..., amne })`, `kravAmne`, `nyttAmnesId`, `amnesId`, `parnyckel`,
  `AMNES_FORM`, `AMNESFALT` (`rubrik`, `arkiverad`), `kravAmnesrubrik`, `MAX_AMNESRUBRIK` (80), `amnesrubrik` (satt rubrik, annars
  `autonamn`, annars `NAMNLOST_AMNE`). `delaSamtalsnyckel` läser fyra delar.
- `createSamtalskalla({ amnen: true })`: `nyttAmne` (inte skrivet), `skickaIAmne` (samtalet skapas med första meddelandet),
  `oppnaAmne({ groupId, uid, agent, text, rubrik? })` för TALK:s Agent, `sattRubrik`, `arkivera`. Översikten hoppar över ett
  arkiverat ämne innan dess meddelanden läses, och `oversikt({ ..., arkiverade: true })` ger bara de arkiverade. `harAmnen(kalla)`.
- `samtalsregelfragment({ amnen: true })`: nyckeln med ämnesid, `rubrik` vid skapelsen och ändring av `rubrik` och `arkiverad` av
  personen i ett agentsamtal. Inget raderas. Läsregeln är oförändrad. Regelprov: `rules/__tests__/amnen.test.mjs`.
- `OpsMeddelanden`: agenten som en rad i inkorgen med antalet samtal, ämneslistan med Nytt samtal, ämnets rubrik i huvudet och
  Arkivera. `valtAgent`, `nytt="agent"`, och `onValj(id, { agent })`.

### Tillagt: läsa bakåt

- Vyn följer slutet bara för den som står där (inom 96 px), också när agentens status, ett förslag eller skrivfältet ändrar höjden.
  Den som läst bakåt rycks inte ned, och Till senaste säger antalet nya och att agenten arbetar. Ett eget meddelande rullar alltid ned.
- Nytt sedan sist står före det första olästa från någon annan, härlett ur läsmärket.

### Tillagt: skrivfältet på telefon

- 16 px under 768 (iOS zoomar in under det), 14 på dator. Växer med texten till 160 px och rullar sedan inuti sig. `enterKeyHint`
  är send. Ovanför tangentbordet: det `visualViewport` täcker dras av från chattens höjd.
- Nära taket står "3700 av 4000 tecken". Över taket står hela texten kvar, raden säger hur mycket för lång, och Skicka är avstängd.
- Ett scroll-event som köats medan fältet krympte och körs efter att tangentbordet krympt loggen läses inte längre som att personen
  rullat bort (mätt i 47 (5)).

### Tillagt: en Mer-knapp per meddelande på telefon

- Under 768 px står en ⋮ (`OpsAtgardsblad`) under varje bubbla, med de sex reaktionerna överst och sedan Svara i tråd, Lyft till
  minnet, Svara med citat, Fäst och Kopiera. Kopiera säger Kopierat, eller att urklippet inte släppte in. Trådens märke och nålen på
  ett fäst meddelande står kvar. På dator är raden oförändrad.
- Bara den ena uppsättningen ritas när bredden är känd (`matchMedia`, en lyssnare per lista): mätt 23,8 element per meddelande vid
  390 px och 26 vid 1280, mot 26 i 0.105.0 (avsnitt 47 (6), ett tak som bara får sjunka).
- `OpsAtgardsblad overst`: något som står överst i rutan, under namnet.

### Tillagt: en inkorg som lever utan fokus

- `createSamtalskalla({ levandeInkorg: true })` ger `bevakaInkorg` (en lyssnare per samtal på de två senaste meddelandena, `limit: 2`),
  `inkorgsrad` (en rad ur översikten) och `inkorgsradMed`. `harLevandeInkorg(kalla)`.
- Ett meddelande från någon annan räknas in i raden ur det lyssnaren har (`inkorgsradMed`) i stället för att raden läses om: ett
  dokument (läsmärket) i stället för 51. Läsmärket läses för varje meddelande, också ett eget: den som svarar från telefonen har
  läst samtalet där, och datorn ska inte stå kvar på 1. Raden läses om när den inte går att räkna med säkerhet: lyssnaren slog ihop
  meddelanden (det näst senaste i bilden är inte det raden har) eller olästa är redan ett golv.
- I det öppna samtalet får ett meddelande från någon annan bara ett nytt `senaste` (och ett längre fönster): inget räknas och inget
  läses, för läsmärket skrivs strax efter över nätet och en läsning dessförinnan visade 1 en stund. När märket är skrivet anropar vyn
  `onLast` och inkorgen läses om (inte om ett nyare märke redan är på väg). `inkorgsradMed` har ett femte argument, `oppet`.
- Mätt i Firestore-emulatorn (`rules/__tests__/inkorg-levande.test.mjs`, tre samtal med 60 meddelanden): hel översikt 156 dokument
  i 8 frågor (det 0.105.0 läste vid varje fokus), lyssnarnas första bild 6 dokument, ett nytt meddelande 1 dokument, och när raden
  ändå läses om 51 dokument i 2 frågor. Ingen ny samling och ingen ny regel.
- Läsmärket syns när nästa meddelande kommer och vid fokus. En prenumeration på ett enda dokument finns inte i datakontraktet, och en
  fråga på samlingen `last` nekas av reglerna, så en läsning på en annan enhet syns inte i samma stund.

### Tillagt: en bild öppnas stor vid tryck

- I kommentarerna, i chatten och i Chattinfo är en bilds miniatyr en knapp som visar bilden i full storlek i en dialog, med Ladda ned
  i dialogens fot. Fokus går tillbaka till miniatyren när dialogen stängs. `ORD_BILAGAVISNING` på svenska och engelska.

### ⛔ Brytande: tal är förval i textfälten

- `OpsTextarea` och `OpsInput` av typen `text` får ljudvågen utan att appen bett om den, när fältet har `onChange`, inte är
  skrivskyddat, och webbläsaren har taligenkänning. ⛔ **Webbläsarens taligenkänning skickar ljudet till Googles (Chrome) eller
  Apples (Safari) taltjänst.** Fram till 0.105.0 var den därför av som förval. Ingenting spelas in förrän personen trycker på
  ljudvågen, och ingenting skrivs in förrän hen trycker Klar. `tal={false}` stänger av per fält.
- Aldrig för `password`, `email`, `number`, `search`, `tel` och `url`, och ett `tal` på dem kastar.
- Knappen i ett formulärfält är diskret: ingen kant och ingen skugga, dämpad ikon. Samma ikon och storlek som chattens röstknapp.
  Skalytans avsnitt 45 krävde förut kant, som chattens, och kräver nu ingen.

### ⛔ Brytande: annat som ser annorlunda ut eller beter sig annorlunda

- Chattens skrivfält har ingen `maxLength`: text över taket står kvar och Skicka är avstängd, i stället för att kapas.
- En bild i en kommentar eller ett meddelande är en knapp och inte en nedladdningslänk. Ett prov som letar efter länken till en bild
  hittar den i dialogens fot.
- På telefon står Reagera, Fäst, Svara med citat och Svara i tråd i Mer-menyn och inte under bubblan.
- Chatten på båda språken (#385): varje förval i `Meddelandetexter` och i Chattinfo har en engelsk form (`ORD_MEDDELANDEN`,
  `ORD_CHATTINFO`), och vyerna sätter sitt språk som kontext för det de ritar. De engelska förvalen är nya, och en app som läser
  förvalen på engelska ser dem nu i Meddelanden och Chattinfo.

### Rättat: kalenderns månadsvy

- Etiketterna ligger inom sina dagsrutor, och bandplatsen räknas per dag och inte per vecka. CP 2026-10-14, med en skärmbild: en röd
  etikett gick ut över rutans högra kant. Bandplatsen reserverades för hela veckoraden, rutan hade fast höjd och kunde inte växa, och
  bandet täckte rutans kant. Nu reserverar bara en dag som ett band täcker plats, raden växer med innehållet och alla rutor i veckan
  följer med. Skalytans avsnitt 48 mäter det vid 390, 640, 1024 och 1280 px.
- ⛔ Ett dagsband ligger 9 px in från rutans kant, så en lång titel kortas något tidigare än förut.

### Ordning för appen

- Med `amnen`: reglerna från `samtalsregelfragment({ amnen: true })` deployas FÖRE klienten som skapar ämnen, annars nekas den
  fjärde delen i nyckeln.
- `levandeInkorg` och `karna` kräver inga regler.

### Inte mätt

- En riktig iPhone (Safari, tangentbordet, zoomen): skrivfältet är mätt i Chromium med iPhonens användaragent och ett låtsat
  `visualViewport`. WebKit finns inte på maskinen.
- Firestore i produktion: inkorgens kostnad är mätt i emulatorn.
- Agentens server, som sätter ett ämnes rubrik med sitt första svar.

## 0.105.0

**TALK: efter talet står Meddelande, Händelse, Ärende och Agent med ord, och Agent tar det sagda till appen. Agentens förslag är
knappar under svaret i chatten (`OpsForslag`).**

CP 2026-10-14, med en skärmbild av TALK-panelen där agenten svarat på ett "ja gör det" med en lista över spärrens ord: "talk gör att
man pratar in så att man ser texten direkt i realtid. Sen så finns de tre knapparna där direkt. Meddelande, ärende, kalender. Och sen
så adderar vi en agentknapp. Så att man får trycka på agenten om man vill att agenten ska svara för att hålla en dialog." Förslaget
han godkände: knappraden efter talet, agenten svarar bara när man trycker Agent, och en åtgärd agenten föreslår visas som en knapp där
trycket är personens begäran. Därefter, om var dialogen står: "Kör chatten". Skärmbilder mot en byggd yta, 390 och 1280 px i mörkt
läge: `docs/jamforelser/0.105.0/` (`node scripts/check-skalyta.mjs --bara-talkval --tema dark --bilder docs/jamforelser/0.105.0`).

### Tillagt: valen efter talet

- `OpsAppShell talk.onAgent(text)`. Med den lämnar Klar inte det sagda till `onTalk`. Fältet går till det nya läget `hort`: texten
  står kvar där den stod medan man pratade, och under den frågan "Vad ska hända med det du sa?" med fyra knappar med ord i ett
  rutnät med två kolumner: Meddelande, Händelse, Ärende och Agent. Fokus går till det första valet. Stäng kastar det sagda.
- **Agent** lämnar texten till `onAgent` och stänger fältet när löftet löser sig, eftersom appen tar över (lifehub.app skickar texten
  till chatten med agenten och öppnar den). ⛔ Avvisas löftet går fältet tillbaka till valen: det sagda och de fyra valen står kvar
  med felet (`role="alert"`), så att den som inte nådde agenten kan välja Meddelande eller Ärende i stället, och ett nytt tryck på
  Agent är Försök igen, aldrig `onTalk`. (Granskningen av PR 387: i första versionen blev det läget `fel` med en egen Försök igen,
  och då stod varken texten eller valen kvar.) Ett andra tryck medan det pågår gör ingenting. Felraden (`role="alert"`) finns från
  det att Klar trycks, tom och dold, och byter text, av samma skäl som statusregionen: en region som föds med sin text läses inte
  alltid upp.
- **Händelse** och **Ärende** öppnar skalets formulär ifyllda (`talkForifyllt`), som rubrikradens ikoner gjorde i 0.103.0.
  **Meddelande** lämnar `{ text }` till `talk.onMeddelande`. Ett val ritas bara när dess mottagare finns.
- Utan `onAgent`, eller när inget hördes (igenkänningen av eller föll), är flödet som förut: Klar lämnar ljudet och texten till `onTalk`.
  Ett fält låst till ett moduls mål (Bibliotekets röstinspelning) får inga val.
- ⛔ Med `onAgent` och taligenkänningen på står inget "Skickas till" medan man pratar, också när appen har flera mål: personen väljer
  vart det sagda ska efteråt, och ett mål som valdes under talet hade inte använts. Hördes inget går ljudet till `onTalk` med appens
  första mål. Utan igenkänning kommer inga val, och då står målvalet som förut. (Granskningen av PR 387.)
- `useTalk` tar `onAgent` och ger `agent()` och `medAgent`. `OpsInspelning` tar `onAgent`. `talkKnappNamn("hort")` är "TALK, välj vad
  som ska hända".
- Orden står i `ORD_TALK` på svenska och engelska: `valFragan`, `valMeddelande`, `valHandelse`, `valArende`, `valAgent`, `felAgent`.

### Tillagt: `OpsForslag`, och förslagen under agentens svar i chatten

- `OpsForslag forslag={[{ id, etikett, ikon?, text? }]} onForslag={(id) => ...}`: en knapp per förslag med etiketten och en kort
  förhandsvisning under. `onForslag` löser till `{ utfall: "ok" | "nekad", text? }`, och utfallet står i en statusrad under knappen.
  ⛔ Ett tryck är ett anrop: ett dubbelklick ger ett, och efter Klart eller Gjordes inte gör knappen ingenting. Ett avvisat löfte är ett
  fel som går att försöka igen, eftersom inget gjordes; att ett förslag bara kan utföras en gång är appens servers sak. ⛔ Ett fel står
  som "Förslaget gick inte att utföra." (`felForslag`) på personens språk, och felets egen text går bara till felrapporten
  (`rapporteraFel`): den är skriven för den som bygger, inte för den som tryckte. (Granskningen av PR 387: första versionen visade
  felets `message` ordagrant, till exempel "onForslag ska lösa till …".)
- `OpsMeddelanden onForslag({ sid, mid, id })`: under ett meddelande från en medlem av typen agent som bär fältet `forslag` (skrivet av
  appens server) ritas `OpsForslag`. En persons meddelande med samma fält får inga knappar. Ett felformat förslag ur databasen hoppas
  över och rapporteras, i stället för att fälla chatten.
- ⛔ I en tråd ritas inga förslag, varken under trådens rot eller under ett agentsvar i tråden. Agenten som vill föreslå något svarar i
  samtalet. (Granskningen av PR 387: det stod ingenstans.)
- ⛔ Appens server ska pröva `{ sid, mid, id }` mot det LAGRADE meddelandet, att det är skrivet av en agent och bär förslaget `id`, och
  mot att den som trycker är deltagare i samtalet `sid`; den utför det lagrade förslaget, aldrig något klienten skickat, och ser om det
  redan är använt. Ramverkets lås mot dubbelklick gäller en flik och är en bekvämlighet, inte ett skydd. Står i `lib/forslag.js`.
- `OpsMeddelanden nyttUtkast`: texten som står i skrivfältet när läget "nytt" öppnas, för Meddelande i TALK. Ingenting skickas.
- `src/lib/forslag.js`: `kontrolleraForslag`, `forslagUrData`, `forslagetsFel`, `forslagssvar`, `FORSLAG_IKONER`, `MAX_FORSLAG` (4),
  `MAX_FORSLAG_ETIKETT` (80) och `MAX_FORSLAG_TEXT` (240). Orden `forslagen`, `forslagPagar`, `forslagKlart`, `forslagNekat` och
  `felForslag` i `ORD_TALK`.
- Nodsidan (`ops-framework/node`) exporterar `FORSLAG_IKONER`, `MAX_FORSLAG`, `MAX_FORSLAG_ETIKETT`, `MAX_FORSLAG_TEXT`, `forslagetsFel`
  och `kontrolleraForslag`, så att appens server bygger knapparna med samma tak och samma prövning som chatten ritar dem med.

### ⛔ Brytande: Svara, samtalet i fältet och Fortsätt i chatten är borta

Mätt i 0.103.0 och 0.104.0: Svara (0.99.0) startade en ny omgång i fältet efter agentens kvitto, `useTalk().historik` (0.103.0) höll
omgångarna, samtalsytan ritade dem, rubrikradens tre ikoner lämnade samtalet vidare när kvittot stod, och `talk.onFortsatt` med
`fortsattEtikett` ("Fortsätt i chatten") öppnade samtalet med agenten. Med Agent hamnar dialogen i chatten, och då hade varje del gjort
samma sak som något som redan finns: Svara som chattens skrivfält (som har sin egen mikrofon med text i realtid sedan 0.103.0),
historiken som samtalet i chatten, ikonerna som valen, och Fortsätt i chatten som Agent. Två kopior av samma samtal hade glidit isär
(regel 2).

- Borta: `talk.svaraText`, `talk.onFortsatt`, `talk.fortsattEtikett`, `useTalk().historik`, `OpsInspelning`s `svaraText`, `onSvara`,
  `historik` och `fortsattEtikett`, `TALK_SVARA_TEXT`, och orden `samtalet`, `gorNagot`, `du`, `agenten`, `angratPrefix`,
  `vidareMeddelande`, `vidareHandelse` och `vidareArende` i `ORD_TALK`.
- ⛔ Skalet kastar när `talk.svaraText`, `talk.onFortsatt` eller `talk.fortsattEtikett` ges, med vad som ersätter dem. En nyckel som
  tyst ignorerades hade varit en knapp som försvann utan förklaring. `OpsInspelning` kastar på de borttagna som okända props.
- `Talkunderlag` är `{ text }`, det som sades. `samtal` och `rader` är borta, och `talkUnderlag` tar texten i stället för raderna.
- Kvittot (0.97.0) med Ångra finns kvar för ett `onTalk` som löser till `{ kvitto, angra? }`. Stäng är nu den primära knappen och får
  fokus, som före 0.99.0.
- Statusregionen står direkt i fältet i varje läge. Samtalsytan som var dess förälder i 0.103.0 är borta.

Det Svara gjorde som inget annat gör: en röstdialog med agenten utan att lämna sidan man står på. Den finns nu i chatten, som TALK
öppnar. Ingen app har bett om att stanna kvar på sidan.

### Prov

- `src/__tests__/talk-val.test.jsx` (24 prov): läget hört, de fyra valen med ord i rätt ordning och fokus, Agent en gång och fältet
  stängt, ett fel i Agent som visar texten och valen igen, felraden som finns från början, Ärende i stället efter ett fel i Agent,
  inget Skickas till med agent, utan agent som förut, inget hört som förut, ett val per mottagare, färdiga noder utan val, Stäng,
  Meddelande, Ärende och Händelse ifyllda, det sagda inte i adressen, en ny förifyllning som ersätter ett öppet ärende, en mottagare
  som kastar, engelska, och det stängda API:t. Mot 0.104.0:s `OpsAppShell`, `OpsMeddelanden`, `OpsTalk` och `lib/talk.js`: 20 röda,
  4 gröna: de två om `talkForifyllt`, "utan agent som förut" och "inget hört som förut", som mäter att det som inte ändrats är orört.
- `src/__tests__/forslag.test.jsx` (11 prov): två knappar med eget lås och egen statusrad, ett tryck ett anrop, ett nej, ett fel som går att försöka
  igen, fel form från appen, stängt API, data ur databasen, knapparna under agentens svar men inte under en persons, inga knappar utan
  `onForslag`, och `nyttUtkast`. Mot 0.104.0:s `OpsAppShell`, `OpsMeddelanden` och `OpsTalk` (med 0.105.0:s `OpsForslag` och ordlista
  kvar, eftersom komponenten hämtar sina ord ur `lib/talk.js`): 3 röda, 8 gröna. De tre röda är chattens prov: knapparna under agentens
  svar, inga förslag i en tråd (vars golv kräver rotens knapp utanför tråden) och `nyttUtkast`. ⛔ "En knapp per förslag" hade först bara ett förslag och kunde därför inte se om låset eller statusraden
  delades; nu har det två, och ett tryck på det ena lämnar det andra orört. Rött med låset gemensamt och med statusraden gemensam.
  (Granskningen av PR 387.) De sju om `OpsForslag` och `forslagUrData` mäter bara de nya filerna och kan inte bli röda mot gammal kod, så de
  mäts genom att koppla bort det de vaktar: utan spärren i `OpsForslag` är dubbelklicket och nejet röda, och utan `kontrolleraForslag`
  är det stängda API:t rött. Med villkoret "bara agentens svar" bortkopplat i chatten är chattens prov rött. ⛔ Det var det inte i
  första versionen av provet: "en persons meddelande" var skrivet av den som tittade, och dess knappar filtrerades redan bort som egna,
  så villkoret mättes inte. Provet har nu också ett meddelande från en annan person. Provet för "inga knappar utan `onForslag`" är inte mätt rött. Proven för ett avvisat löfte och för fel form från appen är röda med felets egen text i statusraden (se ovan om `felForslag`).
- `src/__tests__/talk-samtal.test.jsx` och `src/__tests__/talk-svara-andra-gangen.test.jsx` är borttagna. ⛔ Första versionen av
  0.105.0 sade att de togs bort "med det de mätte", och det var inte sant: nio av proven mätte inte Svara eller samtalsytan, och
  granskningen av PR 387 fann att de försvunnit. De står nu kvar, med andra omgången startad med mikrofonen i stället för med Svara.
  `talk-andra-omgangen.test.jsx` (6 prov, ur talk-svara-andra-gangen): taket som räknas om mitt i en inspelning, de två Safari-proven
  för `webblasarensIgenkanning`, de två skalproven "öppna, prata, kvitto, stäng, öppna, prata" och mikrofonströmmen som släpps.
  `talk-val.test.jsx` (3 nya, ur talk-samtal): Händelse och Ärende ritas inte när `skapa` är en färdig nod, det sagda står inte i
  adressen (`not.toContain("noterna")`), och en ny förifyllning ersätter ett ärende som redan stod öppet. Vart och ett mätt rött med
  det det vaktar bortkopplat: omräkningen av taket (1 rött), stängningen av förra igenkännaren i `starta` och `stoppa` (2), felbeskedet
  när `start()` kastar (2), `slapp` som stoppar spåren (1), villkoren `handelseSkapareFinns` och `typeof skapa.arende` (1), det sagda
  skrivet i adressen (1) och `key` på ärendeformuläret (1).
  `talk-kvitto.test.jsx` (fokus på Stäng i stället för Svara) och `talk-tomt-ljud.test.jsx` (andra omgången startas med mikrofonen i
  stället för med Svara) är ändrade och behöver en annan granskare (regel 9).
- `rules/__tests__/samtal.test.mjs` (1 nytt, mot Firestore-emulatorn): en klient som skriver fältet `forslag` nekas i privat samtal,
  gruppchatt och agentsamtal, med ett golv där samma meddelande utan fältet går igenom. Rött med `forslag` tillagt i
  `MEDDELANDEFALT`. Reglerna är oförändrade: fältet nekades redan som okänt, och provet gör det till en regel som syns.
  (Granskningen av PR 387.)
- `check-skalyta.mjs` avsnitt 46 (`--bara-talkval`), vid 390 och 1280 px: valen med ord som inte klipps, träffbara på 44x44, inne i fältet
  och fönstret, fokus på Meddelande och inget lämnat innan personen valt; Agent lämnar det sagda till `onAgent`; i chatten två förslag
  minst 44 px höga inne i fönstret med förhandsvisningen, ett dubbelklick ger ett anrop med samtalet, meddelandet och id, och utfallet
  står under knappen; inget rullar i sidled. Rött med en mutation (inget fokus på första valet och ingen förhandsvisning): 4 brott
  av 54, fokus och förhandsvisning vid 390 och 1280 px. Med 0.105.0: 54 kontroller utan brott. ⛔ Här stod först "mot 0.104.0:s
  dist: 4 brott av 4", men alla fyra var en krasch ("Cannot read properties of null (reading 'useContext')", två React-kopior när
  en annan dist laddas) och inte en mätning (granskningen av PR 387, varv 2). Hela `check-skalyta.mjs`: 2746 kontroller utan brott. ⛔ En körning av `--bara-talkval` direkt efter ett bygge
  föll en gång på att mittknappen inte gick att klicka inom 4 s vid 390 px, och samma körning en gång till var grön; det är en
  misslyckad mätning enligt regel 14 och inte ett resultat, men orsaken är inte utredd.
- Rytmen mellan publika block: `OpsPublikHjalte` med bild följd av ett `OpsPublikAvsnitt` fick 0 px luft, eftersom rytmregeln bara
  kände ljusa block och avsnitt efter avsnitt (CP 2026-10-14, Identitys startsida, #388). Regeln i `tokens.css` (mellan `RYTM` och
  `SLUT RYTM`) har nu fallet `[data-ops-publik="hjalte"][data-med-bild] + [data-ops-publik="avsnitt"]`: 80 px, 96 px från `sm`, samma
  luft som mellan två avsnitt. `check-brand.mjs` mäter paret i Chromium (provsidan `hjalteavsnitt` i `scripts/lib/publik-prov.jsx`) vid
  1280 och 390 px, med golv: minst ett par mätt. Rött med just det fallets väljarrad bortkopplad (`--bevisa`), grönt med den.

## 0.104.0

**Tal i vanliga textfält: `OpsTextarea` tar `tal`, och ett tryck på mikrofonen skriver in det sagda i fältet.**

CP 2026-10-14, med en skärmbild av Skapa app i lifehub.app (ett `OpsTextarea` med "Beskriv appen du vill ha"): "Jag vill gärna ha
TALK funktionen även här på skapa app." Skärmbilder mot en byggd yta, 390 och 1280 px, i vila och medan man pratar:
`docs/jamforelser/0.104.0/` (`node scripts/check-skalyta.mjs --bara-textfalt --bilder docs/jamforelser/0.104.0`).

### Tillagt: `tal` på `OpsTextarea`

- `tal={true}` eller `tal={{ igenkanning?, onTranscribe?, inspelare? }}` ger en mikrofon i fältets nedre hörn, samma knapp som i
  chattens skrivfält. Ett tryck visar TALK:s inspelningsyta med texten medan den hörs. **Klar skriver in det sagda där markören
  stod**, eller sist när markören aldrig stått i fältet, med ett mellanslag där orden annars suttit ihop. **Avbryt ändrar ingenting.**
  Fältet skickar inget, till skillnad från chatten. Fokus går tillbaka till fältet efter Klar och Avbryt, med markören efter det
  inskrivna.
- Samma regler som chatten och TALK: den preliminära texten räknas vid stopp, `onTranscribe` är reserven när igenkänningen inte gav
  någon text eller saknas i webbläsaren, mikrofonen släpps i alla vägar ut, och ett fel står i ytan med Försök igen. **Inget tomt
  skrivs in tyst** (rättelsen för cllp/lifehub.app#253): kommer utskriften tillbaka tom, eller finns varken text eller utskrift, säger
  ytan det.
- **`maxLength` gäller även det sagda.** Det som inte får plats kapas, och fältet säger det på en statusrad under fältet ("Det du sa
  kortades: fältet rymmer N tecken.", eller att fältet är fullt). Raden försvinner vid nästa ändring.
- Mikrofonen ritas bara när den kan ge text: med `onTranscribe`, eller med igenkänning som webbläsaren har. `tal={true}` slår på
  igenkänningen; i objektformen är den av som förval, som i TALK, eftersom webbläsaren skickar talet till Google eller Apple.
- `tal` kräver `onChange`, och ett `tal` utan både `igenkanning` och `onTranscribe` eller med en okänd nyckel kastar.
- Fältets ord på svenska och engelska: `ORD_OPSTEXTAREA_TAL` (knappen heter "Prata in" och "Dictate").

### Rättat: TALK:s yta följer appens språk

Inspelningsytan (`OpsInspelning`, och därmed TALK-fältet, chattens och textfältets yta) hade sina ord bara på svenska: "Klar",
"Avbryt", "Försök igen", "Stäng", "Sparat", "Ångra", platstexten, rubrikradens ikoner och TALK:s egna fel. Sett när textfältets egna
ord var engelska men ytans inte var det. Orden står nu i `ORD_TALK` (`lib/talk.js`) och läses med `ordet` på språket ur
`useOpsSprak`. Klars namn följer med ("Done, save the recording"). De svenska konstanterna (`TALK_INGET_LJUD`, `TALK_TEXTFEL`,
`TALK_SKICKAR_TEXT` med flera) läser sin text ur ordlistan, så att meningen står på ett ställe. Ett fel bär sin svenska text i
tillståndet, så att `kanSpelaInIgen` och `kanBeOmMikrofon` känner igen det, och översätts när det ritas; ett fel från appen ritas
som det är. Prov i `talk-sprak.test.jsx`: 5 av 7 röda mot koden före rättelsen, alla 7 gröna med den (de två som är gröna i båda
mäter att appens egen text och svenskan är orörda).

### Rättat: Appar-arket visar inte en ordning som aldrig sparades

När `onOrdning` avvisade sitt löfte låg den hållna ordningen kvar i `OpsApparArk`: felet stod i arket, men rutorna visade
ordningen som aldrig sparades, också efter att arket stängts och öppnats igen. Nu hålls ordningen bara medan sparandet pågår och
släpps när det avvisas eller kastar, så att arket visar propens ordning och felet. Ett äldre anrop som avvisas efter ett nyare rör
inte det nyare. Felraden har ramverkets felfärg (`text-etikett text-danger`), förut stod den ostylad. Prov i `apparark.test.jsx`:
avvisat löfte röd mot koden före (ordningen låg kvar), synkront kast röd på den ostylade raden, båda gröna med rättelsen.

### Ändrat: mittknappen är bara en mikrofon

CP 2026-10-14: "Sak bara vi måste ta bort plusset till plus-knappen. Den ser bara skräpig ut." Det lilla plusset bakom mikrofonen
på `OpsBottomNav`s mittknapp, från 0.103.0, är borttaget, och `SkapaMarkeIkon` med det. Mikrofonen är lika stor som förut (31 px)
och står mitt i cirkeln. Långtrycket öppnar fortfarande skapa-listan, och Shift+F10, ContextMenu, `aria-haspopup="dialog"`,
`aria-keyshortcuts` och namnet ("TALK, prata in. Håll inne för att skapa") är kvar. Vakten `scripts/lib/mittknappMatt.mjs`
(skalytans avsnitt 39 och `mikrofon-montage.mjs`) kräver nu att inget plus ritas, att mikrofonen är 30 till 32 px och centrerad, och
att namnet nämner långtrycket: röd mot 0.103.0:s knapp ("mittknappen ritar ett plus"), grön med ändringen. Bilder vid 390 px:
`docs/jamforelser/0.104.0/ramverk-mikrofon-390.png` och `ramverk-mikrofon-ljus-390.png`. `mikrofon-montage.mjs` skriver nu sina
bilder under versionen som byggs.

### Rättat: chattens röst-ord följer chattens språk

I en chatt på engelska stod det synliga ordet "Done" på Klar, men namnet som lästes upp var det svenska "Klar, skicka det du sagt"
(granskningen av PR 384, MÅSTE 1). Chattens röst-ord står nu i `ORD_MEDDELANDEN_TAL` på båda språken: mikrofonens namn ("Dictate"),
Stoppa agenten, Klar ("Done, send what you said"), statusraderna och utskriftsfelen, med två nya nycklar `talIngenUtskrift` och
`talIngetHordes` i `Meddelandetexter`. `texterPa` väljer dem på chattens språk, och appens egna `texter` vinner som förut. Ytan i
skrivfältet ritas också på chattens språk när appen ger `sprak` utan `OpsSprakProvider`. Chattens övriga texter är fortfarande bara
svenska: cllp/ops-framework#385. Prov i `chatt-talsprak.test.jsx`: 5 av 6 röda mot koden före (svenskan grön i båda), 6 av 6 gröna med.

### Prov: Appar-arkets skydd mot ett gammalt avvisat sparande

Skyddet i `OpsApparArk` som låter ett äldre sparande som avvisas efter ett nyare vara (`sparaForsok`) saknade prov: granskningen av
PR 384 (BÖR 2) tog bort det och fick 15 av 15 gröna. `apparark.test.jsx` har nu ett prov med tre synliga appar och två Klar i följd,
där det första avvisas efter det andra. Ordningen från det andra står kvar och inget fel visas. Rött med skyddet bortkopplat, grönt med det.

### Rättat: inspelarens egna fel följer språket

Två fel som `webblasarensInspelare` kastar ritades på svenska i en app på engelska, eftersom de inte stod i `ORD_TALK` (granskningen
av PR 384, BÖR 3): "Den här webbläsaren kan inte spela in ljud." och "Ingen inspelning pågår.". De står nu där som `felInspelningSaknas`
och `felIngenPagar`, tillsammans med det tredje felet inspelaren kastar ("Inspelningen avbröts innan mikrofonen öppnades.",
`felAvbrotsForeMikrofon`), och inspelaren kastar den svenska formen därifrån. Prov i `talk-sprak.test.jsx`, som hämtar felen ur
inspelaren själv: rött före, grönt med.

### Rättat: `talkTextPa` översätter bara TALK:s fel och statusrader

`talkTextPa` slog upp varje ord i `ORD_TALK`, så ett fel från appen som råkade heta som en knapp ("Stäng", "Klar") ritades på
engelska fast det var appens text (granskningen av PR 384, KAN 5). Uppslaget gäller nu bara felen (`fel*`, `ingetLjud`, `textFel`)
och statusraden `skickar`. Prov i `talk-sprak.test.jsx`: knappnamnen röda före och gröna med, och alla fel och statusrader översätts,
med ett golv på 15 nycklar.

### Rättat: tal som når `maxLength` kapas vid ett ordslut

`skrivInTal` kapade det sagda mitt i ett ord och kunde lämna ett mellanslag sist ("Abc en lång "), och när bara mellanslaget framför
inte fick plats sade fältet att det var fullt fast det sagda fick plats (granskningen av PR 384, KAN 6). Nu klipps det vid ett ordslut
utan blanksteg sist (ett enda för långt ord kapas fortfarande mitt i), och får det sagda plats utan mellanslaget framför släpps
mellanslaget i stället: `skrivInTal("abcde", null, "x", 6)` ger "abcdex". Prov i `textfalt-tal.test.jsx`: 3 röda före, gröna med. Två
befintliga påståenden ändrades och behöver en annan granskare (regel 9).

### Rättat: markören står kvar när appen avvisar det sagda

När appen avvisade det inskrivna (`onChange` utan att värdet ändrades) lade `OpsTextarea` ändå markören efter det inskrivna, så att den
hoppade fram i en text som aldrig ändrats, och positionen låg kvar tills fältet blev långt nog (granskningen av PR 384, KAN 4). Den
väntande positionen bär nu värdet den gäller: blir värdet inte det väntade läggs markören där den stod, och en ändring av fältet tömmer
positionen. Prov i `textfalt-tal.test.jsx`: rött före (markören på 7 i stället för 2), grönt med.

### Rättat: talytan i ett textfält bär fältets namn

Ytan som står i fältets plats medan man pratar hade inget namn, så den som lyssnar hörde "Klar" och "Avbryt" utan att veta vilket
fält de gällde (granskningen av PR 384, KAN 7). Ytan är nu en grupp med fältets namn: etiketten i `OpsField` via `aria-labelledby`
(etiketten har fått ett id, `etikettId` i fältets kontext), annars fältets `ariaLabel`. Chattens yta är oförändrad. Prov i
`textfalt-tal.test.jsx`: 2 röda före, gröna med.

### Rättat: `tal` med fel form ger ett begripligt fel

`OpsTextarea` med `tal={null}` kastade "fick object", eftersom `typeof null` är "object", och en lista föll igenom till ett annat fel
(granskningen av PR 384, KAN 8). Felet säger nu vad det fick ("null. Utelämna tal, eller ge false, …", "en lista", `"ja"`). Prov i
`textfalt-tal.test.jsx`: rött före, grönt med.

### Rättat: det sagda limmas aldrig ihop med ett ord

Rättelsen av KAN 6 släppte mellanslaget före eller efter för att det sagda skulle rymmas, och då limmades det ihop med ordet bredvid
utan besked: "Hej världen" fick "stora" som "Hej storavärlden", och "abcd" fick "xx yy" som "abxx yycd" (andra granskningsvarvet av
PR 384, BÖR). Det är en tyst väg (regel 5). `skrivInTal` behåller nu avskiljarna på båda sidor och kapar det sagda inom det som blir
kvar ("Hej stor världen", "ab xx cd"). Får det bara plats ihop med ett ord kommer det inte in alls, värdet och en markering står kvar,
och fältet säger "Fältet rymmer {max} tecken, och det du sa fick inte plats." (engelska: "The field holds {max} characters, and what
you said did not fit."). `fullt` sägs bara när fältet är fullt. Prov i `textfalt-tal.test.jsx`: 6 röda mot `fa1e637`, gröna med.
Påståendet om `skrivInTal("abcde", null, "x", 6)` är ändrat en gång till, med en ny ⛔ ÄNDRAT-rad (regel 9).

### Prov: chattens tillägg till utskriftsfelet är engelska på engelska

En mutation som skrev "Ingen utskrift finns." och "Inget hördes i det inspelade." på svenska i chattens `rosttexter` var grön (andra
granskningsvarvet av PR 384, KAN 2). `chatt-talsprak.test.jsx` prövar nu alla röst-ord som chatten ger röstinmatningen på engelska,
med ett golv på 7 nycklar, och "Nothing was heard in the recording." genom chattens yta. "Ingen utskrift" går inte att nå genom chattens
yta, eftersom mikrofonen bara ritas med `onTranscribe`, så `rosttexter` och `texterPa` exporteras från filen för proven (inte ur
ramverket). Båda mutationerna är röda med proven.

### Städat: död tömning av markörens position i `OpsTextarea`

`onChange` tömde den väntande markörpositionen vid varje ändring, men det gjorde ingenting (andra granskningsvarvet av PR 384, KAN 3).
Positionen läggs bara när fältets värde är exakt det väntade, så en avvisad position som ligger kvar läggs aldrig, och den skrivs över
nästa gång mikrofonen trycks. Raden är borttagen och skälet står vid `tillbakaTill`. Fältets 96 prov är gröna utan den, som de var med den.

### Ändrat: röstinmatningen har ett hem

Talet bodde inbyggt i chattens skrivfält (`OpsMeddelanden.jsx`). Det är utbrutet till `OpsRostinmatning.jsx`
(`useRostinmatning`, `useRostfokus`, `Rostyta`, `Mikrofonknapp`), och både chatten och `OpsTextarea` använder det. Den enda
skillnaden mellan dem skickas in som `onTal`: chatten skickar, fältet skriver in. Chattens beteende och texter är oförändrade, och
dess prov (`chatt-live-text`, `chatt-talk-krock`, `chatt-skrivfalt`, `chatt-bilagor`) är gröna utan ändringar.

### Vakter

- `src/__tests__/textfalt-tal.test.jsx`: Klar skriver in vid markören, sist utan markör, Avbryt ändrar inget, `maxLength` kapar och
  säger det, reserven via `onTranscribe`, inget tomt skrivs in tyst, mikrofonen bara när den kan ge text, och `skrivInTal`. Röda mot
  0.103.0 (11 av 12; den tolfte mäter att ett fält utan `tal` är som förut), och var och en röd när just dess beteende tas bort.
- `check-skalyta.mjs` avsnitt 45 (`--bara-textfalt`), vid 390 och 1280 px: knappen 44 px med en 36 px cirkel och 18 px ikon som
  chattens, träffbar på 44x44, helt inne i fältet; fältets text slutar före knappen; inget rullar i sidled; ett tryck ger ytan i
  fältets plats med fokus på Klar, och Klar skriver in det sagda sist med markören efter. Rött mot 0.103.0 (6 av 6), och rött på
  överlappet när fältet saknar utfyllnaden till höger.

## 0.103.0

**Samtalet i TALK-fältet, och tre ikoner som gör det till ett meddelande, en händelse eller ett ärende. Mittknappen är en
mikrofon, och ett långtryck på ikonerna i raden skapar i modulen.**

CP 2026-10-14: "vi kanske vill kunna att skapa ett ärende manuellt på det som sägs genom att klicka på skapa ärende, händelse
eller meddelande själv med den man pratar in? Inte så dumt med 3 knappar/ikoner när man pratat in som option, där historiken
finns med om man pratat med agenten olika omgångar. Så bubblans storlek med texten får en fixed size men texten scrollar där i,
och överst finns en headerbar med ikonerna för chatt, händelse, kalender där man för in all text från konversationen direkt. Och
om det är i en chatt så är flödet 'fortsätt i chatten'." Skärmbilder mot en byggd yta, 390 och 1280 px i mörkt läge:
`docs/jamforelser/0.103.0/` (`node scripts/talk-montage.mjs`).

CP 2026-10-14, "kör" på förslaget: "Långpress på ikoner och TALK med Microfon-ikon direkt? ... Att håller man inne knappen på
kalender kommer man direkt in i skapa ny händelse, default datum är idag (det skall alltid ställas in om det inte finns nåt
datum). Under appar, blir det 'Skapa app', under Ärenden blir det Skapa ärende. Grupp-ikonen i telefonen långpress blir skapa
grupp. Då skulle vi kunna göra +:et till en Mikrofon". Skärmbilder mot en byggd yta, 390 px i mörkt läge:
`docs/jamforelser/0.103.0/ramverk-mikrofon-390.png`, `ramverk-tips-390.png` och `ramverk-kalender-hall-390.png`
(`node scripts/mikrofon-montage.mjs`).

Tal i chatten medan man pratar, 390 px i mörkt läge: `docs/jamforelser/0.103.0/ramverk-chatt-tal-390.png`
(`node scripts/chatt-tal-montage.mjs`). Förebilden är ramverkets eget TALK-fält, `ramverk-samtal-390.png`.

### Tillagt: Appar har vyns huvud, och "+ Skapa app" står i det

CP 2026-10-14, med en skärmbild av Appar där sidan började direkt med korten och "Skapa en app" var ett eget kort längst ned: "App
panelen och Skapa app kan få vara enligt samma princip i header som meddelanden."

- `OpsGruppHubb` ritar vyns tunna huvud: ikonen, "Appar" och `atgard` (ny prop).
- `OpsVyAtgard`: åtgärden i ett vyhuvud, med Meddelandens form. `OpsMeddelanden` använder den för "+ Nytt meddelande".

### Granskningen av PR 383

- Plussets streck sätts med en klass på plussets ram (`[&_svg]:[stroke-width:3]`). `strokeWidth={3}` på ikonen gjorde ingenting, eftersom `.lucide { stroke-width }` i tokens.css går före attributet: plusset ritades 1,25 px mot mikrofonens 1,94. Skalytans vakt kräver nu att plusset är minst lika tjockt som mikrofonen (rött utan klassen, grönt med den).

- **Skapa-listan går att nå utan pekare** (MÅSTE 1). Före 0.103.0 öppnade Enter på plusset listan. När plusset blev en mikrofon
  startade Enter TALK, och listan nåddes bara med ett långtryck, alltså inte alls med tangentbordet under 768 px (också när en dator
  zoomar 200 %). Shift+F10 och tangenten ContextMenu på mikrofonen öppnar nu listan, och knappen bär `aria-haspopup="dialog"` och
  `aria-keyshortcuts="Shift+F10"`. Vägen ligger i `useLangtryck`, så samma tangenter öppnar genvägen på ikonerna med `skapa`
  (Kalender, Inkorgen, gruppväxlaren, med `aria-keyshortcuts`) och menyn i `OpsAtgardsblad`. Tangenten sätter inget släppskydd, och
  kontextmenyn som webbläsaren skickar efter den stoppas. Prov i `skapa-genvag.test.jsx` och `atgardsblad-langtryck.test.jsx`, och
  Shift+F10 i en riktig webbläsare i `check-skalyta.mjs` avsnitt 39.
- **Mikrofonens namn är helt engelskt på engelska** (BÖR 2): "TALK, speak. Hold to create" i stället för "TALK, prata in. Hold to
  create". Namnen per läge står i `ORD_TALKKNAPP` (`lib/talk.js`), och `talkKnappNamn(lage, sprak)` tar språket. Huvudets
  mikrofon och raden "TALK, prata in" i den gamla modellen följer samma tabell. `TALK_PRATA_IN` är kvar och är den svenska raden.
- **Bilderna av samtalet är tagna om** (BÖR 3): `ramverk-samtal-390.png` och `ramverk-samtal-1280.png` visar mikrofonen i
  bottenraden, inte plusset.
- **En stor mikrofon med plusset bakom** (BÖR 5). Förut var mikrofonen 24 px, ungefär 43 % av cirkeln, och plusset ett märke med
  ring framför den som en notisbricka. Nu är mikrofonen 31 px, plusset 20 px med `opacity-60`, förskjutet upp till höger, ritat före
  mikrofonen och täckt av dess kapsel där de möts. `check-skalyta.mjs` avsnitt 39 kräver det i stället för motsatsen, och
  `ramverk-mikrofon-390.png` och `ramverk-mikrofon-ljus-390.png` är tagna om. Plusset syns i båda lägena.
- **TALK-fältets nya kant står här** (KAN 7). Fältet står ovanför bottenraden och spelraden med samma kant som arken
  (`--bottom-nav-h`, `--safe-bottom` och `--spelrad-h`, plus 0,75 rem), i stället för `env(safe-area-inset-bottom) + 5.5rem`, en
  gissning av bottenradens höjd som inte räknade med spelraden och lade fältet delvis över den (granskningen av PR 366, BÖR 3).
- **Under inspelning går mittknappen inte att hålla in** (KAN 8). Medan TALK lyssnar, sparar eller visar ett kvitto öppnar varken
  långtrycket eller tangenten skapa-listan, plusset ritas inte, och namnet är bara "TALK, lyssnar" utan "Håll inne för att skapa".

### ⛔ Brytande

- **Med `talk` är bottenradens mittknapp en mikrofon, inte ett plus.** Ett vanligt tryck startar TALK direkt (samma
  `talkStyr.direkt()` som huvudets mikrofon). Knappen heter "TALK, prata in" (`talkKnappNamn`) i stället för "Skapa", och
  `data-talk-knapp` bär läget som förut. En app vars prov letar efter `nav button[aria-label="Skapa"]` med `talk` påslaget
  behöver se över det.
- **Mittknappens namn har en andra halva när ett långtryck skapar: "TALK, prata in. Håll inne för att skapa"** (#382). En app vars
  prov letar efter mittknappen med exakt `aria-label="TALK, prata in"` och `skapa` påslaget behöver se över det. Utan något i
  skapa-listan heter den som förut.
- **Långtrycket som spelade in är borta från mittknappen.** Före 0.103.0 spelade ett långtryck på plusset in och ett vanligt
  tryck öppnade Skapa. Nu är ett vanligt tryck TALK, och ett långtryck öppnar skapa-listan. Läget håll (`haller`) nås inte
  längre från skalet. `OpsBottomNav` fristående med `primaryAction.talk.knapp` ur `useTalk` beter sig som förut.
- **Tal i chattens skrivfält skickas direkt, som i TALK.** CP 2026-10-14, med en skärmbild av agentchatten där "Skriver ut det
  inspelade…" stod under skrivfältet: "Sedan funkar inte tal i meddelanden på samma sätt som TALK, det skall skrivas ut text i realtid
  och inte gå en omväg via textfältet." Ljudvågen visar TALK:s inspelningsyta (`OpsInspelning`) i skrivfältets plats, texten står i
  ytan medan den hörs, och Klar skickar den som ett meddelande i den öppna tråden, samma väg som Skicka. Före 0.103.0 skrevs orden in
  i fältet och personen tryckte Skicka själv. Ingen färdig text: det som stod i ytan skickas. Ingenting hört: `onTranscribe` skriver
  ut ljudet ("Skriver ut det inspelade…" i ytan) och resultatet skickas. Utan `igenkanning` är det alltid den vägen, och även då
  skickas resultatet direkt. Fältets utkast ligger kvar och skickas inte med. Ett fel står i ytan med Försök igen och texten eller
  ljudet kvar. En app vars prov letar efter "Skriv ut det inspelade", "Avbryt inspelningen" eller "Kasta ljudet" behöver se över det:
  ytan har TALK:s Avbryt, Klar ("Klar, skicka det du sagt") och Försök igen.
- **Texterna `skrivUt`, `stoppaInspelning`, `spelarIn`, `lyssnar`, `forsokIgen`, `kastaLjudet` och `stang` är borta ur
  `Meddelandetexter`.** Raderna de hörde till finns inte längre. Nya: `talKlar`, `talSkickar`, `talSkickaFel`, `talTextFel`.
  Ingen av dem står i lifehub.app:s eller bolag-ops `web/src` (mätt 2026-10-14 i lokala kopior från 2026-10-14 respektive 2026-10-07).
- **"Ny händelse" får alltid en dag.** `HandelseSkapare.form` fick `datum: null` när panelen öppnades utan dag; nu får den idag
  (`idagI()`, Stockholms dag, samma som kalenderns), utom i redigeringsläge. Dagen skrivs inte i adressen.

### Tillagt

- `useTalk().historik`: en rad per omgång som nådde kvittot, med det som hördes och agentens kvitto (`{ hord, kvitto, angrat }`).
  Den överlever Svara och töms när fältet går tillbaka till vila. Ångrat syns på omgången kvittot hör till.
- Fältet: när kvittot står visas samtalet i en rullande yta med fast höjd (`min(15rem, 34dvh)`), personens repliker som bubblor
  till höger och agentens med bocken. Ytan rullar till sista raden när ett nytt kvitto kommer och går att nå med tangentbordet.
  Ångra, Stäng och Svara står under ytan och syns alltid. Svara är fortfarande den primära knappen och får fokus.
- Rubrikraden överst med tre ikoner: Meddelande, Händelse och Ärende ("Skapa ett ... av samtalet"). Ett tryck lämnar
  `{ text, samtal, rader }` till mottagaren och stänger fältet. En ikon ritas bara med en mottagare och bara när något av det
  personen sade hördes. Kastar mottagaren står felet i fältet och samtalet finns kvar.
- `OpsAppShell talk.onFortsatt(underlag)` och `talk.fortsattEtikett` ("Fortsätt i chatten"): Meddelande går till appen.
  Händelse och Ärende öppnar skalets egna formulär med `forifyllt: { rubrik, beskrivning }`, härledda med `talkForifyllt`
  (rubriken är första meningen, högst 80 tecken, beskrivningen resten). `skapa.arende` och `HandelseSkapare.form` får `forifyllt`,
  `null` när panelen öppnats på annat sätt.

- **Långtryck på en ikon skapar i modulen.** En nav-post (`nav`, och `fasta.idag`, `fasta.kalender`, `fasta.hub`) och en
  `OpsIconLink` tar `skapa`, en nyckel som `useOppnaSkapa()` tar ("handelse", "arende", "grupp", "meddelande" eller en moduls
  registrerings id). Ett långtryck på ikonen i bottenraden eller i huvudet öppnar samma panel som raden i plusset, och ett
  vanligt tryck navigerar som förut. Kalender bär "handelse" från början (`FASTA_SKAPA`). Gruppväxlaren i huvudet ger "Ny
  grupp" när skalet kan skapa en grupp. Inkorgen ger "Nytt ärende" med `<OpsIconLink skapa="arende" />`. `validateNav` kastar
  för en nyckel med fel form, för "talk" och för `skapa` på ett barn.
- **Mikrofonen bär ett plus när ett långtryck skapar** (#382). CP 2026-10-14: "Ett kort press på talk öppnar ju då dialogen för
  att kunna prata in med agenten direkt. Och i den dialogen så finns ikonerna. Men om jag pressar en lång press på talk så blir det
  plusmenyn. Så att man kan lägga till manuellt utan att gå till talk. Undra om man i den ikonen kan ha en stor mikrofon och liksom
  lite bakomliggande ett plus som indikerar det." Mikrofonen ritas i 31 px, och ett dämpat plus på 20 px (`data-skapa-marke`) står
  upp till höger bakom den: det ritas före mikrofonen, och mikrofonens kapsel är fylld i knappens färg så att den täcker plusset där
  de möts. Bara när långtrycket öppnar skapa-listan, och bara medan TALK vilar. Ny text: `ORD_OPSBOTTOMNAV.langtryckText` ("Håll
  inne för att skapa", "Hold to create") och propen `OpsBottomNav langtryckText`. Ny ikon: `SkapaMarkeIkon`. Skärmbilder, 390 px i
  mörkt och ljust läge: `docs/jamforelser/0.103.0/ramverk-mikrofon-390.png` och `ramverk-mikrofon-ljus-390.png`
  (`node scripts/mikrofon-montage.mjs`). Mätningen och kraven står i `scripts/lib/mittknappMatt.mjs`, som både montaget och
  `check-skalyta.mjs` avsnitt 39 läser.
- Ingen genväg utan mottagare: har skalet ingen panel för nyckeln just nu (en modul som inte är påslagen, ett `skapa` utan
  posten, en ikon utanför skalet) får ikonen inga händelser och går inte att hålla in, med webbläsarens vanliga meny kvar.
- Långtrycket stoppar iOS förhandsvisning av länken (`-webkit-touch-callout: none`) och Androids kontextmeny medan ett tryck
  pågår, sväljer klicket som följer släppet och vibrerar kort där webbläsaren kan (`navigator.vibrate`). Ett högerklick med
  mus på en länk får sin vanliga meny.
- En tipsrad ovanför bottenraden första gången en ikon med genväg trycks: "Tips: håll in Kalender så öppnas Ny händelse
  direkt." En gång per webbläsare (`localStorage`, nyckeln `ops-skapa-genvag-tips`), inte från 768 px och inte efter att någon
  redan hållit in en ikon.
- `OpsInspelning klarEtikett`: namnet Klar läses upp med. Förval "Klar, spara inspelningen" som förut; chattens skrivfält ger
  "Klar, skicka det du sagt". En tom sträng kastar.
- `useLangtryck` (intern): hålltiden, rörelsetoleransen och släppskyddet som `OpsAtgardsblad` hade, flyttade till en krok som
  `OpsAtgardsblad`, ikonerna och mikrofonen delar.

### Rättat

- **Taligenkänningen kastade allt som hörts när inget resultat blivit slutligt före stoppet** (`webblasarensIgenkanning`). Det är den
  troliga orsaken till att CP såg "Skriver ut det inspelade…" fast lifehub.app slagit på `igenkanning`. ⛔ Hypotes, inte mätt på en
  iPhone: Safari på iOS markerar ofta inget resultat som slutligt i `continuous`-läge, så texten blev tom varje gång, chatten föll till
  `onTranscribe` och TALK skickade bara ljudet. Nu räknas den preliminära texten som hel när personen stoppat och webbläsaren sagt
  `end` inom väntetiden, samma bud som redan räknades när Chrome tar en paus mitt i. Ett fel, ett avbrott (`aborted`) och en väntetid
  som tar slut ger fortfarande tom text (granskningen av PR 358, MÅSTE 2, som i övrigt står kvar).
- **Andra omgången efter agentens fråga skickade 0 byte och ingen text, och Försök igen skickade samma tomma ljud igen**
  (cllp/lifehub.app#253, CP 2026-10-14 på iPhone: "Efter att jag fått en fråga så kan man inte spela in mer ljud"). `useTalk`
  lämnar aldrig längre tomt ljud utan text till `onTalk`: fältet säger `TALK_INGET_LJUD`, rapporterar det inspelaren såg om
  strömmen (`diagnos` från `webblasarensInspelare().stoppa()`), och visar Spela in igen i stället för Försök igen. En ström där
  alla spår är tysta (`muted`) hämtas om en gång innan inspelningen börjar. ⛔ Hypotes, inte mätt på en iPhone: WebKit ger en tyst
  ström när taligenkänningen nyss haft mikrofonen. Mätt i koden: att det tomma gick vidare och att Försök igen inte kunde ge något
  annat (`talk-tomt-ljud.test.jsx`).

### Borttaget, och var vägen nu går

- **Plusmenyn är inte längre mittknappens tryck när `talk` finns.** Samma lista (`renderSkapaLista`) öppnas av ett långtryck på
  mikrofonen, utan raden "TALK, prata in", och bara när den har något utöver TALK. Den ligger kvar där för att modulernas
  registreringar och platsen `handelse.atgard` inte har någon annan väg på telefon.
- Ny händelse: långtryck på Kalender. Nytt ärende: långtryck på Inkorgen (appen sätter `skapa="arende"`). Ny grupp:
  långtryck på gruppikonen. Nytt meddelande: Meddelandens eget Nytt. På dator är plusset i huvudet kvar med hela listan,
  och mikrofonen bredvid det.
- Utan `talk` är mittknappen plusset med dagens beteende.

### Medvetet utelämnat

- "Skapa app" under Appar är inte ramverkets: ramverket har ingen sådan registrering. Appen sätter `fasta.hub.skapa` till sin
  registrerings id, och utan den går Appar inte att hålla in.
- Tipsraden visas inte för gruppväxlaren: ett tryck på den öppnar ett ark över skärmen, och en rad under arket hade räknats
  som visad utan att ha setts.

- Samtalet står inte i adressen. `?skapa=` skrivs som vanligt, men det som sades skrivs inte i webbläsarens historik, och en
  omladdning öppnar formuläret tomt.
- Agentens repliker kommer inte med i formulärets beskrivning, bara det personen sade. Hela samtalet finns i underlaget
  (`samtal`) för den mottagare som vill ha det.

## 0.102.0

**Biblioteket som SessionStudios, och en kortare meny.** [lifehub.app#214](https://github.com/cllp/lifehub.app/issues/214),
[lifehub.app#226](https://github.com/cllp/lifehub.app/issues/226).

CP 2026-10-14: "Det måste se ut exakt som SessionStudio ... Separera hellre artefakter i listan på ett bättre sätt som
SessionStudio. Måste vara supersnyggt." Och om långtrycksmenyn: "Kanske popup med en kortare meny för artefakten? Vad är detta
med hastighet mm och spolning när en låt/ljud inte ens har startat?" Montage sida vid sida med SessionStudios riktiga
`MyLibraryPanel` i mörkt läge: `docs/jamforelser/0.102.0/`.

### ⛔ Brytande

- `ORD_OPSATGARDSBLAD.stang` är borttagen, och `OpsAtgardsblad` är inte längre ett ark från botten under 768 px utan en kort ruta
  vid raden på alla bredder.
- `BIBLIOTEKFLIKAR` har fliken `bild`, och `filtreraBibliotek({ flik: "fil" })` ger dokumenten utan bilderna.
- `OpsHubTillbaka` och `OpsViewHeader` ritar vyns tunna huvud (se nedan). `atgard` står på rubrikens rad, inte på Tillbaka-raden.
  En app som mätt rubrikens storlek eller letat efter åtgärden på Tillbaka-raden behöver se över det.
- Bibliotekets rad "N objekt" (`data-bibliotek-antal`) är borta. Antalet står i fliken Allt.

### Ändrat

- **Vyns huvud är Meddelandens, i varje vy.** CP 2026-10-14, med skärmbilder av Meddelanden, Bibliotek och Inkorg från telefonen:
  "Kolla header panelen på chatt. Den är mycket tunnare och bättre än bibliotek. Gör dessa enhetliga med utgångspunkt från
  meddelanden. Inkorgen börjar nästan i halva panelen." `OpsHubTillbaka`, `OpsViewHeader` och `OpsMeddelanden` delar en rad:
  ikonen i accent, namnet i etikettens storlek och vikt 600, och åtgärderna till höger (`VYHUVUD_KLASS`, `VYRUBRIK_KLASS`,
  `VYIKON_KLASS`). `ikon` på `OpsHubTillbaka`, `OpsViewHeader` och `modulTillbaka`, och `OpsModulRam` skickar modulens `hubb.ikon`.
- `OpsBibliotek`: varje post är ett eget kort med luft emellan, som kortet i SessionStudios app (CP:s skärmbilder i
  `docs/jamforelser/0.102.0/forebild-ss-app-*.png`). Kortet har en rund ikonplatta i typens färg, rubriken, typen i singular
  med format ("DOKUMENT · PDF"), taggarna som färgade piller, en förhandsvisning och en metarad (storlek, längd och datum).
  Ett ljud spelas med en rund knapp till höger, i skalets spelare.
- Huvudet: "N objekt" och platsen som en pill, sedan sök, "+ Ny" och Taggar på en rad, och flikarna som piller som rullar i
  sidled på alla bredder.
- Flikarna är Allt, Ljud, Anteckningar, Bilder, Dokument och Länkar. Tomma flikar döljs, utom Allt och Ljud.
  `BIBLIOTEKFLIKAR` har `bild` som en ny flik, och `fil` är nu dokumenten, utan bilderna.
- Taggarna ändras på kortet: lägg till med ett fält med förslag, ta bort med krysset, och ett tryck på en tagg filtrerar.
  Rutan Taggar i menyn är borta. Filtret är en knapp Taggar med en panel, och den gamla raden med `#tagg` under sökfältet är
  borta.
- Menyn är kortare. Öppna, Taggar, 10 sekunder bakåt och framåt, Hastighet, Ladda ned och Redigera i listan är borta, och
  Kopiera till Mitt bibliotek för författaren ligger i "Flytta eller kopiera".
- `OpsAtgardsblad` är en liten ruta vid raden på alla bredder, med postens namn överst. Arket nerifrån med Stäng är borta.
  `ORD_OPSATGARDSBLAD.stang` är borttagen.
- `OpsLjudspelare` visar hopp och hastighet först när ljudet startats. Ladda ned syns hela tiden.

### Tillagt

- **Skalets spelare** (`OpsSpelareProvider`, `OpsSpelaKnapp`, `OpsSpelarKontroller`, `useSpelare`, `ORD_OPSSPELARE`), som
  SessionStudios. CP 2026-10-14: "Kolla SessionStudio och spelaren. Men gärna med waveform också." `OpsAppShell` lägger
  providern runt sidan. Ett ljud som startas spelar vidare medan man byter vy, i en spelrad ovanför bottenraden (från 768 px i
  ett hörn). Ett tryck på namnet öppnar arket med vågen, spolning, -10 och +10, hastigheten och Ladda ned. Låsskärmen och
  hörlurarna styr den via Media Session. En `<audio>` för hela skalet, och en i taget med `OpsLjudspelare` och chattens bilagor.
- `taggfarg(tagg)` och `TAGGFARGER`: taggens färg 1 till 8 med SessionStudios hash, och tokens `--color-tagg-1` till
  `--color-tagg-8`, `--color-tagg-text` och `--color-typ-anteckning`, `--color-typ-ljud` och `--color-typ-lank`.
- `OpsLjudspelare` läget `liten`, och `kort` på `OpsSvepRad` och `OpsAtgardsblad`.

### Granskningen av PR 366

- Vyns rubrik (`VYRUBRIK_KLASS`) bär `font-display` igen. Det tunna huvudet tog etikettens storlek och tappade typsnittsrollen
  med den, så en brandfil som byter `--font-display` ändrade inte längre vyns namn. `check:brand` fångade det i CI.
- Skalets spelare skriver inget fel när ett äldre `play()` avvisas efter ett byte av spår, en paus eller en stängning. `startFelText`
  i `lib/ljudspelare.js` är texten för båda spelarna, och tom för `AbortError`.
- Spelraden tar sin plats: höjden står i `--spelrad-h`, och ytorna som slutar vid bottenraden räknar in den. Förut låg den över
  skrivfältet i Meddelanden, och från 768 px täckte hörnrutan skicka-knappen. Från 768 px är den en list längst ned.
- Bibliotekets flikar är Radix Tabs: piltangenter, Home och End, och fliken styr panelen.
- Vågen i skalets spelare spolar 5 s med piltangenterna, och Home och End går till början och slutet.
- `OpsLjudspelare liten` är 44 px och lämnar felet till kortet med `onFel`, så att det syns och inte bara hörs.
- Media Session rensas när skalet avmonteras.
- Dela i Mitt bibliotek kräver fortfarande att man äger posten eller får ändra den, som försvar i djupet.
- Flikraden tonar ut mot högerkanten, så att det syns att fler flikar finns.

### Rättat

- Väljaren i Flytta eller kopiera heter det den visar ("Flytta eller kopiera till"). Förut stod "Till" synligt och ett annat
  namn för skärmläsaren.
- Escape i taggfältet sparar inte det avbrutna utkastet, också när webbläsaren tar bort fokus från fältet i samma ögonblick.

## 0.101.0

**Mitt bibliotek, och flytt mellan det och gruppen.** [lifehub.app#226](https://github.com/cllp/lifehub.app/issues/226).

CP 2026-10-13: en post ska "antingen kunna vara helt privata till mig själv eller visa till gruppen". Beslutet på #226: privat är en
egen plats bredvid gruppens, och att dela är att flytta posten dit. En flagga "privat" på en post i gruppens samling hade krävt en
läsregel som avgör synlighet per post, och det är permissions-träsket (kanonens regel 13).

### Tillagt

- Platsen `mitt~<uid>` (`mittBibliotek`, `arMittBibliotek`, `mittJag`, `MITT_PREFIX`, `MITTFORM`). En post där är en vanlig
  bibliotekspost med samma fält, filer och taggar. `postFel` godtar platsen. `farAndra` släpper bara ägaren där.
- Regelgrenar: `bibliotekregelfragment` släpper läsning, skapande, ändring och radering på `mitt~<uid>` för den inloggade med det
  uid:t och ingen annan, också inte en admin i en grupp. `lagringsregelfragment({ bibliotek })` gör samma sak för filerna.
- `flyttaBibliotekspost({ fran, till, id, satt, hamtaFil })`: kopian först, originalet sedan. En halv flytt säger att posten finns
  på båda ställena. En fil flyttas genom sina byte till den nya platsens sökväg. Källan har `hamta(id)`, och `laddaUppFil` tar
  `taggar` och `utskrift` så att en flyttad post har dem från första skrivningen.
- `createFirebaseStorageSource` har `hamta(sokvag)`, som ger filens byte med `getBlob` och personens inloggning. Det är vägen
  `flyttaBibliotekspost` tar för en fil (`hamtaFil`). Mätt mot lifehub-my: Storage svarar med `access-control-allow-origin: *`,
  så ingen CORS-inställning behövs.
- `OpsBibliotek`: växlaren `platser`, `plats` och `onPlats` ovanför flikarna. I menyn Flytta till Mitt bibliotek (bara
  författaren) och Kopiera till Mitt bibliotek, och i Mitt bibliotek Dela med gruppen. Medan det pågår och när det är klart står
  det i statusraden, och ett fel står kvar med skälet.

### Granskningen av PR 365

- Reglernas grenar utesluter varandra. En plats som ser ut som `mitt~…` prövas bara mot uid:t och aldrig mot `memberships`, i
  Firestore och i storage. Med "eller" hade ett medlemskap vars `groupId` råkade vara någons plats öppnat den, sett i emulatorn.
  `byggMedlemskap` avvisar dessutom ett `groupId` som inte är ett grupp-id.
- Storage-reglerna har sitt första prov (`rules/__tests__/lagring-bibliotek.test.mjs`, storage-emulatorn), och `test:rules` kör
  `--only firestore,storage`.
- `flyttaBibliotekspost` stämmer av byten mot postens storlek innan något skrivs.
- Bara författaren flyttar, också till en annan grupp. En admin kopierar. Medan en flytt ur menyn pågår visas inga flyttval för
  posten.
- `MITTFORM` godtar bara ett uid:s tecken: bokstäver, siffror, `-` och `_`. Regelns prov på prefixet är `(?s)`, så också en
  radbrytning i platsen hålls i rätt gren (varv 2).
- Varv 2: en flytt ur rutan Till en annan grupp lägger också posten i spärren, så att flyttvalen inte kommer tillbaka om rutan stängs
  innan flytten är klar. Storage-provet har ett fall till: en annan medlem i gruppen skriver inte över någon annans fil.

### Ändrat

- Menyvalet Dela heter Till en annan grupp (Dela med en grupp i Mitt bibliotek). Postens egen grupp står inte bland målen.
  Rutan har Flytta och Kopiera med framsteg, och den stängs först när det gick. Förut stod den kvar utan besked efter ett lyckat
  tryck.

## 0.100.1

**Långtrycket öppnar menyn också på en låg rad.** [lifehub.app#226](https://github.com/cllp/lifehub.app/issues/226).

CP 2026-10-13: "Man ska kunna hålla inne fingret ... och få upp menyn." Mätt i Chromium med pekskärm i iPhone-storlek mot lifehub.app:s
mätbygge: ett långt tryck på rad ett och två i Biblioteket gav menyn, på rad tre och fyra öppnades posten i stället. På en smal skärm
är menyn ett ark nerifrån. På en låg rad låg arket under fingret när det lyftes, och klicket som följer släppet träffade raden där,
oftast Öppna.

### Rättat

- `OpsAtgardsblad` ignorerar klick i menyn eller arket, Stäng inräknad, inom 400 ms (`SLAPP_SKYDD_MS`) efter att fingret som öppnade
  den med ett långt tryck lyfts (eller gesten avbröts). Det är ett tidsfönster och inget tillstånd: ett klick efter det går alltid
  fram. Rörelse efter att menyn öppnats avbryter inte mätningen, och ett släpp som aldrig kommer låser inte menyn längre än 2 s.
  Menyn som öppnas med ⋮ har ingen spärr.
- Bibliotekets listrad visar taggarna på en egen rad under metaraden. I metaraden kapades de av anteckningens text ("#kvi…"), sett i
  skärmbilden i 390 bredd.
- Taggrutans Lägg till står i höjd med fältet. Hjälptexten ligger under raden.

## 0.100.0

**Taggar i Biblioteket.** [lifehub.app#214](https://github.com/cllp/lifehub.app/issues/214) och långtrycksmenyn i
[lifehub.app#226](https://github.com/cllp/lifehub.app/issues/226).

CP 2026-10-13: "Precis som i sessionstudio skall man kunna tagga artefakter så att det blir lättare att filtrera och hitta sina saker även
om det är mkt." Långtrycket fanns redan (`OpsAtgardsblad`, mätt i Chromium med pekskärm i telefonstorlek), och taggarna ligger i samma
meny som Byt namn.

### Nytt

- **Fältet `taggar`** på en bibliotekspost: högst `MAX_TAGGAR` (8), var och en i `TAGGFORM` (gemener, siffror, mellanslag och
  bindestreck, högst `MAX_TAGGLANGD` = 24 tecken), utan dubbletter. En post utan taggar saknar fältet.
- **`normaliseraTagg`, `normaliseraTaggar`, `taggarFel`, `allaTaggar`.** "#Kvitto" blir "kvitto". `allaTaggar` räknar gruppens taggar ur
  posterna, flest först: det finns ingen egen samling för taggar, och en tagg utan poster finns inte.
- **`filtreraBibliotek(poster, { taggar })`**: valda taggar är OCH. Sökningen läser också taggarna.
- **Vyn:** en rad taggar under sökfältet (`OpsChip`, tryck för att filtrera, tryck igen för att släppa), postens taggar efter metaraden
  ("Anteckning · 2 okt · #kvitto · #bil"), och **Taggar** i ⋯ och i långtrycket för den som får ändra posten. Rutan visar postens taggar
  med en knapp per tagg som tar bort den, ett fält där Enter lägger till, och gruppens andra taggar som förslag.
- **Källan** (`createBibliotekskalla.spara`) tar `{ id, taggar }`. En borttagen sista tagg tas bort ur dokumentet med `FALT_BORT`: en
  uppdatering slår ihop, och utan det hade de gamla taggarna stått kvar.

### Regler

- `bibliotekregelfragment` släpper `taggar` och prövar listan, taket, dubbletterna och varje plats mot `TAGGFORM` ur samma konstant
  (`regelRegex`). Regler har ingen loop, så platserna är utrullade till taket. Provet i `rules/__tests__/bibliotek.test.mjs` skriver samma
  taggar som modellen prövar och kräver samma utfall, och det är sett rött utan villkoret.

⛔ **Appen genererar om sina regler** (`check-regelfragment --skriv` i lifehub.app) och **deployar reglerna före klienten**: en klient som
skriver `taggar` mot gamla regler får "Missing or insufficient permissions."

## 0.99.0

**Beskrivna appar, byggsätt A.** En app är en beskrivning (data), och motorn ritar och sparar den. Beslut 0005, nattens första skiva i
[lifehub.app#213](https://github.com/cllp/lifehub.app/issues/213).

CP 2026-10-13: "Nu skall vi skapa funktionen för att bygga appar från agenten under natten." Agenten ska kunna bygga en app åt en grupp
utan att skriva kod. Kod körs som den inloggade personen eller med Admin SDK, och en beskrivning kan bara BE motorn om listor och fält ur
en sluten uppsättning (beslut 0005, "kod får nycklarna, en beskrivning får bara be"). Därför behövs ingen granskning av en beskrivning,
och därför är formatet strängt: ett okänt fält är ett fel och släpps inte tyst igenom.

### Nytt

- **Formatet, version 1:** `{ format: 1, id, namn, ikon, beskrivning, listor: [{ id, namn, falt: [{ id, namn, typ, krav?, val? }], rubrikfalt, visning? }] }`.
  Åtta fälttyper: `text`, `langtext`, `tal`, `datum`, `val`, `janej`, `lank`, `person`. 1 till 5 listor och 1 till 20 fält per lista. Id är små
  bokstäver, siffror och bindestreck (2 till 40 tecken). `ikon` är ett namn ur `GRUPPIKONKATALOG`, ingen andra lista.
- **`validateBeskrivning(b)`** ger `{ ok: true, beskrivning }` (normaliserad och idempotent) eller `{ ok: false, fel }` med ALLA fel, inte det
  första, och varje med sökvägen och vad som gäller: `listor[0].falt[2].typ: okänd typ "siffra". Giltiga: text, langtext, tal, datum, val,
  janej, lank, person.` De är skrivna för en agent som rättar sig efter dem.
- **`validateRad(beskrivning, listaId, varden)`** prövar en rads värden mot fältens typer, krav och okända fält, och ger `{ ok: true, varden }`
  eller `{ ok: false, fel, faltfel }` (`faltfel` är texten per fält-id, för ett formulär).
- **`createBeskrivenAppKalla`** (raderna) och **`createBeskrivningskalla`** (beskrivningarna). Båda tar `source`, `collection`, `groupId` och
  `skapare`, och båda prövar innan de skriver. Appen namnger samlingarna.
- **`beskrivenappdataregelfragment(namn)`** och **`beskrivningsregelfragment(namn)`**, med emulatorprov (36 prov i `rules/__tests__/beskrivenapp.test.mjs`). Mutationskörning mot de genererade reglerna: 81 mutanter (varje villkor i de två fragmenten togs bort eller gjordes sant, ett i taget), 81 dödade, mätt efter granskningens rättningar nedan. Siffran som stod här tidigare, 66, gick inte att reproducera: granskaren fick 57 av 62.
- **`OpsBeskrivenApp`**: flikar per lista, sök, Ny, raderna som lista eller tabell, ett formulär ur fältens typ, Spara, Avbryt och Ta bort med
  fråga. Bara ramverkets egna delar, och ingenting ur beskrivningen blir HTML.
- **`byggBeskrivningsdokument`** och **`beskrivningsId`**: dokumentets form och id på ett ställe, för klienten och för en server med Admin SDK.
- **`ops-framework/node`** bär modellen (`validateBeskrivning`, `validateRad`, `byggBeskrivningsdokument`, `beskrivningsId` och alla tak), så att
  appens Cloud Functions validerar med samma funktion som klienten.

### För appen

1. **Klistra in två fragment i `firestore.rules`**, efter `regelfragment()`, med samlingsnamn appen väljer:

   ```js
   import { beskrivenappdataregelfragment, beskrivningsregelfragment } from "ops-framework";
   beskrivenappdataregelfragment("appdata");        // ALL appdata, en samling för alla beskrivna appar
   beskrivningsregelfragment("appbeskrivningar");   // beskrivningarna själva
   ```

   ⛔ **Deploya reglerna INNAN den klienthalva som börjar läsa samlingarna mergas.** En regel i `main` är inte en regel i produktion
   (bolag-ops, 2026-09-27: `Missing or insufficient permissions` över hela Inkorgen). Catch-all nekar allt som inte har ett block.
2. **Skapa källorna och montera vyn:**

   ```js
   const beskrivningar = createBeskrivningskalla({ source, collection: "appbeskrivningar", groupId, skapare });
   const { beskrivningar: appar } = await beskrivningar.lista();       // bara de som håller, resten står i trasiga
   const kalla = createBeskrivenAppKalla({ source, collection: "appdata", groupId, beskrivning: appar[0].beskrivning, skapare });
   <OpsBeskrivenApp beskrivning={appar[0].beskrivning} kalla={kalla} jag={jag} medlemmar={medlemmar} hubHref="/" />
   ```

3. **På servern (agentens `skapaApp`):** `validateBeskrivning` och svara modellen med `fel` tills den är giltig. Skriv sedan med Admin SDK:
   `const { id, data } = byggBeskrivningsdokument({ groupId, beskrivning, skapadAv, skapad: Date.now() })` och `set(id, data)`.
   Importera från `ops-framework/node`, inte från huvudingången.

### Beslut att granska

- ⛔ **Regeln för raderna läser aldrig beskrivningen.** Beslut 0005: en regel för all appdata. Den låser formen (fälten, `appId` och `lista` på
  id-form, `varden` en map med högst 20 fält, skapare, klocka) och `validateRad` låser innehållet i klienten och på servern. Konsekvensen är
  mätt i provet: en medlem som skriver förbi klienten kan lägga ett värde av fel typ i en rad i sin EGEN grupp. Vyn visar det som text och
  kastar inte. Regeln hade annars behövt ett `get()` av beskrivningen vid varje skrivning, och då hänger varje apps skrivning på ett annat
  dokument. Inget uttryck per värde, så den går inte över Firestores tak på 1000 uttryck (bibliotekets [#349](https://github.com/cllp/ops-framework/issues/349)).
- ⛔ **Appens id står bara i `beskrivning.id`.** Beskrivningsdokumentet har inget eget `id`-fält (planen nämnde ett): dokumentets id härleds
  (`beskrivningsId`, samma schema som modulinställningarna) och reglerna binder id:t till kroppen. Ett tredje ställe för samma id hade
  varit en andra sanning.
- ⛔ **Id med bindestreck.** `lanad-av`, inte `lanad_av`: id-formen är en delmängd av `ID_FORM` utan understreck, så att tilde-delningen i
  dokumentets id är entydig och ett app-id aldrig kan krocka med en annan del. Felet säger det.
- **En rad vars värden inte längre passar beskrivningen läses ändå.** Agenten kan ta bort ett fält. Prövar läsningen värdena blir en app som
  utvecklats osynlig för sin egen data. Bara en rad som saknar sin form (fel grupp eller app, en lista som inte finns) är trasig.
- **Att ta bort en beskrivning tar inte bort raderna.** En borttagen app kan skapas igen med samma id, och då är raderna tillbaka. Att städa
  dem är en körning med Admin SDK.

### Rättat efter granskningen

Ett oberoende granskningspass över de beskrivna apparna hittade inga MÅSTE. Det här är BÖR och provluckor, alla rättade.

- **Ett fält-id som `constructor` visade funktionen `Object`.** `rad.varden[id]` rakt av ger prototypens nyckel för en rad som saknar fältet, och vyn skrev
  "function Object() { [native code] }" i listan, fyllde formuläret med den och sparade den. Alla läsningar av en rads värden och av formulärets fältfel
  går nu genom `Object.hasOwn`. `constructor` är kvar som giltigt id (det är en slug), bara `id` är upptaget.
- **Ett fält med id `id` skrev över radens nyckel i tabellen** (dubbla nycklar i `OpsTable`). `validateBeskrivning` avvisar nu fält-id `id` med ett fel som
  föreslår `id-nummer` (`RESERVERADE_FALTID`), och tabellen sätter radens id sist.
- **Stora värden ritades i full längd och sökningen gjorde `toLowerCase` på dem för varje rad vid varje tangenttryck.** Vyn kortar nu det den ritar och
  söker (text och val till `MAX_TEXTVARDE`, länk till `MAX_LANKVARDE`, lång text till raden, värden av fel typ också, skaparens namn i rubrikraden).
  Regelfragmenten begränsar `skapadAv.namn` och `skapadAv.kalla` (`MAX_SKAPARNAMN` och `MAX_SKAPARKALLA`, 100, nya i `skapare.js`, samma tal i regeln och i
  `byggSkapare`). Regelns huvud säger nu också att ANTALET rader inte är begränsat: en regel kan inte räkna dokument. Det är en känd lucka, inget beslut.
- **En agent med adminroll kunde ändra och radera gruppens rader** (raderna saknade `typ == 'person'` på adminvägen, beskrivningarna hade det). Rättat, med prov.
- **Fem mutanter överlevde de första proven** (`skapadAv.namn is string` i båda fragmenten, beskrivningens `skapadAv.keys().hasOnly`, dess `skapadAv.kalla is string`
  och `opsBeskrivningNu(andrad)` vid skapande), och en sjätte hittades vid omkörningen (`t is int`, ett decimaltal nära nu släpptes igenom). Alla har prov nu. Mot de
  gamla proven överlevde de fem, mot de nya dör de.
- **`byggSkapare` kortar ett namn över 100 tecken och kastar på en `kalla` över 100.** Utan det hade en lång profiltext gett varje skrivning "Missing or insufficient permissions".

### Rättat före utgivningen: `chatt-live-text` föll bara på CI

Publiceringen av 0.99.0 föll på `chatt-live-text.test.jsx:173` ("expected 'boka re' to be ''"), både före och efter rättelsen i 0.98.0 (d85132f). Den rättelsen var en gissning
om vilken effekt som kom först, och den rörde inte orsaken.

- **Orsaken:** fältet gick tillbaka till sin bas i en `useEffect` (`useRostinmatning`). En passiv effekt körs EFTER att renderingen är målad, så renderingen där läget blev "fel" stod i DOM:en med felmeddelandet och den halva
  meningen i fältet samtidigt, tills en senare uppgift tömde den. Provet läste fältet direkt efter att felet hittats, och på en maskin där React:s tidsfönster (5 ms) tar slut
  hinner testbibliotekets `setTimeout(0)` före effekten. Mätt: med `performance.now` låtsat långsam gav provet "expected 'boka re' to be ''" tre gånger av tre. Produkten hade samma glipa: en bild med felet och den halva meningen, som också går att skicka medan den står där.
- **Rättelsen i produkten:** de två effekterna är `useLayoutEffect`. De körs före målningen och deras `setText` renderas synkront i samma uppgift. Provet är orört.
- **Nytt prov som mäter glipan direkt** (`en MutationObserver` körs som mikrouppgift direkt efter en rendering): rött mot `useEffect` varje gång, grönt mot `useLayoutEffect`. Och ett prov för den väg där `talk.text` aldrig töms (inspelningen går inte att avsluta), som visar att läges-effektens återställning behövs och inte var död kod.

### TALK: Svara, bara appens mål i mikrofonen, och andra omgången på iPhone

TALK: bara appens mål i mikrofonen, Svara efter ett kvitto, och en andra omgång som inte längre faller tyst. CP 2026-10-13 kväll.

### Ändrat

- **Mikrofonen erbjuder bara appens mål.** CP: "Ja vi kör på bara text för att få en bra användarupplevelse." Huvudets mikrofon, långtrycket på plus och raden "TALK, prata in" visade modulernas mål (Spara i Biblioteket) bredvid appens, så att en röst till agenten kunde hamna i Biblioteket med ett knapptryck fel. Skalet delar nu listan från `malForInspelning` (som är oförändrad): appens mål till mikrofonen, modulens mål bara genom modulens egen rad (Ny-menyn: Röstinspelning), som öppnar fältet låst till målet utan val. Valet "Skickas till" ritas bara när det finns fler än ett mål, så med ett ensamt appmål finns inget val alls. Utan `talk` öppnar raden "Spela in" fältet låst till modulens första mål.
- Fokus går till **Svara** när ett kvitto kommer (förut Stäng). Skälet: nästa steg i en dialog med agenten är att svara.

### Nytt

- **Svara** på kvittot (CP 22:13, efter en följdfråga från agenten: "Efter att jag pratat en gång finns bara stäng. Sedan kan jag inte börja om."). Primär knapp med mikrofonen som startar en ny omgång i samma fält till samma mål, rensar kvittot och förra omgångens text. Stäng är sekundär, Ångra finns kvar med `angra`. Svara spärras medan Ångra pågår. `talk.svaraText` byter ordet (förval "Svara", på engelska "Reply").
- `useTalk().textFel` och `TALK_TEXTFEL`: fältet säger när texten uteblir (se Rättat).

### Rättat

- **Andra gången man pratade fungerade inte i Safari på iPhone** (CP 22:15). `webblasarensIgenkanning().stoppa()` gav upp efter `IGENKANNING_VANTA_MS` när webbläsaren aldrig sade `end`, men lät igenkännaren leva. Safari tillåter bara en aktiv igenkänning, så `start()` i nästa omgång kastade InvalidStateError, felet sväljdes, och fältet stod med sin platstext utan att något förklarade varför. Nu stängs den gamla igenkännaren (`abort`) både när `stoppa` ger upp och innan en ny startas, och en start som ändå faller, eller ett riktigt fel under tiden, går till felrapporten och till fältet (`role="alert"`, ljudet spelas in och sparas ändå). Igenkännarens `starta` tar valfri `onFel(kod)`. Förra omgångens text rensas nu när nästa börjar, inte först när mikrofonen öppnats. Mätt mot en fejkad Safari-igenkänning med regeln "bara en aktiv", inte mot en riktig iPhone.


## 0.98.0

**Rättat före utgivningen:** publiceringen föll på `chatt-live-text` ("expected 'boka re' to be ''"). Kom läget "fel" i en tidigare rendering än den tömda texten stod en halv mening kvar i chattens fält. Fältet går nu tillbaka till texten från före mikrofonen så fort försöket slutar utan text.

Chattens mikrofon skriver orden i skrivfältet medan man pratar, som TALK. Av som förval: appen slår på det.

CP 2026-10-13, med en skärmbild av chattens skrivfält och raden "Skriver ut det inspelade…" under det efter inspelningen: "VI behöver ha
samma snabba text utskrift även i chatten. Kan vi ordna det?" Och sedan: "kör".

Samma version bär en rättning i Biblioteket: en röstinspelning med våg gick inte att spara (se Rättat nedan).

### Nytt

- **`igenkanning`** på `OpsMeddelanden`, `OpsSamtal` och `OpsTrad`, samma val som `useTalk({ igenkanning })`. Med `true` och en
  webbläsare som har taligenkänning skrivs orden i skrivfältet medan de sägs, och den som stoppar har texten kvar att rätta och
  skicka. Ingenting skickas av sig självt. Det som stod i fältet före mikrofonen ligger kvar, och orden läggs efter med ett
  mellanslag. Fältet är skrivskyddat medan mikrofonen lyssnar (varje delresultat skriver hela fältet, och Enter skickar inte en halv
  mening), och statusraden säger då "Lyssnar. Orden skrivs i fältet medan du pratar. Tryck på ljudvågen när du är klar."
  (`texter.lyssnar`, `role="status"` som förut). Ljudvågens knapp heter och bär `aria-pressed` som förut.
- **Ingen andra kopia av igenkänningen.** Chatten kör `useTalk` med `igenkanning`, alltså `webblasarensIgenkanning` i `lib/talk.js`:
  samma omstart efter tystnad, samma språk (`igenkanningensSprak`, ur appens språk) och samma "hellre ingen text än en halv". TALK
  är orörd.

### Rättat

- ⛔ **En röstinspelning gick inte att spara i Biblioteket ([#349](https://github.com/cllp/ops-framework/issues/349)).** CP 2026-10-13
  20:24, i Chrome på iPhone: en inspelning sparades och svaret blev "Missing or insufficient permissions." Rotorsaken: vågen
  (`peaks`, 48 tal) skrevs på posten när den skapades, och reglerna prövade varje tal som ett eget uttryck. Firestore räknar högst
  1000 uttryck per skrivning, så varje skapande av en inspelning med våg nekades, och bakfyllnaden av en gammal inspelning
  (`onFyllLjud`) nekades av samma skäl. Mätt i emulatorn 2026-10-12 med "maximum of 1000 expressions to evaluate has been reached".
  Att dela prövningen i bitar om åtta (0.92.4) flyttade taket men tog inte bort det.
  **Nu är vågen en sträng**, ett tecken per stolpe, 64 nivåer (tecknen A-Z, a-z, 0-9, `-` och `_`), och regeln prövar den med ett
  enda `matches()`. Fältet heter fortfarande `peaks`, men är en sträng i stället för en lista av tal.
- **`kodaToppar` och `avkodaToppar`** (nya exporter): `kodaToppar` gör `LJUD_STOLPAR` tal mellan 0 och 1 till strängen som sparas
  (och kastar på fel form), `avkodaToppar` gör tillbaka strängen till tal att rita, eller `null` när det inte finns någon sparad våg.
  `peaksGiltiga` prövar nu strängen. `byggPost` och `postFel` avvisar en lista av tal. Mönstret i regeln och i `peaksGiltiga` är
  samma uttryck (`TOPPFORM`), och alfabetet och längden bor på ett ställe.
- **`OpsLjudspelare`:** `peaks` tar strängen, och `onMeta` lämnar `peaks` i samma form, så posten går rakt in och rakt ut.
  `OpsBibliotek` skickar `post.peaks` oförändrad och `onFyllLjud` får strängen. En `peaks` som inte är en giltig sträng kastar inte
  (den kastade förut på allt som inte var en lista): den räknas som att ingen våg är sparad, och spelaren räknar fram den ur ljudet.
- **`createBibliotekskalla.laddaUppFil`** räknar vågen ur filen och skriver strängen. En inskickad `peaks` som är en lista av tal
  räknas inte som en våg, och vågen räknas ur filen i stället.
- ⛔ **Ingen migrering behövs.** Varje skrivning med vågen som lista nekades av reglerna, så ingen post i någon databas bär den.
  Läsaren tål den ändå.

### Oförändrat, med flit

- ⛔ **Av som förval.** Granskningen av PR 358 (MÅSTE 3) kopplade bort igenkänningen i skrivfältet, eftersom Chrome skickar talet
  till Google och Safari till Apple, och ingen app ska börja göra det bara genom att pinna om. Skälet gäller fortfarande. Utan
  `igenkanning` är chatten exakt som i 0.97.0 (provet i `chatt-skrivfalt.test.jsx` står kvar och mäter det).
- **Den gamla vägen är kvar som reserv.** Saknas igenkänningen (Firefox), nekas den eller faller den mitt i, blir texten tom: de halva
  orden tas bort ur fältet, ljudet spelas in som förut och `onTranscribe` skriver ut med "Skriver ut det inspelade…". Faller också den
  står felet kvar med Försök igen, och ljudet sparas. Ljudvågen kräver därför fortfarande `onTranscribe`.
- Avbryt kastar orden som hörts och lämnar fältet som det var.

### För appen

Slå på med `igenkanning` (eller `igenkanning={true}`) på det som ritar chatten. Det är appens beslut, så som det är i `talk.igenkanning`.

⛔ **Bibliotekets regler måste deployas FÖRE klienten som skriver vågen som sträng** (samma ordning som varje ny regel: en regel i
main är inte en regel i produktion). Regenerera appens regelfil ur `bibliotekregelfragment()` (`opsBibliotekToppar` är nu
`p.matches('[A-Za-z0-9_-]{48}')`, utan bitarna `opsBibliotekToppar0` till `5`), deploya reglerna, och pinna sedan om appen. Pinnas
appen om först nekar de gamla reglerna en våg som sträng (`p is list`), och inspelningen faller som förut. Längden går igenom ändå,
eftersom `OpsBibliotek` skickar längd och våg som två anrop. Appar som själva anropar `byggPost`, `createBibliotekskalla.spara`
eller `OpsLjudspelare` med `peaks` ska skicka strängen (`kodaToppar`), inte en lista av tal.

## 0.97.0

TALK kan svara med ett kvitto som går att ångra, statusraden medan appen arbetar går att ange, och fältet är ritat om.

CP 2026-10-13, i Chrome på iPhone: "knapparna är asfula", "jättekonstigt", och "Gör en grafisk genomlysning också. Så att det
blir riktigt snyggt och clean. Kanske texten ska vara lite större som visar vad man pratar in?" Samma dag beslutades att TALK
i lifehub.app ska gå till gruppens agent, som gör det man bad om och svarar med ett kvitto (lifehub.app#219). Det här är
ramverkets del av den skivan.

### Nytt

- **Kvitto och Ångra.** `onTalk` får lösa till `{ kvitto, angra? }`. Fältet visar då kvittot med en bock, **Ångra** (bara när
  `angra` finns, sekundär) och **Stäng** (primär), och döljs inte av sig självt. Ångra snurrar medan den pågår, och ett andra tryck
  gör ingenting. Lyckas den står "Ångrat" i `SPARAT_MS`, sedan stängs fältet. Faller den står felet med
  `role="alert"`, Stäng står kvar och Ångra går att trycka igen. En ny inspelning, ett långtryck eller Stäng rensar kvittot, och en
  Ångra som svarar efter att kvittot försvunnit, eller efter avmonteringen, sätter ingenting. ⛔ Faller den då rapporteras felet
  ändå med `rapporteraFel` (`kvittotBorta: true`): det är det enda spåret av att något inte gick att ta tillbaka. Allt annat `onTalk` löser till
  (ingenting, ett id) är Sparat som förut. Läses av `talkKvitto` i `lib/talk.js`.
- **`skickarText`**, i `useTalk` och `talk.skickarText` i `OpsAppShell`: statusraden medan appen arbetar. Förval
  `TALK_SKICKAR_TEXT`, "Sparar…". En sträng utan innehåll, eller något annat än en sträng, kastar; skalet prövar den vid uppstart.
  ⛔ Den gäller bara appens mål. När ett moduls mål är valt (Biblioteket) är det modulens `spara` som arbetar, och där står förvalet.
- **`useTalk` lämnar `medText`, `skickarText`, `kvitto` och `angra`**, och `OpsTalk` och `OpsInspelning` tar dem (`onAngra` för
  `angra`). Skalet kopplar dem samma väg som `text`.
- **Tillgänglighet.** Kvittot, "Ångrat", "Sparat" och statusraden ("Agenten arbetar…") läses upp ur en statusregion
  (`role="status"`, `aria-live="polite"`) som finns i fältet från första läget, visuellt dold medan den är tom, och byter text.
  En region som föds med sin text läses ofta inte upp. När kvittot visas flyttas fokus till Stäng, inte till Ångra, så att ett
  Enter av vana inte ångrar. Medan Ångra pågår bär knappen `aria-disabled` i stället för `disabled`, så att fokus stannar, och
  klicket spärras i hanteraren.
- **`onTalk` måste lösas eller avvisas inom rimlig tid**, nu dokumenterat i JSDoc och README. Läget skickar har ingen väg ut, och
  ramverket lägger ingen tidsgräns: bara appen vet hur länge dess arbete får ta.

### Fältet, ritat om

- **Texten man pratar in är fältets huvudsak**, i brödtextens storlek (`text-brod`, 16 px, förut `text-meta`, 12 px), med en
  minsta höjd på tre rader så att fältet inte hoppar när orden kommer. Den rullar inuti när den blir lång. Med igenkänningen
  påslagen och inget hört står den dämpade platstexten `TALK_PLATSTEXT`, "Prata, så syns texten här". ⛔ Bara då: utan
  igenkänning (av som förval, Firefox) hade raden lovat text som aldrig kommer.
- **Den övre raden är lugn**: prickarna, tiden och kugghjulet i `ink-muted`. Den står kvar medan det skickas, med stilla prickar,
  så att texten inte flyttar sig när man trycker Klar.
- **Knapparna är en rad**: X (rund, sekundär) till vänster och den primära knappen som fyller resten, samma höjd (48 px) och
  samma rundning. Samma form i felläget och i frågan om att kasta. Sekundärt är `bg-hover`: `bg-sunken` är nästan samma färg som
  fältet i ljust läge, och krysset flöt då i luften.
- **Målvalet är en segmenterad rad** med etiketten "Skickas till", lika breda delar, i stället för staplade knappar i fältets
  primärfärg som såg ut som Klar. Spåret är nedsänkt och det valda lyft i båda lägena. Rollerna `radiogroup` och `radio` med
  `aria-checked` står kvar.

### Prov

`talk-kvitto.test.jsx`, 25 prov, flödet genom `OpsAppShell talk={...}` och kroken direkt där en knapp inte kan visa felet. Varje
prov sett rött med sin rättelse borttagen och grönt med den. Inga prov från före 0.97.0 behövde ändras. Inom 0.97.0 ändrades två
efter granskningen: Ångra-knappen provas nu mot `aria-disabled` och kvarvarande fokus i stället för `disabled`, och provet för en
Ångra som faller efter avmonteringen kräver nu en felrapport i stället för tystnad.

### Bilder

Före och efter vid 390 px i ljust och mörkt läge, i lägena lyssnar med text, lyssnar utan text, skickar och sparat med kvitto,
tagna med Playwright mot en byggd sida. De bifogas i PR:en.

## 0.96.0

TALK kan visa texten medan man pratar, och den hela texten följer med till appen. Av som förval: appen slår på det.

CP 2026-10-13: "Min upplevelse är att det nu tar lång tid för transkribering och det är ingen smidig AI upplevelse." Och om
förslagen i lifehub.app#209: "vi kör på 3 direkt", alltså text som syns medan man pratar.

### Nytt

- **`webblasarensIgenkanning()`** i `lib/talk.js`: webbläsarens taligenkänning (`SpeechRecognition`, i Safari och Chrome
  `webkitSpeechRecognition`), eller `null` när den saknas. Den startar om sig själv när Chrome avslutar efter tystnad och
  behåller det som redan hörts, men högst tre gånger per sekund.
- **Hellre ingen text än en halv.** Texten blir tom när igenkänningen fallit (också `aborted`, alltså ett samtal eller ett annat
  ljudpass som bryter mitt i), när ett ord fortfarande är preliminärt när den stoppas, eller när webbläsaren inte ger sitt sista
  besked inom `IGENKANNING_VANTA_MS`. Tystnad (`no-speech`) är inget fel. Varje försök har sitt nummer, så att en avbruten
  igenkännare som svarar sent aldrig skriver in i nästa försök.
- **`useTalk({ igenkanning: true })`**, och `talk.igenkanning: true` i `OpsAppShell`, slår på den. Kroken lämnar då `text`
  medan man pratar och `onTalk(blob, { text })` när texten är hel. **Ljudet spelas in som förut, alltid.** Utan text får appen
  bara ljudet. Ett eget objekt med `starta`, `stoppa` och `kasta` går också att ge.
- **`OpsInspelning` och `OpsTalk`** tar `text` och visar den medan man pratar och medan det sparas, med `aria-live="polite"`.

### ⛔ Vart talet går, och därför är den av som förval

Chrome skickar talet till Googles taltjänst och Safari till Apples. Det är en annan väg än appens egen modell, och en app med
kundmaterial ska inte börja använda den bara genom att pinna om. Därför är igenkänningen av tills appen slår på den, och
chattens skrivfält använder den inte alls: där går talet bara till appens egen `onTranscribe` (granskningen av PR 358).

### Prov

`talk-text.test.jsx` (19 prov) och ett vänt fall i `chatt-skrivfalt.test.jsx`, med fejkad `SpeechRecognition`. Sedda röda utan
sin rättelse: försöksnumret, preliminär text vid stopp, tidsgränsen, `aborted`, omstartstaket, av som förval, och de första
fallen (en halv text som hel, ingen omstart, texten följer inte med, Avbryt kastar inte texten).

## 0.95.1

Rullningslistens tumme syns i båda lägena, och väljarens lista är minst lika bred som fältet.

### Felet

- **Tummen.** 0.95.0 målade den `color-mix(in srgb, var(--color-ink-muted) 50%, transparent)`. Mätt i lifehub.app:s ompinning till 0.95.0 (montaget `docs/jamforelser/rullningslist-idag-390.jpg` i lifehub.app PR 206): i mörkt läge syntes tummen knappt mot `bg-surface`, mest i Idags ruta, och operativsystemets grå list före 0.95.0 syntes bättre. Mot Identitys beige yta var den också svag. Räknat ur tokens efter blandningen: 1,77 till 1,80:1 i ljust läge och 2,11 till 2,34:1 i mörkt, mot `canvas`, `surface`, `raised`, `sunken` och `elevated`. WCAG 1.4.11 kräver 3:1 av en grafisk del som visar läget. Standardvägen hade dessutom inget hover-läge alls.
- **Väljarens lista.** I Identitys AI-nycklar (`docs/jamforelser/kontroller/ai-leverantor-1440.jpg` i lifehub.identity) var fältet Leverantör cirka 640 px och den öppna listan i `OpsSelect` cirka 150 px, bara så bred som "Annan / custom". Mätt här: 131 px under en 608 px knapp. Samma `Select.Content` finns i `OpsTimePicker`.
- **Ingen vakt såg något av det.** `check-kontrast` mätte text mot yta, och tummen är ett uttryck och inte ett token: ett par "ink-muted mot canvas" hade varit grönt i 0.95.0 också. jsdom ritar ingen list och räknar ingen bredd.

### Rättelsen

- **Tummen är hel `--color-ink-muted`** i vila: 3,65 till 3,86:1 i ljust läge och 4,18 till 5,45:1 i mörkt.
- **Med pekaren på den rullande ytan är den `--color-ink`** (`:where(:not(html)):hover`), i Safari på `::-webkit-scrollbar-thumb:hover`. `ink` och inte `ink-secondary`, mätt i Chromium 141: Chromium tonar själv tummen mot en mellangrå när pekaren står på den, och hovrad `ink-secondary` blev då 3,84:1 i mörkt läge mot `raised`, svagare än vilans 4,47:1. Hovrad `ink` blir 6,53:1 där. `html` är undantagen, annars hade sidans list alltid stått i full `ink` så fort pekaren är i fönstret.
- **Bara tokens.** En instans brandfil styr fortfarande listen. `examples/brand/lifehub.css` skriver inte över `canvas`, `surface`, `raised`, `sunken`, `elevated`, `ink-muted` eller `ink`, alltså gäller samma tal för Life Hub.
- **Stegpilarna i Chromium på Linux och Windows står kvar, med skälet i `tokens.css`.** När `scrollbar-color` eller `scrollbar-width` är satt läser Chromium inget av `::-webkit-scrollbar*`; `::-webkit-scrollbar-button { display: none }` provades och gav en bild som var identisk byte för byte. Den enda vägen bort är att släppa standarden i Chromium. Pilarna fanns också i operativsystemets list före 0.95.0.
- **`OpsSelect` och `OpsTimePicker`:** listan får `min-w-(--radix-select-trigger-width)` (`faltListaBreddKlass` i `radKlass.js`), variabeln Radix själv sätter i `position="popper"`. Min och inte bredd, så ett alternativ längre än fältet får plats.

### Vakterna

- **`check-kontrast`** räknar nu tummen ur de fyra uttrycken i basskiktet (standarden i vila och under pekaren, Safaris tumme i vila och under pekaren), sammansatta med sin genomskinlighet över fem ytor i båda teman. Röd under 3:1, röd när hover är svagare än vila, röd när ett uttryck saknas eller inte går att läsa. Golv 40 mätningar. Röd mot 0.95.0:s `tokens.css` (1,77 till 2,34:1, och hover saknas). `test-guards` planterar 0.95.0:s uttryck, tar bort hover-regeln och vänder vila och hover, och kräver rött för alla tre.
- **Ny: `scripts/check-kontrollyta.mjs`** (`npm run check:kontrollyta`, i `check:all` och i CI-jobbet med webbläsare). Startar Chromium utan `--hide-scrollbars`, ritar listor på `canvas`, `surface` och `raised` och en väljare i Identitys 640 px, i ljust och mörkt läge och i 1440 och 390 px. Mäter tummens ritade pixel i vila, med pekaren på ytan och med pekaren på tummen, och att väljarens lista är minst lika bred som knappen. Golv: varje lista måste ha en ritad list och en tumme, väljaren sex alternativ. Röd mot 0.95.0 med 20 brott av 40 mätningar, grön nu. `--bilder` och `--montage` ger montaget i `docs/jamforelser/0.95.1/`.
- **`startaWebblasare`** tar `{ visaRullningslister: true }`.

## 0.95.0

Inga ostylade webbläsarkontroller, varken i ramverket eller i apparna, och en vakt som apparna kör.

CP 2026-10-13, med skärmbilder från Life Hub Identity där Leverantör under AI-nycklar visar webbläsarens egen grå `<select>`-lista: "Alla dropdowns mm skall vara brandade från ramverket och uppåt. Det skall aldrig finnas en ostylad komponent som använder webläsarens scroll eller style."

### Mätt samma dag

- `src/components/OpsSelect.jsx` sade själv att rå `<select>` är förbjuden i produkt-UI.
- `src/components/OpsBibliotek.jsx:1324` hade ändå en rå `<select aria-label="Grupp att dela till">`.
- Identity hade tre i `web/src/main.ts`, byggda som HTML i strängar. De rättas i Identity, inte här.
- Ingen vakt fångade något av det. Förbudet stod i en kommentar.
- Genomsökningen av hela `src/` hittade två till: ett **synligt** `<input type="file">` i `OpsBibliotek` (filposten) och ett i `OpsAgenter` (importera kunskap), alltså webbläsarens "Välj fil, ingen fil vald". Inga `<datalist>`, inga `type="date"`, `"time"`, `"color"` och liknande.
- Ramverket hade **ingen rullningsliststil alls**. Tjugo komponentfiler med `overflow-auto` och sidan själv ritade operativsystemets list.

### Rättelserna

- **`OpsBibliotek`, delning:** gruppvalet är `OpsSelect` i en `OpsField` med etiketten "Dela till", samma tillgängliga namn ("Grupp att dela till") och samma beteende.
- **`OpsBibliotek`, filposten, och `OpsAgenter`, importera kunskap:** filfältet är dolt (`hidden`) bakom en `OpsButton` ("Välj fil", i Biblioteket "Byt fil" när en fil är vald). Biblioteket skriver ut den valda filens namn, och tomheten med: "Ingen fil vald." eller "Den sparade filen behålls." när en befintlig post redigeras. `OpsAgenter` får ordet `valjFil` (sv och en).
- **Rullningslisten i basskiktet (`tokens.css`):** `* { scrollbar-width: thin; scrollbar-color: ... }` för Chrome, Edge och Firefox, och `::-webkit-scrollbar` bakom `@supports not (scrollbar-color: auto)` för Safari. Tummen är `--color-ink-muted` till hälften genomskinlig, skenan är genomskinlig, så listen följer ljust och mörkt läge och en instans brandfil. Basskiktet och inte `ops-ramverk`, så en verktygsklass som avsiktligt döljer en list fortfarande vinner. Appar får den utan att göra något.

### Vakterna

- **Ny: `scripts/check-webblasarkontroller.mjs`** (`npm run check:webblasarkontroller`, i `npm run check`). Fäller `<select`, `<datalist`, `createElement("select" | "datalist")`, `type="date"`, `"time"`, `"datetime-local"`, `"month"`, `"week"` och `"color"` (som attribut, escapat i en sträng, som `el.type =` och via `setAttribute`), och ett synligt `<input type="file">` eller `type="range"`. Läser `.js`, `.jsx`, `.ts`, `.tsx` och `.mjs`, kommentarer bort och strängar kvar. Undantagslistan står i vakten med skäl, och den är tom. Golv 150 filer i ramverket och 5 i en app. Taket är noll i ramverket; en app med kända fynd sätter `--tak=N`, och vakten är röd både över och under taket.
- **I en app:** `node node_modules/ops-framework/scripts/check-webblasarkontroller.mjs src`. Mallen i `create-ops-app` kör den i `check`, i CI och i `pre-push-gate.sh`.
- **`check-page-frame`** kräver nu också rullningslistens regler i basskiktet, ur tokens och utan hårdkodad färg.
- **Bevisat i båda riktningarna.** Mot `src/` före rättelsen: röd med tre fynd (`OpsBibliotek.jsx:1324` `<select>`, `OpsBibliotek.jsx:1128` och `OpsAgenter.jsx:874` synligt filfält). Efter: grön, 236 filer, 0 fynd. `test-guards` planterar en rå select i en sträng i en `.ts`-fil, en i JSX, en `<datalist>`, `type="date"`, ett escapat `type=\"datetime-local\"`, `createElement("select")` och ett synligt filfält, och kräver rött för vart och ett; ett dolt filfält, `<Select.Root>` och en kommentar som citerar förbudet kräver grönt; ett tak över utfallet, ett för tunt underlag och en fel sökväg kräver rött. `check-page-frame` provas röd utan `scrollbar-color`, utan Safaris tumme och med en hexfärg, och mot 0.94.3:s `tokens.css`.
- **Två nya prov i `bibliotek-vy.test.jsx`** (gruppvalet väljer den andra gruppen genom väljaren och den når `onDela`; filfältet är dolt och den valda filen skrivs ut) och ett tillägg i `agenter.test.jsx`. Båda Biblioteksproven är röda mot 0.94.3:s `OpsBibliotek.jsx`.

### Vad vakten inte bevisar

- Att en kontroll SER rätt ut. Den mäter att webbläsarens egen kontroll inte används, inte hur ersättaren ritas. Rullningslistens utseende är en CSS-regel som vaktas på plats, inte en mätning i en webbläsare.

---

## 0.94.3

Inspelarens valda mål stod kvar efter inspelningen. lifehub.app#187, mätt i lifehub.app PR 200.

### Felet

- **Mätt:** efter en Röstinspelning ur Bibliotekets Ny-meny, sparad eller avbruten, stod Biblioteket kvar som valt mål nästa gång någon långtryckte på plusset eller tryckte på TALK. TALK:s förval, appens första mål ("Förslag" i lifehub.app), hade flyttat utan att någon valt det, och nästa inspelning hade hamnat i Biblioteket.
- **Orsaken:** `OpsAppShell` håller målet i `valtInspelning`. `oppnaInspelning` sätter det, och ett val i fältet sätter det, men ingenting nollade det. Samma sak gällde ett mål som valdes i fältet under en plusinspelning: valet låg kvar till nästa gång.

### Rättelsen

- **`OpsAppShell`:** `valtInspelning` blir `null` när inspelningen är över, alltså när `talkStyr.lage` går från ett annat läge tillbaka till `"vila"`: efter Sparat, efter Avbryt och efter att ett fel stängts. Bara på övergången, aldrig medan läget redan är vila: `oppnaInspelning` sätter målet och anropar `direkt()` i samma händelse, och en återställning på "läget är vila" hade nollat målet innan inspelningen startat om övergången någon gång blir asynkron.
- **Tre nya prov i `bibliotek-plus.test.jsx`:** sparad röstinspelning, avbruten röstinspelning (med ett val i fältet under en plusinspelning) och att röstinspelningen fortfarande sparas i modulens mål efter en återställning. De två första är röda utan rättelsen och gröna med den.

---

## 0.94.2

Samarbetet står i kanon, överst efter metaregeln. Ingen kod ändras.

### Vad

- **Avsnittet "Samarbetet" (S1 till S11) i `CLAUDE.md`**, ur SessionStudios `memory/samarbete.md`: förslag i stället för förhör, vänta på kör, vem som äger vad, utmana en gång, kort skrivet med området först och varje steg med sin länk. CP 2026-10-12: "Detta måste finnas högst upp i minnet i varje repo." Det fanns bara i SessionStudio, och samma kväll fick CP fråga om reglerna fanns i minnet här. De gjorde det inte.
- **Regel 3 får ett tredje mätfel** ur SessionStudios arbetssätt: kod visar vad som kan hända, bara data visar vad som har hänt.
- **Regel 14** ur samma källa: ett rött utfall som passerar isolerat är en misslyckad mätning, inte ett resultat.
- **`lifehub.app`** står med bland konsumentrepona i inledningen. Det bär redan en genererad kopia.
- **`AGENTS.md`**: en hänvisning till `CLAUDE.md` för agenter som läser den filen i stället (Codex, Cursor). Den är en hänvisning och ingen kopia, så den kan inte glida isär.

### Vad som inte kom med

Resten av SessionStudios arbetssätt (roller, deployfönster, grindens flöde, kostnader och lanes) handlar om SessionStudios egna maskiner och människor och hade blivit cargo cult här, samma skäl som kanonens inledning ger.

---

## 0.94.1

Kalenderns veckodagar tappade vikt 500 från 640 px. Mätt i lifehub.app:s ompinning till 0.94.0.

### Felet

- **Mätt:** veckodagsraden i `OpsCalendar` (`text-liten ... sm:text-hjalp`) gick från vikt 500 till 400 från `sm` (640 px). 0.94.0 tog bort `font-medium` som "dubbel vikt". Men `text-liten` är 500 och `text-hjalp` är 400, och en uttrycklig vikt går före rollens på alla bredder (Tailwind skriver rollens vikt som `var(--tw-font-weight, rollens)`). `font-medium` var alltså det som höll 500 från `sm`; den var inte dubbel där.
- **Orsaken var vakten.** `check-typografi` såg rollen utan brytpunkt (`text-liten`) och räknade vikten som dubbel även när en responsiv roll med annan vikt gäller på samma element. Vakten pekade ut ett ställe som inte var fel, och rättningen efter den skapade felet.

### Rättat

- **`check-typografi`:** en vikt är dubbel bara om den är lika med vikten hos varje roll som gäller på elementet, basrollen och de responsiva (`sm:text-*`, `md:text-*`). En vikt med brytpunkt (`sm:font-medium`) jämförs bara mot rollerna med samma brytpunkt. Fem nya fall i `test-guards`: tre gröna/röda enligt uppdraget (`text-liten font-medium sm:text-hjalp` grön, `text-liten font-medium` röd, `text-liten sm:font-medium` grön) och två röda gränsfall (alla gällande roller lika, variantvikt lika med variantens roll). Den gamla vakten är röd mot det gröna fallet (provat mot 0.94.0:s `check-typografi` på sex filer), den nya grön.
- **`OpsCalendar`:** veckodagarna har `font-medium` igen, 500 på alla bredder.
- **Revision av 0.94.0 mot 0.93.0:** varje ändrad klasssträng i `src/` jämfördes bredd för bredd (bas, `sm`, `md`, `lg`, `xl`) med uttrycklig vikt före rollens. 22 strängar ändrade vikt 700 till 600 och det är avsikten (`font-bold` fälls). **Exakt en ändrade vikt av en annan orsak: veckodagsraden.** Inget annat ställe tappade en vikt.

## 0.94.0

Typografin på ett ställe, ett publikt skal, ett brandkontrakt och lager. lifehub.app#165, CP 2026-10-10 och 2026-10-12. Ersätter utkastet #344.

### Typografi: tre vikter (lifehub.app#165, beslut 3a)

- **Rollernas vikter.** `text-rubrik`, `text-titel` och `text-sida` är 600 (var 700); `sektion` är redan 600. **700 finns bara på räknemärkets siffror** (`mikro`, `raknare`). SS har 700 på rubrik och titel; det är ett medvetet avsteg. `text-sida` var 700 sedan 0.31.2 och `SIDRUBRIK_KLASS` la `font-semibold` ovanpå (0.90.1, lifehub.app#146); vikten är nu rollens och ingen klass korrigerar den.
- **44 ställen i komponenterna** rättade (mätta av `check-typografi` före ändringen): `font-bold` borttaget på 18 och sänkt till `font-semibold` på 6 (den runda hjälpknappen i `OpsHelp` och `OpsModulRam`, TALK-ordet, kalenderns valda dag, datumväljarens idag, rubriken i `OpsKalendrar`), och en vikt ovanpå en roll som redan bar den borttagen på 20. Stat-värden, summor och kalenderns antal är 600 i stället för 700.
- **Fältet:** `text-brod` (16 px) och `md:pointer-fine:text-etikett` (14 px) från `md` med en exakt pekare (beslut 2a+c). Villkoret är pekaren och inte bara bredden: en stående iPad är 768 px bred och zoomar in vid fokus i ett fält under 16 px.
- **`check-typografi`** fäller `font-bold` (också som variant) och dubbel vikt: en roll och en vikt den redan bär i samma klasssträng (strängen är enheten och inte raden). Rollernas vikter läses ur `tokens.css`, inte ur en lista i vakten. En sänkning under rollens vikt och emfas på en 400-roll är tillåtna. Provad rött och grönt i `test-guards` (10 fall).
- **Ändrat mot utkastet #344:** #344 formaterade om hela `sessionstudio-profil.json` (300 rader brus) och tappade indraget på rader i 20 komponenter; det är gjort om kirurgiskt på 0.93.0. #344 lämnade `titel` på 700 och `mikro` utan sin `font-semibold` (vikten gick från 600 till 700 på tre ställen); och dess `docs/typografi.md` sade att ingen hubb brandar typsnitt, vilket CP ändrade 2026-10-12.

### Publika sidor: roller och komponenter

- **Roller:** `text-publik-rubrik` (2,25 / 3 / 3,5 rem, 500, radhöjd 1,05), `text-publik-sida` (2,25 / 3 rem, innehållssidans h1), `text-publik-block` (1,875 / 2,25 rem, blockets och avsnittets h2), `text-publik-ingress`, `text-publik-brod` (radhöjd 1,625) och `text-publik-eyebrow`, i steg vid `sm` och `lg`. De bor i `typografi.publik` i profilen (mätta ur SessionStudios landningssidor, med fil och rad) och genereras till `tokens.css` av `generate-tokens` (nytt markörpar för stegen). Rubrikfamiljen är `--font-display-publik` (Georgia, serif) och läsbredden `max-w-las` (65ch).
- **Komponenter:** `OpsPublikSkal`, `OpsPublikHuvud`, `OpsPublikHjalte`, `OpsPublikBlock`, `OpsPublikUppmaning`, `OpsPublikFot`, `OpsPublikAvsnitt` och `OpsPublikText`, och klasserna `PUBLIK_KLASS`, `PUBLIK_KNAPP` och `PUBLIK_TONER`. Efter SessionStudios `LandingShell`, `LandingNav`, `LandingHero`, `LandingFeatureBlock`, `LandingCtaBlock` och `LandingFooter`, utan adresser, text och bilder: allt är props. Toppraden är en rad på en plats (56 px, `max-w-7xl`) och loggan ligger på samma pixel på varje sida.
- **Innehållssidans färger är de publika tonernas.** `PUBLIK_KLASS` använde appens `text-ink`, `text-ink-secondary` och `text-accent`; nu `text-publik-ljus-text`, `text-publik-ljus-dampad` och `text-publik-markering`, samma som `PUBLIK_TONER.ljus`, så brandfilen styr innehållssidan och inte bara blocken. `check-brand` mäter de renderade färgerna och kontrasten på hjälte och avsnitt med båda brandfilerna, röd mot den gamla koden.
- **Spärrningen -0,01em** (SS `--letter-spacing-tight`, som SS landningsrubriker ärver av appens `h1` till `h3`) ligger i rubrikrollernas token (`rubrik`, `sida`, `block`), inte i en klass. `check-brand` mäter rubrikbredden mot SS spärrning och är röd utan den.
- **Tre toner** (`ljus`, `accent`, `mork`) som SS `TONE_STYLES`, med bildens toning per ton. En figur (SVG) kan ersätta fotot.
- **Rytmen mellan blocken ägs av ramverket** (CSS i `ops-ramverk`-lagret med syskonväljare, ingen prop): 96 px mellan två block i samma ljusa ton, efter fotohjälten före ett ljust block och före uppmaningen, 0 mellan olika toner (SS `HomePage.jsx:31` och `FeaturesPage.jsx:31`); en innehållssidas avsnitt 80 px, 96 från `sm` (`HowItWorksPage.jsx`). Innehållssidans hjälte och avsnitt har SS mått (`text-publik-sida` 36/48 px, avsnittet i `max-w-[1080px]`).

### Brand och lager

- **Lager.** Ramverkets olagrade CSS (mörkeraliasen, `--z-*`, säkra ytor, `.ops-sidoyta`) ligger i `@layer ops-ramverk`, deklarerat efter `utilities`. En instans olagrade regel slår alla lager utan `!important`. Före 0.94.0 slog `:root:not([data-theme="light"])` (0,2,0) en instans `:root` (0,1,0) i mörkt läge.
- **Brandkontraktet** `tokens/brand-kontrakt.json` (39 variabler): rubrik-, publik rubrik- och märkesfamilj, accent i ljust och mörkt läge, märkets mått och de publika tonerna (`--color-publik-*`). Nytt: `--font-display-publik`, `--color-publik-*`, `--publik-logga-hojd`, `--container-las`. Allt annat är internt.
- **Exempel:** `examples/brand/brand.css`, `sessionstudio.css` (SS exakta värden), `lifehub.css` och `egen.css`. Dokumentation i `docs/brand.md` och README.
- **`check-brand`** (ny, `check:brand`, `check:all`, `check.yml` och `publish.yml`): mäter i Chromium att brandfilen ändrar den beräknade stilen, att en olagrad regel vinner, att loggan ligger på samma plats på två sidor i 1280 och 390 px, att mobilmenyn fungerar, att ingen sida scrollar i sidled i 390 och att SS och Life Hub ger sina toner; räknar kontrasten för varje ton i båda brandfilerna. `--bevisa` kräver rött utan lagren, rött för en brandfil utan typsnittsraden och rött när toppraden läggs i en smal centrerad kolumn.
- **`check-token-overrides`** följer stilrotens relativa importer: `brand.css` kontrolleras som variabelfil mot kontraktet, övriga importer är egen CSS, fri men räknad (antalet skrivs ut även när det är noll). Regel 6 är oförändrad för stilroten.

### Vad en konsument behöver göra

- **Ompinna** till 0.94.0 (release-URL i PR-texten). Lagren är bakåtkompatibla för en app som bara importerar tokens; en egen regel som av en slump förlorade mot mörkerblocken vinner nu.
- Kör `npx ops-framework/scripts/check-typografi.mjs src` mot appens källa: `font-semibold` på en rubrikroll och `font-bold` pekas ut.
- Vill appen branda: flytta färg- och typsnittsraderna till en `brand.css` enligt `examples/brand/`.

---

## 0.93.0

Granskningsfynd från 2026-10-12: en regelfix, utgivningsgrinden, ljudet och sparandet. Utges som 0.93.0, efter 0.92.5.

Fynden är verifierade mot main före ändringen, och varje prov är sett rött utan sin fix och grönt med den (se PR-texten).

### Säkerhet: modulinställningarnas id är bundet till kroppen

- `modulinstallningsregelfragment`: dokumentets id måste vara `<längd>~<groupId>~<modulId>` med kroppens egna `groupId` och `modulId`, både vid `create` och `update`. Förut läste reglerna bara kroppen: ägaren av grupp A kunde skriva en rad med `groupId: A` på det id som grupp B skulle använda. Klienten läser B:s rad på det id:t, hittar A:s innehåll, och B:s ägare kunde inte skriva över den, eftersom `update` prövar ägarskap mot radens `groupId`. Id-formen `ID_FORM` släpper inte in ett tilde, så uppdelningen är entydig.
- `bibliotekregelfragment(namn, { gruppPrefix, postPrefix })`: en filposts `fil.sokvag` måste ligga i postens egen grupp, `{gruppPrefix}/{groupId}/{postPrefix}/...` (förval `grupper` och `bibliotek`, samma form som `lagringsregelfragment({ bibliotek })`). En medlem i grupp A kunde skapa en post i A som pekade på en fil i grupp B. Ingen server läser fältet i dag, men en framtida städning med Admin SDK, som går förbi storage-reglerna, hade raderat B:s fil. Segmenten jämförs med `==` och inte med ett reguljärt uttryck, så grupp `cps` blandas inte ihop med `cps-ab` och ett `groupId` kan inte föra in regex-tecken. Sökvägen är exakt fem icke-tomma segment (`{gruppPrefix}/{groupId}/{postPrefix}/{postId}/{filnamn}`), `postId` är dokumentets id (som i appens `biblioteksokvag`), inget segment är `.` eller `..`, och inget styrtecken (radbrytning, tabb, NUL) finns. Förut släpptes `grupper/cps-ab/bibliotek/p<radbrytning>/../../../miranda-ab/bibliotek/q/f` igenom av `..`-kontrollen, eftersom RE2:s punkt inte matchar radbrytning (mätt i emulatorn), och `split` släpper ett avslutande tomt segment, så en avslutande `/` räknades inte. Gäller både `create` och `update`. ⛔ Använder appen andra prefix än `grupper` och `bibliotek` måste den skicka dem hit också, annars nekas dess egna uppladdningar.
- Regelprovet använder nu de riktiga id:n ur `modulinstallningsId` och inte `ny-1`, och provar rätt id, fel grupp, fel modul, fel antal delar, en ändring på ett fel id, samt åtta poster (går) och nio (nekas).

### Utgivning

- `publish.yml` kör nu `check:skalyta` (med Chromium, som `check.yml`) före utgivningen. Skalytevakten var röd från 0.90.4 till 0.91.0 och sju versioner gick ut ändå, eftersom utgivningen bara körde `check` och `check:paket`.
- Ny vakt `check:lasversion`: `package.json` och `package-lock.json` måste säga samma version (tre tal, golvet är antalet tal som faktiskt lästs ur filerna). Mätt på main före den här versionen: `package.json` 0.92.5 mot lockfilen 0.92.4. Provad rött och grönt i `test-guards`.

### Ljud och svep

- `OpsSvepRad`: ett svep som börjar på ett `input[type=range]` (ljudvågen) drar inte upp raden. Avmonteras raden under Ångra-fönstret (flikbyte, sökning, en öppnad detalj, ett gruppbyte) **avbryts** raderingen och `onValj` körs aldrig: en destruktiv åtgärd sker inte utan att Ångra syns. Posten finns kvar. En första version i den här PR:en körde `onValj` vid avmontering och drogs tillbaka (beslut 2026-10-12).
- `OpsLjudspelare`: reglagets `step` är 1 (det blev över 1000 för ljud kortare än fem sekunder). Piltangenterna sköts av spelaren: vänster och höger (och ned och upp) flyttar 5 s, Home och End går till början och slutet, eftersom en pil annars flyttar en tusendel, 0,6 s på tio minuter. Är längden känd ur posten (`durationMs`) hoppas sökhacket för `Infinity` över. Nytt prov att `timeupdate` flyttar både tiden och förloppet.
- `OpsBibliotek`: längd och våg skrivs på posten (`onFyllLjud`) bara när den som tittar får ändra posten (`farAndra`). Längden visas för alla ändå. Längden och vågen skickas som **två anrop, i ordning** (`{ id, durationMs }` och sedan `{ id, peaks }`), så att längden går igenom även när vågen nekas av reglernas uttryckstak ([#349](https://github.com/cllp/ops-framework/issues/349)). Ett fel loggas i konsolen med postens id, det sväljs inte.
- `createBibliotekskalla.spara`: ett anrop som bara fyller i `durationMs` och/eller `peaks` flyttar inte `andrad`, så posten hoppar inte överst i listan för att någon lyssnade. Bibliotekets regel släpper just den formen utan ny tid; allt annat kräver fortfarande serverns klocka.
- Inspelningstaket följer målet. Ett mål på `inspelning.mal` kan bära `maxSekunder` (positivt heltal), och skalet skickar det till `useTalk`. Bibliotekets mål ska ange `IDE_MAX_SEKUNDER` (600). Förut anropades `useTalk` utan tak, så Bibliotekets inspelning kapades vid 120 sekunder. `useTalk` räknar nu om taket när målet byts under pågående inspelning, och räknar det (och sekunderna i fältet) från att mikrofonen faktiskt är öppen och inte från trycket: en mikrofonprompt på 30 s gav annars 90 s ljud i stället för 120, och en på 130 s gav 0,001 s.

### Sparande som faller

- `OpsDokument` och `OpsBibliotek` (formuläret och Byt namn): ett kast eller ett avvisat löfte från `onSpara` visas och läget står kvar. Förut sväljdes det (`catch (e) { return; }`, `.catch(() => {})`). En `sparar`-flagga spärrar ett andra tryck medan det första pågår. Ett svar `false` får en text ("Posten kunde inte sparas.", "Namnet kunde inte sparas."). Avbryt nollar felet och släpper flaggan, och ett avslag som kommer efter Avbryt ignoreras i stället för att visas i nästa redigering.

### Agenter

- `OpsAgenter`: modellvalet är avstängt och märkt "Kommer" som förval, utan Spara, och kvitterar aldrig "Sparat." Appen slår på det med `modellvalAktivt` när dess funktioner läser fältet. Förut sparade vyn ett val som appen avvisade och skrev ändå "Sparat.".

### Hjälp

- "Roller i gruppen": det är ägaren, inte admin, som installerar appar, väljer huvudmenyn och arkiverar. Texten lovar inte längre att ägaren "ändrar roller" eller "överlåter ägarskapet": medlemskap skrivs aldrig av en klient och ingen funktion i ramverket gör det. Provet läser fältlistorna som reglerna byggs ur och kräver att varje påstående har en grund.

### Språk

- Tankstreck i `CHANGELOG.md` (0.92.2), `src/data/bibliotekkalla.js` och `src/__tests__/bibliotekkalla.test.js` är utbytta mot kolon och komma.

### Regler och funktioner

Två regelfragment ändras, så en app som limmar in dem måste skriva om sina regler (`--skriv` mot kanonen) och deploya dem **innan** den klient som börjar använda ändringen mergas:

- `modulinstallningsregelfragment`: id bundet till kroppen (säkerhet, se ovan). Klienten (`modulinstallningsId`) skriver redan rätt id, så ingen klientändring behövs.
- `bibliotekregelfragment`: filens sökväg måste ligga i postens egen grupp (säkerhet, se ovan). En app med andra lagringsprefix än `grupper` och `bibliotek` skickar dem som andra argument.
- `bibliotekregelfragment`: en uppdatering som bara rör `durationMs`/`peaks` får lämna `andrad` som den var. Deployas reglerna inte först nekas bakgrundsskrivningen av längden, och listan visar längden ändå.

⛔ **Känd gräns, inte åtgärdad här ([#349](https://github.com/cllp/ops-framework/issues/349)):** en skrivning med `peaks` (48 tal) nekas av Firestore med "maximum of 1000 expressions to evaluate has been reached", både `create` och `update`, mätt i emulatorn på main före den här versionen. Längden ensam (`durationMs`) går igenom. Vågen kan alltså inte sparas på posten förrän `opsBibliotekToppar` görs billigare. (Åtgärdat i 0.98.0: vågen är en sträng.)

---

## 0.92.5

Biblioteket enhetligt för alla typer. Utges som 0.92.5, efter 0.92.4.

CP 2026-10-10: "Jobba igenom bibliotek ordentligt. Kolla så att det är enhetligt i ramverket." Live på iPhone: anteckningens rubrik var för stor och delade rad med ikonen och Redigera. Radera ska fungera som på ljudraderna för varje typ.

### Detaljhuvud

- Gemensamt `BibliotekDetaljHuvud`: Tillbaka, ikon och ⋯ på en rad; rubriken på egen rad med rollen `text-rubrik`; metadata under.
- `OpsDokument` ritar inte längre `text-sida`/`font-display` på samma rad som verktyg. Pennan (när den används) står i en egen verktygsrad. Biblioteket styr Redigera via ⋯, samma som ljud.
- Skalyta mäter detaljhuvudet vid 390 och 1280 px.

### Lista och radera

- Gemensam `BibliotekListrad` (ikon, rubrik, meta, ⋯). Ljud fyller innehållet (spelare) men delar ⋯ och svep med övriga typer.
- Radera: ⋯ och svep i listan, ⋯ i detaljen, bekräftelse (modal) respektive Ångra (svep), för anteckning, länk, ljud och fil.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras.

## 0.92.4

Ljudraden i Biblioteket. Utges som 0.92.4, efter 0.92.3.

CP 2026-10-10, iPhone, Bibliotek i 0.92.3: den runda spelknappen låg på musikikonen, längden stod `0:04 / 0:00`, vågen var en platt grå rand, kontrollerna var ihoptryckta, och rubriken man döpt inspelningen till syntes inte.

### Listan och detaljen

- En ljudrad har ett element till vänster: spelknappen. Musikikonen ritas inte på den raden.
- Rubriken visas alltid. Saknas namnet blir det "Röstinspelning" plus datumet posten skapades (`ljudRubrik`, `ljudDatum`). Samma namn i detaljens rubrik.
- Under rubriken: datum och längd. Längden utelämnas bara tills den är räknad, så `0:00` inte påstår att ljudet är tomt. En gammal post utan `durationMs` får längden ur metadata, sök-fallback eller avkodning, och raden visar den så fort den finns (inte bara döljer den).
- Vågen ritas ur sparade toppar, med förlopp i accent, och går att skrubba.
- Hopp, hastighet och Ladda ned ligger i detaljen och i ⋯-menyn. Träffytor minst 44 px.

### Längd och toppar

- `durationMs` och `peaks` på posten. Bara ljud, och valfria, så en gammal post utan fälten fortfarande är giltig. `LJUD_STOLPAR` är 48. `MAX_LJUD_MS` är tolv timmar.
- När HTML-längden är Infinity söker spelaren till ett stort värde och läser igen. Avkodning med AudioContext är reserven och ger också topparna.
- Uppladdning och inspelning sparar längd och toppar ur filen, eller ur inspelarens sekunder när avkodningen inte går.
- En gammal post fylls i bakgrunden när spelaren räknat fram dem. Appen tar emot `onFyllLjud` och skriver. Listan visar värdet redan i sessionen. `spara({ id, durationMs, peaks })` behåller rubrik, text, url och fil från den lästa raden, så fyllnaden inte kräver hela formuläret.

### Regler

`durationMs` och `peaks` får bara stå på ett ljud, och bara när de är giltiga. Anteckning och länk får dem inte. Topparna valideras i bitar om åtta (`opsBibliotekToppar0`…), så Firestore inte vägrar en enda lång &&-kedja. Inga funktioner ändras.

## 0.92.3

Den tomma rutan i app-arket, och appar som saknas i gruppen. Utges som 0.92.3, efter 0.92.2.

### App-arket

CP 2026-10-10, dator, gruppen Travel: en tom inramad ruta högst upp i panelen Appar, före Meddelanden.

Orsaken är handtaget som drar ned arket på telefonen. Det är första knappen, så Radix fokuserar det när panelen öppnas. Träffytan är `h-11` gånger `w-16` med en tunn list i mitten, och `:focus-visible` ritar en accentkant runt hela ytan. Den kanten är rutan. Mätt i bilden: rutan sitter centrerad i panelens överkant, i accentfärgen, i samma ruta som handtagets fokusring. Det är inte en app utan ikon. Ett kort utan ikon går inte att registrera (`hubb.ikon` måste vara ett element).

- Handtaget ritas inte på dator (`md:hidden`). Där är ytan en panel, inte ett ark man drar ned.
- Det ligger utanför tabbordningen och får ingen kontur. Öppning flyttar inte fokus dit.
- Släppmarkeringen (`data-ark-mal`) finns bara medan en app dras.

### Alla appar

- **`OpsGruppHubb`** listar appar med kort som gruppen inte har, också när gruppen redan har appar. Travel med Meddelanden men utan Bibliotek visar Bibliotek under "Appar som kan läggas till", med **Installera** när appen skickar `installera`.
- En modul utan kort (`hubb: null`) erbjuds inte. En medlem ser namnen och att ägaren installerar. `onInstallera(id)` installerar just den appen. Utan den anropas `onClick` med id, eller så öppnas `href`.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras.

## 0.92.2

lifehub.app#150: innehållsbredd-token, `OpsSidoyta` och `OpsVyValjare` landar på main.

Utges som 0.92.2, efter 0.92.1 (hjälp). Samma innehåll som antecknades under 0.91.2, men den utgivningen byggdes från grenen `cursor/sidoyta-vyvaljare-150` och kom aldrig in i main: taggen `v0.91.2` pekade på 0.91.1. Därför saknade 0.92.0 och 0.92.1 både sidytan och vyväljaren. Den här versionen rättar det.

### Innehållsbredd

- **Token `--ops-innehall-max` (64 rem)** och Tailwind `max-w-innehall`. `OpsView` `width="normal"` använder den (förr `max-w-5xl`, samma tal).
- **`OpsSidoyta`** och klassen `.ops-sidoyta`: samma bredd för shell i HTML och React, så Hubbar / Profil / Inställningar inte hoppar i storlek.

### Vyväljare

- **`OpsVyValjare`**: vyns namn i mitten med chevron och meny (samma gest som i kalendern). Appen ger posterna (t.ex. Hubbar, Profil, Anslutningar, Betalningar och konto, AI-nycklar, Logga ut).

---

## 0.92.1

Hjälp i två lager: grundfunktioner i ramverket, och ett avsnitt per installerad app ur modulens `hjalp`. Utges som 0.92.1, efter 0.92.0 (ljudspelaren).

### Kontrakt: `hjalp` på modulen

- Valfritt fält `{ rubrik, avsnitt: [{ id, fraga, svar, sokord }] }`. Utelämnat blir `null`. Tom lista kastas.
- Inte samma sak som `kallor.hjalp` (sidans korta frågetecken-text).
- `hjalpAnkare`, `hjalpAdress`, `lasHjalpAnkare` för djuplänk `#hjalp/<modulId>`.

### Generell hjälp och sidan

- `GENERELL_HJALP` / `GENERELL_OMRADEN`: Kom igång, Kalender, Ärenden och inkorg, Grupper och medlemmar, Inställningar och konto.
- `OpsHjalpSida`: sök över båda lagren. Först Grundfunktioner, sedan installerade appar i `groups.moduler`-ordning.
- En avinstallerad app (eller en utan `hjalp`) syns inte.
- Moduler med `hubb: null` och `hjalp` (Agenter) syns sist även när id:t rensats ur `groups.moduler` (`utanAgenterSomApp`). Annars nådde agenttexten aldrig hjälpsidan.

### Frågetecknet

- Modulramen visar `?` när modulen har `hjalp`, och leder till `/hjalp#hjalp/<id>`.
- `OpsViewHeader` tar `hjalpHref`: samma gest som länk till hjälpsidan.
- Agenter bär hjälp i `agenterManifest`.

## 0.92.0

Ljudspelaren och inspelaren (cllp/lifehub.app#163). Utges som 0.92.0, efter 0.91.1.

### Spelaren

CP: progress syns inte, ikoner ligger på varandra under 430 px, uppspelning är svår.

- **`OpsLjudspelare`.** Spela och pausa är kvar som 44 px. Tid står bredvid vågen. Förloppet är en synlig skena under stolparna (`data-ljud-skena`), inte bara en osynlig range. Hopp, hastighet och Ladda ned ligger på en egen rad och får inte överlappa. `playsInline` på `<audio>` för iOS Safari. En spelare i taget som förut. Laddning och fel i ord, med åtgärd när webbläsaren nekar play.
- **Storage-URL:er.** `sokvag` + `hamtaAdress` (`getDownloadURL`) oförändrat. Hämtningen visar snurra och "Hämtar ljudet."

### Inspelningen

- **Safari-format.** `LJUDFORMAT` prövar `audio/mp4` först, sedan webm. Reserv utan mimeType är mp4, inte webm.
- **Tillåt mikrofon.** När mikrofonen nekats (och sidan inte spärrar den) ritas knappen "Tillåt mikrofon", som ber igen med en gest. När Permissions-Policy spärrar står skälet kvar, utan knappen.
- **Uppladdningsprogress.** `laddaUpp` tar `rapportera` (0 till 1). `createFirebaseStorageSource` använder `uploadBytesResumable` när den finns och någon rapporterar. `createBibliotekskalla.laddaUppFil` skickar den vidare. Inspelaren visar redan Sparar… N %.

### Biblioteket

- **Fliken Ljud.** Härledd ur fil+MIME (`arLjudpost`, `BIBLIOTEKFLIKAR`). Filer-fliken är bild och dokument. Under Ljud öppnar Ny röstinspelningen.

### Var ljudet hamnar utan Biblioteket

Se PR-beskrivningen. Kort: TALK går till Inkorgen som förslag (ljudet sparas inte som fil). Meddelanden kan bära ljudbilagor och röst till text. Utan Bibliotek-modulen saknas målet "Bibliotek" i inspelaren.

### Vakter

- **`realpath` i `check-utvecklarord` och `check-sprak`.** På macOS är `os.tmpdir` `/var` → `/private/var`. Utan `realpath` kördes inte `main()` i test-guards temp-kopior, och mönstergolven såg gröna ut utan mätning.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras.

---

## 0.91.2

⛔ **Använd inte 0.91.2.** Paketet byggdes från en gren som aldrig mergades till main, och taggen `v0.91.2` pekar på 0.91.1. Innehållet nedan finns inte i den versionen. Använd **0.92.2**, som är samma ändring på main.

lifehub.app#150: samma innehållsbredd och vyväljare i headern.

### Innehållsbredd

- **Token `--ops-innehall-max` (64 rem)** och Tailwind `max-w-innehall`. `OpsView` `width="normal"` använder den (förr `max-w-5xl`, samma tal).
- **`OpsSidoyta`** och klassen `.ops-sidoyta`: samma bredd för shell i HTML och React, så Hubbar / Profil / Inställningar inte hoppar i storlek.

### Vyväljare

- **`OpsVyValjare`**: vyns namn i mitten med chevron och meny (samma gest som i kalendern). Appen ger posterna (t.ex. Hubbar, Profil, Anslutningar, Betalningar och konto, AI-nycklar, Logga ut).

---

## 0.91.1

Ingen utgivning i det här passet. Appen pinnar kvar.

### Skalytan: Tillbaka i biblioteket

Check på main har varit röd i scaffold-jobbets `check:skalyta` sedan 0.90.4. Ett brott: "bibliotek detalj 390 px: Tillbaka kom inte tillbaka till listan."

Mätt mot 0.91.0 i Chromium vid 390 px. Tillbaka stänger detaljen. Listans rad "Protokoll" finns en gång. Åtgärdsknappen från 0.90.4 heter "Åtgärder för Protokoll". Vaktens `getByRole` med `name: "Protokoll"` är en delsträng och räknar båda, så den blev 2 och röd fast listan var tillbaka.

- Kravet är det exakta namnet "Protokoll", och att `[data-bibliotek-detalj]` är borta.
- Rött när Tillbaka inte gör något: detalj 1, raden Protokoll 0.
- Grönt när listan är tillbaka: `--bara-surfplatta`, 203 kontroller, inga brott.

---

## 0.91.0

Ingen utgivning i det här passet. Appen pinnar kvar på 0.90.0.

### En avslutad medlem kommer in igen (#317)

CP 2026-10-08: en ny inbjudan från ägare eller admin är ett uttryckligt val, och accepten ska återaktivera ett avslutat medlemskap.

- **`accepteraInbjudningar`.** Saknas medlemskapet skrivs det som förut. Ett aktivt rörs inte, så ingen roll höjs för den som redan är med. Ett med status `avslutad` sätts till `aktiv` med inbjudans roll, via `updateIf` på `status: "avslutad"`. Namn och bild står kvar. Gruppen hamnar i `accepterade`. Stämmer villkoret inte, och raden inte är aktiv, lämnas inbjudan tillbaka till `vantar` och felet går vidare. Inget nytt fält i svaret: personen är inte längre avslutad, och `avslutade` hade varit en andra sanning.
- **Inga Firestore-regler ändras.** `memberships` skrivs av Admin SDK, `allow write: if false` står kvar.

Kvittofelets maskning av adresser kom i 0.84.0 och är orörd.

### Trådmärket väntar på svaret (#282)

- **Okänt trådläge är inte "Svara i tråd".** Innan `tradarFor` svarat ritas en neutral rad, "Tråden hämtas", med `data-tradmarke="okand"`. Knappen kommer när svaret säger att tråden saknas. Föll läsningen står knappen kvar, och raden om att trådarna inte kunde hämtas står kvar.
- **`asyncUtilTimeout` i `tradar.test.jsx` är 15 sekunder**, och suiterna som ritar vyn har 20 sekunder. Gränsen på 1 sekund var den som föll, inte Vitests `testTimeout`. Den sätts i filen, inte i `setup.js`.

### Bibliotekets radering, en avslutad admin (#311)

Raderingen för författare, admin och ägare kom i 0.85.0. Regeln är orörd.

- **`farAndra` nekar ett medlemskap vars `status` är satt och inte `aktiv`.** En avslutad admin och en avslutad författare är nej, samma som `opsArMedlem` i regeln. Saknas `status` är svaret som förut: anroparen skickar redan bara aktiva rader.
- **Emulatorprovet** nekar en avslutad admin, utöver den avslutade medlemmen.
## 0.90.9

Grok i agentens modellväljare. Utges som 0.90.9, efter 0.90.8.

### Modellväljare

- **Grok.** `AGENTMODELLER` får `grok-4.7`, visningsnamn Grok, leverantör `xai`. Raden kräver att `xai` står i `kopplade`. Utan den nyckeln är den avstängd, med länken Koppla nyckel, som de andra nyckelmodellerna. Id:t ritas inte. Meningen under namnet säger att den kräver en xAI-nyckel.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras. Lifehubs `modellFor` och `sparaAgent` rörs inte: ett sparat val ändrar inte svaret förrän funktionerna läser fältet.

---

## 0.90.8

CP vill ha en ljudspelare, samma för allt ljud: Bibliotekets inspelningar, chattens röstfiler och bilagor, och vilken ljudfil som helst. Förebilden är SessionStudios spelare (`InlineAudioPlayer`, `WebFullscreenAudioPlayer`, den delade räknaren). Utges som 0.90.8, efter 0.90.7.

### En spelare

- **`OpsLjudspelare`.** Våg med spolning, spela och pausa, förfluten tid och total tid, hopp tio sekunder, hastighet 1×, 1,25×, 1,5× och 2×, väntan och fel i ord. Reglaget under vågen är ett riktigt `input type=range`, så piltangenter, pekare och skärmläsare delar en kontroll. Knapparna är 44 px. En spelare i taget: den som startar pausar de andra.
- **Storage.** `src` är en färdig adress. `sokvag` och `hamtaAdress` hämtar den, samma kontrakt som `createFirebaseStorageSource.adress` (`getDownloadURL`). `src` vinner när båda finns, så Bibliotekets cache inte hämtar två gånger. Medan adressen hämtas står "Hämtar ljudet." Ett fel från anropet skrivs ut.
- **`isAudio`.** Samma fråga som `isImage`, för en fil man just valde och för en bilaga ur databasen.

### Där ljudet redan fanns

- **Biblioteket** ritar `OpsLjudspelare` i listan och i detaljen. Den lokala spelaren med enbart knapp och tid är borta. `hamtaAdress` och "Hämtar ljudet." står kvar.
- **Chattens och kommentarernas bilagor** spelar ett ljud i stället för att bara vara en nedladdningslänk. PDF och övriga filer är länkar som förut. Tillåtna ljudtyper: WebM (också `codecs=opus`, det inspelaren rapporterar), MP4, MPEG, Ogg och WAV. Regeln är byggd av samma lista.

### Regler och funktioner

`KOMMENTARBILAGA_TYPER` innehåller ljudtyperna, så `handelseregelfragment` och `samtalsregelfragment` släpper in dem. Inga funktioner ändras. Appen som redan rullat ut reglerna behöver skriva om dem innan ett ljud går att spara. Att läsa ett gammalt dokument ändras inte.

### Inspelningen

CP 2026-10-09, med en skärmbild av röstfältet (prickar, mikrofon, rött kryss): efter stopp syntes ingen sparning, och det var oklart hur man slutar.

- **`OpsInspelning` är den enda inspelaren.** Den ritas i plussets fält. Bibliotekets lista har ingen inspelningsrad. Ny-menyn under Alla har Röstinspelning, som öppnar samma fält (`useOppnaInspelning`) med modulens mål på `inspelning.mal` förvalt. `onSpelaIn` kastas. Ett ljud som redan finns spelas med `OpsLjudspelare`. Klar, med stopp-ruta och ordet, sparar. Tiden löper. Vågen rör sig. Avbryt är ett sekundärt kryss. Från tre sekunder frågar Avbryt innan ljudet kastas. Fältet fälls inte ned. Plusset har taket 2:00.
- **Mål i plussets inspelare.** `talk.mal` är appens egna, till exempel Händelse och Meddelande. En påslagen moduls tillägg på platsen `inspelning.mal` läggs till (`malForInspelning`, `INSPELNING_PLATSER`). Etiketten är modulens, till exempel "Spara i Biblioteket", och `spara` tar emot ljudet. En avstängd modul bidrar inte. Ramverket känner inte namnet Bibliotek. `skapa.spelaIn` kastas: den raden hårdkodade målet.
- **Sparar…** med procent när appen anropar `rapportera` (0 till 1, samma kvot som `bytesTransferred / totalBytes` i `uploadBytesResumable`). Utan anrop en snurra. Sedan **Sparat**, kort, sedan stängs fältet. Ett fel får Försök igen på samma ljud. Ett andra tryck under sparningen gör inget.
- Huvudets mikrofon heter "TALK, sparar" och "TALK, sparat" i de lägena.

---

## 0.90.7

Kalenderlager i `OpsCalendar`: en plockare där personen visar och döljer lager ett och ett. SessionStudio har mönsterlager (återkommande, datumintervall, enstaka dagar) under användaren, med färg och ikon, och en meny under lagerikonen. Egna lager sparas påslaget på dokumentet. Andras delade lager är av tills personen slår på dem på enheten. Prenumererade kalendrar syns tills de döljs, också på enheten. Helgdagar är inte ett lager där. Gruppens och mina kalendrar väljs i kalenderväljaren, inte i lagermenyn.

Ramverket tar inte in mönstersamlingen. Appen skickar in de lager den redan har. Valet vilka som syns sparas per person i webbläsaren. Färgen är identitetspalettens sex toner. Gruppens kulör rörs inte.

Utges som 0.90.7, efter 0.90.6.

### Kalenderlager

- **`lager.lista` på `OpsCalendar`.** Knappen öppnar ett ark under 768 px och en panel från 768. En rad per lager, med bock, ton och namn, grupperad på `sektion`. `undertext` är en andra rad. "Hantera kalendrar" anropar `onHantera` och stänger. Tom lista skriver `tomText`, eller "Inga kalenderlager ännu." En tom sträng skriver ingenting, så ett fel inte ser ut som att lager saknas.
- **Synligheten sparas per `minne`.** Nyckeln är `lagerNyckel`, värdet de dolda id:n. Saknas posten syns lagret. Saknas `minne` gäller valet bara den här visningen. `onSynliga` får de synliga id:n vid start och när valet ändras. Ett dolt lager ritas inte, varken i rutnätet, i snabbtitten eller i kalenderväljaren.
- **`lagerFarg`.** En giltig ton 1 till 6 vinner. Annars räknas tonen ur id (`identityTone`), aldrig ur namnet och aldrig ur gruppens kulör.
- **`{ pa, onByt }` finns kvar.** En app som bara skickar brytaren får samma knapp som i 0.61.0.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras. Vilka lager som finns är appens data. Vilka som syns ligger i webbläsarens minne, samma väg som veckonummer och dolda appar.

---

## 0.90.6

CP: nycklar hör till dig, agenter hör till gruppen. Agenter är inte en app.

Utges som 0.90.6, efter 0.90.5.

### Agenter hör till gruppen

- **Inget kort.** `agenterManifest` har `hubb: null`. Appar och hubben ritar den inte. `modulerIAppar` tar bort den ur appkatalogen. `utanAgenterSomApp` tar bort id:t `agenter` ur `moduler` och `huvudmeny`. Medlemskapet och agentens dokument står kvar. En saknad `huvudmeny` skrivs tillbaka som `null`.
- **Under inställningarna.** `inomInstallningar` ritar listan och agentens inställningar utan modulramen. Chattens tryck öppnar samma inställningar, adressen är appens.
- **Modell och nycklar.** Väljaren står kvar. Under den en länk, "Hantera nycklar i Mitt konto", till `nycklarHref` (eller `valvHref` om den första saknas). Valvets innehåll ritas inte här. Utan adress står det att adressen till Mitt konto inte är kopplad.

### Regler och funktioner

Inga Firestore-regler och inga funktioner. Lifehubs `modellFor` och `sparaAgent` rörs inte: ett annat pass kopplar modellvalet.

---

## 0.90.5

CP 2026-10-09: i Meddelanden, efter Nytt meddelande, stod pluset kvar i compose-huvudet och såg ut som en knapp till. Utges som 0.90.5, efter 0.90.4; appen pinnar om.

### Skapa-vyn har en vanlig rubrik

- **`OpsSkapaRubrik`.** En rubrik utan plus och utan knapp. `OpsSkapaPanel` (Ny händelse, Nytt ärende, Ny grupp) och läget nytt i Meddelanden använder den. Knappen "+ Nytt meddelande" står kvar i samtalslistan. Tillbaka står kvar.
- **Bibliotekets Ny anteckning, Ny länk och Ny fil** hade redan en vanlig sidrubrik, och "+ Ny" ritas bara i listan. Kalenderns Ny kalender döljer plusknappen när formuläret är öppet.

### Appar-hyllan ligger under plusknappen

- **`--z-ark`.** App-arket slutar vid bottenradens överkant, men ritades på `--z-modal` och klippte den upphöjda plusknappen. En hylla som sitter på raden ligger under `--z-chrome`, så pluset målar över kanten. `arkHyllaZ` och `arkOvanforRad` i `radKlass` är den gemensamma klassen. Ark som täcker skärmen från underkanten (Skapa, Meny, aktivitet, Skapa i) stannar på `--z-modal`.

### Appar går att ordna

- **Byt ordning är ett läge.** Ikonerna vickar och visar ett grepp. De dras med pekaren, mus och finger. Pilknappar och piltangenter flyttar ett steg. Klar skriver `groups.moduler` och lämnar läget. Stängning utan Klar sparar inte. Samma lista styr inställningarnas Ordning och huvudmenyn.

---

## 0.90.4

CP: en anteckning i Biblioteket öppnades som fält (Rubrik, Text) med Spara och en stor röd Radera. Öppning är läsning. Redigera byter till fält med Spara och Avbryt. Radering ligger i menyn, med en fråga, och i ett svep åt vänster med ångra.

Utges som 0.90.4, efter 0.90.3; appen pinnar om.

### Läsvy, svep och radmeny

- **`OpsDokument`.** Läsläge med rubrik och inskickad läsning, inga fält. Pennan (Redigera) visas när `kanRedigera` är sant. Redigering har Spara och Avbryt. `ny` börjar i redigering. `onSpara` som ger `false` lämnar läget. Radering ritas inte.
- **`OpsSvepRad`, `ANGRA_MS`.** Svep åt vänster avslöjar åtgärder. Själva svepet anropar ingenting. Med `angraMeddelande` visas meddelandet och Ångra i åtta sekunder innan `onValj`. Avmontering under fönstret anropar inte. Utan åtgärder är raden en vanlig `li`.
- **`OpsAtgardsblad`.** Långtryck (`LANGTRYCK_MS`, samma som app-arket), högerklick och ⋮ öppnar samma poster. Under 768 px ett ark från botten, på md och uppåt en meny. `baraKnapp` ritar bara ⋮. Tom `poster` ritar barnen utan knapp. `namn` krävs.
- **`OpsMarkdown` tar `dokument`.** Läsning av ett dokument använder `text-brod`. Kortets etikettstorlek är oförändrad. Rubriker blir fortfarande aldrig `h1`.
- **`OpsBibliotek` komponerar dem.** Anteckning, länk och fil öppnas i läsläge. Ett nytt dokument börjar i redigering. Formuläret har Spara och Avbryt. Listan sveper fram Radera med ångra. Menyn har Öppna, Redigera, Byt namn, Dela och Kopiera länk när det finns en adress eller en grupp att dela till, och Radera med fråga. Redigera, Byt namn, Dela, svepets Radera och menyns Radera kräver `farAndra`, som förut.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras.

---

## 0.90.3

CP 2026-10-09, modulens inställningar på live 0.90.0 (till exempel "Meddelanden · Inställningar"): reglagen är svåra att träffa och svarar sent, kugghjulet trängs mot en lång rubrik, ordningen är textknappar, och tomma avsnitt tar plats. Utges som 0.90.3; appen pinnar om.

### Träffyta och sparning

- **Hela raden är reglaget.** `OpsSwitch` med `placering="rad"` har etikett och hjälptext till vänster, spåret till höger, och minst 44 px (`min-h-11`) på varje bredd. Formulärets `spar` släpper höjdgolvet från `md` och är oförändrat.
- **Tummen slår om i samma varv som trycket.** Appen väntar på Firestore-skrivningen och läser sedan om alla grupper, och skalet ritas om först då. Ramverket väntar inte på det svaret. Utkastet ritas direkt. Sparningen går i bakgrunden. Ett avslag ställer tillbaka utkastet och skriver en liten rad (`data-installning-fel`). Kopplingens fel står kvar som `OpsBanner`.

### Huvudet

- **Kugghjulet och Klar sitter i huvudets bakre kant.** Finns Tillbaka står de på den raden, så en lång rubrik inte tränger dem. En fäst modul har dem på rubrikraden. I Meddelandens lista är kugghjulet sista kontrollen, efter Nytt.

### Rader

- **Ordning** är en rad: ordet, pil upp, `3/4`, pil ned. Skärmläsarnamnen är Flytta upp och Flytta ned. Avstängd visas platsen som `-`, med hjälptexten under ordet.
- **Ikon** är en rad med chevron. Den öppnar manifestets ikon. Den sparar den inte en gång till.
- **Tomma avsnitt ritas inte.** Saknas kopplingar, och saknas egna fält och slot, syns inte de rubrikerna. Meningarna om inga kopplingar och inga egna inställningar är borta. Synlighet som egen mening är borta: den sade samma sak som På och Visa i huvudmenyn.

### Samordning

Ändringarna ligger i `OpsModulRam`, `OpsSwitch`, `OpsHubTillbaka` och Meddelandens listhuvud. `OpsAgenter` är orörd, så ett senare pass om agentinställningar kan rebasa och ta samma rader.

---

## 0.90.2

CP, live på 0.90.0: agentens inställningar är "super messy, I understand nothing of the enormous list". Första skärmen är ett kort. Resten är fyra rader, ett avsnitt i taget.

0.90.1 är ett annat arbete (aktivitetsdetalj, skrivfält, kalendern när den är tom) och rörs inte här.

### Agentens inställningar

- **Kortet först.** Bild, namn, roll, på eller av, och en modellväljare. På och av anropar samma `onVaxla` som förut, och bara när `kanVaxla` är sant. Märket är medlemskapets bild. Det sparas inte en gång till, och den meningen står inte i vyn.
- **Fyra rader med pil.** Om agenten (namn, roll, beskrivning). Vad den kan (verktyg som strömbrytare, med en mening om vad de gör). Kunskap och minne (instruktioner, kunskap, minne). Modell och nycklar, märkt avancerat (modelltexten och appens valv). Adressen är `avsnitt=om|kan|kunskap|modell`. En tom eller okänd parameter är översikten.
- **Inga råa id:n.** Verktygets etikett är beskrivningen. Saknas den står "Ett verktyg" och en mening, aldrig id:t. Id:t finns bara i kartan som `onSparaVerktyg` redan tar emot. Kunskapens källa och kontrollsumma ritas inte.
- **Spara per avsnitt.** Knappen säger Spara, och "Sparat." skrivs ut när anropet går igenom. Saknas sparfunktionen står felet, och ingenting skrivs.
- **Modellväljare.** Kortet och Modell och nycklar visar samma lista: vänligt namn och en mening, inte id:t. `AGENTMODELLER` är listan, en modell per leverantör som kan chatta. Gemini Flash Lite kräver ingen nyckel. De andra är valbara när leverantören står i `kopplade`, annars avstängda med länken Koppla nyckel (`valvHref`, eller `#agent-nycklar` i avsnittet). Ett val på kortet anropar `onSparaModell({ id, leverantor })` direkt. I avsnittet gör sparknappen samma anrop. Ett okänt id ritas inte.
- **Samma anrop som 0.90.0.** `onSparaIdentitet`, `onSparaVerktyg`, `onSparaInstruktioner`, `onSparaSkill`, `onSparaMinne`, `onSparaMinnePa`, `onVaxla`. Ingen ny samling.

### Funktioner

Lifehubs `functions/agentmodell.js` `modellFor` anropar alltid `MODELL` (`gemini-2.5-flash-lite`) och tar inte emot gruppen. `sparaAgent` godtar inte åtgärden `modell`: okända fält avvisas. Ett sparat val ändrar därför inte vad agenten svarar med förrän funktionerna läser `agenter/{agentId}.modell` som `{ id, leverantor }` och deployas. Ingen sådan ändring i det här paketet; funktionerna i lifehub.app läser fältet i en egen PR.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras. Skrivningarna ligger kvar på appens anrop (`sparaAgent`, `vaxlaAgent`).

## 0.90.1

CP 2026-10-09: felmeddelandet i agenten ska ramas in enligt den grafiska profilen, och rubrikerna ska följa SessionStudio. Tre äldre ärenden står öppna fast beteendet redan håller. Utges som 0.90.3; appen pinnar om.

### Rubriker

- **Sidans rubrik väger 600.** `OpsHubTillbaka`, `OpsViewHeader` och `OpsInstallningar` delar `SIDRUBRIK_KLASS`: `font-display text-sida font-semibold`. SessionStudio ritar sidrubriken `text-xl font-semibold` (20 px, vikt 600), och `OpsGruppSida` gör redan så. `text-sida` är 1.25rem. `--font-display` är `--font-sans`, Plus Jakarta Sans, samma familj som SessionStudio. Det som såg ut som fel typsnitt var vikten 700.
- **Agentens avsnitt är rubriker på inställningarnas vikt.** Allmänt, Kopplingar och Egna inställningar är `h2` med `text-sektion font-semibold` (12 px, vikt 600, versaler, accent). `OpsSectionLabel` står kvar på profilen, där SessionStudio mäter `font-bold` (700).

### Fel ramas in

- **`OpsBanner` med tonen danger** ritar läsfelet i agentlistan, en sparning som inte är kopplad, och en fil som inte lästes. Samma ram i modulens inställningar: det egna felet och en koppling som svarade fel. Ramen, ytan `bg-danger-bg` och `role="alert"` är banderollens, inte en naken rad.

### Beteenden som redan höll

- **Utfälld aktivitet visar inte rubrik och text en gång till** (#321, lifehub.app#119). Vakten står i `aktivitet.test.jsx`.
- **En vald bild räknas som innehåll, så knappen säger Skicka** (#315). Vakten står i `chatt-bilagor.test.jsx`.
- **Ny händelse namnger gruppen.** Rubriken Gruppens kalendrar ritas bara när det finns namngivna kalendrar (#309). Strängen Ingen kalender ännu finns inte i källan.
- **En grupp utan appar listar appar som kan läggas till** (lifehub.app#129).

## 0.90.0

CP hittar agentens inställningar för långt från samtalet. Agenter följer samma ram som övriga appar: visning, kugghjul, Allmänt, Kopplingar och egna. Tryck på agenten i chatten öppnar samma ställe.

LifeHub pinnar om till 0.90.0 i samma pass. Där öppnar ett tryck på agenten i chatten inställningarna, och Agenter syns i Appar.

### Modulen Agenter

- **`OpsAgenter`, `ORD_OPSAGENTER`, `agenterManifest`.** Visningen listar gruppens agenter. Kugghjulet öppnar inställningar för en agent i taget, adressen `?agent=<id>&lage=installningar`. Allmänt är namn, roll och beskrivning, och märket visas utan att sparas en gång till. Kopplingar är modelltexten appen skickar in, appens eget valv (`byok`) och verktygen. Egna är instruktioner, kunskap, minne och vad agenten får göra. Ägare och admin ändrar när `ram.farAndra` är sant. Strömbrytaren på och av ritas bara när `kanVaxla` är sant, och den anropar samma `onVaxla` som gruppsidan redan har. `listfel` skrivs ut när listan inte gick att läsa. Utan den är en tom lista noll agenter.
- **Ingen egen lagring.** Namn, roll, verktyg, minne och kunskap är fält appen redan sparar. Modellen är den appen redan anropar. Nyckeln ritas av appens valv och skrivs aldrig här. Gränserna (`granser`) kommer från appens validering. Manifestet har ingen samling.
- **`AGENTER_ID`, `AGENT_PARAM`, `agentIHref`, `medAgent`, `agentInstallningsHref`.** Agenten är en egen parameter så att ett tryck i chatten kan öppna just den, och modulens övriga parametrar står kvar.
- **`OpsModulRam` tar `rubrikNamn` och `ram.kropp`.** Med kropp ritas inte de tre standardavsnitten. Agenter använder den, eftersom inställningarna gäller en agent och inte appens på och av. Utan kropp är avsnitten som i 0.89.0.
- **`OpsMeddelanden`, `OpsSamtal` och `OpsTrad` tar `onVisaAgent`.** I ett agentsamtal är namn och ikon i huvudet en knapp. I en tråd är agentens avatar en knapp. Utan propen är huvudet text och avataren ett märke, som förut.
- **`OpsGruppSida` tar `agenterHref`.** Med den ritas en länk till modulen och ingen strömbrytare. "Skriv till" står kvar. Utan den är strömbrytaren kvar för ägaren. `OpsGruppFormular` får inga agentfält: en installerad modul med kort länkar till sina inställningar, och Agenter syns i Appar för att manifestet har ett kort.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras. Skrivningarna ligger kvar på appens anrop (`sparaAgent`, `vaxlaAgent`) och på samlingen appen redan äger. Identitetens valv är orört.

## 0.89.0

CP 2026-10-09, med en bild av Outlook på telefonen: ett tryck på Appar ska öppna ett ark ovanför flikraden, inte en ny sida. Samma dag: varje modul ska ha en ram med visning och inställningar, och inställningarna ska bo på ett ställe. Pinnen, ikonen, synligheten, kopplingarna och de egna fälten ritas i modulens ram. Redigera grupp, Appar, installerar och avinstallerar.

Ingen utgivning i det här passet. Appen pinnar kvar på 0.88.2 tills den tar in 0.89.0.

### App-arket

- **`OpsApparArk` och `apparArk` på `OpsAppShell`.** Utan propen navigerar Appar som förut. Med den är fliken en knapp. Arket dimmar innehållet, har ett handtag, och stängs med dimningen, ett drag nedåt, Escape eller ett nytt tryck på Appar. Appar lyser medan det är öppet. När det stängs är fliken man stod på vald igen, eftersom adressen inte byttes. Huvudet och bottenraden får pekarhändelser tillbaka: en modal sätter annars `pointer-events: none` på `body`, och då är fliken död fast den syns.
- **Innehållet är gruppens `moduler`**, fyra i bredd, också de som är fästa. Sista rutan är Alla appar och öppnar hubbsidan. Byt ordning, för ägare och admin, sparar hela `groups.moduler`. Ett långt tryck, ett kontexttryck eller skift-enter öppnar modulen med `?lage=installningar`.
- **På `md` och uppåt är samma innehåll en panel under huvudet.** Bottenraden finns inte där.

### Modulramen

- **`OpsModulRam`.** `OpsModulSida`, `OpsBibliotek` och `OpsMeddelanden` tar `ram`. Kugghjulet sitter till höger i rubrikraden när `farAndra` är sant. Rubriken blir "Ekonomi · Inställningar", och kugghjulet blir Klar. En medlem som öppnat läget via adressen ser Klar och avstängda reglage.
- **Allmänt** skriver på och av (`groups.moduler`), Visa i huvudmenyn (`groups.huvudmeny`) och ordningen. Ikonen visas, den sparas inte en gång till. Synligheten är texten som följer av de två fälten.
- **Kopplingar** deklareras i manifestet (`kopplingar`: id, namn, hint, behörigheter). Läget skickar appen in: ansluten, ej ansluten eller fel, senaste synk och feltext. En nyckel, en token eller ett lösenord kastas i manifestet och kopieras inte ur läget. Lagringen är appens, i identitetens valv. Ramverket har ingen egen samling för hemligheter.
- **Egna inställningar** är manifestets `installningar` och därefter `ram.egna`. Saknas båda står det att det inte finns några.
- **`LAGE_PARAM`, `INSTALLNINGSLAGE`, `arInstallningslage`, `medInstallningslage`, `utanInstallningslage`.** Läget ligger i adressen så arket och kugghjulet delar en väg, och webbläsarens tillbaka lämnar det.
- **`OpsModulInstallningar` ritar inte längre reglagen.** `onSpara`, `onSparaHuvudmeny` och `sparade` kastas. `hrefFor` ger länken Inställningar. Utan adress står det att inställningarna öppnas i appen.

### Regler och funktioner

Inga Firestore-regler och inga funktioner ändras. Ordning och pinne ligger kvar på `groups.moduler` och `groups.huvudmeny`, ägarfält som i 0.83.0. En admin som appen släpper in i ytan (`farAndra`) får ändå avslag av reglerna tills de vidgas. Förslaget, inte gjort här: en admin får uppdatera `moduler` när mängden id är densamma. De egna fälten ligger kvar i samlingen appen namnger, ägaren skriver. Hemligheter ligger kvar i identitetens valv.

## 0.88.2

CP 2026-10-09, telefon, grupp "my": inspelningen syntes som en liten rad, ett sparat ljud sade "Filen har ingen adress.", och Meddelanden saknades i huvudet (tema, inkorg, Bibliotek, avatar).

### Inspelningen syns

- **Mikrofonen är centrerad och 96 px.** Den lilla raden med texten "Spela in idé" är borta. Saknas `onSpelaIn` ritas ingen mikrofon, som förut.
- **Medan den lyssnar ritas TALK:s nivåprickar** (`TalkPrickar`, samma tio som fältet). Tid, Spara idé och Avbryt står kvar.

### Ett ljud går att spela

- **`adress(sokvag)` på lagringen.** `createMemoryStorage` ger den lagrade `minne://`-adressen och kastar när sökvägen saknas. `createFirebaseStorageSource` anropar `getDownloadURL`. `STORAGE_OPERATIONS` är `laddaUpp`, `taBort` och `adress`.
- **`OpsBibliotek` tar `hamtaAdress`.** Svaret cachas per sökväg, så listan och detaljen delar det. `filUrl` vinner när den är ifylld. Medan adressen hämtas står "Hämtar ljudet." eller "Hämtar filen.", inte "Filen har ingen adress." Ett fel visas när anropet faller.

### En fäst ikon stannar i huvudet

- **`OpsIconLink` tar `kvarIHuvudet`.** Skalet flyttar annars åtgärd fyra och uppåt till menyn på telefon (`ATGARDER_SMAL`). Meddelanden föll ur för att `huvudmenyPoster` följer `moduler`, inte `huvudmeny`: Bibliotek kom före och tog den sista synliga platsen. Ikonen hade kort (`/meddelanden`) och märket `meddelanden-av` var inte satt. Med propen stannar ikonen på telefon och surfplatta, och den dubbleras inte i menyn. Utan propen gäller taket som förut.

## 0.88.1

CP 2026-10-09: "Om en modul/app ligger i huvudmenyn ska dess sida inte ha någon Tillbaka, den beter sig som inbyggd." Samma dag: Meddelanden saknade Tillbaka när den inte är fäst.

### En fäst modul är inbyggd

- **`OpsHuvudmenyProvider` och `useIHuvudmenyn`.** Appen ger gruppens `huvudmeny`. `OpsHubTillbaka` tar `modul`, och står modulen i listan ritas ingen länk, bara rubriken (eller ingenting utan `rubrik`). Gäller alla moduler, på ett ställe.
- **`OpsModulSida` skickar modulens id, `OpsBibliotek` har `modulId` (förval `bibliotek`).** Insidor (bibliotekets detalj, ett samtal på telefon) har kvar sin egen väg tillbaka till listan.
- **`OpsMeddelanden` tar `tillbaka`.** Samma rad som modulerna, överst i listan. Fäst: ingen rad. Inte fäst: "‹ Tillbaka" till hubben.
- Utan provider är listan tom och varje sida har sin rad som förut.

## 0.88.0

CP 2026-10-09, telefonbredd: Ekonomis flikar ligger på många rader. Samma dag: grunden för appens inställningar ska vara gemensam, och Bibliotekets anteckning har en centrerad Tillbaka utan chevron.

### Flikraden rullar igen

- **En rad, på smal skärm och på bred.** `FLIKRAD` är `flex-nowrap` och `overflow-x-auto`, samma klass i `OpsModulSida` och i `OpsTabs` med `medOrd` (Ekonomi, Bibliotek, varje modul). Omslaget `min-w-0` sitter på flexbarnet. Utan det växer raden med innehållet och sidan rullar, vilket är det lane 11 mätte i 0.87.0 (Länkar slutade på x 411). Brytningen löste överflödet och gav Ekonomi fjorton rader. Den öppna posten rullas in med `scrollLeft` på raden.
- **Surfplattehuvudet från 0.87.0 är orört.** Ordmärket väntar till `lg`, åtgärder som inte ryms flyttar till menyn, knapparna är 44 px till `xl`.
- Avsnitt 9c (d) kräver en rad, radens ruta i bodyn, den öppna delen synlig, och att fjorton delar rullar vid 390 px. Bibliotekets flikar vid 390 px har samma golv. Mot 0.87.0 är kontrollen röd (raden högre än en länk, och den rullar inte).

### Modulens inställningar

- **En mekanism.** `installningar` i manifestet, valfritt som `typer`. `OpsModulInstallningar` ritar varje installerad modul. Ägaren skriver. En medlem läser. Admin skriver inte.
- **Pinnen stannar på gruppen.** `visaIHuvudmenyn` härleds ur `groups.huvudmeny` och skrivs dit. Huvudet läser samma fält som förut. En modul får inte deklarera id:t. `OpsGruppFormular` använder samma hjälpfunktioner.
- **Egna fält** sparas i en samling appen namnger (`createModulinstallningskalla`, `modulinstallningsregelfragment`). Ramverket känner inte namnet. Ingen ändring av gruppens regler: de ligger på uttryckstaket. Fragmentet deployas bara om appen börjar skriva samlingen. Flikraden och pinnen kräver ingen regeldeploy och inga functions.

### Tillbaka i Bibliotekets detalj

- **Läsning och formulär använder `TillbakaKnapp`.** Samma chevron och vänsterställda text som skapa- och händelsepanelen. Listan använder fortfarande `OpsHubTillbaka` upp till hubben. Spökknappen sträcktes i vyns kolumn och centrerade ordet, utan chevron.
- **`OpsGruppSida` använder samma `TillbakaKnapp`.** Den egna kopian hade chevron och ord, men egna klasser (`gap-2`). Chatten har kvar sin kompakta rad med gruppnamnet (`ChevronVanster` 14 px, linje under). Menyn och panelhuvudet har en ikonknapp utan ord. De är andra gester.

### Bibliotekets yta och inspelning

- **Listan.** Varje rad har ikonen i en ruta, rubrik och en metarad (typ och en kort förhandsrad). En bild fyller rutan. Ett ljud har en rund spela-knapp, inte en textknapp som tar raden. Tomt läge har biblioteksikonen i en cirkel (`OpsEmpty` tar emot `icon`).
- **Inspelningen är TALK:s mikrofon.** Knappen är `MikrofonIkon` med `huvudknappKlass`, och flödet är `useTalk` (`direkt`, `skickaIn`, `avbryt`), samma som huvudets mikrofon. Saknas `onSpelaIn` ritas ingen rad. `inspelare` är valfri, samma som TALK: utelämnad används webbläsarens.
- **Detaljen** visar samma ikonruta som listan, bredvid rubriken.

### Meddelanden som modul

- **Ikonen i huvudet kan bära en räknare.** `huvudmenyPoster` tar `badge` och `badgeFler`, samma kartor som `hubbPoster`. Appen ritar den fästa modulens ikon, inklusive chattens olästa, i stället för en egen länk bredvid.
- **Appar-raden säger inte att chatten alltid finns utanför modulerna.** Hintet nämner kalender och inkorg. Chatten är en app med kort, och då står det "Egen yta" och reglaget "Visa i huvudmenyn". En modul som varken har kort eller tillägg säger fortfarande "ingen egen yta och inga tillägg", för det är sant om den.
- **En ny grupp kan börja med ikoner.** `createGroupService({ huvudmeny })` skriver listan i samma batch som gruppen. Den är en delmängd av `moduler`. Utelämnad är den tom, som förut. Inget nytt fält och ingen ny regel.

## 0.87.0

CP 2026-10-07, lifehub.app#119: "När man expanderar en post i aktivitet så står rubrik och text dubbelt." Och #262, mätt på nytt 2026-10-08: vid 768 px ligger gruppväxlaren över fliken Idag, och flikarna över plusset. Knapparna i högerklustret är 36 px.

### Aktivitetens utfällning

- **Rubrik och detalj ritas en gång.** De står på raden. `OpsActivityDetail` visar det raden inte har: exakt tid, källa, utfall, felrutan och länken.
- Prov i jsdom (`#321` i `aktivitet.test.jsx`) och i Chromium (`check-skalyta` 6c, 390 px). Rött mot 0.83.0 (rubriken två gånger), grönt med fixen.

### Huvudet på surfplatta

- **Ordmärket väntar till `lg`.** Mätt i 768 px: märket 180 px plus växlare med namn 160 px lämnar inte plats åt tre flikar och 44 px knappar. Panelen, som märket ska stå över, finns från `lg`. Växlaren med namn står kvar mellan `md` och `lg`.
- **Åtgärder som inte ryms flyttar till menyn** mellan `md` och `lg` (`ATGARDER_SURF`). På telefon gäller `ATGARDER_SMAL` som förut. Utan `meny` ritas hamburgaren på surfplattan, så inget försvinner.
- **Knapparna är 44 px till `xl`.** Från 1280 px står 36 px (plusset 40) kvar. Avsnitt 6b kräver träffyta och inget överlapp vid 768, 834, 900, 1023 och 1024 px, i scenerna `full`, `talk` och `utanmeny`. `documentElement.scrollWidth` är 15 px under `clientWidth` på varje bredd, också före ändringen: `scrollbar-gutter: stable` (bolag-ops#143). Likhet där vore röd utan att sidan rullar i sidled. Kravet är därför `scrollWidth <= clientWidth` på dokumentet och `scrollWidth === clientWidth` på bodyn.
- **Bibliotekets flikrad bryts i stället för att rulla.** Mätt vid 390 px: Alla, Anteckningar och Länkar var 395 px i en ruta på 343, och Länkar slutade på x 411. `FLIKRAD` (`flex-wrap`) är samma klass i modulens delar och i `OpsTabs` med `medOrd`. Avsnitt 9c (d) kräver samma brytning för Ekonomis fjorton delar: raden högre än en länk, ingen sidrullning, varje länk inne i raden. Mot 0.83.0 är den kontrollen röd (en rad, 1731 px i 343).
- **Dagpanelens långa ord stannar i kolumnen.** Mätt vid 390 px, samma på 0.83.0: "Löneutbetalning" är 133 px i en kolumn på 123, och texten slutar på 225 medan utfällningen börjar på 223. Titeln har `break-words`. Efter: ordet är två rader och slutar på 205, utfällningen börjar på 223.

### Hubben utan appar

- **Listan över appar som kan läggas till, i stället för meningen om kalender, chatt och inkorg.** CP i lifehub.app#129: meddelandet när gruppen saknar appar är märkligt. `OpsGruppHubb` visar nu "Gruppen har inga appar ännu", namnen på modulerna som har ett kort, och "Välj appar" när appen skickar `installera` (bara för ägaren). En modul med `hubb: null` står inte i listan.

## 0.86.0

Gruppens minne (lifehub.app#66). En person lyfter en slutsats ur ett meddelande i en tråd. Hela gruppen ser raderna. Agenten läser, och skriver aldrig.

- **`minnesregelfragment(namn)`.** Samlingsnamnet skickar appen in. Aktiv medlem läser. Aktiv person lyfter som sig själv, med `lyftAv.typ == "manniska"` och serverns klocka. Den som lyfte raden, eller gruppens ägare, skriver om texten och tar bort raden. Admin gör inget av det. Gruppen, källan, vem och `lyft` står stilla vid en ändring.
- **`OpsMinne`.** Listan med text, källa, vem och när. Ändra och Ta bort bara för den som får. Tomt minne säger "Minnet är tomt." Ett läsfel är en varning, inte en tom lista. `arAgare`, `uid`, `onAndra`, `onTaBort` och `hubHref` krävs.
- **`createMinneskalla`.** `source`, `collection`, `groupId`, `skapare`. `las` kastar inte. `lyft`, `andra` och `taBort` sätter klockan och vägrar en rad som hör till en annan grupp.
- **Knappen "Lyft till minnet"** på rotmeddelandet och svaren i `OpsTrad`, bara när appen skickar `onLyftTillMinnet`. Utan den syns ingen knapp och inget lyfts av sig självt. Nekas lyftet står felet i tråden. `minneHref` ritar länken "Minnet" i trådens huvud. Skrivfältet är orört.

## 0.85.0

CP 2026-10-08, i cllp/ops-framework#192: privat är personens egen grupp, filer upp till 25 MB, inspelning upp till 10 minuter, en posttyp `fil` där MIME styr vyn, utskriften sparas på ljudposten och personen väljer om den blir anteckning eller ärende, och radering är författarens eller admin i gruppen (#311).

### Radering

- **Regeln `delete`.** Författaren med aktivt medlemskap i postens grupp, eller `opsArAdmin` (ägare eller admin) i samma grupp. En annan medlem, en admin i en annan grupp, ett avslutat medlemskap, en agent och en utloggad får nej.
- **Knappen** syns bara när `farAndra` säger ja, i detaljen och på en trasig rad. Första trycket frågar. Andra anropar `onRadera`.
- **`radera` i källan** kräver `jag` och `anteckna`. Anteckningen skrivs först. Kastar den lämnas posten kvar. Föll själva borttagningen kastas felet. Filen i lagringen tar appens function bort när dokumentet försvinner. Källan raderar dokumentet, inte objektet.

### Filer

- **En typ, `fil`.** `fil` bär `sokvag`, `namn`, `mime` och `byte`. `filSort` (bild, ljud, dokument) härleds och lagras inte. MIME-listan är stängd, och `normaliseraMime` tar bort `;codecs=` innan jämförelsen.
- **25 MB** i modellen, i Firestore-regeln och i storage-regeln (`<=`). Profilbilder behåller sitt tak under 2 MB.
- **Storage-fragmentet** är samma `lagringsregelfragment`. Med `bibliotek` kräver det medlemskap via `firestore.exists` på memberships, samma id som Firestore-reglerna. Klienten får inte radera objektet (`allow delete: if false`). Sökvägen skickar appen in.
- **Vyn.** Bild ger förhandsbild och en förhandsvisning. PDF och övrigt öppnas i ny flik. För stor fil, fel format och en nekad uppladdning visas. En uppladdning som faller tar bort posten som hunnit skapas.

### Ljud

- **Spela in idé** i biblioteket och som rad i plusmenyn. Inspelaren är TALK:s, med taket som parameter. TALK behåller 120 sekunder. Biblioteket använder `IDE_MAX_SEKUNDER` (600). Rubriken är `ideRubrik`, "Idé" plus datum och tid, och går att döpa om.
- **Spelaren** i listan har spela, pausa och tid. Ett fel från uppspelningen visas.
- **Att dela** är `onDela` med flytta eller kopiera. Ramverket kopierar inte byte och byter inte `groupId`. Appen gör det, i personens grupp `my` när inspelningen ska börja privat.

### Utskrift

- **Fältet `utskrift`** bara på ett ljud, högst 20 000 tecken. Tom sträng är en utskrift utan ord. Saknas fältet har ingen bett om en. En bild, en anteckning och en länk får det inte.
- **Skriv ut** syns för den som får ändra posten, eftersom texten sparas som en ändring. `onSkrivUt` ber servern. Texten visas under spelaren. Sedan visas "Spara som anteckning" och "Skapa ärende", och agentens förslag är märkt. `onGorForslag` anropas först vid det trycket. En saknad koppling, ett svar utan text och ett kastat fel (också ett dygnstak) syns. En läsare ser en sparad utskrift och ingen knapp.

#### Prov, sedda röda utan sin ändring

| Prov | Utan ändringen | Med |
|---|---|---|
| Klient, radering (`bibliotekkalla`, `bibliotek-vy`) | exit 1, 5 fail, 18 pass. `kalla.radera is not a function` | exit 0, 23 pass |
| Emulator, `allow delete: if false` | exit 1, 19 pass, 1 fail. Författaren fick `PERMISSION_DENIED` | exit 0, 20 pass |
| Emulator, författarens medlemskap borta | 19 pass, 1 fail. Avslutat medlemskap raderade | grönt med villkoret |
| Emulator, författarens uid borta | 19 pass, 1 fail. En annan medlem raderade | grönt med villkoret |
| Emulator, `opsArAdmin` borta | 19 pass, 1 fail. Admin fick `PERMISSION_DENIED` | grönt med villkoret |
| Modell, typen `fil` okänd | exit 1. `Biblioteket känner typen "fil"` | 9 pass, sedan 10 med `ideRubrik` |
| Emulator, MIME-villkoret ersatt med `true` | 20 pass, 1 fail. `Expected request to fail, but it succeeded` | exit 0, 21 pass |
| Vy, utan Skriv ut | 1 fail. Knappen "Skriv ut" saknades | 20 pass i `bibliotek-vy` |
| Modell, fil utan ljudundantag för utskrift | 1 fail. `En fil har en fil, och ingen utskrift.` | `postFel` är null på ett ljud |
| Källa, utan att skriva `utskrift` | 1 fail. Fältet var `undefined` | tom sträng och "Hej" sparas, och en omdöpning behåller texten |
| Emulator, utan `^audio/.*` | 1 fail, rad 165. Bild med utskrift gick in | exit 0, 22 pass |
| Emulator, utan taket 20 000 | 1 fail, rad 166. För lång text gick in | exit 0, 22 pass |
| Emulator, anteckning får `utskrift` | 1 fail. Anteckningen gick in | exit 0, 22 pass |

#### Ändrade prov (granskas av någon annan än den som skrev dem, regel 9)

- `bibliotek-vy`: fliklistan förväntar "Filer 0" och menyn "Fil", utöver anteckning och länk.
- `grupp`: storage-fragmentets förval (bara profilbilder) är oförändrat. Nya prov läser bibliotekets gren: medlemskap, 25 MB, MIME och `delete: if false`.

### Efter merge av 0.84.0

- `check-gammalt-namn`: golvet höjt från 618 till 713. Med 618 var vakten röd, den läste 751 filer och 618 låg mer än 20 procent under (618 gånger 1,2 är 741,6). Med 713: grön, 751 filer lästa. 0.84.0 lade till 20 filer ovanpå grenens 731.

---

## 0.84.0

⛔ **Beslutet "gruppen är kalendern" (#309) är ersatt i 0.120.0** (cllp/lifehub.app#367): varje grupp har en standardkalender. Texten nedan står kvar som den skrevs.

Nattsprint 2026-10-08: #315, #309, #316 och halva #317. Ingen ändring av datamodellen och inga nya regler.

**Om numret:** 0.83.0 (PR 318) är mergad och utgiven, origin/main `a0d6c8e` och taggen `v0.83.0`, mätt 2026-10-08. Den här skivan är nästa minor efter den, eftersom `byggAnvandare` tar emot något den förut avvisade (#316). Skärmbildernas "före" är tagna mot 0.82.0 (`aada6ab`): 318 rör inte skrivfältet, Ny händelse eller kalendermenyn.

### Rättat

- ⛔ **Skrivfältet: en vald bilaga är innehåll (#315).** Med en bild vald och tomt fält stod "Prata in" där Skicka skulle stå, så på en pekskärm fanns ingen synlig väg att skicka bilden. Mätt med Playwright vid ompinningen till 0.80.1 (cllp/lifehub.app#134). Ljudvågen står nu bara när fältet verkligen är tomt: ingen text och ingen bilaga. Villkoret är ett och samma för ljudvågen och Skicka-knappens `disabled`, så de två kan inte säga olika saker om vad som är tomt (regel 2).
- ⛔ **Ny händelse säger gruppens namn, inte "Ingen kalender ännu" (#309).** Utan namngivna gruppkalendrar hamnar händelsen i gruppen (inget `kalender` skickas), och raden säger nu det. Texten `ingenKalender` är borttagen: ett fall utan grupp finns inte, eftersom en moduls formulär bara öppnas när `skapalaget` är `redo`, och det kräver en grupp. `git grep -n ingenKalender` ger noll träffar.
- ⛔ **Kalendermenyn ritar ingen tom rubrik (#309, CP:s kommentar 2026-10-08).** 0.78.2 tog bort den falska raden men lät "Gruppens kalendrar" stå ensam. Rubriken ritas nu bara när gruppen har namngivna kalendrar.
- ⛔ **`byggAnvandare` tar emot tom `epost` (#316).** Tom sträng betyder "ingen bevisad adress". Sedan 0.82.0 skriver en serverspegel adressen bara när `email_verified` är sant, och annars `epost: ""`, men `byggAnvandare` kastade "epost krävs", och den körs också på läsvägen (`sakerstallAnvandare`, `uppdateraProfil`). En sådan rad gick alltså varken att skriva eller läsa. Ingenting i ramverket ger åtkomst på `users.epost` sedan 0.82.0. En icke-tom adress normaliseras till gemener som förut.
- ⛔ **Mejl: felet för ett kvitto som inte går att skriva bär ingen adress (#317, andra halvan).** `src/node/mejl.js` kastade `rad.fel || rad.skal` omaskat, och SMTP-svaret kan bära mottagarens adress. I appen loggas felet som ohanterat, förbi appens maskning. Nu byts varje adress i det kastade felet mot `<adress hash>`, samma hash som `mottagarhash` i mejlhändelsen, så att de två går att para ihop. Kvittot i källan maskas inte, det är ägarens underlag.

### Inte gjort här

- **#317, första halvan** (en återinbjudan av en avslutad medlem förbrukar inbjudan): väntar på CP:s beslut mellan ärendets två förslag. Orörd.
- **#287 och #283 är redan gjorda, i 0.73.1** (`7bae970`, PR 288). Mätt i natt: `OpsModulKataloger` ritar modulnamnet med `Delrubrik`, och `kopplaBeteenden` och `hubbPoster` använder `Object.hasOwn`. Proven står kvar och är sedda röda igen i natt: med den fasta `<h3>` tillbaka faller 4 prov i `kallor.test.jsx`, och med `in` tillbaka faller 6 i `beteenden.test.js` och `hubb.test.jsx`. Övriga `in` i `src/lib` prövar fasta nycklar (`"url"`, `"del"`, `"katalog"`, `"hubb"`) eller fasta listor (`gruppikonarv.js`, `kalenderikoner.js`). Ärendena kan stängas.

### Vad appen måste göra vid ompinningen

1. **lifehub: ta bort mellanläget för `epost` i spegeln** (`functions/vaxling.js`, lifehub.app#124). Skriv `epost: ""` för en overifierad inloggning. Provet `functions/__tests__/vaxling.test.js` som väntar sig att `byggAnvandare` kastar på tom `epost` blir rött mot 0.84.0, enligt #316, och ska skrivas om.
2. **Inget annat.** Inga nya props, inga nya regler att deploya. Skrivfältet, Ny händelse och kalendermenyn ändras utan att appen gör något.

⛔ **Kvar efter #316, inte gjort här:** förvalets regel för `users` släpper inte in en klient som skapar sin rad med `epost: ""` från en overifierad inloggning (`opsProfilensEpost()` kräver då en verifierad adress). Det berör bara appar utan `kontoAgerPersonen` och utan serverspegel. Att släppa in tom sträng är en regeländring och ett eget beslut.

### Prov, sedda röda utan sin rättelse

| Prov | Utan rättelsen | Med |
|---|---|---|
| `chatt-bilagor.test.jsx`: samtalet med vald bild visar Skicka, inte Prata in | rött | grönt |
| `chatt-bilagor.test.jsx`: Skicka skickar bilagan utan text | rött | grönt |
| `chatt-bilagor.test.jsx`: tråden, samma regel | rött | grönt |
| `kalenderhantering.test.jsx`: Ny händelse utan namngivna kalendrar säger "Kalender: CPS AB" | rött (`Kalender:Ingen kalender ännu`) | grönt |
| `kalendrar.test.jsx`: ingen tom rubrik "Gruppens kalendrar" | rött | grönt |
| `profil.test.js`: en rad med tom `epost` läses och sparas | rött (`users: epost krävs`) | grönt |
| `nodProfil.test.js`: `uppdateraProfil` på en rad med tom `epost` | rött (`users: epost krävs`) | grönt |
| `grupp.test.js`: tom `epost` är tillåten (ersätter provet "epost krävs") | rött | grönt |
| `mejl.test.js`: kastat kvittofel utan adress, med hashen | rött | grönt |
| Playwright mot byggd dist, före och efter (`docs/jamforelser/0.84.0/`) | se nedan | se nedan |

### Skärmbilder (Playwright mot byggd dist, 390 och 1280 px)

`docs/jamforelser/0.84.0/montage.mjs` bygger samma yta mot main (`aada6ab`) och mot grenen. Mätt i webbläsaren, båda bredderna:

- Skrivfältet med en vald bild: före `["Prata in"]`, efter `["Skicka"]`. I vila `["Prata in"]` i båda.
- Ny händelse utan namngivna kalendrar: före `Kalender:Ingen kalender ännu`, efter `Kalender:CPS AB`.
- Kalendermenyn med bara egna kalendrar: före rubrikerna `["Gruppens kalendrar","Mina kalendrar"]`, efter `["Mina kalendrar"]`.

### Förebilden (regel 12 och 13)

**Skrivfältet.** SS `ComposerBar.jsx:395` räknar en vald artefakt som innehåll: Skicka är aktiv med `selectedArtifact` och utan text. Tas som det är. SS har ingen röstinmatning i skrivfältet, så frågan om vilken knapp som står där finns inte hos SS. ⛔ Ingen skärmbild av SS skrivfält finns här, och SS-appen går inte att starta i den här miljön (kräver Firebase). Montaget är därför före och efter, inte sida vid sida med SS, och det är en lucka mot regel 12.

**Kalendermenyn.** SS `CalendarSourceFilter.jsx` har inga namngivna gruppkalendrar: gruppen själv är en rad med `GroupMark` och namn. Tre listor:

- Som det är: ingen tom rubrik, och "Mina kalendrar" med sin tomrad.
- Bättre: inget.
- Struket, med kostnaden: gruppen själv som en valbar rad. Det hade krävt ett filter-id för "poster utan kalender", som modellen inte har (`filtreraPoster` lägger dem på `forvaldId`), och gruppens namn och färg som nya props till `OpsCalendar`. En rad som går att trycka på men inte filtrerar hade varit en död kontroll. Det är ett eget beslut. ⛔ Mätt i natt: utan namngivna gruppkalendrar men med en förvald egen kalender blir `forvaldKalenderId` den egna, så gruppens poster utan kalender räknas till den när den väljs. Det är ett eget fel och rörs inte här.

## 0.83.0

CP 2026-10-08 17:52 och 17:54, med bilder från telefonen av Bibliotek, Ekonomi och Hubben: "Bibliotek behöver en tillbaka knapp också precis som ekonomi. Sedan navigeringen på liknande sätt. Sök och komponenter är ihoptryckta." Och: "Varje app/modul borde kunna expanderas med chevron och det skall finnas en inställning om att ikon skall placeras i huvudmenyn."

### Biblioteket har Ekonomis ram

- **"‹ Tillbaka" och rubriken.** `OpsBibliotek` ritar samma tillbaka-rad som `OpsModulSida` (en ny intern `modulTillbaka` i `src/lib/modulram.js`, som båda läser): länken till hubben och "Bibliotek" som rubrik. I detaljen står bara detaljens egen Tillbaka, till listan.
- **Typerna är Ekonomis flikrad.** Alla, Anteckningar och Länkar är en `OpsTabs` med den nya formen `medOrd`: ikon, ord och antal på en rad med accentlinjen under den valda. Klasserna är `OpsModulSida`s, flyttade till `modulram.js` (`flikKlass`, `FLIKRAD`, `FLIKIKON`), så att raderna inte kan glida isär. Före var typerna en segmentväljare i pillerform. De är fortfarande ett urval i samma lista och inte länkar till egna adresser: sökordet står kvar när man byter flik.
- **Luften.** Mätt med Playwright mot lifehub-appens mätbygge, 390 och 1280 px: mellan sökfältet, segmentväljaren, knapparna och listan stod 0 px, eftersom allt låg i ett omslag (`data-bibliotek`) utan vyns rytm. Ekonomi har 16 px (`gap-4`) mellan rubriken, raden och innehållet. Omslaget, flikpanelen och detaljen har nu samma rytm.
- **Sök och "+ Ny" på en rad**, som SessionStudios bibliotek. Under Alla öppnar "+ Ny" ett val mellan anteckning och länk. Under en typ skapar den typen direkt ("Ny anteckning", "Ny länk"). Sökfältet har ingen synlig etikett: platshållaren och skärmläsarnamnet säger samma sak.
- **Bredden** är vyns förval (`normal`, som Ekonomi) i stället för `narrow`, så att tillbaka-raden och rubriken står på samma plats när man går mellan modulerna på en dator.
- **`knappKlass`** (intern, i `OpsButton.jsx`) är knappens klasser för en avtryckare som inte kan vara en `OpsButton`: "+ Ny" är en Radix `Popover.Trigger`, som ritar sitt eget `<button>`. `OpsButton` läser samma funktion.

### Hubbens kort fälls ut med en chevron

- **Kortet är länken, chevronen är knappen.** I `OpsGruppHubb` får ett kort för en modul med fler än en del en chevron (`<button aria-expanded aria-controls>`, "Visa delarna i Ekonomi", 44 px) bredvid länken, aldrig i den. Utfälld visar den modulens delar (`hubb.delar`) som länkar med ikon. Kortet leder som förut till modulens startsida.
- **En modul med en enda del får ingen chevron.** Mätt på Bibliotek: dess enda del `lista` leder till `/bibliotek`, samma adress som kortet, och en utfälld lista med en rad dit visar inget nytt.
- **Läget sparas inte mellan besök.** Kortet börjar utfällt när en av dess sidor är aktiv, annars stängt.
- **`hubbPoster` tar `delar: true`** och ger då `children` till moduler med fler än en del. Toppradens rullgardin ber inte om dem och listar fortfarande bara moduler.

### Modulens ikon i huvudet: `groups.huvudmeny`

- **Ett nytt fält på gruppen, ägarens.** `huvudmeny` är en lista modul-id, en delmängd av `moduler`, och står i `AGARGRUPPFALT`. Regelfragmentets `hasOnly` för ägaren bär det, admin-listan inte. Saknas fältet är svaret `[]`, och en grupp ser ut som förut.
- **`byggGrupp`** läser fältet (förval `[]`), prövar formen (en lista, modul-id, inga dubbletter) och, på skrivvägen, att varje id är en av gruppens moduler. Läsvägen kastar inte på ett id som tagits bort ur `moduler`.
- **`huvudmenyPoster({ grupp, moduler, sprak })`** (ny export) ger raderna att rita: gruppens moduler i gruppens ordning, filtrerade på `huvudmeny`, med manifestets `hubb.ikon` och `hubb.rutt`. Appen ritar dem som `OpsIconLink` i `actions`, där den vill ha dem.
- **`OpsGruppFormular`** har reglaget "Visa i huvudmenyn" under varje vald app med kort, bara för ägaren och bara i redigeringsläge, som modulvalet. `onSpara` får `huvudmeny` bredvid `moduler`, alltid som en delmängd: en app som väljs bort tas ur huvudmenyn i samma sparning. En admin skickar aldrig fältet.

#### ⛔ Brytande

- **`OpsBibliotek` kräver `hubHref`** och kastar utan den, som `OpsModulSida`. `onNavigate` och `hubEtikett` är valfria.
- **`OpsBibliotek` har inga knappar "Ny anteckning" och "Ny länk" under Alla.** Där står "+ Ny" ("Ny post") med ett val. Under en typ heter knappen "Ny anteckning" eller "Ny länk".
- **`OpsHub`:s kort med barn är en länk**, inte en knapp, och raden "Visa Ekonomi" är borta. `visaEtikett` läses inte längre.
- **Regelfragmentet för `groups` ändras** (`huvudmeny` i ägarens `hasOnly`). En app ska generera om sina regler och **deploya dem före** den klienthalva som skriver fältet. Utan det nekas ägarens sparning i gruppens inställningar, hela sparningen och inte bara fältet.

#### Prov, sedda röda utan sin ändring

| Prov | Utan ändringen | Med |
|---|---|---|
| `bibliotek-vy`: Tillbaka leder till hubben, rubriken är modulens namn | rött | grönt |
| `bibliotek-vy`: `hubHref` krävs | rött | grönt |
| `bibliotek-vy`: flikrad med ikon, namn och antal, också 0 | rött | grönt |
| `bibliotek-vy`: sökordet står kvar när fliken byts | rött | grönt |
| `bibliotek-vy`: "+ Ny" med val under Alla, direkt under en typ | rött | grönt |
| `bibliotek-vy`: sök och "+ Ny" på en rad, omslaget har vyns rytm | rött | grönt |
| `data-primitives`: `OpsTabs medOrd` | rött | grönt |
| `hubb`: samma klasser i modulens rad och bibliotekets flikar | rött | grönt |
| `hubb`: chevronen fäller ut delarna, ligger utanför länken, heter efter modulen på engelska | rött | grönt |
| `hubb`: grannkorten sträcks inte medan ett kort är utfällt | rött | grönt |
| `hubb`: `hubbPoster` med `delar`, `huvudmenyPoster` | rött | grönt |
| `hubb`: reglaget i gruppformuläret, delmängden vid bortval | rött | grönt |
| `grupp`: `huvudmeny` läses, prövas och är ägarens | rött | grönt |
| Emulator: ägaren ändrar `huvudmeny` | rött (`hasOnly` utan fältet) | grönt |
| Emulator: admin ändrar inte `huvudmeny` | rött med fältet i `ADMINGRUPPFALT` | grönt |

Tre nya prov är gröna också mot 0.82.0, och det är rätt: de vaktar ett beslut i den nya formen, inte ett fel som fanns. "I detaljen bara detaljens Tillbaka" (0.82.0 hade ingen länk till hubben alls), "en modul med en enda del har ingen chevron" (0.82.0 hade ingen chevron alls) och "en admin skickar aldrig huvudmenyn" (0.82.0 hade inget fält). De blir röda om någon lägger till en andra Tillbaka, en chevron på Bibliotek eller fältet för en admin.

#### Ändrade prov (granskas av någon annan än den som skrev dem, regel 9)

- `hubsida`: "knappen bär aria-expanded ... och 'Visa Ekonomi' leder till modulens sida" heter nu "chevronen bär aria-expanded ... och kortet självt leder till modulens sida". Beteendet är ändrat på CP:s begäran.
- `hubb`: "en grupp med Ekonomi har ETT kort" sade att delarna inte står i hubben. Nu: de syns inte förrän chevronen fälls ut.
- `bibliotek-vy`: de två proven som tryckte på "Ny länk" och letade efter "Ny anteckning" under Alla trycker nu på "Ny post" och väljer.
- `skal030`: "OpsHub: ... ett med barn en utfällbar knapp" läser nu kortet som länk med en chevron bredvid.
- `skal031`: tre prov som tryckte på kortet som knapp, eller på raden "Visa Ekonomi" / "Show Ekonomi", trycker nu på chevronen och på kortets länk.

---

## 0.82.0

#313: en adress i `users` gav bort medlemskap. Upptäckt i den tredje granskningen av PR 308, och mätt en gång till i granskningen av lifehub.app#117.

**Om numret:** 0.79.0-skivan (#304, biblioteket) numrerades om till 0.81.0 och är mergad (`e7fdd75`). Den här skivan ändrar API:t och är nästa minor efter den, 0.82.0.

### Inbjudningar: bara den som äger adressen blir medlem

**Felet.** Förvalets regel för `users` prövade bara vilka fält raden hade (`keys().hasOnly`), aldrig vad `epost` innehöll. Mätt i emulatorn: en inloggad användare skrev in någon annans adress i sin egen rad, också med `email_verified: false`. Kommentaren ovanför regeln sade "e-posten kommer ur inloggningen", och det var inte sant. `bjudIn` slog sedan upp adressen med `where epost ==` och skrev medlemskapet direkt, i den roll inbjudan angav. Den som skrivit offrets adress blev medlem, eller ägare, när någon bjöd in offret. Samma sak hände i lifehub utan klienten: appens serverspegel skrev `epost` ur växlingen utan att pröva `email_verified`, och en overifierad växling följd av `bjudIn` som `agare` gav `memberships/angripare|dev` med `roll: "agare"`.

**Valet.** Båda halvorna rättas, eftersom regel 1 gäller och det inte räcker att lita på att den ena håller. Grenen i `bjudIn` tas bort, form (b) i ärendet, i stället för att skyddas med ett fält `epostVerifierad` i `users` (form (a)). Ett sådant fält hade varit en ny uppgift i datamodellen, skriven av en spegel som appen äger och ramverket inte, och en app som glömde det hade varit lika öppen som förut. Det gör modellen tyngre utan att stänga hålet (regel 13). I stället bevisas adressen av den som äger brevlådan: varje inbjudan blir en väntande rad, och accepten kräver en verifierad inloggning.

#### ⛔ Brytande

- **`accepteraInbjudningar` kräver `epostVerifierad: true`.** Skicka `request.auth.token.email_verified` rakt ur inloggningen. Saknas fältet, eller är det något annat än `true`, kastar accepten med texten att adressen inte är verifierad, och ingen inbjudan accepteras. Fältet förvals inte: `true` hade öppnat hålet igen för en app som aldrig läste token, och `false` hade gjort varje accept tom utan att något sade det.
- **`bjudIn` skriver aldrig ett medlemskap.** Svaret är alltid `resultat: "inbjudan"`. `medlemskap` och `fanns` finns inte längre, eftersom de kom ur uppslaget i `users`. En person som redan har ett konto blir medlem vid nästa accept, inte i samma sekund.
- **`bjudIn` kastar när `typ` skickas.** Den bestämde typen på medlemskapet grenen skrev. Felet säger att `typ` togs bort i 0.82.0, och inget skrivs. Ett tyst bortfall hade sett ut som att värdet hamnade någonstans (regel 5). Accepten skriver `typ: "person"`, som förut.
- **En app med ett eget flöde för inbjudningar får nya beteenden.** lifehub.app#117 har grenar för svaren `fanns` och `medlemskap`, och de blir döda: svaret är alltid `inbjudan`. En adress som redan är medlem får nu en väntande rad, och därmed ett inbjudningsmejl om appen mejlar vid `inbjudan`, där den förut fick `fanns` och inget mejl. Appen måste ta hand om båda: ta bort de döda grenarna, och avgöra om ett mejl till en befintlig medlem ska skickas eller hållas tillbaka.
- **`skapaGrupp` svarar alltid `tillagda: []`.** Varje inbjuden adress, också en med konto, står i `inbjudna`. Fältet står kvar så att svaret har samma form.
- **Regeln för `users` (förvalet, utan `kontoAgerPersonen`) prövar adressen.** Skriver eller ändrar klienten `epost` måste det vara `request.auth.token.email` i gemener, och `email_verified` måste vara `true`. En rad utan `epost` påverkas inte, och en uppdatering som inte rör fältet prövas inte mot det. Med `kontoAgerPersonen: true` är regeln oförändrad: klienten skriver aldrig `epost` där.
- **Gamla `users`-rader som redan bär en annan persons adress står kvar**, och klienten får fortsätta uppdatera dem så länge `epost` inte rörs. Ramverket litar inte längre på fältet, så raderna ger ingen åtkomst, men de är fortfarande felaktiga uppgifter om personen. En app bör städa dem, till exempel genom att jämföra `epost` med kontots verifierade adress i Admin SDK och tömma fältet där de inte stämmer.

#### Vad appen måste göra

1. **Anropa `accepteraInbjudningar` vid varje inloggning**, med `uid`, `epost` och `epostVerifierad` ur `request.auth`. En app som inte anropar den alls får nu inga nya medlemmar, eftersom `bjudIn` inte längre skriver medlemskapet direkt. lifehub anropar den inte i dag (mätt 2026-10-08 med `git grep` på `origin/main` `8035d9c` och på grenen till lifehub.app#117, ingen träff på `accepteraInbjudningar`) och måste koppla in den för att en inbjuden ska komma in.
2. **Läs `tillagda` inte som "kom in direkt".** En vy som säger "N lades till" ska säga "N bjöds in".
3. **En klient som skriver `epost` i `users`** ska skriva inloggningens adress i gemener, och bara när adressen är verifierad. Annars nekas skrivningen av reglerna. Ramverkets egna vyer skriver inte fältet.
4. **En serverspegel som skriver `epost`** (lifehub, `personspegel`) ska skriva den bara när `email_verified` är `true`. Ramverket litar inte längre på fältet, men en adress som ingen bevisat är fortfarande en felaktig uppgift om personen.
5. **Generera om reglerna och deploya dem** innan klienthalvan som skriver `epost` pinnas om.

#### Rättat

- **`bjudIn`:s gren för en befintlig användare är borttagen** (`src/node/inbjudan.js`). Den slog upp `users` på `epost` och skrev medlemskapet direkt. Varje inbjudan blir nu en rad i `invitations`.
- **Accepten kräver en verifierad adress.** Före 0.82.0 matchade den den adress den fick, och ett konto med e-post och lösenord kan skapas på vilken adress som helst utan att brevlådan öppnats.
- **Regeln för `users`** prövar `epost` mot inloggningen, se ovan. Två nya hjälpfunktioner i fragmentet, `opsProfilensEpost()` och `opsEgenVerifieradEpost()`, och create och update står kvar i ett block så att `hasOnly`-listan finns en gång (vakten i `check-gruppnyckel` läser att den är härledd). Kommentaren som sade "e-posten kommer ur inloggningen" är rättad.

#### Prov, sedda röda utan sin rättelse

| Prov | Utan rättelsen | Med |
|---|---|---|
| Emulator: en annans adress nekas, också med verifierad egen inloggning | rött | grönt |
| Emulator: egen overifierad adress nekas | rött | grönt |
| Emulator: egen adress utan `email_verified` i token nekas | rött | grönt |
| Emulator: en uppdatering som byter till en annans adress nekas | rött | grönt |
| Emulator: egen verifierad adress släpps in, i gemener mot en inloggning med versaler | rött utan `.lower()` | grönt |
| Emulator: en rad utan `epost` släpps in | rött utan undantaget för en rad utan fältet | grönt |
| Emulator: en uppdatering som inte rör adressen prövas inte | rött när update prövar adressen alltid | grönt |
| Emulator: overifierad och flaggfri inloggning nekas | rött utan villkoret på `email_verified` | grönt |
| Enhet: en klientskriven users-rad med offrets adress ger inget medlemskap efter `bjudIn` | rött | grönt |
| Enhet: en befintlig användare får en väntande inbjudan, inget medlemskap | rött | grönt |
| Enhet: `bjudIn` skriver aldrig ett medlemskap | rött | grönt |
| Enhet: en overifierad adress accepterar ingenting | rött | grönt |
| Enhet: en accept utan `epostVerifierad` kastar | rött | grönt |
| Enhet: `skapaGrupp` med en adress med konto ger en väntande inbjudan | rött | grönt |
| Emulator: en tom `epost` med en token utan `email` nekas (PR 314, KAN 1) | rött utan villkoret `email != ''` | grönt |
| Enhet: `bjudIn` med `typ` kastar (PR 314, KAN 4) | rött | grönt |
| Vakt: `check-changelog-taggar`, en publicerad tagg utan rubrik (PR 314, B1) | rött mot CHANGELOG i `67cbd7e` och i `test-guards` | grönt |

#### Granskningen av PR 314

- **B1. Rubriken `## 0.80.1` var borttagen** i första versionen av den här skivan, och texten för 0.80.1 stod utan rubrik under 0.82.0. Rubriken är tillbaka. `check-paket` fångade inte felet eftersom den bara läser versionen i `package.json`. Den nya vakten `check-changelog-taggar` (i `npm run check`) kräver en rubrik för varje publicerad tagg (`git tag -l 'v*'`), med ett golv på 10 lästa taggar så att en utcheckning utan taggar blir röd i stället för grön på tomt. Taket är 0: mätt 2026-10-08 har alla 82 taggar en rubrik. CI hämtar nu taggarna (`fetch-tags: true` i `check.yml` och `publish.yml`).
- **`resource != null` i `opsProfilensEpost()` är borttaget.** I en create blir mellantermen ett utvärderingsfel, men ett fel i en `||` vinner aldrig över en sann term, och ensamt ger det samma nej som en falsk term. Mätt i emulatorn med och utan villkoret: samma utfall i alla 409 prov och samma svar till klienten, `7 PERMISSION_DENIED` utan text.
- **`probe-tmp.mjs` är borttagen ur repots rot.** Ingenting refererade till den (`git grep -n probe-tmp` gav noll träffar), och den var en rest från 0.31.0.

## 0.81.0

Bibliotek, skiva 1 (#192). Analysen ligger i `docs/beslut/0004-bibliotek-ss-analys.md` (#303, mergad). Skivan bar numret 0.79.0 medan den granskades, och montaget ligger kvar under det numret i `docs/jamforelser/0.79.0/`. 0.78.1, 0.78.2, 0.80.0 och 0.80.1 är mergade, och main står på 0.80.1, mätt på origin/main `e98350f` 2026-10-08. 0.79.0 gavs aldrig ut, och den här är nästa minor efter main.

⛔ **Radering kommer i nästa skiva.** CP valde 2026-10-08 att författaren och admin ska kunna radera en post (#311). Den här skivan går ut utan radering eftersom den redan var granskad, så här raderar ingen. Skiva 1b lägger till `allow delete`, `radera` i källan och en knapp i detaljvyn.

### Tillagt

- `byggPost`, `postFel` och `inmatningsfel`. En post är en `anteckning` med text eller en `lank` med adress på http eller https. Gruppen, författaren och klockslagen hör till dokumentet. Adressen på en anteckning och texten på en länk avvisas. En rubrik eller text är tom när den bara består av tecknen U+0000 till U+0020, som i regeln (se Rättat).
- `ADRESSFORM`, ett `RegExp` för länkens adress. Regeln får det som `matches()` genom `regelRegex`, så regeln och `postFel` kan inte säga olika om en adress. `normaliseraAdress` sätter procentkod på det som går att läsa, före prövningen.
- `farAndra(post, jag)`: regelns `update` i klienten, författaren eller ägare och admin.
- `createBibliotekskalla({ source, collection, groupId, skapare })`. Samlingsnamnet och gruppen kommer utifrån. `las` svarar med `kalla`, `fel` och `trasiga`, så en tom lista går att skilja från en läsning som föll. En rad som inte klarar `postFel`, eller bär en annan grupp, står i `trasiga` med id och skäl och släcker inte de andra.
- `OpsBibliotek`: lista, sök, tre lägen med antal (också noll), detalj och formulär. Formuläret bara för den som får ändra (`jag`), annars läsläge. `jag` krävs, och `null` betyder att personen inte är medlem. En länk öppnas i ny flik med `rel="noopener noreferrer"`, och bara på http eller https. Trasiga rader visas som ett antal med skäl.
- `bibliotekregelfragment(namn)`. Medlem i radens grupp läser. En person, inte en agent, skapar som sig själv. Författaren eller admin ändrar. Ingen raderar. `skapad` och `andrad` är serverns klocka (`opsBiblioteketNu`, samma uttryck som samtalens `opsNu`, nu ur en delad generator i `regler.js`). Samtalens regeltext är byte för byte densamma.

### Rättat före merge (granskningen av PR 304)

- **Regeln och modellen räknade tomhet olika.** Regeln prövar `trim().size() > 0`, och Firestores `trim()` tar bara bort U+0000 till U+0020. Modellen använde JavaScripts `trim()`, som tar bort alla Unicode-blanktecken men inte U+001F. Mätt mot emulatorn räknades 46 tecken olika: en rubrik av bara U+00A0, U+3000, U+2028 eller U+FEFF släpptes in av regeln och fick "Rubriken saknas." av modellen, och en rad som regeln släppt in hamnade i `trasiga` för alltid eftersom ingen får radera. Åt andra hållet nekade regeln U+001F som modellen godtog. Nu trimmar `inmatningsfel`, `postFel`, `byggPost` och vyns rubrikfält genom en funktion, `trimSomRegeln` i `bibliotek.js`, som gör som Firestore.
- **Källan trimmar gruppen som modellen.** `createBibliotekskalla` trimmade `groupId` med JavaScripts `trim()`, och `byggPost` med `trimSomRegeln`. Nu samma funktion på båda ställena, så gruppen i frågan är den raden bär.
- **`jag` krävs i `OpsBibliotek`.** Förvalet var `null`, så en app som glömde propen såg ut som en icke-medlem: inga knappar och inget fel. Nu kastar vyn när `jag` saknas, och `null` betyder att personen inte är medlem.

### Prov

- `rules/__tests__/bibliotek.test.mjs`, 20 prov mot emulatorn. Två nya för tomheten: de fyra rubrikerna och två texterna ovan släpps in av regeln och godtas av modellen, och U+001F nekas av båda. Det andra jämför regeln och modellen tecken för tecken på 84 tecken (kontrolltecknen och ASCII upp till `@`, plus varje tecken JavaScripts `\s` känner), med golv för antalet och för att båda svaren förekommer. Med JavaScripts trim i modellen: 2 röda av 20, 92 avvikelser (46 tecken, rubrik och text). Med `trimSomRegeln`: 20 av 20 gröna. Jämförelsen kör också `postFel(byggPost(rad))` för varje tecken. Med JavaScripts trim bara i `byggPost` (rubrik och text): 1 rött av 20, 38 avvikelser (19 Unicode-blanktecken, rubrik och text, där regeln säger ja och den byggda raden inte klarar `postFel`). Med `trimSomRegeln`: 20 av 20 gröna.
- `src/__tests__/bibliotek.test.js`, tomheten som Firestore: röd med JavaScripts trim ("Rubriken saknas." där regeln säger ja), grön med `trimSomRegeln`. `src/__tests__/bibliotek-vy.test.jsx`, `jag` krävs: röd med förvalet `null` (inget kastades), grön nu.
- Proven i första versionen av grenen, för historiken: 18 prov mot emulatorn. Mutationskörning: varje villkor i fragmentet togs bort ett i taget, och 40 av 40 mutationer gav minst ett rött prov. Tabellen står i PR:en. Typkontroller som inte kunde ändra utfallet togs bort ur regeln. Samma prov mot fragmentet i första versionen: 12 gröna, 6 röda.
- `src/__tests__/bibliotek.test.js`, `src/__tests__/bibliotekkalla.test.js` och `src/__tests__/bibliotek-vy.test.jsx`, 17 prov, nu 19 med de två ovan. De fem nya proven för källan och vyn är röda mot första versionens kod och gröna nu.

## 0.80.1

Ramverkets del av granskningen av lifehub.app PR 117, punkt 3 och 4, arkitektens beslut i PR 308 om en adress som bjuds in igen, och granskningen av PR 308. Om numret: 0.80.0 (#307) är mergad och publicerad, och 0.80.1 kommer efter den. 0.79.0 (#304) får ett nytt nummer efter 0.80.1.

### Inbjudningar: återkallelsen håller, id:t kan inte krocka, och en ny inbjudan skriver aldrig över

#### ⛔ Brytande

- **Appens Admin-källa måste ha `createNew` och `updateIf`.** `createInvitationService` och `createGroupService` nekar en källa utan någon av dem när tjänsten byggs, alltså när functions startar. Felet namnger den tjänst appen byggde. Se "Vad appen måste göra".
- **Ett andra klick på samma adress kastar.** Före 0.80.1 svarade `bjudIn` `fanns` när en väntande inbjudan redan fanns. Nu kastar den med texten att adressen redan har en väntande inbjudan och att man skickar om den i stället.
- **`accepteraInbjudningar` svarar `{ accepterade, utgangna }`.** `utgangna` är grupperna vars väntande inbjudan hade gått ut och därför inte accepterades. Tom lista, aldrig utelämnad. En app som jämför hela svaret med `{ accepterade }` måste ta med fältet.
- **En utgången inbjudan accepteras inte längre.** Förut blev en väntande rad ett medlemskap hur gammal den än var, med den roll den bar när den skrevs.
- **Klienten får bara ändra en inbjudans `status` från `vantar` till `aterkallad`.** En app vars klient skriver något annat på en inbjudan nekas av reglerna.
- **`bjudIn` säger aldrig "redan medlem" om en accepterad rad.** Den öppnar raden igen när adressen saknar en användarrad, och svarar `fran: "accepterad"`. Har adressen en användarrad skriver den medlemskapet direkt, som förut. Se "Det halva läget".

#### Rättat

- **Regelfragmentet för inbjudningar.** En admin fick sätta `status` till vilket värde som helst, och i lifehub sattes en återkallad ägarinbjudan tillbaka till `vantar`. Klienten får nu bara ändra `status`, och bara från `vantar` till `aterkallad`. Alla andra övergångar och alla andra fält nekas. Accepten och ett nytt utskick sker på serversidan med Admin SDK, förbi reglerna.
- **Inbjudans id.** Det var `${groupId}_${epost}`, och `_` är lagligt i ett grupp-id (`ID_FORM`), så `acme` + `team_bob@x.se` och `acme_team` + `bob@x.se` fick samma dokument och den andra inbjudan skrev över den första. Id:t är nu `inbjudningsId(groupId, epost)`: grupp-id:t, `|` och SHA-256 (hex) av adressen i gemener. `|` går inte att skriva i ett grupp-id och finns aldrig i en hash, alltså kan två par inte dela id. Adressen står inte längre i klartext i id:t.
- **En inbjudan skrivs aldrig över.** `bjudIn` skapar en ny rad med `createNew` i stället för `create`. Förut skrev en ny inbjudan över en befintlig rad med samma id, och historiken över en återkallelse försvann.
- **Accepten tar raden innan den skriver medlemskapet** (granskningen av PR 308, K1). Förut lästes raden, medlemskapet skrevs, och raden fick en vanlig `update` till `accepterad`. En återkallelse mellan läsningen och skrivningen gav ändå ett medlemskap, och `update` skrev över `aterkallad`. Nu gör accepten `updateIf({ status: "vantar", roll, giltigTill })` till `accepterad` först, och bara den som vinner skriver medlemskapet. Ordningen har ett halvt läge, och det är valt: allt efter anspråket, också läsningen av medlemskapet, ligger i samma `try`, och faller något lämnas raden tillbaka till `vantar` med en villkorad skrivning (bara en rad som fortfarande står `accepterad`), och felet går vidare. Den omvända ordningen hade gett ett medlemskap utan inbjudan, alltså åtkomst, vilket är värre än en inbjudan utan medlemskap.
- **Anspråkets villkor på `roll` och `giltigTill` har setts falla** (omgranskningen av 5c0d885, B1). Inbjudan står `vantar` med rollen `agare`, går ut mellan acceptens listning och anspråket, och ägaren bjuder in igen som `medlem`: utan villkoret på rollen blev personen ägare och nedgraderingen försvann. Nu ger anspråket inget medlemskap när raden har ändrats sedan listningen.
- **Medlemskapet skrivs med `createNew`**, i accepten och i `bjudIn` (K3). Två rader som väntar för samma grupp, eller två inbjudningar samtidigt, kan inte skriva över varandras medlemskap: det som hann först står kvar med sin roll.
- **Raden för (grupp, adress) väljs deterministiskt** (K2). Finns flera rader, en gammal och en ny, går en giltig väntande rad först, sedan en accepterad, sedan en utgången och sist en återkallad. Inom samma sort går det nya id:t först, sedan id:t i bokstavsordning. Förut valdes det nya id:t och annars listningens första rad, så svaret berodde på i vilken ordning källan listade.

#### Ändrat

- **En inbjudan till en adress som redan har en rad i gruppen**, arkitektens beslut i PR 308. Raden för (grupp, adress) avgör, och den hittas på fältet `epost`:

  | Raden | `bjudIn` |
  |---|---|
  | finns inte | skapar den med `createNew` |
  | `aterkallad`, eller `vantar` med `giltigTill` passerad | öppnar den igen med `updateIf`: `status` blir `vantar`, med ny `tokenHash`, ny `giltigTill`, den nya inbjudans `roll` och `skapadAv`. Raden skapas inte på nytt. Svaret är `{ resultat: "inbjudan", id, ateroppnad: true, fran }`, där `fran` är `aterkallad` eller `utgangen` |
  | `vantar` och fortfarande giltig | kastar: adressen har redan en väntande inbjudan, skicka om den i stället |
  | `accepterad` | öppnar den igen på samma sätt, med `fran: "accepterad"`. Hit kommer bara en adress utan användarrad, och utan uid går medlemskapet inte att slå upp. Se "Det halva läget" |

  Villkoret i `updateIf` är statusen som lästes, och för en rad med `giltigTill` också den lästa `giltigTill`. För en utgången rad är statusen `vantar` både före och efter, så där är det `giltigTill` som skiljer två återöppningar åt. För en återkallad rad utan `giltigTill` är det statusen. Två samtidiga återöppningar ger alltså en vinnare, och den andra får felet att inbjudan redan väntar.
- `bjudIn` tar emot `tokenHash`, SHA-256 i hex av den kod appen mejlar. Ramverket skapar ingen kod. Utan `tokenHash` blir fältet tomt, och en tom hash matchar aldrig något, så den gamla kodens hash överlever aldrig en återöppning.
- Utgång räknas på ett ställe, för både `bjudIn` och accepten: en väntande rad vars `giltigTill` har passerats. En rad utan `giltigTill` räknas som giltig.

#### Det halva läget, och hur det repareras

Accepten tar raden (`vantar` till `accepterad`) innan den skriver medlemskapet. Faller något efter anspråket lämnas raden tillbaka till `vantar`, och nästa inloggning försöker igen. **Det som återstår är att processen dör mellan anspråket och medlemskapet**: då hinner ingen återlämning köras, och raden står `accepterad` utan medlemskap. Nästa inloggning gör då ingenting, eftersom raden inte längre väntar.

Det läget repareras genom att bjuda in adressen igen:

- **Har personen en användarrad** (har loggat in) skriver `bjudIn` medlemskapet direkt, med den roll inbjudan nu anger, och svarar `medlemskap`. Finns medlemskapet redan svarar den `fanns` och rör det inte.
- **Saknas användarraden** går medlemskapet inte att slå upp, och `bjudIn` öppnar den accepterade raden igen (`fran: "accepterad"`). Personen accepterar vid nästa inloggning och blir medlem. Fanns medlemskapet ändå rör accepten det inte, så en återöppning höjer aldrig en roll.

"Redan medlem", som `bjudIn` svarade förut, var ett påstående ingen kontrollerat och var osant just i det här läget. Valet att öppna raden igen är det säkra, eftersom det aldrig ger mer än den som bjuder in får ge nu.

Uppslaget i `users` är en exakt likhet mot den normaliserade adressen, så en användarrad vars `epost` har en annan form missas, och raden öppnas igen i stället för att medlemskapet skrivs direkt. Det är ofarligt, eftersom ett befintligt medlemskap aldrig ändras. `fran: "accepterad"` kan alltså betyda att personen redan är med, att hen har tagits bort, eller att medlemskapet aldrig skrevs. En borttagen person, med medlemskapet `avslutad`, kommer inte in igen den här vägen.

En återöppning skriver över `skapadAv` och `tokenHash` med den nya inbjudans värden.

Kastar återlämningen själv går det ursprungliga felet inte förlorat: felet som går vidare bär båda meddelandena, säger att raden står `accepterad` utan medlemskap och att den repareras genom att bjuda in igen, och har det ursprungliga felet som `cause`.

#### Tillagt

- Datakontraktets regel 8, `createNew(samling, data)`: frivillig, skriver bara om id:t är ledigt, i samma atomära steg, och svarar `{ created, row }`. `createMemorySource` har den, och `createRoutingSource` skickar den vidare och kastar med samlingens namn när just den källan saknar den.
- `inbjudningsId` exporteras ur `ops-framework/node`.

#### Gamla id:n

En inbjudan skriven före 0.80.1 har kvar id:t `${groupId}_${epost}`, och ingenting skrivs om. Den fungerar som förut, eftersom ramverket aldrig slår upp en inbjudan på id:t: `bjudIn` och `accepteraInbjudningar` listar på fältet `epost`. En gammal rad räknas som en rad för (grupp, adress): är den väntande kastar `bjudIn` med det gamla id:t, är den återkallad eller utgången öppnas den igen under sitt gamla id, och den accepteras under sitt gamla id. Det skapas alltså ingen andra rad bredvid den. En app som själv bygger id:t med den gamla formeln för att läsa en rad ska sluta med det och använda id:t ur listningen, eller `inbjudningsId` för rader skrivna från 0.80.1.

#### Vad appen måste göra

1. **Appens Admin-källa i `functions/grupp.js` behöver både `createNew` och `updateIf`, annars startar inte functions.** `createNew` skrivs med `ref.create`, och felkoden 6 (`ALREADY_EXISTS`) betyder "finns redan": fånga just den, läs raden och svara `{ created: false, row }`, och låt alla andra fel gå vidare. `updateIf` skrivs med `db.runTransaction`: läs med `tx.get`, jämför villkoret och skriv med `tx.update`. Båda exemplen står i README. Det här är en brytande ändring för adaptern, fast numret är en patch.
2. **Skicka in `tokenHash` till `bjudIn`** om appen mejlar en kod, och visa felet för en väntande inbjudan. Ett andra klick på samma adress är nu ett fel och inte `fanns`. Svarar `bjudIn` med `fran: "accepterad"` kan personen redan vara med, och vyn bör säga det.
3. **Läs `utgangna` i svaret från `accepteraInbjudningar`**, och säg till personen att inbjudan gått ut och att hen behöver en ny.
4. **Generera om reglerna** ur `regelfragment()` och **deploya dem före klienten**. En klient som redan bara återkallar påverkas inte, men regeln i produktion är den som skyddar, och en regel i main är inte en regel i produktion.
5. Sluta bygga en inbjudans id för hand, om appen gör det (se Gamla id:n).

#### Prov

- `rules/__tests__/grupper.test.mjs`, inbjudan: 163 av 163 gröna med villkoret. Varje övergång och varje fältprov har en egen rad, så att ett nekande prov som av misstag släpps in inte ändrar utgångsläget för nästa. Svepet, ett villkor i taget utslaget i den genererade regeltexten:
  - utan övergångsvillkoret (som på main): 5 röda, `aterkallad` till `vantar` (ägare och admin), `accepterad` till `vantar`, `accepterad` till `aterkallad`, `vantar` till `accepterad` från klienten, och golvprovet som läser tillbaka raderna.
  - utan `resource.data.status == 'vantar'`: 2 röda, `accepterad` till `aterkallad` och golvprovet.
  - utan `request.resource.data.status == 'aterkallad'`: 2 röda, `vantar` till `accepterad` och golvprovet.
  - utan listan över ändrade fält: 7 röda, en återkallelse som också ändrar `tokenHash`, `giltigTill`, `groupId`, `roll`, `epost` eller `antalSkickade`, och golvprovet.
  - utan `opsArAdmin`: 2 röda, en vanlig medlem som återkallar, och golvprovet.
  - `vantar` till `aterkallad` av en admin och av ägaren är gröna i alla fem.
- `src/__tests__/inbjudan.test.js`, 65 prov, 65 av 65 gröna med rättningen. Prov som lagts till efter omgranskningen av 5c0d885, ett i taget utan sin rättelse:
  - utan `roll` i anspråkets villkor: 1 rött, en ny roll mellan listning och anspråk gav ett medlemskap med den gamla rollen `agare` (B1).
  - utan `giltigTill` i anspråkets villkor: 1 rött, en ny `giltigTill` mellan listning och anspråk gav ändå ett medlemskap (B1).
  - med läsningen av medlemskapet utanför `try`, som förut: 1 rött, raden stod kvar som `accepterad` när läsningen föll (B2).
  - med "redan medlem" för en accepterad rad, som förut: 4 röda, den halva raden utan användarrad öppnades inte igen, att en återöppning aldrig höjer en roll, och den gamla accepterade raden bredvid en ny återkallad i båda listordningarna (B2).
  - utan grenen för en användarrad: provet med en halv rad och en användarrad blev rött (det skyddar den befintliga grenen, som nu är reparationsvägen).
  - med en vanlig `update` i återlämningen: 1 rött, en återkallelse medan medlemskapet föll skrevs över med `vantar` (K1).
  - med `create` i stället för `createNew` för medlemskapet i accepten: 3 röda, bland dem att ett medlemskap som skrevs mellan läsningen och skrivningen fick sin roll överskriven (K3). I `bjudIn`: 1 rött, samma sak där.

  Prov som lagts till efter omgranskningen av 42d8f1e:
  - en giltig väntande rad och en accepterad rad för samma adress, i båda listordningarna: kast, och ingenting skrivs. Med den gamla ordningen, accepterad före giltig väntande: 2 röda, den accepterade raden öppnades igen bredvid den väntande.
  - återlämningen kastar: det ursprungliga felet finns i meddelandet och som `cause`. Med återlämningen som förut, utan eget `try`: 1 rött, återlämningens fel ersatte det ursprungliga.

  De tidigare proven, en gren i taget tagen tillbaka:
  - utan återöppningen av en återkallad rad: 4 röda, återöppningen, att den gamla hashen inte överlever, två samtidiga återöppningar och den återkallade gamla raden.
  - utan grenen för en utgången rad: 1 rött, återöppningen av den utgångna.
  - med `fanns` i stället för felet för en väntande rad: 3 röda, det andra klicket, den väntande raden och den väntande gamla raden.
  - med en vanlig `update` i stället för `updateIf` vid återöppningen: 1 rött, två samtidiga återöppningar gav två vinnare.
  - utan `giltigTill` i återöppningens villkor: 1 rött, två samtidiga återöppningar av en utgången rad (B1).
  - utan `status` i återöppningens villkor: 2 röda, två samtidiga återöppningar av en återkallad rad utan `giltigTill` (B1) och den återkallade gamla raden. Med `status` utbytt mot ett annat villkor (`epost`): 1 rött, samma samtidighetsprov, som då fick två vinnare.
  - utan att accepten räknar utgång: 1 rött, den utgångna inbjudan blev ett medlemskap (K1a).
  - med accepten som förut, vanlig `update` efter läsningen: 1 rött, återkallelsen mellan läsning och skrivning försvann och gav ett medlemskap (K1b).
  - utan återlämningen när medlemskapet inte gick att skriva: 1 rött, raden stod kvar som `accepterad`.
  - med raden vald som förut, det nya id:t annars listningens första: 4 röda, en gammal accepterad eller väntande rad bredvid en ny återkallad, i båda listordningarna (K2).
  - utan `createNew` för en ny rad: 14 röda, i `inbjudan.test.js` och `grupp-skapa.test.js`.
  - med `create` i stället för `createNew`: 2 röda, en rad som dök upp mellan listningen och skapandet skrevs över, och felprovet i `grupp-skapa.test.js`.
  - med den gamla formeln för id:t: 5 röda, bland dem att `acme` + `team_bob@x.se` och `acme_team` + `bob@x.se` ger olika id och får var sin rad.
  - utan kravet på `createNew` i fabriken: 1 rött. Utan kravet på `updateIf`: 1 rött.
- `src/__tests__/grupp-skapa.test.js`: två nya prov, en källa utan `createNew` respektive `updateIf` nekas med `createGroupService` i felet. Med det gamla namnet i felet: 2 röda (K4). Provet där en inbjudan faller vid skapandet lägger felet i `createNew`, där skrivningen nu sker. Med felet kvar i `create` blev det rött, eftersom ingen inbjudan längre går den vägen.
- `src/__tests__/routing.test.jsx`, `createNew` per samling, 4 prov. Med en minneskälla vars `createNew` inte frågar om id:t finns: 2 röda, ett här och raden som dök upp i `inbjudan.test.js`. Med rättningen: 20 av 20 gröna i filen.
- Efter att main (e2b6601, med 0.80.0 och #303) tagits in: `npm ci`, `npm run check`, `npm run test:rules` och `npm run check:scaffold` (utan `OPS_CHROMIUM`) gick med exitkod 0. `npm run check`: 2659 av 2659 gröna. `npm run test:rules`: 401 av 401 gröna.

## 0.80.0

Bilagor i egna dokument och panelen Chattinfo (#300, #301), rättad efter granskningen av PR 307. 0.78.1 och 0.78.2 är mergade och har sina avsnitt nedan. 0.79.0 (#304) är inte mergad och väntar på #303, mätt på main `f525384` 2026-10-08. Den kommer därför efter 0.80.0, med ett nytt nummer.

### ⛔ Bakåtbrytande

En app som har `bilagor: true` från 0.77.0 slutar fungera vid ompinningen om den inte gör följande. Inline-`dataUrl` på meddelandet nekas nu av regeln, och källan kastar utan samlingsnamnet.

### Det appen måste göra vid ompinningen

1. **`bilagaSamling` krävs när `bilagor: true`**, både i `createSamtalskalla` och i `samtalsregelfragment`, med samma namn. Utan den kastar appen vid uppstart: `createSamtalskalla: bilagor: true kräver bilagaSamling`. Ramverket väljer inte namnet.
2. **Generera reglerna på nytt och deploya dem FÖRE klienten.** Den nya klienten skriver meddelandet med märket `{ namn, typ }` och filen i ett eget dokument, i en batch. Gamla regler känner inte samlingen och nekar filen. Nya regler nekar i sin tur `dataUrl` på meddelandet, så en gammal klient mot nya regler kan inte skicka bilagor. Ordningen är alltså regler, sedan klient, med kort tid emellan.
3. **Källan behöver `batch`.** Meddelandet och filen skrivs tillsammans eller inte alls. `createFirestoreSource` och `createMemorySource` har den. En egen källa utan `batch` kastar på en bilaga, med skälet.
4. **`tyst` är valfri.** Med den, i källan och i regelfragmentet, ritas Tysta notiser och `samtalsnotiser` hoppar över ett tystat samtal. Utan den finns ingen tystning, och notiserna beter sig som förut.
5. **`mejl` är valfri** på `OpsMeddelanden`, `OpsSamtal` och `OpsTrad`. Utan en adress ritas ingen mejlknapp. Ramverket känner inga adresser.

Bilagor som redan ligger inline på meddelanden från 0.77.0 behöver ingen migrering. De ritas i bubblan som förut och räknas i Chattinfo.

### Ändrat

- Ett meddelande med bilaga bär `{ namn, typ }`. Filen ligger i `<samtal>/{sid}/<bilagaSamling>/{nyckel}` med meddelandets `tid`. Nyckeln är meddelandets id, och för ett svar i en tråd `<tråd>~<id>` (`bilagenyckel`, `BILAGA_TRADSKILJE`). Översikten och notiserna läser inte `dataUrl`.
- Regeln binder filen till sitt meddelande (`opsBundenBilaga`): med `existsAfter` och `getAfter` ska meddelandet finnas efter batchen, vara skrivet av den inloggade och bära samma namn, typ och tid. En fil utan meddelande, en fil på någon annans meddelande och ett märke med en annan typ än filen nekas.
- Meddelandets id är `m_<tid>_<följd>_<slump>`. Utan slumpdelen kunde två flikar som skickar samma millisekund få samma id.
- `lasBilagor(sid)` ger de nyaste filerna först (fallande `tid`) och `fler` när taket nås. `lasBilaga(sid, mid, { trad })` läser en fil. Båda cachar per nyckel, eftersom en fil aldrig ändras eller tas bort, med ett tak på två sidor.
- Chattinfo läser listan när panelen öppnas, och sedan bara filen bakom ett nytt meddelande med märke. Ett textmeddelande ger ingen läsning. Förut lästes alla filer om för varje nytt meddelande.
- Chattinfo härleder också bilagorna i 0.77.0-form ur de laddade meddelandena, utan dubbletter. Förut stod det "Bilder 0" medan bubblan visade bilden.
- Fliken Medlemmar visar samtalets deltagare i ett privat samtal, inte gruppens alla medlemmar (`samtalsdeltagare`).
- Flikarna i Chattinfo är ikon och antal, som förebilden. `OpsTabs` tar `icon` och `badge` på en flik, antingen på alla flikar eller ingen. Med ord fick Dokument och Länkar inte plats på 320 px.
- Klockan i huvudet är en klocka när samtalet inte är tystat och en överstruken klocka när det är det. Panelknappen är `PanelRightOpen`, samma ikon som förebilden.
- `samtalsnotiser` använder `synligText`. En bilaga utan text ger filnamnet, inte en tom notis.
- `BilagaVisning` sätter varken `href` eller `src` när `kommentarbilagaFel` inte är `null`.
- `OpsChattinfo` med flikarna Medlemmar, Bilder, Dokument och Länkar. Verktygsraden i huvudet: Mejl när appen skickar en adress, Tysta notiser när källan har `tyst`, Sök i samtalet, Chattinfo. Varje knapp har namn, tooltip och 44 px.
- Länkarna i panelen härleds ur meddelandenas text. De lagras inte.
- Firebase Storage används inte för chattens bilagor, och appen behöver inga Storage-regler. Med `bilagor` på källan anropas inte `onBifoga`.
- `createRoutingSource` tar `fallback`, samma namn som i koden. README sade `standard` på två ställen.
- Ett meddelande som bär märket ska ha sin fil efter batchen (`existsAfter` på `opsBilagansFil`), i samtalet och i en tråd. Förut släpptes ett märke utan fil in, och bubblan sade "Bilagan går inte att visa" för alltid. Ett meddelande utan bilaga påverkas inte, och en fil som läggs till senare på ett eget meddelande som redan bär märket prövas bara av filens regel och släpps in som förut.
- Meddelandets id får inte innehålla `~` när `bilagor` är på, i samtalet eller i en tråd. Förut släpptes `rot~m1` in som toppmeddelande, men dess fil kunde aldrig skrivas, eftersom regeln läser `~` som trådens avgränsare. Källans id har inget `~`.
- Meddelandets regel jämför också namn och typ med filen (`opsMarketHarFil`), samma jämförelse som filens regel gör åt andra hållet. Förut räckte det att filen fanns, så ett nytt meddelande kunde ta över en fil utan meddelande under ett annat namn eller en annan typ. Med samma namn och typ släpps det in, och README säger varför det är godtagbart.
- Generatorn kastar om `BILAGA_TRADSKILJE` inte är ett enda tecken som är säkert i en teckenklass, i `split` och inom `'...'` (`tradskiljeTeckenklass`). Förut byggdes `[~]` ur konstanten utan prövning.
- README: ett trådrot-id med `~` från tiden innan `bilagor` slogs på gör att svaren i den tråden aldrig kan få en fil.
- README: källan med bilagecachen ska skapas om per inloggad användare och grupp, som bolag-ops gör, annars kan cachen följa med mellan användare i samma flik. Taket är `sida * 2` filer. README säger också att Bilder och Dokument i en tråds Chattinfo läses ur hela samtalets filer, medan Länkar kommer ur trådens laddade meddelanden. Omfånget är inte rättat i koden, skälet står i README.

### Prov

Alla går att köra om med kommandona som står vid dem.

- `npx vitest run src/__tests__/chattinfo.test.jsx`: 9 gröna. Mot grenens förra läge (5c1b427, `OpsMeddelanden.jsx`, `samtalskalla.js`, `samtal.js` och `regler.js` återställda): 4 röda av 9, exit 1. Bilden i 0.77.0-form saknades i Bilder ("Bilder 2" fanns inte). Tre textmeddelanden gav 6 nya läsningar av filerna i stället för 0. `lasBilagor` gav `b1, b2, b3` i stället för `b5, b4, b3`. Medlemmar var 4 i ett samtal mellan två.
- Var för sig, med en ändring i taget bortplockad: utan härledningen i panelen 1 rött, utan inline-vägen i `VisadBilaga` 1 rött (bubblan ritade "Bilagan går inte att visa"), med omläsning för varje meddelande 1 rött, utan sorteringen 1 rött, med gruppens medlemmar 1 rött. Varje gång exit 1.
- `npx vitest run src/__tests__/chatt-bilagor.test.jsx`: trådens id i filens nyckel, filens `tid`, och id:t med slumpdel.
- `npx vitest run src/__tests__/data-primitives.test.jsx`: ikonflikarna i `OpsTabs`, antal också vid 0, och kastar med ikon på bara några flikar.
- `rules/__tests__/chattbilagor.test.mjs` i `npm run test:rules`: 29 gröna. Varje nekande prov har ett giltigt meddelande i samma batch, så att det nekas av det villkor det mäter och inte av bindningen. Mutationskörningen, där ett villkor i taget togs bort ur den genererade regeln, står i PR 307: 23 av 24 mutationer gav minst ett rött prov. Den som överlevde är `existsAfter` före `getAfter`, som är ekvivalent eftersom ett `getAfter` på ett saknat dokument också nekar. Den står kvar av samma skäl som vid `opsHarMedlemskap`: ett fel och ett nej ska gå att skilja i en logg.
- Märket utan fil och `~` i id:t, i `rules/__tests__/chattbilagor.test.mjs`. Med varje villkor bortplockat ur regeln, ett i taget, och bara den filen körd: utan `existsAfter` 1 rött av 25 (märke utan fil släpptes in), med bara trådens `existsAfter` bortplockat 1 rött (samtalets två rader i provet tillfälligt bortkommenterade, så att trådens rad mättes ensam), med trådens nyckel `mid` i stället för `tid + '~' + mid` 3 röda (trådsvaret med sin fil nekades), utan `~`-villkoret 1 rött, med bara trådens `~`-villkor bortplockat 1 rött (samtalets rad tillfälligt bortkommenterad). Varje gång exit 1. Med villkoren och provet återställt: 25 gröna, exit 0. Provet "pngmarke", som stod grönt på ett märke utan fil, är borttaget.
- Föräldralös fil, i `rules/__tests__/chattbilagor.test.mjs`: filen sås förbi reglerna, sedan ett nytt meddelande med samma id. Utan jämförelsen av namn och typ: 2 röda av 29, exit 1 (annat namn släpptes in, och provet med samma namn och typ föll som följd eftersom dokumentet redan fanns). Utan bara namnet: 2 röda, exit 1. Utan bara typen: 2 röda, exit 1 (annan typ släpptes in, och följdfelet). Med jämförelsen: 29 gröna, exit 0.
- `npx vitest run src/__tests__/tradskilje.test.js`: 15 gröna, exit 0. Utan prövningen i `tradskiljeTeckenklass`: 13 röda av 15, exit 1. Med prövningen men utan att generatorn anropar den: 4 röda av 15, exit 1 (generatorn byggde `[]]`, `[^]`, `[\]` och `[-]`).
- Playwright, `OPS_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-skalyta.mjs --bara-chattinfo`: 16 kontroller, inga brott, exit 0. Mot 5c1b427: 4 brott av 16, exit 1 (Medlemmar 4 i stället för 2, och 1 bild i Bilder i stället för 2). Montaget mot förebilden ligger i `docs/jamforelser/0.80.0/`, förebilderna i `docs/jamforelser/0.80.0/forebild/`.

## 0.78.2

Gruppen är kalendern (lane 6 steg F). ⛔ Ersatt i 0.120.0 (cllp/lifehub.app#367): varje grupp har en standardkalender. Texten nedan står kvar som den skrevs.

### Ändrat

- Kalendermenyn i `OpsCalendar` och gruppsektionen i `OpsKalendrar` skriver inte längre "Gruppen har inga kalendrar ännu." En tom lista namngivna gruppkalendrar är inte att gruppen saknar kalender. "Du har inga egna kalendrar ännu." står kvar, för egna kalendrar finns inte av sig själva.

### Prov

- `src/__tests__/kalendrar.test.jsx` ("gruppen är kalendern") och `src/__tests__/kalenderhantering.test.jsx` ("tomt är ett svar för egna kalendrar"). Utan ändringen: 2 röda, exit 1. Med ändringen: 2 gröna, exit 0.

## 0.78.1

Uppgift innan appen använder den (#302). Ompinningen åker med lane 19 i appen och görs inte här.

### Rättat

- Statuslistan är appens. `visaUppgifter` tar `oppna` och `klara`, på samma sätt som `snarast`. En status i `klara` lämnar Idag. En som inte står i någon av listorna hamnar i `avvisade`, med skälet. `i-github` syns när appen säger att den är öppen.
- `idag` är `ÅÅÅÅ-MM-DD` i gruppens zon. Ett `Date` avvisas, för det är enhetens klocka. `utfors` är väggklocka i samma zon, utan `Z`.
- `typ` krävs. Poster med en annan typ räknas i `ovriga` och hamnar inte på Idag. Ett ärende med prioriteten `snarast` följer alltså inte med.
- Huvudets plus har TALK-raden när appen saknar `fasta`. Utan bottenplus är den raden vägen under `md`.
- En rad med `snarast: true` sorteras efter andra rader med samma `daysLeft` i `collectEvents`, så försenat, i dag och snarast står kvar när uppgifterna slås ihop med händelser.
- 0.78.0-texten nedan sade att 0.77.0 och 0.76.3 inte var mergade. Det stämde inte. Båda har avsnitt i den här loggen. Mätt på main `1d1bf66` 2026-10-07. README:s uppgiftsstycke sade det inte.

### Prov

- `src/__tests__/uppgift.test.jsx`. Utan rättningarna: de nya proven röda (datumet avvisade strängen, loggen matchade "Ingen av dem är mergad", och TALK-raden saknades i en app utan `fasta`). Med rättningarna: gröna.
- Bocken i snabbtitten: utan `atgard` i `data-snabbtitt` röd, med den grön.
- `src/__tests__/talk.test.jsx`, raden utan `fasta`. Utan `talkRad: !bottenPlus`: röd. Med den: grön. Proven med `fasta` är oförändrat gröna, raden är fortfarande borta där.

### Kvar i appen

- Provets "listan muteras inte" ser bara att argumentet är orört. En kopia i händelsesamlingen kan inte göra det rött. Den vakten hör till lane 19.
- Appen har redan aktivitetstypen `uppgift` bland händelserna (`lifehub.app/web/src/data/events.js`). Ramverket lägger ingen aktivitetstyp med det namnet. Lane 19 väljer vilken sanning som står kvar.

## 0.78.0

Uppgift som inkorgstyp (lifehub.app#103, lane 19), ramverkets del. 0.77.0 och 0.76.3 är mergade: båda har avsnitt i den här loggen. Meningen som stod här sade att ingen av dem var det, och att main stod på 0.76.2. Det stämde inte. Rättat i 0.78.1, mätt på main `1d1bf66`.

### Tillagt

- `byggUppgift` och `uppgiftFel`. En uppgift har `rubrik`, `status`, och antingen `deadline` eller `utfors`, aldrig båda, plus `vem` och `prio`.
- `visaUppgifter` härleder Idag, Kommande och kalenderrader ur inkorgens poster. Ingenting skrivs till händelsesamlingen. Raderna bär inkorgens id och inget `handelseId`. En bock anropar `onKlar(id)`. En klar uppgift lämnar Idag och kalendern. "Så snart som möjligt" är prioritetsvärdet appen skickar som `snarast`, och det blir aldrig ett datum.
- Kalenderns postkort och snabbtitt ritar `atgard` när raden har en.

### Ändrat

- Huvudets plus på bred skärm har inte längre raden "TALK, prata in". Mikrofonen bredvid plusset gör samma sak. Telefonens plus har raden kvar.

### Prov

- `src/__tests__/uppgift.test.jsx`, 6 prov. Utan avvisningen av båda datumen: 1 rött, 5 gröna. Med den: 6 av 6 gröna.
- `src/__tests__/talk.test.jsx`, raden i huvudets plus. Med `talkRad` påslaget också där: 1 rött. Med av: 24 av 24 gröna i filen.

## 0.77.0

Bilaga i chattens plusmeny (#292, lifehub.app#103 lane 1). Samma form som kommentarernas bilaga, inte en egen.

Regeln med `bilagor: true` ska vara utrullad innan klienten slår på nyckeln. Utan nyckeln är `samtalsregelfragment()` byte för byte samma text som förut.

### Tillagt

- Fältet `bilaga` på ett meddelande, i kommentarernas form `{ dataUrl, namn, typ, tecken, bredd?, hojd? }`. `byggMeddelande` prövar den med `kommentarbilagaFel`. Med en bilaga får texten vara tom.
- `samtalsregelfragment({ bilagor: true })` och `createSamtalskalla({ bilagor: true })`. `skicka` och `skickaITrad` skriver bilagan, och läsningen ger den tillbaka. `harBilagor(kalla)` svarar. Utan nyckeln kastar ett försök att skicka en bilaga.
- Regeln `opsMeddelandebilagaGiltig`, byggd av samma uttryck som `opsKommentarbilagaGiltig`. Två namn, eftersom båda fragmenten limmas in i samma regelfil.
- `onBifoga` på `OpsSamtal`, `OpsTrad` och `OpsMeddelanden`. Plus ritas när den finns, eller när källan har `bilagor`. Ta foto ritas bara när en kamera räknats upp. Med `bilagor` läser ramverket filen och skickar den med meddelandet, och `onBifoga` anropas inte. En bild visas som miniatyr, en fil som nedladdningslänk. Firebase Storage används inte, och appen behöver inga Storage-regler. Filen låg i 0.77.0 i meddelandets dokument. Från 0.80.0 ligger den i ett eget dokument, se det avsnittet.

### Prov

- `src/__tests__/chatt-bilagor.test.jsx`, 7 prov. Utan storlekstaket i `kommentarbilagaFel` och i `opsMeddelandebilagaGiltig`: 2 röda, 5 gröna. Med taket: 7 gröna. Fixturen `samtalsregelfragment-0.67.0.rules` är oförändrad i samma körning.
- `rules/__tests__/chattbilagor.test.mjs` mot emulatorn: med taket 5 av 5 gröna. Med taket sänkt till 1 tecken i den genererade regeln: 2 röda, 3 gröna (den giltiga bilden och exakt taket nekades).
- Playwright, `check-skalyta --bara-chatt --chattbredder 390,1024`: 120 kontroller, inga brott. Avsnitt 29g (9) i båda bredderna visar bilden, Bifoga bild och Välj fil på 44 px, och ingen Ta foto eftersom kameran räknades som nej. Menyn ligger inom fönstret. Avsnitt (8) mäter fortfarande att pluset saknas i agentscenen. Bilderna ligger i `docs/jamforelser/chatt/chatt-9-bilaga-390.png` och `chatt-9-bilaga-1024.png`. Webbläsaren var `/opt/google/chrome/chrome`. `/opt/pw-browsers` fanns inte här, och ingen webbläsare installerades.

## 0.76.3

Småsaker från granskningen av mejlkön (PR 296). När den här skrevs var 0.77.0 ett utkast. Den är mergad, se avsnittet ovan.

### Rättat

- `createRoutingSource` skickar vidare `updateIf` när minst en källa har den, och kastar med samlingens namn när just den källan saknar den. Utan vidarekopplingen hade `createMailSender` nekat den routande källan även när köns källa kan göra anspråket.
- Admin-exemplet för `updateIf` i README står direkt efter meningen om att källan måste ha operationen. Inledningen till `mejlregelfragment` står omedelbart ovanför kodblocket.

### Prov

- `src/__tests__/routing.test.jsx`, 16 prov. Utan vidarekopplingen: 2 röda, 14 gröna. Med metoden alltid exponerad, också när ingen källa har den: 1 röd, 15 gröna. Med rättningen: 16 av 16 gröna.

## 0.76.2

Följd-PR till PR 294 (0.76.0, mejlkön). PR 294 mergades innan granskningen var klar, och granskningen hittade två blockerande fel: https://github.com/cllp/ops-framework/pull/294#issuecomment-6040015858. 0.76.x ska inte publiceras utan de här rättningarna.

### Rättat

- **Varje mejl skickas en gång (B1).** `createMailSender().skicka` läste aldrig dokumentets status och gjorde inget anspråk före transporten. `onDocumentCreated` levereras minst en gång och händelsens dokument står alltid på `koad`, så en omleverans skickade samma mejl igen (granskarens prov: 3 utskick av ett dokument). Nu tar `skicka` ett id (eller ett dokument med `id`), läser dokumentet ur källan och gör ett atomärt anspråk från `koad` till `skickas`, med `paborjad`, innan transporten anropas. Står dokumentet inte på `koad` skickas inget och dokumentet returneras. Ett id som inte finns kastar.
- Dör processen efter anspråket men före kvittot står dokumentet på `skickas` och skickas inte om automatiskt: servern kan ha tagit emot mejlet. Raden syns som `skickas` med `paborjad`, så en app kan visa fastnade utskick.
- **nodemailer laddas först vid utskick (B2).** Det låg i `dependencies` och importerades statiskt, så varje `import ... from "ops-framework/node"` laddade det. Nu är det ett valfritt peer-beroende (`peerDependencies` och `peerDependenciesMeta.nodemailer.optional`, kvar i `devDependencies` för proven), och `createNodemailerTransport` gör `await import("nodemailer")` vid första `send`. Saknas paketet blir utskicket `fel` med texten "Installera nodemailer i appen för att skicka mejl".
- README-exemplet anropade `skicka({ id, ...data })` med händelsens kopia. Nu `skicka(event.params.id)`, och README visar `updateIf` för en Admin-adapter som en `db.runTransaction`.

### Tillagt

- Datakontraktets regel 7: den frivilliga operationen `updateIf(samling, id, villkor, data)`, som skriver bara om likhetsvillkoren stämmer i samma atomära steg som läsningen och svarar `{ updated, row }`. Minneskällan har den. `createMailSender` kräver den och nekar en källa utan vid uppstart, eftersom en läsning följd av en skrivning inte hindrar två samtidiga utskick.

### Prov

`src/__tests__/mejl.test.js`, 27 prov.

- Utan anspråket (dokumentet läses och skickas utan `updateIf`): 5 röda av 27. Samma id två gånger i följd gav 2 utskick, tre samtidiga anrop gav 3, dokument på `skickad`, `fel`, `hoppad` och `skickas` skickades, `skickas` och `paborjad` fanns inte under transporten, och raden stod inte kvar på `skickas` när kvittot inte gick att skriva.
- Med en läs-sedan-skriv-kontroll i stället för `updateIf`: 2 röda av 27, bland dem de samtidiga anropen (fler än ett utskick).
- Med en statisk `import "nodemailer"` tillbaka i `src/node/mejl.js`: 2 röda av 2 för nodemailerproven (en resolve-krok i en barnprocess såg 101 nodemailer-moduler redan vid `import("src/node/index.js")`). Kroken registreras med `module.register` via `node --import` och skriver varje url till en temporär fil, så proven går på Node 20.6 och nyare; de synkrona `registerHooks` finns först i Node 22.15, och CI kör Node 20. Rött och grönt är sett på både Node 20.20.2 och 22.22.2.
- Med rättningen: 27 av 27 gröna. Barnprocessen ser 0 nodemailer-moduler efter importen och efter `createNodemailerTransport`, och minst 1 efter första `send` (golv: kroken måste se nodemailer, och minst 20 moduler). Utan nodemailer (kroken nekar paketet) blir dokumentet `fel` med installationsbeskedet.

## 0.76.1

Grenen skrevs som 0.75.2. PR 294 (0.76.0) mergades före, så versionen är 0.76.1.

Uppföljning av granskningarna av PR 290 (0.75.0) och PR 289 (0.74.0), som båda mergades innan rättningarna var gjorda, och av PR 291 (0.75.1), där skrivfältets väg till mikrofonen saknade prov (cllp/lifehub.identity#30).

### Rättat

- `OpsSamtal` och `OpsTrad` byggde sina texter utan reaktionsnamnen, så med `sprak="en"` hette reaktionerna på svenska när komponenterna användes utan `OpsMeddelanden` runt sig. De är egna exporter (`src/index.js`). Alla tre bygger nu texterna med samma interna funktion (`texterPa`), en källa i stället för tre rader.
- `check-skalyta.mjs --chattbredder` utan värde kraschade på `argv[i + 1].split` (TypeError). Nu stannar skriptet med ett fel som säger vad som saknas, och exit 1. Samma sak för en bredd som inte är ett positivt heltal (`390,abc`) och för en annan flagga i värdets ställe (`--chattbredder --tema`).
- Texten om 0.74.0: raden om att versionen förutsatte att PR 288 mergades först är struken (288 är inne), och `SYNLIGA_MANADER_VILA_MS` och `synligaManader` står som interna, eftersom de inte exporteras ur `src/index.js`. README får en punkt efter "(#259 skiva 2, F4)" och en mening om att intervallet inte rapporteras om när ytan byter storlek och att dedupliceringen är per instans.

### Prov

- `src/__tests__/chatt-reaktioner.test.jsx`: `OpsSamtal` och `OpsTrad` ensamma med `sprak="en"` kräver "Thumbs up, 1" och "Applause, 1" med Lucide-ikonen. Före rättningen 2 röda av 19 (namnen var "Tummen upp, 1" och "Applåd, 1"), efter 19 av 19 gröna.
- `src/__tests__/chatt-skrivfalt.test.jsx` (cllp/lifehub.identity#30): skrivfältets ljudvåg med en inspelare som kastar `NotAllowedError`. Med `document.permissionsPolicy` eller `document.featurePolicy` som spärrar mikrofonen säger raden "Mikrofonen är spärrad av sidan som visar appen" och inget om webbläsarens inställningar; utan API står den gamla texten kvar (golv: provet kräver att jsdom saknar API:t). Utan kontrollen `mikrofonenTillatenAvSidan` i `talkFeltext`: 2 röda av 10. Med den: 10 av 10 gröna.
- `check-skalyta.mjs --chattbredder` utan värde: före TypeError, efter felmeddelandet och exit 1. `--bara-chatt --chattbredder 390,1024`: 106 kontroller, inga brott.

## 0.76.0

Mejlkö, utskick och regelfragment på nodsidan (ops-framework#101, lifehub.app#103 lane 18A). Inbjudningsflödet är inte med. Det är steg B, i appen, efter att den här versionen är publicerad.

PR 289 mergades som 0.74.0 och PR 290 som 0.75.0 innan den här grenen pushades. PR 291 ligger kvar öppen och kräver 0.75.1, så nästa lediga minor är 0.76.0.

### Kön och utskicket

LifeHub ska kunna bjuda in medlemmar via mejl. Mejlvägen är mätt (Gmail i Workspace, avsändare `LifeHub <hello@life-hub.app>`, SMTP `smtp.gmail.com:465`). Ramverket känner inga adresser, inga värden och inget samlingsnamn. Appen skickar in dem.

SessionStudio köar ett dokument och låter en funktion skicka det. Samma beslut här, i ramverkets form. Copy-mallarna, avanmälan mot `users` och inkommande mejl är SessionStudios egen modell och finns inte med: de hade tvingat ramverket att känna en användarsamling.

#### Ändrat

- `createMailQueue({ kalla, samling })` skriver ett köat dokument: `till`, `amne`, `text`, `html`, `sprak` (`sv` eller `en`), `kategori`, valfritt `groupId`, `status: "koad"`. `byggMejl` är formen. `losMejlsprak` väljer språk i ordningen händelse, grupp, avsändare, sedan `sv`. `normaliseraMejlsprak` godtar bara exakt `sv` eller `en`.
- `createMailSender` skickar dokumentet och skriver kvittot på samma rad: `status`, `accepterade`, `avvisade`, `svar` (högst 200 tecken), `messageId`, `tid`, `skal` och `fel`. Tomma fält är `null` eller `[]`. `skickad` betyder att servern accepterade minst en mottagare och avvisade ingen. En avvisad mottagare är `fel`. Ett kast från transporten är `fel` med texten på raden. Går kvittot inte att skriva kastas felet, med både utskickets fel och skrivfelet.
- En spärrad domän skickas inte. Status blir `hoppad` och `skal` namnger domänen. `SPARRADA_MEJLDOMANER` är `test.se`, `example.com`, `test.com` och `example.se`. En extra lista lägger till och tar inte bort de fyra.
- `createNodemailerTransport` tar `host`, `port`, `secure`, `auth` och `from` från appen och ansluter inte förrän `send`. Modulen läser inga hemligheter, varken vid laddning eller senare. Appen binder dem med `secrets: ["MAIL_USER", "MAIL_PASS"]` och läser dem i funktionen.
- `createMockMailTransport` är provets transport. Ingen riktig SMTP i prov eller CI.
- `byggMejlhandelse` är loggraden: mottagaren som SHA-256 (12 tecken), antal, serverns svar och Message-ID. Adressen står på dokumentet, inte i loggen.
- `mejlregelfragment(samling)` nekar klienten både läsning och skrivning. Bara servern, med Admin SDK. Appen limmar in fragmentet och deployar reglerna tillsammans med kön.

Gmail i Workspace tar emot cirka 2000 mejl per dygn för kontot som skickar. Över taket avvisar servern, och det blir `fel` på dokumentet.

#### Prov

Rött utan beteendet, grönt med det. `src/__tests__/mejl.test.js`, 18 prov.

- Köat mejl med kvitto: utan att kvittot skrevs var status `koad` (förväntat `skickad`). Med skrivningen: grönt.
- Avvisad mottagare: när grenen skrev `skickad` föll provet på `expected 'skickad' to be 'fel'`. Med `fel`: grönt.
- Spärrad domän: när spärren var avstängd blev status `skickad` (förväntat `hoppad`) och transporten anropades. Med spärren: inget utskick, `skal` innehåller domänen.
- Regelfragmentet: `allow read, write: if true` föll på att blocket ska innehålla `allow read, write: if false`. Med nekandet: grönt. Emulatorn (`rules/__tests__/mejl.test.mjs`) nekar läsning, listning, skapande och ändring, inloggad och utan inloggning. Filen måste innehålla `mejlregelfragment("mejlko")`, eftersom catch-all också nekar.
- `check-node-side`: en planterad `import "react"` i `src/node/mejl.js` föll med "nodsidan drar in webben". Utan den: grönt, 187 webbfiler och 80 nodexporter i README.
- `check-gammalt-namn`: golvet höjt från 540 till 618. Med 540 var vakten röd, den läste 651 filer och 540 låg mer än 20 procent under (taket är 648). Med 618, efter merge av 0.74.0 och 0.75.0: grön, 652 filer lästa.

## 0.75.1

Grenen bygger på main vid 0.73.0. PR 288 (0.73.1), PR 289 (0.74.0) och PR 290 (0.75.0) ligger före i kön; den som mergas sist tar in main och höjer versionen.

### En mikrofon som sidan spärrar skickar inte personen till webbläsarens inställningar (lifehub.app#103, lane 13 del 2)

Händelsen: my.life-hub.app får visas i en ram (`frame-ancestors` tillåter `lifehub-identity.web.app` och `life-hub.app`, mätt med `curl -sI https://my.life-hub.app/` 2026-10-07). En ram utan `allow="microphone"`, eller en sida med `Permissions-Policy: microphone=()`, ger samma `NotAllowedError` som när personen sagt nej. `talkFeltext` sade då "Ge sidan tillgång till mikrofonen i webbläsarens inställningar", en instruktion som inte går att följa, eftersom inställningarna inte kan häva sidans policy.

#### Tillagt

- `mikrofonenTillatenAvSidan(doc?)`: `true` eller `false` ur `document.permissionsPolicy` eller, i Chromium, `document.featurePolicy`; `null` när webbläsaren inte kan svara (Firefox, Safari).
- `MIKROFON_SPARRAD_AV_SIDAN`: "Mikrofonen är spärrad av sidan som visar appen. Öppna appen i ett eget fönster för att spela in."

#### Ändrat

- `talkFeltext(fel, { sidanTillater? })`: vid `NotAllowedError` och `SecurityError` prövas sidans policy först. Spärrad ger `MIKROFON_SPARRAD_AV_SIDAN`. Tillåten eller okänd ger texten om inställningarna som förut, eftersom den då är den enda som kan stämma.

#### Prov

- `src/__tests__/talk.test.jsx`: den rena funktionen med spärrad, tillåten och okänd policy, och TALK-fältet i en sida vars policy spärrar mikrofonen. Utan kontrollen: 2 röda. Med: 23 av 23 gröna.
- Mätt i Chromium (Playwright, inte jsdom): `mikrofonenTillatenAvSidan` ger `true` utan rubrik, `false` med `Permissions-Policy: microphone=()`, `false` i en främmande ram utan `allow` och `true` i en med `allow="microphone"`. `document.permissionsPolicy` finns inte i Chromium utan flagga, så det är `featurePolicy` som svarar där.

## 0.75.0

Grenen bygger på main vid 0.73.0. PR 288 (0.73.1) och PR 289 (0.74.0) ligger före i kön; den som mergas sist tar in main och höjer versionen.

### Reaktionerna ritas med Lucide, inte med enhetens emoji (lifehub.app#103, lane 7)

Händelsen: CP 2026-10-07, "Kör Lucide Ikoner som reaktioner". Reaktionerna ritades med enhetens egna emoji, så samma reaktion såg olika ut på iPad, Windows och Android och följde inte appens linjestil ("ser ut som Windows 98").

#### Ändrat

- `OpsMeddelanden`: chippen under bubblan och väljaren ritar reaktionen som en Lucide-ikon med `strokeWidth` 1.5: `tumme` ThumbsUp, `hjarta` Heart, `skratt` Laugh, `eld` Flame, `klapp` PartyPopper (Lucide har ingen applåd) och `bock` Check. Ovald ikon är linje i textfärgen (`text-ink`), den egna i accentfärgen (`text-accent`). Ingen hårdkodad färg.
- Väljarens knappar bär nu `aria-pressed`, sant för den kod personen själv redan reagerat med, och den knappen får `bg-accent-faint`. Förut sade bara chippet det.
- Reaktionernas namn finns på svenska och engelska. Med `sprak="en"` (eller `OpsSprakProvider` på engelska) heter de Thumbs up, Heart, Laugh, Fire, Applause och Done. `texter.reaktionsnamn` vinner fortfarande över förvalet.

#### Tillagt

- `TummeUppIkon`, `SkrattIkon`, `EldIkon` och `ApplodIkon` i `icons.jsx`. `HjartaIkon` och `BockIkon` fanns redan.
- `src/components/reaktionsvy.js`: tabellen från kod till ikon och namn. Ramverksintern, exporteras inte.
- `check-skalyta.mjs --chattbredder 390,1024`: avsnitt 29g i andra bredder än förvalet 390 och 1280.

#### Datan ändras inte

De sex koderna (`REAKTIONSKODER`) och reglerna är desamma. En reaktion sparad före 0.75.0 ritas med sin nya ikon utan migrering. Ingen regeländring, ingen deploy före klienten.

#### Tre listor (regel 13)

- Tas som det är: de sex koderna, en rad per person och kod, antalet räknat fram, 44 px träffyta.
- Görs bättre: väljaren säger nu vilken reaktion som är din (`aria-pressed`), inte bara chippet.
- Stryks: ingenting. Ingen fri emojiväljare, eftersom en fri uppsättning kräver att datan bär tecknet, och det är precis den form `samtal.js` stängde.

#### Prov

- `src/__tests__/chatt-reaktioner.test.jsx`, "ikonerna": varje kod har en Lucide-ikon med rätt klass och `stroke-width` 1.5 och namn på båda språken (golv sex); en sparad reaktion ritas som sin ikon med bara antalet som text; väljaren ritar sex ikoner och den egna är tryckt; på engelska heter de på engelska. Mot mains `OpsMeddelanden.jsx`: 3 av de 4 nya röda (tabellprovet läser en fil som inte finns på main). Med bytet: 17 av 17 gröna.
- `check-skalyta.mjs` 29g (3): varje chip bär exakt en Lucide-svg och ingen emoji, och väljaren sex. Mot mains bygge: 4 brott av 106 (390 och 1024 px). Med bytet: 106 kontroller, inga brott.

## 0.74.0

### `OpsCalendar` säger vilka månader som syns (#284)

Händelsen: lifehub.app PR 91 (gruppens frånvaro i kalendern) behövde veta vilket fönster den skulle hämta frånvaro för, och läste därför ramverkets egna attribut `data-kalender-rulle` och `data-cal-day` ur DOM när rullningen stannat. Det var en tillfällig lösning med ärende (regel 1): ändras attributen slutar hämtningen följa rullningen utan att något prov i appen märker det.

#### Tillagt

- `onSynligaManader({ forsta, sista })` på `OpsCalendar`, med månaderna som `YYYY-MM`. Anropas när rullningen stått still i `SYNLIGA_MANADER_VILA_MS` (150 ms, intern) och en gång vid start, efter hoppet till idag. Varje rullningshändelse startar om vilan, så en svepning ger ett anrop och inte ett per händelse. Samma intervall två gånger anropas en gång.
- Varje månadsblock bär `data-kalender-manad="YYYY-MM"`, och `synligaManader(rulle, huvud)` (intern, exporteras inte ur `src/index.js`) räknar fram intervallet under den klistrade veckodagsraden. Utan callback startas ingen vila och ingenting mäts för den.

#### Appens steg

- lifehub.app pinnar om och byter läsningen i `CalendarView.jsx` mot `onSynligaManader`. Det görs efter ompinningen till 0.73.0 (lane 1).

#### Prov

- `src/__tests__/calendar.test.jsx`, "onSynligaManader": fyra månader à 500 px i en rullyta på 600 px. Ett svar vid start (september och oktober), inget svar under sex rullningshändelser med 50 ms emellan, och efter vilan november och december. Ett andra prov: samma intervall efter en kort rullning ger inget nytt svar, inga timrar lever efter avmontering, och utan callback startas ingen vila.
- Utan ändringen: 2 av 2 röda. Utan debounce (vilan satt till 0): rött, med ett svar mitt i rullningen vid 600 px. Med ändringen: 64 av 64 gröna i `calendar.test.jsx`.

## 0.73.1

Två små rättelser ur granskningarna av PR 275 och PR 285, och en tredje som hittades när CI föll på den här grenen. Inga regeländringar, inget att deploya före klienten.

### Agentens status kunde stå kvar som "tänker" för alltid

Händelsen: CI föll på den här grenen i `chatt-status.test.jsx` ("en status som blir gammal medan samtalet är öppet"), fast grenen inte rör chatten. Mätt 2026-10-07: samma prov föll i 6 av 30 körningar på orörd main, alltid på samma rad.

Rotorsaken är vyns och inte provets. `Agentrad` sätter en timer till exakt den tidpunkt då statusen blir gammal, och gränsen är strikt (`nu - sedan > AGENTSTATUS_MAX_ALDER`). En timer kan vakna en millisekund före väggklockan, eftersom timern mäts mot en monoton klocka och `Date.now()` är väggklockan. Då var statusen fortfarande färsk, effektens beroenden oförändrade, och ingen ny timer sattes. "Agenten tänker" stod kvar tills något annat hände i samtalet, alltså den tysta nedsläppsväg raden finns för att stänga.

#### Ändrat

- `OpsMeddelanden`, `Agentrad`: `nu` är ett beroende i timerns effekt, och varje väckning sätter `nu` till `Math.max(Date.now(), förra + 1)`. Varje väckning ritar alltså om och sätter en ny timer, också när väggklockan står still på gränsen, och raden byts mot felraden senast en millisekund efter gränsen enligt vyns egen räkning. Granskningen av PR 288 visade att `nu` i beroendelistan ensam inte räckte: gav väckningen samma tal som förut ritade React inte om, och ingen ny timer sattes.

#### Prov

- `src/__tests__/chatt-status.test.jsx`, "en timer som vaknar före väggklockan sätts om": när raden "tänker" syns släpar väggklockan 200 ms efter timerns, vilket gör den för tidiga väckningen deterministisk. Utan rättningen: rött. Med: 15 av 15 gröna.
- `src/__tests__/chatt-status.test.jsx`, "en väggklocka som står still på gränsen i 400 ms låser inte raden": `Date.now()` hålls på `sedan + AGENTSTATUS_MAX_ALDER` i 400 ms och släpps sedan. Rött på `a5d99cb` (bara `nu` i beroendelistan), grönt med rättningen, 16 av 16 i filen.
- Det instabila provet: 6 av 30 röda på main före, 0 av 30 med rättningen.

### Modulnamnet i `OpsModulKataloger` följer rubrikniva (#287)

Händelsen: granskningen av PR 285 (0.71.1). `OpsModulKataloger.jsx:95` ritade varje moduls namn som en fast `<h3>`. I en inställningspanel med `rubrikniva={3}` stod modulnamnet då på samma nivå som panelens rubrik, och katalogen under modulnamnet hamnade på samma nivå som modulnamnet i stället för under det.

#### Ändrat

- Modulnamnet får sin nivå ur `delrubrik`, samma regel som `OpsKatalogInstallning` och `OpsModulTyper` följer, och ritas med `Delrubrik`. Heter modulen som panelen ritas namnet inte en gång till.
- Katalogen i varje modulsektion ligger en nivå under modulnamnet. `OpsInstallningar.jsx` har en ny intern del, `UnderDel`, som ger katalogen modulnamnet som närmaste rubrik, så att regeln fortfarande bara finns i `delrubrik`.
- Sektionen heter som modulnamnet (`aria-labelledby`), eller som panelen när namnet inte ritas.
- ⛔ Nytt beteende: heter katalogen som modulen ritas katalogens rubrik inte, eftersom den då är samma rubrik som modulnamnet direkt ovanför. Det är samma regel som redan gäller en katalog som heter som panelen, nu tillämpad ett steg längre ned. Katalogens lista har kvar sitt namn för skärmläsaren.

#### Prov

- `src/__tests__/kallor.test.jsx`, "modulnamnet och katalogen följer rubrikniva": utan panel (2 och 3), nivå 2 (3 och 4), nivå 3 (4 och 5), nivå 5 (6 och 7, där 7 är `aria-level` på en `h6`), och nivå 3 när modulen heter som panelen (namnet ritas inte, katalogen 4). Mot den fasta `<h3>`: 5 av 5 röda. Med rättningen: 90 av 90 gröna i `kallor.test.jsx` och `installningar.test.jsx`.

### `in` nådde prototypkedjan i tre uppslag (#283)

Händelsen: granskningen av PR 275. `"constructor" in {}` är sant, så ett id som heter som något på `Object.prototype` räknades som en nyckel ingen hade satt.

#### Ändrat

- `src/lib/beteenden.js`, `kopplaBeteenden`: en kategori med id `constructor`, `toString` eller `__proto__` utan hanterare ger nu skälet "saknar hanterare". Förut räknades den som kopplad, till `Object`-konstruktorn.
- `src/lib/hubb.js`, `hubbPoster`: en modul med ett sådant id får ingen infolinje när appen inte gett någon. Förut fick den prototypens funktion som `info`.
- `src/lib/katalog.js`, de krävda textnycklarna: en krävd nyckel som heter `constructor` räknades som ifylld fast ingen text fanns. Den här var inte nämnd i ärendet men hittades i genomgången, eftersom nycklarna kommer ur appens konfiguration.
- Alla tre går med `Object.hasOwn`.

#### Genomgången av övriga `in` i `src/lib`

- Står kvar, eftersom nyckeln är ett fast fältnamn och inte ett id: `modul.js` (`"katalog"`, `"hubb"`, `"$$typeof"`, `"props"`), `kallor.js` (`"daysLeft"`), `hubb.js` (`"del"`), `talk.js` (`"name"`), och kraven i `modultyper.js`, `grupp.js` och `handelsemodell.js`, som prövar fasta listor.
- Står kvar, eftersom de prövar fasta listor vid laddning: `gruppikonarv.js` och `kalenderikoner.js`.
- `hubb.js` `badge[m.id]` står kvar: `typeof ... === "number"` släpper aldrig igenom något ur prototypen.
- `in` i `regler.js` är Firestore-regelspråk i strängar, inte JavaScript.

#### Prov

- `beteenden.test.js`, `hubb.test.jsx` och `katalogtexter.test.js`, med `constructor`, `toString` och `__proto__` på varje ställe. Utan rättelsen: 9 av 9 nya röda. Med: 96 av 96 gröna i de tre filerna.

## 0.73.0

Grenen började som 0.71.0. Medan den var öppen mergades 0.69.0 till 0.72.0 (PR 278, 275, 280, 285 och 286); main är inmergad med en vanlig merge och versionen är 0.73.0.

### ⛔ Deploy före klienten: regeln för kommentarer på händelser bär nu `bilaga`

`handelseregelfragment` släpper in ett frivilligt fält `bilaga` på `<händelser>/{hid}/<kommentarer>/{kid}`, prövat av en ny regelfunktion i fragmentet, `opsKommentarbilagaGiltig(b)`, som appen också får anropa i sina egna kommentarsregler. Appen genererar om sina regler och rullar ut dem FÖRE en klient som slår på `bilagor` i `OpsKommentarer`. Utan bilaga är regeln oförändrad i sak: samma fält, samma läsning, samma tak för texten. Läsningen ändras inte alls, så en bilaga läses av exakt dem som läser kommentaren.

### Bild och fil i kommentarer (cllp/bolag-ops#570)

Händelsen: CP 2026-10-06, inkorgspost `D7P0tLlRj3EKcoptFcF1`: "Vill kunna klistra in bild i kommentar. Kommentarer behöver ha bilder elelr filer också."

#### Tillagt

- `OpsKommentarer` med `bilagor`: `OpsFilePicker` under skrivrutan. Välj fil, inklistring med Cmd+V (bara när fokus är i tråden, så att två öppna trådar inte får samma bild), förhandsvisning före sändning (miniatyr för en bild, namnet för allt annat), Ta bort. `onSkriv(text, { bilaga })`, och med en bilaga får texten vara tom. Av som förval, se deploy ovan. En bilaga på en befintlig kommentar visas alltid: en bild som miniatyr, en fil som nedladdningslänk med namn och storlek.
- Modellen: `KOMMENTARBILAGA_TYPER` (JPEG, PNG, WebP, GIF, PDF, text, CSV), `MAX_KOMMENTARBILAGA` (700 000 tecken), `MAX_BILAGENAMN`, `KOMMENTARBILAGAFALT` och `kommentarbilagaFel`. `byggKommentar` prövar bilagan med samma funktion.
- `readAttachment` och `OpsFilePicker` tar `typer`, en lista över typerna en bilaga får ha. En bild prövas efter att den krympts till JPEG, allt annat innan filen läses.

#### Tre listor (regel 13)

- **Tas som det är:** inkorgens `bilaga`-form `{ dataUrl, namn, typ, tecken, bredd?, hojd? }`, `readAttachment` och `OpsFilePicker` med inklistring och förhandsvisning.
- **Görs bättre:** en typlista i stället för allt som går att välja (SVG bär skript, en okänd typ går inte att visa), och regeln prövar att data-URL:en är av den typ posten påstår och att `tecken` är dess längd. Inkorgens regel prövar bara `data:.*`.
- **Stryks:** en fillagring (Firebase Storage) för kommentarernas filer. Den hade krävt en andra regeluppsättning för samma läsbehörighet, en andra skrivning per kommentar med en föräldralös fil när den föll, och en ny tjänst i appen, som i dag inte har någon. Bilagan ligger i kommentarens dokument, och taket följer av dokumentets gräns på 1 MiB. Blir bilagorna många eller stora är fillagringen svaret, och då ska den här formen bort och inte byggas ut.

#### Prov

- `src/__tests__/kommentarer.test.jsx`: modellen, att regeln bär samma typer och tak, inklistring som ger en bilaga med förhandsvisning och skickas, fel typ och för stor fil nekade i klienten, och en inklistring utanför tråden som inte tas. Utan ändringen: 8 av de 9 nya röda (det nionde, om fokus, provades med en mutation: med inklistringen alltid på blir det rött). Med: 33 av 33 gröna.
- `rules/__tests__/handelsekommentarer.test.mjs`, mot emulatorn: medlem skriver med bild (också utan text) och läser, icke-medlem nekas att läsa och skriva, exakt taket in och ett tecken över nekas, SVG, program och fel innehåll nekas, okända och saknade fält nekas. Med ändringen 19 av 19 gröna. Mot den gamla regeln 2 röda (det tillåtna nekades, eftersom den gamla regeln nekar varje bilaga). Avslagen är gröna också mot den gamla regeln, så de provades med en mutation: utan typ- och storlekskontrollerna i den nya regeln blir provet för taket och provet för typen röda (2 av 19).

### Snabbvyn vid långtryck ligger överst i panelen, centrerad (cllp/bolag-ops#568)

Händelsen: CP 2026-10-06, inkorgspost `tAv8ejFHHWVkAzKx6eHv`: "Kände nu när jag testade snabbvyn för kalender att den bubblan med långpress i cellen (ej den vanliga). Att snabb vyn kan ligga längst upp i panelen centrerat."

#### Ändrat

- `OpsCalendar`: snabbtitten (långtryck eller högerklick på en dag) är inte längre en `fixed` bubbla under rutan. Den ritas först i dagpanelens plats, centrerad och högst 280 px bred: under rutnätet under 1024 px, i kolumnen bredvid från 1024 px. Platsen öppnas för titten också när ingen dag är vald, och ligger en dagpanel öppen står titten ovanför den. Dagpanelen vid ett vanligt tryck är orörd.

#### Tre listor (regel 13)

- **Tas som det är:** tittens innehåll, "Dold" på det filtret döljer, och de tre vägarna ut (krysset, Escape, tryck utanför).
- **Görs bättre:** titten täcker inte längre rutnätet kring tummen, och dess plats är samma plats som dagpanelens.
- **Stryks:** positionsuträkningen (`ankare.x`, `ankare.y` och klämningen mot fönstret), som bara fanns för att bubblan flöt.

#### Prov

- `src/__tests__/calendar.test.jsx`, "snabbvyn vid långtryck": ett långtryck på 450 ms ger titten som första barn i dagpanelens plats, utan `fixed` och utan koordinater, och utan att en dag väljs; med en dag vald står titten ovanför dagpanelen. Utan ändringen: 2 av 3 nya röda (det tredje, att ett vanligt tryck öppnar dagpanelen, är ett skydd mot en regression och grönt i båda). Med: 117 av 117 gröna i kalenderns tre provfiler.

### Vem-filtrets räknare: ett tal per rad, och en grupp räknas helt eller inte alls (cllp/bolag-ops#569)

Händelsen: CP 2026-10-06, inkorgspost `kBctxHT9NDWs7VQ4roJI`: "Finns många initialt, sedan agent 0st och jag 2st. Går inte jämnt ut. Nåt är fel där med alla, jag och agent."

Rotorsaken är appens, och den mättes i lifehub.app:s kod: filtret Vem jämför `skapadAv.uid` med medlemmens id. Agentens poster skrivs med `skapadAv: { uid: null, typ: "agent" }` (`functions/agentpost.js`), så de träffade aldrig agentens id `agent_<grupp>`, och Agent visade 0. Uppgifter, pengar och kalenderrader bär ingen `skapadAv` alls och räknades bara under Alla. Delarna kunde alltså aldrig bli helheten. Rättningen av vem som äger en rad ligger i appens PR.

Ramverkets del är att talen kan stå där valet görs:

#### Tillagt

- `OpsFilterPanel`: `options[].badge` och gruppens `allBadge` ritas till höger i raden, före bocken, i samma talform som segmentets räknare. 0 ritas (regel 5).

#### Ändrat

- `OpsFilterPanel` kastar när en grupp bara räknar en del av sina rader: har ett alternativ ett tal måste varje alternativ och "Alla" ha det. En saknad siffra går inte att skilja från 0, och en halv uppsättning tal går att lägga ihop till en summa som inte är listans.
- Summan prövas medvetet inte i ramverket. Hade panelen räknat ihop alternativen och skrivit summan på "Alla" hade summan stämt per definition och dolt precis den rad som inte hör till något alternativ.

#### Prov

- `src/__tests__/filterpanel.test.jsx`, "antal per rad": sex rader och fyra alternativ (golv), talet på varje rad jämförs med antalet rader efter tryck, och delarna med Alla. Utan ändringen i `OpsFilterPanel.jsx`: 3 av 3 nya prov röda. Med: 19 av 19 gröna.

## 0.72.0

Chattens nattskiva (#273 och chattanalysen). ⛔ **Mergas efter 0.71.0 (PR 280), som redan är mergad.** Cursors PR 277 blir 0.73.0.

CP 2026-10-06 20:02 i LifeHubs agentsamtal: "jag skulle vilja ha en indikation medans du tänker och skriver i chatten", och agentens
svar ritades med råa `**`. Samma kväll kom chattanalysen (SessionStudio mot ramverket), och CP:s beslut för natten: ett meddelande kan
inte ångras eller redigeras, trådar får inget eget läsmärke, läskvitton och push byggs inte, och bilagor väntar på bilagemodulen i
ops-framework PR 277.

⛔ **Varje ny undersamling och varje nytt meddelandefält är en NY NYCKEL, utan förval**, till `createSamtalskalla` och
`samtalsregelfragment`: `status`, `reaktioner`, `fasta`, `omnamnanden: true` och `citat: true`. En app som inte skickar nyckeln får
byte för byte samma regeltext som i 0.68.0 (prov mot `rules/__fixturer__/samtalsregelfragment-0.67.0.rules` och den nya
`-0.68.0-tradar.rules`), och vyn ritar inget nytt. `undersamlingskrock` är det enda stället som prövar att två undersamlingar inte
heter samma sak.

### Lagt till

- **Markdown i bubblan** (#273): `OpsMarkdown chatt`, chattens delmängd av `splitMarkdown(text, { chatt: true })`. Fet, kursiv (nytt
  i parsern: `*` och `_` vid ordgräns), listor, radbrytningar och klickbara http- och https-länkar i ny flik med `rel="noopener"`.
  Ingen HTML; rubriker, tabeller, citat och kodblock står kvar som text i chatten. Prov med injektionsförsök.
- **Agentens status** (#273, `status`): `<status>/agent { lage, sedan }` under samtalet och tråden, bara servern skriver. "Agenten
  tänker" eller "Agenten skriver" där svaret kommer; äldre än två minuter visas den inte, och en felrad står i stället. `byggAgentstatus`
  och konstanterna också i `node`-delen. Källan: `lasStatus`, `prenumereraStatus`, `harStatus`.
- **Visa äldre** och **50+**: kontraktets nya villkor `fore: { falt, varde }` (`foreVillkor`), i minnet, JSON, Firestore och Postgres;
  http-adaptern kastar. `aldreMeddelanden` tappar inte två meddelanden samma millisekund. Knappen överst i loggen, i samtalet och i
  tråden; det som setts stannar, och rullningen står kvar. `olastaFler` i `oversikt` och `useSamtal`, `onOlasta(antal, { fler })`,
  `OpsCountBadge fler`, `OpsIconLink badgeFler` och `OpsMeddelandeLank olastaFler`.
- **Reaktioner** (`reaktioner`): `<reaktioner>/{mid|uid|kod}` med sex fasta koder, emoji bara i vyn; skapa och radera bara sin egen,
  aldrig uppdatera; meddelandet i samma samtal. En lyssnare per samtal och tråd (`REAKTIONSTAK`). Chips med `aria-pressed` och en
  väljare med 44 px, pilar och Escape.
- **Omnämnanden, @alla och @agent** (`omnamnanden: true`): `namner: [uid] | ["alla"]`, högst 20 uid om högst 128 tecken (`MAX_UIDLANGD`), utan komma. Regeln prövar formen, läsaren
  auktoriserar (`namnda`, `arNamnd`), "alla" expanderas vid läsning. `agentenNamnd` för appens agent, också i `node`.
  `samtalsnotiser({ medlemmar })` ger "nämnd i gruppchatten". @-lista i skrivfältet.
- **Svar med citat i privata samtal** (`citat: true`): `svarPa: mid`, regeln kräver samma samtal och inte gruppchatten; citatet
  härleds. **Sök i samtalet** bland de laddade meddelandena, med träffar, bläddring och omfång utskrivet.
- **Fästa meddelanden** (`fasta`): `<fasta>/{mid} { av, tid }`, samtalets personer lossar. Raden "n fästa" under huvudet.
- **Länk till post som kort**: `postkort={{ slaUpp, onOppna? }}`. Appen slår upp sina egna adresser; ramverket känner inga posttyper.
- **Skrivfältet efter CP:s förebild**: rundat fält, platstext efter samtalet, ljudvåg för röstinmatning (`onTranscribe`, TALK:s
  inspelning, texten in i fältet utan att skickas, ljudet sparas om transkriberingen faller), stopp när något pågår
  (`onStoppaAgent`). Plusmenyn är byggd men inte inkopplad förrän bilagemodulen finns.

### Rättat

- Fokus tillbaka till trådens märke (KAN 6) efter att loggen börjat samla det som setts.
- ⛔ **En mikrofon åt gången.** TALK-knappen i huvudet (0.71.0) och ljudvågen i skrivfältet har var sin `useTalk`, och utan en
  gemensam spärr spelade båda in samtidigt. Nu får den som startar som nummer två felet "En annan inspelning pågår redan. Avsluta
  den först.", och den första spelar vidare. Inget ljud kastas av spärren. Prov: `chatt-talk-krock.test.jsx`, rött utan spärren.
- Skrivfältets felrad säger "Det inspelade kunde inte skrivas ut" bara när det finns ett ljud som inte skrevs ut. En nekad
  mikrofon eller en upptagen inspelning säger sitt eget skäl.
- ⛔ **TALK: ett svar från `getUserMedia` hör till sitt försök (#281).** Ett försök som avbröts, skickades eller avmonterades
  medan mikrofonen öppnades spelade in ändå, och efter en avmontering nådde ljudet appen efter 120 s. Två starter med Avbryt
  emellan lämnade en ström öppen. `useTalk` numrerar nu varje försök, och webbläsarens inspelare stänger en ström som öppnats för
  ett äldre försök. Prov: `talk-forsok.test.jsx` räknar öppna strömmar med en fejkad `getUserMedia`, rött utan rättelsen.
- ⛔ **Utdragen visar inte markdownens tecken.** Fästraden, citaten, citatraden ovanför fältet och listans rad visade agentens
  `**` rått. `utdrag` läser nu samma tolkning som bubblan. Prov i jsdom och i Chromium (`check-skalyta` 29g).
- ⛔ **`namner` i regeln: bara strängar, och med ett tak.** Emulatorn släppte in `[{a:1}, 7]` och 200 000 tecken. Regeln fogar
  ihop listan och delar den igen, vilket bara ger samma lista för strängar utan komma, och längden är högst 20 gånger 128 tecken.

### Ompinning

1. **Regeldeploy före klienten**, med de nycklar appen vill ha, samma som till `createSamtalskalla`:
   `samtalsregelfragment({ tradar, status: "status", reaktioner: "reaktioner", fasta: "fasta", omnamnanden: true, citat: true })`.
   En klient som läser `status`, `reaktioner` eller `fasta` innan reglerna är ute faller på catch-allen.
2. **Agentens server** skriver `<status>/agent` med `byggAgentstatus` innan den börjar och tar bort det när svaret är skrivet eller
   felet visat, och läser `agentenNamnd(meddelande, agentUid, medlemmar)` i stället för en regex på `@agent`.
3. **Valfritt**: `postkort`, `onTranscribe`, `onStoppaAgent`, `samtalsnotiser({ medlemmar })`, och `onOlasta`:s andra argument till
   `OpsMeddelandeLank olastaFler`.

---

## 0.71.1

Rättelser efter granskningen av PR 278 (0.69.0, #274), som mergades innan granskningens två MÅSTE-fynd var lagade.

⛔ **Versionsnumret:** grenen började som 0.69.1, men PR 275 (0.70.0) och PR 280 (0.71.0) mergades medan den var öppen. Main är inmergad båda gångerna, och den här grenen är 0.71.1.

#### Rättat

- **Katalogens delrubriker följer `rubrikniva`.** `OpsKatalogInstallning` räknade själv ut nivån för "Arkiverade", "Senaste ändringarna" och formulärets två rubriker med `niva === 3 ? "h4" : "h3"`, vilket bara stämde vid förvalet 2. Med `rubrikniva={3}` blev "Arkiverade" h3, samma nivå som panelen den står i, och med en egen katalogrubrik på h4 låg "Arkiverade" en nivå ÖVER den. Nivån kommer nu ur `delrubrik` (`underniva`, en under närmaste synliga rubrik), samma hjälpfunktion som `OpsInstallningar` och `OpsModulTyper` använder, så regeln finns på ett ställe. En nivå djupare än 6 ritas som `h6` med `aria-level`. Prov i `installningar.test.jsx`: var och en av de fyra delrubrikerna mäts för sig i sex lägen (utan panel, och nivå 2, 3 och 5 med samma eller annan rubrik än panelen), med en arkiverad kategori, en ifylld logg och formuläret öppet. 13 röda mot 0.71.0. Med de tre delrubrikerna utom "Arkiverade" hårdkodade som `<h3>` (granskningens försök, som inget prov fällde förut) blir 12 röda. Med `underniva` 2 utan panel blir 4 röda.
- **`rubrikniva` kontrolleras.** Ett värde som inte är ett heltal från 1 till 5 vägras med ett läsbart fel (`kontrolleraRubrikniva`). Förut gav `NaN` taggen `<hNaN>` och `9` blev tyst `h6`. Prov för `NaN`, 0, 6, 9, 2,5, `"3"` och `null`, plus 1 och 5 som gröna, och för att `rubrikniva={undefined}` ger förvalet 2.

#### ⛔ Kan bryta en app som pinnar om

Från 0.71.1 **vägras** `rubrikniva` med ett fel vid ritningen när värdet inte är ett heltal från 1 till 5. Förut ritades det ändå, med fel tagg. Följande vägras nu:

- **6 och uppåt.** `rubrikniva={6}` gav förut `h6` för både sidan och panelen, och delarna hamnade lika högt. Skriv högst `rubrikniva={5}`. Ligger sidan så djupt att 5 inte räcker är det appskalets rubriker som behöver ses över, inte den här.
- **Strängar, också siffror som sträng.** `rubrikniva="3"` vägras. Skriv `rubrikniva={3}`, med klamrar, så att värdet blir ett tal. Kommer nivån ur adressen eller en konfiguration: gör om den till ett tal med `Number(...)` innan den skickas in.
- **0, negativa tal, decimaltal, `NaN` och `null`.** Utelämna propen, eller skicka `undefined`, för att få förvalet 2.

#### Kvar

- **`OpsModulKataloger` har samma fel**, med modulnamnet som en hårdkodad `<h3>`: https://github.com/cllp/ops-framework/issues/287. Rättas inte här.

#### Ändrat

- **`check-utvecklarord` säger i filhuvudet vad den INTE läser:** ternär i flera led, ternär där en gren inte är en sträng, `&&`, strängar inuti `${}`, och `text=`/`children=` som props. Varje fall är mätt mot vakten och ger noll träffar. Inga mönster tillagda: `&&` som barn förekommer inte i ramverkets src, så ett mönster hade inte kunnat få ett golv här.
- **`test-guards` skriver kopian av vakten med ett avstängt mönster i en temporär katalog**, inte i `scripts/`, med importen och roten omskrivna till absoluta sökvägar. Ett nytt grönt fall visar att kopian utan avstängt mönster är grön, så att de fem röda inte kan bero på flytten.

#### Ompinning till 0.71.1

Gäller `cllp/lifehub.app`. Ompinningen mergas efter ramverket, i samma pass (regel 11).

1. `package.json`: `"ops-framework": "https://github.com/cllp/ops-framework/releases/download/v0.71.1/ops-framework-0.71.1.tgz"`.
2. Sök i appen efter `rubrikniva`. Varje värde ska vara ett heltal från 1 till 5, skrivet med klamrar (se rutan ovan). Annars kastar `OpsInstallningar` nu i stället för att rita fel nivå.

## 0.71.0

⛔ **Mergas efter 0.70.0 (PR 275), som mergas efter 0.69.0 (PR 278).** Ordningen är satt av utvecklingschefen 2026-10-06.

### TALK får en egen knapp i webbens huvud (#276)

CP 2026-10-06 21:37, med en skärmbild av Skapa-menyn på webben: "TALK förtjänar en egen knapp i web. Och i mobil vet vi ju hur den skall sitta." På dator fanns TALK bara som första rad i Skapa, alltså två klick (plusset, sedan raden). På mobil är vägen redan ett långtryck på bottenradens plus (0.57.0).

#### Tillagt

- **En mikrofonknapp i huvudet på dator, direkt till höger om plusset.** Den ritas bara när appen skickar in `talk`, och bara från `md` (`hidden md:inline-flex`, display i en klass som huvudets övriga knappar). Den är huvudets vanliga ikonknapp (`huvudknappKlass`): 36 px cirkel med 20 px ikon vid 1280, 44 px träffyta, och samma namn i tooltipen som i uppläsningen.
- ⛔ **Samma väg som raden i Skapa, ingen andra inspelningsväg.** Knappen och raden lämnar samma form (`TALK_FORM`, en fryst konstant på modulnivå) till `oppnaSkapa`, som går till `talkStyr.direkt()`. Det är samma krok, samma inspelare och samma fält som plusset och raden använder. Knappen använder inte `talkStyr.knapp`: de händelserna är plussets, där ett vanligt tryck är Skapa och bara ett långtryck spelar in. Här är ett vanligt tryck inspelningen.
- **Knappen visar inspelningsläget.** Medan den lyssnar eller skickar är den tänd (`bg-raised text-accent`, som en öppen knapp i huvudet), och namnet följer läget: "TALK, prata in", "TALK, lyssnar", "TALK, skickar" (`talkKnappNamn` i `lib/talk.js`). Den som inte ser att knappen är tänd hör det i stället.
- `TALK_PRATA_IN` i `lib/talk.js` är raden och knappens gemensamma namn, så att de inte kan börja heta olika saker.
- Raden "TALK, prata in" i Skapa står kvar. Mobilen ändras inte.

#### Prov

- `talk.test.jsx`, "mikrofonknappen i huvudet": knappen finns i huvudet med `talk`, som plussets närmaste granne och med ett namn, och saknas utan `talk`; ett tryck startar samma inspelare och samma fält som raden, bottenradens plus står i samma läge (samma krok), knappen säger "TALK, lyssnar" och ljudet når appen; display bärs av `hidden md:inline-flex` utan bar `inline-flex`. Alla tre röda utan ändringen. Dessutom: namnet blir "TALK, skickar" medan ljudet lämnas till appen (rött när skickar-namnet tas bort), och ett tryck under håll, lyssnar eller skickar startar ingen andra inspelning, både i `talkNasta` och i skalet (rött när `direkt` startar om i alla lägen).
- `check-skalyta` avsnitt 43, scenen `talk`: vid 1280 px står knappen 0 till 4 px från plussets högerkant, är en 36 px cirkel med 20 px ikon, har plussets mittlinje inom 1 px, träffas på hela den ritade cirkeln (`elementFromPoint`), och ett tryck öppnar fältet i läget lyssnar medan knappen är tänd. Vid 390 px har knappen `display: none` och bottenradens plus är kvar. Skärmbilder i `docs/jamforelser/`.
## 0.70.0

⛔ **Versionsnumret:** 0.68.0 är PR 268 (trådar i gruppchatten, mergad medan den här grenen var öppen, och inmergad hit med en vanlig merge) och 0.69.0 är #278 (#274), som mergades medan den här grenen var öppen. Main är inmergad, och den här grenen är 0.70.0.

### Personen har samma märke och samma val som gruppen, och märket finns utan React (cllp/lifehub.identity#27)

Händelsen: CP 2026-10-06 20:13, med en skärmbild av Profil i Mitt konto: "Låt profildelen i identity ha samma fina funktion exakt som man editerar grupp med ikoner och färger." Profilen hade sex fasta ikoner och sex färgprickar; grupper har sedan 0.65.0 en sökbar ikonväljare och en kulör.

Identitys webb är vanlig TypeScript utan React. Mätt i identitys bygge (vite build, gzip -9): React och react-dom med `OpsGruppmarkeValjare` lade till 103,6 kB; katalogen, sökningen och kulörerna ur rotens `ops-framework` 36,9 kB (`dist/index.js` är en fil som inte skakas ned väl); samma funktioner ur källfilerna plus SVG-datan 23,5 kB. Den sista vägen är den nya ingången.

#### Tillagt

- **`ops-framework/gruppmarke`**, en ingång utan React: katalogen, sökningen, de svenska namnen, kulören, senast använda, `personmarke` och SVG för varje ikon. Typer i `dist/types/gruppmarke/index.d.ts`. Se README, "ops-framework/gruppmarke".
- **SVG-datan** (`gruppikonsvg.generated.js`, `GRUPPIKON_SVG`, `gruppikonSvg(namn, storlek)`), genererad av `scripts/generate-gruppikoner.mjs` genom att rita varje `lucide-react`-komponent med `react-dom/server`. ⛔ Inte en andra källa: provet jämför `gruppikonSvg(namn)` med komponentens markup för alla 187 ikoner, och `check-gruppikoner` blir röd när datan ligger efter generatorn.
- **`personmarke(person)`** (ren) och **`personmarkeProps(person)`** (för `OpsIdentity`): personens märke som gruppens, ikonen i kulören på en tonad platta, eller initialerna.
- **`ARV_PROFILIKON`**: de sex äldre profil-id:na till Lucide-namnet de alltid ritats med (person till user, leende till smile, stjarna, hjarta, blixt och krona till star, heart, zap och crown).
- **`arGiltigProfilikon`**, och `arGiltigGruppfarg` exporteras nu.
- **`check-gruppmarke`**: ingången får bara nå filer under `src/lib/` och inga paket alls, och varje export ska stå i README. Planterat i `test-guards` (gruppmärke 1 till 4 och ett golv).

#### Ändrat

- **`byggAnvandare` tar emot ett katalognamn som `ikon` och `kulor:0` till `kulor:359` som `farg`**, utöver de äldre sex id:na och tonerna `"1"` till `"6"`. Allt annat avvisas, också `initialer:AB`, gruppens äldre id (`portfolj`) och `kulor:007`. Ingenting i databasen skrivs om.
- **`OpsProfil` ritar personen som en grupp** (`personmarkeProps`). Bilden väger fortfarande tyngst. Profilens egen väljare i `OpsProfil` är oförändrad i den här versionen: den skriver fortfarande de äldre id:na och tonerna, som tas emot och ritas i det nya märket.
- **`gruppikonKomponent` och `gruppikonNamn` känner också de äldre profil-id:na**, så att en person ritas med samma karta som en grupp.
- **Flyttat utan att namnen ändrats:** `ARV_GRUPPIKON` och `gruppikonNamn` bor i `src/lib/gruppikonarv.js`, märkets former (`PROFILIKONER`, `PROFILFARGER`, `GRUPPIKONER`, `GRUPPINITIALER_FORM`) i `src/lib/markeformer.js`, och senast använda i `src/lib/gruppikonsenaste.js` (samma nyckel i `localStorage`, så listan följer med). Alla återexporteras där de stod.

#### Rättat efter granskningen

- **Prototypnycklar var giltiga färger.** `fargTillKulor` slog upp tonerna med `in`, som når prototypkedjan, så "toString", "constructor", "__proto__", "valueOf" och "hasOwnProperty" togs emot av `byggAnvandare` och `byggGrupp`. Uppslaget går nu med `Object.hasOwn`, och `gruppikonEtikett` likaså (där gav "toString" en funktion i stället för en etikett). Prov i `gruppmarke.test.jsx`.
- **`check-gruppmarke` fångar mallsträngar och beräknade importer.** `import(\`react\`)` gick förbi, och en `import(x)` går inte att följa och är nu ett brott. En export räknas som nämnd i README först som eget ord, inte som del av ett längre.

#### Ompinning till 0.70.0

LifeHubs Identity använder `ops-framework/gruppmarke` för profilens väljare (lifehub.identity#27), och hubben bör rita personens märke i huvudet med `personmarkeProps(profil)`.

⛔ **En app som prövar en spegling av profilen med `byggAnvandare` måste pinna om INNAN identity släpps.** Det gäller hubbens `speglaPerson` (lifehub.app). På 0.67.0 kastar `byggAnvandare` för ett katalognamn som `music` och för `kulor:210`. `speglaPerson` loggar felet och speglar då inte raden alls: inte namnet, inte bilden, inte telefonen. Släpps identity först slutar alltså varje person som väljer en ny ikon eller kulör att speglas, och det syns bara som en varning i funktionsloggen. Ordningen är: ramverket, hubbens ompinning och funktionsdeploy, och sedan identitys funktioner (`sparaProfil`, som också prövar med `byggAnvandare`) före identitys webb.

En app som varken prövar profilen eller vill rita det nya märket behöver ingen ändring.
## 0.69.0

⛔ **Versionsnumret:** 0.68.0 är PR 268 (trådar i gruppchatten, lifehub.app#60), som mergades medan den här grenen var öppen. Main är inmergad, och den här grenen är 0.69.0.

### Inställningarna: en lista med sektioner, och varje sektion i en egen panel (#274)

Händelsen: CP 2026-10-06 20:12, med en skärmbild av Inställningar i LifeHub på surfplatta: "hela inställnings-panelen är superrörig. Vi måste bygga ett intuitivt, enkelt och rent inställningspanel. Sektioner kanske skall stå ensamma, med att man navigerar till en specifik panel med tillbaka-pil mm. Texterna känns ihoptryckta." Sidan var ett enda långt flöde av kort, med små rubriker, täta rader och utvecklartext mellan korten ("Slagen är inte seedade än", "Samlingen är tom, så appen ritar repots standardvärden", "står däremot i koden (SLAGBETEENDEN)").

#### Tillagt

- **`OpsInstallningar`**: appen ger sektionerna (`{ id, ikon, rubrik, beskrivning, antal, innehall }`), ramverket ger listan och panelen. Raderna är minst 56 px, med ikon, rubrik i 16 px halvfet, beskrivningen på egen rad i 14 px dämpad (12 px i första utkastet, som granskningen kallade just det CP klagade på), antalet till höger och en chevron. Panelen har tillbaka-pil, rubrik i 18 px och beskrivning på egen rad. `ORD_OPSINSTALLNINGAR` på svenska och engelska. En sektion utan `id`, `rubrik` eller `innehall` vägras, och ett okänt `vald` ger en varning i utvecklingsläge.
- **`rubrikniva`, förval 2:** sidans och panelens rubrik står på samma nivå under appskalets `h1`, och delarna i en panel en nivå under. Samma nivå med flit, eftersom panelen står ensam under 1024 px.
- **Tillbaka går tillbaka i historiken:** filhuvudet säger att appens `onValj(null)` ska vara `history.back()` när panelen öppnades med `pushState`, och `replaceState` när sidan öppnades direkt på en sektion.
- **Den valda sektionen ligger i adressen.** `vald` och `onValj` kommer från appen, så att webbläsarens tillbaka fungerar och en sektion går att länka till. Ramverket känner ingen router och inga samlingsnamn. Ett okänt `vald` (en gammal länk) ritar listan och ingen tom panel.
- **En kolumn under 1024 px, två från 1024.** Telefon och iPad i stående läge (820 px) får listan, och panelen ersätter den; datorn får listan till vänster och panelen till höger, utan tillbaka-pil. Gränsen är `lg` och inte `md` som i Meddelanden: i 820 px hade panelen blivit drygt 500 px bred, och en katalog trängs där igen.
- **Tangentbord och skärmläsare:** listan är en `<ul>` med knappar och den valda bär `aria-current`. Fokus går till panelens rubrik när den öppnas och tillbaka till raden när man går tillbaka, med pilen eller med webbläsarens tillbaka. Vid första ritningen flyttas inget fokus.
- **`useInstallningspanel`:** `OpsKatalogInstallning` och `OpsModulTyper` ritar sin rubrik en nivå under panelens, och inte alls när den är samma som panelens. Katalogens delrubriker (Arkiverade, Senaste ändringarna) följer med en nivå ned. Utanför en panel är allt som förut.
- **`check-utvecklarord`** (i `npm run check`): larmar på seedad/seedade/seedning, samlingen/samlingens/samlingar, standardvärden, driftsättning, repots, Firestore och kodnamn i versaler i det användaren ser: JSX-text, strängar som ensamma barn i JSX, båda grenarna i en ternär, ordböckernas `sv:`/`en:` och värden på användartextnamn (inklusive `hint`). Kommentarer, felmeddelanden och loggrader läses inte. Golv: 150 filer och 400 texter i ramverket, och ett golv per mönster (attribut 130, ordbok 125, ternär 15, barn 6, JSX-text 55, ungefär hälften av det mätta); 5 filer och 10 texter i en app. `--golv=abc` avbryts med fel. Planterat i `test-guards`: nio röda fall, ett grönt, fyra golv och ett avstängt mönster i taget (fem röda), plus beviset att `{"..."}`-fallet bara fångas av barnmönstret. Ramverket självt: 675 texter, 0 träffar. LifeHub på origin/main: 16, som ompinningen lagar.
- **`check-skalyta` avsnitt 43** vid 390, 820 och 1280 px: listan, en panel, tillbaka, fokus, beskrivningen minst 13 px, inget eget `h1`, panelens rubrik på sidans nivå och ingen horisontell överflödning.

#### Ändrat

- **`OpsKatalogInstallning` utan `ikonRitare`** ritar ingen ikon. Förut stod ikonens nyckel (`wallet`, `inbox`) som text i varje rad.

#### Ompinning till 0.69.0

Gäller `cllp/lifehub.app`. Ompinningen mergas efter ramverket, i samma pass (regel 11).

1. `package.json`: `"ops-framework": "https://github.com/cllp/ops-framework/releases/download/v0.69.0/ops-framework-0.69.0.tgz"`.
2. `SettingsView` byggs om till `OpsInstallningar` med sektionerna ur ärendet, och sektionen läses ur och skrivs till adressen.
3. Utvecklartexten skrivs om för användaren. Lägg `node node_modules/ops-framework/scripts/check-utvecklarord.mjs src` i appens kedja.

## 0.68.0

### Trådar i gruppchatten (cllp/lifehub.app#60)

CP 2026-10-06, överlämning i cllp/lifehub.app#60: "Vore ju snyggt om gruppen i gruppchatt kan starta en tråd och när som helst blanda in en agent som är med i tråden för alla." Bakgrunden var en lång tråd med fem olika spår, där spåren gav kopplingar till varandra som inte hade uppstått om de legat isär. Tråden är gruppens, inte ett privat samtal med agenten.

Första versionen byggdes i appen (lifehub.app PR 65), med datamodell och regler i appens `firestore.rules`. Beslutet samma dag: samtalen och deras regler är ramverkets (`createSamtalskalla`, `samtalsregelfragment`), och en regel för trådar i appen hade varit två hem för samma regel (regel 2). Reglerna och proven flyttar därför hit, och appen pinnar om.

#### Rättat

- **Gruppchatten fanns inte förrän någon hade skapat den.** CP 2026-10-06, i gruppen "Philip Staiger AB" med en medlem och agenten: "Hur skriver jag ett meddelande till hela gruppen?" Det gick inte. Listan i Meddelanden visade bara agentsamtalet, och under Till i "Nytt meddelande" stod bara Agent. Rotorsaken, mätt i `origin/main`: `oppnaGrupp` i `samtalskalla.js` anropades aldrig från vyn, så gruppchatten fanns bara där den var sådd, och den var sådd i varje prov och i varje skalyta-scen. Därför syntes felet aldrig före CP.
  - Gruppchatten står nu **alltid överst** i listan för en vald grupp, med gruppens namn och märket Grupp, också innan något har skrivits. Raden härleds i vyn ur gruppen. Den är inget dokument i databasen: samtalet skapas med `oppnaGrupp` när någon öppnar raden (en rad "Öppnar gruppchatten…" under tiden, och ett fel står som en banderoll).
  - ⛔ **Att öppna raden skapar samtalet, också om inget skrivs.** Det är ett dokument per grupp, med nyckeln härledd ur gruppen (`samtalsnyckel`), så det finns högst ett, och det är samma dokument som det första meddelandet hade skapat. Att vänta med skapelsen till det första meddelandet hade krävt att samtalet läses och prenumereras innan det finns, och regeln för meddelandena förutsätter samtalet (omgranskningen av PR 268, A5: lämnas så).
  - I läget "Nytt meddelande" står **"Hela gruppen"** först under Till, och valet öppnar gruppchatten. `OpsMottagare` har nya props `helaGruppen` och `gruppMarke` för det i `lage="person"`; Meddelanden skickar samma märke som gruppchattens rad i listan, så att raden har gruppens färg och ikon. Utan props är läget som förut.
  - ⛔ **Raden under Till följer valet** (omgranskningen av PR 268, A6). Förut stod "Bara ni två ser det här" redan innan något var valt, vilket var fel om "Hela gruppen" som står först. Nu finns ingen rad innan valet, och efter det säger den "Alla i gruppen ser det här", "Bara du och agenten ser det här" eller "Bara ni två ser det här".
  - Gruppchattens tomma läge säger "Alla i gruppen ser det som skrivs här." (texten `gruppTom`). Nya texter även `helaGruppen` och `oppnarGrupp`.
  - Prov som var röda utan rättningen (mutationstabell i PR-texten): en grupp med bara agentsamtalet har raden överst utan att något skrivs i källan, att öppna den anropar `oppnaGrupp`, och det första meddelandet syns; "Hela gruppen" står först under Till, med gruppchattens märke, och raden under Till följer valet. `check-skalyta` avsnitt 29f, scenen `meddelanden-ny-grupp`, vid 390 och 1280 px: dessutom heter den valda gruppen i sidopanelen samma sak som chatten, och märkets färg under Till är densamma som radens.
  - ⛔ **Följd för appen:** listan sorteras inte längre helt efter senaste meddelandet. Gruppchatten står först, och de privata samtalen under den efter senaste meddelandet.

- **Det gamla paketnamnet hade ingen vakt** (granskningen av PR 271, A1, #270 klarkriterium 2). Bytet i 0.67.0 gjordes för hand, och ingenting hindrade det scopade namnet från att komma tillbaka med en kopierad rad. Nytt: `check-gammalt-namn` (i `npm run check`) läser varje fil i repot och är röd på det scopade namnet och tarbollens gamla filnamn utanför `CHANGELOG.md`, `create-ops-app/` och README:s stycke om namnet före 0.67.0 (ett tak på 2 träffar, som bara får sjunka). Golv: 540 lästa filer (569 nu), och golvet följer med: läser vakten mer än 20 procent över golvet är den röd och säger vilket golv som ska stå. Taket är exakt: färre träffar än taket är också rött, så att taket sänks (omgranskningen av PR 268, A4). Planterat i `test-guards` (`gammalt namn` 1 till 6: en import, tarbollens namn i ett skript, README över taket, golvet, README under taket, golvet för lågt), och provat mot repot med en planterad import (röd) och utan (grön).
- **`check-token-overrides` godkände en `@source` mot det gamla namnets katalog** (granskningen av PR 271, A2). Mönstret krävde bara att sökvägen slutade på `ops-framework/`, så `../node_modules/` följt av det scopade namnet passerade, och en sådan app blir helt ostylad utan fel när nyckeln i `package.json` är bytt. Nu ska segmentet före `ops-framework/` vara `node_modules/`. Planterat i `test-guards` (`overrides 1b`), som var grönt med det gamla mönstret och rött med det nya.
- **README sade att paketet hette `ops-framework` före 0.67.0.** Det hette det scopade namnet; namnbytet hade ersatt även den raden.

#### Tillagt

Trådarna är **frivilliga**: allt nedan gäller bara en app som skickar `tradar`. Ramverket känner inget samlingsnamn själv, så `tradar` har inget förval (granskningen av PR 268, BÖR 1).

- **Modellen i `lib/samtal.js`:** `<samtal>/{sid}/<tradar>/{tid}` med `{ skapad, skapadAv, namn? }`, där `tid` ÄR rotmeddelandets id (inget `rot`-fält, inget `groupId`: samtalet bär gruppen). `TRADFALT`, `MAX_TRADNAMN`, `byggTrad`, `kravTradnamn`.
- **Namnet är en regel, inget modellanrop:** `rensaForNamn`, `autonamn`, `tradensNamn`, `AUTONAMN_LANGD`, `AUTONAMN_MINST`, `NAMNLOS_TRAD`. Rotmeddelandet är frågan, så regeln ger ett begripligt namn direkt och kostar ingen kvot; ett lagrat automatiskt namn hade varit en andra sanning om rotmeddelandet. `namn` på tråden betyder bara att en person döpt om den. `autonamn` och `tradensNamn` finns också i `/node`, så att appens agent kallar tråden samma sak som vyn.
- **`samtalsregelfragment({ tradar })`:** trådar bara i gruppchatten; läsa som gruppchatten; en aktiv person startar en tråd ur ett meddelande som finns, som sig själv; en uppdatering rör bara `namn`; trådens meddelanden har samtalets krav och skrivs aldrig av en klient som agent; ingen radering. Ett `tradar` som krockar med `meddelanden` eller `last` kastar. Regelprov med mutationstabell i `rules/__tests__/tradar.test.mjs`.
- **`createSamtalskalla({ tradar })` och `harTradar(kalla)`:** `trad`, `oppnaTrad`, `tradarFor(sid, rotter)`, `antalSvar`, `tradmeddelanden`, `prenumereraTrad`, `skickaITrad`, `dopOm`, `rotmeddelande`, bara när `tradar` skickats. En tråd skapas med det första svaret, så ett "Svara i tråd" som ångras lämnar ingen tom tråd. Antalet svar räknas, det lagras inte.
- **Datakontraktets frivilliga `count(samling, fråga?)`:** en aggregatfråga utan att läsa raderna. `createFirestoreSource` har den när SDK:n har `getCountFromServer`; minneskällan har den inte, och då räknar källan en lista med `sida` som tak.
- **`OpsMeddelanden` och `OpsTrad`, när källan har trådar:** "Svara i tråd" under varje meddelande i gruppchatten (44 px träffyta, på dator synlig vid hover och fokus, på telefon alltid, eftersom telefonen saknar hover och en meny vore ett steg till), eller ett märke "3 svar" när tråden finns, med namnet bara när en person döpt om tråden. Tråden öppnas i högerpanelen med en rad tillbaka till gruppchatten, namnet med Döp om (Escape avbryter, fokus stannar i rubriken), rotmeddelandet, svaren och samma skrivfält; fokus går tillbaka till märket när tråden stängs. Listan står kvar till vänster på dator. Agentens svar bär agentens ikon. Nya props `valtTrad` och `onValjTrad`.
- **Märkenas läsningar** (BÖR 4, mätt med 50 meddelanden och 20 trådar med 3 svar var, med en källa som räknar som Firestore fakturerar): att öppna chatten 70 läsningar för trådarna (förut 80, och förut växte det med antalet svar: med 50 svar per tråd hade det varit 20 + 20 × 50 = 1 020, räknat och inte mätt; nu är det 70 oavsett antal svar), ett nytt meddelande 1 (förut 77), tillbaka från en tråd 0 (förut 77). Ett svar från någon annan når märket när fönstret får fokus (30 läsningar); förut nådde det inte märket alls förrän chatten lästes om.
- **`check-skalyta` avsnitt 29 (e):** märket och "Svara i tråd" i gruppchatten med 44 px träffyta och hover på dator, tråden i högerpanelen vid 390 och 1280 px, listan kvar vid 1280.

#### Medvetet utelämnat (regel 13)

- **Inget läsmärke per tråd.** Det hade varit en samling till, en läsning till per tråd och en regel till, för ett behov ingen har sett än. Trådens olästa räknas inte; märket visar antal svar.
- **Ingen notis för trådsvar**, utom det som redan gäller när agenten nämns.
- **Inget gruppminne.** "Lyft till minnet" väntar på CP:s beslut om var minnet ska bo.
- **Ingen `in`-fråga i datakontraktet.** Märkena läser en tråd per ny rot i stället; en ny frågeform hade krävt en ändring i varje adapter.

#### Ompinning till 0.68.0

⛔ **Från en version före 0.67.0:** gör först stegen i 0.67.0 (paketet heter `ops-framework`, nyckeln i `package.json` och alla importer byts). Tarbollen är `ops-framework-0.68.0.tgz`.

**Utan `tradar` ändras ingenting.** `samtalsregelfragment()` ger samma text som i 0.67.0, byte för byte (fixturen är genererad ur `origin/main`; mot 0.64.0 skiljer bara källkommentaren, som 0.67.0 bytte till paketnamnet `ops-framework`), `createSamtalskalla` har samma funktioner som förut, och `OpsMeddelanden` ritar varken knappen, märkena eller trådvyn. En ompinning utan `tradar` kräver alltså ingen regeldeploy och ändrar ingenting för användaren.

**Med `tradar`** finns en ordning, och den är inte förhandlingsbar: reglerna med `samtalsregelfragment({ tradar })` deployas FÖRE den klient som skickar `tradar` till `createSamtalskalla`, eftersom det är den klienten som visar "Svara i tråd". En klient som visar knappen mot regler som inte känner trådarna får "Missing or insufficient permissions" vid första svaret. En app som har trådregler i ett eget block ska ta bort det, eftersom två `match` på samma väg läggs ihop med ELLER.

---
## 0.67.0

⛔ **Versionsnumret:** 0.66.0 hoppas över. Det numret bar utkastet till trådarna i gruppchatten (PR 268, lifehub.app#60) när den här grenen öppnades, och trådarna ges ut som 0.68.0. Någon tagg v0.66.0 finns inte.

### Paketet heter `ops-framework`, utan scope

CP 2026-10-06: release-artefakterna ska inte bära "staiger" i namnet. Paketet hette `@staiger/ops-framework`, och `npm pack` gör ett scope till ett prefix i filnamnet, så varje release fick tarbollen `staiger-ops-framework-X.Y.Z.tgz`.

#### Ändrat (brytande)

- **`name` i `package.json` är `ops-framework`.** `npm pack` ger `ops-framework-0.67.0.tgz` (mätt). `publish.yml` är oförändrad: den tar filnamnet ur `npm pack` och skriver det inte själv, så namnet har ett hem.
- **Varje hänvisning i repot följer med:** README, SETUP, adoption, skills, exempelmodulen, kommentarer och filhuvuden i `src/`, de genererade reglernas källrad (`// Källa: ops-framework, ...`), `create-ops-app`-mallen och vakterna.
- **`check-token-overrides` och `check-fonts` kräver `@import "ops-framework/tokens.css"`**, och `@source` ska peka på en sökväg vars segment heter exakt `ops-framework/`. En app som står kvar på `@staiger/ops-framework` i CSS:en blir röd.
- **`check-paket` är rött för ett scopat `name`**, med filnamnet `npm pack` hade gett i felet. Planterat i `test-guards` (`paket 3b`).
- ⛔ **De äldre avsnitten i den här filen står kvar med det gamla namnet.** De beskriver vad som var sant när de gavs ut, och release-URL:erna i dem (till exempel `staiger-ops-framework-0.40.0.tgz`) är filnamnen som faktiskt ligger på de releaserna.
- **Inte ändrat:** `create-ops-app/package.json` heter fortfarande `@staiger/create-ops-app`. Den ligger inte i `files`, packas inte och ges inte ut.

#### Ompinning till 0.67.0

Gäller `cllp/lifehub.app`. `cllp/bolag-ops` stängs och pinnas inte om. Ompinningen mergas efter ramverket, i samma pass (regel 11).

1. **`package.json`:** byt nyckeln, inte bara URL:en: `"ops-framework": "https://github.com/cllp/ops-framework/releases/download/v0.67.0/ops-framework-0.67.0.tgz"`, och ta bort `"@staiger/ops-framework"`.
   - ⛔ Står den gamla nyckeln kvar installerar npm det nya paketet under `node_modules/@staiger/ops-framework` (mätt med en tarboll), så importerna fortsätter fungera och ingenting ser fel ut. Ramverkets vakter och dokumentation säger då `ops-framework`, och appen säger något annat.
2. **Alla importer:** `from "@staiger/ops-framework"`, `"@staiger/ops-framework/node"` och `"@staiger/ops-framework/sentry"` blir `"ops-framework"`, `"ops-framework/node"` och `"ops-framework/sentry"`.
3. **`src/index.css`:** `@import "ops-framework/tokens.css";` och `@source "../node_modules/ops-framework/dist";`.
4. **Skript och CI** som kör `node node_modules/@staiger/ops-framework/scripts/...` byter till `node_modules/ops-framework/scripts/...`.
5. **Genererade regler:** kör regelgenereringen igen, så att källraden säger `ops-framework`. Reglerna i övrigt är oförändrade.
6. `npm install` så att låsfilen bär det nya namnet, och sök efter `@staiger/ops-framework` i repot efteråt. Noll träffar i `src/`, `functions/`, CSS och skript är målet.

## 0.65.0

### Gruppens ikon och färg: sökbar ikonväljare med synonymer, kulör i stället för fri färg (#265)

Händelsen: CP 2026-10-06, överlämning från en annan tråd om att skapa en grupp (`OpsGruppFormular`): "Music" ska ge not, hörlurar, högtalare, gitarr och skiva, inte bara ikonen som heter music; gruppen "Bandet" ska visa musikikonerna först; ingen helt fri färgväljare, eftersom den ger färger bakgrunden inte tål, text som tappar läsbarhet och grupper som inte ser ut som en familj.

#### Tillagt

- **Sökbar ikonväljare** (`OpsGruppmarkeValjare`, i formulärets "Färg och ikon"). 187 Lucide-ikoner som en grupp kan vara (musik, arbete, idrott, familj, natur, mat, resor, pengar, teknik, skapande), med Lucides egna sökord (`lucide-static/tags.json`, samma version som `lucide-react`) och svenska synonymer (`SVENSKA_SYNONYMER` i `gruppikonsok.js`, som pekar på sökord och aldrig på en ikon). Innan något skrivits: förslag ur gruppens namn, de senast använda (per webbläsare, `localStorage`) och tjugo vanliga. Tomma rader säger att de är tomma (regel 5).
- **Kulörväljare**: tolv snabbval och ett reglage för alla 360 kulörer. Ljusheten och mättnaden står i temat (`--gruppmarke-ikon-l/-c`, `--gruppmarke-platta-l/-c`, med `--dark-*` för mörkt läge), och märket ritas som `oklch(L C <kulör>)`.
- **Märket: ikonen i gruppens färg på en tonad platta av samma kulör**, överallt där gruppmärket ritas (gruppanelen, remsan, växlaren, gruppsidan, formuläret). `OpsIdentity` har en ny prop `kulor`; `gruppmarkeProps` sätter den för varje grupp. Personers märken är oförändrade.
- **Exporter:** `gruppikonKomponent`, `ARV_GRUPPIKON`, `GRUPPIKONKATALOG`, `sokGruppikoner`, `forslagUrGruppnamn`, `VANLIGA_GRUPPIKONER`, `GRUPPKULORFORSLAG`, `GRUPPKULOR_FORM`, `fargTillKulor`, `kulorTillFarg`, `gruppKulor`.

#### Efter granskningen av PR 266

- **Svenska namn på ikonerna** (`GRUPPIKON_SVENSKA`, `gruppikonEtikett`). Knapparna hette Lucides engelska filnamn ("music 2", "audio waveform"); nu säger varje namn vad ikonen föreställer, unikt, så varianter går att skilja åt med skärmläsare. Namnen är också sökord.
- **Ord som gav noll träffar och lagades:** hörlur, hörlurar, högtalare, noter och skiva, via ikonernas svenska namn. De lades först också som synonymer, men en mutation som tog bort synonymerna lämnade alla prov gröna, så de ströks (regel 2). Prövat också: fotboll, kontor, familj, skola, resa, mat, bok, kör, band och styrelse gav redan träffar, men "styrelse" gav en tärning (`board` som i brädspel) och "not" gav anteckningsboken först; båda rättade. Ett prov per ord.
- **Prefix på engelska taggar bara för det som skrevs, och lågt viktat.** "kontor" gav en hantel: synonymen `work` var prefix till taggen `workout`.
- **Den levande regionen är en statusrad** ("12 träffar", "Inget matchar"), inte rutnätet med upp till 48 knappar.
- **Reglagets uppläsning bär närmaste kulörnamn** (`narmasteKulornamn`): "227 grader, Turkos".
- **En ny grupp sparar kulören den visar.** Utan val visade formuläret kulören ur fröet `ny-grupp` men sparade tom sträng, och gruppen fick då en annan kulör ur sitt nya id.
- **`GRUPPKULOR_FORM` är `^kulor:(0|[1-9]\d{0,2})$`**, en lagrad form per kulör, och 0 till 359 prövas i `fargTillKulor`.
- **16 nästan-dubbletter strukna ur urvalet** (music-2/3/4, disc-3, flower-2, fish-symbol, users-round, user-round, building, tree-deciduous, mic-vocal, audio-waveform, headset, mountain-snow, brush, diamond) utan att någon sökning tappar sitt svar.
- **`check-gruppfarg`s golv "räknade minst 720" kunde aldrig bli rött** och är ersatt av ett riktigt: minst 300 olika ritade ikonfärger av 360 per läge. En mättnad 0 i temat klarar varje kontrastkrav men gör alla kulörer grå; den är röd nu.
- **`check-skalyta` 22b rullar panelens behållare** för bilden av ikonväljaren (vid 1280 px blev den annars samma bild som översikten), och kräver att den faktiskt rullades.
- **Montage före och efter** av befintliga gruppkort och gruppsidans märke, i ljust och mörkt läge: `docs/bilder/265/montage-fore-efter-*.png` (`docs/bilder/265/gor-montage.mjs`).

#### Valet: kulörvägen, inte en kurerad palett

Ärendet sade att en kurerad palett på 12 till 16 färger väljs bara om kulörvägen inte håller kontrastkraven. Den håller, mätt för alla 360 kulörer (`check-gruppfarg`): sämsta kulören ger ikonen mot plattan 4,92:1 i ljust (kulör 192) och 6,77:1 i mörkt, golv 4,5 eftersom initialer är text; ikonen mot ytan 5,63:1 respektive 7,63:1, golv 3. Skälet: OKLCH-ljusheten är perceptuell, så en fast ljushet ger nästan samma luminans oavsett kulör. Vakten räknar både med CSS Color 4:s gamut-kartläggning och med Chromiums klippning per kanal, eftersom Chromium klipper (mätt: Petrol ljust ritades rgb(0, 111, 113), 4,95:1 avläst ur en canvas mot vaktens 4,93:1).

#### Lagring och migrering

- **Ikonen sparas som sitt Lucide-namn** (`music`, `building-2`), aldrig som index. `byggGrupp` avvisar ett tal (`"12"`). De tio äldre id:na (`grupp`, `hus` ...) tas fortfarande emot och ritas med exakt samma SVG som före 0.65.0 (`ARV_GRUPPIKON`, provat ikon för ikon); formuläret skriver aldrig ett äldre id.
- **Färgen sparas som `kulor:<0-359>`.** De sex äldre tonerna (`"1"` till `"6"`) tas fortfarande emot. ⛔ **Dokumenterad migrering, på läsvägen och utan att något skrivs om:** en grupp med en äldre ton ritas i den tonens kulör (`ARV_TON_KULOR`, härledd ur `--color-identity-N` och provad mot tokens.css), i det nya märket. En grupp utan sparad färg får kulören dess ton ur `id` hade haft. Samma familj som förut, ny form: plattan är ljus och ikonen färgad, i stället för en fylld ruta med vit ikon. Ton 6 (gråoliv) blir mättare än förut, eftersom mättnaden nu kommer ur temat.
- Ett valt gruppkort har kanten i gruppens färg och ytan i samma färg vid 6 procent, som SS `GroupCard.jsx:60-65`. Utan sparad färg: accenten, som förut.
- Ramverket känner inget samlingsnamn och inget projekt-id: inget ändras i reglerna, fälten `farg` och `ikon` finns redan och fick bara nya giltiga värden i `byggGrupp`.

#### Paketstorlek, mätt före och efter

Mätt med `scripts/build.mjs` och `npm pack --dry-run`, före på `origin/main` (0.63.0, 9ab058f), efter på den här grenen:

| | 0.63.0 | 0.65.0 | Skillnad |
|---|---|---|---|
| `dist/index.js` | 933 652 byte | 1 062 111 byte | +128 kB |
| `dist/index.js` gzip | 234 013 byte | 267 545 byte | +33,5 kB |
| minifierad och gzip (det en app laddar, React och Radix externa) | 163 259 byte | 193 942 byte | +30,7 kB |
| tarbollen | 2 640 359 byte | 2 785 721 byte | +145 kB |

Efter granskningen av PR 266, mätt igen mot `origin/main` på 0.64.0 (c03f8e7):

| | 0.64.0 | 0.65.0 före granskningen (203 ikoner, mätt på 0.63.0) | 0.65.0, 187 ikoner och svenska namn |
|---|---|---|---|
| `dist/index.js` | 933 884 | 1 062 111 | 1 060 351 |
| gzip | 234 070 | 267 545 | 268 642 |
| minifierad och gzip | 163 314 | 193 942 | 194 730 (+31,4 kB mot 0.64.0) |
| tarbollen | 2 644 419 | 2 785 721 | 2 799 747 |

Strykningen av 16 ikoner och de tillagda svenska namnen (187 rader) tar i stort sett ut varandra. Att lata in katalogen är ett senare ärende.

Ungefär en fjärdedel av tillväxten är sökorden (26,5 kB okomprimerat), resten är de 203 ikonerna.

Ikonerna buntas in (`lucide-react` är inte extern i `scripts/build.mjs`), så urvalet är ett urval: hela Lucide är 1 539 ikoner och `tags.json` ensam 190 kB. `lucide-static` är en devDependency och hamnar aldrig i paketet.

#### Vakter

- **`check-gruppfarg`** (ny): kontrasten för alla 360 kulörer i båda lägena mot plattan och tre ytor. I `check-guards` röd med ikonens ljushet 0,62 i ljust, med plattans ljushet 0,6 i mörkt och utan talen.
- **`check-gruppikoner`** (ny): katalogen är i takt med generatorn och samma Lucide-version.
- **`check-skalyta` avsnitt 22b** (nytt): i ljust och mörkt vid 390 och 1280 px, kulören når märket (plattan och ikonen två täckande färger, Petrol och Rosa olika), kontrasten i det RITADE märket avläst ur en canvas (golv 4,5), "Bandet" ger gitarr eller trumma bland de sex första förslagen, "music" ger minst fem träffar med gitarr och hörlurar, ingen överflödning. Avsnitt 22, gruppkortet och gruppsidan mäter kulören i stället för identitetstonen.


## 0.64.0

⛔ **Versionsnumret:** 0.64.0 är reserverat för den här grenen. Arbetet med #265 (ikon och kulör) tar 0.65.0.

### Segmentets räknare, antal i menyraderna och grundlägets etikett (cllp/lifehub.app#59)

CP 2026-10-06, om Idag i LifeHub (cllp/lifehub.app#59): segmentet Idag/Kommande är redan ett tidsfilter, och förfiningen ska ligga i flikens chevron i stället för i en egen När-knapp. "Idag visade 9, Kommande 70, Tidigare ingenting. Utan nollan hoppar kontrollen i bredd när den fylls." Antalet ska stå i menyraderna ("Inom 7 dagar 12") före klicket.

Mätt mot 0.63.0 i Chromium (check-skalyta avsnitt 42): samma kontroll var 170,84 px bred med räknaren 0 och 198,44 px med 9, eftersom nollan inte ritades. Menyraderna hade ingen plats för ett tal, och en app som lade talet i `label` hade fått det två gånger i fliken, eftersom etiketten följer menyvalet. Appens bygge i lifehub.app#64 visade också att Kommande bytte namn till "Allt framåt" vid första klicket, eftersom menyraden med segmentets eget värde tog över etiketten.

#### Ändrat

- **`OpsSegmented` ritar räknaren också när den är 0.** `badge` ritas när det är ett tal. En app som inte vill visa något utelämnar `badge`, och skickar inte 0.
- **`menu.items[].badge?: number`** ritas i menyraden, till höger om ordet och före bocken, i samma talform som segmentets räknare (`tabular-nums`, dämpad). `ValRad` har den nya propen `antal`. Menyradens tillgängliga namn bär talet ("Inom 7 dagar 12").
- **Segmentet behåller sin egen etikett när det valda värdet är segmentets eget värde**, också när en menyrad bär samma värde. Bara ett annat menyval byter etiketten: Kommande heter Kommande i grundläget, och Inom 7 dagar när det fönstret valts.

#### Ompinning till 0.64.0

Ingen brytande ändring. En app som skickade `badge: 0` och räknade med att inget syntes får nu en nolla. En app vars menyrad bär segmentets eget värde med ett annat ord (till exempel `{ value: "kommande", label: "Alla" }`) ser nu segmentets ord i fliken när det läget är valt. Prov som letar efter en menyrad med exakt namn måste ta med talet när raden har `badge`.

---

## 0.63.0

⛔ **Versionsnumret:** 0.61.0 och 0.62.0 är redan tagna av PR 260 (#259, regel 13) och PR 261 (bolag-ops#565), som inte är mergade när den här grenen öppnas. Den här grenen tar därför 0.63.0. Mergas de i en annan ordning ska numren rättas vid mergen, inte här.

### "Nytt meddelande" lämnar aldrig Meddelanden (#263)

CP 2026-10-06 11:22, med en skärminspelning från LifeHub: "steget med att öppna en liten chattfönster till är lite konstigt", och "Chatten dök upp långt senare...". Han skickade frågan till agenten två gånger, eftersom ingenting syntes hända.

Tre fel samverkade, alla mätta i ett vitest-prov mot 0.60.0 (efter Skicka och 300 ms: källan har ett samtal, skärmen noll rader, noll trådar och "Inga samtal än"):

1. "+ Nytt meddelande" öppnade skalets skapa-panel, som dolde hela appens vy (`hidden={skapaPanelSyns}`). Listan och tråden försvann.
2. `useSamtal` läste listan vid montering och vid `focus`, och lyssnade inte däremellan. `OpsMeddelanden` monterades inte om, eftersom vyn bara var dold.
3. Tråden ritades bara när samtalet fanns bland raderna, så ett nytt samtal gav "Inga samtal än" fast adressen pekade på rätt `?samtal=`.

Skalprovet i `meddelanden.test.jsx` stod grönt genom felet: det hade `<p>appens vy</p>` som barn och mätte bara att `onGaTill` anropades.

#### Ändrat

- **`OpsMeddelanden` har läget "nytt" i högerpanelen**, som SessionStudio (`ChatInboxPanel.jsx:1091-1124`, `:477-505`). Till (`OpsMottagare lage="person"`) och raden om vem som ser samtalet överst, trådens skrivfält längst ned, och listan står kvar till vänster. På telefon ersätter läget listan, med "‹ Tillbaka". Valet i Till öppnar samtalet direkt med `oppnaPrivat`; ett befintligt samtal, också agentens, öppnas med sin historik och inget nytt skapas. Text skriven före valet följer med in i tråden, och Skicka utan mottagare säger "Välj vem meddelandet ska till.".
- **Tråden ritas på det valda id:t**, inte på listan (SS `:186-191`, `DMPanel.jsx:95-97`). Saknas raden läses gruppen och paret ur nyckeln (`delaSamtalsnyckel` i `lib/samtal.js`, inversen av `samtalsnyckel`) och rubriken ur `medlemmar`. Ett id i en annan grupp, eller ett par man inte är med i, ritar ingen tråd.
- **`useSamtal` har `laggIn(samtal, senaste?)`**: raden läggs in lokalt direkt efter öppnandet och efter Skicka, och listan läses sedan om. Inget sparas. Raden slås in i varje omläsning tills källan själv svarat med samtalet och ett lika nytt meddelande, så att en källa som ännu inte ser samtalet inte tar bort raden igen. Ett samtal i en annan grupp än inkorgens läggs aldrig in.
- **Ett gruppbyte medan samtalet öppnas lägger inget i den nya gruppens inkorg** (granskningen av PR 264, tredje varvet). `NyttSamtal` höll kvar `onOppnat` ur renderingen där klicket skedde, så gruppkontrollen i `laggIn` jämförde den gamla gruppen med sig själv. `useSamtal` jämför nu `laggIn` och `lasOm` med gruppen som visas just nu (en ref), och nollar de lokala raderna och källans förra svar vid bytet. `NyttSamtal` monteras om per grupp och gör ingenting när svaret kommer efter att den avmonterats (också när man tryckt Tillbaka), så ett samtal i en grupp som inte visas väljs aldrig och skrivs inte till appens adress. Utkastet följer inte med över ett gruppbyte, med avsikt: det skrevs till någon i den förra gruppen. Varje skydd har ett eget prov som är rött utan just det skyddet. Två skydd som var gröna utan sig själva (en andra gruppkontroll på svaret i `lasOm`, och en gruppkontroll i `onOppnat`) är borttagna.
- **Filtret och sökningen nollas när ett samtal startas**, som SS (`ChatInboxPanel.jsx:484-487`). Annars döljer "Olästa" det nya samtalet. Text som skrivs medan samtalet öppnas följer också med in i tråden.
- **`samtalsnyckel` kastar för ett `groupId` med `|`**, och `delaSamtalsnyckel(id, groupId)` gör detsamma. En sådan nyckel hade lästs baklänges till fel grupp. ⛔ Ingen spegelkolumn (`senast`) på samtalsdokumentet (regel 2, filhuvudet i `lib/samtal.js`).
- **`OpsMeddelanden` props:** `nytt` (läget, när appen styr det) och `onValj(id, val?)`, som får `(null, { nytt: true })` när läget öppnas. Knappen Nytt meddelande står alltid när en grupp är vald.
- **`OpsSamtal` props:** `onSkickat(meddelande)` och `utkast`.
- **Plussets "Nytt meddelande" leder till Meddelanden i läget "nytt"** (`skapa.nyttMeddelande`, en funktion `() => void`). `useOppnaSkapa()("meddelande")` och adressens `?skapa=meddelande` gör samma sak, och parametern tas bort ur adressen.

#### Borttaget (brytande)

- **`skapa.meddelande`, `OpsNyttMeddelande` och skalets `skickaEtikett`.** Det ska finnas EN väg att starta ett samtal. Skalet **kastar** om `skapa.meddelande` skickas, med vägen till `skapa.nyttMeddelande` i felet, i stället för att raden tyst försvinner (regel 5). En app som pinnar om byter `skapa.meddelande` mot `nyttMeddelande: () => navigera("/meddelanden?nytt=1")` och ger vyns `OpsMeddelanden` `nytt` och `onValj(id, val)`.

#### Ompinning till 0.63.0

Samma ändringar i båda apparna, `cllp/lifehub.app` och `cllp/bolag-ops` (sökvägarna under `web/`). Ompinningen mergas efter ramverket, i samma pass (regel 11).

⛔ **Avsnittet beskriver bara skillnaden från 0.62.0 till 0.63.0.** Apparna står inte där: lifehub.app pinnar 0.60.0 och bolag-ops 0.50.0 (mätt i `web/package.json` på origin/main 2026-10-06). En ompinning från en äldre version går också igenom avsnitten 0.61.0 och 0.62.0 i den här filen, och för bolag-ops dessutom 0.51.0 till 0.60.0, var för sig. 0.61.0 och 0.62.0 kommer från PR 260 och PR 261 och står här först när de är mergade. Radnumren nedan är mätta på origin/main i båda repona samma dag.

1. **`src/app/App.jsx`.**
   - Ta bort `OpsNyttMeddelande` ur importen från `@staiger/ops-framework` (lifehub `:18`, bolag-ops `:19`). Exporten finns inte längre, så importen ger byggfel.
   - Byt blocket med `skapa.meddelande` och dess kommentar (lifehub `:681-703`, bolag-ops `:653-675`) mot `nyttMeddelande: () => navigera("/meddelanden?nytt=1")`, under samma villkor (`samtal.kalla`).
   - ⛔ Skickar appen kvar `skapa.meddelande` kastar skalet.
   - Rätta kommentaren om `skapa.meddelande` (lifehub `:231`, bolag-ops `:221`).
2. **`src/app/views/MeddelandenView.jsx`.**
   - Läs `nytt` ur adressen (`new URLSearchParams(search).has("nytt")`) och ge den till `OpsMeddelanden nytt`.
   - Skriv om `onValj` (`:48`) så att den tar `(id, val)`:
     - Med `val?.nytt` blir adressen `${pathname}?nytt=1`.
     - Med ett `id` blir den `${pathname}?samtal=<id>`.
     - Annars blir den `pathname`.
   - ⛔ Appen ska ta bort `?nytt=1` när den får `onValj(id)` utan `val`. Annars vinner läget "nytt" över det valda samtalet, och tråden öppnas aldrig.
   - Ta bort `onNytt` (`:50`) och `useOppnaSkapa`. Komponenten ignorerar `onNytt`, och knappen öppnar läget själv.
   - Kommentaren `:19-20` beskriver den gamla panelvägen och ska skrivas om.
3. **`src/app/__tests__/meddelanden.test.jsx:135-160`.**
   - Proven för plusset letar efter regionen "Nytt meddelande" med knappen Skicka i skapa-panelen.
   - Nu ligger regionen i Meddelanden: `[data-ops-meddelanden]` med Till, raden om vem som ser samtalet och trådens skrivfält med knappen Skicka (en ikonknapp med etiketten "Skicka").
   - Valet av en person öppnar samtalet direkt. Texten skrivs sedan i tråden.
   - Adressen ska vara `/meddelanden?samtal=<id>` efter valet.
4. **`scripts/ta-montage-meddelanden.mjs:66-76`.**
   - Kommentaren om att adressvägen inte öppnar någon panel är inte längre sann. Både knappen i vyn och plusset leder till läget "nytt".
   - Montaget av "Nytt meddelande" tas nu i Meddelanden, och bör också ta tråden före och efter det första meddelandet.

#### Prov

- `nyttMeddelande.test.jsx`, med `OpsMeddelanden` monterad i skalet och utan någon `focus`-händelse: tom inkorg, Nytt meddelande, agenten, skriv, Skicka ger samtalsraden och `[data-ops-samtal]`; ett valt id som inte finns bland raderna öppnar tråden; agenten med ett befintligt samtal ger samma id och inget nytt `create`; listan är samma element i DOM:en under hela flödet.
- `useSamtal.test.jsx` och ett block i `nyttMeddelande.test.jsx` mäter `laggIn` mot en källa vars `oversikt` är fryst och aldrig svarar med det nya samtalet. Raden ska stå i listan direkt efter valet och finnas kvar efter omläsningen, utdraget ska synas efter Skicka och det nyss skickade ska ligga överst. Granskningen av PR 264 visade att alla prov var gröna med `laggIn` som no-op, eftersom raden syntes ändå via läsmärket.
- `check-skalyta` avsnitt 29 (d) är omskrivet. Den gamla mätningen av panelen (en region, kolumnen högst 672 px, Skicka i panelens knapprad) är borttagen, eftersom det den mätte är felet. Nu: plussets rad öppnar läget "nytt" i Meddelanden utan dialog och utan skapa-panel, listan står kvar vid 1280 med samma bredd, valet öppnar tråden direkt, och efter Skicka står raden i listan och bubblan i tråden utan `focus`.

---

## 0.62.0

### Ikonerna i huvudet och bottenraden går att träffa, och bottenradens ikoner står högre (cllp/bolag-ops#565)

CP 2026-10-06: "Fortfarande lite svårt att träffa ikonerna i header och bottenlagen. Skulle vilja att de kom upp några pixlar. Är det förra ärendet utfört? Ser ingen skillnad ännu."

#### Ändrat

- **Huvudets ikonknappar är 44 px under `md`, inte 36 med en osynlig 44-yta.** Mätt med `elementFromPoint` i 390 px träffades Inkorg på 36x44 och Sök på 36x44, och temaväxlaren (ritad 44) bara på 42x44: knapparna står 2 px isär, så den osynliga `after:size-11` hamnade under grannen och grannen vann trycket. `huvudknappKlass` och `huvudPlusKlass` är nu `size-11 p-2.5` under `md` (ikonen 24 px som i 0.59.1) och `md:size-9`/`md:size-10` från `md`, oförändrat på dator. Avataren är en 44 px knapp under `md` med ringen och 32 px-cirkeln på en inre yta (`group-hover:ring-2`), så den ser likadan ut. Märket utan grupper är en 44 px länk under `md` (monogrammet 40).
- **Bottenradens ikoner står uppifrån, och raden har ett lyft.** `--bottom-nav-h` är nu summan `--bottom-nav-rad` (56 px) plus `--bottom-nav-lyft` (12 px), 68 px, och är fortfarande den enda höjd `<main>`, toasten, sifferbubblan och meddelandeytan räknar med. Platsen är `justify-start pt-2` (SS `MobileTabBar` paddingTop 8) i stället för centrerad; i 0.59.1 blev raden 8 px högre men ikonen steg bara 4 px. Ikonens mitt står nu 82 px över skärmens underkant med hemindikator (safe 34, var 73) och 48 px utan (var 39). SS står på 72 och 38.
- **Åtgärder som inte ryms under `md` flyttar till bottenradens ark även utan `meny`** (granskningen av #261). Före 0.62.0 flyttades ingenting utan `meny`, med skälet att en flyttad åtgärd då saknade hem, och fem åtgärder plus avataren gav ett huvud som svämmade över vid 320 px (scrollWidth 346) och klipptes vid 360. Bottenradens Meny ritas alltid under `md`, och dess ark visar nu de flyttade `OpsIconLink` som rader. Med `meny` går de som förut in i appens avdelning. `ATGARDER_SMAL` (tre) håller därmed i båda fallen.
- **Den runda knappen står i radens överkant och lyfts `--bottom-nav-overhang` minus ringen**, i stället för en handskriven `-translate-y-4` från mitten. Radens höjd kan ändras utan att knappen flyttar sig.

#### Vakter

- **`check-skalyta` avsnitt 6b: träffytan där ett tryck faktiskt landar.** Varje `a`/`button` i huvudet och bottenraden ska träffas på minst 44x44 enligt `elementFromPoint`, vid 390x844 (safe 47/34 och 0) och 375x667 (safe 20/0), i scenerna `fasta` och `full`, utan horisontell överflödning. Bottenradens ikoner ska stå 8 px under radens överkant med mitten minst 81 px (safe 34) eller 47 px (safe 0) över skärmens underkant. Golv: 5 kontroller i huvudet i `full` och `utanmeny` (3 i `fasta`), 5 i bottenraden. Röd mot 0.60.0 med 102 brott (avsnitt 6b och 2), grön med fixen.
- **`ops-viewport` och `check-scaffold` läste `--bottom-nav-h` som text** (`parseFloat` på det beräknade värdet). När tokenen blev en `calc`-summa gav Chromium "calc(3.5rem + .75rem)", `parseFloat` gav NaN, och kontrollen "innehållet hamnar bakom baren" hoppade tyst över i varje app. Höjden mäts nu med ett provelement (`height: var(--bottom-nav-h)`), och en höjd som inte går att mäta är ett brott. Fixturen i `test-viewport-guard` har samma `calc`-form som ramverket och ett nytt prov där tokenen saknas.
- **Avsnitt 6b mäter också** den runda knappens lyft (överkanten `--bottom-nav-overhang` minus ringen, 12 px, ovanför radens överkant), scenen `utanmeny` (fem åtgärder utan `meny`) vid 320 och 360 px och att de flyttade åtgärderna finns som rader i arket. Vid 768, 900 och 1023 px skrivs träffytorna ut utan krav: knapparna är 36 px från `md`, eftersom huvudets flikar redan i 0.60.0 ligger ovanpå högerklustret vid 768 px och större knappar gjorde det värre.
- **Avsnitt 2 mätte pseudoelementets storlek (`efterBredd >= 44`) vid 1280 px.** Den var grön genom hela felet. Ersatt av samma `elementFromPoint`-mätning: vid 1280 ska hela den ritade cirkeln träffa knappen.

## 0.61.0

### Lager och tillgänglighet i dagsrutan (#259 skiva 1)

Händelsen: CP 2026-10-06, med tre skärmbilder ur SessionStudio-appen och en ur SS webb: "Det tog LÅNG tid att få till ikonerna för lager och tillgänglighet särskilt i mobil vy och native med små celler så studera det NOGA", och samma morgon "Allt finns i SessionStudio". Förebilderna ligger i `docs/bilder/259/`, montagen bredvid dem (`montage-393.png`, `montage-393-utsnitt.png`, `montage-1280.png`, gjorda av `gor-montage.mjs`).

#### ⛔ Brytande

- **`dagdekor` är typad: `hornmarken` är borta.** `OpsCalendar dagdekor(dayKey)` ger nu `{ ton?, ram?, borta?: { antal }, lager?: { antal }, narvaro?: { tillgangliga, totalt } }`. Appen skickar bara antalen, och rutan ritar SS:s markeringar själv, med ikonen (`UserX`, `Layers`), räknaren och orden "N borta", "N av N tillgängliga" och "N lager" i knappens namn. Skälet: utseendet ÄR SS-reglerna (fast cirkel, opak yta, kant i ikonens färg, räknaren inne i cirkeln), och en plats där varje app ritade sitt eget innehåll hade låtit varje app göra om SS:s fem varv (#564-#570). En app som skickade `hornmarken` får ingenting ritat: byt till `borta` och `lager`.

#### Tillagt

- **`tillganglighetForDag({ medlemmar, poster, dag, tidszon })` och `bortaAntal(lista)`** (`src/lib/tillganglighet.js`). Vem i gruppen som är borta (något täcker hela dagen i tidszonen) eller upptagen (en tidsatt post skär dagen), sorterat på namn, borta vinner. Heldag har exklusivt slut som `DTEND` i ICS. Härleds, lagras aldrig. ⛔ En post med läget `dold` räknas inte alls och läses inte ens; `orsak` är rubriken bara från `delad` poster. En post som inte går att läsa kastar i stället för att visa personen som tillgänglig. `bortaAntal` räknar borta och upptagna tillsammans, som SS `blockedCount`.
- **Under 640 px: SS-appens hörnbrickor.** En opak cirkel på 20 px med 1 px kant i ikonens färg (fara för `UserX`, `ink-muted` för `Layers`), ikonen 10 px, ingen skugga. Klustret sitter 4 px utanför rutans övre högra hörn, borta först och lagret alltid 4 px högre (SS `marginTop:-4`, också ensam), 16 px mellan överkanterna med båda. Räknaren inne i cirkeln från 2, `9+` från 10. Förebild 7 är mätt: brickan med räknare ("UserX 2" den 8 oktober) är samma fasta cirkel på 59 bildpixlar (20 pt) som de ensamma, inte en kapsel som växer. En dag som varit tonas med brickor och ram till hälften, som SS-appens `opacity` på hela cellen (förebild 7, den 24 september).
- **Från 640 px: SS webbs rad** (`MonthGrid.jsx:448-536`). `UserX` och `Layers` på 14 px i siffrans rad till höger, i flödet och utan bricka, räknaren direkt efter ikonen, och `N/N` på samma plats när ingen är borta (`dekor.narvaro`).
- **`dekor.ram`:** lagrets ram, 2 px i identitetsfärgen. Under 640 px täcker den rutans kant (SS-appen `borderWidthForLayer`) utan att ändra rutans storlek, från 640 px 3 px innanför med 70 procents täckning (SS webb `inset-0.5`). Ingen ram på den valda rutan.
- **`OpsCalendar tillganglighet` och `lager`** (`{ pa, onByt }`): knapparna i verktygsraden, bara när propen finns, med `aria-pressed`. Under 768 px först i raden (tillgänglighet, sök, veckonummer, lager), som SS-appen; från 768 tillgänglighet efter kalenderväljaren, som SS webb, och lager efter veckonumret. Aktiv tillgänglighet är fara-tonad, aktivt lager grått.
- **Typografirollen `raknare`** (9 px, 700, radhöjd 1), SS webbs `sm:text-[9px] font-bold leading-none`.
- **`check-skalyta` avsnitt 41**, i 310, 320, 360, 375, 393 och 1280 px och i 350, 360 och 375 px med veckonummer (310 och 350 är golvet): brickans mått, läge, överlapp och räknare (telefon), radens läge, ordning, räknare och `N/N` (bred), siffrans glyfer fria, ingen bricka över någon siffra i bild, inte heller grannens, med tillgängligheten på och av (e2), höjden oförändrad, ramen, ingen räknare vid 1, söndagskolumnens bricka oklippt, tonade brickor på dagar som varit, dolda poster utan markering och verktygsradens ordning. Varje mätning sedd röd.

#### Strukits (regel 13)

- **Lagrets prick.** SS-appen kan rita ett lager som en egen prick i den undre raden (`DayCell.js:330-357`, visningssättet "dot"), och det är den som står under eventuella händelser på lagerdagarna i förebild 3 och 7. Här syns lagret redan två gånger, som ram och som bricka; en tredje visning hade varit ett visningssätt per lager att lagra, välja och underhålla. Scenerna i `check-skalyta` fejkar den inte med extra poster.

#### Ändrat

- **Smala rutor (granskningen av PR 260): siffrans ruta krymper och brickan går ut lite mer.** Med SS-måtten täckte brickan siffran under cirka 47 px rutbredd: 0,6 px luft vid 375, täckt vid 360 (4 av 12 rutor) och 320 (8 av 12). Siffrans ruta är nu `clamp(14, 2 x radbredd - 38, 28)` px och överhänget `max(4, 40 - rutbredd)` px (`BRICKA_GRANS`), så vid 393 är allt SS rakt av (28 px, 4 px) och under det krymper rutan först. Rullytans marginal under 640 px härleds ur samma tal (`kantluft`, med veckonumrens kolumn inräknad), så att brickan i söndagskolumnen inte klipps: en fast marginal på 7 px klippte 4,6 px vid 320 och 1,7 px vid 340 med veckonummer, och 2,3 px vid 300 utan. ⛔ **Smalaste bredd som stöds är 310 px, och 350 px med veckonummer.** Under det är rutan smalare än cirka 31 px, och brickan behöver så mycket överhäng att den når grannens siffra (mätt vid 300, och 320 och 340 med veckonummer). Avsnitt 41 mäter golvet.
- **`tillganglighetForDag` prövar en tid med zon strikt.** `Date.parse` ensam godtog `2026-02-30T10:00Z` och räknade den som 2 mars. Nu krävs datum som finns, `THH:MM` med valfria sekunder, och `Z` eller `±hh:mm`. Orsakerna ordnas på den tolkade tiden, inte på strängen.
- **`dagdekor` varnar i utveckling** (`import.meta.env.DEV`) för ett antal som inte är ett heltal och för en kvarlämnad `hornmarken` (den senare en gång per sidladdning), i stället för att tyst inte rita.
- **`N/N` har vikt 600**, som SS `font-semibold`.
- **Svenska veckodagar kortas, andra språk inte.** Bara `sv` tappar punkt och kortas till tre bokstäver; franskans "lun." och norskans "man." är `Intl`:s form.
- **En tid med zon kräver kolon** (`±hh:mm`): Safari ger NaN för `+0200`.
- **Svenska veckodagar har alltid tre bokstäver: MÅN TIS ONS TOR FRE LÖR SÖN.** `Intl` på `sv-SE` ger "tors", och `weekdayNames` skrev "Tors" sedan 0.36.0 med motiveringen att det är den korrekta förkortningen. Förebild 7 (SS-appen) skriver TOR som de sex andra; `weekdayNames` kortar nu bara den svenska förkortningen till tre bokstäver. Andra språk är som `Intl` säger.
- **`check-skalyta` har en scen per förebild** (`kalender-tillganglighet` med förebild 7:s dagar och prickar, `kalender-tillganglighet-3` med förebild 3:s), så att varje montage jämför samma läge. Det förebilden inte visar (`9+`, två ensamma lager, en söndag) mäts i november.
- **Siffran står på telefon i en ruta på 28 px längst till vänster, inte centrerad.** Kommentaren sade att SS centrerar; SS lägger `dayNumberContainer` först i `dayTopRow` (`flex-start`). Mätt i förebild 3: 5,8 pt vänster om rutans mitt. `check-skalyta` avsnitt 30 krävde en centrerad siffra och kräver nu SS-geometrin.

## 0.60.0

Tre grenar samlade i en version (#253, #255 och #256), eftersom alla tre gjorde anspråk på 0.60.0 eller 0.61.0.

### Plusset i toppraden är huvudåtgärden (CP 2026-10-05)

#### Ändrat

- **Plusset i toppraden är en fylld accentcirkel på dator, och ligger först i högerklustret.** CP 2026-10-05: "Kan man göra +et sådär framträdande som det är på mobil. Samma position men större och framträdande. Kanske skall ligga längst till vänster av ikonerna i topraden till höger?" Från `md` är plusset 40 px (`bg-accent text-accent-contrast`, `hover:bg-accent-hover`) med en 24 px ikon, fortfarande med 44 px träffyta, och står före `actions` (inkorgen och de andra ikonlänkarna), avataren och hamburgaren. Före 0.60.0 var det en dämpad 36 px cirkel sist bland `actions` och före avataren. Den dämpades i 0.30.0 (#168, #173) eftersom en fylld knapp bland likar "skrek"; förutsättningen är ändrad, plusset är huvudåtgärden och inte en ikon bland ikoner. Under `md` är allt som förut: gömt när bottenraden har ett eget plus, annars den dämpade 36 px cirkeln. Ny `huvudPlusKlass` i `radKlass.js`. `check-skalyta` mäter 40 px, accentbakgrund (mot `--color-accent`) och `plus.x < inkorg.x`.

### Nodsidan för TALK (cllp/lifehub.app#37, #253)

#### Tillagt

- **`typerForGrupp`, `MAX_SEKUNDER` och `LJUDFORMAT` på nodsidan** (cllp/lifehub.app#37). Servern som gör TALK-ljud till ett förslag ger modellen gruppens sorter och prövar ljudets längd. Den importerade tidigare `src/lib/modultyper.js` förbi exports-kartan och skrev taket en gång till. Samma funktion och samma tak som i huvudingången, och båda filerna är rena.

### Tillägg på händelseytan och Syns på (#251, #255)

#### Tillagt

- **Tillägg på händelseytan** (#251, beslut 0003). Modulmanifestet får `tillagg: [{ plats, id, etikett: { sv, en }, komponent }]`. En app ändrar aldrig en ramverksyta, den pluggar bara in i platser ytan erbjuder. Två platser, exporterade som `HANDELSE_PLATSER`: `"handelse.sektion"` är en sektion i `OpsHandelsePanel` efter informationsrutan, med etiketten som rubrik, och `"handelse.atgard"` är en rad i plussets händelsedel direkt under Ny händelse. Komponenten får `{ handelse, grupp }` och inget annat (i plusset är `handelse` `null`).
- **`OpsHandelsePanel moduler grupp`** och **`OpsAppShell skapa.moduler skapa.aktivGrupp`**. Ytan ritar bara tillägg från moduler som är påslagna i `grupp.moduler`; en avslagen moduls komponent anropas inte. `skapa.aktivGrupp.id` måste vara `skapa.lage`, annars kastar skalet.
- **`tillaggFor`, `synsPa`, `synsPaText`, `PLATSER`, `PLATSYTOR`** för den som bygger en egen yta eller en egen lista.
- **"Syns på" i gruppens inställningar.** Listan Appar i `OpsGruppFormular` visar alla appar, också de utan egen yta, och varje rad säger var appen syns: "Egen yta", ytornas namn ("Händelser"), eller båda. Härlett ur manifestet, aldrig ett handskrivet fält.
- **`defineModule` avvisar ett tillägg vars `komponent` inte är en funktion eller ett objekt** (PR 258). Före detta stoppade kontrollen bara `undefined` och `null`, så en sträng eller ett tal klarade uppstarten och föll först när ytan försökte rita det. Objekt släpps in, eftersom React memo och forwardRef ger objekt. Felet nämner modul, fält och skäl.

#### Ändrat

- **`valbaraModuler` ger alla registrerade moduler**, inte bara de med ett kort. En modul med bara tillägg går nu att slå på och av per grupp. `hubbForGrupp` räknar inte en sådan modul som `inget-kort`.

#### Valideras vid uppstart

- `validateModuler` avvisar ett tillägg med okänd plats, ett dubblerat `id` inom modulen, en etikett som saknar ett språk, och ett tillägg utan komponent. Felet bär modulens namn och fältet.

### Agenten är medlem (cllp/lifehub.app#47, #256)

#### Tillagt

- **Gruppens agent är medlem** (cllp/lifehub.app#47, skiva 1 och 2, ramverkets del). `agentId(groupId)` ger det stabila id:t `agent_<groupId>`, `agentMedlemskap(groupId)` raden (typ `agent`, roll `medlem`, status `aktiv`, namnet `AGENT_NAMN`, "Agent").
- **`createGroupService({ agent: true })`** skriver agentens medlemskap i samma batch som gruppen och ägaren. Förval `false`.
- **`createAgentService`** på nodsidan: `satStatus` (ägaren slår av och på agenten, aldrig ta bort) och `sakerstall` för engångssteget som ger befintliga grupper sin agent (idempotent, torrt skriver inget).
- **Nodsidan exporterar också `AGENT_NAMN`, `agentId`, `agentMedlemskap`, `byggMeddelande`, `samtalsnyckel` och `MAX_MEDDELANDE`**, för servern som svarar som agenten.
- **Statusen `avstangd`** i `MEDLEMSSTATUS`, bara för en agent. `byggMedlemskap` avvisar en person med den.
- **`medlemsinfo(...).agenter`**, och **`OpsGruppSida agenter onVaxlaAgent onSkrivTillAgent`**: agenten i medlemslistan med märket AI, ägarens strömbrytare, och "Skriv till" för ett privat samtal.
- **`OpsMedlemmar aiEtikett`**: en agents rad har märket AI och varken rollväljare eller Ta bort.
- **`OpsNyttMeddelande privatAgentText`**.

#### Ändrat

- **`OpsMottagare lage="person"` och "Nytt meddelande" har den aktiva agenten bland mottagarna**, och vald öppnas ett samtal av slaget `agent`. Före 0.60.0 stod den bara med i ärendeläget.
- **`medlemsinfo(...).medlemmar`, `avatarer` och `medlemsantal` räknar inte en agent.** Före 0.60.0 räknades en aktiv agent som en medlem bland personerna. Den står nu i `agenter`.

## 0.59.1

### Ändrat

- **Större ikoner i toppraden och bottenraden, och en högre bottenrad.** CP 2026-10-05 i cllp/bolag-ops#563: "Ikonerna i huvudmenyerna botten och toppen är lite väl små. Svårt att träffa dom med fingret" och "se till att bottensektionen blir några pixlar högre så ikonerna inte kommer så långt i nederkant." Bottenradens ikoner 20 → 24 px och raden 56 → 64 px (`--bottom-nav-h` 4rem). Toppradens ikoner på telefon 20 → 24 px, i samma 36 px cirkel med samma 44 px träffyta. På dator står 20 px kvar (CP: "563 är bara i mobil"). Den stora plusknappen lyfts 16 px i stället för 12, så att den sticker upp exakt lika mycket över raden som förut och `--bottom-nav-overhang` fortfarande stämmer. `check-skalyta` mäter de nya måtten.

## 0.59.0

### Tillagt

- **`createGroupService({ vitlistaKravs })`.** Förval `true`: vitlistan krävs som förut, och `forstaGruppenFri` betyder fortfarande bara den första egna gruppen. `false`: `skapaGrupp` läser inte vitlistan och kräver inte e-post, varken för den första gruppen eller för de följande. Samlingen, reglerna och `byggVitlisterad` står kvar. Appen slår av kravet tills betalning finns, och slår på det igen utan att funktionen tas bort.

## 0.58.0

### Rättat

- **Gruppväljarens ark på telefon går att se hela vägen ned.** CP 2026-10-04, i lifehub-my inuti identity: sista gruppraden (PHST) klipptes av hemindikatorn. `env(safe-area-inset-bottom)` är 0 i den iframen även med `viewport-fit=cover`, så `pb-(--safe-bottom)` gjorde ingenting. Arkets padding är nu `--safe-bottom-ark`, `max(env(...), 34px)`. Listan rullar i arket, och sista raden går att rulla fram ovanför kanten.

### Tillagt

- **Ägare och admin kan redigera gruppen från växlarens ark.** Samma `onRedigera` som pennan i `OpsGruppanel` (och `skapa.redigeraGrupp` när skalet har den). Medlem, och en rad utan roll, får ingen penna. Ingen "Skapa grupp" i arket, det tog 0.37.0 bort.

## 0.57.0

### Tillagt

- **TALK: långtryck på plusset spelar in** (cllp/lifehub.app#2). CP 2026-10-04: medan man håller inne står det bara
  en sak, TALK, och ett fält kommer fram så att man släpper och pratar vidare. `OpsAppShell talk={{ onTalk,
  onInstallningar?, marke? }}`. Ett vanligt tryck är Skapa som förut. Mikrofonen skickar, det röda krysset kastar,
  handtaget fäller ned fältet till en pill, kugghjulet ritas bara med `onInstallningar`. Ljudet lämnas till appen i
  `onTalk(blob, { mimeType, sekunder })`, och vad det blir vet bara appen.
- **Raden "TALK, prata in" först i Skapa**, i både huvudets och bottenradens plus. Den går rakt till fältet, så TALK
  går att nå på en dator där bottenraden inte finns.
- **`useTalk`, `OpsTalk`** och de rena delarna i `src/lib/talk.js` (`talkNasta`, `valjFormat`, `talkFeltext`,
  `webblasarensInspelare`, `LANGTRYCK_MS`, `TALK_ORD`, `MAX_SEKUNDER`, `LJUDFORMAT`) för den som bygger en egen rad.
  `OpsBottomNav` tar `primaryAction.talk`.
- **check-skalyta avsnitt 39**: hållet mäts med mus ned och upp i Chromium vid 390 px, fältet öppnas ur Skapa vid
  1280 px. Fältet ska stå inom skärmen och ovanför bottenraden, knapparna minst 44 px, och appen ska få ljudet.

### Ändrat

- **Kalenderns långtryck läser `LANGTRYCK_MS`** i stället för ett eget 450. En siffra, ett hem.
## 0.56.0

### Tillagt

- **Modulens provsats** (cllp/ops-framework#244, klarkriteriet "en mall och en provsats som en agent kör").
  `scripts/prova-modul.mjs <fil> --grupp <groupId>` och `provaModul(manifest, { groupId })`, med `provrapport(svar)`.
  - Manifestet provas med `validateModuler`, och varje källa genom `skapaKallregister`, alltså samma vägar som appen.
  - Händelser, sök och notiser frågas också för en grupp modulen inte har data för, och ska då ge noll rader.
  - Varje steg skrivs ut, också de godkända och de tomma. Kommandot avslutas med 1 när ett steg faller.
  - Exempelmodulen går igenom alla 16 steg.

## 0.55.0

### Tillagt

- **Ytan `aktivitet` i modulernas typbidrag** (cllp/ops-framework#244, beslut A). CP 2026-10-04: körningar hamnar i
  aktivitetsflödet, märkta med appen. En modul bidrar med aktivitetsslag i `defineModule({ typer: { aktivitet: [...] } })`,
  med värdet `modul:id` (`ekonomi:synk`), på samma sätt som med typer till Inkorgen och kalendern. `typerForGrupp`,
  `typenForRad`, `typmarke`, ägarens avvikelser och regelfragmentet gäller ytan utan särfall, eftersom alla läser
  `TYPYTOR`.
- **`kindMarke` på `OpsActivityList` och `OpsActivityButton`.** Märket för en moduls slag, «från Ekonomi», ritas på raden
  efter slagets ord och i detaljen ("Banksynk, från Ekonomi"). Appen härleder det med
  `typmarke(typenForRad(slag, "aktivitet", ctx))`. Utan propen ritas inget märke, som förut.

### Rättat

- **`frysTyper` räknade upp ytorna för hand.** Den byggda modulen tappade varje yta som lades till i `TYPYTOR`. Nu
  härleds den ur listan.

### Regler

- `typavvikelser[].yta` tillåter `aktivitet`. En app som döljer ett aktivitetsslag behöver de nya reglerna deployade
  först.
## 0.54.0

### Tillagt

- **Appfiltret i `OpsCalendar`** (cllp/ops-framework#244, beslut B och C). CP 2026-10-04: "Om man har många appar i en
  grupp. Hur skall det då funka?"
  - En rad med en knapp per app under verktygsraden: **Gruppens egna** och varje modul vars typer eller poster finns i
    kalendern. Ett tryck döljer appens poster, ett till visar dem. Allt är synligt från början.
  - Appen läses ut ur typens prefix (`ekonomi:kvitto` hör till Ekonomi). Inget nytt fält på posten. En post utan typ
    hör till Gruppens egna.
  - Typlistan i "Typ och status" visar bara de synliga apparnas typer. En vald typ vars app döljs släpps till Alla.
  - Raden finns bara med minst två appar. Så många som ryms står i den, högst fyra, och resten under **Fler (n)**, med
    en prick när något bland dem är dolt. Raden mäter sin bredd och rullar aldrig i sidled. **Visa alla** finns när
    något är dolt.
  - Nya props: `filterMinne` (vanligen gruppens id) gör valet personligt och sparat per grupp. Utan den gäller valet
    bara den visningen. `typer[].modulNamn` blir appens namn i raden.
- **`EGNA_APPEN`, `appForTyp` och `apparFor`** exporteras för appar som vill rita samma indelning någon annanstans.

## 0.53.0

### Tillagt

- **`OpsProfil` i kontoläget** (cllp/lifehub.app#32). `konto={{ href }}` säger att personen ägs av ett konto utanför
  appen, som LifeHubs Mitt konto. CP 2026-10-04: "Vi behöver fixa min profil så att man kommer till sitt
  användarkonto och ställer in allt där."
  - Personen ritas skrivskyddad: bild, namn, e-post och rollen, och en länk **Ändra i Mitt konto**.
  - Inga fält, inga ikon- eller färgval, inget språk och ingen Spara. `onSpara` anropas aldrig.
  - Grupperna och appens egna sektioner (`children`) står kvar.
  - Utan `konto` är vyn som förut.
- **`regelfragment(namn, { kontoAgerPersonen: true })`.** Då får klienten bara ändra `tema` i sin egen `users`-rad och
  aldrig skapa den: raden är en spegel som appens server skriver ur kontot. Utan valet är fragmentet byte för byte
  som förut.
- **`byggAnvandare`, `PROFILIKONER`, `PROFILFARGER` och `MAX_PRESENTATION` på nodsidan.** Kontot som äger personen och
  appen som speglar den prövar den med samma byggare som klienten.

### Rättat

- **Kalenderns dagpanel växer med sitt innehåll i telefonen.** CP 2026-10-04, med en skärmbild: "När datum bubblorna i
  kalendern blir två rader så får det inte plats i den allokerade rutan." Taket var 45 procent av ytan, och med tre valda
  dagar bröt pillren rad och panelen fick en egen rullning som klippte postbubblan. Taket är nu 75 procent
  (`DAGPANEL_TAK`), och under det är panelen så hög som sitt innehåll. `check-skalyta` mäter det vid 390 px med tre
  valda dagar: med rättningen 310 px innehåll i 310 px, utan den 310 i 294.

## 0.52.0

### Tillagt

- **Hubbar i skalet** (cllp/lifehub.app#27). `OpsAppShell` tar `hubbar`: instanserna personen får öppna, som
  `{ aktiv, lista: [{ id, namn, href }], allaHref }`. CP 2026-10-04: "Var går jag ut och väljer fler hubbar", och om
  mobilen: "där är det precis på samma plats som man switchar grupper, inte hubbar."
  - **Mobil (under `lg`):** gruppväxlarens ark börjar med hubbarna, och grupperna står under rubriken
    "Grupper i <hubb>". En knapp, två nivåer.
  - **Dator (från `lg`):** märket heter den aktiva hubben, och en chevron bredvid öppnar samma lista.
  - Den aktiva hubben är ingen länk. En annan hubb är en länk till appens `href`, och ramverket vet inte vart.
  - En lista utan den aktiva hubben, en tom lista eller en hubb utan `href` stoppas med skälet.
- `OpsHubblista` exporteras för en app som vill rita listan någon annanstans.

## 0.51.0

### Den första egna gruppen, och apparna en ny grupp börjar med (cllp/lifehub.app#21)

CP 2026-10-04: "Saknar man grupp ska man kunna skapa en egen, och den fungerar som en vanlig grupp. Första gruppen är
gratis, utan prenumeration och utan paywall. Default-namnet är Mitt projekt." Med vitlistan som enda grind kunde en
privatperson logga in och sedan inte göra något: hen stod inte på listan, och ingen grupp väntade.

**Tillagt, och förvalet är oförändrat beteende:**

| Var | Vad | Förval |
|---|---|---|
| `createGroupService({ forstaGruppenFri })` | Den som aldrig ägt en grupp skapar en utan vitlista och utan e-post. Grupp nummer två går genom vitlistan som förut. Ett avslutat ägarskap räknas | `false` |
| `createGroupService({ moduler })` | Apparna (modul-id) en ny grupp börjar med. Prövas med `byggGrupp` när tjänsten byggs | `[]` |
| `OpsUtanMedlemskap namnForval` | Namnet fältet börjar med, som ett värde och inte en platshållare: knappen går att trycka direkt, och namnet går att byta först | tomt |

⛔ **`skapadAv.namn` på gruppen** tar nu inloggningens namn (`namn`) före e-posten när profilraden saknar namn, samma
ordning som ägarens medlemskap redan hade (0.40.1, #218). Utan e-post hade fältet annars blivit tomt.

**Prov, båda riktningarna:** 6 av de nya proven i `grupp-skapa.test.js` och 1 i `utanMedlemskap.test.jsx` var röda mot
0.50.0 och är gröna nu. Motproven (utan valet nekas samma person, den andra gruppen kräver vitlistan, ett avslutat
ägarskap räknas) är gröna i båda, och det är meningen: de mäter att dörren INTE står öppen.

---

## 0.50.0

### Hub heter Appar (CP 2026-10-03)

CP: "Hub i app-instansen skall byta namn till appar. Moduler som vi kallar det idag är egentligen appar som man
installerar." Ordet "hub" betydde dessutom två saker: instansen på identity ("Dina hubbar", "Öppna hub") och listan
med moduler inne i instansen. Nu betyder det bara det första.

**Vad som syns ändrat:**

| Var | Förut | Nu |
|---|---|---|
| Den fasta posten i toppraden och bottenraden (`FASTA_NAMN.hub`) | Hub / Hub | Appar / Apps |
| Tillbaka-raden (`OpsHubTillbaka`, `OpsModulSida`, `OpsHubModul`, förval `hubEtikett`) | Tillbaka till Hub | Tillbaka till Appar |
| `OpsGruppHubb`, tomt och saknade | "Inga moduler i gruppen", "Modulen ... visas inte" | "Inga appar i gruppen", "Appen ... visas inte" |
| `OpsHub`, förval | "Moduler", "Inga moduler än" | "Appar", "Inga appar än" |
| `OpsGruppFormular`, valet | "Moduler", "Varje vald modul blir ett kort i gruppens hubb" | "Appar", "Varje installerad app blir ett kort under Appar" |
| `OpsOversikt`, tomt | "Inga moduler är påslagna" | "Inga appar är installerade" |

**Vad som INTE ändras, med flit:** API:t. Nyckeln `fasta.hub`, komponentnamnen (`OpsHub`, `OpsGruppHubb`,
`OpsHubTillbaka`), manifestets `hubb` och gruppens fält `moduler` står kvar. De är mekanik, och ett namnbyte i dem är
ett eget arbete i varje app och en datamigrering av `groups.moduler`. En app som skickar egna etiketter
(`hubEtikett`, `ariaLabel`) får dem som förut.

**Prov:** 10 befintliga prov i `hubb`, `hubsida`, `skal030`, `skal031` och `ytorna` väntade på de gamla orden och
väntar nu på de nya. Med "Hub" tillbaka i `FASTA_NAMN` blir `skal030` rött.

---

## 0.49.2

### bolag-ops#535: bekräftelserutan tog in bakgrundstext

CP 2026-10-02 (inkorgsbild): toasten "Det ligger i inkorgen" läste in sidans
text rakt genom den gröna rutan. Orsak: `bg-success-bg` (och motsvarande
danger/info) är 10–14 % opacitet — rätt tint för piller/banderoller *inuti*
en yta, fel för en portal-toast *över* sidan. Samma klass av fel som
sticky-cellerna i `OpsTable`.

**Nu:** `OpsToast` använder `bg-elevated` (opak yta för det som ligger över
kortet). Tonen bärs av kant + rubrikfärg. Inga tokens ändrade; `OpsBanner`/
`OpsPill` oförändrade.

**Prov, båda riktningarna:** 2 nya i `toast-opak.test.jsx`.

| Mutation | Röda |
|---|---|
| `bg-success-bg` tillbaka | 1 |
| danger/info kvar på `*-bg` | 1 |

---

## 0.49.1

⛔ **Datumpillren i kalenderns dagpanel wrappas utan att klämmas ihop (bolag-ops#556). Inga regler ändras.**

### bolag-ops#556: "bubblorna får inte plats när man väljer flera här"
CP 2026-10-02, med skärmbild: tre valda dagar gav överlappande datumpiller där text och kryss låg ovanpå varandra.

**Orsak:** pillren och stängkrysset delade en `flex-wrap`-rad där stängkrysset hade `ml-auto`. Utan `shrink-0` klämdes pillren ihop i stället för att bryta rad, och de absolutplacerade kryssen (SS `DayDetailPanel`, top/right −8) landade på grannen.

**Nu:**
- Pillren wrappas i en egen behållare (`data-datumpiller-rad`); stängkrysset står fast till höger.
- Varje piller har `shrink-0` och marginal för kryssets utstick (`data-datumpiller`).
- `pt-3.5` ger plats för krysset ovanför första raden.

**Prov, båda riktningarna:** 1 nytt i `calendar.test.jsx` (strukturen och `shrink-0`; rött om pillren läggs tillbaka i samma rad som stängkrysset eller får krympa). Chromium: `check-skalyta` avsnitt 30 (g) mäter att tre piller efter dra-markering inte överlappar och inte är smalare än 72 px.

## 0.49.0

⛔ **Två tillägg som skulle ha följt med 0.48.0 och inte gjorde det: `href` på `OpsKommentarsrad` och `ordet` som export. Inga regler ändras.**

### Varför de inte kom med i 0.48.0
De pushades till PR 235 efter att den visat MERGA NU men innan svaret om mergen hunnit fram, och mergen tog det som stod då. Två commits stod alltså kvar på grenen utan att finnas i main eller i 0.48.0. Felet var avsändarens: en push till en PR som redan bär MERGA NU ska till en ny gren, och det står redan i bolag-ops `CLAUDE.md`.

### Nu
- **`OpsKommentarsrad` tar `href`**, som `OpsSvarsrad`: raden blir en länk till händelsen (`handelseHref(id)`), och skalet öppnar panelen. `onOppna` finns kvar: utan `href` öppnar den händelsen, och MED `href` anropas den vid klicket före navigeringen (t.ex. för att markera raden läst direkt). En av de två krävs. Utan `href` behöver appen `useOppnaHandelse`, som kastar utanför skalet, och då går Inkorgen inte att rita i ett prov utan skal: bolag-ops #551 gjorde så, och 43 av webbens prov blev röda.
- **Inne i skalet öppnar raden panelen utan omladdning.** Med `href` till `?handelse=<id>` och ett skal med `handelsepanel` tar raden klicket själv och öppnar panelen som `useOppnaHandelse` gör, så att Inkorgen ligger kvar under den. Utanför skalet, och med Cmd, Ctrl eller Shift, är den en vanlig länk.
- **`ordet(ordbok, nyckel, sprak)` exporteras**, så att appens vyer slår upp sina ord på samma sätt som ramverkets komponenter i stället för med ett eget uppslag (regel 2).

**Prov, båda riktningarna:** 3 nya i `kommentarer.test.jsx`: panelen öppnas i skalet utan omladdning och länken följs med Cmd (rött när skalgrenen tas bort), raden som länk och att den kastar utan både `href` och `onOppna` (rött när länkgrenen tas bort), och `onOppna` anropat vid klicket på länken (rött när `onClick` tas bort från länken). Inga befintliga prov ändrade. `ordet` har redan sina prov i `sprak.test.jsx`.

## 0.48.0

⛔ **Kommentarer på en händelse (#232, beslut 0002), med Inkorgens rad. REGLERNA ÄNDRAS: `handelseregelfragment()` får två nya block. Appen skriver om sitt regelfragment, DEPLOYAR REGLERNA FÖRST, och mergar sedan klienten som läser och skriver tråden.**

### #232: CP 2026-10-02, "Ja och ja"
På frågorna i beslut 0002: den som skrev en kommentar får ta bort den, och en ny kommentar syns i Inkorgen.

**Nu:**
- **Modellen** (`handelsemodell.js`): `byggKommentar`, exakt `{ text, skapad, skapadAv }`, 1 till 5 000 tecken (`MAX_HANDELSEKOMMENTAR`, samma tak som inkorgens kommentarer i bolag-ops). Tom text, text över taket och en skapare utan uid kastar med ett fel som säger vad, i stället för databasens "Missing or insufficient permissions".
- **Inkorgens rad, härledd:** `kommentarsrader({ handelser, kommentarer, lastTill, uid })`. En rad per händelse där någon annan skrivit efter mitt läsmärke. Märket ligger i `<händelser>/{hid}/<läsmärken>/{uid}` och flyttas när händelsen öppnas. Ingen notis skrivs till någon.
- **Källan:** `createKommentarkalla` med `lista`, `prenumerera`, `skriv`, `taBort`, `lastTill`, `markeraLast`.
- **Gränssnittet:** `OpsKommentarer` (tråden), `OpsKommentarsrad` (inkorgens rad) och slotten `kommentarer` i `OpsHandelsePanel`. Svenska och engelska från början, så `check-sprak`s tak står kvar.
- **Reglerna** (`handelseregelfragment`, nya namn `kommentarer` och `lasmarken`, förval just så): kommentarer läses av medlemmar, skrivs av en medlem i eget namn, ändras aldrig, raderas bara av den som skrev dem. Läsmärken läses och skrivs bara av personen själv. Två undersamlingar med samma namn kastar.

⛔ **Priset för Inkorgens rad** (förslaget var nej, CP valde ja): en läsning av tråden och en av märket per händelse i appens fönster. Det står i beslut 0002.

### Att göra i appen
1. Ompinning och `check-regelfragment --skriv` (fragmentet får två nya block).
2. **Regeldeploy** av de nya blocken.
3. Först därefter: klienten (tråden i panelen, `markeraLast` när panelen öppnas, raderna i Inkorgen).

**Prov, båda riktningarna:** 21 nya i `kommentarer.test.jsx`, 14 nya regelprov i emulatorn (`rules/__tests__/handelsekommentarer.test.mjs`). Inga befintliga prov ändrade.

| Mutation | Röda |
|---|---|
| Egna kommentarer ger en rad | 3 |
| Läsmärket ignoreras | 1 |
| Inget tak i modellen | 1 |
| "Ta bort" på allas rader | 2 |
| Tråden oordnad | 1 |
| `taBort` utan ägarkoll | 1 |
| Rutan töms före skrivningen (texten försvinner vid fel) | 1 |
| Panelen ritar inte tråden | 1 |
| Läsfel ritas som tom tråd | 1 |
| Regel: skriva i någon annans namn | 1 |
| Regel: vem som helst raderar | 1 |
| Regel: ändring tillåten | 1 |
| Regel: inget tak | 1 |
| Regel: läsmärken läses av alla | 1 |
| Regel: kommentarer utan medlemskap | 1 |

## 0.47.0

⛔ **Kräv svar från början för en typ som appen pekar ut (bolag-ops#538), och beslutet om kommentarer och flera bilagor på en händelse (#232). Inga regler ändras. Appen pinnar om och skickar `kravSvarFor`.**

### bolag-ops#538: Sammankomst ber om svar utan att någon måste minnas det
CP 2026-10-02: en ny händelsetyp, Sammankomst, där "Kräv svar" är på som förval. Typerna är appens katalog och brytaren är skalets, så policyn kan bara ligga i appen och verkställas i skalet.

**Nu:** `skapa.handelse.kravSvarFor?: (typ) => boolean`. Så länge ingen rört "Kräv svar" står brytaren som policyn säger för den valda typen och följer typvalet. När någon slagit om den gäller deras val, också om typen byts. I redigeringsläge gäller händelsens eget värde, aldrig policyn: en händelse som sparats utan svar ska inte börja be om svar för att någon öppnat den. Utan `kravSvarFor` är allt som förut.

**Prov, båda riktningarna:** 4 nya prov (3 i `kalenderhantering.test.jsx`, 1 i `handelseredigering.test.jsx`). Inga befintliga prov ändrade.

| Mutation | Röda |
|---|---|
| Policyn läses inte | 2 |
| Policyn vinner över ett eget val | 2 |
| Brytaren nollställs till av i stället för orörd vid öppning | 2 |
| Redigeringsläget lämnar ett avslaget värde orört, så att policyn tar över | 1 |

### #232: beslut 0002, kommentarer och flera bilagor
`docs/beslut/0002-kommentarer-och-flera-bilagor-pa-handelse.md`. Flera bilagor går via Storage och Bibliotek (#192), inte som en lista av data-URL i dokumentet, och väntar därför på #192. Kommentarer blir en undersamling `<händelser>/{id}/kommentarer/{id}` med regler i ramverkets handelsefragment, en slot i `OpsHandelsePanel` och en primitiv `OpsKommentarer`. Två öppna frågor till CP står i dokumentet. Ingen kod för kommentarerna i den här versionen.

## 0.46.0

⛔ **Språket ur profilen (bolag-ops#528) och gruppens externa datakällor på nodsidan (bolag-ops#512). Inga regler ändras. Appen pinnar om och lägger `<OpsSprakProvider sprak={profil.sprak}>` runt sig.**

### bolag-ops#528: "byta språk i profil byter inte språk"
CP 2026-10-01: "Har noterat att byta språk i profil inte byter språk. Se till att allt är språkhanterat, svenska engelska." Mätt: profilen sparade valet i `users/{uid}.sprak` och ingenting läste det. Varje komponent hade sina etiketter som svenska förval i parameterlistan, och de som tog ett språk hade `sprak = "sv"`.

**Nu:**
- `OpsSprakProvider` och `useOpsSprak`: appen sätter språket en gång. Komponenter utan eget `sprak` läser det därifrån.
- En ordbok per komponent (`src/lib/ord.js`, `ORD_*`) för sex komponenter: skalet, bottenraden, händelsepanelen, profilen (även språkens namn), händelselistan och skapa-panelen. 65 texter på svenska och engelska. Komponentens svenska förval pekar på ordboken, så svenskan står på ett ställe.
- Skalets egna texter (laddningslägen, "Kräv svar", "Blockerar tillgänglighet", menyknappens namn) i en egen ordbok, `TEXT_SKAL`, via `ordet()`.
- Nio komponenter till läser `sprak` ur providern.
- Appens egna etiketter vinner alltid. Utan provider är allt som förut.

**Vakt:** `check-sprak` räknar svenska förval i komponenternas parametrar (namn som slutar på Label, Etikett, Text, Rubrik, Titel, Beskrivning). 183 före, 118 efter. Taket är 118 och **får bara sjunka**: över taket är rött, och under taket är också rött tills taket sänks i samma PR.

### bolag-ops#512: externa datakällor på nodsidan
`byggExternaDatakallor` och `MAX_EXTERNA` exporteras från `@staiger/ops-framework/node` (18 ms att importera, mot cirka två sekunder för hela paketet), så att appens funktion kan skicka ett ärende till gruppens kopplade repo med samma byggare som klienten och reglerna.

**Två befintliga prov ändrade (regel 9):** `skal030.test.jsx` ritade skalet med `sprak: "en"` och väntade sig de svenska namnen "Huvudnavigering" och "Meny, fler åtgärder". De väntar sig nu "Main navigation" och "Menu, more actions": det gamla provet bekräftade precis den språkblandning ärendet handlar om.

**Prov, båda riktningarna:** 11 nya prov i `sprak.test.jsx`.

| Mutation | Röda |
|---|---|
| Kontexten läses inte | 3 |
| Ordboken skriver över appens etikett | 1 |
| Appens `sprak` ignoreras | 1 |
| Språkens namn följer inte språket | 1 |
| Ett okänt språk tigs | 1 |
| Nodsidan saknar byggaren | 1 |
| `check-sprak`: en komponent tillbaka till svenska förval | röd (129 över taket 118) |
| `check-sprak`: taket 120 över mätvärdet 118 | röd (sänk taket) |

## 0.45.0

⛔ **Tre saker: ett felmärke på ikonlänken så att en räknare som inte kunde läsas inte ser ut som noll (bolag-ops#150), bilagan i händelsepanelen (#221), och ett designbeslut om vems AI-nyckel och vems räkning (#185). Inga regler ändras. Appen pinnar om och skickar `badgeFel` och `bilaga`; bilagans regler är appens (bolag-ops#519).**

### bolag-ops#150: "Inkorgsräknaren visar noll både när allt är klart och när läsningen misslyckats"
En räknare som inte kunde läsas ritade inget märke, och inget märke är vad den ritar när inget väntar. **Nu:** `OpsIconLink` tar `badgeFel` (orden, t.ex. "kunde inte läsas") och ritar `OpsFelBadge`: samma storlek som räknaren men ihåligt, utropstecken och ring i `danger`, aldrig en siffra. Orden läses upp och står i tooltipen. Felet går före ett antal. `OpsFelBadge` exporteras för appens egna räknare.

### #221: bilaga på en händelse
CP 2026-10-01: bilder och dokument på händelser, som på ärenden, utan Bibliotek. **Nu:** `handelse.bilaga` i `OpsHandelsePanel`, i samma form som `OpsFilePicker` ger. En bild visas (och öppnas i full storlek), annat är en nedladdningslänk med namn och storlek. En bilaga utan `dataUrl` kastar. Formuläret och lagringen är appens.

### #185: beslut 0001, vems AI, vems nyckel, vems räkning
`docs/beslut/0001-ai-nyckel-och-kostnad.md`: fem lägen (`av` förvalt, `mock`, `plattform`, `byok`, `agent`), upplösningen grupp före app enligt `groupPolicy` med `own_only` som förval, nyckeln bara som Secret Manager-hänvisning, och minsta API-yta i fyra steg. Ingen kod för AI i den här versionen.

**Prov, båda riktningarna:** 10 nya prov.

| Mutation | Röda |
|---|---|
| Felmärket ritas inte (`badgeFel` ignoreras) | 2 |
| Antalet går före felet | 1 |
| En nolla i stället för utropstecknet | 1 |
| Bilagan ritas inte | 3 |
| En bild visas som länk | 1 |
| En bilaga utan `dataUrl` släpps tyst | 1 |
| Dokumentets länk utan `download` | 1 |

## 0.44.0

⛔ **Två rättelser som CP rapporterade från inkorgen 2026-10-01: Spara stod kvar efter ett sparat ärende (bolag-ops#508), och inställningarnas kataloger saknade rubriker (bolag-ops#507). Appen måste pinna om och anropa `onKlar` i sitt ärendeformulär. Inga regler ändras.**

### bolag-ops#508: "Spara knappen kvar när man sparat ett ärende"
CP: "Spara knappen måste bort efter att man skapat ärende. Men vet inte om det är sparat."

**Rotorsaken var i skalet.** `skapa.grupp`, `skapa.meddelande` och modulernas formulär fick en `onKlar` som stänger panelen, men `skapa.arende` fick bara `{ formId, mal }`. Formuläret kunde visa sitt kvitto men inte stänga panelen, och skalets fasta Spara stod kvar under kvittot och pekade på ett `<form>` som inte fanns längre: ett tryck gjorde ingenting, och ingenting sade om posten var sparad. **Nu:** `({ formId, mal, onKlar }) => nod`, och `onKlar` stänger panelen utan att gå bakåt i historiken, som för en grupp.

### bolag-ops#507: "Inställningar skall vara per grupp ... samt att det är en rubrik på varje sektion"
Katalogerna ÄR redan per grupp i datan sedan 0.33.0 (`groupId` krävs i `OpsKatalogInstallning`). Det som fattades var att det syntes: `rubrik` var bara listans namn för skärmläsaren, så fyra kataloger stod efter varandra utan rubriker, medan kortet från modulerna (`OpsModulTyper`) hade en. **Nu** ritar `OpsKatalogInstallning` `rubrik` som en synlig rubrik på nivå 2 och bär den som sektionens namn, och `OpsModulTyper`s rubrik är också nivå 2 (var 3): två kort på samma sida med olika nivå hade gett skärmläsarens rubriklista en ordning som inte syns. Att sidan säger VILKEN grupp inställningarna gäller är appens: den känner gruppens namn.

**Prov, båda riktningarna:** 4 nya prov.

| Mutation | Röda |
|---|---|
| Katalogen utan synlig rubrik | 2 |
| Katalogens rubrik på nivå 3 | 2 |
| `OpsModulTyper`s rubrik tillbaka på nivå 3 | 1 |
| `onKlar` för ärendet gör ingenting | 1 |

## 0.43.0

⛔ **Händelsens ursprung: vem skapade den och var den hör hemma, i listan och i händelsepanelen, med en länk tillbaka till modulens post (#224). En agents rad märks med en robot. Appen måste pinna om och lägga `ursprung` på sina händelser; inga regler ändras utöver en rättad stavning i en kommentar.**

### #224: "händelsens ursprung"
Händelsen: CP 2026-10-01, med en skärmbild av Nytt ärende: "Vidare är det ju bra om man kan se var vissa händelser hade sitt ursprung. Om det är från en modul t ex. Vem skapade händelsen och var hör den hemma." Svaren på ärendets tre frågor (CP samma kväll): ursprunget syns i listan OCH i panelen, med en länk tillbaka till posten, och fråga 3 (agentens märke) "går på rekommendation".

**API:**
- `typensUrsprung(typ, sprak?)`: modulen ur typen (`typenForRad`), `{ modul }` eller `null` för en egen kategori. En modul som är av eller borta ger `"Ekonomi, arkiverad modul"`.
- `ursprung: { modul, url?, urlEtikett? }` på en rad i `OpsEventList` och på `handelse` i `OpsHandelsePanel`, som också tar `skapadAv` och `skapad`. Nya etiketter `iModulEtikett` ("i") och `franModulEtikett` ("Från"), och `onNavigate` på panelen för länken.

#### Besluten, och varför
- **Inget eget fält i datan.** Typen `ekonomi:kvitto` säger redan att händelsen kom från Ekonomi. Ett fält `ursprungsmodul` hade varit en andra kopia av samma faktum (arbetsreglernas punkt 2). Appen härleder det med `typensUrsprung` när den ritar. Länken tillbaka är däremot appens: bara appen vet var kvittot bor.
- **En komponent för raden** (`Ursprungsrad`), som både listan och panelen ritar. Två ritningar av samma rad hade sagt olika saker efter första ändringen.
- **Agentens robot är också en rättelse.** Före 0.43.0 ersatte namnet ordet "Agent" i `OpsProvenance`, så "Skapad av ops-agent" skiljde sig från en människas rad bara i färgen: precis felet komponentens filhuvud förbjuder. Nu bär en agent `AgentIkon` (Lucide `Bot`), och ordet läses upp för skärmläsaren även när `label` ersätter det synliga. Det gäller överallt där `OpsProvenance` ritas.
- **Ett ursprung som inte går att rita kastar**: tomt `modul`, tom `url`, okända fält. En rad som säger "Från" och inget mer är sämre än ingen rad.

**Prov, båda riktningarna (`src/__tests__/ursprung.test.jsx`, 14 prov):**

| Mutation | Röda prov |
|---|---|
| Utan agentens robot | 3 |
| Utan ordet för skärmläsaren | 3 |
| Ursprunget ignoreras när skaparen saknas | 2 |
| Panelen utan raden | 2 |
| Utan kontrollen av ursprunget | 2 |
| «arkiverad modul» tappas | 1 |
| Länken anropar inte `onNavigate` | 1 |

Rättat i förbigående: "döljt" till "dolt" i en regelkommentar från 0.42.1 (ingen ändring av regeln).

## 0.42.1

⛔ **Rättelse av regelbudgeten för gruppens två listor (#223). En ägare som dolt eller döpt om sex typer kunde inte längre koppla en enda extern datakälla, och `MAX_EXTERNA = 10` lovade fler poster än regeln klarar. Appen måste pinna om, regenerera sitt regelfragment, och CP måste deploya reglerna. Ingen ändring i klientens API utöver att taket sjunker från 10 till 5.**

### #223: "Taket MAX_EXTERNA = 10 håller inte"
Händelsen: mätt 2026-10-01 under #217. Taket för `externaDatakallor` var tio och provades bara med minimala poster. Ärendet bad om att sätta taket med marginal under det mätta talet. Mätningen visade att det inte räcker, och vad som faktiskt var fel.

**Mätt i emulatorn, poster med både `label` och `credentialSecretId` (den dyraste formen; strängarnas längd spelar ingen roll, antalet poster med de valfria fälten gör det):**

| Fall | Går igenom | Spräcker budgeten |
|---|---|---|
| `externaDatakallor` ensam, uppdatering | 6 | 7 |
| Samma, med alla andra fält på gruppen ändrade samtidigt | 6 | 7 |
| `externaDatakallor` ensam, ny grupp | 7 | (8 provades inte, taket var 7 i loopen) |
| **Sex typavvikelser LAGRADE, skriv `externaDatakallor`** (0.42.0) | **0** | **1** |
| Båda listorna i samma uppdatering, sex typavvikelser | 0 | 1 |
| Båda listorna på en ny grupp, sex typavvikelser | 1 | 2 |

**Ändringarna i `regelfragment()`:**
- **`typavvikelser` valideras bara när den ändras**, som `externaDatakallor` sedan 0.42.0. ⛔ 0.42.0:s ändringslogg säger att den valideras alltid för att den är "billig nog att få plats", och att mutationen utan avgränsningen inte gick att slå röd. Det mättes mot minimala externa poster. Mot den dyraste formen är det fel: sex lagrade avvikelser och en extern datakälla spräckte budgeten. Raden ovan i 0.42.0 står kvar som den skrevs, och den här raden är rättelsen.
- **De två listorna skrivs aldrig i samma anrop.** En uppdatering som ändrar båda nekas, och en ny grupp med poster i båda nekas, med ett eget billigt villkor (`opsHarPoster`) som utvärderas före valideringen. Inget tak på antalet löser kombinationen, eftersom det är summan som räknas. Ett tydligt nej är bättre än ett budgetfel som beror på hur långa listorna råkar vara. Ramverkets skrivvägar skriver alltid en lista åt gången (`OpsModulTyper` skriver bara `typavvikelser`).
- **`MAX_EXTERNA` är 5**, en posts marginal under de sex som går igenom.

**Prov, båda riktningarna (`rules/__tests__/grupper.test.mjs`), alla i den dyraste formen och med båda listorna tömda först, eftersom ett oförändrat värde inte räknas som en ändring (två av proven mätte först ingenting av just det skälet, och var gröna av fel anledning):**

| Mutation | Röda prov |
|---|---|
| `typavvikelser` valideras alltid igen | 1 (lagrade avvikelser och en full lista) |
| Utan villkoret mot båda i samma uppdatering | 1 |
| Utan villkoret mot båda på en ny grupp | 1 |
| Taket tillbaka till 10 | 4 |
| Taket 6 | 0. Väntat: sex går igenom, marginalen är ett val och ingen vakt |

⛔ **Ändrade befintliga prov (regel 9, den som skriver godkänner inte):** `precis taket går igenom` i enhetsprovet läser nu taket ur konstanten i stället för en skriven 10, och regelprovet "båda listorna fulla i SAMMA uppdatering går igenom när posterna är minimala" är ersatt av provet att kombinationen nekas.

## 0.42.0

⛔ **Moduler kan bidra med typer till inkorgen, kalendern och händelserna (#217). Nytt valfritt fält `typer` i `defineModule`, sammanslagningen `bas ∪ bidrag(påslagna)` vid render (`typerForGrupp`), ägarens avvikelse (`typavvikelser` på gruppen: dölja eller döpa om, aldrig skapa), en resolver som aldrig tappar en skriven rad (`typenForRad`, «arkiverad modul») och märket «från <modul>» (`typmarke`, `OpsModulTyper`). Appen måste pinna om, regenerera sitt regelfragment, och CP måste deploya reglerna efter mergen. Ett kontrakt och dess bevis, inte hela produkten: ingen migrering av gamla rader och ingen bindning mot Notion eller GitHub.**

### #217: "modulbidrag till kategorier/typer (inkorg, kalender, händelser)"
Händelsen: CP 2026-10-01, med en skärmbild från telefonen av "Nytt ärende" som listade Ärende, Bugg, Ekonomisk uppdatering, Förbättring, Kvitto/utlägg och Övrigt: "Vissa av dessa typer kommer ju med modulerna? Ekonomi t ex." Allt låg i en fast lista i appen (`web/src/data/inbox.js`), så en grupp utan Ekonomi såg ändå "Kvitto, utlägg", och ramverket hade inget sätt för en modul att lägga till en typ. Modellen CP låste är tre lager som aldrig blandas: appens bas (gruppens egna kategorier, gäller alltid), modulens bidrag (läggs till vid render när modulen är på, inget synkjobb) och gruppens avvikelse (ägaren döljer eller döper om, men skapar inget modul-id).

**API (alla exporterade, alla i README, se "Modulernas typbidrag"):**
- `defineModule({ typer: { inkorg, kalender, handelser } })`, varje post `{ id, namn: { sv, en }, ikon?, farg? }`. Den byggda modulen bär alltid alla tre listorna.
- `typerForGrupp(yta, { bas, moduler, modulerPa, avvikelser, sprak? })`: valen. `bidragForGrupp(yta, ctx)`: ägarens lista. `typenForRad(värde, yta, ctx)`: typen en skriven rad pekar på. `typmarke(typ, sprak?)`: «från Ekonomi». `typerTillValg(typer, sprak?)`: alternativen till `OpsRadioGroup`.
- `byggTypavvikelser`, `medAvvikelse`, `modultypId`, `delaModultypId`, `TYPYTOR`, `MODULTYPAVGRANSARE`, `MAX_TYPAVVIKELSER`, `MAX_TYPNAMN`, och komponenten `OpsModulTyper`.
- Gruppen får `typavvikelser: [{ yta, id: "modul:id", dold, namn? }]`, ägarens att skriva (`AGARGRUPPFALT`, inte `ADMINGRUPPFALT`).

#### Besluten, och varför
- **Värdet en rad bär för ett bidrag är `modul:id` (`ekonomi:kvitto`), inte bara `kvitto`.** Valet är kolonet: `ID_FORM` släpper inte kolon, så gruppens egna kategorier kan aldrig få samma värde som ett bidrag, och två moduler kan aldrig krocka med varandra, hur gruppen än döper sina. Utan det hade en grupp som själv skapat kategorin `kvitto` fått en tyst krock den dag Ekonomi lade till samma id, och vilken av dem en rad pekade på hade avgjorts av ordningen. En rad med `ekonomi:kvitto` vet dessutom vilken modul den kom från när modulen är borta (annars går «arkiverad modul» inte att märka), och ägarens avvikelse pekar på samma värde utan ett separat modulfält. Priset: en gammal rad med ett omärkt id (`kvitto` ur appens fasta lista) är en rad i basen tills appen flyttar den. Migreringen ingår inte, och `typenForRad` ger `null` för ett omärkt id som inte finns i basen i stället för att gissa en modul.
- **Ägarens avvikelse bor på GRUPPRADEN (`typavvikelser`), inte i katalogen.** Skälet är rollen: modellen säger "ägaren", och `AGARGRUPPFALT` är redan exakt den gränsen (som `moduler`: vilka moduler som är på är ägarens beslut, alltså är vad de bidrar med det också). En katalograd hade krävt ett nytt fält i `KATEGORIFALT` med en modul-pekare, en andra uppsättning regler och en rad som ser ut som en fri kategori, alltså precis förväxlingen tydlighetsregeln finns för. Priset är ett nytt fält på `groups` och därmed en regeländring.
- **"Kan inte skapa påhittade modul-id" avgörs på skrivvägen, och reglerna kan det inte.** En regel kan inte slå upp modulernas manifest. En avvikelse kan bara PEKA på ett bidrag: sammanslagningen läser avvikelser mot de bidrag modulerna lämnat, så en avvikelse som pekar på ett påhittat id döljer eller döper om ingenting (provat). `byggGrupp(rad, moduler)` (skrivvägen skickar alltid in modulerna) avvisar dessutom ett påhittat modul-id och en typ modulen inte lämnat. Reglerna kontrollerar formen och antalet. Läsvägen utan modulerna tål en gammal rad, som `kandaModuler`.
- **`typer` är valfritt i manifestet, till skillnad från varje annat fält.** `hubb` krävdes även tomt (0.37.0) av arbetsreglernas punkt 5, men `typer` är ett bidrag och inget en modul behöver för att fungera, och ett krav hade fällt varje redan skriven modul (appens, `tam`:s, mallarnas) på en minorversion. Tomheten skrivs ändå ut: den byggda modulen bär alltid `inkorg: []`, `kalender: []`, `handelser: []`. Nycklarna är ASCII (`handelser`), samma skäl som `externaDatakallor` (#216).
- **Ingen tyst nedsläppsväg.** `typerForGrupp` och de andra kräver `bas`, `moduler`, `modulerPa` och `avvikelser` som listor, även tomma. En app som glömt `moduler` hade annars fått en lista utan bidrag och ingen anledning att undra.
- **En modul som är AV tappar inga rader.** Den bidrar inte till valen, men `typenForRad` ger raden tillbaka med `tillstand: "modul-av"` och modulens riktiga namn; är modulen eller typen borta helt blir det `modul-okand` med id-halvan som namn (inte en tom etikett). Båda märks «arkiverad modul». Ett bidrag ägaren dolt visas fortfarande på raderna som redan bär det, märkt «från Ekonomi, dold».
- **Märket härleds (`typmarke`) och skrivs aldrig för hand.** `OpsModulTyper` och `typerTillValg` (hjälptexten under valet i `OpsRadioGroup`) använder samma funktion, så ytorna kan inte säga olika saker.
- **Ordningen är bas först, sedan modulerna** i modullistans ordning och i den ordning modulen deklarerat dem. Ingen sortering över lagren: en blandad ordning hade gjort märket till det enda som skilde dem åt.
- **Ytor utan faser.** Ett bidrag bär inte `fas`: faserna är ramverkets, och en modul kan inte påstå att den äger en.

#### ⛔ Taket är sex, och det är mätt mot det värsta fallet (reglerna)
Reglerna har ingen loop, så varje avvikelse rullas ut till `MAX_TYPAVVIKELSER`, och en regel får utvärdera högst 1000 uttryck per skrivning. Mätt i emulatorn (firebase-tools 14, emulator 1.19.8), ägarens giltiga skrivning: **tjugo poster nekades** (`maximum of 1000 expressions to evaluate has been reached`), tio billiga poster gick igenom, men **tio och åtta poster i dyraste formen (omdöpt namn på båda språken) nekades**, sju går igenom och **sex är taket, med en marginal**. Första versionen hade tio och mättes bara mot billiga poster, vilket var fel och upptäcktes först när provet använde den dyraste formen. Ett tak som regeln inte klarar att utvärdera är sämre än ett lågt tak, eftersom det nekar en giltig skrivning utan att säga varför.

#### ⛔ Budgeten delas med `externaDatakallor` (0.41.0), och en rad i #216:s regel ändrades
Efter ombaseringen mot 0.41.0 mättes samverkan, och den var röd: en grupp som redan bar en full lista `externaDatakallor` (tio minimala poster) kunde inte skriva ens två avvikelser, eftersom `opsExternaGiltiga` utvärderades vid VARJE uppdatering av gruppen, också när listan inte rördes, och tog det mesta av budgeten. **Ändringen:** `update` validerar `externaDatakallor` bara när fältet ändras (`opsAndrad`, `diff().affectedKeys()`), en lista som inte ändras är redan validerad den gång den skrevs. `create` och valideringen av en lista som ÄNDRAS är oförändrade, och #216:s prov (52 stycken) är oförändrade och gröna. Provet är två mutationer: utan avgränsningen 5 prov röda, med avgränsningen omvänd 42, mot fel fält 37, och aldrig validerad 36. `typavvikelser` valideras däremot alltid: jag provade att avgränsa den också, och mutationen utan avgränsningen gick inte att slå röd (0 prov, eftersom listan är billig nog att få plats), så avgränsningen togs bort i stället för att stå kvar som en vakt utan eget utfall.

⛔ **Ett fynd i 0.41.0 som INTE är rättat här:** `MAX_EXTERNA` är 10, men en lista med tio poster som alla bär `label` och `credentialSecretId` **nekas** av samma budget när den skrivs ensam (mätt: tio med båda fälten nekas, tio minimala, sju och fem med båda fälten går igenom, log g217-externa-matt.log). #216:s prov använder minimala poster, så taket 10 har aldrig provats mot det dyraste fallet. Ett eget ärende, inte en del av #217.

#### UI: märket «från <modul>»
- `OpsModulTyper`: ägarens lista «Typer från moduler», varje rad med en pill «från Ekonomi» (varning-ton och «, dold» när dold), knapparna **Byt namn** och **Dölj**/**Visa**. Ingen knapp för att lägga till (ett modul-id hittas inte på). Tomhet är ett svar: en grupp utan bidrag får en rad som säger det. `kanAndra` är en artighet och inte låset, och vyn säger det (samma not som `OpsKatalogInstallning`).
- Valen i ett skapa-formulär: `typerTillValg` ger `hint` = märket, som `OpsRadioGroup` ritar under valet. Gruppens egna kategorier får ingen hjälptext.
- `check-skalyta` avsnitt 37 mäter det i en riktig webbläsare vid 390 och 1280 px (se nedan).

#### Röd utan fixen, grön med den (0.42.0)
Loggar i scratchpad (g217-*.log).
- **`npm run test:rules`:** med fixen **280 av 280 gröna** (246 i 0.41.0, 34 nya prov). Utan reglerna och modellen (0.41.0:s `regler.js`, `grupp.js` och `modul.js`, provfilerna oförändrade) **10 av 280 röda**. ⛔ **Tio är få, och skälet är att nej-proven blir gröna av fel skäl utan fixen:** utan fixen står `typavvikelser` inte i `AGARGRUPPFALT`, så varje skrivning nekas av `hasOnly`. De tio är de som kräver att ägaren FÅR skriva fältet. Vad varje valideringsrad är värd bevisades därför med mutationerna nedan, inte med den här siffran.
- **Mutationer av reglerna och `AGARGRUPPFALT`/`ADMINGRUPPFALT`, en i taget, mot `test:rules` på den ombaserade grenen** (röda av 280 vid varje, log g217-rules-mut4.log): `update` utan validering av typavvikelser 23, `externaDatakallor` valideras alltid (ingen avgränsning) 5, avgränsningen omvänd 42, avgränsningen på fel fält 37, `externaDatakallor` aldrig validerad på update 36, `create` utan validering 1, `typavvikelser` utanför `AGARGRUPPFALT` 9, i `ADMINGRUPPFALT` 24, utan `hasOnly` på posten 1, utan ytakontroll 2, utan id-form 5, utan id-tak 1, utan no-op-kontroll 4, namn utan `hasOnly` 1, `sv` utan nedre gräns 1, `sv` utan tak 1, `en` utan tak 1, utan listtak 1, utan `is list` 2, sista indexet ovaliderat 1. **Alla 20 slog minst ett prov rött.** Fyra mutationer överlevde först och behandlades: `dold is bool` och `namn is map` (0 röda) var ekvivalenta med kontrollen som redan fanns (`p.dold || 'namn' in p` och `p.namn.keys()` kastar på fel typ, och ett fel i en regel är ett nej, provat i `dold som inte är bool` och `ett namn som inte är en map`), så de två raderna togs bort i stället för att stå kvar som vakter utan eget utfall; `is list` (0 röda) hade ett verkligt hål, eftersom en tom sträng eller en tom map har `size()` 0 och släpptes igenom, och fick nya prov (`""`, `"x"`, `{}`); och den avgränsade valideringen av `typavvikelser` (0 röda, se ovan) togs bort.
- **Enhetsprov (vitest), nya filer `modultyper.test.js` och `modulTyper.test.jsx`:** 61 nya prov gröna (53 + 8) med fixen, 38 av 53 röda i `modultyper.test.js` utan den (`modulTyper.test.jsx` kan inte ens importera komponenten), 59 av 61 gröna mot den ombaserade grenen före de två regelprov som följde klausulens nya form (rättade, 61 av 61). Mutationer av `modultyper.js`, `grupp.js`, `modul.js`, `regler.js` och `OpsModulTyper.jsx`, **44 st, en i taget, alla röda, körda före ombaseringen mot 0.41.0 mot en `modultyper.js` som sedan inte ändrats i logiken (bara `MAX_TYPAVVIKELSER` och dess kommentar)** (mot `modultyper.test.js`, `modulTyper.test.jsx`, `modul.test.js`, `grupp.test.js`): avstängd modul i valen 4, dolda i valen 1, `modulerPa` ignoreras 6, omdöpt namn ignoreras 2, bidrag före bas 9, värdet utan modulprefix 18, ytorna blandas 7, avvikelse matchar inte på yta 1, arkiverade egna erbjuds 9, `typenForRad` för avstängd modul 1, för okänd modul 2, för okänt omärkt id 1, för arkiverad egen 1, märke för avstängd 1, för egen kategori 3, för dold 2, ingen kontroll mot kända moduler 2, ingen typkontroll 1, no-op accepteras 1, avvikelse-dubblett 1, utan tak 1, utan kolonkrav 1, `dold` okontrollerad 1, okända fält accepteras 1, namnlängd okontrollerad 1, `medAvvikelse` tar inte bort neutral 1, ersätter inte 2, okänd yta i manifestet 1, dubblett-id 1, kolon i id 1, strängnamn 1, färg okontrollerad 1, okänt fält på post 1, saknad lista tolereras 1, `typavvikelser` utanför `AGARGRUPPFALT` 3, ej byggd 1, `kandaModuler` ej vidareskickad 1, `typer` ej utskrivna 30, `update` utan validering i regelgeneratorn 1, `create` utan validering 1, Dölj skickar inte `dold` 1, märket skrivs inte 2, knappar utan `kanAndra` 1, tomhetsraden utelämnas 1. En mutation var från början ett misstag av mig (en no-op som inte ändrade beteende, 0 röda) och byttes mot en riktig (2).
- **Genererad regel mot konstanter:** `rules/__fixturer__/genererad.rules` skrevs om (`check-regelgenerator --skriv`), och proven `reglerna härleds ur samma listor och gränser` jämför `hasOnly`, ytlista, id-form, id-tak och antalet utrullade poster mot de exporterade konstanterna, och att `typavvikelser` står i ägarens `hasOnly`-lista och inte adminens.
- **`check-skalyta` avsnitt 37 (modultyper, 390 och 1280):** med fixen **1505 kontroller, inga brott** (`OPS_CHROMIUM` mot Chromium 1194). Mätt: valen Ärende och Bugg utan märke, de två bidragen med «från Ekonomi» som hjälptext, listradernas pill «från Ekonomi», knapparna Byt namn och Dölj 44/44 px höga, inget horisontellt överflöde (-15 px, alltså marginal) vid båda bredderna, Dölj tar bort bidraget ur valen men lämnar det i listan som «från Ekonomi, dold» med Visa, och Visa ger tillbaka det. Röd utan fixen: med `typerTillValg` utan `hint` blev avsnitt 37 rött (**4 brott**, två per bredd, inga andra) och `dist` byggdes om med den friska källan efteråt. Golv: minst 4 val och 2 listrader. Inte mätt: mörkt tema och hur långa namn bryts vid 320 px.
- **Ändrade befintliga prov (regel 9):** en förväntning i #216:s prov ändrades, och den är en direkt följd av regeländringen ovan: `grupp.test.js` (`reglerna härleds ur samma listor och gränser`) kontrollerade den exakta texten `allow create: if opsArAgare(gid) && opsExternaGiltiga(request.resource.data);` och `allow update: if (opsArAgare(gid) && opsExternaGiltiga(...)`. Den första raden kräver nu även `opsTypavvikelserGiltiga`, den andra kräver `(!opsAndrad(..., 'externaDatakallor') || opsExternaGiltiga(...))`: samma krav (validering finns på create och update), ny form. Inga andra av #216:s prov ändrades, och deras 52 regelprov är gröna. `rules/__tests__/grupper.test.mjs` fick en ny `describe` sist (och en import av tre konstanter). `examples/paminnelser/index.js` fick ett `typer`-fält, eftersom `check-exempelmodul` kräver att exempelmodulen visar varje manifestfält README lovar. README:s komponentantal rättades 106 till 107 (`check-docs`).

### Att göra i appen
1. Pinna om till 0.42.0 (release-URL i PR-texten).
2. Regenerera regelfragmentet: `check-regelfragment --skriv` (grupp-blocket får `opsTypavvikelse`, `opsTypavvikelserGiltiga`, `opsTypavvikelserLista` och `opsAndrad`, `create`/`update` på gruppen kräver typavvikelsernas validering, och `update` validerar `externaDatakallor` bara när den ändras, se ovan). **CP deployar reglerna efter mergen**, och reglerna deployas innan en klient som skriver `typavvikelser` mergas (en regel i main är inte en regel i produktion).
3. **Flytta "Ekonomisk uppdatering" och "Kvitto, utlägg" ur appens fasta lista i `web/src/data/inbox.js` till Ekonomimodulens `typer.inkorg`:**
   ```js
   typer: { inkorg: [
     { id: "uppdatering", namn: { sv: "Ekonomisk uppdatering", en: "Financial update" } },
     { id: "kvitto", namn: { sv: "Kvitto, utlägg", en: "Receipt, expense" } },
   ] }
   ```
   Kvar i appens bas: Ärende, Bugg, Förbättring, Övrigt.
4. I Nytt ärende: `typerTillValg(typerForGrupp("inkorg", { bas, moduler, modulerPa: grupp.moduler, avvikelser: grupp.typavvikelser }), sprak)` till `OpsRadioGroup`. På en befintlig rad: `typenForRad(rad.typ, "inkorg", ctx)` och `typmarke`. I gruppens inställningar: `OpsModulTyper` med `bidragForGrupp`, och `onAndra` som sparar `byggGrupp({ ...grupp, typavvikelser: medAvvikelse(grupp.typavvikelser, a) }, moduler)`. `kanAndra` ur ägarrollen, inte adminrollen.
5. **Gamla rader:** de som bär ett omärkt id (`ekonomisk-uppdatering`, `kvitto`) ligger i basen tills appen migrerar dem till `ekonomi:uppdatering` och `ekonomi:kvitto`, eller behåller dem som egna kategorier. Ramverket migrerar inget. Hör till appens ärende, inte hit.
6. Ingen datamigrering för gruppraderna: en grupp utan fältet läses som `typavvikelser: []`.

### Utanför ärendet
Migrering av gamla rader, bindning mot Notion eller GitHub (#216), kalenderns och händelsernas faktiska ytor i appen (kontraktet är på plats, ramverket ritar inget typfilter som läser det) och varje appändring. Relaterat: #195 (ärendetyper per grupp), #92 (modulkontraktet).

---

## 0.41.0

⛔ **En grupp kan bära externa datakällor, GitHub först (#216, design i #185). Nytt fält `externaDatakallor` på gruppen, ägarens att skriva och aldrig adminens, validerat i klienten (`byggExternaDatakallor`) och i reglerna. Appen måste pinna om, regenerera sitt regelfragment, och CP måste deploya reglerna efter mergen. Frånvarande eller `[]` beter sig som förut. Ingen vy, ingen läsning av GitHub och ingen token ingår: det här är bara konfigurationen och dess regler.**

### #216: "externa datakällor på en grupp"
Händelsen: CP 2026-10-01 bekräftade "GitHub först" i #185/#216: en grupp ska kunna peka ut vilka externa källor dess ytor får hämta ur, och data utan regler är data vem som helst får skriva (samma skäl som CLAUDE.md "Vad som inte är regler här"). Fältet är gruppens, inte appens, så det bor i ramverkets egen samling `groups`.

**Formen:** `externaDatakallor?: Array<{ type: "github", repo: "ägare/namn", enabled: boolean, label?: string, credentialSecretId?: string }>`, högst `MAX_EXTERNA` (10) poster. `repo` följer `^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$` (GitHub: ägare med bokstäver, siffror och bindestreck, namn med dessutom `.` och `_`), högst 140 tecken, och aldrig `.` eller `..` som namn. `label` högst 80 tecken. `credentialSecretId` 1 till 64 tecken ur `[A-Za-z0-9_-]`. Posten bär inga andra nycklar. Fältet står i `AGARGRUPPFALT` och inte i `ADMINGRUPPFALT`: en datakälla avgör vad gruppens ytor kommer åt, som `moduler`. `GRUPPFALT` och reglernas `hasOnly` härleds ur listorna, ingen handskriven kopia.

#### ⛔ Namnet är `externaDatakallor`, inte `externDatakällor`, och mätningen är skälet
Ärendet bad om `externDatakällor`. Regel 3 (mät) och metaregeln gäller, så namnet mättes i Firestore-emulatorn (firebase-tools 14, emulator 1.19.8) innan något skrevs, och CP beslutade 2026-10-01 ("Kör externaDatakallor, ASCII är bra"):
- **Punktnotation bryter.** `request.resource.data.externDatakällor is list` går inte att kompilera. Kompilatorn svarar `Error compiling rules: L4:56 Unexpected ')'. L4:96 Unexpected 'llor'. L4:145 token recognition error at: 'ä'` (HTTP 400). En regelidentifierare är ASCII. Allt i regler.js som skrivs `d.fält` (`d.groupId is string`, `d.deltagare.size()`) går alltså inte att skriva för det namnet.
- **Strängformerna fungerar.** `keys().hasOnly(["externDatakällor"])`, `diff().affectedKeys().hasOnly([...])`, `'externDatakällor' in data`, `data['externDatakällor']` och klient-SDK:ts `setDoc`/`updateDoc` gav alla förväntat utfall i 13 prov (negativ kontroll med `hasOnly(["namn"])` nekade ändringen). Namnet hade alltså gått att använda med en bracket-regel.
- **Men det hade gjort fältet till det enda i modellen som inte går att skriva med punktnotation i en regel**, och en andra brytpunkt hade funnits kvar: `src/data/postgres.js` `identifier()` kräver `^[A-Za-z_][A-Za-z0-9_]*$` för kolumnnamn och kastar annars (rad 40 till 43). Fältet hade därmed inte kunnat vara en kolumn via ramverkets Postgres-adapter. Unicode-normaliseringen var en tredje risk: en NFD-nyckel (a + U+0308, 17 tecken) är en annan nyckel än NFC (16 tecken) och nekades i provet, så en klient som normaliserar annorlunda hade skrivit ett annat fält.
- Alla andra fält i modellen är redan translittererade (`epostsprak`, `lankar`, `agare`, `vantar`). Provet `namnet är ASCII` i `grupp.test.js` vaktar att inget fält i `GRUPPFALT` får bära ett icke-ASCII-tecken.
- Inte mätt: Firestore-adaptern, memory-adaptern och Postgres-adaptern körda mot ett ä-fält. Postgres-skälet är läst i `identifier()`, inte körd.

#### ⛔ En token bor aldrig här
`credentialSecretId` är ett NAMN på en hemlighet som serversidan slår upp, aldrig själva hemligheten. Fältet läses av klienten och är läsbart för varje medlem i gruppen. Därför avvisas ett värde som ser ut som en GitHub-token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) i `byggExternaDatakallor` och i reglerna. Det är ett skyddsnät och ingen garanti: en token utan känt prefix går igenom, så ingen yta ska be om en token för att spara den här. Tokens hålls aldrig klientsidigt (utanför ärendet, se nedan).

#### Hur reglerna är skrivna
- **Ingen loop i Firestore-regler**, så giltigheten av varje post rullas ut till `MAX_EXTERNA` poster ur samma tal (`opsExternLista`, genererad). Fullt utrullat med 10 giltiga poster går igenom i emulatorn, och en ogiltig post SIST i en full lista nekas (provat, se nedan).
- **Valideringen gäller både `create` och `update`** av gruppen (`opsExternaGiltiga(request.resource.data)`). Före 0.41.0 hade `create` ingen fältvalidering alls, bara `opsArAgare`. Fältet frånvarande är giltigt, så en grupp utan det skapas och uppdateras som förut.
- De krävda fälten och att posten är en map har ingen egen rad: varje kontroll kastar ett utvärderingsfel när fältet saknas eller posten inte är en map, och ett fel är ett nej. Det är provat (`saknas`, `posten är inte en map`), och de två rader som först stod där (`hasAll`, `is map`) togs bort för att deras mutationer inte gick att slå röda: de var ekvivalenta med den kontroll som redan fanns.
- En admin skriver inte fältet: `AGARGRUPPFALT` och inte `ADMINGRUPPFALT`. En skrivning som inte ändrar värdet (admin skriver `[]` över en redan tom lista) är ingen ändring i `affectedKeys()` och går igenom, som för varje annat fält. Provet skriver därför först en icke-tom lista som ägare.

#### Röd utan fixen, grön med den (0.41.0)
Loggar i scratchpad (g216-*.log).
- **`npm run test:rules`:** med fixen **246 av 246 gröna** (194 före, 52 nya prov). Utan reglerna (0.40.1:s `regler.js`, provfilen oförändrad) **37 av 246 röda**, 209 gröna.
- **Mutationer av det genererade fragmentet och modellen, en i taget, mot `test:rules`** (röda av 246 vid varje): `externaDatakallor` utanför `AGARGRUPPFALT` 7, i `ADMINGRUPPFALT` 37, ingen validering på update 35, ingen på create 2, utan `hasOnly` på posten 1, utan typkontroll 4, utan repoform 7, utan punktnamn 2, utan repotak 1, utan `enabled is bool` 4, utan labeltak 1, utan hemlighetsform 1, utan hemlighetstak 1, utan tokenskydd 4, utan listtak 2, sista indexet i listan ovaliderat 1, utan `is list` 2. **Alla 17 slog minst ett prov rött.** Två mutationer överlevde först (`create` utan validering: proven skrev över en rad som redan fanns och provade alltså `update`; och `is list` utan `size()`-fall med tom sträng) och rättades med nya prov (egna grupp-id per create-prov, tom sträng och tom map som fältvärde) innan siffrorna ovan togs.
- **Enhetsprov (`grupp.test.js`, vitest):** 141 av 141 gröna. Mutationer av `byggExternaDatakallor`/`byggGrupp`/`AGARGRUPPFALT`, en i taget, alla röda: utan tokenskydd 2, utan tak 1, utan punktnamn 2, utan `enabled`-kontroll 2, utan typkontroll 1, utan okända-nycklar-kontroll 1, `byggGrupp` ignorerar fältet 29, fältet utanför `AGARGRUPPFALT` 31.
- **Genererad regel mot fält:** `rules/__fixturer__/genererad.rules` skrevs om (`check-regelgenerator --skriv`), och provet `reglerna härleds ur samma listor och gränser` jämför `hasOnly`, typlista, tak, antal utrullade poster och regex mot exporterade konstanter.
- **Ändrade befintliga prov (regel 9):** inga förväntningar ändrades, varken mina egna från före ombaseringen eller #216:s. I `rules/__tests__/grupper.test.mjs` lades ett grupp-id-konstant och seedade medlemskap för create-proven till i `before()`, och `node:assert` importerades. `grupp.test.js` fick bara nya importer och nya `describe`.

### Att göra i appen
1. Pinna om till 0.41.0.
2. Regenerera regelfragmentet: `check-regelfragment --skriv` (grupp-blocket får `opsExternPost`, `opsExternaGiltiga` och `opsExternLista`, och `create`/`update` på gruppen kräver dem).
3. **CP deployar reglerna efter mergen** (regeln gäller först då). Ordning: ramverket mergas först, ompinningen sedan, och reglerna deployas innan en klient som skriver fältet mergas (CLAUDE.md i bolag-ops: en regel i main är inte en regel i produktion).
4. Appens ärenden cllp/bolag-ops#511, #512 och #513 kommer efter ompinningen och ingår inte här.
5. Ingen datamigrering: en grupp utan fältet läses som `externaDatakallor: []` (`byggGrupp`), och en rad som `skapaGrupp` skriver bär från nu `externaDatakallor: []`.

### Utanför ärendet
Notion, SQL och register, BYOK, AI och chatt, en levande GitHub-flik, inkorgsrouting, tokens hållna i klienten och varje appändring. Ingen UI rördes, så `check:skalyta` kördes inte.

---

## 0.40.1

⛔ **Ett uid visas aldrig för en människa, och ett medlemskap som kan få ett namn får det (#218). Rättelse, inget nytt API utom `personnamn`, `NAMN_SAKNAS`, `bakfyllMedlemsnamn` och två valfria indata (`namn` till `skapaGrupp` och `accepteraInbjudningar`). Appen måste pinna om OCH köra bakfyllnaden, se "Att göra i appen" nedan: utan bakfyllnaden ser CP:s rad ut som "Namn saknas" i stället för som ett uid, vilket är bättre men inte rätt.**

### #218: "Bra om användarnamnet inte är Guid"
Händelsen: CP 2026-10-01, med en skärmbild från telefonen av "Nytt ärende": under "Till" stod den inloggade som `eA2ILzNei5TQ2rcHy68aBZPpR1B3 (du)`. "Bra om användarnamnet inte är Guid." Raden ritades ur `p.namn || p.userId` i `OpsMottagare`, och hens medlemskap saknade `namn`.

**Mätt innan något ändrades (regel 3):** `OpsMottagare` ritade `p.namn || p.userId`, och samma form fanns i `OpsMeddelanden` (`namn.get(id)?.namn || id`), `OpsGruppSida` (`m.namn || m.id`, två gånger), `OpsMedlemmar` (`... || medlemskap.userId`), `samtalsnotiser` (`namnFor(s.av) || s.av`) och `skaparensNamn` (uid:ts åtta första tecken). `OpsSvar` ritade `m.namn` rakt av, alltså en tom rad. Inget av dem visste vem som var inloggad.

**Rotorsaken, per skrivväg (varje väg som skapar eller ändrar ett medlemskap, mätt i källan):**
- **`skapaGrupp`, `bjudIn`, `accepteraInbjudningar`** skriver `namn` ur `users/{uid}.namn`: de tappar namnet bara när profilraden SAKNAR ett. `skapaGrupp` hade dessutom inget att falla tillbaka på: `anvandaren?.namn ?? ""`, så en profilrad som saknades eller var tom gav ett tomt namn fast inloggningen bar ett.
- **`sakerstallAnvandare`** skapar profilraden vid första inloggningen med `namn: inloggad.namn ?? ""`. Hade inloggningen inget namn då (e-postlänk, lösenord utan visningsnamn) blev `users.namn` tomt, och den befintliga-raden-vägen fyllde det aldrig senare. Varje medlemskap som sedan skrevs ur raden bar ett tomt namn. **Det är den enda väg i ramverket som kunde skapa en tom rad trots att ett namn fanns.**
- **`uppdateraProfil`** sprider redan ett namnbyte till ALLA personens medlemskap (#156). Den är inte felet, men den körs bara av en server-callable appen registrerar, och bara när namn eller bild faktiskt ändrats.
- **Appens `scripts/skapa-grupp.mjs --agare <uid>`** skriver ägarens medlemskap UTAN namn (raden byggs ur `members/{uid}` eller bara av flaggan, och `namn` tas med bara om raden har ett). Det är sannolikt hur CP:s medlemskap fick sin form, men det är en mätning av skriptets källa och inte av produktionsraden: den läses av bakfyllnaden nedan, som skriver ut `kvar` med skäl.
- **Reglerna:** `memberships` är `allow write: if false` (#136) och ska förbli det. Ingen regeländring behövs: namnbytet och bakfyllnaden körs båda med Admin SDK, som går förbi reglerna. Ingen regelgenerering eller regeldeploy ingår.

**Det som ändrats:**
- **`personnamn(namn, { id, inloggad })` och `NAMN_SAKNAS`** (båda ingångarna, ren fil) och hooken `usePersonnamn`: medlemskapets namn, annars den inloggades namn ur inloggningen om raden är hens (`useOpsAuth().user.namn`, vyn hämtar det själv via `useInloggad`, som inte kräver en provider), annars `"Namn saknas"`. Raden bär `data-namn-saknas` och en varning skrivs en gång per person i konsolen. Det är en synlig, räknebar reserv och inte ett giltigt namn.
- **Fallbackerna som togs bort (alla `|| userId` / `|| id` som namn i `src`):** `OpsMottagare` (sorteringen, radens namn och märket), `OpsMeddelanden` (`namnFor`, alltså rubrik, sök, avsändare, senaste raden och notisen), `OpsGruppSida` (märket och namnet), `OpsMedlemmar` (`visningsnamn`), `OpsSvar` (tom rad), `samtalsnotiser` (titeln), `skaparensNamn` (uid:ts början). **Ändrat beteende:** `skaparensNamn` svarar nu med tom sträng i stället för åtta tecken ur uid:t.
- **`sakerstallAnvandare`** fyller ett TOMT `users.namn` på en befintlig rad när inloggningen nu bär ett. Ett ifyllt namn skrivs aldrig över (filhuvudets beslut gäller).
- **`skapaGrupp({ namn })` och `accepteraInbjudningar({ namn })`:** inloggningens namn som reserv när profilen saknar ett. Profilens namn vinner.
- **`bakfyllMedlemsnamn({ kalla, skarpt?, samlingar? })`** (nodsidan) och `scripts/bakfyll-medlemsnamn.mjs`: fyller TOMMA medlemskapsnamn ur `users/{uid}.namn`. Torrkörning förval, rör aldrig ett ifyllt namn, omkörbar, skriver ut `lästa`, `saknar`, `att fylla`, `fyllda`, `utan profilnamn`, `utan användare` och `fel` också när de är 0, och listar de som inte gick att fylla med skäl.

### Röd utan fixen, grön med den (0.40.1)
- **Enhetsprov** (`personnamn.test.jsx`, nytt, 23 prov): **23 av 23 gröna**. Elva mutationer av koden, en i taget (en sparad logg per mutation), och varje en blir röd (underkända prov i parentes): `OpsMottagare` tillbaka till `p.namn || p.userId` (3), `OpsMedlemmar` (1), `OpsGruppSida` (1), `OpsSvar` (1), `OpsMeddelanden` (1), `samtalsnotiser` (1), `skapaGrupp` utan inloggningsreserv (1), `accepteraInbjudningar` utan reserv (1), `sakerstallAnvandare` utan fyllningen (1), `bakfyllMedlemsnamn` som skriver över ett ifyllt namn (2), `personnamn` utan den inloggades eget namn (2).
- **Ändrade befintliga prov (regel 9, två):** `medlemmar.test.jsx` ("faller tillbaka på uid när namnet saknas") bar det gamla beteendet som förväntning och säger nu "Namn saknas", aldrig uid; `skapare.test.jsx` ("faller till uid:ts början") säger nu tom sträng. Båda bar uttryckligen den regel CP just upphävde. **Den som skrev ändringen granskar inte sig själv:** de två provändringarna ska läsas av någon annan.
- **Bakfyllnadsskriptet mot Firestore-emulatorn** (projekt `regelprov`, aldrig ett riktigt projekt): fyra medlemskap, ett utan namn med profilnamn, ett vars profil saknar namn, ett utan profilrad och ett med eget namn. Torrt: `lästa 4, saknar 3, att fylla 1, fyllda 0, utan profilnamn 1, utan användare 1`. Skarpt: `fyllda 1`, och det ifyllda namnet orört. Omkörning: `att fylla 0, fyllda 0`.
- **Gates (alla exit 0):** `npm run check` (94 testfiler, 1869 prov, `check:guards` 125 vaktregler röda av rätt anledning), `test:rules`, `check:paket`, `check:guards`, `check:scaffold`, `check:skalyta` (1487 kontroller, inga brott).

### Att göra i appen (i den här ordningen)
1. **Pinna om till 0.40.1** (release-URL:en till taggen ska stå i ompinnings-PR:en, regel 11). Efter ompinningen visar listorna redan "Namn saknas" i stället för uid, och CP:s egen rad bär hans namn ur inloggningen.
2. **Skicka inloggningens namn till `skapaGrupp` och `accepteraInbjudningar`** i appens callables (`namn: request.auth?.token?.name`). Valfritt men det är det som hindrar nästa tomma medlemskap.
3. **Kör bakfyllnaden, torrt först, sedan `--skarpt`**, från appens rot (`node web/node_modules/@staiger/ops-framework/scripts/bakfyll-medlemsnamn.mjs --projekt <projekt-id>`). Den som inte har ett profilnamn står i `kvar` och måste öppna Profil och spara sitt namn. Ingen regelgenerering, ingen regeldeploy och ingen Firestore-data rörs av något annat än bakfyllnaden.
4. **Appens `skapa-grupp.mjs`:** låt `--agare` läsa namnet ur `users/{uid}` så nästa skapade grupp inte börjar utan.

## 0.40.0

⛔ **Händelsepanelen (#214): en händelse har en egen sida med Tillbaka, och man kommer dit från Idag och från kalendern, och den går att ändra (penna, skapa-panelen i redigeringsläge, `FALT_BORT`: se "Kolla med sessionstudio också" nedan). Nytt: `OpsHandelsePanel`, skalets `handelsepanel` och `useOppnaHandelse()`, och `handelseId` på `OpsEventList`s rader och `OpsCalendar`s poster. En post utan `handelseId` är oförändrad. En rad MED `handelseId` kastar tills skalet har `handelsepanel` (eller listan `onOppnaHandelse`): en rad som ser tryckbar ut och inte gör något är värre än ett fel. Dessutom en rättelse i `OpsCalendar`: kalendern rullade om sig själv när den visades igen efter en panel.**

### #214: "Vi behöver en händelsepanel"
Händelsen: CP 2026-10-01: "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha en tillbaka knapp. Kolla SessionStudio." En rad i Idag kunde fälla ut lite text och en post i kalenderns dagpanel kunde göra detsamma, men ingen av dem kunde ÖPPNA händelsen: det fanns ingen sida att gå till. SS har `EventDetailRouteView` (en rad "‹ Tillbaka" och händelsen under) och `returnFromEventDetailView` för tillbaka dit man kom ifrån.

**Besluten, och varför:**
- **Adressen är `?handelse=<id>`, på sidan man står på, och skalet äger den.** Samma mekanik som skapa-panelens `?skapa=` (0.31.0): `pushState` vid öppning, appens vy kvar monterad men dold, `popstate` styr panelen åt båda hållen. Ett eget ruttträd hade tvingat varje app att bygga om vyn vid Tillbaka, och det var just det som gjorde att filter och rullning försvann. Därför kommer man tillbaka till EXAKT det man lämnade: kalenderns månad, valda dagar och filter, Idags flik, filter och rullning (mätt, se nedan). Adressen gör också att en händelse går att länka till och att en omladdning öppnar samma panel.
- **Tillbaka-knappen och webbläsarens bakåt är SAMMA gest.** Pushade skalet posten går knappen `history.back()`; kom man in på en adress (omladdning, en länk) finns inget steg att gå tillbaka till, och då skrivs posten om utan parametern (`replaceState`) i stället för att bakåt lämnar appen. Webbläsarens framåt öppnar panelen igen. Att navigera till en annan vy (en flik, en länk i skalet, en ny `activeHref`) stänger panelen utan att gå bakåt, som skapa-panelen sedan 0.38.0.
- **Ingångarna är raderna själva, utan att appen kopplar något.** Skalet delar ut `oppnaHandelse` i en kontext, och en post med `handelseId` frågar den. Appen skickar `handelseId` bara på de poster som ÄR händelser (en uppgift eller ett ärende i samma lista har ingen panel). `onOppnaHandelse` på listan eller kalendern går före kontexten och fungerar utanför ett skal.
- **Raden är en LÄNK, och den täcker hela kortet.** SS gör hela kortet tryckbart. Ett kort som är en `<button>` med knappar inuti är ogiltig HTML och läses upp som en enda knapp, så titeln är en `<a href="?handelse=<id>">` med ett riktigt namn och en riktig adress (högerklick, ny flik; Ctrl, Cmd och Skift lämnas åt webbläsaren), och länkens `::after` ligger över kortet. Åtgärden, utfällningen och länken på kortet har `z-10` och tar sina egna tryck (mätt: Markera räknas och öppnar inte panelen).
- **Idag-radens chevron: den STÅR KVAR för en rad som skickar `details`, men en rad med panel behöver den inte.** SS har ingen utfällning på Idag-kortet: kortet öppnar händelsen. Ramverket tar inte bort chevronen (en app kan ha rader som fortfarande bär `details`, och att ta bort den vore en tyst ändring), men en händelse med panel ska inte skicka `details`: texten är panelens `beskrivning` och svaren är dess `svar`. Det är appens ändring, se "Att göra i appen".
- **Kalenderns dagpanel och snabbtitt:** raden i dagpanelen är en länk över hela raden, som i SS-appen, och snabbtittens rad öppnar också panelen och stänger titten. ⛔ **Raden har INGEN pil och inget annat märke.** Första versionen ritade en chevron åt höger för att raden ska se tryckbar ut: en egen kolumn bredvid utfällningen tog 24 px av en titel i en bubbla som är 239 px bred vid 390, och "Löneutbetalning" gick in under pilen (mätt: texten slutar 216, pilen börjar 199). Pilen i textflödet efter titeln hamnade i stället ensam på en egen rad. SS-appens rad har inget märke, så ramverkets har inget heller.
- **Panelen känner inte appens data.** `OpsHandelsePanel` får en färdig `handelse` i de fält ramverket redan läser på en händelse (`HANDELSEKONTRAKT`: `datum`, `slutDatum`, `tid`, `slutTid`, `heldag`, `kravSvar`) plus det appen löst upp till ord (titel, typens namn och ikon, gruppens namn, kalendern). Svaren kommer som `svar`, appens egen `<OpsSvar>` med sin källa. Kräver händelsen svar och `svar` saknas kastar panelen, och en status utan ord kastar (som `OpsEventList`). Händelsen som `null` skriver "Händelsen finns inte", och `laddar` en väntan: båda har Tillbaka, så en länk till en borttagen händelse lämnar ingen på en sida utan utgång.
- **Fokus följer med.** Panelen tar fokus när den öppnas (länken man tryckte på ligger i en dold vy, och fokus som blir kvar där försvinner till sidans topp), och Tillbaka ger fokus tillbaka till länken. Annars börjar tangentbords- och skärmläsaranvändaren om från början vid varje Tillbaka.
- **Innehållet i SS ordning, bara det händelsen har:** Tillbaka, titel (`text-lg sm:text-xl`) med status till höger, typrad (ikon och ord, grupp, kalender), informationsruta (datum stort med kalenderikon, tid med klocka, plats), beskrivning (SS `text-base`, hela texten), svar. En händelse utan plats och beskrivning ritar ingen tom ruta.

### Det mätningen fann, och som rättades här: kalendern rullade om sig själv efter Tillbaka
Mätt i check-skalyta avsnitt 35 vid 390 px: kalendern rullad så att den valda dagen ligger UNDER den flytande dagpanelen, en händelse öppnad ur dagpanelen, Tillbaka: rullningen var **4424 före och 4924 efter**. Effekten som rullar den valda dagen ovanför den flytande dagpanelen (0.37.0) hade `panelHojd` som beroende, eftersom höjden är 0 när dagen väljs och mäts först efteråt. Men höjden går också till 0 och tillbaka när kalendern DÖLJS och visas, och då körde effekten om och rullade kalendern 500 px: man kom tillbaka till en annan månad än den man lämnade, och det är precis kravet ("kalendern behåller månad och vald dag"). `skuldRullning` sätts nu bara när den första valda dagen BYTS, och effekten kvitterar den när panelen är uppmätt. Vid 1280 px (panelen i en egen kolumn) finns inte felet.
- ⛔ **Provet fick bli deterministiskt innan det bevisade något.** Första försöket mätte direkt efter att dagen valts, och dagpanelens egen mjuka rullning (`behavior: "smooth"`) pågick då fortfarande: samma kod gav 4814 mot 4924 i en körning och 4832 mot 4847 i nästa, en röd som inte var felet och en grön som inte bevisade något. Provet väntar nu in animeringen, och rullar kalendern så att dagen ligger under panelen, annars ger en dag som redan ligger ovanför panelen ingen rullning och provet blir grönt av sig självt (arbetsreglernas punkt 4, "tomt underlag").

### Röd utan fixen, grön med den (0.40.0)
- **check-skalyta avsnitt 35** (nytt, 1280 och 390 px; golv: minst 2 händelselänkar på Idag, 3 på Kommande, 3 i dagpanelen, 9 mätta element i panelen): mot 0.39.2:s dist **6 brott av 1362 kontroller, alla i avsnitt 35 och inga andra** (inga händelselänkar, raden är ingen länk till `?handelse=mote`, provet avbryts på första länken), med fixen **1443 kontroller, inga brott**. Pilen som först ritades bredvid utfällningen i dagpanelen (och som togs bort igen): **1 brott av 1443** med den, "Löneutbetalning slutar 216, pilen 199, utfällningen 223", och inga utan den. Utan rullningsrättelsen (den dist där raden är borttagen, och som ännu har pilkolumnen) är det **2 brott av 1443, båda i avsnitt 35 vid 390 px och inget annat**: pilen (se ovan) och rullningen (4424 före, 4924 efter Tillbaka); vid 1280 px inga. Före provet fick vänta in dagpanelens animering gav samma kod 4814 mot 4924 i en körning och 4832 mot 4847 i nästa, och ingen av dem bevisade något (se ovan). Avsnittet mäter: ett tryck i kortets hörn öppnar (länken täcker kortet), åtgärden och utfällningen öppnar INTE, Tillbaka står överst längst till vänster och är minst 44 px hög, ordningen Tillbaka, titel, typrad, ruta, beskrivning, svar uppifrån och ned, ingen horisontell överflödning, ingen klippt text och ingen titel som går in under en kontroll på sin rad (en rubrik på 90 px i tre rader vid 390, ett långt ord och en lång plats), en händelse utan plats, beskrivning och svar ritar ingen tom ruta, Tillbaka återställer Idags flik och rullning (inom 2 px) och utfällningen, kalenderns dag, dagpanel och månad, webbläsarens bakåt och framåt, en omladdning på adressen, ett id som inte finns, och snabbtitten.
- **Enhetsprov** (`handelsepanel.test.jsx`, nytt, 25 prov; beteende i jsdom: adress, historik, dold men monterad vy, popstate, kastavgränsningar): **25 av 25**. Femton mutationer av koden, en i taget, och varje en blir röd (antal underkända prov i parentes): (M1) Tillbaka går aldrig bakåt (1), (M2) vyn monteras ner i stället för att döljas (3), (M3) ingen popstate-lyssnare (1), (M4) adressen skrivs inte (6), (M6) länken avbryter inte klicket (1), (M7) modifierade tryck fångas (1), (M8) snabbtitten stängs inte (1), (M9) en adress öppnar inte panelen vid inläsning (2), (M10) "finns inte" tigs om (2), (M11) `kravSvar` utan `svar` ritas tyst (1), (M12) en rad med `handelseId` utan öppnare kastar inte (1), (M13) kalenderns rad är ingen länk (1), (M14) panelen tar inte fokus när den öppnas (1), (M15) fokus ges inte tillbaka till länken vid Tillbaka (1), och (M5) att navigera stänger inte panelen: de två vägarna är redundanta med flit (skalets länkar och en ny `activeHref`), så var och en ensam ger 0 underkända, men BÅDA borta ger 1. 
- **Ändrade befintliga prov (regel 9):** inga. `OpsSkapaPanel` fick sin Tillbaka-knapp ur den nya `TillbakaKnapp` (samma klasser, oförändrade pixlar: avsnitt 15 och 26 gröna), och `check-skalyta.mjs` och `skalyta-entry.jsx` fick avsnitt 35 och scenen `handelse`; alla andra avsnitt kör som förut.
- **Gates:** se leveransrapporten.

### Jämförelse mot SS (regel 12)
Montage `docs/jamforelser/0.40.0/montage-panel-390.png` och `montage-panel-1280.png`: ramverkets panel (Playwright mot byggd dist) bredvid SS `EventDetail`, renderad ur SS webbkälla (markup och klasser ur komponenterna, kompilerade med Tailwind och SS ljusa fixtur), samma händelse. SS-appen går inte att starta här (kräver Firebase). Den ärliga jämförelsen står i `docs/jamforelser/0.40.0/jamforelse.md`: vad som matchar (Tillbaka-rad, titel, ruta, beskrivning, ordningen, måtten) och vad som skiljer sig (SS statuspill är en redigerbar väljare, SS har flikar och Tillgänglighetslistan, ramverket har typraden och Svar).

### #214 (forts.): "Kolla med sessionstudio också så att det går att editera en händelse"
Händelsen: CP 2026-10-01, direkt efter att händelsepanelen visats: "Kolla med sessionstudio också så att det går att editera en händelse." Panelen visade händelsen men gick inte att ändra, och skapa-panelen kunde bara skapa. SS har en penna i händelsens titelrad (`EventDetailInlinePanel.jsx:84-86`, `Edit w-5`, `title` och `aria-label` "Redigera", bara när `onEdit` finns) som öppnar SAMMA formulär som skapar (`EventEditRouteView.jsx`: `EventModal inline`, förifyllt, sparar en ändring), under en rad "‹ Tillbaka" som går tillbaka till händelsen. Det här är det i ramverkets ordning, och ingen ny sida: skapa-panelen fick ett redigeringsläge.

**Nytt:** `onRedigera` och `redigeraEtikett` på `OpsHandelsePanel`, `useOppnaSkapa()("handelse", { id })`, `skapa.handelse.redigera` (en hook), `redigeraHandelseEtikett` på skalet och `FALT_BORT` i datakontraktet. Utan dem är allt som förut.

**Besluten, och varför:**
- **Pennan ritas bara när appen ger `onRedigera`.** Ramverket vet inte vem som får ändra en händelse (det är appens regel), och en knapp som nekas efter ett nätanrop är sämre än ingen knapp. Den står i titelraden, till höger om titeln och statusen, som i SS, och är 44 px under `md` (SS `p-2` ger 36, och en tumme är 44).
- **Redigering är ett LÄGE I SKAPA-PANELEN och inte en ny panel.** Samma rubrikrad, samma Tillbaka, samma fasta knapprad, samma adressmekanik (`?skapa=handelse&redigera=<id>`, `pushState`, `popstate`), samma tillstånd i skalet. En andra panel hade betytt en andra uppsättning av allt det som redan finns och redan är mätt (helskärm under `md`, tangentbordet, rullpositionen, att navigering stänger den). Tillbaka går tillbaka till händelsepanelen, för posten under var `?handelse=<id>`; efter Spara visar händelsepanelen den ändrade händelsen eftersom den läser en levande källa.
- **Skalet ritar sina egna val, så de måste fyllas i ur händelsen, och skalet känner inte händelsen.** Typ, kalender och "Kräv svar" är skalets state men händelsens värden. Lösningen är en HOOK som appen ger (`skapa.handelse.redigera`), inte att skalet får händelsens data: en hook kan bara anropas i en komponent, så skalet har en egen (`HandelseRedigeringsgrind`) som anropar den, fyller i valen en gång och släpper då fram formuläret. Formuläret får `redigera: <id>` och läser och sparar själv. ⛔ Formuläret ritas FÖRST när valen är ifyllda: ett formulär monteras med sina `useState`-värden en gång, och ett monterat med tom typ som sedan fick den hade sparat fel typ.
- **Tre lägen som ser olika ut (punkt 5):** läses (en väntan), läsfel (databasens egen text, `fel`) och finns inte ("Händelsen finns inte"), alla med Tillbaka. Ett läsfel som ritades som "finns inte" hade sagt att en händelse är borta för att databasen nekade läsningen.
- **När formuläret väl ritats byts det aldrig ut.** Hade grinden följt hookens senaste svar hade en händelse som försvann ur en levande läsning (arkiverad av någon annan) tagit bort allt personen skrivit, mitt i skrivandet. Formuläret (appen) säger i stället vid Spara att den inte längre finns, och fälten står kvar.
- **Mina kalendrar erbjuds inte i redigeringsläget.** En post i en egen kalender är en annan sorts rad (ingen typ, inga svar) i en annan samling. Att flytta dit en händelse är att skapa en ny och ta bort den gamla, inte att ändra, och väljaren erbjuder det inte.
- **`FALT_BORT`: att ändra betyder att kunna tömma.** Kontraktets `update` slog bara samman, så ett fält som utelämnades blev kvar, och `""` är ett annat värde än "saknas": appens regler avvisar `slutDatum: ""` (inget datum) och `slutTid` utan `tid`, och konventionen är att tomma fält utelämnas, inte skrivs tomma. Utan `FALT_BORT` fanns ingen väg att ta bort en beskrivning, ett klockslag eller en slutdag, och en redigering som inte kan ta bort något är ingen redigering. Det är en SYMBOL och inte en sträng, så ingen text en användare skriver kan bli en borttagning. Varje adapter gör det på sitt sätt (Firestore `deleteField()`, minnet tar bort nyckeln, Postgres `NULL`, HTTP `null`), och en adapter som inte kan KASTAR: Firestore utan `deleteField` i den sdk som skickas in skriver ingenting och säger varför, i stället för att låta fältet bli kvar och rapportera "sparat".

### Röd utan fixen, grön med den (redigering)
- **check-skalyta avsnitt 36** (nytt, 1280 och 390 px; golv: minst fyra fältetiketter i formuläret, en sparad ändring): mot 0.40.0:s dist före den här ändringen (`--dist`) **6 brott av 1451 kontroller, alla i avsnitt 36 och inga andra** (ingen penna, provet avbryts på första klicket); med ändringen **1487 kontroller, inga brott**. Mätt: pennan 44x44 vid 390 och 36x36 vid 1280, på rubrikens rad och till höger om rubrik och status; redigeringspanelen har rubriken "Redigera händelse", Tillbaka 44 px hög överst, formuläret förifyllt, Kalender och Kräv svar som händelsen har dem, Avbryt och Spara kvar; Tillbaka och webbläsarens bakåt visar händelsen oförändrad och sparar inget; Spara visar den ändrade händelsen och tar bort `redigera` ur adressen.
- **Enhetsprov** (`handelseredigering.test.jsx` 18 prov och `faltbort.test.jsx` 6 prov, nya): utan ändringen (källan från `HEAD`, proven oförändrade) **21 av 24 röda**, med ändringen **24 av 24**. De tre som är gröna också utan ändringen är de som bevisar att inget har ändrats: utan `onRedigera` ingen penna, ingen väg in i redigeringsläget utan penna, och Ny händelse oförändrad. Därtill kommer att varje nytt prov i skalet gick rött av ett läge det skyddar (adressen bär `redigera`, Tillbaka sparar inget, ett läsfel skrivs ut, ett formulär som ritats byts inte ut). `faltbort.test.jsx` är rött i alla 6 utan ändringen (symbolen finns inte) och grönt i alla 6 med.
- **Ändrade befintliga prov (regel 9):** inga.

### Att göra i appen (bolag-ops vid ompinning till 0.40.0)
1. **Skalet:** `<OpsAppShell handelsepanel={{ rita: ({ id, onTillbaka }) => <HandelsePanel id={id} onTillbaka={onTillbaka} /> }} ...>`. `HandelsePanel` är appens egen komponent (som `HandelseSvar`): den slår upp `id` i appens händelsekälla (`useEvents` med fönstret som innehåller händelsen, eller en läsning på id) och ritar `<OpsHandelsePanel handelse={...} laddar={laddar} onTillbaka={onTillbaka} statusWords={STATUS_WORDS} svar={<HandelseSvar handelseId={id} />} />`. `handelse` byggs ur appens rad: `titel` (`rubrik`), `datum`, `slutDatum`, `tid`, `slutTid`, `heldag`, `kravSvar`, `typ` (`{ namn: handelsetyper.label(h.category), ikon: kategoriIkon(...), slag }`, samma ur katalogen som raden i Idag), `grupp` (gruppens namn), `kalender` (`{ namn, farg }` ur `useKalendrarna`), `plats` och `beskrivning` om raden har dem (`text`). `svar` ritas bara när `kravSvar` är sant, och `HandelseSvar` (`SvarYta.jsx`) är redan rätt komponent: den ger OpsSvar med läsning, fel och väntan. Läsningen är asynkron: skicka `laddar` medan källan läser, och `handelse={null}` först när den är läst och raden saknas.
2. **Idag (`EventsView.jsx`):** sätt `handelseId: h.handelseId` på raden som blir `OpsEventList`-posten, bara för `typ === "handelse"` (en uppgift, ett ärende eller en faktura har ingen panel). Ta bort `details` för de raderna: `detaljpanel` skickar idag texten och `<HandelseSvar>` där, och båda bor nu i panelen (`beskrivning` och `svar`). Lämnas `details` kvar finns chevronen kvar och svaren visas på två ställen. Ingen `onOppnaHandelse` behövs: skalet har panelen.
3. **Kalendern (`CalendarView.jsx`, `handelseYta.jsx` `kalenderposter`):** sätt `handelseId: h.id` på posterna som kommer ur appens händelser, inte på kalenderposterna ur `kalendrar.poster` (en post i en egen kalender har ingen panel).
4. **Inkorgen:** `OpsSvarsrad` kan få `href={handelseHref(h.id)}` för att länka raden till panelen (en vanlig länk laddar om sidan på `?handelse=` och skalet öppnar panelen vid inläsning); eller `useOppnaHandelse()` om raden ska öppna utan omladdning.
5. **Inga nya regler eller samlingar:** panelen läser det appen redan läser.
6. **Att ändra en händelse (#214, senare i samma släpp):** ge `HandelseForm` propen `redigera` (händelsens id) och låt den fylla utkastet ur händelsen, skriva en ÄNDRING med bara det som skiljer (tomma fält som `FALT_BORT`, aldrig `groupId`, `skapadAv` eller `skapad`) och anropa `onKlar` efteråt. Ge `skapa.handelse` en `redigera`-hook (`(id) => { laddar, finns, fel?, typ?, kalenderId?, kravSvar? }`, kalendern den EFFEKTIVA) och `onRedigera={() => oppna("handelse", { id })}` på `OpsHandelsePanel` för den som får ändra. Reglerna behöver inte ändras om de redan släpper in en ändring av `typ`, `datum`, `slutDatum`, `tid`, `slutTid`, `heldag`, `rubrik`, `text`, `kalenderId` och `kravSvar` (bolag-ops gör det) och firebase-sdk:n som skickas till `createFirestoreSource` har `deleteField` (hela modulen `firebase/firestore` har).
7. **Ompinningen är samma pass (arbetsreglernas punkt 11):** ramverket först (publiceras och taggas `v0.40.0`), appens ompinnings-PR sedan, med release-URL:en `https://github.com/cllp/ops-framework/releases/download/v0.40.0/staiger-ops-framework-0.40.0.tgz`.

---

## 0.39.2

⛔ **Ändringsloggens regel kräver att `av.uid` är den inloggade (#211). Ingen ny export, prop eller komponent: en rad i `konfigloggregelfragment`. Appen måste regenerera sitt regelfragment, och CP måste deploya reglerna efter mergen.**

### #211: "en admin kunde skriva en loggrad i någon annans namn"
Händelsen: öppnad 2026-10-01 under #188 (PR 210). `konfigloggregelfragment` släppte in en `create` från ägare eller admin i radens grupp utan att titta på vem raden sade att den kom från. En admin kunde alltså skriva en rad där `av` var en annan person, och loggen, som finns för att säga vem som ändrade katalogen, hade påstått något databasen inte kunde stå för. Ingen regression: det var lika sant före 0.39.0, men #188 gjorde loggen ramverkets egen och därmed också dess hål.

Mätt före ändringen:
- **`av`s form:** `byggKonfigandring` skriver `av: d.av ?? null`, och appen skickar `useSkapare(...)`, alltså `byggSkapare`: `{ uid, namn, typ, kalla }`, där `uid` är `null` om det saknas. `av` kan alltså vara `null`, och `uid` kan vara `null`.
- **Skrivvägar i ramverket:** en enda, `createConfigLog(...).skriv` (via `byggKonfigandring`). Ramverket skriver aldrig en loggrad själv: `av` kommer från anroparen, och ramverket sätter den inte ur den inloggade. Det är alltså inte en skrivväg som kringgår något; luckan var att regeln litade på vad anroparen skickade.
- **Appen (cllp/bolag-ops, läst, inte ändrad):** båda skrivvägarna i `web/src/data/katalogen.jsx` (`useSparaKategori`, `useArkiveraKategori`) skickar `av: useSkapare("SettingsView")`, som bygger `uid` ur `useOpsAuth().user.id`, samma uid som `request.auth.uid`. Appens övriga regler kräver redan `skapadAv.uid == request.auth.uid` på samma stämpel.

Beslutet, och varför regeln inte försvagas tyst: `av` är **obligatoriskt** i en rad som skrivs av en människa. Regeln kräver `av is map` och `av.uid == request.auth.uid`, så en rad utan `av`, med `av: null` eller med `av` utan uid skapas inte. En loggrad som inte kan peka ut någon är en notis och inte ett spår. Gamla rader med `av: null` läses vidare, eftersom regeln bara gäller `create`.

#### Röd utan fixen, grön med den (0.39.2)
- **`npm run test:rules`** (rules/__tests__/konfiglogg.test.mjs, fyra nya prov: admin i någon annans namn nekas, ägare som låtsas vara admin nekas, eget namn går, `av` saknas/`null`/utan uid/text nekas, och genom den riktiga skrivaren går egen stämpel och en annans stämpel svarar `skrivning`): utan det nya villkoret **3 av 194 rödas** (de tre nya proven som provar nej) och 191 gröna, med det **194 av 194 gröna**. Loggar: g211-rod.log och g211-gron.log.
- **Ändrade befintliga prov (regel 9):** i `konfiglogg.test.mjs` bär nu varje befintlig skrivning den skrivandes egen stämpel (`egen(uid)`) i stället för den fasta `uid: "u"` och ingen stämpel alls. Utan det hade de positiva proven fallit av ett nytt skäl, och de negativa (admin i A skriver B:s rad, medlem, avslutad, utanför) hade fortsatt vara röda men för fel skäl: nu bär de en rätt stämpel och nekas av just gruppvillkoret eller rollen de provar. Ingen förväntan ändrades (samma ja och nej som förut). Inga andra provfiler ändrade.

### Att göra i appen
1. Pinna om till 0.39.2.
2. Regenerera regelfragmentet: `check-regelfragment --skriv` (konfigloggblocket får två rader mer).
3. **CP deployar reglerna efter mergen** (regeln gäller först då). Ordning: ramverket mergas först, ompinningen sedan.
4. Skulle en gammal klient nekas? Bara om den skriver en loggrad utan `av` eller med en `av.uid` som inte är den inloggades. Appens nuvarande kod (`useSkapare`) skickar rätt stämpel, så ingen känd klient nekas. En klient där användaren saknar `id` (`uid: null`) skulle nekas, men det är en användare som inte kan vara admin i någon grupp.

---

## 0.39.1

⛔ **Gruppanelens nederkant på dator går nu att rulla fram helt (cllp/bolag-ops#497). Inga exporter, props eller komponenter ändras: tre klasser på panelens `nav` i `OpsGruppanel`, och kalenderns långtryck rensas när kalendern försvinner. Appen behöver bara pinna om.**

### #497: "Bubblornas scroll kan gå ända ner, huggs av"
Händelsen: CP 2026-09-30 16:58, med en skärmbild i appens inkorg: "Bubblornas scroll kan gå ända ner, huggs av. Scolla ända ner på sidan i web samma som kalendern bredvid." Bubblorna är gruppmärkena i den infällda gruppanelen på dator. Mätt i en riktig webbläsare (check-skalyta avsnitt 34) med tolv extra grupper, rullad till botten:
- **Infälld, 1280x800 och 1024x768:** pluset sist i remsan var **18 px högt i stället för 40** och slutade exakt vid fönstrets kant (800,0 av 800 respektive 768,0 av 768). Halva pluset syntes. Panelen är en flexkolumn med fast höjd, och flexbarn krymper som standard: när listan inte rymdes tryckte flexen ihop knappen till sin minsta innehållshöjd i stället för att låta panelen rulla längre.
- **Utfälld, båda storlekarna:** "Skapa grupp" ligger tätt mot fönstrets underkant (799,5 av 800, ingen luft), eftersom panelen saknade bottenpadding.
- **Båda lägena:** dokumentet var **1665 px högt i ett fönster på 800** på en sida som bara har texten "innehåll". `sr-only`-spanen på varje kort är `position: absolute`, och närmaste positionerade förälder var skalets `sticky`-ruta UTANFÖR panelens rullyta. Spanen rullade därför inte med och klipptes inte, utan förlängde sidan med 865 px tomt.
- **Mätt och friskförklarat, för att en annan tolkning inte ska behöva gissas om:** Meddelanden (samtalsloggen med 34 bubblor, rullad till botten: sista bubblan 669,75 till 723 i en logg som slutar 731, skrivfältet under; 1280, 1024 och 390) och Idag-listan på dator (sista elementet 24,5 px över fönstrets kant) klipper inte. Kalendern på dator har ingen egen rullyta, dokumentet rullar.

Rotorsaken är alltså tre saker i en och samma `nav`, inte en känsla av att panelen är "nästan klar":
- **`[&>*]:shrink-0`**: inget barn till panelen krymper, så panelen rullar i stället.
- **`relative`**: `sr-only` blir positionerad mot panelen och rullar och klipps med den.
- **`pb-5`**: luften i botten bor INUTI rullytan (samma lärdom som 0.33.1 för Idag och Kalender), 20 px som `lg:pt-5` ovanför.

#### Röd utan fixen, grön med den (0.39.1)
- **check-skalyta avsnitt 34** (nytt, fyra mätningar: utfälld och infälld, 1280x800 och 1024x768, med tolv extra grupper; golv: minst 12 grupper och en panel som rullar): mot 0.39.0:s dist **9 brott av 1358 kontroller, alla i avsnitt 34 och inga andra** (sista knappen 18,0 px hög mot väntat minst 40 i båda infällda lägena, luft 0 mot minst 16 i alla fyra, dokument 1665 mot fönster 800 respektive 768 i båda utfällda, och golvet röd i infälld 1280 där panelen inte ens rullade tillräckligt). Med fixen: **1358 kontroller, inga brott**, sista knappen 40,0 (infälld) och 46,0 px (utfälld) hög och 20 px över fönstrets kant, dokumentet lika högt som fönstret.
- Telefon (390) mäts inte i avsnitt 34 med flit: gruppanelen är `hidden lg:block`, och där finns bara gruppväxlarens ark (avsnitt 8).
- **Enhetsprov:** inget nytt. Klasserna `shrink-0`, `relative` och `pb-5` är bara strängar i jsdom, som inte kör CSS: ett prov som sökte efter dem hade varit ett närvarogrep (arbetsreglernas punkt 4). Beteendet mäts i webbläsaren.
- **Ändrade befintliga prov (regel 9):** inga. `check-skalyta.mjs` och `skalyta-entry.jsx` fick en valfri parameter (`manga`, förval 0) som lägger till grupper och samtalsmeddelanden; alla andra avsnitt kör som förut.

### Kalenderns långtryck rensas när kalendern försvinner
Mätt 2026-10-01 i arbetet med #497: `npm run check` blev rött på ett fel efter att alla 1796 prov gått igenom ("window is not defined" i `OpsCalendar.jsx`, långtryckets timer, under `kalendrar.test.jsx`). Timern på 450 ms startas av ett tryck på en dag och rensades bara av släpp, lämna och avbryt, aldrig när kalendern togs bort. Nu rensas den också då.
- **Prov** (`calendar.test.jsx`, nytt): ett tryck på en dag och sedan bort med kalendern. Utan fixen lever 1 timer kvar (rött), med fixen 0 (grönt).

### Att göra i appen
Pinna om till 0.39.1. Inget annat: ingen ny prop, ingen ändrad export.

---

## 0.39.0

⛔ **Ändringsloggen för konfiguration bär en grupp, kategorin heter `kategori` i raden, och ramverket äger nu loggens regler (#188). `byggKonfigandring` kräver `groupId` och kastar utan det (i `createConfigLog.skriv`: `orsak: "utkast"`). Nytt: `konfigloggregelfragment(samlingsnamn)` och `KONFIGLOGGFALT`. Raden byter form (`groupId` in, `id` ut, `kategori` in), så en app som inte skickar `groupId` får `utkast`-fel på varje loggrad efter ompinningen. Inga komponenter ändras.**

### #188: en admin i en annan grupp fick katalogen sparad och loggraden nekad
Händelsen: upptäckt 2026-09-30 i steg 4 av bolag-ops flytt till kataloger per grupp (bolag-ops PR 489 och 490). Katalogerna är gruppens sedan 0.33.0 och ägare och admin i radens grupp skriver. Loggraden (`konfiglogg` i appen) bar däremot ingen grupp, så appens handskrivna regel kunde bara fråga `opsArAdmin(appensGrupp())`. En admin i en ANNAN grupp sparade en kategori: katalograden skrevs, loggraden nekades, och ingenting visade det. Läsregeln hade samma form (`opsArMedlem(appensGrupp())`), så en medlem i en annan grupp kunde inte heller läsa sin grupps logg. Det andra mättes inte i appen; det mäts här mot emulatorn med fragmentet.
- **`byggKonfigandring`** kräver `groupId` (sträng, inte tom efter trim). Utan det kastar den med skälet, och `createConfigLog.skriv` svarar `{ ok: false, orsak: "utkast" }` utan att anropa `append`. Ett tyst förval hade varit samma hål med ett värde i: raden skriven, men åt fel grupp.
- **`KONFIGLOGGFALT`** är fältlistan (`handelse`, `kategori`, `fore`, `efter`, `nar`, `av`, `groupId`) och det enda stället den står. Provet mäter att raden byggaren skriver har exakt de nycklarna, så listan kan inte bli en kopia.
- **`konfigloggregelfragment(namn)`**: medlem i radens grupp läser, ägare eller admin i radens grupp skriver (`opsArAdmin`, samma villkor som `katalogregelfragment`, annars går sparningen igenom och loggraden nekas, som i #188), ingen ändrar eller raderar. `hasOnly` är härledd ur `KONFIGLOGGFALT` och `handelse in` ur `KONFIGHANDELSER`. En rad utan `groupId` skapas inte, och en fråga utan `where: { groupId }` nekas (som katalogens). Samlingsnamnet skickar appen in; ramverket känner det inte.
- **⛔ Ett andra fel, mätt på vägen: kategori-id:t hamnade som dokument-id.** Datakällan tolkar fältet `id` i en post som dokumentets nyckel (`setDoc`) och tar bort det ur datan. Loggradens `id` var KATEGORINS id, så första ändringen av `uppgift` skrev `konfiglogg/uppgift`, och varje senare ändring av samma kategori blev en UPPDATERING av det dokumentet. Loggen är stängd för uppdateringar (det är poängen med den), alltså nekades andra ändringen: `PERMISSION_DENIED`, mätt mot emulatorn, med de gamla reglerna och med de nya. Likadant nekades den första ändringen av en kategori som en ANNAN grupp redan loggat, eftersom kategori-id:n inte bär gruppen. Loggen höll en rad per kategori i hela databasen, och det syntes inte (`skriv` svarar `skrivning` och vyn läste inte svaret). Det är samma hål som #188 med ett annat skäl, och utan det hade en admin i grupp B ändå inte fått sin loggrad skriven så fort grupp A ändrat samma kategori. Raden bär därför `kategori` och inget `id`, så datakällan ger varje rad ett eget dokument-id. **Gamla rader** (en per kategori, dokument-id = kategori-id, inget `kategori`-fält, inget `groupId`) läses vidare: `beskrivKonfigandring` faller tillbaka på radens `id`, som för dem ÄR kategori-id:t.
- **Atomicitet, oförändrat:** katalogen skrivs först och loggraden sedan, i två skrivningar, så som appen gör det. Det är avsiktligt kvar: en logg som kan sänka det den loggar är värre än ingen logg (`createConfigLog` kastar aldrig). Det som ändras är att en nekad loggrad inte längre är systematisk, och att appen ska visa den när den ändå uteblir (se nedan): `OpsKatalogInstallning` anropar `onSpara` utan att läsa svaret, så svaret från `skriv` försvinner om appen inte tar vara på det.
- **Ändrade exporter:** `KONFIGLOGGFALT` och `konfigloggregelfragment` är nya, i `@staiger/ops-framework` (och `KONFIGLOGGFALT` i `/node`).

### Att göra i appen (bolag-ops vid ompinning till 0.39.0)
Ordningen är inte valfri, och den är mätt mot reglerna, inte antagen:
1. **Bakfyll `groupId: "cps-ab"` på befintliga `konfiglogg`-rader FÖRST** (`bakfyllnadsbeslut.mjs`: `konfiglogg` blir `grupp: true`; `node scripts/bakfyll-groupid.mjs --grupp cps-ab`, torrkörning först, sedan `--skarpt`). Appens gamla regel har ingen `hasOnly`, så en bakfyllnad med Admin SDK går förbi reglerna och stör varken gamla reglerna eller gamla klienten, som läser alla rader och ignorerar fältet.
2. **Merga ompinningen och klienten sedan** (webben går ut vid merge). Klienten skickar `groupId` i `logg.skriv({ groupId: grupp, ... })`, och `konfiglogg` är gruppad i `medAktivGrupp`, så läsningen filtreras på den aktiva gruppen. De gamla reglerna släpper in en rad med `groupId` utan `id`-fält och en fråga med `where`, så klienten går ut före reglerna utan att något faller. Efter bakfyllnaden syns de gamla raderna; före den ritar `medAktivGrupp` ett fel för en rad utan grupp.
3. **Deploya reglerna SIST** (`firebase deploy --only firestore:rules`, för hand, ingen automat finns). Före klienten: den gamla klienten skriver rader utan `groupId` (nekas av den nya regeln) och läser hela samlingen (nekas av den nya läsregeln). Efter klienten och bakfyllnaden finns inget som faller. En flik som stod öppen med den gamla klienten får en loggrad nekad och ser det i vyn.
4. **Regelfilen:** lägg `konfigloggregelfragment` till som sjätte fragment i `scripts/check-regelfragment.mjs` (eget markörpar) och kör `node scripts/check-regelfragment.mjs --skriv`. Ta bort det handskrivna `match /konfiglogg/{id}`-blocket: glöms det kvar läggs de två blocken ihop med ELLER, och den gamla snävare regeln gäller vid sidan av den nya. Vakten mäter att inget block står kvar utanför paret.
5. **Klienten:** `useSparaKategori` och `useArkiveraKategori` skickar `groupId: grupp` till `logg.skriv`. Appen tar vara på svaret från `skriv` (en banderoll när `ok` är `false`) och visar läsfelet från `useKonfigloggen`, eftersom `OpsKatalogInstallning` inte gör det.

#### Röd utan fixen, grön med den (0.39.0)
- **Enhetsprov** (`konfiglogg.test.js` +6 prov, `konfigloggregelfragment.test.js` nytt, 5 prov): mot den gamla `konfiglogg.js` (0.38.0) är 7 av 19 prov i `konfiglogg.test.js` röda (bygger raden utan `groupId`, kastar inte utan det, `kategori` och fältlistan saknas, `append` får fel rad); med fixen 24 av 24 i de två filerna.
- **Regelprov mot emulatorn** (`rules/__tests__/konfiglogg.test.mjs`, nytt, 19 prov): grönt med fragmentet, 19 av 19. Tio mutationer av fragmentet, en i taget, och varje en blir röd (antal underkända prov i parentes): (M0) den gamla appregeln `opsArAdmin('cps-ab')` utan `groupId` (7), och det är #188 självt: admin i grupp B nekas loggraden; (M1) läs för vilken inloggad som helst (4); (M2) medlem i stället för admin skriver (2); (M3) bara ägare skriver (2); (M4) `hasOnly` borta (1); (M5) `handelse in` borta (1); (M6) admin får ändra och radera (2); (M7) läs alltid mot appens grupp (4); (M8) vilken inloggad som helst skriver (7); (M9) admin i NÅGON av de två grupperna skriver (3). Det orörda fragmentet 19 av 19. Dessutom kategori-id som `id` i raden (alltså `id`-kollisionen, med reglerna omgenererade): provet "två ändringar av samma kategori" blir rött med `PERMISSION_DENIED` på den andra, övriga 18 gröna.
- **Hela regelsviten** (`npm run test:rules`): 190 av 190, varav 19 nya.
- **Ändrade befintliga prov (regel 9):** `konfiglogg.test.js`, de tolv prov som bygger en loggrad (`bär fore, efter, när och av`, `kastar utan fore`, `en nytillagd har inget före`, `kastar på en okänd händelse`, `kastar utan id`, de fyra i `meningen om vad som hände`, och de tre i `skrivaren` som anropar `skriv`) fick `groupId`, eftersom raden annars inte längre går att bygga; `bär fore, efter, när och av` väntar dessutom `groupId` och `kategori` (förut `id`) i raden, och `skriver raden genom append` väntar `kategori`. `scripts/check-gruppnyckel.mjs` provar nu också det nya fragmentets text mot förbjudna mönster (`array-contains`, `groupIds`).
- **Gates:** se leveransrapporten (npm run check, test:rules, check:paket, check:guards, check:scaffold, check:skalyta).

---

## 0.38.0

⛔ **Profilen tappar Utseende och Logga ut (#202), headern visar OH och aktiva gruppens namn i infälld panel (#203), och skapa-panelen låser inte längre navigeringen (#194). Tre ärenden från CP 2026-09-30. #199 (VEM-filtret på Idag) ändras inte här: filtret ligger i appen, se nedan. Inga nya exporter, inga regler. Borttagna props på `OpsProfil`: `onTema`, `onLoggaUt`, `temaEtikett`, `temaNamn`, `loggaUtEtikett`.**

### #202: Profil utan Utseende och Logga ut
Händelsen: CP 2026-09-30: *"I Min profil: ta bort 1. Utseende (finns redan i headern, temaväljare) 2. Logga ut (finns redan under meny). Profilen ska inte duplicera kontroller som redan har en tydlig plats."* Mätt innan borttagning: Logga ut är menyns sista rad i skalet (`menyFot`, `meny.onLoggaUt`); temaväljaren är `OpsThemeToggle`, som appen lägger i skalets `actions` (skalet ritar den inte själv, bolag-ops har den i headern).
- `OpsProfil` ritar bara Språk under Inställningar. `users/{uid}.tema` finns kvar i datamodellen och skickas orört med `andringen()`.

### #203: OH och gruppens namn i headern
Händelsen: CP 2026-09-30: *"OH kvarstår (plattformskoncept OPS HUB). Bredvid OH: aktivt gruppnamn (max ~20 tecken, truncate) [...] Desktop infällt grupper-panel: OH | Travel (inte byta ut OH mot gruppbokstäver) [...] Appnamn (Bolag Ops) != OH != grupp, tre lager."*
- Infälld gruppanel på dator (från 1024): OH i rutan, en tunn avdelare och gruppens namn (`data-marke="gruppnamn"`). Avkortningen är CSS (`truncate`, ungefär 20 tecken i märkets typsnitt och spärrning), hela namnet finns i `title` och skärmläsartexten. Utfälld: som förut (namnet är rad 2). Telefon: som förut (bara gruppmärket), eftersom ett namn bredvid hade gett tre konkurrerande rader.
- Flikarna går nu åt HÖGER när panelen fälls in (OH + namn är bredare än ordmärket), förut åt vänster.

### #194: skapa-panelen låste navigeringen
Händelsen: CP 2026-09-30: *"Nytt ärende-panelen låser all annan navigering i appen. Samma sak med Ny händelse. Topnav (Idag/Kalender/Hub) och övrigt går inte att använda medan panelen är uppe."*
- Rotorsak (mätt): länkarna var klickbara men skalet höll panelen kvar och appens vy ligger dold medan den visas, så adressen bytte sida och skärmen stod still.
- Nu hör panelen till sidan den öppnades på: ett klick på en länk skalet äger (flikar, märke, menyrader, hubbmoduler), också till samma sida, och ett byte av `activeHref` stänger den. `?skapa=` skrivs om utan `history.back()`, rullpositionen återställs inte.
- Telefon: panelen är fortsatt helskärm och täcker huvudet och bottenraden med flit (CP 2026-09-29 15:01). Vägen ut är Tillbaka överst till vänster (44 px) och Avbryt längst ned. Mätt i `check-skalyta`.

### #199: VEM-filtret på Idag, INTE ändrat här
Filtret ligger i appen: `cllp/bolag-ops` `web/src/app/views/EventsView.jsx` (gruppen `id: "roll"`, `label: "Vem"`, `allLabel: "Alla roller"`, alternativ ur `web/src/data/roller.js`). Ramverkets `OpsFilterPanel` är generisk och känner inga roller.

### Att göra i appen (bolag-ops vid ompinning till 0.38.0)
- **#202:** sluta skicka `onTema`, `onLoggaUt`, `temaEtikett`, `temaNamn`, `loggaUtEtikett` till `OpsProfil`. Skriver appen temat till `users/{uid}` ur profilen måste temaknappen i headern göra det i stället, annars sparas inte temat längre per person.
- **#194:** navigera först, öppna sedan: anropar appen `useOppnaSkapa()` och byter `activeHref` i samma tick stänger bytet panelen.
- **#199:** VEM = medlemmar i aktiva gruppen. Alternativen byggs ur `medlemsinfo(medlemskap, groupId).medlemmar` (`{ id, namn }`, aktiva) plus "Jag" och "Alla" (`allLabel`). Ingen hårdkodad Agent-rad; en agent finns bara om den är medlem (`typ: "agent"`). Händelserna behöver ett fält för vem de gäller (appens data, `OpsEvent` har bara `role`, som är ett ritat märke). "Förfaller" flyttas till filtret När.

#### Röd utan fixen, grön med den (0.38.0)
- **#202** (`profilvy.test.jsx`, ändrat prov): utan fixen 1 fel, 51 av 52; med 52 av 52.
- **#203** (`marke.test.jsx` +5): utan fixen 3 fel, 20 av 23 (`skal031` 14 av 14); med 23 av 23. `check-skalyta` mot dist 0.37.1: 11 brott i de nya kontrollerna (1280, 1600, 1024), med nya dist 0.
- **#194** (`skapaNavigering.test.jsx`, nytt, 4 prov): utan fixen 3 fel, 1 grönt; med 4 av 4. `check-skalyta` avsnitt 33 mot dist 0.37.1: 3 brott (1280), med nya dist 0. Vid 390 är kontrollen grön på båda (Tillbaka fungerade redan), den är ett golv och inte ett fel som rättats.
- **Ändrade befintliga prov (regel 9):** `profilvy` ("båda väljarna", krävde Utseende), `skal031` (länkens klass `hidden md:block` blev `hidden` + `md:flex`), `check-skalyta` (flikarnas rörelse vid infällning: minst 20 åt endera hållet, förut åt vänster).
- `check-skalyta` helt grön med 0.38.0: 1338 kontroller, inga brott.

---

## 0.37.1

⛔ **Slagets ikon (`kindIcon`) ritas nu i dagpanelens rad och i snabbtitten, som 0.37.0 sade att den gjorde. Ren rättelse i `OpsCalendar`, inga nya props, inga regler, ingen ändring i dagrutan (den har fortfarande bara prickar och streck). Några kommentarer som sade 0.38.0 om hubben rättas till 0.37.0.**
Händelsen: CP 2026-09-30: *"Jag gillar ikonerna för typerna hos oss."* 0.37.0:s avsnitt om kalendern sade att ikonerna "står kvar i dagpanelens kort, `OpsEventList` och snabbtitten". Det stämde för `OpsEventList` och inte för de två andra: en granskning i cllp/bolag-ops (en subagent, läst mot källan och sedan kontrollerad av mig i `OpsCalendar.jsx`) fann att `OpsCalendar` aldrig ritade `kindIcon` någonstans. Beslutet om dagrutan (prickar och streck, inga ikoner) var riktigt och är orört; det var panelen och titten som saknade ikonen. En anteckning om tillstånd ruttnar (regel 3): CHANGELOG-raden beskrev avsikten, inte koden.

- **Dagpanelens rad** (telefonens bubbla och datorns kolumn är samma `Postkort`): `kindIcon` ritas före titeln, `aria-hidden` (ordet läses redan ur kantordet), i slagets färg ur `lib/slag.js` (`slagText`, samma som raden i `OpsEventList`), och `text-ink-secondary` när posten saknar slag. En post utan `kindIcon` får ingen ikonruta.
- **Snabbtitten** ritar samma ikon före titeln (titeln trunkeras fortfarande på en rad).
- **Kommentarer:** "0.38.0" i hubbens och modulernas kommentarer (`lib/hubb.js`, `lib/modul.js`, `OpsHub`, `OpsModulSida`, `OpsGruppFormular`, prov och skalytans skript) och i README betydde alltid släppet som blev 0.37.0. Rättade till 0.37.0.

#### Röd utan fixen, grön med den (0.37.1)
- **Enhetsprov** (`calendar.test.jsx`, nytt prov): ikonen finns i panelens rad efter att dagen valts, före titeln, `aria-hidden`, i slagets färg, saknas på posten utan ikon och finns inte i dagrutan. **Utan fixen (raden som ritar ikonen avstängd): 1 fel, 51 gröna av 52. Med fixen: 52 av 52.**
- **`check-skalyta` avsnitt 30 (telefon 390)**: en ny kontroll mäter i den byggda appen att bubblans rad för Styrelsemöte har en svg, att den står till vänster om titeln på samma rad, att titeln inte trunkeras och att ikonen är 12 till 20 px och `aria-hidden`. **Mot den gamla dist (0.37.0): 1 brott av 1295 kontroller, "ingen ikon (svg)". Mot den nya: 0 brott.**

---

## 0.37.0

⛔ **Hantera kalendrar (#179 F2), händelsemodellen med Kräv svar (#179 F3) och dagen till "Ny händelse" (#206), och Ekonomimodulen (#184 del 1: hubben per grupp, modulens insida, `hubb` krävs på varje `defineModule`), i ett släpp. En ny samling med nya regler (svaren) och ändrad text i kalenderfragmentet: reglerna deployas FÖRE klienten, se "Att göra i appen". `defineModule` kräver `hubb` (även som `null`), se Ekonomimodulen. Inga exporter försvinner.**
Händelsen: CP 2026-09-29 21:10 i [#179](https://github.com/cllp/ops-framework/issues/179): *"Vidare kunna skapa olika kalendrar och filtrera på alla eller specifika för gruppen."* Och CP 2026-09-30, tillägget i samma ärende: *"Skapa händelse, man skall kunna välja att skapa en händelse i olika kalendrar ju, om man vill skapa egna kalendrar, men om det är i gruppens kalender så skall vi kunna välja att händelsen skall kräva medlemmars bekräftelse confirm/decline (optional) samt om det skall gå ut mail. Om det går bekräftelse skall det hamna i allas inkorg."* [#206](https://github.com/cllp/ops-framework/issues/206): appen bar dagen till "Ny händelse" med en brygga (`forifylldDag.js`, en modulvariabel som gällde i två sekunder), eftersom `useOppnaSkapa()` bara tog `{ groupId }`.

### F2: hantera kalendrar
- **`OpsKalendrar`**, förebild SS `components/PersonalCalendarsInlineSection.jsx` i kalenderhubben: ett kort för gruppens kalendrar och ett för mina, en rad per kalender med märke, namn och "Förvald", och "Ny kalender" som fäller ut redigeraren (namn, sex färger, åtta ikoner, Förvald, Avbryt och Skapa lika breda). Skapa, byta namn, färg, ikon, **ordning** (upp och ned), **förvald** och **arkivera** (arkiverade under en egen rubrik med "Ta fram"). Gruppens kalendrar ändras bara av ägare och admin; utan rätten ritas listan utan knappar och med raden "Bara gruppens ägare och admin ändrar gruppens kalendrar." Ett fel från sparningen står utskrivet.
- De rena funktionerna bakom: `kalenderIdUrNamn`, `nastaOrdning`, `flyttaKalender` (**numrerar om**: två kalendrar med samma `ordning` byter annars inte plats), `valjForvald` (svarar med den nya OCH den gamla förvalda, som källan skriver i en batch), `arkiveraKalender` (en arkiverad är aldrig förvald), och `kalenderval`, listan som matar både kalenderns filter och "Skapa i".
- **`createKalenderkalla`**: `gruppens`, `sparaGruppens`, `mina`, `sparaMina`, `poster`, `sparaPost`, `taBortPost`. Flera rader i en batch när källan kan, annars `atomar: false` i svaret.
- **`OpsCalendar`**: "Hantera kalendrar" är en knapp (`onHanteraKalendrar`). Raden som sade att den kom i F2 är borta; utan `onHanteraKalendrar` ritas ingen rad. Filtret är utbrutet till `filtreraPoster` och `forvaldKalenderId`, så att klarkriteriet går att prova direkt.
- **"Skapa i"** får gruppens kalendrar och "Mina kalendrar" (se F3). Ingen gruppväljare: det finns alltid exakt en aktiv grupp sedan 0.35.0. `OpsSkapaI` tar `valdSektion`, eftersom gruppens "privat" och min "privat" är två kalendrar.
- ⛔ **"Tas med i flödet" visas inte.** SS har rutan, men flödet är F4 och finns inte; ett val som inte gör något är värre än inget (punkt 5). `iFlodet` bevaras orört.

### F3: händelsemodellen (ramverkets del; appens händelser är appens data)
- **Kontraktet** (`HANDELSEKONTRAKT`, `handelsefel`, `handelsensKalenderId`, `handelsensDagar`), med appens egna fältnamn (`datum`, `tid`, `slutTid`, `heldag`, `groupId`) och tre nya: `kalenderId` (⛔ saknas den gäller gruppens förvalda kalender, så befintliga rader stämmer **utan bakfyllnad**), `slutDatum` (sista dagen, bara när den är efter `datum`) och `kravSvar`. Poster i mina kalendrar med `blockerar` (fältet fanns sedan 0.36.0) får nu sin väg in: formuläret.
- **"Ny händelse"** med `skapa.handelse.kalendrar = { gruppens, mina }`: raden **Kalender** står överst (den öppnar "Skapa i" med den aktiva gruppens kalendrar och "Mina kalendrar", gruppens förvalda förvald). Bara i en gruppkalender visar skalet **Kräv svar** (av från början); i en av mina **Blockerar tillgänglighet** och inget typval (en egen post har ingen typ). Formuläret får `kalender: { id, slag }`, `kravSvar`, `blockerar` och `datum`. ⛔ **"Skicka mejl" visas inte**: avsändarbeslutet (#180 G3) saknas. I en egen kalender finns inga svar.
- **Svaren Kommer / Kommer inte**: en rad per person och händelse i `<handelser>/{händelse}/<svar>/{uid}`. **Nyckeln är personen**, unikheten kommer ur sökvägen, och ingen kopia av händelsen eller personen står på raden (punkt 2). `SVARSVAL`, `byggSvar`, `createSvarskalla` (`lista`, `mina`, `svara`), `sammanstallSvar` ("3 kommer, 1 kommer inte, 2 har inte svarat", **alltid alla tre delarna**, och bara medlemmarnas svar räknas), `OpsSvar`, `OpsSvarsknappar`. Två svar och inte tre som SS (Ja, Nej, Kanske): CP bad om confirm/decline.
- **Inkorgens rad räknas fram och skrivs inte** (`svarsrader`, `OpsSvarsrad`): händelser som kräver svar, som personen inte svarat på och som inte passerat, ur händelserna och personens egna svar, som `samtalsnotiser`. Ingen server, ingen fan-out, ingen inkorgspost per medlem, och raden försvinner i samma stund som svaret skrivs. En skriven post hade krävt Admin SDK (en klient skriver inte i någon annans namn) och varit en andra sanning om samma obesvarade fråga.
- **`handelseregelfragment({ handelser, svar, gruppkalendrar })`**: svaren skrivs **bara av personen själv**, bara av en aktiv medlem i händelsens grupp och bara när händelsen har `kravSvar == true`; gruppens medlemmar läser; ingen radering ("har inte svarat" och "tog tillbaka" är olika). Och **`opsHandelsefaltGiltiga(ny, fore)`** för appens eget händelseblock: `kalenderId` en av GRUPPENS kalendrar och inte arkiverad (⛔ prövas bara när den ändras, annars kan en händelse i en kalender som arkiverats efteråt aldrig rättas), `kravSvar` bool, `slutDatum` efter `datum`.
- ⛔ **Upprepning av händelser ingår inte.** CP har inte beslutat om veckovis upprepning som i SS eller ingen alls (#179 avsnitt 6).

### #206: dagen till formuläret
`useOppnaSkapa()("handelse", { datum: "2026-10-12" })` lägger dagen i skalets beskrivning av formuläret, och formuläret får den som prop (`datum`). Adressen bär den som `&datum=`, på samma sätt som `grupp=` för redigera-grupp, så en omladdning ger samma dag; utan parametern får formuläret `null`. Ett datum som inte finns (31 februari, fel form) kastar när appen skickar det, och i adressen öppnas formuläret utan dag och felet rapporteras (`rapporteraFel`). `datum` till något annat än händelsen kastar.

### Kalendern på telefon mot SS-appen (CP 2026-09-30)
Händelsen: CP 2026-09-30 22:30, med en skärmbild ur SS-appen bredvid vår (`ramverket-390-cp.png` mot `ss-390-cp.png`): *"Rundningen i cellerna är fel."* Och om märkena, efter att först ha velat behålla ikonerna: *"Vi kanske skall ta SessionStudios format rakt av och ha prickar och streck istället med rätt färg för kategori?"*

⛔ **0.36.0:s montage jämförde mot fel förebild.** Det ställde ramverket bredvid en SS-sida som var renderad ur SS webbkällan (`CalView.jsx`) i vår egen byggmiljö, inte bredvid SS-appen som CP har i handen. Webbens rutnät och appens är olika (rundning, siffrans plats, band mot streck, panelens form), så montaget kunde inte visa det CP såg. Förebilden för telefonen är från 0.37.0 **CP:s egna skärmbilder ur SS-appen**, och montaget i `docs/jamforelser/0.37.0/` står bredvid dem.

- **Rutans rundning ur tokens**: `rounded-base` (`--radius-base`, 12 px, SS-appens `radius.md` och SS webbs `rounded-xl`), den valda `rounded-lg` (16 px, SS `radius.lg`). 0.36.0 hade ramverkets `rounded-xl`, som är 20 px: på en 44 px bred ruta nästan en kapsel. Mjuk yta och en tunn kant.
- **Märkena är SS format rakt av**: prickar (6 px) för endagsposter och streck (10 x 4 px) för flerdagsposter, strecket i **varje** ruta posten täcker, två rader och "+N" för resten (`markorlayout`, porterad ur SS `calendarDayMarkerLayout.js`). **Varje märke i sin kategoris färg** (slaget, annars kalendern): det är CP:s tillägg, SS-appen ritar dem i en färg. ⛔ **Inga ikoner i rutan längre.** 0.26.0 ritade slagets ikon (CP 2026-09-24, formen som andra kodning); ikonerna står kvar i dagpanelens kort, `OpsEventList` och snabbtitten, där slagets ord också står. Banden ritas från 640 px som förut.
- **Vald är en mörk fylld ruta med ljus text** (ramverkets inverterade yta, SS-appens mörka `accent`), en aning förstorad. **Idag är en mörk cirkel på 28 px** runt siffran, i en ruta med mörkare kant. Siffran står centrerad på telefon.
- **Verktygsraden på telefon**: Sök, Veckonummer, Typ och status som rena ikoner till vänster (ingen ruta), kalenderpillret med text längst till höger, 44 px osynlig träffyta kvar. Skapa står inte i raden på telefon: plusset i bottenraden gör det. Från 768 px som förut.
- **Idag-knappen** står mörk och centrerad över rutnätet, ovanför dagpanelen när den är öppen (0.36.0: nere till höger, ovanpå korten).

### Dagpanelen på telefon (CP 2026-09-30)
Händelsen: CP 2026-09-30, med två skärmbilder ur SS-appen (`ss-dagpanel-scroll-390-cp.png`, `ss-dagpanel-en-dag-390-cp.png`): panelen är bubblor som flyter över rutnätet, inte ett blad under det.
- **Bubblorna flyter över rutnätets nedre del**, utan egen yta eller kant, högst 45 procent av ytan. Rullytan behåller sin höjd och får lika mycket luft i botten, så att sista raden går att nå. 0.36.0 staplade panelen under rutnätet och krympte det.
- **Raden med datumpiller**, varje piller med sitt eget kryss (också när bara en dag är vald), och krysset som stänger allt till höger.
- **En bubbla med posterna**, med rubrikerna **Grupp** och **Mina** när båda slagen finns, **tak 140 px** (SS `abEventsScroll`) och egen rullning; kalendern bakom står still när bubblan rullas. 0.36.0 hade ett kort per post.
- **Antalet och Skapa** som två rutor till höger, som SS.
- **En egen bubbla för lager** (`OpsCalendar daglager`), plats för F6. Den ritas bara när den har innehåll.

### Plats för F6 i rutan (CP 2026-09-30)
Händelsen: CP 2026-09-30, med en skärmbild ur SS-appen med lager och tillgänglighet påslagna (`ss-lager-tillganglighet-390-cp.jpg`): *"Även sedan med kalender lager och tillgänglighet kommer vi att behöva rendera som i ss."* F6 byggs inte här; rutan får platserna. `OpsCalendar dagdekor(dayKey)` ger `{ ton, hornmarken }`: en ton ur identitetspaletten som bakgrund, och runda märken i rutans övre högra hörn (högst 6 px utanför, som SS), vars ord läses upp i rutans namn. Dagsrutan är utbruten ur `OpsCalendar.jsx` till `OpsCalendarDagruta.jsx` (rutan, siffran, märkesraden, pillerraden, hörnmärkena), färgerna till `lib/kalenderfarg.js` och märkeslayouten till `markorlayout` i `lib/calendar.js`.

### Gruppväxlaren på telefon (CP 2026-09-30)
Händelsen: CP 2026-09-30, med en skärmbild av arket "Byt grupp": *"Ta bort skapa grupp från gruppväljaren. Vill att det skall vara rent där. Finns ju andra ställen att skapa grupp ifrån"*, och rättelsen samma kväll: *"Nej bara i mobil vy."*
- **Arket "Byt grupp" har ingen "Skapa grupp".** En ny grupp skapas med plussets "Ny grupp". `OpsGruppvaxlare` tar inte längre `onSkapa` och `skapaEtikett`. Utan grupper säger arket *"Du är inte medlem i någon grupp än. Skapa en med plusset."* i stället för att vara tomt (punkt 5).
- **Gruppanelen på dator behåller sin "Skapa grupp"** (`onSkapa`, `skapaEtikett` på `OpsGruppanel` är oförändrade).

### Rättat
- ⛔ **Mina kalendrar och posterna gick inte att skriva genom ramverkets egen källa.** 0.36.0:s regel krävde `request.resource.data.id == kid` (och `pid`), alltså nyckeln en gång till på raden. Adaptern (`create` i `src/data/firestore.js`) tar `id` ur datan och gör det till dokumentets nyckel, så varje skrivning genom `createFirestoreSource` hade nekats. Det syntes inte i 0.36.0 eftersom regelproven skrev med `setDoc` direkt och ingen klient skrev ännu. Nu står `id` inte på raden alls (punkt 2): nyckeln är sanningen. Mätt: det nya regelprovet skriver genom källan och är **rött mot 0.36.0:s regel (6 prov)**.

- ⛔ **Den valda dagen hamnade under pillerraden på telefon.** CP 2026-09-30, med `ss-dagpanel-en-dag-390-cp.png` bredvid vår bild: i SS-appen rullas den valda veckan upp ovanför den flytande panelen, hos oss täcktes en ruta långt ner i rutnätet av panelen. `OpsCalendar` mäter nu den översta valda rutans underkant mot panelens överkant (`getBoundingClientRect`, ingen egen siffra; luften är rutnätets radavstånd) och rullar bara det som saknas, uppåt, på rullbehållaren (`scrollBy`, inte `scrollIntoView`). Bara under 1024 px, där panelen flyter; på dator ligger den i en egen kolumn. Skalytan, avsnitt 30 (h): rutan läggs med en tredjedel under panelens topp före trycket och måste ligga helt ovanför efter. **Röd utan rättelsen** (rutans underkant 556,9 mot panelens topp 493), **grön med** (484,9 mot 493).
- ⛔ **`OpsSvar`: det egna namnet trycktes ihop till "Ann…" av knapparna vid 390 px.** Knapparna får en egen rad under namnet under 768 px (`w-full`) och står bredvid från 768 px som förut; `OpsSvarsknappar` fick `className`. Skalytan, avsnitt 33: namnet får inte vara avkortat (`scrollWidth` över `clientWidth`) och knapparna ska ligga under det vid 390. **Röd utan rättelsen** (namnet avkortat 37 px, knapparnas topp 248 mot namnets underkant 280), **grön med** (0 px, 288 mot 272).

### Röd utan fixen, grön med den
- **Regelprov** (`rules/__tests__/kalenderhantering.test.mjs`, 17 prov, och `kalendrar.test.mjs` med raderna i adapterns form): alla 165 gröna. **15 mutationer i `regler.js`, en i taget, alla röda**. Två var först gröna och fick bättre prov: en mutation som skulle göra svaren raderbara träffade fel block (mutationen, inte provet), och "slutDatumets form oprövad" var grön eftersom `"12 okt"` sorterar före datumet och faller på jämförelsen; ett slutdatum med månad 13 lades till.
- **Enhetsprov**: nya `kalenderhantering.test.jsx` (33). Mot 0.36.0 faller filen vid import. **21 mutationer** i logiken, kalendern och växlaren, en i taget mot `kalenderhantering`, `calendar`, `kalendrar` och `gruppformular`: 20 röda direkt; den 21:a ("lagerbubblan ritas alltid") var grön, och ett prov för `daglager` lades till som är rött med mutationen och grönt utan. ⛔ **Befintliga prov är ändrade och bör granskas av någon annan (arbetsreglernas punkt 9):** i `kalendrar.test.jsx` provet för raden "kommer i nästa steg" (borta med flit); i `calendar.test.jsx` fem prov för ikonerna i rutan (ersatta av prickar, streck och "+N"), provet "staplar panelen UNDER rutnätet" (ersatt av att den flyter), "ett EGET kort per post" (ersatt av en bubbla) och krysset på pillret (nu också vid en dag); i `gruppformular.test.jsx` provet för "Skapa grupp" i växlarens ark (nu att den INTE finns). **Grön nu: `npm run check` 1726 prov i 87 filer, `test:rules` 165.**
- **`check-skalyta`**: avsnitt 30 omskrivet för telefonen (rundning 12 och 16, siffran centrerad, idag en 28 px cirkel, prickar och streck i kategorins färg, strecket i varje ruta, inga ikoner och inga band vid 390, verktygsraden, Idag-knappen, dagpanelen som flyter, bubblans tak och egen rullning, Grupp och Mina, ingen lagerbubbla utan innehåll, ton och hörnmärken), växlarens ark vid 390, och nya avsnitt 31 till 33 (Hantera kalendrar, Ny händelse med kalender och dagen, svaren, vid 390 och 1280): **1219 kontroller, inga brott. Mot 0.36.0:s bygge och tokens: 55 brott.** **36 mutationer, en i taget: 35 röda.** Den gröna tar bort `overscroll-contain` från bubblan och platsen: i Chromium finns ingen rullbar förälder ovanför bubblan (dokumentet är lika högt som fönstret), så inget kan kedja. Provet mäter kravet (ingen annan rullyta rör sig när bubblan rullas) och egenskapen står kvar för iOS studs; det har inte gått att mäta här.
- **Montage mot SS** i `docs/jamforelser/0.37.0/`, med en ärlig jämförelse i `jamforelse.md` (regel 12).

### Moduler per grupp (#184)

⛔ **Del 1 i [#184](https://github.com/cllp/ops-framework/issues/184): hubben visar den aktiva gruppens moduler, och en modul har en egen insida. BRYTANDE för varje `defineModule`: fältet `hubb` krävs, även som `null`. Inga exporter försvinner, och `OpsHub`/`OpsHubModul` fungerar som förut.**
Händelsen: CP 2026-09-30, med en bild av hubbens meny (Översikt, Ekonomi, Liv, Schema, Cutover, Bolaget, Kontakter, Länkar, Jämförelse): *"Ekonomi är EN modul. Inte massa moduler med komponenter."* Samma dag: det finns alltid exakt en aktiv grupp (0.35.0, [#190](https://github.com/cllp/ops-framework/issues/190)), så punkt 1 i #184 om "Alla mina grupper" utgår; Ekonomi är EN modul i gruppen bolaget, med privatekonomin i samma grupp; modulens startsida är översikten med flikarna Privat, Företag och Samlat (cllp/bolag-ops#486).

#### Registret är manifestet
- **`defineModule` får fältet `hubb`**: `{ ikon, rutt, startsida, delar: [{ id, namn, ikon, rutt }] }` eller `null`. Det bor i manifestet och inte i ett eget register, eftersom `groups.moduler` redan pekar på `defineModule`-id: två listor över vilka moduler som finns hade glidit isär (regel 2). Ramverket vet aldrig vad Ekonomi är.
- ⛔ **`hubb` krävs även som `null`**, av samma skäl som `katalog: null` i en skapa-registrering: en modul som glömt sitt kort och en som inte ska ha något ser annars likadana ut (regel 5).
- Validering vid uppstart: ikonen är ett React-element (kontrollerat utan att importera React, eftersom regelgeneratorn läser manifestet i Node), modulens adress börjar med snedstreck och slutar inte med ett, minst en del, **varje dels adress ligger under modulens** (`/ekonomi/inkomster`, aldrig `/inkomster`), inga dubbletter, startsidan är en av delarna. `validateModuler` kastar på två moduler med samma adress i hubben och på en modul inuti en annan.

#### Hubben per grupp, modulens insida, gamla adresser
- **`OpsGruppHubb`**: ett kort per id i `grupp.moduler`, i gruppens ordning. En modul appen inte registrerat, eller en med `hubb: null`, ritas inte, och **en rad under korten säger vilken och varför**. En grupp utan moduler säger det med sitt namn ("Kalendern, chatten och inkorgen har gruppen ändå"). Pekar gruppen bara på moduler som inte kan ritas står det, inte "inga moduler". Beslutet bor i **`hubbForGrupp`**.
- **`hubbPoster`** ger samma kort som nav-poster, EN per modul och **inga barn**: det appen skickar som `moduler` till `OpsAppShell`, så att toppradens rullgardin bara listar moduler (#184 punkt 2).
- **`OpsModulSida`**: "Tillbaka" till hubben, modulens namn som rubrik och en rad **länkar**, en per del, med den öppna delen understruken i accent. Länkar och inte flikar: varje del har en egen adress, så bakåt, bokmärken och länkar i Inkorgen fungerar. Raden rullar i sidled när den inte får plats, och den öppna delen rullas in i raden. **`modulLage`** avgör vilken del som är öppen: modulens egen adress är startsidan, en undersida till en del markerar delen.
- **Gamla adresser:** **`byggOmdirigeringar(lista, moduler)`** tar `{ fran, till: { modul, del } }` och härleder måladressen ur manifestet, så ett id som inte finns kastar vid uppstart. `del: null` är modulens egen adress (startsidan) och skrivs ut; en utelämnad `del` kastar. En gammal adress får inte ligga i en modul eller ovanför en. **`omdirigera(href, omdirigeringar)`** tar med `?`, `#` och undersidor (`/kontakter/anna` blir `/ekonomi/kontakter/anna`). **`kontrolleraOmdirigeringar({ gamla, omdirigeringar, moduler })`** är appens prov: det jämför mot adresserna som FANNS, inte mot omdirigeringarna själva (regel 4, tautologisk lista), och har ett golv på en adress.
- **Välja moduler:** `OpsGruppFormular` får propen `moduler: { valbara, agare }` (`valbara` ur **`valbaraModuler`**). Bara i redigeringsläge och bara när `agare` är sant visas sektionen "Moduler": en knapp per registrerad modul med kort (`aria-pressed`), valordningen blir hubbens ordning, ett id gruppen har men appen inte registrerat ligger kvar med en rad som säger det. `onSpara` får `moduler` **bara** när sektionen visades; en admin skickar aldrig fältet, eftersom reglerna då avvisar hela sparningen.
- **Regler:** oförändrade (`moduler` är ägarens sedan 0.32.0). Nya regelprov för hubbens läsning, se nedan.

#### Röd utan fixen, grön med den (moduler per grupp)

Ekonomimodulen själv definieras i appen (cllp/bolag-ops), ramverket vet aldrig vad Ekonomi är (CP 2026-10-01: "Ekonomimodulen ligger i appen. Inte i ramverket").

- **Enhetsprov:** nya `src/__tests__/hubb.test.jsx`, 49 prov, bland dem **provet över bolag-ops faktiska lista**: de 16 adresser hubben ledde till vid cllp/bolag-ops@94aec4d leder alla till en del, varje del nås, och en glömd adress (`/process`) blir röd med namnet utskrivet. **Mot 0.36.0 faller filen vid import** (`lib/hubb.js` finns inte). **31 mutationer, en i taget, alla röda:** 6 i manifestets validering (`hubb` valfri, dels adress utanför modulens, startsida utanför delarna, ikon som sträng eller komponent, modul inuti modul, två delar på samma adress), 15 i `hubb.js` (saknad utan skäl i båda fallen, registrets ordning i stället för gruppens, startsidan inte öppen, undersida utan del, `/ekonomisk` inne i `/ekonomi`, `?#` tappas, undersidor följer inte med, utelämnad `del` släpps, levande adress och adress ovanför en modul släpps, golvet borta, levande adress räknas utan att vara en del, mål utan del räknas, barn i hubbens poster), 6 i komponenterna (modulval för admin och i skapa-läge, `moduler` skickas alltid, valordningen omvänd, okänt id försvinner, `aria-current` borta, raden om saknade moduler borta) och 4 i `check-skalyta` (nedan). Hela sviten: **87 filer, 1732 prov, gröna**.
- **Regelprov** (`rules/__tests__/grupper.test.mjs`, 6 nya): en medlem och en admin läser gruppens `moduler`, en avslutad medlem, ägaren av en annan grupp och en utan inloggning gör det inte, och **en fråga över alla grupper som har en viss modul avvisas** även för en medlem. Gröna, 154 av 154 med kalendrar, kataloger och samtal. **Mutationer i `regler.js`:** gruppen läsbar för alla inloggade: 3 av de nya röda (avslutad, annan grupp, frågan); läsbar bara för ägaren: 2 av de nya röda (medlem, admin).
- **`check-skalyta` avsnitt 9c** (hubben per grupp och modulens insida vid 390 och 1280): (a) gruppen med Ekonomi har ETT kort som leder till `/ekonomi`, inga delar i hubben, klick navigerar, och toppradens rullgardin listar bara Ekonomi utan utfällbara rader; (b) gruppen utan moduler säger det med sitt namn och har inga länkar; (c) en oregistrerad modul ger en synlig rad med id:t; (d) insidan: 14 länkar, EN öppen del med egen accentlinje, varje länk minst 44 px, raden rullar i sidled och sidan gör det inte, den öppna delen syns också när den är den sista (Jämförelse), tillbaka till `/hub`, rubriken. Grön: 1186 kontroller, inga brott. **Mot 0.36.0:s bygge: 15 brott.** **Mutationer i bygget, alla röda:** ingen inrullning av den öppna delen (2), accentlinjen genomskinlig (4), länkarna 32 px höga (4), raden bryts i stället för att rulla (2).
- **Regel 12:** det finns **ingen SessionStudio-förlaga** för en hubb med moduler per grupp eller för en moduls insida (SS har inga moduler), så inget montage. Närmast i SS är tillbaka-raden (`GroupDetailView.jsx:83`), som `OpsModulSida` återanvänder via `OpsHubTillbaka`, och flikraden (`OpsTabs`), vars utseende länkraden följer.

#### Att göra i appen för Ekonomimodulen (bolag-ops), cllp/bolag-ops#486
Mätt i cllp/bolag-ops@94aec4d. **Hubbens rader i dag** (`web/src/app/navigering.jsx`, `byggModuler`) och rutterna i `App.jsx:694-728`:

| Rad i hubben | Adress i dag | Blir delen |
|---|---|---|
| Översikt | `/oversikt` | `oversikt` (startsidan, flikarna Privat, Företag, Samlat) |
| Ekonomi (modulsida) | `/hub/ekonomi` | modulens egen adress, `del: null` |
| Ekonomi / Ekonomiöversikt | `/ekonomi` | ⛔ krockar: `/ekonomi` blir modulens adress, se nedan |
| Ekonomi / Inkomster | `/inkomster` | `inkomster` |
| Ekonomi / Kostnader | `/kostnader` | `kostnader` |
| Ekonomi / Abonnemang | `/abonnemang` | `abonnemang` |
| Ekonomi / Tillgångar | `/tillgangar` | `tillgangar` |
| Ekonomi / Pension | `/pension` | `pension` |
| Ekonomi / Försäkringar | `/forsakringar` | `forsakringar` |
| Liv | `/liv` | `liv` |
| Schema | `/schema` | `schema` |
| Cutover | `/process` | `cutover` (eller `process`, appens val) |
| Bolaget | `/bolaget` | `bolaget` |
| Kontakter | `/kontakter` | `kontakter` |
| Länkar | `/lankar` | `lankar` |
| Jämförelse | `/jamforelse` | `jamforelse` |

Övriga rutter, som inte är moduler och ska stå kvar: `/`, `/kalender`, `/hub`, `/inkorg`, `/meddelanden`, `/fraga`, `/sok`, `/hjalp`, `/primitiver`, `/installningar`, `/profil`, `/grupp/:id`, `/hem` (till `/`), `*`.
⛔ **Mätt avvikelse mot #486:** ärendet räknar upp Skatt, Moms och Bokslut som delar. De finns inte i appens hubb i dag (bara i ramverkets provfixtur); appen har Abonnemang, Tillgångar och Försäkringar i stället. Listan ovan är den mätta.

1. **Pinna om** och lägg `hubb: null` på appens egen `defineModule` (`web/src/data/samtal.jsx`, modulen `meddelanden`). Utan det kastar appen vid uppstart: `modul "meddelanden": hubb krävs`.
2. **Registrera modulen `ekonomi`** med `defineModule({ id: "ekonomi", namn: { sv: "Ekonomi", en: "Finance" }, ..., hubb: { ikon, rutt: "/ekonomi", startsida: "oversikt", delar: [...] } })`, med delarna i tabellen och adresserna `/ekonomi/<del>`. ⛔ **Ekonomiöversikten (`/ekonomi`, `EconomyView`) och Översikt (`/oversikt`, `OverviewView`) blir EN översikt** (CP: "Inne i modulen blir det en enda översikt, och det är den med de tre flikarna"); vilken vy som bär flikarna, och vad som händer med den andra, avgörs i appens PR och mäts före.
3. **Hubben:** `/hub` ritar `<OpsGruppHubb grupp={aktivGrupp} moduler={registrerade} info={...} />`, och skalet får `moduler={hubbPoster(hubbForGrupp({ grupp, moduler }).kort, { info })}`. `HubView`, `HubModulView`, `byggModuler`, `EKONOMI_HUB` och `hubPlats` ersätts. `modulinfo.js` nycklas på modul-id i stället för adress.
4. **Insidan:** en rutt per del under `/ekonomi/...`, var och en lindad i `<OpsModulSida modul={ekonomi} activeHref={pathname} hubHref="/hub" onNavigate={...}>`. `Sida`s egen tillbaka-rad ritas inte där (sidan har redan en).
5. **Omdirigeringar:** `byggOmdirigeringar` med en rad per gammal adress i tabellen (`/hub/ekonomi` till `del: null`), en `<Route>` per rad som gör `<Navigate to={omdirigera(location, OMDIRIGERINGAR)} replace />`, och ett prov som kör `kontrolleraOmdirigeringar` över **listan i tabellen ovan, skriven ut ur dagens `App.jsx`**, inte ur omdirigeringarna. Länkar i Inkorgen och i ärenden (`href: "/kostnader"` och liknande i `data/`) leder då rätt utan att skrivas om, men bör ändå pekas om i samma PR.
6. **Välja moduler:** ge `OpsGruppFormular` i `redigeraGrupp` propen `moduler={{ valbara: valbaraModuler(registrerade), agare: g.roll === "agare" }}`, och låt `gruppandring` (`web/src/data/minaGrupper.js`) ta med `moduler` **när det finns**. I dag släpper den bara de sju admin-fälten, och kommentaren där om att `moduler` nekas "även för en ägare" stämmer inte: reglerna kontrollerar det som ändrades, och `moduler` är ägarens fält.
7. ⛔ **`moduler: ["ekonomi"]` på bolagets grupp sätts av CP**, som ägare, i gruppens inställningar i appen. Inte av ett skript och inte av en agent: det är Firestore-data. Tills det är gjort visar hubben i bolagets grupp "Inga moduler i gruppen", och Ekonomis delar nås via omdirigeringarna.

### Att göra i appen (bolag-ops), och ordningen: regler före klient
⛔ **En ny samling med nya regler (svaren), och ändrad text i kalenderfragmentet.** Läser eller skriver klienten svaren innan reglerna ligger i produktion faller det på catch-allen ("Missing or insufficient permissions", appens `CLAUDE.md`).

**Steg 1 (app, ompinning till 0.37.0): regelfragmenten.**
- Generera om `kalenderregelfragment(...)` (texten ändras: `id` står inte längre på raden). Byte-vakten i `scripts/check-regelfragment.mjs` blir röd tills det är gjort, och det är avsett.
- Lägg `handelseregelfragment({ handelser: "handelser", svar: "svar", gruppkalendrar: "gruppkalendrar" })` i `firestore.rules` efter `kalenderregelfragment(...)`, mellan egna markörer, och en femte post i `FRAGMENTEN` så att det byte-kontrolleras. `svar` är undersamlingens namn under appens `handelser`; ingen annan undersamling där får heta så.
- I appens eget block `match /handelser/{id}`: lägg `kalenderId`, `slutDatum` och `kravSvar` i `hasOnly` (create) och i `affectedKeys` (update), och anropa `opsHandelsefaltGiltiga(request.resource.data, {})` i create och `opsHandelsefaltGiltiga(request.resource.data, resource.data)` i update. Regelprov för de tre fälten i appens `test:rules`.
- *Mellan steg 1 och 2:* ingenting skriver de nya fälten eller svaren än. Ingen skillnad för användaren.

**Steg 2 (CP, regeldeploy), med kontrollsteget först:** `cd ~/AI_Workfolder/bolag-ops && git checkout main && git pull && grep -c "opsHandelsefaltGiltiga" firestore.rules`. Väntat svar: `main` och ett tal större än noll. Därefter `cd ~/AI_Workfolder/bolag-ops && npx --yes firebase-tools@14 deploy --only firestore:rules --project operations-hub-ee63f`.

**Steg 3 (app, klienten), efter regeldeployen:**
1. **Samlingsnamnen appen skickar in:** `createKalenderkalla({ kalla, anvandare: "users", gruppkalendrar: "gruppkalendrar", minaKalendrar: "minaKalendrar", kalenderposter: "kalenderposter" })` och `createSvarskalla({ kalla, handelser: "handelser", svar: "svar" })`, samma namn som till regelfragmenten.
2. **Hantera kalendrar:** `OpsCalendar onHanteraKalendrar` öppnar en vy med `OpsKalendrar` (`kanAndraGruppens` = rollen `agare` eller `admin`, `onSparaGruppens` och `onSparaMina` till källan). `OpsCalendar kalendrar={kalenderval({ gruppens, mina })}`, och mina poster ritas med `postTillRad`.
3. **`kalenderId` på appens händelser:** `skapa.handelse.kalendrar = { gruppens, mina }`. Formuläret skriver `kalenderId` när `kalender.slag === "grupp"`, `kravSvar: true` bara när det är på (utelämnat annars), och `slutDatum` för en flerdagshändelse; när `kalender.slag === "mina"` skriver det en post med `createKalenderkalla().sparaPost` (med `blockerar`). I kalendern får en händelse `kalender` ur `handelsensKalenderId` och `date`, `endDate`, `allDay` ur `handelsensDagar`. Befintliga händelser rörs inte: utan `kalenderId` hör de till gruppens förvalda.
4. **Svaren:** i händelsens detalj `OpsSvar` med `createSvarskalla().lista(id)` och gruppens aktiva personer; i Inkorgen `svarsrader({ handelser, mina: await svarskalla.mina(ids, uid), idag: idagI() })` som `OpsSvarsrad`.
5. **Gruppväxlaren:** inget att göra om appen går genom `OpsAppShell` (skalet skickar inte längre `onSkapa` till arket). Ritar appen `OpsGruppvaxlare` själv tas `onSkapa` och `skapaEtikett` bort där; plussets "Ny grupp" kräver `skapa.grupp`.
6. **Bort med `web/src/data/forifylldDag.js`:** kalenderns `onSkapa(datum)` gör `oppna("handelse", { datum: datum[0] })`, och formuläret läser propen `datum`. Appens prov: dagen följer med vid klick och omladdning, och inte utan parametern.
7. **Första gruppkalendern:** skapas av gruppens ägare eller admin i "Hantera kalendrar" (Ny kalender), och den första blir förvald av sig själv (härledd ur ordningen, inte skriven). ⛔ **Appen seedar inte Firestore i ett skript.** En seedning hade skrivit `forvald: true` på en rad ingen valt (två sanningar om samma sak, ordningen och raden), och en agent rör ingen Firestore-data (appens `CLAUDE.md`). Tills den finns säger filtret "Gruppen har inga kalendrar ännu", raden i "Ny händelse" "Ingen kalender ännu", och befintliga händelser syns som förut.

### Ordningen
1. Ramverket mergas, taggas `v0.37.0` och publiceras.
2. Appens ompinning till 0.37.0 med regelfragmenten (steg 1) och Ekonomimodulens punkt 1 till 6 (`hubb: null` på appens egen modul först, annars kastar appen vid uppstart), i samma pass (arbetsreglernas punkt 11). Mergas efter ramverket.
3. CP deployar reglerna (steg 2). Ekonomimodulen kräver ingen regeldeploy.
4. Klienthalvan (steg 3) mergas efter regeldeployen.
5. CP sätter Ekonomi på bolagets grupp i gruppens inställningar (Ekonomimodulens punkt 7).

## 0.36.0

⛔ **Kalendrarna (#179 F0) och månadsvyn som SessionStudios (#179 F1), i ett släpp. Nya samlingar med nya regler: reglerna deployas FÖRE klienten, se "Att göra i appen". `OpsCalendar` byter utseende och förval, inga exporter försvinner.**
Händelsen: CP 2026-09-29 21:10 i [#179](https://github.com/cllp/ops-framework/issues/179): *"Kolla alla kalender inställningar och funktioner i SessionStudio. Grundlig analys. Samma vill jag ha i ramverket. Vidare kunna skapa olika kalendrar och filtrera på alla eller specifika för gruppen."* Beslutet samma kväll: flera namngivna gruppkalendrar per grupp och egna privata ("Mina"). Efter 0.35.0 ([#190](https://github.com/cllp/ops-framework/issues/190)) har filtret två nivåer: kalendrar (alla, eller valda av den aktiva gruppens och mina) och typ, status och sök. Flödestoken och import (F4, F5) ingår inte.

### F0: datakontrakt och regler (ingen yta)
- **Gruppens kalendrar är en katalog på typernas motor.** `byggGruppkalender` bygger med `byggKategori` (`faser: false`): namn, färg, ikon, ordning, arkiverad, `groupId`, plus `forvald` och `iFlodet`. `KALENDERFALT` är **härledd** ur `KATEGORIFALT` (utan `fas`), inte skriven för hand. Nyckeln är katalogens `groupId|id` (`gruppkalendernyckel`). `validateGruppkalendrar`: högst en förvald, aldrig en arkiverad förvald, en grupp per lista. `forvaldKalender` härleder den förvalda ur ordningen när ingen valt, i stället för att en seedning skriver `forvald: true` (två sanningar).
- **Färgen är identitetspalettens sex toner** (`KALENDERFARGER`), inte slagpalettens tre: en kalender står alltid med sitt namn, så färgen är andrakodningen, och tre färger hade tvingat fram dubbletter vid fjärde kalendern.
- **Mina kalendrar och deras poster ligger under användaren**, med samlingsnamn som appen skickar in. `byggMinKalender`, `validateMinaKalendrar`, `byggKalenderpost` (`kalenderId`, `titel`, `beskrivning`, `plats`, `start`, `slut`, `heldag`, `blockerar`). Heldag är `YYYY-MM-DD` med `slut` som sista dag, annars `YYYY-MM-DDTHH:MM` väggklocka. `slut` aldrig före `start`, och ett datum som inte finns (31 februari) kastar. `beskrivning` och `plats` är tomma strängar när de saknas, aldrig utelämnade (punkt 5). `postTillRad` gör en post till en rad i `OpsCalendar`.
- **Tidszonen är en inställning** (`STANDARD_TIDSZON` = Europe/Stockholm, `kontrolleraTidszon`, `idagI`), inte en konstant som i SS `appTimezone.js`.
- **`CalendarEntry`** får `kalender` ({ id, namn, farg }), `endDate`, `allDay` och `typ`.
- **`kalenderregelfragment({ anvandare, gruppkalendrar, minaKalendrar, kalenderposter })`**: gruppens kalendrar får katalogens block med `KALENDERFALT` (medlem läser, ägare och admin skriver, nyckeln låst till radens grupp, ingen radering). Mina kalendrar och posterna läses och skrivs **bara av ägaren**; en annan inloggad, också en admin i samma grupp, läser dem inte. En post måste ligga i en av ägarens egna kalendrar som finns och inte är arkiverad, med tak på titel, beskrivning och plats, rätt form för `heldag` och `slut >= start`. Datumuttrycken i regeln är **härledda** ur samma `DATUMFORM` och `TIDPUNKTSFORM` som byggaren prövar med. En kalender raderas aldrig (arkiveras); en post får raderas av sin ägare, eftersom skälet till "aldrig radering" är någon annans fråga i efterhand och en privat post har ingen annan läsare.

### F1: månadsvyn som SS (`OpsCalendar`)
Förebilderna: SS `CalView.jsx`, `calView/MonthGrid.jsx`, `useCalendarDaySelection.js`, `CalendarDayPeekPopover.jsx`, `calendarSpanLayout.js`, `CalendarView.jsx`, `CalendarViewToolbar.jsx`. Filhuvudets förbud mot filter och dra-markering är omskrivet med skälet: kalendern har fått flera läsare och ett filter, och en flerdagspost har ingen plats i ett rutnät som bara ritar märken.
- **Löpande månadsvy 12 månader bakåt och 12 framåt** (förval ändrat från 1 och 3), rullad till innevarande, måndag först, flytande "Idag" med pil mot idag. **Rättat:** pilen räknades bara om när månaden korsade observatörens tröskel, så efter ett hopp förbi den pekade den fel; nu räknas den om vid rullning.
- **Rutan som SS:** ett kort med datumet uppe till vänster, idag som fyllt piller, det som varit nedtonat, prickar på telefon och piller med titel från 640 px (två, sedan "+N"). Märkenas regler ur 0.26.0 (räknaren tar märkenas plats) står kvar.
- **Veckonummer** av och på, sparat per enhet i `lagring` (förval `localStorage`; ett fel där loggas med `rapporteraFel` i stället för att tystas), och ett tryck på numret väljer veckan (`isoVecka`, `valjVecka`).
- **Dra-markering** med 12 px tröskel (`valjIntervall`, `datumOmfang`) och **flerdagsval** med datumpiller som har kryss. **Rättat under mätningen:** ett drag som slutar på en annan ruta ger inget klick, och flaggan som skulle svälja klicket åt upp nästa riktiga tryck; nu nollställs den vid varje ny gest.
- **Dagpanelen** vid sidan från 1024 px och **staplad under rutnätet** därunder, högst 45 procent av ytan, med rullytan kortad med panelens uppmätta höjd (till 0.35.0 en bubbla ovanpå rutnätet). Kort per post med spann, "Heldag" och kalenderns namn, och till höger antalet och en skapa-ruta. **En tom dag är nu tryckbar** och panelen säger "Inga poster".
- **Snabbtitt** (långtryck 450 ms eller högerklick): dagens alla poster, de som filtret döljer märkta "Dold".
- **Band per vecka** för flerdagsposter och heldag (`bandIVecka`), staplade i filer, titeln i varje vecka.
- **Verktygsraden:** Kalendrar (alla, eller valda av gruppens och mina; en post utan `kalender` hör till den förvalda; ett tomt urval är Alla; "Hantera kalendrar" är en rad som säger att den kommer i F2 tills `onHanteraKalendrar` finns), veckonummer, typ och status i en meny, sök som tonar ned dagar utan träff och skriver ut antalet (också "Inga träffar"), och "+". En kontroll som inte gör något ritas inte.
- **Rättat under mätningen:** `aspect-[1/1.1]` med SS `min-h-[52px]` gav en minsta BREDD på 47,3 px, och vid 390 px ryms 44,4. Rutorna sköt ut 20 px ur raden och kalendern fick vågrät rullning. Ingen minsta höjd under 640 px.

### Röd utan fixen, grön med den
- **Regelprov** (`rules/__tests__/kalendrar.test.mjs`, 25 prov): gröna, 148 av 148 med grupper, kataloger och samtal. **Utan kalenderfragmentet (som 0.35.0): 8 av 148 röda**, alla som ska släppas in. **13 mutationer i `regler.js`, en i taget, alla röda:** mina kalendrar läsbara för alla inloggade (2), posterna läsbara och raderbara för alla (3), posterna skrivbara för alla (1, se nedan), kalendern oprövad (3), arkiverad kalender oprövad (1), slut före start (1), formen oprövad (1), postens `hasOnly` borta (1), titeln oprövad (1), färgen oprövad (1), mina kalendrar raderbara (2), gruppkalendern med katalogens fält inklusive `fas` (1). **Fyndet:** "posterna skrivbara för alla" var först grön, eftersom kalenderns uppslag görs under ägarens sökväg och alltså lyckas; ett prov där en annan skriver i ägarens samling lades till.
- **Enhetsprov:** nya `kalendrar.test.jsx` (30) och omskrivna `calendar.test.jsx` (42). **Mot 0.35.0:** `kalendrar.test.jsx` faller vid import, `calendar.test.jsx` 9 av 42 röda. **18 mutationer, en i taget, alla röda**, bland dem: `fas: null` kvar på raden, två förvalda, idag i webbläsarens zon, 31 februari, flerdag bara på första dagen, alla band i fil noll, ISO-vecka utan torsdagsregeln, post utan kalender utanför den förvalda, klicket efter ett drag, snabbtitten utan det dolda, "Inga träffar" borta, veckonumret sparas inte, tidszonen ignorerad och en tom dag utan besked. Två var först gröna (tomt kalenderurval blir "inga", tidszonen ignorerad) och fick var sitt prov. **Grön nu: 86 filer, 1683 prov.**
- **`check-skalyta` avsnitt 30** (kalendern vid 390 och 1280, delarna a till j var för sig): grön, 67 kontroller. **Mot 0.35.0:s bygge: 36 brott av 44.** **11 mutationer i bygget, en i taget, alla röda:** rullytan kortas inte (2), minsta höjd 52 px på telefon (1), pilen räknas inte om (2), piller på telefon (1), dragets tröskel 1000 px (8), snabbtitten utan det dolda (2), sökningen tonar inte (2), ett år bakåt blir en månad (8), panelen utan tak (2, först grön: två tomma dagar ryms under taket, så avsnittet väljer nu tre dagar med fyra kort och kräver att panelen rullar), klicket efter ett drag sväljs (5), veckonumret väljer en dag (2). Avsnitt 24 (kalendern når bottenraden) är grönt med den nya kalendern. Hela vakten: 1115 kontroller, inga brott.
- **Montage mot SS** i `docs/jamforelser/0.36.0/`, med en ärlig jämförelse i `jamforelse.md` (regel 12).

### Att göra i appen (bolag-ops), och ordningen: regler före klient
⛔ **Nya samlingar med nya regler.** Läser klienten `gruppkalendrar` eller `minaKalendrar` innan reglerna ligger i produktion faller läsningen på catch-allen ("Missing or insufficient permissions", appens `CLAUDE.md`).

**Steg 1 (app, ompinning till 0.36.0): regelfragmentet.** Lägg `kalenderregelfragment({ anvandare: <samma som till regelfragment()>, gruppkalendrar: "gruppkalendrar", minaKalendrar: "minaKalendrar", kalenderposter: "kalenderposter" })` i `firestore.rules` efter `regelfragment()`, mellan egna markörer, och lägg en fjärde post i `FRAGMENTEN` i `scripts/check-regelfragment.mjs` så att det byte-kontrolleras som de tre andra. Samlingsnamnen är appens val; de ovan är förslag och förvalen. Ingen annan samling i appen får heta så.
- *Mellan steg 1 och 2:* ingenting läser samlingarna än. Ingen skillnad för användaren.

**Steg 2 (CP, regeldeploy):** `cd ~/AI_Workfolder/bolag-ops && npx --yes firebase-tools@14 deploy --only firestore:rules --project operations-hub-ee63f`. Kontrollera efteråt att `gruppkalendrar` finns i produktionens regler.

**Steg 3 (app): `/kalender`.** Mätt i cllp/bolag-ops `origin/main` (5d660b2):
- `web/src/app/views/CalendarView.jsx` ritar `OpsCalendar` med `kalenderposter(selectEvents(events, urval), handelsetyper)`, och `events` kommer ur `useEvents()`, alltså **Idags fönster**: `collectEvents(... horisont = 60)` i `web/src/data/events.js`, ingenting passerat och ingenting bortom 60 dagar. Kalendern ska läsa ett **eget** fönster: `kalenderfonster(idag)` ger `{ fran, till }` för exakt de 25 månader vyn ritar (september 2025 till september 2027 i dag). Använd samma två tal som till `monthsBack` och `monthsForward` (förval 12 och 12), och räkna inte fram fönstret i appen.
- `OpsFilterPanel` ovanför kalendern kan tas bort: filtret bor nu i kalenderns verktygsrad. Skicka `typer` (händelsetyperna, `{ id, namn }`) och sätt `typ` på varje post, och `statusWords={STATUS_WORDS}` som i dag.
- Nya props: `kalendrar` (den aktiva gruppens kalendrar med `grupp: true`, och mina), `typer`, `onSkapa(datum[])` (öppna "Ny händelse" med datumen, t.ex. via `useOppnaSkapa`), `onHanteraKalendrar` (utelämnas tills F2), `tidszon` (utelämnas: förvalet är Europe/Stockholm), `lagring` (utelämnas: `localStorage`).
- Nya fält på `CalendarEntry`: `kalender` (utelämnas för händelser tills F3; de hör då till den förvalda gruppkalendern), `endDate`, `allDay`, `typ`.
- ⛔ Ingen gruppkalender finns ännu i appen. Utan `kalendrar` visas ingen kalenderväljare; med en tom lista säger menyn "Gruppen har inga kalendrar ännu". Seedningen av gruppens första kalender hör till F2.
- Appens egna prov mot kalendern: `aria-label`s format ("12, 2 poster") är oförändrat, men en tom dag är nu tryckbar, dagpanelen staplas under rutnätet i stället för att ligga `fixed`, och titlarna står också i rutnätets piller (ett osagt `getByText` på en titel träffar två noder).

### Ordningen
1. Ramverket mergas, taggas `v0.36.0` och publiceras.
2. Appens ompinning till 0.36.0 med regelfragmentet (steg 1), i samma pass (arbetsreglernas punkt 11). Mergas efter ramverket.
3. CP deployar reglerna (steg 2).
4. Klienthalvan (steg 3) mergas efter regeldeployen.

## 0.35.0

⛔ **Exakt en aktiv grupp, och varje läsväg gäller bara den. Läget "Alla mina grupper" och läsningen över flera grupper är borttagna. Breaking: exporter försvinner, se "Att göra i appen".**
Händelsen: CP 2026-09-30 i [#190](https://github.com/cllp/ops-framework/issues/190): gruppen Travel valdes, och Idag visade fortfarande CPS AB:s rader (Adavo, attest, bank). Appens insvepning filtrerade `list` och `subscribe` på gruppen, men `read` av ett dokument gick orörd igenom, och reglerna frågar bara om personen är MEDLEM i radens grupp. För den som är med i båda grupperna kom grupp A:s dokument tillbaka när B var aktiv. CP samma dag: *"det som ska gälla för alla (bolag-ops, SessionStudio, varje app på ramverket), en regel i ops-framework, inte per app."* Och om läget: *"Ja, frågan om alla grupper: Ta bort det."* (läget kostade en gruppväljare före varje skapa-flöde och två lägen i varje yta, mätt till cirka 365 rader i 11 filer i ramverket och 2 i appen). Sist, om premissen för en samlad vy: *"Det är ingen privat grupp. Jag har en grupp som heter bolaget, men jag måste ha privatekonomi där för att få en total översikt. Det är bara en grupp. Ekonomimodulen bor där."* Privat, Företag och Samlat är alltså flikar över data i EN grupp, och ingen konsument läser över flera grupper.

### Regeln
- **Det finns alltid exakt en aktiv grupp.** `aktivGrupp(sparat, mina)` ger det sparade valet om personen fortfarande är med i gruppen, annars den **första** av `minaGrupper` (sorterade på namn). Ett sparat `"alla"` från en tidigare version blir alltså den första gruppen, aldrig ett fel och aldrig ett tomt läge. `null` betyder bara att personen inte har någon grupp.
- **`medAktivGrupp(kalla, { groupId, gruppade })` lägger den aktiva gruppen på varje läsväg.** Appen skickar in vilka samlingar som är gruppade (ramverket känner aldrig namnen; första ledet i sökvägen avgör).
  - `list`: `where.groupId` läggs på, en annan grupp i frågan kastar, och varje rad i svaret prövas (saknat `groupId` kastar, en annan grupps rad kastar).
  - `subscribe`: samma, och ett brott går till `onError`, aldrig till `onData`.
  - `read`: en annan grupps dokument ger **`null`**, alltså "finns inte" i den aktiva gruppen (kontraktets regel 3). Ett dokument **utan** `groupId` i en gruppad samling kastar: det är en bakfyllnad som inte gjorts, och den sorteras inte bort tyst.
  - `create` och `batch`: den aktiva gruppen sätts, en annan grupp i posten kastar. `update`: en ändring av `groupId` till en annan grupp kastar. `update` och `remove` läser inte först (det vore en läs-sedan-skriv-kontroll); reglerna vaktar flytt (`gruppenOandrad()`) och radering (`delete: if false`).
  - Varför `null` och inte ett fel för en annan grupps dokument: vyn ritar redan sitt tomma läge för `null`, och ett kast hade gjort varje vy som läser ett känt dokument-id (`read("data", "kundfakturor")`) till en röd banderoll i varje grupp utom en.
- **Källregistret** (`skapaKallregister`) kastar när en modul svarar med en rad vars `groupId` inte är frågans, och felet namnger modulen.
- **Allt som skapas hamnar i den aktiva gruppen**, utan gruppväljare. `skapalaget` ger `ingenGrupp` | `tomt` | `redo` (tidigare `valjGrupp`). "Skapa i" (`OpsSkapaI`) visar bara appens egna mål (`skapa.skapaISektioner`, t.ex. "Mina kalendrar") och öppnas bara från raden "Skapas i", aldrig före panelen. Ett meddelande skrivs i den aktiva gruppen och har ingen väljare.

### Borttaget
- `ALLA_GRUPPER`, `valtLage` (ersatt av `aktivGrupp`), `navForLage` (ersatt av `navForGrupp({ groupId, ramnav, moduler, mina })`), `gruppenAttSkapaI` (utan ersättare: gruppen är den aktiva).
- `grupperAttFraga`, `slaIhopSvar`, `listaPerGrupp`, `raderPerGrupp`, `OpsGruppfilter`, `OpsGruppmarke`. Ingen ersättare: ingen konsument läser över flera grupper (mätt i bolag-ops, se nedan).
- Raden "Alla mina grupper" i `OpsGruppanel` (panelen och den infällda remsan), i `OpsGruppvaxlare`s ark och i `OpsGruppvaljare`. Propen `allaEtikett` är borta; listans skärmläsarnamn är `listEtikett` (förval "Mina grupper"), och växlarens namn utan grupp är `ingenGruppEtikett` (förval "Ingen grupp").
- Sektionen Grupper i `OpsSkapaI` och dess props `grupper`, `sprak`, `grupperRubrik` och `medlemmarEtikett`. `OpsSkapa` tar `ingenGruppText` i stället för `valjGruppText`.
- Kvar och oförändrade: `minaGrupper` (utan krocken mot id:t `"alla"`, som inte längre är ett läge), `grupplagetsNyckel`, `lasAktivGrupp`, `sparaAktivGrupp(uid, groupId, lagring)` (kastar på tomt), `gruppLista`, `gruppSkapa`.

### Röd utan fixen, grön med den
- **Enhetsprov:** nya `aktivgrupp.test.jsx` (22: list, subscribe och read var för sig, genom `useCollection`, `useLiveCollection` och `useDocument`, med underlaget mätt först så att inget prov blir grönt av tom indata), och omskrivna `grupplage`, `gruppanel`, `skapapanel`, `skapa`, `meddelanden`, `kallor`, `skal031`, `marke`, `gruppformular`, `gruppg2`. **Mot 0.34.1: 25 av 155 prov röda** i de sex omskrivna filer som bär regeln (grupplage, gruppanel, skapapanel, skapa, meddelanden, kallor), och `aktivgrupp.test.jsx` faller redan vid import. **Grön nu: 85 filer, 1653 prov.**
- **11 mutationer, en i taget, alla röda:** `read` ger en annan grupps rad (2 prov), `read` utan `groupId` ger `null` (1), `list` utan gruppfilter (2), `list` prövar inte raderna (2), `subscribe` utan gruppfilter (3), källregistret släpper en annan grupps rad (1), ett sparat `"alla"` ger tomt läge (3), raden "Alla mina grupper" tillbaka i panelen (2), raden i remsan (1), gruppväljaren före panelen (1), exporten `ALLA_GRUPPER` tillbaka (1).
- **`check-skalyta`:** grön, 1048 kontroller. Mot 0.34.1:s bygge röd (panelen heter inte "Mina grupper", avsnittet avbryts). Mutationer i bygget, en i taget: raden "Alla" i remsan (4 brott, bland annat `remsan 1280 px: en post heter ["Alla mina grupper"]`), väljaren öppen före panelen (8 brott). Remsans golv är nu fem poster (växlaren, tre grupper, Skapa).

### Att göra i appen (bolag-ops)
Mätt i cllp/bolag-ops `origin/main` (a0131db), `web/src` och `functions`:
- `web/src/data/grupper.jsx` importerar `ALLA_GRUPPER`, `lasAktivGrupp`, `sparaAktivGrupp`. Ta bort `ALLA_GRUPPER` och grenarna `if (id === ALLA_GRUPPER) return;`: panelen skickar aldrig längre `"alla"`.
- `web/src/data/minaGrupper.js` importerar `ALLA_GRUPPER`. `valdGrupp` kan ersättas av ramverkets `aktivGrupp`, eller behållas om appen vill föredra `cps-ab` före den första gruppen (ramverket väljer den första). Villkoret `sparat !== ALLA_GRUPPER` behövs inte: ett sparat `"alla"` matchar ingen grupp.
- `web/src/data/grupp.js` (`medGrupp`, `medGruppIFragan`, `arGruppad`, `GRUPPADE_SAMLINGAR`) ersätts av `medAktivGrupp(kalla, { groupId, gruppade: GRUPPADE_SAMLINGAR })` i `GruppProvider`, `firebase.js` och `measurement.js`. ⛔ **Det är den här raden som täpper luckan:** appens `medGrupp` lämnar `read` orörd, och `data` är gruppad (`bakfyllnadsbeslut.mjs`). `useDocument("data", ...)` läses i `events.js` (Idag: `todos`, `kundfakturor`, `kostnader`, `forsakringar`), `overview.js`, `income.js`, `costs.js`, `insurance.js`, `pension.js`, `assets.js`, `subscriptions.js`, `tid.js`, `search.js`, `home.js`, `kontakter.js`, `modulinfo.js`, och `aktivitet.js` läser `ops/aktivitet-lasning`. Med Travel aktiv ger de `null` efter bytet.
- ⛔ **Varje dokument i en gruppad samling måste bära `groupId`**, annars kastar `read` i stället för att visa det. Bakfyllnaden i #447 skulle ha satt fältet; mät det innan ompinningen mergas (appens `measurement.js`-fixtur lägger på `groupId` på gruppade samlingar och döljer alltså inte en lucka i produktion).
- `App.jsx` rad 243 och 624: kommentarer om läget "Alla mina grupper" skrivs om. `skapa.lage: aktivGrupp` står kvar och betyder nu den aktiva gruppen, alltid.
- Proven `web/src/data/__tests__/grupper.test.jsx` (valet `"alla"` ignoreras) och `grupp.test.js`, `samtal.test.jsx`, `handelse-form.test.jsx` (bygger på `medGrupp`) skrivs om mot `medAktivGrupp`.
- ⛔ **`web/src/data/schedule.js` är statisk kod utan `groupId`** och läses av Idag (`events.js`) och `modulinfo.js`. Den går inte genom någon datakälla, så `medAktivGrupp` kan inte se den: appen måste avgöra i vilken grupp driftkalendern gäller (t.ex. bara `cps-ab`) eller flytta den till en gruppad samling.
- Används inte i appen (mätt, noll träffar utanför kommentarer): `valtLage`, `navForLage`, `gruppenAttSkapaI`, `grupperAttFraga`, `slaIhopSvar`, `listaPerGrupp`, `raderPerGrupp`, `OpsGruppfilter`, `OpsGruppmarke`, `OpsGruppvaljare`, `allaEtikett`, `skapaISektioner`. `functions/` använder inget av det.
- Ingen ny samling och inga nya regler: ingen regeldeploy.

### Ordningen
1. Ramverket mergas, taggas `v0.35.0` och publiceras.
2. Appens ompinning till 0.35.0 med ändringarna ovan, i samma pass (arbetsreglernas punkt 11). Mergas efter ramverket.

## 0.34.1

⛔ **`?skapa=` öppnar panelen även när posten kommer efter monteringen, och `useOppnaSkapa()` ersätter hård navigering. Inte breaking.**
Händelsen: mätt i bolag-ops med ett byggt mätbygge: knappen "Nytt meddelande" i Meddelanden-vyn öppnade ingen panel. Appen gjorde `window.location.assign(pathname + "?skapa=meddelande")`, men skalet läste `?skapa=` bara EN gång, vid monteringen, och `skapa.meddelande` skickas in av appen först när samtalskällan finns (efter inloggning och gruppval). Vid monteringen fanns alltså inte raden, adressen ignorerades och panelen öppnades aldrig. Samma lucka gällde varje djuplänk eller omladdning med `?skapa=` till en post som dyker upp sent (`redigera-grupp`, modulregistreringar).

### Rotorsaken
- Skalet härleder en sträng av vilka `skapa`-nycklar som finns. När strängen ändras och adressen bär en `?skapa=` som ingen panel är öppen för, öppnas panelen. Deterministiskt, ingen polling, inga timeouts.
- Öppnar bara om inget formulär redan är öppet, och en stängd panel tar bort parametern ur adressen: den som stängt panelen får den inte tillbaka.
- Nyckel till formulär är EN funktion (`skapaFormFranNyckel`) som både adressen och hooken använder, inte två sanningar.

### Nytt: `useOppnaSkapa()`
`const oppna = useOppnaSkapa(); oppna("meddelande")`. Nycklarna är adressens: `"meddelande"`, `"arende"`, `"handelse"`, `"grupp"`, `"redigera-grupp"` (med `{ groupId }` som andra argument) eller en modulregistrerings id. Använder skalets egen `oppnaSkapa`, så `?skapa=` och Tillbaka fungerar som när panelen öppnas ur plusset. Saknar skalet posten kastas ett fel, och utanför `OpsAppShell` kastas ett fel: ingenting sker tyst.

### Att göra i appen
- Byt `window.location.assign(pathname + "?skapa=meddelande")` mot `useOppnaSkapa()("meddelande")` (hooken anropas i komponenten, funktionen i händelsehanteraren). Ingen sidladdning behövs längre.
- Ompinna till 0.34.1. Ingen ny samling, inga nya regler.

## 0.34.0

⛔ **Meddelanden: gruppchatt, privata meddelanden och Assistent-tråden som EN modell, med regler, inkorg, "Nytt meddelande" och mottagarväljaren. Ny samling med nya regler: reglerna deployas FÖRE klienten, se "Att göra i appen".**
Händelsen: CP 2026-09-30 08:12 i [#182](https://github.com/cllp/ops-framework/issues/182), med en skärmbild av "Nytt ärende": *"Skall kunna välja i grupp och vem i gruppen (optional) den är adresserad till. [...] Då kan vi också ha en typ som är meddelande, så att man kan skicka ett enkelt 'meddelande' till en person i inboxen."* CP:s beslut samma dag:
1. Ett meddelande till en person är **privat**, bara avsändaren och mottagaren ser det, och det är en standardfunktion i ramverket.
2. Ett ärende till en person syns för hela gruppen, med mottagaren utskriven.
3. Mottagaren aviseras med en notis i appen. Mejl är inte beslutat, så inget mejl byggs.
4. Chatt, meddelanden och Assistent-tråden ([#185](https://github.com/cllp/ops-framework/issues/185)) är EN modell och byggs en gång. Assistenten byggs inte nu, men modellen rymmer den som en deltagare av typen `agent`. Skälet står i arkitektens [second opinion på #185](https://github.com/cllp/ops-framework/issues/185#issuecomment-5908278214), punkt 1: tre ytor för samma sak är två sanningar om vad ett meddelande är.

### Modellen, och varför den blev som den blev
- **Ett samtal** (`samtal`, namnet skickas in) har `groupId`, `slag` (`grupp`, `personer` eller `agent`), `deltagare` (bara `personer` och `agent`), `skapad` och `skapadAv`. **Meddelanden** (`text`, `av`, `tid`) och **läst-status** (`lastTill`) är undersamlingar till samtalet.
- **Undersamlingar och inte egna samlingar:** ett meddelande i en egen samling hade behövt bära samtalets `groupId` och deltagare för att regeln ska kunna avgöra vem som läser det, alltså en kopia per meddelande (regel 2). Som undersamling slår regeln upp samtalet en gång.
- **Nyckeln härleds** (`samtalsnyckel`): `<groupId>|grupp`, eller `<groupId>|<uid>|<uid>` med uid:na sorterade. Högst ett samtal per par och grupp kommer ur nyckeln och regeln, aldrig ur en läs-sedan-skriv-kontroll. `personer` och `agent` delar form utan att kunna krocka, eftersom parets typer avgör slaget.
- **Två deltagare, inte N.** Regelspråket har ingen `join`, så en nyckel av N sorterade uid:n går inte att kontrollera i regeln. Deltagarna är ändå en lista, så att fler personer senare är en ändring av regeln, inte av datamodellen.
- ⛔ **Avvikelse från förslaget: inget `senast` på samtalet.** Det senaste meddelandet finns redan i samtalet, och inkorgen måste läsa meddelandena ändå för att räkna olästa (räknaren lagras inte). Ett `senast` hade sparat noll läsningar, lagt till en skrivning per meddelande som kan misslyckas för sig, och varit ett fält vem som helst i gruppchatten kan skriva om med ett falskt utdrag. Utdraget härleds (`utdrag`). Växer volymen är rätt plats en server som skriver fältet, inte klienten.
- **Olästa räknas fram** (`olastaI`): andras meddelanden efter läsmärket. Egna är aldrig olästa.
- **Tider är millisekunder**, och regeln kräver dem inom fem minuter från serverns klocka. Annars kan ett meddelande dateras "i morgon" och vara oläst för alltid.
- **Mottagaren på ett ärende** (`byggMottagare`): formen `{ slag: "grupp" | "person" | "agent", uid? }`. Appens ärenden ligger i appens samling och appen skriver deras regler; ramverket ger formen, valideringen och väljaren.

### Vad som lades till
- `src/lib/samtal.js`: `SAMTALSSLAG`, `SAMTALSFALT`, `MEDDELANDEFALT`, `LASTFALT`, `MAX_MEDDELANDE` (4000), `MOTTAGARSLAG`, `samtalsnyckel`, `byggSamtal`, `byggMeddelande`, `byggMottagare`, `olastaI`, `motpart`, `utdrag`.
- `samtalsregelfragment({ samtal, meddelanden, last, medlemskap })`: aktiv medlem läser gruppchatten; bara deltagarna läser ett privat samtal och dess meddelanden; en borttagen medlem läser inget, inte ens sina egna privata samtal (samtalet hör till gruppen), medan den andra deltagaren läser vidare. Samtalet skapas med den härledda nyckeln av en deltagare, och båda är aktiva medlemmar (`personer`: två personer; `agent`: den andra är agent). Deltagarna kan inte ändras och samtalet raderas inte. Ett meddelande skrivs med `av == request.auth.uid` av en medlem av typen `person`: **en klient skriver aldrig som agent**, inte ens med agentens inloggning. Meddelanden ändras och raderas aldrig: ett meddelande är vad som sades, och ett svar ska inte i efterhand kunna se ut att svara på något annat. Läsmärket är bara personens eget.
- `createSamtalskalla`: `lista` (två frågor: gruppchatten på `slag`, de privata på `deltagare`), `oversikt`, `oppnaGrupp`, `oppnaPrivat`, `meddelanden`, `prenumerera`, `skicka`, `lastTill`, `markeraLast`.
- `samtalsnotiser`: notiser för olästa privata meddelanden, som en källa för ytan `notiser`. **Inget nytt notissystem** (mätt: ramverket har `OpsNotiser` och källkontraktets `notiser`, och aktivitetsloggen är jobbens logg, inte personers notiser). Notisen härleds ur samtalet och läsmärket och försvinner när meddelandet läses; en skriven notis hade varit en andra sanning om samma oläst, och hade krävt en server som skriver åt mottagaren.
- `useSamtal`, `OpsMeddelanden` (inkorgen, SS `ChatInboxPanel`), `OpsSamtal`, `OpsNyttMeddelande`, `OpsMottagare`, `OpsMeddelandeLank`.
- Skalet: `skapa.meddelande` ger "Nytt meddelande" i plusset (efter Nytt ärende, före Ny grupp), panelen med smal kolumn och knappen **Skicka** (`skickaEtikett`), och gruppväljaren först i läget "Alla mina grupper", bara bland grupperna. `nyttMeddelandeEtikett`.
- Datakontraktet: `innehaller` (array-contains), högst ett fält per fråga. Minne, Firestore och Postgres (`= ANY`); http-adaptern kastar hellre än att tappa villkoret.
- Ikoner: `MeddelandeIkon`, `SkickaIkon`, `LasIkon`, `SokIkon`, `AgentIkon` (Lucide).

### Rättat i skalet
- **Gruppanelens höjd var 1 px (plus den säkra zonen) för hög.** `lg:h-[calc(100dvh-var(--topbar-height))]` räknade inte huvudets kant eller den säkra zonen, så varje sida med gruppanelen var högre än fönstret och rullade. Det syntes inte på långa sidor. På Meddelanden, som fyller fönstret, gav det en rullning. Nu `100dvh - safe-top - topbar - 1px`.

### Röd utan fixen, grön med den
- **Regelprov (`rules/__tests__/samtal.test.mjs`) mot emulatorn:** 45 gröna, 123 av 123 med grupper och kataloger. Rollerna: en främling, en annan medlem, båda deltagarna, en borttagen medlem och en klient inloggad som agenten. **Mot 0.33.0:s regler (inget samtalsblock): 13 av 45 röda**, alla som ska släppas in. **17 mutationer, en i taget, alla röda:** läsning utan deltagarkontroll (6), läsning utan medlemskap (4), den andra deltagaren oprövad (4), osorterad deltagarlista (1), nyckeln oprövad (1), skaparen inte deltagare (1), samtalet uppdaterbart (7), agenten får skriva (1), `av` oprövad (1), meddelandet ändringsbart (1), `tid` oprövad (1), `skapad` oprövad (1), annans läsmärke (1), läsmärkets `hasOnly` borta (1), agentslaget utan agent (1), texttaket 100 000 (1). Blocket helt borta: 13.
- **Enhetsprov:** `samtal.test.js` (22) och `meddelanden.test.jsx` (13). Röda mot 0.33.0 redan vid import. **12 mutationer, en i taget, alla röda:** osorterad nyckel (5 prov), egna meddelanden räknade som olästa (4), `lista` utan deltagarvillkor (4), `innehaller` ignorerat i minnesadaptern (5), notis för gruppchatten (1), mig själv i personläget (1), borttagen medlem i väljaren (2), läsmärket flyttas aldrig (1), raden om det privata borta i Nytt meddelande (1), inget krav på mottagare (1), raden i plusset borta (2), `byggMottagare` utan medlemskontroll (1).
- **`check-skalyta` avsnitt 29** (meddelanden vid 390 och 1280): **röd mot 0.33.0** (avsnittet avbryts, komponenterna finns inte, 2 brott). Mutationer, en i taget, alla röda: gruppanelens höjd som i 0.33.0 (1 brott vid 1280, sidan 1 px för hög), inkorgens höjd utan huvudets kant (2 brott), mottagarraden utan 44 px (2), panelens knapp Spara i stället för Skicka (2), egna bubblor till vänster (2), listan halva bredden (1), inget mellanrum mellan listan och samtalet (1), utan raden om det privata (2), andras bubblor i `bg-raised` (6, se nedan). **Grön nu, 1048 kontroller (efter ombasering på 0.33.1, som lade till sina egna).**
- **Fyndet i montaget:** andras bubblor var först `bg-raised`, som i det ljusa temat är samma färg som `surface`. Proven i jsdom var gröna och avsnitt 29 också, eftersom inget mätte bubblans yta mot samtalets. Montaget mot SS visade text utan bubbla. Bubblan, den valda raden och etiketten Grupp är nu `bg-hover`, och avsnitt 29 kräver att bubblans bakgrund skiljer sig från ytan (röd med `bg-raised`, 6 brott).
- **Montage mot SS** i `docs/jamforelser/0.34.0/`, med en ärlig jämförelse i `jamforelse.md` (regel 12).

### Att göra i appen (bolag-ops), och ordningen: regler före klient
⛔ **En ny samling med nya regler.** Mergas klienten först faller varje läsning av `samtal` på catch-allen, och inkorgen visar "Missing or insufficient permissions" (samma händelse som `prioriteringar`, appens `CLAUDE.md`).

**Steg 1 (app, ompinning till 0.34.0, bara regler): reglerna.** Lägg `samtalsregelfragment({ medlemskap: <samma namn som till regelfragment()> })` i appens `firestore.rules`, efter `regelfragment()`. Granska diffen.
- *Mellan steg 1 och 2:* inget läser samtalen än. Ingen skillnad för användaren.

**Steg 2 (CP, regeldeploy):** deploya reglerna. Kontrollera efteråt att `samtal` finns i produktionens regler.

**Steg 3 (app): klienten.**
- `createSamtalskalla({ kalla })` på appens Firestore-källa.
- En sida för Meddelanden med `OpsMeddelanden` (gruppens medlemskap som `medlemmar`, den aktiva gruppens namn), och `OpsMeddelandeLank` med `olasta` i `actions`.
- `skapa.meddelande: ({ formId, groupId, onKlar }) => <OpsNyttMeddelande ... onKlar={(id) => { onKlar(); gaTillSamtalet(id); }} />`.
- `samtalsnotiser({ samtal, uid, namnFor, href })` som `kallor.notiser` i en av appens moduler.
- Ärendeformuläret får `OpsMottagare lage="arende"`, och appens ärenden fältet `mottagare` (validera med `byggMottagare`). Appens läsregel för ärenden ska INTE bero på `mottagare`: ett ärende till en person syns för hela gruppen (beslut 2). Utlösaren för `inkorgTillArende` och rutten till agenten är F5 och kräver CP:s beslut.

### Hoppat över, med flit
- Ingen AI, inga mejl, inga bilagor, ingen realtidsnärvaro ("skriver nu"). Inga reaktioner, trådar, fästa meddelanden, redigering, arkivering eller favoriter (SS har dem).
- Samtal med fler än två personer (regeln kan inte kontrollera nyckeln).
- Sökfält i mottagarväljaren (SS DMPanel har det). En grupp har sällan fler än ett tjugotal, och listan visar alla.

---

## 0.33.1

⛔ **Idag och Kalender möter bottenraden med 0 px, luften ligger inuti rullytan, och händelsekortets text har inkorgens skala (titel 14/500, datum 12, pill 10/500). Inte breaking.**
Händelsen: CP 2026-09-30 cirka 11:50 i [#187](https://github.com/cllp/ops-framework/issues/187), efter 0.32.1 och en hårduppdatering på telefonen: *"glappet är mindre men kvar"*. En beige remsa mellan listans innehåll och raden (Idag / Kalender / + / Hub / Meny).

### Rotorsaken, mätt
Remsan är exakt 24 px, i båda vyerna och i alla tre lägena i skalytans avsnitt 24 (verktygsfältet infällt, hemskärm, rad borta). Den är `- 1.5rem` i höjduttrycket i `FULL_HEIGHT_CLASSES` (`src/lib/fullHeight.js`).
⛔ **Det var arkitektens miss i 0.32.1.** Arkitekten bad om att "behålla 24 px luft som i dag" mellan ytans underkant och bottenraden, och avsnitt 24 fick kravet "gapet är 23 +- 2 px". Luft UTANFÖR en rullyta är canvas mellan innehållet och raden, och det är precis det CP ser. Kravet skrevs för att bevara en siffra och inte för att beskriva vad en användare ser.
Hypoteserna i ärendet, mätta och uteslutna: `--safe-bottom` är INTE dubbelräknad (gapet var 24 med en säker yta på 34 px), appen har ingen egen wrapper under `OpsScrollArea` i labbet (gapet är identiskt med enbart ramverkets kod), och `visualViewport` ger samma tal som fönstret i alla tre lägen. Kvar var bara uttrycket självt.

### Fixen
- `FULL_HEIGHT_CLASSES`: höjden är `botten - topp` utan `- 1.5rem`, och `-mb-6` tar tillbaka samma 1,5 rem ur sidans höjd. `OpsView` har sin egen `pb-6` (0.31.2, "Den scrollar liksom upp"), så summan är oförändrad: dokumentet är lika högt som fönstret och rullar inte ovanpå ytan. Ytan möter raden.
- Luften flyttad in i rullytan: `OpsScrollArea` har redan `pb-6`, och kalenderns månadslista gick från `pb-4` till `pb-6`. Sista kortet kan rullas upp ovanför raden men ligger aldrig mot den i vila.
- 0.32.1:s arkitektur (mätning mot `data-ops-bottenrad`, ommätning vid visualViewport och ResizeObserver) är orörd.

### Röd utan fixen, grön med den
- **`check-skalyta` avsnitt 24** kräver nu gap 0 +- 1 mellan ytan och raden, och att innehållets sista element har minst 16 px luft över radens överkant när ytan är rullad till botten (innehållets underkant, inte lådans). Golv: minst 5 element mätta i ytan, och ytan måste gå att rulla.
- Mot 0.33.0 (`--dist` och `--tokens` mot ett bygge av origin/main): **RÖD**, 6 brott (2 vyer x 3 lägen), gap 24.0 px överallt.
- Mot 0.33.1: **GRÖN**, gap 0.0 px i alla sex, sista elementet 24 px över raden (Idag) och 24 px (Kalender).
- Före/efter vid 390 px: `docs/jamforelser/0.33.1/`.

### Händelsekortets text som inkorgens rader (tillägget i #187)
CP 2026-09-30 09:52 i samma ärende: *"Textstorlek och typsnitt på händelserna (listkort) ska matcha det inkorgen har nu, inte ett eget större/tyngre utseende."*
⛔ **Beslutet ändrat, och varför:** 0.31.2 och 0.32.1 följde SS `TodayView.jsx:89` (titel 18/700). CP:s önskan går före den förebilden, eftersom det är inkorgen han jämför med i telefonen. De gamla raderna står kvar i koden och i avsnitten som historik, med en ny rad ovanför som säger att de inte längre gäller.
- **`OpsEventList`:** titeln är `text-etikett font-medium` (14/500) i alla bredder (var `text-titel sm:text-sida`, 18/20 och 700). Datumraden och rollen/slaget är `text-meta` (12) i alla bredder (var `text-meta sm:text-etikett`, 14 från 640 px). Titelns fulla bredd, datumraden först och radien 24 är orörda.
- **`ROLLMARKE_MATT`** (rollmärket `OpsRollmarke` och brådskemärket "Försenat", som delar mått): 10/500 med `px-1.5 py-0.5` (var 12/600, `px-2`). Samma storlek som `OpsPill size="liten"`, alltså inkorgens typpill.
- Kalenderns dagpanel använder inte händelsekortet (`OpsCalendar` har inget `OpsEventList`), så den är orörd.
- Mätt mot inkorgen i bolag-ops main (`InboxView.jsx:646-680` och `web/scripts/lib/inkorgstypografi.mjs`, SS `ChatInboxPanel.jsx:735-745`): datum 12, titel 14/500, `OpsPill size="liten"`. Skalan är densamma.
- **`check-skalyta` avsnitt 25** kräver titel 14/500, datumrad 12, "Försenat" och rollmärket 10/500. **Avsnitt 20** (Idag-kortet per element) väntar samma skala i alla bredder. Mot 0.33.0 (18/700, 12/600): **RÖD, 17 brott av 975**: 11 är typografin (titeln 18px/700 på båda korten, Försenat och rollmärket 12/600, Idag-kortet per element) och 6 är gapet 24 px från första delen. Mot 0.33.1: **GRÖN, 975 kontroller.**
- Montage vid 390 px, före och efter med en inkorgsrad bredvid: `docs/jamforelser/0.33.1/handelsekort-fore-efter-inkorg-390.png`. Inkorgsraden i montaget är en kopia med bolag-ops klasser, alltså en bild och inte ett prov.

### Att göra i appen (bolag-ops)
- Pinna om till 0.33.1. Inget annat.
- Har appen egen padding eller en wrapper under `OpsScrollArea`/`OpsCalendar` syns den som en remsa igen. Mät då mot `data-ops-bottenrad`, och lägg luften inuti ytan.

---

## 0.33.0

⛔ **Katalogerna är gruppens: `groupId` obligatoriskt, seedning i samma batch som gruppen, regelfragmentet med admin och nyckellås, och bakfyllnaden. Breaking för appens katalogkod, se "Att göra i appen". Ordningen där är inte valfri.**
Händelsen: CP 2026-09-28 i [#160](https://github.com/cllp/ops-framework/issues/160), "väg C": *"Katalogerna är gruppens (väg C), seedade med appens standardvärden när gruppen skapas. Inställningsvyn är gruppens. Inget delas mellan grupper."* Ärendet är [#162](https://github.com/cllp/ops-framework/issues/162), epiken [#92](https://github.com/cllp/ops-framework/issues/92).
0.29.0 gjorde `groupId` TILLÅTET på en kategori och 0.32.0 tog bort spärren mot en andra grupp. Det som saknades var att det också blev KRAV, att en ny grupp fick sina kataloger allt eller inget, att admin fick skriva dem och att bolag-ops raderna utan grupp fick en väg in.

### Vad som ändrades
- **`byggKategori` kräver `groupId` som förval.** `grupp` är förvalt `true`, och en kategori utan grupp kastar ("groupId krävs"). Bara en MALL (appens standardvärden innan de seedats in i en grupp) och en MODULS kodkatalog säger `grupp: false`, och då avvisas `groupId`. Före 0.33.0 var det tvärtom: varje ny väg var ogrupperad tills någon kom ihåg flaggan. `kallor.js` och `examples/paminnelser` säger nu `grupp: false`.
- **`createCatalogSource`:** `groupId: null` (0.29.0, "hela samlingen, rader utan grupp") är borttaget. Ersättaren är `overgang: true` TILLSAMMANS med appens `groupId`: läser hela samlingen, raderna utan grupp räknas som den gruppens, andra gruppers rader faller bort, skrivning och seedning vägras. `las()` svarar nu också `utanGrupp`, alltid, också 0. Ny **`spara(kategori)`**, den enda skrivvägen: bygger med källans `groupId` och skriver med `katalognyckel(groupId, id)`. En kategori med en annan grupps `groupId` kastar i stället för att flyttas tyst.
- **`katalognyckel(groupId, id)` och `gruppensRader(rader, { groupId, overgang })`** (nya, i båda ingångarna): nyckeln `groupId|id`, och den enda tolkningen av en lagrad rad. En app som prenumererar själv kör sina rader genom `gruppensRader`, så klienten och functions ser samma katalog.
- **`createGroupService.skapaGrupp`** skriver gruppens kataloger ur appens `kataloger` i SAMMA batch som gruppen och ägarens medlemskap. Före 0.33.0 seedades de efter commit med en skrivning i taget. `kataloger` prövas när tjänsten byggs. Ramverket ändrar aldrig standardvärdena eller en grupps kopia i efterhand.
- **`bakfyllKatalogGrupp({ kalla, samlingar, groupId, torr = true, grupper = "groups" })`** (ny, nodsidan): ger rader utan grupp `groupId` och nyckeln `groupId|id`, tar bort den gamla raden, och seedar varje grupp i `groups` som saknar en katalog. Allt i en batch. Fel, konflikter (nyckeln finns redan) och en batch över 500 skrivningar stoppar allt. Svarar `{ torr, flyttade, seedade, kvarUtanGrupp, fel, skrivningar }`, varje nyckel alltid med.
- **`katalogregelfragment`:** skrivvillkoret är `opsArAdmin` (ägare eller admin) i stället för `opsArAgare`, och en ny rads dokumentnyckel måste vara `<radens groupId>|<id>`. Valet av admin: katalogen är samma sorts konfiguration som gruppens utseende och uppgifter, som admin får ändra sedan 0.32.0 (`ADMINGRUPPFALT`). Det ägaren ensam behöll i 0.32.0 är det strukturella: `moduler` och att arkivera gruppen. En kategori är namn, färg, ikon och ordning, arkiveras och tas fram och står i ändringsloggen. `opsArAgare` här skrevs i 0.29.0, innan rollen admin fanns. Nyckellåset: utan det kunde en admin i grupp A skapa `B|uppgift` med sin egen grupp på raden, och grupp B kunde sedan aldrig spara "uppgift".
- **`OpsKatalogInstallning`:** `groupId` KRÄVS, och ett öppet utkast stängs i samma rendering som `groupId` byts. Före 0.33.0 stod den förra gruppens kategori kvar i formuläret efter ett gruppbyte, och Spara byggde den med den nya gruppens `groupId`.
- **`check-gruppnyckel` steg 5** mäter beteende, inte närvaro: bygger en kategori utan groupId med förvalet, en katalogkälla utan grupp och med `groupId: null`, och läser katalogregelns create. Alla måste säga nej.
- **Fjärde villkoret i #161 (vägra en andra grupp):** borta sedan 0.32.0 och kontrollerat nu. Ingen spärr finns i `src/node/grupp.js` eller någon annanstans (sökt efter spärren och dess meddelanden i `src`, `scripts`, `rules`), och provet "en andra grupp får sina EGNA kataloger bredvid den förstas, i samma samling" är nytt i `grupp-skapa.test.js`.
- **Den incheckade symlänken `node_modules`** (21e8a83, 0.31.0) är borttagen, och `.gitignore` säger `node_modules` utan snedstreck, så att en symlänk med samma namn inte släpps igenom igen.

### Röd utan fixen, grön med den
- **Regelprov mot emulatorn:** 78 av 78 gröna. Mot 0.32.1:s fragment är 3 av 24 katalogprov röda (admin lägger till, admin ändrar, kapningen). Mutationer, en i taget, varje gång röd: nyckellåset borta (1), `opsArAdmin` till `opsArAgare` (3), skrivning som medlem (2), läsning utan grupp (6), flytt mellan grupper tillåten (4, varav följdfel), `hasOnly` borta (2), radering tillåten (3).
- **Enhetsprov mot 0.32.1:s `src`:** 11 av de nya proven i `katalogkalla`, `katalogInstallning` och `grupp-skapa` röda (bland dem `spara`, `overgang`, `groupId` krävs i vyn, utkastet vid gruppbyte, katalogerna i samma batch, allt eller inget), och `katalog.test.js` röd redan vid import.
- Provet "en nyskapad grupp har standardvärdena på plats innan första vyn ritas" är grönt också mot 0.32.1: seedningen var klar innan `skapaGrupp` svarade. Det nya är att det sker i samma batch, och det mäts av "i samma batch" och "allt eller inget", som båda är röda mot 0.32.1.
- **`check-skalyta` avsnitt 28** (inställningsvyn med två grupper vid 390 och 1280): **röd mot 0.32.1, 2 brott** (utkastet "Styrelsemöte" och Spara kvar efter bytet till miranda-ab, båda bredderna). **Grön nu, 951 kontroller.**
- **`check-gruppnyckel`:** tre nya planterade fel i `test-guards` (förvalet `grupp = false`, nyckellåset borta, katalogkällan utan grupp), alla röda.

### Att göra i appen (bolag-ops), och ordningen
⛔ **Ordningen är hela ändringen.** Två steg i fel ordning ger den röda banderollen hos alla:
- Bakfyllnaden före steg 1: 0.32.1 kastar på en rad med `groupId` (`byggKategori` utan `grupp: true`) och på en nyckel med `|` (`ID_FORM`). Både klienten och functions faller till reserven.
- Regeldeployen före steg 3: de nya reglerna nekar en fråga utan `where: { groupId }`, och övergångsklienten frågar efter hela samlingen.

Varje steg nedan tål både det före och det efter.

**Steg 1 (app, ompinning till 0.33.0, klient och functions i samma PR): övergångsläget.**
- functions: `createCatalogSource({ ..., groupId: APPENS_GRUPP, overgang: true })` i stället för `groupId: null`.
- webben: läs som i dag (hela samlingen), men kör raderna genom `gruppensRader(rader, { groupId: APPENS_GRUPP, overgang: true }).rader` före `validateKatalog`. Validera standardvärdena (reserven) med `grupp: false` och databasraderna med förvalet.
- `OpsKatalogInstallning` får `groupId={APPENS_GRUPP}` och `kanAndra={false}`, plus en banderoll som säger att katalogerna flyttas in i gruppen. Katalogerna går inte att ändra från nu till steg 5.
- `createGroupService({ kalla, samlingar, kataloger })` får appens standardvärden, så en grupp som skapas från nu har sina kataloger.
- Reglerna rörs inte.
- *Mellan steg 1 och 2:* samma kategorier som före. Raderna utan grupp stämplas med `cps-ab` i minnet, och en annan grupps rader faller bort i stället för att fälla valideringen. Gamla regler släpper igenom frågan på hela samlingen, eftersom läsregeln (`opsArMedlem(appensGrupp())`) inte beror på raden. Inga katalogskrivningar sker.

**Steg 2 (CP, skript i appen): bakfyllnaden.**
- Skriptet anropar `bakfyllKatalogGrupp({ kalla, samlingar: KATALOGER, groupId: "cps-ab", torr })`, med samma `KATALOGER` som `createGroupService`.
- Kör först torrt och granska `flyttade`, `seedade` och `fel`. Kör sedan `--skarpt`. Kör torrt igen: `kvarUtanGrupp` ska vara 0 i varje samling och `fel` tom. Annars stannar ordningen här.
- *Mellan steg 2 och 3:* raderna bär `groupId: "cps-ab"` och nyckeln `cps-ab|id`. Övergångsklienten packar upp nyckeln och ser samma kategorier. Grupper som skapats med 0.32.x har fått standardvärdena. Admin SDK går förbi reglerna, alltså spelar de gamla reglerna ingen roll för skriptet.

**Steg 3 (app): övergången bort.**
- functions: `createCatalogSource` utan `overgang`.
- webben: prenumerera med `where: { groupId: aktivGrupp }` och kör raderna genom `gruppensRader(rader, { groupId: aktivGrupp })`.
- Skrivvägen blir katalogkällans `spara`, eller `source.create(samling, { ...kategori, id: katalognyckel(groupId, kategori.id) })`, aldrig `source.create(samling, kategori)`.
- Inställningsvyn är fortfarande låst (`kanAndra={false}`).
- *Mellan steg 3 och 4:* de gamla reglerna släpper igenom frågan med `where: { groupId }`, eftersom läsregeln inte beror på raden. Inga skrivningar.

**Steg 4 (CP, regeldeploy):**
- Appens handskrivna block för `handelsetyper`, `sorter`, `prioriteringar` och `slag` ersätts av `katalogregelfragment(["handelsetyper", "sorter", "prioriteringar", "slag"])`. Granska diffen och deploya reglerna. Regeldeployen har ingen automat, se appens `CLAUDE.md`.
- *Mellan steg 4 och 5:* läsningen är gruppens och tillåts för en aktiv medlem av radens grupp. Vyn är fortfarande låst.

**Steg 5 (app): inställningsvyn låses upp.** `kanAndra` följer rollen, ägare eller admin (`opsArAdmin`), och `OpsKatalogInstallning` får den aktiva gruppens id.

### Övrigt breaking
- En Admin-adapter som används av `bakfyllKatalogGrupp` måste ha `remove` i sin `batch`. bolag-ops `gruppKalla` har det.
- Anrop av `byggKategori`/`validateKatalog` på data utan grupp (standardvärden, provfixturer) behöver `grupp: false`.

## 0.32.1

⛔ **Idag och Kalender når bottenraden igen, också när Safaris verktygsfält fälls in och när något ovanför ytan försvinner. Händelsekortet, inkorgsraden och profilen som SS. Inte breaking.**
CP 2026-09-30, två skärmbilder från telefonen: *"Kalender och idag går inte ända ner utan huggs av i botten."* Innehållet slutade långt ovanför
bottenraden. Ett kort i Idag klipptes rakt av, och veckoraden i Kalender klipptes horisontellt.

### Rotorsaken
`useFullHeight` (`src/lib/fullHeight.js`), som både `OpsScrollArea` och `OpsCalendar` använder, räknade höjden som
`calc(100svh - var(--fullhojd-topp) - var(--bottom-nav-h) - var(--safe-bottom) - 1.5rem)`. Två antaganden i samma uttryck:
- **`svh` är den minsta vyhöjden, men bottenraden är `fixed bottom-0` och följer den verkliga kanten.** När Safaris verktygsfält fälls in växer den
  synliga ytan och raden flyttar ner, medan `100svh` står still. I hemskärmsläget kan `svh` dessutom skilja sig från den synliga höjden med de säkra zonerna.
- **Toppen mättes bara vid mount och vid `resize`.** Försvann en rad ovanför ytan (en banner, ett filter) låg talet kvar för högt och ytan slutade lika mycket för tidigt.

### Fixen
- Ingen viewport-enhet i höjden. Hooken mäter båda kanterna och lägger dem i `--fullhojd-topp` (ytans avstånd till dokumentets topp, som förut) och
  `--fullhojd-botten` (bottenradens övre kant om raden syns, annars fönstrets höjd minus den säkra ytan). Klassen är nu
  `h-[calc(var(--fullhojd-botten)_-_var(--fullhojd-topp)_-_1.5rem)]` plus `min-h-60` som golv. `md:`-varianten behövs inte längre: på en dator är
  bottenraden `md:hidden` och räknas som frånvarande, så botten blir fönstret minus den säkra ytan, samma sak som `md:`-raden räknade.
- Ommätning vid `resize`, `orientationchange`, `visualViewport` `resize` och `scroll`, och med en `ResizeObserver` på föräldern, `offsetParent`, `main`,
  dokumentets kropp och syskonen ovanför ytan. En mätning per bildruta (`requestAnimationFrame`), lyssnarna rensas vid unmount.
- `OpsBottomNav` bär `data-ops-bottenrad`, som hooken letar efter.
- SSR och jsdom: startvärdet är `innerHeight` (eller 800 utan fönster), och utan `ResizeObserver` eller `requestAnimationFrame` mäts det direkt.
- `FULL_HEIGHT_CLASSES` och `useFullHeight` har samma namn och signatur. Ingen av dem exporteras ur paketets `index.js`, så inget i appen berörs.

### Vakten
`check-skalyta` avsnitt 24 mäter `navTop - ytaBottom` för en Idag-lik `OpsScrollArea` och `OpsCalendar` vid 390x844, med `--safe-top: 47px` och
`--safe-bottom: 34px` satta före mount, i tre lägen: (a) verktygsfältet fälls in efter mount (fönstret 844 till 928, med `svh` modellerad som Safari:
fast vid höjden vid mount, eftersom Chromiums egen `100svh` följer med och alltså aldrig kan visa felet; skillnaden 84 px mäts), (b) hemskärmsläget
(`100svh` blir `calc(100dvh - 81px)`), (c) en rad på 170 px ovanför ytan tas bort efter mount. Krav 23 +- 2 px, golv 2 vyer och 3 lägen.
- **Rött mot 0.32.0 (`--dist` och `--tokens` ur origin/main):** 6 brott av 901. Idag och Kalender: (a) 107 px, (b) 104 px, (c) 209 px.
- **Grönt med fixen:** 901 kontroller, inga brott. Alla sex lägen 24 px.
- Avsnitt 21 och 21b var gröna genom hela felet: i en skrivbords-Chromium är `100svh` alltid fönstrets höjd, fönstret ändrades aldrig efter mount och
  ingenting ovanför ytan försvann, så uttrycket mättes bara i det enda läge där det råkar stämma. Skälet står nu i koden vid avsnitt 24.
- Enhetsprov (`scrollArea.test.jsx`): tre nya prov (bottenradens kant, ingen synlig rad, ommätning när något ovanför ändrar storlek) är röda mot 0.32.0:s hook och gröna nu.
- Före och efter vid 390: `docs/jamforelser/0.32.1/fullyta-c-fore-efter-390.png` och `fullyta-a-fore-efter-390.png`. Felet citerar ingen SessionStudio-bild, så det finns ingen förebild att ställa bredvid.

### Händelsekortet och inkorgsraden som SS
CP 2026-09-30 08:04: *"Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i SessionStudio. Dubbelkolla även inkorgen."*
Titeln var redan 18/700 som SS. Felet låg i kompositionen:
- **Chevronen tar ingen kolumn längre.** Den låg i en egen kolumn på 44 px, så titeln fick 251 px mot kortets 299 och en rad extra. Nu är knappen
  absolut i kortets övre högra hörn (samma 44 px träffyta), och bara kortets första rad ger plats åt den. Titeln har hela innerbredden.
- **Datumraden står vänsterställd direkt ovanför titeln,** som SS (`TodayView.jsx:527`), 12 px (14 från `sm`) och dämpad. Förut var den en `ml-auto`-grupp i
  pillraden som blev högerställd på en egen rad vid 390 px.
- **Radien är 24 px som SS** (`--radius-card`, SS `index.css:228`): CP 2026-09-30 valde det. `OpsEventList` använder kortets förval i stället för `bubbla`
  (28 px). `bubbla` finns kvar i `OpsCard` och används fortfarande av `OpsInloggning`.
- **`OpsDisclosure`:** summary-behållaren har `text-etikett`, så innehåll utan egen klass är 14 px (SS `text-sm`) i stället för bodyns 16.
- **`OpsPill size="liten"`** (ny, valfri): rollen `liten` (10/500) med `px-1.5 py-0.5`, för typbadgar (SS `ChatInboxPanel.jsx:743`, 9/500). Standard är oförändrad.
- **`OpsRollmarke`** (ny, exporterad): rollpillret ("Du", "Förfaller", "Agent") med samma mått som "Försenat" (12/600, `px-2 py-0.5`), ur en konstant som
  `OpsEventList` också använder för brådskemärket.
- **Vakt:** `check-skalyta` avsnitt 25 vid 390 px, två kort: titeln minst 95 procent av innerbredden, datumradens vänsterkant lika med titelns (+-1), radien
  24 +- 0,5, rollmärket lika stort som "Försenat", summary utan klass 14 px, liten `OpsPill` 10 px. **Rött mot 0.32.0: 9 brott** (titeln 251 av 299 i båda
  korten, datumraden vid 101,5 och 152,9 mot titelns 40, radien 28 i båda, rollmärket saknas, summary 16 px, pillret 12/600). **Grönt nu.**
- Montage och en ärlig jämförelse (vad som matchar, vad som skiljer: kortets luft 24 mot 20, den färgade vänsterkanten, pillraden som SS saknar):
  `docs/jamforelser/0.32.1/idag-kort-fore-efter-ss-390.png` och `jamforelse.md`.

### Luft mellan skapa-panelens huvud och första raden
CP 2026-09-30 08:12, med en skärmbild av "Nytt ärende" vid 390 px: *"Vidare är det skönt om det är lite luft mellan första raden och headern."*
Formulärets första rad låg direkt under huvudets linje (0 px). `OpsSkapaPanel`s innehållsbehållare har nu `pt-4`, 16 px, SS värde i båda inline-formulären
(`ManageGroupModal.jsx:479` `py-4`, `eventModal/sizeClasses.js:7` `formPad: "py-4 ..."`). Luften bor i panelen och inte i varje formulär.
Vakt: `check-skalyta` avsnitt 26 mäter huvudets underkant mot första raden. **Rött mot 0.32.0: 0 px vid 390 (1 brott). Grönt nu: 16 px** (1280 px: 0 före, 16 efter, utskrivet men inte krävt).

### Profilen som SS
CP 2026-09-30, med en skärmbild av Profil på dator: *"Typsnitten på profil är också fel. Storlek / typsnitt"*. Mätt mot SS `ProfileView.jsx`:
- **`OpsProfil`** har kolumnen 672 px (`width="narrow"`, SS `max-w-2xl`; förut 1024), varje sektion (Profilbild, Personuppgifter, Länkar, Inställningar) är ett kort med
  1 px kant och rubriken INUTI, Namn, Telefon och Stad står i tre kolumner från `sm`, och Mina grupper har samma rubrik som korten.
- **`OpsSectionLabel`** är 700 (`font-bold`), som filhuvudet alltid sagt (SS `text-xs font-bold`). Rollen `sektion` bär fortfarande 600 för de andra sektionsraderna.
- **`OpsField labelSize="liten"`** (ny, valfri): 10 px, 400, dämpad, SS profilens etikett. Standard (14/500) är oförändrad; SS formulär har den.
- **Vakt:** `check-skalyta` avsnitt 27 vid 390 och 1280 (rubrikerna 12/700 versaler accent och inuti kortet, etiketterna 10/400, kolumnen högst 672, inget överflöde,
  inget kort utanför marginalen). **Rött mot 0.32.0: 15 brott. Grönt nu.** Inget horisontellt överflöde före eller efter: kortet på CP:s bild var beskuret, inte utanför.
- Kvar och ärligt listat i `docs/jamforelser/0.32.1/jamforelse.md`: radie 24 mot 12, fälttext 16 mot 14, kort 640 mot 672, SS huvud ovanför korten, SS 11 px-knappar.

### Att göra i appen vid ompinning till 0.32.1
Pinna om. ⛔ Byt sedan appens tre handskrivna rollpiller (`Rolletikett` i `EventsView.jsx`, `Rolltegner` i `ProcessView.jsx` och
`ScheduleView.jsx`) mot `<OpsRollmarke kind={role} label={roleLabel(role)} />`, och inkorgens typbadge mot `<OpsPill size="liten">`. Inget av det
krävs för att bygga. ⛔ Profilen: `ProfileView.jsx` lägger `OpsProfil` i en egen `<OpsView width="narrow">`, och `OpsProfil` har redan en egen
(nu `narrow`, 0.32.1); ta bort den yttre, annars dubbleras sidomarginalen och bottenluften. ⛔ Har appen en egen bottenrad i stället för `OpsBottomNav` hittar hooken den inte, och då slutar ytan vid fönstret minus
den säkra ytan i stället för vid raden. Sätt i så fall `data-ops-bottenrad` på appens `<nav>`.

## 0.32.0

⛔ **Skapa grupp och bjud in, som i SessionStudio. Delvis breaking för appens skapa-grupp-callable och admin-adapter, se "Att göra i appen".**
CP 2026-09-29 23:30: *"Skapa grupp och bjuda in till grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio. Gruppkortet skall ha lite mer info i sig som i SessionStudio."*
Epiken är cllp/ops-framework#180. **Det här passet är G0 (modell och regler), G1 (skapa grupp) och G2 (gruppkortet, detaljsidan och redigering).** Inbjudans kod och utskick (G3) är INTE gjorda.

### Rättelse: textfälten är 16 px och vikt 400 på telefon
- `faltKlass` skrev `text-rubrik md:text-brod` i 0.31.2. Rollen `rubrik` bär vikt 700, så varje textfält under 768 px skrev fet text (CP 19:50: "Stor text"). Nu `text-brod` på alla bredder, som SS fält.
- Vakten: `check-skalyta` mäter varje textfält i Ny grupp vid 390 och 1280 px. Rött mot bygget utan fixen (`16px/700` i fyra fält), grönt med den (882 kontroller).

### G0. Modell och regler
- **Gruppen bär utseende och uppgifter:** `farg` (ett id ur `PROFILFARGER`, samma sex identitetstoner som profilen: ingen ny färgskala), `ikon` (`GRUPPIKONER`, tio generiska id, eller
  `initialer:AB`), `bild` (lagringssökväg), `beskrivning` (högst 280), `ort` (högst 80) och `epostsprak` (`sv` eller `en`). Tomma strängar och inte utelämnade fält, så en rad från före
  0.32.0 läses utan migrering. `byggGrupp` validerar och avvisar fortfarande okända fält.
- **Rollerna är `agare`, `admin`, `medlem`.** Regelfragmentet får `opsArAdmin(gid)` (ägare eller admin). **Admin** ändrar utseende och uppgifter (`ADMINGRUPPFALT`), **ägare** även `moduler` och
  `arkiverad` (`AGARGRUPPFALT`), `id` och `skapadAv` ändrar ingen, och ingen raderar. `hasOnly`-listorna är härledda ur samma två listor som modellen (`GRUPPFALT` också), inte handskrivna kopior.
- **`memberships`:** en aktiv medlem läser gruppens övriga medlemskap (medlemslistan), aldrig en annan grupps. Klienten skriver fortfarande inget.
- **`invitations`:** `tokenHash` (SHA-256 i hex, koden lagras aldrig), `giltigTill` (ISO, 30 dagar), `skickad` (ISO eller tom), `antalSkickade`. ⛔ **Klienten skapar aldrig en inbjudan**
  (`create: if false`): raden bär kodens hash och slutdatum, och med rollen admin hade en klientskriven inbjudan kunnat bära rollen `agare` och göra vem som helst till ägare via en accept.
  Ägare och admin läser, och en klient får bara ändra `status` (återkalla). `bjudIn` får bjudas av ägare eller admin, men bara en ägare bjuder in till rollen `agare`.
- **Rött utan ändringen (regelprov mot emulatorn):** 8 av 71 prov röda mot 0.31.2:s regler (admin ändrar utseendet, ingen ändrar `skapadAv`, en medlem läser en medkamrat, ingen klient skapar en inbjudan,
  ägaren läser/återkallar via admin, `tokenHash` och `giltigTill` går inte att skriva), **71 av 71 gröna nu.** De prov som skyddar mot för mycket (admin raderar inte, en medlem ändrar inte, en medlem läser inte en annan grupps
  medlemskap, klienten skriver inget medlemskap, admin ändrar inte `moduler`) är bevisade med mutationer: en regel i taget försvagad, varje gång rött (radering 4 prov, medlem som ägare 4, medlem som admin 1, medlemskapsläsning 3,
  medlemskapsskrivning 12, admins fältlista 2). Modellprov: 14 av 106 röda mot gamla `grupp.js`.

### G1. Skapa grupp
- **`skapaGrupp({ uid, epost, grupp, inbjudningar })`** (nodsidan) skriver gruppen OCH ägarens medlemskap i EN `kalla.batch`, allt eller inget. Före 0.32.0 var det två anrop, och ett fel mitt emellan lämnade en grupp utan ägare.
  **Spärren "en grupp per person" (#162) är borttagen.** Vitlistan kontrolleras först. Inbjudningar valideras före första skrivningen (en adress som inte är en adress kastar med "Inget har skrivits"), skickas efter commit via `bjudIn`
  (finns kontot blir det ett medlemskap, annars en väntande inbjudan) och är best effort. Svaret är `{ groupId, tillagda, inbjudna, fel }`, alltid alla tre listorna. Ägarens medlemskap bär nu PERSONENS namn och bild ur `users`, inte gruppens namn.
- **Datakontraktet får en frivillig `batch(ops)`** (regel 6 i `contract.js`): allt eller inget, svar i samma ordning. `createMemorySource` har den (återställer hela lagret), `createFirestoreSource` har den när SDK:n har `writeBatch`.
  `createGroupService` KRÄVER den och avvisar en källa utan när tjänsten byggs. Ramverket har ingen egen Admin-adapter (appen skriver den i sina functions), så den måste få `db.batch()`.
- **`OpsGruppFormular`** (ny, exporterad): Visuell identitet (märket som förhandsvisning, sex färgprickar, ikonrutor med "Aa" för initialer, egna initialer 1 till 3 tecken), Gruppnamn (krävs), Beskrivning, Ort, Medlemmar (e-post, roll Admin eller Medlem, listan före spara)
  och Mer inställningar (E-postspråk), i SS ordning. Bilden laddas upp först när gruppen finns, som i SS (`!isNew`). Faller en inbjudan visas adressen och skälet i panelen i stället för att den stängs.
- **Tre ingångar, en panel:** `skapa.grupp` ger raden "Ny grupp" i plusset (efter Ny händelse och Nytt ärende, som SS plusmeny), och gör "Skapa grupp" i gruppanelen (utfälld och infälld) och i växlarens ark till samma panel (`?skapa=grupp`).
  Panelen stängs utan `history.back()` när gruppen skapats, så appens navigering efter `onSkapad` inte ångras av ett sent back (`onKlar` stänger först, sedan `onSkapad`).
- **Märket ritas överallt:** `GruppanelGrupp` tar `farg` och `ikon`, `gruppmarkeProps(grupp)` ger `OpsIdentity` `tone`, `icon` och `initialer` (ny prop).
- **Vakter:** `check-skalyta` avsnitt 22 mäter panelen vid 390 och 1280 px (fältens ordning, ingen dialog, obligatoriskt namn, 14 px och 500 på etiketten, 12 px versaler på raden Visuell identitet, 44 px träffyta, märkets färg mot identitetstonen, Mer inställningar,
  tangentbord 500 px, Spara stänger och ger `onSkapad`, samt gruppanelens och växlarens ingång). **Rött mot 0.31.2:s `dist`: 4 brott** (ingen "Ny grupp"-rad, ingen panel), och mot mutationer av formuläret: färgprickar 36 px i stället för 44 (2 brott),
  märket utan vald färg (2 brott). Komponentprov (`gruppformular.test.jsx`, 31) och tjänsteprov (`grupp-skapa.test.js`, 32): mutationerna panelen stängs efter `onSkapad`, `history.back()` efter skapandet, kvarvarande adress ignoreras,
  gruppanelen inte kopplad och resultatvyns Spara skapar en till är röda var för sig, och skapandet utan `batch` (två anrop) lämnar en grupp utan ägare (röd).
- Före/efter mot SS och en ärlig lista över vad som skiljer: `docs/jamforelser/0.32.0/jamforelse.md`, montage `ny-grupp-390-ramverk-ss.png` och `ny-grupp-1280-ramverk-ss.png` (SS-sidan är renderad ur SS-källan, inte SS-appen).

### G2. Gruppkortet, detaljsidan och redigering
- **Skapa-panelens kolumn har SS bredd per formulär** (`OpsSkapaPanel kolumn`): 672 px för grupp (SS `GroupEditRouteView.jsx:40`, `max-w-2xl`) och 896 px för händelse, ärende och moduler (`EventEditRouteView.jsx:145`, `max-w-4xl`). Före var den 880 för alla. `check-skalyta` mäter bredden mot SS-värdet vid 1280: röd före (880), grön efter.
- **Kortet i `OpsGruppanel`:** (i) (`onInfo(id)`) för alla och penna (`onRedigera(id)`) bara för `roll` agare eller admin, 26 px med ikon 14 som SS; valt kort i gruppens `farg` (kant och ca 6 procents yta, SS `GroupCard.jsx:60-65`); märket i gruppens färg och ikon, också infällt. Medlemsantal och avatarrad (4 plus "+N") fanns redan som data.
- **`medlemsinfo(medlemskap, groupId?)`** härleder antal, avatarer och medlemslista ur en grupps rader i `memberships` (aktiva, ägare före admin före medlem): ingen spegelkolumn, appen listar bara medlemskapen. I båda ingångarna.
- **`OpsGruppSida`** (ny): detaljsidan som SS `GroupDetailView` (märke 56, namn, beskrivning, ort, Redigera för ägare och admin, appens snabbval, medlemslista med Ägare- och Admin-etikett, `children` för appens sektioner).
- **`OpsGruppFormular` i redigeringsläge** (`grupp`, `onSpara`, `bildUrl`, `onLaddaUppBild`, `onTaBortBild`): samma formulär, förifyllt, utan medlemssektion, med bilduppladdning nu när gruppen finns. `skapa.redigeraGrupp` gör pennan till samma panel (`?skapa=redigera-grupp&grupp=<id>`). Oförändrat namn skickas tillbaka orört, så en engelsk översättning inte tappas.
- **Vakt:** `check-skalyta` avsnitt 23 mäter kortets delar (26 px knapp, 12/600 namn, 10 px antal, 4 avatarer om 20, kantfärg och 6 procents yta, märkets ton och ikon) på dator och detaljsidan vid 390 och 1280 (kolumn 768, märke 56, 20/600, 14, 12, tre snabbval, p-3, 12/500, avatar 32, etikett 10 px). **Rött mot förra committen 05278f5: 9 brott** (880 mot 896, 880 mot 672, inga (i) och pennor, kant och yta i accent, ingen `OpsGruppSida`), **grönt nu: 880 kontroller.**
  Komponentprov (`gruppg2.test.jsx`, 29): pennan för alla, vald färg ignorerad, avslutade som medlemmar, Redigera för alla och namnet alltid omskrivet är röda var för sig. Före/efter mot SS: `docs/jamforelser/0.32.0/` (`gruppkort-ramverk-ss.png`, `gruppsida-*-ramverk-ss.png`, `jamforelse.md` med en ärlig lista på vad som skiljer).

### Att göra i appen (ompinningen)
1. **Regeldeployen FÖRE klienten.** Reglerna ändras (admin, medlemmars läsning, `invitations.create` nekas, `groups.update` begränsas till fältlistor): generera om fragmentet, granska diffen och deploya reglerna till produktion INNAN klienthalvan mergas. En regel i main är inte en regel i produktion.
2. **Callablen `skapaGrupp` får ny signatur:** `{ uid, epost, grupp: { namn, farg?, ikon?, beskrivning?, ort?, epostsprak? }, inbjudningar?: [{ epost, roll? }] }` och svarar `{ groupId, tillagda, inbjudna, fel }`. Den gamla `{ namn }` finns inte kvar; `OpsUtanMedlemskap props.onSkapaGrupp` anropar den med `grupp: { namn }`.
3. **Admin-adaptern i functions måste ha `batch(ops)`** (`db.batch()` med `set`/`update`/`delete` och `commit()`), annars kastar `createGroupService` när den byggs.
4. **`skapa.grupp`** i `OpsAppShell` ersätter `grupper.onSkapa`: `grupp: ({ formId, onKlar }) => <OpsGruppFormular formId={formId} onKlar={onKlar} onSkapa={...callable} onSkapad={(id) => navigate(...)} />`, och `skapa.sparaEtikett` ritar den fasta Spara.
5. **G2:** lista `memberships` per grupp (en medlem får läsa dem) och ge kortet `medlemsinfo(rader, gruppId)`: `medlemsantal` och `avatarer` (`{ id, namn, bild }`) på `GruppanelGrupp`, plus `roll`, `farg` och `ikon` ur gruppen. `grupper.onInfo(id)` öppnar appens sida med `OpsGruppSida` (`medlemmar` ur samma `medlemsinfo`, `snabbval` appens egna länkar). Pennan: `skapa.redigeraGrupp: ({ formId, groupId, onKlar }) => <OpsGruppFormular grupp={...} onSpara={...} onLaddaUppBild={...} />`, annars `grupper.onRedigera(id)`. Uppladdningen (sökväg med gruppens id) är appens, och storage-reglerna för gruppbilder likaså.
6. Ingen klient skapar längre en `invitations`-rad direkt: bjud in via `bjudIn`-callablen. Rollen `admin` finns nu i `ROLLER`.

---

## 0.31.2

⛔ **Valmenyernas rader är SS rader, och appens stilrot får inte omforma skalet. Inte breaking.**
CP 2026-09-29 19:50, med en skärmbild av filtrets "Slag"-dropdown (rader "Alla slag", "Fakta", "Påminnelser", "Uppgifter"):
"Typsnitten är inte syncade. Stor text och kanske inte rätt typsnitt? Har ni verkligen gått igenom allt? Kolla olika 'slag'".

### A. Valmenyerna
Mätt i Chromium mot 0.31.1: raderna i filtrets dropdown var **16 px och fetstil (600)** med en **2 px accentkontur** runt den valda raden; SS raden
(`ThemedDropdown.jsx:122`) är 12 px, vanlig vikt, vald = tonad yta och en bock. Typsnittet var rätt (Plus Jakarta Sans), storleken och ramen inte.
Orsaken var att samma rad skrevs i fyra filer (`OpsFilterPanel`, `OpsFilterChip`, `OpsThemeToggle`, `OpsSegmented`) med `text-base`, och två till i
`OpsSelect` och `OpsTimePicker`, medan menyns egen rad (`radKlass`) rättades i 0.30.0. Nu finns raden på ETT ställe: `radKlass` (`vald`), den interna
`ValRad`, `valjAlternativKlass` (formulärlistor, SS `optionSizeForm`: 14 px, bock sist) och `radRubrikKlass`. Sammanlagt 20 ytor genomgångna, 13 ändrade
(tabell med SS fil:rad, före och efter: `docs/jamforelser/0.31.2/menyer.md`). Också ändrat: datumväljarens text (16 till 12 px, SS `ThemedDatePicker`),
Aktivitets Mer-meny (14 till 12 px), grupplistan och "Skapa i" (vald rad = tonad yta och bock, ingen ram), rubriken över raderna står i radernas kolumn.
⛔ Den valda raden syntes inte i ljust tema: `raised` är samma färg som `surface` där, och behållarna var `bg-raised`. Nu `bg-surface` och valt `bg-accent-subtle`.
Raderna har SS höjd på dator (28 px för ThemedDropdown-raderna, 36 för AppHeader-raderna, 40 för statusmenyn som är `text-sm` som SS `TodayView.jsx:294`) och 44 px träffyta under `md`; vald rads text är `text-ink` som SS. Fokus på en menyrad är en yta (`bg-hover`), inte en ram. Vakt: check-skalyta avsnitt 18 öppnar 16 ytor i 1280 och 390 px (30 mätningar, golv 28) med
tangentbordet och mäter radens text, vikt, typsnitt, luft, höjd samt den valda radens kant, kontur, bock och yta. **Rött mot 0.31.1: 84 brott, och mot första 0.31.2-versionen 28 (radhöjden 44 mot SS 28)** (16 px, 600,
konturen 2 px, 32x8 i listorna), **grönt nu: 726 kontroller, inga brott.**

### B. Appens stilrot får inte omforma skalet (`check:tokens`)
bolag-ops hade i `web/src/index.css` (#240) regeln `header.sticky > div.max-w-7xl { max-width: 64rem; }`. Den smalnade toppen till 1024 px medan
grupppanelen låg kvar i `max-w-7xl`, så textmärket stod **120 till 128 px till höger om panelen vid 1280 och 1600 px** (mätt i bolag-ops av CP:s uppdrag,
inte ommätt här). Vakten gick grön, för den läste bara custom properties. `check-token-overrides` (regel 6) tillåter nu bara `@import`, `@source`,
`@font-face`, `@theme` och `:root`/`.dark`/`[data-theme]` med `--*`-rader; allt som stilar ett element eller en klass är rött med väljaren i meddelandet och
uppmaningen att be ramverket. Prov i `check:guards`: rött med exakt regeln ovan, en klassregel och en vanlig deklaration i `:root`; grönt utan dem (121 vaktregler, 30 grönkontroller).

### C. Hub, tillbaka-raden och menyhöjden (CP 2026-09-29 20:57, två bilder av bolag-ops på telefon)
CP: *"Hubbens kort måste få lite distans från headern. Ekonomi fäller inte ut submenyer. Navigeringen tillbaka ser inget bra ut. Gör samma som SessionStudio
och aktivitet. Se till att aktivitetspanelen blir lika hög som menyn så den inte hoppar. Kanske att meny skall vara en standardhöjd."**
**Inte breaking**, men Hub ändrar form: se "Att göra i appen".
- **Hubben äger sin ram.** Korten låg kant i kant under toppraden (0 px avstånd, 0 px marginal) eftersom `OpsHub` var ett bart rutnät och appen inte lindat det i `OpsView`;
  fixturens scen gjorde det åt den och dolde felet. `OpsHub` och `OpsHubModul` ritas nu i `OpsView` (24 px under toppraden och 16 px sidomarginal som Idag, mätt 390/768/1280), `ram={false}` för en app som redan lindat.
- **Ekonomi fälls ut på plats.** Ett kort med barn är en knapp (`aria-expanded`, chevron vrids) som visar "Visa Ekonomi" (modulens egen sida) och barnen som rader; kort utan barn är oförändrat länkar.
- **Tillbaka-raden är SS textlänk** (`OpsTillbaka`, ny fil): "‹ Tillbaka" (chevron 20 px, `gap-2`, 14 px) ett steg upp och rubriken under, inget band, ingen ram, inte `sticky` (`GroupDetailView.jsx:83-95`). Samma komponent i `OpsView tillbaka` och `OpsHubModul`; nya props `rubrik`, `tillbakaEtikett`, `tillbakaTillEtikett`. `OpsHubTillbaka` exporteras som förut.
- **Menyn har en standardhöjd.** Rullgardinen (1280) och arket (390) är lika höga i roten och i Aktivitet (512 / 512 px och 576 / 576 px, före 378,5 / 402,0 och 470,5 / 374,0), innehållet rullar inuti.
Mått: `check-skalyta` avsnitt 19. **Rött mot HEAD 37272d5: 38 brott** (avstånd 0 px mot 24, marginal 0 mot 16, inga utfällbara kort, band med ram och `sticky`, menyhöjd 378,5/402,0 och 470,5/374,0), **grönt nu**. Före/efter: `docs/jamforelser/0.31.2/hub-tillbaka-meny-text.md`.

### D. Textstorleken har EN skala (CP 2026-09-29 21:00, en bild av Idag med ett utfällt kort)
CP: *"Fortfarande jävla diffar i textstorlek på olika håll. Kan det bli enhetligt och läsa från samma klasser."* På bilden hade pillret, hjälptexten, kortets chips, meta, titel,
faktatabellen och bottenraden olika storlekar. Orsaken: komponenterna skrev `text-xs`, `text-sm`, `text-base`, `text-md`, `text-lg` och `text-xl` rakt av (**168 ställen i 61 filer**)
och det som saknade storlek ärvde 16 px från body. Nu finns tio roller i `tokens/sessionstudio-profil.json` med SS fil och rad (nya: `meta` 12 px, `brod` 16 px, `titel` 18 px, `sida` 20 px;
`etikett` fick SS radhöjd 1,25 rem) och **ingen ramverkskomponent skriver en Tailwind-storlek**: kortets titel är `titel`, metaraden och faktarader `etikett`, chips `meta`.
⛔ Ändrat värde: **sidrubrikerna (`text-xl`) går från 24 till 20 px**, som SS `GroupDetailView.jsx:95` (ramverkets `text-xl` var ett eget mellansteg). Kortets titel går från 16 till 18 px (20 från 640 px).
**SS per brytpunkt** (CP: "exakt SS"): kortets metarad är `text-meta sm:text-etikett` (12 px under 640 px, 14 från; SS `text-xs sm:text-sm`, `TodayView.jsx:83/86`) och korttiteln `text-titel sm:text-sida` (18 / 20 px; SS `text-lg sm:text-xl`, `TodayView.jsx:89`). Vakten mäter mot SS-värdet per bredd (390 och 1280); rött mot c896fb3 (4 brott), grönt efter.
`check-typografi` fäller nu `text-xs/sm/base/md/lg/xl` i `src/components` och `src/lib` (rött i `check:guards`, grönt för en roll; en app utan `--ramverksregler` berörs inte).
`check-skalyta` avsnitt 20 mäter varje synligt textelement på fem fixtursidor vid 390 och 1280 (296 i `main`, golv 60): roll finns, storleken ur rollmängden och lika med SS-värdet,
samma storlek på båda bredder, Idag-kortets element mot SS. **Rött mot HEAD: 300 avvikelser (278 textelement), grönt nu: 0.** Tokens `--text-sm/base/xs/md/lg/xl` finns kvar för appar som ännu inte flyttat.

### E. Hemskärmsapp (iOS standalone): headern täcker statusfältet och sidan rullar inte extra (CP 2026-09-29 22:33)
CP, bolag-ops på hemskärmen (`viewport-fit=cover`, `black-translucent`): *"Ser ut att scrollningen blir fel. Den scrollar liksom upp."* Emulerat i Chromium med `--safe-top: 47px` och `--safe-bottom: 34px` (390x844), mätt före: (1) headern var `sticky top-(--safe-top)` utan padding och satt 47 px ned, med en otäckt remsa ovanför där innehållet rullade förbi statusfältet; (2) `OpsView` räknade `--safe-bottom` en andra gång (`main` räknar den redan) och `OpsScrollArea` drog inte bort `OpsView`s `pb-6`, så en sida med listan i `OpsScrollArea` (Idag) blev 902 px hög i ett fönster på 844: dokumentet rullade 58 px OVANPÅ listans egen rullning, och en tom remsa stod mellan listan och bottenraden.
Nu: headern är `top-0 pt-(--safe-top)` (börjar vid y = 0, 104 px hög med zonerna), `OpsView` räknar säker yta i botten bara från `md`, och `FULL_HEIGHT_CLASSES` drar bort 1,5 rem: sidan är exakt fönstrets höjd (844 mot 844, scrollY 0), sista kortet ligger 23 px ovanför bottenraden. `check-skalyta` avsnitt 21: **rött mot c896fb3 (6 brott), grönt nu.** Ingen ändring krävs i appen (bolag-ops behöver inte lägga egen padding).

### Att göra i appen vid ompinning till 0.31.2
1. **Ta bort regeln `header.sticky > div.max-w-7xl { ... }` ur `web/src/index.css` (#240).** Toppen är då åter lika bred som panelen. Behövs en smalare topp är det
en fråga till ramverket.
2. **Ta bort appens egen ram runt `OpsHub` och `OpsHubModul`** (t.ex. `px-4 py-4`), annars dubbel marginal, eller ge `ram={false}`. Sidor under Hub ger `OpsView` propen `tillbaka` (`OpsHubTillbaka` ritar inte längre ett spår "Hub / Ekonomi").
3. **Egna textstorlekar i appen.** Ramverket skriver inga `text-xs/sm/base/lg/xl` längre, men appens egna gör det fortfarande och ser då annorlunda ut än ramverkets rader. Mätt i bolag-ops `web/src` (inget ändrat där):
   **170 förekomster i 22 filer**: CostsView 29, LivView 18, InboxView 16, InsuranceView 13, IncomeView 12, ScheduleView 10, PensionView 8, SubscriptionsView 7, ProcessView 7, ComparisonView 7,
   OverviewView 6, HelpView 6, AssetsView 6, PrimitivesView 4, EventsView 4, NewCaseModal 3, EconomyView 3, ContactsView 3, BusinessView 3, SearchView 2, `overview-view.test.jsx` 2, AskView 1, samt ett `text-[..]`.
   Byt dem mot rollerna (`text-etikett` 14, `text-meta` 12, `text-brod` 16, `text-titel` 18, `text-sida` 20, `text-rubrik`, `text-hjalp`, `text-liten`). Text utan storlek ärver 16 px: ge den en roll.

## 0.31.1

⛔ **Inloggningen tar appens bildlogga, mobilhuvudet har ingen text och gruppväxlaren tar loggans plats. Inte breaking: allt är nya valfria props.**
CP 2026-09-29 18:40: "INloggningen den nya loggan. Header i mobil skall vi ta bort texten helt. VI behöver en bra Grupp-väljare-ikon i mobil
istället för logga. I Web skall vi ha texten som jag angav 0.31.0."

### A. Inloggningen tar en bildlogga från appen
`OpsAuthGate` och `OpsInloggning` tar `ordmarke={{ ljus, mork }}` (två URL:er) och `ordmarkeHojd` (Tailwind-höjdklass, förval `h-56`).
Med `ordmarke` ritas bilden i stället för textmärket, `ljus` i ljust tema och `mork` i mörkt via temat (`data-theme` och systemet, samma
tre tillstånd som tokens: klasserna `.ops-ordmarke-*` i `tokens.css`), alt-text är appens namn (`etikett`) i BÅDA temana. Utan `ordmarke`
ritas textmärket från 0.31.0 som förut. **Headern (webb) påverkas inte, textmärket står kvar där.** Höjd och inte bredd, eftersom appens
mästerbilder är fyrkantiga (3750 px) med mycket luft: bilden beskärs med `-my-10`. Den ljusa bilden ritas med `mix-blend-multiply`
så att dess vita botten blir sidans papper. ⛔ `ordmarkeHojd` kom tillbaka på `OpsInloggning`, inte på `OpsBrand` (där den togs bort i 0.31.0).
⛔ Klassen måste finnas i appens Tailwind-skanning för att den ska få effekt; förvalet `h-56` finns i ramverket och behöver inget.
Mätt (check-skalyta, Chromium): 224 px hög, 27 procent av vyn vid 390 px och 28 procent vid 1280 px (gräns 40), centrerad inom 1 px, en bild
synlig per tema. Vakten hittade en riktig miss under bygget: den mörka bilden hade först `aria-hidden` och `alt=""`, så loggan hade
inget namn i mörkt tema.

### B. Mobilhuvudet utan text, gruppväxlaren som ikonknapp
Under `md` ritas märket inte alls när `grupper` finns (ordmärke, monogram och undertext). Längst till vänster står i stället gruppväxlaren
som en ikonknapp med 44x44 träffyta: den aktiva gruppens märke i samma 40 px ruta som remsan (`gruppRutaKlass`, `OpsIdentity rail`), och
i läget "Alla mina grupper" samma `PersonIkon` som panelens och remsans rad. Ingen text bredvid. `aria-label` är "Byt grupp, nu: <namn>"
(`grupper.nuEtikett` byter ordet "nu"). Från `md` är växlaren märke + namn som förut, och webbhuvudet är oförändrat. Utan `grupper` finns
ingen växlare att ersätta märket med, och monogrammet står kvar under `md`. Startsidan nås ur bottenraden.
⛔ SS har ingen gruppväxlare i mobilhuvudet (`AppHeader.jsx:173`: en 40 px loggeikon, `AppHeaderMobileToolbar.jsx`: tema, sök, plus,
avatar). Det här är CP:s beslut och inte SS-paritet, och montaget visar det ärligt.
Vakt: check-skalyta avsnitt 7 kräver nu inget märke och ingen "OPS HUB"-text i mobilhuvudet, gruppväxlaren först, 44x44 och gruppmärket
40x40. Rött mot 0.31.0 (märket ritades, växlaren 32x44, inget gruppmärke), grönt med ändringen.

### C. `skapa.arende` tar formulärets id
`skapa.arende` får vara en funktion `({ formId, mal }) => nod`, så appen sätter `id={formId}` på sitt `<form>` och kan använda panelens
gemensamma Spara (`skapa.sparaEtikett`). Funktionen ritas som en egen komponent, så hooks fungerar i den. En färdig nod fungerar som förut.
⛔ **Ändrat beteende, en död knapp borta:** för en färdig nod (`arende` eller `handelse` som nod) kan formuläret inte få `formId`, och
panelens Spara pekade då på ett id ingen känner. Den ritas nu inte för noder. Modulformulär och `HandelseSkapare` får `formId` som förut.

### Att göra i appen vid ompinning till 0.31.1
Inloggning: `<OpsAuthGate ordmarke={{ ljus: "/brand/ops-hub-wordmark-light-640.png", mork: "/brand/ops-hub-wordmark-dark-640.png" }} etikett="Bolag Ops">`
(640-varianterna räcker, 224 px högt). Ärende: byt `skapa.arende={<Formular />}` mot `skapa.arende={({ formId }) => <Formular formId={formId} />}`
och ta bort formulärets egen Spara till förmån för `sparaEtikett`. Inget annat krävs. ⛔ Appens PNG:er har opak bakgrund: den mörka
(`#202420`) är 8 nivåer ljusare än mörkt tema (`#181c18`) och syns som en svag ruta. Genomskinliga varianter, eller `#181c18` som botten, tar bort den.

## 0.31.0

⛔ **Märket är text, inte bilder. BREAKING: appar måste pinna om.** CP 2026-09-29:
"Viktigt. Logotyp. Vi gör såhär. Vi tar bort bilder, kör med text. Font: Glacial
Indifference Regular. Colors: Light Gray och Gray Orange. Ha detta både på
inloggning och inne i appen. Följ detta exakt." Och därefter, "kör allt, och bort
med loggorna".

### Märket (avsnitt 1 till 6 och 15)

**Bort, helt:** `varumarke/*.webp` (fyra bilder), `scripts/generate-varumarke.mjs`,
`src/lib/varumarke.js` med `OPS_HUB_VARUMARKE`, bildläget i `OpsBrand`
(`ordmarke`, `ikon`, `ordmarkeHojd`, `endastOrdmarke`, `title`, `subtitle`, `mark`),
PH.ST-märkets fyra bilder i `assets/` och tokens `--logo-phst*`, samt vakterna
och proven som stod över dem (test-guards "varumarke", `varumarke.test.js`,
PH.ST-kontrollen i `check-scaffold`). Ingen död fil kvar: `grep` efter `varumarke`,
`OPS_HUB_VARUMARKE` och `phst` ger noll träffar utanför den här texten.

**Nytt:** `OpsBrand` är två textrader och ett monogram.

| Prop | Betyder |
|---|---|
| `namn` | Rad 1. Förval `"OPS HUB"`. Första ordet ljusgrått (`ink`), resten gråorange (`marke-accent`). Eller `{ forsta, andra }`. |
| `undertext` | Rad 2, appens eller gruppens namn. Tom: bara rad 1, centrerad lodrätt. |
| `monogram` | Tecknen i rutan. Förval: första bokstaven i varje ord, "OH". |
| `storlek` | `"topp"` (förval) eller `"stor"` (inloggningen). |
| `panelInfalld` | Sätts av skalet. |

I `OpsAppShell` är `brand` (sträng) märkets `namn`, och **rad 2 är den aktiva
gruppens namn i versaler** när `grupper` finns och en grupp är vald (i läget
"Alla mina grupper" används appens `undertext`, annars ritas bara rad 1).
`OpsInloggning` får `namn` (nytt) och `etikett` (blir rad 2); `mark` och
`ordmarke` är borta.

**Typsnittet:** Glacial Indifference Regular (SIL OFL 1.1) ligger i
`fonts/glacial-indifference/` med `LICENSE.txt` bredvid, `@font-face` med
`font-display: swap` i `tokens/tokens.css`, token `--font-marke`. Bara märket
använder det. `check-fonts` godtar nu ett självvärdat typsnitt med licensfil och
fäller ett utan (fil som saknas, licens som saknas, ingen `@font-face` alls), och
`check-scaffold` mäter att filen faktiskt följer med genom ett konsumentbygge.

**Mätt i CP:s bild, inte gissat.** `cp-utfalld.webp` är 2000 px bred; panelens kort
är 411 bildpixlar och 180 CSS-pixlar, alltså skala 2,283. Bokstävernas startlägen
och versalhöjder är avlästa pixel för pixel mot bakgrunden #202521 och anpassade med
minsta kvadrat mot typsnittets egna breddtabell (typsnittets versalhöjd är 0,67 em):

| | Rad 1 "OPS HUB" | Rad 2 undertexten |
|---|---|---|
| Versalhöjd i bilden | 21 px (O med översvängning) | 15 px |
| Typsnittsstorlek | **13 px** (`--marke-storlek`) | **9,5 px** (`--marke-undertext`) |
| Spärrning | **0,23 em** = 2,99 px (`--marke-sparrning`), 0,34 av versalhöjden | **0,26 em** (`--marke-undertext-sparrning`), 0,39 av versalhöjden |
| Bredd i bilden / här | 157 / 156 bildpixlar | 360 / 362 bildpixlar |
| Baslinjeavstånd | 31 bildpixlar = 13,6 CSS-px (`--marke-radavstand` 3,5 px) | |

Monogrammet "OH": 14 px, spärrning 0,04 em. Inloggningen: rad 1 32 px, rad 2 12
px (23 px hade blivit bredare än kortet). Toppradens rutor ryms i 56 px: ordmärket
är 40 px högt.

**Färger, mätta:** ljusgrått är bokstävernas toppvärde (230, 235, 231) och
ramverkets mörka `ink` är (232, 236, 230): skillnad 2, 1, 1, alltså under gränsen 4,
och därför ingen ny färg, märket använder `ink`. Gråorange är H:ets toppvärde
(169, 146, 94) = **#a9925e** = `--color-marke-accent` (mörkt), i fixturen
`tokens/sessionstudio-profil.json` under `marke` med `_kalla` mot CP:s bilder.
**Ljust tema:** ljusgrått syns inte på ljus yta, så `ink` (#3C2F2F, 12,5:1) bär "OPS" och
monogrammets O. #a9925e klarar inte 3:1 mot ljus yta (**2,94:1** mot `surface`,
**2,85:1** mot `canvas`), så ljust läge har en mörkare ton av samma kulör (H 41,6, S 30 procent,
ljushet 51,6 till 49,2 procent): **#a38c57**, **3,18:1** mot `surface` och **3,08:1**
mot `canvas`. Mörkt: 5,22:1 mot `surface`. `check-kontrast` har fyra nya rader
(orange mot yta och canvas, båda teman; `ink` mot yta) och är grön.

**Placering och rörelse, som SessionStudio och som CP skärpte den.**

- Ordmärkets två rader står **över kortens bredd** i gruppanelen, inte över panelens
  ytterkant: mittlinjen mäts till 107,99 mot kortens 108,00 vid 1280 px och 260,49
  mot 260,50 vid 1600 (högst 1 px tillåtet, båda raderna). Spärrningen lägger ett
  tomt avstånd efter sista bokstaven, så varje rad bär lika mycket `padding-left`
  som den har spärrning: annars sitter texten en halv spärrning till vänster.
  Panelens sidopadding är nu ett token (`--panel-kant`, 2 px) som både panelen och
  märkesrutan läser. (`check-skalyta` mätte förut mot panelens ytterkant och
  godkände därför 2 px fel; det jämför nu mot innehållet.)
- **Infälld:** monogrammet står i **samma ruta som remsans grupper**: `gruppRutaKlass`
  (ny, `src/lib/radKlass.js`) är EN definition som remsan, chevronknappen och
  monogrammet använder. Mätt med `getComputedStyle`: bredd, höjd, rundning (12 px),
  kantfärg, kantbredd (1 px) och yta är lika med en icke-aktiv grupprutas, och
  mittlinjerna är lika (38,00 mot 38,00 vid 1280).
- Båda formerna är alltid monterade och växlar med en opacity-crossfade på 200 ms.
  Under `md`, eller i en app utan grupper: monogramrutan, vänsterställd på x 16.
- Namnet står en gång som `sr-only`; formerna är `aria-hidden`.

**Prov (alla röda mot origin/main 0.30.1, gröna här):** `check-skalyta` sektion 10
(1280 och 1600 utfälld och infälld, långt gruppnamn, läget Alla, 390 px, inloggning
390 och 1280: typsnittet laddat med `document.fonts.check`, färger beräknade lika med
tokens, inga `<img>`, `scrollWidth <= clientWidth`, höjd <= 56); `src/__tests__/marke.test.jsx`
(props, förval, monogram, undertext från gruppen); `test-guards` typsnitt 4 till 7.

**Appen måste:** pinna om till 0.31.0 och ta bort `title`, `subtitle`, `mark`, `ordmarke`,
`ikon`, `ordmarkeHojd`, `endastOrdmarke` ur varje `OpsBrand`/`OpsInloggning`-anrop;
`brand="Bolag Ops"` blir nu märket "BOLAG OPS", så utelämna `brand` (förval OPS HUB)
eller skicka `<OpsBrand undertext="Bolag Ops" />` för en rad 2 i läget Alla mina grupper.
`OPS_HUB_VARUMARKE` finns inte längre.

---

### Accenten är SessionStudios bruna (avsnitt 7)
CP 2026-09-29: "OPS HUB är grön i mörkt läge. Sessionstudio är brun, vilken färg är det?" Det är tonen **Brun** i
grön-profilen: webben väljer ton med attributet `data-hsl-preset` (`apps/web/src/constants/themes.js:105-109`
`applyHslPreset`, `main.jsx:73-75`, `localStorage sp_hsl_preset`, swatch "Brun" `packages/shared/designTokens.js:249`).
Värdena står i `index.css:690-704` (ljust) och `index.css:767-781` (mörkt). Mobilens `theme.js:100` hue -30 är en annan väg
och ger olivgrönt, alltså inte det CP ser.

| | accent | hover (`accent-light`) |
|---|---|---|
| mörkt | `#9e8a6e` (index.css:768) | `#ae9a7e` (index.css:769) |
| ljust | `#8E7A4E` (index.css:691) | `#9e8a5e` (index.css:692) |

CP:s bild visar ungefär `#a8987a`, det vill säga tonen efter komprimering. Märkets gråorange `#a9925e` ligger nära den mörka
accenten: skillnad 11, 8 och 16 i R, G och B. `accent-subtle` och `-faint` härleds nu ur accentens hex (`rgbaAv` i
generate-tokens) i stället för att vara egna rgba-tal, för de olivgröna literalerna hade blivit kvar. Kontrast mätt av
check-kontrast: mörk primärknapp 4,56:1 (hover 5,58:1). Ljus `accent-contrast` blev `#000000` (5,04:1), eftersom `#1a1a1a` gav
4,18:1 på SessionStudios ljusa brun. En vakt fäller en handskriven genomskinlig ton.

### Chevronen ligger inne i fliken (avsnitt 9)
CP: "Hub ⌄ står längre bort än Idag och Kalender." Länken hade `px-3` på båda sidor och chevronen `pr-2`, så ordet och
chevronen låg 18 px isär och flikens högra luft var 8 px (mätt 900/1280/1600 px, 0.30.1: 18,0 px ord till chevron, luft efter
chevron 20/24 mot en vanlig fliks 12/16). SS `AppHeader.jsx:217-230` är en flik med chevronen `ml-0.5`. Nu ligger luften
vänster på länken och höger på chevronen (`FLIK_LUFT`), 2 px mellan ordet och chevronen. Mätt efter: ord till chevron 6,0 px
(2 px marginal plus ikonens egen), luft före och efter 12 (900) respektive 16 px (1280, 1600) på alla tre flikarna, avstånd
Idag till Kalender och Kalender till Hub lika (28 respektive 36 px). check-skalyta avsnitt 11, rött mot 0.30.1.

### Tillbaka-raden hålls i innehållskolumnen (avsnitt 10, och roten till fynd 1 i #475)
CP: raden "‹ Hub / Ekonomi" ritades över den infällda gruppanelen. Raden hade `-mx-4 px-4`: en negativ marginal som drog
ut den 16 px åt vänster, in över panelens kolumn, och 16 px åt höger utanför kolumnen. Mätt på 0.30.1 (1280 px): raden
200..1265 mot kortens rutnät 216..1249, marginaler -16/-16, och panelen utan z-index. Det är också rotorsaken till den
horisontella överflödningen på modulsidan när appen inte lägger `px-4` runt. Nu: ingen negativ marginal, raden är exakt
rutnätets bredd (216..1249 vid 1280 utfälld, 76..1249 infälld, 368,5..1416,5 och 228,5..1416,5 vid 1600), panelens kolumn
har `--z-sticky-header` (110) över radens `--z-sticky` (100). check-skalyta avsnitt 12, rött mot 0.30.1.

### Menyn har en bredd, och raden utan ikon linjerar (avsnitt 13)
CP: "Aktivitet ... Modalen blir superbred. Skall vara samma som i dropdown så det inte känns hackigt." Rullgardinen var
`min-w-52` och växte med det bredaste som ritades. Mätt på 0.30.1 (1280 px, en undervy med en lång rad): 208 px före och
1256 px efter att Aktivitet öppnats, och ytan flyttade sig från x 1041 till 0. Nu `w-80` med `meny` (SS `AppHeader.jsx:514`),
undervyn i SAMMA ruta med tillbaka-pil: 320,0 px före och efter, samma position och rundning. Utan `meny` är den rena
överflödsmenyn fortfarande innehållsstyrd. Raden "Primitiver" utan ikon får en tom 16 px-plats när någon annan rad i
appens sektion har ikon (i stället för att kräva en ikon): mätt x 972,0 för båda, mot 1058 respektive 1084 på 0.30.1.
check-skalyta avsnitt 13, rött mot 0.30.1.

### Typ, datum och tid går att välja i en modal (avsnitt 11)
CP: "Ny händelse: datum går inte att välja, och det finns ingen tidsväljare", "Går heller inte att välja typ i dropdown".
Två rotorsaker, båda mätta i Chromium på 0.30.1 (390 och 1280 px): (1) listorna ritades på `--z-dropdown` (200) och
modalen på `--z-modal` (400), så typlistans val och kalenderns dag låg BAKOM modalen (`elementFromPoint` gav modalen, inte
valet, och klicket avbröts); (2) `OpsDatePicker` gav react-day-picker en STYRD månad (`month={chosen}`), så månadspilarna
gjorde ingenting så fort ett datum var valt. Rättat: `--z-dropdown` är 450, över modalen och under toasten (450 mot 400), och
`defaultMonth`. Ny `OpsTimePicker` (timme och minut i två listor med kolon emellan, `"HH:MM"`, 24 h) efter SS
`ThemedTimeSelect.jsx`. Trigger och yta delar nu `faltTriggerKlass`/`faltYtaKlass` (radKlass.js) i stället för tre
skrivna strängar. check-skalyta avsnitt 14 väljer typ, datum och tid inuti en `OpsModal` vid 390 och 1280 px (listan
överst och inom vyn, valet når värdet, Escape stänger bara listan, tangentbord), rött mot 0.30.1 (`--dist` och nya
`--tokens` mot origin/main). Vitest `tidval.test.jsx`: rött på 0.30.1 för månadsnavigeringen och lagrens ordning. README:
formulär får inte använda rå `input type=date/time`. **Appen:** `skapa.handelse` får datum- och tidsfält med
`OpsDatePicker` och `OpsTimePicker`, och `skapa.kataloger` måste innehålla `handelsetyper` för att typlistan ska ha val
(ramverket ritar typvalet ur den, `typerAttValja`).

### Skapa är en panel, "Skapa i" som SS, och tätare valkort (avsnitt 16 och 12)
CP: "Skapa nytt i ramverket. Låt det vara paneler istället för modaler precis som i sessionstudio", och om "Nytt ärende" på 390 px:
arket täckte hela huvudet, nästa fält klipptes utan knapprad, valkorten var höga. SS-förlagor: `GroupEditRouteView.jsx:36-47`
(rad "‹ Tillbaka"), `ManageGroupModal.jsx:454,479,640` (rubrikrad, kropp som rullar, knapprad med `border-t`) och
`CalendarCreateDestinationSheet.jsx:53-135` ("Skapa i"). Före 0.31.0 öppnade plusset en `OpsModal`. Nu öppnar det en panel
(`OpsSkapaPanel`): på dator en sida i innehållskolumnen (kolumn 880 px, centrerad, huvudet och gruppanelen kvar, fast knapprad
längst ned till höger med `Avbryt` som textknapp och `Spara` fylld; mätt vid 1280 px: panel 200..1265, knapprad 731..800 av 800), på
telefon helskärm med egen rubrikrad (mätt 390x844: 0,0 mot hela sidbredden, knapprad 775..844, alla fyra valkort och knappraden
samtidigt, valkort 58 px höga; med fönstret krympt till 500 px, som med tangentbord: panelen 500 px, knapprad 431..500, fältet
ovanför den). Ingen `role="dialog"` för formuläret. Appens vy hålls monterad men dold, så Tillbaka återställer den, och
`?skapa=handelse` ligger i adressen (`skapa.adress: false` stänger av). Ny exporterad `OpsSkapaI` (grupper med 34 px märke och
medlemsantal, vald rad med accentkant, appens egen sektion via `skapa.skapaISektioner`, `Avbryt`): med en vald grupp visar
panelen "Skapas i: <grupp> ⌄" som öppnar den, och i läget Alla mina grupper visas den FÖRST. Formuläret får `{ groupId, typ, mal,
formId, onKlar }`; med `skapa.sparaEtikett` ritas `Spara` som `type="submit" form={formId}` (`OpsButton` fick `form`).
`OpsRadioGroup` och `OpsSegmented` är tätare: `px-3 py-2` (var `px-4 py-3`), titel i rollen `etikett`, beskrivning i `hjalp`,
`min-h-11` kvar för tummen. Prov: Vitest `skapapanel.test.jsx` (rött på 0.30.1: 11 av 12 fäller) och check-skalyta avsnitt 15
(rött mot 0.30.1: panelen öppnas aldrig). **Appen (bolag-ops):** ge händelse- och ärendeformulären `id={formId}`, skicka
`skapa.sparaEtikett`, och ta bort formulärets egna Spara och Avbryt om det ska bo i den fasta raden; för "Mina kalendrar"
skicka `skapa.skapaISektioner`.

### Design-QA cllp/bolag-ops#475, ramverkets del (avsnitt 8)
Åtta fynd på live 0.30.1. Ramverkets, och klara: **1** horisontell överflödning på modulsidan (rotorsak: `-mx-4` på tillbaka-raden, mätt
med Hub utan appens `px-4`: scrollWidth 391 mot 390, 769 mot 768, 1281 mot 1280; nu ingen överflödning vid 390, 768 och 1280 för Hub och
modulsida, med och utan padding); **2** gruppmodellen är densamma överallt och nu mätt (panel från lg, annars en växlare med märke, och
från md gruppens namn; 390, 900, 1280 på Hub och modulsida); **3** `OpsHubTillbaka` exporteras och `OpsView` fick `tillbaka`, så varje sida
under Hub kan ha "‹ Hub / Ekonomi / Inkomster" (README: varje sida under Hub bär raden); **4** barnkorten är samma kort som Hubs (ikon,
namn, räknare, info: samma rundning, padding och yta, mätt); **5** Fråga står med namn i mobilmenyn (mätt) och ikonknapparna i huvudet har
`aria-label` och en synlig tooltip (`OpsIconLink` via `OpsTooltip`; på 0.30.1 kom ingen tooltip); **6** sidchrome är dokumenterat som tokens
i README; **7** `OpsAuthGate` ritar ett skelett av huvud och innehåll och efter 8 s en rad med "Försök igen" (`OpsLaddaSkelett`, Vitest
`laddar.test.jsx` med fördröjd auth); **8** info-raden i `ink-secondary` (7,65:1 ljust och 7,72:1 mörkt mot kortet, var `ink-muted` 3,76:1
ljust) och "Inget nytt" i en egen statusstil. Inget ärende stängs. **Appens del** (kvar i bolag-ops): ersätt den kopierade raden i
`UnderHub.jsx` med `OpsView tillbaka` eller `OpsHubTillbaka`, och ge varje modulsida raden.

### Primitiverna mot SessionStudio (avsnitt 14)
Alla 93 exporterade komponenter är genomgångna; tabellen med SS-förlaga (fil:rad), avvikelse och åtgärd står i
`docs/jamforelser/0.31.0/primitiver.md`. Rättat genom gemensamma klasser: fälten (`faltKlass`: 12 px, 1,5 px kant, `bg-surface`, kontur inåt,
hover; var 10 px, 1 px, `bg-canvas`, kontur utåt, skrivet på fem ställen), `OpsModal` (448/672/1024 px och 12 px, var 384/512/768 och 16),
liten knapp (12 px text), kryssruta (18 px), valkort och segmenterad (tätare). Kvar med skäl: pillformen på knappar (CP-beslut
2026-09-28), `OpsSwitch` (kontrast), `OpsCard` 24 px. Vakt: check-skalyta avsnitt 17 mäter ett galleri i ljust och mörkt läge (fjorton
primitiver, golv 14), rött mot 0.30.1 (fält 10 px, liten knapp 14 px). Montage i `docs/jamforelser/0.31.0/`.

### Att göra i appen vid ompinning till 0.31.0
Märket: ta bort `title`, `subtitle`, `mark`, `ikon`, `ordmarkeHojd`, `endastOrdmarke`, `OPS_HUB_VARUMARKE`; utelämna `brand` (eller `namn`/`undertext`).
Skapa: formulär med `id={formId}` och `skapa.sparaEtikett`, ta bort formulärets egna Spara/Avbryt, `skapa.skapaISektioner` för kalendrar,
`skapa.kataloger` med `handelsetyper`, datum/tid med `OpsDatePicker`/`OpsTimePicker`. Hub: ersätt `UnderHub.jsx`s kopierade rad med
`OpsView tillbaka`. `OpsAuthGate` `description` används inte längre. Ramverkets `--z-dropdown` är 450.

## 0.30.1

⛔ **Mobilhuvudet, gruppanelen och loggan, och Hub, som SessionStudio.** CP
2026-09-29 13:44, efter att ha provat 0.30.0 i telefonen och på datorn: "Kolla
UI problem, både i hub med ekonomi (ekonomi skall vara expanderbar). Vidare hur
headern inte får plats med ikoner. Sedan kolla hur gruppväljaren funkar i web.
Jag vill att det funkar exakt som i sessionstudio. Se hur header-logo följer
med." Tre punkter, och alla tre mäts nu i en riktig webbläsare (`check-skalyta`,
avsnitt 7 till 9b): varje mätning var röd på 0.30.0 (16 brott) och är grön här.

### A. Mobilhuvudet flödar aldrig över

**Händelsen:** CP:s skärmbild från telefonen visade märket, temaväljaren,
gruppväxlarens märke och namn ("Claes Philip St..." i klartext), inkorg, sök,
fråga och avataren ovanpå varandra i 390 px. Ramverket lät appen lägga så många
ikoner den ville i `actions`, och en topprad har en bredd.

SessionStudios mobilhuvud är ikonen (`AppHeader.jsx:173`, `w-10`), en flexibel
lucka (`AppHeader.jsx:299`) och en klunga om fyra saker: tema, sök, plus, avatar
(`AppHeaderMobileToolbar.jsx:34-90`, monterad `AppHeader.jsx:301`). Ingen
gruppväxlare med namn, ingen inkorg, inget fråga. Ramverket gör samma sak under `md`:

- **Märket är ikonen under `md`** (`OpsBrand`, med `panelInfalld` givet). Före
  0.30.1 var ordmärket 180 px brett även på en telefon, eftersom panelen är
  "utfälld" i state fast den inte ritas under 1024 px.
- **Gruppväxlaren visar bara märket under `md`.** Namnet står kvar i arket och i
  knappens innehåll, och syns från `md`.
- **De tre första åtgärderna i `actions` stannar, resten flyttar till menyn**
  (`ATGARDER_SMAL`). En `OpsIconLink` utöver de tre göms under `md` och blir en
  rad i bottenradens Meny (först i appens sektion). Bara med `meny`: utan den har
  en flyttad åtgärd inget hem, och en åtgärd som försvinner tyst är värre än en som
  ligger kvar. Siffran bor i skalet och inte i appen, så en åttonde ikon kan inte
  ge ett överlappande huvud igen.
- **Prov:** 390 px, appens verkliga uppsättning (tema, inkorg med räknare, sök,
  fråga, avatar, gruppväxlare med ett långt namn): inga av huvudets kontroller
  överlappar (`boundingBox`), ingen horisontell överflödning, inget utanför skärmen.

### B. Gruppanelen och loggan på dator

**Händelsen:** "Se hur header-logo följer med." Loggan följde inte panelen: märket
stod 4 px in från panelens vänsterkant (`px-1` på länken), och vid 1600 px stod
panelen vid fönstrets kant medan märket stod i den centrerade toppraden, 157 px
isär. Toppradens flikar låg mitt på sidan och rörde sig aldrig när panelen fälldes.

- **Samma behållare som toppraden.** Panelen och innehållet ligger i
  `mx-auto max-w-7xl` när `grupper` finns, som SS `App.jsx:1364`. Märkesrutans
  vänsterkant är panelens, båda lägena, båda bredderna.
- **Märkesrutan är lika bred som panelens innehåll**: 180 px mot panelens 184 minus
  dess `px-0.5`, 40 mot 44. SS gör samma sak (`AppHeader.jsx:173` `md:w-[180px]`,
  `AppSidebar.jsx:43` `md:w-[184px]`), så de fyra pixlarna är panelens padding.
- **Toppraden är en flexrad, inte ett grid** (`AppHeader.jsx:194`, `flex-1
  justify-center`): flikarna ligger mitt i det som är kvar efter loggan och följer
  med när loggan går från 180 till 40 px.
- Knappen överst i panelen (SS `AppSidebar.jsx:51-59`) var redan panelens första
  barn i full bredd. Det är nu ett prov, inte ett antagande.
- **Prov:** märkesrutans vänsterkant och bredd mot panelens, högst 1 px, vid 1280 och
  1600 px, utfälld och infälld; första barnet är knappen i full bredd; flikarna
  flyttar sig minst 20 px när panelen fälls in.

### C. Hub: modulkort och modulsida

**Händelsen:** "ekonomi skall vara expanderbar". Ekonomis sex undersidor stod
uppradade under namnet, och ett kort med sex rader stod bredvid kort med noll:
fyra kort, tre höjder. CP ändrade sedan lösningen samma dag från "kortet fälls ut
på plats" till modulkort med räknare och infolinje och en egen sida per modul med barn.

- **Varje modul är ett kort som är en länk** (`OpsHub`): ikon, namn, `badge`
  (bara när den är större än noll) och en ny `info`-rad. `info` utelämnad ritar
  ingenting; `info: null` skriver "Inget nytt" / "Nothing new" (tomhet är ett
  svar, punkt 5). `info` valideras i `validateNav`: en tom sträng kastar.
- **Ny `OpsHubModul`**: en modul med barn har en egen sida med en fast
  tillbaka-rad ("‹ Hub / Ekonomi", `sticky` under toppraden, 44 px hög) och barnen
  som mindre kort med samma `badge` och `info`. Varje steg har en egen `href`, så
  webbläsarens och telefonens bakåt fungerar.
- **Rullgardinen i toppraden**: Ekonomi är en rad med chevron (`aria-expanded`)
  som fäller ut barnen; de är infällda från början.
- **Kort i en rad är lika höga** (`h-full`), och ingen text flödar ut ur ett kort
  (mätt vid 390 och 1280 px).
- **Rättat vid genomgången:** de infällda korten stod på två höjder (76 mot 354 px)
  före ändringen; nu 98 mot 76 bara mellan kort med och utan `info`, aldrig inom en rad.

### Vad appen behöver ändra

Ingenting för A och B: allt gäller det skalet redan får (`actions`, `grupper`).
Appen kan skicka `info` och `badge` på sina `moduler` och rita `OpsHubModul` på
modulens `href` (se README, "Hub och modulkort"). Ompinning till 0.30.1 krävs för
att få något av detta.

---

## 0.30.0

⛔ **Navigationen, menyn, hover, loggan, typografin och händelsen som
SessionStudio.** CP 2026-09-29, efter att ha använt 0.29.x i telefonen:
sex saker som alla var "lite fel" och som tillsammans gjorde att appen inte
kändes som förebilden. Ärendet är
[#173](https://github.com/cllp/ops-framework/issues/173). Måtten är lästa ur
SessionStudios källa med fil och rad (i koden och i fixturen), och de som beror
på pixlar mäts nu i en riktig webbläsare (`check-skalyta`), eftersom fem av de
sex gick grönt genom hela provsviten: jsdom kör ingen CSS.

### A. Fasta poster och moduler i Hub

**Händelsen:** bolag-ops hade tretton poster i navigeringen (Händelser,
Översikt, Ekonomi med fem barn, och så vidare). De fick inte plats i toppraden,
hamnade under "Meny", och menyn blev en andra navigering bredvid den första.
Ordningen, namnen och ikonerna var appens, alltså olika i varje app. CP: menyn
ska bara ha ramverkets saker, appens moduler ska ligga i Hub.

`OpsAppShell` tar `fasta` (`{ idag, kalender, hub }`, var och en `{ href }`)
och `moduler` (samma form som `nav`). Ramverket äger ordning (Idag, Kalender,
Hub), namn (sv och en) och ikoner. Toppraden visar de tre, Hub som en post med
chevron-dropdown över modulerna; bottenraden på telefon är Idag, Kalender, ETT
STORT PLUS, Hub, Meny (ikon 20 px, etikett 10 px, raden 56 px, som
`MobileTabBar.jsx:73-87`). Plusset öppnar samma lista som plusset i huvudet,
och huvudets plus göms i mobil: ett plus per yta. Ny **`OpsHub`** är sidan Hub
leder till, ett kort per modul (`rounded-card`). `nav` och `fasta` får inte
ges ihop, `moduler` kräver `fasta`, och `primaryAction` får inte ges med `fasta`:
skalet kastar hellre än att gissa. Utan `fasta` är allt som förut.

### B. Menyn: appens länkar i en egen sektion, en avgränsare mellan sektioner

**Händelsen:** mätt i Chromium, 390 px: i mobilens meny låg två streck 5 px
från varandra under arkets rubrik. Arkets rubrik hade `border-b`, första
sektionen `border-t`, och nav-blocket ovanför sitt eget `mt-1 border-t pt-1`:
ingen ägde frågan var en linje går, alla svarade "ovanför mig".

`MenyAvdelningar` äger den nu och ritar EN avgränsare mellan varje par, ingen
före den första; tomma avdelningar filtreras bort FÖRE räkningen. Menyn har två
sorters innehåll: ramverkets (`meny.sektioner`: Aktivitet, Inställningar,
Hjälp, Notiser) och appens egna länkar, `meny.app`, med egen rubrik
(`meny.appRubrik`, förval Appen/App). Menyn innehåller aldrig moduler. Radstil
som `MobileHamburgerMenu.jsx:288/346`, sektionsrubrik i rollen `liten`.

### C. Hover och rundning som SessionStudio

**Händelsen:** CP: hover och rundning "ska vara som SS". Raderna hade
`rounded-sm` och `hover:bg-accent-faint`, ikonknapparna var 44 px rundade rutor
utom plusset som var en 32 px accentfylld cirkel: tre former och tre höjder i
samma rad, och avataren hade ingen ring.

`radKlass`, `radBehallare` och `huvudknappKlass` (`src/lib/radKlass.js`) är EN
definition för fyra ytor som förut ritade raden var för sig. Raden är 12 px
(`rounded-base`) med `hover:bg-raised`, aktiv `bg-raised text-accent`;
behållaren `bg-surface` (annars syns inte hovern), `rounded-base`, `border-line`,
`shadow-lg` (ramverkets skuggskala har tre steg, SS `shadow-xl` finns inte).
Ikonknapparna är 36 px cirklar med 44 px träffyta som osynlig `after:`-yta;
avataren en 28 px cirkel (`OpsIdentity size="avatar"`) i en 32 px knapp med
`hover:ring-2`, aktiv `ring-accent` (`OpsIconLink avatar`). Mätt: mittlinjerna
för plus, ikonlänk, avatar och hamburgare skiljer 0 px. **Observerat:** i ljust
tema är `--color-raised` och `--color-surface` samma tal (`#fefcf6`), så hovern
syns inte mot behållaren där; i mörkt tema gör den det. Fixturen är oförändrad.

### D. Typografin på ett ställe, och inställningsvyn

**Händelsen:** 0.29.1 hade tio `text-[Npx]` i fem komponenter (8, 9, 10 och 11
px, var och en med sin egen vikt). Bottenradens etikett var 12 px där
SessionStudios är 10, ingen av de tio hade ett namn att peka på, och CP såg det
som "allt är lite fel".

Fixturen får `typografi.roller` (rubrik, sektion, etikett, hjalp, liten, mikro,
var och en med `_kalla` fil:rad) och `typografi.radhojd`; `generate-tokens`
skriver dem som `--text-<roll>` med sammansatta radhöjd, vikt och spärrning, och
`--leading-tight/normal`. De tio literalerna är ersatta. **`check-typografi`**
fäller `text-[..px]`, `text-[..rem]`, `font-size:` och `font-family:` (golv 60
filer, planterat fel i `test-guards`) och kan köras av en app mot sin källkatalog.
`OpsKatalogInstallning`, `OpsModulKataloger` och `OpsField` följer
SessionStudios `SettingsView`: sektionsrubrik, etikett och hjälptext som roller,
kort `rounded-base border p-5`, `gap-3`, rader `flex items-center
justify-between gap-3` med vänsterdelen `min-w-0 flex-1`. **Mätt:** ett
kategorinamn på 49 tecken (svenska sammansatta ord) gav `scrollWidth` 397 mot
`clientWidth` 390 vid 390 px; nu bryts det. Räknemärkets 8 px och vikt är rollen
`mikro`, samma värde som förut.

### E. Loggan utan text under

**Händelsen:** CP: "loggan utan text under". Märket i toppraden ritade appens
namn som undertext under bilden, alltså en kolumn på 68 px i en topprad på 56
(mätt). `OpsBrand` ritar inte längre undertexten i bildläget; `title` är bildens
`alt` och därmed länkens namn. Inloggningen behåller undertexten via ny prop
`undertext`. Toppradens höjd är oförändrat `--topbar-height`.

### F. Skapa händelse med typ och vem som skapade

**Händelsen:** CP: "skapa händelse med typ och vem som skapade". `skapa.handelse`
var ett färdigt `ReactNode`, och ett färdigt nod kan varken få en `groupId` eller
en vald typ. Det kan nu vara `{ form, katalog? }` (katalogen `"handelsetyper"`,
`katalog: null` = ingen typ) och formuläret får `{ groupId, typ, onKlar }` som en
moduls registrering. Datumfälten är formulärets. `OpsEventList` ritar "Skapad av
Namn, 29 sep 09:12" under titeln när både `skapadAv` och `skapad` finns, i lokal
tid och med orden på valt språk (`formatDagOchKlockslag`); en agent och en
människa skrivs ut med orden via `OpsProvenance`; en halv rad ritas aldrig.

### Vakter och prov

`check-skalyta` (Chromium, fail-closed, körs i CI-jobbet som redan har en
webbläsare) och `check-typografi` är nya. `check-docs` kräver nu avsnitten
"Navigationen" och "Typografin". Varje nytt prov är visat rött mot 0.29.1 och
grönt mot 0.30.0, se pull-texten.


## 0.29.1

⛔ **Rättelse: en kategori utan grupp bär ingen `groupId`-nyckel alls.**
0.29.0 skrev `groupId: null` på varje kategori som byggts utan `grupp: true`,
alltså på varje rad i en app som ännu inte grupperat sina kataloger
(övergången i cllp/bolag-ops#447). Mätt i bolag-ops ompinning till 0.29.0:
regelproven föll 10 av 151 med `PERMISSION_DENIED` på varje kategoriskrivning,
eftersom appens `hasOnly`-regler för `kategorier`, `typer` och `status` inte
känner `groupId` och inte ska göra det förrän #447 är gjort. En rad utan grupp
är nu byte för byte samma rad som i 0.28.0, och `groupId` finns på raden bara
när `grupp: true` sattes. `standardvarden()`, `las()` i ogrupperat läge och
`OpsKatalogInstallning` utan `groupId`-prop följer med. Proven är röda på
0.29.0 (5 av 90 i katalogsviten) och gröna med rättelsen. Ingen ändring för
grupperade kataloger, ingen regeländring.


## 0.29.0

⛔ **Gruppanelen och gruppväxlaren som SessionStudio, katalogerna per grupp,
vitlistan och den första gruppen, märket rättat.** CP 2026-09-28: "OCH
GRUPPVÄLJARE? Var fins det?" och senare "Titta noga på uppdelningen av header
logo och hur grupppanelen vecklas ut. Kolla i SessionStudio. Det är inte så du
angett nu. Det skall vara exakt." Måtten i den här versionen är lästa ur
SessionStudios källa med fil och rad, inte ur minnet: första utkastet hade
288/72 px, förebilden har 184/44. Ärendena är
[#160](https://github.com/cllp/ops-framework/issues/160),
[#161](https://github.com/cllp/ops-framework/issues/161) och
[#162](https://github.com/cllp/ops-framework/issues/162).

### Gruppanelen och gruppväxlaren (#161)

**`OpsAppShell` tar `grupper`** (`{ lista, aktiv, onValj, onSkapa, infalld,
onInfalld, ... }`). Från `lg` ritas `OpsGruppanel` som en kolumn UNDER
toppraden, bredvid innehållet (SessionStudio `App.jsx:1364`): utfälld 184 px
med "Alla arbetsytor", ett kort per grupp (märke 20 px, glob/info/penna,
namn, medlemsantal, runda bibliotek- och chattknappar med badge, avatarer
20 px, max fyra och "+N") och "Skapa grupp" streckad; infälld 44 px med
40 px-knappar och gruppmärke, chevronen överst i panelen. Bredden byter
direkt, utan transition (`AppSidebar.jsx:13-16`). Under `lg` ersätts panelen
av `OpsGruppvaxlare` i toppraden, ett ark med samma rader. Bredderna är
tokens: `--panel-bredd` 184 px, `--panel-bredd-infalld` 44 px, `--logo-bredd`
180 px, `--logo-bredd-infalld` 40 px (4 px skillnad som i förebilden, asidets
`px-0.5`).

**Loggan följer panelen.** `OpsBrand` tar `panelInfalld`: ordmärket (40 px
högt) när panelen är utfälld, ikonen (32 px) när den är infälld, båda alltid
monterade och crossfadade med opacity på 200 ms (`AppHeader.jsx:174-193`).

**`--radius-base` 12 px** läggs till fixturen: SessionStudios `--radius`
(`index.css:215`), det steg kort, knappar och gruppmärke ritas med. Det
saknades i 0.28.0. `OpsIdentity` får `size="xs"` (20 px).

### Vitlistan och den första gruppen (#160, #161)

**`createGroupService({ kalla, samlingar, kataloger })` på nodsidan** ger
`skapaGrupp({ uid, epost, namn })`: kontrollerar vitlistan först, en grupp per
person, skriver gruppen, sedan ägarens medlemskap, sedan gruppens kataloger.
`byggVitlisterad` och `VITLISTEFALT` med regelfragment. `OpsUtanMedlemskap`
tar `onSkapaGrupp` och visar "Skapa din första grupp" för den vitlistade.

### Katalogerna per grupp (#162)

**En kategori bär `groupId`.** `createCatalogSource` kräver `groupId` och
lagrar nyckeln `groupId|id` så två gruppers "uppgift" inte krockar i samma
samling. `OpsKatalogInstallning` och `OpsModulKataloger` tar `groupId`.
`katalogregelfragment(namn)` ger regelblocket. `seedaKataloger({ kalla,
groupId, standardvarden })` seedar en ny grupps kataloger och anropas av
`skapaGrupp` när appen anger `kataloger`. `check-gruppnyckel` blir rött om
`KATEGORIFALT` saknar `groupId`. Befintliga kategorier utan `groupId` fylls på
av appen (README, punkt 5), inte av ramverket.

### Märket (CP 23:50: "Login alldeles för stor. Och bilden ser inte rätt ut")

**Genomskinligt utanför hårlinjeramen.** Alla fyra `varumarke/*.webp` var
opaka ända ut till kanten, 3 px utanför den rundade ramen: på canvas en vit
eller svart rektangel med fyrkantiga hörn, i 32 px en suddig kant. Området är
nu alfa 0, och `generate-varumarke` vägrar en fil utan alfakanal (bevisat rött
mot originalfilen). **Storleken sätts i höjd, inte bredd.** `ordmarkeMaxWidth`
heter nu `ordmarkeHojd`: `h-10` i toppraden (`AppHeader.jsx:191`), `h-20` i
inloggningen (SessionStudios 4:1-logga vid 330 px är 82 px hög,
`LoginScreen.jsx:224`). OPS Hub-ordmärket är 2,6:1, så samma bredd gav 128 px.

### `createCatalogSource({ groupId: null })`, det ogrupperade övergångsläget

Mätt i appens ompinning: functions i bolag-ops läser hela katalogsamlingen
tills serversidan har gruppmodellen (cllp/bolag-ops#447), och #162 gjorde
`groupId` obligatoriskt, så 11 av 101 functions-prov föll och appen kunde
varken pinna om functions eller köra bakfyllnadens första steg. Bokstavligt
`null` betyder nu "ogrupperad, hela samlingen, som före #162": läser utan
`where`, hoppar över rader med en grupps nyckel, lämnar id:n orörda, seedar
utan groupId. Ett utelämnat groupId är fortfarande rött.

### Menyns undervy är levande (mätt i appens ompinning till 0.28.0)

`OpsAppShell` sparade hela menyraden i state när en undervy öppnades, alltså
även `undervy`-noden som den såg ut vid klicket. Appens nästa render nådde
aldrig panelen: en `OpsSwitch` bunden till appens state såg ut att inte
reagera förrän menyn stängts och öppnats igen, och appen tog bort
aktivitetsfiltret hellre än att visa en knapp som ljuger. Nu lagras radens
`key` och raden slås upp ur `meny.sektioner` vid varje render. Prov: en
räknare i undervyn ökar vid tryck, rött med den gamla koden och grönt med
den nya.

### Deploy (appen)

Nya samlingar: `vitlista` och katalogerna med `groupId`. **Reglerna deployas
före klienthalvan** (bolag-ops CLAUDE.md), och funktionerna som anropar
`skapaGrupp` och `seedaKataloger` deployas före den vy som anropar dem.

## 0.28.0

⛔ **Utseendet som SessionStudio, den här gången mätt och inte tyckt.** CP
2026-09-28, efter 0.27.0: "Jag ber om samma sak massor av gånger men får
ingen skillnad." Tre orsaker, alla åtgärdade i den här versionen: fel profil
hade kopierats (SessionStudios förval är `green`, `main.jsx:65`, inte
grundprofilen), "klart" mättes med jsdom-prov i stället för skärmbilder, och
releaser publicerades utan att appen pinnade om. Ärendena är
[#166](https://github.com/cllp/ops-framework/issues/166),
[#167](https://github.com/cllp/ops-framework/issues/167) och
[#168](https://github.com/cllp/ops-framework/issues/168).

### SessionStudios profil som en fixtur, med generator och vakt (#167)

**`tokens/sessionstudio-profil.json` är hela green-profilen**, avläst ur
SessionStudios källa med fil och rad per grupp: färger ljust och mörkt,
skuggor, radier, typografiskala, ikonernas linjetjocklek, kortets kant och
padding, diagramfärger, rörelsetider och toppradens höjd.
`scripts/generate-tokens.mjs` skriver blocken i `tokens/tokens.css` mellan
markörer, och `check-tokens` blir rött om ett block redigerats för hand
(regel 8/9) eller om fixturen tömts (regel 11). Generatorn kör i `prebuild`,
`pretest` och `precheck:types`, så ett handskrivet tal överlever aldrig ett
bygge.

Det som ändrats i talen: accent oliv (`#6B8E4E` ljust, `#7a9e5e` mörkt),
`--text-sm` 14 px (var 13), `--word-spacing-normal` 0,06em, mörka ytor
`#181c18/#202420/#262d26` med två nya steg `--color-elevated` och
`--color-hover`, mörk sekundärtext `#b0b8ac`, skuggor ur green-profilen (alfa
0,2/0,25/0,3, inte grundprofilens 0,3/0,4/0,5), rörelsetider 150/200/300 ms,
topprad 56 px (`--topbar-height`). Ikonerna ritas med `strokeWidth` 1,5.
`OpsCard` har ingen kant (SessionStudio skiljer kort från sida med ton, inte
linje); `kant` finns som opt-in. `OpsStat`, `OpsTable` och `OpsField` sätter
etiketter på sekundär färg i `font-medium`, aldrig `font-semibold`.

**Diagramfärgerna byter namn** från `--color-series-*` till `--color-chart-*`.
SessionStudios åtta gruppfärgförval sparas i fixturen som referens men matas
INTE in som diagramfärger: mätta med `validate_palette.js` faller de på tre
av fyra kontroller (kromgolv, CVD-separation, delta E mellan grannar), så de
sex redan validerade tonerna behålls.

### Undervyer i menyn (#166)

**En menyrad kan öppna en undervy i samma panel**: `undervy` på raden byter
panelens huvud till en tillbakapil med radens etikett som rubrik, och
innehållet byts på plats. Chevronen sätts automatiskt av `undervy`; en
handskriven `chevron` utan `undervy` är ett tomt löfte och stoppas av
vakten. Aktivitetsflödet och inställningarna hör alltså hemma i menyn, som i
SessionStudio, inte i egna sidor.

### Plusset i toppraden, byggt ur modulerna (#168)

**`OpsAppShell` tar `skapa`**: `{ handelse, arende, registreringar, lage,
kataloger, onKlar }`. Plusset är en fylld rund accentknapp mellan `actions`
och avataren, och trycket öppnar en popover med en platt lista: ramverkets
rader "Ny händelse" och "Nytt ärende" först, sedan en rad per modul som
registrerat ett skapa-formulär. Måtten är SessionStudios (`AppHeader.jsx`
create-menyn): `w-56`, rader `px-4 py-2.5 gap-3`, ikon 18 px, `text-sm
font-medium`, ikon och ord i accentfärg. `OpsPanelRow` får `accent` för
exakt den raden; menyns vanliga rad är oförändrad. Valet öppnar formuläret i
en `OpsModal`. `OpsSkapa` är nu bara listan; popovern och modalen är skalets.

### Två nya regler i kanon

**Regel 11:** en ramverksrelease är klar först när appens ompinnings-PR är
öppnad med besked, i samma pass. **Regel 12:** ett ärende som citerar
SessionStudio är klart först när PR:en bär en skärmbild av samma flöde sida
vid sida med förebilden, tagen mot en byggd app, med en ärlig jämförelse.
Konsumentrepon kör `node scripts/check-kanon.mjs --skriv`.

### Övrigt

`package-lock.json` låg kvar på 0.26.0 medan `package.json` sade 0.27.0;
versionsbumpen skriver båda.

## 0.27.0

⛔ **Skalet nättare, som SessionStudio: rundningar, typografi, en meny, en
inloggning, OPS Hub som märke.** CP 2026-09-28, med bolag-ops (0.26.0) och
SessionStudio sida vid sida: "Man ser tydligt att rundningen på ikoner och
knappar och det som ligger i huvudmenyn inte är samma som sessionstudio. Allt
ser lite bulligare ut." Ärendet är
[#164](https://github.com/cllp/ops-framework/issues/164), och varje punkt
nedan är mätt mot SessionStudios källa, inte tyckt.

### Rundningsskalan och typografin (#164)

**`--radius-sm/md/lg/xl` är nu 8/10/16/20 px, plus `--radius-card` 24 px**,
alltså den skala SessionStudio faktiskt ritar med (`.rounded-app`), inte dess
bastal 4/6/8/12 som ramverket hade kopierat. `OpsCard` använder
`--radius-card`. Regel 9 i `check-tokens.mjs` håller talen som fixtur, regel
10 fäller ett radie-literal som dubblerar ett token (fyra `9999px` i
reglaget var det).

**Knapparna blir piller** (CP 18:20: "Ja, som SessionStudio"): `OpsButton`
textknappar är `rounded-full`, vikten `font-medium` (var `font-semibold`),
`size="md"` är `text-sm` (var `text-base`). Ikonknappar oförändrade.
`OpsPanelRow` är `text-xs` och en aktiv rad byter färg, inte vikt.

### En meny, en inloggning, ett märke (#164)

**Avataren har ingen meny.** Som i SessionStudio är den en länk till
profilen ("Min profil"). **Menyn är skalets hamburgare**, och det finns bara
en: `OpsAppShell` tar `meny` (`{ sektioner, onLoggaUt, appVersion, rubrik?,
loggaUtEtikett? }`) och ritar rubriken "Meny", appens sektioner (typiskt
Notiser och Aktivitet med chevron först), navigeringens överflöd,
`menuExtras`, Logga ut och sist två versionsrader: appens och ramverkets.
`OpsBottomNav` ritar samma innehåll i bottenradens Meny-ark. `OpsAnvandarmeny`
från 0.26.0 är borta; en första omskrivning (`OpsMeny` med egen knapp) gav
två hamburgare och togs bort igen innan utgivning.

**`OpsInloggning`** ritas av `OpsAuthGate` i utloggat läge: ordmärket, appens
namn som spärrad undertext, en viskning, ett kort med Swe/Eng-pill,
leverantörsrader som piller, "ELLER", "Fortsätt med e-post och lösenord",
"Skapa konto", "Logga in med e-postlänk", och en sidfot med appens länkar och
version. **Raderna styrs av adapterns förmågor:** `createAuth` normaliserar
`signInWithGoogle` (`signIn` fungerar fortfarande), `signInWithApple`,
`sendEmailLink`/`completeEmailLink`, `signInWithPassword`, `createAccount`
och `resetPassword`, och `createGoogleAuth` tänder dem som finns i det
`sdk`-objekt appen skickar in. En app med bara Google får en rad.
`useOpsAuth()` ger `auth` och `clearError` i stället för `signIn`;
`OpsAuthGate` tar `etikett` (appens namn), `viskning`, `lankar`,
`appVersion`, `sprak`, `onSprak` i stället för `signInText`.

**OPS Hub är ramverkets märke** (CP 19:00: "Loggorna ska vara default för
ramverket"; 19:10: appens namn som undertext under loggan). Fyra webp-filer
i `varumarke/` (44 KB) bäddas in som data-URL:er vid bygget
(`scripts/generate-varumarke.mjs`, git-ignorerad utfil), så bilden finns i
paketet oavsett hur konsumenten bundlar. Bevisat i ett riktigt Vite-bygge av
scaffold-mallen. `OpsBrand` ritar ordmärket i bred vy och ikonen i smal, i
rätt tema via `useResolvedTheme`, och `title` som undertext; `ordmarke` och
`ikon` som props är en apps överridning. Namnet "Operations Hub" är borta,
`check-docs` fäller det.

### Profil, inställningar, plus-meny (#164)

**`OpsProfil`** får SessionStudios huvud (avatar, namn, e-post, rollen som
pill via `roll`), och Profilbild-sektionen erbjuder standardikon och färg
(`users` växer med `ikon` och `farg` i `ANVANDARFALT`, hasOnly följer med;
konsumenten regenererar sina regler). Det kräver ingen Storage: bara "Byt"
är gömd utan `lagring`. Länksektionen ritas bara när appen skickar
plattformar, och Språk och Utseende har en egen rubrik, Inställningar.

**`OpsKatalogInstallning`**: Ändra, Arkivera och Ta fram har ikoner.
**`OpsModulKataloger`**: varje katalog står under sin moduls namn med raden
"Används i: ...", härledd ur manifestet, och en katalog utan modul säger det.
**`OpsSkapa`**: första nivån är en platt lista med ikon och ord (som
SessionStudios plus-meny), typval och formulär efter valet; `ikonRitare` och
`tillbakaEtikett` är nya props.

### Vakter och arkitektur

`check-fonts` är obligatorisk i konsumentens `check`-kedja (`check-adoption`
fäller en `package.json` utan den; det var luckan som lät bolag-ops ladda
Inter i en vecka). Ny `check-handritade-ikoner`: en `<svg>` utanför
`icons.jsx` är röd, med fyra dokumenterade undantag. Bottennavens eget
räknemärke och två handritade kryss är ersatta av `OpsCountBadge` och
`KryssIkon`. Alla nya vakter är inkopplade i `test-guards.mjs` med rött
utan sin fix.

---

## 0.26.0

⛔ **SessionStudios profil: typsnitt, användarmeny, versionsrad, och en
aktivitetspanel som ser ut som förebilden.** CP, efter att ha lagt bolag-ops
och SessionStudio sida vid sida: "sessionstudios typsnitt är bättre än ops
framework. Jag vill följa sessionstudios profil exakt." Två ärenden, samma
dag, samma spår: [#157](https://github.com/cllp/ops-framework/issues/157) och
[#158](https://github.com/cllp/ops-framework/issues/158).

### Typsnitt, användarmeny och versionsrad ([#157](https://github.com/cllp/ops-framework/issues/157))

**Plus Jakarta Sans i stället för Inter.** `--font-sans` byter till
SessionStudios typsnitt, med samma systemstack men UTAN Inter kvar som
reserv: två typsnitt är två sanningar. Hämtningen flyttar som förut i
`create-ops-app/template/index.html`, `check-fonts.mjs` vaktar det nya
namnet. `--font-mono` hade redan SessionStudios kedja.

**`OpsAnvandarmeny` får SessionStudios form:** en rubrik ("Meny"), sektioner
skilda med linjer, ikon per rad, en chevron på rader som öppnar en panel, en
extern-länk-ikon på rader som lämnar appen, Logga ut i sin egen sektion, och
en dämpad versionsrad sist. Vilka rader som finns bestämmer appen via en ny
`sektioner`-prop (en lista rader, samma primitiv, `OpsPanelRow`, som notis-
och aktivitetspanelerna redan ritar med); formen bestämmer ramverket.

**Versionsraden bär två versioner:** `bolag-ops v1.4.2 · ops-framework
v0.26.0`. Ramverkets tal kommer ur en konstant som skrivs vid bygget ur
`package.json` (`scripts/generate-framework-version.mjs`, git-ignorerad
utfil), aldrig en handskriven kopia. Appens version är en prop; saknas den
skrivs raden ändå, med ramverkets ensam.

**Två nya primitiver**, mätta ur SessionStudios `ProfileView.jsx`:
`OpsSectionLabel` (sektionsrubrik, liten versal, spärrad, accentfärg) och
`OpsChip` (ett val i pillform, med ikon och ett valt läge).

**Kortens luft blir ett token.** `--card-padding: 20px` ersätter `OpsCard`s
hårdkodade `p-4`, mätt mot SessionStudios `p-5`. Mörkrets skuggalfa
(0.35/0.45/0.55, plus ett eget offset på `shadow-lg`) rättas till
SessionStudios exakta tal (0.3/0.4/0.5, `0 4px 16px` överallt).

⛔ **`tokens/check-tokens.mjs` fick en åttonde regel:** röd om en palettfärg
glider från SessionStudios värden, med paletten inskriven som fixtur och
skälet utskrivet. Paletten visade sig redan vara densamma, tecken för
tecken; regeln håller den så framåt.

### Aktivitet och notiser som i SessionStudio ([#158](https://github.com/cllp/ops-framework/issues/158))

CP, mobilskärmbild: "I mobile ops står Aktivitet två gånger [...]. Filter
högerställt och fult. [...] med en chevron down (expand) för detalj eftersom
notisen inte leder någonstans om det inte är en länk."

- **Rubriken stod två gånger på mobil.** Rotorsaken satt i `OpsPanel.jsx`:
  roten ritade sin egen rubrik OVANPÅ sheetens egen `Dialog.Title`, med
  samma ord. Roten ritar nu ingen egen rubrik på smal skärm.
- **"Ny" var en pill, är nu en punkt**, med ordet kvar för skärmläsaren
  (`sr-only`).
- **Raden bytte förut vy. Nu fäller en chevron ut `OpsActivityDetail` PÅ
  PLATS**, under raden, och listan blir kvar. En länk-knapp ritas bara när
  händelsen bär en `lank`.
- **Filtren låg ovanför listan, högerställda. De ligger nu bakom en
  filterknapp** i huvudet, och "Rensa" flyttade till en trepunktsmeny
  bredvid den. Ingendera syns förrän man tryckt på sin knapp.
- **Grupperingens ord rättades**: "I går" → "Igår", "Senaste veckan" →
  "Denna vecka".

Datamodellen och läsmarkeringen (`lasning`, `onSeen`, `onRead`) är
oförändrade: det här ärendet är ytan, inte källan. `OpsActivityButton` fick
`open`/`onOpenChange`/`renderTrigger`, så panelen går att nå från en rad i
`OpsAnvandarmeny` i stället för bara från sin egen klocka.

⛔ **Mätt i en riktig webbläsare, inte i jsdom:** att öppna panelen från en
rad i en ANNAN, just stängd, Radix-yta gjorde att panelen stängde sig själv
igen inom 10-15 ms. Fokus, som satt på menyraden, hamnade på `<body>` när
menyn stängdes, och `OpsPanel`s `DismissableLayer` läste det som "fokus
utanför". `onOpenAutoFocus`/`onFocusOutside` avstyrs nu på panelens
rullgardin; ett riktigt klick utanför stänger fortfarande som förut.

**Granskningsrättelse:** `handelse.lank` ({ href, etikett }) skrevs och
lästes utan att formen någonsin kontrollerades. `createActivityLog` avvisar
nu en `lank` vars `href` inte är https eller en relativ sökväg, eller vars
`etikett` är tom. `ACTIVITY_SECTIONS` bar dessutom fyra hårdkodade svenska
ord trots epikens princip om tvåspråkigt från dag ett (#109); etiketterna är
nu `{ sv, en }` och `OpsActivityList`/`OpsActivityButton` tar emot en
`sprak`-prop, precis som `OpsProfil`.

### Profilen som i SessionStudio ([#156](https://github.com/cllp/ops-framework/issues/156))

CP: "vill ha profil precis som SessionStudio." Mätt mot SessionStudios
`ProfileView.jsx`: bild, namn, telefon, stad, presentation och länkar är
fält varje app med människor behöver, alltså ramverkets. Det kreativa
(discipliner, roller, instrument) är SessionStudios egna begrepp och hör
INTE hit, se `OpsProfil`s nya `children`-slot.

**`users` växer med fem fält** (`ANVANDARFALT`, `byggAnvandare` i
`src/lib/grupp.js`): `telefon` (E.164 eller tom sträng), `stad`,
`presentation` (max `MAX_PRESENTATION`, 500 tecken), `lankar` (lista av
`{ plattform, url }`, plattformen måste finnas i den lista appen skickar in,
url måste vara https) och `bildSokvag` (lagringssökvägen, så bilden går att
ta bort). Alla tomma strängar/listor när de saknas, aldrig utelämnade fält.

**Namn och bild blir redigerbara av personen själv.** `sparaInstallningar`
tar nu emot alla `PERSONFALT`, inte bara språk och tema. En namn- eller
bildändring når däremot inte automatiskt medlemslistorna:
`memberships` skrivs aldrig av en klient (#136), så en ny nodfunktion,
`uppdateraProfil({ kalla, uid, andring })` (`@staiger/ops-framework/node`),
skriver `users` OCH alla medlemskap för `uid` i samma steg. Appen anropar
den, via en server-callable, när `onSpara` ser namn eller bild i andringen.

**Ramverkets första Storage-yta**, bredvid `kalla`: `createStorageSource`
(kontraktet), `createMemoryStorage` (för prov), `createFirebaseStorageSource`
(mot Firebase Storage, ramverket importerar ingen Firebase-SDK) och
`lagringsregelfragment({ prefix })` (bara sin egen sökväg, bara bilder,
2 MB tak). `OpsProfil` fungerar utan en `lagring`-prop: Profilbild-sektionens
knappar döljs då helt, ramverket kräver inte Storage.

**`regelfragment()`s `users`-block fick en `keys().hasOnly`**, exakt
`ANVANDARFALT`, splittad i `allow read, delete` och `allow create, update`
(`request.resource` finns bara på det senare). `check-gruppnyckel.mjs`
vaktar att `ANVANDARFALT` och `hasOnly`-listan inte glider isär.

**`OpsProfil` får tre nya sektioner**, byggda med `OpsSectionLabel`,
`OpsChip` och `OpsCard`: Profilbild (ladda upp, ta bort, återställ från
inloggningen), Personuppgifter (namn, telefon, stad, presentation) och
Länkar (plattform ur appens lista + url). En `children`-slot sist, för
appens egna sektioner.

⛔ **Storage-emulatorprov finns inte ännu.** `lagringsregelfragment` provas
som text, inte mot en riktig Storage-emulator: `rules/__tests__/` kör bara
Firestore-emulatorn i dag.

### Felrapportering: felgräns, loggpunkt, Sentry som valfri mottagare ([#159](https://github.com/cllp/ops-framework/issues/159))

CP: "Skall Sentry vara default eller optional i framework?" Beslut, CP:s
svar "Allt perfekt": **valfritt, men färdigkopplat.**

**`OpsAppShell` har nu en felgräns som alltid är på**, ingen prop stänger
av den. Ett kastat fel ger en felyta med ett sexteckens id och en
Ladda om-knapp, aldrig en vit sida.

**En ny loggpunkt**, `rapporteraFel(fel, sammanhang, felmottagare)`
(`src/lib/felrapport.js`): skriver ALLTID till `console.error`, oavsett
mottagare eller miljö, och vidarebefordrar till `felmottagare.fanga` när en
sådan finns. Kastar aldrig, ett fel i mottagaren fångas och loggas separat.

**Ett kontrakt för mottagare**, `{ fanga, satt }`. `OpsAppShell` kallar
`fanga` från felgränsen. `OpsAuthProvider` (nu med en `felmottagare`-prop)
kallar `satt({ uid, groupId })` vid varje inloggningsbyte och `satt(null)`
vid utloggning, aldrig med e-post.

**En färdig Sentry-mottagare**, i en egen, obundlad ingång:
`@staiger/ops-framework/sentry`, `sentryMottagare({ dsn, miljo, version })`.
`@sentry/browser` bara laddas av den app som skriver raden;
`check-paket.mjs` bevisar att ramverkets `dist/index.js` aldrig nämner
Sentry. `@sentry/browser` är en `peerDependency`, `optional: true`, aldrig
en `dependency`.

**Scaffold-mallen** (`create-ops-app`): den handrullade
`src/lib/ErrorBoundary.jsx` togs bort, den dupplicerade nu exakt det
`OpsAppShell` gör åt alla. `App.jsx` har en utkommenterad rad för Sentry med
skälet till att den är av som förval.

---

## 0.25.0

⛔ **Fas 2.5 i sin helhet: ramverket vet nu vems rad en rad är.**

Fram till här svarade `members/{uid}` på "vem får använda appen". Det svarar inte
på "vems rad är det här", och utan det svaret kan två verksamheter inte dela en
app. Fem PR:ar samma dag, epiken [#92](https://github.com/cllp/ops-framework/issues/92).

### ⛔ Medlemskapets nyckel är entydig ([#152](https://github.com/cllp/ops-framework/issues/152))

Avgränsaren i `medlemskapsId` går från `_` till `|`, och den är nu **ett värde**
som både funktionen och regelfragmentet läser: `MEDLEMSKAPSAVGRANSARE`.

⛔ **Med understreck var nyckeln tvetydig.** `ID_FORM` tillåter understreck i
ett id, alltså var avgränsaren ett lagligt tecken i båda halvorna:

```
medlemskapsId("a_b", "c")  ->  "a_b_c"
medlemskapsId("a", "b_c")  ->  "a_b_c"
```

Två olika medlemskap pekade på samma dokument, och vilken roll som gällde
avgjordes av vem som skrev sist. Regeln slår upp exakt den nyckeln.

⛔ **Felet var av den tysta sorten.** Ingenting kraschar. En person får fel roll
i en grupp, eller ser en grupp hen inte är med i, och det syns inte i en logg.

⛔ **Och det ändras nu för att migreringen är TOM.** Noll skarpa medlemskap
finns. Om en månad hade varje nyckel i databasen behövt skrivas om, plus
reglerna, i samma andetag.

⛔ **`medlemskapsId` kastar ändå om någon halva innehåller avgränsaren.**
`ID_FORM` släpper inte igenom `|`, men `userId` är ett Firebase-uid och alltså
någon annans format: med en custom token är det fritt. Att lita på en annan
leverantörs format är ett antagande, i en kodrad som avgör behörighet.

⛔ **Tecknet stod förut på tre ställen**, en gång i `grupp.js` och två gånger i
regelfragmentet. Tre handskrivna kopior av samma faktum, och den dag en av dem
ändrades hade regeln nekat varje läsning utan att något prov var rött. Ett prov
mäter nu att regeltexten bär samma tecken som konstanten.

**Har du redan medlemskap i en databas** måste varje `memberships`-dokument
skrivas om till den nya nyckeln innan reglerna deployas. Inom bolag-ops finns
inga, så där är det en tom åtgärd.

### Grupper och medlemskap ([#136](https://github.com/cllp/ops-framework/issues/136))

Fyra samlingar ramverket äger: `users`, `groups`, `memberships`, `invitations`.
Appen skickar in namnen, som för katalogen, så en kund senare kan bli ett eget
Firebase-projekt utan att datamodellen ändras.

⛔ **Exakt en gruppnyckel per rad.** Varje rad bär `groupId`, ett värde, aldrig
en lista, och läsregeln blir ETT uppslag mot `memberships`. `check-gruppnyckel`
vaktar raden. SessionStudio bar `invitedGroupIds` och fick bära "eller någon av
de här" i varje regel, varje fråga och varje vy, och det gick inte att ta bort
efteråt eftersom datan redan hade formen.

⛔ **`memberships` skrivs aldrig av en klient.** Den som kan skriva sitt eget
medlemskap kan ge sig själv rollen ägare i vilken grupp som helst vars id hen
gissar. Reglerna säger `allow write: if false`, och serversidan skriver.

`regelfragment()` och `gruppadSamling()` genererar regeltexten appen limmar in.
Firestore-regler har ingen import, så alternativet är en textsnutt någon
klistrar in per samling, och den dagen villkoret ändras sitter den gamla kvar i
de samlingar ingen kom ihåg. Ramverket fick samtidigt sin första emulatorkedja.

### Profil, inställningar och utloggning ([#138](https://github.com/cllp/ops-framework/issues/138))

`OpsProfil`, `OpsAnvandarmeny` och en `anvandare`-plats i `OpsAppShell`, plus
`sakerstallAnvandare`, `sparaInstallningar` och `andringen` i `profil.js`.

⛔ **Beslutet ligger i en ren funktion, inte i komponenten.** En Radix-komponent
går inte att driva med `fireEvent` i jsdom, så två prov stod gröna på att
ingenting hände. `andringen()` flyttade beslutet dit ett prov når det.

### Inbjudan och vägen in ([#137](https://github.com/cllp/ops-framework/issues/137))

`createInvitationService` i `./node` med `bjudIn` och `accepteraInbjudningar`,
plus `OpsMedlemmar` och `OpsUtanMedlemskap`.

⛔ **Ägarskapet kontrolleras i funktionen, inte bara i reglerna.** En callable
med Admin SDK kör FÖRBI reglerna, så en ägarkontroll som bara finns i
`firestore.rules` gör funktionen till en väg runt dem.

⛔ **En inbjudans roll är oföränderlig.** En inbjudan är ett löfte någon redan
fått: höjs rollen i efterhand blir en accepterad inbjudan till medlem plötsligt
ett ägarskap, utan att den som accepterade såg det.

### Gruppväljare, gruppfilter och sammanslagning ([#139](https://github.com/cllp/ops-framework/issues/139))

`OpsGruppvaljare`, `OpsGruppfilter` och `OpsGruppmarke`, plus `grupplage.js` och
`gruppkalla.js`. Två lägen: en vald grupp, eller alla mina.

⛔ **Sammanslagning är inte delning.** I läget alla frågas varje grupp en gång,
`slaIhopSvar` märker varje rad med sin grupp, och ingen rad och ingen regel
ändras. En fråga per grupp, ingen optimering.

⛔ **`groupId` är ett krav i TYPEN**, och `check-gruppfraga` kör tsc mot en
fråga och ett skapande utan grupp och kräver ett typfel för var och en. En vakt
som letat efter raden i källan hade varit ett närvarogrep.

### Nytt i den publika ytan

`ROLLER`, `MEDLEMSTYPER`, `MEDLEMSSTATUS`, `INBJUDNINGSSTATUS`, `TEMAN`,
`byggAnvandare`, `byggGrupp`, `byggMedlemskap`, `byggInbjudan`, `medlemskapsId`,
`regelfragment`, `gruppadSamling`, `sakerstallAnvandare`, `sparaInstallningar`,
`andringen`, `ALLA_GRUPPER`, `minaGrupper`, `valtLage`, `grupperAttFraga`,
`navForLage`, `gruppenAttSkapaI`, `slaIhopSvar`, `grupplagetsNyckel`,
`lasAktivGrupp`, `sparaAktivGrupp`, `gruppLista`, `gruppSkapa`, `listaPerGrupp`,
`raderPerGrupp`, samt komponenterna `OpsProfil`, `OpsAnvandarmeny`,
`OpsMedlemmar`, `OpsUtanMedlemskap`, `OpsGruppvaljare`, `OpsGruppfilter` och
`OpsGruppmarke`. `createInvitationService` i `./node`.

⛔ **Ingenting togs bort och ingenting bytte form.** En app som inte använder
grupper märker inte den här versionen, vilket är skälet att den är minor och
inte major.

### Tre luckor stängda innan taggen

⛔ **Gruppens modullista valideras mot de registrerade.** `byggGrupp(rad,
kandaModuler)` avvisar ett påhittat modul-id, som annars sparades som en flik
ingen hittar. Argumentet är valfritt med flit: skrivvägen skickar in listan,
läsvägen måste tåla en avinstallerad modul och får sitt svar av `navForLage`.

⛔ **`memberships` bär `namn` och `bild`** (beslut A i #138). E-posten lämnar
aldrig `users`, och utan de två fälten hade medlemslistan varit en rad uid:n.
Serversidan skriver dem vid inbjudan och vid acceptans, och profilen läses en
gång även när tre inbjudningar accepteras samtidigt.

⛔ **`check-kontrast` och `check-gruppnyckel` går nu att göra röda.** Båda
saknade bevis i båda riktningarna, alltså var de förhoppningar och inte vakter.
Sökvägarna går att peka om, båda har golv mot tom indata, och nio nya fall i
`test-guards` planterar riktiga fel: brödtext i bakgrundens färg,
`invitedGroupIds` i en fältlista, `array-contains` i regeltexten och en regel
som slutat slå upp medlemskapet.

⛔ **Och kontrastvakten kraschade i stället för att mäta** när ett tokenblock
saknades. Ett oväntat undantag är visserligen rött, men säger fel sak, och det
är precis den "röd av fel anledning" som harnessets andra villkor finns för.

### Fas 3, första tre ärendena

⛔ **Källkontraktet** (#129). `skapaKallregister(moduler)` ger en funktion per
yta, och varje anrop bär exakt en grupp. Formen prövas när raden kommer, inte
vid uppstart: vad en funktion returnerar går inte att veta förrän den anropats,
och felet namnger modulen, ytan och radnumret. `OpsModulHandelser`,
`OpsModulHjalp` och `OpsModulKataloger` läser ur registret, medan primitiverna
fortsätter ta emot data. `useKallor` skiljer på laddar, fel, tomt och fyller.

⛔ **Regelgeneratorn** (#130). `generateRules(moduler, { extra })` ger hela
`firestore.rules` ur manifesten. Manifestets `samlingar` bär nu fält, eftersom
`keys().hasOnly` inte går att generera ur ett namn; strängformen från 0.25.0
tas fortfarande emot och läsaren får alltid den utskrivna formen.
`check-regelgenerator` jämför mot en gyllene fil.

⛔ **En modulsamling får `allow delete: if false`** (granskningsfynd på PR 151).
Generatorn skrev först att en medlem fick radera. #136:s beslut är arkivering
och aldrig radering, eftersom svaret på "varför försvann den" alltid
efterfrågas i efterhand, och ramverkets egna samlingar har redan `delete: if
false`. Generatorn hade alltså infört den enda raderingsvägen i hela modellen,
som ett förval ingen valt. Behöver en modul radera ska det bli ett beslut i
manifestet med sitt skäl. `test-guards` är rött om `delete` blir något annat
än `false`.

⛔ **Exempelmodulen** (#131) i `examples/paminnelser/`, som nu följer med
paketet. `check-exempelmodul` kräver att varje manifestfält, samlingsfält och
källtyp finns både i README-avsnittet och i exemplet.

⛔ **Exemplet importerar via paketnamnet, inte via `../../src/`**
(granskningsfynd på PR 151). Det importerade ramverkets innanmäte medan README
säger `import { defineModule } from "@staiger/ops-framework"`, alltså bröt det
mot det enda löfte mappen finns för: att gå att kopiera och bygga ur README
utan att öppna källkoden. En modulbyggare fick sökvägar som inte finns i en
installerad tarboll. Node tillåter självreferens via paketnamnet när `exports`
finns, så det fungerar även inne i repot. Vakten fäller nu varje import som
lämnar exempelmappen, och släpper igenom relativa vägar inom den: den gamla
vakten jämförde fältnamn, och importvägar är inte fältnamn.

⛔ **Manifestet importerar sin vy med `lazy`**, och exemplet visar varför:
regelgeneratorn körs i ett Node-skript, och Node kan inte läsa JSX.

### De tre ytorna som saknades

⛔ **Sök** (#140), **Notiser** (#141) och **Översikt** (#142). Alla tre läser ur
källregistret och äger sin egen tomhet, sitt fel och sin väntan.

Sök indexerar inte: ramverket frågar källorna och visar vad de ger. Fältet
frågar inte förrän något skrivits, eftersom en modul som får en tom söksträng
rimligen svarar med allt den har. Tomheten bär sökordet, så stavfelet syns.

Notisernas läsmärke är ramverkets data och skickas in av appen. Räknaren kan
inte nå en grupp jag inte är med i, och det följer av kontraktet i stället för
av en kontroll: källan frågas per grupp.

Översikten är alltid en grupps. En widget som saknas i gruppens ordning hamnar
sist, inte utanför: en ny modul ska dyka upp, inte vara osynlig tills någon
redigerat en lista de inte visste fanns.

### Skapa-kontraktet: plusset ([#150](https://github.com/cllp/ops-framework/issues/150))

⛔ **Manifestet får sin sjunde del, och den är spegelbilden av källorna.**
Källorna läser IN i ramverkets ytor, `skapar[]` skriver UT ur plusset. En
registrering bär `{ id, namn, ikon, katalog, form }`, och `OpsSkapa` ritar en
flik per registrering från den aktiva gruppens påslagna moduler.

⛔ **BRYTANDE: `skapar` krävs i varje manifest, även tomt.** Samma skäl som
`kallor: {}`: en modul som inte kan skapa något och en som glömt fältet ser
likadana ut om det är valfritt. Lägg till `skapar: []` i manifest som inte
registrerar något.

⛔ **Ramverket äger panelen, modulen äger formuläret.** Formuläret får
`{ groupId, typ, onKlar }` och ingenting mer. Skulle ramverket skriva raden
måste det känna till modulens samling, och då är uppdelningen bara en
uppdelning på papperet.

⛔ **Tre tomlägen, inte två.** `skapalaget` skiljer "välj en grupp först" från
"inget att skapa här", eftersom de kräver olika handlingar. Samma text för båda
lär användaren att plusset är trasigt, och den läxan sitter kvar efter att
texten rättats.

⛔ **Katalogkontrollen bor i `kontrolleraSkaparkataloger`, inte i
`defineModule`, och det är en avvikelse från ärendets ord "kastar vid
uppstart".** Kataloger kommer ur `kallor.kataloger`, alltså ur en funktion som
frågas per grupp, och ingen lista finns förrän den frågats. Kontrollen körs så
tidigt den kan: när gruppens kataloger är lästa.

### Kedjan kontrollerar nu varje PR

`check.yml` hade `branches: [main]` på `pull_request`, så en PR mot en annan
gren fick NOLL kontroller, tyst. Tre av fasens PR:ar stod så i timmar, varken
röda eller gröna. Filtret är borta och en knapp för att köra kedjan för hand är
tillagd.

---

## 0.24.0

⛔ **Primärknappens text var oläsbar i ljust läge, och blev sämre av att man
pekade på den.**

`--color-accent-contrast` var `#f8f7f4`, alltså sidans botten, avläst ur
förlagans enda accentfyllda knapp. Paritet var beslutet, och svagheten stod
utskriven vid tokenet som "medvetet ärvd". Tre fynd 2026-09-27, och bara det
första var känt:

| | på `accent` | på `accent-hover` |
|---|---|---|
| `#f8f7f4`, förut | **2,79:1** | **2,44:1** |
| `#1a1a1a`, nu | **5,83:1** | **6,66:1** |
| WCAG AA kräver | 4,5:1 | 4,5:1 |

⛔ **Noten hade fel siffra.** Den sade 2,99:1. Rätt svar är 2,79:1, och 2,99 är
vad `raised` ger på accent, alltså raden bredvid i tabellen i
`check-kontrast.mjs`. En felskriven siffra i en not om en MÄTT svaghet är precis
den sorts uppgift ingen kontrollerar igen: den ser redan verifierad ut.

⛔ **Hover-läget var aldrig mätt.** Det var sämre än viloläget. En vakt som bara
mäter vila godkänner en knapp som blir oläsbar när muspekaren når den.

### Ändrat

- Ljust `--color-accent-contrast` går från `#f8f7f4` till `#1a1a1a`. Värdet är
  inte påhittat: det är `--color-ink`, sidans egen text. En egen hex här hade
  varit en färg vid sidan av paletten.

### Lagt till

- Två par i `PAR` i `scripts/check-kontrast.mjs`: `primärknappens text` och
  `primärknappens text, hover`. Noten på platsen sade att hålet skulle stängas
  den dag beslutet togs, och **en kommentar fäller inget bygge.**

### Inte ändrat

**Mörkt läge.** Det gav redan 11,56:1 och 12,76:1, och värdet står orört.

**Reglagets på-läge.** Knoppen är då en yta och inte text, och inget befintligt
token klarar 3:1 mot accent i båda teman. Hålet står kvar i noten, med sitt skäl.

### ⛔ Vad som faktiskt ändras för den som uppgraderar

Tokenet bär mer än en knapp. Fyra komponenter ser annorlunda ut i ljust läge:

| Komponent | Vad som ändras |
|---|---|
| `OpsButton variant="primary"` | textens färg |
| `OpsBottomNav` | FAB:ens plustecken och räknemärkets siffra |
| `OpsDatePicker` | den valda dagens siffra |
| `OpsToggle` | kryssrutans bock |

⛔ **Bocken är det som gör det här till mer än kosmetik.** Den är en grafik på
accent och behövde 3:1, vilket 2,79:1 aldrig var. Ändringen stänger därmed också
en del av cllp/bolag-ops#417.

### Beviset i båda riktningarna

| | Utfall |
|---|---|
| `check-kontrast` **utan** fixen | `exit 1`, båda paren utskrivna med sina tal |
| `check-kontrast` **med** fixen | 19 par i 2 teman, alla över AA, `exit 0` |

---

## 0.23.1

⛔ **Katalogschemat hade elva kontroller och nio prov. Mätt, inte antaget.**

En granskning (cllp/bolag-ops#420) noterade att katalogproven saknade synligt
bevis på rött utan sin fix. Beviset togs genom att slå ut varje kontroll i
`byggKategori` och `validateKatalog`, en i taget, och köra de fyra
katalogprovfilerna mot den trasiga koden.

Nio kontroller gav rött. **Två gick att ta bort utan att något blev rött:**

| Kontroll | Utfall före | Varför den överlevde |
|---|---|---|
| `id` krävs | **grön** | En tom sträng föll ändå på ID-formen. Beteendet var rätt, meddelandet blev fel |
| `ikon` krävs | **grön** | En tom ikon föll ändå på tillåtelselistan, men bara när en lista skickas in |

⛔ **Den andra är den farliga.** Utan tillåtelselista fanns ingenting kvar:
`if (!ikon)` var det enda som stod mellan en kategori utan ikon och ett tyst
godkännande. Och det läget är inte hypotetiskt: `functions/katalog.js` i
bolag-ops bygger sin katalogkälla helt utan `ikoner`, med flit, eftersom en
ikon som appen känner men inte functions annars hade fällt hela katalogen till
reserven för något som bara rör en vy.

### Lagt till

- Två prov i `src/__tests__/katalog.test.js`: en kategori utan `id` avvisas med
  meddelandet "id krävs", och en kategori utan `ikon` avvisas **också när ingen
  tillåtelselista skickats**. Båda visade sig röda utan sin kontroll.
- Hela mutationssvepet skrivet i provfilens filhuvud, så nästa läsare ser vad
  som faktiskt är bevisat och vad som bara är skrivet.

### Inte ändrat

Ingen kod i `src/lib/katalog.js`. Kontrollerna fanns och gjorde rätt; det som
saknades var beviset.

---

## 0.23.0

⛔ **Reglaget gick inte att se, och det var inte bara i mörkt läge.**

CP 2026-09-26, med bild från mobilen: "Går ej att se kontrast på toggle".
Mätt mot tokens gällde det båda temana, och det var inte en knopp som var svår
att se utan en knopp som inte fanns:

| Par | Ljust | Mörkt |
|---|---|---|
| spår av (`sunken`) mot panelen (`raised`) | 1,17:1 | **1,00:1** |
| knopp (`canvas`) mot spår av (`sunken`) | 1,09:1 | 1,14:1 |

### Ändrat

- **`OpsToggle`s switch har kant på både spår och knopp.** Fyllningen kan inte
  bära kravet: `sunken` ligger per definition nära ytan den vilar på. Kanten
  (`ink-secondary`) ger 9,47:1 i ljust och 5,10:1 i mörkt.
- **Knoppen ligger på `raised` i stället för `canvas`.** Det är tokenet för det
  som ligger ovanpå något, och det enda som når 3:1 mot `accent` i mörkt läge.
- **`check-kontrast` bevakar två av reglagets par**, och ett prov bredvid
  kräver att komponenten faktiskt ritar de tokens vakten mäter. En vakt som
  mäter tokens är grön även när ingen ritar dem.

### Känt hål, utskrivet

Knoppen i **på**-läget når inte 3:1 mot `accent` i ljust läge, och det går inte
att lösa med befintliga tokens: ljust `accent` (#9a9588) ligger mitt i skalan,
för mörkt för en ljus knopp och för ljust för en mörk. Samma orsak som gör att
`accent-contrast` bara ger 2,79:1 på `accent` i ljust, vilket redan står
utskrivet vid tokenet.

Hålet stängs den dag ljust `--color-accent-contrast` blir mörkt (#1a1a1a ger
5,83:1), och det är ett produktbeslut om hur varje primärknapp ser ut.

I på-läget bär formen i stället: knoppen flyttar sig, och spårets kant mot
panelen står kvar. Läget avgörs alltså aldrig av färg ensam (WCAG 1.4.1).

---

## 0.22.0

⛔ **Två adaptrar av samma kontrakt svarade olika på samma anrop.**
`createFirestoreSource.create` med ett eget id gör `setDoc`, alltså ersätter
dokumentet. `createMemorySource.create` la till en andra rad med samma id.

Upptäckt i `cllp/bolag-ops` när inställningsvyn skulle provas: `list()` gav två
poster där Firestore hade gett en, och `find(r => r.id === x)` svarade med den
gamla. Provet var rött mot en app som var rätt.

Riktningen kan lika gärna bli den andra. En adapter som står in för en annan i
proven måste svara likadant på samma anrop, annars mäter provsviten en app som
inte finns.

### Ändrat

- **`createMemorySource.create` ersätter posten när anropet bär ett eget `id`**,
  precis som `setDoc`. Ersätter, slår inte ihop: en sammanslagning hade dolt en
  bugg där appen skickar en delmängd, alltså fungerat i provet och tappat fält i
  produktionen. Det är `update` som slår ihop. Utan id skapas fortfarande en ny
  post med ett genererat id, precis som `addDoc`.
- **Kontraktet säger nu vad ett eget `id` BETYDER vid `create`.** Det stod
  ingenstans, så båda adaptrarna hade rätt var för sig.

---

## 0.21.0

⛔ **Panelen följde sin egen regel på bred skärm och bröt den på smal.**
Filhuvudet i `OpsPanel` sade redan att panelen ska se ut som menyn, för att den
är samma sak. Men menyn är inte samma yta i båda bredderna: på bred skärm är
den en rullgardin i headern, på smal skärm en sheet i `OpsBottomNav`. Panelen
var en rullgardin i båda.

CP 2026-09-26: "Vill ha notisers funktion med inkorgs utseende. Alltså bara att
det är en egen panel och ingen ful dropdown. Den ser inte ut som i
SessionStudio och är inget nice i mobil."

### Ändrat

- **`OpsPanel` är en sheet under `md` och en rullgardin från `md` och upp.**
  Sheeten är samma yta som `OpsBottomNav`s Meny-sheet ned i detaljerna:
  `85dvh`, rundad överkant, `--safe-bottom`, egen stängknapp. Beteendet är
  oförändrat: samma stack, samma tillbakapil, samma nollställning vid
  stängning.
- **Tre lappar försvann med ytan.** `max-w-[calc(100vw-1.5rem)]`, taket på
  `70vh` och den egna dämpningen `data-ops-panel-scrim` fanns alla för att en
  22 rem bred rullgardin inte fick plats på en telefon. Sheeten har Radix egen
  `Dialog.Overlay` i stället.
- **Nytt fel: `closeLabel`** på `OpsPanel`, skärmläsarnamnet på sheetens
  stängknapp. Förval `"Stäng"`, samma som `OpsBottomNav`.

⛔ **Valet görs i JS och inte med CSS.** Att rendera båda och dölja den ena är
mönstret i `OpsAppShell`, och det duger för en nav. Panelen bär en fokusfälla
och en triggerknapp: två rötter hade gett två fokusfällor, två klockor i DOM:en
och dubbletter i varje `getByRole` hos appen. Utan `matchMedia`, alltså i jsdom
och vid serverrendering, blir det rullgardinen.

### Mätt under arbetet

- `role="dialog"` skiljer **inte** ytorna åt: Radix `Popover.Content` sätter den
  också. Ett prov på rollen var grönt på bred skärm, alltså bevakade det inget.
- `aria-modal` sätts **inte** av Radix `Dialog` här. Provet som utgick från det
  var rött mot en sheet som renderades rätt.
- Det som faktiskt skiljer är behållaren, vilket också är precis det som
  klagomålet handlade om. Proven kontrollerar därför ytans klasser.

## 0.20.0

Fas 2 fortsätter. Båda luckorna nedan hittades när appens halva
([cllp/bolag-ops#384](https://github.com/cllp/bolag-ops/issues/384)) skulle
börja, alltså precis i den ordning som skulle hitta dem: ramverket först, appen
sedan.

⛔ **`0.19.0` och den första `0.20.0` hann aldrig taggas.** Därför står #119 i
det här avsnittet i stället för i ett eget: en version ingen någonsin kan
installera är en rad i loggen som bara går att snubbla på.

### Tillagt

- **`texter` på kategorin** ([#117](https://github.com/cllp/ops-framework/issues/117)).
  En påse namngivna texter, var och en ett `Namn` och alltså tvåspråkig. Skälet
  är mätt i appens listor: en kategori behöver plural i filtret ("Uppgifter"),
  singular på raden ("Uppgift"), en kort form i smala kontroller ("Ekonomi"),
  och inkorgens sorter dessutom nio hjälptexter var. ⛔ En påse och inte fasta
  fält, eftersom vilka texter som behövs är appens fråga och inte ramverkets.
  Ramverket vet inte vad en rubrikhjälp är; det det kan veta är att varje text
  har svenska.
- **`textnycklar`, alltså vilka texter katalogen kräver**. Skickas till
  `validateKatalog`, `byggKategori` och `createCatalogSource`. En kategori som
  saknar en deklarerad nyckel är rött vid uppstart. ⛔ Utan det kravet är
  "texterna tappas inte i flytten" ett löfte utan vakt: en kategori som läggs
  till i inställningsvyn föds då utan hjälptexter, och resultatet är ett
  formulär med tomma fält och inga exempel, alltså sämre än listan det ersatte.
- **`faser`, alltså om katalogen har faser alls** ([#119](https://github.com/cllp/ops-framework/issues/119)).
  Skickas till `byggKategori`, `validateKatalog` och `createCatalogSource`.
  Förvalet är `true`, alltså oförändrat. En **sortkatalog** deklareras med
  `faser: false` och får `fas: null`. Skälet är mätt i cllp/bolag-ops#384: av
  appens åtta listor är varenda en som flyttar en sortlista (uppgift,
  påminnelse, faktum, kvitto, ärende), och `arAvslutad` och `AVSLUTADE_FASER`
  används ingenstans i appen. Fasen finns för att en vy ska kunna fråga om en
  RAD är klar, och i en sortkatalog avgörs det av radens egen status och aldrig
  av dess sort. ⛔ En fas som ändå skickas in **avvisas**, den ignoreras inte:
  vore fältet bara valfritt kunde två kategorier i samma katalog skilja sig åt,
  och då kan ingen vy lita på svaret. ⛔ `null` och inte tom sträng, eftersom
  `null` säger "den här katalogen har inga faser" medan en tom sträng ser ut som
  något någon glömt fylla i.
- **`farger`, alltså om katalogen har färger alls** ([#121](https://github.com/cllp/ops-framework/issues/121)).
  Samma form och samma skäl som `faser`. Slagpaletten har **tre** platser, och
  det är en mätt gräns där en fjärde faller i mörkt läge. Inkorgens **sex**
  sorter kan alltså inte få var sin, och de skiljs redan i dag åt med ikon och
  aldrig med färg, varken i vyn eller i datan. Att kräva en palettplats hade
  tvingat fram dubbletter i ett schema som annars är strikt, och två kategorier
  med samma färg är en färg som slutat betyda något. ⛔ Ikonen krävs fortfarande:
  utan färg bär den hela igenkänningen.
- **`texten(kategori, nyckel, sprak)`**. Svarar tom sträng och kastar aldrig,
  samma val som `beteendet()`: den körs i en vy, på en rad som kan peka på en
  kategori som hunnit arkiveras, och en vy som kastar där tar ned hela listan i
  stället för en rad.

### Ändrat

- ⛔ **`byggKategori` AVVISAR OKÄNDA FÄLT i stället för att slänga dem.** Mätt
  före ändringen: en kategori skriven med `lofte` och `titleHint` högst upp kom
  ut utan båda, och ingenting kastades. Den som skrev fick en grön uppstart och
  en tom rad i vyn, alltså letade i vyn efter ett fel som låg i katalogen. Felet
  säger nu vart texten hör hemma i stället. Det här är den enda ändringen som
  gör resten omöjlig att göra fel, och det är skälet till att den finns.
- **`saknadeSprak` räknar också texterna i påsen.** Inkorgens sorter bär nio
  texter var, alltså vida fler ord än namnen. En vakt som bara tittade på
  nyckeln `namn` hade visat noll medan merparten av appens ytor fortfarande var
  enspråkiga, vilket är exakt det den finns för att förhindra.
- **`OpsKatalogInstallning` ritar varken fasväljare, färgväljare eller prick**
  när katalogen saknar dem, och ingen tom fas-etikett på raden. En rullgardin för något som inte sparas är
  värre än ingen: den som väljer i den tror att valet betyder något, och det
  hade dessutom stått i den enda vy som byggts för den som äger verksamheten.
- **`OpsKatalogInstallning` både bär och visar texterna.** Vyn byggde förut en
  ny kategori av formulärets fält och bara dem, så en redigering av en befintlig
  kategori hade RADERAT dess texter: samma tysta förlust en gång till, men
  utlöst av en knapp och därmed värre. ⛔ Den ritar också de texter kategorin
  bär utan att de är deklarerade, eftersom en text som bärs vidare utan att
  synas är ett läge där vyn ljuger med utelämnande.

⛔ **Bakåtkompatibelt.** `texter` är en tom påse när inget skickas in, och
`textnycklar` utan värde kräver ingenting. Det som inte är bakåtkompatibelt är
avvisningen av okända fält, och den är avsiktlig: ett fält som försvann tyst
förut gör det inte längre.

---

## 0.19.0

Fas 2 i epiken [#92](https://github.com/cllp/ops-framework/issues/92), ramverkets
del: konfigurationen blir data, och orden blir två.

### Tillagt

- **Katalogschemat, med validering vid uppstart** ([#108](https://github.com/cllp/ops-framework/issues/108)).
  En kategori är `{ id, namn, farg, ikon, fas, ordning, arkiverad }`.
  `validateKatalog` körs vid uppstart i samma form som `validateNav` och kastar
  med katalogens namn och fältet. ⛔ `id` ändras aldrig och `namn` får ändras
  fritt, eftersom varje rad i databasen pekar på `id`: vore namnet nyckeln
  förlorar en omdöpning kopplingen till allt som redan skrivits. ⛔ `farg` är en
  palettplats och aldrig hex, för en hex i konfigurationen följer inte med när
  temat byter. ⛔ Två kategorier med samma `id` är ett eget fel: de ser ut som
  EN i varje vy.
- **Två språk** ([#109](https://github.com/cllp/ops-framework/issues/109)). Ett
  namn är `{ sv, en }`. `text()` tar emot en sträng också, samma
  migreringsordning som `skapadAv` fick i Fas 1: läsaren måste tåla båda
  formerna innan skrivarna byter. ⛔ Toleransen är inte tyst: `saknadeSprak`
  räknar upp varje namn som saknar `en`, som sökvägar och inte som en siffra,
  och en sträng räknas som saknad.
- **Katalogkällan** ([#110](https://github.com/cllp/ops-framework/issues/110)).
  `createCatalogSource` ovanpå datakontraktet. ⛔ Seedar aldrig ovanpå
  befintliga värden, annars kommer en arkiverad kategori tillbaka vid nästa
  driftsättning. ⛔ `las()` kastar aldrig och skiljer `databas` från `reserv`, så
  ett läsfel kan visas i stället för att se ut som en tom katalog. ⛔ Samlingens
  namn kommer utifrån: ramverket känner aldrig projekt-id eller samlingsnamn.
- **Inställningsvyn** ([#112](https://github.com/cllp/ops-framework/issues/112)).
  `OpsKatalogInstallning` lägger till, döper om och arkiverar. ⛔ Raderar aldrig:
  en raderad kategori lämnar varje rad som pekar på den utan kategori. ⛔ Ägaren
  ändrar, medlemmen läser, och vyn säger själv att den inte är låset.
- **Ändringsloggen för konfig** ([#113](https://github.com/cllp/ops-framework/issues/113)).
  `createConfigLog`. ⛔ `fore` krävs för allt utom en nytillagd: en rad utan det
  svarar inte på vad som stod förut, och då är loggen en notis och inte ett
  spår. ⛔ `skriv` kastar aldrig, och `orsak` skiljer ett trasigt utkast från en
  trasig skrivning.

- **Gränsen för det dynamiska, väg A** ([#111](https://github.com/cllp/ops-framework/issues/111),
  beslut CP 2026-09-26). Katalogen bär data, koden bär beteende, och
  `kopplaBeteenden` vaktar kopplingen åt BÅDA håll vid uppstart. ⛔ En kategori
  utan hanterare ritas, går att välja och gör sedan ingenting: exakt felet i
  cllp/bolag-ops#144, där sorten `bugg` aldrig blev ett ärende och ingenting
  blev rött. ⛔ En hanterare utan kategori är död kod som ser levande ut.
  ⛔ Arkiverade kategorier kräver också en hanterare, eftersom gamla rader ska
  ritas och räknas som förut. Vad som går att ändra utan en release står som en
  tabell i README: det är produktlöftet, och oskrivet blir det ett antagande.

### Noteringar

- Allt ovan ligger i **båda ingångarna**, huvudingången och nodsidan, av samma
  skäl som `createActivityLog`: konfigurationen läses också av det som körs utan
  skärm, och nodsidan tar 8 ms mot huvudingångens 1946 ms.
- Ingen konsument läser katalogen ännu. Utgivningen finns för att appens halva
  ska kunna pinna mot en tagg där allt är grönt.

---

## 0.18.0

Fas 1 i epiken [#92](https://github.com/cllp/ops-framework/issues/92), ramverkets
del: identiteten får en form.

### Tillagt

- **`skapadAv` blir `{ uid, namn, typ, kalla }`** ([#106](https://github.com/cllp/ops-framework/issues/106)).
  Fältet bar en fri sträng, och tre sorters värde hamnade i det: en e-postadress
  från klienten, `"ops-agent"` från agenten, och en påhittad adress från
  mätbygget.

  ⛔ En adress går inte att kontrollera i en Firestore-regel. Regeln har bara
  `request.auth.uid` att jämföra med, så länge fältet är en sträng är det ett
  **påstående** och inte ett bevis.

- `byggSkapare`, `laesSkapare`, `skaparensNamn`, `arGammalForm` och
  `SKAPARTYPER`, ur **båda** ingångarna: klienten och nodsidan skriver samma
  fält.

  ⛔ `laesSkapare` tål den gamla strängen, och det är inte snällhet.
  Migreringsordningen är tvingande: läsaren måste tåla båda formerna **innan**
  skrivaren byter, annars visar varje vy tomt för varje omigrerat dokument i
  samma sekund.

- `createCaseModel().buildEntry` tar `skapare`. `email` fungerar kvar, av samma
  skäl: en konsument som inte bytt ska inte gå sönder av en uppgradering.

---

## 0.17.1

Släpps för **räknemärkesfixen** (CP 2026-09-25): `v0.17.0` saknar den, så en app
som pinnar den versionen backar märket på live-sidan.

### Ändrat

- **Räknemärket ser ut som inkorgens gamla** (CP 18:10, #97): `h-4 min-w-4
  px-0.5`, `text-[8px] font-bold`, hörnet `-top-0.5 -right-0.5`, ingen ring,
  på alla placeringar. Versionen nedan (`text-xs`, ring, flyttad placering) var
  fel förlaga.
- **Ett räknemärke, `OpsCountBadge`**, för inkorgen, klockan, toppradens flikar
  och panelens rader ([#97](https://github.com/cllp/ops-framework/issues/97)).
  16 px högt, `text-xs` med `tabular-nums`, `badge`/`badge-contrast` i båda
  teman, kapas vid "99+" (tidigare "9+" på inkorgen och flikarna).
- **"Ny" har en ton**, `STATUS_TONES.ny` (info), i Aktivitet och i appens lista
  (bolag-ops #363). Aktivitetens eget röda chip är borta.
- **Panelen på telefon** får en dämpning bakom sig (`--z-scrim`, under kromet),
  egen staplingskontext och `shadow-lg`.
- `check-kontrast` mäter genomskinliga ytor sammansatta över sin bas och vaktar
  "Ny" och märket mot headern.

### Tillagt

Följdrättningen till [#93](https://github.com/cllp/ops-framework/issues/93) åker
med: utan den kostar det ärendet ville uppnå nästan två sekunder per kallstart.

- `createActivityLog` återexporteras ur `@staiger/ops-framework/node`. Den låg
  bara i huvudingången, så ett Cloud Function som ville skriva en rad i loggen
  tvingades importera hela webbuntlen. Mätt, Node 20, ur den utgivna tarbollen:

  | import | tid |
  |---|---|
  | `@staiger/ops-framework/node` | **8 ms** |
  | `@staiger/ops-framework` | **1946 ms** |

- `check-node-side` kräver att nodsidan inte når React eller en komponent,
  varken direkt eller genom en mellanfil.

### Rättat

- ⛔ **`check-node-side` såg inte sidoeffektimporter.** Mönstret matchade
  `from "x"` och `import("x")` men inte `import "x";`, alltså den form man
  skriver när man vill åt en bieffekt. Mätt: en planterad `import "react";` i
  `src/node/index.js` lämnade vakten grön. Gäller båda halvorna av vakten, så
  en webbfil hade kunnat sidoeffektimportera nodsidan utan att bygget föll.
- Filhuvudena sade `@staiger/ops-framework/nod`. Ingången heter `/node`.

---

## 0.17.0

Fas 0 i epiken [#92](https://github.com/cllp/ops-framework/issues/92). Första
taggade versionen: fram till nu har konsumentapparna pinnat en SHA.

### Tillagt

- **Paketet ges ut som en packad tarboll på en GitHub-release** vid varje tagg
  `vX.Y.Z` ([#93](https://github.com/cllp/ops-framework/issues/93)). Färdigbyggd,
  så ingen `prepare` behövs hos den som installerar, och publik HTTPS, så ingen
  inloggning behövs. Det är det som gör att `bolag-ops/functions` kan sluta bära
  en kopia av aktivitetsloggen.
- `OpsCalendar` och `OpsDatePicker` tar `locale`
  ([#95](https://github.com/cllp/ops-framework/issues/95)). Månads- och
  veckodagsnamn kommer ur `Intl` i stället för ur handskrivna listor.
- `monthNames(locale)`, `weekdayNames(locale)` och `DEFAULT_LOCALE` i
  `src/lib/calendar.js`. `dateText` tar locale som andra argument.
- `createCaseModel` ger `STATUS` ([#94](https://github.com/cllp/ops-framework/issues/94)).
- Tre vakter: `check-statusord`, `check-datumnamn`, `check-paket`.

### Ändrat

- **Taxonomin heter Status, inte Läge** ([#94](https://github.com/cllp/ops-framework/issues/94)).
  Värdena `ny`, `hanterad` och `avskriven` är orörda: de står i Firestore.
- Veckodagen i kalendern skrivs `Tors` i stället för `Tor`, vilket är den
  korrekta svenska förkortningen och det `Intl` svarar.
- `CLAUDE.md` och README: ramverket äger datamodell och regler för sina **egna**
  samlingar ([#96](https://github.com/cllp/ops-framework/issues/96)).

### Utfasat

- `createCaseModel().STATES` heter `STATUS`. Aliaset är samma frysta objekt och
  står kvar tills bolag-ops pekar på en tagg som bytt.

### Borttaget

- `MONTH_NAMES` ur `src/lib/calendar.js`. Den var intern, aldrig exporterad ur
  `src/index.js`, och hade inga användare kvar efter #95.

---

## 0.16.2

Sista versionen före taggarna. Historiken före den här punkten står i
commit-loggen och i ärendena, inte här.
