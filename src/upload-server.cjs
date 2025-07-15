const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const FormData = require("form-data");

// Load .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log("[DEBUG] process.cwd():", process.cwd());
console.log("[DEBUG] __dirname:", __dirname);
console.log("[DEBUG] process.env.OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in .env");
}

app.use(cors());

/**
 * POST /api/openai/upload-image
 * Accepts multipart/form-data with a single image file.
 * Uploads the image to OpenAI and returns { file_id }
 */
app.post("/api/openai/upload-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Use node-fetch and form-data for multipart upload
    const fetch = (await import("node-fetch")).default;
    const formData = new FormData();
    formData.append("file", req.file.buffer, req.file.originalname);
    formData.append("purpose", "vision");

    const response = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: error?.error?.message || "Failed to upload to OpenAI" });
    }

    const data = await response.json();
    if (!data.id) {
      return res.status(500).json({ error: "No file ID returned from OpenAI" });
    }

    return res.json({ file_id: data.id });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

const PORT = process.env.UPLOAD_SERVER_PORT ? parseInt(process.env.UPLOAD_SERVER_PORT) : 3030;
app.listen(PORT, () => {
  console.log(`[Upload Server] Listening on port ${PORT}`);
});
