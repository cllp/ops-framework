import { OpsPanelRow } from "./OpsPanel.jsx";
import { ChevronVansterIkon, LoggaUtIkon } from "./icons.jsx";
import { OpsCountBadge } from "./counter.jsx";
import { cx } from "../lib/cx.js";
import { validateNav } from "../lib/nav.js";
import { radKlass } from "../lib/radKlass.js";
import { text } from "../lib/sprak.js";
import { OPS_FRAMEWORK_VERSION } from "../lib/frameworkVersion.generated.js";

/**
 * Menyns INNEHÅLL: sektioner, utloggning, versionsraderna. INGEN egen
 * hamburgare längre, och ingen egen export från `src/index.js`.
 *
 * ══ ⛔ #164, ANDRA GRANSKNINGEN, RÄTTAT FRÅN "TVÅ HAMBURGARE" ════════════
 *
 * Korrigering A (se historiken i git) gav ramverket EN meny, men löste den
 * med en HELT EGEN `Popover.Root`/`Popover.Trigger` i `anvandare`-facket,
 * bredvid navigeringens EGEN hamburgare i `OpsAppShell`. Mätt mot en app som
 * byggde skalet: två hamburgare i samma toppräcke, en som öppnade
 * överflödesnavigeringen och en som öppnade `OpsMeny`. SessionStudio har EN.
 *
 * Den här filen ritar därför bara INNEHÅLLET: `OpsAppShell` äger triggern
 * (header-popovern på bred skärm, botten-Meny-arket på smal, se
 * `OpsBottomNav.jsx`) och öppning/stängningen. Innehållet är detsamma i
 * båda: appens sektioner, sedan navigeringens överflödsrader i en EGEN
 * sektion, sedan `menuExtras`, sedan Logga ut, sist de två versionsraderna.
 * Ordningen är skalets ansvar (se `OpsAppShell.jsx` och `OpsBottomNav.jsx`),
 * radrenderingen och valideringen är gemensam och ligger här, en gång, så de
 * två ytorna aldrig kan glida isär.
 *
 * ⛔ RADEN ÅTERANVÄNDER `OpsPanelRow`, INTE EN EGEN KOPIA. Notis- och
 * aktivitetspanelerna (#158) byggs redan av samma primitiv, och en app som
 * öppnar dem via en rad i menyn ska se EXAKT samma rad som panelen själv
 * ritar när den listar sina egna poster.
 *
 * ══ ⛔ TVÅ VERSIONSRADER, INTE EN MED PUNKT EMELLAN ══════════════════════
 *
 * Appens tal och ramverkets tal är två skilda fakta, och en rad som bär
 * båda går inte att peka på var för sig i ett prov eller i en skärmläsare
 * ("bolag-ops v1.4.2 · ops-framework v0.27.0" läses som en enda mening).
 */

/**
 * @typedef {object} MenyRad
 * @property {string} key
 * @property {import("react").ReactNode} etikett
 * @property {import("react").ReactNode} [ikon]
 * @property {() => void} [onClick]
 * @property {string} [href] Lämnar appen. Ritar en extern-länk-ikon i stället för
 *   en chevron. Kan inte kombineras med `chevron` eller `undervy`.
 * @property {boolean} [chevron] Raden öppnar en undervy. ⛔ FÅR INTE STÅ ENSAM
 *   (#166): en chevron lovar en vy som öppnas, och ritas den utan `undervy` är
 *   löftet tomt (se filhuvudets "chevronen var ett löfte som inte infriades").
 *   Sätt `undervy`, inte `chevron`: den senare sätts automatiskt när `undervy` finns.
 * @property {import("react").ReactNode} [undervy] Raden öppnar en undervy i SAMMA
 *   panel (#166): huvudet byts till en tillbakapil + radens `etikett` som rubrik,
 *   och det här innehållet ritas under. Ingen ny Popover/Dialog öppnas. Kan inte
 *   kombineras med `href`.
 * @property {import("react").ReactNode} [undervyAction] Ritas i undervyns huvud,
 *   till höger om rubriken (#166, samma plats som `OpsPanel`s `action`). T.ex.
 *   filter- och mer-knapparna till en `OpsActivityList`.
 * @property {number} [badge] Olästa eller liknande. Noll och under ritas inte.
 * @property {string} [badgeText] Skärmläsarord efter siffran, t.ex. "nya".
 */

