CREATE TYPE "public"."call_status" AS ENUM('pending', 'calling', 'completed', 'failed', 'no_answer');--> statement-breakpoint
CREATE TYPE "public"."company_size" AS ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+');--> statement-breakpoint
CREATE TYPE "public"."intent" AS ENUM('hot', 'warm', 'cold');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"company" varchar(255) NOT NULL,
	"role" varchar(100),
	"company_size" "company_size",
	"initial_request" text NOT NULL,
	"call_id" varchar(255),
	"call_status" "call_status" DEFAULT 'pending' NOT NULL,
	"call_duration" integer,
	"call_started_at" timestamp with time zone,
	"call_ended_at" timestamp with time zone,
	"motivation" text,
	"timeline" varchar(100),
	"budget" varchar(100),
	"authority" varchar(100),
	"past_experience" text,
	"intent" "intent",
	"qualification_score" real,
	"transcript" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_call_status_idx" ON "leads" USING btree ("call_status");--> statement-breakpoint
CREATE INDEX "leads_intent_idx" ON "leads" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_deleted_at_idx" ON "leads" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "leads_qualification_score_idx" ON "leads" USING btree ("qualification_score");