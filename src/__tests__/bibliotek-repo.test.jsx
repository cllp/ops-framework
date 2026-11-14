import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { REPO_INDRAG_MAX } from "../components/BibliotekRepo.jsx";
import { repoMinnesnyckel } from "../components/BibliotekRepoLat.jsx";
import { githubDokumentUrl } from "../lib/githubdokument.js";

/*
 * "I repot" på ett projekts plats (0.205.0, cllp/lifehub.app#653 skiva 3), och som träd (0.209.0, cllp/lifehub.app#706).
 * ⛔ RÖTT UTAN 0.205.0: `repoLasare` finns inte i OpsBibliotek, så ingen sektion ritas och läsaren anropas aldrig.
 * ⛔ RÖTT UTAN 0.209.0 (mätt mot 0.208.0): sektionen läser projektets mapp när platsen ritas, en mapp öppnas i stället för den förra listan (ingen utfällning på plats),
 *   och varje fil har en knapp "Lägg i Biblioteket" i stället för ⋮ med "Lägg i Biblioteket" och "Öppna i GitHub".
 *
 * Proven om brödsmulan och Tillbaka uppåt (0.205.0) är omskrivna till trädet: "en mapp öppnas i sektionen, och Tillbaka och brödsmulan stannar i projektets mapp" och
 * "brödsmulans rot går tillbaka till projektets mapp" är nu "en mapp fälls ut på plats, läses först då, och inget anrop går ovanför projektets mapp". Knappen "Lägg i Biblioteket"
 * på raden är nu ett val i ⋮, med samma anrop, samma klartext och samma fel.
 */

const JAG = { uid: "uid-1", roll: "medlem" };
const PLATS = "plats~cps-ab~lifehub";
const PLATSER = [{ id: "cps-ab", namn: "CPS AB" }, { id: PLATS, namn: "Life Hub" }];
const urlFor = (/** @type {string} */ sokvag) => githubDokumentUrl({ agare: "cllp", repo: "lifehub.app", ref: "main", sokvag: `projekt/lifehub/${sokvag}` });

/** Ett litet repo: projektets mapp har en undermapp `docs` med en fil, och en fil i roten. @param {{ plats: string, sokvag: string }} f */
function repo({ sokvag }) {
  if (sokvag === "") {
    return Promise.resolve({
      lage: "last",
      poster: [
        { namn: "docs", sokvag: "docs", sort: "mapp" },
        { namn: "README.md", sokvag: "README.md", sort: "fil", storlek: 2048, url: urlFor("README.md") },
      ],
      fler: false,
    });
  }
  if (sokvag === "docs") return Promise.resolve({ lage: "last", poster: [{ namn: "plan.md", sokvag: "docs/plan.md", sort: "fil", storlek: 10, url: urlFor("docs/plan.md") }], fler: false });
  return Promise.resolve({ lage: "saknas" });
}

/** Ett djupt repo: a/b/c/d/e, en mapp per nivå och en fil längst ned. @param {{ plats: string, sokvag: string }} f */
function djupt({ sokvag }) {
  const led = sokvag === "" ? [] : sokvag.split("/");
  if (led.length === 5) return Promise.resolve({ lage: "last", poster: [{ namn: "slut.md", sokvag: `${sokvag}/slut.md`, sort: "fil", url: urlFor(`${sokvag}/slut.md`) }] });
  const namn = "abcde"[led.length];
  return Promise.resolve({ lage: "last", poster: [{ namn, sokvag: [...led, namn].join("/"), sort: "mapp" }] });
}

/** @param {Record<string, any>} [extra] */
function visa(extra = {}) {
  return render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats={PLATS} onPlats={() => {}} {...extra} />);
}

const sektion = (/** @type {HTMLElement} */ c) => /** @type {HTMLElement} */ (c.querySelector("[data-bibliotek-repo]"));
/** Fäller ut "I repot" med ett tryck på raden, om den inte redan är utfälld (utfällningen minns per plats). @param {HTMLElement} c */
const fallUt = (c) => {
  if (sektion(c).querySelector("details")?.hasAttribute("open")) return;
  fireEvent.click(within(sektion(c)).getByRole("heading", { name: /I repot|In the repo/ }));
};
/** Visar och fäller ut, och väntar på projektets mapp. @param {Record<string, any>} extra */
async function visaUtfalld(extra) {
  const r = visa(extra);
  fallUt(r.container);
  await waitFor(() => expect(r.container.querySelector('[data-bibliotek-repo-lista=""]')).not.toBeNull());
  return r;
}

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // Testmiljön har lagring.
  }
});
afterEach(() => vi.restoreAllMocks());

