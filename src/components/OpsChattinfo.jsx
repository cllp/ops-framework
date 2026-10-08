import { useState } from "react";
import { isImage } from "../lib/file.js";
import { bilagaUrDokument } from "../lib/handelsemodell.js";
import { lankarI } from "../lib/markdown.js";
import { BilagaVisning } from "./BilagaVisning.jsx";
import { BildIkon, FilIkon, GruppIkon, LankIkon, KryssIkon } from "./icons.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsTabs, OpsTabPanel } from "./OpsTabs.jsx";

/**
 * Texterna panelen och verktygsraden delar (0.80.0, #301). Ett hem, så att knappen och fliken inte får olika namn.
 */
export const CHATTINFO_TEXTER = {
  mejl: "Mejl",
  tystaNotiser: "Tysta notiser",
  notiserTysta: "Notiser är tysta",
  chattinfo: "Chattinfo",
  stangChattinfo: "Stäng chattinfo",
  medlemmar: "Medlemmar",
  bilder: "Bilder",
  dokument: "Dokument",
  lankar: "Länkar",
  ingaMedlemmar: "Inga medlemmar.",
  ingaBilder: "Inga bilder.",
  ingaDokument: "Inga dokument.",
  ingaLankar: "Inga länkar.",
  hamtarBilaga: "Hämtar bilagan…",
  hamtarBilagor: "Hämtar bilagor…",
  bilagorFler: "Äldre bilagor visas inte.",
  bilagorFel: "Bilagorna kunde inte hämtas.",
  lankarUrLaddade: "Länkarna är de som står i de laddade meddelandena.",
  aldreLankar: "Det kan finnas fler länkar i äldre meddelanden.",
};

/**
 * Panelen Chattinfo: Medlemmar, Bilder, Dokument och Länkar (0.80.0, #301).
 *
 * ⛔ FYRA FLIKAR, INGEN VIDEO. Video kräver en fil utanför dokumentet, och det är inte det här ärendet.
 * Bilder är bildtyperna. Dokument är de andra typerna som får bifogas. Länkarna härleds ur meddelandenas text
 * (`lankarI`), de lagras inte igen.
 *
 * @param {object} props
 * @param {ReadonlyArray<{ userId: string, namn?: string, bild?: string, typ?: string }>} [props.medlemmar]
 * @param {ReadonlyArray<{ id?: string, namn?: string, typ?: string, dataUrl?: string, tecken?: number }> | null} [props.bilagor]
 *   `null` betyder att de inte hämtats än. En tom lista betyder att det inte finns några.
 * @param {boolean} [props.bilagorFler]
 * @param {string | null} [props.bilagorFel]
 * @param {ReadonlyArray<{ text?: string }>} [props.meddelanden]
 * @param {boolean} [props.aldreFinns] Det kan finnas meddelanden bakom sidan, alltså länkar som inte lästs.
 * @param {(uid: string) => string} props.namnFor
 * @param {() => void} props.onStang
 * @param {typeof CHATTINFO_TEXTER} props.texter
 */
