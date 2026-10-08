import { useEffect, useState } from "react";
import { Link, StickyNote } from "lucide-react";
import { ADRESSFORM, BIBLIOTEKTYPER, farAndra, filtreraBibliotek, inmatningsfel, normaliseraAdress, trimSomRegeln } from "../lib/bibliotek.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";

/**
 * Gruppens bibliotek: lista och detalj för anteckning och länk.
 *
 * Ytan följer SessionStudios lista (ikon, rubrik, öppna raden) och håller
 * sökningen i det som redan lästs. Flikarna är en segmentväljare med tre lägen,
 * också när en typ har noll poster: noll är beskedet att typen finns och är tom.
 *
 * Komponenten skriver ingenting själv. `onSpara` får typ, rubrik och text eller
 * adress. Källan sätter grupp, författare och klockslag.
 *
 * ⛔ FORMULÄRET VISAS BARA FÖR DEN SOM FÅR ÄNDRA (granskningen av #304). Det är
 * `farAndra`, samma villkor som regelns `update`: författaren eller admin. Andra
 * ser posten i läsläge. Ett formulär som regeln sedan nekar är ett löfte vyn inte
 * kan hålla, och nejet hade kommit som "Missing or insufficient permissions".
 * `jag: null` betyder att den inloggade inte är medlem: allt visas i läsläge och
 * inga knappar för att lägga till.
 *
 * ⛔ `jag` KRÄVS, OCH `null` ÄR ETT SVAR (regel 5, granskningen av #304). Med
 * `null` som förval såg en app som glömt propen ut som en icke-medlem: inga
 * knappar och inget fel, och den som faktiskt får skriva fick bara läsa. Nu
 * kastar komponenten när `jag` saknas, och appen säger `null` när personen inte
 * är medlem.
 *
 * ⛔ EN LÄNK GÅR ATT ÖPPNA. Den visas som en `<a>` i ny flik med
 * `rel="noopener noreferrer"`, och bara när adressen klarar `ADRESSFORM`, alltså
 * http eller https.
 */

/**
 * @param {object} props
 * @param {readonly (import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} props.poster
 * @param {string | null} [props.fel] Läsningen misslyckades. Tom lista med fel är inte "biblioteket är tomt".
 * @param {readonly { id: string, fel: string }[]} [props.trasiga] Rader källan inte kunde läsa (`las().trasiga`). De visas som ett antal med skäl, aldrig tyst.
 * @param {{ uid: string, roll: string, groupId?: string } | null} props.jag Den inloggades aktiva medlemskap i gruppen, eller `null` när personen inte är medlem. Krävs.
 * @param {boolean} [props.laddar]
 * @param {(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null} [props.vald]
 * @param {"anteckning" | "lank" | null} [props.skapar]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }) => void} props.onOppna
 * @param {() => void} props.onStang
 * @param {(typ: "anteckning" | "lank") => void} props.onSkapa
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string }) => void} props.onSpara
 */
