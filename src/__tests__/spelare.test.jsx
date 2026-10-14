import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsSpelaKnapp, OpsSpelareProvider, OpsSpelarKontroller } from "../components/OpsSpelare.jsx";
import { kodaToppar } from "../lib/bibliotek.js";
import { baraEnSpelar, nollstallSpelare, registreraSpelare } from "../lib/ljudspelare.js";

/**
 * Skalets spelare (0.102.0): en `<audio>` för hela skalet, spelraden längst ned och arket med vågen. Proven går mot beteendet:
 * vad `<audio>` får för adress, vad som syns och vad låsskärmen får för handlingar.
 */

const VAG = kodaToppar(Array.from({ length: 48 }, (_, i) => 0.2 + ((i * 7) % 10) / 12));
const IDE = { id: "ide", namn: "Idé", src: "https://exempel.se/ide.webm", durationMs: 30000, peaks: VAG };
const JAZZ = { id: "jazz", namn: "R jazz", src: "https://exempel.se/jazz.webm", durationMs: 60000, peaks: VAG };

/** @returns {HTMLAudioElement} */
function ljudet() {
  const el = document.querySelector("audio");
  if (!el) throw new Error("ingen audio");
  return /** @type {HTMLAudioElement} */ (el);
}

/** @param {import("react").ReactNode} barn */
function ritaISkal(barn) {
  return render(<OpsSpelareProvider>{barn}</OpsSpelareProvider>);
}

/** @type {Record<string, MediaSessionActionHandler | null>} */
let handlingar = {};

