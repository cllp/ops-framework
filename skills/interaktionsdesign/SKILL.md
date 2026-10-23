---
name: interaktionsdesign
description: Hur en vy blir lugn, strukturerad och användbar. Hierarki, hur mycket text som får stå, formulär bakom en knapp, grupperade val, täthet och en checklista före varje PR med UI. Ladda innan du bygger eller ändrar en vy, ett formulär eller en lista i ramverket eller i en app.
konsument: true
---

# Interaktionsdesign och användbarhet

Skillen gäller dig som bygger en vy. Den säger hur mycket som får stå på en yta, i vilken
ordning, och vad som ska ligga bakom en knapp i stället för på sidan. Typografin (storlekar,
vikter) står i `css-and-components`. Den här säger VAD som ritas, inte bara hur stort.

## ⛔ Varför den finns

CP 2026-10-21, med två skärmbilder (LifeHubs Inställningar, panelen API-nycklar, bredvid
SessionStudios Mitt bibliotek): "Det känns som att någon skrivit över vilka typsnitt vi skall
använda i appen. Ser inte ut som SessionStudio. Känns tjockt och stort och inte snyggt och
enkelt." Och: "Jag skulle vilja att du lade till skills på interaktionsdesign och usability så
att det blir användarvänligt och strukturerat. Väldigt plottrigt allt. Ligger stora sjok i
många rader."

Mätt samma dag var typsnittet rätt (Plus Jakarta Sans, samma som SessionStudio) och
storleksskalan SessionStudios. Det som skilde var två saker. Dels VILKEN roll en komponent
valde (kryssrutans etikett 16 px mot SS 14, flikar 16/600 mot 12/500, listradens titel 16/600
mot 14/500), det rättades i komponenterna. Dels hur MYCKET en vy lade på ytan: API-nycklarnas
panel hade tre sektionsrubriker i versaler, sju stycken förklaringstext, två öppna formulär
med åtta kryssrutor var och en lång lista där de befintliga nycklarna stod mellan
formulären. SessionStudios Mitt bibliotek har en rubrik, en flikrad, en sökruta och listan.
Det andra felet rättar ingen komponent. Det rättas av den som bygger vyn, och därför finns
den här filen.

## 1. Hierarki: en sidrubrik, få sektioner, det viktigaste först

- **En sidrubrik** (`OpsViewHeader`). Ingen andra rubrik som är lika stor.
- **Få sektioner.** Fler än tre sektioner på en yta är en lista som ska delas i paneler
  (`OpsInstallningar`: lista, sedan en panel per sektion) eller flikar (`OpsTabs`).
- **Det som finns före det som skapas.** Användaren kom för sina befintliga saker. Listan
  med nycklar, medlemmar eller kategorier står överst, och "Ny ..." är en knapp, inte ett
  formulär ovanför listan.
- **Det vanliga före det sällsynta.** En stängd nyckel, en gammal post eller en avancerad
  inställning hör till en `OpsDisclosure` eller en egen flik.

*API-nycklarna som motexempel:* gruppens nycklar och personens egna stod i samma panel,
varje sektion med sitt eget formulär och sin egen förklaring. Rätt: en lista (egna och, för
ägare och admin, gruppens), en knapp "Ny nyckel" och en rad för stängda nycklar.

## 2. Text: en mening, inte ett stycke

- **En mening under en rubrik, högst.** Behövs mer: bakom frågetecknet (`OpsHelp`, och
  `OpsViewHeader` gör det åt vyns beskrivning) eller i hjälpsidan. CP 2026-09-22: "Låt texter
  komma fram med hjälp av att man trycker på ett frågetecken, så blir appen lite renare."
- **Samma förklaring en gång.** Står den i introt behöver den inte stå som hjälptext under
  fältet och igen i en tom-text. Tre kopior av samma sak läses som tre olika saker.
- **Tomt är en rad och en knapp**, `OpsEmpty`: "Inga nycklar ännu" och knappen som skapar
  den första. Inte ett stycke om vad en nyckel är.
- **Versala sektionsrubriker sparsamt.** Rollen `sektion` (12 px, 600, versaler) är för
  grupper i en lång yta. Fyra versala rubriker i en panel gör att ingen av dem syns.
- **Skriv för den som ska göra något**, inte för den som byggde: utfallet, inte
  implementationen. Inga utvecklarord i det som syns (`check-utvecklarord`).

## 3. Formulär bakom en knapp

- **Ett formulär som skapar något öppnas av en knapp** ("Ny nyckel") och ritas i en dialog
  (`OpsModal`, titel krävs) eller en egen panel, aldrig öppet på sidan bland listan. Sidan
  visar det som finns. Dialogen visar det som skapas.
- **Ett formulär har få fält**: namn och det som är nödvändigt. Resten får förval, eller
  ligger under "Mer inställningar" (`OpsDisclosure`).
