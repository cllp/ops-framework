import { describe, expect, it } from "vitest";
import { delaInline, delaMarkdown } from "../lib/markdown.js";

describe("delaMarkdown", () => {
  it("gör en rubrik till ett rubrikblock i stället för text med brädgårdar", () => {
    /*
     * ⛔ DET HÄR ÄR FELET CP SÅG (bolag-ops #249, med bild). Ett utfällt
     * ärendekort visade `## Context` rakt av, alltså formateringstecken i
     * stället för struktur, och en rubrik som står ensam på en rad ser ut som
     * ett fel eftersom den var ett.
     */
    expect(delaMarkdown("## Context\n\nEn mening.")).toEqual([
      { typ: "rubrik", niva: 2, inline: [{ typ: "text", varde: "Context" }] },
      { typ: "stycke", inline: [{ typ: "text", varde: "En mening." }] },
    ]);
  });

  it("slår ihop mjuka radbrytningar till ett stycke", () => {
    // ⛔ Utan det blir varje rad i ett stycke ett eget stycke, och texten får
    // luft mitt i en mening. Markdown gör samma sak.
    expect(delaMarkdown("en rad\noch en till")).toEqual([
      { typ: "stycke", inline: [{ typ: "text", varde: "en rad och en till" }] },
    ]);
  });

  it("läser kryssrutor som ett fält och inte som tecken i texten", () => {
    // ⛔ `- [x]` som ren text ser ut som en skrivfel-parentes, och en lista
    // där hälften är gjort går då inte att skumma.
    const [block] = delaMarkdown("- [x] Statusprick\n- [ ] Markdown\n- Vanlig");
    expect(block).toEqual({
      typ: "list",
      ordnad: false,
      poster: [
        { kryss: true, inline: [{ typ: "text", varde: "Statusprick" }] },
        { kryss: false, inline: [{ typ: "text", varde: "Markdown" }] },
        { kryss: null, inline: [{ typ: "text", varde: "Vanlig" }] },
      ],
    });
  });

  it("håller isär punktlista och sifferlista", () => {
    // Två listor och inte en, annars ärver den andra den förstas numrering.
    const block = delaMarkdown("- a\n1. b");
    expect(block.map((b) => b.typ === "list" && b.ordnad)).toEqual([false, true]);
  });

  it("läser en tabell bara när strecket finns under rubrikraden", () => {
    const [tabell] = delaMarkdown("| Vad | Färg |\n|---|---|\n| Öppet | gul |");
    expect(tabell.typ).toBe("tabell");
    expect(tabell.header.map((c) => c[0].varde)).toEqual(["Vad", "Färg"]);
    expect(tabell.rader[0].map((c) => c[0].varde)).toEqual(["Öppet", "gul"]);

    // ⛔ Utan streck är det inte en tabell utan en rad med rörtecken, och att
    // gissa hade gjort en ASCII-ritning till en trasig tabell.
    expect(delaMarkdown("| bara en rad |")[0].typ).toBe("stycke");
  });

  it("låter kodblocket vara text och inte markdown", () => {
    // ⛔ En brädgård inuti ett kodblock är en kommentar i koden, inte en
    // rubrik. Tolkades den skulle exempel på markdown bli omöjliga att visa.
    expect(delaMarkdown("```\n# inte en rubrik\n```")).toEqual([{ typ: "kod", text: "# inte en rubrik" }]);
  });

  it("slår ihop flera citatrader utan att tappa fet text", () => {
    /*
     * ⛔ REGRESSIONSPROV. Första versionen slog ihop citatrader genom att
     * plocka isär det redan delade blocket och sätta ihop strängen igen. Den
     * såg ut att fungera och tappade tyst all fet text, eftersom stjärnorna
     * inte finns kvar i en bit som redan är typad som `fet`.
     */
    expect(delaMarkdown("> CP sade **nej**\n> och menade det")).toEqual([
      {
        typ: "citat",
        inline: [
          { typ: "text", varde: "CP sade " },
          { typ: "fet", varde: "nej" },
          { typ: "text", varde: " och menade det" },
        ],
      },
    ]);
  });

  it("tom text ger inga block alls", () => {
    // ⛔ Tomhet är ett svar: ett block med tom text hade ritat en tom panel,
    // och en tom panel ser ut som ett laddningsfel.
    for (const tomt of ["", "   \n\n", null, undefined]) expect(delaMarkdown(tomt)).toEqual([]);
  });

  it("tappar aldrig text", () => {
    const text = "## Rubrik\n\nEtt stycke med https://example.com/x i.\n\n- en punkt";
    const allt = delaMarkdown(text)
      .flatMap((b) => (b.typ === "list" ? b.poster.flatMap((p) => p.inline) : b.inline || []))
      .map((bit) => bit.varde)
      .join("");
    for (const ord of ["Rubrik", "Ett stycke med", "https://example.com/x", "en punkt"]) {
      expect(allt).toContain(ord);
    }
  });
});

describe("delaInline", () => {
  it("gör både markdown-länkar och nakna adresser till länkar", () => {
    expect(delaInline("se [PR 53](https://github.com/cllp/ops-framework/pull/53) och https://example.com/x.")).toEqual([
      { typ: "text", varde: "se " },
      { typ: "lank", varde: "PR 53", url: "https://github.com/cllp/ops-framework/pull/53" },
      { typ: "text", varde: " och " },
      { typ: "lank", varde: "https://example.com/x", url: "https://example.com/x" },
      { typ: "text", varde: "." },
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
      const bitar = delaInline(`klicka [här](${farligt}) nu`);
      expect(bitar.every((b) => b.typ === "text")).toBe(true);
      expect(bitar.map((b) => b.varde).join("")).toContain(farligt);
    }
  });

  it("gissar aldrig en länk ur ett ärendenummer", () => {
    // ⛔ En gissad länk ser exakt likadan ut som en riktig ända tills någon
    // klickar, och då är förtroendet för alla de andra borta.
    expect(delaInline("Se #183 och PR 188.")).toEqual([{ typ: "text", varde: "Se #183 och PR 188." }]);
  });

  it("låter en länk inuti en kodsnutt vara kod", () => {
    /*
     * ⛔ SKÄLET TILL ATT DET ÄR EN REGEX MED ALTERNATIV OCH INTE FYRA SVEP.
     * Fyra svep över samma sträng betyder att svep två träffar inuti det svep
     * ett redan tagit, alltså en adress i ett kodexempel som plötsligt blir
     * klickbar.
     */
    expect(delaInline("kör `curl https://example.com/x`")).toEqual([
      { typ: "text", varde: "kör " },
      { typ: "kod", varde: "curl https://example.com/x" },
    ]);
  });
});
