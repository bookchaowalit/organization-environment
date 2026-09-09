ALTER TABLE "decisions" DROP CONSTRAINT "decisions_state";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_state";--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "actor_id" text GENERATED ALWAYS AS (data->>'actorId') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "meeting_id" text GENERATED ALWAYS AS (data->'source'->>'id') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "state" text GENERATED ALWAYS AS (data->>'status') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "source_id" text GENERATED ALWAYS AS (data->>'sourceId') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "owner_id" text GENERATED ALWAYS AS (data->>'ownerId') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "decision_id" text GENERATED ALWAYS AS (data->>'decisionId') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "state" text GENERATED ALWAYS AS (data->>'status') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "owner_id" text GENERATED ALWAYS AS (data->>'ownerId') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_tenant_id_actor_id_actors_tenant_id_id_fk" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "public"."actors"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_tenant_id_meeting_id_meetings_tenant_id_id_fk" FOREIGN KEY ("tenant_id","meeting_id") REFERENCES "public"."meetings"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_tenant_id_source_id_source_entities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."source_entities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_owner_id_actors_tenant_id_id_fk" FOREIGN KEY ("tenant_id","owner_id") REFERENCES "public"."actors"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_decision_id_decisions_tenant_id_id_fk" FOREIGN KEY ("tenant_id","decision_id") REFERENCES "public"."decisions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_tenant_id_owner_id_actors_tenant_id_id_fk" FOREIGN KEY ("tenant_id","owner_id") REFERENCES "public"."actors"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_state" CHECK ("decisions"."state" IN ('proposed', 'approved_for_sync', 'synced'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_state" CHECK ("tasks"."state" IN ('proposed', 'approved_for_sync', 'synced'));