import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsDisclosure } from "../components/OpsDisclosure.jsx";
import { OpsField, OpsInput } from "../components/OpsField.jsx";
import { OpsGastChatt } from "../components/OpsGastChatt.jsx";
import { bibliotekslank } from "../lib/postkommentar.js";
import { faltKlass } from "../lib/radKlass.js";

/*
 * 0.196.0: inga kantlinjer som bara ramar in, i gästens vy och i det gästen delar med appen.
 *
 * CP 2026-11-06, med en skärmbild av gästens Chatt i telefonen: "Ta bort borders runt chatten och överallt." Ramen runt loggen och strecket över skrivfältet togs bort i 0.195.0. Kvar stod en kant runt korten i chatten
 * (postkortet, till exempel ljudfilen med mikrofonikon), runt skrivfältets piller, runt Integritet-rutan (`OpsDisclosure`) och runt namnfältet.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), utfallen står i PR-texten: med 0.195.0 bär kortet `border border-line`, pillret `border border-line`, avsnittet `border border-line` och namnfältet `border-line`.
 * ⛔ KANTER SOM BÄR BETYDELSE STÅR KVAR: ett fält med fel har `border-danger`, och fokus syns med fokusringen (`outline`).
 */

/** En klass som ritar en synlig kant: `border`, `border-t`, `border-line`, men inte `border-transparent` eller en fokusring. */
const SYNLIG_KANT = /(^|\s)border(-[trblxy])?(-(?!transparent)[a-z][a-z0-9-]*)?(?=\s|$)/;

const BAS = "https://my.life-hub.app/bibliotek";
const LANK = bibliotekslank(BAS, { plats: "g", postId: "p1" });

describe("gästens chatt: kortet och skrivfältet", () => {
  it("⛔ postkortet har ingen kantlinje, och skiljs ut med en fylld yta", async () => {
    render(
      <OpsGastChatt
        meddelanden={[{ id: "m1", av: { namn: "Maja" }, text: `Lyssna ${LANK}`, tid: 1000, kort: [{ url: LANK, postId: "p1", typ: "fil", rubrik: "Oklart.Edit1", mime: "audio/mpeg" }] }]}
        onSkriv={async () => {}}
        igenkanning={false}
      />,
    );
    const kort = await waitFor(() => {
      const k = document.querySelector(`[data-postkort="${LANK}"]`);
      expect(k).not.toBeNull();
      return /** @type {HTMLElement} */ (k);
    }, { timeout: 5000 });
    expect(kort.className).not.toMatch(SYNLIG_KANT);
    expect(kort.className).toMatch(/(^|\s)bg-hover(\s|$)/);
    expect(kort.className).toMatch(/focus-visible:outline-2/);
  });

  it("⛔ skrivfältets piller har ingen kantlinje: en fylld yta, och fokus syns med fokusringen", () => {
    render(<OpsGastChatt meddelanden={[{ id: "m1", av: { namn: "Maja" }, text: "Hej", tid: 1000 }]} onSkriv={async () => {}} igenkanning={false} />);
    const ruta = /** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-skriv] [data-skrivruta]"));
    expect(ruta).not.toBeNull();
    expect(ruta.className).not.toMatch(SYNLIG_KANT);
    expect(ruta.className).toMatch(/(^|\s)bg-hover(\s|$)/);
    expect(ruta.className).toMatch(/focus-within:outline-2/);
    expect(ruta.className).toMatch(/focus-within:outline-accent/);
  });
});

describe("det gästen delar med appen", () => {
  it("⛔ ett utfällbart avsnitt (Integritet) har ingen kant runt sig och inget streck över innehållet", () => {
    render(
      <OpsDisclosure summary="Integritet och dina uppgifter" defaultOpen>
        <p>Innehållet</p>
      </OpsDisclosure>,
    );
    const avsnitt = /** @type {HTMLElement} */ (document.querySelector("details"));
    expect(avsnitt.className).not.toMatch(SYNLIG_KANT);
    const innehall = /** @type {HTMLElement} */ (screen.getByText("Innehållet").parentElement);
    expect(innehall.className).not.toMatch(SYNLIG_KANT);
  });

  it("⛔ ett fyllt fält har ingen synlig kant, men felet syns som kant och fokus som ring; förvalet är oförändrat", () => {
    expect(faltKlass({ yta: "fylld" })).not.toMatch(/(^|\s)border-line(\s|$)/);
    expect(faltKlass({ yta: "fylld" })).toMatch(/(^|\s)border-transparent(\s|$)/);
    expect(faltKlass({ yta: "fylld" })).toMatch(/(^|\s)bg-hover(\s|$)/);
    expect(faltKlass({ yta: "fylld", invalid: true })).toMatch(/(^|\s)border-danger(\s|$)/);
    expect(faltKlass({ yta: "fylld" })).toMatch(/focus-visible:outline-accent/);
    // Appens formulär behåller SS-kanten.
    expect(faltKlass()).toMatch(/(^|\s)border-line(\s|$)/);
    render(
      <OpsField label="Vad ska gruppen kalla dig?">
        <OpsInput value="" onChange={() => {}} tal={false} yta="fylld" />
      </OpsField>,
    );
    expect(screen.getByRole("textbox").className).not.toMatch(/(^|\s)border-line(\s|$)/);
  });
});
