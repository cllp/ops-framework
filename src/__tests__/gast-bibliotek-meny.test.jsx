import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * ⛔ GÄSTENS FIL HAR KOPIERA LÄNK I LISTAN OCH I DETALJEN (cllp/lifehub.app#716).
 *
 * 0.192.0 (lifehub.app#673) tog bort raden för en gästs fil. Adressen hämtas bara för posten som är öppen
 * (`adresserPaBegaran`), så raden fanns i detaljen och i listan bara när adressen råkade ligga kvar. Adressen är en
 * signering som dör efter en kvart, och den gick att kopiera också när nedladdning var av. Raden togs därför bort
 * för alla gästens filer, i listan och i detaljen.
 *
 * QA 2026-11-09 (my.life-hub.app v1.0.1147, ramverket 0.208.0): medlemmen i samma grupp har Kommentera och Kopiera länk.
 * Gästen har bara Kommentera, i listan och i detaljen, också utan att öppna filen först.
 *
 * Raden visas utan att adressen är hämtad, så listan och detaljen har samma meny. Ett tryck hämtar adressen för just
 * den filen (samma `hamtaAdress` som visningen, ett argument, en signering, aldrig en per rad i listan) och kopierar den.
 * Är adressen redan hämtad kopieras den utan en ny hämtning. Nekar hämtningen kopieras ingenting, och felet står kvar.
 * Ladda ned styrs som förut av `utanNedladdning`.
 *
 * ⛔ RÖTT UTAN RÄTTNINGEN: listan före öppning ger bara Kommentera, eftersom `lankAttKopiera` hoppar över en fil när
 * `adresserPaBegaran` är satt. Det är det här provet som fångar det.
 */

const tid = 1_700_000_000_000;
const med = (extra) => ({ groupId: "gast", skapadAv: { uid: "u1", namn: "Anna", typ: "manniska", kalla: "bibliotek" }, skapad: tid, andrad: tid, ...extra });
// Som gästvyn bygger posterna ur tjänstens svar (OpsGastGrupp): `fil.sokvag` är postens id och skaparen saknar uid.
const somGast = (/** @type {any} */ p, id) => ({ ...p, id, groupId: "gast", skapadAv: { uid: "", namn: "Anna" } });
const fil = { sokvag: "f1", namn: "a.pdf", mime: "application/pdf", byte: 2048 };
const FIL = somGast(byggPost(med({ typ: "fil", rubrik: "Avtal", fil })), "f1");
const ZIP = somGast(byggPost(med({ typ: "fil", rubrik: "Paket", fil: { sokvag: "z1", namn: "a.txt", mime: "text/plain", byte: 100 } })), "z1");
const LANK = somGast(byggPost(med({ typ: "lank", rubrik: "Kartan", url: "https://exempel.se/karta" })), "k1");
const ANTECKNING = somGast(byggPost(med({ typ: "anteckning", rubrik: "Minnesanteckning", text: "Hej." })), "a1");
const OFARDIG = somGast(byggPost(med({ typ: "fil", rubrik: "Halv", fil: { sokvag: "h1", namn: "halv.pdf", mime: "application/pdf", byte: 10, klar: false } })), "h1");

const ADRESS = "https://signerad.exempel/f1?sig=abc";
const KOMMENTARER = { maxTecken: 2000, las: async () => ({ rader: [] }), kommentera: async () => ({}) };
const GASTENS_FILMENY = ["Kommentera", "Kopiera länk"];

function Gastvy({ kommentarer = KOMMENTARER, hamtaAdress, utanNedladdning = false, poster = [FIL, LANK, ANTECKNING, OFARDIG] }) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  return (
    <OpsBibliotek
      poster={poster}
      jag={null}
      vald={vald}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={async () => false}
      hamtaAdress={hamtaAdress}
      adresserPaBegaran
      utanHubb
      utanNedladdning={utanNedladdning}
      kommentarer={kommentarer}
    />
  );
}

const menyrader = (namn) => within(screen.getByRole("menu", { name: namn })).getAllByRole("menuitem").map((r) => r.querySelector(".truncate")?.textContent ?? r.textContent);

/** @param {() => Promise<void>} kor */
async function medUrklipp(kor) {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const tidigare = navigator.clipboard;
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    await kor(writeText);
  } finally {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: tidigare });
  }
}

