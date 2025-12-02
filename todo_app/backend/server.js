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

// Configure nodemailer (FILL THESE WITH REAL VALUES FOR PRODUCTION)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "your_smtp_user",
    pass: process.env.SMTP_PASS || "your_smtp_password",
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

async function sendOtpEmail(to, subject, otp) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "no-reply@example.com",
      to,
      subject,
      text: `Your verification code is: ${otp}`,
      html: `<p>Your verification code is: <b>${otp}</b></p>`,
    });
    console.log(`OTP sent to ${to}: ${otp}`);
  } catch (err) {
    console.error("Failed to send email, but OTP is:", otp);
    // For dev: still log OTP so you can test without SMTP
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
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    const newUser = {
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      verified: false,
      verificationOtp: otp,
      verificationOtpExpires: expires,
      resetOtp: null,
      resetOtpExpires: null,
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

  // Existing users (before OTP system) might not have fields
  if (!user.verificationOtp || !user.verificationOtpExpires) {
    if (user.verified === true || user.verified === undefined) {
      return res.json({ message: "Already verified" });
    }
    return res.status(400).json({ message: "No OTP to verify" });
  }

  const now = Date.now();
  const exp = new Date(user.verificationOtpExpires).getTime();

  if (now > exp) {
    return res.status(400).json({ message: "OTP expired. Please register again." });
  }

  if (user.verificationOtp !== otp) {
    return res.status(400).json({ message: "Incorrect OTP" });
  }

  user.verified = true;
  user.verificationOtp = null;
  user.verificationOtpExpires = null;
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

// Forgot password: send OTP to email
app.post("/api/auth/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = findUserByEmail(email);
    // For security: respond success even if user not found
    if (!user) {
      return res.json({
        message: "If this email exists, an OTP has been sent.",
      });
    }

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    user.resetOtp = otp;
    user.resetOtpExpires = expires;
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

    if (user.resetOtp !== otp) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = null;
    user.resetOtpExpires = null;
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