- **En primär knapp per vy** (`OpsButton variant="primary"`), på samma ställe i hela appen.
  Avbryt är den tysta.
- **Hjälptexten under ett fält är en rad** (`OpsField hint`, 11 px). Behöver fältet mer: ett
  exempel i fältet (`placeholder`), inte ett stycke.

## 4. Val: grupperade, kompakta

- **En lång lista av kryssrutor är fel form.** Åtta rader ovanpå varandra läses som ett
  formulär med åtta frågor. Gruppera dem efter betydelse (Läsa, Skriva) med en rubrik per
  grupp och lägg dem i ett rutnät (`grid grid-cols-1 sm:grid-cols-2 gap-x-6`).
- **Växel eller kryssruta?** En växel (`OpsSwitch`) slår om något direkt. En kryssruta
  (`OpsCheckbox`) väljer något som träder i kraft när man sparar. Blanda dem inte.
- **Två eller tre lägen** är `OpsSegmented`. Fler än fem val är en lista eller en väljare
  (`OpsSelect`), inte en rad knappar.
- **Förval som passar de flesta.** Ett val som alla gör likadant är ingen fråga.

## 5. Täthet och luft, som SessionStudio

Storlekarna kommer ur rollerna, aldrig ur en egen siffra. SessionStudios (mätta, och vakten
`check-typografimatning` håller dem):

| Element | Roll | Mått |
|---|---|---|
| Sektionsrubrik | `sektion` + versaler | 12 px, 600 |
| Rad, etikett, brödtext i UI | `etikett` | 14 px, 400 |
| Radens titel, fältets etikett, knapp, banner- och tom-titel | `etikett` + `font-medium` | 14 px, 500 |
| Beskrivning under en titel, bannertext, flik | `meta` (flik: `font-medium`) | 12 px |
| Hjälptext under en rad eller ett fält | `hjalp` | 11 px |

- **Brödtext i UI är 14 px.** `text-brod` (16 px) är för läsning (dokument) och för fält på
  telefon (`text-brod md:text-etikett`, så iOS inte zoomar). Vakten `check-typografi` fäller
  `text-brod` på en etikett.
- **Vikt: 400 för text, 500 för det som ska stå ut (radnamn, pill, flik, knapp), 600 för
  rubriker.** En rad där allt är fetstil har ingen betoning. `font-semibold` på ett radnamn
  fälls av vakten.
- **Luft ur tokens**: `gap-2`, `gap-3`, `gap-4`, `gap-6`. Ingen `mt-[13px]`. Mellan sektioner
  `gap-6`, inom en sektion `gap-2` till `gap-4`.
- **Radlängd**: löptext går inte över cirka 65 tecken (`max-w-prose`). Lång text i full
  bredd på en skrivbordsyta läses inte.

## 6. Konsekvens: samma mönster överallt

- **Lista, detalj, skapa** ser likadana ut i hela appen: raden öppnar detaljen, ⋮ eller
  långtryck ger åtgärderna (`OpsAtgardsblad`), "Ny ..." öppnar dialogen. Två vyer som löser
  samma sak olika är den vanligaste orsaken till att en produkt känns hopsatt.
- **Ramverkets komponent före en egen.** Saknas den du behöver: lägg den i ramverket. En
  lokal knapp eller rad är början på två appar som ser olika ut.
- **Samma ord för samma sak**, på båda språken. Ett ord som byter i en annan vy är en ny sak
  för användaren.

## 7. Väntan: varje tryck som väntar på svar visar det

CP 2026-10-23, om en knapp som blev blek utan att något syntes medan servern svarade: "Medans man kopplar måste man få en progress. Detta
glömmer vi ofta. Se till att alla ställen där användaren väntar på svar får en progress." Knappen hade `disabled` men ingen snurra och inget
verb, så den som tryckte såg en grå knapp och visste inte om trycket gick fram. Ramverket hade sedan 0.129.0 ett gemensamt väntläge i
`OpsButton`, men ingenting såg till att varje knapp som startar ett anrop FAKTISKT nådde det. Mätt 2026-10-23: 19 ställen i ramverkets egna
komponenter gjorde det inte (11 råa knappar, 6 svalda löften, 2 submit-knappar), bland dem Anslut och Koppla från i modulramen, Ja/Nej på
en inbjudan, Spara av ett trädnamn och skicka i chatten.

- **Använd `OpsButton`.** Ger `onClick` ett löfte är knappen upptagen tills det är klart: snurra, `aria-busy`, spärrad mot dubbeltryck. Du
  behöver inte göra något mer, men löftet MÅSTE nå knappen: `onClick={() => spara(x)}`, inte `onClick={() => { void spara(x); }}` och inte
  en funktion som startar anropet och ger tillbaka inget. Det andra är det vanligaste sättet att missa.