describe("utan repoLasare", () => {
  it("har projektets plats ingen sektion I repot", () => {
    const { container } = visa();
    expect(container.querySelector("[data-bibliotek-repo]")).toBeNull();
    expect(screen.queryByText("I repot")).toBeNull();
  });

  it("kastar när repoLasare eller onLaggRepoFil inte är en funktion", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => visa({ repoLasare: "ja" })).toThrow(/repoLasare/);
    expect(() => visa({ repoLasare: repo, onLaggRepoFil: 3 })).toThrow(/onLaggRepoFil/);
    fel.mockRestore();
  });
});

describe("infälld från början (0.209.0)", () => {
  it("raden I repot står infälld och repot läses inte förrän den fälls ut", async () => {
    const lasare = vi.fn(repo);
    const { container } = visa({ repoLasare: lasare });
    const s = sektion(container);
    expect(within(s).getByRole("heading", { name: "I repot" })).toBeTruthy();
    expect(s.querySelector("details")?.hasAttribute("open")).toBe(false);
    // Ge en eventuell läsning tid att ske: ingen ska ske.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(lasare).not.toHaveBeenCalled();
    expect(s.querySelector("[data-bibliotek-repo-rad]")).toBeNull();
    fallUt(container);
    await waitFor(() => expect(lasare).toHaveBeenCalledWith({ plats: PLATS, sokvag: "" }));
    expect(lasare).toHaveBeenCalledTimes(1);
  });

  it("minns utfällningen per plats, och utan lagring ritas den infälld", async () => {
    const lasare = vi.fn(repo);
    const a = visa({ repoLasare: lasare });
    fallUt(a.container);
    await waitFor(() => expect(lasare).toHaveBeenCalledTimes(1));
    expect(globalThis.localStorage.getItem(repoMinnesnyckel(PLATS))).toBe("1");
    a.unmount();
    // Samma plats igen: utfälld, och läser direkt.
    const b = visa({ repoLasare: lasare });
    expect(sektion(b.container).querySelector("details")?.hasAttribute("open")).toBe(true);
    await waitFor(() => expect(lasare).toHaveBeenCalledTimes(2));
    b.unmount();
    // En lagring som kastar: infälld, och inget kast.
    const lagring = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blockerad");
    });
    const c = visa({ repoLasare: lasare });
    expect(sektion(c.container).querySelector("details")?.hasAttribute("open")).toBe(false);
    expect(lasare).toHaveBeenCalledTimes(2);
    lagring.mockRestore();
  });
});

