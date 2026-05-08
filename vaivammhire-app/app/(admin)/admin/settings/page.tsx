import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Settings</h1>
      <p className="text-neutral-600 mb-8">Users, integrations, retention, branding.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Cognito user pool · MFA mandatory for Admin role.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            Manage roles via the Cognito console; in-app management ships in Phase 2.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>OAuth tokens stored in AWS Secrets Manager, rotated quarterly.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            Google Calendar · LinkedIn · WhatsApp Cloud API · Documenso.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Retention</CardTitle>
            <CardDescription>Six-month auto-purge of rejected candidates. Audit logs retained 12 months.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            Per PRD §12.1; HR can extend per candidate with a single click.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Design tokens in <code>styles/tokens.css</code>.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            Tone of voice notes for AI drafts live in <code>server/services/prompts/</code>.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
