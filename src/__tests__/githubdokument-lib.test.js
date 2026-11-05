import { describe, expect, it } from "vitest";
import { GITHUB_LAGEN, GITHUB_SORTER, githubDokument, githubDokumentUrl, githubMarkdown } from "../lib/githubdokument.js";
import { lankKalla } from "../lib/lankkalla.js";

/*
 * Tolkningen av en adress till en fil i GitHub (0.186.0, cllp/lifehub.app#653).
 * ⛔ RÖTT UTAN ÄNDRINGEN: `src/lib/githubdokument.js` finns inte, så varje prov här fäller redan på importen.
 */

const A = "https://github.com/cllp/bolag-ops/blob/main/docs/rapport.md";

describe("githubDokument", () => {
  it("tolkar en giltig adress till sina delar, och sorten ur ändelsen", () => {
    expect(githubDokument(A)).toEqual({ agare: "cllp", repo: "bolag-ops", ref: "main", sokvag: "docs/rapport.md", namn: "rapport.md", andelse: "md", sort: "markdown" });
  });

  it("ignorerar query och fragment", () => {
    expect(githubDokument(`${A}?plain=1#L10`)?.sokvag).toBe("docs/rapport.md");
    expect(githubDokument(`${A}#L10`)?.namn).toBe("rapport.md");
  });

  it("avkodar varje segment", () => {
    const d = githubDokument("https://github.com/cllp/repo/blob/v1.0/m%C3%A5nad%20ett/%C3%A5r%20%C3%A4r.pdf");
    expect(d?.sokvag).toBe("månad ett/år är.pdf");
    expect(d?.namn).toBe("år är.pdf");
    expect(d?.sort).toBe("pdf");
  });

  it.each([
    ["en annan värd", "https://gitlab.com/cllp/repo/blob/main/a.md"],
    ["värd med efterhäng", "https://github.com.evil.se/cllp/repo/blob/main/a.md"],
    ["användaruppgift före värden", "https://github.com@evil.se/cllp/repo/blob/main/a.md"],
    ["http", "http://github.com/cllp/repo/blob/main/a.md"],
    ["www", "https://www.github.com/cllp/repo/blob/main/a.md"],
    ["tree i stället för blob", "https://github.com/cllp/repo/tree/main/docs"],
    ["raw", "https://raw.githubusercontent.com/cllp/repo/main/a.md"],
    ["utan sökväg", "https://github.com/cllp/repo/blob/main"],
    ["tom sökväg", "https://github.com/cllp/repo/blob/main/"],
    ["tomt segment", "https://github.com/cllp/repo/blob/main/a//b.md"],
    ["avslutande snedstreck", "https://github.com/cllp/repo/blob/main/a/"],
    ["dubbelpunkt", "https://github.com/cllp/repo/blob/main/a/../b.md"],
    ["kodad dubbelpunkt", "https://github.com/cllp/repo/blob/main/a/%2e%2e/b.md"],
    ["punkt", "https://github.com/cllp/repo/blob/main/a/./b.md"],
    ["kodat snedstreck", "https://github.com/cllp/repo/blob/main/a%2Fb.md"],
    ["omvänt snedstreck", "https://github.com/cllp/repo/blob/main/a%5Cb.md"],
    ["styrtecken", "https://github.com/cllp/repo/blob/main/a%00b.md"],
    ["felaktig avkodning", "https://github.com/cllp/repo/blob/main/%E0%A4%A.md"],
    ["ogiltigt ägarnamn", "https://github.com/c%20p/repo/blob/main/a.md"],
    ["ägaren är punkter", "https://github.com/../repo/blob/main/a.md"],
    ["repot är punkter", "https://github.com/cllp/../blob/main/a.md"],
    ["ref är dubbelpunkt", "https://github.com/cllp/repo/blob/../a.md"],
    ["inte en text", 42],
    ["null", null],
    ["tom text", ""],
  ])("ger null för %s", (_namn, url) => {
    expect(githubDokument(url)).toBeNull();
  });

  it("en gren med snedstreck är ref + sökväg (känd begränsning)", () => {
    const d = githubDokument("https://github.com/cllp/repo/blob/feature/x/a.md");
    expect(d?.ref).toBe("feature");
    expect(d?.sokvag).toBe("x/a.md");
  });

  it("sorten ur ändelsen, versaler räknas, och okänt är annat", () => {
    const sort = (/** @type {string} */ f) => githubDokument(`https://github.com/o/r/blob/main/${f}`)?.sort;
    expect(sort("A.MD")).toBe("markdown");
    expect(sort("a.markdown")).toBe("markdown");
    expect(sort("a.htm")).toBe("html");
    expect(sort("a.jpeg")).toBe("bild");
    expect(sort("a.webp")).toBe("bild");
    expect(sort("a.txt")).toBe("text");
    expect(sort("a.csv")).toBe("csv");
    expect(sort("a.docx")).toBe("word");
    expect(sort("a.xlsx")).toBe("excel");
    expect(sort("a.zip")).toBe("annat");
    expect(sort("README")).toBe("annat");
    expect(sort(".gitignore")).toBe("annat");
    // Ett ändelsenamn som finns på Object.prototype får inte ge en sort.
    expect(sort("a.constructor")).toBe("annat");
    expect(sort("a.toString")).toBe("annat");
  });

  it("svg är annat och aldrig bild: den kan bära skript", () => {
    expect(githubDokument("https://github.com/o/r/blob/main/logo.svg")?.sort).toBe("annat");
    expect(Object.values(GITHUB_SORTER)).not.toContain("annat");
    expect(GITHUB_SORTER.svg).toBeUndefined();
  });

  it("kartan och lägena är frysta", () => {
    expect(Object.isFrozen(GITHUB_SORTER)).toBe(true);
    expect(Object.isFrozen(GITHUB_LAGEN)).toBe(true);
    expect([...GITHUB_LAGEN]).toEqual(["last", "saknas", "obehorig", "inte-gruppens", "for-stor", "fel"]);
  });

  it("källan förblir annat: en GitHub-adress är ingen oEmbed-källa", () => {
    expect(lankKalla(A)).toBe("annat");
  });
});