describe("trädet", () => {
  it("läser projektets mapp när den fälls ut och ritar raderna", async () => {
    const lasare = vi.fn(repo);
    const { container } = await visaUtfalld({ repoLasare: lasare });
    const s = sektion(container);
    expect(lasare).toHaveBeenCalledWith({ plats: PLATS, sokvag: "" });
    expect(within(s).getByText("README.md")).toBeTruthy();
    expect(within(s).getByText("2 kB")).toBeTruthy();
    expect(s.querySelectorAll("[data-bibliotek-repo-rad]").length).toBe(2);
    // Ingen brödsmula och ingen Tillbaka uppåt längre.
    expect(container.querySelector("[data-bibliotek-repo-smula]")).toBeNull();
    expect(container.querySelector("[data-bibliotek-repo-tillbaka]")).toBeNull();
  });

  // ⛔ RÖTT UTAN 0.217.0 (cllp/lifehub.app#785): gruppens eget bibliotek fick ingen I repot fast appen skickade `repoLasare`, eftersom raden krävde en egen plats (`arPlatsBibliotek`).
  it("0.217.0: gruppens eget bibliotek får I repot när appen skickar repoLasare, och läsaren frågas med gruppens id", async () => {
    const lasare = vi.fn(repo);
    const { container } = render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats="cps-ab" onPlats={() => {}} repoLasare={lasare} />);
    expect(container.querySelector("[data-bibliotek-repo]")).not.toBeNull();
    fallUt(container);
    await waitFor(() => expect(lasare).toHaveBeenCalled());
    expect(lasare.mock.calls[0][0]).toEqual({ plats: "cps-ab", sokvag: "" });
  });

  it("syns inte i Mitt bibliotek, på en händelses eller ett ärendes plats, i en inbäddad lista eller utan repoLasare", () => {
    const lasare = vi.fn(repo);
    for (const plats of ["mitt~u1", "handelse~cps-ab~h1", "arende~cps-ab~a1"]) {
      const a = render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats={plats} onPlats={() => {}} repoLasare={lasare} />);
      expect(a.container.querySelector("[data-bibliotek-repo]"), plats).toBeNull();
      a.unmount();
    }
    const b = render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" inbaddad repoLasare={lasare} />);
    expect(b.container.querySelector("[data-bibliotek-repo]")).toBeNull();
    b.unmount();
    const c = render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats="cps-ab" onPlats={() => {}} />);
    expect(c.container.querySelector("[data-bibliotek-repo]")).toBeNull();
    expect(lasare).not.toHaveBeenCalled();
  });

  it("väntar synligt medan mappen hämtas", async () => {
    const { container } = visa({ repoLasare: () => new Promise(() => {}) });
    fallUt(container);
    await waitFor(() => expect(container.querySelector('[data-bibliotek-repo-lage="hamtar"]')).not.toBeNull());
    const v = /** @type {HTMLElement} */ (container.querySelector('[data-bibliotek-repo-lage="hamtar"]'));
    expect(v.querySelector('[role="status"]')?.getAttribute("aria-busy")).toBe("true");
    expect(v.textContent).toContain("Hämtar mappen från GitHub.");
  });

  it("en mapp fälls ut på plats och läses först då, fälls ihop och läses igen, och inget anrop går ovanför projektets mapp", async () => {
    const lasare = vi.fn(repo);
    const { container } = await visaUtfalld({ repoLasare: lasare });
    expect(lasare).toHaveBeenCalledTimes(1);
    const knapp = within(sektion(container)).getByRole("button", { name: /docs/ });
    expect(knapp.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(knapp);
    await waitFor(() => expect(within(sektion(container)).queryByText("plan.md")).not.toBeNull());
    expect(knapp.getAttribute("aria-expanded")).toBe("true");
    expect(lasare).toHaveBeenLastCalledWith({ plats: PLATS, sokvag: "docs" });
    // Mappen öppnades på plats: projektets mapp står kvar med sin fil, och plan.md står under docs.
    expect(within(sektion(container)).getByText("README.md")).toBeTruthy();
    const docsRad = /** @type {HTMLElement} */ (knapp.closest("[data-bibliotek-repo-rad]"));
    expect(within(docsRad).getByText("plan.md")).toBeTruthy();
    fireEvent.click(knapp);
    expect(within(sektion(container)).queryByText("plan.md")).toBeNull();
    fireEvent.click(knapp);
    await waitFor(() => expect(within(sektion(container)).queryByText("plan.md")).not.toBeNull());
    expect(lasare).toHaveBeenCalledTimes(3);
    for (const [f] of lasare.mock.calls) expect(f.sokvag.startsWith("..") || f.sokvag.startsWith("/")).toBe(false);
  });

  it("varje mapp har sitt eget läge: en undermapp som saknas säger det vid mappen, och resten står kvar", async () => {
    const lasare = vi.fn(async (/** @type {any} */ f) => (f.sokvag === "" ? { lage: "last", poster: [{ namn: "borta", sokvag: "borta", sort: "mapp" }, { namn: "hemlig", sokvag: "hemlig", sort: "mapp" }, { namn: "trasig", sokvag: "trasig", sort: "mapp" }] } : f.sokvag === "borta" ? { lage: "saknas" } : f.sokvag === "hemlig" ? { lage: "obehorig" } : Promise.reject(new Error("nätet"))));
    const { container } = await visaUtfalld({ repoLasare: lasare });
    for (const namn of ["borta", "hemlig", "trasig"]) fireEvent.click(within(sektion(container)).getByRole("button", { name: namn }));
    await waitFor(() => expect(container.querySelector('[data-bibliotek-repo-mapp="trasig"]')?.getAttribute("data-bibliotek-repo-lage")).toBe("fel"));
    expect(container.querySelector('[data-bibliotek-repo-mapp="borta"]')?.textContent).toBe("Mappen finns inte i repot.");
    expect(container.querySelector('[data-bibliotek-repo-mapp="hemlig"]')?.textContent).toBe("GitHub-kopplingen når inte mappen.");
    expect(container.querySelector('[data-bibliotek-repo-mapp="trasig"]')?.textContent).toBe("Det gick inte att läsa mappen just nu.");
    expect(container.querySelector('[data-bibliotek-repo-mapp="trasig"]')?.getAttribute("role")).toBe("alert");
    expect(within(sektion(container)).getAllByRole("button", { name: /borta|hemlig|trasig/ }).length).toBe(3);
  });

  it(`indraget växer per nivå och stannar efter ${REPO_INDRAG_MAX} nivåer`, async () => {
    const { container } = await visaUtfalld({ repoLasare: vi.fn(djupt) });
    for (const namn of ["a", "b", "c", "d", "e"]) {
      await waitFor(() => expect(within(sektion(container)).queryByRole("button", { name: namn })).not.toBeNull());
      fireEvent.click(within(sektion(container)).getByRole("button", { name: namn }));
    }
    await waitFor(() => expect(within(sektion(container)).queryByText("slut.md")).not.toBeNull());
    /** Indragets klass för raden på en nivå. @param {number} niva */
    const indrag = (niva) => {
      const rad = /** @type {HTMLElement} */ (container.querySelector(`[data-bibliotek-repo-rad][data-bibliotek-repo-niva="${niva}"]`));
      const el = rad.getAttribute("data-bibliotek-repo-rad") === "mapp" ? /** @type {HTMLElement} */ (rad.firstElementChild) : rad;
      return [...el.classList].filter((k) => /^pl-/.test(k)).join(" ");
    };
    const per = [0, 1, 2, 3, 4, 5].map(indrag);
    // Golv: varje nivå ritades.
    expect(per.every((k) => k !== "")).toBe(true);
    expect(new Set(per.slice(0, 4)).size).toBe(4);
    expect(per[4]).toBe(per[3]);
    expect(per[5]).toBe(per[3]);
  });

  it("en post med en väg som går uppåt eller är absolut ritas inte", async () => {
    const lasare = async () => ({ lage: "last", poster: [{ namn: "upp", sokvag: "../annat", sort: "mapp" }, { namn: "rot", sokvag: "/etc", sort: "mapp" }, { namn: "ok", sokvag: "ok", sort: "mapp" }] });
    const { container } = await visaUtfalld({ repoLasare: lasare });
    expect(container.querySelectorAll("[data-bibliotek-repo-rad]").length).toBe(1);
    expect(within(sektion(container)).queryByText("upp")).toBeNull();
  });

  it("en fil öppnar läsläget genom githubLasare, med adressen och platsen och utan id, och Tillbaka kommer till samma utfällda träd", async () => {
    const githubLasare = vi.fn(async () => ({ lage: "last", text: "# Hej" }));
    const lasare = vi.fn(repo);
    const { container } = await visaUtfalld({ repoLasare: lasare, githubLasare });
    fireEvent.click(within(sektion(container)).getByRole("button", { name: /docs/ }));
    await waitFor(() => expect(within(sektion(container)).queryByText("plan.md")).not.toBeNull());
    fireEvent.click(within(sektion(container)).getByRole("button", { name: /^README\.md/ }));
    await waitFor(() => expect(container.querySelector('[data-github-dokument="markdown"]')).not.toBeNull());
    expect(githubLasare).toHaveBeenCalledTimes(1);
    const post = /** @type {any} */ (githubLasare.mock.calls[0])[0];
    expect(post.url).toBe(urlFor("README.md"));
    expect(post.groupId).toBe(PLATS);
    expect(post.typ).toBe("lank");
    expect(post.id).toBeUndefined();
    fireEvent.click(within(/** @type {HTMLElement} */ (container.querySelector("[data-bibliotek-repo-fil]"))).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-fil]")).toBeNull());
    // docs är fortfarande utfälld, och ingen ny läsning skedde.
    expect(within(sektion(container)).getByText("plan.md")).toBeTruthy();
    expect(lasare).toHaveBeenCalledTimes(2);
  });

  it("utan githubLasare är en fil en länk till github.com i en ny flik", async () => {
    const { container } = await visaUtfalld({ repoLasare: repo });
    const a = /** @type {HTMLAnchorElement} */ (within(sektion(container)).getByRole("link", { name: /README\.md/ }));
    expect(a.getAttribute("href")).toBe(urlFor("README.md"));
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("en tom mapp har en rad, och taket säger att det finns fler", async () => {
    const a = visa({ repoLasare: async () => ({ lage: "last", poster: [], fler: false }) });
    fallUt(a.container);
    await waitFor(() => expect(a.container.querySelector('[data-bibliotek-repo-lage="tom"]')).not.toBeNull());
    expect(a.container.querySelector('[data-bibliotek-repo-lage="tom"]')?.textContent).toBe("Mappen är tom.");
    a.unmount();
    const b = visa({ repoLasare: async () => ({ lage: "last", poster: [{ namn: "a.md", sokvag: "a.md", sort: "fil", url: urlFor("a.md") }], fler: true }) });
    fallUt(b.container);
    await waitFor(() => expect(b.container.querySelector("[data-bibliotek-repo-fler]")).not.toBeNull());
    expect(b.container.querySelector("[data-bibliotek-repo-fler]")?.textContent).toBe("Visar de första 1. Fler finns i mappen i repot.");
  });

  it.each([
    ["saknas", "Mappen finns inte i repot.", "status"],
    ["obehorig", "GitHub-kopplingen når inte mappen.", "status"],
    ["fel", "Det gick inte att läsa mappen just nu.", "alert"],
  ])("läget %s har sin mening", async (lage, text, roll) => {
    const { container } = visa({ repoLasare: async () => ({ lage }) });
    fallUt(container);
    await waitFor(() => expect(container.querySelector(`[data-bibliotek-repo-lage="${lage}"]`)).not.toBeNull());
    const p = /** @type {HTMLElement} */ (container.querySelector(`[data-bibliotek-repo-lage="${lage}"]`));
    expect(p.textContent).toBe(text);
    expect(p.getAttribute("role")).toBe(roll);
  });

  it("ett avvisat löfte och ett okänt läge ritas som fel", async () => {
    const a = visa({ repoLasare: () => Promise.reject(new Error("nätet")) });
    fallUt(a.container);
    await waitFor(() => expect(a.container.querySelector('[data-bibliotek-repo-lage="fel"]')).not.toBeNull());
    a.unmount();
    const b = visa({ repoLasare: async () => ({ lage: "konstigt" }) });
    fallUt(b.container);
    await waitFor(() => expect(b.container.querySelector('[data-bibliotek-repo-lage="fel"]')).not.toBeNull());
  });

  it("på engelska", async () => {
    const { container } = render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats={PLATS} onPlats={() => {}} repoLasare={async () => ({ lage: "last", poster: [], fler: false })} />
      </OpsSprakProvider>,
    );
    expect(within(sektion(container)).getByRole("heading", { name: "In the repo" })).toBeTruthy();
    fallUt(container);
    await waitFor(() => expect(container.querySelector('[data-bibliotek-repo-lage="tom"]')).not.toBeNull());
    expect(container.querySelector('[data-bibliotek-repo-lage="tom"]')?.textContent).toBe("The folder is empty.");
  });
});

