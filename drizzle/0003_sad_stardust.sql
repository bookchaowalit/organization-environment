CREATE TABLE "office_invites" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "office_members" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "office_members_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "office_username" UNIQUE("tenant_id","username"),
	CONSTRAINT "office_role" CHECK ("office_members"."role" IN ('owner','member'))
);
--> statement-breakpoint
CREATE TABLE "office_messages" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text NOT NULL,
	"room_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "office_messages_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "office_presence" (
	"tenant_id" text NOT NULL,
	"member_id" text NOT NULL,
	"room_id" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "office_presence_tenant_id_member_id_pk" PRIMARY KEY("tenant_id","member_id"),
	CONSTRAINT "presence_coordinates" CHECK ("office_presence"."x" BETWEEN 5 AND 95 AND "office_presence"."y" BETWEEN 5 AND 95),
	CONSTRAINT "presence_status" CHECK ("office_presence"."status" IN ('available','focus','away'))
);
--> statement-breakpoint
CREATE TABLE "office_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"member_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "office_invites" ADD CONSTRAINT "office_invites_tenant_id_organizations_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_members" ADD CONSTRAINT "office_members_tenant_id_organizations_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_messages" ADD CONSTRAINT "office_messages_tenant_id_member_id_office_members_tenant_id_id_fk" FOREIGN KEY ("tenant_id","member_id") REFERENCES "public"."office_members"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_messages" ADD CONSTRAINT "office_messages_tenant_id_room_id_rooms_tenant_id_id_fk" FOREIGN KEY ("tenant_id","room_id") REFERENCES "public"."rooms"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_presence" ADD CONSTRAINT "office_presence_tenant_id_member_id_office_members_tenant_id_id_fk" FOREIGN KEY ("tenant_id","member_id") REFERENCES "public"."office_members"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_presence" ADD CONSTRAINT "office_presence_tenant_id_room_id_rooms_tenant_id_id_fk" FOREIGN KEY ("tenant_id","room_id") REFERENCES "public"."rooms"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_sessions" ADD CONSTRAINT "office_sessions_tenant_id_member_id_office_members_tenant_id_id_fk" FOREIGN KEY ("tenant_id","member_id") REFERENCES "public"."office_members"("tenant_id","id") ON DELETE no action ON UPDATE no action;