const QUESTIONS = [
  {
    question: "What does Ayursarga help me do?",
    answer: "Ayursarga helps you discover approved Ayurvedic centers, understand their active services, and send an appointment request directly to the center you choose.",
  },
  {
    question: "Can I explore centers without creating an account?",
    answer: "Yes. You can search centers and review their listed services without signing in. Google sign-in is required only when you request an appointment or manage your bookings.",
  },
  {
    question: "What postnatal care services can I book through Ayursarga?",
    answer: "You can explore and book trusted Ayurvedic postnatal care services for mothers and babies through Ayursarga.",
  },
  {
    question: "How do I choose the right postnatal care centre?",
    answer: "You can compare centres based on their location, services, facilities and packages, and choose what suits you best.",
  },
  {
    question: "How is an appointment confirmed?",
    answer: "Your preferred date and time are sent as a request. The selected center can confirm it, reject it, or suggest a different appointment time from its Hospital portal.",
  },
  {
    question: "Does Ayursarga decide which treatment I need?",
    answer: "No. Ayursarga supports discovery and general guidance. Treatment suitability and clinical decisions are confirmed by a qualified physician at the selected Ayurvedic center.",
  },
  {
    question: "Are the displayed service prices final?",
    answer: "Displayed prices describe the service listed by the center. The center will confirm the appropriate care plan, inclusions, duration, and any final charges after clinical consultation.",
  },
  {
    question: "How can an Ayurvedic center partner with Ayursarga?",
    answer: "Use the Personal Guidance form and select Ayurvedic hospital partnership. Our team will review the request and explain the approval, agreement, and account activation process.",
  },
] as const;

export default function GeneralQuestions() {
  return (
    <section id="general-questions" className="section general-questions">
      <div className="section-inner general-questions-layout">
        <div className="general-questions-intro">
          <h2 className="section-title">A little clarity before you begin.</h2>
          <p>Simple answers about discovering centers, requesting appointments, and receiving care through Ayursarga.</p>
        </div>

        <div className="general-questions-list">
          {QUESTIONS.map(({ question, answer }) => (
            <details key={question}>
              <summary>
                <span>{question}</span>
                <span className="general-question-mark" aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
