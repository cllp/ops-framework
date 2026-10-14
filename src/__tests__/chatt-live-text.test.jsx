import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/*
 * Tal i chatten som i TALK (0.103.0). CP 2026-10-14, med en skärmbild av agentchatten där "Skriver ut det inspelade…" stod under
 * skrivfältet: "Sedan funkar inte tal i meddelanden på samma sätt som TALK, det skall skrivas ut text i realtid och inte gå en omväg
 * via textfältet."
 *
 * ⛔ ÄNDRAT 0.103.0, HELA FILEN. Här mättes förut 0.98.0:s väg: orden skrevs in i skrivfältet medan de sades, fältet var skrivskyddat,
 * och den som stoppade fick texten i fältet att rätta och skicka själv. Det är just den omvägen CP ville bort från. Nu mäts att
 * texten står i TALK:s yta (`OpsInspelning`) i fältets plats medan man pratar, att Klar skickar den direkt i tråden utan att fältet rörs,
 * att appens `onTranscribe` bara används när inget hördes och att dess resultat också skickas direkt, att ett fel står kvar med
 * Försök igen, att Avbryt inte skickar något, och att det sagda i agentens samtal är ett vanligt meddelande.
 *
 * ⛔ HÄR MÄTS BETEENDE MED EN FEJKAD WEBBLÄSARE (samma `SpeechRecognition` som TALK:s prov). Att igenkänningen är AV som förval
 * mäts i chatt-skrivfalt.test.jsx och rörs inte här.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

function provinspelare() {
  const blob = new Blob(["ljud"], { type: "audio/webm" });
  return {
    blob,
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob, mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/**
 * En fejkad `SpeechRecognition`. Provet styr resultat, fel och slut.
 * @param {{ tystVidStopp?: boolean }} [val] `tystVidStopp`: webbläsaren säger aldrig `end` efter `stop()`, så att väntetiden tar slut.
 */
function fejkadIgenkanning(val = {}) {
  /** @type {any[]} */
  const instanser = [];
  class SR {
    constructor() {
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      this.startad = false;
      instanser.push(this);
    }
    start() {
      this.startad = true;
    }
    stop() {
      if (!val.tystVidStopp) queueMicrotask(() => this.onend?.());
    }
    abort() {}
  }
  /** @param {any} rec @param {Array<[string, boolean]>} rader */
  const resultat = (rec, rader, fran = 0) =>
    act(() => rec.onresult({ resultIndex: fran, results: rader.map(([t, slut]) => Object.assign([{ transcript: t }], { isFinal: slut })) }));
  return { SR, instanser, resultat };
}

async function underlag() {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla }));
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Hej", av: "anna" });
  return { kalla, s, a };
}

const ruta = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Skriv ett meddelande" }));
const yta = () => /** @type {HTMLElement} */ (document.querySelector("[data-rostyta]"));
const klar = () => within(yta()).getByRole("button", { name: "Klar, skicka det du sagt" });
/** Meddelandena i samtalet, i ordning. @param {any} kalla @param {string} id */
const meddelanden = async (kalla, id) => (await kalla.list(`samtal/${id}/meddelanden`)).sort((/** @type {any} */ x, /** @type {any} */ y) => x.tid - y.tid);

/**
 * Renderar chatten med igenkänning påslagen och trycker på mikrofonen. Ger igenkännaren när den lyssnar.
 * @param {{ igenkanning?: boolean, onTranscribe?: any, fore?: string, tystVidStopp?: boolean }} [val]
 */
async function borjaPrata(val = {}) {
  const { kalla, s, a } = await underlag();
  const insp = provinspelare();
  const f = fejkadIgenkanning({ tystVidStopp: val.tystVidStopp });
  vi.stubGlobal("webkitSpeechRecognition", f.SR);
  const onTranscribe = val.onTranscribe ?? vi.fn(async () => "från servern");
  // Källan är fryst, så spionen sitter på en kopia med samma funktioner. Meddelandet når ändå den riktiga källan.
  const skicka = vi.fn((/** @type {any[]} */ ...x) => s.skicka(...x));
  const k = { ...s, skicka };
  render(<OpsMeddelanden kalla={k} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={insp} igenkanning={val.igenkanning ?? true} />);
  await within(await screen.findByRole("log")).findByText("Hej");
  if (val.fore !== undefined) fireEvent.change(ruta(), { target: { value: val.fore } });
  fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
  await waitFor(() => expect(f.instanser[0]?.startad).toBe(true));
  return { kalla, s: k, a, insp, f, onTranscribe, skicka, rec: f.instanser[0] };
}

