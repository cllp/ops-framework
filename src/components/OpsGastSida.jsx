import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { lasSparatSprak, sparaSprak, valdSprak } from "../lib/deladdatum.js";
import { GASTFEL, GASTNYLANK_SVAR, GASTNYCKELFORM, MAX_GASTNAMN, normaliseraGastepost } from "../lib/gast.js";
import { definierade, forvalda } from "../lib/ord.js";
import { PUBLIK_KLASS, PUBLIK_TONER } from "../lib/publikKlass.js";
import { SPRAK } from "../lib/sprak.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { PublikSprakval } from "./PublikSprakval.jsx";

/**
 * Orden på gästsidan, på svenska och engelska (0.131.0, cllp/lifehub.app#389). Svenskan i feltexterna är `GASTFEL` och ingen kopia av den (regel 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTSIDA = {
  sprakEtikett: { sv: "Språk", en: "Language" },
  laddar: { sv: "Hämtar", en: "Loading" },
  rubrikRosta: { sv: "Du är inbjuden att rösta", en: "You are invited to vote" },
  ingress: { sv: "Skriv adressen inbjudan skickades till, så öppnas omröstningen. Du behöver inget konto.", en: "Enter the address the invitation was sent to and the vote opens. You do not need an account." },
  adressEtikett: { sv: "Skriv adressen inbjudan skickades till", en: "Enter the address the invitation was sent to" },
  fortsatt: { sv: "Fortsätt", en: "Continue" },
  felAdress: { sv: "Det där ser inte ut som en e-postadress.", en: "That does not look like an email address." },
  orsak_nej: { sv: GASTFEL.nej, en: "The link or the address was not right" },
  orsak_aterkallad: { sv: GASTFEL.aterkallad, en: "The invitation has been withdrawn" },
  orsak_utgangen: { sv: GASTFEL.utgangen, en: "The link has expired" },
  "orsak_for-manga": { sv: GASTFEL["for-manga"], en: "Too many attempts. Wait a while and try again" },
  orsak_saknas: { sv: GASTFEL.saknas, en: "What you were invited to no longer exists" },
  kundeInte: { sv: "Det gick inte just nu. Försök igen.", en: "That did not work right now. Try again." },
  nyLankRubrik: { sv: "Be om en ny länk", en: "Ask for a new link" },
  nyLankIngress: { sv: "Skriv din adress, så skickar vi en ny länk om adressen har en inbjudan.", en: "Enter your address and we will send a new link if the address has an invitation." },
  nyLankKnapp: { sv: "Skicka en ny länk", en: "Send a new link" },
  nyLankSvar: { sv: GASTNYLANK_SVAR, en: "If the address has an invitation we have sent a link." },
  namnEtikett: { sv: "Vad ska gruppen kalla dig? (valfritt)", en: "What should the group call you? (optional)" },
  namnSpara: { sv: "Spara", en: "Save" },
  namnSparat: { sv: "Sparat", en: "Saved" },
  gastNot: { sv: "Du är gäst. Du ser bara det du bjudits in till.", en: "You are a guest. You only see what you were invited to." },
};

/** Orsakerna där en länk som gått ut ändå går att ersätta: adressen stämde, så sidan erbjuder en ny länk. */
const ERSATTBARA = /** @type {readonly string[]} */ (["utgangen"]);

/** Nyckeln en gästs session sparas under, per inbjudan. Sessionen ligger i webbläsarens minne och inte i adressen. */
const sessionsnyckelFor = (/** @type {string} */ id) => `ops-gast:${id}`;
/** Nyckeln som minns vilken inbjudan som senast öppnades, så att `/gast` utan länk öppnar rätt sak igen. */
const SENASTE = "ops-gast:senaste";

/**
 * Minnet för sessionen: webbläsarens (`localStorage`) om det går, annars ett som gäller tills sidan lämnas. Kastar aldrig: privat läge eller blockerad lagring ska inte stoppa sidan.
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void } | null | undefined} lagring
 */
