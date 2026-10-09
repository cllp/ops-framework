import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAgenter, agenterManifest } from "../components/OpsAgenter.jsx";
import { OpsApparArk } from "../components/OpsApparArk.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { AGENTER_ID, agentIHref, agentInstallningsHref, medAgent } from "../lib/agenter.js";
import { arkRader } from "../lib/apparark.js";
import { validateModuler } from "../lib/modul.js";

/**
 * Agenter (0.90.0, inställningsvyn 0.90.2). Listan, inställningarna per agent, chattens ingång och att
 * gruppvyn bara länkar. jsdom mäter inte pixlar.
 */

const GRANSER = {
  namn: 40,
  beskrivning: 200,
  roll: 120,
  instruktioner: 4000,
  minne: 500,
  skillNamn: 80,
  skillBeskrivning: 300,
  skillText: 12000,
};

const AGENTER = [
  { id: "ops", namn: "Ops", status: "aktiv" },
  { id: "karta", namn: "Karta", status: "avstangd" },
];

function modul() {
  return validateModuler([agenterManifest()])[0];
}

/** @param {Record<string, unknown>} [over] */
function rita(over = {}) {
  const onNavigate = vi.fn((_h, e) => e?.preventDefault?.());
  const utils = render(
    <OpsAgenter
      modul={modul()}
      activeHref="/agenter"
      hubHref="/hub"
      onNavigate={onNavigate}
      ram={{ farAndra: true }}
      agenter={AGENTER}
      granser={GRANSER}
      {...over}
    />,
  );
  return { ...utils, onNavigate };
}

describe("adressen till en agents inställningar", () => {
  it("behåller övriga parametrar och ankaret, och en tom agent kastas", () => {
    expect(agentInstallningsHref("/agenter?grupp=g#kort", "ops")).toBe("/agenter?grupp=g&agent=ops&lage=installningar#kort");
    expect(agentIHref("/agenter?grupp=g")).toBe("");
    expect(agentIHref(agentInstallningsHref("/agenter", "ops"))).toBe("ops");
    expect(AGENTER_ID).toBe("agenter");
    expect(() => medAgent("/agenter", "")).toThrow(/agentId/);
    expect(() => medAgent("/agenter", "  ")).toThrow(/agentId/);
  });

  it("manifestet har ett kort och ingen samling, så Appar kan lista det", () => {
    const m = modul();
    expect(m.id).toBe("agenter");
    expect(m.samlingar).toEqual([]);
    expect(m.hubb?.rutt).toBe("/agenter");
    expect(m.installningar).toEqual([]);
    expect(m.kopplingar).toEqual([]);
    const rader = arkRader({ moduler: ["agenter"], huvudmeny: [] }, [m]);
    expect(rader.map((r) => r.id)).toEqual(["agenter"]);
  });
});

