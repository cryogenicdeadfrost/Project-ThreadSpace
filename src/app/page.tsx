"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AccessibilityMenu } from "@/components/accessibility-menu";

/* ================================================================
   THREADSPACE — Landing Page
   Interactive physics-based graph hero · Glassmorphism UI
   ================================================================ */

// ── Demo Graph Data ──────────────────────────────────────────────
interface GraphNode {
  id: string;
  label: string;
  type: "person" | "show" | "character" | "trait" | "concept";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  temperature: number; // 0 = cold, 1 = hot
  targetTemp: number;
  connections: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  type: "explicit" | "inferred";
  strength: number;
}

const DEMO_NODES: Omit<GraphNode, "x" | "y" | "vx" | "vy" | "temperature" | "targetTemp">[] = [
  { id: "n1", label: "Dry Humor", type: "trait", radius: 28, connections: ["n2", "n3", "n7"] },
  { id: "n2", label: "The Office", type: "show", radius: 34, connections: ["n1", "n4", "n5"] },
  { id: "n3", label: "Sarcasm", type: "trait", radius: 24, connections: ["n1", "n4", "n8"] },
  { id: "n4", label: "Jim Halpert", type: "character", radius: 30, connections: ["n2", "n3", "n6"] },
  { id: "n5", label: "Parks & Rec", type: "show", radius: 26, connections: ["n2", "n7", "n9"] },
  { id: "n6", label: "Pranks", type: "trait", radius: 20, connections: ["n4", "n8"] },
  { id: "n7", label: "Sitcom Fan", type: "concept", radius: 32, connections: ["n1", "n5", "n10"] },
  { id: "n8", label: "Strategic", type: "trait", radius: 22, connections: ["n3", "n6", "n11"] },
  { id: "n9", label: "Leslie Knope", type: "character", radius: 26, connections: ["n5", "n10"] },
  { id: "n10", label: "Optimism", type: "trait", radius: 24, connections: ["n7", "n9", "n12"] },
  { id: "n11", label: "Ben 10", type: "show", radius: 22, connections: ["n8", "n12"] },
  { id: "n12", label: "Sci-Fi Fan", type: "concept", radius: 26, connections: ["n10", "n11"] },
];

const DEMO_EDGES: GraphEdge[] = DEMO_NODES.flatMap((node) =>
  node.connections.map((target) => ({
    source: node.id,
    target,
    type: (Math.random() > 0.3 ? "explicit" : "inferred") as "explicit" | "inferred",
    strength: 0.4 + Math.random() * 0.6,
  }))
).filter(
  (edge, i, arr) =>
    arr.findIndex(
      (e) =>
        (e.source === edge.source && e.target === edge.target) ||
        (e.source === edge.target && e.target === edge.source)
    ) === i
);

// ── Color Utilities ──────────────────────────────────────────────
function tempToColor(t: number): string {
  if (t < 0.33) {
    const p = t / 0.33;
    return lerpColor([56, 189, 248], [45, 212, 191], p);
  } else if (t < 0.66) {
    const p = (t - 0.33) / 0.33;
    return lerpColor([45, 212, 191], [245, 158, 11], p);
  } else {
    const p = (t - 0.66) / 0.34;
    return lerpColor([245, 158, 11], [249, 112, 102], p);
  }
}

function lerpColor(a: number[], b: number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function tempToGlow(t: number): string {
  const color = tempToColor(t);
  const alpha = 0.15 + t * 0.2;
  return `0 0 ${12 + t * 24}px ${color.replace("rgb", "rgba").replace(")", `,${alpha})`)}`;
}

const TYPE_ICONS: Record<string, string> = {
  person: "👤",
  show: "📺",
  character: "🎭",
  trait: "✦",
  concept: "◈",
};

