import { useId, useRef, useState } from "react";
import { KALENDERPRICK } from "../lib/kalenderfarg.js";
import { cx } from "../lib/cx.js";
import { KalenderIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { ValRad } from "./ValRad.jsx";

/**
 * "Flytta till kalender" i händelsepanelen (0.123.0, cllp/lifehub.app#371).
 *
 * ══ ⛔ VAD PANELEN GÖR OCH INTE GÖR ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Panelen RITAR listan (`flyttmal` ur `lib/flytta.js`, som appen räknar fram) och anropar `onFlytta` med valet. Den vet inte vilken flytt
 * det är i databasen: appen anropar `flyttaPost`, `flyttaHandelse` eller `goraPostTillHandelse` efter `mal.atgard`, och servern prövar
 * allt på nytt. Listan är ett erbjudande, aldrig en behörighet.
 *
 * ⛔ EN POST SOM BLIR EN GRUPPENS HÄNDELSE BEKRÄFTAS FÖRST (`atgard: "konvertera"`). Det är den enda flytten som ändrar vem som ser
 * något: efteråt ser gruppens medlemmar den, och den finns inte längre i personens egen kalender. Texten säger båda sakerna, med
 * gruppens namn, och knappen heter samma sak som åtgärden. Ett byte av egen eller gruppens kalender sker direkt: ingen ser något nytt.
 *
 * ⛔ ETT FEL FRÅN SERVERN SKRIVS UT OCH LÄMNAR RUTAN ÖPPEN. En flytt som föll får inte se ut som en som gick: panelen visar orsaken
 * (`role="alert"`), och personen kan försöka igen eller stänga. Under tiden är knapparna spärrade, så ett dubbeltryck inte skickar två anrop.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/flytta.js").Flyttmal>} props.mal
 * @param {(mal: import("../lib/flytta.js").Flyttmal) => void | Promise<void>} props.onFlytta
 * @param {string} props.titel Postens eller händelsens titel, för bekräftelsen.
 * @param {Record<string, string>} props.ord Etiketterna, ur `ORD_OPSHANDELSEPANEL`.
 */
export function HandelseFlytta({ mal, onFlytta, titel, ord }) {
  const [oppen, setOppen] = useState(false);
  const [valt, setValt] = useState(/** @type {import("../lib/flytta.js").Flyttmal | null} */ (null));
  const [upptagen, setUpptagen] = useState(false);
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  const felId = useId();
  // ⛔ EN REF OCH INTE BARA `upptagen`: två tryck i samma tick ser samma state, och då skickas flytten två gånger.
  const pagar = useRef(false);

  const stang = () => {
    setOppen(false);
    setValt(null);
    setFel(null);
  };

  /** @param {import("../lib/flytta.js").Flyttmal} m */
  async function utfor(m) {
    if (pagar.current) return;
    pagar.current = true;
    setFel(null);
    setUpptagen(true);
    try {
      await onFlytta(m);
      stang();
    } catch (e) {
      // ⛔ Orsaken skrivs ut, och rutan står kvar (se filhuvudet).
      setFel(e instanceof Error && e.message ? e.message : String(e));
    } finally {
      pagar.current = false;
      setUpptagen(false);
    }
  }

  // Egna kalendrar först, sedan en rubrik per grupp i den ordning appen gav dem (flyttmal behåller den).
  /** @type {Array<{ nyckel: string, rubrik: string, mal: import("../lib/flytta.js").Flyttmal[] }>} */
  const grupper = [];
  for (const m of mal) {
    const nyckel = m.groupId ? `grupp:${m.groupId}` : "mina";
    let g = grupper.find((x) => x.nyckel === nyckel);
    if (!g) {
      g = { nyckel, rubrik: m.groupId ? String(m.gruppnamn) : ord.flyttaMinaRubrik, mal: [] };
      grupper.push(g);
    }
    g.mal.push(m);
  }

  const bekrafta = valt?.atgard === "konvertera" ? valt : null;
  const bekraftaText = bekrafta
    ? ord.bekraftaText.replace("{titel}", titel).replace("{grupp}", String(bekrafta.gruppnamn)).replace("{kalender}", bekrafta.namn)
    : "";

  return (
    <div data-handelseflytta="" className="mt-3">
      <OpsButton size="sm" variant="secondary" onClick={() => setOppen(true)}>
        <KalenderIkon size={16} />
        {ord.flyttaEtikett}
      </OpsButton>
      <OpsModal
        open={oppen}
        onOpenChange={(o) => {
          // Mitt i ett anrop stänger varken Escape eller utsidan rutan: svaret ska synas.
          if (!o && !upptagen) stang();
        }}
        title={bekrafta ? ord.bekraftaTitel : ord.flyttaEtikett}
        closeLabel={ord.stangEtikett}
        size="sm"
        footer={
          bekrafta ? (
            <>
              <OpsButton variant="ghost" disabled={upptagen} onClick={() => { setValt(null); setFel(null); }}>
                {ord.avbrytEtikett}
              </OpsButton>
              <OpsButton variant="primary" busy={upptagen} onClick={() => utfor(bekrafta)}>
                {ord.bekraftaKnapp}
              </OpsButton>
            </>
          ) : null
        }
      >
        {bekrafta ? (
          <p data-flytta-bekrafta="" className="m-0 text-etikett leading-relaxed text-ink-secondary wrap-anywhere">
            {bekraftaText}
          </p>
        ) : (
          <div data-flytta-lista="" className="flex flex-col gap-3">
            {grupper.map((g) => (
              <section key={g.nyckel} aria-label={g.rubrik} className="flex flex-col gap-0.5">
                <h3 className="m-0 px-3 text-sektion uppercase text-ink-muted">{g.rubrik}</h3>
                {g.mal.map((m) => (
                  <ValRad
                    key={`${m.groupId ?? ""}|${m.id}`}
                    chosen={false}
                    stor
                    ikon={<span className={cx("size-2 rounded-full", KALENDERPRICK[m.farg] || "bg-accent")} />}
                    onClick={() => (m.atgard === "konvertera" ? setValt(m) : utfor(m))}
                  >
                    {m.namn}
                  </ValRad>
                ))}
              </section>
            ))}
          </div>
        )}
        {fel ? (
          <p id={felId} role="alert" data-flytta-fel="" className="m-0 mt-3 text-etikett text-danger wrap-anywhere">
            {ord.flyttFelEtikett}: {fel}
          </p>
        ) : null}
      </OpsModal>
    </div>
  );
}
