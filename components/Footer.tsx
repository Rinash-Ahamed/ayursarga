import Image from "next/image";

export default function Footer() {
  return <footer id="site-footer"><div className="footer-inner">
    <div className="footer-mark"><Image src="/logo.jpg" alt="Ayursarga" width={34} height={34} /><span>Ayursarga</span></div>
    <p>Kerala · Personalised Ayurvedic Retreat Matching</p>
    <div className="footer-links"><a href="#how-it-works">How it works</a><a href="#wellness">Wellness</a><a href="#partners">For partners</a><a href="#contact">Contact</a></div>
    <p className="footer-fine">© 2026 Ayursarga. Recommendations are personalised; treatment suitability is confirmed by the chosen centre’s physician.</p>
  </div></footer>;
}