describe("OpsSpelare", () => {
  beforeEach(() => {
    nollstallSpelare();
    // jsdom spelar inget och låter `paused` stå kvar på true. Här följer `paused` play och pause som i en webbläsare.
    HTMLMediaElement.prototype.play = function play() {
      Object.defineProperty(this, "paused", { configurable: true, value: false });
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      Object.defineProperty(this, "paused", { configurable: true, value: true });
      this.dispatchEvent(new Event("pause"));
    };
    HTMLMediaElement.prototype.load = function load() {};
    handlingar = {};
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: {
        metadata: null,
        playbackState: "none",
        setActionHandler: (/** @type {string} */ namn, /** @type {MediaSessionActionHandler | null} */ gor) => {
          handlingar[namn] = gor;
        },
      },
    });
  });

  afterEach(() => {
    // @ts-expect-error provets egen mediaSession tas bort
    delete navigator.mediaSession;
  });

  it("utanför skalet ritas ingen spelknapp, så att anroparen ritar sin egen spelare", () => {
    const { container } = render(<OpsSpelaKnapp spar={IDE} />);
    expect(container.innerHTML).toBe("");
  });

  it("spela på en post ger spelraden med namnet, och ett andra tryck pausar samma spår", async () => {
    ritaISkal(<OpsSpelaKnapp spar={IDE} />);
    expect(document.querySelector("[data-ops-spelrad]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    expect(ljudet().src).toBe(IDE.src);
    const rad = await screen.findByRole("region", { name: "Spelar Idé" });
    expect(rad.textContent).toContain("Tryck för att spola");
    expect(screen.getAllByRole("button", { name: "Pausa Idé" }).length).toBe(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Pausa Idé" })[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Spela Idé" }).length).toBe(2));
    expect(screen.getByRole("region", { name: "Spelar Idé" })).toBeTruthy();
  });

  it("ett annat spår byter adressen i samma ljudelement, och bara en spelrad finns", async () => {
    ritaISkal(
      <>
        <OpsSpelaKnapp spar={IDE} />
        <OpsSpelaKnapp spar={JAZZ} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    await screen.findByRole("region", { name: "Spelar Idé" });
    fireEvent.click(screen.getByRole("button", { name: "Spela R jazz" }));
    await screen.findByRole("region", { name: "Spelar R jazz" });
    expect(document.querySelectorAll("audio").length).toBe(1);
    expect(ljudet().src).toBe(JAZZ.src);
    expect(screen.queryByRole("region", { name: "Spelar Idé" })).toBeNull();
  });

  it("stäng tar bort spelraden och adressen, och låsskärmen får inga handlingar kvar", async () => {
    ritaISkal(<OpsSpelaKnapp spar={IDE} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    await screen.findByRole("region", { name: "Spelar Idé" });
    expect(typeof handlingar.play).toBe("function");
    fireEvent.click(screen.getByRole("button", { name: "Stäng spelaren" }));
    expect(screen.queryByRole("region", { name: "Spelar Idé" })).toBeNull();
    expect(ljudet().getAttribute("src")).toBeNull();
    expect(handlingar.play).toBeNull();
    expect(navigator.mediaSession.playbackState).toBe("none");
  });

  it("låsskärmens handlingar styr spåret: paus, tio sekunder framåt och spola till en tid", async () => {
    ritaISkal(<OpsSpelaKnapp spar={IDE} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    await screen.findByRole("region", { name: "Spelar Idé" });
    await waitFor(() => expect(navigator.mediaSession.playbackState).toBe("playing"));
    expect(navigator.mediaSession.metadata?.title ?? "Idé").toBe("Idé");
    act(() => handlingar.pause?.({ action: "pause" }));
    await waitFor(() => expect(navigator.mediaSession.playbackState).toBe("paused"));
    act(() => handlingar.seekforward?.({ action: "seekforward" }));
    expect(ljudet().currentTime).toBe(10);
    act(() => handlingar.seekto?.({ action: "seekto", seekTime: 21 }));
    expect(ljudet().currentTime).toBe(21);
  });

  it("arket öppnas ur spelraden med vågen, och spolningen flyttar uppspelningen", async () => {
    ritaISkal(<OpsSpelaKnapp spar={IDE} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    fireEvent.click(await screen.findByRole("button", { name: "Öppna spelaren för Idé" }));
    const ark = await screen.findByRole("dialog");
    expect(ark.textContent).toContain("Spelar");
    expect(ark.querySelector('[data-ops-spelarkontroller="aktiv"]')).not.toBeNull();
    const spola = screen.getByRole("slider", { name: "Spola i Idé" });
    fireEvent.change(spola, { target: { value: "500" } });
    expect(ljudet().currentTime).toBe(15);
    fireEvent.click(screen.getByRole("button", { name: "Fäll ihop spelaren" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("region", { name: "Spelar Idé" })).toBeTruthy();
  });

  it("hopp och hastighet syns först när spåret startats, och hastigheten följer med till ljudet", async () => {
    ritaISkal(<OpsSpelarKontroller spar={IDE} />);
    expect(screen.getByRole("button", { name: "10 sekunder framåt" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: /^Uppspelningshastighet/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    const hastighet = await screen.findByRole("button", { name: /^Uppspelningshastighet/ });
    fireEvent.click(hastighet);
    expect(ljudet().playbackRate).toBe(1.25);
    expect(screen.getByRole("button", { name: "10 sekunder framåt" }).hasAttribute("disabled")).toBe(false);
  });

  it("en nekad uppspelning säger det i stället för att se ut att spela", async () => {
    HTMLMediaElement.prototype.play = function nekad() {
      const e = new Error("nej");
      e.name = "NotAllowedError";
      return Promise.reject(e);
    };
    ritaISkal(<OpsSpelarKontroller spar={IDE} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    const fel = await screen.findByRole("alert");
    expect(fel.textContent).toContain("Webbläsaren stoppade uppspelningen");
    expect(screen.getAllByRole("button", { name: "Spela Idé" }).length).toBeGreaterThan(0);
  });

  it("startar en annan spelare tystnar skalets spelare", async () => {
    ritaISkal(<OpsSpelaKnapp spar={IDE} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Pausa Idé" }).length).toBe(2));
    const annan = { pausa: vi.fn() };
    registreraSpelare(annan);
    act(() => baraEnSpelar(annan));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Spela Idé" }).length).toBe(2));
  });
});