describe("⋮ på en fil (0.209.0)", () => {
  /** @param {HTMLElement} c @param {string} namn */
  const oppnaMeny = (c, namn) => fireEvent.click(within(sektion(c)).getByRole("button", { name: `Åtgärder för ${namn}` }));

  it("har Lägg i Biblioteket och Öppna i GitHub, och ingen knapp på raden", async () => {
    const { container } = await visaUtfalld({ repoLasare: repo, onLaggRepoFil: vi.fn(async () => ({})) });
    expect(within(sektion(container)).queryByRole("button", { name: /^Lägg .* i Biblioteket$/ })).toBeNull();
    // En mapp har ingen meny, bara filen.
    expect(within(sektion(container)).queryByRole("button", { name: "Åtgärder för docs" })).toBeNull();
    oppnaMeny(container, "README.md");
    const rader = screen.getAllByRole("menuitem").map((m) => m.textContent);
    expect(rader).toEqual(["Lägg i Biblioteket", "Öppna i GitHub"]);
  });

  it("Lägg i Biblioteket anropar onLaggRepoFil med platsen, sökvägen, adressen och namnet, och säger att det gick", async () => {
    const onLaggRepoFil = vi.fn(async () => ({ id: "gh-1" }));
    const { container } = await visaUtfalld({ repoLasare: repo, onLaggRepoFil });
    oppnaMeny(container, "README.md");
    fireEvent.click(screen.getByRole("menuitem", { name: "Lägg i Biblioteket" }));
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lagd]")).not.toBeNull());
    expect(onLaggRepoFil).toHaveBeenCalledWith({ plats: PLATS, sokvag: "README.md", url: urlFor("README.md"), namn: "README.md" });
    expect(container.querySelector("[data-bibliotek-repo-lagd]")?.textContent).toBe("Lagd i Biblioteket.");
    // Lagd en gång: valet finns inte kvar, så ingen lägger samma fil två gånger av misstag.
    oppnaMeny(container, "README.md");
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Öppna i GitHub"]);
  });

  it("ett nej från onLaggRepoFil står vid filen med sitt meddelande", async () => {
    const onLaggRepoFil = vi.fn(async () => {
      throw new Error("Du får inte lägga filen här.");
    });
    const { container } = await visaUtfalld({ repoLasare: repo, onLaggRepoFil });
    oppnaMeny(container, "README.md");
    fireEvent.click(screen.getByRole("menuitem", { name: "Lägg i Biblioteket" }));
    await waitFor(() => expect(within(sektion(container)).queryByRole("alert")).not.toBeNull());
    expect(within(sektion(container)).getByRole("alert").textContent).toBe("Du får inte lägga filen här.");
    expect(container.querySelector("[data-bibliotek-repo-lagd]")).toBeNull();
  });

  it("Öppna i GitHub öppnar filens adress i en ny flik utan att appen går att nå därifrån", async () => {
    const oppna = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = await visaUtfalld({ repoLasare: repo });
    oppnaMeny(container, "README.md");
    fireEvent.click(screen.getByRole("menuitem", { name: "Öppna i GitHub" }));
    expect(oppna).toHaveBeenCalledWith(urlFor("README.md"), "_blank", "noopener,noreferrer");
  });

  it("utan onLaggRepoFil har menyn bara Öppna i GitHub, och utan adress har filen ingen meny", async () => {
    const { container } = await visaUtfalld({ repoLasare: async () => ({ lage: "last", poster: [{ namn: "README.md", sokvag: "README.md", sort: "fil", url: urlFor("README.md") }, { namn: "lokal.txt", sokvag: "lokal.txt", sort: "fil" }] }) });
    oppnaMeny(container, "README.md");
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Öppna i GitHub"]);
    expect(within(sektion(container)).queryByRole("button", { name: "Åtgärder för lokal.txt" })).toBeNull();
  });
});

