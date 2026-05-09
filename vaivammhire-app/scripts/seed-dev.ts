/**
 * Seed dev data — one approved comp band + one published job + one sample
 * application so /admin/jobs and the kanban have something to render.
 *
 * Run: pnpm tsx scripts/seed-dev.ts
 */

import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import {
  applications,
  candidates,
  compBands,
  emailTemplates,
  jobs,
  organizations,
  users,
} from '../server/db/schema';
import { buildShareLinks } from '../server/services/share-links';
import { slugify } from '../lib/slugify';

async function main() {
  console.log('Seeding dev data…');

  const [insertedOrg] = await db
    .insert(organizations)
    .values({ name: 'Vaivamm Capital', slug: 'vaivamm-capital' })
    .onConflictDoNothing()
    .returning();

  let orgRow = insertedOrg;
  if (!orgRow) {
    const [found] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, 'vaivamm-capital'))
      .limit(1);
    orgRow = found;
  }
  if (!orgRow) throw new Error('Failed to seed organization');

  await db
    .insert(users)
    .values({
      email: 'admin@vaivammhire.local',
      name: 'Vaivamm Admin',
      role: 'admin',
      organizationId: orgRow.id,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: 'Vaivamm Admin',
        role: 'admin',
        organizationId: orgRow.id,
      },
    });

  await db
    .insert(emailTemplates)
    .values([
      {
        organizationId: orgRow.id,
        templateKey: 'rejection',
        name: 'Standard rejection',
        subject: 'Update on your application — {{job_title}}',
        bodyHtml:
          '<p>Hi {{candidate_name}},</p><p>Thank you for your interest in {{job_title}}. We will not be moving forward at this time.</p><p>Kind regards,<br/>The Vaivamm Capital Hiring Team</p>',
        bodyText:
          'Hi {{candidate_name}},\n\nThank you for your interest in {{job_title}}. We will not be moving forward at this time.\n\nThe Vaivamm Capital Hiring Team',
      },
      {
        organizationId: orgRow.id,
        templateKey: 'interview_invite',
        name: 'Interview invitation',
        subject: 'Interview — {{job_title}}',
        bodyHtml:
          '<p>Hi {{candidate_name}},</p><p>We would like to invite you for an interview for {{job_title}}.</p><p>{{scheduling_note}}</p><p>The Vaivamm Capital Hiring Team</p>',
        bodyText:
          'Hi {{candidate_name}},\n\nWe would like to invite you for an interview for {{job_title}}.\n\n{{scheduling_note}}\n\nThe Vaivamm Capital Hiring Team',
      },
      {
        organizationId: orgRow.id,
        templateKey: 'offer',
        name: 'Offer letter email',
        subject: 'Offer — {{job_title}}',
        bodyHtml:
          '<p>Hi {{candidate_name}},</p><p>We are pleased to extend an offer for {{job_title}}. Details will follow separately.</p><p>The Vaivamm Capital Hiring Team</p>',
        bodyText:
          'Hi {{candidate_name}},\n\nWe are pleased to extend an offer for {{job_title}}. Details will follow separately.\n\nThe Vaivamm Capital Hiring Team',
      },
    ])
    .onConflictDoNothing();

  // 1. A user record so foreign keys for createdBy resolve.
  const [hr] = await db
    .insert(users)
    .values({
      email: 'hr.seed@vaivammcapital.com',
      name: 'Seed HR',
      role: 'recruiter',
      organizationId: orgRow.id,
    })
    .onConflictDoNothing()
    .returning();
  const hrId = hr?.id ?? (await db.select().from(users).limit(1))[0]?.id;
  if (!hrId) throw new Error('Failed to seed user');

  // 2. Approved comp band so offer drafts are unblocked.
  await db
    .insert(compBands)
    .values({
      roleFamily: 'wealth_advisory',
      level: 'l3',
      location: 'hyderabad',
      fixedMin: 1_800_000,
      fixedMax: 2_400_000,
      variablePct: 20,
      esopsInr: 0,
      approved: true,
      approvedBy: hrId,
    })
    .onConflictDoNothing();

  // 3. A published job.
  const slug = slugify('Senior Relationship Manager · Hyderabad');
  const [job] = await db
    .insert(jobs)
    .values({
      organizationId: orgRow.id,
      slug,
      title: 'Senior Relationship Manager',
      department: 'Wealth Advisory',
      level: 'l3',
      location: 'hyderabad',
      type: 'full_time',
      status: 'open',
      jdMarkdown: `## About Vaivamm Capital

We manage wealth for HNIs and family offices across India and the GCC.

## About the role

Own a book of HNI relationships in Hyderabad. Build trust, deepen wallet share,
and partner with the investment team to deliver high-conviction portfolios.

## What you'll do

- Manage 60–80 HNI relationships with combined AUM of ₹250–500cr.
- Run quarterly portfolio reviews; collaborate with investment team on rebalancing.
- Source new clients via referrals and curated events.
- Maintain a clean compliance record — every interaction logged in CRM.

## What we're looking for

- 5–9 years in private banking / wealth management at a credible firm.
- CFA, CFP, or NISM XV preferred.
- Hyderabad-based or willing to relocate.
- Strong written + spoken English; Telugu/Hindi a plus.

## Compensation

Fixed CTC ₹18–24L + 20% variable, reviewed yearly.`,
      screeningQuestions: [
        { prompt: 'How many years of HNI/PB experience do you have?', type: 'short_text', required: true },
        { prompt: 'Are you Hyderabad-based or willing to relocate?', type: 'yes_no', required: true },
      ],
      hardFilters: { minYearsExperience: 5, location: 'hyderabad' },
      autoShortlistThreshold: 75,
      shareLinks: buildShareLinks(slug, 'Senior Relationship Manager'),
      createdBy: hrId,
    })
    .onConflictDoNothing()
    .returning();

  // 4. Sample candidate + application so kanban isn't empty.
  if (job) {
    const [cand] = await db
      .insert(candidates)
      .values({
        name: 'Priya Reddy',
        email: 'priya.reddy.seed@example.com',
        phone: '+919999912345',
        resumeS3Key: 'seed/sample-resume.pdf',
        consentDpdp: true,
        consentTraining: true,
      })
      .onConflictDoNothing()
      .returning();

    if (cand) {
      await db
        .insert(applications)
        .values({
          jobId: job.id,
          candidateId: cand.id,
          stage: 'ai_screened',
          questionnaireAnswers: {} as never,
        })
        .onConflictDoNothing();
    }
  }

  console.log('✓ Seed complete.');
  console.log('');
  console.log('  Staff login — open /admin/login (requires AUTH_DEV_SECRET in env):');
  console.log('    Email:       admin@vaivammhire.local');
  console.log('    Dev secret:  same value as AUTH_DEV_SECRET (see .env.example)');
  console.log('    Name:        Vaivamm Admin');
  console.log('    Role:        admin');
  console.log('');
  console.log('  Also seeded: hr.seed@vaivammcapital.com (recruiter), comp band, job, sample application.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
