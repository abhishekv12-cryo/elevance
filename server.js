const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const UAParser = require("ua-parser-js");
const nodemailer = require("nodemailer");
const { v4: uuid } = require("uuid");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "elevance-demo-secret-change-me";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const defaultDB = {
  users: [],
  sessions: [],
  otp: [],
  resetRequests: [],
  posts: [],
  questions: [],
  answers: [],
  subscriptions: [],
  transactions: [],
  comments: []
};

function loadDB() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(defaultDB, null, 2));
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return structuredClone(defaultDB); }
}
let db = loadDB();
function saveDB() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

function now() { return new Date(); }
function dayKey(date = now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}
function istHourMinute() {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(now());
  return { h: Number(p.find(x => x.type === "hour").value), m: Number(p.find(x => x.type === "minute").value) };
}
function betweenIST(startH, endH) {
  const { h } = istHourMinute();
  return h >= startH && h < endH;
}
function tokenFor(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
}
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    language: u.language, points: u.points, friends: u.friends.length,
    plan: u.plan
  };
}
function auth(req, res, next) {
  const raw = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    const user = db.users.find(u => u.id === payload.id);
    if (!user) return res.status(401).json({ error: "Invalid session" });
    req.user = user;
    next();
  } catch { res.status(401).json({ error: "Authentication required" }); }
}
function findUser(identifier) {
  const v = String(identifier || "").trim().toLowerCase();
  return db.users.find(u => u.email.toLowerCase() === v || u.phone === v);
}
function randomLetters(n = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function createOtp(userId, purpose, channel) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.otp = db.otp.filter(x => !(x.userId === userId && x.purpose === purpose));
  db.otp.push({ id: uuid(), userId, purpose, channel, code, expires: Date.now() + 5 * 60 * 1000 });
  saveDB();
  console.log(`[DEV OTP] ${purpose}/${channel}: ${code}`);
  return code;
}
function verifyOtp(userId, purpose, code) {
  const item = db.otp.find(x => x.userId === userId && x.purpose === purpose && x.code === String(code));
  if (!item || item.expires < Date.now()) return false;
  db.otp = db.otp.filter(x => x.id !== item.id);
  saveDB();
  return true;
}
async function sendMail(to, subject, text) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[DEV EMAIL] To ${to}\n${subject}\n${text}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
}
function parseEnvironment(req) {
  const parser = new UAParser(req.headers["user-agent"] || "");
  const r = parser.getResult();
  let browser = r.browser.name || "Unknown";
  const os = r.os.name || "Unknown";
  const type = r.device.type || "desktop";
  const device = type === "mobile" ? "mobile" : type === "tablet" ? "tablet" : "desktop";
  return { browser, os, device, ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown" };
}
function questionLimit(plan) {
  return ({ Free: 1, Bronze: 5, Silver: 10, Gold: Infinity }[plan] ?? 1);
}
function dailyQuestions(userId) {
  const d = dayKey();
  return db.questions.filter(q => q.userId === userId && dayKey(new Date(q.createdAt)) === d).length;
}
function postLimit(friends) {
  if (friends === 0) return 0;
  if (friends === 1) return 1;
  if (friends === 2) return 2;
  if (friends > 10) return Infinity;
  return 2;
}
function canPost(user) {
  const limit = postLimit(user.friends.length);
  if (limit === Infinity) return true;
  const today = dayKey();
  const count = db.posts.filter(p => p.userId === user.id && dayKey(new Date(p.createdAt)) === today).length;
  return count < limit;
}

if (!db.users.some(u => u.email === "demo@elevance.test")) {
  db.users.push({
    id: uuid(), name: "Demo User", email: "demo@elevance.test", phone: "9999999999",
    password: bcrypt.hashSync("Demo@123", 10), language: "en", points: 20,
    friends: [], plan: "Free", loginHistory: [], resetHistory: [], createdAt: new Date().toISOString()
  });
  saveDB();
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${uuid()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error("Only image/video files are allowed"), ok);
  }
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_, res) => res.json({ ok: true, service: "Elevance Community" }));

