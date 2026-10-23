/**
 * Granskaren bakom vakten `check-vantar` (0.141.0): varje knapp som startar ett anrop visar att den väntar.
 * 0.142.0 (#440): utvidgad till OpsSwitch, OpsCheckbox och OpsSelect. Regeln `valet-svaljs` gäller ett val vars onChange startar ett anrop
 * utan att ge löftet vidare, och `val-utan-vantan` gäller komponenten själv. Golvet `val` får bara sjunka i den meningen att det inte sänks.
 *
 * ══ ⛔ VARFÖR (CP 2026-10-23) ══════════════════════════════════════════════════════════════════════════
 *
 * CP, om en knapp som blev blek utan att något syntes medan servern svarade: "Medans man kopplar måste man få en progress. Detta
 * glömmer vi ofta. Se till att alla ställen där användaren väntar på svar får en progress." `OpsButton` fick ett gemensamt väntläge
 * i 0.129.0 (ger `onClick` ett löfte är knappen upptagen: snurra, `aria-busy`, spärr), men ingenting såg till att varje knapp som
 * startar ett anrop FAKTISKT når det. Tre sätt att missa det fanns kvar, alla tre sedda i koden:
 *
 *   1. En `OpsButton` vars `onClick` startar ett anrop men inte ger löftet vidare (`onClick={() => { void spara(x); }}`). Knappen ser
 *      inget löfte och väntar aldrig. (Tecknet är ofta en lokal rättelse: "löftet svaldes i en blockkropp".)
 *   2. En rå `<button>` vars `onClick` startar ett anrop. Den har varken snurra eller `aria-busy`, och blir bara grå om appen sätter
 *      `disabled`. Det är CP:s bild: en blek knapp och ingenting mer.
 *   3. En `type="submit"`-knapp i ett `<form>` vars `onSubmit` startar ett anrop. Knappen har ingen egen `onClick` att läsa ett löfte
 *      ur, så den väntar bara om den får `busy`.
 *
 * ══ HUR DEN LÄSER (en mätning av syntaxträdet, inte ett grep) ═══════════════════════════════════════════
 *
 * Filen parsas (`@babel/parser`, JSX). En handlare "startar ett anrop" när dess kropp (eller en lokal funktion den anropar, upp till fyra
 * steg) innehåller `await`, `.then(`, eller ett anrop av en `on...`-prop som filens egen JSDoc deklarerar med `Promise` i typen. Det sista
 * är hur kontraktet mot appen ser ut: ramverket vet inte vad appens `onSpara` gör, men typen säger att den får ge ett löfte.
 * "Ger löftet vidare" är en async funktion, en pilfunktion med uttryckskropp, eller en kropp med ett `return`.
 *
 * ══ ⛔ UNDANTAG: `vantar-ej: <skäl>` ═══════════════════════════════════════════════════════════════════
 *
 * Det finns knappar där väntan inte är rätt svar: utkastet ritas i samma varv som trycket och ställs tillbaka om anropet faller
 * (optimistiskt, 0.128.0), eller en statusrad bredvid säger redan vad som pågår. De får en kommentar `vantar-ej: <skäl>` på någon av de
 * fyra raderna före elementet. Skälet krävs (minst 20 tecken). ⛔ TAK SOM BARA FÅR SJUNKA, INTE NOLL (arbetsreglernas punkt 4): antalet
 * undantag får inte överstiga `UNDANTAGSTAK`, och ett undantag som inte täcker något brott är ett fel (en död rad ser ut som en
 * försäkring).
 *
 * ⛔ GOLV (tomt underlag): vakten är röd om den läste färre än `GOLV` filer, knappar, handlare som startar anrop eller deklarerade
 * löftesprops. En vakt som blir grön av att inget hittades mäter ingenting.
 */

import { parse } from "@babel/parser";

/** Antal `vantar-ej`-rader som får finnas. Sänks när en rad lagas, höjs aldrig utan skäl i CHANGELOG. */
export const UNDANTAGSTAK = 8;

export const GOLV = {
  filer: 60,
  knappar: 250,
  anropande: 60,
  loftesprops: 30,
  val: 29,
};

/** (0.142.0, #440) Valen som väntar själva när `onChange` ger ett löfte. Varje komponent måste anropa `useLofteVantan(onChange)`. */
export const VAL_KOMPONENTER = ["OpsSwitch", "OpsCheckbox", "OpsSelect"];

