/**
 * Mäter en byggd app i en riktig webbläsare vid telefonbredd och surfplattebredd.
 *
 * ⛔ Det här är den enda kontrollen i huset som kan svara på om CSS:en fungerar.
 *
 * Alla andra tester kör i jsdom, och jsdom lägger ingen CSS alls. Det betyder
 * att `hidden md:flex` är osynligt där: båda navigeringarna finns i DOM:en och
 * testet kan inte se vilken av dem en användare faktiskt möter. Exakt det hålet
 * gjorde att två navigeringar kunde bära samma namn i veckor utan att något
 * blev rött.
 *
 * Samma sak gäller varje löfte om layout. "Ingen horisontell scroll vid 390 px"
 * går inte att testa utan en layoutmotor. Det går att LOVA utan en, och ett
 * löfte utan mätning är precis den sortens regel som ser ut som ett skydd och
 * inte är ett.
 *
 * ── ⛔ VARFÖR DEN MÄTER OCH INTE JÄMFÖR BILDER ──────────────────────────────
 *
 * Den naturliga första tanken är skärmbilder och pixeljämförelse. Den blir
 * röd av varje typsnittsuppdatering och av varje avsiktlig designändring, alltså
 * varje vecka, och en vakt som är röd varje vecka stängs av inom en månad.
 *
 * Den här mäter i stället tre påståenden som antingen är sanna eller falska och
 * som ingen designändring rimligen ska bryta:
 *
 *   1. Sidan är inte bredare än fönstret. Horisontell scroll i en app är alltid
 *      ett fel, utom inuti något som medvetet scrollar (en tabell i ett kort).
 *   2. Bottenraden syns under `md` och är borta på `md` och uppåt. Två synliga
 *      navigeringar samtidigt är två sanningar.
 *   3. `main` har botteninset minst lika stor som bottenraden. Utan den ligger
 *      sista raden i innehållet bakom baren, och det upptäcks först när någon
 *      undrar var deras sista post tog vägen.
 *
 * Och i ett andra pass, som `matTeman` nedan förklarar i detalj:
 *
 *   4. Sidans bakgrund är en annan färg i mörkt läge än i ljust, alltså att
 *      temaväxlingen når en renderad sida och inte bara står i tokenfilen.
 *   5. Varje reglage är minst 44px högt i den renderade rutan.
 *   6. Accentfärgen finns i varje reglages bild i båda lägen, alltså att tumman
 *      är vår och inte webbläsarens egen.
 *
 * ── ⛔ FAIL-CLOSED NÄR WEBBLÄSAREN SAKNAS ───────────────────────────────────
 *
 * Kan den inte starta Chromium säger den det och blir RÖD. Frestelsen är att
 * hoppa över tyst så att grinden går igenom på en maskin utan webbläsare, men
 * då är den grön av att inte ha tittat, och det är samma sak som att ljuga.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

/**
 * Bredder vi lovar. `md` i Tailwind är 768, så 767 är sista telefonbredden.
 *
 * ⛔ 1024 kom till efteråt, och skälet är värt att minnas: med bara 390 och 768
 * mättes ingenting på skrivbordsbredd, och toppraden bytte antal poster vid
 * `lg` (1024) utan att någon mätning såg det. En brytpunkt som inte mäts på
 * båda sidor är en brytpunkt man tror på.
 *
 * Tre bredder räcker eftersom det är vad layouten har lägen för. Fler vore en
 * gissning om att något händer däremellan.
 */
const VYPORTER = [
  { namn: "telefon 390", bredd: 390, hojd: 844, bottenrad: true },
  { namn: "surfplatta 768", bredd: 768, hojd: 1024, bottenrad: false },
  { namn: "skrivbord 1280", bredd: 1280, hojd: 900, bottenrad: false },
];

/**
 * Var webbläsaren kan finnas. Playwrights egen upplösning först, eftersom den
 * är rätt på en vanlig utvecklingsmaskin. Den här containern har en annan
 * version liggande på en fast plats, därav raden efter.
 */
const KANDIDATER = [process.env.OPS_CHROMIUM, "/opt/pw-browsers/chromium"].filter(Boolean);

const MIMES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/**
 * @param {string} distmapp
 * @returns {Promise<{ server: http.Server, url: string }>}
 */
