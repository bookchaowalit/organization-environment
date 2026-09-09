CREATE TABLE "activity_events" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "activity_events_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "activity_events_identity" CHECK ("activity_events"."data"->>'id' = "activity_events"."id")
);
--> statement-breakpoint
CREATE TABLE "actors" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "actors_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "actors_identity" CHECK ("actors"."data"->>'id' = "actors"."id")
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"tenant_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_id" text NOT NULL,
	"excerpt" text NOT NULL,
	CONSTRAINT "citations_tenant_id_entity_id_source_id_pk" PRIMARY KEY("tenant_id","entity_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "decisions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "decisions_identity" CHECK ("decisions"."data"->>'id' = "decisions"."id")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	CONSTRAINT "entities_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "entity_links_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "link_identity" CHECK ("entity_links"."data"->>'id' = "entity_links"."id" AND "entity_links"."data"->>'from' = "entity_links"."from_id" AND "entity_links"."data"->>'to' = "entity_links"."to_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "meetings_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "meetings_identity" CHECK ("meetings"."data"->>'id' = "meetings"."id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "organization_identity" CHECK ("organizations"."data"->>'id' = "organizations"."tenant_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "rooms_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "rooms_identity" CHECK ("rooms"."data"->>'id' = "rooms"."id")
);
--> statement-breakpoint
CREATE TABLE "source_entities" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "source_entities_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "source_identity" UNIQUE("tenant_id","provider","external_id"),
	CONSTRAINT "source_data_identity" CHECK ("source_entities"."data"->>'id' = "source_entities"."id" AND "source_entities"."data"->>'provider' = "source_entities"."provider" AND "source_entities"."data"->>'externalId' = "source_entities"."external_id")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "sync_runs_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "sync_delivery_identity" UNIQUE("tenant_id","provider","event_id"),
	CONSTRAINT "sync_identity" CHECK ("sync_runs"."data"->>'id' = "sync_runs"."id" AND "sync_runs"."data"->>'provider' = "sync_runs"."provider" AND "sync_runs"."data"->>'eventId' = "sync_runs"."event_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "tasks_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "tasks_identity" CHECK ("tasks"."data"->>'id' = "tasks"."id")
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "work_items_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "work_items_identity" CHECK ("work_items"."data"->>'id' = "work_items"."id")
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_tenant_id_entity_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","entity_id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_tenant_id_source_id_source_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."source_entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_tenant_id_organizations_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_tenant_id_from_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","from_id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_tenant_id_to_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","to_id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_entities" ADD CONSTRAINT "source_entities_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_tenant_id_organizations_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_tenant_id_id_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","id") REFERENCES "public"."entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;