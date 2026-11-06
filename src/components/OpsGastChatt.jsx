import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { GASTSKRIV_MAX_TECKEN } from "../lib/gast.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsGastFelrad } from "./OpsGastFelrad.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { Meddelanderader, Skrivfalt, texterPa } from "./OpsMeddelanden.jsx";
/** Kortets ritning, hämtad när ett kort slås upp (se `bibliotekPostkortVisning`). */
const laddaPostkortVisning = () => import("./bibliotekPostkortVisning.jsx");

/**
 * Orden i gästens chatt, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTCHATT = {
  rubrik: { sv: "Chatt", en: "Chat" },
  tom: { sv: "Inga meddelanden än.", en: "No messages yet." },
  // ⛔ (0.190.0, QA fynd 8 i cllp/lifehub.app#658) Ingen mening under skrivfältet längre: märket Gäst syns på bubblan, en klippknapp som saknas säger att bilagor
  // inte går, och trådar syns som "N svar" under meddelandet (0.191.0). Bara den som inte får skriva får en rad, eftersom det inte syns på något annat sätt.
  skrivskyddad: { sv: "Du kan läsa chatten men inte skriva i den.", en: "You can read the chat but not write in it." },
  skrivFel: { sv: "Meddelandet kunde inte skickas.", en: "The message could not be sent." },
  aldre: { sv: "Visa äldre meddelanden", en: "Show older messages" },
  bilaga: { sv: "Bilaga: {namn}. Bilagor visas inte för gäster.", en: "Attachment: {namn}. Attachments are not shown to guests." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  fel: { sv: "Chatten kunde inte hämtas just nu.", en: "The chat could not be loaded right now." },
  laddar: { sv: "Hämtar chatten", en: "Loading the chat" },
  svar: { sv: "{n} svar", en: "{n} replies" },
  svarEtt: { sv: "1 svar", en: "1 reply" },
  trad: { sv: "Tråd", en: "Thread" },
  tillbaka: { sv: "Till chatten", en: "Back to the chat" },
  tradLaddar: { sv: "Hämtar tråden", en: "Loading the thread" },
  tradFel: { sv: "Tråden kunde inte hämtas just nu.", en: "The thread could not be loaded right now." },
  tradTom: { sv: "Inga svar än.", en: "No replies yet." },
  // ⛔ SKRIVFÄLTET SÄGER VART MEDDELANDET GÅR (0.195.0). CP 2026-11-06 på datorn: "Vet inte var man skall skriva in chattmeddelanden. Konstigt om den ligger längst ner kanske?
  // Hur brukar det se ut?", med Signal som förebild: fältet längst ned och platstexten "Meddelande". Här med gruppens namn, eftersom gästen bara har en chatt och kan undra vem som läser.
  platstext: { sv: "Meddelande till {grupp}", en: "Message to {grupp}" },
  platstextTrad: { sv: "Svara i tråden", en: "Reply in the thread" },
};

/**
 * Loggens klasser (0.195.0). Utan `fyll` är loggen en ruta med egen ram, högst 60 % av fönstret. Med `fyll` är den hela ytan utan ram (CP 2026-11-06: "Det finns en rund
 * border i web, den yttersta som känns överflödig"), och skrivfältet under har inget streck och inget eget indrag (`ram={false}`):
 * det har samma vänster- och högerkant som meddelandena (CP samma dag från telefonen: "Sedan kanske skrivfältet kan vara lika brett som chattramen?").
 */
const LOGG_RUTA = "max-h-[60dvh] min-h-48 rounded-lg border border-line bg-surface p-3";
const LOGG_FYLLD = "min-h-0 flex-1 py-3";

/** Märket för gästens egna meddelanden i raderna. Ingen avsändare kan heta så, och namnen kommer aldrig härifrån. */
const EGEN = "__gast_egen__";

