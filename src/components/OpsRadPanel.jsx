import * as Dialog from "@radix-ui/react-dialog";
import { useMemo } from "react";
import { definierade, forvalda } from "../lib/ord.js";
import { kallaForRad, losKnapprad, radkallaEtikett } from "../lib/radkallor.js";
import { OpsHandelsePanel, ORD_OPSHANDELSEPANEL } from "./OpsHandelsePanel.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Panelen för en rad som inte är en händelse (0.145.0, cllp/ops-framework#446): en påminnelse, en faktura, ett ärende, en inkorgspost, öppnad ur kalendern eller Idag.
 *
 * ══ ⛔ SAMMA PANEL SOM HÄNDELSEN, MED KÄLLANS KNAPPAR LÄNGST NED ═══════════════════════════════════════════════════════
 *
 * CP 2026-10-25: "Är det inte bättre att det är likadant för allt?" Panelen ÄR `OpsHandelsePanel`: Tillbaka, rubriken, när och "Från <källa>" överst, raden
 * som den ser ut i listan (typ, kalender, status, utfällningens innehåll) i mitten, och längst ned `Knapprad` (källans knappar och Dela, se `lib/radkallor.js`).
 * Det är inte en andra panel som ska hållas lik den första: det är den första, med en rad data som inte kommer ur en händelse.
 *
 * ⛔ EN DIALOG OVANPÅ LISTAN OCH INTE EN SIDA I SKALET, som `OpsExternPanel` (0.134.0), av samma skäl: skalets sida (`?handelse=<id>`) slår upp sin händelse ur appens källa
 * på id, och en rad här har ingen sådan: appen skickade den som en rad, och ramverket har den i handen. Listan eller kalendern håller sig monterad under panelen
 * med sitt urval, sin månad och sina filter, och Tillbaka (eller Escape) lämnar den som den var. Fokus går till panelen, inte till dialogens första knapp.
 * ⛔ Att en rad också ska gå att länka till (`?rad=<id>` som en omladdning öppnar) kräver att appen kan slå upp raden på id, och det är ett eget beslut (se PR-texten).
 *
 * ⛔ PANELEN LÄSER RADEN, DEN ÄNDRAR DEN INTE. Det raden bär visas; det en källa kan göra åt den är en knapp som källan själv levererar.
 *
 * @param {object} props
 * @param {any | null} props.rad Raden som öppnas, en `CalendarEntry` (`form: "kalender"`) eller en `OpsEvent` (`form: "idag"`). `null`: stängd.
 * @param {"kalender" | "idag"} props.form Vilken sorts rad det är, eftersom de bär sina fakta i olika fält.
 * @param {import("../lib/radkallor.js").Radkallor | null} props.radkallor Manifestet. Raden slås upp mot det på `lasRadId(rad.id)`; utan källa ritas ingenting.
 * @param {() => void} props.onStang
 * @param {Record<string, string>} [props.statusWords] Statusorden raden använder, som i listan. En status utan ord ritas inte i panelen.
 * @param {string} [props.sprak] "sv" eller "en".
 * @param {string} [props.franModulEtikett] Ordet före källans namn i källraden ("Från Ekonomi"). Förval "Från". Samma ord som `OpsHandelsePanel`.
 * @param {string} [props.knappradEtikett] Skärmläsarens namn på knappraden. Förval "Åtgärder".
 * @param {string} [props.delaEtikett] Dela-knappen. Förval "Dela".
 * @param {string} [props.delaSkalForord] Ordet före skälet när raden inte går att dela. Förval "Går inte att dela:".
 * @param {string} [props.delaIstalletForord] Ordet före vad man gör i stället. Förval "Gör så här i stället:".
 * @param {string} [props.delaStandardSkal] Skälet när källan inte svarat på `dela`. Förval "Den här raden går inte att dela härifrån ännu."
 */
