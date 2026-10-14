/**
 * Avsnitt 47 i check-skalyta: chattepiken 0.106.0 (#386), en del per skiva, vid 390 och 1280 px.
 *
 * ⛔ EN EGEN FIL OCH INTE ETT BLOCK TILL I check-skalyta.mjs. Skriptet är över 6800 rader, och skivorna läggs till en i taget.
 * Funktionerna får vaktens egna verktyg (`oppna`, `krav`, `matt`) som argument, så att mätningen räknas, skrivs ut och blir röd
 * på samma sätt som resten av vakten. Kör ensamt: `node scripts/check-skalyta.mjs --bara-0106`.
 *
 * ⛔ GOLV: varje del kräver att det den mäter fanns (rader, knappar, meddelanden), annars är den röd.
 */

import path from "node:path";

/** @typedef {{ oppna: (scen: string, vp: { width: number, height: number }, tema?: string, skala?: number, aktiv?: string | null, manga?: number) => Promise<{ page: import("playwright").Page, context: import("playwright").BrowserContext }>, krav: (ok: boolean, text: string) => void, matt: string[], bildmapp: string | null }} Verktyg */

export const BREDDER = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];

/** @param {import("playwright").Page} page */
const over = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Kör en del i en egen sida, och gör ett avbrott till ett brott i stället för ett kast.
 * @param {Verktyg} v @param {string} namn @param {string} scen @param {{ width: number, height: number }} vp @param {string | null} aktiv
 * @param {(page: import("playwright").Page) => Promise<void>} fn
 */
async function del(v, namn, scen, vp, aktiv, fn) {
  /** @type {import("playwright").BrowserContext | null} */
  let context = null;
  try {
    const o = await v.oppna(scen, vp, "light", 1, aktiv);
    context = o.context;
    await fn(o.page);
    // ⛔ En kommentar som hamnat som text i JSX (hänt i arbetet med skiva 3: ett `/* ... */` efter en ny omslutande tagg ritades som
    // ett stycke text överst i chatten, och varje jsdom-prov var grönt).
    const kommentar = await o.page.evaluate(() => (document.body.innerText || "").includes("/* ⛔"));
    v.krav(!kommentar, `${namn}: en kodkommentar står som text på sidan.`);
    const o2 = await over(o.page);
    v.krav(o2 <= 0, `${namn}: sidan rullar ${o2} px i sidled.`);
  } catch (e) {
    v.krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context?.close();
}

/** @param {Verktyg} v @param {import("playwright").Page} page @param {string} fil */
async function bild(v, page, fil) {
  if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, fil) });
}

/**
 * (1) MEDDELANDEN ÄR KÄRNA (skiva 1). Gruppen är sparad UTAN Meddelanden. Hubben ritar ändå kortet, och listan över appar att
 * installera har inte Meddelanden. På telefonen visar Appar-arket Meddelanden. Golv: hubben har minst tre kort och listan att
 * installera minst en rad (Kontakter).
 * @param {Verktyg} v
 */
