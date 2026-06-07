import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nodes } from "@/lib/schema";
import { ilike, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || !q.trim()) {
    return NextResponse.json([]);
  }

  try {
    const term = q.trim();
    // Query nodes that match the query in display name or slug
    const results = await db
      .select({
        id: nodes.id,
        label: nodes.displayName,
        type: nodes.type,
        slug: nodes.slug,
        score: nodes.id, // we will return 0 for matching seeds initially
      })
      .from(nodes)
      .where(
        or(
          ilike(nodes.displayName, `%${term}%`),
          ilike(nodes.slug, `%${term}%`)
        )
      )
      .limit(10);

    // Format the results to match GraphNodeData interface
    const formatted = results.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      slug: n.slug,
      score: 0.0,
      temperature: "cold" as const,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