function serveraDist(distmapp) {
  const server = http.createServer((req, res) => {
    const begard = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let fil = path.join(distmapp, begard);
    // ⛔ SPA-fallback. Appen använder riktiga sökvägar (`/primitiver`), och utan
    // fallback svarar servern 404 på precis de rutter vi vill mäta.
    if (!fs.existsSync(fil) || fs.statSync(fil).isDirectory()) fil = path.join(distmapp, "index.html");
    fs.readFile(fil, (fel, data) => {
      if (fel) {
        res.writeHead(404);
        res.end("saknas");
        return;
      }
      res.writeHead(200, { "content-type": MIMES[path.extname(fil)] ?? "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((los) => {
    server.listen(0, "127.0.0.1", () => {
      const adress = /** @type {import("node:net").AddressInfo} */ (server.address());
      los({ server, url: `http://127.0.0.1:${adress.port}` });
    });
  });
}

/** @returns {Promise<{ browser: any, varifran: string }>} */
async function startaWebblasare() {
  /** @type {any} */
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    // ⛔ Playwright är en valfri peer, inte ett beroende paketet drar in. Ett
    // ramverk som tvingar varje konsument att ladda ner en webbläsare vid
    // `npm install` är inte ett ramverk, det är en börda. Men saknas den får
    // mätningen ALDRIG hoppas över: då är den grön av att inte ha tittat.
    throw new Error(
      "playwright saknas. Layouten kan inte mätas utan en webbläsare, och ett överhoppat mått får aldrig räknas som grönt.\n" +
        "    I en app: npm install --save-dev playwright\n" +
        "    Har du redan en Chromium: sätt OPS_CHROMIUM till den körbara filen.",
    );
  }

  /** @type {string[]} */
  const misslyckanden = [];
  try {
    return { browser: await chromium.launch(), varifran: "playwrights egen installation" };
  } catch (e) {
    misslyckanden.push(`standard: ${/** @type {Error} */ (e).message.split("\n")[0]}`);
  }
  for (const sokvag of KANDIDATER) {
    try {
      return { browser: await chromium.launch({ executablePath: sokvag }), varifran: sokvag };
    } catch (e) {
      misslyckanden.push(`${sokvag}: ${/** @type {Error} */ (e).message.split("\n")[0]}`);
    }
  }
  throw new Error(
    `Chromium gick inte att starta. Sätt OPS_CHROMIUM till en körbar Chromium, eller kör \`npx playwright install chromium\`.\n    ${misslyckanden.join("\n    ")}`,
  );
}

/**
 * Minsta träffyta i px. Kommer ur CP:s krav på mobil (bolag-ops#141): en kontroll
 * man drar med tummen och inte med en pekare.
 *
 * ⛔ 44 är inte en smaksak utan samma golv som ramverkets `touchTarget`-regel, och
 * det mäts på den RENDERADE rutan. En klass som lovar `h-11` bevisar ingenting:
 * jsdom lägger ingen CSS, så `h-11` och ingenting alls ser identiska ut där.
 */
const TRAFFYTA_MIN = 44;

/**
 * Hur många bildpunkter av accentfärgen som räcker för att tumman är vår.
 *
 * ⛔ Siffran är mätt, inte vald. En 20px rund tumme ger 268 träffar inom
 * toleransen (kantutjämningen räknas inte), och samma mätning med tumregeln
 * borttagen ger 0, alltså webbläsarens egen tumme i systemets accentfärg. Golvet
 * ligger lågt för att tåla en mindre tumme, och skiljer ändå de två utfallen.
 */
const ACCENTPIXLAR_MIN = 20;

/**
 * Läser den renderade bilden av ett element och räknar bildpunkter i accentfärgen.
 *
 * ── ⛔ VARFÖR EN BILD OCH INTE `getComputedStyle` ────────────────────────────
 *
 * Reglagets tumme finns bara som ett leverantörsspecifikt pseudoelement, och det
 * går INTE att läsa. Mätt: `getComputedStyle(el, "::-webkit-slider-thumb")`
 * svarar `rgba(0, 0, 0, 0)` för bakgrunden och `129px` för bredden, alltså
 * elementets egen ruta och inte tummens. Den vägen ser ut att fungera och
 * svarar med skräp, vilket är värre än att inte finnas.
 *
 * ── ⛔ VARFÖR DET INTE ÄR EN BILDJÄMFÖRELSE ─────────────────────────────────
 *
 * Filens huvudkommentar avvisar pixeljämförelse, och det gäller fortfarande: en
 * vakt som blir röd av varje typsnittsuppdatering stängs av inom en månad. Det
 * här är inte en jämförelse mot en referensbild utan EN räkning av EN färg. Den
 * bryr sig inte om form, position, kantutjämning eller typsnitt.
 *
 * Bilden avkodas av webbläsaren själv via en canvas, inte av en egen PNG-läsare.
 * En handskriven avkodare hade varit femtio rader med fem filtertyper att ha fel
 * i, alltså en vakt vars egen korrekthet blir nästa sak att bevisa.
 *
 * @param {any} sida Playwright-sidan.
 * @param {number} index Vilket reglage på sidan.
 * @returns {Promise<{ accent: string, traffar: number, fel?: string }>}
 */
async function raknaAccentpixlar(sida, index) {
  const bild = (await sida.locator("input[type=range]").nth(index).screenshot()).toString("base64");
  return await sida.evaluate(
    async ({ b64 }) => {
      // Normaliserar tokenets värde till rgb via webbläsaren, så en hex, en
      // `color-mix` eller ett `oklch` behandlas likadant.
      const prob = document.createElement("div");
      prob.style.color = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
      document.body.appendChild(prob);
      const accent = getComputedStyle(prob).color;
      prob.remove();

      const delar = accent.match(/\d+(\.\d+)?/g);
      if (!delar || delar.length < 3) {
        // ⛔ Ett oläsbart tokenvärde rapporteras, det tolkas inte som noll
        // träffar. Noll hade skyllt på tumman för ett fel i mätningen.
        return { accent, traffar: -1, fel: `--color-accent gick inte att läsa som rgb (${accent}).` };
      }
      const [r, g, b] = delar.slice(0, 3).map(Number);

      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let traffar = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - r) <= 2 && Math.abs(d[i + 1] - g) <= 2 && Math.abs(d[i + 2] - b) <= 2 && d[i + 3] > 200) traffar += 1;
      }
      return { accent, traffar };
    },
    { b64: bild },
  );
}

