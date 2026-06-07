import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { slugify } from "./slugify";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const SHOWS = [
  "The Office",
  "Parks & Rec",
  "Breaking Bad",
  "Friends",
  "Stranger Things",
  "Ben 10",
  "Avatar: TLA",
  "Naruto",
  "One Piece",
  "Attack on Titan",
  "Game of Thrones",
  "The Mandalorian",
  "Brooklyn Nine-Nine",
  "Suits",
  "How I Met Your Mother",
  "Seinfeld",
  "The Good Place",
  "Better Call Saul",
];

const CHARACTERS_BY_SHOW: Record<string, string[]> = {
  "The Office": ["Jim Halpert", "Michael Scott", "Dwight Schrute", "Pam Beesly"],
  "Parks & Rec": ["Leslie Knope", "Ron Swanson", "Ben Wyatt", "Andy Dwyer"],
  "Breaking Bad": ["Walter White", "Jesse Pinkman", "Saul Goodman"],
  "Friends": ["Chandler Bing", "Joey Tribbiani", "Monica Geller", "Rachel Green"],
  "Stranger Things": ["Eleven", "Mike Wheeler", "Dustin Henderson"],
  "Ben 10": ["Ben Tennyson", "Gwen Tennyson", "Kevin Levin"],
  "Avatar: TLA": ["Aang", "Zuko", "Katara", "Sokka", "Toph Beifong"],
  "Naruto": ["Naruto Uzumaki", "Sasuke Uchiha", "Kakashi Hatake"],
  "One Piece": ["Monkey D. Luffy", "Roronoa Zoro", "Nami"],
  "Attack on Titan": ["Eren Yeager", "Mikasa Ackerman", "Levi Ackerman"],
  "Game of Thrones": ["Jon Snow", "Daenerys Targaryen", "Tyrion Lannister"],
  "The Mandalorian": ["Din Djarin", "Grogu"],
  "Brooklyn Nine-Nine": ["Jake Peralta", "Amy Santiago", "Captain Holt"],
  "Suits": ["Harvey Specter", "Mike Ross", "Donna Paulsen"],
  "How I Met Your Mother": ["Ted Mosby", "Barney Stinson", "Robin Scherbatsky"],
  "Seinfeld": ["Jerry Seinfeld", "George Costanza", "Elaine Benes", "Cosmo Kramer"],
  "The Good Place": ["Eleanor Shellstrop", "Chidi Anagonye", "Tahani Al-Jamil"],
  "Better Call Saul": ["Jimmy McGill", "Kim Wexler", "Mike Ehrmantraut"],
};

const TRAITS = [
  "Sarcasm",
  "Dry Humor",
  "Optimism",
  "Strategic Thinking",
  "Leadership",
  "Introvert",
  "Extrovert",
  "Creative",
  "Analytical",
  "Empathetic",
  "Adventurous",
  "Curious",
  "Loyal",
  "Nerdy",
  "Ambitious",
  "Calm",
  "INTJ",
  "ENFP",
  "INFP",
  "ENTP",
  "ISFJ",
  "INTP",
];

async function seed() {
  console.log("🌱 Starting database seeding...");

  // 1. Insert shows and characters, create edges between them
  for (const showName of SHOWS) {
    const showSlug = slugify(showName);
    console.log(`Inserting show: ${showName} (${showSlug})`);

    // Insert show node
    const showNodes = await db
      .insert(schema.nodes)
      .values({
        type: "show",
        slug: showSlug,
        displayName: showName,
        visibility: "public",
      })
      .onConflictDoUpdate({
        target: schema.nodes.slug,
        set: { displayName: showName },
      })
      .returning();

    const showNodeId = showNodes[0].id;

    // Insert characters for this show
    const characters = CHARACTERS_BY_SHOW[showName] || [];
    for (const charName of characters) {
      const charSlug = slugify(charName);
      console.log(`  Inserting character: ${charName} (${charSlug})`);

      const charNodes = await db
        .insert(schema.nodes)
        .values({
          type: "character",
          slug: charSlug,
          displayName: charName,
          visibility: "public",
        })
        .onConflictDoUpdate({
          target: schema.nodes.slug,
          set: { displayName: charName },
        })
        .returning();

      const charNodeId = charNodes[0].id;

      // Create edge between character and show
      await db
        .insert(schema.edges)
        .values({
          sourceId: charNodeId,
          targetId: showNodeId,
          edgeType: "belongs_to",
          weight: 1.0,
          confidence: 1.0,
          sourceOfTruth: "user_explicit",
        })
        .onConflictDoNothing();
    }
  }

  // 2. Insert traits
  for (const traitName of TRAITS) {
    const traitSlug = slugify(traitName);
    console.log(`Inserting trait: ${traitName} (${traitSlug})`);

    await db
      .insert(schema.nodes)
      .values({
        type: "trait",
        slug: traitSlug,
        displayName: traitName,
        visibility: "public",
      })
      .onConflictDoUpdate({
        target: schema.nodes.slug,
        set: { displayName: traitName },
      });
  }

  console.log("✅ Seeding completed successfully!");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
