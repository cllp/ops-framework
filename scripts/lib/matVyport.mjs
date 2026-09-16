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
 * ── ⛔ FAIL-CLOSED NÄR WEBBLÄSAREN SAKNAS ───────────────────────────────────
 *
 * Kan den inte starta Chromium säger den det och blir RÖD. Frestelsen är att
 * hoppa över tyst så att grinden går igenom på en maskin utan webbläsare, men
 * då är den grön av att inte ha tittat, och det är samma sak som att ljuga.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

/** Bredder vi lovar. `md` i Tailwind är 768, så 767 är sista telefonbredden. */
const VYPORTER = [
  { namn: "telefon 390", bredd: 390, hojd: 844, bottenrad: true },
  { namn: "surfplatta 768", bredd: 768, hojd: 1024, bottenrad: false },
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
 * @param {object} arg
 * @param {string} arg.dist Mappen med den byggda appen.
 * @param {string[]} arg.rutter Sökvägar att mäta, t.ex. ["/", "/primitiver"].
 * @returns {Promise<{ brott: string[], matningar: number, varifran: string }>}
 */
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
      }

      await kontext.close();
    }
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
      varifran,
    };
  }

  return { brott, matningar, varifran };
}
