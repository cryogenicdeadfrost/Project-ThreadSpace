CREATE TYPE "public"."card_node_visibility" AS ENUM('public', 'friends_only', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."node_type" AS ENUM('person', 'show', 'character', 'trait', 'concept', 'community', 'derived');--> statement-breakpoint
CREATE TYPE "public"."source_of_truth" AS ENUM('user_explicit', 'system_inferred', 'admin');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private', 'friends_only');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"processed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_clusters" (
	"card_id" uuid PRIMARY KEY NOT NULL,
	"cluster_id" integer NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"visibility" "card_node_visibility" DEFAULT 'public' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_card_id" uuid NOT NULL,
	"clue_node_ids" uuid[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cluster_centroids" (
	"cluster_id" integer PRIMARY KEY NOT NULL,
	"centroid_vector" real[],
	"size" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"edge_type" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"source_of_truth" "source_of_truth" DEFAULT 'user_explicit' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_cooccurrence" (
	"node_a" uuid NOT NULL,
	"node_b" uuid NOT NULL,
	"co_count" integer DEFAULT 0 NOT NULL,
	"total_cards_seen" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_cooccurrence_node_a_node_b_pk" PRIMARY KEY("node_a","node_b")
);
--> statement-breakpoint
CREATE TABLE "node_index" (
	"node_id" uuid PRIMARY KEY NOT NULL,
	"index" integer NOT NULL,
	CONSTRAINT "node_index_index_unique" UNIQUE("index")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "node_type" NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"metadata" jsonb,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "search_terms" (
	"node_id" uuid NOT NULL,
	"term" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tfidf_vectors" (
	"card_id" uuid PRIMARY KEY NOT NULL,
	"vector" real[],
	"vector_norm" real,
	"computed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_clusters" ADD CONSTRAINT "card_clusters_card_id_identity_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."identity_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_nodes" ADD CONSTRAINT "card_nodes_card_id_identity_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."identity_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_nodes" ADD CONSTRAINT "card_nodes_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_links" ADD CONSTRAINT "challenge_links_creator_card_id_identity_cards_id_fk" FOREIGN KEY ("creator_card_id") REFERENCES "public"."identity_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_id_nodes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_target_id_nodes_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_cards" ADD CONSTRAINT "identity_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_cooccurrence" ADD CONSTRAINT "node_cooccurrence_node_a_nodes_id_fk" FOREIGN KEY ("node_a") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_cooccurrence" ADD CONSTRAINT "node_cooccurrence_node_b_nodes_id_fk" FOREIGN KEY ("node_b") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_index" ADD CONSTRAINT "node_index_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_terms" ADD CONSTRAINT "search_terms_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tfidf_vectors" ADD CONSTRAINT "tfidf_vectors_card_id_identity_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."identity_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_nodes_card_node_idx" ON "card_nodes" USING btree ("card_id","node_id");--> statement-breakpoint
CREATE INDEX "card_nodes_node_card_idx" ON "card_nodes" USING btree ("node_id","card_id");--> statement-breakpoint
CREATE INDEX "edges_source_type_idx" ON "edges" USING btree ("source_id","edge_type");--> statement-breakpoint
CREATE INDEX "edges_target_type_idx" ON "edges" USING btree ("target_id","edge_type");--> statement-breakpoint
CREATE INDEX "edges_confidence_idx" ON "edges" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "edges_source_target_idx" ON "edges" USING btree ("source_id","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_cards_user_id_unique" ON "identity_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nodes_type_idx" ON "nodes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "nodes_slug_idx" ON "nodes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "search_terms_node_idx" ON "search_terms" USING btree ("node_id");