# Beslut 0002: kommentarer och flera bilagor på en händelse

Status: **beslutat** (2026-10-02, CP svarade "Ja och ja" på frågorna nedan). Kommentarerna byggda i 0.48.0; flera bilagor väntar på #192. Ärende: cllp/ops-framework#232. Appens halva: cllp/bolag-ops#539.
Relaterat: #221 (en bilaga, 0.45.0), #192 (Bibliotek), cllp/bolag-ops#519 (appens bilaga), cllp/bolag-ops#538 (Sammankomst).
Det här är ett designbeslut. Ingen kod i den här leveransen bygger kommentarerna eller bilagelistan; följdstegen längst ned gör det.

## Händelsen

CP 2026-10-02, överlämningen i #232: händelser ska kunna ha en kommentarstråd och fler än en bilaga. Två saker gör att
kontraktet måste skrivas före koden och inte efter:

1. **Den enda bilagan är en data-URL i dokumentet** (0.45.0, `HandelseVy.bilaga`). Taket är 700 000 tecken, både i appens
   regel (`handelsebilagaGiltig`) och i datalagret (`MAX_HANDELSEBILAGA = MAX_ATTACHMENT_CHARS`). Ett Firestore-dokument
   rymmer 1 MiB. Två bilagor av den storleken får alltså inte plats i samma händelse, och en lista som tyst växte ur
   `bilaga` hade fallit först hos den som laddade upp den andra.
2. **Svaren (0.37.0) visade redan vägen för det som hör till en händelse men inte är dess innehåll.** De ligger i en
   undersamling, en rad per person, och reglerna för dem står i ramverkets regelfragment. Kommentarer är samma sorts sak.

## Beslutet

### 1. Flera bilagor: Storage via Bibliotek, inte en lista av data-URL

