import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nastaKvar } from "../components/DeladLista.jsx";
import { OpsDelad } from "../components/OpsDelad.jsx";
import { OpsLjudspelare } from "../components/OpsLjudspelare.jsx";
import { LISTRADTEXT } from "../lib/biblioteklista.js";

/**
 * Den publika vyn för anteckning, länk och lista (0.133.0, lifehub.app#356). Servern provas i `delning-alla-typer.test.js`; här provas det som syns.
 *
 * CP 2026-10-20: listan ritas som en spellista, och "Ändras listan kan den ju bara ändras för alla som den delas med. Om en låt tas bort kan den bara tas bort precis som för den som
 * skapade den." Mottagaren kan inte ändra något, och en låt som försvunnit hoppas över.
 */

/** @type {import("vitest").MockInstance} */
let play;
beforeEach(() => {
  // jsdom spelar inget ljud. `play` skickar `play`-händelsen som en webbläsare gör, och `pause` är en tom funktion.
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play_() {
    // @ts-expect-error `this` är elementet
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ljud = (id, rubrik, extra = {}) => ({ id, typ: "ljud", rubrik, mime: "audio/mpeg", storlek: 4_000_000, langd: 180000, peaks: null, nedladdning: false, url: `https://lagring.test/${id}.mp3?d=inline`, visaUrl: null, ...extra });
const anteckning = (id, rubrik, text) => ({ id, typ: "anteckning", rubrik, text });
const lank = (id, rubrik, url) => ({ id, typ: "lank", rubrik, url });
const pdf = (id, rubrik, extra = {}) => ({ id, typ: "pdf", rubrik, mime: "application/pdf", storlek: 2048, langd: null, peaks: null, nedladdning: false, url: `https://lagring.test/${id}.pdf`, visaUrl: null, ...extra });
const lista = (poster, extra = {}) => ({ typ: "lista", rubrik: "Gig 12 november", nedladdning: false, ejVisade: 0, poster, ...extra });

describe("OpsDelad: anteckning", () => {
  it("rubriken, typen och texten (radbrytningar och markdown som biblioteket läser den)", () => {
    render(<OpsDelad delning={{ typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade **tre** saker.\n\nNästa punkt." }} />);
    expect(screen.getByRole("heading", { level: 1, name: "Protokoll" })).toBeInTheDocument();
    expect(document.querySelector("[data-delad-meta]")?.textContent).toBe("Anteckning");
    expect(screen.getByText("tre")).toHaveProperty("tagName", "STRONG");
    expect(screen.getByText("Nästa punkt.")).toBeInTheDocument();
    expect(document.querySelector("[data-delad='anteckning']")).not.toBeNull();
  });

  it("⛔ HTML i texten blir text och aldrig element", () => {
    render(<OpsDelad delning={{ typ: "anteckning", rubrik: "A", text: "<img src=x onerror=alert(1)><script>alert(1)</script>" }} />);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
});

describe("OpsDelad: länk", () => {
  it("rubriken, adressen som text och en knapp som öppnar den i en ny flik", () => {
    render(<OpsDelad delning={{ typ: "lank", rubrik: "Kartan", url: "https://exempel.se/karta?x=1" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "Kartan" })).toBeInTheDocument();
    expect(document.querySelector("[data-delad-adress]")?.textContent).toBe("https://exempel.se/karta?x=1");
    const knapp = screen.getByRole("link", { name: "Öppna länken Kartan" });
    expect(knapp).toHaveAttribute("href", "https://exempel.se/karta?x=1");
    expect(knapp).toHaveAttribute("target", "_blank");
    expect(knapp.getAttribute("rel")).toContain("noopener");
  });

  it("⛔ en adress som inte är http eller https får ingen knapp", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://exempel.se/x", "https://exa mple.se"]) {
      const { unmount } = render(<OpsDelad delning={{ typ: "lank", rubrik: "Farlig", url }} />);
      expect(screen.queryByRole("link"), url).toBeNull();
      unmount();
    }
  });
});

describe("OpsDelad: lista som spellista", () => {
  const spel = () => [ljud("s1", "Första låten"), anteckning("a1", "Ackord", "Am G C"), ljud("s2", "Andra låten", { langd: 200000 }), lank("k1", "Texten", "https://exempel.se/text"), ljud("s3", "Tredje låten")];
  const rader = () => within(screen.getByRole("list", { name: /Posterna i/ })).getAllByRole("listitem");
  const audio = () => /** @type {HTMLAudioElement} */ (document.querySelector("audio"));

  it("rubriken, antalet och posterna i ordning, varje rad med sin typ", () => {
    render(<OpsDelad delning={lista(spel())} />);
    expect(screen.getByRole("heading", { level: 1, name: "Gig 12 november" })).toBeInTheDocument();
    expect(document.querySelector("[data-delad-meta]")?.textContent).toBe("Lista · 5 poster");
    expect(rader().map((r) => r.querySelector("[data-delad-radrubrik]")?.textContent)).toEqual(["Första låten", "Ackord", "Andra låten", "Texten", "Tredje låten"]);
    expect(rader().map((r) => r.getAttribute("data-delad-rad"))).toEqual(["ljud", "anteckning", "ljud", "lank", "ljud"]);
    // Typen står på raden, och längden för ett ljud.
    expect(rader().map((r) => r.querySelector("[data-delad-radmeta]")?.textContent)).toEqual([
      "Spelas nu · Ljud · 3:00 · 3,8 MB",
      "Anteckning",
      "Ljud · 3:20 · 3,8 MB",
      "Länk",
      "Ljud · 3:00 · 3,8 MB",
    ]);
  });

  it("⛔ EN spelare och ETT ljudelement för alla låtar, med första låten vald och ingenting som börjar spela av sig självt", () => {
    render(<OpsDelad delning={lista(spel())} />);
    expect(document.querySelectorAll("audio")).toHaveLength(1);
    expect(audio().getAttribute("src")).toBe("https://lagring.test/s1.mp3?d=inline");
    expect(play).not.toHaveBeenCalled();
    expect(rader()[0]).toHaveAttribute("aria-current", "true");
  });

  it("ett tryck på en låt väljer den och startar den, i samma ljudelement", () => {
    render(<OpsDelad delning={lista(spel())} />);
    const element = audio();
    fireEvent.click(screen.getByRole("button", { name: "Spela Andra låten ur listan" }));
    expect(audio()).toBe(element);
    expect(element.getAttribute("src")).toBe("https://lagring.test/s2.mp3?d=inline");
    expect(play).toHaveBeenCalledTimes(1);
    expect(rader()[2]).toHaveAttribute("aria-current", "true");
    expect(rader()[0]).not.toHaveAttribute("aria-current");
  });

  it("⛔ när en låt tar slut startar NÄSTA ljud, och anteckningen och länken däremellan hoppas över", () => {
    render(<OpsDelad delning={lista(spel())} />);
    const element = audio();
    fireEvent.click(screen.getByRole("button", { name: "Spela Första låten ur listan" }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.ended(element);
    expect(element.getAttribute("src")).toBe("https://lagring.test/s2.mp3?d=inline");
    expect(play).toHaveBeenCalledTimes(2);
    fireEvent.ended(element);
    expect(element.getAttribute("src")).toBe("https://lagring.test/s3.mp3?d=inline");
    expect(play).toHaveBeenCalledTimes(3);
    expect(audio()).toBe(element);
  });

  it("⛔ efter den sista låten stannar listan: ingen ny start, och första låten är vald igen", () => {
    render(<OpsDelad delning={lista(spel())} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Tredje låten ur listan" }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.ended(audio());
    expect(play).toHaveBeenCalledTimes(1);
    expect(audio().getAttribute("src")).toBe("https://lagring.test/s1.mp3?d=inline");
  });

  it("⛔ en låt som pausats av lyssnaren går inte vidare av sig själv när listan hämtas om", () => {
    const { rerender } = render(<OpsDelad delning={lista(spel())} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Första låten ur listan" }));
    fireEvent.pause(audio());
    play.mockClear();
    // En ny adress för samma låt (den gamla gick ut): inget startar eftersom lyssnaren pausat.
    rerender(<OpsDelad delning={lista([ljud("s1", "Första låten", { url: "https://lagring.test/s1.mp3?ny=1" }), ...spel().slice(1)])} />);
    expect(audio().getAttribute("src")).toBe("https://lagring.test/s1.mp3?ny=1");
    expect(play).not.toHaveBeenCalled();
  });

  it("⛔ listan hämtas om och den spelande låten finns kvar: bara adressen byts, och den spelar vidare", () => {
    const { rerender } = render(<OpsDelad delning={lista(spel())} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Andra låten ur listan" }));
    play.mockClear();
    rerender(<OpsDelad delning={lista(spel().map((p) => (p.id === "s2" ? { ...p, url: "https://lagring.test/s2.mp3?ny=1" } : p)))} />);
    expect(audio().getAttribute("src")).toBe("https://lagring.test/s2.mp3?ny=1");
    expect(rader()[2]).toHaveAttribute("aria-current", "true");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("⛔ den spelande låten har tagits ur listan: spelaren hoppar till NÄSTA låt som finns kvar", () => {
    const { rerender } = render(<OpsDelad delning={lista(spel())} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Andra låten ur listan" }));
    play.mockClear();
    // s2 är borta ur den nya listan (tagen ur eller raderad): nästa som fanns efter den, s3, spelar.
    rerender(<OpsDelad delning={lista(spel().filter((p) => p.id !== "s2"))} />);
    expect(audio().getAttribute("src")).toBe("https://lagring.test/s3.mp3?d=inline");
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Andra låten")).toBeNull();
    // Och är det den sista som försvunnit finns inget att hoppa till: första låten väljs utan att spela.
    play.mockClear();
    rerender(<OpsDelad delning={lista(spel().filter((p) => p.id !== "s2" && p.id !== "s3"))} />);
    expect(audio().getAttribute("src")).toBe("https://lagring.test/s1.mp3?d=inline");
    expect(play).not.toHaveBeenCalled();
  });

  it("nastaKvar: första som kom efter i den gamla ordningen och finns kvar", () => {
    expect(nastaKvar(["a", "b", "c", "d"], ["a", "c", "d"], "b")).toBe("c");
    expect(nastaKvar(["a", "b", "c", "d"], ["a", "d"], "b")).toBe("d");
    expect(nastaKvar(["a", "b", "c"], ["a", "b"], "c")).toBeNull();
    expect(nastaKvar(["a", "b"], ["a"], "okand")).toBeNull();
  });

  it("⛔ en ändrad ordning följer med: raderna står i den nya ordningen", () => {
    const { rerender } = render(<OpsDelad delning={lista(spel())} />);
    rerender(<OpsDelad delning={lista([...spel()].reverse())} />);
    expect(rader().map((r) => r.querySelector("[data-delad-radrubrik]")?.textContent)).toEqual(["Tredje låten", "Texten", "Andra låten", "Ackord", "Första låten"]);
  });

  it("⛔ en post som raderats står som medlemmens egen listvy visar den, utan något annat, och en lista i listan likaså", () => {
    render(<OpsDelad delning={lista([ljud("s1", "Första låten"), { typ: "saknas" }, { typ: "lista-i-lista" }])} />);
    expect(rader()).toHaveLength(3);
    expect(rader()[1]).toHaveTextContent(/^Finns inte längre$/);
    expect(rader()[2]).toHaveTextContent(/^Listor kan inte ligga i en lista\.$/);
    expect(LISTRADTEXT).toEqual({ saknas: "Finns inte längre", lista: "Listor kan inte ligga i en lista." });
    expect(within(rader()[1]).queryByRole("button")).toBeNull();
  });

  it("⛔ mottagaren kan inte ändra något: inga drag, ingen Ta bort, ingen Lägg till", () => {
    render(<OpsDelad delning={lista(spel())} />);
    expect(document.querySelector("[data-lista-grepp]")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ta bort|Lägg till|Radera|Byt namn/ })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("⛔ Ladda ner finns bara när delningen tillåter det, och då per fil", () => {
    const { unmount } = render(<OpsDelad delning={lista([ljud("s1", "Första låten")])} />);
    expect(screen.queryByText("Ladda ner")).toBeNull();
    expect(screen.queryByText(/Ladda ne[rd]/)).toBeNull();
    unmount();
    render(<OpsDelad delning={lista([ljud("s1", "Första låten", { nedladdning: true, url: "https://lagring.test/s1.mp3?d=attachment" }), ljud("s2", "Andra låten", { nedladdning: true, url: "https://lagring.test/s2.mp3?d=attachment" })], { nedladdning: true })} />);
    const nedladdningar = screen.getAllByRole("link", { name: /^Ladda ner (Första|Andra) låten$/ });
    expect(nedladdningar.map((a) => a.getAttribute("href"))).toEqual(["https://lagring.test/s1.mp3?d=attachment", "https://lagring.test/s2.mp3?d=attachment"]);
  });

  it("länken i listan har en knapp till adressen, men bara för http och https", () => {
    render(<OpsDelad delning={lista([lank("k1", "Texten", "https://exempel.se/text"), lank("k2", "Farlig", "javascript:alert(1)")])} />);
    expect(screen.getByRole("link", { name: "Öppna länken Texten" })).toHaveAttribute("href", "https://exempel.se/text");
    expect(screen.queryByRole("link", { name: /Farlig/ })).toBeNull();
  });

  it("en anteckning i listan fälls ut och visar sin text, och texten finns inte i sidan förrän den öppnas", () => {
    render(<OpsDelad delning={lista(spel())} />);
    expect(screen.queryByText("Am G C")).toBeNull();
    const rad = /** @type {HTMLElement} */ (rader().find((r) => r.getAttribute("data-delad-rad") === "anteckning"));
    const detaljer = /** @type {HTMLDetailsElement} */ (rad.querySelector("details"));
    act(() => {
      detaljer.open = true;
      detaljer.dispatchEvent(new Event("toggle"));
    });
    expect(screen.getByText("Am G C")).toBeInTheDocument();
  });

  it("⛔ ejVisade syns: en kapad lista ser aldrig ut som hela listan", () => {
    render(<OpsDelad delning={lista([ljud("s1", "Första låten")], { ejVisade: 7 })} />);
    expect(document.querySelector("[data-delad-ejvisade]")?.textContent).toBe("7 poster till visas inte här.");
    expect(document.querySelector("[data-delad-meta]")?.textContent).toBe("Lista · 8 poster");
  });

  it("en tom lista säger att den är tom, och har ingen spelare", () => {
    render(<OpsDelad delning={lista([])} />);
    expect(document.querySelector("[data-delad-tom]")?.textContent).toBe("Listan är tom.");
    expect(document.querySelector("audio")).toBeNull();
  });

  it("⛔ adressen gick ut: ber om en ny EN gång per adress, och inte alls när sidan öppnas", async () => {
    const onNyUrl = vi.fn(() => Promise.resolve());
    const { rerender } = render(<OpsDelad delning={lista(spel())} onNyUrl={onNyUrl} />);
    expect(onNyUrl).not.toHaveBeenCalled();
    // Ett fel räknas när lyssnaren bett om ljudet (spelaren rapporterar inte ett fel hos ett ljud ingen försökt spela).
    fireEvent.click(screen.getByRole("button", { name: "Spela Första låten" }));
    fireEvent.error(audio());
    fireEvent.error(audio());
    expect(onNyUrl).toHaveBeenCalledTimes(1);
    // Samma adress igen: nu visas felet.
    fireEvent.error(audio());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // En ny adress får sin egen chans.
    rerender(<OpsDelad delning={lista([{ ...spel()[0], url: "https://lagring.test/s1.mp3?ny=1" }, ...spel().slice(1)])} onNyUrl={onNyUrl} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("OpsDelad: en delad ljudfil ber inte om en ny adress när sidan öppnas", () => {
  it("⛔ onNyUrl anropas aldrig utan ett fel (förut anropades den vid första ritningen)", () => {
    const onNyUrl = vi.fn(() => Promise.resolve());
    render(<OpsDelad delning={ljud("x", "Demo")} onNyUrl={onNyUrl} />);
    expect(onNyUrl).not.toHaveBeenCalled();
  });
});

describe("OpsLjudspelare: slut, status och autostart (0.133.0)", () => {
  it("onSlut anropas när ljudet tar slut, och onSpelstatus med true vid start och false vid paus men inte vid slut", () => {
    const onSlut = vi.fn();
    const onSpelstatus = vi.fn();
    render(<OpsLjudspelare src="https://x/a.mp3" namn="A" onSlut={onSlut} onSpelstatus={onSpelstatus} />);
    const el = /** @type {HTMLAudioElement} */ (document.querySelector("audio"));
    fireEvent.play(el);
    expect(onSpelstatus).toHaveBeenLastCalledWith(true);
    fireEvent.pause(el);
    expect(onSpelstatus).toHaveBeenLastCalledWith(false);
    onSpelstatus.mockClear();
    Object.defineProperty(el, "ended", { configurable: true, value: true });
    fireEvent.pause(el);
    expect(onSpelstatus).not.toHaveBeenCalled();
    fireEvent.ended(el);
    expect(onSlut).toHaveBeenCalledTimes(1);
  });

  it("⛔ autoSpela startar vid en ny adress men aldrig vid första ritningen", () => {
    const { rerender } = render(<OpsLjudspelare src="https://x/a.mp3" namn="A" autoSpela />);
    expect(play).not.toHaveBeenCalled();
    rerender(<OpsLjudspelare src="https://x/b.mp3" namn="B" autoSpela />);
    expect(play).toHaveBeenCalledTimes(1);
    rerender(<OpsLjudspelare src="https://x/c.mp3" namn="C" autoSpela={false} />);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("onSlut, onSpelstatus och autoSpela måste vara rätt typ", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsLjudspelare src="https://x/a.mp3" onSlut="x" />)).toThrow(/onSlut/);
    expect(() => render(<OpsLjudspelare src="https://x/a.mp3" onSpelstatus="x" />)).toThrow(/onSpelstatus/);
  });
});
