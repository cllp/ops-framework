/**
 * Exempelmodulen: Påminnelser.
 *
 * ══ ⛔ VAD DEN HÄR FILEN ÄR TILL FÖR (#131) ════════════════════════════
 *
 * Klarkriteriet i epiken #92: **en modulbyggare kan bygga en händelsekälla ur
 * README och exempelmodulen utan att öppna ramverkets källkod.** Det går inte
 * att bevisa med ett prov, bara med att någon faktiskt gör det. Den här filen
 * är det närmaste ett bevis vi kommer, och den håller README ärlig:
 * `check-docs` kräver att varje manifestfält och varje källtyp finns både i
 * README-avsnittet "Modulkontraktet" och här.
 *
 * ⛔ DEN MONTERAS INTE I SCAFFOLD-MALLEN, och det är ett beslut. Mallen är vad
 * varje ny app startar från, och en app som föds med en Påminnelser-modul
 * ingen bett om är kod någon måste ta bort innan den kan börja. Beviset att
 * modulen fungerar är dess egna prov plus att registret tar emot den, inte att
 * den ligger i någon annans startpunkt.
 *
 * ⛔ KOPIERA HELA MAPPEN. Den är avsiktligt liten och fullständig: en samling,
 * en nav-post, en route, tre källor och en egen katalog, på två språk. Byt id,
 * namn och innehåll, behåll formen.
 */

import { createElement, lazy } from "react";
import { Bell, List } from "lucide-react";
import { defineModule, byggKategori } from "ops-framework";

/**
 * ⛔ VYN LADDAS LAT, OCH DET ÄR INTE EN PRESTANDAFRÅGA. Manifestfilen måste gå
 * att läsa ur ett vanligt Node-skript: regelgeneratorn (#130) importerar
 * modulerna för att komma åt `samlingar`, och Node kan inte läsa JSX.
 *
 * Med en direkt `import ... from "./PaminnelserVy.jsx"` faller det skriptet på
 * "Unknown file extension .jsx", och felet dyker upp i appens CI långt från sin
 * orsak. Med `lazy` är filen ett löfte som bara webbläsaren infriar, och
 * manifestet är ren JavaScript.
 *
 * ⛔ `defineModule` TAR EMOT DET, eftersom kravet på `vy` är att något är
 * utpekat och inte vilken form React råkar ge det. Samma rad i modul.js som
 * släpper igenom `memo` och `forwardRef`.
 */
const PaminnelserVy = lazy(() => import("./PaminnelserVy.jsx"));

/** Samma skäl som vyn ovan: Node kan inte läsa JSX, manifestet måste gå att importera. */
const PaminnelserForm = lazy(() => import("./PaminnelserForm.jsx"));

/** Samma skäl som vyn ovan. */
const PaminnelserTillagg = lazy(() => import("./PaminnelserTillagg.jsx"));

/**
 * Modulens egen katalog: vad en påminnelse handlar om.
 *
 * ⛔ KATEGORIERNA BYGGS MED RAMVERKETS `byggKategori`, inte som råa objekt. Då
 * gäller samma validering för modulens katalog som för appens, och en modul
 * kan inte smyga in en kategori med en fas som inte finns.
 *
 * ⛔ MED `grupp: false` (0.33.0). En kategori kräver annars `groupId`, eftersom
 * en katalog i databasen är en grupps egen. Den här är KOD: samma lista för
 * varje grupp som installerar modulen, och den har ingen databasgrupp att peka på.
 */
export const SORTER = [
  byggKategori(
    { id: "rakning", namn: { sv: "Räkning", en: "Bill" }, ikon: "gem", farg: 1, fas: "aktiv" },
    { ikoner: ["gem", "fil"], katalog: "paminnelser", grupp: false },
  ),
  byggKategori(
    { id: "avtal", namn: { sv: "Avtal", en: "Contract" }, ikon: "fil", farg: 2, fas: "aktiv" },
    { ikoner: ["gem", "fil"], katalog: "paminnelser", grupp: false },
  ),
];

