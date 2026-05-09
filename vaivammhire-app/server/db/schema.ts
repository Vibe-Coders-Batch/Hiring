import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// Enums (PRD §9 + §3)
// ─────────────────────────────────────────────────────────────────────────────

export const userRole = pgEnum('user_role', [
  'admin',
  'recruiter',
  'hiring_manager',
  'interviewer',
  'ml_engineer',
]);

export const jobStatus = pgEnum('job_status', ['draft', 'open', 'paused', 'closed']);
export const jobType = pgEnum('job_type', ['full_time', 'contract', 'intern']);
export const agentAutonomy = pgEnum('agent_autonomy', [
  'suggest_only',
  'auto_low_stakes',
  'full_except_offers',
]);

export const applicationStage = pgEnum('application_stage', [
  'applied',
  'ai_screened',
  'hr_review',
  'shortlisted',
  'interview_1',
  'assignment',
  'interview_2',
  'interview_3',
  'reference_check',
  'offer',
  'hired',
  'rejected',
  'on_hold',
]);

export const agentRecommendation = pgEnum('agent_recommendation', [
  'shortlist',
  'review',
  'reject',
]);

export const interviewType = pgEnum('interview_type', [
  'phone',
  'video',
  'onsite',
  'ai_audio',
  'ai_video',
]);
export const interviewStatus = pgEnum('interview_status', [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
]);

export const assessmentType = pgEnum('assessment_type', ['mcq', 'coding', 'case_study']);
export const channel = pgEnum('channel', ['email', 'whatsapp', 'sms', 'linkedin']);
export const direction = pgEnum('direction', ['inbound', 'outbound']);
export const offerStatus = pgEnum('offer_status', [
  'draft',
  'pending_approval',
  'sent',
  'viewed',
  'signed',
  'declined',
  'expired',
]);

export const emailDeliveryStatus = pgEnum('email_delivery_status', [
  'queued',
  'sent',
  'failed',
  'bounced',
]);

export const actorType = pgEnum('actor_type', ['human', 'agent', 'model', 'system']);
export const labelSource = pgEnum('label_source', [
  'hr_override',
  'hr_explicit',
  'hire_outcome',
  'synthetic',
  'public',
]);
export const modelTarget = pgEnum('model_target', ['M1', 'M2', 'M3', 'M4', 'M5']);
export const modelStatus = pgEnum('model_status', ['training', 'staging', 'prod', 'archived']);
export const roleFamily = pgEnum('role_family', [
  'engineering',
  'wealth_advisory',
  'operations',
  'marketing',
  'finance',
  'legal',
  'data_ml',
]);
export const roleLevel = pgEnum('role_level', [
  'intern',
  'l1',
  'l2',
  'l3',
  'l4',
  'lead',
  'manager',
]);
export const compLocation = pgEnum('comp_location', ['hyderabad', 'remote_india', 'uae']);

// ─────────────────────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────────────────────

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(t.slug),
  }),
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    role: userRole('role').notNull().default('recruiter'),
    cognitoSub: varchar('cognito_sub', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    cognitoSubIdx: uniqueIndex('users_cognito_sub_idx').on(t.cognitoSub),
  }),
);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    slug: varchar('slug', { length: 200 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    department: varchar('department', { length: 100 }).notNull(),
    level: roleLevel('level').notNull(),
    location: compLocation('location').notNull(),
    type: jobType('type').notNull().default('full_time'),
    status: jobStatus('status').notNull().default('draft'),
    jdMarkdown: text('jd_markdown').notNull(),
    screeningQuestions: jsonb('screening_questions').notNull().default([]),
    hardFilters: jsonb('hard_filters').notNull().default({}),
    autoShortlistThreshold: integer('auto_shortlist_threshold').notNull().default(75),
    agentAutonomy: agentAutonomy('agent_autonomy').notNull().default('suggest_only'),
    shareLinks: jsonb('share_links').notNull().default({}),
    linkedinPostId: varchar('linkedin_post_id', { length: 100 }),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('jobs_slug_idx').on(t.slug),
  }),
);

