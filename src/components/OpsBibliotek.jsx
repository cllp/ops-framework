import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Library, Link, Plus, StickyNote } from "lucide-react";
import { ADRESSFORM, BIBLIOTEKTYPER, farAndra, filtreraBibliotek, inmatningsfel, normaliseraAdress, trimSomRegeln } from "../lib/bibliotek.js";
import { cx } from "../lib/cx.js";
import { modulTillbaka } from "../lib/modulram.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { OpsButton, knappKlass } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsTabPanel, OpsTabs } from "./OpsTabs.jsx";
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
 * ⛔ RADERA SYNS BARA FÖR DEN SOM FÅR (#311). Samma `farAndra` som formuläret.
 * Första trycket frågar, andra tar bort. Utan frågan hade ett tryck i listan
 * raderat posten. En trasig rad har samma knapp när raden bär grupp och
 * skapare nog för `farAndra`.
 *
 * ⛔ `jag` KRÄVS, OCH `null` ÄR ETT SVAR (regel 5, granskningen av #304). Med
 * `null` som förval såg en app som glömt propen ut som en icke-medlem: inga
 * knappar och inget fel, och den som faktiskt får skriva fick bara läsa. Nu
 * kastar komponenten när `jag` saknas, och appen säger `null` när personen inte
 * är medlem.
 *
 * ══ ⛔ SIDAN SER UT OCH NAVIGERAS SOM EKONOMI (0.83.0) ════════════════════
 *
 * CP 2026-10-08 17:52, med bilder från telefonen av Bibliotek och Ekonomi: "Bibliotek behöver en tillbaka knapp också
 * precis som ekonomi. Sedan navigeringen på liknande sätt. Sök och komponenter är ihoptryckta." Tre ändringar, alla mätta:
 *
 * - **Tillbaka och rubriken är modulens ram**, samma `OpsView`-rad som `OpsModulSida` ritar (`modulTillbaka` i
 *   `modulram.js`): "‹ Tillbaka" upp till hubben och "Bibliotek" som rubrik. Därför krävs `hubHref`, som för
 *   `OpsModulSida`: en tillbaka-rad som inte vet vart den leder är en knapp som inte gör något.
 * - **Typerna är Ekonomis flikrad** (`OpsTabs` med `medOrd`): ikon, namn, antal och accentlinjen, med samma klasser.
 *   Före var de en segmentväljare i pillerform. Att de inte är länkar som Ekonomis delar är ett beslut: typen är ett
 *   urval i samma lista, inte en egen sida, och sökordet ska stå kvar när man byter flik.
 * - **Luften är vyns rytm.** Mätt med Playwright mot appens mätbygge: mellan sökfältet, segmentet, knapparna och listan
 *   stod 0 px, eftersom allt låg i ett omslag (`data-bibliotek`) utan vyns `gap`. I Ekonomi är luften 16 px (`gap-4`)
 *   mellan rubriken, raden och innehållet. Omslaget har nu samma rytm, och flikpanelen lika så.
 *
 * ⛔ SÖK OCH "+ NY" PÅ EN RAD, SOM SESSIONSTUDIOS BIBLIOTEK. Två stora knappar ("Ny anteckning", "Ny länk") under
 * segmentet tog en egen rad och bredde ut sig. Under Alla öppnar "+ Ny" ett val mellan anteckning och länk. Under en typ
 * skapar den den typen direkt, och dess namn säger vilken ("Ny anteckning"): ett val med ett enda alternativ är ett tryck
 * för mycket. Sökfältet har ingen synlig etikett längre: ordet "Sök" ovanför fältet tog en rad och sade samma sak som
 * platshållaren och skärmläsarnamnet.
 *
 * ⛔ EN LÄNK GÅR ATT ÖPPNA. Den visas som en `<a>` i ny flik med
 * `rel="noopener noreferrer"`, och bara när adressen klarar `ADRESSFORM`, alltså
 * http eller https.
 */

/**
 * @param {object} props
 * @param {readonly (import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} props.poster
 * @param {string | null} [props.fel] Läsningen misslyckades. Tom lista med fel är inte "biblioteket är tomt".
 * @param {readonly { id: string, fel: string, groupId?: string, skapadAv?: { uid?: string | null } }[]} [props.trasiga] Rader källan inte kunde läsa (`las().trasiga`). De visas som ett antal med skäl, aldrig tyst. Den som får raderar raden.
 * @param {{ uid: string, roll: string, groupId?: string } | null} props.jag Den inloggades aktiva medlemskap i gruppen, eller `null` när personen inte är medlem. Krävs.
 * @param {boolean} [props.laddar]
 * @param {(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null} [props.vald]
 * @param {"anteckning" | "lank" | null} [props.skapar]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }) => void} props.onOppna
 * @param {() => void} props.onStang
 * @param {(typ: "anteckning" | "lank") => void} props.onSkapa
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string }) => void} props.onSpara
 * @param {(id: string) => void | Promise<void>} [props.onRadera] Tar bort posten efter bekräftelse. Saknas den och någon bekräftar visas felet, posten rörs inte.
 * @param {string} props.hubHref (0.83.0) Hubbens adress: tillbaka-radens mål, som `OpsModulSida`. Krävs.
 * @param {string} [props.hubEtikett] Förval "Appar".
 * @param {(href: string, event: any) => void} [props.onNavigate] Tillbaka-länkens klick, som `OpsModulSida`.
 */
export function OpsBibliotek({ poster, fel = null, trasiga = [], laddar = false, vald = null, skapar = null, jag, onOppna, onStang, onSkapa, onSpara, onRadera, hubHref, hubEtikett, onNavigate }) {
  if (jag === undefined) {
    throw new Error("OpsBibliotek: jag krävs, den inloggades aktiva medlemskap i gruppen ({ uid, roll }), eller null när personen inte är medlem. Utan propen ser en medlem ut som en som bara får läsa.");
  }
  if (typeof hubHref !== "string" || hubHref === "") {
    throw new Error("OpsBibliotek: hubHref krävs (0.83.0), hubbens adress. Sidan har Ekonomis tillbaka-rad, och en rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  const sprak = useOpsSprak();
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

  // ⛔ DETALJEN HAR SIN EGEN TILLBAKA, TILL LISTAN. Två "Tillbaka" på samma sida, en till hubben och en till listan, hade
  // lämnat läsaren att gissa vilken som är vilken.
  return (
    <OpsView tillbaka={detalj ? undefined : modulTillbaka({ namn: "Bibliotek", hubHref, hubEtikett, onNavigate, sprak })}>
      <div data-bibliotek="" className="flex flex-col gap-4">
        {detalj ? (
          <Detalj post={vald} skapar={skaparTyp} jag={jag} onStang={onStang} onSpara={onSpara} onRadera={onRadera} />
        ) : (
          <OpsTabs
            ariaLabel="Typ i biblioteket"
            medOrd
            value={flik}
            onChange={(v) => setFlik(/** @type {typeof flik} */ (v))}
            tabs={[
              { id: "alla", label: "Alla", icon: <Library size={16} />, badge: antal.alla },
              { id: "anteckning", label: "Anteckningar", icon: <StickyNote size={16} />, badge: antal.anteckning },
              { id: "lank", label: "Länkar", icon: <Link size={16} />, badge: antal.lank },
            ]}
          >
            <OpsTabPanel id={flik}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <OpsInput value={sok} onChange={setSok} type="search" ariaLabel="Sök i biblioteket" placeholder="Sök i rubrik, text eller adress" />
                  </div>
                  {jag ? <NyKnapp flik={flik} onSkapa={onSkapa} /> : null}
                </div>
                {trasiga.length > 0 ? (
                  <div role="status" data-bibliotek-trasiga={trasiga.length} className="text-meta text-ink-muted">
                    <p>{trasiga.length === 1 ? "1 post kunde inte läsas och visas inte." : `${trasiga.length} poster kunde inte läsas och visas inte.`}</p>
                    <ul>
                      {trasiga.map((t) => (
                        <li key={t.id} className="flex flex-col gap-2">
                          <span>{t.id}: {t.fel}</span>
                          {farAndra({ groupId: t.groupId, skapadAv: t.skapadAv }, jag) ? (
                            <RaderaKontroll id={t.id} namn={`Radera ${t.id}`} onRadera={onRadera} />
                          ) : null}
                        </li>
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
              </div>
            </OpsTabPanel>
          </OpsTabs>
        )}
      </div>
    </OpsView>
  );
}

const TYPNAMN = /** @type {const} */ ({ anteckning: "Anteckning", lank: "Länk" });
const NYTT_NAMN = /** @type {const} */ ({ anteckning: "Ny anteckning", lank: "Ny länk" });

/**
 * "+ Ny" bredvid sökfältet. Under Alla ett val mellan typerna, under en typ den typen direkt.
 *
 * ⛔ AVTRYCKAREN ÄR INTE EN `OpsButton` MEN SER UT SOM EN (`knappKlass`): Radix `Popover.Trigger` ritar sitt eget
 * `<button>`, och `OpsButton` har ingen `forwardRef`. Samma skäl som plusset i `OpsAppShell`.
 *
 * @param {{ flik: "alla" | "anteckning" | "lank", onSkapa: (typ: "anteckning" | "lank") => void }} props
 */
function NyKnapp({ flik, onSkapa }) {
  const [oppen, setOppen] = useState(false);
  const innehall = (
    <>
      <Plus size={16} aria-hidden="true" />
      <span>Ny</span>
    </>
  );
  if (flik !== "alla") {
    return (
      <button type="button" aria-label={NYTT_NAMN[flik]} onClick={() => onSkapa(flik)} className={cx(knappKlass(), "shrink-0 cursor-pointer")}>
        {innehall}
      </button>
    );
  }
  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger aria-label="Ny post" aria-haspopup="menu" className={cx(knappKlass(), "shrink-0 cursor-pointer")}>
        {innehall}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className={cx("z-(--z-dropdown) min-w-44 p-1", radBehallare())}>
          <div role="menu" aria-label="Ny post">
            {BIBLIOTEKTYPER.map((typ) => (
              <button
                key={typ}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOppen(false);
                  onSkapa(typ);
                }}
                className={radKlass({ stor: true })}
              >
                <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-4">
                  {typ === "anteckning" ? <StickyNote size={16} /> : <Link size={16} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{TYPNAMN[typ]}</span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
 * @param {(id: string) => void | Promise<void>} [props.onRadera]
 */
function Detalj({ post, skapar, jag, onStang, onSpara, onRadera }) {
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
      <div data-bibliotek-detalj={typ} data-bibliotek-lasning="" className="flex flex-col gap-4">
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
    <div data-bibliotek-detalj={typ} className="flex flex-col gap-4">
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
      {post && !skapar ? <RaderaKontroll id={post.id} onRadera={onRadera} /> : null}
    </div>
  );
}

/**
 * Första trycket frågar. Andra tar bort. Avbryt lämnar posten.
 *
 * @param {{ id: string, namn?: string, onRadera?: (id: string) => void | Promise<void> }} props
 */
function RaderaKontroll({ id, namn = "Radera", onRadera }) {
  const [fraga, setFraga] = useState(false);
  const [fel, setFel] = useState("");
  if (!fraga) {
    return (
      <OpsButton variant="danger" onClick={() => setFraga(true)}>{namn}</OpsButton>
    );
  }
  return (
    <div data-bibliotek-bekrafta="" className="flex flex-col gap-2">
      <p>Radera posten? Den går inte att ångra.</p>
      {fel ? <p role="alert">{fel}</p> : null}
      <div className="flex gap-2">
        <OpsButton variant="secondary" onClick={() => { setFraga(false); setFel(""); }}>Avbryt</OpsButton>
        <OpsButton
          variant="danger"
          onClick={() => {
            if (typeof onRadera !== "function") {
              setFel("Raderingen är inte kopplad. Posten är kvar.");
              return;
            }
            try {
              const svar = onRadera(id);
              if (svar && typeof svar.then === "function") {
                svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
              }
            } catch (e) {
              setFel(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Radera posten
        </OpsButton>
      </div>
    </div>
  );
}
