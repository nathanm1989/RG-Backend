const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const auth = require("../middlewares/auth");
const prisma = new PrismaClient();

// Get all users
router.get("/users", auth(["admin"]), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, developerId: true, password: true },
  });
  res.json(users);
});

// Delete user
router.delete("/users/:id", auth(["admin"]), async (req, res) => {
  try{
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });

    console.log(`User with ID ${id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete user with ID ${req.params.id}:`, err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Change user role
router.put("/users/:id/role", auth(["admin"]), async (req, res) => {
  try{
    const { id } = req.params;
    const { role } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: { role },
    });

    console.log(`User with ID ${id} role changed to ${role}`);
    res.json(updated);
  } catch (err) {
    console.error(`Failed to change role for user with ID ${req.params.id}:`, err);
    res.status(500).json({ message: "Failed to change role" });
  }
});

// Assign bidder to developer
router.post("/assign-bidder", auth(["admin"]), async (req, res) => {
  try{
    const { bidderId, developerId } = req.body;
    const updated = await prisma.user.update({
      where: { id: bidderId },
      data: { developerId },
    });

    console.log(`Bidder with ID ${bidderId} assigned to developer with ID ${developerId}`);
    res.json(updated);
  } catch (err) {
    console.error(`Failed to assign bidder with ID ${req.body.bidderId}:`, err);
    res.status(500).json({ message: "Failed to assign bidder" });
  }
});

router.put("/users/:id/password", auth(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: { password },
    });

    console.log(`User with ID ${id} password changed`);
    res.json(updated);
  } catch (error) {
    console.error(`Failed to change password for user with ID ${req.params.id}:`, error);
    res.status(500).json({ message: "Failed to change password" });   
  }
});

router.post("/create-user", auth(["admin"]), async (req, res) => {
  const { username, password, role, developerId } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password, // plain text
        role,
        developerId: role === "bidder" ? developerId : undefined,
      },
    });

    console.log(`User created: ${user.username}`);
    res.json(user);
  } catch (err) {
    console.error("User creation failed:", err);
    res.status(400).json({ message: "Failed to create user" });
  }
});

module.exports = router;
