// Fetches the faces the bill and the prescription PDFs are drawn in (plan §33):
//
//   public/fonts/pdf/{Figtree-Regular,Figtree-SemiBold,Figtree-Bold}.ttf
//
// The app's own face, as static TrueType from Google Fonts — pdfkit needs
// TrueType. Each is cut to Latin with Latin Extended, the general
// punctuation, sub- and superscripts and ₹ (D224: Indian scripts later), so
// the three stay small. Figtree is under the SIL Open Font License
// (OFL-Figtree.txt beside them). Ported from Brio's scripts/bill-fonts.mjs.
//
//   node scripts/pdf-fonts.mjs
import fs from "node:fs";

const OUT = "public/fonts/pdf";
const RANGES = [
  [0x20, 0x7e],
  [0xa0, 0x24f],
  [0x2010, 0x2027],
  [0x2030, 0x203a],
  [0x2070, 0x209f],
  [0x20ac, 0x20ac],
  [0x20b9, 0x20b9],
  [0x2122, 0x2122],
  [0x2212, 0x2212],
];
const FACES = {
  "Figtree-Regular": "Figtree:wght@400",
  "Figtree-SemiBold": "Figtree:wght@600",
  "Figtree-Bold": "Figtree:wght@700",
};

const text = RANGES.flatMap(([from, to]) =>
  Array.from({ length: to - from + 1 }, (_, index) => String.fromCodePoint(from + index)),
).join("");

fs.mkdirSync(OUT, { recursive: true });
for (const [file, family] of Object.entries(FACES)) {
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
  // An agent Google does not know is answered with TrueType.
  const css = await (await fetch(url, { headers: { "User-Agent": "curl/8" } })).text();
  const source = /src:\s*url\(([^)]+)\)\s*format\('truetype'\)/.exec(css)?.[1];
  if (!source) throw new Error(`No TrueType for ${family}`);
  const bytes = Buffer.from(await (await fetch(source)).arrayBuffer());
  fs.writeFileSync(`${OUT}/${file}.ttf`, bytes);
  console.log(`${file}.ttf  ${(bytes.length / 1024).toFixed(0)} KB`);
}
