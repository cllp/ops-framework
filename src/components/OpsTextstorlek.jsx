import { useState } from "react";
import { forvalda } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { getTextstorlek, setTextstorlek, TEXTSTORLEKAR } from "../lib/textstorlek.js";

/**
 * Väljaren för textstorleken: Liten, Mellan och Stor (cllp/lifehub.app#873, CP 2026-11-17).
 *
 * ⛔ TRE LÄGEN ÄR `OpsSegmented` (interaktionsdesignens avsnitt 4), och valet träder i kraft i samma tryck: `setTextstorlek`
 * skriver attributet på `<html>`, och varje roll i appen räknas om. Ingen nätväg, alltså ingen väntan att visa.
 *
 * ⛔ VALET ÄR PERSONENS, INTE HUBBENS. Väljaren står gärna bredvid hubbens färger, men de är gemensamma för alla i hubben och
 * textstorleken är den som läser. Enheten minns valet (`localStorage`, som temat). Ska det följa personen mellan enheter skickar
 * appen in `onChange` och skriver `users/{uid}.textstorlek` (`sparaInstallningar`), som den gör med temat. `onChange` anropas
 * EFTER att valet redan syns: en text som väntar på nätet för att bli större känns trasig. Ett fel där är appens att visa.
 *
 * @param {object} props
 * @param {string} [props.ariaLabel]
 * @param {{ liten?: string, mellan?: string, stor?: string }} [props.labels]
 * @param {(storlek: import("../lib/textstorlek.js").Textstorlek) => void} [props.onChange] Efter bytet, till exempel för att spara på kontot.
 */
export function OpsTextstorlek({ ariaLabel: ariaLabelProp, labels = {}, onChange }) {
  const o = forvalda(ORD_OPSTEXTSTORLEK, useOpsSprak());
  // Läses en gång vid montering: attributet på <html> är redan satt av `initTextstorlek` före första renderingen.
  const [storlek, setLage] = useState(getTextstorlek);
  return (
    <OpsSegmented
      ariaLabel={ariaLabelProp ?? o.ariaLabel}
      value={storlek}
      onChange={(v) => {
        setTextstorlek(v);
        setLage(v);
        onChange?.(v);
      }}
      options={TEXTSTORLEKAR.map((v) => ({ value: v, label: labels[v] ?? o[v] }))}
    />
  );
}

/** OpsTextstorleks förval. */
export const ORD_OPSTEXTSTORLEK = {
  ariaLabel: { sv: "Textstorlek", en: "Text size" },
  liten: { sv: "Liten", en: "Small" },
  mellan: { sv: "Mellan", en: "Medium" },
  stor: { sv: "Stor", en: "Large" },
};
