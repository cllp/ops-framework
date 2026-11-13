/**
 * Exempeldata till `OpsKarta` (cllp/ops-framework#570).
 *
 * En punkt med simplestyle-färg, en punkt med `typ` (paletten), en punkt utan färg (instansens accent), en linje och en yta. Namn och beskrivning på svenska. Koordinaterna ligger runt Dahab.
 *
 * `import { exempelkarta } from "ops-framework/exempel/karta"`
 */
export const exempelkarta = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "blue-hole",
      properties: {
        namn: "Blue Hole",
        beskrivning: "Dykplatsen norr om fyren. Ingången från land ligger vid sadeln.",
        "marker-color": "#c0683a",
        "marker-size": "large",
      },
      geometry: { type: "Point", coordinates: [34.5384, 28.5721] },
    },
    {
      type: "Feature",
      id: "fyren",
      properties: {
        namn: "Fyren",
        beskrivning: "Fyren i södra Dahab. Båtarna går ut härifrån på morgonen.",
        typ: "hamn",
      },
      geometry: { type: "Point", coordinates: [34.5197, 28.4955] },
    },
    {
      type: "Feature",
      id: "eel-garden",
      properties: {
        namn: "Eel Garden",
        beskrivning: "Grunda korallträdgården söder om lagunen.",
      },
      geometry: { type: "Point", coordinates: [34.5132, 28.4387] },
    },
    {
      type: "Feature",
      id: "kusten",
      properties: {
        namn: "Kusten",
        beskrivning: "Promenaden från Eel Garden till Blue Hole, längs vattnet.",
        stroke: "#bf9522",
        "stroke-width": 3,
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [34.5132, 28.4387],
          [34.5165, 28.47],
          [34.5197, 28.4955],
          [34.528, 28.54],
          [34.5384, 28.5721],
        ],
      },
    },
    {
      type: "Feature",
      id: "lagunen",
      properties: {
        namn: "Lagunen",
        beskrivning: "Den grunda lagunen innanför stranden. Vattnet står stilla på förmiddagen.",
        fill: "#4e7558",
        stroke: "#4e7558",
        "fill-opacity": 0.45,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [34.516, 28.488],
          [34.523, 28.488],
          [34.523, 28.496],
          [34.516, 28.496],
          [34.516, 28.488],
        ]],
      },
    },
  ],
};