describe("⛔ gästens fil har Kopiera länk och Kommentera i listan och i detaljen (#716)", () => {
  it("lista före, detalj och lista efter ger samma rader, och listan kopierar adressen utan att ha hämtat den i förväg", async () => {
    const user = userEvent.setup();
    const hamtaAdress = vi.fn(async () => ADRESS);
    render(<Gastvy hamtaAdress={hamtaAdress} />);

    await medUrklipp(async (writeText) => {
      await user.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
      const fore = menyrader("Avtal");
      expect(hamtaAdress, "menyn i listan hämtar ingen adress").not.toHaveBeenCalled();
      await user.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(ADRESS));
      expect(hamtaAdress.mock.calls).toEqual([["f1"]]);
      expect(await screen.findByText("Länken är kopierad. Den gäller i 15 minuter.")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Avtal" }));
      await waitFor(() => expect(document.querySelector("[data-bibliotek-pdf]")).toBeTruthy());
      await user.click(await screen.findByRole("button", { name: "Åtgärder för Avtal" }));
      const detalj = menyrader("Avtal");
      const anropFore = hamtaAdress.mock.calls.length;
      await user.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
      expect(writeText).toHaveBeenLastCalledWith(ADRESS);
      // ⛔ Gästens adress hämtas på nytt vid varje kopiering: visningens adress kan ha gått ut (granskningen av PR 558).
      expect(hamtaAdress.mock.calls.length, "kopieringen hämtar en färsk adress").toBe(anropFore + 1);

      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: /Tillbaka|Stäng/ }));
      await user.click(await screen.findByRole("button", { name: "Åtgärder för Avtal" }));
      const efter = menyrader("Avtal");

      expect(fore).toEqual(GASTENS_FILMENY);
      expect(detalj).toEqual(fore);
      expect(efter).toEqual(fore);
      expect(fore).not.toContain("Byt namn");
      expect(fore).not.toContain("Radera");
      expect(fore).not.toContain("Ladda ned");
    });
  });

  it("utan Kommentera har filen Kopiera länk i listan och i detaljen, och en anteckning utan adress har ingen ⋮", async () => {
    const user = userEvent.setup();
    const hamtaAdress = vi.fn(async () => ADRESS);
    render(<Gastvy kommentarer={null} hamtaAdress={hamtaAdress} />);
    expect(screen.queryByRole("button", { name: "Åtgärder för Minnesanteckning" }), "en anteckning har ingenting att kopiera").toBeNull();
    expect(screen.queryByRole("button", { name: "Åtgärder för Halv" }), "en fil som inte är uppladdad har ingen adress").toBeNull();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
    expect(menyrader("Avtal")).toEqual(["Kopiera länk"]);
    expect(hamtaAdress).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Avtal" }));
    await waitFor(() => expect(hamtaAdress).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Avtal" }));
    expect(menyrader("Avtal")).toEqual(["Kopiera länk"]);
  });

  it("en länk har sin adress utan hämtning, och Kopiera länk står kvar för den", async () => {
    const user = userEvent.setup();
    const hamtaAdress = vi.fn();
    render(<Gastvy hamtaAdress={hamtaAdress} />);
    await medUrklipp(async (writeText) => {
      await user.click(screen.getByRole("button", { name: "Åtgärder för Kartan" }));
      expect(menyrader("Kartan")).toEqual(GASTENS_FILMENY);
      await user.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://exempel.se/karta"));
      expect(hamtaAdress).not.toHaveBeenCalled();
    });
  });

  it("en anteckning med kommentarer har Kommentera och inte Kopiera länk", async () => {
    const user = userEvent.setup();
    render(<Gastvy hamtaAdress={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Minnesanteckning" }));
    expect(menyrader("Minnesanteckning")).toEqual(["Kommentera"]);
  });

  it("⛔ nedladdning av: ingen Kopiera länk och ingen Ladda ned, och hämtningen ber inte om en bilaga (granskningen av PR 558)", async () => {
    const user = userEvent.setup();
    const hamtaAdress = vi.fn(async () => "https://signerad.exempel/z1?sig=abc");
    render(<Gastvy hamtaAdress={hamtaAdress} utanNedladdning poster={[ZIP]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Paket" }));
    expect(menyrader("Paket")).toEqual(["Kommentera"]);
    expect(hamtaAdress).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Paket" }));
    // (cllp/ops-framework#560) Filnamnet är text när nedladdning är av: en länk hade gett gästen den signerade adressen att kopiera.
    await waitFor(() => expect(document.querySelector("[data-bibliotek-filnamn]")?.textContent).toContain("a.txt"));
    expect(screen.queryByRole("link", { name: /a\.txt/ })).toBeNull();
    expect(hamtaAdress.mock.calls.every((anrop) => anrop.length === 1 && anrop[0] === "z1")).toBe(true);
    expect(screen.queryByRole("link", { name: "Ladda ned" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Paket" }));
    expect(menyrader("Paket")).toEqual(["Kommentera"]);
  });

  it("en nekad hämtning kopierar ingenting och visar felet", async () => {
    const user = userEvent.setup();
    const hamtaAdress = vi.fn(async () => {
      throw new Error("Gruppen har stängt av nedladdning. Filen går inte att öppna här.");
    });
    render(<Gastvy hamtaAdress={hamtaAdress} poster={[FIL]} />);
    await medUrklipp(async (writeText) => {
      await user.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
      await user.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
      expect(await screen.findByText("Gruppen har stängt av nedladdning. Filen går inte att öppna här.")).toBeTruthy();
      expect(writeText).not.toHaveBeenCalled();
    });
  });
});

describe("medlemmens meny har kvar Kopiera länk och de andra raderna", () => {
  it("en fil kopierar postens adress i appen och aldrig filens (0.220.0, lifehub.app#801), och en anteckning har ingen Kopiera länk", async () => {
    const user = userEvent.setup();
    const medlemsfil = { id: "mf", ...byggPost(med({ groupId: "g1", typ: "fil", rubrik: "Avtal", fil })) };
    const anteckning = { id: "ma", ...byggPost(med({ groupId: "g1", typ: "anteckning", rubrik: "Minnesanteckning", text: "Hej." })) };
    render(
      <OpsBibliotek
        poster={[medlemsfil, anteckning]}
        jag={{ uid: "u1", namn: "Anna", roll: "medlem", status: "aktiv" }}
        vald={null}
        onOppna={() => {}}
        onStang={() => {}}
        onSkapa={() => {}}
        onSpara={async () => false}
        filUrl={() => "https://lagring.exempel/avtal.pdf?token=hemlig"}
        postlank={(p) => `https://app.exempel/bibliotek?plats=${p.groupId}&post=${p.id}`}
        hubHref="/hubb"
        kommentarer={KOMMENTARER}
      />,
    );
    await medUrklipp(async (writeText) => {
      await user.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
      expect(menyrader("Avtal")).toEqual(["Byt namn", "Lägg till tagg", "Kommentera", "Lägg i lista", "Kopiera länk", "Nåla fast", "Arkivera", "Radera"]);
      await user.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
      // ⛔ ÄNDRAT I 0.220.0: här kopierades filens nedladdningsadress, som öppnas av vem som helst och aldrig går ut.
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://app.exempel/bibliotek?plats=g1&post=mf"));
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Åtgärder för Minnesanteckning" }));
      const rader = menyrader("Minnesanteckning");
      expect(rader).toContain("Kommentera");
      expect(rader).toContain("Byt namn");
      expect(rader).not.toContain("Kopiera länk");
    });
  });
});