/** Minsta längd på skälet efter `vantar-ej:`. */
const MIN_SKAL = 20;

/** Propen som är knappens egen. Den deklareras med `Promise` men är ingen app-handling. */
const EGNA_PROPS = new Set(["onClick"]);

/**
 * @typedef {{ fil: string, rad: number, regel: "loftet-svaljs" | "valet-svaljs" | "val-utan-vantan" | "ra-knapp" | "submit-utan-vantan" | "dod-undantag" | "undantag-utan-skal", text: string }} Brott
 */

/** @param {any} n @param {(n: any) => boolean | void} besok Ger `false` för att inte gå ned i barnen. */
function ga(n, besok) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) {
    for (const x of n) ga(x, besok);
    return;
  }
  if (typeof n.type !== "string") return;
  if (besok(n) === false) return;
  for (const k of Object.keys(n)) {
    if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments" || k === "innerComments") continue;
    ga(n[k], besok);
  }
}

/** @param {string} kalla @returns {Set<string>} Namnen på props som filens JSDoc säger kan ge ett löfte. */
export function loftesProps(kalla) {
  const ut = new Set();
  for (const m of kalla.matchAll(/@(?:param|property)\s+\{([^\n]*?Promise[^\n]*)\}\s+\[?(?:props\.)?(on[A-Z][A-Za-z]*)\]?/g)) {
    if (!EGNA_PROPS.has(m[2])) ut.add(m[2]);
  }
  // Objekttypen: `@param {{ onSpara: (x) => Promise<void>, ... }} props`. Namnet, kolon, parametrar, pil och sedan Promise innan nästa fält.
  for (const m of kalla.matchAll(/\b(on[A-Z][A-Za-z]*)\??\s*:\s*(?:\([^)\n]*\)|[A-Za-z]+)\s*=>\s*[^,}\n]*Promise/g)) {
    if (!EGNA_PROPS.has(m[1])) ut.add(m[1]);
  }
  return ut;
}

/**
 * @param {string} fil
 * @param {string} kalla
 */
