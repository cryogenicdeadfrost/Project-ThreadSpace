"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { traverseGraph } from "@/app/actions/traverse";
import { getUserSeeds } from "@/app/actions/card";

// ── Types ────────────────────────────────────────────────────────
export interface GraphNodeData {
  id: string;
  label: string;
  type: "person" | "show" | "character" | "trait" | "concept" | "community" | "derived";
  score: number; // 0-1 normalized
  temperature: "cold" | "warm" | "hot";
  slug: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  edgeType: string;
  confidence: number;
  sourceOfTruth: "user_explicit" | "system_inferred" | "admin";
}

export interface ScoredCard {
  cardId: string;
  displayName: string;
  score: number;
  temperature: "cold" | "warm" | "hot";
  nodeIds: string[];
}

interface GraphContextType {
  // Seeds
  seeds: GraphNodeData[];
  addSeed: (node: GraphNodeData) => void;
  removeSeed: (nodeId: string) => void;
  clearSeeds: () => void;

  // Graph data
  graphNodes: GraphNodeData[];
  graphEdges: GraphEdgeData[];
  setGraphNodes: Dispatch<SetStateAction<GraphNodeData[]>>;
  setGraphEdges: Dispatch<SetStateAction<GraphEdgeData[]>>;

  // Scored results
  scoredCards: ScoredCard[];
  setScoredCards: (cards: ScoredCard[]) => void;

  // Active state
  activeCardId: string | null;
  setActiveCardId: (id: string | null) => void;

  // Traversal history
  traversalHistory: string[][];
  pushTraversal: (path: string[]) => void;

  // Loading
  isTraversing: boolean;
  setIsTraversing: (v: boolean) => void;
}

export const GraphContext = createContext<GraphContextType | null>(null);

export function useGraph() {
  const ctx = useContext(GraphContext);
  if (!ctx) throw new Error("useGraph must be used within GraphProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────
export function GraphProvider({ children }: { children: ReactNode }) {
  const [seeds, setSeeds] = useState<GraphNodeData[]>([]);

  // Load initial seeds from current user card on mount
  useEffect(() => {
    async function loadUserSeeds() {
      try {
        const userSeeds = await getUserSeeds();
        if (userSeeds && userSeeds.length > 0) {
          setSeeds(userSeeds);
        }
      } catch (err) {
        console.error("Failed to load user seeds:", err);
      }
    }
    loadUserSeeds();
  }, []);
  const [graphNodes, setGraphNodes] = useState<GraphNodeData[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdgeData[]>([]);
  const [scoredCards, setScoredCards] = useState<ScoredCard[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [traversalHistory, setTraversalHistory] = useState<string[][]>([]);
  const [isTraversing, setIsTraversing] = useState(false);

  // Automatically fetch neighborhood when seeds change
  useEffect(() => {
    let active = true;
    async function fetchTraversal() {
      setIsTraversing(true);
      try {
        const seedIds = seeds.map((s) => s.id);
        const result = await traverseGraph(seedIds);
        if (active) {
          setGraphNodes(result.nodes);
          setGraphEdges(result.edges);
          setScoredCards(result.cardScores || []);
        }
      } catch (err) {
        console.error("Failed to fetch graph traversal:", err);
      } finally {
        if (active) setIsTraversing(false);
      }
    }
    fetchTraversal();
    return () => {
      active = false;
    };
  }, [seeds]);

  const addSeed = useCallback((node: GraphNodeData) => {
    setSeeds((prev) => {
      if (prev.find((s) => s.id === node.id)) return prev;
      return [...prev, node];
    });
  }, []);

  const removeSeed = useCallback((nodeId: string) => {
    setSeeds((prev) => prev.filter((s) => s.id !== nodeId));
  }, []);

  const clearSeeds = useCallback(() => {
    setSeeds([]);
  }, []);

  const pushTraversal = useCallback((path: string[]) => {
    setTraversalHistory((prev) => [...prev, path]);
  }, []);

  return (
    <GraphContext.Provider
      value={{
        seeds,
        addSeed,
        removeSeed,
        clearSeeds,
        graphNodes,
        graphEdges,
        setGraphNodes,
        setGraphEdges,
        scoredCards,
        setScoredCards,
        activeCardId,
        setActiveCardId,
        traversalHistory,
        pushTraversal,
        isTraversing,
        setIsTraversing,
      }}
    >
      {children}
    </GraphContext.Provider>
  );
}
