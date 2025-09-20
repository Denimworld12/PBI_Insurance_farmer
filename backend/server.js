// backend/server.js
const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());

// Ensure uploads & data directories exist
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Multer storage (keeps original extension)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // create readable filename: timestamp + original
    const safeName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage });

function pythonCommand() {
  if (process.platform === "win32") {
    // prefer 'py' launcher, then 'python'
    return fs.existsSync("C:\\Windows\\py.exe") ? "py" : "python";
  }
  return "python3";
}

app.post("/api/claims/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const filePath = path.resolve(req.file.path); // absolute path to uploaded file
    const lat = parseFloat(req.body.lat);
    const lon = parseFloat(req.body.lon);
    const overlayText = req.body.overlay_text || "";
    const clientTs = Number(req.body.client_ts) || Date.now();
    const parcelId = req.body.parcel_id || "";

    // Use backend/data/parcel.geojson as default (ensure exists, if empty create minimal)
    const cadastralPath = path.join(DATA_DIR, "parcel.geojson");
    if (!fs.existsSync(cadastralPath)) {
      fs.writeFileSync(cadastralPath, JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2));
    }

    // Python worker path (worker folder is at project root sibling of backend)
    const pyPath = path.join(__dirname, "..", "worker", "pipeline.py");

    // spawn Python
    const pyCmd = pythonCommand();
    const args = [pyPath, filePath, String(lat), String(lon), String(clientTs), cadastralPath, overlayText, parcelId];
    const py = spawn(pyCmd, args, { cwd: process.cwd() });

    let out = "";
    let err = "";

    py.stdout.on("data", d => { out += d.toString(); });
    py.stderr.on("data", d => { err += d.toString(); console.error("PY ERR:", d.toString()); });

    py.on("close", code => {
      // Try to parse stdout first (preferred). If fails, return stderr as error.
      try {
        out = out.trim();
        if (!out) throw new Error(err || `Worker exited with code ${code}`);
        const result = JSON.parse(out);
        // always return 200 with a JSON result (result may include error field)
        res.json(result);
      } catch (e) {
        console.error("Failed to parse worker output:", e.message);
        res.status(500).json({ error: "Worker failed", details: err || out || e.message });
      } finally {
        // cleanup uploaded file (preserve for debug by commenting out)
        fs.unlink(filePath, () => {});
      }
    });
  } catch (e) {
    console.error("Upload handler error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.send("Backend server is running"));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
