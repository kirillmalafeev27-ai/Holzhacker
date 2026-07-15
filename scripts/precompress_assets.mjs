import { constants, brotliCompressSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("Pass at least one asset path");

for (const file of files) {
  const source = readFileSync(file);
  const compressed = brotliCompressSync(source, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
    },
  });
  writeFileSync(`${file}.br`, compressed);
  console.log(`BROTLI_OK ${file} ${(source.length / 1048576).toFixed(2)}MB -> ${(compressed.length / 1048576).toFixed(2)}MB`);
}
