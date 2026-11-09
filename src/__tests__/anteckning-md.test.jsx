import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { FILMIME, byggPost, filContentTypeMonster, filInmatningsfel, filMimeMonster, filTak, mimeUrFilnamn, normaliseraMime, MAX_BIBLIOTEKFIL } from "../lib/bibliotek.js";
import { bibliotekregelfragment, lagringsregelfragment } from "../lib/regler.js";
import { anteckningFilnamn, arMarkdownFilnamn, markdownSomAnteckning } from "../lib/anteckningsfil.js";
import { markdownSomHtml } from "../lib/markdownhtml.js";
import { sparaText } from "../lib/sparaFil.js";
import { blobBytes } from "../lib/blobbytes.js";

/** En Blobs text, UTF-8. jsdom har inte `Blob.text()`. @param {Blob} b */
const textUr = async (b) => new TextDecoder("utf-8").decode(await blobBytes(b));

/*
 * .md in som anteckning och anteckningen ut som .md, PDF och HTML (0.209.0, cllp/lifehub.app#706).
 * ⛔ RÖTT UTAN ÄNDRINGEN (mätt mot 0.208.0): `lib/anteckningsfil.js` och `lib/markdownhtml.js` finns inte, text/markdown står inte i FILMIME (en .md nekas med "Formatet ... går inte att lägga in"),
 * anteckningens meny har inga nedladdningsval, och en markdownfil ritas som en länk utan sin text.
 */

afterEach(() => vi.restoreAllMocks());

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };

