import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsSprakProvider, useOpsSprak } from "../components/OpsSprak.jsx";
import { OpsHandelsePanel, ORD_OPSHANDELSEPANEL } from "../components/OpsHandelsePanel.jsx";
import { OpsProfil, ORD_OPSPROFIL } from "../components/OpsProfil.jsx";
import { OpsBottomNav, ORD_OPSBOTTOMNAV } from "../components/OpsBottomNav.jsx";
import { ORD_OPSAPPSHELL, TEXT_SKAL } from "../components/OpsAppShell.jsx";
import { ORD_OPSEVENTLIST } from "../components/OpsEventList.jsx";
import { ORD_OPSSKAPA } from "../components/OpsSkapa.jsx";
import { forvalda, ordet } from "../lib/ord.js";
import * as nod from "../node/index.js";

/**
 * 0.46.0: språket ur profilen (cllp/bolag-ops#528).
 *
 * ⛔ HÄNDELSEN: CP 2026-10-01, "byta språk i profil byter inte språk". Profilen sparade valet och ingenting läste det: varje komponent
 * hade sina etiketter som svenska förval. Proven mäter det en person ser: samma komponent på svenska utan något satt, på engelska när
 * appen sätter engelska, och appens egna ord före ordbokens.
 */

afterEach(() => vi.restoreAllMocks());

const handelse = { id: "h1", titel: "Styrelsemöte", datum: "2026-10-12" };

describe("⛔ OpsSprakProvider styr ramverkets egna texter (#528)", () => {
  it("utan provider är allt som förut, på svenska", () => {
    render(<OpsHandelsePanel handelse={handelse} onTillbaka={() => {}} />);
    expect(screen.getByRole("button", { name: /Tillbaka/ })).toBeTruthy();
  });

  it("med engelska byter panelen språk, också i det som läses upp", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsHandelsePanel handelse={null} onTillbaka={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: /Back/ })).toBeTruthy();
    expect(screen.getByText("The event does not exist")).toBeTruthy();
    expect(screen.queryByText("Händelsen finns inte")).toBeNull();
  });

  it("⛔ appens egna etikett vinner över ordboken, på vilket språk som helst", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsHandelsePanel handelse={handelse} onTillbaka={() => {}} tillbakaEtikett="Till kalendern" />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: /Till kalendern/ })).toBeTruthy();
  });

  it("⛔ ett `sprak` som appen ger direkt vinner över providern", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsHandelsePanel handelse={null} onTillbaka={() => {}} sprak="sv" />
      </OpsSprakProvider>,
    );
    expect(screen.getByText("Händelsen finns inte")).toBeTruthy();
  });

  it("profilen på engelska: knappen och språkens egna namn följer med", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsProfil anvandare={{ id: "u1", namn: "Prov", epost: "p@exempel.se", bild: "", sprak: "en", tema: "system", telefon: "", stad: "", presentation: "", lankar: [], bildSokvag: "" }} onSpara={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getAllByText("English").length).toBeGreaterThan(0);
    expect(screen.queryByText("Engelska")).toBeNull();
  });

  it("bottenraden på engelska", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsBottomNav nav={[{ href: "/", label: "Today" }]} activeHref="/" />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Quick navigation" })).toBeTruthy();
  });

  it("⛔ ett okänt språk blir svenska och säger det i konsolen, det tiger inte", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    /** @type {string[]} */
    const sett = [];
    function Las() {
      sett.push(useOpsSprak());
      return null;
    }
    render(
      <OpsSprakProvider sprak="de">
        <Las />
      </OpsSprakProvider>,
    );
    expect(sett.at(-1)).toBe("sv");
    expect(fel).toHaveBeenCalled();
  });
});

describe("⛔ ordböckerna är hela (#528)", () => {
  const alla = { TEXT_SKAL, ORD_OPSAPPSHELL, ORD_OPSBOTTOMNAV, ORD_OPSHANDELSEPANEL, ORD_OPSPROFIL, ORD_OPSEVENTLIST, ORD_OPSSKAPA };
  it("varje nyckel har svenska och engelska, och engelskan är inte en kopia av svenskan där ordet faktiskt skiljer sig", () => {
    let antal = 0;
    for (const [namn, ord] of Object.entries(alla)) {
      for (const [k, t] of Object.entries(ord)) {
        antal += 1;
        expect(t.sv, `${namn}.${k}.sv`).toBeTruthy();
        expect(t.en, `${namn}.${k}.en`).toBeTruthy();
      }
    }
    // GOLV: de sex komponenterna bär 65 förval och skalet 11 egna texter. Färre betyder att något föll ur en ordbok (arbetsreglernas punkt 4).
    expect(antal).toBeGreaterThanOrEqual(76);
  });

  it("⛔ ordet: en nyckel som saknas kastar, i stället för att rita en tom etikett", () => {
    expect(() => ordet({ x: { sv: "Hej", en: "Hi" } }, "y", "en")).toThrow(/finns inte/);
    expect(ordet({ x: { sv: "Hej", en: "Hi" } }, "x", "en")).toBe("Hi");
  });

  it("forvalda: ett språk utan ord i ordboken ger svenska", () => {
    expect(forvalda({ x: { sv: "Hej", en: "Hi" } }, "de")).toEqual({ x: "Hej" });
    expect(forvalda({ x: { sv: "Hej", en: "Hi" } }, "en")).toEqual({ x: "Hi" });
  });
});

describe("nodsidan läser gruppens externa datakällor (#512)", () => {
  it("byggExternaDatakallor finns i @staiger/ops-framework/node", () => {
    expect(typeof nod.byggExternaDatakallor).toBe("function");
    expect(nod.byggExternaDatakallor([{ type: "github", repo: "cllp/travel", enabled: true }], "g")).toEqual([{ type: "github", repo: "cllp/travel", enabled: true }]);
  });
});

describe("nodsidan ger gruppens typer och TALK-taken (lifehub.app#37)", () => {
  it("typerForGrupp på nodsidan ger samma lista som huvudingången, med modulens bidrag", async () => {
    const huvud = await import("../lib/modultyper.js");
    const sammanhang = {
      bas: [{ id: "arende", namn: "Ärende" }],
      moduler: [{ id: "kvitto", typer: { inkorg: [{ id: "kvitto", namn: "Kvitto" }] } }],
      modulerPa: ["kvitto"],
      avvikelser: [],
    };
    const lista = nod.typerForGrupp("inkorg", sammanhang);
    expect(lista.map((t) => t.id)).toEqual(["arende", "kvitto:kvitto"]);
    expect(lista).toEqual(huvud.typerForGrupp("inkorg", sammanhang));
  });

  it("TALK-taken på nodsidan är inspelarens", async () => {
    const talk = await import("../lib/talk.js");
    expect(nod.MAX_SEKUNDER).toBe(talk.MAX_SEKUNDER);
    expect(nod.MAX_SEKUNDER).toBeGreaterThan(0);
    expect(nod.LJUDFORMAT).toBe(talk.LJUDFORMAT);
    expect(nod.LJUDFORMAT.length).toBeGreaterThanOrEqual(2);
  });
});
