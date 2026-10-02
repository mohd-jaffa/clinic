// Every unit test mirrors the file it tests (plan §34.3): tests/unit/X.test.ts
// covers src/X.ts or src/X.tsx. A test beside nothing means its subject moved
// or went, and the test would quietly keep passing against nothing — so this
// fails the run instead. A test left inside src/ fails it too.
import fs from "node:fs";
import path from "node:path";

const UNIT = "tests/unit";
const walk = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))
    : [];

const orphans = walk(UNIT)
  .filter((file) => /\.test\.tsx?$/.test(file))
  .filter((file) => {
    const subject = path.join("src", path.relative(UNIT, file).replace(/\.test\.tsx?$/, ""));
    return ![".ts", ".tsx"].some((ext) => fs.existsSync(subject + ext));
  });

const strays = walk("src").filter((file) => /\.test\.tsx?$/.test(file));

for (const file of orphans) console.error(`No subject for ${file} — expected it beside src/.`);
for (const file of strays) console.error(`${file} belongs under ${UNIT}/ (plan §34.3).`);
if (orphans.length || strays.length) process.exit(1);
console.log("Every unit test mirrors a file in src/.");
