import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { MAX_ALTERNATIV, OMROSTNINGSROSTTAK, OMROSTNINGSVALTAK } from "../lib/samtal.js";
import { levandeKalla } from "./levandeKalla.js";

/**
 * Omröstning skiva 2 (cllp/lifehub.app#742): alternativ och röster läses PER OMRÖSTNING, inte som de 500 senaste i hela samtalet.
 *
 * Fyndet i granskningen av PR 566: med en lyssnare per samling och samtal fyllde ungefär 25 omröstningar i en grupp med 20 personer rösternas
 * fönster, och de äldsta omröstningarna visade fel antal eller "Inga alternativ än.". "Lägg till alternativ" prövade då taket och dubbletten
 * mot en ofullständig lista, och en medlem som skrev hundratals alternativ i en omröstning tryckte ut alla andras.
 *
 * ⛔ PROVEN SKRIVER MED KÄLLAN OCH LÄSER MED VYN, så att det som mäts är vad en person ser, inte hur frågan ser ut.
 */

/** Tjugo röstande, inga av dem i medlemslistan: namnet spelar ingen roll här, bara antalet. */
const ROSTANDE = Array.from({ length: 20 }, (_, i) => `p${String(i).padStart(2, "0")}`);
const MEDLEMMAR = [{ userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" }];

/** @param {any} kalla */
async function underlag(kalla) {
  let t = Date.now() - 10_000_000;
  const s = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 10), omrostningsval: "omrostningsval", omrostningsroster: "omrostningsroster" }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  return { s, g };
}

/**
 * Alternativen till en omröstning, lästa direkt ur samlingen (inte genom källans läsning, så att provet går att köra mot vilken form den har).
 * @param {any} kalla @param {string} sid @param {string} mid
 */
async function alternativFor(kalla, sid, mid) {
  const rader = await kalla.list(`samtal/${sid}/omrostningsval`);
  return rader.filter((/** @type {any} */ r) => r.mid === mid).sort((/** @type {any} */ a, /** @type {any} */ b) => a.tid - b.tid);
}

/** @param {string} mid @returns {Promise<HTMLElement>} */
const hittaKort = (mid) =>
  waitFor(() => {
    const k = document.querySelector(`[data-omrostning="${mid}"]`);
    if (!(k instanceof HTMLElement)) throw new Error("inget kort än");
    return k;
  });

