import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Women’s Wellness | Ayursarga",
  description: "Explore holistic women’s wellness through different stages of life, including lifestyle, nutrition, relaxation, reproductive wellness and selected professional consultations.",
};

const WELLNESS_CONCERNS = [
  {
    title: "Menstrual irregularities",
    copy: "Menstrual irregularities can include changes in the timing, frequency, duration or amount of menstrual bleeding.",
    items: ["Heavy or prolonged menstrual bleeding", "Irregular periods", "Absent periods (amenorrhea)", "Infrequent periods (oligomenorrhea)", "Frequent periods", "Painful periods (dysmenorrhea)", "Bleeding between periods (intermenstrual bleeding)", "Abnormal bleeding after menopause"],
    warning: "Persistent, heavy or unusual bleeding should be evaluated by an appropriately qualified healthcare professional.",
  },
  {
    title: "PCOD / PCOS",
    paragraphs: [
      "Polycystic ovary syndrome (PCOS) is a common hormonal and metabolic condition that may be associated with irregular periods, acne, excess hair growth, weight changes and difficulty becoming pregnant.",
      "PCOS requires appropriate medical evaluation and individualised management.",
      "Healthy lifestyle habits, nutrition, physical activity and stress management may form part of an individual’s overall wellbeing plan.",
    ],
  },
  {
    title: "Perimenopausal concerns",
    copy: "Perimenopause is the transition toward menopause and may bring physical, emotional and hormonal changes. The severity and duration of symptoms vary from person to person.",
    items: ["Changes in menstrual cycles", "Hot flashes and night sweats", "Mood changes", "Sleep disturbances", "Fatigue", "Vaginal dryness", "Changes in sexual wellbeing"],
    warning: "Persistent or concerning symptoms should be discussed with a qualified healthcare professional.",
  },
  {
    title: "Uterine fibroids",
    copy: "Uterine fibroids are non-cancerous growths that develop from the muscular tissue of the uterus. They are common during the reproductive years and can vary in size and location. Many fibroids do not cause symptoms.",
    items: ["Heavy or prolonged menstrual bleeding", "Pelvic pain or pressure", "Frequent urination", "Abdominal discomfort", "Reproductive difficulties"],
    warning: "Management depends on symptoms, the size and location of the fibroids, age and reproductive plans. Medical evaluation is important when fibroids are suspected or symptoms are present.",
  },
  {
    title: "Infertility",
    paragraphs: [
      "Infertility refers to difficulty achieving pregnancy despite regular, unprotected sexual intercourse. It can be associated with factors affecting either partner, including ovulation, hormones, fallopian tubes, the uterus or male reproductive health.",
      "Appropriate medical evaluation can help identify possible causes and guide treatment. Depending on age and individual circumstances, evaluation may be recommended.",
    ],
    warning: "Ayurvedic wellness and lifestyle support may complement an individual’s overall wellbeing, but should not replace appropriate fertility evaluation or treatment.",
  },
  {
    title: "Other women’s wellness concerns",
    copy: "Women may also seek guidance for concerns such as:",
    items: ["Abnormal vaginal discharge", "Pelvic discomfort", "Stress and emotional wellbeing", "Lifestyle and nutrition", "General reproductive wellness", "Preconception wellness", "Postpartum wellbeing", "Menopause-related wellness"],
    warning: "Symptoms such as unusual vaginal discharge, pelvic pain, fever, abnormal bleeding or persistent discomfort may require medical evaluation.",
  },
] as const;

const WELLNESS_INCLUDES = [
  {
    title: "Holistic Ayurvedic wellness",
    copy: "Ayurveda takes an individualised approach to wellbeing. Based on a person’s needs, lifestyle and overall condition, appropriate Ayurvedic wellness practices may be recommended.",
    items: ["Ayurvedic lifestyle guidance", "Personalised dietary guidance", "Wellness therapies", "Rejuvenation programmes", "Relaxation practices", "Healthy daily-routine guidance"],
    note: "These services are intended to support wellbeing and are not a substitute for medical diagnosis or treatment.",
  },
  {
    title: "Stress and relaxation management",
    copy: "Busy lifestyles, work, family responsibilities and major life transitions can affect a woman’s physical and emotional wellbeing. The goal is to encourage relaxation and healthy approaches to managing everyday stress.",
    items: ["Breathing practices", "Yoga", "Meditation", "Relaxation techniques", "Mindfulness", "Appropriate Ayurvedic wellness therapies"],
  },
  {
    title: "Nutrition and healthy lifestyle",
    copy: "Nutrition and lifestyle habits play an important role in overall wellbeing. Ayursarga may connect women with appropriate professional guidance regarding:",
    items: ["Balanced nutrition", "Healthy eating habits", "Hydration", "Lifestyle modification", "Healthy weight management", "Individual wellness goals"],
  },
  {
    title: "Fitness and movement",
    copy: "Regular, appropriate physical activity can support general health and wellbeing. Exercise recommendations should be adapted to an individual’s health status and physical condition.",
    items: ["Yoga", "Gentle exercise", "Stretching", "Walking", "Mobility practices", "Relaxation and breathing exercises"],
  },
  {
    title: "Reproductive and maternal wellness",
    copy: "Women may seek wellness support during different reproductive stages.",
    items: ["Preconception wellness", "Prenatal wellness", "Postnatal recovery", "Lactation support", "General women’s wellness consultations"],
    note: "Where a medical concern is present, appropriate medical evaluation should always take priority.",
  },
  {
    title: "Self-care and rejuvenation",
    copy: "Women often prioritise the needs of their families while overlooking their own wellbeing. Wellness programmes can provide an opportunity to pause, rest and focus on self-care.",
    items: ["Ayurvedic massage and wellness therapies", "Relaxation sessions", "Wellness retreats", "Personalised self-care routines", "Rest and rejuvenation programmes"],
  },
  {
    title: "Online consultation",
    copy: "For selected women’s wellness services, Ayursarga may provide access to online consultations with appropriate professionals. Availability and suitability may vary depending on the service and individual requirements.",
  },
] as const;

