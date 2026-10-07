import { useEffect, useState } from "react";
import { Link, StickyNote } from "lucide-react";
import { BIBLIOTEKTYPER, filtreraBibliotek, inmatningsfel } from "../lib/bibliotek.js";
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
 */

/**
 * @param {object} props
 * @param {readonly (import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} props.poster
 * @param {string | null} [props.fel] Läsningen misslyckades. Tom lista med fel är inte "biblioteket är tomt".
 * @param {boolean} [props.laddar]
 * @param {(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null} [props.vald]
 * @param {"anteckning" | "lank" | null} [props.skapar]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }) => void} props.onOppna
 * @param {() => void} props.onStang
 * @param {(typ: "anteckning" | "lank") => void} props.onSkapa
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string }) => void} props.onSpara
 */
export function OpsBibliotek({ poster, fel = null, laddar = false, vald = null, skapar = null, onOppna, onStang, onSkapa, onSpara }) {
  const [flik, setFlik] = useState(/** @type {"alla" | "anteckning" | "lank"} */ ("alla"));
  const [sok, setSok] = useState("");
  const detalj = Boolean(skapar || vald);

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
          <Detalj post={vald} skapar={skapar} onStang={onStang} onSpara={onSpara} />
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
            <div className="flex flex-wrap gap-2">
              {(flik === "alla" ? BIBLIOTEKTYPER : [flik]).map((typ) => (
                <OpsButton key={typ} variant="secondary" onClick={() => onSkapa(typ)}>
                  {typ === "anteckning" ? "Ny anteckning" : "Ny länk"}
                </OpsButton>
              ))}
            </div>
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
 * @param {object} props
 * @param {(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null} props.post
 * @param {"anteckning" | "lank" | null} props.skapar
 * @param {() => void} props.onStang
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string }) => void} props.onSpara
 */
function Detalj({ post, skapar, onStang, onSpara }) {
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
  }, [nyckel, post, skapar]);

  const rubrikVy = skapar ? (typ === "anteckning" ? "Ny anteckning" : "Ny länk") : post?.rubrik ?? "Post";

  return (
    <div data-bibliotek-detalj={typ}>
      <OpsButton variant="ghost" onClick={onStang}>Tillbaka</OpsButton>
      <OpsViewHeader title={rubrikVy} description={typ === "anteckning" ? "En text gruppen delar." : "En adress gruppen delar."} />
      <OpsField label="Rubrik" error={formfel && !rubrik.trim() ? formfel : undefined}>
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
            : { typ, rubrik, url, ...(post && !skapar ? { id: post.id } : {}) };
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
