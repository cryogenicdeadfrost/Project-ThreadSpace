import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────
export const nodeTypeEnum = pgEnum("node_type", [
  "person",
  "show",
  "character",
  "trait",
  "concept",
  "community",
  "derived",
]);

export const visibilityEnum = pgEnum("visibility", [
  "public",
  "private",
  "friends_only",
]);

export const cardNodeVisibilityEnum = pgEnum("card_node_visibility", [
  "public",
  "friends_only",
  "hidden",
]);

export const sourceOfTruthEnum = pgEnum("source_of_truth", [
  "user_explicit",
  "system_inferred",
  "admin",
]);

// ── Users (Better Auth managed) ──────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Sessions (Better Auth managed) ───────────────────────────────
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Accounts (Better Auth managed — OAuth providers) ─────────────
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Verifications (Better Auth managed — magic links, email) ─────
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Identity Cards ───────────────────────────────────────────────
export const identityCards = pgTable(
  "identity_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    visibility: visibilityEnum("visibility").default("private").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("identity_cards_user_id_unique").on(table.userId),
  ]
);

// ── Nodes (Universal node store) ─────────────────────────────────
export const nodes = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: nodeTypeEnum("type").notNull(),
    slug: text("slug").notNull().unique(),
    displayName: text("display_name").notNull(),
    metadata: jsonb("metadata"),
    visibility: visibilityEnum("visibility").default("public").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("nodes_type_idx").on(table.type),
    index("nodes_slug_idx").on(table.slug),
  ]
);

// ── Edges (Universal edge store) ─────────────────────────────────
export const edges = pgTable(
  "edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    edgeType: text("edge_type").notNull(), // likes, has_trait, similar_to, belongs_to, inferred_affinity
    weight: real("weight").default(1.0).notNull(),
    confidence: real("confidence").default(1.0).notNull(),
    sourceOfTruth: sourceOfTruthEnum("source_of_truth").default("user_explicit").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("edges_source_type_idx").on(table.sourceId, table.edgeType),
    index("edges_target_type_idx").on(table.targetId, table.edgeType),
    index("edges_confidence_idx").on(table.confidence),
    index("edges_source_target_idx").on(table.sourceId, table.targetId),
  ]
);

// ── Card Nodes (Junction: card ↔ node) ───────────────────────────
export const cardNodes = pgTable(
  "card_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => identityCards.id, { onDelete: "cascade" }),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    visibility: cardNodeVisibilityEnum("visibility").default("public").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("card_nodes_card_node_idx").on(table.cardId, table.nodeId),
    index("card_nodes_node_card_idx").on(table.nodeId, table.cardId),
  ]
);

// ── TF-IDF Vectors ───────────────────────────────────────────────
export const tfidfVectors = pgTable("tfidf_vectors", {
  cardId: uuid("card_id")
    .primaryKey()
    .references(() => identityCards.id, { onDelete: "cascade" }),
  vector: real("vector").array(),
  vectorNorm: real("vector_norm"),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow(),
});

// ── Node Co-occurrence ───────────────────────────────────────────
export const nodeCooccurrence = pgTable(
  "node_cooccurrence",
  {
    nodeA: uuid("node_a")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    nodeB: uuid("node_b")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    coCount: integer("co_count").default(0).notNull(),
    totalCardsSeen: integer("total_cards_seen").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.nodeA, table.nodeB] }),
  ]
);

// ── Audit Events ─────────────────────────────────────────────────
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload"),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Search Terms ─────────────────────────────────────────────────
export const searchTerms = pgTable(
  "search_terms",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    weight: real("weight").default(1.0).notNull(),
  },
  (table) => [
    index("search_terms_node_idx").on(table.nodeId),
  ]
);

// ── Node Index (stable dimension mapping for vectors) ────────────
export const nodeIndex = pgTable("node_index", {
  nodeId: uuid("node_id")
    .primaryKey()
    .references(() => nodes.id, { onDelete: "cascade" }),
  index: integer("index").notNull().unique(),
});

// ── Challenge Links ──────────────────────────────────────────────
export const challengeLinks = pgTable("challenge_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorCardId: uuid("creator_card_id")
    .notNull()
    .references(() => identityCards.id, { onDelete: "cascade" }),
  clueNodeIds: uuid("clue_node_ids").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Card Clusters (k-means assignments) ──────────────────────────
export const cardClusters = pgTable("card_clusters", {
  cardId: uuid("card_id")
    .primaryKey()
    .references(() => identityCards.id, { onDelete: "cascade" }),
  clusterId: integer("cluster_id").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Cluster Centroids ────────────────────────────────────────────
export const clusterCentroids = pgTable("cluster_centroids", {
  clusterId: integer("cluster_id").primaryKey(),
  centroidVector: real("centroid_vector").array(),
  size: integer("size").default(0).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});
