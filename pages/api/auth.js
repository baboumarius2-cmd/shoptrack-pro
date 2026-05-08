import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

function loadSettings() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")); }
  catch { return {}; }
}

function saveSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, role, password, newPassword } = req.body;
  const settings = loadSettings();

  // First time setup — create password
  if (action === "setup") {
    if (!role || !newPassword) return res.status(400).json({ error: "Données manquantes" });
    const key = role === "patron" ? "patronPassword" : "assistantePassword";
    if (settings[key]) return res.status(400).json({ error: "Mot de passe déjà configuré" });
    const hash = await bcrypt.hash(newPassword, 10);
    settings[key] = hash;
    saveSettings(settings);
    return res.status(200).json({ success: true });
  }

  // Login
  if (action === "login") {
    if (!role || !password) return res.status(400).json({ error: "Données manquantes" });
    const key = role === "patron" ? "patronPassword" : "assistantePassword";
    if (!settings[key]) return res.status(404).json({ error: "no_password" });
    const valid = await bcrypt.compare(password, settings[key]);
    if (!valid) return res.status(401).json({ error: "Mot de passe incorrect" });
    return res.status(200).json({ success: true, role });
  }

  // Change password
  if (action === "change") {
    if (!role || !password || !newPassword) return res.status(400).json({ error: "Données manquantes" });
    const key = role === "patron" ? "patronPassword" : "assistantePassword";
    if (settings[key]) {
      const valid = await bcrypt.compare(password, settings[key]);
      if (!valid) return res.status(401).json({ error: "Ancien mot de passe incorrect" });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    settings[key] = hash;
    saveSettings(settings);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Action inconnue" });
}