describe("omröstning skiva 2 (lifehub.app#742)", () => {
  it("⛔ 30 omröstningar med 20 röster var i samma samtal: varje kort visar sina 20, också den äldsta", async () => {
    const kalla = levandeKalla();
    const { s, g } = await underlag(kalla);
    /** @type {string[]} */
    const mids = [];
    for (let i = 0; i < 30; i += 1) {
      const m = await s.skickaOmrostning(g.id, { fraga: `Fråga ${i + 1}?`, alternativ: ["Fredag", "Lördag"], av: "anna" });
      const [fre] = await alternativFor(kalla, g.id, m.id);
      for (const u of ROSTANDE) await s.rosta(g.id, { mid: m.id, val: fre.id, av: u });
      mids.push(m.id);
    }
    // 600 röster i samtalet: mer än de 500 som skiva 1 läste för hela samtalet.
    expect((await kalla.list(`samtal/${g.id}/omrostningsroster`)).length).toBe(600);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    let provade = 0;
    for (const mid of mids) {
      const kort = await hittaKort(mid);
      await within(kort).findByRole("button", { name: "Fredag, 20 röster" });
      expect(within(kort).getByRole("button", { name: "Lördag, 0 röster" })).toBeTruthy();
      expect(/** @type {HTMLElement} */ (kort.querySelector("[data-omrostning-antal]")).textContent).toBe("20 har röstat");
      expect(kort.querySelector("[data-omrostning-fler]")).toBeNull();
      provade += 1;
    }
    // Golv: alla trettio kort mättes, inte bara de som råkade ritas.
    expect(provade).toBe(30);
  }, 30_000);

  it("⛔ en omröstning med hundratals alternativ (förbi byggaren) trycker inte ut en annan, säger själv att alla inte visas, och tar inga fler", async () => {
    const kalla = levandeKalla();
    const { s, g } = await underlag(kalla);
    const a = await s.skickaOmrostning(g.id, { fraga: "Vilken dag?", alternativ: ["Fredag", "Lördag"], av: "anna" });
    const b = await s.skickaOmrostning(g.id, { fraga: "Vilken mat?", alternativ: ["Soppa", "Sallad"], av: "anna" });
    // En klient förbi byggaren: reglerna kan inte räkna, så 500 alternativ i omröstning B går att skriva.
    for (let i = 0; i < 500; i += 1) await kalla.create(`samtal/${g.id}/omrostningsval`, { id: `${b.id}|x${i}`, mid: b.id, text: `Rätt ${i}`, av: "bo", tid: b.tid + 100 + i });
    const laggTillAlternativ = vi.fn(s.laggTillAlternativ);
    render(<OpsMeddelanden kalla={{ ...s, laggTillAlternativ }} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);

    const kortA = await hittaKort(a.id);
    await within(kortA).findByRole("button", { name: "Fredag, 0 röster" });
    expect(within(kortA).getByRole("button", { name: "Lördag, 0 röster" })).toBeTruthy();
    expect(kortA.querySelector("[data-omrostning-tom]")).toBeNull();
    expect(kortA.querySelector("[data-omrostning-fler]")).toBeNull();

    const kortB = await hittaKort(b.id);
    await waitFor(() => expect(kortB.querySelectorAll("[data-omrostningsval]").length).toBe(MAX_ALTERNATIV));
    const fler = /** @type {HTMLElement} */ (kortB.querySelector("[data-omrostning-fler]"));
    expect(fler).toBeTruthy();
    expect(fler.getAttribute("role")).toBe("status");
    expect(fler.textContent).toBe("Alla röster och alternativ i omröstningen visas inte.");
    // Taket är nått och listan är inte hel: inget fält att pröva ett nytt alternativ mot fel underlag.
    expect(within(kortB).queryByRole("button", { name: "Lägg till alternativ" })).toBeNull();

    // Kort A:s underlag för dubbletten är A:s egna alternativ, inte det som råkade rymmas i samtalets fönster.
    fireEvent.click(within(kortA).getByRole("button", { name: "Lägg till alternativ" }));
    const falt = within(kortA).getByLabelText("Nytt alternativ");
    fireEvent.change(falt, { target: { value: "fredag" } });
    fireEvent.submit(falt.closest("form") ?? falt);
    expect((await within(kortA).findByRole("alert")).textContent).toBe("Alternativet finns redan.");
    expect(laggTillAlternativ).not.toHaveBeenCalled();
    fireEvent.change(falt, { target: { value: "Söndag" } });
    fireEvent.submit(falt.closest("form") ?? falt);
    await waitFor(() => expect(laggTillAlternativ).toHaveBeenCalledWith(g.id, { mid: a.id, text: "Söndag", av: "anna", befintliga: ["Fredag", "Lördag"] }));
    await within(kortA).findByRole("button", { name: "Söndag, 0 röster" });
  }, 30_000);

  it("⛔ källan läser per omröstning: likhet på mid och ett tak per omröstning, utan sortering (alltså inget sammansatt index)", async () => {
    const bas = createMemorySource({});
    /** @type {any[]} */
    const fragor = [];
    const kalla = {
      ...bas,
      list: (/** @type {string} */ c, /** @type {any} */ q) => (fragor.push(["list", c, q]), bas.list(c, q)),
      subscribe: (/** @type {string} */ c, /** @type {any} */ q, /** @type {any} */ l) => (fragor.push(["subscribe", c, q]), bas.list(c, q).then(l.onData), () => {}),
    };
    const { s, g } = await underlag(kalla);
    const a = await s.skickaOmrostning(g.id, { fraga: "Dag?", alternativ: ["Fredag", "Lördag"], av: "anna" });
    const b = await s.skickaOmrostning(g.id, { fraga: "Mat?", alternativ: ["Soppa", "Sallad", "Pasta"], av: "anna" });
    fragor.length = 0;

    const valA = await s.lasOmrostningsval(g.id, a.id);
    expect(valA.rader.map((/** @type {any} */ r) => r.text).sort()).toEqual(["Fredag", "Lördag"]);
    expect(valA.fler).toBe(false);
    expect((await s.lasOmrostningsval(g.id, b.id)).rader).toHaveLength(3);
    await s.rosta(g.id, { mid: a.id, val: valA.rader[0].id, av: "bo" });
    const rosterA = await s.lasOmrostningsroster(g.id, a.id);
    expect(rosterA.rader.map((/** @type {any} */ r) => r.av)).toEqual(["bo"]);
    expect((await s.lasOmrostningsroster(g.id, b.id)).rader).toHaveLength(0);

    /** @type {any[]} */
    const svar = [];
    s.prenumereraOmrostningsval(g.id, b.id, { onData: (/** @type {any} */ x) => svar.push(x), onError: () => {} });
    s.prenumereraOmrostningsroster(g.id, b.id, { onData: (/** @type {any} */ x) => svar.push(x), onError: () => {} });
    await waitFor(() => expect(svar).toHaveLength(2));
    // ⛔ Ett tak per omröstning, läst med en rad extra så att "fler" betyder att fler FINNS, inte att taket råkade nås.
    const valfraga = { where: { mid: a.id }, limit: OMROSTNINGSVALTAK + 1 };
    const rostfraga = { where: { mid: a.id }, limit: OMROSTNINGSROSTTAK + 1 };
    expect(fragor).toEqual([
      ["list", `samtal/${g.id}/omrostningsval`, valfraga],
      ["list", `samtal/${g.id}/omrostningsval`, { ...valfraga, where: { mid: b.id } }],
      ["list", `samtal/${g.id}/omrostningsroster`, rostfraga],
      ["list", `samtal/${g.id}/omrostningsroster`, { ...rostfraga, where: { mid: b.id } }],
      ["subscribe", `samtal/${g.id}/omrostningsval`, { ...valfraga, where: { mid: b.id } }],
      ["subscribe", `samtal/${g.id}/omrostningsroster`, { ...rostfraga, where: { mid: b.id } }],
    ]);
    for (const [, , q] of fragor) expect(q.sortBy).toBeUndefined();
    expect(OMROSTNINGSVALTAK).toBe(MAX_ALTERNATIV);
    expect(() => s.lasOmrostningsval(g.id)).toThrow(/mid/);
  });

  it("⛔ fler är exakt: taket fullt är inte fler, en rad över taket är det, och då visas taket och inte raden över", async () => {
    const kalla = createMemorySource({});
    const { s, g } = await underlag(kalla);
    const m = await s.skickaOmrostning(g.id, { fraga: "Dag?", alternativ: ["a", "b"], av: "anna" });
    for (let i = 2; i < OMROSTNINGSVALTAK; i += 1) await kalla.create(`samtal/${g.id}/omrostningsval`, { id: `${m.id}|y${i}`, mid: m.id, text: `y${i}`, av: "bo", tid: m.tid + 100 + i });
    const fullt = await s.lasOmrostningsval(g.id, m.id);
    expect(fullt.rader).toHaveLength(OMROSTNINGSVALTAK);
    expect(fullt.fler).toBe(false);
    await kalla.create(`samtal/${g.id}/omrostningsval`, { id: `${m.id}|over`, mid: m.id, text: "over", av: "bo", tid: m.tid + 999 });
    const over = await s.lasOmrostningsval(g.id, m.id);
    expect(over.rader).toHaveLength(OMROSTNINGSVALTAK);
    expect(over.fler).toBe(true);
  });
});