| | A) Storage, via Bibliotek (#192) | B) Flera data-URL i dokumentet |
|---|---|---|
| Storlek | Filen ligger utanför dokumentet. Taket sätts per fil i Storage-reglerna. | Alla bilagor delar 1 MiB med händelsens övriga fält. Två fulla bilagor går inte. |
| Läsning | Händelsen bär bara metadata och en referens. Listan, Idag och kalendern läser små dokument. | Varje läsning av händelsen hämtar alla filer, också där bara rubriken ritas. |
| Behörighet | Egna Storage-regler, som måste spegla gruppens. En regel till att hålla i takt. | Följer händelsens regler gratis. |
| Återanvändning | Samma fil kan visas i Bibliotek och i flera händelser. | Varje händelse har sin egen kopia. |
| Radering | Filen måste städas när den sista referensen försvinner (eller behållas med flit, som i Bibliotek). | Försvinner med dokumentet. |
| Beroende | Väntar på #192 och på en Storage-bucket i appens projekt. | Kan byggas i dag. |

**Rekommendation: A.** B skalar inte, och dess enda fördel (inget beroende) är just den sortens genväg regel 1 förbjuder:
den hade varit snabb i dag och en datamigrering när den första stora filen kom.

⛔ **Den singulära `bilaga` utökas inte och byter inte form.** Den står kvar som den är tills bilagelistan finns. Då blir
den en rad i listan genom en uttalad migrering (läs `bilaga`, skriv en fil i Storage och en rad i listan, ta bort fältet),
aldrig genom att läsaren börjar acceptera båda formerna för alltid.

⛔ **Tills #192 finns gäller en bilaga plus `text`.** Multi-bilaga **väntar på #192 / Storage**, och det står så i
ärendet i stället för att en halv lösning byggs runt det.

Kontraktet när #192 finns, så att Bibliotek byggs med det i åtanke:

```
HandelseVy.bilagor?: ReadonlyArray<{
  id: string,          Bibliotekets id för filen
  namn: string,        filnamnet som det visas
  typ: string,         MIME-typen
  byte: number,        storleken, för "2,3 MB" i panelen
  url?: string,        nedladdningslänk, hämtad av appen (aldrig lagrad: Storage-länkar har tokens)
}>
```

Panelen ritar listan med samma rad som den enda bilagan har i dag (bild som miniatyr, annat som filnamn och storlek).
Väljaren tar emot flera filer, med ett tak per fil och ett tak för antalet, båda satta av appen.

### 2. Kommentarer: en undersamling speglad från inkorgen, regler i ramverkets fragment

**Sökväg:** `<händelser>/{händelse}/kommentarer/{kommentar}`. Samlingsnamnen skickas in av appen, som för svaren
(ramverket känner aldrig ett samlingsnamn, se "Vad som inte är regler här" i `CLAUDE.md`).

**Fält, exakt lista:**

| Fält | Typ | Varför |
|---|---|---|
| `text` | sträng, 1 till 5 000 tecken, trimmad | Samma tak som inkorgens kommentarer i bolag-ops (`MAX_KOMMENTAR`), så att en mening som går att skriva på ett ställe går att skriva på det andra. |
| `skapad` | ISO-tid | Ordningen i tråden. Tråden läses äldst först. |
| `skapadAv` | `{ uid, namn, typ, kalla }` ur `byggSkapare` | Vem som skrev. Regeln kräver `skapadAv.uid == request.auth.uid`, som på händelsen. |

Inga `synk`, `resultat` eller `fel`: de finns på inkorgens kommentarer för att de speglas till GitHub. **En händelse har
ingen GitHub-spegel**, och fält för en spegel som inte finns är fält som ljuger om att något väntar.

**Regelförväntan** (i ramverkets handelsefragment, provat mot emulatorn som svaren):

| | Regel |
|---|---|
| read | Den som får läsa händelsen. |
| create | Medlem i händelsens grupp, `skrevSigSjalv()`, exakt fältlista, textens längd. |
| update | Stängd. En kommentar ändras inte i efterhand: ett svar på den hade annars kunnat stå under en mening som inte längre finns. |
| delete | Bara den som skrev den, också efter att hen lämnat gruppen. CP 2026-10-02: "Ja". |

⛔ **Reglerna deployas före den klienthalva som skriver kommentarer** (bolag-ops `CLAUDE.md`). I #539 är ordningen alltså:
ramverkets release med fragmentet, appens regeldeploy, och först därefter appens PR som kopplar in tråden.

**Panelen:** `OpsHandelsePanel` får en slot `kommentarer` (en `ReactNode`, som `svar`), och ramverket en primitiv
`OpsKommentarer` med listan och skrivrutan: `{ kommentarer, uid, onSkriv, onTaBort?, laddar, fel }`. Appen kopplar data, ramverket
ritar. Tom tråd skrivs ut som "Inga kommentarer än" (punkt 5), aldrig som en tom yta.

### 3. Det som inte ingår

- Ingen GitHub-spegel av händelsekommentarer.
- Inga omnämnanden.
- Ingen redigering av en skickad kommentar (se update ovan).

## CP:s svar (2026-10-02): "Ja och ja"

1. **Den som skrev en kommentar får ta bort den.** Bara sin egen, och regeln prövar det. Inkorgens kommentarer går inte att ta
   bort, men där är skälet GitHub-kopian, som inte finns här.
2. **En ny kommentar syns i Inkorgen.** Den skrivs inte till någon: raden härleds, som `svarsrader`. Varje person har ett
   läsmärke per händelse (`<händelser>/{hid}/<läsmärken>/{uid}`, fältet `lastTill`), och `kommentarsrader` ger en rad per
   händelse där någon annan skrivit efter märket. Appen flyttar märket när händelsen öppnas, och raden försvinner. Egna
   kommentarer ger ingen rad. Utan märke är alla andras kommentarer olästa; vilka händelser som läses (fönstret) avgör appen,
   samma som för svarsraderna, så gamla trådar fyller inte inkorgen.

   ⛔ Förslaget var nej i första leveransen, av kostnadsskäl: raden kräver en läsning av tråden och en av märket per händelse i
   fönstret. CP valde ja. Priset står här så att den som ser läsningarna växa vet varifrån de kommer.

## Följdsteg

1. ~~Ramverket: `OpsKommentarer`, slotten i `OpsHandelsePanel`, kommentarmodellen och regelfragmentet.~~ Klart i 0.48.0, med
   läsmärkena, `kommentarsrader` och `OpsKommentarsrad` för Inkorgen.
2. bolag-ops#539: regeldeploy, sedan klienten och ompinningen.
3. #192 (Bibliotek), därefter `bilagor` enligt kontraktet ovan och migreringen av `bilaga`.
