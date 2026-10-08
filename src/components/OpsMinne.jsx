import { useState } from "react";
import { Bookmark } from "lucide-react";
import { farAndraMinne } from "../lib/minne.js";
import { modulTillbaka } from "../lib/modulram.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsView } from "./OpsView.jsx";

/**
 * Gruppens minne: listan hela gruppen ser, och ändra eller ta bort för den som lyfte raden och för ägaren.
 *
 * Komponenten skriver ingenting själv. `onAndra` och `onTaBort` är appens källa, och den sätter klockan.
 * Saknas en av dem kastar vyn: en knapp som inte gör något är ett tyst fel.
 *
 * ⛔ `arAgare` KRÄVS SOM ETT SVAR. `true` när den inloggade är gruppens ägare, `false` annars. Utan propen
 * hade ägarens knappar uteblivit och sidan sett ut som att minnet bara kan läsas.
 *
 * @param {object} props
 * @param {readonly (import("../lib/minne.js").Minnesrad & { id: string })[]} props.rader
 * @param {string | null} [props.fel] Läsningen misslyckades. Tom lista med fel är inte "minnet är tomt".
 * @param {readonly { id: string, fel: string }[]} [props.trasiga]
 * @param {boolean} [props.laddar]
 * @param {string} props.uid Den inloggades id. Tom sträng när ingen är inloggad.
 * @param {boolean} props.arAgare
 * @param {(id: string, text: string) => void | Promise<void>} props.onAndra
 * @param {(id: string) => void | Promise<void>} props.onTaBort
 * @param {string} props.hubHref Hubbens adress. Tillbaka-raden behöver den.
 * @param {string} [props.hubEtikett]
 * @param {(href: string, event: any) => void} [props.onNavigate]
 */
export function OpsMinne({ rader, fel = null, trasiga = [], laddar = false, uid, arAgare, onAndra, onTaBort, hubHref, hubEtikett, onNavigate }) {
  if (typeof uid !== "string") {
    throw new Error("OpsMinne: uid krävs, den inloggades id, eller en tom sträng när ingen är inloggad.");
  }
  if (typeof arAgare !== "boolean") {
    throw new Error("OpsMinne: arAgare krävs, true när den inloggade är gruppens ägare och false annars. Utan propen syns ägarens knappar inte.");
  }
  if (typeof onAndra !== "function" || typeof onTaBort !== "function") {
    throw new Error("OpsMinne: onAndra och onTaBort krävs. Utan dem är Ändra och Ta bort knappar som inte gör något.");
  }
  if (typeof hubHref !== "string" || hubHref === "") {
    throw new Error("OpsMinne: hubHref krävs, hubbens adress. En tillbaka-rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  const sprak = useOpsSprak();
  const [redigerar, setRedigerar] = useState(/** @type {string | null} */ (null));
  const [utkast, setUtkast] = useState("");
  const [handlingsfel, setHandlingsfel] = useState(/** @type {string | null} */ (null));
  const jag = { uid, roll: arAgare ? "agare" : "medlem" };

  /** @param {string} id @param {string} text */
  const spara = async (id, text) => {
    setHandlingsfel(null);
    try {
      await onAndra(id, text);
      setRedigerar(null);
    } catch (e) {
      setHandlingsfel(e instanceof Error ? e.message : String(e));
    }
  };
  /** @param {string} id */
  const taBort = async (id) => {
    setHandlingsfel(null);
    try {
      await onTaBort(id);
      if (redigerar === id) setRedigerar(null);
    } catch (e) {
      setHandlingsfel(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <OpsView tillbaka={modulTillbaka({ namn: "Minne", hubHref, hubEtikett, onNavigate, sprak })}>
      <div data-minne="" className="flex flex-col gap-4">
        {trasiga.length > 0 ? (
          <div role="status" data-minne-trasiga={trasiga.length} className="text-meta text-ink-muted">
            <p>{trasiga.length === 1 ? "1 rad kunde inte läsas och visas inte." : `${trasiga.length} rader kunde inte läsas och visas inte.`}</p>
            <ul>
              {trasiga.map((t) => (
                <li key={t.id}>{t.id}: {t.fel}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {fel ? <p role="alert" data-minne-fel="">{fel}</p> : null}
        {handlingsfel ? <p role="alert" data-minne-handling="">{handlingsfel}</p> : null}
        {fel ? null : laddar ? (
          <OpsEmpty busy title="Hämtar minnet" />
        ) : rader.length === 0 ? (
          <OpsEmpty title="Minnet är tomt." description="Lyft en slutsats ur en tråd, så syns den här." />
        ) : (
          <OpsList ariaLabel="Minnet" divided>
            {rader.map((rad) => {
              const far = farAndraMinne(rad, jag);
              const oppen = redigerar === rad.id;
              return (
                <OpsListRow key={rad.id}>
                  <span className="text-ink-secondary" aria-hidden="true">
                    <Bookmark size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {oppen ? (
                      <form
                        className="flex flex-col gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          spara(rad.id, utkast);
                        }}
                      >
                        <label className="flex flex-col gap-1">
                          <span className="sr-only">Texten i minnet</span>
                          <textarea
                            value={utkast}
                            onChange={(e) => setUtkast(e.target.value)}
                            rows={4}
                            className="min-h-24 w-full rounded-base border border-line bg-canvas px-2.5 py-2 text-etikett text-ink outline-none focus-visible:border-accent"
                          />
                        </label>
                        <span className="flex flex-wrap gap-2">
                          <OpsButton type="submit">Spara</OpsButton>
                          <OpsButton type="button" variant="ghost" onClick={() => setRedigerar(null)}>Avbryt</OpsButton>
                        </span>
                      </form>
                    ) : (
                      <span className="block whitespace-pre-wrap text-brod text-ink">{rad.text}</span>
                    )}
                    <span className="mt-1 block text-meta text-ink-muted">
                      {kallanamn(rad.kalla.slag)} · {rad.lyftAv.namn || "Namn saknas"} · {nar(rad.lyft, sprak)}
                    </span>
                    {far && !oppen ? (
                      <span className="mt-2 flex flex-wrap gap-2">
                        <OpsButton
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setUtkast(rad.text);
                            setRedigerar(rad.id);
                            setHandlingsfel(null);
                          }}
                        >
                          Ändra
                        </OpsButton>
                        <OpsButton type="button" variant="ghost" onClick={() => taBort(rad.id)}>Ta bort</OpsButton>
                      </span>
                    ) : null}
                  </span>
                </OpsListRow>
              );
            })}
          </OpsList>
        )}
      </div>
    </OpsView>
  );
}

/** @param {string} slag */
function kallanamn(slag) {
  if (slag === "samtal") return "Samtal";
  if (slag === "trad") return "Tråd";
  if (slag === "meddelande") return "Meddelande";
  return "Källa saknas";
}

/** @param {number} ms @param {string} sprak */
function nar(ms, sprak) {
  if (!Number.isInteger(ms)) return "Tid saknas";
  return new Date(ms).toLocaleString(sprak === "en" ? "en-GB" : "sv-SE");
}