function OpsRadPanelRitad({
  rad,
  form,
  radkallor,
  onStang,
  statusWords = {},
  sprak = "sv",
  franModulEtikett = ORD_OPSHANDELSEPANEL.franModulEtikett.sv,
  knappradEtikett = ORD_OPSHANDELSEPANEL.knappradEtikett.sv,
  delaEtikett = ORD_OPSHANDELSEPANEL.delaEtikett.sv,
  delaSkalForord = ORD_OPSHANDELSEPANEL.delaSkalForord.sv,
  delaIstalletForord = ORD_OPSHANDELSEPANEL.delaIstalletForord.sv,
  delaStandardSkal = ORD_OPSHANDELSEPANEL.delaStandardSkal.sv,
}) {
  const kalla = rad ? kallaForRad(radkallor, rad.id) : null;
  const ritad = rad && kalla ? { rad, kalla } : null;
  // ⛔ KNAPPARNA RÄKNAS UT NÄR PANELEN ÖPPNAS OCH NÄR RADEN ELLER MANIFESTET BYTS, inte vid varje ritning: `atgarder(rad)` är appens kod, och en ny lista med nya
  // funktioner vid varje ritning hade gett knapparna nya identiteter medan någon trycker på dem.
  const knapprad = useMemo(() => (ritad ? losKnapprad(ritad.kalla.manifest, ritad.rad, "OpsRadPanel") : null), [ritad?.rad, ritad?.kalla.manifest]);
  const etikett = ritad ? radkallaEtikett(ritad.kalla.manifest, ritad.rad, "OpsRadPanel") : "";
  const handelse = ritad ? (form === "idag" ? idagradTillHandelse(ritad.rad, etikett, franModulEtikett, statusWords) : kalenderradTillHandelse(ritad.rad, etikett, franModulEtikett, statusWords)) : null;
  return (
    <Dialog.Root open={ritad !== null} onOpenChange={(o) => (o ? undefined : onStang())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
        <Dialog.Content
          data-radpanel=""
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-(--z-modal) overflow-y-auto bg-canvas outline-none md:inset-auto md:top-6 md:left-1/2 md:max-h-[calc(100dvh-3rem)] md:w-[min(48rem,calc(100vw-3rem))] md:-translate-x-1/2 md:rounded-base md:border md:border-line"
        >
          <Dialog.Title className="sr-only">{handelse ? handelse.titel : ""}</Dialog.Title>
          {handelse && knapprad ? (
            <OpsHandelsePanel
              handelse={handelse}
              onTillbaka={onStang}
              sprak={sprak}
              statusWords={statusWords}
              knapprad={knapprad}
              knappradEtikett={knappradEtikett}
              delaEtikett={delaEtikett}
              delaSkalForord={delaSkalForord}
              delaIstalletForord={delaIstalletForord}
              delaStandardSkal={delaStandardSkal}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Samma rad, med det den ritar efter språket (`OpsSprakProvider`): de orden som hör till panelen kommer ur `ORD_OPSHANDELSEPANEL`, där de bor, och skickas vidare.
 * @param {Parameters<typeof OpsRadPanelRitad>[0]} props
 */
export function OpsRadPanel(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  return <OpsRadPanelRitad {...forvalda(ORD_ARVDA, sprak)} {...definierade(props)} sprak={sprak} />;
}

/**
 * Orden panelen delar med `OpsHandelsePanel`: samma ordlista, så att "Dela" och "Från" heter detsamma överallt och ändras på ett ställe.
 * @type {import("../lib/ord.js").Ordbok}
 */
const ORD_ARVDA = {
  franModulEtikett: ORD_OPSHANDELSEPANEL.franModulEtikett,
  knappradEtikett: ORD_OPSHANDELSEPANEL.knappradEtikett,
  delaEtikett: ORD_OPSHANDELSEPANEL.delaEtikett,
  delaSkalForord: ORD_OPSHANDELSEPANEL.delaSkalForord,
  delaIstalletForord: ORD_OPSHANDELSEPANEL.delaIstalletForord,
  delaStandardSkal: ORD_OPSHANDELSEPANEL.delaStandardSkal,
};

/**
 * "Från Ekonomi": källans namn efter ramverkets eget ord. Det står som källrad under rubriken, som "Från Apple" gör för en extern händelse.
 * @param {string} fran @param {string} etikett
 */
const franRad = (fran, etikett) => `${fran} ${etikett}`;

/**
 * En kalenderpost (`CalendarEntry`) som en `HandelseVy`: titeln, dagen och spannet ur posten, typen ur `not` (appen skriver slagets ord där), kalendern, statusen
 * när den har ett ord, och utfällningens innehåll (`details`) som panelens text. Ingen tid: posten bär ingen, och en påhittad hade varit värre än ingen.
 * @param {import("../lib/calendar.js").CalendarEntry} p
 * @param {string} etikett @param {string} fran @param {Record<string, string>} statusWords
 * @returns {import("./OpsHandelsePanel.jsx").HandelseVy}
 */
export function kalenderradTillHandelse(p, etikett, fran, statusWords) {
  return {
    id: p.id,
    titel: p.title,
    datum: p.date,
    ...(typeof p.endDate === "string" && p.endDate > p.date ? { slutDatum: p.endDate } : {}),
    ...(p.allDay === true ? { heldag: true } : {}),
    ...(typeof p.not === "string" && p.not ? { typ: { namn: p.not, ...(p.kindIcon ? { ikon: p.kindIcon } : {}), ...(p.slag ? { slag: p.slag } : {}) } } : {}),
    ...(p.status && statusWords[p.status] ? { status: p.status } : {}),
    ...(p.kalender ? { kalender: { namn: p.kalender.namn, farg: p.kalender.farg } } : {}),
    ...(p.details ? { beskrivning: p.details } : {}),
    kalla: franRad(fran, etikett),
  };
}

/**
 * En rad i Idag (`OpsEvent`) som en `HandelseVy`. Raden har ingen riktig dag, bara appens ord ("Om 3 dagar", "Senast 28 okt"), och de står som "När" (`nar`).
 * Typen är radens `kind` när den är en text (en nod kan inte bli ett namn), med ikonen och slaget.
 * @param {import("../lib/events.js").OpsEvent} h
 * @param {string} etikett @param {string} fran @param {Record<string, string>} statusWords
 * @returns {import("./OpsHandelsePanel.jsx").HandelseVy}
 */
export function idagradTillHandelse(h, etikett, fran, statusWords) {
  const nar = [h.when, h.deadline].filter((x) => typeof x === "string" && x).join(" · ");
  return {
    id: h.id,
    titel: h.title,
    ...(nar ? { nar } : {}),
    ...(typeof h.kind === "string" && h.kind ? { typ: { namn: h.kind, ...(h.kindIcon ? { ikon: h.kindIcon } : {}), ...(h.slag ? { slag: h.slag } : {}) } } : {}),
    ...(h.status && statusWords[h.status] ? { status: h.status } : {}),
    ...(h.details ? { beskrivning: h.details } : {}),
    kalla: franRad(fran, etikett),
  };
}