const WELLNESS_BENEFITS = [
  "Make healthier lifestyle choices",
  "Prioritise self-care",
  "Manage everyday stress",
  "Maintain appropriate physical activity",
  "Develop awareness of nutritional needs",
  "Make time for rest and relaxation",
  "Access appropriate professional wellness guidance when needed",
] as const;

export default function WomensWellnessPage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="womens-wellness-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">Holistic wellbeing</span>
          <h1>Women&apos;s wellness</h1>
          <p>Supporting women through every stage of life.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="Women’s wellness overview">
          <strong>Women&apos;s wellness is about supporting physical, emotional and overall wellbeing through the different stages of life. Ayursarga connects women with suitable Ayurvedic wellness centres, qualified professionals, wellness therapies, lifestyle support and selected online consultation services, making holistic wellness more accessible and convenient.</strong>
        </section>

        <section className="discover-care-introduction" aria-labelledby="women-through-life-title">
          <div className="discover-care-heading">
            <span>Wellness through life</span>
            <h2 id="women-through-life-title">Care that evolves with every stage</h2>
          </div>
          <div className="discover-care-copy discover-care-prenatal-copy">
            <p>Women experience physical, emotional and lifestyle changes throughout different stages of life. From adolescence and the reproductive years to pregnancy, postpartum recovery, perimenopause and beyond, each stage may bring its own wellness needs.</p>
            <p>At Ayursarga, women&apos;s wellness focuses on a holistic approach that supports healthy lifestyle habits, relaxation, nutrition, physical activity, emotional wellbeing and appropriate Ayurvedic wellness practices.</p>
            <p>Our aim is to help women make time for their own health and wellbeing, not only when they are unwell, but as part of everyday life.</p>
          </div>
        </section>

        <section className="discover-care-topics" aria-labelledby="womens-concerns-title">
          <div className="discover-care-section-title">
            <span>Understand your needs</span>
            <h2 id="womens-concerns-title">Common women&apos;s wellness concerns</h2>
            <p>Women may seek guidance for a wide range of health and wellness concerns. Some common concerns include:</p>
          </div>
          <div className="discover-care-topic-grid">
            {WELLNESS_CONCERNS.map((concern, index) => <article className="discover-care-topic-card" key={concern.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{concern.title}</h3>
              {"copy" in concern && <p>{concern.copy}</p>}
              {"paragraphs" in concern && concern.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {"items" in concern && <ul>{concern.items.map((item) => <li key={item}>{item}</li>)}</ul>}
              {"warning" in concern && <p className="discover-care-topic-warning">{concern.warning}</p>}
            </article>)}
          </div>
        </section>

        <section className="discover-care-topics discover-care-includes" aria-labelledby="womens-wellness-includes-title">
          <div className="discover-care-section-title">
            <span>A holistic approach</span>
            <h2 id="womens-wellness-includes-title">What does women&apos;s wellness include?</h2>
          </div>
          <div className="discover-care-topic-grid">
            {WELLNESS_INCLUDES.map((area, index) => <article className="discover-care-topic-card" key={area.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{area.title}</h3>
              <p>{area.copy}</p>
              {"items" in area && <ul>{area.items.map((item) => <li key={item}>{item}</li>)}</ul>}
              {"note" in area && <p className="discover-care-topic-warning">{area.note}</p>}
            </article>)}
          </div>
        </section>

        <section className="discover-care-ayursarga discover-care-prenatal-benefits" aria-labelledby="womens-wellness-matters-title">
          <span className="eyebrow light">Everyday wellbeing</span>
          <h2 id="womens-wellness-matters-title">Why women&apos;s wellness matters</h2>
          <p>Women&apos;s wellness is not limited to addressing illness. It is also about developing healthy and sustainable habits that support physical, emotional and overall wellbeing. A holistic wellness approach can help women:</p>
          <ul className="discover-care-dark-list">
            {WELLNESS_BENEFITS.map((item) => <li key={item}><span aria-hidden="true">✓</span><p>{item}</p></li>)}
          </ul>
        </section>

        <section className="discover-care-network" aria-labelledby="womens-wellness-ayursarga-title">
          <span>Discover through Ayursarga</span>
          <h2 id="womens-wellness-ayursarga-title">Women&apos;s wellness through Ayursarga</h2>
          <p>Ayursarga connects women with suitable Ayurvedic wellness centres, qualified professionals and selected online consultation services, helping them discover wellness options that suit their individual needs and preferences.</p>
          <p>Whether a woman is looking for relaxation, lifestyle guidance, nutritional support, rejuvenation or wellness support during a particular stage of life, Ayursarga aims to make suitable wellness options easier to discover and access.</p>
        </section>

        <aside className="discover-care-disclaimer discover-care-disclaimer-strong">
          <p><strong>Important disclaimer: Ayursarga facilitates access to wellness services and selected professional consultations. Wellness services are not a substitute for medical diagnosis, treatment or emergency care. Women experiencing persistent, severe or concerning symptoms should consult an appropriately qualified healthcare professional.</strong></p>
        </aside>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#womens-wellness-top" />
  </>;
}
