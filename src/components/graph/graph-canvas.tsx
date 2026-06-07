"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGraph, type GraphEdgeData } from "./graph-provider";
import { connectNodesAction } from "@/app/actions/card";
import { speakText } from "@/components/accessibility-menu";

/* ================================================================
   THREADSPACE — Physics Graph Canvas
   Force-directed layout · Hot-cold color system · Interactive nodes
   ================================================================ */

// ── Demo seed data for the exploration page ──────────────────────
interface PhysicsNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  score: number;
  targetScore: number;
  connections: string[];
  fixed?: boolean;
}

interface PhysicsEdge {
  source: string;
  target: string;
  type: "explicit" | "inferred";
  confidence: number;
}

const EXPLORE_NODES: Omit<PhysicsNode, "x" | "y" | "vx" | "vy" | "score" | "targetScore">[] = [
  { id: "e1", label: "The Office", type: "show", radius: 36, connections: ["e2", "e3", "e5", "e8"] },
  { id: "e2", label: "Jim Halpert", type: "character", radius: 30, connections: ["e1", "e4", "e6"] },
  { id: "e3", label: "Michael Scott", type: "character", radius: 32, connections: ["e1", "e7", "e9"] },
  { id: "e4", label: "Sarcasm", type: "trait", radius: 26, connections: ["e2", "e10", "e14"] },
  { id: "e5", label: "Parks & Rec", type: "show", radius: 30, connections: ["e1", "e9", "e11"] },
  { id: "e6", label: "Pranks", type: "trait", radius: 22, connections: ["e2", "e14"] },
  { id: "e7", label: "Leadership", type: "trait", radius: 24, connections: ["e3", "e9", "e12"] },
  { id: "e8", label: "Sitcom Fan", type: "concept", radius: 34, connections: ["e1", "e5", "e13"] },
  { id: "e9", label: "Leslie Knope", type: "character", radius: 28, connections: ["e3", "e5", "e7"] },
  { id: "e10", label: "Dry Humor", type: "trait", radius: 24, connections: ["e4", "e13"] },
  { id: "e11", label: "Ben Wyatt", type: "character", radius: 24, connections: ["e5", "e15"] },
  { id: "e12", label: "Optimism", type: "trait", radius: 22, connections: ["e7", "e9"] },
  { id: "e13", label: "Comedy Nerd", type: "concept", radius: 28, connections: ["e8", "e10", "e16"] },
  { id: "e14", label: "Strategic", type: "trait", radius: 20, connections: ["e4", "e6"] },
  { id: "e15", label: "Nerdy", type: "trait", radius: 20, connections: ["e11", "e16"] },
  { id: "e16", label: "Sci-Fi Fan", type: "concept", radius: 26, connections: ["e13", "e15", "e17"] },
  { id: "e17", label: "Ben 10", type: "show", radius: 22, connections: ["e16", "e18"] },
  { id: "e18", label: "Alien X", type: "character", radius: 20, connections: ["e17"] },
];

const EXPLORE_EDGES: PhysicsEdge[] = EXPLORE_NODES.flatMap((node) =>
  node.connections.map((target) => ({
    source: node.id,
    target,
    type: (Math.random() > 0.25 ? "explicit" : "inferred") as "explicit" | "inferred",
    confidence: 0.3 + Math.random() * 0.7,
  }))
).filter(
  (edge, i, arr) =>
    arr.findIndex(
      (e) =>
        (e.source === edge.source && e.target === edge.target) ||
        (e.source === edge.target && e.target === edge.source)
    ) === i
);

import { pullThread } from "@/app/actions/traverse";

// ── Color System ─────────────────────────────────────────────────
function scoreToColor(score: number): string {
  if (score < 0.3) {
    const p = score / 0.3;
    return lerpColor([56, 189, 248], [45, 212, 191], p);
  } else if (score < 0.6) {
    const p = (score - 0.3) / 0.3;
    return lerpColor([45, 212, 191], [245, 158, 11], p);
  } else {
    const p = (score - 0.6) / 0.4;
    return lerpColor([245, 158, 11], [249, 112, 102], p);
  }
}

