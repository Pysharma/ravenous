import "dotenv/config";
import { seedDatabase } from "@/db/seed";

const force = process.argv.includes("--force");

seedDatabase(force)
  .then((result) => {
    console.log(result.seeded ? "Ravenous database seeded with demo data." : `Seed skipped: ${result.reason}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  });