- **Säg vad som pågår: `busyLabel`.** `<OpsButton busyLabel="Kopplar…">Koppla</OpsButton>` byter etiketten mot verbet i pågående form
  medan knappen väntar ("Sparar…", "Kopplar…", "Skickar dig till banken…", "Tar bort…"). Etiketten ligger kvar osynlig i samma ruta, så
  knappen inte ändrar bredd. En snurra utan verb säger att något pågår men inte vad.
- **`type="submit"` har ingen `onClick` att läsa ett löfte ur.** Ett formulär vars `onSubmit` startar ett anrop ger sin submit-knapp
  `busy={sparar}` (en egen flagga som sätts före anropet och släpps i `finally`). Knappen utanför formuläret (`form={id}`) likadant.
- **En rå `<button>` som startar ett anrop är fel.** Behövs en egen form (en rund färgprick, en ikon i ett fält): sätt `aria-busy`, rita
  `OpsSpinner size="sm" decorative` i knappen och spärra de syskon som inte ska tryckas under tiden.
- **Felet står vid knappen och knappen blir tryckbar igen.** Ingen knapp går tillbaka till vila utan att något hänt: klart, fel eller en
  omdirigering. Ett löfte som avslås svälj aldrig tyst (arbetsreglernas punkt 5). En omdirigering till en annan sida (banken, inloggningen)
  är också ett svar: knappen väntar på sidbytet, och verbet säger vart ("Skickar dig till banken…").
- **Bara `disabled` är inte väntan.** En knapp som blir blek är det CP såg. `disabled` för att något annat pågår är rätt (Avbryt medan Spara
  väntar), men knappen som STARTADE anropet visar snurran.
- **Undantaget är optimistiskt, och det är ett undantag.** Ritas resultatet i samma varv som trycket och ställs tillbaka med ett fel om
  anropet faller (ordningen på appar, en tagg, en lista) behövs ingen snurra, för trycket gav ett synligt svar. Kommentera då raden
  `vantar-ej: <skäl>` (minst 20 tecken). Vakten `check-vantar` har ett tak på antalet och räknar en död rad som fel: undantaget är för
  det optimistiska och det som har en egen statusrad, aldrig för "den går snabbt". Det som går snabbt idag är långsamt i en kallstart.

*Vad vakten ser och inte ser:* `npm run check:vantar` läser komponenterna som syntax (inte som text) och fäller en knapp vars handlare
startar ett anrop (`await`, `.then`, eller en `on...`-prop som JSDoc deklarerar med `Promise`) utan att knappen väntar. Den ser inte om
snurran SYNS eller om verbet är rätt. Det mäts i en webbläsare (`check-skalyta`) och av dig.

## Checklista före varje PR med UI

Gå igenom den, och skriv i PR-texten vad som är avbockat och vad som medvetet inte är det.

1. En sidrubrik. Högst tre sektioner. Det befintliga står före formulär för att skapa nytt.
2. Ingen text längre än en mening utan att ligga bakom `OpsHelp` eller hjälpsidan. Ingen
   förklaring står två gånger.
3. Skapa-formulär ligger i en dialog bakom en knapp. Tomt läge är en rad och en knapp.
4. Val med fler än fyra alternativ är grupperade och i rutnät, inte en lång lista.
5. Alla storlekar är roller. Ingen `text-brod` på en etikett, ingen `font-semibold` på ett
   radnamn. `npm run check` och `check:typografi` är gröna.
6. Samma mönster som övriga appen för lista, detalj och skapa.
7. ⛔ **Montage bredvid förebilden** (arbetsreglernas regel 12): har ärendet en
   SessionStudio-skärmbild, bär PR:en en skärmbild av ramverkets flöde bredvid den, tagen
   med Playwright mot en byggd app (aldrig jsdom), och en ärlig jämförelse: vad som nu
   matchar och vad som fortfarande skiljer sig. Utan en SS-bild som förebild: ändå en
   skärmbild på 390 och 1280 px, så att den som granskar ser ytan och inte bara diffen.
8. Förebilden är ett golv, inte ett tak (regel 13): är SessionStudio plottrigare än du kan
   göra den, gör den enklare och skriv det i PR-texten.
9. ⛔ **Varje tryck som väntar på svar visar väntan** (avsnitt 7): snurra, verb i pågående form (`busyLabel`), låst mot dubbeltryck och
   `aria-busy`. Gå igenom varje knapp du rört och fråga "vad ser jag medan servern svarar?". `npm run check:vantar` är grön.

## Vad vakterna ser och vad de inte ser

`check:typografi` ser storlek och vikt per klasssträng. `check:vantar` ser att en knapp som startar ett anrop väntar (avsnitt 7). `check:typografimatning` ritar
komponenterna i en webbläsare och mäter. Ingen vakt ser att en vy har tre stycken för mycket
eller ett formulär som borde legat bakom en knapp. Det är därför den här checklistan finns:
den som bygger vyn är vakten för det som ingen maskin mäter.
