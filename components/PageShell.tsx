import SmoothScroll from "@/components/SmoothScroll";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Philosophy from "@/components/Philosophy";
import WellnessGuide from "@/components/WellnessGuide";
import Therapies from "@/components/Therapies";
import Sanctuary from "@/components/Sanctuary";
import Voices from "@/components/Voices";
import GeneralQuestions from "@/components/GeneralQuestions";
import Footer from "@/components/Footer";
import PublicOpening from "@/components/PublicOpening";

export default function PageShell() {
  return (
    <>
      <PublicOpening />
      <WhatsAppBubble />
      <Nav />

      <SmoothScroll>
        <main>
          <Hero />
          <Philosophy />
          <WellnessGuide />
          <Therapies />
          <Sanctuary />
          <Voices />
          <GeneralQuestions />
        </main>
        <Footer />
      </SmoothScroll>
    </>
  );
}
