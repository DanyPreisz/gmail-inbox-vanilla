const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const SEED = path.join(ROOT, "data", "mail.json");
const LOCAL_DB = process.env.DB_PATH || path.join("/tmp", "gmail-inbox.json");
const MONGO_URI = process.env.MONGODB_URI || "";
const MONGO_DB = process.env.MONGODB_DB || "gmail";
const MONGO_COL = process.env.MONGODB_COLLECTION || "mail";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function seedMail() {
  try {
    return JSON.parse(fs.readFileSync(SEED, "utf8"));
  } catch {
    return [];
  }
}

let colPromise = null;

async function collection() {
  if (!MONGO_URI) return null;
  if (!colPromise) {
    colPromise = (async () => {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      const col = client.db(MONGO_DB).collection(MONGO_COL);
      if ((await col.countDocuments()) === 0) {
        const seed = seedMail();
        if (seed.length) await col.insertMany(seed);
      }
      return col;
    })();
  }
  return colPromise;
}

function publicMail(doc) {
  return {
    id: doc.id,
    from: doc.from,
    subject: doc.subject,
    body: doc.body,
    read: Boolean(doc.read),
    star: Boolean(doc.star),
  };
}

function localRead() {
  try {
    if (fs.existsSync(LOCAL_DB)) return JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  } catch {}
  const seed = seedMail();
  localWrite(seed);
  return seed;
}

function localWrite(rows) {
  fs.writeFileSync(LOCAL_DB, JSON.stringify(rows, null, 2));
}

function matches(mail, q) {
  if (!q) return true;
  return `${mail.from} ${mail.subject} ${mail.body}`.toLowerCase().includes(q);
}

function send(res, status, body, type = TYPES[".json"]) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function file(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "No encontrado", "text/plain; charset=utf-8");
    send(res, 200, data, TYPES[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const col = await collection();

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/healthz")) {
      return send(res, 200, { ok: true, store: col ? "mongodb" : "local" });
    }

    if (req.method === "GET" && url.pathname === "/api/mail") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const rows = col
        ? (await col.find({}, { projection: { _id: 0 } }).toArray()).map(publicMail)
        : localRead();
      return send(res, 200, rows.filter((m) => matches(m, q)));
    }

    const star = url.pathname.match(/^\/api\/mail\/([^/]+)\/star$/);
    if (req.method === "POST" && star) {
      const id = star[1];
      if (col) {
        const mail = await col.findOne({ id });
        if (!mail) return send(res, 404, { error: "no" });
        const next = !mail.star;
        await col.updateOne({ id }, { $set: { star: next } });
        return send(res, 200, publicMail({ ...mail, star: next }));
      }
      const rows = localRead();
      const mail = rows.find((m) => m.id === id);
      if (!mail) return send(res, 404, { error: "no" });
      mail.star = !mail.star;
      localWrite(rows);
      return send(res, 200, mail);
    }

    const one = url.pathname.match(/^\/api\/mail\/([^/]+)$/);
    if (one) {
      const id = one[1];
      if (req.method === "GET") {
        if (col) {
          const out = await col.findOneAndUpdate(
            { id },
            { $set: { read: true } },
            { returnDocument: "after" }
          );
          const doc = out && out.value ? out.value : out;
          if (!doc || !doc.id) return send(res, 404, { error: "no" });
          return send(res, 200, publicMail(doc));
        }
        const rows = localRead();
        const mail = rows.find((m) => m.id === id);
        if (!mail) return send(res, 404, { error: "no" });
        mail.read = true;
        localWrite(rows);
        return send(res, 200, mail);
      }
      if (req.method === "DELETE") {
        if (col) {
          const out = await col.deleteOne({ id });
          return out.deletedCount ? send(res, 200, { ok: true }) : send(res, 404, { error: "no" });
        }
        const rows = localRead();
        const next = rows.filter((m) => m.id !== id);
        if (next.length === rows.length) return send(res, 404, { error: "no" });
        localWrite(next);
        return send(res, 200, { ok: true });
      }
    }

    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
    file(res, path.join(PUBLIC, safe));
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "store", detail: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT} store=${MONGO_URI ? "mongodb" : "local"}`);
});
