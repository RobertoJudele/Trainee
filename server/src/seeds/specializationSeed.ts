import { Specialization } from "../models/specialization";

export const seedSpecializations = async () => {
  try {
    const specializationsData = [
      {
        name: "Test",
        description: "Tessttt",
        iconUrl: "TESSSstt",
        isActive: true
      }
      // Poți adăuga mai multe obiecte aici dacă dorești în viitor
    ];

    for (const spec of specializationsData) {
      // Folosim findOrCreate pentru a evita duplicarea datelor dacă rulezi seed-ul de mai multe ori
      await Specialization.findOrCreate({
        where: { name: spec.name },
        defaults: spec
      });
    }

    console.log("✅ Seed-ul pentru specializări a rulat cu succes!");
  } catch (error) {
    console.error("❌ Eroare la rularea seed-ului pentru specializări:", error);
  }
};