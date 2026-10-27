import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

test("public discovery runtime dependency graphs do not import the Firestore SDK", () => {
  // Inspect emitted imports, not type annotations. No application build required.
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    for (const [, specifier] of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
      assert.ok(!/^(@firebase\/firestore|firebase\/firestore|firebase-admin)(\/|$)/.test(specifier), `${file} imports ${specifier}`);
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      const dependency = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
      assert.ok(dependency, `Missing local dependency ${specifier}`);
      visit(dependency);
    }
  }
  for (const file of ["components/PublicHospitalSearch.tsx", "components/PublicCentreDetails.tsx", "components/PublicCentreComparison.tsx"]) visit(path.resolve(file));
});
