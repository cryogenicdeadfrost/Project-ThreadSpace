import { db } from "@/lib/db";
import {
  nodes,
  edges,
  cardNodes,
  identityCards,
  nodeIndex,
  tfidfVectors,
  nodeCooccurrence,
  cardClusters,
  clusterCentroids,
} from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

/**
 * 1. RECOMPUTE TF-IDF VECTORS FOR ALL CARDS
 * Maps all nodes to stable vector dimensions, calculates TF-IDF weightings,
 * normalizes the vectors, and saves them to tfidf_vectors.
 */
export async function recomputeTFIDF() {
  console.log("⚡ Starting TF-IDF computation...");

  // 1. Establish stable index dimension mapping for all nodes
  const allNodes = await db.select({ id: nodes.id }).from(nodes);
  if (allNodes.length === 0) {
    console.log("No nodes found, skipping TF-IDF.");
    return;
  }

  // Clear existing indices and rebuild
  await db.delete(nodeIndex);
  const indexValues = allNodes.map((node, i) => ({
    nodeId: node.id,
    index: i,
  }));
  await db.insert(nodeIndex).values(indexValues);
  console.log(`Mapped ${allNodes.length} nodes to stable dimensions.`);

  // 2. Fetch all cards and their associated nodes
  const cards = await db
    .select({ id: identityCards.id })
    .from(identityCards)
    .where(eq(identityCards.visibility, "public"));

  const totalCards = cards.length;
  if (totalCards === 0) {
    console.log("No public cards found, skipping TF-IDF.");
    return;
  }

  const allCardNodes = await db
    .select({
      cardId: cardNodes.cardId,
      nodeId: cardNodes.nodeId,
      nodeIdx: nodeIndex.index,
    })
    .from(cardNodes)
    .innerJoin(nodeIndex, eq(cardNodes.nodeId, nodeIndex.nodeId));

  // Group nodes by card
  const cardNodeMap = new Map<string, number[]>(); // cardId -> nodeIndices
  const nodeDFMap = new Map<number, number>(); // nodeIndex -> documentFrequency

  for (const item of allCardNodes) {
    if (!cardNodeMap.has(item.cardId)) {
      cardNodeMap.set(item.cardId, []);
    }
    cardNodeMap.get(item.cardId)!.push(item.nodeIdx);

    // Calculate Document Frequency (DF)
    nodeDFMap.set(item.nodeIdx, (nodeDFMap.get(item.nodeIdx) || 0) + 1);
  }

  // 3. Compute TF-IDF vectors for each card
  const dimensionCount = allNodes.length;

  for (const card of cards) {
    const activeIndices = cardNodeMap.get(card.id) || [];
    if (activeIndices.length === 0) continue;

    // Sparse representation: index -> weight
    const vector = new Array(dimensionCount).fill(0);
    const termFrequency = 1.0 / activeIndices.length;

    let sumSquares = 0;

    for (const idx of activeIndices) {
      const df = nodeDFMap.get(idx) || 1;
      // Smoothed IDF formulation: log(1 + N/DF) + 1
      const idf = Math.log(1 + totalCards / df) + 1.0;
      const tfidf = termFrequency * idf;

      vector[idx] = tfidf;
      sumSquares += tfidf * tfidf;
    }

    const norm = Math.sqrt(sumSquares);

    // Normalize to unit length (L2 Normalization)
    const normalizedVector = vector.map((val) => (norm > 0 ? val / norm : 0));

    // Save to tfidf_vectors table
    await db
      .insert(tfidfVectors)
      .values({
        cardId: card.id,
        vector: normalizedVector,
        vectorNorm: norm,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tfidfVectors.cardId,
        set: {
          vector: normalizedVector,
          vectorNorm: norm,
          computedAt: new Date(),
        },
      });
  }

  console.log(`✅ TF-IDF vector computation complete for ${totalCards} cards.`);
}

/**
 * 2. COMPUTE CO-OCCURRENCE & POINTWISE MUTUAL INFORMATION (PMI)
 * Learns semantic connections from how cards group traits/shows together.
 * High-PMI associations are promoted to system-inferred edges.
 */
