const router = require("express").Router();
const auth = require("../middlewares/auth");
const archiver = require("archiver");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/templates');
  },
  filename: (req, file, cb) => {
    // Name format: <developerId>__<originalFilename>
    const ext = path.extname(file.originalname);
    const cleanName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${req.user.id}__${cleanName}`);
  },
});

const upload = multer({ storage });

// Get bidders for this developer
router.get("/bidders", auth(["developer"]), async (req, res) => {
  try {
    const bidders = await prisma.user.findMany({
      where: { developerId: req.user.id, role: "bidder" },
      select: { id: true, username: true },
    });
    res.json(bidders);
  }
  catch (error) {
    console.error("Error fetching bidders:", error);
    res.status(500).json({ message: "Failed to fetch bidders." });
  }
});

// Get bidder files by ID (stub)
router.get("/bidder-files/:id", auth(["developer"]), async (req, res) => {
  try {
    const bidderId = req.params.id;
    const devId = req.user.id;

    const bidder = await prisma.user.findUnique({ where: { id: bidderId } });
    if (!bidder || bidder.developerId !== devId) {
      console.log("Unauthorized access to bidder:", bidderId, " -- developerId:", devId);
      return res.status(403).json({ message: "Unauthorized" });
    }

    const resumes = await prisma.generatedResume.findMany({
      where: { bidderId },
      orderBy: { date: "desc" },
    });

    const fileMap = {};
    for (const resume of resumes) {
      const date = resume.date;

      if (!fileMap[date]) fileMap[date] = [];

      fileMap[date].push({
        name: resume.name,
        jdUrl: resume.jobDescriptionUrl,
      });
    }

    res.json(fileMap);
  } catch (error) {
    console.error("Error fetching bidder's resumes:", error);
    res.status(500).json({ message: "Failed to fetch bidder's resumes." });
  }
});

// This route is used to delete a generated resume file for a bidder
router.post("/delete-bidder-file/:id", auth(["developer"]), async (req, res) => {
  try {
    const { name } = req.body;
    const bidderId = req.params.id;
    const devId = req.user.id;

    const bidder = await prisma.user.findUnique({ where: { id: bidderId } });
    if (!bidder || bidder.developerId !== devId) {
      console.log("Unauthorized access to bidder:", bidderId, " -- developerId:", devId);
      return res.status(403).json({ message: "Unauthorized" });
    }

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

// Upload or replace developer's template
router.post('/template-upload', auth(['developer']), upload.single('template'), async (req, res) => {
  try {
    const devId = req.user.id;
    const uploadedFile = req.file;

    if (!uploadedFile) {
      console.log("Failed to upload template:", req.file, " -- developerId:", devId);
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Remove previous templates by this developer
    const templateDir = path.join(__dirname, '../../uploads/templates');
    const files = fs.readdirSync(templateDir);
    files.forEach(file => {
      if (file.startsWith(devId) && file !== uploadedFile.filename) {
        fs.unlinkSync(path.join(templateDir, file));
      }
    });

    console.log("Template uploaded:", uploadedFile.filename, " -- developerId:", devId);

    res.json({
      message: 'Template uploaded successfully',
      fileName: uploadedFile.filename,
      fileUrl: `/uploads/templates/${uploadedFile.filename}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// GET current template file
router.get('/template', auth(['developer']), async (req, res) => {
  try {
    const templateDir = path.join(__dirname, '../../uploads/templates');
    if (!fs.existsSync(templateDir)) {
      console.log('Template directory does not exist:', templateDir);
      return res.status(404).json({ message: 'Template directory not found' });
    }

    const files = fs.readdirSync(templateDir);

    // Look for file that starts with devId
    const devFile = files.find(f => f.startsWith(req.user.id));

    if (devFile) {
      res.json({
        fileName: devFile,
        fileUrl: `/uploads/templates/${devFile}`,
      });
    } else {
      console.log('No template found for developer:', req.user.id);
      res.status(404).json({ message: 'No template found' });
    }
  } catch (err) {
    console.error('Error retrieving template:', err);
    res.status(500).json({ message: 'Failed to retrieve template' });
  }
});

// DELETE current template
router.delete('/template', auth(['developer']), async (req, res) => {
  try {
    const devId = req.user.id;
    const templateDir = path.join(__dirname, '../../uploads/templates');
    const files = fs.readdirSync(templateDir);

    const devTemplate = files.find(f => f.startsWith(devId));
    if (!devTemplate) {
      console.log('No template found for developer:', devId);
      return res.status(404).json({ message: 'Template not found' });
    }

    const filePath = path.join(templateDir, devTemplate);
    fs.unlinkSync(filePath);

    console.log('Template deleted:', devTemplate, " -- developerId:", devId);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    return res.status(500).json({ message: 'Failed to delete template' });
  }
});

// Save OpenAI token
router.post("/openai-token", auth(["developer"]), async (req, res) => {
  try {
    const { token } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { openaiToken: token },
    });
    console.log("OpenAI token saved for developer:", req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving OpenAI token:", error);
    return res.status(500).json({ message: "Failed to save OpenAI token" });
  }
});