function minne(lagring) {
  /** @type {Record<string, string>} */
  const reserv = {};
  const l = lagring === undefined ? (() => { try { return globalThis.localStorage; } catch { return null; } })() : lagring;
  return {
    /** @param {string} k @returns {string | null} */
    las(k) {
      try {
        const v = l ? l.getItem(k) : null;
        return v ?? reserv[k] ?? null;
      } catch {
        return reserv[k] ?? null;
      }
    },
    /** @param {string} k @param {string} v */
    skriv(k, v) {
      reserv[k] = v;
      try {
        l?.setItem(k, v);
      } catch {
        /* Reserven gäller tills sidan lämnas. */
      }
    },
    /** @param {string} k */
    glom(k) {
      delete reserv[k];
      try {
        l?.removeItem(k);
      } catch {
        /* Inget att göra: det finns inget sparat. */
      }
    },
  };
}

/**
 * Gästens egen sida: det en person ser som bjudits in utan konto, på `/gast` (0.131.0, cllp/lifehub.app#389, skiva 1).
 *
 * ══ ⛔ SIDAN HAR INGEN FIREBASE OCH INGET KONTO, OCH DEN RITAS FÖRE APPENS GRIND ════════════════════════════════════════
 *
 * Appen ritar den på `/gast` före sin inloggning, utan Firebase, med `noindex`. Sidan vet inget om gruppen, medlemmarna eller andra gäster: den får `onLos`, `onHamta`, `onNamn` och
 * `onNyLank` (appens anrop mot `/api/gast`) och ritar vad de svarar. Sakens eget kort (för omröstningen: förslagen, Ja, Kanske, Nej och summan) är appens och ritas av `renderSak`.
 *
 * ══ ⛔ ADRESSEN SKRIVS EN GÅNG, SEDAN STANNAR GÄSTEN INLOGGAD PÅ ENHETEN ═══════════════════════════════════════════════
 *
 * Första öppningen med en länk (`lank`, ur `tolkaGastLank(location.hash)`): sidan frågar efter adressen och postar `{ id, nyckel, epost }`. Ett ja ger en sessionsnyckel som sparas i webbläsarens
 * minne (per inbjudan), och fragmentet tas bort ur adressraden så att nyckeln inte ligger kvar i historiken. Nästa gång sidan öppnas, med eller utan länk, hämtas saken direkt med sessionen. På en ny
 * enhet finns ingen session: gästen skriver adressen på `/gast` och får en ny länk (`onNyLank`), med samma svar hur det än gått.
 *
 * ⛔ ALLA NEJ ÄR ETT NEJ. Fel nyckel, fel adress och okänd inbjudan ger samma text (`orsak_nej`). `aterkallad` och `utgangen` kommer bara när adressen stämt. Sidan försöker inte vara klyftigare än servern.
 *
 * ⛔ ÅTERKALLNING SYNS INOM EN MINUT. Sidan hämtar på nytt när fliken får fokus och var `intervallMs`:e millisekund medan den är öppen (förval 60 s). Svarar servern att inbjudan är återkallad byts
 * sakens kort mot texten, och inget mer går att göra.
 *
 * ⛔ KNAPPARNA VÄNTAR SJÄLVA (`OpsButton`, 0.129.0). Ett andra tryck medan ett anrop väntar startar inget nytt: servern räknar felaktiga adresser per inbjudan.
 *
 * ⛔ SPRÅKET ÄR BESÖKARENS (som `OpsDeladHandelse`): SV och EN i huvudet, förval webbläsarens språk, valet sparas. Ger appen `sprak` är språket appens.
 *
 * @param {object} props
 * @param {{ id: string, nyckel: string } | null} [props.lank] Id och nyckel ur adressens fragment (`tolkaGastLank`), eller `null` när sidan öppnas utan länk.
 * @param {(arg: { id: string, nyckel: string, epost: string }) => Promise<{ ok: boolean, sessionsnyckel?: string, orsak?: string }>} props.onLos
 * @param {(arg: { sessionsnyckel: string }) => Promise<{ ok: boolean, namn?: string, funktion?: string, sak?: Record<string, any>, orsak?: string }>} props.onHamta
 * @param {(arg: { epost: string }) => Promise<unknown>} props.onNyLank Ger alltid samma svar; sidan skriver ut `nyLankSvar` oavsett vad som kommer tillbaka.
 * @param {(arg: { sessionsnyckel: string, namn: string }) => Promise<unknown>} [props.onNamn] Utelämnad: ingen namnruta.
 * @param {(arg: { sak: Record<string, any>, funktion: string, sessionsnyckel: string, uppdatera: () => Promise<void> }) => import("react").ReactNode} [props.renderSak] Sakens kort. `uppdatera` hämtar saken på nytt (efter en röst).
 * @param {import("react").ReactNode} [props.huvud] Appens logga eller namn, till vänster i huvudet.
 * @param {string} [props.sprak] `sv` eller `en` om appen styr det. Utelämnat: sidan väljer själv och minns valet.
 * @param {(sprak: string) => void} [props.onSprak]
 * @param {number} [props.intervallMs] Hur ofta saken hämtas på nytt medan sidan är öppen. Förval 60 000. `0` stänger av tidtagningen (fokus hämtar ändå).
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void } | null} [props.lagring] Minnet för sessionen. Förval `localStorage`; `null` ger bara minne för den här sidvisningen.
 * @param {Partial<Record<keyof typeof ORD_OPSGASTSIDA, string>>} [props.ord] Egna texter, som vinner över ordboken.
 */