export async function computePMI() {
  console.log("⚡ Starting PMI co-occurrence mining...");

  const cards = await db
    .select({ id: identityCards.id })
    .from(identityCards)
    .where(eq(identityCards.visibility, "public"));

  const totalCards = cards.length;
  if (totalCards < 2) {
    console.log("Not enough cards to compute co-occurrence, skipping.");
    return;
  }

  // Get nodes on each card
  const allCardNodes = await db
    .select({
      cardId: cardNodes.cardId,
      nodeId: cardNodes.nodeId,
    })
    .from(cardNodes);

  // Group node occurrences by card and calculate single node frequencies
  const cardNodeMap = new Map<string, string[]>(); // cardId -> nodeIds[]
  const nodeCountMap = new Map<string, number>(); // nodeId -> cardCount

  for (const item of allCardNodes) {
    if (!cardNodeMap.has(item.cardId)) {
      cardNodeMap.set(item.cardId, []);
    }
    cardNodeMap.get(item.cardId)!.push(item.nodeId);
    nodeCountMap.set(item.nodeId, (nodeCountMap.get(item.nodeId) || 0) + 1);
  }

  // Calculate pairwise co-occurrences
  const pairCountMap = new Map<string, number>(); // "nodeA_id:nodeB_id" -> coCount

  for (const [_, nodeIds] of cardNodeMap.entries()) {
    if (nodeIds.length < 2) continue;

    // Iterate all unique pairs
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        // Sort IDs to ensure order-independence A < B
        const [a, b] = [nodeIds[i], nodeIds[j]].sort();
        const pairKey = `${a}:${b}`;
        pairCountMap.set(pairKey, (pairCountMap.get(pairKey) || 0) + 1);
      }
    }
  }

  // Process pairs and compute PMI
  let edgesCreated = 0;
  await db.delete(nodeCooccurrence); // refresh co-occurrence table

  for (const [pairKey, coCount] of pairCountMap.entries()) {
    const [nodeA, nodeB] = pairKey.split(":");
    const countA = nodeCountMap.get(nodeA) || 0;
    const countB = nodeCountMap.get(nodeB) || 0;

    // Save co-occurrence data
    await db.insert(nodeCooccurrence).values({
      nodeA,
      nodeB,
      coCount,
      totalCardsSeen: totalCards,
    });

    // To prevent noise, require at least 2 co-occurrences
    if (coCount >= 2) {
      // PMI formulation: log2( P(A,B) / (P(A)*P(B)) )
      const pAB = coCount / totalCards;
      const pA = countA / totalCards;
      const pB = countB / totalCards;
      const pmi = Math.log2(pAB / (pA * pB));

      // Significant positive correlation threshold
      if (pmi >= 1.5) {
        // Edge confidence scales with PMI, capped at 1.0
        const confidence = Math.min(1.0, pmi / 4.0);

        // Check if edge already exists
        const existing = await db
          .select()
          .from(edges)
          .where(
            and(
              eq(edges.sourceId, nodeA),
              eq(edges.targetId, nodeB),
              eq(edges.edgeType, "inferred_affinity")
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(edges).values({
            sourceId: nodeA,
            targetId: nodeB,
            edgeType: "inferred_affinity",
            weight: pmi,
            confidence,
            sourceOfTruth: "system_inferred",
          });
          edgesCreated++;
        }
      }
    }
  }

  console.log(`✅ PMI mining complete. Promoted ${edgesCreated} system-inferred edges.`);
}

/**
 * Helper to compute cosine similarity between two unit vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

/**
 * 3. RUN SPHERICAL K-MEANS CLUSTERING
 * Groups similar cards together into conceptual clusters based on TF-IDF vectors.
 */
export async function runKMeans(k: number = 3) {
  console.log(`⚡ Starting Spherical K-Means clustering (K=${k})...`);

  // 1. Fetch vectors
  const cardVectors = await db.select().from(tfidfVectors);
  if (cardVectors.length < k) {
    console.log("Not enough vectors to run clustering, skipping.");
    return;
  }

  const dimensionCount = cardVectors[0].vector?.length || 0;
  if (dimensionCount === 0) return;

  // Initialize cluster centroids from random cards
  const centroids: number[][] = [];
  const shuffled = [...cardVectors].sort(() => 0.5 - Math.random());
  for (let i = 0; i < k; i++) {
    centroids.push(shuffled[i].vector as number[]);
  }

  // Cluster assignments: cardId -> clusterId
  const assignments = new Map<string, number>();
  let changed = true;
  let maxIterations = 8;

  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations--;

    // Assign cards to closest centroid
    for (const card of cardVectors) {
      let maxSim = -1;
      let bestCluster = 0;

      for (let c = 0; c < k; c++) {
        const sim = cosineSimilarity(card.vector as number[], centroids[c]);
        if (sim > maxSim) {
          maxSim = sim;
          bestCluster = c;
        }
      }

      if (assignments.get(card.cardId) !== bestCluster) {
        assignments.set(card.cardId, bestCluster);
        changed = true;
      }
    }

    // Recompute centroids as mean of assigned vectors and normalize
    if (changed) {
      for (let c = 0; c < k; c++) {
        const clusterCards = cardVectors.filter(
          (card) => assignments.get(card.cardId) === c
        );

        if (clusterCards.length === 0) continue;

        const newCentroid = new Array(dimensionCount).fill(0);
        let sumSquares = 0;

        for (const card of clusterCards) {
          const vec = card.vector as number[];
          for (let d = 0; d < dimensionCount; d++) {
            newCentroid[d] += vec[d];
          }
        }

        // L2 Norm
        for (let d = 0; d < dimensionCount; d++) {
          newCentroid[d] /= clusterCards.length;
          sumSquares += newCentroid[d] * newCentroid[d];
        }

        const norm = Math.sqrt(sumSquares);
        centroids[c] = newCentroid.map((val) => (norm > 0 ? val / norm : 0));
      }
    }
  }

  // 2. Save assignments and centroids to DB
  await db.delete(cardClusters);
  await db.delete(clusterCentroids);

  for (const [cardId, clusterId] of assignments.entries()) {
    await db.insert(cardClusters).values({
      cardId,
      clusterId,
      assignedAt: new Date(),
    });
  }

  for (let c = 0; c < k; c++) {
    const size = Array.from(assignments.values()).filter(
      (v) => v === c
    ).length;

    await db.insert(clusterCentroids).values({
      clusterId: c,
      centroidVector: centroids[c],
      size,
      computedAt: new Date(),
    });
  }

  console.log(`✅ Spherical K-Means completed. Grouped cards into ${k} clusters.`);
}

/**
 * 4. ONE-CLICK CRON TRIGGER
 * Runs all computation background jobs in order.
 */
export async function runAllBackgroundJobs() {
  console.log("🎬 Initiating background computation suite...");
  await recomputeTFIDF();
  await computePMI();
  await runKMeans();
  console.log("🎉 All background jobs completed successfully.");
}
