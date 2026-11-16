import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsMarkdown } from "../components/OpsMarkdown.jsx";
import { OpsSpelareProvider } from "../components/OpsSpelare.jsx";
import { AppNavigeringKontext } from "../components/appNavigering.js";
import { byggPost, kodaToppar } from "../lib/bibliotek.js";
import { nollstallSpelare } from "../lib/ljudspelare.js";
import { bibliotekslank, lasBibliotekslank } from "../lib/postkommentar.js";
import { medSpela } from "../lib/spelalank.js";
import { appadress } from "../lib/applank.js";

/**
 * ⛔ HÄNDELSEN (0.234.0, cllp/lifehub.app#860, L3 och L4). CP 2026-11-16, om agenten: "Jag vill att agenten skall vara en riktig assistens
 * i Life Hub. Ha tillgång till allt och kunna skapa genvägar och länkar direkt till kanske att spela upp en låt eller visa en fil." Varje
 * länk öppnades i en ny flik, en relativ adress blev ingen länk, kortet kände inte `?grupp=`, och postens adress startade inte spelaren.
 */

const URSPRUNG = window.location.origin;

/** @param {string} text @param {((href: string, e: any) => void) | null} [navigera] */
function rita(text, navigera = null) {
  return render(
    <AppNavigeringKontext.Provider value={navigera}>
      <OpsMarkdown text={text} chatt />
    </AppNavigeringKontext.Provider>,
  );
}