/*
 * Läs om, när det lästes och mappen i repot (0.216.0, cllp/lifehub.app#775 och #774 punkt 2).
 * ⛔ RÖTT UTAN 0.216.0 (mätt mot 0.215.0): det finns ingen knapp Läs om, ingen rad med tiden och ingen rad med mappen i repot, och en fil som läggs till i repot syns inte
 *   förrän raden fälls ihop och ut igen: projektets mapp läses en gång och aldrig mer.
 */
describe("Läs om och när det lästes (0.216.0)", () => {
  /** Ett repo som ändras när provet säger det (`lasare.andrat = true`): då har projektets mapp en fil till, och docs en fil till. Varje mapp läser för sig, i den ordning React kör dem. */
  function vaxande() {
    const lasare = Object.assign(vi.fn(async (/** @type {{ plats: string, sokvag: string }} */ f) => {
      const andrat = lasare.andrat;
      if (f.sokvag === "") {
        const poster = [{ namn: "docs", sokvag: "docs", sort: "mapp" }, { namn: "README.md", sokvag: "README.md", sort: "fil", url: urlFor("README.md") }];
        if (andrat) poster.push({ namn: "NY.md", sokvag: "NY.md", sort: "fil", url: urlFor("NY.md") });
        return { lage: "last", poster, fler: false, hamtad: andrat ? "2026-11-11T10:05:00.000Z" : "2026-11-11T09:42:00.000Z", kalla: { repo: "cllp/lifehub.app", mapp: "projekt/lifehub", url: "https://github.com/cllp/lifehub.app/tree/HEAD/projekt/lifehub" } };
      }
      if (f.sokvag === "docs") return { lage: "last", poster: [{ namn: "plan.md", sokvag: "docs/plan.md", sort: "fil" }, ...(andrat ? [{ namn: "andra.md", sokvag: "docs/andra.md", sort: "fil" }] : [])] };
      return { lage: "saknas" };
    }), { andrat: false });
    return lasare;
  }

  it("Läs om läser projektets mapp och den utfällda undermappen igen, och det nya syns utan att trädet fälls ihop", async () => {
    const lasare = vaxande();
    const { container } = await visaUtfalld({ repoLasare: lasare });
    const s = sektion(container);
    fireEvent.click(within(s).getByRole("button", { name: /docs/ }));
    await waitFor(() => expect(within(s).queryByText("plan.md")).not.toBeNull());
    expect(within(s).queryByText("NY.md")).toBeNull();
    expect(lasare).toHaveBeenCalledTimes(2);

    lasare.andrat = true;
    fireEvent.click(within(s).getByRole("button", { name: "Läs om mapparna från GitHub" }));
    await waitFor(() => expect(within(s).queryByText("NY.md")).not.toBeNull());
    await waitFor(() => expect(within(s).queryByText("andra.md")).not.toBeNull());
    expect(lasare).toHaveBeenCalledTimes(4);
    expect(lasare.mock.calls.slice(2).map(([f]) => f.sokvag).sort()).toEqual(["", "docs"]);
    // Utfällningen står kvar, och raderna stod kvar medan det lästes om (ingen väntan i stället för listan).
    expect(within(s).getByRole("button", { name: /docs/ }).getAttribute("aria-expanded")).toBe("true");
    expect(within(s).getByText("README.md")).toBeTruthy();
  });

  it("raderna står kvar medan Läs om väntar, och knappen är upptagen tills projektets mapp svarat", async () => {
    let svara = /** @type {(v: any) => void} */ (() => {});
    let forsta = true;
    const lasare = vi.fn((/** @type {any} */ f) => {
      if (forsta) {
        forsta = false;
        return repo(f);
      }
      return new Promise((r) => {
        svara = r;
      });
    });
    const { container } = await visaUtfalld({ repoLasare: lasare });
    const s = sektion(container);
    const knapp = within(s).getByRole("button", { name: "Läs om mapparna från GitHub" });
    fireEvent.click(knapp);
    await waitFor(() => expect(knapp.getAttribute("aria-busy")).toBe("true"));
    expect(within(s).getByText("README.md")).toBeTruthy();
    expect(s.querySelector('[data-bibliotek-repo-lage="hamtar"]')).toBeNull();
    await act(async () => {
      svara({ lage: "last", poster: [{ namn: "NY.md", sokvag: "NY.md", sort: "fil" }], fler: false });
    });
    await waitFor(() => expect(knapp.getAttribute("aria-busy")).not.toBe("true"));
    expect(within(s).getByText("NY.md")).toBeTruthy();
    expect(within(s).queryByText("README.md")).toBeNull();
  });

  it("tiden är appens hamtad, och den följer med en ny läsning", async () => {
    const lasare = vaxande();
    const { container } = await visaUtfalld({ repoLasare: lasare });
    const s = sektion(container);
    const tid = () => /** @type {HTMLElement | null} */ (s.querySelector("[data-bibliotek-repo-hamtad]"));
    await waitFor(() => expect(tid()).not.toBeNull());
    expect(tid()?.getAttribute("data-bibliotek-repo-hamtad")).toBe("2026-11-11T09:42:00.000Z");
    expect(tid()?.textContent).toMatch(/^Hämtad från GitHub \d{1,2} nov \d\d:42$/);
    lasare.andrat = true;
    fireEvent.click(within(s).getByRole("button", { name: "Läs om mapparna från GitHub" }));
    await waitFor(() => expect(tid()?.getAttribute("data-bibliotek-repo-hamtad")).toBe("2026-11-11T10:05:00.000Z"));
  });

  it("utan hamtad är tiden när svaret kom fram, och ett avvisat löfte har ingen tid", async () => {
    const fore = Date.now();
    const { container, unmount } = await visaUtfalld({ repoLasare: repo });
    const el = /** @type {HTMLElement | null} */ (sektion(container).querySelector("[data-bibliotek-repo-hamtad]"));
    await waitFor(() => expect(el ?? sektion(container).querySelector("[data-bibliotek-repo-hamtad]")).not.toBeNull());
    const ms = Date.parse(String(sektion(container).querySelector("[data-bibliotek-repo-hamtad]")?.getAttribute("data-bibliotek-repo-hamtad")));
    expect(ms).toBeGreaterThanOrEqual(fore - 1000);
    expect(ms).toBeLessThanOrEqual(Date.now() + 1000);
    unmount();
    const b = visa({ repoLasare: () => Promise.reject(new Error("nätet")) });
    fallUt(b.container);
    await waitFor(() => expect(b.container.querySelector('[data-bibliotek-repo-lage="fel"]')).not.toBeNull());
    expect(sektion(b.container).querySelector("[data-bibliotek-repo-hamtad]")).toBeNull();
    b.unmount();
    // ⛔ Granskningen av PR 575: ett LÖST svar med läget fel är inte heller en läsning. Förut stod "Hämtad från GitHub" bredvid felraden.
    const c = visa({ repoLasare: async () => ({ lage: "fel", hamtad: "2026-11-11T10:05:00.000Z", kalla: { repo: "cllp/tam", mapp: "" } }) });
    fallUt(c.container);
    await waitFor(() => expect(c.container.querySelector('[data-bibliotek-repo-lage="fel"]')).not.toBeNull());
    expect(sektion(c.container).querySelector("[data-bibliotek-repo-hamtad]")).toBeNull();
    expect(sektion(c.container).textContent).not.toMatch(/Hämtad från GitHub/);
    // Statusraden finns ändå, tom, så att den första tiden läses upp när den kommer.
    expect(sektion(c.container).querySelector('[data-bibliotek-repo-huvud] [role="status"]')).not.toBeNull();
    c.unmount();
    const d = visa({ repoLasare: () => Promise.reject(new Error("nätet")) });
    fallUt(d.container);
    await waitFor(() => expect(d.container.querySelector('[data-bibliotek-repo-lage="fel"]')).not.toBeNull());
    const b2 = d;
    // Läs om finns också efter ett fel: det är där den behövs mest.
    expect(within(sektion(b2.container)).getByRole("button", { name: "Läs om mapparna från GitHub" })).toBeTruthy();
  });

  it("mappen i repot står överst och länkar till mappen på github.com, och hela repot säger det", async () => {
    const { container, unmount } = await visaUtfalld({ repoLasare: vaxande() });
    await waitFor(() => expect(sektion(container).querySelector("[data-bibliotek-repo-kalla]")).not.toBeNull());
    const kalla = /** @type {HTMLElement} */ (sektion(container).querySelector("[data-bibliotek-repo-kalla]"));
    expect(kalla.textContent).toBe("Mappen i repot: cllp/lifehub.app/projekt/lifehub");
    const a = /** @type {HTMLAnchorElement} */ (kalla.querySelector("a"));
    expect(a.getAttribute("href")).toBe("https://github.com/cllp/lifehub.app/tree/HEAD/projekt/lifehub");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    unmount();
    const hela = await visaUtfalld({ repoLasare: async () => ({ lage: "last", poster: [{ namn: "x.md", sokvag: "x.md", sort: "fil" }], kalla: { repo: "cllp/tam", mapp: "" } }) });
    await waitFor(() => expect(sektion(hela.container).querySelector("[data-bibliotek-repo-kalla]")).not.toBeNull());
    const k2 = /** @type {HTMLElement} */ (sektion(hela.container).querySelector("[data-bibliotek-repo-kalla]"));
    expect(k2.textContent).toBe("Mappen i repot: cllp/tam (hela repot)");
    expect(k2.querySelector("a")).toBeNull();
  });

  it("⛔ en kalla med fel form, en väg uppåt eller en adress utanför github.com ritas inte som länk eller inte alls", async () => {
    const fall = [
      [{ repo: "cllp/tam", mapp: "../hemligt" }, null],
      [{ repo: "inte ett repo", mapp: "a" }, null],
      [{ repo: "cllp/tam", mapp: "a", url: "https://elak.example/a" }, "a"],
      [{ repo: "cllp/tam", mapp: "a", url: "javascript:alert(1)" }, "a"],
      [{ repo: "cllp/tam", mapp: "a", url: "//github.com/cllp/tam" }, "a"],
      [{ repo: "cllp/tam", mapp: "a", url: "https://github.com.evil.com/cllp/tam" }, "a"],
      [{ repo: "../..", mapp: "" }, null],
      [{ repo: "cllp/..", mapp: "a" }, null],
      [null, null],
      ["text", null],
    ];
    for (const [kalla, lank] of fall) {
      const r = visa({ repoLasare: async () => ({ lage: "last", poster: [{ namn: "x.md", sokvag: "x.md", sort: "fil" }], kalla }) });
      fallUt(r.container);
      await waitFor(() => expect(within(sektion(r.container)).queryByText("x.md")).not.toBeNull());
      const k = sektion(r.container).querySelector("[data-bibliotek-repo-kalla]");
      if (lank === null) expect(k, JSON.stringify(kalla)).toBeNull();
      else {
        expect(k?.textContent).toBe("Mappen i repot: cllp/tam/a");
        expect(k?.querySelector("a")).toBeNull();
      }
      r.unmount();
      try {
        globalThis.localStorage?.clear();
      } catch {
        // Testmiljön har lagring.
      }
    }
  });

  it("på engelska", async () => {
    const r = render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats={PLATS} onPlats={() => {}} repoLasare={vaxande()} />
      </OpsSprakProvider>,
    );
    fallUt(r.container);
    await waitFor(() => expect(sektion(r.container).querySelector("[data-bibliotek-repo-hamtad]")).not.toBeNull());
    expect(sektion(r.container).querySelector("[data-bibliotek-repo-hamtad]")?.textContent).toMatch(/^Fetched from GitHub \d{1,2} Nov \d\d:42$/);
    expect(sektion(r.container).querySelector("[data-bibliotek-repo-kalla]")?.textContent).toBe("Folder in the repo: cllp/lifehub.app/projekt/lifehub");
    expect(within(sektion(r.container)).getByRole("button", { name: "Reload the folders from GitHub" }).textContent).toContain("Reload");
  });
});