function lerpColor(a: number[], b: number[], t: number): string {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

const TYPE_EMOJI: Record<string, string> = {
  show: "📺",
  character: "🎭",
  trait: "✦",
  concept: "◈",
  person: "👤",
  community: "🌐",
  derived: "🔮",
};

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  show: { icon: "📺", color: "#38bdf8" },
  character: { icon: "🎭", color: "#a78bfa" },
  trait: { icon: "✦", color: "#60d4c8" },
  concept: { icon: "◈", color: "#f59e0b" },
  person: { icon: "👤", color: "#f97066" },
  community: { icon: "🌐", color: "#34d399" },
  derived: { icon: "🔮", color: "#818cf8" },
};

// ── Main Canvas Component ────────────────────────────────────────
export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<PhysicsNode[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const frameRef = useRef(0);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const connectingRef = useRef<{ sourceId: string } | null>(null);

  const [hoveredNode, setHoveredNode] = useState<PhysicsNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<PhysicsNode | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [connectModeSourceId, setConnectModeSourceId] = useState<string | null>(null);

  const {
    addSeed,
    graphNodes,
    graphEdges,
    setGraphNodes,
    setGraphEdges,
    isTraversing,
  } = useGraph();

  // Sync database nodes into physics state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;

    const currentNodes = nodesRef.current;
    const nextNodes: PhysicsNode[] = graphNodes.map((n, i) => {
      const existing = currentNodes.find((cn) => cn.id === n.id);
      if (existing) {
        return {
          ...existing,
          label: n.label,
          type: n.type,
          score: n.score,
          targetScore: n.score,
        };
      } else {
        const angle = (i / Math.max(1, graphNodes.length)) * Math.PI * 2 + Math.random() * 0.5;
        const spread = 120 + Math.random() * 80;
        return {
          id: n.id,
          label: n.label,
          type: n.type,
          x: cx + Math.cos(angle) * spread,
          y: cy + Math.sin(angle) * spread,
          vx: 0,
          vy: 0,
          radius: n.type === "show" ? 36 : n.type === "character" ? 30 : 24,
          score: n.score,
          targetScore: n.score,
          connections: [],
        };
      }
    });

    nodesRef.current = nextNodes;

    if (selectedRef.current && !graphNodes.some((n) => n.id === selectedRef.current)) {
      selectedRef.current = null;
      setSelectedNode(null);
    }
  }, [graphNodes]);

  // Audio Assist Speech Announcer
  useEffect(() => {
    if (selectedNode && typeof document !== "undefined" && document.documentElement.dataset.audioAssist === "true") {
      const scorePct = Math.round(selectedNode.score * 100);
      speakText(`${selectedNode.label}. Category: ${selectedNode.type}. Relevance: ${scorePct} percent.`);
    }
  }, [selectedNode]);

  // Thread pulling action
  const handlePullThread = useCallback(async (nodeId: string) => {
    setIsExpanding(true);
    try {
      const result = await pullThread(nodeId);
      if (result.nodes.length > 0) {
        // Merge new nodes
        const existingIds = new Set(graphNodes.map((n) => n.id));
        const newNodes = result.nodes.filter((n) => !existingIds.has(n.id));

        // Merge new edges
        const existingEdgeIds = new Set(graphEdges.map((e) => e.id));
        const newEdges = result.edges.filter((e) => !existingEdgeIds.has(e.id));

        setGraphNodes([...graphNodes, ...newNodes]);
        setGraphEdges([...graphEdges, ...newEdges]);
      }
    } catch (err) {
      console.error("Failed to pull thread:", err);
    } finally {
      setIsExpanding(false);
    }
  }, [graphNodes, graphEdges, setGraphNodes, setGraphEdges]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    const mouse = mouseRef.current;
    const dpr = window.devicePixelRatio || 1;
    const pan = panRef.current;
    const zoom = zoomRef.current;

    // Physics constants - optimized to settle quickly and support prefers-reduced-motion accessibility
    const isReducedMotionClass = typeof document !== "undefined" && document.documentElement.classList.contains("reduced-motion");
    const prefersReducedMotion = (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || isReducedMotionClass;
    const damping = prefersReducedMotion ? 0.80 : 0.96;
    const centerGravity = prefersReducedMotion ? 0.0 : 0.0005;
    const repulsion = prefersReducedMotion ? 0.0 : 1500;
    const spring = prefersReducedMotion ? 0.0 : 0.003;
    const restLength = 120;
    const mouseAttract = prefersReducedMotion ? 0.0 : 0.03;
    const mouseRadius = prefersReducedMotion ? 0.0 : 180;

    // Center gravity
    for (const n of nodes) {
      if (n.fixed) continue;
      n.vx += (cx - n.x) * centerGravity;
      n.vy += (cy - n.y) * centerGravity;
    }

    // Node-node repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
        if (!b.fixed) { b.vx += fx; b.vy += fy; }
      }
    }

    // Edge springs dynamically from graphEdges
    for (const edge of graphEdges) {
      const src = nodes.find((n) => n.id === edge.source);
      const tgt = nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const disp = dist - restLength;
      const force = disp * spring * (edge.confidence || 1.0);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!src.fixed) { src.vx += fx; src.vy += fy; }
      if (!tgt.fixed) { tgt.vx -= fx; tgt.vy -= fy; }
    }

    // Mouse attraction
    const worldMouseX = (mouse.x - pan.x) / zoom;
    const worldMouseY = (mouse.y - pan.y) / zoom;

    if (mouse.active && !dragRef.current) {
      for (const n of nodes) {
        const dx = n.x - worldMouseX;
        const dy = n.y - worldMouseY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < mouseRadius) {
          const strength = (1 - dist / mouseRadius) * mouseAttract;
          n.vx += (dx / dist) * strength * 15;
          n.vy += (dy / dist) * strength * 15;
        }
      }
    }

    // Dragging
    if (dragRef.current) {
      const dNode = nodes.find((n) => n.id === dragRef.current!.nodeId);
      if (dNode) {
        dNode.x = worldMouseX + dragRef.current.offsetX;
        dNode.y = worldMouseY + dragRef.current.offsetY;
        dNode.vx = 0;
        dNode.vy = 0;
        dNode.fixed = true;
      }
    }

    // Hover detection
    let newHoveredId: string | null = null;
    if (mouse.active) {
      for (const n of nodes) {
        const dx = n.x - worldMouseX;
        const dy = n.y - worldMouseY;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 10) {
          newHoveredId = n.id;
          break;
        }
      }
    }

    if (newHoveredId !== hoveredRef.current) {
      hoveredRef.current = newHoveredId;
      const hNode = newHoveredId ? nodes.find((n) => n.id === newHoveredId) || null : null;
      setHoveredNode(hNode);

      if (hNode) {
        hNode.targetScore = 1;
        for (const edge of graphEdges) {
          if (edge.source === hNode.id || edge.target === hNode.id) {
            const nId = edge.source === hNode.id ? edge.target : edge.source;
            const neighbor = nodes.find((n) => n.id === nId);
            if (neighbor) neighbor.targetScore = Math.min(1, 0.5 + (edge.confidence || 1.0) * 0.4);
          }
        }
      } else {
        for (const n of nodes) {
          if (n.id !== selectedRef.current) n.targetScore = n.score;
        }
      }
    }

    // Update coordinates & bounds
    for (const n of nodes) {
      if (n.fixed && n.id !== dragRef.current?.nodeId) n.fixed = false;
      if (!n.fixed) {
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
      }
      const margin = 50;
      if (n.x < margin) { n.x = margin; n.vx *= -0.3; }
      if (n.x > w - margin) { n.x = w - margin; n.vx *= -0.3; }
      if (n.y < margin) { n.y = margin; n.vy *= -0.3; }
      if (n.y > h - margin) { n.y = h - margin; n.vy *= -0.3; }
    }

    // Render Canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // ── Progressive Disclosure Cluster Zoom Hulls ──
    const showClusterZoom = zoom < 0.6;
    if (showClusterZoom) {
      // Group nodes by type and calculate centers of mass
      const typeGroups: Record<string, { x: number; y: number; count: number }> = {};
      for (const node of nodes) {
        if (!typeGroups[node.type]) {
          typeGroups[node.type] = { x: 0, y: 0, count: 0 };
        }
        typeGroups[node.type].x += node.x;
        typeGroups[node.type].y += node.y;
        typeGroups[node.type].count++;
      }

      // Draw cluster bubbles
      for (const [type, data] of Object.entries(typeGroups)) {
        if (data.count === 0) continue;
        const avgX = data.x / data.count;
        const avgY = data.y / data.count;
        const radius = 90 + data.count * 8;
        const typeInfo = TYPE_ICONS[type] || { color: "#888", icon: "◉" };

        // Draw soft bubble background
        ctx.beginPath();
        ctx.arc(avgX, avgY, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${typeInfo.color}09`;
        ctx.fill();

        ctx.strokeStyle = `${typeInfo.color}1c`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label in the center of the bubble
        ctx.fillStyle = typeInfo.color;
        ctx.font = "bold 14px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = type === "show" ? "Media Cluster" : type === "character" ? "Characters Cluster" : type === "trait" ? "Traits Cluster" : "Concepts Cluster";
        ctx.fillText(`${typeInfo.icon} ${label}`, avgX, avgY);
      }
    }

    // Draw Edges
    for (const edge of graphEdges) {
      const src = nodes.find((n) => n.id === edge.source);
      const tgt = nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) continue;

      const isActive = hoveredRef.current && (edge.source === hoveredRef.current || edge.target === hoveredRef.current);
      const isSelectedEdge = selectedRef.current && (edge.source === selectedRef.current || edge.target === selectedRef.current);

      ctx.beginPath();
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y + tgt.y) / 2;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const cpx = mx - dy * 0.12;
      const cpy = my + dx * 0.12;
      ctx.moveTo(src.x, src.y);
      ctx.quadraticCurveTo(cpx, cpy, tgt.x, tgt.y);

      if (isActive || isSelectedEdge) {
        const grad = ctx.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
        grad.addColorStop(0, scoreToColor(src.score).replace("rgb", "rgba").replace(")", ",0.66)"));
        grad.addColorStop(1, scoreToColor(tgt.score).replace("rgb", "rgba").replace(")", ",0.66)"));
        ctx.strokeStyle = grad;
        ctx.lineWidth = isActive ? 2.5 : 1.8;
        ctx.globalAlpha = isActive ? 0.9 : 0.6;
      } else {
        ctx.strokeStyle = edge.sourceOfTruth === "user_explicit" ? "rgba(77,88,115,0.2)" : "rgba(77,88,115,0.08)";
        ctx.lineWidth = edge.sourceOfTruth === "user_explicit" ? 1 : 0.6;
        if (edge.sourceOfTruth === "system_inferred") ctx.setLineDash([3, 3]);
        ctx.globalAlpha = showClusterZoom ? 0.15 : 0.5;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Render active Shift-drag or Click-connect preview lines
    const activeConnectSrcId = connectingRef.current?.sourceId || connectModeSourceId;
    if (activeConnectSrcId) {
      const src = nodes.find((n) => n.id === activeConnectSrcId);
      if (src) {
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(worldMouseX, worldMouseY);
        ctx.strokeStyle = "rgba(219, 39, 119, 0.85)"; // bright magenta
        ctx.lineWidth = 2.0;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target hover outline during drag
        let hoveredTarget: PhysicsNode | null = null;
        for (const n of nodes) {
          if (n.id !== src.id) {
            const dx = n.x - worldMouseX;
            const dy = n.y - worldMouseY;
            if (Math.sqrt(dx * dx + dy * dy) < n.radius + 15) {
              hoveredTarget = n;
              break;
            }
          }
        }

        if (hoveredTarget) {
          ctx.beginPath();
          ctx.arc(hoveredTarget.x, hoveredTarget.y, hoveredTarget.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(219, 39, 119, 0.6)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Draw Nodes (only if zoom is high enough to show full detail, else fade them slightly)
    for (const node of nodes) {
      const isHovered = hoveredRef.current === node.id;
      const isSelected = selectedRef.current === node.id;
      const isNeighbor = hoveredRef.current && graphEdges.some(
        (e) => (e.source === hoveredRef.current && e.target === node.id) || (e.target === hoveredRef.current && e.source === node.id)
      );

      const r = node.radius * (isHovered ? 1.18 : isSelected ? 1.1 : 1);
      const color = scoreToColor(node.score);

      ctx.globalAlpha = showClusterZoom ? 0.35 : 1.0;

      // Glow effect
      if (node.score > 0.25 || isHovered || isSelected) {
        const glowR = r + 10 + node.score * 16;
        const glowGrad = ctx.createRadialGradient(node.x, node.y, r * 0.3, node.x, node.y, glowR);
        glowGrad.addColorStop(0, color.replace("rgb", "rgba").replace(")", `,${0.12 + node.score * 0.12})`));
        glowGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // Body Gradient
      const nodeGrad = ctx.createRadialGradient(
        node.x - r * 0.2, node.y - r * 0.2, r * 0.05,
        node.x, node.y, r
      );
      nodeGrad.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.4)"));
      nodeGrad.addColorStop(0.6, color.replace("rgb", "rgba").replace(")", ",0.15)"));
      nodeGrad.addColorStop(1, color.replace("rgb", "rgba").replace(")", ",0.06)"));

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeGrad;
      ctx.fill();

      // Border
      const borderAlpha = isHovered ? 0.9 : isSelected ? 0.7 : isNeighbor ? 0.4 : 0.18;
      ctx.strokeStyle = color.replace("rgb", "rgba").replace(")", `,${borderAlpha})`);
      ctx.lineWidth = isHovered ? 2.5 : isSelected ? 2 : 1;
      ctx.stroke();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = color.replace("rgb", "rgba").replace(")", ",0.3)");
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Emojis and details
      const emoji = TYPE_EMOJI[node.type] || "◉";
      ctx.font = `${r * 0.45}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = showClusterZoom ? 0.2 : isHovered ? 1 : 0.7;
      ctx.fillText(emoji, node.x, node.y - r * 0.15);

      // Node Label
      const fontSize = isHovered ? 11 : 9;
      ctx.font = `${isHovered ? 600 : 400} ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isHovered ? "#ffffff" : isNeighbor ? "rgba(232,236,244,0.85)" : "rgba(232,236,244,0.5)";
      ctx.fillText(node.label, node.x, node.y + r * 0.25);
    }

    ctx.restore();
    frameRef.current = requestAnimationFrame(simulate);
  }, [graphEdges]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.style.width = container.clientWidth + "px";
      canvas.style.height = container.clientHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);
    frameRef.current = requestAnimationFrame(simulate);

    // Mouse & Touch events
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const onMouseLeave = () => { mouseRef.current.active = false; };

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const my = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      for (const n of nodesRef.current) {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 6) {
          if (e.shiftKey) {
            connectingRef.current = { sourceId: n.id };
          } else {
            dragRef.current = { nodeId: n.id, offsetX: dx, offsetY: dy };
            n.fixed = true;
          }
          return;
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (connectingRef.current) {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const my = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
        
        let targetNode: PhysicsNode | null = null;
        for (const n of nodesRef.current) {
          if (n.id !== connectingRef.current.sourceId) {
            const dx = n.x - mx;
            const dy = n.y - my;
            if (Math.sqrt(dx * dx + dy * dy) < n.radius + 15) {
              targetNode = n;
              break;
            }
          }
        }

        if (targetNode) {
          const sourceId = connectingRef.current.sourceId;
          const targetId = targetNode.id;
          
          // Optimistically add edge locally
          const newEdgeId = `temp-edge-${Date.now()}`;
          setGraphEdges([
            ...graphEdges,
            {
              id: newEdgeId,
              source: sourceId,
              target: targetId,
              edgeType: "likes",
              confidence: 1.0,
              sourceOfTruth: "user_explicit"
            }
          ]);
          
          connectNodesAction(sourceId, targetId).catch((err) => {
            console.error("Failed to connect nodes:", err);
            setGraphEdges((prev) => prev.filter((e) => e.id !== newEdgeId));
          });
        }
        connectingRef.current = null;
      }

      if (dragRef.current) {
        const dNode = nodesRef.current.find((n) => n.id === dragRef.current!.nodeId);
        if (dNode) dNode.fixed = false;
        dragRef.current = null;
      }
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const my = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      let clicked: PhysicsNode | null = null;
      for (const n of nodesRef.current) {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 6) {
          clicked = n;
          break;
        }
      }
      
      if (clicked) {
        if (connectModeSourceId) {
          if (clicked.id !== connectModeSourceId) {
            const sourceId = connectModeSourceId;
            const targetId = clicked.id;
            
            // Optimistically add edge
            const newEdgeId = `temp-edge-${Date.now()}`;
            setGraphEdges([
              ...graphEdges,
              {
                id: newEdgeId,
                source: sourceId,
                target: targetId,
                edgeType: "likes",
                confidence: 1.0,
                sourceOfTruth: "user_explicit"
              }
            ]);
            
            connectNodesAction(sourceId, targetId).catch((err) => {
              console.error("Failed to connect nodes:", err);
              setGraphEdges((prev) => prev.filter((e) => e.id !== newEdgeId));
            });
            
            setConnectModeSourceId(null);
            selectedRef.current = clicked.id;
            setSelectedNode(clicked);
          } else {
            setConnectModeSourceId(null);
          }
        } else {
          selectedRef.current = clicked.id;
          setSelectedNode(clicked);
        }
      } else {
        selectedRef.current = null;
        setSelectedNode(null);
        setConnectModeSourceId(null);
      }
    };

    const onDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const my = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      for (const n of nodesRef.current) {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 6) {
          handlePullThread(n.id);
          break;
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      zoomRef.current = Math.max(0.3, Math.min(3, zoomRef.current * delta));
    };

    // Mobile touch events
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const mx = (touch.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const my = (touch.clientY - rect.top - panRef.current.y) / zoomRef.current;
        
        let clicked: PhysicsNode | null = null;
        for (const n of nodesRef.current) {
          const dx = n.x - mx;
          const dy = n.y - my;
          if (Math.sqrt(dx * dx + dy * dy) < n.radius + 12) {
            clicked = n;
            dragRef.current = { nodeId: n.id, offsetX: dx, offsetY: dy };
            n.fixed = true;
            break;
          }
        }
        
        if (clicked) {
          if (connectModeSourceId && clicked.id !== connectModeSourceId) {
            const sourceId = connectModeSourceId;
            const targetId = clicked.id;
            const newEdgeId = `temp-edge-${Date.now()}`;
            setGraphEdges([
              ...graphEdges,
              { id: newEdgeId, source: sourceId, target: targetId, edgeType: "likes", confidence: 1.0, sourceOfTruth: "user_explicit" }
            ]);
            connectNodesAction(sourceId, targetId).catch((err) => {
              setGraphEdges((prev) => prev.filter((e) => e.id !== newEdgeId));
            });
            setConnectModeSourceId(null);
          }
          selectedRef.current = clicked.id;
          setSelectedNode(clicked);
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && dragRef.current) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
          active: true,
        };
      }
    };

    const onTouchEnd = () => {
      if (dragRef.current) {
        const dNode = nodesRef.current.find((n) => n.id === dragRef.current!.nodeId);
        if (dNode) dNode.fixed = false;
        dragRef.current = null;
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    
    // Add touch support for mobile friendliness
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("wheel", onWheel);
      
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [simulate, handlePullThread]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair block" />

      {/* Node detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            key={selectedNode.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-6 left-6 glass rounded-2xl p-5 max-w-xs pointer-events-auto z-45"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{
                  background: `${scoreToColor(selectedNode.score).replace("rgb", "rgba").replace(")", ",0.15)")}`,
                  border: `1px solid ${scoreToColor(selectedNode.score).replace("rgb", "rgba").replace(")", ",0.3)")}`,
                }}
              >
                {TYPE_EMOJI[selectedNode.type]}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{selectedNode.label}</h3>
                <p className="text-xs text-[var(--fg-muted)] capitalize">{selectedNode.type}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--fg-muted)]">Relevance</span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: scoreToColor(selectedNode.score) }}
                  >
                    {Math.round(selectedNode.score * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedNode.score * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      background: `linear-gradient(90deg, ${scoreToColor(0)}, ${scoreToColor(selectedNode.score)})`,
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      addSeed({
                        id: selectedNode.id,
                        label: selectedNode.label,
                        type: selectedNode.type as any,
                        score: selectedNode.score,
                        temperature: selectedNode.score < 0.3 ? "cold" : selectedNode.score < 0.6 ? "warm" : "hot",
                        slug: selectedNode.label.toLowerCase().replace(/\s+/g, "-"),
                      })
                    }
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] hover:shadow-[0_0_16px_rgba(96,212,200,0.3)] transition-all duration-300"
                  >
                    + Seed
                  </button>
                  <button
                    onClick={() => handlePullThread(selectedNode.id)}
                    disabled={isExpanding}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--glass-border)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {isExpanding && <div className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />}
                    Pull Thread
                  </button>
                </div>
                <button
                  onClick={() => setConnectModeSourceId(selectedNode.id)}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 ${
                    connectModeSourceId === selectedNode.id
                      ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/40 text-[var(--brand-primary)]"
                      : "bg-[var(--bg-elevated)] border-[var(--glass-border)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {connectModeSourceId === selectedNode.id ? "⚡ Select another node to link..." : "🔗 Chaining: Connect Node"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredNode && !selectedNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-4 right-4 glass rounded-full px-3 py-1.5 flex items-center gap-2 pointer-events-none z-45"
          >
            <div
              className="w-2 h-2 rounded-full animate-breathe"
              style={{ backgroundColor: scoreToColor(hoveredNode.score) }}
            />
            <span className="text-xs font-medium" style={{ color: scoreToColor(hoveredNode.score) }}>
              {hoveredNode.score < 0.3 ? "Cold" : hoveredNode.score < 0.6 ? "Warm" : "Hot"}
            </span>
            <span className="text-xs text-[var(--fg-muted)]">•</span>
            <span className="text-xs text-[var(--fg-secondary)]">
              {TYPE_EMOJI[hoveredNode.type]} {hoveredNode.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas controls */}
      <div className="absolute bottom-6 right-6 glass rounded-xl p-1.5 flex flex-col gap-1 pointer-events-auto z-45">
        <button
          onClick={() => { zoomRef.current = Math.min(3, zoomRef.current * 1.2); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-hover)] transition-all text-lg font-bold"
          title="Zoom in"
        >
          +
        </button>
        <div className="h-px bg-[var(--glass-border)]" />
        <button
          onClick={() => { zoomRef.current = Math.max(0.3, zoomRef.current * 0.8); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-hover)] transition-all text-lg font-bold"
          title="Zoom out"
        >
          −
        </button>
        <div className="h-px bg-[var(--glass-border)]" />
        <button
          onClick={() => { zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-hover)] transition-all text-xs font-mono"
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      {/* Temperature legend */}
      <div className="absolute top-4 left-4 glass rounded-lg px-3 py-1.5 flex items-center gap-2 pointer-events-none z-45">
        <span className="text-[10px] text-[var(--fg-muted)] font-mono">Cold</span>
        <div className="w-20 h-1.5 rounded-full temp-gradient" />
        <span className="text-[10px] text-[var(--fg-muted)] font-mono">Hot</span>
      </div>
    </div>
  );
}