/**
 * Gruppens chatt för en gäst (0.132.0, cllp/lifehub.app#389, skiva 2).
 *
 * ══ ⛔ DEN RITAR MEDLEMMENS BUBBLOR (`Meddelanderader`), INTE MEDLEMMENS CHATT ═══════════════════════════════════════════
 *
 * `OpsMeddelanden` är 4 300 rader med en samtalskälla, skrivfält, trådar, reaktioner och fästa meddelanden, och ingenting av det går att slå av för en gäst. Den rena ritaren av raderna
 * (dagsavdelare, bubblor, tid) är en egen funktion i samma fil och tar raderna som props; den delas här (regel 2), så att en gästs chatt ser ut som medlemmens utan en andra bubbla att hålla i takt.
 * Skrivfältet är chattens (`Skrivfalt`, delat) utan bilagor, omnämnanden och agent. Mikrofonen är webbläsarens taligenkänning (0.190.0, `igenkanning`), aldrig serverns utskrift.
 * Reaktioner och bilagornas innehåll byggs inte. En bilaga SÄGS (`bilaga`) i stället för att tiga; meningen under skrivfältet är borta (0.190.0, QA fynd 8).
 *
 * ⛔ TRÅDAR (0.191.0, cllp/lifehub.app#663): ett meddelande med svar bär knappen "N svar" (tjänstens `svar`). Den öppnar tråden i samma yta: roten, svaren och ett skrivfält som svarar i tråden
 * (`onLasTrad`, `onSkrivITrad`, tjänstens `chatt({ trad })` och `skrivChatt({ trad })`). Bara text, som i chatten. Utan `onLasTrad` ritas ingen knapp.
 *
 * ⛔ KORT (0.191.0): en länk till en post i gruppens bibliotek ritas som chattens kort (`kort` ur tjänsten, ritat med `postkortFor`, samma rubrik, typ och ikon som listan). Servern har redan
 * prövat att gästen ser posten; vyn ritar bara det den fick. Ett tryck öppnar posten i gästens bibliotek (`onOppnaPost`), aldrig länken: den pekar på medlemmarnas app.
 *
 * ⛔ AVSÄNDAREN ÄR ETT NAMN OCH ALDRIG ETT UID. Tjänsten (`createGastService.chatt`) skickar `av: { namn }`; vyn använder namnet som nyckel för avatar och sammanhållning av på varandra följande
 * meddelanden. Ingen adress eller uid finns att visa.
 *
 * ⛔ TOMT ÄR ETT SVAR: utan meddelanden står `tom`. Äldre meddelanden hämtas med en knapp (`onAldre`), inte tyst.
 *
 * @param {object} props
 * @param {ReadonlyArray<{ id: string, av: { namn: string }, text: string, tid: number, svarPa?: { id: string, namn: string, text: string }, bilaga?: { namn: string, typ: string } }>} props.meddelanden Tjänstens `chatt().meddelanden`, äldst först.
 * @param {boolean} [props.fler] Det finns äldre meddelanden (`chatt().fler`).
 * @param {() => void | Promise<unknown>} [props.onAldre] Hämtar nästa sida bakåt. Utan den ritas ingen knapp.
 * @param {(text: string) => Promise<unknown>} [props.onSkriv] (0.132.0, CP 2026-10-20: "Gästen får skriva") Skickar ett meddelande (tjänstens `skrivChatt`). Ger den ett fel visas dess text under fältet och texten står kvar.
 *   Utan den ritas inget skrivfält och sidan säger att chatten bara går att läsa.
 * @param {boolean} [props.laddar] Första sidan hämtas ännu.
 * @param {string | null} [props.fel] Hämtningen föll. Ett fel är inte "inga meddelanden".
 * @param {() => void} [props.onForsokIgen] (0.192.0, cllp/lifehub.app#675) Hämtar igen efter ett fel. Med den står en Försök igen under felet.
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTCHATT, string>>} [props.ord]
 * @param {import("../lib/talk.js").Igenkanning | boolean} [props.igenkanning] (0.190.0, CP 2026-11-05: gästen får mikrofon) Webbläsarens taligenkänning i skrivfältet, samma som
 *   medlemmarnas. Förval `true`: ljudvågen står där webbläsaren har igenkänningen och saknas annars. Ingen serverutskrift för gäster. `false` stänger av den.
 * @param {(trad: string) => Promise<{ rot: any, meddelanden: any[], fler?: boolean }>} [props.onLasTrad] (0.191.0) Läser tråden ur ett meddelande (tjänstens `chatt({ trad })`). Utan den: ingen trådknapp.
 * @param {(trad: string, text: string) => Promise<unknown>} [props.onSkrivITrad] (0.191.0) Svarar i tråden (tjänstens `skrivChatt({ trad, text })`). Utan den: tråden går att läsa men inte svara i.
 * @param {(postId: string) => void} [props.onOppnaPost] (0.191.0) Öppnar posten ett kort pekar på, i gästens bibliotek.
 * @param {boolean} [props.fyll] (0.190.0, del B) Chatten fyller sin förälders höjd: loggen rullar i den och skrivfältet står längst ned. Gästens telefonvy, där ytan
 *   mellan huvudet och bottenraden har en mätt höjd, och sedan 0.195.0 också datorns (CP 2026-11-06: "Kan sidan gå ända ner eller hur blir det i chatten i Web?"). Utan den är loggen
 *   högst 60 % av fönstret, som förut. ⛔ I FYLLT LÄGE HAR LOGGEN INGEN EGEN RAM: den är hela ytan, som i Signal, och en ram runt den blev en ruta i en ruta.
 * @param {string} [props.gruppnamn] (0.195.0) Gruppens namn, till skrivfältets platstext ("Meddelande till {grupp}"). Utan den står skrivfältets egen platstext.
 */