export function OpsGastSida({ lank = null, onLos, onHamta, onNyLank, onNamn, renderSak, huvud, sprak, onSprak, intervallMs = 60_000, lagring, ord }) {
  for (const [namn, f] of /** @type {const} */ ([["onLos", onLos], ["onHamta", onHamta], ["onNyLank", onNyLank]])) {
    if (typeof f !== "function") throw new Error(`OpsGastSida: ${namn} krävs, en funktion som anropar appens /api/gast.`);
  }
  if (lank !== null && (!lank || typeof lank.id !== "string" || !GASTNYCKELFORM.test(lank.nyckel))) {
    throw new Error("OpsGastSida: lank är { id, nyckel } ur tolkaGastLank, eller null.");
  }
  if (sprak !== undefined && !(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) {
    throw new Error(`OpsGastSida: språket ${JSON.stringify(sprak)} finns inte (giltiga: ${SPRAK.join(", ")}).`);
  }
  const [valt, setValt] = useState(() => valdSprak({ sparat: lasSparatSprak(), webblasare: typeof navigator === "undefined" ? undefined : navigator.language }));
  const aktivt = sprak ?? valt;
  const t = { ...forvalda(ORD_OPSGASTSIDA, aktivt), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const mem = useRef(minne(lagring));

  /** @type {[{ fas: "startar" | "adress" | "ny-lank" | "klar" | "fel" | "nylank-skickad" }, Function]} */
  const [lage, setLage] = useState({ fas: "startar" });
  const [sessionsnyckel, setSessionsnyckel] = useState(/** @type {string | null} */ (null));
  const [svar, setSvar] = useState(/** @type {Record<string, any> | null} */ (null));
  const [orsak, setOrsak] = useState("");
  const [epost, setEpost] = useState("");
  const [fel, setFel] = useState("");
  const [namn, setNamn] = useState("");
  const [namnSparat, setNamnSparat] = useState(false);
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  /** @param {string} s */
  function valj(s) {
    if (sprak === undefined) setValt(/** @type {"sv" | "en"} */ (s));
    sparaSprak(s);
    if (onSprak) onSprak(s);
  }

  /**
   * Hämtar saken med en session. `tyst` (tidtagningen och fokus): ett fel byter bara vyn om servern säger att åtkomsten är borta, ett nätfel lämnar den som den är.
   * @param {string} nyckel
   * @param {{ tyst?: boolean }} [val]
   * @returns {Promise<boolean>} Sant om saken gick att visa.
   */
  const hamta = useCallback(
    /**
     * @param {string} nyckel
     * @param {{ tyst?: boolean }} [val]
     * @returns {Promise<boolean>}
     */
    async (nyckel, val = {}) => {
      let r;
      try {
        r = await onHamta({ sessionsnyckel: nyckel });
      } catch {
        if (!val.tyst && levande.current) {
          setOrsak("kundeInte");
          setLage({ fas: "fel" });
        }
        return false;
      }
      if (!levande.current) return false;
      if (r && r.ok) {
        setSvar(r);
        setNamn(typeof r.namn === "string" ? r.namn : "");
        setLage({ fas: "klar" });
        return true;
      }
      setOrsak(`orsak_${r && typeof r.orsak === "string" ? r.orsak : "nej"}`);
      setLage({ fas: "fel" });
      return false;
    },
    [onHamta],
  );

  // Första gången: finns en session för inbjudan (länkens, annars den senast öppnade) hämtas saken direkt. Annars frågar sidan efter adressen, eller erbjuder en ny länk.
  useEffect(() => {
    const id = lank?.id ?? mem.current.las(SENASTE);
    const lagrad = id ? mem.current.las(sessionsnyckelFor(id)) : null;
    if (lagrad && GASTNYCKELFORM.test(lagrad)) {
      setSessionsnyckel(lagrad);
      void (async () => {
        let r;
        try {
          r = await onHamta({ sessionsnyckel: lagrad });
        } catch {
          if (levande.current) {
            setOrsak("kundeInte");
            setLage({ fas: "fel" });
          }
          return;
        }
        if (!levande.current) return;
        if (r && r.ok) {
          setSvar(r);
          setNamn(typeof r.namn === "string" ? r.namn : "");
          setLage({ fas: "klar" });
          return;
        }
        // En session som servern inte känner igen glöms. Återkallad och saknas är besked till gästen och inte skäl att be om adressen.
        if (r && (r.orsak === "aterkallad" || r.orsak === "saknas")) {
          setOrsak(`orsak_${r.orsak}`);
          setLage({ fas: "fel" });
          return;
        }
        if (id) mem.current.glom(sessionsnyckelFor(id));
        setSessionsnyckel(null);
        setLage({ fas: lank ? "adress" : "ny-lank" });
      })();
      return;
    }
    setLage({ fas: lank ? "adress" : "ny-lank" });
    // Körs en gång per sidvisning och länk: att hämta om vid varje ny funktionsidentitet vore att hämta i en loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lank?.id]);

  // Återkallning och ändringar syns: hämta på nytt när fliken får fokus och var `intervallMs`:e millisekund medan den är öppen.
  useEffect(() => {
    if (!sessionsnyckel || lage.fas !== "klar") return undefined;
    const om = () => void hamta(sessionsnyckel, { tyst: true });
    const synlig = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") om();
    };
    const timer = intervallMs > 0 ? setInterval(om, intervallMs) : null;
    if (typeof window !== "undefined") window.addEventListener("focus", om);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", synlig);
    return () => {
      if (timer) clearInterval(timer);
      if (typeof window !== "undefined") window.removeEventListener("focus", om);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", synlig);
    };
  }, [sessionsnyckel, lage.fas, intervallMs, hamta]);

  async function skickaAdress() {
    if (!lank) return;
    setFel("");
    if (normaliseraGastepost(epost) === null) {
      setFel(t.felAdress);
      return;
    }
    let r;
    try {
      r = await onLos({ id: lank.id, nyckel: lank.nyckel, epost: epost.trim() });
    } catch {
      if (levande.current) setFel(t.kundeInte);
      return;
    }
    if (!levande.current) return;
    if (r && r.ok && typeof r.sessionsnyckel === "string" && GASTNYCKELFORM.test(r.sessionsnyckel)) {
      mem.current.skriv(sessionsnyckelFor(lank.id), r.sessionsnyckel);
      mem.current.skriv(SENASTE, lank.id);
      setSessionsnyckel(r.sessionsnyckel);
      // Nyckeln ska inte ligga kvar i adressraden eller historiken när den fyllt sin uppgift.
      try {
        if (typeof window !== "undefined" && window.history?.replaceState) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch {
        /* Adressraden går inte att ändra här: inget att göra. */
      }
      await hamta(r.sessionsnyckel);
      return;
    }
    const o = r && typeof r.orsak === "string" ? r.orsak : "nej";
    setFel(t[`orsak_${o}`] ?? t.orsak_nej);
    if (ERSATTBARA.includes(o)) setOrsak(`orsak_${o}`);
  }

  async function begarNyLank() {
    setFel("");
    if (normaliseraGastepost(epost) === null) {
      setFel(t.felAdress);
      return;
    }
    try {
      await onNyLank({ epost: epost.trim() });
    } catch {
      // ⛔ Ett fel visas inte som ett annat svar än det vanliga: servern svarar likadant hur det än gått, och sidan gör det också.
    }
    if (levande.current) setLage({ fas: "nylank-skickad" });
  }

  async function sparaNamn() {
    if (!onNamn || !sessionsnyckel) return;
    setFel("");
    try {
      await onNamn({ sessionsnyckel, namn: namn.trim() });
      if (levande.current) setNamnSparat(true);
    } catch {
      if (levande.current) setFel(t.kundeInte);
    }
  }

  const adressFormulär = (/** @type {{ rubrik: string, ingress: string, etikett: string, knapp: string, onKlar: () => Promise<void> }} */ p) => (
    <form
      data-gast-form={lage.fas}
      noValidate
      className="flex w-full max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <h1 className={PUBLIK_KLASS.sida}>{p.rubrik}</h1>
      <p className={PUBLIK_KLASS.brod}>{p.ingress}</p>
      <OpsField label={p.etikett} error={fel || undefined}>
        <OpsInput value={epost} onChange={setEpost} type="email" autoComplete="email" tal={false} />
      </OpsField>
      <div>
        <OpsButton type="submit" variant="primary" onClick={p.onKlar}>
          {p.knapp}
        </OpsButton>
      </div>
      {lage.fas === "adress" && orsak === "orsak_utgangen" ? (
        <div className="flex flex-col gap-2">
          <OpsButton variant="secondary" onClick={begarNyLank}>
            {t.nyLankKnapp}
          </OpsButton>
        </div>
      ) : null}
    </form>
  );

  return (
    <div lang={aktivt} data-gastsida="" data-sprak={aktivt} className={cx("flex min-h-dvh w-full flex-col", PUBLIK_TONER.ljus.band, PUBLIK_TONER.ljus.rubrik)}>
      <header className="sticky top-0 z-10 border-b border-publik-ljus-text/10 bg-publik-ljus">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <div data-gast-huvud="" className="flex min-w-0 items-center">{huvud}</div>
          <PublikSprakval aktivt={aktivt} etikett={t.sprakEtikett} onVal={valj} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-16 sm:pt-12">
        {lage.fas === "startar" ? (
          <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
        ) : lage.fas === "adress" ? (
          adressFormulär({ rubrik: t.rubrikRosta, ingress: t.ingress, etikett: t.adressEtikett, knapp: t.fortsatt, onKlar: skickaAdress })
        ) : lage.fas === "ny-lank" ? (
          adressFormulär({ rubrik: t.nyLankRubrik, ingress: t.nyLankIngress, etikett: t.adressEtikett, knapp: t.nyLankKnapp, onKlar: begarNyLank })
        ) : lage.fas === "nylank-skickad" ? (
          <div data-gast-nylank-skickad="">
            <OpsEmpty title={t.nyLankSvar} />
          </div>
        ) : lage.fas === "fel" ? (
          <div data-gast-fel={orsak.replace(/^orsak_/, "")}>
            <OpsEmpty title={t[orsak] ?? t.orsak_nej} />
          </div>
        ) : (
          <div data-gast-klar="" className="flex min-w-0 flex-col gap-6">
            {svar && renderSak && svar.sak ? renderSak({ sak: svar.sak, funktion: String(svar.funktion ?? ""), sessionsnyckel: /** @type {string} */ (sessionsnyckel), uppdatera: async () => void (await hamta(/** @type {string} */ (sessionsnyckel), { tyst: true })) }) : null}
            {onNamn && svar && !svar.namn && !namnSparat ? (
              <form
                data-gast-namn=""
                noValidate
                className="flex max-w-md flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <OpsField label={t.namnEtikett} error={fel || undefined}>
                  <OpsInput value={namn} onChange={setNamn} maxLength={MAX_GASTNAMN} autoComplete="name" tal={false} />
                </OpsField>
                <div>
                  <OpsButton type="submit" variant="secondary" onClick={sparaNamn}>
                    {t.namnSpara}
                  </OpsButton>
                </div>
              </form>
            ) : null}
            {namnSparat ? <p data-gast-namn-sparat="" role="status" className={PUBLIK_KLASS.brod}>{t.namnSparat}</p> : null}
            <p data-gast-not="" className="m-0 text-meta text-publik-ljus-dampad">{t.gastNot}</p>
          </div>
        )}
      </main>
    </div>
  );
}