describe("L3: länkar i texten", () => {
  it("⛔ en länk till appen navigerar i appen, utan ny flik och utan omladdning", () => {
    const navigera = vi.fn();
    rita(`[Hamnen](${URSPRUNG}/bibliotek?grupp=g&post=p)`, navigera);
    const lank = screen.getByRole("link", { name: "Hamnen" });
    expect(lank.getAttribute("target")).toBeNull();
    const klick = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    lank.dispatchEvent(klick);
    expect(klick.defaultPrevented).toBe(true);
    expect(navigera).toHaveBeenCalledWith("/bibliotek?grupp=g&post=p", expect.anything());
  });

  it("⛔ en extern länk öppnas i en ny flik, och en länk till appen gör det inte", () => {
    const navigera = vi.fn();
    rita("[Extern](https://exempel.se/x) och [Intern](/inkorg?post=a)", navigera);
    const extern = screen.getByRole("link", { name: "Extern" });
    expect(extern.getAttribute("target")).toBe("_blank");
    expect(extern.getAttribute("rel")).toContain("noopener");
    fireEvent.click(extern);
    expect(navigera).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Intern" }).getAttribute("target")).toBeNull();
  });

  it("⛔ javascript: och //annan.se blir aldrig en länk, en relativ adress i appen blir det", () => {
    rita("[ond](javascript:alert(1)) [annan](//annan.se/x) [bak](/\\annan.se) [bra](/bibliotek)");
    expect(screen.queryByRole("link", { name: "ond" })).toBeNull();
    expect(screen.queryByRole("link", { name: "annan" })).toBeNull();
    expect(screen.queryByRole("link", { name: "bak" })).toBeNull();
    expect(screen.getByRole("link", { name: "bra" }).getAttribute("href")).toBe("/bibliotek");
    expect(document.body.textContent).toContain("[ond](javascript:alert(1))");
  });

  it("⛔ samma ursprung med en sökväg som börjar med // eller /\\ blir aldrig en adress i appen (granskningen av 0.234.0)", () => {
    // Mätt i granskningen: alla tre har appens ursprung, men sökvägen pekar på en annan värd när den används som href.
    expect(appadress(`${URSPRUNG}//evil.com/x`, URSPRUNG)).toBeNull();
    expect(appadress(`${URSPRUNG}/\\evil.com`, URSPRUNG)).toBeNull();
    expect(appadress(`${URSPRUNG}/..//evil.com`, URSPRUNG)).toBeNull();
    expect(appadress(`${URSPRUNG}/bibliotek?plats=g&post=p`, URSPRUNG)).toBe("/bibliotek?plats=g&post=p");
    const navigera = vi.fn();
    rita(`[Hamnen](${URSPRUNG}//evil.com/x)`, navigera);
    const lank = screen.queryByRole("link", { name: "Hamnen" });
    if (lank) {
      expect(lank.getAttribute("href")).not.toMatch(/^\/\//);
      expect(lank.hasAttribute("data-applank")).toBe(false);
      fireEvent.click(lank);
    }
    expect(navigera).not.toHaveBeenCalled();
  });

  it("⛔ en relativ adress blir klickbar och navigerar i appen; Ctrl-klick lämnas åt webbläsaren", () => {
    const navigera = vi.fn();
    rita("Lyssna på [Hamnen](/bibliotek?plats=g&post=p&spela=1).", navigera);
    const lank = screen.getByRole("link", { name: "Hamnen" });
    expect(lank.getAttribute("href")).toBe("/bibliotek?plats=g&post=p&spela=1");
    fireEvent.click(lank, { ctrlKey: true });
    expect(navigera).not.toHaveBeenCalled();
    fireEvent.click(lank);
    expect(navigera).toHaveBeenCalledWith("/bibliotek?plats=g&post=p&spela=1", expect.anything());
  });

  it("⛔ postkortet godtar ?grupp=&post= som ?plats=&post=, men aldrig båda eller fler", () => {
    const bas = "https://my.life-hub.app/bibliotek";
    expect(lasBibliotekslank(bas, `${bas}?grupp=g&post=p1`)).toEqual({ plats: "g", postId: "p1" });
    expect(lasBibliotekslank(bas, `${bas}?plats=g&post=p1`)).toEqual({ plats: "g", postId: "p1" });
    expect(lasBibliotekslank(bas, `${bas}?plats=g&grupp=h&post=p1`)).toBeNull();
    expect(lasBibliotekslank(bas, `${bas}?grupp=g`)).toBeNull();
  });
});

describe("⛔ spela-länken blir ett kort i chatten (0.234.0)", () => {
  // Agentens länk till ett ljud bär spela=1 (`medSpela`), och `lasBibliotekslank` krävde exakt två parametrar: länken blev aldrig ett kort.
  const bas = "https://my.life-hub.app/bibliotek";
  it("medSpela(bibliotekslank(...)) läses tillbaka med spela", () => {
    expect(lasBibliotekslank(bas, medSpela(bibliotekslank(bas, { plats: "g", postId: "hamnen" })))).toEqual({ plats: "g", postId: "hamnen", spela: true });
    expect(lasBibliotekslank(bas, `${bas}?grupp=g&post=hamnen&spela=1`)).toEqual({ plats: "g", postId: "hamnen", spela: true });
  });
  it("spela=2, två spela och en annan extra parameter ger ingen post", () => {
    expect(lasBibliotekslank(bas, `${bas}?plats=g&post=hamnen&spela=2`)).toBeNull();
    expect(lasBibliotekslank(bas, `${bas}?plats=g&post=hamnen&spela=1&spela=1`)).toBeNull();
    expect(lasBibliotekslank(bas, `${bas}?plats=g&post=hamnen&x=1`)).toBeNull();
    expect(lasBibliotekslank(bas, `${bas}?plats=g&post=hamnen`)).toEqual({ plats: "g", postId: "hamnen" });
  });
});

describe("L4: spela-länken", () => {
  const tid = 1_700_000_000_000;
  const ljud = {
    ...byggPost({
      groupId: "g",
      typ: "fil",
      rubrik: "Hamnen",
      fil: { sokvag: "grupper/g/bibliotek/p/hamnen.mp3", namn: "hamnen.mp3", mime: "audio/mpeg", byte: 4000 },
      durationMs: 4000,
      peaks: kodaToppar(Array.from({ length: 48 }, () => 0.5)),
      skapadAv: { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" },
      skapad: tid,
      andrad: tid,
    }),
    id: "hamnen",
  };
  const forr = { play: HTMLMediaElement.prototype.play, pause: HTMLMediaElement.prototype.pause, load: HTMLMediaElement.prototype.load };
  /** @type {ReturnType<typeof vi.fn>} */
  let play;

  /** @param {(this: HTMLMediaElement) => Promise<void>} gor */
  function satt(gor) {
    play = vi.fn(gor);
    HTMLMediaElement.prototype.play = /** @type {any} */ (play);
    HTMLMediaElement.prototype.pause = function pause() {};
    HTMLMediaElement.prototype.load = function load() {};
  }
  function vy() {
    return render(
      <OpsSpelareProvider>
        <OpsBibliotek poster={[ljud]} jag={{ uid: "uid-1", roll: "medlem" }} vald={ljud} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} filUrl={() => "https://exempel.se/hamnen.mp3"} hubHref="/hub" />
      </OpsSpelareProvider>,
    );
  }

  beforeEach(() => {
    nollstallSpelare();
    window.history.replaceState(null, "", "/bibliotek?plats=g&post=hamnen&spela=1");
  });
  afterEach(() => {
    Object.assign(HTMLMediaElement.prototype, forr);
    window.history.replaceState(null, "", "/");
  });

  it("⛔ spela=1 anropar play() när detaljen öppnas, och parametern tas bort ur adressen", async () => {
    satt(async function () {
      this.dispatchEvent(new Event("play"));
    });
    vy();
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(window.location.search).toBe("?plats=g&post=hamnen");
    expect(document.querySelector("[data-spela-blockerad]")).toBeNull();
  });

  it("⛔ en avvisad uppspelning visar uppmaningen, och Spela får fokus (regel 5)", async () => {
    satt(async () => {
      throw Object.assign(new Error("nej"), { name: "NotAllowedError" });
    });
    vy();
    await waitFor(() => expect(document.querySelector("[data-spela-blockerad]")).not.toBeNull());
    const uppmaning = /** @type {HTMLElement} */ (document.querySelector("[data-spela-blockerad]"));
    expect(uppmaning.textContent).toBe("Webbläsaren startade inte låten. Tryck på Spela.");
    expect(uppmaning.getAttribute("role")).toBe("alert");
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Spela Hamnen"));
  });

  it("utan spela=1 startar ingenting", async () => {
    window.history.replaceState(null, "", "/bibliotek?plats=g&post=hamnen");
    satt(async () => {});
    vy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(play).not.toHaveBeenCalled();
  });

  it("medSpela lägger till spela=1 på postens länk", () => {
    expect(medSpela("https://my.life-hub.app/bibliotek?plats=g&post=p")).toBe("https://my.life-hub.app/bibliotek?plats=g&post=p&spela=1");
    expect(medSpela("/bibliotek?plats=g&post=p")).toBe("/bibliotek?plats=g&post=p&spela=1");
  });
});
