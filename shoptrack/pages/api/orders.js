import fs from "fs";
import path from "path";

const ORDERS_FILE = path.join(process.cwd(), "data", "orders.json");

function ensureDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadOrders() {
  ensureDir();
  if (!fs.existsSync(ORDERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8")); }
  catch { return {}; }
}

function saveOrders(data) {
  ensureDir();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json(loadOrders());
  }

  if (req.method === "POST") {
    const { orderId, updates } = req.body;
    if (!orderId) return res.status(400).json({ error: "orderId requis" });
    const orders = loadOrders();
    orders[orderId] = { ...(orders[orderId] || {}), ...updates };
    saveOrders(orders);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
