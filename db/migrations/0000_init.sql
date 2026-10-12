CREATE TABLE "admin_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	CONSTRAINT "admin_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin_user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"event" text NOT NULL,
	"key" text DEFAULT '' NOT NULL,
	"origin" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_day_event_key_origin_pk" PRIMARY KEY("day","event","key","origin")
);
--> statement-breakpoint
ALTER TABLE "analytics_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "announcement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"link" text,
	"edition_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "competition" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "competition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"edition_id" integer NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"edition_id" integer,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"file_url" text,
	"revised_at" timestamp with time zone,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "edition" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "edition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"year" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"end_date" date,
	"venue_id" integer,
	"hero_media_id" integer,
	"registration_open_at" timestamp with time zone,
	"registration_close_at" timestamp with time zone,
	"rules_url" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	CONSTRAINT "edition_year_unique" UNIQUE("year")
);
--> statement-breakpoint
ALTER TABLE "edition" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "field" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "field_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "field" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stage_group" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stage_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stage_id" integer NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stage_group" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "honour" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "honour_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"edition_id" integer NOT NULL,
	"competition_type" text NOT NULL,
	"winner_team_id" integer,
	"winner_name" text,
	"runner_up_team_id" integer,
	"runner_up_name" text,
	"top_scorer_name" text,
	"top_scorer_goals" integer,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "honour" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "login_token" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "login_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "match_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"type" text NOT NULL,
	"minute" integer,
	"roster_entry_id" integer,
	"team_entry_id" integer NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "match" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"edition_id" integer NOT NULL,
	"competition_id" integer NOT NULL,
	"stage_id" integer NOT NULL,
	"group_id" integer,
	"round" integer,
	"slot" integer,
	"home_entry_id" integer,
	"away_entry_id" integer,
	"home_source" jsonb,
	"away_source" jsonb,
	"kickoff_at" timestamp with time zone,
	"field_id" integer,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_pens" integer,
	"away_pens" integer,
	"decided_by" text,
	"note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"storage_key" text,
	"url" text,
	"mime" text,
	"width" integer,
	"height" integer,
	"variants" jsonb,
	"alt" text,
	"caption" text,
	"credit" text,
	"edition_id" integer,
	"match_id" integer,
	"consent_publish" boolean DEFAULT false NOT NULL,
	"contains_minors" boolean DEFAULT false NOT NULL,
	"uploaded_by" integer,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "person" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"is_minor" boolean DEFAULT false NOT NULL,
	"publish_name_mode" text DEFAULT 'full' NOT NULL,
	"consent_status" text DEFAULT 'pending' NOT NULL,
	"consent_recorded_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "registration" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "registration_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"edition_id" integer NOT NULL,
	"team_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text NOT NULL,
	"players_count" integer,
	"kit_color" text,
	"has_minors" boolean DEFAULT false NOT NULL,
	"notes" text,
	"consent_privacy_at" timestamp with time zone NOT NULL,
	"consent_rules_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"internal_notes" text,
	"team_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "removal_request" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "removal_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"subject" text NOT NULL,
	"reference" text NOT NULL,
	"requester_role" text,
	"contact_email" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "removal_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roster_entry" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roster_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_entry_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"shirt_number" integer,
	"role" text,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roster_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_setting" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_setting" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sponsor_edition" (
	"sponsor_id" integer NOT NULL,
	"edition_id" integer NOT NULL,
	CONSTRAINT "sponsor_edition_sponsor_id_edition_id_pk" PRIMARY KEY("sponsor_id","edition_id")
);
--> statement-breakpoint
ALTER TABLE "sponsor_edition" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sponsor" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sponsor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"logo_media_id" integer,
	"url" text,
	"tier" text DEFAULT 'standard' NOT NULL,
	"visible_from" date,
	"visible_to" date,
	"order" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"competition_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_entry" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"edition_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"group_id" integer,
	"seed" integer,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_code" text NOT NULL,
	"crest_media_id" integer,
	"kit_color" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	CONSTRAINT "team_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "team" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tiebreak_decision" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tiebreak_decision_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"group_id" integer NOT NULL,
	"entry_order" jsonb NOT NULL,
	"note" text,
	"decided_by" integer,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tiebreak_decision_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
ALTER TABLE "tiebreak_decision" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "venue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "venue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"maps_url" text,
	"source" text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_user_id_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_admin_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition" ADD CONSTRAINT "edition_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition" ADD CONSTRAINT "edition_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field" ADD CONSTRAINT "field_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_group" ADD CONSTRAINT "stage_group_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honour" ADD CONSTRAINT "honour_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honour" ADD CONSTRAINT "honour_winner_team_id_team_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honour" ADD CONSTRAINT "honour_runner_up_team_id_team_id_fk" FOREIGN KEY ("runner_up_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_token" ADD CONSTRAINT "login_token_user_id_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_roster_entry_id_roster_entry_id_fk" FOREIGN KEY ("roster_entry_id") REFERENCES "public"."roster_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_team_entry_id_team_entry_id_fk" FOREIGN KEY ("team_entry_id") REFERENCES "public"."team_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_group_id_stage_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."stage_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_home_entry_id_team_entry_id_fk" FOREIGN KEY ("home_entry_id") REFERENCES "public"."team_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_away_entry_id_team_entry_id_fk" FOREIGN KEY ("away_entry_id") REFERENCES "public"."team_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_field_id_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_updated_by_admin_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_admin_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_approved_by_admin_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entry" ADD CONSTRAINT "roster_entry_team_entry_id_team_entry_id_fk" FOREIGN KEY ("team_entry_id") REFERENCES "public"."team_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entry" ADD CONSTRAINT "roster_entry_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_edition" ADD CONSTRAINT "sponsor_edition_sponsor_id_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_edition" ADD CONSTRAINT "sponsor_edition_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor" ADD CONSTRAINT "sponsor_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entry" ADD CONSTRAINT "team_entry_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entry" ADD CONSTRAINT "team_entry_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entry" ADD CONSTRAINT "team_entry_group_id_stage_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."stage_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_crest_media_id_media_id_fk" FOREIGN KEY ("crest_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiebreak_decision" ADD CONSTRAINT "tiebreak_decision_group_id_stage_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."stage_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiebreak_decision" ADD CONSTRAINT "tiebreak_decision_decided_by_admin_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_edition_slug" ON "competition" USING btree ("edition_id","slug");--> statement-breakpoint
CREATE INDEX "document_slug" ON "document" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "honour_edition_type" ON "honour" USING btree ("edition_id","competition_type");--> statement-breakpoint
CREATE INDEX "match_event_match" ON "match_event" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_edition" ON "match" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "match_kickoff" ON "match" USING btree ("kickoff_at");--> statement-breakpoint
CREATE INDEX "media_edition" ON "media" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "roster_entry_team_entry" ON "roster_entry" USING btree ("team_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_entry_edition_team" ON "team_entry" USING btree ("edition_id","team_id");