/**
 * Mäter det som bara en riktig webbläsare kan svara på om TEMAT och om TUMMEN.
 *
 * ── ⛔ VARFÖR DET HÄR PASSET FINNS ──────────────────────────────────────────
 *
 * `check-diagramfarger` var länge den enda regeln i huset som brydde sig om
 * mörkt läge, och den mäter färgvärden ur tokenfilen. Ingenting mätte att
 * temaväxlingen faktiskt NÅR en renderad sida. Ett `@media (prefers-color-scheme:
 * dark)`-block med ett stavfel i selektorn är helt tyst: filen ser komplett ut,
 * sviten är grön, och appen är ljus i mörkt läge hos användaren.
 *
 * ⛔ Och det är inte teoretiskt. Reglaget (bolag-ops#141) är målat ur tokens just
 * för att webbläsarens egen tumme annars ritas i systemets accentfärg, alltså en
 * färg utanför kontraktet som inte byter med läget. `check-reglage` bevisar att
 * CSS-blocket säger `var(--color-accent)`. Det här beviset är det andra ledet:
 * att tokenet verkligen är ett annat värde i mörkt läge OCH att det är den färgen
 * som hamnar på skärmen.
 *
 * Tre påståenden, alla sanna eller falska:
 *
 *   1. Sidans bakgrund är en ANNAN färg i mörkt läge än i ljust.
 *   2. Varje reglage är minst 44px högt i den renderade rutan.
 *   3. Accentfärgen finns i varje reglages bild, i BÅDA lägen.
 *
 * @param {object} arg
 * @param {any} arg.browser
 * @param {string} arg.url
 * @param {string[]} arg.rutter
 * @returns {Promise<{ brott: string[], matningar: number, reglage: number }>}
 */