/**
 * Skalets `meny`-prop, samma form på `OpsAppShell` och `OpsBottomNav` (#164,
 * andra granskningen). En typ, ett ställe: annars glider de två isär.
 * @typedef {object} MenyKonfiguration
 * @property {MenyRad[][]} [sektioner] RAMVERKETS rader, i sina sektioner: Aktivitet, Inställningar, Hjälp, Notiser
 *   när de finns. (Namnet är äldre än uppdelningen i 0.30.0 och står kvar så att ingen app går sönder.)
 * @property {import("../lib/nav.js").NavPost[]} [app] (0.30.0, #173) APPENS egna länkar, i en EGEN sektion med
 *   rubrik (`appRubrik`). ⛔ ALDRIG appens moduler: de bor i Hub. Menyn är det som gäller kontot och
 *   ramverket, Hub är det som gäller arbetet. Se README "Navigationen".
 * @property {string | { sv: string, en?: string }} [appRubrik] Rubriken över `app`. Förval `{ sv: "Appen", en: "App" }`.
 * @property {string} [sprak] Språket för `appRubrik` ("sv" eller "en"). Förval "sv".
 * @property {() => void} onLoggaUt
 * @property {string} [appVersion]
 * @property {string} [rubrik]
 * @property {string} [loggaUtEtikett]
 */

/**
 * Kastar om en sektionsrad saknar det den måste ha, oavsett vilken behållare
 * (header-popover eller botten-ark) som ska rita den. EN kontroll, inte en
 * i varje behållare som kan sluta stämma överens.
 * @param {MenyRad[][]} sektioner
 * @param {string} vem Vilket prop-namn felet ska peka på, t.ex. "OpsAppShell: meny.sektioner".
 */
export function validateMenySektioner(sektioner, vem) {
  for (const sektion of sektioner) {
    for (const rad of sektion) {
      if (!rad || !rad.key) {
        throw new Error(`${vem}: en rad saknar "key". Utan den kan React inte skilja raderna åt.`);
      }
      if (!rad.etikett) {
        throw new Error(`${vem}: raden "${rad.key}" saknar etikett.`);
      }
      // ⛔ #166, SAMMA STIL SOM OpsPanelRows BEFINTLIGA KONTROLL (href+chevron):
      // en rad med `href` lämnar appen, en rad med `undervy` stannar i SAMMA
      // panel. Två olika löften, och en rad kan inte hålla båda.
      if (rad.href && rad.undervy) {
        throw new Error(
          `${vem}: raden "${rad.key}" har både "href" och "undervy". En rad med href lämnar appen och ritar en extern-länk-ikon; en rad med undervy öppnar en undervy i SAMMA panel. De är olika löften och kan inte båda hållas av en rad.`,
        );
      }
      // ⛔ "CHEVRONEN VAR ETT LÖFTE SOM INTE INFRIADES" (se OpsAppShell.jsx,
      // RowEntry). Samma fel kan hända här: en rad som ritar en chevron men
      // inte öppnar något. `chevron` sätts numera AUTOMATISKT av `undervy`, så
      // en handskriven `chevron: true` utan `undervy` är alltid ett tomt löfte.
      if (rad.chevron && !rad.undervy) {
        throw new Error(
          `${vem}: raden "${rad.key}" har "chevron" utan "undervy". En chevron som inte öppnar något är ett löfte som bryts vid första trycket. Sätt "undervy" (chevronen ritas automatiskt), skriv inte "chevron" för hand.`,
        );
      }
    }
  }
}

/**
 * Hela menykonfigurationen, en kontroll för header-popovern OCH botten-arket.
 * @param {MenyKonfiguration} meny
 * @param {string} vem T.ex. "OpsAppShell".
 */
