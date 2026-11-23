const path = require("path");
const fs = require("fs");
require("../loadEnv");
const prisma = require("../src/config/prisma");

async function applyMigration() {
  const sqlPath = path.join(__dirname, "../prisma/migrations/02_continuous_learning_schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  
  // Split statements by semicolon
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} migration statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing statement...`);
    await prisma.$executeRawUnsafe(stmt);
  }

  console.log("Migration 02 applied successfully!");
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