async function matTeman({ browser, url, rutter }) {
  /** @type {string[]} */
  const brott = [];
  let matningar = 0;
  let reglage = 0;

  // ⛔ Telefonbredd och bara den. Temat och träffytan beror inte på bredden, och
  // en tredubbling av webbläsartiden för samma svar är bara väntan.
  for (const rutt of rutter) {
    /** @type {Record<string, { bakgrund: string, reglage: { hojd: number, accent: string, traffar: number, fel?: string }[] }>} */
    const perTema = {};

    for (const tema of /** @type {const} */ (["light", "dark"])) {
      const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: tema });
      const sida = await kontext.newPage();
      await sida.goto(`${url}${rutt}`, { waitUntil: "networkidle" });
      matningar += 1;

      const grund = await sida.evaluate(() => ({
        bakgrund: getComputedStyle(document.body).backgroundColor,
        antal: document.querySelectorAll("input[type=range]").length,
        hojder: Array.from(document.querySelectorAll("input[type=range]")).map((el) => el.getBoundingClientRect().height),
      }));

      const matta = [];
      for (let i = 0; i < grund.antal; i += 1) {
        const px = await raknaAccentpixlar(sida, i);
        matta.push({ hojd: grund.hojder[i], accent: px.accent, traffar: px.traffar, fel: px.fel });
      }
      perTema[tema] = { bakgrund: grund.bakgrund, reglage: matta };

      await kontext.close();
    }

    // 1. Temat når sidan.
    if (perTema.light.bakgrund === perTema.dark.bakgrund) {
      brott.push(
        `${rutt}: sidans bakgrund är ${perTema.light.bakgrund} i BÅDA lägen. Mörkt läge når inte den renderade sidan, ` +
          "alltså är appen ljus för den som har mörkt läge påslaget, utan att något blir rött någon annanstans.",
      );
    }

    for (const tema of ["light", "dark"]) {
      perTema[tema].reglage.forEach((r, i) => {
        // 2. Träffytan.
        if (r.hojd < TRAFFYTA_MIN) {
          brott.push(
            `${rutt} (${tema}): reglage ${i + 1} är ${Math.round(r.hojd)} px högt, golvet är ${TRAFFYTA_MIN}. ` +
              "En tunn skena går inte att ta tag i med tummen, och det rapporteras som att kontrollen inte fungerar, inte som att den är liten.",
          );
        }
        // 3. Tumman är vår.
        if (r.fel) {
          brott.push(`${rutt} (${tema}): reglage ${i + 1} gick inte att mäta. ${r.fel}`);
        } else if (r.traffar < ACCENTPIXLAR_MIN) {
          brott.push(
            `${rutt} (${tema}): reglage ${i + 1} har ${r.traffar} bildpunkter i accentfärgen (${r.accent}), golvet är ${ACCENTPIXLAR_MIN}. ` +
              "Tumman målas alltså inte ur tokens utan av webbläsaren själv, i systemets accentfärg: en färg utanför kontraktet som inte byter med läget.",
          );
        }
      });
    }

    reglage += perTema.light.reglage.length;
  }

  return { brott, matningar, reglage };
}

/**
 * @param {object} arg
 * @param {string} arg.dist Mappen med den byggda appen.
 * @param {string[]} arg.rutter Sökvägar att mäta, t.ex. ["/", "/primitiver"].
 * @returns {Promise<{ brott: string[], matningar: number, temamatningar: number, reglage: number, varifran: string }>}
 */
/**
 * Är appskalets krom (headern och bottenraden) fortfarande överst efter att
 * sidan scrollats?
 *
 * ⛔ MÄTS MED `elementFromPoint`, INTE MED z-index. Att läsa z-index av två
 * element svarar inte på frågan: värdena kan vara lika, de kan ligga i olika
 * stackningskontexter, och `position: sticky` flyttar dessutom elementet efter
 * att stilen är beräknad. `elementFromPoint` svarar på det som faktiskt gäller
 * — vad en tumme träffar på den punkten.
 *
 * Kräver att sidan går att scrolla. Gör den inte det kan ingenting glida förbi
 * kromet, och då mäter provet ingenting; det rapporteras som `scrollad: false`
 * i stället för som ett grönt utfall, eftersom en mätning utan underlag inte är
 * ett godkännande.
 *
 * @param {import("playwright").Page} sida
 * @returns {Promise<{ scrollad: boolean, traffar: { krom: string, x: number, overst: string }[] }>}
 */