export function validateMeny(meny, vem) {
  if (typeof meny.onLoggaUt !== "function") {
    throw new Error(`${vem}: meny.onLoggaUt krävs (en funktion) när "meny" skickas in. Utan den kan ingen logga ut från menyn.`);
  }
  validateMenySektioner(meny.sektioner ?? [], `${vem}: meny.sektioner`);
  if (meny.app !== undefined) validateNav(meny.app, `${vem}: meny.app`);
}

/**
 * Stänger den behållare (Popover/Dialog) menyn ritas i INNAN appens egen
 * handling körs.
 *
 * ⛔ `fn` SKJUTS TILL NÄSTA TICK, OCH DET ÄR MÄTT, INTE FÖRSIKTIGHET (#158).
 * En rad som öppnar en ANNAN Radix-panel (t.ex. en aktivitetsknapp via en
 * chevron-rad) öppnade den ALDRIG i praktiken när stängningen och appens
 * `onClick` kördes i samma händelse: Radix Popover/Dialog river sin egen
 * "klick utanför"-lyssnare på samma klick som stänger den, och den nya
 * panelens öppning hann in i samma fönster och stängdes tillbaka på plats.
 * Symptomet var tyst, inget kastade: knappens `onClick` kördes (mätt med en
 * logg), state uppdaterades, men panelen syntes aldrig. `setTimeout(fn, 0)`
 * lägger appens handling EFTER att behållaren hunnit stänga och tas bort ur
 * DOM:en.
 * @param {() => void} onStang
 * @returns {(fn?: () => void) => () => void}
 */
export function kordarePafunktion(onStang) {
  return (fn) => () => {
    onStang();
    if (fn) setTimeout(fn, 0);
  };
}

/**
 * Ramverkets rader, i sina sektioner. Delad mellan header-popovern och
 * botten-arket, se filhuvudet.
 *
 * ⛔ #166: EN RAD MED `undervy` STÄNGER INTE MENYN. Den byter innehållet i
 * SAMMA panel (se `visaUndervy`, anropad av skalet), i stället för `kor` som
 * stänger hela Popover/Dialog innan appens `onClick` körs. Stänger man i
 * stället för att byta försvinner exakt det #166 ville rätta: en chevron-rad
 * som öppnar sin egen, lösa yta i stället för att stanna i menyn.
 *
 * ⛔ 0.30.0: RETURNERAR AVDELNINGAR, INTE FÄRDIGA BLOCK MED EGEN KANT. Före
 * 0.30.0 ritade varje sektion sin egen `border-t`, arkets rubrik sin egen
 * `border-b` och nav-blocket ovanför sin `mt-1 border-t pt-1`, så linjerna
 * lades på varandra: två streck med åtta pixlar emellan under rubriken i
 * mobilens meny (mätt i Chromium, se `check-skalyta`). Rotorsaken var att
 * ingen ägde frågan "var går en linje", alla svarade "ovanför mig".
 * `MenyAvdelningar` äger den nu och ritar EN avgränsare mellan varje par.
 * @param {object} props
 * @param {MenyRad[][]} props.sektioner
 * @param {(fn?: () => void) => () => void} props.kor
 * @param {(rad: MenyRad) => void} [props.visaUndervy] Krävs om någon rad har `undervy`.
 * @returns {MenyAvdelning[]}
 */
export function menySektioner({ sektioner, kor, visaUndervy }) {
  return sektioner
    .filter((sektion) => sektion.length > 0)
    .map((sektion, i) => ({
      key: `sektion-${i}`,
      innehall: sektion.map((rad) => (
        <OpsPanelRow
          key={rad.key}
          icon={rad.ikon}
          label={rad.etikett}
          chevron={rad.undervy ? true : rad.chevron}
          href={rad.href}
          badge={rad.badge}
          badgeText={rad.badgeText}
          onClick={rad.undervy ? () => visaUndervy?.(rad) : kor(rad.onClick)}
        />
      )),
    }));
}

/**
 * @typedef {object} MenyAvdelning
 * @property {string} key
 * @property {import("react").ReactNode} innehall
 */

