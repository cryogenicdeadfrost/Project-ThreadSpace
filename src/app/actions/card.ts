"use server";

import { db } from "@/lib/db";
import {
  identityCards,
  nodes,
  cardNodes,
  edges,
  users,
} from "@/lib/schema";
import { slugify } from "@/lib/slugify";
import { eq, and, inArray, notInArray, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Mapping of character slugs to show slugs for automatic edge creation
const CHARACTER_TO_SHOW: Record<string, string> = {
  "jim-halpert": "the-office",
  "michael-scott": "the-office",
  "leslie-knope": "parks-rec",
  "walter-white": "breaking-bad",
  "chandler-bing": "friends",
  "eleven": "stranger-things",
  "ben-tennyson": "ben-10",
  "aang": "avatar-tla",
  "zuko": "avatar-tla",
  "naruto-uzumaki": "naruto",
  "monkey-d-luffy": "one-piece",
  "levi-ackerman": "attack-on-titan",
  "jake-peralta": "brooklyn-nine-nine",
  "harvey-specter": "suits",
  "ted-mosby": "how-i-met-your-mother",
  "eleanor-shellstrop": "the-good-place",
};

/**
 * Gets the current authenticated session
 */
export async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * Get the current user's identity card or create a blank one if it doesn't exist.
 */
export async function getOrCreateCard() {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;

  // 1. Check if card exists
  const existingCards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.userId, userId))
    .limit(1);

  let card = existingCards[0];

  // 2. If it does not exist, create a blank card
  if (!card) {
    const defaultName = session.user.name || session.user.email.split("@")[0];
    const inserted = await db
      .insert(identityCards)
      .values({
        userId,
        displayName: defaultName,
        bio: "",
        visibility: "private",
        version: 1,
      })
      .returning();
    card = inserted[0];
  }

  // 3. Fetch nodes associated with this card
  const associatedNodes = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      slug: nodes.slug,
      displayName: nodes.displayName,
    })
    .from(cardNodes)
    .innerJoin(nodes, eq(cardNodes.nodeId, nodes.id))
    .where(eq(cardNodes.cardId, card.id));

  // Separate nodes by type for the client
  const shows = associatedNodes
    .filter((n) => n.type === "show")
    .map((n) => n.displayName);
  const characters = associatedNodes
    .filter((n) => n.type === "character")
    .map((n) => n.displayName);
  const traits = associatedNodes
    .filter((n) => n.type === "trait")
    .map((n) => n.displayName);

  return {
    card,
    shows,
    characters,
    traits,
  };
}

/**
 * Update the profile information (display name and bio)
 */
export async function updateCardProfile(displayName: string, bio: string) {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const existingCards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.userId, session.user.id))
    .limit(1);

  if (existingCards.length === 0) {
    throw new Error("Identity card not found");
  }

  const card = existingCards[0];

  await db
    .update(identityCards)
    .set({
      displayName,
      bio,
      version: card.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(identityCards.id, card.id));

  return { success: true };
}

/**
 * Save all nodes associated with a card. Dedups nodes, creates links,
 * and creates character->show edges when both are selected.
 */
