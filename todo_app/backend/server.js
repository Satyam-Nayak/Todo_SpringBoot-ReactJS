const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ===== File-based storage =====
const DATA_FILE = path.join(__dirname, "data.json");

// Load data from file (users + tasks + trash)
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || [],
      tasksByUser: parsed.tasksByUser || {},
      trashByUser: parsed.trashByUser || {},
      nextTaskId: parsed.nextTaskId || 1,
    };
  } catch (err) {
    return { users: [], tasksByUser: {}, trashByUser: {}, nextTaskId: 1 };
  }
}

// Save data to file
function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        users: data.users,
        tasksByUser: data.tasksByUser,
        trashByUser: data.trashByUser,
        nextTaskId: data.nextTaskId,
      },
      null,
      2
    )
  );
}

// In-memory copy BUT synced with file
let data = loadData();

function findUserByUsername(username) {
  return data.users.find((u) => u.username === username);
}

function findUserByEmail(email) {
  return data.users.find((u) => u.email === email);
}

function findUserByIdentifier(identifier) {
  return (
    data.users.find((u) => u.username === identifier) ||
    data.users.find((u) => u.email === identifier)
  );
}

// Cleanup trash older than 2 days
function cleanupTrash(username) {
  const now = Date.now();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

  const trash = data.trashByUser[username] || [];
  const filtered = trash.filter((t) => {
    const deletedTime = new Date(t.deletedAt).getTime();
    return now - deletedTime < twoDaysMs;
  });

  if (filtered.length !== trash.length) {
    data.trashByUser[username] = filtered;
    saveData();
  }

  return data.trashByUser[username] || [];
}

// ===== Email / OTP helpers =====

// Configure nodemailer (you already set Gmail + app password)
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: "YOUR_GMAIL@gmail.com",
//     pass: "YOUR_16_DIGIT_APP_PASSWORD",
//   },
// });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "sop97541@gmail.com",
    pass: "ofje erdr gqdh vnzu", 
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

