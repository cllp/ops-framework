import { useState } from "react";
import { getTheme, setTheme } from "../lib/theme.js";
import { OpsSelect } from "./OpsSelect.jsx";

/**
 * Växlare för ljust, mörkt och följ systemet.
 *
 * ⛔ Den här låg tidigare i mallen, alltså kopierad in i varje app. Det betydde
 * att tre plattformar hade tre kopior som kunde glida isär, och att en rättning
 * i en av dem aldrig nådde de andra. Nu är det en primitiv som alla delar.
 *
 * ⛔ TRE lägen, inte en kryssruta. En boolean har bara "mörkt av" och "mörkt
 * på", och då försvinner "följ systemet": den som aldrig valt något fastnar i
 * ljust läge även med telefonen i mörkt, och det ser ut som att inställningen är
 * trasig.
 *
 * Etiketterna går att skicka in, eftersom en app kan köras på ett annat språk
 * än svenska. Standardvärdena är svenska därför att det är vad vi kör.
 */

/**
 * @param {object} props
 * @param {string} [props.ariaLabel]
 * @param {{ system?: string, light?: string, dark?: string }} [props.labels]
 */
export function OpsThemeToggle({ ariaLabel = "Utseende", labels = {} }) {
  // Läses en gång vid montering. Attributet på <html> är redan satt av
  // `initTheme` före första renderingen, så det finns inget att synka här.
  const [lage, setLage] = useState(() => getTheme());

  const val = [
    { value: "system", label: labels.system ?? "Följ systemet" },
    { value: "light", label: labels.light ?? "Ljust" },
    { value: "dark", label: labels.dark ?? "Mörkt" },
  ];

  return (
    <OpsSelect
      options={val}
      value={lage}
      ariaLabel={ariaLabel}
      onChange={(nytt) => {
        setTheme(/** @type {any} */ (nytt));
        setLage(/** @type {any} */ (nytt));
      }}
    />
  );
}
