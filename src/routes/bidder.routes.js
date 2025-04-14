const router = require("express").Router();
const auth = require("../middlewares/auth");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/files', auth(['bidder']), async (req, res) => {
  try {
    const bidderId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [total, records] = await Promise.all([
      prisma.generatedResume.count({ where: { bidderId } }),

      prisma.generatedResume.findMany({
        where: { bidderId },
        orderBy: { date: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const files = records.map((record) => ({
      name: record.name,
      jdUrl: record.jobDescriptionUrl,
      date: record.date,
      url: `/uploads/${bidderId}/${record.date}/${record.name}`, // optional
    }));

    const dateCountsRaw = await prisma.generatedResume.groupBy({
      by: ['date'],
      where: { bidderId },
      _count: { date: true },
    });
    
    const dateCounts = {};
    dateCountsRaw.forEach((entry) => {
      dateCounts[entry.date] = entry._count.date;
    });

    res.json({
      files,
      totalPages: Math.ceil(total / limit),
      dateCounts,
    });
  } catch (err) {
    console.error('Error loading paginated files:', err);
    res.status(500).json({ message: 'Failed to fetch files' });
  }
});


router.post("/delete-file", auth(["bidder"]), async (req, res) => {
  try {
    const { name } = req.body;
    const bidderId = req.user.id;

    // Find the resume in the database
    const resume = await prisma.generatedResume.findFirst({
      where: { name, bidderId },
    });

    if (!resume || resume.bidderId !== bidderId) {
      console.log("Unauthorized access or resume not found:", resume, " -- bidderId:", bidderId);

      return res
        .status(403)
        .json({ message: "Unauthorized or resume not found" });
    }

    const dirPath = path.join(__dirname, "../../uploads", bidderId, resume.date, name);

    // Delete .docx and .txt files
    try {
      fs.unlinkSync(`${dirPath}.docx`);
      fs.unlinkSync(`${dirPath}.txt`);
    } catch (err) {
      console.warn("One or both resume files not found on disk", err);
    }

    await prisma.generatedResume.delete({ where: { id: resume.id } });

    console.log("Resume deleted:", resume.name, " -- bidderId:", bidderId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting resume:", err);
    res.status(500).json({ message: "Failed to delete resume" });
  }
});

// Download a file
router.get("/download", auth(["bidder"]), async (req, res) => {
  try {
    const { filePath } = req.query;
    console.log("File path:", filePath);
    const baseName = path.basename(filePath, path.extname(filePath)); // Get the base name without extension
    const bidderId = req.user.id;

    const resume = await prisma.generatedResume.findFirst({
      where: { name: baseName, bidderId },
    });

    // Check if the resume exists and belongs to the user
    if (!resume || resume.bidderId !== bidderId) {
      console.log("Unauthorized access or resume not found:", resume, " -- bidderId:", bidderId);
      return res.status(404).json({ message: "Unauthorized or resume not found." });
    }

    const fullPath = path.join(__dirname, `../../uploads`, bidderId, resume.date, filePath);

    // 🚧 SECURITY CHECKS HERE:
    // Ensure the file belongs to the current user or their bidder
    // You might want to lookup DB to verify access before allowing it

    if (!fs.existsSync(fullPath)) {
      console.error("File not found:", fullPath);
      return res.status(404).json({ message: "File not found" });
    }

    console.log("Downloading file:", fullPath);
    return res.download(fullPath); // prompts download
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ message: "Download failed" });
  }
});

// Download a folder (zip logic later)
router.get("/download-folder", auth(["bidder"]), async (req, res) => {
  try {
    const date = req.query.date;
    const bidderId = req.user.id;

    const folderPath = path.join(__dirname, "../../uploads", bidderId, date);
    if (!fs.existsSync(folderPath)) {
      console.error("Missing folder:", folderPath);
      return res.status(404).json({ message: "Folder not found" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${date}-resumes.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      res.status(500).send({ message: "Archive failed" });
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="resumes.zip"`);

    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize(); // <- don't forget this!

    console.log("Download folder:", folderPath);
  }
  catch (err) {
    console.error("Error downloading folder:", err);
    res.status(500).json({ message: "Failed to download folder" });
  }
});

module.exports = router;