app.post("/api/register", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) return res.status(400).json({ error: "All fields are required" });
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase() || u.phone === phone))
    return res.status(409).json({ error: "Email or phone already registered" });
  const user = {
    id: uuid(), name, email, phone, password: await bcrypt.hash(password, 10),
    language: "en", points: 0, friends: [], plan: "Free", loginHistory: [],
    resetHistory: [], createdAt: new Date().toISOString()
  };
  db.users.push(user); saveDB();
  res.json({ token: tokenFor(user), user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const { email, password, otp } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.password))) return res.status(401).json({ error: "Invalid email or password" });

  const env = parseEnvironment(req);
  if (env.device === "mobile" && !betweenIST(10, 13))
    return res.status(403).json({ error: "Mobile access is allowed only between 10:00 AM and 1:00 PM IST." });

  if (/chrome/i.test(env.browser) && !/edge/i.test(env.browser)) {
    if (!otp) {
      createOtp(user.id, "login", "email");
      await sendMail(user.email, "Elevance login OTP", "Your login OTP is shown in the development console.");
      return res.status(202).json({ otpRequired: true, message: "Email OTP sent. In development, check the server console." });
    }
    if (!verifyOtp(user.id, "login", otp)) return res.status(401).json({ error: "Invalid or expired OTP" });
  }

  const entry = { id: uuid(), at: new Date().toISOString(), ...env };
  user.loginHistory.unshift(entry); user.loginHistory = user.loginHistory.slice(0, 50);
  saveDB();
  res.json({ token: tokenFor(user), user: publicUser(user), environment: env });
});

app.post("/api/login/otp", (req, res) => {
  const { email, otp } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user || !verifyOtp(user.id, "login", otp)) return res.status(401).json({ error: "Invalid or expired OTP" });
  const env = parseEnvironment(req);
  if (env.device === "mobile" && !betweenIST(10, 13)) return res.status(403).json({ error: "Mobile access is outside the allowed time." });
  user.loginHistory.unshift({ id: uuid(), at: new Date().toISOString(), ...env });
  saveDB();
  res.json({ token: tokenFor(user), user: publicUser(user) });
});

app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user), loginHistory: req.user.loginHistory }));

app.get("/api/profile/:id", auth, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json({ ...publicUser(u), loginHistory: req.user.id === u.id ? u.loginHistory : [] });
});

app.post("/api/friends/:id", auth, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot add yourself" });
  const other = db.users.find(x => x.id === req.params.id);
  if (!other) return res.status(404).json({ error: "User not found" });
  if (!req.user.friends.includes(other.id)) {
    req.user.friends.push(other.id);
    if (!other.friends.includes(req.user.id)) other.friends.push(req.user.id);
    saveDB();
  }
  res.json({ user: publicUser(req.user), message: "Friend added" });
});

