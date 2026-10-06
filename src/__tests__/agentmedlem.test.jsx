import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemorySource } from "../data/adapters.js";
import { createGroupService } from "../node/grupp.js";
import { createAgentService } from "../node/agent.js";
import { AGENT_NAMN, agentId, agentMedlemskap, byggMedlemskap, medlemskapsId, MEDLEMSSTATUS } from "../lib/grupp.js";
import { medlemsinfo } from "../lib/gruppmedlemmar.js";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";
import { OpsMedlemmar } from "../components/OpsMedlemmar.jsx";
import { OpsMottagare } from "../components/OpsMottagare.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";

/**
 * Agenten är medlem i varje grupp (cllp/lifehub.app#47, skiva 1 och 2, ramverkets del).
 *
 * Beslutet: ett medlemskap med `typ: "agent"`, roll `medlem`, status `aktiv`, stabilt id `agent_<groupId>`, namnet "Agent".
 * Klienten skriver aldrig medlemskap (#136). Ägaren kan stänga av agenten (status `avstangd`), ingen kan ta bort den i listan.
 */

const UID = "uid-agare";

describe("agentens medlemskap är härlett, aldrig handskrivet", () => {
  it("id:t är agent_<groupId> och raden är en aktiv medlem av typen agent", () => {
    expect(agentId("g1")).toBe("agent_g1");
    expect(AGENT_NAMN).toBe("Agent");
    expect(agentMedlemskap("g1")).toEqual({
      id: medlemskapsId("agent_g1", "g1"),
      userId: "agent_g1",
      groupId: "g1",
      roll: "medlem",
      typ: "agent",
      status: "aktiv",
      namn: "Agent",
      bild: "",
    });
  });

  it("⛔ utan groupId finns ingen agent", () => {
    expect(() => agentId("")).toThrow(/groupId/);
  });

  it("⛔ avstangd finns, men bara för en agent: en person avslutas, den stängs inte av", () => {
    expect(MEDLEMSSTATUS).toContain("avstangd");
    expect(byggMedlemskap({ userId: "agent_g1", groupId: "g1", roll: "medlem", typ: "agent", status: "avstangd" }).status).toBe("avstangd");
    expect(() => byggMedlemskap({ userId: "p", groupId: "g1", roll: "medlem", typ: "person", status: "avstangd" })).toThrow(/avstangd.*agent/);
  });
});

describe("createGroupService({ agent: true }) skriver agenten i samma batch som gruppen", () => {
  const bygg = (/** @type {any} */ konfig = {}) => {
    const kalla = createMemorySource({ memberships: [], groups: [], users: [], invitations: [], vitlista: [] });
    const batch = vi.spyOn(kalla, "batch");
    return { kalla, batch, tjanst: createGroupService({ kalla, vitlistaKravs: false, ...konfig }) };
  };

  it("en ny grupp har agenten som medlem, i samma batch som gruppen och ägaren", async () => {
    const { kalla, batch, tjanst } = bygg({ agent: true });
    const { groupId } = await tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Mitt bolag" } });
    expect(batch).toHaveBeenCalledTimes(1);
    const ops = batch.mock.calls[0][0];
    expect(ops.map((o) => `${o.collection}:${o.data.id}`)).toEqual([`groups:${groupId}`, `memberships:${UID}|${groupId}`, `memberships:agent_${groupId}|${groupId}`]);
    expect(await kalla.read("memberships", medlemskapsId(agentId(groupId), groupId))).toMatchObject({ typ: "agent", roll: "medlem", status: "aktiv", namn: "Agent" });
  });

  it("utan agent: ingen agent, som förut", async () => {
    const { kalla, tjanst } = bygg();
    const { groupId } = await tjanst.skapaGrupp({ uid: UID, epost: "", grupp: { namn: "Mitt bolag" } });
    expect((await kalla.list("memberships")).map((m) => m.userId)).toEqual([UID]);
    expect(groupId).toBeTruthy();
  });

  it("⛔ agent måste vara true eller false", () => {
    expect(() => bygg({ agent: "ja" })).toThrow(/agent måste vara true eller false/);
  });
});