describe("githubDokumentUrl", () => {
  it.each([
    { agare: "cllp", repo: "bolag-ops", ref: "main", sokvag: "README.md" },
    { agare: "cllp", repo: "lifehub.app", ref: "v1.2.3", sokvag: "docs/en mapp/ett blad.pdf" },
    { agare: "a-b_c", repo: "r.x", ref: "abc123", sokvag: "årsredovisning/räkenskapsår åäö.xlsx" },
    { agare: "o", repo: "r", ref: "main", sokvag: "a/b/c/d#1?.txt" },
  ])("rundturen ger samma värden: %j", (x) => {
    const d = githubDokument(githubDokumentUrl(x));
    expect(d).not.toBeNull();
    expect({ agare: d?.agare, repo: d?.repo, ref: d?.ref, sokvag: d?.sokvag }).toEqual(x);
  });

  it("kodar mellanslag och å/ä/ö per segment", () => {
    expect(githubDokumentUrl({ agare: "o", repo: "r", ref: "main", sokvag: "en mapp/år.md" })).toBe("https://github.com/o/r/blob/main/en%20mapp/%C3%A5r.md");
  });
});

describe("githubMarkdown", () => {
  it("en bild blir sin alt-text, eller 'bild'", () => {
    expect(githubMarkdown("Se ![diagram](img/a.png) här")).toBe("Se diagram här");
    expect(githubMarkdown("![](img/a.png)")).toBe("bild");
  });
  it("en relativ länk blir sin text, en absolut länk och ett ankare lämnas", () => {
    expect(githubMarkdown("[mer](docs/a.md) och [../b](../b.md)")).toBe("mer och ../b");
    expect(githubMarkdown("[x](https://a.se/b) [y](#rubrik) [z](mailto:a@b.se)")).toBe("[x](https://a.se/b) [y](#rubrik) [z](mailto:a@b.se)");
  });
});
