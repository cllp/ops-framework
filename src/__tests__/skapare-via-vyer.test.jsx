import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { OpsKommentarer, OpsKommentarsrad } from "../components/OpsKommentarer.jsx";
import { Meddelanderader } from "../components/OpsMeddelanden.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { kommentarsrader } from "../lib/handelsemodell.js";

/**
 * Vyerna ritar "Miranda via Byggagent" när en personlig API-nyckel skrev åt Miranda (0.135.0, cllp/lifehub.app#409, CP 2026-10-21).
 *
 * Varje prov har ett motsatspar: samma rad UTAN via ritas exakt som förut. Ett prov som bara visar att märket finns är grönt även
 * när märket sitter på alla rader, och då är det ingen skillnad kvar att se.
 */

const via = { nyckelId: "0123456789abcdef", namn: "Byggagent" };
const miranda = { uid: "uid-miranda", namn: "Miranda", typ: "manniska", kalla: "api" };
const skapad = new Date(2026, 8, 29, 9, 12).toISOString();

describe("Ursprungsrad (OpsEventList och OpsHandelsePanel)", () => {
  const rad = { id: "h1", title: "Bokslutsmöte", daysLeft: 3 };

  it("listan: 'Skapad av Miranda via Byggagent', och utan via 'Skapad av Miranda'", () => {
    render(<OpsEventList events={[{ ...rad, id: "a", skapadAv: { ...miranda, via }, skapad }, { ...rad, id: "b", skapadAv: miranda, skapad }]} />);
    const [med, utan] = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-ursprungsrad]")]);
    expect(med.textContent).toContain("Skapad av Miranda via Byggagent, 29 sep 09:12");
    expect(utan.textContent).toContain("Skapad av Miranda, 29 sep 09:12");
    expect(utan.textContent).not.toContain("via");
  });

  it("panelen ritar samma rad", () => {
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Bokslut", datum: "2026-10-12", skapadAv: { ...miranda, via }, skapad }} onTillbaka={() => {}} />);
    const r = /** @type {HTMLElement} */ (document.querySelector("[data-handelsepanel] [data-ursprungsrad]"));
    expect(r.textContent).toContain("Skapad av Miranda via Byggagent, 29 sep 09:12");
  });

  it("⛔ märket syns också när skaparen är en människa: via gör inte raden till en agents (roboten är agentens)", () => {
    render(<OpsEventList events={[{ ...rad, skapadAv: { ...miranda, via }, skapad }]} />);
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-ursprungsrad]")).textContent).toMatch(/^Människa: /);
  });
});

describe("OpsKommentarer", () => {
  const k = (/** @type {string} */ id, /** @type {any} */ av, text = id) => ({ id, text, skapad, skapadAv: av });

  it("tråden ritar 'Miranda via Byggagent' bara på kommentaren nyckeln skrev", () => {
    render(<OpsKommentarer kommentarer={[k("a", { ...miranda, via }), k("b", { uid: "uid-bo", namn: "Bo", typ: "manniska", kalla: "x" })]} uid="uid-bo" onSkriv={() => {}} />);
    const [a, b] = screen.getAllByRole("listitem");
    expect(within(a).getByText("Miranda via Byggagent")).toBeInTheDocument();
    expect(within(b).getByText("Bo (du)")).toBeInTheDocument();
    expect(within(b).queryByText(/via/)).toBeNull();
  });

  it("⛔ min egen kommentar via min nyckel heter 'Miranda via Byggagent (du)', så märket inte försvinner för ägaren", () => {
    render(<OpsKommentarer kommentarer={[k("a", { ...miranda, via })]} uid="uid-miranda" onSkriv={() => {}} />);
    expect(screen.getByText("Miranda via Byggagent (du)")).toBeInTheDocument();
  });

  it("inkorgens rad (kommentarsrader och OpsKommentarsrad) bär märket hela vägen", () => {
    const rader = kommentarsrader({
      handelser: [{ id: "h1", titel: "Höstfest" }],
      kommentarer: new Map([["h1", [k("a", { ...miranda, via }, "Jag tar med kaffe")]]]),
      lastTill: new Map(),
      uid: "uid-bo",
    });
    expect(rader[0].senaste.via).toEqual(via);
    const s = rader[0].senaste;
    render(<OpsKommentarsrad titel="Höstfest" olasta={1} namn={s.namn} via={s.via} text={s.text} href="/h/h1" />);
    expect(screen.getByRole("link")).toHaveTextContent("Miranda via Byggagent: Jag tar med kaffe");
  });

  it("kommentarsrader: en kommentar utan via ger ingen via-nyckel på raden", () => {
    const rader = kommentarsrader({ handelser: [{ id: "h1", titel: "Höstfest" }], kommentarer: new Map([["h1", [k("a", miranda)]]]), lastTill: new Map(), uid: "uid-bo" });
    expect(Object.hasOwn(rader[0].senaste, "via")).toBe(false);
  });
});

