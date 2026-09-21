import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { OpsBrand } from "./OpsBrand.jsx";
import { OpsBottomNav } from "./OpsBottomNav.jsx";
import { postAktiv, valideraNav } from "../lib/nav.js";
import { Raknare } from "./raknare.jsx";
import { ChevronNedIkon, MenyIkon } from "./icons.jsx";

/**
 * Appskalet: varumärke, navigering och ett utrymme för konto och tema.
 *
 * ⛔ Skalet är ROUTER-AGNOSTISKT, och det är ett medvetet val.
 *
 * Ramverket får inte bero på react-router, för då tvingar det varje plattform
 * till samma routerval för all framtid. Lösningen är att skalet renderar riktiga
 * `<a href>` och tar emot ett valfritt `onNavigate`. Appen skickar in en
 * hanterare som anropar sin router och stoppar webbläsarens omladdning.
 *
 * ⛔ Skalet vet aldrig vilka destinationer en plattform har. Listan kommer in
 * som `nav`-data. Dyker ett plattformsspecifikt ord upp här är något fel.
 *
 * Navigering i två lägen, en sanning:
 *   - Bred skärm (md+): länkarna i toppraden.
 *   - Smal skärm (under md): `OpsBottomNav`, en fast bottenrad med en Meny-sheet
 *     för överflödet. Den gamla push-menyn i headern finns inte längre — två
 *     mobila menyer parallellt är två sanningar.
 */

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.brand Appens namn som sträng, eller en egen `OpsBrand`. Länkar till startsidan.
 * @param {import("../lib/nav.js").NavPost[]} props.nav Toppdestinationer. `{ href, label }` räcker; `icon`, `badge` och `children` (en nivå) är valfria tillägg.
 * @param {string} props.activeHref Vilken sida som visas nu.
 * @param {(href: string, event: any) => void} [props.onNavigate] Anropas i stället för webbläsarens navigering.
 * @param {import("react").ReactNode} [props.actions] Temaväxlare, konto, sök. Ligger till höger.
 * @param {{ label: string, onClick: () => void, icon?: import("react").ReactNode }} [props.primaryAction] Det man GÖR i appen, inte går till. Blir en rund knapp mitt i bottenraden på telefon. ⛔ På bred skärm finns ingen bottenrad, så appen sätter samma åtgärd i `actions` själv: skalet gissar inte var en knapp hör hemma i en toppradslayout det inte äger.
 * @param {string} [props.menuLabel] Text på Meny-platsen i bottenraden.
 * @param {string} [props.navLabel] Skärmläsarnamn på toppradens navigering.
 * @param {number} [props.maxTopNav] Hur många destinationer som får plats i toppraden på bred skärm (1024 och uppåt). Resten hamnar i hamburgarmenyn.
 * @param {number} [props.maxTopNavSmal] Hur många som får plats mellan 768 och 1024. Mätt: fler än tre ger horisontell scroll på en iPad i stående läge.
 * @param {string} [props.moreLabel] Namn på överflödesmenyn (aria/nav). Knappen visar en hamburgare, inte text.
 * @param {string} [props.badgeText] Skärmläsarord efter siffran i en räknare, t.ex. "olästa". Appen bestämmer vad den räknar.
 * @param {string} [props.bottomNavLabel] Skärmläsarnamn på bottenraden. ⛔ Eget
 *   namn med flit, INTE samma som `navLabel`: se OpsBottomNav för varför två
 *   navigeringar med samma namn gör app-tester tvetydiga.
 * @param {import("react").ReactNode} props.children
 */
