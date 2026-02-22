require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // 前端靜態檔案

// ─── LINE Notify 代理 API ─────────────────────────────────────────────────────
/**
 * POST /api/line-notify
 * Body: { token: "LINE_NOTIFY_TOKEN", message: "通知內容" }
 */
app.post("/api/line-notify", (req, res) => {
  const { token, userId, message } = req.body;

  if (!token || !userId || !message) {
    return res.status(400).json({ success: false, error: "缺少 token、userId 或 message" });
  }

  const body = JSON.stringify({
    to: userId,
    messages: [{ type: "text", text: message }],
  });

  const options = {
    hostname: "api.line.me",
    path: "/v2/bot/message/push",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Authorization: `Bearer ${token}`,
    },
  };

  const request = https.request(options, (lineRes) => {
    let data = "";
    lineRes.on("data", (chunk) => (data += chunk));
    lineRes.on("end", () => {
      if (lineRes.statusCode === 200) {
        console.log(`[LINE] ✅ 通知發送成功: ${message.substring(0, 30)}...`);
        res.json({ success: true, message: "通知已發送" });
      } else {
        console.error(`[LINE] ❌ 發送失敗 (${lineRes.statusCode}): ${data}`);
        res.status(lineRes.statusCode).json({ success: false, error: data });
      }
    });
  });

  request.on("error", (err) => {
    console.error("[LINE] 請求錯誤:", err.message);
    res.status(500).json({ success: false, error: err.message });
  });

  request.write(body);
  request.end();
});

// ─── 健康檢查 ─────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ─── 前端路由 fallback ────────────────────────────────────────────────────────
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── 啟動 ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🥗 食材庫存系統 後端服務啟動        ║
║   http://localhost:${PORT}              ║
╚═══════════════════════════════════════╝
  `);
});