app.get("/api/users", auth, (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  res.json(db.users.filter(u => u.id !== req.user.id && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
    .slice(0, 20).map(publicUser));
});

app.post("/api/points/transfer", auth, (req, res) => {
  const to = db.users.find(u => u.id === req.body.userId);
  const amount = Number(req.body.amount);
  if (!to) return res.status(404).json({ error: "Recipient not found" });
  if (req.user.points <= 10) return res.status(400).json({ error: "You need more than 10 points to transfer." });
  if (!Number.isInteger(amount) || amount <= 0 || amount > req.user.points) return res.status(400).json({ error: "Invalid amount" });
  req.user.points -= amount; to.points += amount; saveDB();
  res.json({ user: publicUser(req.user), message: `${amount} points transferred.` });
});

app.get("/api/questions", auth, (req, res) => {
  const questions = db.questions.map(q => ({
    ...q,
    author: publicUser(db.users.find(u => u.id === q.userId)),
    answers: db.answers.filter(a => a.questionId === q.id).map(a => ({
      ...a, author: publicUser(db.users.find(u => u.id === a.userId))
    }))
  }));
  res.json(questions.reverse());
});

app.post("/api/questions", auth, (req, res) => {
  const limit = questionLimit(req.user.plan);
  if (dailyQuestions(req.user.id) >= limit) return res.status(403).json({ error: `Daily question limit reached for ${req.user.plan} plan.` });
  const q = { id: uuid(), userId: req.user.id, title: String(req.body.title || "").trim(), body: String(req.body.body || "").trim(), createdAt: new Date().toISOString() };
  if (!q.title || !q.body) return res.status(400).json({ error: "Title and body are required" });
  db.questions.push(q); saveDB();
  res.json(q);
});

app.post("/api/questions/:id/answers", auth, (req, res) => {
  const q = db.questions.find(x => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: "Question not found" });
  const a = { id: uuid(), questionId: q.id, userId: req.user.id, body: String(req.body.body || "").trim(), upvotes: 0, downvotes: 0, bonusAwarded: false, createdAt: new Date().toISOString() };
  if (!a.body) return res.status(400).json({ error: "Answer is required" });
  db.answers.push(a); req.user.points += 5; saveDB();
  res.json({ answer: a, points: req.user.points });
});

app.post("/api/answers/:id/vote", auth, (req, res) => {
  const a = db.answers.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: "Answer not found" });
  if (req.body.type === "up") {
    a.upvotes++;
    if (a.upvotes >= 5 && !a.bonusAwarded) {
      const author = db.users.find(u => u.id === a.userId);
      if (author) author.points += 5;
      a.bonusAwarded = true;
    }
  } else if (req.body.type === "down") {
    a.downvotes++;
    const author = db.users.find(u => u.id === a.userId);
    if (author) author.points = Math.max(0, author.points - 1);
  }
  saveDB(); res.json(a);
});

app.delete("/api/answers/:id", auth, (req, res) => {
  const i = db.answers.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Answer not found" });
  const a = db.answers[i];
  if (a.userId !== req.user.id) return res.status(403).json({ error: "Only the author can remove an answer." });
  req.user.points = Math.max(0, req.user.points - 5);
  db.answers.splice(i, 1); saveDB();
  res.json({ message: "Answer removed", points: req.user.points });
});

app.get("/api/posts", auth, (req, res) => {
  res.json(db.posts.slice().reverse().map(p => ({
    ...p,
    author: publicUser(db.users.find(u => u.id === p.userId)),
    comments: db.comments.filter(c => c.postId === p.id).map(c => ({ ...c, author: publicUser(db.users.find(u => u.id === c.userId)) }))
  })));
});

app.post("/api/posts", auth, upload.single("media"), (req, res) => {
  if (!canPost(req.user)) return res.status(403).json({ error: `Posting limit reached. Current friends: ${req.user.friends.length}.` });
  const post = {
    id: uuid(), userId: req.user.id, text: String(req.body.text || ""),
    media: req.file ? `/uploads/${req.file.filename}` : null,
    mediaType: req.file?.mimetype?.startsWith("video") ? "video" : "image",
    likes: [], shares: 0, createdAt: new Date().toISOString()
  };
  db.posts.push(post); saveDB();
  io.emit("new-post", post);
  res.json(post);
});

app.post("/api/posts/:id/like", auth, (req, res) => {
  const p = db.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Post not found" });
  const i = p.likes.indexOf(req.user.id);
  if (i >= 0) p.likes.splice(i, 1); else p.likes.push(req.user.id);
  saveDB(); res.json({ likes: p.likes.length });
});

app.post("/api/posts/:id/share", auth, (req, res) => {
  const p = db.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Post not found" });
  p.shares++; saveDB(); res.json({ shares: p.shares });
});

app.post("/api/posts/:id/comments", auth, (req, res) => {
  const p = db.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Post not found" });
  const c = { id: uuid(), postId: p.id, userId: req.user.id, text: String(req.body.text || "").trim(), createdAt: new Date().toISOString() };
  if (!c.text) return res.status(400).json({ error: "Comment required" });
  db.comments.push(c); saveDB(); res.json(c);
});

