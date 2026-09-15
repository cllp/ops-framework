# __APP_NAME__

En ops-plattform byggd på `@staiger/ops-framework`.

## ⛔ Läs ramverkets regler först, och läs dem där de bor

Arbetsreglerna och skills ligger i ramverket, inte här:

```
node_modules/@staiger/ops-framework/CLAUDE.md
node_modules/@staiger/ops-framework/skills/
```

**Kopiera dem aldrig hit.** En kopia börjar glida isär från originalet samma
vecka den skapas, och sedan finns två regeluppsättningar där ingen vet vilken
som gäller. En sanning per faktum.

Den här filen innehåller bara det som är **sant för just den här appen**.

## De två halvorna

| Kom hit genom att kopieras. Får divergera. | Kommer från ramverket. Får inte divergera. |
|---|---|
| appskal, routes, vyer | tokens |
| ESLint-konfig, CI, grinden | primitiverna och deras stängda API |
| allt domänspecifikt | arbetsreglerna och skills |
| | vakterna |

Behöver du något som inte finns i ramverket: **lägg till det i ramverket**. Ett
lokalt token eller en lokal knapp är början på två plattformar som ser olika ut,
och den skillnaden upptäcks först när någon jämför dem sida vid sida.

## Före varje push

```
npm run gate
```

Den lokala grinden är **golvet**, inte ett komplement till CI. Lita aldrig på
att något annat fångade det: en regel som utlovar ett skydd den inte har är
farligare än ingen regel alls.

## Det som inte finns här ännu, med flit

Datalager, auth och behörighetsmodell. De ser olika ut per plattform och läggs
till när det är klart vilken modell just den här appen ska ha. Att gissa modellen
i förväg är hur man får en behörighetsmodell som ingen litar på.

## Appens egna regler

<!-- Skriv dem här, och skriv ut händelsen som skapade varje regel.
     En regel utan sitt skäl tas bort av nästa person som tycker den är i vägen. -->
