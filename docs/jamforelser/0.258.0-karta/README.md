# Kartans paneler, 0.258.0 (cllp/lifehub.app#950)

Skärmbilder från en byggd sida i Chromium (Playwright, `deviceScaleFactor` 2): `OpsKarta` med åtta exempelplatser i fyra lager, i den öppnade kartan.

| Fil | Bredd | Läge |
|---|---|---|
| `telefon-infallt.png` | 390 | Öppnad karta, allt infällt, knapparna längst ner |
| `telefon-lager.png` | 390 | Lager som halvt ark |
| `telefon-installningar.png` | 390 | Inställningar som halvt ark |
| `dator-infallt.png` | 1280 | Panelerna som flikar vid kanten |
| `dator-utfallt.png` | 1280 | Lager och Inställningar utfällda |

**Underlaget är tomt i bilderna.** OpenFreeMap och Mapterhorn svarar inte i miljön där bilderna togs, så kartan visar bara landets färg och objekten. Det som bilderna visar är panelerna, inte kartgrunden. Ett montage med riktiga brickor görs i appen efter publiceringen.

**Jämfört med skissen** (lifehub.app `docs/skiss/kartor/kartor-v1.0.pdf`):
- **Matchar:**
  - panelerna Lager och Inställningar;
  - flikarna vid kanten på dator;
  - arket nerifrån med handtag och knappar på telefon;
  - lagrens färg och antal;
  - kartgrunden som väljare.
- **Skiljer sig:**
  - På dator ligger panelerna över kartan i stället för att kartan krymper.
  - Panelen Info saknas, och kommer i skiva 5.
  - Satellit saknas i väljaren tills Esri-nyckeln finns.