app.post("/api/forgot-password", async (req, res) => {
  const user = findUser(req.body.identifier);
  if (!user) return res.status(404).json({ error: "No account found for that email or phone." });
  const d = dayKey();
  if (user.resetHistory?.includes(d)) return res.status(429).json({ error: "You can use this option only one time per day." });
  user.resetHistory = user.resetHistory || []; user.resetHistory.push(d);
  const otp = createOtp(user.id, "reset", user.email ? "email" : "phone");
  saveDB();
  await sendMail(user.email, "Password reset OTP", `Your password reset OTP is ${otp} in development mode.`);
  res.json({ message: "OTP generated. Check email/server console in development.", userId: user.id });
});

app.post("/api/reset-password", async (req, res) => {
  const user = db.users.find(u => u.id === req.body.userId);
  if (!user || !verifyOtp(user.id, "reset", req.body.otp)) return res.status(400).json({ error: "Invalid or expired OTP" });
  const newPassword = req.body.password || randomLetters(12);
  if (!/^[A-Za-z]+$/.test(newPassword)) return res.status(400).json({ error: "Password must contain only letters." });
  user.password = await bcrypt.hash(newPassword, 10); saveDB();
  res.json({ message: "Password reset successful", generatedPassword: req.body.password ? undefined : newPassword });
});

app.get("/api/password-generator", (_, res) => res.json({ password: randomLetters(14) }));

app.post("/api/language/request", auth, (req, res) => {
  const lang = req.body.language;
  if (!["en", "es", "hi", "pt", "zh", "fr"].includes(lang)) return res.status(400).json({ error: "Unsupported language" });
  if (lang === req.user.language) return res.json({ direct: true, language: lang });
  const channel = lang === "fr" ? "email" : "mobile";
  createOtp(req.user.id, `language-${lang}`, channel);
  res.json({ otpRequired: true, channel, message: `OTP sent via ${channel}. In development, check server console.` });
});

app.post("/api/language/verify", auth, (req, res) => {
  const lang = req.body.language;
  if (!verifyOtp(req.user.id, `language-${lang}`, req.body.otp)) return res.status(400).json({ error: "Invalid or expired OTP" });
  req.user.language = lang; saveDB(); res.json({ user: publicUser(req.user) });
});

app.get("/api/plans", (_, res) => res.json([
  { id: "Free", price: 0, limit: 1 },
  { id: "Bronze", price: 100, limit: 5 },
  { id: "Silver", price: 300, limit: 10 },
  { id: "Gold", price: 1000, limit: "Unlimited" }
]));

app.post("/api/subscribe", auth, async (req, res) => {
  if (!betweenIST(10, 11)) return res.status(403).json({ error: "Payments are allowed only between 10:00 AM and 11:00 AM IST." });
  const plan = String(req.body.plan || "");
  const plans = { Bronze: 100, Silver: 300, Gold: 1000 };
  if (!plans[plan]) return res.status(400).json({ error: "Choose a paid plan." });

  // Demo gateway transaction. Add Razorpay keys to .env to replace this with a live gateway.
  const tx = { id: `DEMO_${uuid().slice(0, 8)}`, userId: req.user.id, plan, amount: plans[plan], status: "paid", createdAt: new Date().toISOString() };
  db.transactions.push(tx);
  req.user.plan = plan;
  db.subscriptions.push({ id: uuid(), userId: req.user.id, plan, amount: plans[plan], active: true, startedAt: tx.createdAt });
  saveDB();

  await sendMail(req.user.email, "Subscription invoice", `Plan: ${plan}\nAmount: ₹${plans[plan]}\nTransaction: ${tx.id}`);
  res.json({ message: "Payment successful in demo mode.", transaction: tx, user: publicUser(req.user) });
});

io.on("connection", socket => {
  socket.emit("connected", { message: "Real-time connection established" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

server.listen(PORT, () => console.log(`Elevance Community running at http://localhost:${PORT}`));