// ── Physics Engine (Canvas) ──────────────────────────────────────
function usePhysicsGraph(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const nodesRef = useRef<GraphNode[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const hoveredRef = useRef<string | null>(null);
  const frameRef = useRef<number>(0);
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;

    nodesRef.current = DEMO_NODES.map((n, i) => {
      const angle = (i / DEMO_NODES.length) * Math.PI * 2;
      const spread = 120 + Math.random() * 80;
      return {
        ...n,
        x: cx + Math.cos(angle) * spread,
        y: cy + Math.sin(angle) * spread,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        temperature: Math.random() * 0.5,
        targetTemp: Math.random(),
      };
    });
  }, [canvasRef]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    const mouse = mouseRef.current;
    const dpr = window.devicePixelRatio || 1;

    // --- Physics step ---
    const damping = 0.985;
    const centerGravity = 0.0008;
    const repulsion = 1800;
    const edgeSpring = 0.003;
    const edgeRestLength = 110;
    const mouseForce = 0.06;
    const mouseRadius = 140;

    // Center gravity
    for (const n of nodes) {
      n.vx += (cx - n.x) * centerGravity;
      n.vy += (cy - n.y) * centerGravity;
    }

    // Repulsion (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Edge springs
    for (const edge of DEMO_EDGES) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - edgeRestLength;
      const force = displacement * edgeSpring * edge.strength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Mouse interaction
    if (mouse.active) {
      for (const n of nodes) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < mouseRadius) {
          const strength = (1 - dist / mouseRadius) * mouseForce;
          n.vx += (dx / dist) * strength * 30;
          n.vy += (dy / dist) * strength * 30;
          n.targetTemp = Math.min(1, n.targetTemp + 0.02);
        }
      }
    }

    // Hovered node detection
    let newHovered: GraphNode | null = null;
    if (mouse.active) {
      for (const n of nodes) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 8) {
          newHovered = n;
          break;
        }
      }
    }
    if (newHovered?.id !== hoveredRef.current) {
      hoveredRef.current = newHovered?.id || null;
      setHovered(newHovered);
      // When hovering a node, heat it and its neighbors
      if (newHovered) {
        newHovered.targetTemp = 1;
        for (const edge of DEMO_EDGES) {
          if (edge.source === newHovered.id || edge.target === newHovered.id) {
            const neighborId = edge.source === newHovered.id ? edge.target : edge.source;
            const neighbor = nodes.find((n) => n.id === neighborId);
            if (neighbor) neighbor.targetTemp = 0.6 + Math.random() * 0.3;
          }
        }
      } else {
        // Cool down on unhover
        for (const n of nodes) n.targetTemp = 0.1 + Math.random() * 0.35;
      }
    }

    // Apply velocity and damping
    for (const n of nodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;

      // Bounds
      const margin = 40;
      if (n.x < margin) { n.x = margin; n.vx *= -0.5; }
      if (n.x > w - margin) { n.x = w - margin; n.vx *= -0.5; }
      if (n.y < margin) { n.y = margin; n.vy *= -0.5; }
      if (n.y > h - margin) { n.y = h - margin; n.vy *= -0.5; }

      // Temperature interpolation
      n.temperature += (n.targetTemp - n.temperature) * 0.04;
    }

    // --- Render ---
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw edges
    for (const edge of DEMO_EDGES) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;

      const isConnectedToHovered =
        hoveredRef.current &&
        (edge.source === hoveredRef.current || edge.target === hoveredRef.current);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);

      // Subtle curve
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const controlX = midX - dy * 0.1;
      const controlY = midY + dx * 0.1;
      ctx.quadraticCurveTo(controlX, controlY, target.x, target.y);

      if (isConnectedToHovered) {
        const grad = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        grad.addColorStop(0, tempToColor(source.temperature) + "90");
        grad.addColorStop(1, tempToColor(target.temperature) + "90");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
      } else {
        ctx.strokeStyle = edge.type === "explicit" ? "rgba(77,88,115,0.25)" : "rgba(77,88,115,0.12)";
        ctx.lineWidth = edge.type === "explicit" ? 1.2 : 0.8;
        if (edge.type === "inferred") ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.6;
      }

      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = hoveredRef.current === node.id;
      const isNeighbor =
        hoveredRef.current &&
        DEMO_EDGES.some(
          (e) =>
            (e.source === hoveredRef.current && e.target === node.id) ||
            (e.target === hoveredRef.current && e.source === node.id)
        );
      const r = node.radius * (isHovered ? 1.15 : 1);
      const color = tempToColor(node.temperature);

      // Glow ring
      if (node.temperature > 0.3 || isHovered) {
        const glowRadius = r + 8 + node.temperature * 12;
        const glowGrad = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, glowRadius);
        glowGrad.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.15)"));
        glowGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // Node body
      const grad = ctx.createRadialGradient(
        node.x - r * 0.25,
        node.y - r * 0.25,
        r * 0.1,
        node.x,
        node.y,
        r
      );
      grad.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.35)"));
      grad.addColorStop(1, color.replace("rgb", "rgba").replace(")", ",0.1)"));
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.strokeStyle = color.replace("rgb", "rgba").replace(")", `,${isHovered ? 0.8 : isNeighbor ? 0.5 : 0.25})`);
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.font = `${isHovered ? 600 : 400} ${isHovered ? 11 : 9.5}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isHovered
        ? "#fff"
        : isNeighbor
        ? "rgba(232,236,244,0.9)"
        : "rgba(232,236,244,0.55)";
      ctx.fillText(node.label, node.x, node.y);
    }

    frameRef.current = requestAnimationFrame(simulate);
  }, [canvasRef]);

  return { init, simulate, mouseRef, hovered, frameRef };
}

// ── Floating Particles Background ────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: { x: number; y: number; r: number; vx: number; vy: number; alpha: number }[] = [];
    const count = 60;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 0.5 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: 0.1 + Math.random() * 0.25,
      });
    }

    let frame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 212, 200, ${p.alpha})`;
        ctx.fill();
      }
      // Draw faint connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(96, 212, 200, ${0.04 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

