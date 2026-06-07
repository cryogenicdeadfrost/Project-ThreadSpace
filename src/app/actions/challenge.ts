"use server";

import { db } from "@/lib/db";
import { challengeLinks, identityCards, nodes, cardNodes, edges } from "@/lib/schema";
import { eq, inArray, and, or } from "drizzle-orm";
import { getSession } from "./card";

export interface ChallengeDetails {
  id: string;
  creatorName: string;
  clues: {
    id: string;
    displayName: string;
    type: string;
    slug: string;
  }[];
  expiresAt: Date;
  isExpired: boolean;
  creatorCardId: string;
}

/**
 * Creates a challenge link with selected clue nodes.
 * Valid for 72 hours.
 */
export async function createChallengeLink(clueNodeIds: string[]): Promise<string> {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  // Get user's card
  const cards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.userId, session.user.id))
    .limit(1);

  if (cards.length === 0) {
    throw new Error("You must create an identity card first.");
  }

  const cardId = cards[0].id;
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  const inserted = await db
    .insert(challengeLinks)
    .values({
      creatorCardId: cardId,
      clueNodeIds,
      expiresAt,
    })
    .returning();

  return inserted[0].id;
}

/**
 * Retrieves the details of a challenge, including the clues and creator name.
 */
export async function getChallengeDetails(id: string): Promise<ChallengeDetails> {
  const links = await db
    .select()
    .from(challengeLinks)
    .where(eq(challengeLinks.id, id))
    .limit(1);

  const link = links[0];
  if (!link) {
    throw new Error("Challenge link not found.");
  }

  const isExpired = new Date() > new Date(link.expiresAt);

  // Fetch creator identity card
  const cards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.id, link.creatorCardId))
    .limit(1);

  const card = cards[0];
  const creatorName = card?.displayName || "Anonymous";

  // Fetch clue node details
  let clues: ChallengeDetails["clues"] = [];
  if (link.clueNodeIds && link.clueNodeIds.length > 0) {
    const clueNodes = await db
      .select()
      .from(nodes)
      .where(inArray(nodes.id, link.clueNodeIds));

    clues = clueNodes.map((n) => ({
      id: n.id,
      displayName: n.displayName,
      type: n.type,
      slug: n.slug,
    }));
  }

  return {
    id: link.id,
    creatorName,
    clues,
    expiresAt: link.expiresAt,
    isExpired,
    creatorCardId: link.creatorCardId,
  };
}

/**
 * Helper to fetch clues for a user's own card to initialize a challenge.
 */
export async function getMyCardNodes() {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const cards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.userId, session.user.id))
    .limit(1);

  if (cards.length === 0) {
    return [];
  }

  const cardId = cards[0].id;

  const associatedNodes = await db
    .select({
      id: nodes.id,
      displayName: nodes.displayName,
      type: nodes.type,
      slug: nodes.slug,
    })
    .from(cardNodes)
    .innerJoin(nodes, eq(cardNodes.nodeId, nodes.id))
    .where(eq(cardNodes.cardId, cardId));

  return associatedNodes;
}

export interface ChallengeTraversalResult {
  nodes: {
    id: string;
    label: string;
    type: "person" | "show" | "character" | "trait" | "concept" | "community" | "derived";
    score: number;
    temperature: "cold" | "warm" | "hot";
    slug: string;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    edgeType: string;
    confidence: number;
    sourceOfTruth: "user_explicit" | "system_inferred" | "admin";
  }[];
  similarity: number;
  won: boolean;
  targetCard?: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    nodes: {
      id: string;
      displayName: string;
      type: string;
      slug: string;
    }[];
  };
}

