import { createRoot } from "react-dom/client";
import SmoothScroll from "@/components/SmoothScroll";

createRoot(document.getElementById("fixture-root")!).render(<SmoothScroll>
  <header id="site-nav" style={{ position: "fixed", top: 0, width: "100%" }}><div className="nav-inner" style={{ height: 60 }}>
    <a href="#target">Next section</a><a href="#hero">Home section</a>
  </div></header>
  <main><section id="hero" tabIndex={-1} style={{ height: 950, paddingTop: 100 }}>
    <ol className="process-journey"><li><article className="process-card">Stable process card</article></li></ol>
  </section><section id="target" tabIndex={-1} style={{ minHeight: 2200 }}><div className="section-inner" style={{ padding: 20 }}>Next section content</div></section></main>
</SmoothScroll>);