export function OpsAppShell({
  brand,
  nav,
  activeHref,
  onNavigate,
  actions,
  primaryAction,
  menuLabel = "Meny",
  navLabel = "Huvudnavigering",
  // ⛔ Fem, inte "så många som får plats". En mätning av tillgänglig bredd vid
  // varje rendering ger hopp när typsnittet laddar och gör ordningen beroende av
  // fönstret. Ett fast tak är förutsägbart, och appen styr vilka fem genom sin
  // ordning.
  maxTopNav = 5,
  maxTopNavSmal,
  moreLabel = "Meny",
  badgeText = "nya",
  bottomNavLabel = "Snabbnavigering",
  children,
}) {
  valideraNav(nav, "OpsAppShell");
  // ⛔ Kastar hellre än att rendera en rad som tyst tappar destinationer:
  // vore taket på smal skärm högre skulle poster mellan talen ligga i raden på
  // smal skärm och ingenstans alls på bred.
  if (maxTopNavSmal !== undefined && maxTopNavSmal > maxTopNav) {
    throw new Error(
      `OpsAppShell: maxTopNavSmal (${maxTopNavSmal}) kan inte vara större än maxTopNav (${maxTopNav}). Den smala skärmen visar aldrig fler än den breda.`,
    );
  }
  // Standardvärdet HÄRLEDS och står inte i signaturen. En app som säger
  // `maxTopNav={2}` har sagt allt som behövs, och ska inte behöva känna till
  // ett andra tal för att slippa ett undantag.
  const smaltTak = maxTopNavSmal ?? Math.min(3, maxTopNav);
  const [merOppen, setMerOppen] = useState(false);

  // ⛔ En sträng blir ett riktigt varumärke, inte fet text. Skälet är att det
  // vanliga fallet ska vara det rätta fallet: skriver man `brand="Bolag Ops"`
  // får man PH.ST-märket och namnet, utan att behöva veta att `OpsBrand` finns.
  const varumarke = typeof brand === "string" ? <OpsBrand title={brand} /> : brand;

  /** @param {string} href @param {any} e */
  const klick = (href, e) => {
    if (onNavigate) onNavigate(href, e);
  };

  /**
   * ⛔ AKTIV FLIK ÄR EN UNDERSTRYKNING, INTE EN FYLLD PILL.
   *
   * Den första versionen gav aktiv post `bg-accent-subtle`, alltså en ifylld
   * chip. Den läses som en KNAPP man kan trycka på, inte som "du är här", och
   * med tio poster i rad blir resultatet att man inte ser var man står. Det var
   * ordagrant vad som rapporterades: "menyn är enorm, man vet inte var man är".
   *
   * En understruken flik säger position. Det är också vad SessionStudio gör, och
   * den likheten är hela poängen med paritet: samma sak ska se likadan ut.
   *
   * ⛔ TRE LÄGEN, INTE TVÅ, och det tredje finns av ett mätt skäl.
   *
   * När antalet i raden ändras vid `lg` kan samma destination ligga i raden på
   * bred skärm och i menyn på smal. Då måste "du är här" sitta på olika ställen
   * vid olika bredder, och det går inte att uttrycka med en boolean.
   *
   * Klasserna står utskrivna i stället för att byggas, av samma skäl som
   * `OpsCard`s kantfärger: Tailwind läser källkoden som text.
   */
  /**
   * ⛔ `inline-flex` STÅR INTE HÄR, och det är inte en stilfråga.
   *
   * Först gjorde den det, och posterna utanför det smala taket fick
   * `hidden lg:inline-flex` ovanpå. De doldes aldrig. Tailwind skriver
   * `.hidden` före `.inline-flex` i utdatan, så när ett element bär båda vinner
   * den senare, och raden var lika bred som förut. Mätningen i Chromium gav
   * exakt samma 892 px efter "fixen" som före, vilket är skälet till att den
   * finns: enhetstestet såg grönt ut eftersom jsdom inte kör någon CSS alls.
   *
   * Därför äger anropsstället display-klassen, och de två kan inte krocka.
   */
  /**
   * ⛔ KLASSERNA ÄR AVLÄSTA UR SESSIONSTUDIO, INTE VALDA AV MIG.
   *
   * `apps/web/src/components/AppHeader.jsx`, flikknappen:
   *
   *   relative shrink-0 px-3 lg:px-4 py-2 text-sm font-medium whitespace-nowrap
   *   transition-all border-b-2
   *   aktiv:    border-[--color-text-primary] text-[--color-text-primary]
   *   inaktiv:  border-transparent text-[--color-text-muted]
   *             hover:text-[--color-text-secondary]
   *             hover:border-[--color-border-hover]
   *
   * Översatt till tokenkontraktet: `text-primary` är `ink`, `text-muted` är
   * `ink-muted`, `text-secondary` är `ink-secondary`, `border-hover` är
   * `line-strong`.
   *
   * ⛔ Två glidningar rättas här, och båda var mina egna:
   *   - `text-base font-semibold` skulle varit `text-sm font-medium`. Raden såg
   *     tyngre ut än förlagan.
   *   - Inaktiv flik var `text-ink-secondary` med hover till `ink`. Förlagan
   *     går från `muted` till `secondary`, alltså en svagare vila och ett
   *     svagare lyft. Min variant gjorde hela raden mörkare och lät varje flik
   *     se halvaktiv ut, vilket är precis det som gör att man inte ser var man
   *     står.
   */
  const lankKlass = (/** @type {"av"|"pa"|"pa-under-lg"} */ lage) =>
    cx(
      "relative shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium lg:px-4",
      "transition-all duration-(--duration-fast) ease-standard",
      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
      lage === "pa" && "border-ink text-ink",
      lage === "av" && "border-transparent text-ink-muted hover:border-line-strong hover:text-ink-secondary",
      lage === "pa-under-lg" &&
        "border-ink text-ink lg:border-transparent lg:text-ink-muted lg:hover:border-line-strong lg:hover:text-ink-secondary",
    );

  // ⛔ Bara de första får plats i raden, resten hamnar i hamburgarmenyn.
  //
  // Skälet är mätt: bolag-ops har tretton destinationer, och tretton platta
  // textlänkar får inte plats på någon skärm. De klämdes ihop tills de sista
  // hamnade under temaväxlaren och två försvann helt. Ingen "smart" prioritering
  // och ingen mätning av tillgänglig bredd: appen listar sina destinationer i
  // den ordning den vill ha dem, och de första syns. Samma regel som
  // bottenraden, av samma skäl.
  //
  // ⛔ TVÅ TAL, INTE ETT, OCH DET ANDRA KOMMER UR EN MÄTNING.
  //
  // Ett enda `maxTopNav` fick raden att fungera på 1280 och spricka på 768.
  // Mätt i Chromium mot en riktig app: vid 768 px blev sidan 892 px bred,
  // alltså horisontell scroll på VARJE rutt, med länkarna och överflödesknappen
  // utanför kanten. Länkarna vägde 110 till 129 px styck, knappen ~44, varumärket och
  // temaväxlaren omkring 184 tillsammans. Tre länkar plus "Mer" får plats vid
  // 768, fyra gör det inte.
  //
  // Bytet sker i CSS vid `lg`, inte genom att mäta bredd i JavaScript. En
  // ResizeObserver hade gett samma utseende och tre nya problem: ett hopp
  // första renderingen, en rad som inte finns i markup förrän JS kört, och ett
  // test som måste låtsas ha en layout. CSS vet redan hur bred skärmen är.
  const iRaden = nav.slice(0, maxTopNav);
  const iMenyn = nav.slice(smaltTak);
  const aktivIndex = nav.findIndex((s) => postAktiv(s, activeHref));

  // Ligger den aktiva posten i menyn på BÅDA bredderna, eller bara på den
  // smala? Utan den skillnaden är ingenting markerat mellan 768 och 1024, och
  // det är exakt felet raden skulle rätta: man ser inte var man är.
  const merLage =
    aktivIndex >= maxTopNav ? "pa" : aktivIndex >= smaltTak ? "pa-under-lg" : "av";

  return (
    <div className="min-h-dvh bg-canvas">
      {/* `top-(--safe-top)` och inte `top-0`: utan säker yta hamnar raden under
          statusfältet på en telefon, och det syns bara på riktig hårdvara. */}
      <header className="sticky top-(--safe-top) z-(--z-chrome) border-b border-line bg-surface">
        {/*
          ⛔ TRE KOLUMNER, INTE EN FLEX-RAD MED flex-1.

          Brand vänster, primärflikar mitt i headern, åtgärder + hamburgare
          höger — samma upplägg som SessionStudio. En `flex-1`-nav vänsterjusterar
          flikarna mot varumärket. Grid med `1fr auto 1fr` håller mitten mitt
          utan att absolutpositionera över åtgärderna.
        */}
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2">
          <a
            href="/"
            onClick={(e) => klick("/", e)}
            className="justify-self-start shrink-0 rounded-md px-1 py-1 text-md font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {varumarke}
          </a>

          {/* Bred skärm: länkarna centrerade. Smal: bottenraden nedan. */}
          <nav aria-label={navLabel} className="hidden items-center gap-1 justify-self-center md:flex">
            {iRaden.map((s, i) => (
              <a
                key={s.href}
                href={s.href}
                onClick={(e) => klick(s.href, e)}
                aria-current={postAktiv(s, activeHref) ? "page" : undefined}
                className={cx(
                  lankKlass(postAktiv(s, activeHref) ? "pa" : "av"),
                  // Utanför det som får plats vid 768: finns i menyn i stället,
                  // och `display:none` tar bort den ur uppläsningen också, så
                  // ingen möter samma destination två gånger.
                  i >= smaltTak ? "hidden lg:inline-flex" : "inline-flex",
                )}
              >
                {/*
                  ⛔ INGEN IKON HÄR, OCH DET ÄR MÄTT, INTE TYCKT.

                  Toppraden ritade `s.icon` en kort period, efter rapporten
                  "finns inga ikoner?". Den rapporten gällde att ikonfältet
                  slängdes överallt, och jag drog slutsatsen till toppraden utan
                  att titta på förlagan.

                  SessionStudios header (`apps/web/src/components/AppHeader.jsx`)
                  renderar `{n.label}` och inget annat. Chevron bara på posten
                  med undermeny, badge som en liten cirkel. Ikonerna sitter i
                  hamburgermenyn (16 px) och i mobilens bottenrad (20 px), aldrig
                  i flikraden.

                  Utfallet av min variant beskrevs som "fruktansvärda, ser
                  80-tal ut". Med tolv ikoner i rad blir raden en verktygslåda i
                  stället för fyra ord, och ett kontosammanhang har inga
                  självklara bilder: en spargris för pension är den sortens
                  gissning som ser billig ut i just det sammanhang där den ska
                  inge förtroende.

                  `icon` är kvar i kontraktet. Bottenraden och menyn ritar den.
                  Den här raden gör det inte.
                */}
                {s.label}
                {Array.isArray(s.children) && s.children.length ? (
                  <span aria-hidden="true" className="ml-0.5 inline-block shrink-0">
                    <ChevronNedIkon size={12} />
                  </span>
                ) : null}
                {typeof s.badge === "number" && s.badge > 0 ? <Raknare antal={s.badge} text={badgeText} /> : null}
              </a>
            ))}
          </nav>

          {/*
            ⛔ Hamburgaren LIGGER EFTER actions, längst till höger.
            Inte inne i den centrerade nav-klustret och inte före temaväxlaren.
            SessionStudio: sök/tema/… sedan hamburgare sist.

            ⛔ gap-1, inte gap-2. Klustret är 44 px-ikonknappar; gap-2 gjorde
            dem glest på desktop (bolag-ops #246). gap-1 håller träffytorna
            men sätter dem tätare.
          */}
          <div className="flex shrink-0 items-center justify-self-end gap-1">
            {actions}
            {iMenyn.length ? (
              <Popover.Root open={merOppen} onOpenChange={setMerOppen}>
                <Popover.Trigger
                  className={cx(
                    // Samma 44 px ikonknapp som tema/sök — inte en textflik "Mer".
                    "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md",
                    "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    // Aktiv sida bakom menyn: mörkare bläck, samma språk som OpsIconLink.
                    merLage === "pa" && "text-ink",
                    merLage === "pa-under-lg" && "text-ink lg:text-ink-secondary",
                    merLage === "av" && "text-ink-secondary",
                    // Ryms allt i raden vid `lg` finns ingen meny att öppna där.
                    // Under md finns bottenradens Meny i stället — dölj här.
                    "hidden md:inline-flex",
                    nav.length <= maxTopNav && "lg:hidden",
                  )}
                  // ⛔ Ingen siffra i namnet. Antalet bakom knappen beror på
                  // skärmbredden, och ett tal som bara stämmer ibland är värre
                  // än inget tal.
                  aria-label={`${moreLabel}, fler destinationer`}
                >
                  <MenyIkon size={20} />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={4}
                    className="z-(--z-dropdown) min-w-52 rounded-md border border-line bg-raised p-1 shadow-md"
                  >
                    {/* ⛔ Egen nav med eget namn. Menyn är en lista destinationer,
                        alltså navigering, och utan namn blir den en tredje
                        anonym `<nav>` i dokumentet. */}
                    <nav aria-label={moreLabel} className="flex flex-col">
                      {iMenyn.map((s, i) => (
                        <a
                          key={s.href}
                          href={s.href}
                          onClick={(e) => {
                            setMerOppen(false);
                            klick(s.href, e);
                          }}
                          aria-current={postAktiv(s, activeHref) ? "page" : undefined}
                          className={cx(
                            "flex min-h-11 items-center gap-2 rounded-sm px-3 text-base",
                            // Ligger i raden vid `lg`, alltså inte också här.
                            smaltTak + i < maxTopNav && "lg:hidden",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                            postAktiv(s, activeHref) ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                          )}
                        >
                          {s.icon ? (
                            <span aria-hidden="true" className="shrink-0">
                              {s.icon}
                            </span>
                          ) : null}
                          {s.label}
                        </a>
                      ))}
                    </nav>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : null}
          </div>
        </div>
      </header>

      {/* `padding-bottom` lika med bottenradens höjd plus säker yta, men bara
          under md där baren finns. Utan den ligger sista kortet under baren, och
          det upptäcks först när någon inte hittar sin sista rad. */}
      <main className="pb-[calc(var(--bottom-nav-h)+var(--safe-bottom))] md:pb-0">{children}</main>

      <OpsBottomNav
        nav={nav}
        activeHref={activeHref}
        onNavigate={onNavigate}
        primaryAction={primaryAction}
        menuLabel={menuLabel}
        navLabel={bottomNavLabel}
        badgeText={badgeText}
      />
    </div>
  );
}
