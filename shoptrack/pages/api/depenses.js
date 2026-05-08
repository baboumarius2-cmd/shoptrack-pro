import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "depenses.json");

function ensureDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; }
}
function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

export default function handler(req, res) {
  if (req.method === "GET") return res.status(200).json(load());

  if (req.method === "POST") {
    const { action, depense } = req.body;
    const list = load();
    if (action === "add") {
      list.unshift({ ...depense, id: "D" + Date.now() });
      save(list);
      return res.status(200).json({ success: true });
    }
    if (action === "delete") {
      const updated = list.filter(d => d.id !== depense.id);
      save(updated);
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: "Action inconnue" });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
