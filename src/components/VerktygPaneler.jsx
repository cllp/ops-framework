import { cx } from "../lib/cx.js";
import { text } from "../lib/sprak.js";
import { knappKlass } from "./OpsButton.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { KryssIkon } from "./icons.jsx";

/*
 * ⛔ (i)-PANELERNA PÅ SIDAN VERKTYG, I EN EGEN FIL SOM LÄSES IN LAT (0.242.0, ops-framework#624). 0.240.0 lade panelerna i `OpsHub`, och
 * appens startfil växte med 1 961 byte gzip (mätt i lifehub.app vid ompinningen, `components/OpsHub.js` +5 303 byte minifierat). Panelerna
 * ritas först efter ett tryck på (i), så de hör inte hemma före första vyn. `VerktygPanelerLat.jsx` läser in filen, och `check:delbarhet`
 * mäter att den inte följer med `OpsHub`.
 */

/**
 * Den utfällda panelen under en ruta (0.240.0): läget, delarna och "Öppna <verktyg>". Spänner hela raden (`col-span-full`).
 *
 * ⛔ LÄGET ÄR APPENS `info`, SAMMA KARTA SOM FÖRUT. `null` är ett svar och ritas som "Inget nytt" (regel 5); saknas nyckeln
 * (`undefined`) har verktyget ingen lägesrad, och då står ingen rad.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {import("./OpsHub.jsx").VerktygPost} props.post
 * @param {"sv"|"en"} props.sprak
 * @param {any} props.t
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {() => void} props.onStang
 */
export function VerktygPanel({ id, post, sprak, t, onNavigate, onStang }) {
  const rubrikId = `${id}-rubrik`;
  const beskrivning = post.beskrivning ? text(post.beskrivning, sprak) : "";
  const lage = post.info === undefined ? null : post.info === null ? t.ingetNytt : text(post.info, sprak);
  const delar = post.children ?? [];
  return (
    <li className="col-span-full min-w-0" data-verktygspanel={post.id}>
      <section
        id={id}
        aria-labelledby={rubrikId}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onStang();
          }
        }}
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-sm"
      >
        <div className="flex min-h-11 items-center gap-2.5">
          {post.icon ? (
            <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
              {post.icon}
            </span>
          ) : null}
          <h3 id={rubrikId} className="m-0 min-w-0 flex-1 truncate text-etikett font-medium text-ink">
            {post.label}
          </h3>
          <button type="button" onClick={onStang} aria-label={t.stang} className={knappKlass({ variant: "ghost", iconOnly: true })}>
            <KryssIkon size={16} />
          </button>
        </div>
        {beskrivning ? <p data-verktyg-beskrivning="" className="m-0 max-w-prose text-etikett text-ink-secondary">{beskrivning}</p> : null}
        {lage !== null ? (
          <p data-verktyg-lage="" className={cx("m-0 text-etikett", post.info === null ? "text-ink-secondary" : "text-ink")}>
            {lage}
          </p>
        ) : null}
        {delar.length > 0 ? (
          <nav aria-label={`${t.delar}: ${post.label}`}>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {delar.map((d) => (
                <li key={d.href}>
                  <a href={d.href} onClick={(e) => onNavigate?.(d.href, e)} className={knappKlass({ variant: "secondary", size: "sm" })}>
                    {d.icon ? (
                      <span aria-hidden="true" className="flex items-center [&_svg]:size-4">
                        {d.icon}
                      </span>
                    ) : null}
                    {d.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div>
          <a href={post.href} onClick={(e) => onNavigate?.(post.href, e)} className={knappKlass({ variant: "primary", size: "sm" })}>
            {t.oppna(post.label)}
          </a>
        </div>
      </section>
    </li>
  );
}

/**
 * Panelen under ett verktyg som gruppen inte har (0.240.0): vad verktyget är, dess delar som text, var det syns, och Lägg till.
 * ⛔ DELARNA SOM TEXT, INTE LÄNKAR: verktyget är inte installerat, och en länk dit hade lett till en sida gruppen inte har.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {string} props.namn
 * @param {string} props.sprak
 * @param {any} props.t `GRUPPHUBB_TEXT` på personens språk.
 * @param {() => void} props.onStang
 * @param {string} props.syns
 * @param {boolean} props.installerbar Appen gav `onInstallera` eller `onClick`.
 * @param {boolean} props.upptagen
 * @param {() => void} props.onInstallera
 * @param {string} props.etikett
 * @param {string} props.href
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {boolean} [props.visaAgarRad]
 */
export function ValbarPanel({ id: panelId, modul: m, namn, sprak, t, onStang, syns, installerbar, upptagen, onInstallera, etikett, href, onNavigate, visaAgarRad = false }) {
  const beskrivning = m.beskrivning ? text(m.beskrivning, sprak) : "";
  const delar = m.hubb?.delar ?? [];
  const rubrikId = `${panelId}-rubrik`;
  return (
    <li className="col-span-full min-w-0" data-valbarpanel={m.id}>
      <section
        id={panelId}
        aria-labelledby={rubrikId}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onStang();
          }
        }}
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-sm"
      >
        <div className="flex min-h-11 items-center gap-2.5">
          {m.hubb?.ikon ? (
            <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
              {/** @type {import("react").ReactNode} */ (m.hubb.ikon)}
            </span>
          ) : null}
          <h3 id={rubrikId} className="m-0 min-w-0 flex-1 truncate text-etikett font-medium text-ink">
            {namn}
          </h3>
          <button type="button" onClick={onStang} aria-label={t.stang} className={knappKlass({ variant: "ghost", iconOnly: true })}>
            <KryssIkon size={16} />
          </button>
        </div>
        {beskrivning ? <p data-verktyg-beskrivning="" className="m-0 max-w-prose text-etikett text-ink">{beskrivning}</p> : null}
        {/* ⛔ DELARNA SOM TEXT, INTE LÄNKAR: verktyget är inte installerat, och en länk dit hade lett till en sida gruppen inte har. */}
        {delar.length > 1 ? (
          <p data-verktyg-delar="" className="m-0 text-etikett text-ink-secondary">
            {t.delarText}: {delar.map((d) => text(d.namn, sprak)).join(", ")}
          </p>
        ) : null}
        {syns ? <p className="m-0 text-etikett text-ink-secondary">{syns}</p> : null}
        {installerbar ? (
          <div>
            <button
              type="button"
              aria-busy={upptagen || undefined}
              disabled={upptagen}
              onClick={() => onInstallera()}
              className={cx(knappKlass({ variant: "primary", size: "sm" }), "disabled:cursor-wait")}
            >
              {upptagen ? <OpsSpinner size="sm" decorative /> : null}
              {etikett}
            </button>
          </div>
        ) : href !== "" ? (
          <div>
            <a href={href} onClick={(e) => onNavigate?.(href, e)} className={knappKlass({ variant: "primary", size: "sm" })}>
              {etikett}
            </a>
          </div>
        ) : visaAgarRad ? (
          <p className="m-0 text-hjalp text-ink-secondary">{t.agarenInstallerar}</p>
        ) : null}
      </section>
    </li>
  );
}