export function granskaFil(fil, kalla) {
  const ast = parse(kalla, { sourceType: "module", plugins: ["jsx"] });
  const props = loftesProps(kalla);

  /** @type {Map<string, any[]>} */
  const funktioner = new Map();
  const lagg = (/** @type {string} */ namn, /** @type {any} */ fn) => {
    if (!funktioner.has(namn)) funktioner.set(namn, []);
    /** @type {any[]} */ (funktioner.get(namn)).push(fn);
  };
  ga(ast.program, (n) => {
    if (n.type === "FunctionDeclaration" && n.id) lagg(n.id.name, n);
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init) {
      let init = n.init;
      if (init.type === "CallExpression" && init.callee.type === "Identifier" && init.callee.name === "useCallback") init = init.arguments[0];
      if (init && /Function/.test(init.type)) lagg(n.id.name, init);
    }
  });

  /** @param {any} fn @param {number} djup @param {Set<any>} sedda */
  const anropar = (fn, djup = 0, sedda = new Set()) => {
    if (!fn || sedda.has(fn) || djup > 4) return false;
    sedda.add(fn);
    if (fn.async) return true;
    let traff = false;
    ga(fn.body, (n) => {
      if (traff) return false;
      if (n.type === "AwaitExpression") traff = true;
      if (n.type === "CallExpression" || n.type === "OptionalCallExpression") {
        const c = n.callee;
        const namn = c.type === "Identifier" ? c.name : c.property && !c.computed ? c.property.name : null;
        if (c.type !== "Identifier" && namn === "then") traff = true;
        else if (namn && props.has(namn)) traff = true;
        else if (c.type === "Identifier" && funktioner.has(c.name)) {
          for (const g of /** @type {any[]} */ (funktioner.get(c.name))) if (anropar(g, djup + 1, sedda)) traff = true;
        }
      }
      return !traff;
    });
    return traff;
  };

  /** Ger funktionen löftet vidare till den som anropade den? */
  const gerVidare = (/** @type {any} */ fn) => {
    if (fn.async) return true;
    // `() => void spara()` kastar bort löftet lika säkert som en blockkropp utan return: uttrycket är `undefined`.
    if (fn.body.type !== "BlockStatement") return !(fn.body.type === "UnaryExpression" && fn.body.operator === "void");
    let ret = false;
    ga(fn.body.body, (n) => {
      if (n !== fn && /Function/.test(n.type)) return false;
      if (n.type === "ReturnStatement" && n.argument) ret = true;
      return !ret;
    });
    return ret;
  };

  /** @param {any} uttryck @returns {any[]} Funktionerna ett attributvärde kan vara. */
  const handlare = (uttryck) => {
    if (!uttryck) return [];
    if (/Function/.test(uttryck.type)) return [uttryck];
    if (uttryck.type === "Identifier") return funktioner.get(uttryck.name) ?? [];
    if (uttryck.type === "CallExpression" && uttryck.callee.type === "Identifier" && uttryck.callee.name === "useCallback") return handlare(uttryck.arguments[0]);
    return [];
  };

  /** @type {{ rad: number, text: string }[]} */
  const undantag = [];
  for (const c of ast.comments ?? []) {
    const m = /vantar-ej:\s*([\s\S]*)/.exec(c.value);
    if (m) undantag.push({ rad: c.loc?.end.line ?? 0, text: m[1].replace(/\*+\s*$/, "").trim() });
  }
  const anvanda = new Set();
  /** Ett undantag täcker ett element som börjar högst fyra rader efter kommentarens sista rad. */
  const undantagFor = (/** @type {number} */ rad) => {
    const u = undantag.find((x) => x.rad <= rad && rad - x.rad <= 4);
    if (u) anvanda.add(u);
    return u;
  };

  /** @type {Brott[]} */
  const brott = [];
  const stat = { knappar: 0, anropande: 0, undantag: 0, formul: 0, val: 0 };
  /** @param {any} el */
  const attr = (el) => {
    /** @type {Record<string, any>} */
    const a = {};
    for (const x of el.openingElement.attributes) if (x.type === "JSXAttribute") a[x.name.name] = x.value;
    return a;
  };
  /** @param {Brott["regel"]} regel @param {number} rad @param {string} text */
  const fall = (regel, rad, text) => {
    const u = undantagFor(rad);
    if (u) {
      if (u.text.length < MIN_SKAL) brott.push({ fil, rad, regel: "undantag-utan-skal", text: `vantar-ej utan skäl (minst ${MIN_SKAL} tecken): "${u.text}"` });
      else stat.undantag += 1;
      return;
    }
    brott.push({ fil, rad, regel, text });
  };

  ga(ast.program, (n) => {
    if (n.type !== "JSXElement") return;
    const tagg = n.openingElement.name.type === "JSXIdentifier" ? n.openingElement.name.name : "";
    const a = attr(n);
    const rad = n.openingElement.loc.start.line;
    if (tagg === "OpsButton" || tagg === "button") stat.knappar += 1;
    const onClick = a.onClick && a.onClick.type === "JSXExpressionContainer" ? a.onClick.expression : null;
    if ((tagg === "OpsButton" || tagg === "button") && onClick) {
      const fns = handlare(onClick);
      const startar = fns.some((f) => anropar(f));
      if (startar) {
        stat.anropande += 1;
        if (tagg === "OpsButton") {
          if (a.busy === undefined && !fns.some((f) => anropar(f) && gerVidare(f))) {
            fall("loftet-svaljs", rad, "OpsButton: onClick startar ett anrop men ger inte löftet vidare, och `busy` saknas. Knappen ser aldrig att den väntar. Ge löftet vidare (`onClick={() => anrop()}`) eller sätt `busy`.");
          }
        } else if (a["aria-busy"] === undefined) {
          fall("ra-knapp", rad, "rå <button>: onClick startar ett anrop men knappen har varken snurra eller `aria-busy`. Använd OpsButton (väntar själv när onClick ger ett löfte) eller sätt `aria-busy` och rita en snurra.");
        }
      }
    }
    if (VAL_KOMPONENTER.includes(tagg)) {
      stat.val += 1;
      const onChange = a.onChange && a.onChange.type === "JSXExpressionContainer" ? a.onChange.expression : null;
      const fns = onChange ? handlare(onChange) : [];
      if (fns.some((f) => anropar(f))) {
        stat.anropande += 1;
        if (!fns.some((f) => anropar(f) && gerVidare(f))) {
          fall("valet-svaljs", rad, `${tagg}: onChange startar ett anrop men ger inte löftet vidare. Valet ser aldrig att det väntar (0.142.0). Ge löftet vidare (\`onChange={(v) => spara(v)}\`).`);
        }
      }
    }
    if (tagg === "form" && a.onSubmit && a.onSubmit.type === "JSXExpressionContainer") {
      stat.formul += 1;
      const fns = handlare(a.onSubmit.expression);
      // Ett formulär vars onSubmit bara stoppar standardhändelsen och låter knappens onClick göra jobbet startar inget här.
      if (fns.some((f) => anropar(f))) {
        stat.anropande += 1;
        ga(n.children, (m) => {
          if (m.type !== "JSXElement") return;
          const t = m.openingElement.name.type === "JSXIdentifier" ? m.openingElement.name.name : "";
          if (t !== "OpsButton" && t !== "button") return;
          const b = attr(m);
          const typ = b.type && b.type.type === "StringLiteral" ? b.type.value : b.type?.value;
          if (typ !== "submit") return;
          const saknar = t === "OpsButton" ? b.busy === undefined : b["aria-busy"] === undefined;
          if (saknar) fall("submit-utan-vantan", m.openingElement.loc.start.line, `${t === "OpsButton" ? "OpsButton" : "<button>"} type="submit" i ett formulär vars onSubmit startar ett anrop saknar ${t === "OpsButton" ? "`busy`" : "`aria-busy`"}. Knappen har ingen onClick att läsa ett löfte ur.`);
        });
      }
    }
    return undefined;
  });

  // (0.142.0) Komponenten själv: varje val i VAL_KOMPONENTER som definieras här måste lägga sin onChange genom useLofteVantan.
  ga(ast.program, (n) => {
    if (n.type !== "FunctionDeclaration" || !n.id || !VAL_KOMPONENTER.includes(n.id.name)) return;
    let har = false;
    ga(n.body, (m) => {
      if ((m.type === "CallExpression") && m.callee.type === "Identifier" && m.callee.name === "useLofteVantan") har = true;
    });
    if (!har) brott.push({ fil, rad: n.loc?.start.line ?? 0, regel: "val-utan-vantan", text: `${n.id.name} lägger inte onChange genom useLofteVantan. Ett löfte ur onChange ger då ingen snurra, ingen aria-busy och ingen spärr (#440).` });
    return false;
  });

  for (const u of undantag) {
    if (!anvanda.has(u)) brott.push({ fil, rad: u.rad, regel: "dod-undantag", text: `vantar-ej täcker inget brott: "${u.text}". Ta bort raden (en död rad ser ut som en försäkring).` });
  }
  return { brott, stat, loftesprops: props.size };
}

