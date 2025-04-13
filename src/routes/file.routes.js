// routes/file.routes.js (or wherever resume routes are defined)
const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const OpenAI = require("openai");
const zod = require("zod").z;
const zodResponseFormat = require("openai/helpers/zod").zodResponseFormat;
const auth = require("../middlewares/auth");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const formatBullets = (bulletsArray) => {
  return bulletsArray.map((bullet) => {
    let words = bullet.split("**");
    const segments = words.map((word, index) => ({
      bold: index % 2 == 1 ? word : "",
      plain: index % 2 == 0 ? word : "",
    }));
    return { bullet: segments };
  });
};
const prisma = new PrismaClient();

const formatSkills = (skillsArray) => {
  return skillsArray.map(skill => {
      return {
          bullet : 
          {
              category: skill.category,
              items: skill.items.join(', ')  // Join items with a comma for each category
          }
      };
  });
}

router.post("/resume-draft", auth(["bidder"]), async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const bidderId = req.user.id;

    // Get dev's OpenAI token and prompt
    const bidder = await prisma.user.findUnique({
      where: { id: bidderId },
      include: { developer: true },
    });

    const dev = bidder.developer;
    if (!dev || !dev.openaiToken || !dev.gptPrompt) {
      console.log("Missing OpenAI credentials or prompt for dev:", dev.id);

      return res
        .status(400)
        .json({ message: "Missing supervisor OpenAI credentials or prompt" });
    }

    const gpt = new OpenAI({ apiKey: dev.openaiToken });

    const resumeSchema = zod.object({
      companyName: zod.string(),
      roleTitle: zod.string(),
      summary: zod.string(),
      skills: zod.array(zod.object({
        category: zod.string(),
        items: zod.array(zod.string())
    })),
      experience_first: zod.array(zod.string()),
      experience_second: zod.array(zod.string()),
      experience_third: zod.array(zod.string()),
    });

    const result = await gpt.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        { role: "system", content: dev.gptPrompt + "\n" + jobDescription },
      ],
      response_format: zodResponseFormat(resumeSchema, "resume_generation"),
    });

    const parsed = JSON.parse(result.choices[0].message.content);
    return res.json({ resume: parsed }); // return resume parts to frontend
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OpenAI resume generation failed" });
  }
});

router.post("/resume-finalize", auth(["bidder"]), async (req, res) => {
  try {
    const {
      companyName,
      roleTitle,
      summary,
      skills,
      experience_first,
      experience_second,
      experience_third,
      jobDescription,
      jdUrl,
    } = req.body;

    const bidderId = req.user.id;
    const bidder = await prisma.user.findUnique({
      where: { id: bidderId },
      include: { developer: true },
    });

    const dev = bidder.developer;
    if (!dev)
      return res.status(400).json({ message: "Bidder has no supervisor" });

    const today = new Date().toISOString().slice(0, 10);
    const basePath = path.join(__dirname, `../../uploads/${bidderId}/${today}`);
    fs.mkdirSync(basePath, { recursive: true });

    const filenameBase = `${roleTitle.replace(/[\s/]+/g, "_")}-${companyName}`;
    const resumePath = path.join(basePath, filenameBase + ".docx");
    const jdPath = path.join(basePath, filenameBase + ".txt");

    // Check if the resume already exists
    const existingResume = await prisma.generatedResume.findFirst({
      where: { name: filenameBase, bidderId },
    });
    if (existingResume) {
      console.log("Resume with the same company and same title already exists:", existingResume.name);
      return res.status(400).json({ message: "Resume with the same company and same title already exists:" });
    }

    // Load template
    const templatesDir = path.join(__dirname, "../../uploads/templates");
    const templateFile = fs
      .readdirSync(templatesDir)
      .find((f) => f.startsWith(dev.id));
    if (!templateFile) {
      console.log("No template found for dev:", dev.id);
      return res.status(404).json({ message: "No template uploaded by dev" });
    }

    const templateBuffer = fs.readFileSync(
      path.join(templatesDir, templateFile)
    );
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const options = {
      title: roleTitle,
      lastJob: roleTitle,
      summary: summary.replace(/\*/g, ""),
      skills: formatSkills(skills),
      bullets1: formatBullets(experience_first),
      bullets2: formatBullets(experience_second),
      bullets3: formatBullets(experience_third),
    };

    doc.render(options);
    const buf = doc
      .getZip()
      .generate({ type: "nodebuffer", compression: "DEFLATE" });
    fs.writeFileSync(resumePath, buf);
    fs.writeFileSync(jdPath, jobDescription);

    // Save record to DB
    await prisma.generatedResume.create({
      data: {
        bidderId,
        date: today,
        name: filenameBase,
        jobDescriptionUrl: jdUrl || "",
      },
    });

    console.log("Resume saved to:", resumePath, " for bidder:", bidder.username);

    res.json({
      message: "Resume finalized and saved",
      name: filenameBase,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Resume finalization failed" });
  }
});

module.exports = router;