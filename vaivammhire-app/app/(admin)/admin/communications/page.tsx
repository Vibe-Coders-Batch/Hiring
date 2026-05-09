import { CommunicationsInbox } from './inbox';

export const metadata = { title: 'Communications' };

export default function CommunicationsPage() {
  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Communications hub</h1>
      <p className="text-neutral-600 mb-8">
        Email, WhatsApp, and LinkedIn DMs in one inbox. Outbound messages are AI-drafted, HR-approved.
      </p>

      <CommunicationsInbox />
    </div>
  );
}