describe("OpsBibliotek, en posts detalj", () => {
  const tid = 1_700_000_000_000;
  const post = (/** @type {any} */ skapadAv) => ({ ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", skapadAv, skapad: tid, andrad: tid }), id: "a" });
  const detalj = (/** @type {any} */ skapadAv) => {
    const p = post(skapadAv);
    return render(<OpsBibliotek poster={[p]} vald={p} jag={{ uid: "uid-miranda", roll: "medlem" }} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />);
  };

  it("'Skriven av Miranda via Byggagent.' när en nyckel skrev posten", () => {
    detalj({ ...miranda, via });
    expect(document.querySelector("[data-bibliotek-meta]")?.textContent).toContain("Skriven av Miranda via Byggagent.");
  });

  it("och 'Skriven av Miranda.' utan via", () => {
    detalj(miranda);
    const meta = document.querySelector("[data-bibliotek-meta]")?.textContent ?? "";
    expect(meta).toContain("Skriven av Miranda.");
    expect(meta).not.toContain("via");
  });
});

describe("OpsMeddelanden, ett meddelande från en nyckel", () => {
  const T = Date.UTC(2026, 9, 19, 9, 0);
  const namn = (/** @type {string} */ id) => (id === "u-miranda" ? "Miranda" : id === "u-bo" ? "Bo" : "Namn saknas");
  const rita = (/** @type {any[]} */ meddelanden, /** @type {any} */ props = {}) =>
    render(
      <OpsSprakProvider sprak={props.locale === "en-GB" ? "en" : "sv"}>
        <Meddelanderader meddelanden={meddelanden} uid="u-bo" namnFor={namn} medlemmar={[]} locale="sv-SE" visaNamn {...props} />
      </OpsSprakProvider>,
    );
  const rubriker = () => [...document.querySelectorAll("[data-avsandare]")].map((e) => e.textContent);

  it("namnraden heter 'Miranda via Byggagent', och Mirandas eget meddelande heter 'Miranda'", () => {
    rita([
      { id: "a", av: "u-miranda", text: "För hand", tid: T },
      { id: "b", av: "u-bo", text: "Svar", tid: T + 1000 },
      { id: "c", av: "u-miranda", via, text: "Från nyckeln", tid: T + 2000 },
    ]);
    expect(rubriker()).toEqual(["Miranda", "Miranda via Byggagent"]);
  });

  it("⛔ ett meddelande från nyckeln fortsätter inte Mirandas eget inom fem minuter: märket ska inte gömmas under ett namn utan märke", () => {
    rita([
      { id: "a", av: "u-miranda", text: "För hand", tid: T },
      { id: "b", av: "u-miranda", via, text: "Från nyckeln", tid: T + 60_000 },
      { id: "c", av: "u-miranda", via, text: "Och en till från nyckeln", tid: T + 90_000 },
    ]);
    // Två namnrader: den för hand och den första från nyckeln. Det tredje är samma nyckel inom fem minuter och får fortsätta.
    expect(rubriker()).toEqual(["Miranda", "Miranda via Byggagent"]);
  });

  it("två nycklar med olika namn fortsätter inte varandra", () => {
    rita([
      { id: "a", av: "u-miranda", via, text: "A", tid: T },
      { id: "b", av: "u-miranda", via: { nyckelId: "fedcba9876543210", namn: "Kalenderagent" }, text: "B", tid: T + 1000 },
    ]);
    expect(rubriker()).toEqual(["Miranda via Byggagent", "Miranda via Kalenderagent"]);
  });

  it("⛔ ett meddelande jag själv skrev via min nyckel bär märket (annars läses det som något jag skrev för hand)", () => {
    rita([
      { id: "a", av: "u-bo", text: "För hand", tid: T },
      { id: "b", av: "u-bo", via, text: "Från min nyckel", tid: T + 1000 },
    ]);
    const eget = [...document.querySelectorAll("[data-via-eget]")].map((e) => e.textContent);
    expect(eget).toEqual(["Du via Byggagent"]);
  });

  it("i ett privat samtal (utan namnrader) bär ändå nyckelns meddelande sitt märke, och Mirandas eget ingen namnrad", () => {
    rita(
      [
        { id: "a", av: "u-miranda", text: "För hand", tid: T },
        { id: "b", av: "u-miranda", via, text: "Från nyckeln", tid: T + 60 * 60_000 },
      ],
      { visaNamn: false },
    );
    expect(rubriker()).toEqual(["Miranda via Byggagent"]);
  });

  it("ett citat av ett meddelande från en nyckel bär märket", () => {
    const uppslag = new Map([["q", { id: "q", av: "u-miranda", via, text: "Citerad text", tid: T }]]);
    rita([{ id: "r", av: "u-bo", svarPa: "q", text: "Svar", tid: T + 1000 }, { id: "s", av: "u-miranda", text: "Annat", tid: T + 2000 }], { citat: { uppslag } });
    const citat = /** @type {HTMLElement} */ (document.querySelector("[data-citat='q']"));
    expect(citat.textContent).toContain("Miranda via Byggagent");
  });

  it("på engelska heter det också 'via' (ordet går genom textlagret)", () => {
    rita([{ id: "a", av: "u-miranda", via, text: "From the key", tid: T }], { locale: "en-GB" });
    expect(rubriker()).toEqual(["Miranda via Byggagent"]);
  });
});