async function matKrom(sida) {
  return await sida.evaluate(() => {
    const rot = document.documentElement;
    if (rot.scrollHeight <= window.innerHeight + 50) return { scrollad: false, traffar: [] };

    window.scrollTo(0, Math.min(400, rot.scrollHeight - window.innerHeight));

    /** @param {Element | null} el */
    const namn = (el) => {
      if (!el) return "ingenting";
      const klass = String(el.className || "").split(" ")[0];
      return `${el.tagName.toLowerCase()}${klass ? `.${klass}` : ""}`;
    };

    const kromdelar = [
      { krom: "appskalets header", el: document.querySelector("header") },
      { krom: "bottenraden", el: document.querySelector('nav[aria-label="Snabbnavigering"]') },
    ];

    const traffar = [];
    for (const { krom, el } of kromdelar) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.height <= 0 || getComputedStyle(el).display === "none") continue;
      // ⛔ Krom som inte syns i fönstret mäts inte. `elementFromPoint` svarar
      // `null` utanför fönstret, och `null` är inte en övermålning — det är
      // ingen mätning alls. Utan det här blev varje sida röd så fort en
      // bottenrad låg i flödet i stället för fast, alltså ett falskt rött
      // som hade fått hela mätningen avstängd.
      if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
      const y = Math.min(window.innerHeight - 1, Math.max(0, Math.round(r.top + r.height / 2)));
      // Tre punkter i stället för en: en övermålning täcker sällan hela bredden.
      // Förstakolumnen i en tabell tar vänsterkanten, en modal hela mitten.
      for (const andel of [0.1, 0.5, 0.9]) {
        const x = Math.round(r.left + r.width * andel);
        const overst = document.elementFromPoint(x, y);
        if (overst && (overst === el || el.contains(overst))) continue;
        traffar.push({ krom, x, overst: namn(overst) });
      }
    }
    return { scrollad: true, traffar };
  });
}