export function OpsChattinfo({ medlemmar = [], bilagor = null, bilagorFler = false, bilagorFel = null, meddelanden = [], aldreFinns = false, namnFor, onStang, texter: t }) {
  const [flik, setFlik] = useState("medlemmar");
  const personer = medlemmar ?? [];
  const filer = bilagor ?? [];
  const bilder = filer.filter((b) => b && isImage(/** @type {string} */ (b.typ)));
  const dokument = filer.filter((b) => b && b.typ && !isImage(b.typ));
  /** @type {Array<{ url: string, text: string }>} */
  const lankar = [];
  const sedda = new Set();
  for (const m of meddelanden ?? []) {
    for (const l of lankarI(m?.text)) {
      if (sedda.has(l.url)) continue;
      sedda.add(l.url);
      lankar.push(l);
    }
  }
  // ⛔ Ikon och antal, som förebilden. Antalet saknas medan filerna hämtas: "inte hämtat" och "noll" ska inte se likadana ut.
  const hamtat = bilagor !== null;
  const flikar = [
    { id: "medlemmar", label: t.medlemmar, icon: <GruppIkon size={18} />, badge: personer.length },
    { id: "bilder", label: t.bilder, icon: <BildIkon size={18} />, ...(hamtat ? { badge: bilder.length } : {}) },
    { id: "dokument", label: t.dokument, icon: <FilIkon size={18} />, ...(hamtat ? { badge: dokument.length } : {}) },
    { id: "lankar", label: t.lankar, icon: <LankIkon size={18} />, badge: lankar.length },
  ];

  return (
    <div data-chattinfo="" className="flex h-full min-h-0 w-full flex-col bg-canvas">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <h3 className="m-0 min-w-0 flex-1 truncate text-etikett font-semibold text-ink">{t.chattinfo}</h3>
        <button
          type="button"
          aria-label={t.stangChattinfo}
          onClick={onStang}
          data-stang-chattinfo=""
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <KryssIkon size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <OpsTabs tabs={flikar} value={flik} onChange={setFlik} ariaLabel={t.chattinfo}>
          <OpsTabPanel id="medlemmar">
            {personer.length === 0 ? <p className="m-0 text-meta text-ink-muted">{t.ingaMedlemmar}</p> : null}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {personer.map((p) => (
                <li key={p.userId} data-chattinfo-medlem={p.userId} className="flex items-center gap-2">
                  <OpsIdentity name={namnFor(p.userId)} seed={p.userId} imageUrl={p.bild} size="sm" rund />
                  <span className="min-w-0 truncate text-etikett text-ink">{namnFor(p.userId)}</span>
                </li>
              ))}
            </ul>
          </OpsTabPanel>
          <OpsTabPanel id="bilder">
            {bilagorFel ? <p role="alert" className="m-0 text-meta text-danger">{bilagorFel}</p> : null}
            {bilagor === null && !bilagorFel ? <p className="m-0 text-meta text-ink-muted">{t.hamtarBilagor}</p> : null}
            {bilagor && bilder.length === 0 ? <p data-inga-bilder="" className="m-0 text-meta text-ink-muted">{t.ingaBilder}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              {bilder.map((b) => (
                <span key={b.id || b.namn} data-chattinfo-bild={b.namn} className="min-w-0">
                  <BilagaVisning bilaga={/** @type {any} */ (bilagaUrDokument(b))} alt={b.namn || t.bilder} marke="data-chattinfo-bilaga" />
                </span>
              ))}
            </div>
            {bilagorFler ? <p className="m-0 mt-2 text-liten text-ink-muted">{t.bilagorFler}</p> : null}
          </OpsTabPanel>
          <OpsTabPanel id="dokument">
            {bilagorFel ? <p role="alert" className="m-0 text-meta text-danger">{bilagorFel}</p> : null}
            {bilagor === null && !bilagorFel ? <p className="m-0 text-meta text-ink-muted">{t.hamtarBilagor}</p> : null}
            {bilagor && dokument.length === 0 ? <p data-inga-dokument="" className="m-0 text-meta text-ink-muted">{t.ingaDokument}</p> : null}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {dokument.map((b) => (
                <li key={b.id || b.namn} data-chattinfo-dokument={b.namn}>
                  <BilagaVisning bilaga={/** @type {any} */ (bilagaUrDokument(b))} alt={b.namn || t.dokument} marke="data-chattinfo-bilaga" />
                </li>
              ))}
            </ul>
            {bilagorFler ? <p className="m-0 mt-2 text-liten text-ink-muted">{t.bilagorFler}</p> : null}
          </OpsTabPanel>
          <OpsTabPanel id="lankar">
            <p className="m-0 mb-2 text-liten text-ink-muted">{t.lankarUrLaddade}</p>
            {lankar.length === 0 ? <p data-inga-lankar="" className="m-0 text-meta text-ink-muted">{t.ingaLankar}</p> : null}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lankar.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-etikett text-accent underline">
                    <LankIkon size={14} />
                    <span className="min-w-0 truncate">{l.text}</span>
                  </a>
                </li>
              ))}
            </ul>
            {aldreFinns ? <p className="m-0 mt-2 text-liten text-ink-muted">{t.aldreLankar}</p> : null}
          </OpsTabPanel>
        </OpsTabs>
      </div>
    </div>
  );
}
