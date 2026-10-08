# Ändringslogg

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/), och
versionerna är [semver](https://semver.org/lang/sv/).

⛔ **Varje tagg `vX.Y.Z` ska ha ett avsnitt här.** `check-paket` kräver att
versionen i `package.json` står i den här filen, eftersom en utgivning utan
anteckningar är en version ingen kan välja att hoppa över.

---

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

Gruppen är kalendern (lane 6 steg F).

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
