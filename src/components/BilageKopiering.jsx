import { createContext, useContext, useState } from "react";
import { Copy } from "lucide-react";
import { bilagaKanKopieras } from "../data/bibliotekkalla.js";
import { ordet } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/*
 * Kopiera en chattbilaga till en plats i Biblioteket (0.155.0, cllp/ops-framework#469).
 *
 * ⛔ KNAPPEN FINNS BARA NÄR APPEN GER DEN ETT MÅL. Utan `OpsBilagekopiering` runt chatten ritas ingenting, och chatten ser ut som förut. Det är appen som vet vilka platser personen får skriva i och hur
 * filen läggs dit (`kopieraBilagaTillPlats` mot den platsens `createBibliotekskalla`), så komponenten skriver ingenting själv.
 * ⛔ KOPIERA, INTE FLYTTA: bilagan är en del av meddelandet. ⛔ EN TYP BIBLIOTEKET INTE TAR EMOT (till exempel text/csv) FÅR INGEN KNAPP (`bilagaKanKopieras`): en knapp som alltid svarar nej är värre än ingen.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_BILAGEKOPIERING = {
  knapp: { sv: "Kopiera till en plats", en: "Copy to a place" },
  rubrik: { sv: "Kopiera bilagan till Biblioteket", en: "Copy the attachment to the Library" },
  etikett: { sv: "Plats", en: "Place" },
  kopiera: { sv: "Kopiera", en: "Copy" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  klar: { sv: "Kopierad till {namn}.", en: "Copied to {namn}." },
  ejKopplad: { sv: "Kopieringen är inte kopplad. Bilagan ligger kvar i chatten.", en: "Copying is not connected. The attachment stays in the chat." },
  misslyckades: { sv: "Bilagan kunde inte kopieras.", en: "The attachment could not be copied." },
};

/**
 * @typedef {object} Bilagekopiering
 * @property {readonly { id: string, namn: string }[]} platser Platserna personen får lägga en fil på (`id` är platsens adress: `mitt~...`, gruppens id eller `plats~grupp~id`).
 * @property {(inmatning: { bilaga: { namn?: string, typ?: string, dataUrl?: string }, platsId: string }) => void | Promise<void>} onKopiera Appens kopiering. Kastar den visas texten i dialogen.
 */

const Kontext = createContext(/** @type {Bilagekopiering | null} */ (null));

/**
 * Ger bilagorna i chatten under sig knappen "Kopiera till en plats".
 * @param {{ platser: Bilagekopiering["platser"], onKopiera: Bilagekopiering["onKopiera"], children?: import("react").ReactNode }} props
 */
export function OpsBilagekopiering({ platser, onKopiera, children }) {
  if (!Array.isArray(platser)) throw new Error("OpsBilagekopiering: platser ska vara en lista av { id, namn }.");
  if (typeof onKopiera !== "function") throw new Error("OpsBilagekopiering: onKopiera ska vara en funktion. Komponenten skriver inget själv.");
  return <Kontext.Provider value={{ platser, onKopiera }}>{children}</Kontext.Provider>;
}

/**
 * Knappen och dialogen under en bilaga. Ritar ingenting utan provider, utan mål eller för en typ som inte kan kopieras.
 * @param {{ bilaga: { namn?: string, typ?: string, dataUrl?: string } }} props
 */
export function KopieraBilagaKnapp({ bilaga }) {
  const val = useContext(Kontext);
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_BILAGEKOPIERING} */ k) => ordet(ORD_BILAGEKOPIERING, k, sprak);
  const [oppen, setOppen] = useState(false);
  const [mal, setMal] = useState("");
  const [fel, setFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  const [klar, setKlar] = useState("");
  if (!val || val.platser.length === 0 || !bilagaKanKopieras(/** @type {any} */ (bilaga))) return null;
  const { platser, onKopiera } = val;
  const valt = mal || platser[0].id;
  const stang = () => {
    if (upptagen) return;
    setOppen(false);
    setFel("");
  };
  async function kopiera() {
    if (upptagen) return;
    setFel("");
    setUpptagen(true);
    try {
      await onKopiera({ bilaga, platsId: valt });
      setKlar(t("klar").replace("{namn}", platser.find((p) => p.id === valt)?.namn ?? valt));
      setOppen(false);
    } catch (e) {
      setFel(e instanceof Error && e.message ? e.message : t("misslyckades"));
    }
    setUpptagen(false);
  }
  return (
    <span data-bilaga-kopiera="" className="mt-1 flex flex-wrap items-center gap-2">
      <OpsButton variant="secondary" onClick={() => { setKlar(""); setOppen(true); }}>
        <Copy size={14} aria-hidden="true" /> {t("knapp")}
      </OpsButton>
      {klar ? <span role="status" data-bilaga-kopierad="" className="text-meta text-ink-muted">{klar}</span> : null}
      <OpsModal
        open={oppen}
        onOpenChange={(o) => { if (!o) stang(); }}
        title={t("rubrik")}
        size="sm"
        footer={(
          <>
            <OpsButton variant="secondary" onClick={stang}>{t("avbryt")}</OpsButton>
            <OpsButton variant="primary" onClick={kopiera} busy={upptagen}>{t("kopiera")}</OpsButton>
          </>
        )}
      >
        <OpsField label={t("etikett")} error={fel || undefined}>
          <OpsSelect value={valt} onChange={setMal} options={platser.map((p) => ({ value: p.id, label: p.namn }))} />
        </OpsField>
      </OpsModal>
    </span>
  );
}
