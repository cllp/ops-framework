import { cx } from "../lib/cx.js";
import { delaMarkdown } from "../lib/markdown.js";

/**
 * Markdown som riktiga element.
 *
 * ── ⛔ VARFÖR DEN BOR I RAMVERKET ───────────────────────────────────────
 *
 * CP (bolag-ops #249): "Mycket av kortets chrome hör hemma i ops-framework."
 * Det gäller den här mest av allt. Varje app som renderar en issue-text
 * kommer annars välja sina egna rubrikstorlekar, sin egen listindragning och
 * sin egen länkfärg, och två plattformar visar samma text på två sätt. Det är
 * precis den drift ramverket finns för att stoppa.
 *
 * ── ⛔ INGEN HTML PASSERAR NÅGONSIN EN STRÄNG ───────────────────────────
 *
 * `dangerouslySetInnerHTML` finns inte här, och ska aldrig göra det. Parsern
 * (`lib/markdown.js`) ger block, komponenten ger element. Texten kommer från
 * GitHub och Firestore, alltså från oss, och det är just det antagandet som
 * gör en injektion möjlig den dagen en källa till läggs.
 *
 * ── ⛔ RUBRIKERNA BLIR ALDRIG h1 ────────────────────────────────────────
 *
 * En issue-text börjar på `##` eller `###` och vet ingenting om sidan den
 * hamnar i. Renderades `#` som `<h1>` skulle ett utfällt kort ha en rubrik
 * över sidans egen, och en skärmläsares dokumentöversikt blir då obrukbar.
 * Nivåerna klampas till h4 till h6 med `niva` som bara styr STORLEKEN, som
 * `OpsCard` gör med sina rubriker.
 *
 * ── ⛔ DEN KAPAR INTE, DEN VISAR ALLT SOM SKICKAS IN ────────────────────
 *
 * Frestelsen är en `maxLangd` här. Den hör hemma i datalagret: komponenten vet
 * inte vad som är viktigt i texten, och en kapning i renderingen ser för
 * läsaren ut som att resten inte finns. Appen bestämmer hur mycket den hämtar.
 */

/**
 * @param {import("../lib/markdown.js").Bit[]} bitar
 * @param {string} nyckel
 */
