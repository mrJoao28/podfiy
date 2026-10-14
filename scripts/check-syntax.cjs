// Verificação de sintaxe independente do build. Não resolve dependências.
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require(process.env.PODFIY_ESBUILD || "esbuild");
let errors = 0,
  checked = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts")) {
      checked++;
      try {
        esbuild.transformSync(fs.readFileSync(file, "utf8"), {
          sourcefile: file,
          loader: file.endsWith(".tsx") ? "tsx" : "ts",
          target: "es2022",
        });
      } catch (e) {
        errors++;
        console.error(e.message);
      }
    }
  }
}
visit("src");
visit("tests");
console.log(
  `${checked} arquivos; ${errors} erros de sintaxe. Não substitui tsc/build.`,
);
process.exitCode = errors ? 1 : 0;
