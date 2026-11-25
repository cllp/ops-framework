import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Helskärm för en yta, med ett fast lager som reserv (0.234.0, en sanning för PDF-vyn och kartan, regel 2).
 *
 * ══ ⛔ HÄNDELSEN ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * PDF-vyn fick Helskärm i 0.196.0, med webbläsarens egen helskärm där den finns och ett lager som fyller fönstret där den inte gör
 * det. CP 2026-11-16: "Jag kan inte få en fullscreen för kartor, det är ett måste." Kartan får samma beteende, och beteendet bor här
 * i stället för att skrivas en gång till.
 *
 *   - `oppna()` anropas i trycket: webbläsaren släpper bara in helskärm i en användargest. Finns `requestFullscreen` och säger dokumentet
 *     ja (`fullscreenEnabled`) blir läget `helskarm`. Annars, och om webbläsaren avslår (iPhone ger inte ett element helskärm), `fonster`:
 *     anroparen ritar ytan som ett fast lager över hela skärmen.
 *   - Lämnas helskärmen utan oss (Esc i webbläsaren, F11, en annan flik) är läget slut. Webbläsaren äger det läget.
 *   - I `fonster` stänger Escape lagret, och sidan bakom rullar inte medan lagret ligger över den.
 *   - ⛔ AVMONTERAS ÄGAREN I HELSKÄRM AVSLUTAS HELSKÄRMEN (0.249.1, GPT:s granskning av cllp/lifehub.app PR 922). Tavlan lägger hela sidan
 *     (`document.documentElement`) i helskärm, och sidan finns kvar när tavlan avmonteras. Mätt i byggd Chromium på 390 och 1280: öppna ett kort
 *     med ikonen, gå tillbaka, och `document.fullscreenElement` var fortfarande sidan medan den nya tavlan saknade Stäng helskärm. Personen satt kvar
 *     i webbläsarens helskärm utan utväg. Ett element som tas bort ur sidan lämnar helskärmen av sig självt (PDF-vyn, kartan), sidan gör det inte.
 *     Därför minns kroken elementet den själv bad om (`agd`) och avslutar helskärmen vid avmonteringen bara om det fortfarande är det elementet
 *     som är i helskärm. En helskärm någon annan bett om lämnas orörd.
 *
 *
 * ══ ⛔ VYN SOM VAR I HELSKÄRM KAN BÖRJA I HELSKÄRM IGEN (0.262.0, cllp/lifehub.app#933) ═══════════════════════════════════════════════
 *
 * CP 2026-11-25 om tavlan: "Kan den komma ihåg om man hade helskärm så att den utgår ifrån det om man kom ifrån helskärm. Det ger en upplevelse
 * om att man inte lämnat." Tavlan öppnar ett kort i kortets egen vy, och avmonteringen ovan avslutade helskärmen, så man kom tillbaka till en
 * vanlig tavla. Två delar, och båda väljs av anroparen:
 *   - `behall()` anropas när ägaren lämnar vyn för att komma tillbaka (tavlan, innan kortet öppnas). Då lämnas helskärmen kvar vid avmonteringen,
 *     så att webbläsarens helskärm ligger kvar medan kortets vy visas.
 *   - `start` (andra argumentet) är läget vyn hade. Är elementet fortfarande i webbläsarens helskärm tar kroken över den (`helskarm`, och den blir
 *     krokens egen igen, så att Stäng och avmonteringen fungerar). Annars ritas lagret (`fonster`): en webbläsare släpper bara in sin egen helskärm
 *     i ett tryck, och ett lager kräver inget tryck. Personen ser ändå tavlan över hela fönstret, och Stäng finns.
 *   Händelsen bakom avmonteringen ovan gäller fortfarande: utan `behall()` avslutas helskärmen som förut, och en vy som tar över helskärmen ritar
 *   alltid sin Stäng, så ingen sitter kvar utan utväg.
 *
 *
 * ══ ⛔ DÄR ETT SVEP STÄNGER WEBBLÄSARENS HELSKÄRM VÄLJS LAGRET (0.263.0, cllp/lifehub.app#967) ═════════════════════════════════════════
 *
 * CP 2026-11-25 om kartan på iPhone: "det ska vara lite svårare att stänga helskärmsläge, man får aktivt trycka för att stänga helskärm. Annars så
 * stängs den nästan hela tiden när man sveper runt." Mätt i WebKits källa (main, 2026-11-25): `WKFullScreenWindowControllerIOS.mm` lägger en
 * `UISwipeGestureRecognizer` nedåt med ett finger och en `UIPanGestureRecognizer` på helskärmens vy, och båda stänger helskärmen. De känns igen
 * samtidigt med allt annat (`shouldRecognizeSimultaneouslyWithGestureRecognizer` svarar `YES`), och de är påslagna på hela iOS-familjen
 * (`ENABLE_FULLSCREEN_DISMISSAL_GESTURES`, `PlatformEnableCocoa.h`). En sida kan inte stänga av dem: de ligger i UIKit, utanför webbsidan. Den som drar
 * kartan söderut drar alltså fingret nedåt, och helskärmen stängs. `WKFullScreenViewController.mm` ritar dessutom en egen stängknapp och skylten
 * "is in full screen. Swipe down to exit.", och det var det andra krysset på CP:s skärmbild, under klockan bredvid kartans eget.
 *   - `undvikSvep` (andra argumentet) väljer lagret (`fonster`) där webbläsarens helskärm stängs av ett svep (`svepStangerHelskarm`), också när
 *     `requestFullscreen` finns. Lagret täcker hela skärmen med säkra zoner, och i appen på hemskärmen (`viewport-fit=cover`, statusraden genomskinlig)
 *     ser det likadant ut som webbläsarens helskärm. Bara Stäng och Escape stänger det.
 *   - Utan `undvikSvep` är beteendet som förut. PDF-vyn och tavlan har inte valt det ännu: det är deras eget beslut (S6).
 *
 * @param {{ current: HTMLElement | null }} yta Elementet som blir helskärm.
 * @param {{ start?: false | "helskarm" | "fonster", undvikSvep?: boolean }} [val] `start`: läget vyn hade när den lämnades (`behall`), för att börja i det
 *   igen. `undvikSvep`: lagret i stället för webbläsarens helskärm där ett svep stänger den.
 * @returns {{ lage: false | "helskarm" | "fonster", oppna: () => void, avsluta: () => void, behall: () => void }}
 */
export function useHelskarm(yta, { start = false, undvikSvep = false } = {}) {
  const [lage, setLage] = useState(/** @type {false | "helskarm" | "fonster"} */ (false));
  /** Elementet kroken själv bad om helskärm för, så att avmonteringen bara avslutar sin egen. */
  const agd = useRef(/** @type {Element | null} */ (null));
  /** Satt av `behall()`: avmonteringen lämnar helskärmen kvar, eftersom vyn kommer tillbaka och tar över den (`start`). */
  const behalls = useRef(false);
  const startlage = useRef(start);

  // ⛔ FÖRE MÅLNINGEN, så att en tavla som ska börja i helskärm aldrig syns en bild i vanligt läge.
  useLayoutEffect(() => {
    const onskat = startlage.current;
    if (!onskat || typeof document === "undefined") return;
    const el = yta.current;
    if (el && document.fullscreenElement === el) {
      agd.current = el;
      setLage("helskarm");
      return;
    }
    setLage("fonster");
  }, [yta]);

  const behall = useCallback(() => {
    behalls.current = true;
  }, []);

  const avsluta = useCallback(() => {
    setLage(false);
    agd.current = null;
    if (typeof document !== "undefined" && document.fullscreenElement && document.fullscreenElement === yta.current) document.exitFullscreen?.()?.catch(() => {});
  }, [yta]);

  const oppna = useCallback(() => {
    const el = yta.current;
    const kan = Boolean(el) && typeof document !== "undefined" && Boolean(document.fullscreenEnabled) && typeof el?.requestFullscreen === "function" && !(undvikSvep && svepStangerHelskarm());
    setLage(kan ? "helskarm" : "fonster");
    if (kan && el) {
      agd.current = el;
      const tillFonster = () => {
        agd.current = null;
        setLage((nu) => (nu ? "fonster" : nu));
      };
      try {
        el.requestFullscreen()?.catch(tillFonster);
      } catch {
        tillFonster();
      }
    }
  }, [yta, undvikSvep]);

  useEffect(() => {
    if (lage !== "helskarm") return undefined;
    const vid = () => {
      if (document.fullscreenElement === yta.current) return;
      agd.current = null;
      setLage(false);
    };
    document.addEventListener("fullscreenchange", vid);
    return () => document.removeEventListener("fullscreenchange", vid);
  }, [lage, yta]);

  /*
   * ⛔ OCH EN BEGÄRAN SOM FORTFARANDE VÄNTAR AVSLUTAS NÄR DEN KOMMER FRAM (GPT:s granskning av PR 636). `requestFullscreen()` är asynkron. Lämnas vyn
   * innan webbläsaren gått in i helskärm är `fullscreenElement` ännu tom vid avmonteringen, och en begäran som lyckas efteråt lägger sidan i helskärm
   * utan någon kvar som äger den. Därför lyssnar avmonteringen en gång på `fullscreenchange` och `fullscreenerror`: blir det vårt element avslutas
   * helskärmen, annars lämnas den (någon annans, eller ingen).
   */
  useEffect(
    () => () => {
      const egen = agd.current;
      agd.current = null;
      if (!egen || behalls.current) return;
      const lamna = () => {
        if (document.fullscreenElement === egen) document.exitFullscreen?.()?.catch(() => {});
      };
      if (document.fullscreenElement === egen) {
        lamna();
        return;
      }
      const sent = () => {
        document.removeEventListener("fullscreenchange", sent);
        document.removeEventListener("fullscreenerror", sent);
        lamna();
      };
      document.addEventListener("fullscreenchange", sent);
      document.addEventListener("fullscreenerror", sent);
    },
    [],
  );

  /*
   * ⛔ SIDRAMENS RESERVERADE RULLNINGSLIST GÄLLER INTE YTAN I HELSKÄRM (mätt i `check-skalyta` 52c, samma som `OpsHtmlVy`, avsnitt 60). Tokens ger `html`
   * `scrollbar-gutter: stable`, och i Chromium var kartan då 10 px smalare än skärmen i båda lägena, med en svart rand till höger.
   */
  useEffect(() => {
    if (!lage) return undefined;
    const rot = document.documentElement;
    const fore = rot.style.scrollbarGutter;
    rot.style.scrollbarGutter = "auto";
    return () => {
      rot.style.scrollbarGutter = fore;
    };
  }, [lage]);

  useEffect(() => {
    if (lage !== "fonster") return undefined;
    /** @param {KeyboardEvent} e */
    const tangent = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setLage(false);
    };
    document.addEventListener("keydown", tangent);
    const rot = document.documentElement;
    const fore = rot.style.overflow;
    rot.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tangent);
      rot.style.overflow = fore;
    };
  }, [lage]);

  return { lage, oppna, avsluta, behall };
}

/**
 * Om webbläsarens helskärm stängs av ett svep på den här enheten (0.263.0, se `undvikSvep` ovan): iPhone och iPad, där WebKit lägger sina
 * stänggester på helskärmen. En iPad i skrivbordsläge säger "Macintosh" och skiljs från en Mac genom pekpunkterna. En Mac har inga.
 *
 * @param {{ userAgent?: string, maxTouchPoints?: number } | undefined} [nav]
 * @returns {boolean}
 */
export function svepStangerHelskarm(nav = typeof navigator === "undefined" ? undefined : navigator) {
  const ua = String(nav?.userAgent ?? "");
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && Number(nav?.maxTouchPoints ?? 0) > 1;
}
