/**
 * Provsidorna för det publika skalet. INTE en app och exporteras inte: `check-brand` och `montage-publik` ritar dem med RIKTIG
 * CSS i Chromium. Scenariot och innehållet väljs med `window.__prov` (satt före sidan laddas):
 *
 *   { sida: "start" | "kort", innehall: <scripts/lib/publik-innehall.mjs>, loggaMitt?: boolean }
 *
 * `loggaMitt` är det BEVIS-läge `check-brand --bevisa` använder: toppraden läggs i en smal centrerad kolumn, alltså den
 * komposition CP kritiserade ("loggan i mitten"), så att provet "loggan ligger på samma plats" kan ses falla.
 */
import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

const { OpsPublikSkal, OpsPublikHuvud, OpsPublikFot, OpsPublikHjalte, OpsPublikBlock, OpsPublikUppmaning, OpsPublikAvsnitt, OpsPublikText } = Ops;

function Sida() {
  const { sida, innehall: i, loggaMitt } = window.__prov;
  const start = sida === "start";
  let huvud = (
    <OpsPublikHuvud
      logga={i.logga}
      lankar={i.lankar}
      mobilLankar={i.mobilLankar}
      sprak={{ ...i.sprak, onVal: () => {} }}
      loggaIn={i.loggaIn}
      kom={i.kom}
      transparent={start}
      ton={i.huvudTon ?? "mork"}
      texter={i.texter}
    />
  );
  if (loggaMitt && !start) huvud = <div style={{ margin: "0 auto", maxWidth: "24rem" }}>{huvud}</div>;
  const fot = <OpsPublikFot {...i.fot} />;
  return (
    <OpsPublikSkal huvud={huvud} fot={fot}>
      {start ? (
        <>
          <OpsPublikHjalte {...i.hjalte} />
          {i.block.map((b) => (
            <OpsPublikBlock key={b.title} ton={b.ton} bildSida={b.bildSida} eyebrow={b.eyebrow} title={b.title} handling={b.handling} bild={b.bild} figur={b.figur ? <div style={{ width: 240 }} dangerouslySetInnerHTML={{ __html: b.figur }} /> : undefined}>
              {b.text.map((t) => (
                <p key={t} className="m-0">{t}</p>
              ))}
            </OpsPublikBlock>
          ))}
          <OpsPublikUppmaning title={i.uppmaning.title} primar={i.uppmaning.primar} sekundar={i.uppmaning.sekundar}>
            {i.uppmaning.text}
          </OpsPublikUppmaning>
        </>
      ) : (
        <>
          <OpsPublikHjalte eyebrow={i.kort.eyebrow} title={i.kort.title} ingress={i.kort.ingress} centrerad />
          <OpsPublikAvsnitt eyebrow={i.kort.avsnitt.eyebrow} title={i.kort.avsnitt.title} ingress={i.kort.avsnitt.ingress}>
            <OpsPublikText>{i.kort.avsnitt.text}</OpsPublikText>
          </OpsPublikAvsnitt>
        </>
      )}
    </OpsPublikSkal>
  );
}

createRoot(document.getElementById("root")).render(<Sida />);
window.__redo = true;