/**
 * Modulens data. ⛔ En riktig modul läser ur sin datakälla här. Exemplet bär
 * raderna i minnet, eftersom en exempelmodul som kräver en databas inte går
 * att köra i ett prov, och en exempelmodul som inte körs ruttnar.
 *
 * @param {string} groupId
 */
const raderna = (groupId) =>
  [
    { id: "p1", groupId: "bolaget", titel: "Betala F-skatt", sort: "rakning", dagar: 3 },
    { id: "p2", groupId: "bolaget", titel: "Säg upp avtalet", sort: "avtal", dagar: 21 },
    { id: "p3", groupId: "privat", titel: "Förnya passet", sort: "avtal", dagar: 60 },
  ].filter((r) => r.groupId === groupId);

export const paminnelser = defineModule({
  id: "paminnelser",
  namn: { sv: "Påminnelser", en: "Reminders" },

  nav: [{ href: "/paminnelser", label: "Påminnelser" }],

  routes: [
    { path: "/paminnelser", vy: PaminnelserVy },
    { path: "/paminnelser/lista", vy: PaminnelserVy },
  ],

  /*
   * ⛔ SAMLINGEN NAMNGES RELATIVT OCH BÄR SINA FÄLT. Appen skickar in roten, se
   * README: det är den raden som gör att en kund kan bli ett eget
   * Firebase-projekt utan att datamodellen ändras. Fältlistan blir
   * `keys().hasOnly` i de genererade reglerna (#130).
   */
  samlingar: [
    {
      namn: "paminnelser",
      falt: ["id", "groupId", "titel", "sort", "dagar"],
      /*
       * ⛔ UTSKRIVET FASTÄN DET ÄR FÖRVALET. Vem som får skriva i en samling
       * är inte en detalj att lista ut ur en frånvaro: `false` säger att varje
       * medlem får skriva, och det är ett beslut och inte en glömska.
       * Sätt `true` för sådant bara ägaren ska röra, som en konfiguration.
       */
      agareKravsForSkrivning: false,
    },
  ],

  kallor: {
    /*
     * ⛔ VARJE KÄLLA FÅR EXAKT EN GRUPP. Ramverket avgör vilka grupper som
     * frågas och slår ihop svaren. Modulen filtrerar på den grupp den fick,
     * och ser aldrig någon annan.
     */
    handelser: async ({ groupId }) =>
      raderna(groupId).map((r) => ({ id: r.id, title: r.titel, daysLeft: r.dagar, kind: "Påminnelse" })),

    sok: async ({ groupId, text }) =>
      raderna(groupId)
        .filter((r) => r.titel.toLowerCase().includes(String(text ?? "").toLowerCase()))
        .map((r) => ({ id: r.id, titel: r.titel, text: `Om ${r.dagar} dagar`, href: `/paminnelser#${r.id}` })),

    /*
     * ⛔ MODULEN AVGÖR VILKA AV SINA SIDOR DEN SVARAR FÖR. Ramverket skickar
     * routen, eftersom bara modulen vet vilka vyer den har.
     */
    hjalp: async ({ route }) =>
      route === "/paminnelser"
        ? [
            {
              titel: { sv: "Om påminnelser", en: "About reminders" },
              text: {
                sv: "En påminnelse hör till en grupp och en sort. Sorterna ändras i inställningarna.",
                en: "A reminder belongs to a group and a kind. Kinds are changed in settings.",
              },
            },
          ]
        : [],

    notiser: async ({ groupId }) =>
      raderna(groupId)
        .filter((r) => r.dagar <= 7)
        .map((r) => ({ id: r.id, titel: r.titel, text: `Om ${r.dagar} dagar`, prio: "hog", href: `/paminnelser#${r.id}` })),

    widgets: async ({ groupId }) => [
      { id: "naraste", titel: { sv: "Närmaste påminnelsen", en: "Next reminder" }, vy: PaminnelserVy, antal: raderna(groupId).length },
    ],

    kataloger: async () => [{ id: "sorter", namn: { sv: "Påminnelsesorter", en: "Reminder kinds" }, kategorier: SORTER }],
  },

  /*
   * ⛔ SKAPA-REGISTRERINGEN ÄR SPEGELBILDEN AV KÄLLORNA (#150). Källorna läser
   * in i ramverkets ytor, den här skriver ut ur plusset. Ramverket ritar
   * fliken och typväljaren, modulen ritar fälten och skriver raden.
   *
   * ⛔ `katalog` PEKAR PÅ MODULENS EGEN KATALOG OVAN, alltså "sorter". Hade den
   * pekat på en katalog gruppen inte har kastar `kontrolleraSkaparkataloger`
   * när gruppens kataloger är lästa, och inte tyst ritat en tom typlista.
   * En registrering utan typ skriver `katalog: null`, aldrig ingenting.
   */
  skapar: [
    {
      id: "paminnelse",
      namn: { sv: "Påminnelse", en: "Reminder" },
      ikon: "gem",
      katalog: "sorter",
      form: PaminnelserForm,
    },
  ],

  /*
   * ⛔ MODULENS KORT I HUBBEN OCH DESS INSIDA (0.38.0, #184). Kortet leder till
   * `rutt`, som visar startsidan, och delarna är modulens egen navigation.
   * Ägaren väljer modulen i gruppens inställningar, och hubben ritar kortet
   * bara i grupper som har den i `moduler`.
   *
   * ⛔ IKONERNA ÄR ELEMENT, SKRIVNA MED `createElement` OCH INTE JSX, av samma
   * skäl som vyn laddas lat: manifestet läses av ett vanligt Node-skript.
   *
   * ⛔ DELENS ADRESS LIGGER UNDER MODULENS. En modul utan kort skriver
   * `hubb: null`, aldrig ingenting.
   */
  hubb: {
    ikon: createElement(Bell, { size: 20 }),
    rutt: "/paminnelser",
    startsida: "lista",
    delar: [{ id: "lista", namn: { sv: "Alla påminnelser", en: "All reminders" }, ikon: createElement(List, { size: 16 }), rutt: "/paminnelser/lista" }],
  },

  /*
   * ⛔ `typer` (0.42.0, #217): typer modulen bidrar med till inkorgen, kalendern och händelserna. Har gruppen modulen på
   * läggs de till valen vid render och märks «från Påminnelser»; är modulen av försvinner de ur valen men raderna som
   * redan bär dem visas som «arkiverad modul». Värdet en rad bär är `paminnelser:paminnelse` (modul:id), aldrig bara
   * `paminnelse`. Valfritt, till skillnad från alla andra fält, och en modul utan bidrag utelämnar det.
   */
  typer: {
    inkorg: [{ id: "paminnelse", namn: { sv: "Påminnelse", en: "Reminder" }, ikon: "gem" }],
  },

  /*
   * ⛔ `tillagg` (0.60.0, #251): det modulen pluggar in på ramverkets ytor, i en `plats` ramverket erbjuder
   * (`HANDELSE_PLATSER`). En plats som inte finns avvisas vid uppstart. `etikett` krävs på båda språken och är
   * sektionens rubrik, och `komponent` pekas ut och laddas lat, av samma skäl som vyn. Ytan ritar bara tillägget
   * i grupper som har modulen påslagen. Valfritt som `typer`.
   */
  tillagg: [
    {
      plats: "handelse.sektion",
      id: "kopplade",
      etikett: { sv: "Påminnelser", en: "Reminders" },
      komponent: PaminnelserTillagg,
    },
  ],

  /*
   * ⛔ `installningar` (0.88.0): fält per grupp, i en samling appen namnger. Valfritt som `typer`.
   * Id `visaIHuvudmenyn` är reserverat: pinnen skrivs på gruppen, inte här. En modul utan egna fält
   * utelämnar listan eller skriver [].
   */
  installningar: [
    {
      id: "visaklara",
      namn: { sv: "Visa klara påminnelser", en: "Show done reminders" },
      typ: "boolean",
      forval: false,
    },
  ],
});