/** @param {Record<string, any>} [extra] */
function anteckning(extra = {}) {
  return { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Plan", text: "# Plan\n\nHej **där**.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a1", ...extra };
}

/** @param {string} text @param {string} namn @param {string} [typ] */
const mdFil = (text, namn = "plan.md", typ = "") => new File([text], namn, { type: typ });

describe("text/markdown som filformat", () => {
  it("står i FILMIME, har namnet ur .md och .markdown, aliaset text/x-markdown och samma tak som text/plain", () => {
    expect(FILMIME).toContain("text/markdown");
    expect(mimeUrFilnamn("Plan.md")).toBe("text/markdown");
    expect(mimeUrFilnamn("plan.MARKDOWN")).toBe("text/markdown");
    expect(normaliseraMime("text/x-markdown")).toBe("text/markdown");
    expect(normaliseraMime("text/markdown; charset=utf-8")).toBe("text/markdown");
    expect(filTak("text/markdown")).toBe(filTak("text/plain"));
    expect(filTak("text/markdown")).toBe(MAX_BIBLIOTEKFIL);
    expect(filInmatningsfel({ namn: "plan.md", mime: "text/markdown", byte: 10 })).toBeNull();
  });

  it("regelfragmenten släpper in text/markdown, och lagringen med teckenkodning", () => {
    expect(filMimeMonster()).toContain("|text/markdown|");
    expect(filContentTypeMonster()).toContain("|text/markdown(; charset=utf-8)?|");
    expect(String(bibliotekregelfragment("bibliotek"))).toContain("text/markdown");
    expect(String(lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" } }))).toContain("text/markdown(; charset=utf-8)?");
  });
});

describe("markdownSomAnteckning", () => {
  it("rubriken är den första nivå-ett-rubriken, utan formateringstecken, och inte en i ett kodblock", () => {
    expect(markdownSomAnteckning({ namn: "x.md", text: "```\n# kommentar\n```\n\n## Under\n\n# Planen **2026**\n\ntext" }).rubrik).toBe("Planen 2026");
  });
  it("utan nivå-ett-rubrik är rubriken filnamnet utan ändelse, klippt till taket", () => {
    expect(markdownSomAnteckning({ namn: "Möte med Lars.md", text: "## bara nivå två\n\ntext" }).rubrik).toBe("Möte med Lars");
    expect(markdownSomAnteckning({ namn: `${"x".repeat(300)}.md`, text: "t" }).rubrik.length).toBe(200);
  });
  it("räknar bilder med sökväg och länkar som inte är http eller https, men inte i kod och inte säkra bildnamn", () => {
    const t = markdownSomAnteckning({ namn: "a.md", text: "![a](bilder/a.png) ![b](b.png) [x](../doc.md) [y](https://ex.se) `![k](k/k.png)`\n```\n[z](z.md)\n```" });
    expect(t.bilder).toBe(1);
    expect(t.lankar).toBe(1);
    expect(t.forLang).toBe(false);
  });
  it("en text över 50 000 tecken är för lång, och ett inledande BOM tas bort", () => {
    expect(markdownSomAnteckning({ namn: "a.md", text: "x".repeat(50001) }).forLang).toBe(true);
    expect(markdownSomAnteckning({ namn: "a.md", text: "x".repeat(50000) }).forLang).toBe(false);
    expect(markdownSomAnteckning({ namn: "a.md", text: "﻿# Hej" }).text).toBe("# Hej");
  });
  it("arMarkdownFilnamn och anteckningFilnamn", () => {
    expect(arMarkdownFilnamn("a.MD")).toBe(true);
    expect(arMarkdownFilnamn("a.markdown")).toBe(true);
    expect(arMarkdownFilnamn("a.txt")).toBe(false);
    expect(anteckningFilnamn('Plan: v1/v2 "ny"?', "md")).toBe("Plan_ v1_v2 _ny__.md");
    expect(anteckningFilnamn("Möte åäö", "html")).toBe("Möte åäö.html");
    expect(anteckningFilnamn("  ...  ", "pdf")).toBe("anteckning.pdf");
  });
});

describe("markdownSomHtml", () => {
  it("ritar blocken statiskt: rubriker, listor, kryssrutor, citat, kod, tabell, länkar, fet text och avdelare", () => {
    const html = markdownSomHtml("# Rubrik\n\nEtt **fett** och *kursivt* ord med [länk](https://ex.se).\n\n- [x] klart\n- [ ] kvar\n\n1. ett\n\n> citat\n\n```\nkod <b>\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n---", { titel: "Rubrik" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Rubrik</title>");
    expect(html).toContain("<h1>Rubrik</h1>");
    // Rubriken står inte två gånger när texten själv börjar med den.
    expect(html.match(/<h1>/g)?.length).toBe(1);
    expect(html).toContain("<strong>fett</strong>");
    expect(html).toContain("<em>kursivt</em>");
    expect(html).toContain('<a href="https://ex.se">länk</a>');
    expect(html).toContain('<input type="checkbox" disabled checked> klart');
    expect(html).toContain("<ol><li>ett</li></ol>");
    expect(html).toContain("<blockquote><p>citat</p></blockquote>");
    expect(html).toContain("<pre><code>kod &lt;b&gt;</code></pre>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>2</td>");
    expect(html).toContain("<hr>");
  });

  it("escapar allt användarinnehåll: en script-tagg blir text, och sidan har inget skript och ingen extern resurs", () => {
    const html = markdownSomHtml('<script>alert(1)</script>\n\n[x](javascript:alert(1)) ![a"b](bild.png) `<img src=x onerror=alert(1)>`', { titel: '<img src=x onerror="a">' });
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("javascript:alert(1)\"");
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain("&lt;img src=x onerror=&quot;a&quot;&gt;");
    expect(html).toContain('<span class="bild">[a&quot;b]</span>');
    expect(html).not.toMatch(/\b(src|href)="https?:\/\/(?!ex\.se)/);
    expect(html).not.toMatch(/<link|@import|url\(/i);
  });

  it("utan egen nivå-ett-rubrik står titeln som sidans rubrik", () => {
    const html = markdownSomHtml("Bara text.", { titel: "Plan" });
    expect(html).toContain("<h1>Plan</h1>");
    expect(html).toContain("<p>Bara text.</p>");
  });
});

describe("sparaText", () => {
  it("skapar en Blob med typen och en länk med filnamnet, och vägrar text/html", async () => {
    /** @type {Blob[]} */
    const blobbar = [];
    const url = { createObjectURL: vi.fn((/** @type {Blob} */ b) => (blobbar.push(b), "blob:x")), revokeObjectURL: vi.fn() };
    const klick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(sparaText({ text: "# Hej", typ: "text/markdown;charset=utf-8", namn: "Plan.md", url })).toBe(true);
    expect(blobbar[0].type).toBe("text/markdown;charset=utf-8");
    expect(await textUr(blobbar[0])).toBe("# Hej");
    expect(klick).toHaveBeenCalledTimes(1);
    expect(() => sparaText({ text: "<p>", typ: "text/html", namn: "a.html", url })).toThrow(/octet-stream/);
  });
});

/** Biblioteket med en ny fil på väg in. @param {Record<string, any>} [extra] */
function nyFil(extra = {}) {
  return render(<OpsBibliotek poster={[]} jag={JAG} skapar="fil" onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" {...extra} />);
}

/** @param {File} fil */
function valj(fil) {
  fireEvent.change(/** @type {HTMLInputElement} */ (document.querySelector('input[type="file"][aria-label="Fil"]')), { target: { files: [fil] } });
}
const spara = () => fireEvent.click(screen.getByRole("button", { name: "Spara" }));
const rubrikfalt = () => /** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" }));
const besked = () => document.querySelector("[data-bibliotek-import-besked]")?.textContent ?? null;

describe(".md in som anteckning", () => {
  it("rubriken föreslås ur # och anteckningen sparas genom onSpara, oavsett vad webbläsaren säger om typen", async () => {
    for (const typ of ["", "text/markdown", "text/x-markdown", "application/octet-stream"]) {
      const onSpara = vi.fn(async () => {});
      const onLaddaUpp = vi.fn();
      const r = nyFil({ onSpara, onLaddaUpp });
      valj(mdFil("# Planen\n\nText.", "plan.md", typ));
      await waitFor(() => expect(rubrikfalt().value).toBe("Planen"));
      spara();
      await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
      expect(onSpara).toHaveBeenCalledWith({ typ: "anteckning", rubrik: "Planen", text: "# Planen\n\nText." });
      expect(onLaddaUpp).not.toHaveBeenCalled();
      await waitFor(() => expect(besked()).toBe("Filen är inlagd som en anteckning."));
      r.unmount();
    }
  });

  it("utan # är rubriken filnamnet, och en rubrik personen skrivit vinner", async () => {
    const onSpara = vi.fn(async () => {});
    nyFil({ onSpara });
    valj(mdFil("Bara text.", "Möte.md"));
    await waitFor(() => expect(rubrikfalt().value).toBe("Möte"));
    fireEvent.change(rubrikfalt(), { target: { value: "Mitt namn" } });
    spara();
    await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ typ: "anteckning", rubrik: "Mitt namn", text: "Bara text." }));
  });

  it("beskedet säger att bilder och länkar med sökväg visas som text, och texten är orörd", async () => {
    const onSpara = vi.fn(async () => {});
    nyFil({ onSpara });
    const text = "# A\n\n![x](bilder/x.png) och [doc](../b.md)";
    valj(mdFil(text));
    await waitFor(() => expect(rubrikfalt().value).toBe("A"));
    spara();
    await waitFor(() => expect(besked()).toBe("Filen är inlagd som en anteckning. Bilder och länkar som pekar på andra filer visas som text."));
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].text).toBe(text);
  });

  it("finns en anteckning med samma rubrik frågar vyn i sin egen ruta: Ersätt sparar med dess id, Lägg in som ny utan, Avbryt sparar inget", async () => {
    const conf = vi.spyOn(window, "confirm");
    for (const val of ["Ersätt", "Lägg in som ny", "Avbryt"]) {
      const onSpara = vi.fn(async () => {});
      const r = nyFil({ onSpara, poster: [anteckning()] });
      valj(mdFil("# Plan\n\nNy text."));
      await waitFor(() => expect(rubrikfalt().value).toBe("Plan"));
      spara();
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Det finns redan en anteckning som heter Plan. Ersätta den, eller lägga in som ny?")).toBeTruthy();
      expect(onSpara).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: val }));
      if (val === "Avbryt") {
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(onSpara).not.toHaveBeenCalled();
      } else {
        await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
        expect(onSpara).toHaveBeenCalledWith({ typ: "anteckning", rubrik: "Plan", text: "# Plan\n\nNy text.", ...(val === "Ersätt" ? { id: "a1" } : {}) });
      }
      r.unmount();
    }
    expect(conf).not.toHaveBeenCalled();
  });

  it("en text över 50 000 tecken läggs in som fil med typen text/markdown, och beskedet säger varför", async () => {
    const onSpara = vi.fn();
    const onLaddaUpp = vi.fn(async () => {});
    nyFil({ onSpara, onLaddaUpp });
    valj(mdFil(`# Lång\n\n${"x".repeat(50001)}`, "lang.md", ""));
    await waitFor(() => expect(rubrikfalt().value).toBe("Lång"));
    spara();
    await waitFor(() => expect(onLaddaUpp).toHaveBeenCalledTimes(1));
    expect(onSpara).not.toHaveBeenCalled();
    const arg = /** @type {any} */ (onLaddaUpp.mock.calls[0])[0];
    expect(arg.rubrik).toBe("Lång");
    expect(arg.fil.name).toBe("lang.md");
    expect(arg.fil.type).toBe("text/markdown");
    await waitFor(() => expect(besked()).toBe("Texten är för lång för en anteckning (50 009 tecken, taket är 50 000). Den ligger som fil och går att läsa men inte redigera."));
  });

  it("en annan fil laddas upp som förut", async () => {
    const onSpara = vi.fn();
    const onLaddaUpp = vi.fn(async () => {});
    nyFil({ onSpara, onLaddaUpp });
    valj(new File(["hej"], "a.txt", { type: "text/plain" }));
    await waitFor(() => expect(rubrikfalt().value).toBe("a"));
    spara();
    await waitFor(() => expect(onLaddaUpp).toHaveBeenCalledTimes(1));
    expect(onSpara).not.toHaveBeenCalled();
    expect(besked()).toBeNull();
  });
});

/** Biblioteket med en anteckning öppen. @param {Record<string, any>} [extra] */
function oppen(extra = {}) {
  const post = anteckning();
  return render(<OpsBibliotek poster={[post]} vald={post} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" {...extra} />);
}
const meny = () => fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Plan" }));

describe("ladda ned en anteckning", () => {
  it("menyn har Markdown (.md), PDF och HTML i den ordningen, och inget med utanNedladdning", () => {
    const r = oppen();
    meny();
    const rader = screen.getAllByRole("menuitem").map((m) => m.textContent);
    const i = rader.indexOf("Ladda ned som Markdown (.md)");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(rader.slice(i, i + 3)).toEqual(["Ladda ned som Markdown (.md)", "Ladda ned som PDF", "Ladda ned som HTML"]);
    r.unmount();
    oppen({ utanNedladdning: true });
    meny();
    expect(screen.queryByRole("menuitem", { name: /Ladda ned som/ })).toBeNull();
  });

  it("Markdown sparar texten som den är med text/markdown och rubriken som filnamn, och HTML sparar sidan som application/octet-stream", async () => {
    /** @type {Blob[]} */
    const blobbar = [];
    // @ts-ignore jsdom har ingen createObjectURL.
    URL.createObjectURL = vi.fn((/** @type {Blob} */ b) => (blobbar.push(b), "blob:prov"));
    // @ts-ignore
    URL.revokeObjectURL = vi.fn();
    /** @type {string[]} */
    const namn = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      // @ts-ignore
      namn.push(this.download);
    });
    oppen();
    meny();
    fireEvent.click(screen.getByRole("menuitem", { name: "Ladda ned som Markdown (.md)" }));
    meny();
    fireEvent.click(screen.getByRole("menuitem", { name: "Ladda ned som HTML" }));
    expect(namn).toEqual(["Plan.md", "Plan.html"]);
    expect(blobbar[0].type).toBe("text/markdown;charset=utf-8");
    expect(await textUr(blobbar[0])).toBe("# Plan\n\nHej **där**.");
    expect(blobbar[1].type).toBe("application/octet-stream");
    const html = await textUr(blobbar[1]);
    expect(html).toContain("<strong>där</strong>");
    expect(html).toContain("<title>Plan</title>");
  });

  it("PDF ritar sidan i den avspärrade rutan med Spara som PDF", async () => {
    oppen();
    meny();
    fireEvent.click(screen.getByRole("menuitem", { name: "Ladda ned som PDF" }));
    const dialog = await screen.findByRole("dialog");
    const ruta = /** @type {HTMLIFrameElement} */ (await waitFor(() => {
      const r = dialog.querySelector("iframe[data-html-dokument-ruta]");
      if (!r) throw new Error("ingen ruta än");
      return r;
    }));
    expect(ruta.getAttribute("sandbox")).toBe("allow-scripts allow-modals");
    expect(ruta.getAttribute("src")).toBeNull();
    expect(ruta.getAttribute("srcdoc")).toContain("<strong>där</strong>");
    expect(within(dialog).getByRole("button", { name: "Spara som PDF" })).toBeTruthy();
  });

  it("på engelska", () => {
    const post = anteckning();
    render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[post]} vald={post} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />
      </OpsSprakProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions for Plan" }));
    expect(screen.getByRole("menuitem", { name: "Download as Markdown (.md)" })).toBeTruthy();
  });
});

describe("en markdownfil i detaljen", () => {
  it("ritas som markdown med hamtaFil, med samma tak som en textfil", async () => {
    const post = { ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Lång", fil: { sokvag: "g/a/lang.md", namn: "lang.md", mime: "text/markdown", byte: 20, klar: true }, skapadAv: skapare, skapad: tid, andrad: tid }), id: "f1" };
    const hamtaFil = vi.fn(async () => new Blob(["# Rubrik\n\n**fet**"]));
    const { container } = render(<OpsBibliotek poster={[post]} vald={post} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/lang.md"} hamtaFil={hamtaFil} />);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-text-markdown]")).not.toBeNull());
    const md = /** @type {HTMLElement} */ (container.querySelector("[data-bibliotek-text-markdown]"));
    expect(md.querySelector("strong")?.textContent).toBe("fet");
    expect(md.querySelector("pre")).toBeNull();
    expect(hamtaFil).toHaveBeenCalledWith("g/a/lang.md");
  });
});
