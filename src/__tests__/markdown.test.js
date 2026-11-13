import { describe, expect, it } from "vitest";
import { splitInline, splitMarkdown } from "../lib/markdown.js";

describe("splitMarkdown", () => {
  it("gör en rubrik till ett rubrikblock i stället för text med brädgårdar", () => {
    /*
     * ⛔ DET HÄR ÄR FELET CP SÅG (bolag-ops #249, med bild). Ett utfällt
     * ärendekort visade `## Context` rakt av, alltså formateringstecken i
     * stället för struktur, och en rubrik som står ensam på en rad ser ut som
     * ett fel eftersom den var ett.
     */
    expect(splitMarkdown("## Context\n\nEn mening.")).toEqual([
      { kind: "heading", level: 2, inline: [{ kind: "text", value: "Context" }] },
      { kind: "paragraph", inline: [{ kind: "text", value: "En mening." }] },
    ]);
  });

  it("slår ihop mjuka radbrytningar till ett stycke", () => {
    // ⛔ Utan det blir varje rad i ett stycke ett eget stycke, och texten får
    // luft mitt i en mening. Markdown gör samma sak.
    expect(splitMarkdown("en rad\noch en till")).toEqual([
      { kind: "paragraph", inline: [{ kind: "text", value: "en rad och en till" }] },
    ]);
  });

  it("läser kryssrutor som ett fält och inte som tecken i texten", () => {
    // ⛔ `- [x]` som ren text ser ut som en skrivfel-parentes, och en lista
    // där hälften är gjort går då inte att skumma.
    const [block] = splitMarkdown("- [x] Statusprick\n- [ ] Markdown\n- Vanlig");
    expect(block).toEqual({
      kind: "list",
      ordered: false,
      entries: [
        { cross: true, inline: [{ kind: "text", value: "Statusprick" }] },
        { cross: false, inline: [{ kind: "text", value: "Markdown" }] },
        { cross: null, inline: [{ kind: "text", value: "Vanlig" }] },
      ],
    });
  });

  it("håller isär punktlista och sifferlista", () => {
    // Två listor och inte en, annars ärver den andra den förstas numrering.
    const block = splitMarkdown("- a\n1. b");
    expect(block.map((b) => b.kind === "list" && b.ordered)).toEqual([false, true]);
  });

  it("⛔ en radbruten punkt fortsätter på nästa rad, och listan står kvar med sina fem punkter (CP 2026-11-13)", () => {
    // CP, med en skärmbild av strategins README i Biblioteket: "5 punkter i readme alla fick en 1:a". Fortsättningen blev ett stycke,
    // stycket stängde listan, och varje punkt blev en egen lista som numrerades från 1. GitHub visade samma fil rätt.
    const text = [1, 2, 3, 4, 5].map((n) => `${n}. **Punkt ${n}.** Början på punkten\n   och fortsättningen, med **fet** text.`).join("\n");
    const block = splitMarkdown(text);
    expect(block).toHaveLength(1);
    expect(block[0]).toMatchObject({ kind: "list", ordered: true });
    const entries = /** @type {any} */ (block[0]).entries;
    expect(entries).toHaveLength(5);
    expect(entries[2].inline).toEqual([
      { kind: "bold", value: "Punkt 3." },
      { kind: "text", value: " Början på punkten och fortsättningen, med " },
      { kind: "bold", value: "fet" },
      { kind: "text", value: " text." },
    ]);
  });

  it("en tom rad efter en punkt avslutar den: raden efter är ett stycke, och en punkt efter tom rad hör till samma lista", () => {
    expect(splitMarkdown("1. Ett\n\nStycke.").map((b) => b.kind)).toEqual(["list", "paragraph"]);
    const b = splitMarkdown("1. Ett\n\n2. Två");
    expect(b).toHaveLength(1);
    expect(/** @type {any} */ (b[0]).entries).toHaveLength(2);
    expect(splitMarkdown("- punkt\n> citat").map((x) => x.kind)).toEqual(["list", "quote"]);
  });

  it("i chatten fortsätter bara en indragen rad punkten, en rad utan indrag är ett nytt stycke", () => {
    expect(splitMarkdown("- punkt\nny mening", { chatt: true }).map((b) => b.kind)).toEqual(["list", "paragraph"]);
    const b = splitMarkdown("- punkt\n  fortsätter", { chatt: true });
    expect(b).toHaveLength(1);
    expect(/** @type {any} */ (b[0]).entries[0].inline).toEqual([{ kind: "text", value: "punkt fortsätter" }]);
  });

  it("läser en tabell bara när strecket finns under rubrikraden", () => {
    const [tabell] = splitMarkdown("| Vad | Färg |\n|---|---|\n| Öppet | gul |");
    expect(tabell.kind).toBe("table");
    expect(tabell.header.map((c) => c[0].value)).toEqual(["Vad", "Färg"]);
    expect(tabell.rows[0].map((c) => c[0].value)).toEqual(["Öppet", "gul"]);

    // ⛔ Utan streck är det inte en tabell utan en rad med rörtecken, och att
    // gissa hade gjort en ASCII-ritning till en trasig tabell.
    expect(splitMarkdown("| bara en rad |")[0].kind).toBe("paragraph");
  });

  it("låter kodblocket vara text och inte markdown", () => {
    // ⛔ En brädgård inuti ett kodblock är en kommentar i koden, inte en
    // rubrik. Tolkades den skulle exempel på markdown bli omöjliga att visa.
    expect(splitMarkdown("```\n# inte en rubrik\n```")).toEqual([{ kind: "code", text: "# inte en rubrik" }]);
  });

  it("slår ihop flera citatrader utan att tappa fet text", () => {
    /*
     * ⛔ REGRESSIONSPROV. Första versionen slog ihop citatrader genom att
     * plocka isär det redan delade blocket och sätta ihop strängen igen. Den
     * såg ut att fungera och tappade tyst all fet text, eftersom stjärnorna
     * inte finns kvar i en bit som redan är typad som `fet`.
     */
    expect(splitMarkdown("> CP sade **nej**\n> och menade det")).toEqual([
      {
        kind: "quote",
        inline: [
          { kind: "text", value: "CP sade " },
          { kind: "bold", value: "nej" },
          { kind: "text", value: " och menade det" },
        ],
      },
    ]);
  });

  it("tom text ger inga block alls", () => {
    // ⛔ Tomhet är ett svar: ett block med tom text hade ritat en tom panel,
    // och en tom panel ser ut som ett laddningsfel.
    for (const empty of ["", "   \n\n", null, undefined]) expect(splitMarkdown(empty)).toEqual([]);
  });

  it("tappar aldrig text", () => {
    const text = "## Rubrik\n\nEtt stycke med https://example.com/x i.\n\n- en punkt";
    const allt = splitMarkdown(text)
      .flatMap((b) => (b.kind === "list" ? b.entries.flatMap((p) => p.inline) : b.inline || []))
      .map((piece) => piece.value)
      .join("");
    for (const word of ["Rubrik", "Ett stycke med", "https://example.com/x", "en punkt"]) {
      expect(allt).toContain(word);
    }
  });
});