// ── Navigation ───────────────────────────────────────────────────
function Nav() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between font-medium">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#60d4c8] to-[#38bdf8] flex items-center justify-center">
            <span className="text-[#05080f] font-bold text-sm">T</span>
          </div>
          <span className="font-[var(--font-outfit)] text-lg font-semibold tracking-tight text-[var(--fg-primary)]">
            ThreadSpace
          </span>
        </div>

        <div className="flex items-center gap-3">
          <AccessibilityMenu />
          <a
            href="/explore"
            className="px-4 py-2 text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors duration-200"
          >
            Explore
          </a>
          <a
            href="/login"
            className="px-5 py-2 text-sm rounded-full glass text-[var(--fg-primary)] hover:border-[rgba(96,212,200,0.3)] transition-all duration-300"
          >
            Sign In
          </a>
          <a
            href="/register"
            className="px-5 py-2 text-sm rounded-full bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] font-medium hover:shadow-[0_0_24px_rgba(96,212,200,0.3)] transition-all duration-300"
          >
            Create Identity
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

// ── Feature Card ─────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="glass rounded-2xl p-6 cursor-default group"
    >
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-[var(--fg-primary)] mb-2 group-hover:text-[var(--brand-primary)] transition-colors duration-300">
        {title}
      </h3>
      <p className="text-sm text-[var(--fg-secondary)] leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ── Temperature Pill ─────────────────────────────────────────────