/**
 * Menyns avdelningar med EN avgränsare mellan varje par, ingen före den första
 * och ingen efter den sista. Delad mellan header-popovern och botten-arket, så
 * de två aldrig kan glida isär igen.
 *
 * ⛔ TOMMA AVDELNINGAR RITAS INTE, och de får aldrig lämna en linje efter sig.
 * Filtret sker FÖRE räkningen: en tom avdelning i mitten hade annars gett två
 * streck (ett före den, ett efter), och det var just den formen felet hade.
 * @param {{ avdelningar: (MenyAvdelning | null | false | undefined)[] }} props
 */
export function MenyAvdelningar({ avdelningar }) {
  const synliga = /** @type {MenyAvdelning[]} */ (avdelningar.filter((a) => a && a.innehall));
  return synliga.map((a, i) => (
    <div key={a.key} data-meny-avdelning={a.key} className={cx("flex flex-col gap-0.5 p-1", i > 0 && "border-t border-line")}>
      {a.innehall}
    </div>
  ));
}

/**
 * Appens egna länkar (`meny.app`), som INTERNA länkar med samma rad som resten av
 * menyn. Barn (en nivå) ritas indragna under sin förälder.
 *
 * ⛔ `<a href>` OCH INTE `OpsPanelRow href`: den senare är en EXTERN länk
 * (`target="_blank"` och en extern-länk-ikon). Appens egna sidor lämnar inte appen.
 * @param {object} props
 * @param {import("../lib/nav.js").NavPost[]} props.poster
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {() => void} props.stang Stänger menyn innan navigeringen körs.
 * @param {string} [props.badgeText]
 */