export async function matVyport({ dist, rutter }) {
  const { server, url } = await serveraDist(dist);
  const { browser, varifran } = await startaWebblasare().catch(async (e) => {
    server.close();
    throw e;
  });

  /** @type {string[]} */
  const brott = [];
  let matningar = 0;
  let sidorUtanNav = 0;
  /** @type {{ brott: string[], matningar: number, reglage: number }} */
  let tema = { brott: [], matningar: 0, reglage: 0 };

  try {
    for (const vy of VYPORTER) {
      const kontext = await browser.newContext({ viewport: { width: vy.bredd, height: vy.hojd } });
      const sida = await kontext.newPage();

      for (const rutt of rutter) {
        await sida.goto(`${url}${rutt}`, { waitUntil: "networkidle" });
        matningar += 1;

        const matt = await sida.evaluate(() => {
          const rot = document.documentElement;

          /**
           * Elementen som sticker ut, inte bara att något gör det. Ett rött
           * "sidan är för bred" utan att säga av vad är en halv dags sökande.
           * Element inuti något som medvetet scrollar i sidled räknas inte.
           */
          const skyldiga = [];
          for (const el of Array.from(document.querySelectorAll("body *"))) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right <= window.innerWidth + 1 && r.left >= -1) continue;
            let f = el.parentElement;
            let medvetet = false;
            while (f && f !== document.body) {
              const s = getComputedStyle(f);
              if (s.overflowX === "auto" || s.overflowX === "scroll") {
                medvetet = true;
                break;
              }
              f = f.parentElement;
            }
            if (medvetet) continue;
            skyldiga.push(`${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""} (${Math.round(r.left)}..${Math.round(r.right)})`);
          }

          const navs = Array.from(document.querySelectorAll("nav")).map((n) => ({
            namn: n.getAttribute("aria-label"),
            synlig: n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== "none",
          }));

          const huvud = document.querySelector("main");
          const insetBotten = huvud ? parseFloat(getComputedStyle(huvud).paddingBottom) || 0 : 0;
          const barhojd = parseFloat(getComputedStyle(rot).getPropertyValue("--bottom-nav-h")) || 0;

          return {
            sidbredd: rot.scrollWidth,
            fonsterbredd: window.innerWidth,
            skyldiga: skyldiga.slice(0, 6),
            navs,
            insetBotten,
            // `--bottom-nav-h` är i rem; 1rem är 16px om inget annat sagts.
            barhojdPx: barhojd * parseFloat(getComputedStyle(rot).fontSize),
          };
        });

        const var_ = `${vy.namn}, ${rutt}`;

        // 1. Ingen horisontell scroll.
        if (matt.sidbredd > matt.fonsterbredd + 1) {
          brott.push(
            `${var_}: sidan är ${matt.sidbredd} px bred i ett ${matt.fonsterbredd} px fönster, alltså horisontell scroll. ` +
              (matt.skyldiga.length
                ? `Sticker ut: ${matt.skyldiga.join(", ")}.`
                : "Inget enskilt element sticker ut, så det är troligen en marginal eller en negativ position."),
          );
        }

        // 2. Rätt navigering syns för rätt bredd.
        const synliga = matt.navs.filter((n) => n.synlig).map((n) => n.namn);
        if (synliga.length === 0) sidorUtanNav += 1;
        if (synliga.length !== 1) {
          brott.push(
            `${var_}: ${synliga.length} navigeringar är synliga samtidigt (${synliga.join(", ") || "ingen"}). ` +
              "Exakt en ska synas per bredd, annars finns det två sanningar om var man klickar.",
          );
        } else if (vy.bottenrad && synliga[0] !== "Snabbnavigering") {
          brott.push(`${var_}: bottenraden syns inte, det gör "${synliga[0]}". Under md ska telefonens rad vara den som möter användaren.`);
        } else if (!vy.bottenrad && synliga[0] === "Snabbnavigering") {
          brott.push(`${var_}: bottenraden syns fortfarande vid ${vy.bredd} px. Den ska vara borta från och med md.`);
        }

        // 3. Innehållet hamnar inte bakom baren.
        if (vy.bottenrad && matt.barhojdPx > 0 && matt.insetBotten < matt.barhojdPx) {
          brott.push(
            `${var_}: main har ${Math.round(matt.insetBotten)} px botteninset men baren är ${Math.round(matt.barhojdPx)} px hög. ` +
              "Sista raden i innehållet hamnar bakom baren, och det märks först när någon letar efter sin sista post.",
          );
        }

        // 4. Kromet ligger kvar överst när sidan har scrollats.
        //
        // ⛔ DEN HÄR MÄTNINGEN FINNS FÖR ATT LAGREN INTE GÅR ATT LÄSA SIG TILL.
        // Två element på samma z-index är inte ordnade, de är oavgjorda:
        // dokumentordningen avgör, och den som står sist vinner. Ingen ser det i
        // koden, för båda raderna ser rimliga ut var för sig.
        //
        // Mätt i bolag-ops 2026-09-18: OpsTables låsta förstakolumn och
        // appskalets header låg båda på `--z-sticky`, och kolumnen målade rakt
        // över headern på telefon så fort sidan scrollades. Logotyp, inkorg och
        // temaknapp försvann bakom en tabellcell.
        //
        // Ett skärmklipp hittade det. En mätning hittar det varje gång.
        const krom = await matKrom(sida);
        if (krom.scrollad) {
          for (const t of krom.traffar) {
            brott.push(
              `${var_}: ${t.krom} är övermålad vid x=${t.x} efter scroll. Överst ligger ${t.overst}. ` +
                "Kromets hela uppgift är att finnas kvar när innehållet rör sig, så innehåll får aldrig ligga över det. " +
                "Nästan alltid samma z-index på båda, och då avgör dokumentordningen i stället för avsikten.",
            );
          }
        }
      }

      await kontext.close();
    }

    // ⛔ Temapasset ligger INNANFÖR samma `try`, så webbläsaren och servern
    // stängs även när det kastar. En kvarlämnad Chromium hänger körningen.
    tema = await matTeman({ browser, url, rutter });
  } finally {
    await browser.close();
    server.close();
  }

  // ── ⛔ Golv: mätte vi ens appen? ─────────────────────────────────────────
  //
  // Saknar VARENDA sida navigering är slutsatsen nästan aldrig att navigeringen
  // är trasig. Den är att vi tittar på något annat: en inloggningsskärm, en
  // felsida, eller en dist-mapp från ett gammalt bygge.
  //
  // Utan det här golvet rapporterades det som ett fynd PER sida och bredd. Mätt
  // på bolag-ops gav det 18 rader som alla sade samma sak och ingen av dem det
  // som var sant, alltså att appen ligger bakom en inloggning. En vakt som
  // svarar med brus på fel fråga blir avstängd, och då skyddar den ingenting.
  const alla = VYPORTER.length * rutter.length;
  if (matningar > 0 && sidorUtanNav === alla) {
    return {
      brott: [
        `Ingen av de ${alla} mätningarna hittade någon navigering. Det betyder nästan säkert att mätningen inte ser appen: ` +
          "en inloggningsskärm, en felsida, eller en dist-mapp från ett annat bygge. Kontrollera att sökvägen stämmer och " +
          "att sidorna går att nå utan att logga in innan du tolkar något annat resultat.",
      ],
      matningar,
      temamatningar: tema.matningar,
      reglage: tema.reglage,
      varifran,
    };
  }

  return { brott: [...brott, ...tema.brott], matningar, temamatningar: tema.matningar, reglage: tema.reglage, varifran };
}
