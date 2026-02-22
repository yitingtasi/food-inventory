require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── 資料檔案路徑 ─────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (e) { console.error("讀取資料失敗:", e.message); }
  return { ingredients: [], settings: { lineToken: "", lineUserId: "" } };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) { console.error("儲存資料失敗:", e.message); return false; }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── 資料同步 API ─────────────────────────────────────────────────────────────
app.get("/api/data", (req, res) => {
  res.json({ success: true, data: loadData() });
});

app.post("/api/data/ingredients", (req, res) => {
  const { ingredients } = req.body;
  if (!Array.isArray(ingredients)) return res.status(400).json({ success: false, error: "格式錯誤" });
  const data = loadData();
  data.ingredients = ingredients;
  saveData(data) ? res.json({ success: true }) : res.status(500).json({ success: false, error: "儲存失敗" });
});

app.post("/api/data/ingredients/add", (req, res) => {
  const ingredient = req.body;
  if (!ingredient || !ingredient.id) return res.status(400).json({ success: false, error: "格式錯誤" });
  const data = loadData();
  data.ingredients.push(ingredient);
  saveData(data) ? res.json({ success: true }) : res.status(500).json({ success: false, error: "儲存失敗" });
});

app.put("/api/data/ingredients/:id", (req, res) => {
  const { id } = req.params;
  const data = loadData();
  const idx = data.ingredients.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: "找不到此食材" });
  data.ingredients[idx] = { ...data.ingredients[idx], ...req.body };
  saveData(data) ? res.json({ success: true, ingredient: data.ingredients[idx] }) : res.status(500).json({ success: false, error: "儲存失敗" });
});

app.delete("/api/data/ingredients/:id", (req, res) => {
  const { id } = req.params;
  const data = loadData();
  data.ingredients = data.ingredients.filter(i => i.id !== id);
  saveData(data) ? res.json({ success: true }) : res.status(500).json({ success: false, error: "儲存失敗" });
});

app.post("/api/data/settings", (req, res) => {
  const data = loadData();
  data.settings = { ...data.settings, ...req.body };
  saveData(data) ? res.json({ success: true }) : res.status(500).json({ success: false, error: "儲存失敗" });
});

// ─── LINE Messaging API 代理 ──────────────────────────────────────────────────
app.post("/api/line-notify", (req, res) => {
  const { token, userId, message } = req.body;
  if (!token || !userId || !message) return res.status(400).json({ success: false, error: "缺少 token、userId 或 message" });

  const body = JSON.stringify({ to: userId, messages: [{ type: "text", text: message }] });
  const options = {
    hostname: "api.line.me", path: "/v2/bot/message/push", method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Authorization: `Bearer ${token}` },
  };
  const request = https.request(options, (lineRes) => {
    let data = "";
    lineRes.on("data", (chunk) => (data += chunk));
    lineRes.on("end", () => {
      if (lineRes.statusCode === 200) { console.log(`[LINE] ✅ 通知發送成功`); res.json({ success: true }); }
      else { console.error(`[LINE] ❌ 失敗 (${lineRes.statusCode}): ${data}`); res.status(lineRes.statusCode).json({ success: false, error: data }); }
    });
  });
  request.on("error", (err) => res.status(500).json({ success: false, error: err.message }));
  request.write(body);
  request.end();
});

// ─── 健康檢查 ─────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const data = loadData();
  res.json({ status: "ok", time: new Date().toISOString(), ingredientCount: data.ingredients.length });
});

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════╗\n║   🥗 食材庫存系統 後端服務啟動        ║\n║   http://localhost:${PORT}              ║\n╚═══════════════════════════════════════╝\n`);
});
