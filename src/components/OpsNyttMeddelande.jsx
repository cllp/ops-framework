import { useState } from "react";
import { MAX_MEDDELANDE } from "../lib/samtal.js";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsField, OpsTextarea } from "./OpsField.jsx";
import { LasIkon } from "./icons.jsx";
import { OpsMottagare } from "./OpsMottagare.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/** @type {import("../lib/ord.js").Ordbok} */
const ORD = { privatAgent: { sv: "Bara du och agenten ser det här.", en: "Only you and the agent can see this." } };

/**
 * "Nytt meddelande": en person i gruppen och en text (0.34.0, #182 F2).
 *
 * ⛔ MEDDELANDET ÄR ETT SAMTAL MED TVÅ DELTAGARE (CP:s beslut 4). Formuläret öppnar det privata samtalet med den valda
 * personen (samma samtal som förra gången, nyckeln är härledd) och skickar texten i det. Det finns alltså ingen egen
 * sorts "meddelande" bredvid chatten: svaret kommer i samma tråd.
 *
 * ⛔ DET SYNS ATT DET ÄR PRIVAT. CP 2026-09-30, beslut 1: bara avsändaren och mottagaren ser det. Raden står under
 * mottagaren, där man väljer vem som ska se det, och inte i en hjälptext längst ned.
 *
 * ⛔ FORMULÄRET ÄR ETT `<form id={formId}>`: skapa-panelens fasta knapprad skickar det (`skapa.meddelande` i
 * `OpsAppShell`), och Cmd eller Ctrl plus Enter i textrutan gör samma sak.
 *
 * @param {object} props
 * @param {string} props.formId
 * @param {string | null} props.groupId Gruppen samtalet hör till. `null`: ingen grupp vald, och formuläret säger det.
 * @param {string} props.uid Den inloggade.
 * @param {ReadonlyArray<{ userId: string, namn?: string, bild?: string, typ?: string, status?: string }>} props.medlemmar Gruppens medlemskap.
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {(samtalId: string) => void} [props.onKlar] Anropas med samtalets id när meddelandet är skickat.
 * @param {import("../lib/samtal.js").Mottagare | null} [props.forvald] En person som redan är vald, t.ex. från en medlemslista.
 * @param {string} [props.tillEtikett] Förval "Till".
 * @param {string} [props.textEtikett] Förval "Meddelande".
 * @param {string} [props.privatText] Förval "Bara ni två ser det här."
 * @param {string} [props.privatAgentText] När agenten är vald (lifehub.app#47). Förval ur ordboken, på appens språk.
 * @param {string} [props.utanGruppText]
 * @param {string} [props.valjPersonText] Felet när ingen person är vald.
 * @param {string} [props.tomTextFel] Felet när texten är tom.
 * @param {string} [props.felRubrik] Rubriken när skickandet misslyckas.
 */
export function OpsNyttMeddelande({
  formId,
  groupId,
  uid,
  medlemmar,
  kalla,
  onKlar,
  forvald = null,
  tillEtikett = "Till",
  textEtikett = "Meddelande",
  privatText = "Bara ni två ser det här.",
  privatAgentText,
  utanGruppText = "Du är inte med i någon grupp än. Ett meddelande går till en person i en grupp.",
  valjPersonText = "Välj vem meddelandet ska till.",
  tomTextFel = "Skriv något först.",
  felRubrik = "Meddelandet kunde inte skickas",
}) {
  const [mottagare, setMottagare] = useState(/** @type {import("../lib/samtal.js").Mottagare | null} */ (forvald));
  const [text, setText] = useState("");
  const [fel, setFel] = useState(/** @type {{ falt?: "till" | "text", text: string } | null} */ (null));
  const [skickar, setSkickar] = useState(false);
  const sprak = useOpsSprak();

  if (!groupId) return <p className="m-0 text-etikett text-ink-secondary">{utanGruppText}</p>;

  const skicka = async () => {
    if (skickar) return;
    // ⛔ AGENTEN ÄR ETT EGET SLAG AV SAMTAL (lifehub.app#47): samma nyckelform som två personer, men regeln kräver att den andra är en aktiv agent.
    const annan = mottagare && (mottagare.slag === "person" || mottagare.slag === "agent") ? mottagare.uid : undefined;
    if (!mottagare || !annan) return setFel({ falt: "till", text: valjPersonText });
    if (!text.trim()) return setFel({ falt: "text", text: tomTextFel });
    setFel(null);
    setSkickar(true);
    try {
      const s = await kalla.oppnaPrivat(mottagare.slag === "agent" ? { groupId, uid, annan, slag: "agent" } : { groupId, uid, annan });
      await kalla.skicka(s.id, { text, av: uid });
      setText("");
      onKlar?.(s.id);
    } catch (e) {
      setFel({ text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSkickar(false);
    }
  };

  return (
    <form
      id={formId}
      noValidate
      aria-busy={skickar || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        skicka();
      }}
      className="flex flex-col gap-4"
    >
      {fel && !fel.falt ? <OpsBanner tone="danger" title={felRubrik}>{fel.text}</OpsBanner> : null}
      <OpsField label={tillEtikett} required error={fel?.falt === "till" ? fel.text : undefined}>
        <div className="flex flex-col gap-2">
          <OpsMottagare lage="person" medlemmar={medlemmar} uid={uid} value={mottagare} onChange={setMottagare} ariaLabel={tillEtikett} />
          {/* ⛔ Raden syns alltid, också innan någon är vald: det är innan man skriver som man behöver veta vem som läser. */}
          <p data-privat="" className="m-0 flex items-center gap-1.5 text-meta text-ink-secondary">
            <LasIkon size={14} />
            <span>{mottagare?.slag === "agent" ? (privatAgentText ?? ordet(ORD, "privatAgent", sprak)) : privatText}</span>
          </p>
        </div>
      </OpsField>
      <OpsField label={textEtikett} required error={fel?.falt === "text" ? fel.text : undefined}>
        <OpsTextarea value={text} onChange={setText} rows={5} maxLength={MAX_MEDDELANDE} onSend={skicka} />
      </OpsField>
    </form>
  );
}
