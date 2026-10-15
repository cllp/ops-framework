import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { TALK_INGET_LJUD, tystStrom, webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";

/*
 * Andra omgången efter en fråga från agenten (lifehub.app#253). CP 2026-10-14 på iPhone, i lifehub.app med ramverket 0.101.0:
 * "Ljudinspelning. Efter att jag fått en fråga så kan man inte spela in mer ljud." Första omgången nådde agenten, som svarade med en
 * fråga. När han tryckte på mikrofonen igen stod "Inget ljud kom fram. Försök igen." i fältet: serverns `TALK_FEL.tomt`, alltså ett
 * anrop med varken text eller ljud.
 *
 * ⛔ VAD SOM ÄR MÄTT OCH VAD SOM ÄR HYPOTES. Mätt i koden, och här: att `useTalk` lämnade 0 byte och ingen text till appen, och att
 * Försök igen sedan skickade samma 0 byte igen, så att inget tryck i fältet kunde ge en ny inspelning. Hypotes, inte mätt på en
 * iPhone: att WebKit ger en tyst ström (spåren `muted`, inga bitar) när taligenkänningen nyss haft mikrofonen. Provet efterliknar
 * den regeln med en falsk webbläsare. Det mäter koden mot regeln, inte regeln mot Apple.
 *
 * Appens mottagare här gör det lifehub.app gör (`web/src/app/App.jsx`, `onTalk`): text går till agenten, utan text går ljudet till
 * servern, och servern svarar med `TALK_FEL.tomt` på 0 byte.
 */

const flush = () => act(async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
});
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const SERVERNS_TOMT = "Inget ljud kom fram. Försök igen.";

/**
 * En falsk webbläsare med mikrofon, inspelare och taligenkänning. `tysta` säger, per anrop till `getUserMedia`, om strömmen är tyst.
 * En tyst ström ger inga bitar, och taligenkänningen hör ingenting medan den är tyst. Utan post i listan är strömmen inte tyst.
 * @param {boolean[]} tysta
 */
function falskTelefon(tysta) {
  /** @type {Array<{ muted: boolean, readyState: string, stoppad: boolean, stop: () => void }>} */
  const spar = [];
  let anrop = 0;
  const mediaDevices = {
    getUserMedia: vi.fn(async () => {
      const tyst = tysta[anrop] === true;
      anrop += 1;
      const s = { muted: tyst, readyState: "live", stoppad: false, stop() { this.stoppad = true; this.readyState = "ended"; } };
      spar.push(s);
      return { getTracks: () => [s], getAudioTracks: () => [s] };
    }),
  };
  class MR {
    /** @param {any} strom */
    constructor(strom) {
      this.strom = strom;
      this.state = "inactive";
      this.mimeType = "audio/mp4";
      /** @type {any} */ this.ondataavailable = null;
      /** @type {any} */ this.onstop = null;
    }
    static isTypeSupported(/** @type {string} */ t) {
      return t === "audio/mp4";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      const tyst = this.strom.getAudioTracks()[0].muted;
      if (!tyst) this.ondataavailable?.({ data: new Blob(["aac"], { type: "audio/mp4" }) });
      queueMicrotask(() => this.onstop?.());
    }
  }
  /** @type {any[]} */
  const igenkannare = [];
  class SR {
    constructor() {
      this.lang = "";
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      this.startad = false;
      this.slut = false;
      igenkannare.push(this);
    }
    start() {
      this.startad = true;
    }
    stop() {
      this.avsluta();
    }
    abort() {
      this.avsluta();
    }
    avsluta() {
      if (this.slut) return;
      this.slut = true;
      queueMicrotask(() => this.onend?.());
    }
  }
  /** Personen säger något. Igenkännaren hör det bara när den senaste strömmen inte är tyst. @param {string} t */
  const sag = (t) => {
    const rec = igenkannare[igenkannare.length - 1];
    const strom = spar[spar.length - 1];
    if (!rec || !rec.startad || rec.slut || strom.muted) return;
    rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
  };
  const inspelare = webblasarensInspelare({ mediaDevices: /** @type {any} */ (mediaDevices), MediaRecorder: /** @type {any} */ (MR), AudioContext: undefined });
  const igenkanning = /** @type {NonNullable<ReturnType<typeof webblasarensIgenkanning>>} */ (webblasarensIgenkanning({ SpeechRecognition: SR }));
  return { mediaDevices, spar, igenkannare, sag, inspelare, igenkanning };
}

