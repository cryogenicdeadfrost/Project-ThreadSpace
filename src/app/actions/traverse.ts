"use server";

import { db } from "@/lib/db";
import { nodes, edges, cardNodes, identityCards, nodeIndex, tfidfVectors } from "@/lib/schema";
import { eq, inArray, and, or } from "drizzle-orm";

export interface TraversalResult {
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
  cardScores?: {
    cardId: string;
    displayName: string;
    score: number;
    temperature: "cold" | "warm" | "hot";
    nodeIds: string[];
  }[];
}

/**
 * Traverses the graph from a set of seed nodes and scores all candidate cards.
 */
export async function traverseGraph(seedIds: string[]): Promise<TraversalResult> {
  try {
    // ── CASE 1: No seeds selected — return default landing/initial graph neighborhood ──
    if (seedIds.length === 0) {
      // Get first 30 nodes
      const allNodes = await db
        .select()
        .from(nodes)
        .limit(30);

      if (allNodes.length === 0) {
        return { nodes: [], edges: [] };
      }

      const nodeIds = allNodes.map((n) => n.id);

      // Fetch all edges linking these nodes
      const allEdges = await db
        .select()
        .from(edges)
        .where(
          and(
            inArray(edges.sourceId, nodeIds),
            inArray(edges.targetId, nodeIds)
          )
        );

      const formattedNodes = allNodes.map((n) => ({
        id: n.id,
        label: n.displayName,
        type: n.type as any,
        score: 0.1 + Math.random() * 0.2, // low ambient score when cold
        temperature: "cold" as const,
        slug: n.slug,
      }));

      const formattedEdges = allEdges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        edgeType: e.edgeType,
        confidence: e.confidence,
        sourceOfTruth: e.sourceOfTruth,
      }));

      return { nodes: formattedNodes, edges: formattedEdges };
    }

    // ── CASE 2: Seeds selected — traverse neighborhood (up to 2 hops) ──
    const visitedNodeIds = new Set<string>(seedIds);
    const nodeHopMap = new Map<string, number>(); // node_id -> hop count
    seedIds.forEach((id) => nodeHopMap.set(id, 0));

    // Hop 1 traversal
    const hop1Edges = await db
      .select()
      .from(edges)
      .where(
        or(
          inArray(edges.sourceId, seedIds),
          inArray(edges.targetId, seedIds)
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

    // ── Scoring Engine: Compute Node Similarity Scores ──
    // Seed = 1.0, Hop 1 = 0.6, Hop 2 = 0.3
    const formattedNodes = dbNodes.map((n) => {
      const hop = nodeHopMap.get(n.id) ?? 2;
      const score = hop === 0 ? 1.0 : hop === 1 ? 0.6 : 0.3;
      const temperature = score >= 0.8 ? ("hot" as const) : score >= 0.4 ? ("warm" as const) : ("cold" as const);

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

    // ── Scoring Cards ──
    // Get all cards linked to traversed nodes
    const links = await db
      .select({
        cardId: cardNodes.cardId,
        nodeId: cardNodes.nodeId,
        displayName: identityCards.displayName,
      })
      .from(cardNodes)
      .innerJoin(identityCards, eq(cardNodes.cardId, identityCards.id))
      .where(inArray(cardNodes.nodeId, finalNodesList));

    // Group links by card
    const cardMap = new Map<string, { displayName: string; nodeIds: string[] }>();
    for (const link of links) {
      if (!cardMap.has(link.cardId)) {
        cardMap.set(link.cardId, {
          displayName: link.displayName || "Anonymous",
          nodeIds: [],
        });
      }
      cardMap.get(link.cardId)!.nodeIds.push(link.nodeId);
    }

    // Fetch vector dimensions for active seeds
    const seedIndices = await db
      .select({ index: nodeIndex.index })
      .from(nodeIndex)
      .where(inArray(nodeIndex.nodeId, seedIds));
    const activeIndices = seedIndices.map((s) => s.index);

    // Fetch TF-IDF vectors for candidate cards
    const cardVectorRecords = await db
      .select()
      .from(tfidfVectors)
      .where(inArray(tfidfVectors.cardId, Array.from(cardMap.keys())));

    const cardVectorMap = new Map<string, number[]>();
    for (const record of cardVectorRecords) {
      if (record.vector) {
        cardVectorMap.set(record.cardId, record.vector);
      }
    }

    // Score cards based on matching seed nodes and path weight
    const cardScores = Array.from(cardMap.entries()).map(([cardId, info]) => {
      let weightSum = 0;
      let matchCount = 0;

      for (const nodeId of info.nodeIds) {
        const hop = nodeHopMap.get(nodeId);
        if (hop !== undefined) {
          matchCount++;
          // Higher weights for closer nodes
          weightSum += hop === 0 ? 1.0 : hop === 1 ? 0.5 : 0.25;
        }
      }

      // Normalize similarity score based on total items in card
      const baseScore = info.nodeIds.length > 0 ? weightSum / info.nodeIds.length : 0;
      // Boost score if we have more matching elements
      const graphScore = Math.min(1.0, baseScore * (1 + matchCount * 0.15));

      // Cosine Similarity score from precomputed TF-IDF vector
      let cosineSimilarityVal = 0;
      const vector = cardVectorMap.get(cardId);
      if (vector && activeIndices.length > 0) {
        let dotProduct = 0;
        for (const idx of activeIndices) {
          if (idx < vector.length) {
            dotProduct += vector[idx];
          }
        }
        // Seed vector is V_S = 1/sqrt(|seeds|) for seed dimensions. Cosine sim = dotProduct / sqrt(|seeds|).
        cosineSimilarityVal = dotProduct / Math.sqrt(activeIndices.length);
      }

      // Hybrid blended score: 60% graph structure, 40% TF-IDF cosine similarity
      // If no vector has been computed yet (e.g. cron hasn't run), fallback 100% to graphScore
      const score = vector ? (graphScore * 0.6 + cosineSimilarityVal * 0.4) : graphScore;
      const temperature = score >= 0.7 ? ("hot" as const) : score >= 0.35 ? ("warm" as const) : ("cold" as const);

      return {
        cardId,
        displayName: info.displayName,
        score: Math.min(1.0, Math.max(0.0, score)),
        temperature,
        nodeIds: info.nodeIds,
      };
    });

    // Sort cards by score descending
    cardScores.sort((a, b) => b.score - a.score);

    return {
      nodes: formattedNodes,
      edges: formattedEdges,
      cardScores,
    };
  } catch (error) {
    console.error("Traversal error:", error);
    return { nodes: [], edges: [] };
  }
}

/**
 * Single-hop expansion along an edge type (Thread Pulling).
 */
export async function pullThread(
  nodeId: string,
  edgeType?: string
): Promise<{ nodes: any[]; edges: any[] }> {
  try {
    const queryConditions = edgeType
      ? and(
          eq(edges.edgeType, edgeType),
          or(eq(edges.sourceId, nodeId), eq(edges.targetId, nodeId))
        )
      : or(eq(edges.sourceId, nodeId), eq(edges.targetId, nodeId));

    const neighborEdges = await db
      .select()
      .from(edges)
      .where(queryConditions)
      .limit(10);

    const neighborNodeIds = new Set<string>();
    for (const edge of neighborEdges) {
      neighborNodeIds.add(edge.sourceId);
      neighborNodeIds.add(edge.targetId);
    }

    if (neighborNodeIds.size === 0) {
      return { nodes: [], edges: [] };
    }

    const neighborNodesList = Array.from(neighborNodeIds);
    const dbNodes = await db
      .select()
      .from(nodes)
      .where(inArray(nodes.id, neighborNodesList));

    const formattedNodes = dbNodes.map((n) => ({
      id: n.id,
      label: n.displayName,
      type: n.type as any,
      score: 0.4, // intermediate warm score for expanded nodes
      temperature: "warm" as const,
      slug: n.slug,
    }));

    const formattedEdges = neighborEdges.map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      edgeType: e.edgeType,
      confidence: e.confidence,
      sourceOfTruth: e.sourceOfTruth,
    }));

    return {
      nodes: formattedNodes,
      edges: formattedEdges,
    };
  } catch (error) {
    console.error("Pull thread error:", error);
    return { nodes: [], edges: [] };
  }
}
