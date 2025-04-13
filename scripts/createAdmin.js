const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      password: "admin123",
      role: "admin",
    },
  });

  console.log("✅ Admin user created:", admin);
}

main().finally(() => prisma.$disconnect());