export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    linkedin: varchar('linkedin', { length: 500 }),
    resumeS3Key: varchar('resume_s3_key', { length: 500 }).notNull(),
    parsedData: jsonb('parsed_data'),
    consentDpdp: boolean('consent_dpdp').notNull().default(false),
    consentTraining: boolean('consent_training').notNull().default(false),
    dedupKeys: text('dedup_keys').array().notNull().default([]),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('candidates_email_idx').on(t.email),
  }),
);

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id),
  stage: applicationStage('stage').notNull().default('applied'),
  /** Structured answers keyed by screening question index or prompt */
  questionnaireAnswers: jsonb('questionnaire_answers').notNull().default({}),
  scoreCard: jsonb('score_card'),
  agentRecommendation: agentRecommendation('agent_recommendation'),
  hrOverride: jsonb('hr_override'),
  lastActionAt: timestamp('last_action_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const interviews = pgTable('interviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  panelIds: text('panel_ids').array().notNull().default([]),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  type: interviewType('type').notNull(),
  meetLink: varchar('meet_link', { length: 500 }),
  status: interviewStatus('status').notNull().default('scheduled'),
  feedback: jsonb('feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const assessments = pgTable('assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: assessmentType('type').notNull(),
  templateBlob: jsonb('template_blob').notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  assessmentId: uuid('assessment_id').notNull().references(() => assessments.id),
  content: jsonb('content').notNull(),
  score: integer('score'),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const offers = pgTable('offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  draftPdfS3Key: varchar('draft_pdf_s3_key', { length: 500 }),
  approvedBy: uuid('approved_by').references(() => users.id),
  status: offerStatus('status').notNull().default('draft'),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signedPdfS3Key: varchar('signed_pdf_s3_key', { length: 500 }),
  documensoEnvelopeId: varchar('documenso_envelope_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const compBands = pgTable(
  'comp_bands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleFamily: roleFamily('role_family').notNull(),
    level: roleLevel('level').notNull(),
    location: compLocation('location').notNull(),
    fixedMin: integer('fixed_min').notNull(),
    fixedMax: integer('fixed_max').notNull(),
    variablePct: integer('variable_pct').notNull().default(0),
    esopsInr: integer('esops_inr').notNull().default(0),
    approved: boolean('approved').notNull().default(false),
    approvedBy: uuid('approved_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bandIdx: uniqueIndex('comp_bands_unique_idx').on(t.roleFamily, t.level, t.location),
  }),
);

export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    templateKey: varchar('template_key', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgKeyIdx: uniqueIndex('email_templates_org_key_idx').on(t.organizationId, t.templateKey),
  }),
);

export const communications = pgTable('communications', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').references(() => applications.id),
  channel: channel('channel').notNull(),
  direction: direction('direction').notNull(),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  toEmail: varchar('to_email', { length: 320 }),
  templateKey: varchar('template_key', { length: 64 }),
  deliveryStatus: emailDeliveryStatus('delivery_status').notNull().default('sent'),
  providerMessageId: varchar('provider_message_id', { length: 200 }),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  repliedAt: timestamp('replied_at', { withTimezone: true }),
});

// Append-only — no updates, no deletes (PRD §9).
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorType: actorType('actor_type').notNull(),
  actorId: varchar('actor_id', { length: 64 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: varchar('target_id', { length: 64 }).notNull(),
  payload: jsonb('payload'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

// Append-only — every row is a labeled training example (PRD §7.3).
export const trainingLabels = pgTable('training_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelTarget: modelTarget('model_target').notNull(),
  inputRef: jsonb('input_ref').notNull(),
  label: jsonb('label').notNull(),
  source: labelSource('source').notNull(),
  labelerId: uuid('labeler_id').references(() => users.id),
  aiPrediction: jsonb('ai_prediction'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const modelRuns = pgTable('model_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelName: varchar('model_name', { length: 100 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  trainedAt: timestamp('trained_at', { withTimezone: true }).notNull(),
  trainingDataSnapshotId: varchar('training_data_snapshot_id', { length: 100 }),
  hyperparams: jsonb('hyperparams').notNull().default({}),
  evalMetrics: jsonb('eval_metrics').notNull().default({}),
  status: modelStatus('status').notNull().default('training'),
  sageMakerModelArn: varchar('sagemaker_model_arn', { length: 500 }),
  promotedAt: timestamp('promoted_at', { withTimezone: true }),
  promotedBy: uuid('promoted_by').references(() => users.id),
});

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  jobs: many(jobs),
  emailTemplates: many(emailTemplates),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  jobsCreated: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [jobs.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, { fields: [jobs.createdBy], references: [users.id] }),
  applications: many(applications),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailTemplates.organizationId],
    references: [organizations.id],
  }),
}));

export const candidatesRelations = relations(candidates, ({ many }) => ({
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  job: one(jobs, { fields: [applications.jobId], references: [jobs.id] }),
  candidate: one(candidates, { fields: [applications.candidateId], references: [candidates.id] }),
  interviews: many(interviews),
  submissions: many(submissions),
  offer: many(offers),
  communications: many(communications),
}));

export const interviewsRelations = relations(interviews, ({ one }) => ({
  application: one(applications, {
    fields: [interviews.applicationId],
    references: [applications.id],
  }),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  application: one(applications, {
    fields: [offers.applicationId],
    references: [applications.id],
  }),
  approver: one(users, { fields: [offers.approvedBy], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Interview = typeof interviews.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type CompBand = typeof compBands.$inferSelect;
export type Communication = typeof communications.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type TrainingLabel = typeof trainingLabels.$inferSelect;
export type ModelRun = typeof modelRuns.$inferSelect;
