// Trusted Node-only operator loader. Reuse application SMTP/templates without
// weakening server-only boundaries in Next or browser code.
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const url = new URL(`${specifier.slice(2)}.ts`, root);
      if (!existsSync(url)) throw new Error("Required server service is unavailable.");
      return nextResolve(url.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root.href) && url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "transform" }),
    };
    return nextLoad(url, context);
  },
});