// Get OpenAI token
router.get("/openai-token", auth(["developer"]), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ token: user.openaiToken });
  } catch (error) {
    console.error("Error fetching OpenAI token:", error);
    return res.status(500).json({ message: "Failed to fetch OpenAI token" });
  }
});

// GET GPT prompt
router.get('/gpt-prompt', auth(['developer']), async (req, res) => {
  try {
    const dev = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ prompt: dev.gptPrompt || '' });
  } catch (error) {
    console.error("Error fetching GPT prompt:", error);
    res.status(500).json({ message: "Failed to fetch GPT prompt" });
  }
});

// POST GPT prompt
router.post('/gpt-prompt', auth(['developer']), async (req, res) => {
  try {
    const { prompt } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { gptPrompt: prompt },
    });
    console.log("GPT prompt saved for developer:", req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving GPT prompt:", err);
    res.status(500).json({ message: "Failed to save GPT prompt" });
  }
});

// Download a file
router.get("/download-resume/:bidderId", auth(["developer"]), async (req, res) => {
  try {
    const { bidderId } = req.params;
    const { filePath } = req.query;
    console.log("File path:", filePath);
    const baseName = filePath.split(".")[0];
    const devId = req.user.id;

    // Verify relationship
    const bidder = await prisma.user.findUnique({ where: { id: bidderId } });
    if (!bidder || bidder.developerId !== devId) {
      console.log("Unauthorized access to bidder:", bidderId, " -- developerId:", devId);
      return res.status(403).json({ message: "Not your bidder" });
    }

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

    console.log("Resume is downloaded:", fullPath, " -- bidderId:", bidderId, " -- developerId:", devId);
    return res.download(fullPath); // prompts download
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ message: "Download failed" });
  }
});

router.get("/download-folder/:bidderId", auth(["developer"]), async (req, res) => {
  try {
    const { bidderId } = req.params;
    const { date } = req.query;
    const devId = req.user.id;

    // Verify relationship
    const bidder = await prisma.user.findUnique({ where: { id: bidderId } });
    if (!bidder || bidder.developerId !== devId) {
      console.log("Unauthorized access to bidder:", bidderId, " -- developerId:", devId);
      return res.status(403).json({ message: "Not your bidder" });
    }

    const folderPath = path.join(__dirname, "../../uploads", bidderId, date);
    if (!fs.existsSync(folderPath)) {
      console.error("Missing folder:", folderPath);
      return res.status(404).json({ message: "Folder not found" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${bidder.username}-${date}.zip"`
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

    console.log("Download folder:", folderPath, " -- bidderId:", bidderId, " -- developerId:", devId);
  } catch (error) {
    console.error("Error downloading folder:", error);
    res.status(500).json({ message: "Failed to download folder" });
  }
}
);

module.exports = router;
