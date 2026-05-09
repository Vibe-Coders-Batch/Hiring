CREATE TYPE "public"."actor_type" AS ENUM('human', 'agent', 'model', 'system');--> statement-breakpoint
CREATE TYPE "public"."agent_autonomy" AS ENUM('suggest_only', 'auto_low_stakes', 'full_except_offers');--> statement-breakpoint
CREATE TYPE "public"."agent_recommendation" AS ENUM('shortlist', 'review', 'reject');--> statement-breakpoint
CREATE TYPE "public"."application_stage" AS ENUM('applied', 'ai_screened', 'hr_review', 'shortlisted', 'interview_1', 'assignment', 'interview_2', 'interview_3', 'reference_check', 'offer', 'hired', 'rejected', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."assessment_type" AS ENUM('mcq', 'coding', 'case_study');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'whatsapp', 'sms', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."comp_location" AS ENUM('hyderabad', 'remote_india', 'uae');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."email_delivery_status" AS ENUM('queued', 'sent', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."interview_type" AS ENUM('phone', 'video', 'onsite', 'ai_audio', 'ai_video');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'open', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('full_time', 'contract', 'intern');--> statement-breakpoint
CREATE TYPE "public"."label_source" AS ENUM('hr_override', 'hr_explicit', 'hire_outcome', 'synthetic', 'public');--> statement-breakpoint
CREATE TYPE "public"."model_status" AS ENUM('training', 'staging', 'prod', 'archived');--> statement-breakpoint
CREATE TYPE "public"."model_target" AS ENUM('M1', 'M2', 'M3', 'M4', 'M5');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('draft', 'pending_approval', 'sent', 'viewed', 'signed', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."role_family" AS ENUM('engineering', 'wealth_advisory', 'operations', 'marketing', 'finance', 'legal', 'data_ml');--> statement-breakpoint
CREATE TYPE "public"."role_level" AS ENUM('intern', 'l1', 'l2', 'l3', 'l4', 'lead', 'manager');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'recruiter', 'hiring_manager', 'interviewer', 'ml_engineer');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"stage" "application_stage" DEFAULT 'applied' NOT NULL,
	"questionnaire_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_card" jsonb,
	"agent_recommendation" "agent_recommendation",
	"hr_override" jsonb,
	"last_action_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "assessment_type" NOT NULL,
	"template_blob" jsonb NOT NULL,
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" varchar(64) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(32),
	"linkedin" varchar(500),
	"resume_s3_key" varchar(500) NOT NULL,
	"parsed_data" jsonb,
	"consent_dpdp" boolean DEFAULT false NOT NULL,
	"consent_training" boolean DEFAULT false NOT NULL,
	"dedup_keys" text[] DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"channel" "channel" NOT NULL,
	"direction" "direction" NOT NULL,
	"subject" varchar(500),
	"body" text NOT NULL,
	"to_email" varchar(320),
	"template_key" varchar(64),
	"delivery_status" "email_delivery_status" DEFAULT 'sent' NOT NULL,
	"provider_message_id" varchar(200),
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"replied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comp_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_family" "role_family" NOT NULL,
	"level" "role_level" NOT NULL,
	"location" "comp_location" NOT NULL,
	"fixed_min" integer NOT NULL,
	"fixed_max" integer NOT NULL,
	"variable_pct" integer DEFAULT 0 NOT NULL,
	"esops_inr" integer DEFAULT 0 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"template_key" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"panel_ids" text[] DEFAULT '{}' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"type" "interview_type" NOT NULL,
	"meet_link" varchar(500),
	"status" "interview_status" DEFAULT 'scheduled' NOT NULL,
	"feedback" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"slug" varchar(200) NOT NULL,
	"title" varchar(200) NOT NULL,
	"department" varchar(100) NOT NULL,
	"level" "role_level" NOT NULL,
	"location" "comp_location" NOT NULL,
	"type" "job_type" DEFAULT 'full_time' NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"jd_markdown" text NOT NULL,
	"screening_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hard_filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"auto_shortlist_threshold" integer DEFAULT 75 NOT NULL,
	"agent_autonomy" "agent_autonomy" DEFAULT 'suggest_only' NOT NULL,
	"share_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"linkedin_post_id" varchar(100),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"version" varchar(50) NOT NULL,
	"trained_at" timestamp with time zone NOT NULL,
	"training_data_snapshot_id" varchar(100),
	"hyperparams" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"eval_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "model_status" DEFAULT 'training' NOT NULL,
	"sagemaker_model_arn" varchar(500),
	"promoted_at" timestamp with time zone,
	"promoted_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"draft_pdf_s3_key" varchar(500),
	"approved_by" uuid,
	"status" "offer_status" DEFAULT 'draft' NOT NULL,
	"signed_at" timestamp with time zone,
	"signed_pdf_s3_key" varchar(500),
	"documenso_envelope_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"score" integer,
	"graded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_target" "model_target" NOT NULL,
	"input_ref" jsonb NOT NULL,
	"label" jsonb NOT NULL,
	"source" "label_source" NOT NULL,
	"labeler_id" uuid,
	"ai_prediction" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" varchar(320) NOT NULL,
	"name" varchar(200) NOT NULL,
	"role" "user_role" DEFAULT 'recruiter' NOT NULL,
	"cognito_sub" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communications" ADD CONSTRAINT "communications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comp_bands" ADD CONSTRAINT "comp_bands_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_promoted_by_users_id_fk" FOREIGN KEY ("promoted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offers" ADD CONSTRAINT "offers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_labels" ADD CONSTRAINT "training_labels_labeler_id_users_id_fk" FOREIGN KEY ("labeler_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_email_idx" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "comp_bands_unique_idx" ON "comp_bands" USING btree ("role_family","level","location");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_org_key_idx" ON "email_templates" USING btree ("organization_id","template_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_slug_idx" ON "jobs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_cognito_sub_idx" ON "users" USING btree ("cognito_sub");