describe("createAgentService: ägarens strömbrytare och engångssteget", () => {
  const bygg = (/** @type {any[]} */ medlemskap) => {
    const kalla = createMemorySource({ memberships: medlemskap.map((m) => ({ ...m, id: medlemskapsId(m.userId, m.groupId) })) });
    return { kalla, tjanst: createAgentService({ kalla }) };
  };
  const AGARE = { userId: UID, groupId: "g1", roll: "agare", typ: "person", status: "aktiv", namn: "Ägaren", bild: "" };
  const MEDLEM = { userId: "uid-medlem", groupId: "g1", roll: "medlem", typ: "person", status: "aktiv", namn: "Medlem", bild: "" };
  const ADMIN = { userId: "uid-admin", groupId: "g1", roll: "admin", typ: "person", status: "aktiv", namn: "Admin", bild: "" };

  it("ägaren stänger av agenten och slår på den igen", async () => {
    const { kalla, tjanst } = bygg([AGARE, agentMedlemskap("g1")]);
    expect(await tjanst.satStatus({ uid: UID, groupId: "g1", status: "avstangd" })).toEqual({ status: "avstangd" });
    expect((await kalla.read("memberships", "agent_g1|g1")).status).toBe("avstangd");
    await tjanst.satStatus({ uid: UID, groupId: "g1", status: "aktiv" });
    expect((await kalla.read("memberships", "agent_g1|g1")).status).toBe("aktiv");
  });

  it("⛔ en admin eller en medlem får inte, och inget skrivs", async () => {
    const { kalla, tjanst } = bygg([AGARE, ADMIN, MEDLEM, agentMedlemskap("g1")]);
    await expect(tjanst.satStatus({ uid: "uid-admin", groupId: "g1", status: "avstangd" })).rejects.toThrow(/bara ägaren/);
    await expect(tjanst.satStatus({ uid: "uid-medlem", groupId: "g1", status: "avstangd" })).rejects.toThrow(/bara ägaren/);
    expect((await kalla.read("memberships", "agent_g1|g1")).status).toBe("aktiv");
  });

  it("⛔ ingen annan status än aktiv och avstangd: agenten tas inte bort härifrån", async () => {
    const { tjanst } = bygg([AGARE, agentMedlemskap("g1")]);
    await expect(tjanst.satStatus({ uid: UID, groupId: "g1", status: "avslutad" })).rejects.toThrow(/aktiv eller avstangd/);
  });

  it("⛔ en grupp utan agent: felet säger det, inget skapas i smyg", async () => {
    const { kalla, tjanst } = bygg([AGARE]);
    await expect(tjanst.satStatus({ uid: UID, groupId: "g1", status: "avstangd" })).rejects.toThrow(/har ingen agent/);
    expect(await kalla.read("memberships", "agent_g1|g1")).toBeNull();
  });

  it("sakerstall: torrt skriver inget, skarpt lägger till där den saknas, och en grupp som har den rörs inte", async () => {
    const avstangd = { ...agentMedlemskap("g2"), status: "avstangd" };
    const { kalla, tjanst } = bygg([AGARE, { ...AGARE, groupId: "g2" }, avstangd]);
    expect(await tjanst.sakerstall({ groupId: "g1", skarpt: false })).toBe("saknas");
    expect(await kalla.read("memberships", "agent_g1|g1")).toBeNull();
    expect(await tjanst.sakerstall({ groupId: "g1", skarpt: true })).toBe("skapad");
    expect(await kalla.read("memberships", "agent_g1|g1")).toMatchObject({ typ: "agent", status: "aktiv" });
    expect(await tjanst.sakerstall({ groupId: "g1", skarpt: true })).toBe("finns");
    // ⛔ En avstängd agent är ägarens val, och engångssteget slår inte på den igen.
    expect(await tjanst.sakerstall({ groupId: "g2", skarpt: true })).toBe("finns");
    expect((await kalla.read("memberships", "agent_g2|g2")).status).toBe("avstangd");
  });
});