describe("chattens mikrofon som TALK", () => {
  it("⛔ texten syns i TALK:s yta medan den sägs, i skrivfältets plats, och fältet är borta under tiden", async () => {
    try {
      const { f, rec } = await borjaPrata();
      expect(yta()?.getAttribute("data-rostlage")).toBe("spelar");
      expect(yta()?.hasAttribute("data-live")).toBe(true);
      expect(yta().querySelector("[data-ops-inspelning]")).not.toBeNull();
      expect(screen.queryByRole("textbox", { name: "Skriv ett meddelande" })).toBeNull();
      f.resultat(rec, [["boka rep", false]]);
      expect(yta().querySelector("[data-talk-text]")?.textContent).toBe("boka rep");
      f.resultat(rec, [["boka rep på torsdag", false]]);
      expect(yta().querySelector("[data-talk-text]")?.textContent).toBe("boka rep på torsdag");
      // TALK:s delar: prickarna, tiden, Avbryt och Klar.
      expect(yta().querySelector("[data-talk-prickar]")).not.toBeNull();
      expect(yta().querySelector("[data-inspelning-tid]")?.textContent).toContain("/ 2:00");
      expect(within(yta()).getByRole("button", { name: "Avbryt" })).toBeTruthy();
      expect(klar()).toBeTruthy();
      // ⛔ Fokus i ytan, på Klar: mikrofonen som trycktes finns inte längre.
      expect(document.activeElement).toBe(klar());
      expect(rec.lang).toBe("sv-SE");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ Klar skickar texten direkt i tråden, fältet rörs inte, och ingenting transkriberas", async () => {
    try {
      const { kalla, a, f, rec, onTranscribe, skicka } = await borjaPrata();
      f.resultat(rec, [["boka rep på torsdag", true]]);
      fireEvent.click(klar());
      await waitFor(() => expect(skicka).toHaveBeenCalledTimes(1));
      expect(skicka).toHaveBeenCalledWith(a.id, { text: "boka rep på torsdag", av: "anna" });
      await waitFor(() => expect(yta()).toBeNull());
      const alla = await meddelanden(kalla, a.id);
      expect(alla.map((/** @type {any} */ m) => m.text)).toEqual(["Hej", "boka rep på torsdag"]);
      expect(within(screen.getByRole("log")).getByText("boka rep på torsdag")).toBeTruthy();
      expect(onTranscribe).not.toHaveBeenCalled();
      expect(ruta().value).toBe("");
      expect(document.activeElement).toBe(ruta());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ webbläsaren säger aldrig sitt sista ord: det som stod i ytan skickas, inte en utskrift av ljudet", async () => {
    try {
      // Som Safari på iOS när `end` inte kommer inom väntetiden: igenkänningen lämnar ingen hel text, men ytan visade orden.
      const { kalla, a, f, rec, onTranscribe } = await borjaPrata({ tystVidStopp: true });
      f.resultat(rec, [["boka rep på torsdag", false]]);
      fireEvent.click(klar());
      await waitFor(async () => expect((await meddelanden(kalla, a.id)).map((/** @type {any} */ m) => m.text)).toEqual(["Hej", "boka rep på torsdag"]), { timeout: 4000 });
      expect(onTranscribe).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ det som stod i fältet ligger kvar, och bara det sagda skickas", async () => {
    try {
      // Mikrofonen finns bara i ett fält utan innehåll, så det som kan stå där är blanksteg.
      const { kalla, a, f, rec } = await borjaPrata({ fore: "  " });
      f.resultat(rec, [["hej alla", true]]);
      fireEvent.click(klar());
      await waitFor(() => expect(yta()).toBeNull());
      expect((await meddelanden(kalla, a.id)).at(-1).text).toBe("hej alla");
      expect(ruta().value).toBe("  ");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ Avbryt skickar ingenting, transkriberar ingenting, och lämnar fältet som det var", async () => {
    try {
      const { kalla, a, f, rec, onTranscribe, skicka, insp } = await borjaPrata();
      f.resultat(rec, [["boka rep", false]]);
      fireEvent.click(within(yta()).getByRole("button", { name: "Avbryt" }));
      await waitFor(() => expect(yta()).toBeNull());
      expect(insp.kasta).toHaveBeenCalled();
      expect(skicka).not.toHaveBeenCalled();
      expect(onTranscribe).not.toHaveBeenCalled();
      expect(await meddelanden(kalla, a.id)).toHaveLength(1);
      expect(ruta().value).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ en igenkänning som faller: ytan säger det, appen skriver ut ljudet medan ytan säger det, och resultatet skickas", async () => {
    try {
      let svara = /** @type {(t: string) => void} */ (() => {});
      const onTranscribe = vi.fn(() => new Promise((res) => (svara = res)));
      const { kalla, a, f, rec, insp } = await borjaPrata({ onTranscribe });
      f.resultat(rec, [["boka re", false]]);
      act(() => rec.onerror({ error: "network" }));
      expect(yta().querySelector("[data-talk-textfel]")?.textContent).toBe("Texten kan inte visas just nu. Det du säger spelas in ändå och skrivs ut när du trycker Klar.");
      fireEvent.click(klar());
      await waitFor(() => expect(yta()?.getAttribute("data-rostlage")).toBe("skriver"));
      expect(within(yta()).getByRole("status").textContent).toBe("Skriver ut det inspelade…");
      // ⛔ Den halva meningen skickas inte: ytan hade sagt att texten inte kunde visas.
      expect(onTranscribe).toHaveBeenCalledWith(insp.blob);
      await act(async () => svara("boka rep på torsdag"));
      await waitFor(() => expect(yta()).toBeNull());
      expect((await meddelanden(kalla, a.id)).map((/** @type {any} */ m) => m.text)).toEqual(["Hej", "boka rep på torsdag"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ en utskrift som faller står kvar med Försök igen, och Försök igen skriver ut samma ljud och skickar", async () => {
    try {
      const onTranscribe = vi.fn().mockRejectedValueOnce(new Error("Tjänsten svarade 503.")).mockResolvedValueOnce("andra försöket");
      const { kalla, a, insp } = await borjaPrata({ onTranscribe });
      // Inget hördes alls: då, och bara då, är det appens utskrift.
      fireEvent.click(klar());
      const fel = await within(yta()).findByRole("alert");
      expect(yta().getAttribute("data-rostlage")).toBe("fel");
      expect(fel.textContent).toBe("Det inspelade kunde inte skrivas ut. Tjänsten svarade 503.");
      expect(await meddelanden(kalla, a.id)).toHaveLength(1);
      fireEvent.click(within(yta()).getByRole("button", { name: "Försök igen" }));
      await waitFor(() => expect(yta()).toBeNull());
      expect(onTranscribe).toHaveBeenNthCalledWith(2, insp.blob);
      expect((await meddelanden(kalla, a.id)).at(-1).text).toBe("andra försöket");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ en sändning som faller står kvar med Försök igen och texten, och Försök igen skickar samma text en gång", async () => {
    try {
      const { kalla, a, f, rec, onTranscribe, skicka } = await borjaPrata();
      skicka.mockRejectedValueOnce(new Error("Nätet är nere."));
      f.resultat(rec, [["boka rep", true]]);
      fireEvent.click(klar());
      const fel = await within(yta()).findByRole("alert");
      expect(fel.textContent).toBe("Det du sa kunde inte skickas. Nätet är nere.");
      // Felet står i ytan, inte som en banderoll i loggen.
      expect(within(screen.getByRole("log")).queryByText(/Nätet är nere/)).toBeNull();
      fireEvent.click(within(yta()).getByRole("button", { name: "Försök igen" }));
      await waitFor(() => expect(yta()).toBeNull());
      expect(skicka).toHaveBeenCalledTimes(2);
      expect(skicka).toHaveBeenLastCalledWith(a.id, { text: "boka rep", av: "anna" });
      expect((await meddelanden(kalla, a.id)).map((/** @type {any} */ m) => m.text)).toEqual(["Hej", "boka rep"]);
      expect(onTranscribe).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ i agentens samtal är det sagda ett vanligt meddelande till agenten, samma post som Skicka ger", async () => {
    try {
      const { kalla, a, f, rec, skicka } = await borjaPrata();
      f.resultat(rec, [["vad har jag i morgon", true]]);
      fireEvent.click(klar());
      await waitFor(() => expect(yta()).toBeNull());
      fireEvent.change(ruta(), { target: { value: "och på fredag" } });
      fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
      await waitFor(() => expect(skicka).toHaveBeenCalledTimes(2));
      const [sagt, skrivet] = skicka.mock.calls.map((c) => c[1]);
      expect(Object.keys(sagt).sort()).toEqual(Object.keys(skrivet).sort());
      expect(sagt).toEqual({ text: "vad har jag i morgon", av: "anna" });
      const sist = (await meddelanden(kalla, a.id)).slice(-2);
      expect(sist.map((/** @type {any} */ m) => [m.text, m.av])).toEqual([["vad har jag i morgon", "anna"], ["och på fredag", "anna"]]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ utan taligenkänning i webbläsaren: Skriver ut det inspelade… i ytan, och appens text skickas direkt", async () => {
    // ⛔ ÄNDRAT 0.103.0. Förut hamnade appens text i fältet ("och appens text i fältet"). Nu är det samma beteende som med igenkänning:
    // det som blev text skickas.
    const { kalla, s, a } = await underlag();
    const insp = provinspelare();
    let svara = /** @type {(t: string) => void} */ (() => {});
    const onTranscribe = vi.fn(() => new Promise((res) => (svara = res)));
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={insp} igenkanning />);
    await within(await screen.findByRole("log")).findByText("Hej");
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await waitFor(() => expect(insp.starta).toHaveBeenCalled());
    expect(yta().hasAttribute("data-live")).toBe(false);
    // Ingen platstext om text som aldrig kommer.
    expect(yta().querySelector("[data-talk-platstext]")).toBeNull();
    fireEvent.click(klar());
    await waitFor(() => expect(within(yta()).getByRole("status").textContent).toBe("Skriver ut det inspelade…"));
    await act(async () => svara("påminn mig på fredag"));
    await waitFor(() => expect(yta()).toBeNull());
    expect((await meddelanden(kalla, a.id)).at(-1).text).toBe("påminn mig på fredag");
    expect(ruta().value).toBe("");
  });
});