/**
 * @param {Record<string, string>} filer Filnamn till källtext.
 * @returns {{ brott: Brott[], golv: string[], stat: { filer: number, knappar: number, anropande: number, undantag: number, loftesprops: number } }}
 */
export function granska(filer) {
  /** @type {Brott[]} */
  const brott = [];
  const stat = { filer: 0, knappar: 0, anropande: 0, undantag: 0, loftesprops: 0, val: 0 };
  for (const [fil, kalla] of Object.entries(filer)) {
    const r = granskaFil(fil, kalla);
    stat.filer += 1;
    stat.knappar += r.stat.knappar;
    stat.anropande += r.stat.anropande;
    stat.undantag += r.stat.undantag;
    stat.val += r.stat.val;
    stat.loftesprops += r.loftesprops;
    brott.push(...r.brott);
  }
  const golv = [];
  for (const [namn, min] of Object.entries(GOLV)) {
    if (/** @type {Record<string, number>} */ (stat)[namn] < min) golv.push(`golvet för ${namn}: läste ${/** @type {Record<string, number>} */ (stat)[namn]}, kräver minst ${min}. En vakt som läser för lite mäter ingenting.`);
  }
  if (stat.undantag > UNDANTAGSTAK) golv.push(`${stat.undantag} undantag (vantar-ej) men taket är ${UNDANTAGSTAK}. Taket får bara sjunka: laga en rad i stället för att höja det.`);
  return { brott, golv, stat };
}
