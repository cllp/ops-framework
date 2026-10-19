import { useId, useState } from "react";
import { definierade, forvalda } from "../lib/ord.js";
import { arHandelseBibliotek } from "../lib/bibliotek.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsBibliotek } from "./OpsBibliotek.jsx";
import { OpsButton } from "./OpsButton.jsx";

/**
 * En händelses filer: sektionen "Filer" i händelsepanelen (0.121.0, cllp/lifehub.app#366, docs/beslut/0006).
 *
 * ══ ⛔ VARFÖR, OCH VAD DEN HÄR INTE ÄR ═════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-19: "Jag vill ta detta mail och skapa en händelse och lägga till PDF:erna, och eventuellt bilder på biljetter mm ... ett
 * händelsebibliotek som bara gäller den händelsen", som i SessionStudio. En händelses filer är biblioteksposter på en egen PLATS,
 * `handelse~<grupp>~<händelse>` (`handelseBibliotek`), och den här komponenten är `OpsBibliotek` inbäddad för just den platsen: uppladdning,
 * förhandsvisning av bild, PDF-länk, ljudspelare, utskrift och Dela länk är samma kod som i Biblioteket.
 *
 * ⛔ EN KÄLLA OCH INTE SEX CALLBACKS. Appen skickar `kalla` (`createBibliotekskalla` med `groupId: handelseBibliotek(...)`, samma `lagring`,
 * `sokvag`, `skapare`, `jag` och `anteckna` som Biblioteket), och komponenten kopplar `spara`, `laddaUppFil` och `radera` själv. Den håller
 * valt läge (öppen fil, ny fil) själv. Vad som är appens: källan, medlemskapet (`jag`), adressen till en fil, och om personen får lägga till.
 *
 * ⛔ `kanLaggaTill` ÄR SAMMA AVGÖRANDE SOM PENNAN på panelen (`onRedigera`): ritas bara när personen får redigera händelsen. Reglerna prövar
 * det ändå (aktiv medlem som person, händelsen finns i gruppen), så knappen döljer en knapp som nekas och är inte skyddet. Krävs, utan förval:
 * en medlem som får läsa men inte lägga till ska inte se en knapp som inte går att använda, och en app som glömt propen ska märka det.
 *
 * ⛔ BARA FILER, och inget flyttas dit eller därifrån. En anteckning eller en länk på en händelse är händelsens beskrivning en gång till, och en flytt
 * är ett beslut om vem som ser filen, som händelsen redan har bestämt. `OpsBibliotek` kastar om platsen ges som `platser` eller `grupper`.
 *
 * @param {object} props
 * @param {{ groupId: string, las: () => Promise<any>, prenumerera?: Function, spara: Function, laddaUppFil: Function, radera: Function }} props.kalla
 *   Bibliotekskällan för EN händelses plats. Kastar om `kalla.groupId` inte är en händelseplats: en källa för gruppens plats hade visat gruppens
 *   hela bibliotek under en händelse. Ska vara stabil mellan renderingar (`useMemo`), som `OpsBibliotek kalla`.
 * @param {{ uid: string, roll: string, groupId?: string, status?: string } | null} props.jag Den inloggades aktiva medlemskap i händelsens GRUPP, eller `null` när personen inte är medlem. Krävs.
 * @param {boolean} props.kanLaggaTill Personen får redigera händelsen. Krävs.
 * @param {(post: { fil?: { sokvag?: string } }) => string} [props.filUrl] Se `OpsBibliotek`.
 * @param {(sokvag: string) => Promise<string>} [props.hamtaAdress] Se `OpsBibliotek`.
 * @param {(inmatning: { id: string, durationMs?: number, peaks?: string }) => void | Promise<void>} [props.onFyllLjud] Se `OpsBibliotek`.
 * @param {(post: any) => Promise<void> | void} [props.onSkrivUt] Se `OpsBibliotek`. Appens server måste slå upp medlemskapet med `gruppForPlats(post.groupId)`.
 * @param {(post: any) => Promise<void> | void} [props.onAnteckningAvUtskrift] Se `OpsBibliotek`.
 * @param {readonly any[]} [props.delningar] Se `OpsBibliotek`. Delningstjänsten slår upp medlemskapet via `gruppForPlats`.
 * @param {(inmatning: any) => Promise<any>} [props.onDelaLank] Se `OpsBibliotek`.
 * @param {(inmatning: any) => Promise<void> | void} [props.onAndraNedladdning] Se `OpsBibliotek`.
 * @param {(inmatning: any) => Promise<void> | void} [props.onAterkalla] Se `OpsBibliotek`.
 * @param {string} [props.sprak] "sv" eller "en". Förval ur `OpsSprakProvider`.
 * @param {string} [props.rubrik] Förval "Filer".
 * @param {string} [props.laddaUppEtikett] Förval "Ladda upp".
 */
export function OpsHandelsefiler(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  return <OpsHandelsefilerRitad {...forvalda(ORD_OPSHANDELSEFILER, sprak)} {...definierade(props)} sprak={sprak} />;
}

/** @param {any} p */
function OpsHandelsefilerRitad({ kalla, jag, kanLaggaTill, rubrik, laddaUppEtikett, filUrl, hamtaAdress, onFyllLjud, onSkrivUt, onAnteckningAvUtskrift, delningar, onDelaLank, onAndraNedladdning, onAterkalla }) {
  const rubrikId = useId();
  const [vald, setVald] = useState(/** @type {any} */ (null));
  const [skapar, setSkapar] = useState(/** @type {"fil" | null} */ (null));
  if (!kalla || !arHandelseBibliotek(kalla.groupId)) {
    throw new Error("OpsHandelsefiler: kalla ska vara bibliotekskällan för en händelses plats (createBibliotekskalla med groupId: handelseBibliotek(groupId, handelseId)). En källa för gruppens plats hade visat gruppens hela bibliotek under en händelse.");
  }
  if (jag === undefined) {
    throw new Error("OpsHandelsefiler: jag krävs, den inloggades aktiva medlemskap i gruppen ({ uid, roll }), eller null när personen inte är medlem. Utan propen ser en medlem ut som en som bara får läsa.");
  }
  if (typeof kanLaggaTill !== "boolean") {
    throw new Error("OpsHandelsefiler: kanLaggaTill krävs och ska vara sant eller falskt. Samma avgörande som pennan på händelsepanelen: en knapp som nekas ska inte ritas, och en app som glömt propen ska märka det.");
  }
  const oppen = Boolean(vald || skapar);
  const stang = () => {
    setVald(null);
    setSkapar(null);
  };
  const kanLagga = Boolean(jag) && kanLaggaTill;
  return (
    <section data-handelsefiler="" aria-labelledby={rubrikId} className="flex min-w-0 flex-col gap-2">
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
        {...(onDelaLank ? { onDelaLank } : {})}
        {...(onAndraNedladdning ? { onAndraNedladdning } : {})}
        {...(onAterkalla ? { onAterkalla } : {})}
      />
    </section>
  );
}

/**
 * OpsHandelsefilers förvalda texter. Biblioteket under är på svenska (som resten av `OpsBibliotek`); rubriken och knappen följer språket.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSHANDELSEFILER = {
  rubrik: { sv: "Filer", en: "Files" },
  laddaUppEtikett: { sv: "Ladda upp", en: "Upload" },
};