async function sendOtpEmail(to, subject, otp) {
  const appName = "GlowTasks";
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#020617;border-radius:16px;border:1px solid #1f2937;padding:20px 22px;color:#e5e7eb;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#e5e7eb;">
          ${appName} <span style="font-size:18px;">📝</span>
        </h1>
        <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;">
          ${subject}
        </p>
        <div style="text-align:center;margin:18px 0;">
          <div style="display:inline-block;padding:12px 24px;border-radius:999px;background:linear-gradient(135deg,#6366f1,#ec4899);font-size:26px;font-weight:700;letter-spacing:4px;">
            ${otp}
          </div>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#cbd5f5;">
          This code is valid for <strong>10 minutes</strong>. Please do not share it with anyone.
        </p>
        <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"GlowTasks" <${process.env.SMTP_FROM || "no-reply@example.com"}>`,
      to,
      subject,
      text: `Your verification code is: ${otp}`,
      html,
    });
    console.log(`OTP sent to ${to}: ${otp}`);
  } catch (err) {
    console.error("Failed to send email, but OTP is:", otp);
  }
}

// ===== Auth middleware =====
function authMiddleware(req, res, next) {
  const username = req.header("x-user");
  if (!username) {
    return res.status(401).json({ message: "Missing x-user header" });
  }

  const user = findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ message: "Invalid user" });
  }

  req.username = username;
  next();
}

// ===== Auth routes =====

// Registration: username + email + password (with email OTP)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Username, email and password are required" });
    }

    if (findUserByUsername(username)) {
      return res.status(400).json({ message: "Username already exists" });
    }

    if (findUserByEmail(email)) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const nowIso = new Date().toISOString();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    const newUser = {
      username,
      email,
      password: hashedPassword,
      createdAt: nowIso,
      verified: false,
      verificationOtp: otp,
      verificationOtpExpires: expires,
      verificationOtpSentCount: 1,
      lastVerificationOtpSentAt: nowIso,
      verificationOtpAttempts: 0,
      resetOtp: null,
      resetOtpExpires: null,
      resetOtpSentCount: 0,
      lastResetOtpSentAt: null,
      resetOtpAttempts: 0,
    };

    data.users.push(newUser);
    data.tasksByUser[username] = [];
    data.trashByUser[username] = [];
    saveData();

    await sendOtpEmail(
      email,
      "Your GlowTasks verification code",
      otp
    );

    return res.json({
      message: "User created. Please verify using the OTP sent to your email.",
      email,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Resend signup OTP with limits
app.post("/api/auth/resend-verify", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "User not found for this email" });
    }

    if (user.verified === true) {
      return res.status(400).json({ message: "User already verified" });
    }

    const now = Date.now();

    // Cooldown: 60 seconds between sends
    if (user.lastVerificationOtpSentAt) {
      const last = new Date(user.lastVerificationOtpSentAt).getTime();
      if (now - last < 60 * 1000) {
        const remaining = Math.ceil((60 * 1000 - (now - last)) / 1000);
        return res.status(429).json({
          message: `Please wait ${remaining}s before requesting another OTP`,
        });
      }
    }

    // Max 5 sends total
    const count = user.verificationOtpSentCount || 0;
    if (count >= 5) {
      return res
        .status(429)
        .json({ message: "Too many OTP requests. Please try again later." });
    }

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    user.verificationOtp = otp;
    user.verificationOtpExpires = expires;
    user.verificationOtpSentCount = count + 1;
    user.lastVerificationOtpSentAt = new Date().toISOString();
    user.verificationOtpAttempts = 0;
    saveData();

    await sendOtpEmail(
      email,
      "Your GlowTasks verification code",
      otp
    );

    return res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    console.error("Resend verify error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Verify signup OTP
app.post("/api/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(400).json({ message: "Invalid email or OTP" });
  }

  // If user already verified
  if (user.verified === true && !user.verificationOtp) {
    return res.json({ message: "Already verified" });
  }

  const now = Date.now();
  if (user.verificationOtpExpires) {
    const exp = new Date(user.verificationOtpExpires).getTime();
    if (now > exp) {
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }
  }

  const attempts = user.verificationOtpAttempts || 0;
  if (attempts >= 5) {
    return res
      .status(429)
      .json({ message: "Too many wrong attempts. Request a new OTP." });
  }

  if (user.verificationOtp !== otp) {
    user.verificationOtpAttempts = attempts + 1;
    saveData();
    return res.status(400).json({ message: "Incorrect OTP" });
  }

  user.verified = true;
  user.verificationOtp = null;
  user.verificationOtpExpires = null;
  user.verificationOtpAttempts = 0;
  saveData();

  return res.json({ message: "Email verified successfully" });
});

// Login: identifier (username or email) + password
app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Identifier and password are required" });
    }

    const user = findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({ message: "Invalid username/email or password" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid username/email or password" });
    }

    // If verified is explicitly false -> block login
    if (user.verified === false) {
      return res
        .status(403)
        .json({ message: "Please verify your email before logging in." });
    }

    return res.json({
      message: "Login successful",
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Forgot password: send OTP to email (with limits)
app.post("/api/auth/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = findUserByEmail(email);
    // If user doesn't exist, respond generic success
    if (!user) {
      return res.json({
        message: "If this email exists, an OTP has been sent.",
      });
    }

    const now = Date.now();

    // Cooldown: 60s between reset OTPs
    if (user.lastResetOtpSentAt) {
      const last = new Date(user.lastResetOtpSentAt).getTime();
      if (now - last < 60 * 1000) {
        const remaining = Math.ceil((60 * 1000 - (now - last)) / 1000);
        return res.status(429).json({
          message: `Please wait ${remaining}s before requesting another OTP`,
        });
      }
    }

    // Max 5 reset OTPs
    const count = user.resetOtpSentCount || 0;
    if (count >= 5) {
      return res
        .status(429)
        .json({ message: "Too many reset requests. Please try again later." });
    }

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    user.resetOtp = otp;
    user.resetOtpExpires = expires;
    user.resetOtpSentCount = count + 1;
    user.lastResetOtpSentAt = new Date().toISOString();
    user.resetOtpAttempts = 0;
    saveData();

    await sendOtpEmail(email, "Your GlowTasks password reset code", otp);

    return res.json({
      message: "If this email exists, an OTP has been sent.",
    });
  } catch (err) {
    console.error("Forgot error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Reset password with OTP
app.post("/api/auth/reset", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email, OTP and new password are required" });
    }

    const user = findUserByEmail(email);
    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }

    const now = Date.now();
    const exp = new Date(user.resetOtpExpires).getTime();

    if (now > exp) {
      return res.status(400).json({ message: "OTP expired, please try again." });
    }

    const attempts = user.resetOtpAttempts || 0;
    if (attempts >= 5) {
      return res
        .status(429)
        .json({ message: "Too many wrong attempts. Request a new OTP." });
    }

    if (user.resetOtp !== otp) {
      user.resetOtpAttempts = attempts + 1;
      saveData();
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.resetOtpAttempts = 0;
    saveData();

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get profile of logged in user
app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = findUserByUsername(req.username);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    verified: user.verified !== false,
  });
});

// ===== Task routes =====

// Get all tasks for logged-in user
app.get("/api/tasks", authMiddleware, (req, res) => {
  const username = req.username;
  const tasks = data.tasksByUser[username] || [];
  res.json(tasks);
});

// Add new task
app.post("/api/tasks", authMiddleware, (req, res) => {
  const username = req.username;
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }

  const newTask = {
    id: data.nextTaskId++,
    title,
    description: description || "",
    completed: false,
    createdAt: new Date().toISOString(),
  };

  if (!data.tasksByUser[username]) {
    data.tasksByUser[username] = [];
  }

  data.tasksByUser[username].push(newTask);
  saveData();

  res.json(newTask);
});

// Update task (title / description)
app.put("/api/tasks/:id", authMiddleware, (req, res) => {
  const username = req.username;
  const taskId = parseInt(req.params.id, 10);
  const { title, description } = req.body;

  const tasks = data.tasksByUser[username] || [];
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;

  saveData();
  res.json(task);
});

// Toggle completed
app.put("/api/tasks/:id/toggle", authMiddleware, (req, res) => {
  const username = req.username;
  const taskId = parseInt(req.params.id, 10);

  const tasks = data.tasksByUser[username] || [];
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  task.completed = !task.completed;

  saveData();
  res.json(task);
});

// Delete task -> move to trash (kept for 2 days)
app.delete("/api/tasks/:id", authMiddleware, (req, res) => {
  const username = req.username;
  const taskId = parseInt(req.params.id, 10);

  const tasks = data.tasksByUser[username] || [];
  const index = tasks.findIndex((t) => t.id === taskId);

  if (index === -1) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (!data.trashByUser[username]) {
    data.trashByUser[username] = [];
  }

  const deletedTask = {
    ...tasks[index],
    deletedAt: new Date().toISOString(),
  };

  data.trashByUser[username].push(deletedTask);
  tasks.splice(index, 1);
  data.tasksByUser[username] = tasks;

  saveData();
  res.json({ message: "Task moved to trash" });
});

// ===== Trash routes =====

// Get trash for user (auto removes older than 2 days)
app.get("/api/trash", authMiddleware, (req, res) => {
  const username = req.username;
  const trash = cleanupTrash(username);
  res.json(trash);
});

// Restore tasks from trash
app.post("/api/trash/restore", authMiddleware, (req, res) => {
  const username = req.username;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids array is required" });
  }

  const trash = data.trashByUser[username] || [];
  const tasks = data.tasksByUser[username] || [];

  const remainingTrash = [];
  const restored = [];

  for (const t of trash) {
    if (ids.includes(t.id)) {
      const { deletedAt, ...taskFields } = t;
      tasks.push(taskFields);
      restored.push(taskFields);
    } else {
      remainingTrash.push(t);
    }
  }

  data.trashByUser[username] = remainingTrash;
  data.tasksByUser[username] = tasks;
  saveData();

  res.json({ restored });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});