const RAD = (/** @type {string} */ userId, /** @type {string} */ roll, /** @type {any} */ extra = {}) => ({ userId, groupId: "g1", roll, typ: "person", status: "aktiv", namn: userId, bild: "", ...extra });

describe("medlemsinfo: agenten står för sig, personerna räknas som förut", () => {
  it("agenten är inte en av personerna i antalet och avatarerna, men står i agenter, också avstängd", () => {
    const info = medlemsinfo([RAD("Ann", "agare"), RAD("Bo", "medlem"), { ...agentMedlemskap("g1"), status: "avstangd" }]);
    expect(info.medlemsantal).toBe(2);
    expect(info.medlemmar.map((m) => m.id)).toEqual(["Ann", "Bo"]);
    expect(info.avatarer.map((a) => a.id)).toEqual(["Ann", "Bo"]);
    expect(info.agenter).toEqual([{ id: "agent_g1", namn: "Agent", status: "avstangd" }]);
  });

  it("tomhet är ett svar: agenter är en tom lista, aldrig utelämnad", () => {
    expect(medlemsinfo([RAD("Ann", "agare")]).agenter).toEqual([]);
  });
});

describe("OpsGruppSida: agenten i medlemslistan", () => {
  const G = { id: "g1", namn: { sv: "Gruppen" }, roll: /** @type {const} */ ("agare") };
  const MEDLEMMAR = [{ id: "Ann", namn: "Ann", bild: "", roll: /** @type {const} */ ("agare") }];
  const AKTIV = [{ id: "agent_g1", namn: "Agent", status: /** @type {const} */ ("aktiv") }];

  it("agenten står med märket AI, och räknas i rubrikens antal", () => {
    render(<OpsGruppSida grupp={G} medlemmar={MEDLEMMAR} agenter={AKTIV} />);
    const rad = screen.getByText("Agent").closest("[data-agentrad]");
    expect(rad).not.toBeNull();
    expect(within(/** @type {HTMLElement} */ (rad)).getByText("AI")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Medlemmar \(2\)/ })).toBeTruthy();
  });

  it("ägaren stänger av agenten med en strömbrytare, och ingen knapp tar bort den", () => {
    const onVaxlaAgent = vi.fn();
    render(<OpsGruppSida grupp={G} medlemmar={MEDLEMMAR} agenter={AKTIV} onVaxlaAgent={onVaxlaAgent} />);
    const brytare = screen.getByRole("switch", { name: /Agenten är på/ });
    expect(/** @type {HTMLInputElement} */ (brytare).checked).toBe(true);
    fireEvent.click(brytare);
    expect(onVaxlaAgent).toHaveBeenCalledWith({ userId: "agent_g1", status: "avstangd" });
    expect(screen.queryByRole("button", { name: /Ta bort/ })).toBeNull();
  });

  it("⛔ en admin och en medlem ser ingen strömbrytare", () => {
    for (const roll of /** @type {const} */ (["admin", "medlem"])) {
      const { unmount } = render(<OpsGruppSida grupp={{ ...G, roll }} medlemmar={MEDLEMMAR} agenter={AKTIV} onVaxlaAgent={() => {}} />);
      expect(screen.queryByRole("switch")).toBeNull();
      unmount();
    }
  });

  it("en avstängd agent säger det, och går inte att skriva till", () => {
    render(<OpsGruppSida grupp={{ ...G, roll: "medlem" }} medlemmar={MEDLEMMAR} agenter={[{ ...AKTIV[0], status: "avstangd" }]} onSkrivTillAgent={() => {}} />);
    expect(screen.getByText("Avstängd")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Skriv till Agent/ })).toBeNull();
  });

  it("vem som helst i gruppen startar ett privat samtal med agenten från listan", () => {
    const onSkrivTillAgent = vi.fn();
    render(<OpsGruppSida grupp={{ ...G, roll: "medlem" }} medlemmar={MEDLEMMAR} agenter={AKTIV} onSkrivTillAgent={onSkrivTillAgent} />);
    fireEvent.click(screen.getByRole("button", { name: "Skriv till Agent" }));
    expect(onSkrivTillAgent).toHaveBeenCalledWith("agent_g1");
  });
});