describe("⛔ en annan blocktyp avslutar listpunkten (GPT:s granskning av 12200f6, P2)", () => {
  /** @param {any} inline */
  const text = (inline) => (inline ?? []).map((/** @type {any} */ d) => (typeof d.value === "string" ? d.value : d.kind === "br" ? "\n" : "")).join("");
  it("en rad efter ett citat hör till ett nytt stycke efter citatet, inte till punkten före", () => {
    const b = splitMarkdown("1. Första\n> Citat\nEfter citatet");
    expect(b.map((x) => x.kind)).toEqual(["list", "quote", "paragraph"]);
    expect(text(b[0].entries[0].inline)).toBe("Första");
    expect(text(b[1].inline)).toBe("Citat");
    expect(text(b[2].inline)).toBe("Efter citatet");
  });
  it("i chatten hoppar en indragen rad inte över ett stycke som redan börjat", () => {
    const b = splitMarkdown("1. Första\nvanligt stycke\n  indragen fortsättning", { chatt: true });
    expect(text(b[0].entries[0].inline)).toBe("Första");
    expect(text(b[0].entries[0].inline)).not.toMatch(/indragen/);
    const resten = b.slice(1).map((/** @type {any} */ x) => text(x.inline)).join(" | ");
    expect(resten).toMatch(/vanligt stycke/);
    expect(resten.indexOf("vanligt stycke")).toBeLessThan(resten.indexOf("indragen fortsättning"));
  });
});

describe("delaInline", () => {
  it("gör både markdown-länkar och nakna adresser till länkar", () => {
    expect(splitInline("se [PR 53](https://github.com/cllp/ops-framework/pull/53) och https://example.com/x.")).toEqual([
      { kind: "text", value: "se " },
      { kind: "link", value: "PR 53", url: "https://github.com/cllp/ops-framework/pull/53" },
      { kind: "text", value: " och " },
      { kind: "link", value: "https://example.com/x", url: "https://example.com/x" },
      { kind: "text", value: "." },
    ]);
  });

  it("länkar aldrig ett schema som kör kod", () => {
    /*
     * ⛔ `javascript:` i en `href` ÄR kodkörning, och att texten kommer ur vår
     * egen datakälla är inget skydd: det är precis det antagandet som gör en
     * injektion möjlig den dagen en källa till läggs.
     *
     * Den råa formen står kvar som text, så den som skrev den ser att den inte
     * blev en länk.
     */
    for (const farligt of ["javascript:alert(1)", "data:text/html,<script>x</script>", "file:///etc/passwd"]) {
      const pieces = splitInline(`klicka [här](${farligt}) nu`);
      expect(pieces.every((b) => b.kind === "text")).toBe(true);
      expect(pieces.map((b) => b.value).join("")).toContain(farligt);
    }
  });

  it("gissar aldrig en länk ur ett ärendenummer", () => {
    // ⛔ En gissad länk ser exakt likadan ut som en riktig ända tills någon
    // klickar, och då är förtroendet för alla de andra borta.
    expect(splitInline("Se #183 och PR 188.")).toEqual([{ kind: "text", value: "Se #183 och PR 188." }]);
  });

  it("låter en länk inuti en kodsnutt vara kod", () => {
    /*
     * ⛔ SKÄLET TILL ATT DET ÄR EN REGEX MED ALTERNATIV OCH INTE FYRA SVEP.
     * Fyra svep över samma sträng betyder att svep två träffar inuti det svep
     * ett redan tagit, alltså en adress i ett kodexempel som plötsligt blir
     * klickbar.
     */
    expect(splitInline("kör `curl https://example.com/x`")).toEqual([
      { kind: "text", value: "kör " },
      { kind: "code", value: "curl https://example.com/x" },
    ]);
  });
});
