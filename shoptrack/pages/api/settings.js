import fs from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

function ensureDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSettings() {
  ensureDir();
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(data) {
  ensureDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  if (req.method === "GET") {
    const settings = loadSettings();
    // Never return passwords in GET
    const { patronPassword, assistantePassword, ...safe } = settings;
    return res.status(200).json({
      ...safe,
      hasPatronPassword: !!patronPassword,
      hasAssistantePassword: !!assistantePassword,
    });
  }

  if (req.method === "POST") {
    const current = loadSettings();
    const updates = req.body;
    const merged = { ...current, ...updates };
    saveSettings(merged);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