/** lifehub.app:s mottagare: text till agenten, annars ljudet till servern, som svarar `tomt` på 0 byte. */
function lifehubsMottagare() {
  return vi.fn(async (/** @type {Blob} */ blob, /** @type {{ text?: string }} */ meta) => {
    if (!meta.text && blob.size === 0) throw new Error(SERVERNS_TOMT);
    return { kvitto: meta.text === "påminn mig om repet" ? "Vilken dag är repet?" : "Inlagt: påminnelse om repet på torsdag" };
  });
}

/** @param {{ onTalk: any, inspelare: any, igenkanning: any }} talk */
const Skal = (talk) => (
  <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={{ ...talk, mal: [{ id: "agenten", etikett: "Agenten" }] }}>
    <p>innehåll</p>
  </OpsAppShell>
);

const klar = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
  await flush();
};

describe("andra omgången efter agentens fråga (lifehub.app#253)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ en tyst ström i andra omgången hämtas om, och svaret på frågan når agenten", async () => {
    // Första strömmen hörs. Den andra omgångens första ström är tyst, som efter taligenkänningen på iOS (hypotes).
    const tel = falskTelefon([false, true]);
    const onTalk = lifehubsMottagare();
    render(Skal({ onTalk, inspelare: tel.inspelare, igenkanning: tel.igenkanning }));

    fireEvent.click(huvudMikrofon());
    await flush();
    act(() => tel.sag("påminn mig om repet"));
    await klar();
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(within(dialog).getByRole("status").textContent).toBe("Vilken dag är repet?");

    // ⛔ 0.105.0: Svara är borta. Den andra omgången startas med mikrofonen, som efter vilket kvitto som helst.
    fireEvent.click(huvudMikrofon());
    await flush();
    act(() => tel.sag("på torsdag"));
    await klar();

    expect(onTalk).toHaveBeenCalledTimes(2);
    const [blob, meta] = /** @type {[Blob, { text?: string }]} */ (/** @type {unknown} */ (onTalk.mock.calls[1]));
    // Röd före rättningen: den tysta strömmen spelades in, igenkänningen hörde ingenting, och appen fick 0 byte och ingen text.
    expect(blob.size + (meta.text ?? "").length).toBeGreaterThan(0);
    expect(meta.text).toBe("på torsdag");
    expect(screen.queryByText(SERVERNS_TOMT)).toBeNull();
    expect(within(/** @type {HTMLElement} */ (falt())).getByRole("status").textContent).toBe("Inlagt: påminnelse om repet på torsdag");
    // En ny ström och en ny igenkännare för varje omgång. Den tysta stängdes.
    expect(tel.mediaDevices.getUserMedia).toHaveBeenCalledTimes(3);
    expect(tel.spar.every((s) => s.stoppad)).toBe(true);
    expect(tel.igenkannare).toHaveLength(2);
    expect(tel.igenkannare[0]).not.toBe(tel.igenkannare[1]);
  });

  it("⛔ blir ljudet ändå tomt skickas ingenting, fältet säger varför, och Spela in igen ger en tredje omgång med ny ström", async () => {
    // Andra omgången: både första strömmen och den omhämtade är tysta. Tredje omgången hörs.
    const tel = falskTelefon([false, true, true, false]);
    const onTalk = lifehubsMottagare();
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(Skal({ onTalk, inspelare: tel.inspelare, igenkanning: tel.igenkanning }));
      fireEvent.click(huvudMikrofon());
      await flush();
      act(() => tel.sag("påminn mig om repet"));
      await klar();
      fireEvent.click(huvudMikrofon());
      await flush();
      act(() => tel.sag("på torsdag"));
      await klar();

      // Röd före rättningen: appen anropades en andra gång, med 0 byte och utan text, och servern svarade "Inget ljud kom fram".
      expect(onTalk).toHaveBeenCalledTimes(1);
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(within(dialog).getByRole("alert").textContent).toBe(TALK_INGET_LJUD);
      // Försök igen hade skickat samma tomma ljud igen. I stället: en ny inspelning.
      expect(within(dialog).queryByRole("button", { name: "Försök igen" })).toBeNull();
      // Det tomma utfallet går till felrapporten, med det inspelaren såg om strömmen.
      const rapport = konsol.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
      expect(rapport).toContain("inspelningen gav inget ljud");

      fireEvent.click(within(dialog).getByRole("button", { name: "Spela in igen" }));
      await flush();
      act(() => tel.sag("på torsdag"));
      await klar();
      expect(onTalk).toHaveBeenCalledTimes(2);
      expect(/** @type {any} */ (onTalk.mock.calls[1])[1].text).toBe("på torsdag");
      expect(within(/** @type {HTMLElement} */ (falt())).getByRole("status").textContent).toBe("Inlagt: påminnelse om repet på torsdag");
      expect(tel.mediaDevices.getUserMedia).toHaveBeenCalledTimes(4);
      expect(tel.igenkannare).toHaveLength(3);
      expect(new Set(tel.igenkannare).size).toBe(3);
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("webblasarensInspelare och en tyst ström", () => {
  it("hämtar en ny ström EN gång när alla spår är tysta, och stänger den tysta", async () => {
    const tel = falskTelefon([true, true, true]);
    await tel.inspelare.starta();
    const ut = await tel.inspelare.stoppa();
    expect(tel.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(tel.spar[0].stoppad).toBe(true);
    expect(ut.blob.size).toBe(0);
    expect(ut.diagnos).toEqual({
      tystVidStart: true,
      omhamtad: true,
      tystVidStopp: true,
      bitar: 0,
      // (0.107.0) Spårens läge, ljudkontexten och stoppet. Det falska spåret bär inget `enabled`, och det läses som påslaget.
      sparVidStart: [{ readyState: "live", muted: true, enabled: true }],
      sparVidStopp: [{ readyState: "live", muted: true, enabled: true }],
      ljudkontextVidStart: "ingen",
      ljudkontextVidStopp: "ingen",
      forraLjudkontext: null,
      stannadeSjalv: false,
      stoppetHann: true,
    });
  });

  it("rör inte en ström som hörs", async () => {
    const tel = falskTelefon([false]);
    await tel.inspelare.starta();
    const ut = await tel.inspelare.stoppa();
    expect(tel.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(ut.blob.size).toBeGreaterThan(0);
    expect(ut.diagnos).toMatchObject({ tystVidStart: false, omhamtad: false, tystVidStopp: false, bitar: 1, sparVidStopp: [{ readyState: "live", muted: false, enabled: true }] });
  });

  it("tystStrom: bara när alla ljudspår är tysta eller avslutade, och aldrig för en ström utan spår", () => {
    const spar = (/** @type {any[]} */ s) => ({ getAudioTracks: () => s, getTracks: () => s });
    expect(tystStrom(spar([{ muted: true }, { readyState: "ended" }]))).toBe(true);
    expect(tystStrom(spar([{ muted: true }, { muted: false }]))).toBe(false);
    expect(tystStrom(spar([]))).toBe(false);
    expect(tystStrom({ getTracks: () => [{}] })).toBe(false);
    expect(tystStrom(null)).toBe(false);
  });
});
