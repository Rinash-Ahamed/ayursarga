import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Exercise real route code with isolated fake cloud dependencies, never live writes.
export function loadTypeScript(entry, overrides = {}) {
  const root = process.cwd();
  const require = createRequire(path.join(root, "package.json"));
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Function("require", "module", "exports", source)((specifier) => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier === "server-only") return {};
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return require(specifier);
      const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
      if (!file) throw new Error(`Unresolved test import ${specifier}`);
      return load(file);
    }, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, entry));
}
