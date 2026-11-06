import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsGastChatt } from "../components/OpsGastChatt.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { bibliotekPostkort } from "../components/bibliotekPostkort.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createPostkommentarer } from "../data/postkommentarer.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { byggPost } from "../lib/bibliotek.js";
import { bibliotekslank } from "../lib/postkommentar.js";
import { samtalsnyckel } from "../lib/samtal.js";

/**
 * Kommentarer på en post i vyerna (0.191.0, cllp/lifehub.app#663): kortet i chatten ur länken, Kommentera och tråden i biblioteket, och gästens trådar och kort.
 *
 * ⛔ HÄR MÄTS BETEENDE I JSDOM. Hur tråden SER UT på 390 och 1280 mäts i Chromium av `check:skalyta` (avsnitt om kommentarerna).
 */

const BAS = "https://app.exempel.se/bibliotek";
const GRUPP = "kallan";
const tid = 1_700_000_000_000;
const skapare = { uid: "anna", namn: "Anna Ek", typ: "manniska", kalla: "bibliotek" };
const ANTECKNING = { ...byggPost({ groupId: GRUPP, skapadAv: skapare, skapad: tid, andrad: tid, typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade" }), id: "a1" };
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

describe("⛔ kortet ritas från länken, ur posten som den är nu", () => {
  it("en länk till en post blir ett kort med postens rubrik och typ; ett nytt namn syns, en borttagen post ger bara texten, och inget lagras", async () => {
    const kalla = createMemorySource({});
    const s = createSamtalskalla({ kalla });
    const p = await s.oppnaPrivat({ groupId: GRUPP, uid: "anna", annan: "bo" });
    const lank = bibliotekslank(BAS, { plats: GRUPP, postId: "a1" });
    const borta = bibliotekslank(BAS, { plats: GRUPP, postId: "borta" });
    await s.skicka(p.id, { text: `Titta här\n${lank}`, av: "bo" });
    await s.skicka(p.id, { text: `Och här\n${borta}`, av: "bo" });
    const poster = /** @type {Record<string, any>} */ ({ a1: { ...ANTECKNING, rubrik: "Protokoll v2" } });
    const hamta = vi.fn(async ({ postId }) => poster[postId] ?? null);
    const onOppna = vi.fn((_d, e) => e.preventDefault());
    const postkort = bibliotekPostkort({ bas: BAS, hamta, onOppna });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId={GRUPP} gruppNamn="Källan" medlemmar={MEDLEMMAR} valt={p.id} postkort={postkort} />);
    const kort = await waitFor(() => {
      const k = document.querySelector(`[data-postkort="${lank}"]`);
      expect(k).not.toBeNull();
      return /** @type {HTMLElement} */ (k);
    });
    expect(kort.textContent).toContain("Protokoll v2");
    expect(kort.textContent).toContain("Anteckning");
    await waitFor(() => expect(hamta).toHaveBeenCalledWith({ plats: GRUPP, postId: "borta" }));
    expect(document.querySelector(`[data-postkort="${borta}"]`)).toBeNull();
    fireEvent.click(kort);
    expect(onOppna).toHaveBeenCalledWith({ plats: GRUPP, postId: "a1" }, expect.anything());
    // Inget fält på meddelandet: texten är som den skrevs.
    const rader = await kalla.list(`samtal/${p.id}/meddelanden`);
    expect(rader.every((r) => Object.keys(r).sort().join() === "av,id,text,tid")).toBe(true);
  });
});

/** Biblioteket med en medlems kommentarer, som en app kopplar in det. */
function Vy({ samtal, uid = "bo" }) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  const kommentarer = useMemo(() => createPostkommentarer({ samtal, groupId: GRUPP, uid, bas: BAS, namnFor: (u) => (u === "anna" ? "Anna Ek" : u === "bo" ? "Bo Lind" : null) }), [samtal, uid]);
  return <OpsBibliotek poster={[ANTECKNING]} jag={{ uid, roll: "medlem" }} vald={vald} onOppna={setVald} onStang={() => setVald(null)} onSkapa={() => {}} onSpara={async () => {}} hubHref="/hub" kommentarer={kommentarer} />;
}

describe("⛔ Kommentera i biblioteket: menyn, tråden på posten och chatten är samma tråd", () => {
  it("Kommentera i menyn öppnar posten med fältet i fokus, och den första kommentaren blir roten i chatten med posten som länk", async () => {
    const user = userEvent.setup();
    const kalla = createMemorySource({});
    const samtal = createSamtalskalla({ kalla, tradar: "tradar" });
    render(<Vy samtal={samtal} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    await user.click(within(screen.getByRole("menu", { name: "Protokoll" })).getByRole("menuitem", { name: /Kommentera/ }));
    const falt = await screen.findByRole("textbox", { name: "Skriv en kommentar" });
    await waitFor(() => expect(document.activeElement).toBe(falt));
    expect(await screen.findByText("Inga kommentarer än.")).toBeTruthy();
    await user.type(falt, "Bra protokoll");
    await user.click(screen.getByRole("button", { name: "Kommentera" }));
    await waitFor(() => expect(document.querySelectorAll("[data-bibliotek-kommentar]")).toHaveLength(1));
    const sid = samtalsnyckel({ groupId: GRUPP, slag: "grupp" });
    expect(await kalla.read(`samtal/${sid}/meddelanden`, "post~a1")).toMatchObject({ av: "bo", text: `Bra protokoll\n${bibliotekslank(BAS, { plats: GRUPP, postId: "a1" })}` });
    // I tråden på posten står kommentaren utan postens egen länk.
    expect(document.querySelector('[data-bibliotek-kommentar="post~a1"]')?.textContent).toContain("Bra protokoll");
    expect(document.querySelector('[data-bibliotek-kommentar="post~a1"]')?.textContent).not.toContain(BAS);
    // Ett svar i chattens tråd syns under posten när den läses.
    await samtal.skickaITrad(sid, "post~a1", { text: "Svar från chatten", av: "anna" });
    await user.type(falt, "Och en till");
    await user.click(screen.getByRole("button", { name: "Kommentera" }));
    await waitFor(() => expect(document.querySelectorAll("[data-bibliotek-kommentar]")).toHaveLength(3));
    expect([...document.querySelectorAll("[data-bibliotek-kommentar]")].map((e) => e.textContent)).toEqual([
      expect.stringContaining("Bra protokoll"),
      expect.stringContaining("Svar från chatten"),
      expect.stringContaining("Och en till"),
    ]);
    expect((await kalla.list(`samtal/${sid}/tradar/post~a1/meddelanden`)).map((m) => m.text)).toEqual(["Svar från chatten", "Och en till"]);
  });

  it("utan källan: ingen Kommentera i menyn och ingen tråd på posten, som förut", async () => {
    const user = userEvent.setup();
    render(<OpsBibliotek poster={[ANTECKNING]} jag={{ uid: "bo", roll: "medlem" }} vald={ANTECKNING} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => {}} hubHref="/hub" />);
    expect(document.querySelector("[data-bibliotek-kommentarer]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    expect(within(screen.getByRole("menu", { name: "Protokoll" })).queryByRole("menuitem", { name: /Kommentera/ })).toBeNull();
  });

  it("ett fel när kommentaren skickas står under fältet, och texten står kvar", async () => {
    const user = userEvent.setup();
    const kalla = { las: async () => ({ rader: [] }), kommentera: vi.fn(async () => { throw new Error("Kommentaren nådde inte fram."); }) };
    render(<OpsBibliotek poster={[ANTECKNING]} jag={null} vald={ANTECKNING} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => false} utanHubb kommentarer={kalla} />);
    const falt = await screen.findByRole("textbox", { name: "Skriv en kommentar" });
    await user.type(falt, "Hej");
    await user.click(screen.getByRole("button", { name: "Kommentera" }));
    expect(await screen.findByText("Kommentaren nådde inte fram.")).toBeTruthy();
    expect(/** @type {HTMLTextAreaElement} */ (falt).value).toBe("Hej");
  });
});

describe("⛔ gästens chatt: trådar och kort", () => {
  const LANK = bibliotekslank(BAS, { plats: GRUPP, postId: "a1" });
  const MEDDELANDEN = [
    { id: "m1", av: { namn: "Agda" }, text: "Välkommen", tid: 1000, svar: 1 },
    { id: "post~a1", av: { namn: "Bo" }, text: `Bra protokoll\n${LANK}`, tid: 2000, kort: [{ url: LANK, postId: "a1", typ: "anteckning", rubrik: "Protokoll" }] },
  ];

  it("ett meddelande med svar visar knappen, tråden öppnas och gästen svarar med text i tråden", async () => {
    const user = userEvent.setup();
    const onLasTrad = vi.fn(async () => ({ rot: MEDDELANDEN[0], meddelanden: [{ id: "t1", av: { namn: "Maja" }, text: "Svar i tråden", tid: 1100 }] }));
    const onSkrivITrad = vi.fn(async () => {});
    render(<OpsGastChatt meddelanden={MEDDELANDEN} onSkriv={async () => {}} onLasTrad={onLasTrad} onSkrivITrad={onSkrivITrad} igenkanning={false} />);
    await user.click(screen.getByRole("button", { name: "1 svar" }));
    expect(onLasTrad).toHaveBeenCalledWith("m1");
    const trad = await waitFor(() => {
      const el = document.querySelector('[data-gast-chatt-trad="m1"]');
      expect(el?.textContent).toContain("Svar i tråden");
      return /** @type {HTMLElement} */ (el);
    });
    expect(trad.textContent).toContain("Välkommen");
    const falt = within(trad).getByRole("textbox");
    await user.type(falt, "Gästens svar");
    await act(async () => {
      fireEvent.keyDown(falt, { key: "Enter" });
    });
    await waitFor(() => expect(onSkrivITrad).toHaveBeenCalledWith("m1", "Gästens svar"));
    await user.click(screen.getByRole("button", { name: "Till chatten" }));
    expect(document.querySelector("[data-gast-chatt-trad]")).toBeNull();
  });

  it("kortet ritas ur serverns kort, och ett tryck öppnar posten i gästens bibliotek och inte länken", async () => {
    const onOppnaPost = vi.fn();
    render(<OpsGastChatt meddelanden={MEDDELANDEN} onOppnaPost={onOppnaPost} igenkanning={false} />);
    const kort = await waitFor(() => {
      const k = document.querySelector(`[data-postkort="${LANK}"]`);
      expect(k).not.toBeNull();
      return /** @type {HTMLElement} */ (k);
    });
    expect(kort.textContent).toContain("Protokoll");
    const klick = new MouseEvent("click", { bubbles: true, cancelable: true });
    kort.dispatchEvent(klick);
    expect(klick.defaultPrevented).toBe(true);
    expect(onOppnaPost).toHaveBeenCalledWith("a1");
    // Ett meddelande utan svar och utan onLasTrad: ingen trådknapp.
    expect(screen.queryByRole("button", { name: /svar/ })).toBeNull();
  });
});
