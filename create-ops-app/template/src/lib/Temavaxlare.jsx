import { useState } from "react";
import { OpsSelect, getTheme, setTheme } from "@staiger/ops-framework";

/**
 * Ljust, mörkt eller följ systemet.
 *
 * Tre val, inte en kryssruta. En boolean har bara "mörkt av" och "mörkt på",
 * och då försvinner "följ systemet": den som aldrig valt något fastnar i ljust
 * läge även med telefonen i mörkt, och det ser ut som att inställningen är
 * trasig.
 */
const VAL = [
  { value: "system", label: "Följ systemet" },
  { value: "light", label: "Ljust" },
  { value: "dark", label: "Mörkt" },
];

export function Temavaxlare() {
  const [lage, setLage] = useState(() => getTheme());
  return (
    <OpsSelect
      options={VAL}
      value={lage}
      ariaLabel="Utseende"
      onChange={(nytt) => {
        setTheme(nytt);
        setLage(nytt);
      }}
    />
  );
}
