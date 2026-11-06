import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * ⛔ SAMMA MENY I GÄSTENS LISTA OCH DETALJ (0.192.0, cllp/lifehub.app#673). Mätt i QA på live (v1.0.1125, ramverket 0.191.0), samma fil i tre tillstånd:
 * listan före öppning hade Kommentera, detaljen Kommentera och Kopiera länk, och listan efter återgång ibland det ena och ibland det andra.
 *
 * Orsaken: "Kopiera länk" för en fil krävde en hämtad adress (`lankAttKopiera`, `adressFor`). Gästens adresser hämtas bara för posten som är öppen
 * (`adresserPaBegaran`), så raden fanns i detaljen och i listan bara när adressen råkade ligga kvar. Utan Kommentera (en grupp utan `tradar`) var menyn
 * i listan dessutom tom, och då ritades ingen ⋮ alls förrän filen öppnats. Adressen är en signering som dör efter en kvart och som också gick att
 * kopiera när gruppen stängt av nedladdning, så den är ingen länk att dela. Raden finns därför inte för en gästs fil, i listan eller i detaljen.
 */

const tid = 1_700_000_000_000;
const med = (extra) => ({ groupId: "gast", skapadAv: { uid: "u1", namn: "Anna", typ: "manniska", kalla: "bibliotek" }, skapad: tid, andrad: tid, ...extra });
// Som gästvyn bygger posterna ur tjänstens svar (OpsGastGrupp): `fil.sokvag` är postens id och skaparen saknar uid.
const somGast = (/** @type {any} */ p, id) => ({ ...p, id, groupId: "gast", skapadAv: { uid: "", namn: "Anna" } });
const FIL = somGast(byggPost(med({ typ: "fil", rubrik: "Avtal", fil: { sokvag: "f1", namn: "a.pdf", mime: "application/pdf", byte: 2048 } })), "f1");
const LANK = somGast(byggPost(med({ typ: "lank", rubrik: "Kartan", url: "https://exempel.se/karta" })), "k1");

const KOMMENTARER = { maxTecken: 2000, las: async () => ({ rader: [] }), kommentera: async () => ({}) };

function Gastvy({ kommentarer = KOMMENTARER, hamtaAdress }) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  return (
    <OpsBibliotek
      poster={[FIL, LANK]}
      jag={null}
      vald={vald}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={async () => false}
      hamtaAdress={hamtaAdress}
      adresserPaBegaran
      utanHubb
      kommentarer={kommentarer}
    />
  );
}

const menyrader = (namn) => within(screen.getByRole("menu", { name: namn })).getAllByRole("menuitem").map((r) => r.querySelector(".truncate")?.textContent ?? r.textContent);

describe("⛔ gästens fil har samma meny före, under och efter att den öppnats (#673)", () => {
  it("lista före, detalj och lista efter ger samma rader, utan Kopiera länk", async () => {
    const user = userEvent.setup();
    const hamtaAdress = vi.fn(async () => "https://signerad.exempel/f1?sig=abc");
    render(<Gastvy hamtaAdress={hamtaAdress} />);

    await user.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
    const fore = menyrader("Avtal");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Avtal" }));
    await waitFor(() => expect(hamtaAdress).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Avtal" }));
    const detalj = menyrader("Avtal");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /Tillbaka|Stäng/ }));
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Avtal" }));
    const efter = menyrader("Avtal");

    expect(fore).toEqual(["Kommentera"]);
    expect(detalj).toEqual(fore);
    expect(efter).toEqual(fore);
  });

  it("utan Kommentera har filen ingen ⋮ i listan och ingen i detaljen, i stället för en som dyker upp efter ett besök", async () => {
    const user = userEvent.setup();
    const hamtaAdress = vi.fn(async () => "https://signerad.exempel/f1?sig=abc");
    render(<Gastvy kommentarer={null} hamtaAdress={hamtaAdress} />);
    expect(screen.queryByRole("button", { name: "Åtgärder för Avtal" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Avtal" }));
    await waitFor(() => expect(hamtaAdress).toHaveBeenCalled());
    // Ge adressen tid att landa: det var den som förut gav detaljen en rad listan saknade.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: "Åtgärder för Avtal" })).toBeNull();
  });

  it("en länk har sin adress utan hämtning, och Kopiera länk står kvar för den", async () => {
    const user = userEvent.setup();
    render(<Gastvy hamtaAdress={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Kartan" }));
    expect(menyrader("Kartan")).toEqual(["Kommentera", "Kopiera länk"]);
  });
});