function inline(bitar, nyckel) {
  return bitar.map((b, i) => {
    const k = `${nyckel}-${i}`;
    if (b.typ === "lank") {
      return (
        <a
          key={k}
          href={b.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-accent underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {b.varde}
        </a>
      );
    }
    if (b.typ === "kod") {
      return (
        <code key={k} className="rounded-sm bg-sunken px-1 py-0.5 font-mono text-xs text-ink">
          {b.varde}
        </code>
      );
    }
    if (b.typ === "fet") {
      return (
        <strong key={k} className="font-semibold text-ink">
          {b.varde}
        </strong>
      );
    }
    /*
     * ⛔ REN TEXT BLIR EN TEXTNOD, INTE ETT `span`. Första versionen slog ett
     * `span` om varje textbit "för nyckelns skull", och det syntes i provet:
     * en rubrik blev `<h4><span>Context</span></h4>`, alltså en extra nivå att
     * ta sig igenom för den som söker i DOM:en. React behöver ingen nyckel för
     * en sträng i en lista.
     */
    return b.varde;
  });
}

// ⛔ Uppslagstabell och inte `text-${...}`. Tailwind läser källkoden som text,
// så ett interpolerat klassnamn genererar ingen CSS alls.
/** @type {Record<number, string>} */
const RUBRIKSTORLEK = {
  1: "text-base font-semibold",
  2: "text-base font-semibold",
  3: "text-sm font-semibold",
  4: "text-sm font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold",
};

/**
 * @param {object} props
 * @param {string | null | undefined} props.text Markdown. Tom text ger ingenting alls.
 */
export function OpsMarkdown({ text }) {
  const block = delaMarkdown(text);
  if (block.length === 0) return null;

  return (
    /* ⛔ `break-words`: issue-texter bär URL:er och tabellrader utan
       mellanslag, och utan den skjuter de ut behållarens högerkant och tar med
       sig hela sidan på en telefon. Mätt i bolag-ops Idag. */
    <div className="flex flex-col gap-2 break-words text-sm text-ink-secondary">
      {block.map((b, i) => {
        const k = `b${i}`;
        if (b.typ === "rubrik") {
          // Nivå 1 och 2 i texten blir h4, resten h5 och h6: se filens huvud.
          const Rubrik = b.niva <= 2 ? "h4" : b.niva === 3 ? "h5" : "h6";
          return (
            <Rubrik key={k} className={cx("m-0 text-ink", RUBRIKSTORLEK[b.niva])}>
              {inline(b.inline, k)}
            </Rubrik>
          );
        }
        if (b.typ === "stycke") return <p key={k} className="m-0">{inline(b.inline, k)}</p>;
        if (b.typ === "citat") {
          return (
            <blockquote key={k} className="m-0 border-l-2 border-line-strong pl-3 text-ink-muted">
              {inline(b.inline, k)}
            </blockquote>
          );
        }
        if (b.typ === "kod") {
          return (
            <pre key={k} className="m-0 overflow-x-auto rounded-md bg-sunken p-3 font-mono text-xs text-ink">
              {b.text}
            </pre>
          );
        }
        if (b.typ === "linje") return <hr key={k} className="m-0 border-0 border-t border-line" />;
        if (b.typ === "tabell") {
          return (
            /* ⛔ Egen enkel tabell och inte `OpsTable`. Den primitiven tar
               kolumner med nycklar och riktar tal, alltså ett schema, och en
               markdowntabell har inget schema: den har celler. Att trycka in
               den ena i den andra hade krävt ett påhittat id per rad. */
            <div key={k} className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {b.header.map((cell, ci) => (
                      <th key={`${k}-h${ci}`} className="border-b border-line px-2 py-1 font-semibold text-ink">
                        {inline(cell, `${k}-h${ci}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rader.map((rad, ri) => (
                    <tr key={`${k}-r${ri}`}>
                      {rad.map((cell, ci) => (
                        <td key={`${k}-r${ri}c${ci}`} className="border-b border-line px-2 py-1 align-top">
                          {inline(cell, `${k}-r${ri}c${ci}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const Lista = b.ordnad ? "ol" : "ul";
        return (
          <Lista
            key={k}
            className="m-0 flex list-none flex-col gap-1 p-0"
          >
            {b.poster.map((post, pi) => (
              <li key={`${k}-p${pi}`} className="flex gap-2">
                {/* ⛔ Kryssrutan är en RUTA, inte en inaktiverad `OpsCheckbox`.
                    Den speglar vad som står i ärendet på GitHub och går inte
                    att ändra här: en avstängd kontroll hade sett ut som något
                    man skulle kunna trycka på om man bara vore inloggad.

                    Tecknet är hårdkodat text, och ordet ligger i `sr-only`
                    bredvid: en bock är osynlig för en skärmläsare. */}
                {post.kryss === null ? (
                  <span aria-hidden="true" className="shrink-0 text-ink-muted">
                    {b.ordnad ? `${pi + 1}.` : "•"}
                  </span>
                ) : (
                  <span className="shrink-0">
                    <span aria-hidden="true" className={post.kryss ? "text-success" : "text-ink-muted"}>
                      {post.kryss ? "☑" : "☐"}
                    </span>
                    <span className="sr-only">{post.kryss ? "Gjort:" : "Ogjort:"}</span>
                  </span>
                )}
                <span className="min-w-0 flex-1">{inline(post.inline, `${k}-p${pi}`)}</span>
              </li>
            ))}
          </Lista>
        );
      })}
    </div>
  );
}