export async function karnan(v) {
  for (const vp of BREDDER) {
    const namn = `47 (1) kärnan ${vp.width} px`;
    await del(v, namn, "karna", vp, null, async (page) => {
      await page.locator("[data-grupphubb]").waitFor({ timeout: 4000 });
      const m = await page.evaluate(() => ({
        kort: [...document.querySelectorAll("[data-grupphubb] a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h !== "/installera" && /^\/[a-z]+$/.test(h)),
        valbara: [...document.querySelectorAll("[data-hubb-valbar]")].map((el) => el.getAttribute("data-hubb-valbar")),
      }));
      v.matt.push(`${namn}: kort ${JSON.stringify(m.kort)}, att installera ${JSON.stringify(m.valbara)}`);
      v.krav(m.kort.length >= 3, `${namn}: ${m.kort.length} kort i hubben, väntat minst 3. Golv.`);
      v.krav(m.kort.includes("/meddelanden"), `${namn}: hubben ritar inte Meddelanden fast den är kärna (${JSON.stringify(m.kort)}).`);
      v.krav(m.valbara.length >= 1 && !m.valbara.includes("meddelanden"), `${namn}: listan att installera är ${JSON.stringify(m.valbara)}, väntat Kontakter och inte Meddelanden.`);
      await bild(v, page, `karna-hubb-${vp.width}.png`);
      if (vp.width < 768) {
        await page.locator("[data-ops-bottenrad]").getByRole("button", { name: "Appar" }).click();
        await page.waitForSelector("[data-appar-ark]");
        const ark = await page.evaluate(() => [...document.querySelectorAll("[data-appar-ark] [data-ark-id]")].map((el) => el.getAttribute("data-ark-id")));
        v.matt.push(`${namn}: arket ${JSON.stringify(ark)}`);
        v.krav(ark.length >= 3 && ark.includes("meddelanden"), `${namn}: arket är ${JSON.stringify(ark)}, väntat minst tre appar med Meddelanden.`);
        await bild(v, page, `karna-ark-${vp.width}.png`);
      }
    });
  }
}

/**
 * Träffytan för ett element: bredd och höjd i den ritade rutan.
 * @param {import("playwright").Page} page @param {string} valjare
 */
async function ruta(page, valjare) {
  return page.evaluate((v) => {
    const el = document.querySelector(v);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom, text: (el.textContent || "").trim() };
  }, valjare);
}

/**
 * (2) SAMTAL PER ÄMNE MED AGENTEN (skiva 2). Inkorgen har gruppen överst, sedan agenten som en rad med "gruppens agent" och antalet
 * samtal, sedan personerna. Agentens rad öppnar agentens samtal: Nytt samtal överst (44 px hög), och ett ämne per rad med rubriken.
 * Ett ämne visar rubriken i huvudet och en rad tillbaka till agenten (44 px). Golv: minst tre ämnen i listan.
 * @param {Verktyg} v
 */
export async function amnen(v) {
  for (const vp of BREDDER) {
    const namn = `47 (2) ämnen ${vp.width} px`;
    await del(v, namn, "amnen", vp, null, async (page) => {
      await page.locator("[data-agentrad='ops']").waitFor({ timeout: 4000 });
      const ordning = await page.evaluate(() => [...document.querySelectorAll("[data-samtalslista] [data-samtalsrad], [data-samtalslista] [data-agentrad]")].map((el) => el.getAttribute("data-samtalsrad") ?? "agent"));
      const rad = await ruta(page, "[data-agentrad='ops']");
      v.matt.push(`${namn}: inkorgen ${JSON.stringify(ordning)}, agentens rad ${JSON.stringify(rad?.text)} ${rad?.h.toFixed(0)} px`);
      v.krav(JSON.stringify(ordning) === JSON.stringify(["grupp", "agent", "personer"]), `${namn}: inkorgen är ${JSON.stringify(ordning)}, väntat gruppen, agenten, personen.`);
      v.krav(Boolean(rad && rad.text.includes("Hugo, gruppens agent") && /3 samtal, senast/.test(rad.text) && rad.h >= 43.5), `${namn}: agentens rad är ${JSON.stringify(rad)}, väntat "Hugo, gruppens agent" och "3 samtal, senast", minst 44 px.`);
      await bild(v, page, `amnen-inkorg-${vp.width}.png`);
      await page.locator("[data-agentrad='ops']").click();
      await page.locator("[data-agentens-samtal]").waitFor({ timeout: 4000 });
      const nytt = await ruta(page, "[data-nytt-amne]");
      const rader = await page.evaluate(() => [...document.querySelectorAll("[data-amnesrad]")].map((el) => { const r = el.getBoundingClientRect(); return { h: r.height, r: r.right, text: (el.textContent || "").trim().slice(0, 40) }; }));
      v.matt.push(`${namn}: Nytt samtal ${nytt?.w.toFixed(0)}x${nytt?.h.toFixed(0)}, ämnen ${JSON.stringify(rader.map((r) => r.text))}`);
      v.krav(Boolean(nytt && nytt.h >= 43.5 && nytt.r <= vp.width + 0.5), `${namn}: Nytt samtal är ${JSON.stringify(nytt)}, väntat minst 44 px hög och inom fönstret.`);
      v.krav(rader.length >= 3, `${namn}: ${rader.length} ämnen i listan, väntat minst 3. Golv.`);
      v.krav(rader.every((r) => r.h >= 43.5 && r.r <= vp.width + 0.5), `${namn}: en ämnesrad är lägre än 44 px eller sticker ut (${JSON.stringify(rader)}).`);
      v.krav(rader.some((r) => r.text.startsWith("Resan till Stockholm")), `${namn}: rubriken agenten satt syns inte i listan (${JSON.stringify(rader)}).`);
      await bild(v, page, `amnen-lista-${vp.width}.png`);
      await page.locator("[data-amnesrad]").first().click();
      await page.locator("[data-amnesrubrik]").waitFor({ timeout: 4000 });
      const huvud = await ruta(page, "[data-amnesrubrik]");
      const tillbaka = await ruta(page, "[data-tillbaka-agent]");
      v.matt.push(`${namn}: ämnets huvud ${JSON.stringify(huvud?.text)}, tillbaka ${tillbaka?.h.toFixed(0)} px`);
      v.krav(Boolean(huvud && huvud.text.length > 0 && huvud.r <= vp.width + 0.5), `${namn}: ämnets rubrik saknas i huvudet (${JSON.stringify(huvud)}).`);
      v.krav(Boolean(tillbaka && tillbaka.h >= 43.5 && tillbaka.text === "Hugo"), `${namn}: raden tillbaka till agenten är ${JSON.stringify(tillbaka)}, väntat "Hugo" och minst 44 px.`);
      await bild(v, page, `amnen-samtal-${vp.width}.png`);
    });
  }
}

/** Svenska förval som inte får stå i en engelsk chatt. Ett urval: det fullständiga provet är jsdom-provet `chatt-sprak.test.jsx`. */
const SVENSKA = ["Skicka", "Skriv till gruppen", "Sök i samtalet", "Chattinfo", "Reagera", "Svara i tråd", "Fäst", "Olästa", "Nytt meddelande", "Meddelanden", "Tysta notiser", "Nytt samtal", "gruppens agent", "Visa arkiverade", "Prata in", "Alla i gruppen ser det här"];

/**
 * (3) CHATTEN PÅ ENGELSKA (skiva 3, #385). Gruppchatten och agentens samtal med `sprak="en"`: inga svenska förval i texter, namn
 * och platstexter, platstexten "Write to the group" syns hel i fältet, och inget rullar i sidled. Golv: minst 8 engelska ord hittas.
 * @param {Verktyg} v
 */
export async function engelska(v) {
  for (const vp of BREDDER) {
    for (const aktiv of ["grupp", "agent"]) {
      const namn = `47 (3) engelska ${aktiv} ${vp.width} px`;
      await del(v, namn, "chatt0106-en", vp, aktiv, async (page) => {
        await page.locator(aktiv === "grupp" ? "[data-ops-samtal] [data-meddelande]" : "[data-agentens-samtal]").first().waitFor({ timeout: 4000 });
        const m = await page.evaluate((svenska) => {
          const texter = [...document.querySelectorAll("[data-ops-meddelanden] *")].flatMap((el) => [
            ...[...el.childNodes].filter((n) => n.nodeType === 3).map((n) => (n.textContent || "").trim()),
            el.getAttribute("aria-label") ?? "",
            el.getAttribute("placeholder") ?? "",
          ]).filter(Boolean);
          const hel = (/** @type {string} */ ord) => new RegExp(`(?<![\\p{L}])${ord}(?![\\p{L}])`, "u");
          const ruta = document.querySelector("[data-skrivfalt] textarea");
          return {
            svenska: svenska.filter((o) => texter.some((t) => hel(o).test(t))),
            engelska: ["Messages", "New message", "All", "Unread", "Search messages", "Send", "Write to the group", "Search the conversation", "Chat info", "React", "Reply in thread", "Pin", "New conversation", "the group's agent", "Show archived"].filter((o) => texter.some((t) => hel(o).test(t))),
            platstext: ruta ? { text: ruta.getAttribute("placeholder"), ryms: ruta.scrollWidth <= ruta.clientWidth + 1 } : null,
          };
        }, SVENSKA);
        v.matt.push(`${namn}: svenska ${JSON.stringify(m.svenska)}, engelska ${m.engelska.length}, platstext ${JSON.stringify(m.platstext)}`);
        v.krav(m.svenska.length === 0, `${namn}: svenska förval i en engelsk chatt: ${JSON.stringify(m.svenska)}.`);
        v.krav(m.engelska.length >= (aktiv === "grupp" ? 8 : 4), `${namn}: ${m.engelska.length} engelska ord hittades (${JSON.stringify(m.engelska)}). Golv.`);
        if (aktiv === "grupp") v.krav(Boolean(m.platstext && m.platstext.text === "Write to the group" && m.platstext.ryms), `${namn}: platstexten är ${JSON.stringify(m.platstext)}.`);
        await bild(v, page, `engelska-${aktiv}-${vp.width}.png`);
      });
    }
  }
}

/**
 * Var en rad står mot loggens synliga del och skrivfältet. `inne` när hela raden är inom loggens fönster och ovanför skrivfältet.
 * @param {import("playwright").Page} page @param {string} valjare
 */
async function iSikte(page, valjare) {
  return page.evaluate((v) => {
    const el = [...document.querySelectorAll(v)].pop();
    const logg = document.querySelector("[data-ops-samtal] [role=log]");
    const falt = document.querySelector("[data-skrivfalt]");
    if (!el || !logg) return null;
    const r = el.getBoundingClientRect();
    const l = logg.getBoundingClientRect();
    const f = falt ? falt.getBoundingClientRect().top : Infinity;
    return { topp: r.top, botten: r.bottom, loggTopp: l.top, loggBotten: l.bottom, falt: f, inne: r.top >= l.top - 0.5 && r.bottom <= l.bottom + 0.5 && r.bottom <= f + 0.5 };
  }, valjare);
}

/**
 * (4) LÄSA BAKÅT OCH AGENTENS STATUS (skiva 4, och CP:s skärmbild 2026-10-14: "Agenten tänker" hamnade under skrivfältet).
 *   (a) Står man vid slutet och agentens status kommer, står raden helt inom loggen, ovanför skrivfältet.
 *   (b) Ett förslagskort som kommer med agentens svar syns också helt.
 *   (c) Har man rullat upp och ett svar kommer, står loggen kvar (högst 2 px), och "Till senaste" visar "1 nya" och att agenten
 *       arbetar, minst 44 px hög och inom fönstret. Ett tryck tar en till slutet.
 * Golv: loggen måste kunna rulla (minst 200 px mer innehåll än fönster), annars mäter (c) ingenting.
 * @param {Verktyg} v
 */
export async function lasaBakat(v) {
  for (const vp of BREDDER) {
    const namn = `47 (4) läsa bakåt ${vp.width} px`;
    await del(v, namn, "chatt0106-las", vp, null, async (page) => {
      await page.locator("[data-ops-samtal] [data-meddelande]").first().waitFor({ timeout: 4000 });
      await page.waitForTimeout(150);
      const rullbar = await page.evaluate(() => { const l = /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")); return l.scrollHeight - l.clientHeight; });
      v.krav(rullbar >= 200, `${namn}: loggen rullar ${rullbar} px, väntat minst 200. Golv.`);
      // (a)
      await page.evaluate(() => { const x = /** @type {any} */ (window).__las; return x.kalla.create(`samtal/${x.sid}/status`, { id: "agent", lage: "tanker", sedan: Date.now() }); });
      await page.locator("[data-agentstatus='tanker']").waitFor({ timeout: 4000 });
      await page.waitForTimeout(150);
      const a = await iSikte(page, "[data-agentstatus]");
      v.matt.push(`${namn}: (a) "Agenten tänker" ${JSON.stringify(a)}`);
      v.krav(Boolean(a?.inne), `${namn}: (a) raden "Agenten tänker" står inte helt inom loggen ovanför skrivfältet (${JSON.stringify(a)}).`);
      await bild(v, page, `lasa-status-${vp.width}.png`);
      // (b)
      await page.evaluate(() => {
        const x = /** @type {any} */ (window).__las;
        return Promise.all([
          x.kalla.remove(`samtal/${x.sid}/status`, "agent"),
          x.kalla.create(`samtal/${x.sid}/meddelanden`, { text: "Jag kan boka mötet med banken på fredag klockan tio.", av: "ops", tid: x.tid(), forslag: [{ id: "f1", etikett: "Boka mötet", ikon: "kalender", text: "Fredag 10.00, banken" }, { id: "f2", etikett: "Välj en annan tid" }] }),
        ]);
      });
      await page.locator("[data-ops-forslag]").waitFor({ timeout: 4000 });
      await page.waitForTimeout(150);
      const b = await iSikte(page, "[data-ops-forslag]");
      v.matt.push(`${namn}: (b) förslagen ${JSON.stringify(b)}`);
      v.krav(Boolean(b?.inne), `${namn}: (b) förslagskortet står inte helt inom loggen ovanför skrivfältet (${JSON.stringify(b)}).`);
      // (c)
      await page.evaluate(() => { const l = /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")); l.scrollTop = 0; });
      await page.waitForTimeout(150);
      const fore = await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")).scrollTop);
      await page.evaluate(() => {
        const x = /** @type {any} */ (window).__las;
        return Promise.all([
          x.kalla.create(`samtal/${x.sid}/meddelanden`, { text: "En sak till om banken.", av: "ops", tid: x.tid() }),
          x.kalla.create(`samtal/${x.sid}/status`, { id: "agent", lage: "skriver", sedan: Date.now() }),
        ]);
      });
      await page.locator("[data-agentstatus='skriver']").waitFor({ timeout: 4000, state: "attached" });
      await page.waitForTimeout(200);
      const efter = await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")).scrollTop);
      const knapp = await ruta(page, "[data-till-senaste]");
      const etikett = await page.locator("[data-till-senaste]").getAttribute("aria-label").catch(() => null);
      v.matt.push(`${namn}: (c) rullning ${fore} till ${efter}, knappen ${JSON.stringify(knapp)} "${etikett}"`);
      v.krav(Math.abs(efter - fore) <= 2, `${namn}: (c) loggen rycktes från ${fore} till ${efter} när ett svar kom.`);
      v.krav(Boolean(knapp && knapp.h >= 43.5 && knapp.r <= vp.width + 0.5 && knapp.b <= vp.height + 0.5), `${namn}: (c) Till senaste saknas, är lägre än 44 px eller står utanför fönstret (${JSON.stringify(knapp)}).`);
      v.krav(etikett === "Till senaste, 1 nya, Agenten skriver", `${namn}: (c) Till senaste heter ${JSON.stringify(etikett)}, väntat "Till senaste, 1 nya, Agenten skriver".`);
      await bild(v, page, `lasa-till-senaste-${vp.width}.png`);
      if (knapp) {
        await page.locator("[data-till-senaste]").click();
        await page.waitForTimeout(150);
        const sist = await iSikte(page, "[data-agentstatus]");
        v.krav(Boolean(sist?.inne), `${namn}: (c) efter Till senaste står agentens rad inte i sikte (${JSON.stringify(sist)}).`);
      }
    });
  }
}

/**
 * Alla delar i ordning. Varje skiva lägger till sin rad här.
 * @param {Verktyg} v
 */
export async function chattepiken0106(v) {
  await karnan(v);
  await amnen(v);
  await engelska(v);
  await lasaBakat(v);
}
