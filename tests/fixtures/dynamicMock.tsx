import { lazy, Suspense, type ComponentType } from "react";

/** Exercise real deferred component code without a Next.js server in fixtures. */
export default function dynamic(loader: () => Promise<ComponentType<Record<string, unknown>> | { default: ComponentType<Record<string, unknown>> }>) {
  const Component = lazy(() => {
    const state = globalThis as typeof globalThis & { fixtureLazyLoads?: number; fixtureLazyFailure?: boolean };
    state.fixtureLazyLoads = (state.fixtureLazyLoads ?? 0) + 1;
    if (state.fixtureLazyFailure) return Promise.reject(new Error("Simulated helper chunk failure"));
    return loader().then(module => typeof module === "function" ? { default: module } : module);
  });
  return function DeferredFixture(props: Record<string, unknown>) {
    return <Suspense fallback={<p role="status">Loading helper...</p>}><Component {...props} /></Suspense>;
  };
}