export async function saveCardNodes(
  shows: string[],
  characters: string[],
  traits: string[]
) {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  // Get the user's card
  const existingCards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.userId, session.user.id))
    .limit(1);

  if (existingCards.length === 0) {
    throw new Error("Identity card not found");
  }

  const card = existingCards[0];
  const cardId = card.id;

  const allItems = [
    ...shows.map((s) => ({ name: s, type: "show" as const })),
    ...characters.map((c) => ({ name: c, type: "character" as const })),
    ...traits.map((t) => ({ name: t, type: "trait" as const })),
  ];

  const itemsWithSlugs = allItems
    .map((item) => ({
      ...item,
      slug: slugify(item.name),
    }))
    .filter((item) => item.slug !== "");

  const uniqueSlugs = Array.from(new Set(itemsWithSlugs.map((i) => i.slug)));

  if (uniqueSlugs.length === 0) {
    // If no nodes selected, clear all links and increment version
    await db.delete(cardNodes).where(eq(cardNodes.cardId, cardId));
    await db
      .update(identityCards)
      .set({
        version: card.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(identityCards.id, cardId));
    return { success: true };
  }

  // 1. Fetch existing nodes matching any of the unique slugs in bulk
  const existingNodes = await db
    .select()
    .from(nodes)
    .where(inArray(nodes.slug, uniqueSlugs));

  const existingNodesMap = new Map<string, typeof nodes.$inferSelect>();
  for (const n of existingNodes) {
    existingNodesMap.set(n.slug, n);
  }

  // 2. Filter missing nodes and bulk insert them
  const missingItems = itemsWithSlugs.filter((item) => !existingNodesMap.has(item.slug));
  const uniqueMissingItemsMap = new Map<string, typeof itemsWithSlugs[number]>();
  for (const item of missingItems) {
    uniqueMissingItemsMap.set(item.slug, item);
  }
  const uniqueMissingItems = Array.from(uniqueMissingItemsMap.values());

  if (uniqueMissingItems.length > 0) {
    const insertedNodes = await db
      .insert(nodes)
      .values(
        uniqueMissingItems.map((item) => ({
          type: item.type,
          slug: item.slug,
          displayName: item.name,
          visibility: "public" as const,
        }))
      )
      .returning();

    for (const n of insertedNodes) {
      existingNodesMap.set(n.slug, n);
    }
  }

  // 3. Collect all target node IDs, separating shows and characters
  const targetNodeIds: string[] = [];
  const showNodeMap = new Map<string, string>(); // slug -> id
  const characterNodes: { id: string; slug: string }[] = [];

  for (const item of itemsWithSlugs) {
    const node = existingNodesMap.get(item.slug);
    if (node) {
      targetNodeIds.push(node.id);
      if (item.type === "show") {
        showNodeMap.set(item.slug, node.id);
      } else if (item.type === "character") {
        characterNodes.push({ id: node.id, slug: item.slug });
      }
    }
  }

  const uniqueTargetNodeIds = Array.from(new Set(targetNodeIds));

  // 4. Clear old links that are no longer selected
  if (uniqueTargetNodeIds.length > 0) {
    await db
      .delete(cardNodes)
      .where(
        and(
          eq(cardNodes.cardId, cardId),
          notInArray(cardNodes.nodeId, uniqueTargetNodeIds)
        )
      );
  } else {
    await db.delete(cardNodes).where(eq(cardNodes.cardId, cardId));
  }

  // 5. Select existing links and bulk insert new ones
  const existingLinks = await db
    .select()
    .from(cardNodes)
    .where(eq(cardNodes.cardId, cardId));

  const existingLinkNodeIds = new Set(existingLinks.map((l) => l.nodeId));
  const linksToInsert = uniqueTargetNodeIds.filter((id) => !existingLinkNodeIds.has(id));

  if (linksToInsert.length > 0) {
    await db.insert(cardNodes).values(
      linksToInsert.map((nodeId) => ({
        cardId,
        nodeId,
        visibility: "public" as const,
      }))
    );
  }

  // 6. Create automatic character -> show edges in the universal graph in bulk
  const characterEdgesToInsert: {
    sourceId: string;
    targetId: string;
    edgeType: string;
    weight: number;
    confidence: number;
    sourceOfTruth: "user_explicit";
  }[] = [];

  for (const charNode of characterNodes) {
    const targetShowSlug = CHARACTER_TO_SHOW[charNode.slug];
    if (targetShowSlug) {
      const showNodeId = showNodeMap.get(targetShowSlug);
      if (showNodeId) {
        characterEdgesToInsert.push({
          sourceId: charNode.id,
          targetId: showNodeId,
          edgeType: "belongs_to",
          weight: 1.0,
          confidence: 1.0,
          sourceOfTruth: "user_explicit",
        });
      }
    }
  }

  if (characterEdgesToInsert.length > 0) {
    const charNodeIds = characterNodes.map((c) => c.id);
    const existingEdges = await db
      .select()
      .from(edges)
      .where(
        and(
          eq(edges.edgeType, "belongs_to"),
          inArray(edges.sourceId, charNodeIds)
        )
      );

    const existingEdgesSet = new Set(existingEdges.map((e) => `${e.sourceId}->${e.targetId}`));
    const newEdgesToInsert = characterEdgesToInsert.filter(
      (e) => !existingEdgesSet.has(`${e.sourceId}->${e.targetId}`)
    );

    if (newEdgesToInsert.length > 0) {
      await db.insert(edges).values(newEdgesToInsert);
    }
  }

  // 7. Increment card version
  await db
    .update(identityCards)
    .set({
      version: card.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(identityCards.id, cardId));

  return { success: true };
}

/**
 * Update the visibility setting of the card
 */
export async function updateCardVisibility(
  visibility: "public" | "friends_only" | "private"
) {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const existingCards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.userId, session.user.id))
    .limit(1);

  if (existingCards.length === 0) {
    throw new Error("Identity card not found");
  }

  const card = existingCards[0];

  await db
    .update(identityCards)
    .set({
      visibility,
      version: card.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(identityCards.id, card.id));

  return { success: true };
}

/**
 * Fetches the user's current identity card nodes to load as active seeds on the exploration canvas.
 */
export async function getUserSeeds() {
  const session = await getSession();
  if (!session || !session.user) {
    return [];
  }

  const existingCards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.userId, session.user.id))
    .limit(1);

  const card = existingCards[0];
  if (!card) return [];

  const associatedNodes = await db
    .select({
      id: nodes.id,
      displayName: nodes.displayName,
      type: nodes.type,
      slug: nodes.slug,
    })
    .from(cardNodes)
    .innerJoin(nodes, eq(cardNodes.nodeId, nodes.id))
    .where(eq(cardNodes.cardId, card.id));

  return associatedNodes.map((n) => ({
    id: n.id,
    label: n.displayName,
    type: n.type as any,
    score: 1.0,
    temperature: "hot" as const,
    slug: n.slug,
  }));
}

/**
 * Creates an explicit edge connecting two nodes on the canvas.
 */
export async function connectNodesAction(sourceId: string, targetId: string) {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  // Check if edge already exists
  const existingEdge = await db
    .select()
    .from(edges)
    .where(
      or(
        and(eq(edges.sourceId, sourceId), eq(edges.targetId, targetId)),
        and(eq(edges.sourceId, targetId), eq(edges.targetId, sourceId))
      )
    )
    .limit(1);

  if (existingEdge.length === 0) {
    const inserted = await db
      .insert(edges)
      .values({
        sourceId,
        targetId,
        edgeType: "likes",
        weight: 1.0,
        confidence: 1.0,
        sourceOfTruth: "user_explicit",
      })
      .returning();
    return { success: true, edge: inserted[0] };
  }

  return { success: true, edge: existingEdge[0] };
}