export async function traverseChallenge(
  challengeId: string,
  seedIds: string[]
): Promise<ChallengeTraversalResult> {
  // 1. Fetch challenge link details
  const links = await db
    .select()
    .from(challengeLinks)
    .where(eq(challengeLinks.id, challengeId))
    .limit(1);

  const link = links[0];
  if (!link) {
    throw new Error("Challenge link not found.");
  }

  const creatorCardId = link.creatorCardId;

  // 2. Fetch target card's node IDs
  const targetNodes = await db
    .select({
      id: nodes.id,
      displayName: nodes.displayName,
      type: nodes.type,
      slug: nodes.slug,
    })
    .from(cardNodes)
    .innerJoin(nodes, eq(cardNodes.nodeId, nodes.id))
    .where(eq(cardNodes.cardId, creatorCardId));

  const targetNodeIds = targetNodes.map((n) => n.id);
  const targetNodeIdSet = new Set(targetNodeIds);

  if (targetNodeIds.length === 0) {
    throw new Error("Target card has no nodes associated.");
  }

  // 3. Compute target neighborhood distances (in-memory BFS on edges)
  const D0 = targetNodeIdSet;

  // Find all edges connected directly to D0
  const edgesD1 = await db
    .select({ sourceId: edges.sourceId, targetId: edges.targetId })
    .from(edges)
    .where(
      or(
        inArray(edges.sourceId, targetNodeIds),
        inArray(edges.targetId, targetNodeIds)
      )
    );

  const D1 = new Set<string>();
  for (const e of edgesD1) {
    if (!D0.has(e.sourceId)) D1.add(e.sourceId);
    if (!D0.has(e.targetId)) D1.add(e.targetId);
  }

  // Find all edges connected directly to D1
  let D2 = new Set<string>();
  if (D1.size > 0) {
    const edgesD2 = await db
      .select({ sourceId: edges.sourceId, targetId: edges.targetId })
      .from(edges)
      .where(
        or(
          inArray(edges.sourceId, Array.from(D1)),
          inArray(edges.targetId, Array.from(D1))
        )
      );

    for (const e of edgesD2) {
      if (!D0.has(e.sourceId) && !D1.has(e.sourceId)) D2.add(e.sourceId);
      if (!D0.has(e.targetId) && !D1.has(e.targetId)) D2.add(e.targetId);
    }
  }

  // 4. Perform traversal from current user seedIds (up to 2 hops, identical to traverseGraph)
  // If no seeds, default to the clueNodeIds!
  const activeSeeds = seedIds.length > 0 ? seedIds : (link.clueNodeIds as string[]);

  const visitedNodeIds = new Set<string>(activeSeeds);
  const nodeHopMap = new Map<string, number>();
  activeSeeds.forEach((id) => nodeHopMap.set(id, 0));

  // Hop 1 traversal
  const hop1Edges = await db
    .select()
    .from(edges)
    .where(
      or(
        inArray(edges.sourceId, activeSeeds),
        inArray(edges.targetId, activeSeeds)
      )
    );

  const hop1NodeIds = new Set<string>();
  for (const edge of hop1Edges) {
    if (!visitedNodeIds.has(edge.sourceId)) {
      hop1NodeIds.add(edge.sourceId);
      visitedNodeIds.add(edge.sourceId);
      nodeHopMap.set(edge.sourceId, 1);
    }
    if (!visitedNodeIds.has(edge.targetId)) {
      hop1NodeIds.add(edge.targetId);
      visitedNodeIds.add(edge.targetId);
      nodeHopMap.set(edge.targetId, 1);
    }
  }

  // Hop 2 traversal
  if (hop1NodeIds.size > 0) {
    const hop2Edges = await db
      .select()
      .from(edges)
      .where(
        or(
          inArray(edges.sourceId, Array.from(hop1NodeIds)),
          inArray(edges.targetId, Array.from(hop1NodeIds))
        )
      );

    for (const edge of hop2Edges) {
      if (!visitedNodeIds.has(edge.sourceId)) {
        visitedNodeIds.add(edge.sourceId);
        nodeHopMap.set(edge.sourceId, 2);
      }
      if (!visitedNodeIds.has(edge.targetId)) {
        visitedNodeIds.add(edge.targetId);
        nodeHopMap.set(edge.targetId, 2);
      }
    }
  }

  // Fetch details of all visited nodes
  const finalNodesList = Array.from(visitedNodeIds);
  const dbNodes = await db
    .select()
    .from(nodes)
    .where(inArray(nodes.id, finalNodesList));

  // Fetch edges linking all visited nodes
  const dbEdges = await db
    .select()
    .from(edges)
    .where(
      and(
        inArray(edges.sourceId, finalNodesList),
        inArray(edges.targetId, finalNodesList)
      )
    );

  // 5. Score Nodes based on proximity to target card nodes (hot-cold game guidance)
  const formattedNodes = dbNodes.map((n) => {
    let score = 0.1;
    let temperature: "cold" | "warm" | "hot" = "cold";

    if (D0.has(n.id)) {
      score = 1.0;
      temperature = "hot";
    } else if (D1.has(n.id)) {
      score = 0.6;
      temperature = "warm";
    } else if (D2.has(n.id)) {
      score = 0.3;
      temperature = "cold";
    }

    return {
      id: n.id,
      label: n.displayName,
      type: n.type as any,
      score,
      temperature,
      slug: n.slug,
    };
  });

  const formattedEdges = dbEdges.map((e) => ({
    id: e.id,
    source: e.sourceId,
    target: e.targetId,
    edgeType: e.edgeType,
    confidence: e.confidence,
    sourceOfTruth: e.sourceOfTruth,
  }));

  // 6. Compute overall similarity game progress score
  let weightSum = 0;
  for (const tId of targetNodeIds) {
    if (activeSeeds.includes(tId)) {
      weightSum += 1.0;
    } else if (hop1NodeIds.has(tId)) {
      weightSum += 0.5;
    } else if (visitedNodeIds.has(tId)) {
      weightSum += 0.25;
    }
  }

  const similarity = Math.min(1.0, weightSum / targetNodeIds.length);
  const won = similarity >= 0.85;

  // 7. Security boundaries: return target profile only if won!
  let targetCard: ChallengeTraversalResult["targetCard"] = undefined;
  if (won) {
    const cards = await db
      .select()
      .from(identityCards)
      .where(eq(identityCards.id, creatorCardId))
      .limit(1);

    const card = cards[0];
    if (card) {
      targetCard = {
        displayName: card.displayName || "Anonymous",
        bio: card.bio || "",
        avatarUrl: card.avatarUrl,
        nodes: targetNodes.map((n) => ({
          id: n.id,
          displayName: n.displayName,
          type: n.type,
          slug: n.slug,
        })),
      };
    }
  }

  return {
    nodes: formattedNodes,
    edges: formattedEdges,
    similarity,
    won,
    targetCard,
  };
}