function TempPill({ node }: { node: GraphNode }) {
  const color = tempToColor(node.temperature);
  const label = node.temperature < 0.33 ? "Cold" : node.temperature < 0.66 ? "Warm" : "Hot";
  return (
    <div
      className="absolute top-4 right-4 glass rounded-full px-3 py-1 flex items-center gap-2 pointer-events-none"
      style={{ zIndex: 40 }}
    >
      <div className="w-2 h-2 rounded-full animate-breathe" style={{ backgroundColor: color }} />
      <span className="text-xs font-medium" style={{ color }}>
        {label}
      </span>
      <span className="text-xs text-[var(--fg-muted)]">•</span>
      <span className="text-xs text-[var(--fg-secondary)]">
        {TYPE_ICONS[node.type]} {node.label}
      </span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { init, simulate, mouseRef, hovered, frameRef } = usePhysicsGraph(canvasRef);

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

    init();
    frameRef.current = requestAnimationFrame(simulate);

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };
    const onLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener("mousemove", onMouse);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [init, simulate, mouseRef, frameRef]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <ParticleField />
      <div className="bg-mesh fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />
      <Nav />

      {/* ── Hero ── */}
      <section className="relative z-10 pt-28 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[70vh]">
            {/* Left — Copy */}
            <div className="stagger-children">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-breathe" />
                  <span className="text-xs text-[var(--fg-secondary)] font-medium tracking-wider uppercase">
                    Graph-Native Discovery
                  </span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                <span className="text-[var(--fg-primary)]">Every identity is a</span>
                <br />
                <span className="bg-gradient-to-r from-[#60d4c8] via-[#38bdf8] to-[#a78bfa] bg-clip-text text-transparent">
                  thread in the graph
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-lg text-[var(--fg-secondary)] max-w-lg leading-relaxed mb-8"
              >
                Step into a living ontology of traits, fandoms, and personalities.
                Pull threads, discover kindred spirits, and watch the graph
                react to your every move.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap gap-4"
              >
                <a
                  href="/register"
                  className="group relative px-7 py-3.5 rounded-full bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] font-semibold text-sm overflow-hidden transition-all duration-300 hover:shadow-[0_0_32px_rgba(96,212,200,0.35)]"
                >
                  <span className="relative z-10">Create Your Identity</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#38bdf8] to-[#a78bfa] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </a>
                <a
                  href="/explore"
                  className="px-7 py-3.5 rounded-full glass text-[var(--fg-primary)] font-medium text-sm hover:border-[rgba(96,212,200,0.3)] transition-all duration-300 flex items-center gap-2"
                >
                  <span>Explore the Graph</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="flex gap-8 mt-12"
              >
                {[
                  { value: "∞", label: "Connections" },
                  { value: "3", label: "Hop Depth" },
                  { value: "$0", label: "Forever Free" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl font-bold text-[var(--brand-primary)]">{stat.value}</div>
                    <div className="text-xs text-[var(--fg-muted)] mt-1">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — Interactive Graph Canvas */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              ref={containerRef}
              className="relative w-full h-[500px] lg:h-[560px] rounded-3xl overflow-hidden"
            >
              {/* Ambient glow behind canvas */}
              <div className="absolute inset-0 bg-gradient-to-br from-[rgba(96,212,200,0.05)] via-transparent to-[rgba(249,112,102,0.03)] rounded-3xl" />
              <div className="absolute inset-0 border border-[var(--glass-border)] rounded-3xl pointer-events-none" style={{ zIndex: 30 }} />

              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                style={{ display: "block" }}
              />

              {/* Hovered node tooltip */}
              <AnimatePresence>
                {hovered && <TempPill node={hovered} />}
              </AnimatePresence>

              {/* Corner label */}
              <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-1.5 pointer-events-none" style={{ zIndex: 30 }}>
                <span className="text-[10px] text-[var(--fg-muted)] font-mono tracking-wider uppercase">
                  Live Graph • Hover to explore
                </span>
              </div>

              {/* Temperature legend */}
              <div className="absolute bottom-4 right-4 glass rounded-lg px-3 py-1.5 flex items-center gap-2 pointer-events-none" style={{ zIndex: 30 }}>
                <span className="text-[10px] text-[var(--fg-muted)]">Cold</span>
                <div className="w-16 h-1.5 rounded-full temp-gradient" />
                <span className="text-[10px] text-[var(--fg-muted)]">Hot</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-3xl lg:text-4xl font-bold mb-4"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              One graph.{" "}
              <span className="bg-gradient-to-r from-[#60d4c8] to-[#f59e0b] bg-clip-text text-transparent">
                Infinite discovery.
              </span>
            </h2>
            <p className="text-[var(--fg-secondary)] max-w-xl mx-auto">
              Every feature is a constrained traversal of the same canonical graph.
              No parallel data models — one source of truth.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🌡️"
              title="Hot-Cold Scoring"
              description="Nodes heat up as you get closer to matching identities. The teal→amber→coral ramp shows real similarity scores computed via TF-IDF and cosine distance."
              delay={0}
            />
            <FeatureCard
              icon="🧵"
              title="Thread Pulling"
              description="Drag an edge and pull it outward. Watch new nodes emerge from the fabric of the graph, extending your traversal one hop at a time."
              delay={0.1}
            />
            <FeatureCard
              icon="🔍"
              title="Semantic Search"
              description="Type a name and the graph expands. Fuzzy matching plus query expansion means searching 'Jim Halpert' also surfaces sarcasm and pranks."
              delay={0.2}
            />
            <FeatureCard
              icon="🎭"
              title="Identity Cards"
              description="Build your one permanent card: shows, characters, traits, personality markers. Each becomes a node connected to the universal graph."
              delay={0.3}
            />
            <FeatureCard
              icon="🧠"
              title="Ontology Inference"
              description="The system learns relationships you never typed. Co-occurrence mining and PMI analysis connect concepts that consistently appear together."
              delay={0.4}
            />
            <FeatureCard
              icon="🔗"
              title="Challenge Links"
              description="Share a mystery link with friends. They traverse the graph using your clue nodes, racing to find your hidden identity card."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-3xl lg:text-4xl font-bold mb-4"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              How it{" "}
              <span className="bg-gradient-to-r from-[#f59e0b] to-[#f97066] bg-clip-text text-transparent">
                works
              </span>
            </h2>
          </motion.div>

          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Create your identity card",
                desc: "Add your favorite shows, characters, personality traits, and interests. Each becomes a node in the graph.",
                color: "#60d4c8",
              },
              {
                step: "02",
                title: "The graph connects you",
                desc: "Your nodes link to existing concepts. Jim Halpert connects to sarcasm, which connects to dry humor lovers everywhere.",
                color: "#38bdf8",
              },
              {
                step: "03",
                title: "Explore and pull threads",
                desc: "Navigate the graph. Hot nodes mean high similarity. Pull edges to explore deeper. Find your people.",
                color: "#f59e0b",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="glass rounded-2xl p-6 flex items-start gap-6 group hover:border-[rgba(96,212,200,0.2)] transition-all duration-500"
              >
                <div
                  className="text-4xl font-bold font-mono opacity-30 group-hover:opacity-70 transition-opacity duration-500"
                  style={{ color: item.color, fontFamily: "var(--font-mono)" }}
                >
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-[var(--fg-secondary)]">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto text-center glass rounded-3xl p-12"
        >
          <h2
            className="text-3xl lg:text-4xl font-bold mb-4"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Ready to find your{" "}
            <span className="bg-gradient-to-r from-[#60d4c8] via-[#38bdf8] to-[#a78bfa] bg-clip-text text-transparent">
              threads
            </span>
            ?
          </h2>
          <p className="text-[var(--fg-secondary)] mb-8 max-w-lg mx-auto">
            Join ThreadSpace and become a node in the world&apos;s most interesting knowledge graph.
            Free forever. No ads. No algorithms hiding your connections.
          </p>
          <a
            href="/register"
            className="inline-block px-8 py-4 rounded-full bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] font-semibold hover:shadow-[0_0_40px_rgba(96,212,200,0.35)] transition-all duration-300"
          >
            Create Your Identity Card
          </a>
          <p className="text-xs text-[var(--fg-muted)] mt-4">No credit card • Free forever • Open source</p>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-8 px-6 border-t border-[var(--glass-border)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#60d4c8] to-[#38bdf8] flex items-center justify-center">
              <span className="text-[#05080f] font-bold text-[10px]">T</span>
            </div>
            <span className="text-sm text-[var(--fg-muted)]">ThreadSpace</span>
          </div>
          <p className="text-xs text-[var(--fg-muted)]">
            Graph-native identity discovery • Built with Next.js, Neon, and React Flow
          </p>
        </div>
      </footer>
    </div>
  );
}
