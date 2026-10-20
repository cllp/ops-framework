import { useId, useState } from "react";
import { definierade, forvalda } from "../lib/ord.js";
import { beskrivObjektbibliotek } from "../lib/bibliotek.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsBibliotek } from "./OpsBibliotek.jsx";
import { OpsButton } from "./OpsButton.jsx";

/**
 * Ett objekts filer: sektionen "Filer" på en händelse eller ett ärende (0.122.0, cllp/lifehub.app#366 punkt 3, docs/beslut/0007). Det här är
 * samma sektion som `OpsHandelsefiler` var i 0.121.0 (docs/beslut/0006), gjord generell i stället för kopierad (regel 2): en komponent, och
 * `OpsHandelsefiler` är kvar som ett namn för händelser.
 *
 * ══ ⛔ VARFÖR, OCH VAD DEN HÄR INTE ÄR ═════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-19: "Jag vill ta detta mail och skapa en händelse och lägga till PDF:erna ... ett händelsebibliotek som bara gäller den händelsen",
 * och för ärenden: biljetterna ska ligga på ärendet "köpa biljetter före fredag", inte som en data-URL på posten. Ett objekts filer är
 * biblioteksposter på en egen PLATS i `groupId`: `handelse~<grupp>~<händelse>` (`handelseBibliotek`) eller `arende~<grupp>~<inkorgspostens id>`
 * (`arendeBibliotek`). Den här komponenten är `OpsBibliotek` inbäddad för just den platsen: uppladdning, förhandsvisning av bild, PDF-länk,
 * ljudspelare, utskrift och Dela länk är samma kod som i Biblioteket.
 *
 * ⛔ EN KÄLLA OCH INTE SEX CALLBACKS. Appen skickar `kalla` (`createBibliotekskalla` med objektets plats som `groupId`, samma `lagring`,
 * `sokvag`, `skapare`, `jag` och `anteckna` som Biblioteket), och komponenten kopplar `spara`, `laddaUppFil` och `radera` själv. Den håller
 * valt läge (öppen fil, ny fil) själv. Vad som är appens: källan, medlemskapet (`jag`), adressen till en fil, och om personen får lägga till.
 *
 * ⛔ SLAGET LÄSES UR KÄLLAN. `kalla.groupId` säger om det är en händelse eller ett ärende, så det finns ingen andra uppgift att hålla lika med
 * den (regel 2). `slag` är bara en spärr: ger appen det kastar komponenten när källan är av ett annat slag, så att ett ärendes filer aldrig
 * ritas under en händelse. Utan `slag` godtas båda.
 *
 * ⛔ `kanLaggaTill` ÄR SAMMA AVGÖRANDE SOM PENNAN på panelen (`onRedigera`): ritas bara när personen får redigera objektet. Reglerna prövar
 * det ändå (aktiv medlem som person, objektet finns i gruppen), så knappen döljer en knapp som nekas och är inte skyddet. Krävs, utan förval:
 * en medlem som får läsa men inte lägga till ska inte se en knapp som inte går att använda, och en app som glömt propen ska märka det.
 *
 * ⛔ BARA FILER, och inget flyttas dit eller därifrån. En anteckning eller en länk på ett objekt är objektets text en gång till, och en flytt
 * är ett beslut om vem som ser filen, som objektet redan har bestämt. `OpsBibliotek` kastar om platsen ges som `platser` eller `grupper`.
 *
 * @param {object} props
 * @param {{ groupId: string, las: () => Promise<any>, prenumerera?: Function, spara: Function, laddaUppFil: Function, radera: Function }} props.kalla
 *   Bibliotekskällan för EN händelses eller ETT ärendes plats. Kastar om `kalla.groupId` inte är en sådan: en källa för gruppens plats hade visat gruppens
 *   hela bibliotek under objektet. Ska vara stabil mellan renderingar (`useMemo`), som `OpsBibliotek kalla`.
 * @param {{ uid: string, roll: string, groupId?: string, status?: string } | null} props.jag Den inloggades aktiva medlemskap i objektets GRUPP, eller `null` när personen inte är medlem. Krävs.
 * @param {boolean} props.kanLaggaTill Personen får redigera objektet. Krävs.
 * @param {"handelse" | "arende"} [props.slag] Spärr: kastar om källan är av det andra slaget. Utelämnad godtas båda.
 * @param {(post: { fil?: { sokvag?: string } }) => string} [props.filUrl] Se `OpsBibliotek`.
 * @param {(sokvag: string) => Promise<string>} [props.hamtaAdress] Se `OpsBibliotek`.
 * @param {(inmatning: { id: string, durationMs?: number, peaks?: string }) => void | Promise<void>} [props.onFyllLjud] Se `OpsBibliotek`.
 * @param {(post: any) => Promise<void> | void} [props.onSkrivUt] Se `OpsBibliotek`. Appens server måste slå upp medlemskapet med `gruppForPlats(post.groupId)`.
 * @param {(post: any) => Promise<void> | void} [props.onAnteckningAvUtskrift] Se `OpsBibliotek`.
 * @param {readonly any[]} [props.delningar] Se `OpsBibliotek`. Delningstjänsten slår upp medlemskapet via `gruppForPlats`.
 * @param {string} [props.delningGruppdel] (0.127.0) Se `OpsBibliotek`. Gruppdelen gruppen redan använt i en länk (`gruppdelar({ uid, groupId }).senaste`), där `groupId` är objektets GRUPP och inte platsen.
 *   ⛔ Förut vidarebefordrades den inte: en fil som delades från en händelse föreslog då ett fast ord, och eftersom en gruppdel tillhör den första gruppen som tar den för alltid fick en enda grupp ordet och alla andra "används av en annan grupp".
 * @param {string} [props.gruppnamn] (0.127.0) Se `OpsBibliotek`. Objektets grupps namn, för förslaget till gruppdelen när gruppen inte delat något förut (`handelse.grupp` på panelen). Platsen (`handelse~<grupp>~<händelse>`) bär inget namn.
 * @param {(inmatning: any) => Promise<any>} [props.onDelaLank] Se `OpsBibliotek`.
 * @param {(inmatning: any) => Promise<void> | void} [props.onAndraNedladdning] Se `OpsBibliotek`.
 * @param {(inmatning: any) => Promise<void> | void} [props.onAterkalla] Se `OpsBibliotek`.
 * @param {(inmatning: { id: string, url: string, till: string }) => Promise<void | boolean> | void | boolean} [props.onMejlaLank] (0.128.0, cllp/lifehub.app#356) Se `OpsBibliotek`. Fältet "Skicka till mejl" i dialogen Dela länk.
 * @param {string} [props.sprak] "sv" eller "en". Förval ur `OpsSprakProvider`.
 * @param {string} [props.rubrik] Förval "Filer".
 * @param {string} [props.laddaUppEtikett] Förval "Ladda upp".
 */
