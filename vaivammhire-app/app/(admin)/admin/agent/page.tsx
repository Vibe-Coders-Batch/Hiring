import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Agent' };

const LEVELS = [
  {
    key: 'suggest_only',
    title: 'Suggest only',
    description: 'Agent drafts every action. HR approves before anything reaches a candidate.',
  },
  {
    key: 'auto_low_stakes',
    title: 'Auto for low-stakes',
    description: 'Agent auto-sends acks, scheduling, reminders. HR approves shortlists, offers, rejections.',
  },
  {
    key: 'full_except_offers',
    title: 'Full autonomy except offers',
    description: 'Agent runs the pipeline. HR approves only offers.',
  },
] as const;

export default function AgentSettingsPage() {
  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Agent settings</h1>
      <p className="text-neutral-600 mb-8">
        Default at v2 launch is <strong>Auto for low-stakes</strong>. Per-role overrides live on each job.
      </p>

      <div className="space-y-4">
        {LEVELS.map((l) => (
          <Card key={l.key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{l.title}</CardTitle>
                {l.key === 'auto_low_stakes' && <Badge tone="primary">Default</Badge>}
              </div>
              <CardDescription>{l.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-neutral-500">
              Routing logic: parsing/scoring prefer local Track B models (when promoted). Drafting and edge cases
              use Bedrock Claude.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
