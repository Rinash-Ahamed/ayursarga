import { createRoot } from "react-dom/client";
import TreatmentFilm from "@/components/TreatmentFilm";
import Voices from "@/components/Voices";

createRoot(document.getElementById("fixture-root")!).render(<main>
  <div style={{height:2000}}>Above-the-fold fixture</div>
  <section className="section"><div className="section-inner"><TreatmentFilm /></div></section>
  <Voices />
</main>);