export function OpsGastChatt({ meddelanden, fler = false, onAldre, onSkriv, laddar = false, fel = null, onForsokIgen, sprak = "sv", ord, igenkanning = true, fyll = false, onLasTrad, onSkrivITrad, onOppnaPost, gruppnamn }) {
  if (!Array.isArray(meddelanden)) {
    throw new Error("OpsGastChatt: meddelanden måste vara en lista, tom när chatten är tom. Utan den går det inte att skilja 'inga meddelanden' från 'inte hämtad'.");
  }
  for (const m of meddelanden) {
    if (!m || typeof m.id !== "string" || typeof m.tid !== "number" || typeof m.av?.namn !== "string") throw new Error("OpsGastChatt: varje meddelande har { id, av: { namn }, text, tid } (tjänstens chatt()).");
  }
  const t = { ...forvalda(ORD_OPSGASTCHATT, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const texter = useMemo(() => texterPa(sprak, {}), [sprak]);
  const logg = useRef(/** @type {HTMLDivElement | null} */ (null));
  const sistaId = meddelanden.length > 0 ? meddelanden[meddelanden.length - 1].id : "";
  // Chatten börjar nederst, där det nyaste står. Ett nytt meddelande rullar bara ner den som redan står längst ned.
  const vidBotten = useRef(true);
  useEffect(() => {
    const el = logg.current;
    if (el && vidBotten.current) el.scrollTop = el.scrollHeight;
  }, [sistaId]);

  const [skrivText, setSkrivText] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [skrivFel, setSkrivFel] = useState("");
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);
  async function skicka() {
    const ut = skrivText.trim();
    if (!ut || !onSkriv || skickar) return;
    setSkickar(true);
    setSkrivFel("");
    try {
      await onSkriv(ut);
      if (!levande.current) return;
      setSkrivText("");
      // Det gästen själv skrev ska synas: scrollen följer med hela vägen ned.
      vidBotten.current = true;
    } catch (e) {
      if (levande.current) setSkrivFel(e instanceof Error && e.message ? e.message : t.skrivFel);
    } finally {
      if (levande.current) setSkickar(false);
    }
  }
  // ── Tråden (0.191.0) ──
  const [trad, setTrad] = useState(/** @type {null | { id: string, rot: any, meddelanden: any[], fel: boolean, laddar: boolean }} */ (null));
  /** @param {string} id */
  async function oppnaTrad(id) {
    if (!onLasTrad) return;
    setTrad({ id, rot: null, meddelanden: [], fel: false, laddar: true });
    try {
      const r = await onLasTrad(id);
      if (levande.current) setTrad((f) => (f && f.id === id ? { id, rot: r.rot, meddelanden: r.meddelanden ?? [], fel: false, laddar: false } : f));
    } catch {
      if (levande.current) setTrad((f) => (f && f.id === id ? { ...f, fel: true, laddar: false } : f));
    }
  }
  /** @param {string} id @param {string} text */
  async function skrivITrad(id, text) {
    if (!onSkrivITrad) return;
    await onSkrivITrad(id, text);
    if (!onLasTrad || !levande.current) return;
    const r = await onLasTrad(id);
    if (levande.current) setTrad((f) => (f && f.id === id ? { id, rot: r.rot, meddelanden: r.meddelanden ?? [], fel: false, laddar: false } : f));
  }

  // ⛔ GÄSTENS EGNA MEDDELANDEN ÄR "EGNA" (höger, accentfärg) som medlemmens: `uid` är ett märke som bara raderna känner igen. Ett annat namn är en avsändare, och märket Gäst sitter på varje meddelande en gäst skrivit.
  const rader = useMemo(() => meddelanden.map((m) => ({ id: m.id, text: m.text, av: m.egen ? EGEN : m.av.namn, tid: m.tid, ...(m.gast ? { gast: true } : {}), ...(m.svarPa ? { svarPa: m.svarPa.id } : {}) })), [meddelanden]);
  const originalPerId = useMemo(() => new Map(meddelanden.map((m) => [m.id, m])), [meddelanden]);
  const uppslag = useMemo(
    () => new Map(meddelanden.filter((m) => m.svarPa).map((m) => [/** @type {string} */ (m.svarPa?.id), { id: /** @type {string} */ (m.svarPa?.id), av: /** @type {string} */ (m.svarPa?.namn), text: /** @type {string} */ (m.svarPa?.text), tid: 0 }])),
    [meddelanden],
  );

  // ── Korten (0.191.0) ──
  // ⛔ ETT STABILT UPPSLAG: chatten minns uppslagen per funktion, så funktionen är densamma mellan ritningarna och läser korten ur en ref som följer meddelandena.
  const kortRef = useRef(/** @type {Map<string, any>} */ (new Map()));
  kortRef.current = useMemo(() => {
    const m = new Map();
    for (const x of meddelanden) for (const k of /** @type {any[]} */ (/** @type {any} */ (x).kort ?? [])) m.set(k.url, k);
    for (const x of trad?.rot ? [trad.rot, ...trad.meddelanden] : []) for (const k of /** @type {any[]} */ (x.kort ?? [])) m.set(k.url, k);
    return m;
  }, [meddelanden, trad]);
  const slaUpp = useCallback(async (/** @type {string} */ url) => {
    const k = kortRef.current.get(url);
    if (!k) return null;
    return (await laddaPostkortVisning()).postkortFor({ typ: k.typ, rubrik: k.rubrik, ...(k.mime ? { fil: { mime: k.mime } } : {}) }, sprak);
  }, [sprak]);
  const postkort = useMemo(
    () => ({
      slaUpp,
      onOppna: (/** @type {string} */ url, /** @type {import("react").MouseEvent} */ e) => {
        // Länken pekar på medlemmarnas app, dit gästen inte kommer. Posten öppnas i gästens bibliotek, eller inte alls.
        e.preventDefault();
        const k = kortRef.current.get(url);
        if (k && onOppnaPost) onOppnaPost(k.postId);
      },
    }),
    [slaUpp, onOppnaPost],
  );

  if (trad) {
    return (
      <GastTrad
        trad={trad}
        t={t}
        texter={texter}
        locale={locale}
        sprak={sprak}
        postkort={postkort}
        onStang={() => setTrad(null)}
        onSkriv={onSkrivITrad ? (text) => skrivITrad(trad.id, text) : undefined}
        igenkanning={igenkanning}
        fyll={fyll}
      />
    );
  }

  return (
    <section aria-label={t.rubrik} data-gast-chatt="" data-fyll={fyll ? "" : undefined} className={cx("flex min-w-0 flex-col gap-3", fyll && "min-h-0 flex-1 pt-2")}>
      {fel ? (
        <OpsGastFelrad data="gast-chatt-fel" text={t.fel} forsokIgen={t.forsokIgen} onForsokIgen={onForsokIgen} />
      ) : laddar ? (
        <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
      ) : meddelanden.length === 0 ? (
        <OpsEmpty title={t.tom} />
      ) : (
        <div
          ref={logg}
          role="log"
          aria-label={t.rubrik}
          data-gast-chatt-logg=""
          onScroll={(e) => {
            const el = e.currentTarget;
            vidBotten.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className={cx("flex min-w-0 flex-col overflow-y-auto", fyll ? LOGG_FYLLD : LOGG_RUTA)}
        >
          {fler && onAldre ? (
            <div className="flex justify-center pb-2">
              <OpsButton variant="secondary" size="sm" onClick={onAldre}>
                {t.aldre}
              </OpsButton>
            </div>
          ) : null}
          <Meddelanderader
            meddelanden={/** @type {any} */ (rader)}
            uid={EGEN}
            namnFor={(/** @type {string} */ namn) => namn}
            medlemmar={[]}
            locale={locale}
            visaNamn
            texter={texter}
            citat={{ pa: false, onCitera: () => {}, uppslag: /** @type {any} */ (uppslag) }}
            postkort={postkort}
            efter={(m) => {
              const original = /** @type {any} */ (originalPerId.get(m.id));
              const bilaga = original?.bilaga;
              const svar = typeof original?.svar === "number" && original.svar > 0 ? original.svar : 0;
              if (!bilaga && !(svar && onLasTrad)) return null;
              return (
                <>
                  {bilaga ? <span data-gast-chatt-bilaga="" className="text-meta text-ink-muted">{t.bilaga.replace("{namn}", bilaga.namn)}</span> : null}
                  {svar && onLasTrad ? (
                    <span data-gast-chatt-svar={m.id}>
                      <OpsButton variant="ghost" size="sm" onClick={() => oppnaTrad(m.id)} busyLabel={t.tradLaddar}>
                        {svar === 1 ? t.svarEtt : t.svar.replace("{n}", String(svar))}
                      </OpsButton>
                    </span>
                  ) : null}
                </>
              );
            }}
          />
        </div>
      )}
      {onSkriv ? (
        <div data-gast-chatt-skriv="" className={cx("flex min-w-0 flex-col", fyll && "mt-auto")}>
          <Skrivfalt text={skrivText} setText={setSkrivText} skickar={skickar} onSkicka={skicka} texter={texter} sprak={sprak} maxTecken={GASTSKRIV_MAX_TECKEN} igenkanning={igenkanning} ram={false} platstext={gruppnamn ? t.platstext.replace("{grupp}", gruppnamn) : undefined} />
        </div>
      ) : null}
      {skrivFel ? <p role="alert" data-gast-chatt-skrivfel="" className="m-0 text-etikett text-danger">{skrivFel}</p> : null}
      {onSkriv ? null : <p data-gast-chatt-skrivskyddad="" className="m-0 text-meta text-ink-muted">{t.skrivskyddad}</p>}
    </section>
  );
}

/**
 * En tråd i gästens chatt (0.191.0): roten, svaren och skrivfältet. Samma bubblor som chatten (`Meddelanderader`).
 * @param {{ trad: { id: string, rot: any, meddelanden: any[], fel: boolean, laddar: boolean }, t: Record<string, string>, texter: any, locale: string, sprak: string, postkort: any, onStang: () => void, onSkriv?: (text: string) => Promise<unknown>, igenkanning: any, fyll: boolean }} props
 */
function GastTrad({ trad, t, texter, locale, sprak, postkort, onStang, onSkriv, igenkanning, fyll }) {
  const [skrivText, setSkrivText] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [skrivFel, setSkrivFel] = useState("");
  const alla = trad.rot ? [trad.rot, ...trad.meddelanden] : [];
  const rader = alla.map((m) => ({ id: m.id, text: m.text, av: m.egen ? EGEN : m.av.namn, tid: m.tid, ...(m.gast ? { gast: true } : {}) }));
  async function skicka() {
    const ut = skrivText.trim();
    if (!ut || !onSkriv || skickar) return;
    setSkickar(true);
    setSkrivFel("");
    try {
      await onSkriv(ut);
      setSkrivText("");
    } catch (e) {
      setSkrivFel(e instanceof Error && e.message ? e.message : t.skrivFel);
    } finally {
      setSkickar(false);
    }
  }
  return (
    <section aria-label={t.trad} data-gast-chatt-trad={trad.id} className={cx("flex min-w-0 flex-col gap-3", fyll && "min-h-0 flex-1 pt-2")}>
      <div>
        <OpsButton variant="secondary" size="sm" onClick={onStang}>
          {t.tillbaka}
        </OpsButton>
      </div>
      {trad.fel ? (
        <p role="alert" data-gast-chatt-tradfel="" className="m-0 text-etikett text-danger">{t.tradFel}</p>
      ) : trad.laddar ? (
        <OpsEmpty busy title={t.tradLaddar} busyLabel={t.tradLaddar} />
      ) : rader.length === 0 ? (
        <OpsEmpty title={t.tradTom} />
      ) : (
        <div role="log" aria-label={t.trad} className={cx("flex min-w-0 flex-col overflow-y-auto", fyll ? LOGG_FYLLD : LOGG_RUTA)}>
          <Meddelanderader meddelanden={/** @type {any} */ (rader)} uid={EGEN} namnFor={(/** @type {string} */ namn) => namn} medlemmar={[]} locale={locale} visaNamn texter={texter} postkort={postkort} />
          {!trad.laddar && trad.rot && trad.meddelanden.length === 0 ? <p data-gast-chatt-tradtom="" className="m-0 pt-2 text-meta text-ink-muted">{t.tradTom}</p> : null}
        </div>
      )}
      {onSkriv && trad.rot ? (
        <div data-gast-chatt-tradskriv="" className={cx("flex min-w-0 flex-col", fyll && "mt-auto")}>
          <Skrivfalt text={skrivText} setText={setSkrivText} skickar={skickar} onSkicka={skicka} texter={texter} sprak={sprak} maxTecken={GASTSKRIV_MAX_TECKEN} igenkanning={igenkanning} ram={false} platstext={t.platstextTrad} />
        </div>
      ) : null}
      {skrivFel ? <p role="alert" data-gast-chatt-tradskrivfel="" className="m-0 text-etikett text-danger">{skrivFel}</p> : null}
    </section>
  );
}