export function MenyAppPoster({ poster, activeHref, onNavigate, stang, badgeText = "nya" }) {
  /** @param {import("../lib/nav.js").NavPost | { href: string, label: string }} p @param {boolean} [barn] */
  const rad = (p, barn = false) => {
    const aktiv = p.href === activeHref;
    const badge = /** @type {any} */ (p).badge;
    const ikon = /** @type {any} */ (p).icon;
    return (
      <a
        key={p.href}
        href={p.href}
        aria-current={aktiv ? "page" : undefined}
        onClick={(e) => {
          stang();
          onNavigate?.(p.href, e);
        }}
        className={cx(radKlass({ active: aktiv }), barn && "ml-6 w-auto")}
      >
        {ikon ? (
          <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-4">
            {ikon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{p.label}</span>
        {typeof badge === "number" ? <OpsCountBadge count={badge} text={badgeText} placement="inline" /> : null}
      </a>
    );
  };
  return poster.map((p) => (
    <div key={p.href} className="flex flex-col gap-0.5">
      {rad(p)}
      {(p.children ?? []).map((c) => rad(c, true))}
    </div>
  ));
}

/**
 * Sektionsrubriken över appens egna länkar. Typografirollen `liten` med versaler
 * och spärrning, som SessionStudios (`MobileHamburgerMenu.jsx:314`, `text-[10px]
 * uppercase tracking-wider text-muted font-medium`).
 * @param {{ children: import("react").ReactNode }} props
 */
export function MenySektionsrubrik({ children }) {
  return <p className="m-0 px-3 pt-1.5 pb-0.5 text-liten uppercase tracking-wider text-ink-muted">{children}</p>;
}

/**
 * Appens sektion i menyn, med rubrik. `null` när appen inte skickat några länkar.
 * @param {object} props
 * @param {MenyKonfiguration} props.meny
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {() => void} props.stang
 * @param {string} [props.badgeText]
 * @returns {MenyAvdelning | null}
 */
export function menyAppAvdelning({ meny, activeHref, onNavigate, stang, badgeText }) {
  if (!meny.app || meny.app.length === 0) return null;
  const rubrik = text(meny.appRubrik ?? { sv: "Appen", en: "App" }, meny.sprak ?? "sv");
  return {
    key: "app",
    innehall: (
      <>
        <MenySektionsrubrik>{rubrik}</MenySektionsrubrik>
        <MenyAppPoster poster={meny.app} activeHref={activeHref} onNavigate={onNavigate} stang={stang} badgeText={badgeText} />
      </>
    ),
  };
}

/**
 * Rubrikraden i menyns huvud: tillbakapil (bara i en undervy) + rubrik + en
 * valfri åtgärd till höger. Delad mellan header-popovern (som redan hade en
 * likadan rad) och botten-arkets `Dialog.Title`-rad (#166), så de två inte
 * kan glida isär.
 *
 * ⛔ INTE `OpsPanelHeader`: den komponenten har en egen bottenkant
 * (`border-b`) avsedd för `OpsPanel`s undervyer, medan skalets meny redan har
 * en egen kant runt hela huvudet (headerns `border-b border-line` respektive
 * sheetens `border-b`). Två kanter under varandra är en dubblett, inte en
 * gräns till.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.rubrik
 * @param {(() => void)} [props.onBack] Utan den ritas ingen pil, alltså menyns rot.
 * @param {string} [props.backLabel]
 * @param {import("react").ReactNode} [props.action]
 * @param {string} [props.className]
 */
export function MenyRubrikRad({ rubrik, onBack, backLabel = "Tillbaka till menyn", action, className }) {
  return (
    <div className={cx("flex items-center gap-1", className)}>
      <MenyTillbakaKnapp onBack={onBack} backLabel={backLabel} />
      <h2 className="m-0 min-w-0 flex-1 truncate text-base font-semibold text-ink">{rubrik}</h2>
      {action ? <div className="flex shrink-0 items-center gap-0.5">{action}</div> : null}
    </div>
  );
}

/**
 * Tillbakapilen ensam, utan sin egen rubrik. Exporteras separat för botten-
 * arket (#166): dess rubrikrad är `Dialog.Title` (Radix kräver EXAKT en per
 * dialog), och den kan inte ligga inuti `MenyRubrikRad`s egen `<h2>` utan att
 * skriva en rubrik i en rubrik. Samma knapp, samma klasser, som `MenyRubrikRad`
 * använder internt.
 * @param {object} props
 * @param {(() => void)} [props.onBack] Utan den ritas ingenting (menyns rot).
 * @param {string} [props.backLabel]
 */
export function MenyTillbakaKnapp({ onBack, backLabel = "Tillbaka till menyn" }) {
  if (!onBack) return null;
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={backLabel}
      className={cx(
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-secondary",
        "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <ChevronVansterIkon size={18} />
    </button>
  );
}

/**
 * Menyns SISTA två avdelningar, alltid i den ordningen: Logga ut, sedan
 * versionsraderna. Delad mellan header-popovern och botten-arket. Returneras
 * som avdelningar (se `MenyAvdelningar`), så avgränsaren mellan dem och allt
 * ovanför ägs av EN funktion.
 * @param {object} props
 * @param {() => void} props.onLoggaUt
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.appVersion] Appens egen versionstext, t.ex. "bolag-ops v1.4.2".
 *   ⛔ SAKNAS DEN skrivs raden ändå, med ramverkets ensam: tomhet är ett svar,
 *   inte en utelämnad rad (arbetsreglernas punkt 5).
 * @param {(fn?: () => void) => () => void} props.kor
 * @returns {MenyAvdelning[]}
 */
export function menyFot({ onLoggaUt, loggaUtEtikett = "Logga ut", appVersion, kor }) {
  return [
    { key: "loggaut", innehall: <OpsPanelRow icon={<LoggaUtIkon />} label={loggaUtEtikett} onClick={kor(onLoggaUt)} /> },
    {
      // ⛔ TVÅ RADER, INTE EN. Ramverkets rad kommer ur en konstant som
      // skrivs vid bygget ur package.json, ALDRIG en handskriven kopia här:
      // se `scripts/generate-framework-version.mjs` och provet i
      // `versionsrad.test.jsx` som är rött om de går isär.
      key: "versioner",
      innehall: (
        <div className="flex flex-col gap-0.5 px-3 py-1.5">
          {appVersion ? <span className="text-xs text-ink-muted">{appVersion}</span> : null}
          <span className="text-xs text-ink-muted">{`ops-framework v${OPS_FRAMEWORK_VERSION}`}</span>
        </div>
      ),
    },
  ];
}