describe("OpsAgenter", () => {
  it("listan länkar till agentens inställningar, och en tom lista skrivs ut", () => {
    const { onNavigate, unmount } = rita();
    expect(screen.getByRole("heading", { name: "Agenter" })).toBeTruthy();
    const lank = screen.getByRole("link", { name: "Öppna inställningar för Ops" });
    expect(lank.getAttribute("href")).toBe("/agenter?agent=ops&lage=installningar");
    fireEvent.click(lank);
    expect(onNavigate).toHaveBeenCalledWith("/agenter?agent=ops&lage=installningar", expect.anything());
    expect(screen.getByText("Avstängd")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Skriv till Karta/ })).toBeNull();
    unmount();

    rita({ agenter: [] });
    expect(screen.getByText("Gruppen har ingen agent.")).toBeTruthy();
  });

  it("ett läsfel skrivs ut, och utan det är en tom lista noll", () => {
    const { unmount } = rita({ agenter: [], listfel: "Agenterna gick inte att läsa." });
    expect(screen.getByRole("alert").textContent).toBe("Agenterna gick inte att läsa.");
    expect(screen.queryByText("Gruppen har ingen agent.")).toBeNull();
    unmount();
    rita({ agenter: [], listfel: "" });
    expect(screen.getByText("Gruppen har ingen agent.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("utan lista och utan gränser kastas, så tomhet inte ser ut som noll", () => {
    expect(() => render(
      <OpsAgenter modul={modul()} activeHref="/agenter" hubHref="/hub" ram={{ farAndra: true }} agenter={/** @type {any} */ (undefined)} granser={GRANSER} />,
    )).toThrow(/agenter krävs/);
    expect(() => render(
      <OpsAgenter modul={modul()} activeHref="/agenter" hubHref="/hub" ram={{ farAndra: true }} agenter={[]} granser={/** @type {any} */ (undefined)} />,
    )).toThrow(/granser krävs/);
  });

  it("översikten är ett kort och fyra rader, och varje avsnitt sparar det appen redan äger", async () => {
    const onSparaIdentitet = vi.fn();
    const onSparaVerktyg = vi.fn();
    const onSparaInstruktioner = vi.fn();
    const onSparaSkill = vi.fn();
    const onSparaMinne = vi.fn();
    const onVaxla = vi.fn();
    const installning = {
      namn: "Ops",
      roll: "Assistent",
      beskrivning: "Hjälper gruppen",
      instruktioner: "Var kort.",
      minnePa: true,
      version: 1,
      nyckel: "super-secret",
    };
    const verktyg = [
      { namn: "webb", beskrivning: "Sök på webben", not: "Hämtar sidor.", pa: true },
      { namn: "raw_tool_id_xyz", beskrivning: "", pa: false },
    ];
    const falt = {
      installning,
      modell: { namn: "gemini-2.5-flash-lite", hint: "Appens modell." },
      byok: <p>Valvets nycklar</p>,
      verktyg,
      skills: [{ id: "s1", namn: "Kort", beskrivning: "Kort text", kalla: "kort.md", sha: "abc123" }],
      kanVaxla: true,
      onSparaIdentitet,
      onSparaVerktyg,
      onSparaInstruktioner,
      onSparaSkill,
      onSparaMinne,
      onVaxla,
    };
    const { onNavigate, unmount } = rita({
      activeHref: "/agenter?agent=ops&lage=installningar",
      ...falt,
    });
    expect(screen.getByRole("heading", { name: "Ops · Inställningar" })).toBeTruthy();
    expect(screen.getByText("Assistent")).toBeTruthy();
    expect(screen.getByText("gemini-2.5-flash-lite")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Om agenten/ }).getAttribute("href")).toBe("/agenter?agent=ops&lage=installningar&avsnitt=om");
    expect(screen.getByRole("link", { name: /Vad den kan/ }).getAttribute("href")).toContain("avsnitt=kan");
    expect(screen.getByRole("link", { name: /Kunskap och minne/ }).getAttribute("href")).toContain("avsnitt=kunskap");
    expect(screen.getByRole("link", { name: /Modell och nycklar/ }).getAttribute("href")).toContain("avsnitt=modell");
    expect(screen.queryByRole("heading", { name: "Om agenten" })).toBeNull();
    expect(screen.queryByText("Allmänt")).toBeNull();
    expect(screen.queryByText("Kopplingar")).toBeNull();
    expect(screen.queryByText("Egna inställningar")).toBeNull();
    expect(screen.queryByText("Valvets nycklar")).toBeNull();
    expect(screen.queryByText("Appen är installerad i gruppen.")).toBeNull();
    expect(screen.queryByRole("switch", { name: /Visa i huvudmenyn/ })).toBeNull();
    expect(screen.queryByText(/sparas inte en gång till/)).toBeNull();
    expect(document.body.textContent).not.toContain("super-secret");
    expect(document.body.textContent).not.toContain("raw_tool_id_xyz");
    expect(document.querySelector("input[type=password]")).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: /Agenten är på/ }));
    expect(onVaxla).toHaveBeenCalledWith({ id: "ops", status: "avstangd" });
    expect(screen.getByRole("status").textContent).toBe("Sparat.");

    fireEvent.click(screen.getByRole("link", { name: /Om agenten/ }));
    expect(onNavigate).toHaveBeenCalledWith("/agenter?agent=ops&lage=installningar&avsnitt=om", expect.anything());
    unmount();

    const om = rita({ activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=om", ...falt });
    fireEvent.change(screen.getByLabelText("Namn"), { target: { value: "Ops två" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(onSparaIdentitet).toHaveBeenCalledWith({ namn: "Ops två", beskrivning: "Hjälper gruppen", roll: "Assistent" });
    expect(screen.getByRole("status").textContent).toBe("Sparat.");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(om.onNavigate).toHaveBeenCalledWith("/agenter?agent=ops&lage=installningar", expect.anything());
    om.unmount();

    const kan = rita({ activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=kan", ...falt });
    expect(screen.getByRole("switch", { name: /Ett verktyg/ })).toBeTruthy();
    expect(screen.getByText("Vad det gör är inte beskrivet.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("raw_tool_id_xyz");
    fireEvent.click(screen.getByRole("switch", { name: /Sök på webben/ }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(onSparaVerktyg).toHaveBeenCalledWith({ webb: false, raw_tool_id_xyz: false });
    expect(screen.getByRole("status").textContent).toBe("Sparat.");
    kan.unmount();

    const kunskap = rita({ activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=kunskap", ...falt });
    expect(screen.queryByText("kort.md")).toBeNull();
    expect(screen.queryByText("abc123")).toBeNull();
    expect(screen.getByRole("switch", { name: /Använd den här kunskapen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Spara instruktioner" }));
    expect(onSparaInstruktioner).toHaveBeenCalledWith("Var kort.");
    expect(screen.getByRole("status").textContent).toBe("Sparat.");
    fireEvent.change(screen.getByLabelText("Namn"), { target: { value: "Karta" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara kunskap" }));
    expect(onSparaSkill).toHaveBeenCalledWith(expect.objectContaining({ namn: "Karta", aktiv: true, alltidMed: false, publik: false }));
    fireEvent.change(screen.getByLabelText("Ny minnesrad"), { target: { value: "Gillar korta svar" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara minne" }));
    await waitFor(() => expect(onSparaMinne).toHaveBeenCalledWith("Gillar korta svar"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Sparat."));
    kunskap.unmount();

    rita({ activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=modell", ...falt });
    expect(screen.getByText("Valvets nycklar")).toBeTruthy();
    expect(screen.getByText("Modellen väljs av appen. Den ändras inte här.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(document.body.textContent).not.toContain("super-secret");
  });

  it("en okänd avsnittsparameter är översikten, och utan sparfunktion står felet", () => {
    const { unmount } = rita({
      activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=hemligt",
      installning: { namn: "Ops", roll: "Assistent", beskrivning: "Hjälper" },
    });
    expect(screen.getByRole("link", { name: /Om agenten/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Om agenten" })).toBeNull();
    unmount();

    rita({
      activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=om",
      installning: { namn: "Ops", roll: "", beskrivning: "", instruktioner: "", minnePa: false },
    });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Sparandet är inte kopplat/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("en medlem läser kortet utan att kunna skriva", () => {
    const { unmount } = rita({
      activeHref: "/agenter?agent=ops&lage=installningar",
      ram: { farAndra: false },
      installning: { namn: "Ops", roll: "Assistent", beskrivning: "Hjälper", instruktioner: "Var kort.", minnePa: true },
      verktyg: [{ namn: "webb", beskrivning: "Sök på webben", pa: false }],
    });
    expect(screen.getByText("Skrivskyddad")).toBeTruthy();
    expect(screen.getByText("Assistent")).toBeTruthy();
    expect(screen.queryByText("Ingen roll.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.getByRole("link", { name: "Klar" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Inställningar" })).toBeNull();
    unmount();

    rita({
      activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=kan",
      ram: { farAndra: false },
      installning: { namn: "Ops", roll: "Assistent" },
      verktyg: [{ namn: "sok_webb_id", beskrivning: "Sök på webben", pa: false }],
    });
    expect(screen.getByText("Sök på webben: Avstängd")).toBeTruthy();
    expect(document.body.textContent).not.toContain("sok_webb_id");
  });

  it("tom roll skrivs ut på kortet, och beskrivningen först i sitt avsnitt", () => {
    const { unmount } = rita({
      activeHref: "/agenter?agent=ops&lage=installningar",
      ram: { farAndra: false },
      installning: { namn: "Ops", roll: "", beskrivning: "" },
    });
    expect(screen.getByText("Ingen roll.")).toBeTruthy();
    expect(screen.queryByText("Ingen beskrivning.")).toBeNull();
    unmount();

    const om = rita({
      activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=om",
      ram: { farAndra: false },
      installning: { namn: "Ops", roll: "", beskrivning: "" },
    });
    expect(screen.getByText("Ingen beskrivning.")).toBeTruthy();
    om.unmount();

    rita({ activeHref: "/agenter?lage=installningar", modell: null, byok: null });
    expect(screen.getByText("Inställningarna gäller en agent i taget.")).toBeTruthy();
    expect(document.querySelector("[data-agent-val=karta]")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Om agenten/ })).toBeNull();
  });

  it("en agent som inte hör hit, en saknad modell och ett saknat valv skrivs ut", () => {
    const { unmount } = rita({ activeHref: "/agenter?agent=annan&lage=installningar" });
    expect(screen.getByText("Agenten hör inte till gruppen.")).toBeTruthy();
    unmount();
    const kort = rita({
      activeHref: "/agenter?agent=ops&lage=installningar",
      ram: { farAndra: false },
      installning: { namn: "Ops" },
      modell: null,
      byok: null,
    });
    expect(screen.getByText("Ingen modell angiven.")).toBeTruthy();
    expect(screen.queryByText("Nycklarna är inte kopplade i appen.")).toBeNull();
    kort.unmount();
    rita({
      activeHref: "/agenter?agent=ops&lage=installningar&avsnitt=modell",
      ram: { farAndra: false },
      installning: { namn: "Ops" },
      modell: null,
      byok: null,
    });
    expect(screen.getByText("Nycklarna är inte kopplade i appen.")).toBeTruthy();
  });

  it("Appar visar modulen när gruppen har den", () => {
    render(
      <OpsApparArk
        oppen
        onOppen={() => {}}
        moduler={[modul()]}
        grupp={{ moduler: ["agenter"] }}
        farAndra={false}
        allaHref="/hub"
      />,
    );
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Agenter" }).getAttribute("href")).toBe("/agenter");
  });
});

describe("gruppvyn länkar, och formuläret har inga agentfält", () => {
  const G = { id: "g1", namn: { sv: "Gruppen" }, roll: /** @type {const} */ ("agare") };
  const AKTIV = [{ id: "agent_g1", namn: "Agent", status: /** @type {const} */ ("aktiv") }];

  it("med agenterHref är länken där och strömbrytaren borta, och utan den är det tvärtom", () => {
    const onVaxlaAgent = vi.fn();
    const onSkrivTillAgent = vi.fn();
    const { unmount } = render(
      <OpsGruppSida grupp={G} agenter={AKTIV} agenterHref="/agenter" onVaxlaAgent={onVaxlaAgent} onSkrivTillAgent={onSkrivTillAgent} />,
    );
    expect(screen.getByRole("link", { name: "Agenter" }).getAttribute("href")).toBe("/agenter");
    expect(document.querySelector("[data-agenter-lank]")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: /Agenten är på/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Skriv till Agent/ }));
    expect(onSkrivTillAgent).toHaveBeenCalledWith("agent_g1");
    unmount();

    render(<OpsGruppSida grupp={G} agenter={AKTIV} onVaxlaAgent={onVaxlaAgent} />);
    expect(screen.getByRole("switch", { name: /Agenten är på/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Agenter" })).toBeNull();
    expect(() => render(<OpsGruppSida grupp={G} agenterHref="" />)).toThrow(/agenterHref/);
  });

  it("redigera grupp länkar till Agenter och har varken roll eller modell", () => {
    render(
      <OpsGruppFormular
        formId="f"
        grupp={{ id: "g1", namn: { sv: "Gruppen", en: "Gruppen" }, moduler: ["agenter"] }}
        onSpara={vi.fn(async () => {})}
        moduler={{
          valbara: [modul()],
          agare: true,
          installningarHref: (m) => `/${m.id}?lage=installningar`,
        }}
      />,
    );
    const lank = screen.getByRole("link", { name: "Inställningar" });
    expect(lank.getAttribute("data-modul-installningar")).toBe("agenter");
    expect(lank.getAttribute("href")).toBe("/agenter?lage=installningar");
    expect(screen.queryByLabelText("Roll")).toBeNull();
    expect(screen.queryByText("Modell")).toBeNull();
  });
});

describe("chatten öppnar agentens inställningar", () => {
  const MED = [
    { userId: "anna", namn: "Anna", typ: "person", status: "aktiv" },
    { userId: "cecilia", namn: "Cecilia", typ: "person", status: "aktiv" },
    { userId: "ops", namn: "Ops", typ: "agent", status: "aktiv" },
  ];

  async function agentSamtal() {
    const samtal = createSamtalskalla({ kalla: createMemorySource({}) });
    const a = await samtal.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
    return { samtal, a };
  }

  async function trad() {
    let t = Date.now() - 600000;
    const samtal = createSamtalskalla({ kalla: createMemorySource({}), tradar: "tradar", klocka: () => (t += 1000) });
    const g = await samtal.oppnaGrupp({ groupId: "g", uid: "anna" });
    const rot = await samtal.skicka(g.id, { text: "Budgeten för Q3, hur ser den ut?", av: "cecilia" });
    await samtal.skickaITrad(g.id, rot.id, { text: "Marginalen är 5,6 procent.", av: "ops" });
    return { samtal, g, rot };
  }

  it("namn och ikon i agentsamtalet är en knapp, och utan återanrop är huvudet text", async () => {
    const { samtal, a } = await agentSamtal();
    const onVisaAgent = vi.fn();
    const { unmount } = render(
      <OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MED} valt={a.id} onVisaAgent={onVisaAgent} />,
    );
    const knapp = await screen.findByRole("button", { name: /Ops, öppna inställningar/ });
    expect(knapp.getAttribute("data-visa-agent")).toBe("ops");
    fireEvent.click(knapp);
    expect(onVisaAgent).toHaveBeenCalledWith({ id: "ops", namn: "Ops" });
    unmount();

    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MED} valt={a.id} />);
    expect(await screen.findByRole("heading", { level: 3, name: "Ops" })).toBeTruthy();
    expect(document.querySelector("[data-visa-agent]")).toBeNull();
    expect(screen.queryByRole("button", { name: /öppna inställningar/ })).toBeNull();
  });

  it("agentens avatar i en tråd öppnar inställningarna, och en persons avatar gör det inte", async () => {
    const { samtal, g, rot } = await trad();
    const onVisaAgent = vi.fn();
    const { unmount } = render(
      <OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MED} valt={g.id} valtTrad={rot.id} onVisaAgent={onVisaAgent} />,
    );
    expect(await screen.findByText("Marginalen är 5,6 procent.")).toBeTruthy();
    const knapp = screen.getByRole("button", { name: /Ops, öppna inställningar/ });
    expect(knapp.getAttribute("data-visa-agent")).toBe("ops");
    fireEvent.click(knapp);
    expect(onVisaAgent).toHaveBeenCalledWith({ id: "ops", namn: "Ops" });
    expect(document.querySelector('[data-visa-agent="cecilia"]')).toBeNull();
    unmount();

    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MED} valt={g.id} valtTrad={rot.id} />);
    expect(await screen.findByText("Marginalen är 5,6 procent.")).toBeTruthy();
    expect(document.querySelector("[data-visa-agent]")).toBeNull();
    expect(document.querySelectorAll("svg").length).toBeGreaterThan(0);
  });
});