export function OpsPlatsfiler(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  return <PlatsfilerRitad {...forvalda(ORD_OPSPLATSFILER, sprak)} {...definierade(props)} sprak={sprak} />;
}

/**
 * Det som skiljer ett slag från ett annat: hur appen bygger källan, meningen under "Inga filer än." och attributet sektionen bär (`data-handelsefiler`
 * är kvar som i 0.121.0, så att inget som letar efter det tappar det).
 * @type {Record<"handelse" | "arende", { plats: string, bygg: string, tom: string }>}
 */
const SLAG = {
  handelse: {
    plats: "en händelses plats",
    bygg: "createBibliotekskalla med groupId: handelseBibliotek(groupId, handelseId)",
    tom: "Filer som läggs till här hör bara till händelsen.",
  },
  arende: {
    plats: "ett ärendes plats",
    bygg: "createBibliotekskalla med groupId: arendeBibliotek(groupId, inkorgspostens id)",
    tom: "Filer som läggs till här hör bara till ärendet.",
  },
};

/** @param {any} p */
function PlatsfilerRitad({ slag: kravtSlag, kalla, jag, kanLaggaTill, rubrik, laddaUppEtikett, filUrl, hamtaAdress, onFyllLjud, onSkrivUt, onAnteckningAvUtskrift, delningar, delningGruppdel, gruppnamn, onDelaLank, onAndraNedladdning, onAterkalla, onMejlaLank }) {
  const rubrikId = useId();
  const [vald, setVald] = useState(/** @type {any} */ (null));
  const [skapar, setSkapar] = useState(/** @type {"fil" | null} */ (null));
  const objekt = kalla ? beskrivObjektbibliotek(kalla.groupId) : null;
  if (kravtSlag !== undefined && !SLAG[/** @type {"handelse" | "arende"} */ (kravtSlag)]) {
    throw new Error(`OpsPlatsfiler: slag är "handelse" eller "arende", inte "${kravtSlag}".`);
  }
  const forvantat = /** @type {"handelse" | "arende" | undefined} */ (kravtSlag);
  if (!kalla || !objekt || (forvantat && objekt.slag !== forvantat)) {
    const vilken = forvantat ? SLAG[forvantat] : null;
    throw new Error(
      `OpsPlatsfiler: kalla ska vara bibliotekskällan för ${vilken ? vilken.plats : `${SLAG.handelse.plats} eller ${SLAG.arende.plats}`} (${vilken ? vilken.bygg : `${SLAG.handelse.bygg}, eller ${SLAG.arende.bygg}`}). En källa för gruppens plats hade visat gruppens hela bibliotek under ${forvantat ? (forvantat === "arende" ? "ett ärende" : "en händelse") : "ett objekt"}.`,
    );
  }
  if (jag === undefined) {
    throw new Error(`OpsPlatsfiler: jag krävs, den inloggades aktiva medlemskap i gruppen ({ uid, roll }), eller null när personen inte är medlem. Utan propen ser en medlem ut som en som bara får läsa.`);
  }
  if (typeof kanLaggaTill !== "boolean") {
    throw new Error(`OpsPlatsfiler: kanLaggaTill krävs och ska vara sant eller falskt. Samma avgörande som pennan på panelen: en knapp som nekas ska inte ritas, och en app som glömt propen ska märka det.`);
  }
  const oppen = Boolean(vald || skapar);
  const stang = () => {
    setVald(null);
    setSkapar(null);
  };
  const kanLagga = Boolean(jag) && kanLaggaTill;
  const slagattribut = { [`data-${objekt.slag}filer`]: "" };
  return (
    <section {...slagattribut} aria-labelledby={rubrikId} className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 id={rubrikId} className="m-0 text-sektion uppercase text-ink-muted">{rubrik}</h2>
        {kanLagga && !oppen ? (
          <OpsButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setVald(null);
              setSkapar("fil");
            }}
          >
            {laddaUppEtikett}
          </OpsButton>
        ) : null}
      </div>
      <OpsBibliotek
        inbaddad
        tomText={SLAG[objekt.slag].tom}
        kalla={kalla}
        jag={jag}
        vald={vald}
        skapar={kanLagga ? skapar : null}
        onOppna={setVald}
        onStang={stang}
        onSkapa={() => setSkapar("fil")}
        onSpara={async (/** @type {any} */ inmatning) => {
          await kalla.spara(inmatning);
        }}
        onLaddaUpp={async (/** @type {any} */ inmatning) => {
          await kalla.laddaUppFil(inmatning);
          // En ny fil leder tillbaka till listan, där den redan syns (källan prenumererar). Byts filen på en befintlig post står detaljen kvar.
          if (!inmatning?.id) stang();
        }}
        onRadera={async (/** @type {string} */ id) => {
          await kalla.radera(id);
          if (vald?.id === id) setVald(null);
        }}
        {...(filUrl ? { filUrl } : {})}
        {...(hamtaAdress ? { hamtaAdress } : {})}
        {...(onFyllLjud ? { onFyllLjud } : {})}
        {...(onSkrivUt ? { onSkrivUt } : {})}
        {...(onAnteckningAvUtskrift ? { onAnteckningAvUtskrift } : {})}
        {...(delningar ? { delningar } : {})}
        {...(delningGruppdel ? { delningGruppdel } : {})}
        {...(gruppnamn ? { gruppnamn } : {})}
        {...(onDelaLank ? { onDelaLank } : {})}
        {...(onAndraNedladdning ? { onAndraNedladdning } : {})}
        {...(onAterkalla ? { onAterkalla } : {})}
        {...(onMejlaLank ? { onMejlaLank } : {})}
      />
    </section>
  );
}

/**
 * OpsPlatsfilers förvalda texter. Biblioteket under är på svenska (som resten av `OpsBibliotek`); rubriken och knappen följer språket.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSPLATSFILER = {
  rubrik: { sv: "Filer", en: "Files" },
  laddaUppEtikett: { sv: "Ladda upp", en: "Upload" },
};
