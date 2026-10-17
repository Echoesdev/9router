// [veille-a5] Resout l'alias "@/..." (convention Next.js / jsconfig du
// depot, "@/x" -> "src/x") pour que les scripts Node autonomes puissent
// importer le mecanisme officiel de la couche DB (src/lib/db/...), qui
// utilise cet alias dans src/lib/db/paths.js. Aucune donnee sensible ne
// transite par ce loader : il ne fait que resoudre des chemins de modules.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");

export async function resolveSpecifier(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(pathToFileURL(resolve(srcRoot, specifier.slice(2))).href, context);
  }
  return nextResolve(specifier, context);
}

// Node's module customization hooks attendent une exportee nommee "resolve".
export { resolveSpecifier as resolve };

