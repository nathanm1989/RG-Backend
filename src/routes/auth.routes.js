const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = new PrismaClient();
const auth = require("../middlewares/auth");

// router.post("/signup", async (req, res) => {
//   const { username, password, role, developerId } = req.body;

//   // ✅ ONLY allow 'bidder' or 'developer'
//   const allowedRoles = ["bidder", "developer"];
//   if (!allowedRoles.includes(role)) {
//     return res.status(403).json({ message: "Unauthorized role" });
//   }
  
//   const hashed = await bcrypt.hash(password, 10);

//   try {
//     const user = await prisma.user.create({
//       data: {
//         username,
//         password: hashed,
//         role,
//         developerId: role === "bidder" ? developerId : undefined,
//       },
//     });
//     res.json(user);
//     console.log("User created:", user);
//   } catch (err) {
//     res.status(400).json({ message: "Signup error", error: err.message });
//     console.error("Signup error:", err);
//   }
// });

router.post("/signin", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) return res.status(404).json({ message: "User not found" });

    // const valid = await bcrypt.compare(password, user.password);
    if (user.password !== password) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET
    );
    res.json({ username: user.username, role: user.role, token });
    console.log("User signed in:", user.username);
  } catch (error) {
    res.status(500).json({ message: "Signin error", error: error.message });
    console.error("Signin error:", error);
  }
});

module.exports = router;
