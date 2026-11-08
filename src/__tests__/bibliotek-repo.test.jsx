import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { githubDokumentUrl } from "../lib/githubdokument.js";

/*
 * "I repot" på ett projekts plats (0.205.0, cllp/lifehub.app#653 skiva 3).
 * ⛔ RÖTT UTAN ÄNDRINGEN: `repoLasare` finns inte i OpsBibliotek, så ingen sektion ritas och läsaren anropas aldrig.
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

/** @param {Record<string, any>} [extra] */
function visa(extra = {}) {
  return render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats={PLATS} onPlats={() => {}} {...extra} />);
}

const sektion = (/** @type {HTMLElement} */ c) => /** @type {HTMLElement} */ (c.querySelector("[data-bibliotek-repo]"));

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

describe("med repoLasare", () => {
  it("syns på en egen plats och läser projektets mapp (sokvag tom)", async () => {
    const lasare = vi.fn(repo);
    const { container } = visa({ repoLasare: lasare });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    expect(lasare).toHaveBeenCalledWith({ plats: PLATS, sokvag: "" });
    const s = sektion(container);
    expect(within(s).getByRole("heading", { name: "I repot" })).toBeTruthy();
    expect(within(s).getByText("README.md")).toBeTruthy();
    expect(within(s).getByText("2 kB")).toBeTruthy();
    expect(s.querySelectorAll("[data-bibliotek-repo-rad]").length).toBe(2);
  });

  it("syns inte på gruppens eget bibliotek, Mitt bibliotek eller i en inbäddad lista", () => {
    const lasare = vi.fn(repo);
    const a = render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats="cps-ab" onPlats={() => {}} repoLasare={lasare} />);
    expect(a.container.querySelector("[data-bibliotek-repo]")).toBeNull();
    a.unmount();
    const b = render(<OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" inbaddad repoLasare={lasare} />);
    expect(b.container.querySelector("[data-bibliotek-repo]")).toBeNull();
    expect(lasare).not.toHaveBeenCalled();
  });

  it("väntar synligt medan mappen hämtas", async () => {
    const { container } = visa({ repoLasare: () => new Promise(() => {}) });
    await waitFor(() => expect(container.querySelector('[data-bibliotek-repo-lage="hamtar"]')).not.toBeNull());
    const v = /** @type {HTMLElement} */ (container.querySelector('[data-bibliotek-repo-lage="hamtar"]'));
    expect(v.getAttribute("aria-busy")).toBe("true");
    expect(v.textContent).toContain("Hämtar mappen från GitHub.");
  });

  it("en mapp öppnas i sektionen, och Tillbaka och brödsmulan stannar i projektets mapp", async () => {
    const lasare = vi.fn(repo);
    const { container } = visa({ repoLasare: lasare });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    // I projektets mapp finns ingen Tillbaka: det finns inget ovanför att gå till.
    expect(container.querySelector("[data-bibliotek-repo-tillbaka]")).toBeNull();
    fireEvent.click(within(sektion(container)).getByRole("button", { name: /docs/ }));
    await waitFor(() => expect(within(sektion(container)).queryByText("plan.md")).not.toBeNull());
    expect(lasare).toHaveBeenLastCalledWith({ plats: PLATS, sokvag: "docs" });
    const smula = /** @type {HTMLElement} */ (container.querySelector("[data-bibliotek-repo-smula]"));
    expect(smula.textContent).toContain("Projektets mapp");
    expect(smula.textContent).toContain("docs");
    fireEvent.click(within(/** @type {HTMLElement} */ (container.querySelector("[data-bibliotek-repo-tillbaka]"))).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(within(sektion(container)).queryByText("README.md")).not.toBeNull());
    expect(lasare).toHaveBeenLastCalledWith({ plats: PLATS, sokvag: "" });
    expect(container.querySelector("[data-bibliotek-repo-tillbaka]")).toBeNull();
    // Brödsmulans rot är inte en knapp när man står i den: det finns ingen väg uppåt.
    expect(within(smula).queryByRole("button", { name: "Projektets mapp" })).toBeNull();
    // Inget anrop gick någonsin ovanför projektets mapp.
    for (const [f] of lasare.mock.calls) expect(f.sokvag.startsWith("..") || f.sokvag.startsWith("/")).toBe(false);
  });

  it("brödsmulans rot går tillbaka till projektets mapp från en undermapp", async () => {
    const lasare = vi.fn(repo);
    const { container } = visa({ repoLasare: lasare });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    fireEvent.click(within(sektion(container)).getByRole("button", { name: /docs/ }));
    await waitFor(() => expect(within(sektion(container)).queryByText("plan.md")).not.toBeNull());
    fireEvent.click(within(/** @type {HTMLElement} */ (container.querySelector("[data-bibliotek-repo-smula]"))).getByRole("button", { name: "Projektets mapp" }));
    await waitFor(() => expect(lasare).toHaveBeenLastCalledWith({ plats: PLATS, sokvag: "" }));
  });

  it("en post med en väg som går uppåt eller är absolut ritas inte", async () => {
    const lasare = async () => ({ lage: "last", poster: [{ namn: "upp", sokvag: "../annat", sort: "mapp" }, { namn: "rot", sokvag: "/etc", sort: "mapp" }, { namn: "ok", sokvag: "ok", sort: "mapp" }] });
    const { container } = visa({ repoLasare: lasare });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    expect(container.querySelectorAll("[data-bibliotek-repo-rad]").length).toBe(1);
    expect(within(sektion(container)).queryByText("upp")).toBeNull();
  });

  it("en fil öppnar läsläget genom githubLasare, med adressen och platsen och utan id", async () => {
    const githubLasare = vi.fn(async () => ({ lage: "last", text: "# Hej" }));
    const { container } = visa({ repoLasare: repo, githubLasare });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    fireEvent.click(within(sektion(container)).getByRole("button", { name: /README\.md/ }));
    await waitFor(() => expect(container.querySelector('[data-github-dokument="markdown"]')).not.toBeNull());
    expect(githubLasare).toHaveBeenCalledTimes(1);
    const post = /** @type {any} */ (githubLasare.mock.calls[0])[0];
    expect(post.url).toBe(urlFor("README.md"));
    expect(post.groupId).toBe(PLATS);
    expect(post.typ).toBe("lank");
    expect(post.id).toBeUndefined();
    // Tillbaka från filen går till mappen.
    fireEvent.click(within(/** @type {HTMLElement} */ (container.querySelector("[data-bibliotek-repo-fil]"))).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
  });

  it("utan githubLasare är en fil en länk till github.com i en ny flik", async () => {
    const { container } = visa({ repoLasare: repo });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    const a = /** @type {HTMLAnchorElement} */ (within(sektion(container)).getByRole("link", { name: /README\.md/ }));
    expect(a.getAttribute("href")).toBe(urlFor("README.md"));
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("Lägg i Biblioteket anropar onLaggRepoFil med platsen, sökvägen, adressen och namnet, och säger att det gick", async () => {
    const onLaggRepoFil = vi.fn(async () => ({ id: "gh-1" }));
    const { container } = visa({ repoLasare: repo, onLaggRepoFil });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    // En mapp har inget sådant val, bara filen.
    expect(within(sektion(container)).getAllByRole("button", { name: /Lägg .* i Biblioteket/ }).length).toBe(1);
    fireEvent.click(within(sektion(container)).getByRole("button", { name: "Lägg README.md i Biblioteket" }));
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lagd]")).not.toBeNull());
    expect(onLaggRepoFil).toHaveBeenCalledWith({ plats: PLATS, sokvag: "README.md", url: urlFor("README.md"), namn: "README.md" });
    expect(container.querySelector("[data-bibliotek-repo-lagd]")?.textContent).toBe("Lagd i Biblioteket.");
  });

  it("ett nej från onLaggRepoFil står vid filen med sitt meddelande", async () => {
    const onLaggRepoFil = vi.fn(async () => {
      throw new Error("Du får inte lägga filen här.");
    });
    const { container } = visa({ repoLasare: repo, onLaggRepoFil });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    fireEvent.click(within(sektion(container)).getByRole("button", { name: "Lägg README.md i Biblioteket" }));
    await waitFor(() => expect(within(sektion(container)).queryByRole("alert")).not.toBeNull());
    expect(within(sektion(container)).getByRole("alert").textContent).toBe("Du får inte lägga filen här.");
    expect(container.querySelector("[data-bibliotek-repo-lagd]")).toBeNull();
  });

  it("utan onLaggRepoFil finns inget Lägg i Biblioteket", async () => {
    const { container } = visa({ repoLasare: repo });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-repo-lista]")).not.toBeNull());
    expect(within(sektion(container)).queryByRole("button", { name: /i Biblioteket/ })).toBeNull();
  });

  it("en tom mapp har en rad, och taket säger att det finns fler", async () => {
    const a = visa({ repoLasare: async () => ({ lage: "last", poster: [], fler: false }) });
    await waitFor(() => expect(a.container.querySelector('[data-bibliotek-repo-lage="tom"]')).not.toBeNull());
    expect(a.container.querySelector('[data-bibliotek-repo-lage="tom"]')?.textContent).toBe("Mappen är tom.");
    a.unmount();
    const b = visa({ repoLasare: async () => ({ lage: "last", poster: [{ namn: "a.md", sokvag: "a.md", sort: "fil", url: urlFor("a.md") }], fler: true }) });
    await waitFor(() => expect(b.container.querySelector("[data-bibliotek-repo-fler]")).not.toBeNull());
    expect(b.container.querySelector("[data-bibliotek-repo-fler]")?.textContent).toBe("Visar de första 1. Fler finns i mappen i repot.");
  });

  it.each([
    ["saknas", "Mappen finns inte i repot.", "status"],
    ["obehorig", "GitHub-kopplingen når inte mappen.", "status"],
    ["fel", "Det gick inte att läsa mappen just nu.", "alert"],
  ])("läget %s har sin mening", async (lage, text, roll) => {
    const { container } = visa({ repoLasare: async () => ({ lage }) });
    await waitFor(() => expect(container.querySelector(`[data-bibliotek-repo-lage="${lage}"]`)).not.toBeNull());
    const p = /** @type {HTMLElement} */ (container.querySelector(`[data-bibliotek-repo-lage="${lage}"]`));
    expect(p.textContent).toBe(text);
    expect(p.getAttribute("role")).toBe(roll);
  });

  it("ett avvisat löfte och ett okänt läge ritas som fel", async () => {
    const a = visa({ repoLasare: () => Promise.reject(new Error("nätet")) });
    await waitFor(() => expect(a.container.querySelector('[data-bibliotek-repo-lage="fel"]')).not.toBeNull());
    a.unmount();
    const b = visa({ repoLasare: async () => ({ lage: "konstigt" }) });
    await waitFor(() => expect(b.container.querySelector('[data-bibliotek-repo-lage="fel"]')).not.toBeNull());
  });

  it("på engelska", async () => {
    const { container } = render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" platser={PLATSER} plats={PLATS} onPlats={() => {}} repoLasare={async () => ({ lage: "last", poster: [], fler: false })} />
      </OpsSprakProvider>,
    );
    await waitFor(() => expect(container.querySelector('[data-bibliotek-repo-lage="tom"]')).not.toBeNull());
    expect(container.querySelector('[data-bibliotek-repo-lage="tom"]')?.textContent).toBe("The folder is empty.");
    expect(within(sektion(container)).getByRole("heading", { name: "In the repo" })).toBeTruthy();
  });
});