export function OpsBibliotek({ poster, fel = null, trasiga = [], laddar = false, vald = null, skapar = null, jag, onOppna, onStang, onSkapa, onSpara }) {
  if (jag === undefined) {
    throw new Error("OpsBibliotek: jag krävs, den inloggades aktiva medlemskap i gruppen ({ uid, roll }), eller null när personen inte är medlem. Utan propen ser en medlem ut som en som bara får läsa.");
  }
  const [flik, setFlik] = useState(/** @type {"alla" | "anteckning" | "lank"} */ ("alla"));
  const [sok, setSok] = useState("");
  const skaparTyp = jag ? skapar : null;
  const detalj = Boolean(skaparTyp || vald);

  const antal = {
    alla: poster.length,
    anteckning: poster.filter((p) => p.typ === "anteckning").length,
    lank: poster.filter((p) => p.typ === "lank").length,
  };
  const synliga = filtreraBibliotek(poster, { flik, sok });

  return (
    <OpsView width="narrow">
      <div data-bibliotek="">
        {detalj ? (
          <Detalj post={vald} skapar={skaparTyp} jag={jag} onStang={onStang} onSpara={onSpara} />
        ) : (
          <>
            <OpsViewHeader title="Bibliotek" description="Anteckningar och länkar i gruppen." />
            <OpsField label="Sök">
              <OpsInput value={sok} onChange={setSok} ariaLabel="Sök i biblioteket" placeholder="Sök i rubrik, text eller adress" />
            </OpsField>
            <OpsSegmented
              ariaLabel="Typ i biblioteket"
              value={flik}
              onChange={(v) => setFlik(/** @type {typeof flik} */ (v))}
              options={[
                { value: "alla", label: "Alla", badge: antal.alla },
                { value: "anteckning", label: "Anteckningar", badge: antal.anteckning },
                { value: "lank", label: "Länkar", badge: antal.lank },
              ]}
            />
            {jag ? (
              <div className="flex flex-wrap gap-2">
                {(flik === "alla" ? BIBLIOTEKTYPER : [flik]).map((typ) => (
                  <OpsButton key={typ} variant="secondary" onClick={() => onSkapa(typ)}>
                    {typ === "anteckning" ? "Ny anteckning" : "Ny länk"}
                  </OpsButton>
                ))}
              </div>
            ) : null}
            {trasiga.length > 0 ? (
              <div role="status" data-bibliotek-trasiga={trasiga.length} className="text-meta text-ink-muted">
                <p>{trasiga.length === 1 ? "1 post kunde inte läsas och visas inte." : `${trasiga.length} poster kunde inte läsas och visas inte.`}</p>
                <ul>
                  {trasiga.map((t) => (
                    <li key={t.id}>{t.id}: {t.fel}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {fel ? (
              <p role="alert" data-bibliotek-fel="">{fel}</p>
            ) : laddar ? (
              <OpsEmpty busy title="Hämtar biblioteket" />
            ) : synliga.length === 0 ? (
              <OpsEmpty
                title={sok ? "Inga träffar." : poster.length === 0 ? "Biblioteket är tomt." : flik === "anteckning" ? "Inga anteckningar ännu." : "Inga länkar ännu."}
                description={sok ? `Inget matchar "${sok}".` : "Lägg till en anteckning eller en länk."}
              />
            ) : (
              <OpsList ariaLabel="Biblioteket" divided>
                {synliga.map((post) => (
                  <OpsListRow key={post.id} interactive onClick={() => onOppna(post)} ariaLabel={post.rubrik}>
                    <span className="text-ink-secondary" aria-hidden="true">
                      {post.typ === "anteckning" ? <StickyNote size={20} /> : <Link size={20} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-brod font-medium text-ink">{post.rubrik}</span>
                      <span className="block truncate text-meta text-ink-muted">{post.typ === "anteckning" ? post.text : post.url}</span>
                    </span>
                  </OpsListRow>
                ))}
              </OpsList>
            )}
          </>
        )}
      </div>
    </OpsView>
  );
}

/**
 * En adress som går att öppna, eller texten när den inte klarar `ADRESSFORM`.
 *
 * @param {{ url: string }} props
 */
function Adress({ url }) {
  if (!ADRESSFORM.test(url)) return <p className="text-brod text-ink break-all">{url}</p>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-bibliotek-lank=""
      className="block break-all rounded-sm text-brod text-accent underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {url}
    </a>
  );
}

/**
 * @param {object} props
 * @param {(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null} props.post
 * @param {"anteckning" | "lank" | null} props.skapar
 * @param {{ uid: string, roll: string, groupId?: string } | null} props.jag
 * @param {() => void} props.onStang
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string }) => void} props.onSpara
 */
function Detalj({ post, skapar, jag, onStang, onSpara }) {
  const typ = skapar ?? post?.typ ?? "anteckning";
  const [rubrik, setRubrik] = useState(post && !skapar ? post.rubrik : "");
  const [text, setText] = useState(post && !skapar && post.typ === "anteckning" ? post.text ?? "" : "");
  const [url, setUrl] = useState(post && !skapar && post.typ === "lank" ? post.url ?? "" : "");
  const [formfel, setFormfel] = useState("");
  const nyckel = `${skapar ?? ""}:${post?.id ?? ""}`;

  useEffect(() => {
    setRubrik(post && !skapar ? post.rubrik : "");
    setText(post && !skapar && post.typ === "anteckning" ? post.text ?? "" : "");
    setUrl(post && !skapar && post.typ === "lank" ? post.url ?? "" : "");
    setFormfel("");
    // Nyckeln är beroendet: en ny lista med samma post ska inte tömma ett halvskrivet formulär.
  }, [nyckel]);

  const lasning = !skapar && post && !farAndra(post, jag);
  const rubrikVy = skapar ? (typ === "anteckning" ? "Ny anteckning" : "Ny länk") : post?.rubrik ?? "Post";
  const beskrivning = typ === "anteckning" ? "En text gruppen delar." : "En adress gruppen delar.";

  if (lasning && post) {
    return (
      <div data-bibliotek-detalj={typ} data-bibliotek-lasning="">
        <OpsButton variant="ghost" onClick={onStang}>Tillbaka</OpsButton>
        <OpsViewHeader title={post.rubrik} description={beskrivning} />
        {post.typ === "anteckning" ? (
          <p className="whitespace-pre-wrap text-brod text-ink">{post.text}</p>
        ) : (
          <Adress url={post.url ?? ""} />
        )}
        <p className="text-meta text-ink-muted">{post.skapadAv.namn ? `Skriven av ${post.skapadAv.namn}.` : "Författaren saknar namn."}</p>
      </div>
    );
  }

  return (
    <div data-bibliotek-detalj={typ}>
      <OpsButton variant="ghost" onClick={onStang}>Tillbaka</OpsButton>
      <OpsViewHeader title={rubrikVy} description={beskrivning} />
      {post && !skapar && post.typ === "lank" && post.url ? <Adress url={post.url} /> : null}
      <OpsField label="Rubrik" error={formfel && !trimSomRegeln(rubrik) ? formfel : undefined}>
        <OpsInput value={rubrik} onChange={setRubrik} ariaLabel="Rubrik" />
      </OpsField>
      {typ === "anteckning" ? (
        <OpsField label="Text">
          <OpsTextarea value={text} onChange={setText} ariaLabel="Text" rows={8} />
        </OpsField>
      ) : (
        <OpsField label="Adress">
          <OpsInput value={url} onChange={setUrl} ariaLabel="Adress" placeholder="https://" />
        </OpsField>
      )}
      {formfel ? <p role="alert">{formfel}</p> : null}
      <OpsButton
        variant="primary"
        onClick={() => {
          const inmatning = typ === "anteckning"
            ? { typ, rubrik, text, ...(post && !skapar ? { id: post.id } : {}) }
            : { typ, rubrik, url: normaliseraAdress(url), ...(post && !skapar ? { id: post.id } : {}) };
          const fel = inmatningsfel(inmatning);
          if (fel) {
            setFormfel(fel);
            return;
          }
          setFormfel("");
          onSpara(inmatning);
        }}
      >
        Spara
      </OpsButton>
    </div>
  );
}