describe("OpsMedlemmar: agenten har varken roll att ändra eller en Ta bort", () => {
  it("märket AI, ingen rollväljare och ingen Ta bort, också för ägaren", () => {
    const person = byggMedlemskap({ userId: "uid-b", groupId: "g1", roll: "medlem", typ: "person", namn: "Bo" });
    render(
      <OpsMedlemmar
        medlemmar={[{ medlemskap: person }, { medlemskap: agentMedlemskap("g1") }]}
        migUid={UID}
        kanAndra
        onAndraRoll={() => {}}
        onTaBort={() => {}}
      />,
    );
    expect(screen.getByText("AI")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Ta bort" })).toHaveLength(1);
    expect(screen.queryByLabelText(/Roll, Agent/)).toBeNull();
  });
});

describe("Nytt meddelande: agenten går att välja, som en person", () => {
  const medlemskap = () => [RAD(UID, "agare", { namn: "Ägaren" }), RAD("uid-b", "medlem", { namn: "Bo" }), agentMedlemskap("g1")];

  it("OpsMottagare i personläget har agenten, men inte en avstängd agent", () => {
    const MEDLEMSKAP = medlemskap();
    const { rerender } = render(<OpsMottagare lage="person" medlemmar={MEDLEMSKAP} uid={UID} value={null} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Agent" })).toBeTruthy();
    rerender(<OpsMottagare lage="person" medlemmar={[MEDLEMSKAP[0], MEDLEMSKAP[1], { ...agentMedlemskap("g1"), status: "avstangd" }]} uid={UID} value={null} onChange={() => {}} />);
    expect(screen.queryByRole("radio", { name: "Agent" })).toBeNull();
  });

  // 0.63.0 (#263): läget "nytt" i Meddelanden, inte längre en panel. Valet öppnar samtalet direkt, och texten skrivs i tråden.
  it("med agenten vald öppnas ett agentsamtal, och raden säger vem som ser det", async () => {
    const id = "g1|agent_g1|uid-agare";
    const samtal = { id, groupId: "g1", slag: "agent", deltagare: ["agent_g1", "uid-agare"], skapad: 1, skapadAv: UID };
    const kalla = {
      oversikt: vi.fn(async () => []),
      oppnaPrivat: vi.fn(async () => samtal),
      meddelanden: vi.fn(async () => []),
      prenumerera: () => null,
      markeraLast: vi.fn(async () => {}),
      skicka: vi.fn(async (_sid, { text, av }) => ({ id: "m1", text, av, tid: 2 })),
    };
    const onValj = vi.fn();
    render(<OpsMeddelanden kalla={/** @type {any} */ (kalla)} uid={UID} groupId="g1" gruppNamn="G" medlemmar={medlemskap()} nytt onValj={onValj} />);
    expect(screen.getByText("Bara ni två ser det här")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Agent" }));
    expect(screen.getByText("Bara du och agenten ser det här")).toBeTruthy();
    await waitFor(() => expect(onValj).toHaveBeenCalledWith(id, undefined));
    expect(kalla.oppnaPrivat).toHaveBeenCalledWith({ groupId: "g1", uid: UID, annan: "agent_g1", slag: "agent" });
  });
});
