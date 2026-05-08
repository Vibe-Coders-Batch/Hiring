export const metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 prose prose-slate">
      <h1>Privacy policy (DPDP)</h1>
      <p>
        Vaivamm Capital Advisors processes the data you provide on this careers site in accordance with India's
        Digital Personal Data Protection Act, 2023 (DPDP).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Identification: name, email, phone, LinkedIn URL.</li>
        <li>Resume document and any answers to screening questions.</li>
        <li>System metadata: IP, timestamps, user-agent (security only).</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Recruitment: matching you to roles, scheduling, feedback, offers.</li>
        <li>AI screening: an automated scorecard is produced. A human at Vaivamm has the final say on every decision.</li>
        <li>
          Anonymised model training (only if you consent): we strip your name, email, phone, address, and LinkedIn
          before any training data leaves the recruitment system.
        </li>
      </ul>

      <h2>Retention</h2>
      <p>
        Rejected applications are auto-purged at six months. We extend per-candidate only by explicit HR action.
        Audit trails are retained for 12 months in anonymised form for legal defence.
      </p>

      <h2>Your rights</h2>
      <p>
        You can withdraw consent and request deletion at any time via{' '}
        <a href="/delete-my-data">/delete-my-data</a>. Deletion cascades resume blob, parsed data, and communications.
      </p>

      <h2>Contact</h2>
      <p>
        Data protection: <a href="mailto:dpo@vaivammcapital.com">dpo@vaivammcapital.com</a>
      </p>
    </article>
  );
}
