import { hydrateRoot } from "react-dom/client";
import { useEffect } from "react";
import Nav from "@/components/Nav";
declare global { interface Window { navFixtureReady: boolean; updateNavFixturePath: (pathname: string) => void; } }
function App() {
  useEffect(() => { window.navFixtureReady = true; }, []);
  return <Nav />;
}
const root = hydrateRoot(document.getElementById("fixture-root")!, <App />);
window.updateNavFixturePath = (pathname) => { window.navFixturePath = pathname; root.render(<App />); };
