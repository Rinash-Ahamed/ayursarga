import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Bundle the actual shared components for browser tests without a test-only
// application route, authentication bypass, cloud writes or build dependency.
export function bundleDialogHarness(fixture = "tests/fixtures/dialogHarness.tsx", overrides: Record<string, string> = {}, environment: Record<string, string> = {}) {
  const root = process.cwd();
  const localRequire = createRequire(path.join(root, "package.json"));
  const productionModule = (name: string, file: string) => path.join(path.dirname(localRequire.resolve(name)), "cjs", file);
  const libraries: Record<string, string> = {
    react: productionModule("react", "react.production.js"),
    "react/jsx-runtime": productionModule("react", "react-jsx-runtime.production.js"),
    "react-dom": productionModule("react-dom", "react-dom.production.js"),
    "react-dom/client": productionModule("react-dom", "react-dom-client.production.js"),
    scheduler: productionModule("scheduler", "scheduler.production.js"),
    "qrcode-generator": localRequire.resolve("qrcode-generator"),
    "next/dynamic": path.join(root, "tests/fixtures/dynamicMock.tsx"),
  };
  const modules: Array<{ source: string; imports: Record<string, number> }> = [];
  const ids = new Map<string, number>();
  function include(filename: string): number {
    const existing = ids.get(filename);
    if (existing !== undefined) return existing;
    const id = modules.length;
    ids.set(filename, id);
    const entry = { source: "", imports: {} as Record<string, number> };
    modules.push(entry);
    const source = readFileSync(filename, "utf8");
    entry.source = /\.tsx?$/.test(filename) ? ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText : source;
    for (const [, specifier] of entry.source.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      const dependency = overrides[specifier] ? path.join(root, overrides[specifier]) : libraries[specifier] ?? [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
      if (!dependency) throw new Error(`Unsupported fixture dependency: ${specifier}`);
      entry.imports[specifier] = include(dependency);
    }
    return id;
  }
  const entry = include(path.join(root, fixture));
  return `(function(){const process={env:${JSON.stringify({ NODE_ENV: "production", ...environment })}},modules=${JSON.stringify(modules)},cache={};function load(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;const item=modules[id];new Function("require","module","exports","process",item.source)(name=>load(item.imports[name]),module,module.exports,process);return module.exports;}load(${entry});})();`;
}
