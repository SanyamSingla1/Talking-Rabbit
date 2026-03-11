import express from "express";
import cors from "cors";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- Multer Setup ---------- */

const upload = multer({
  dest: "uploads/"
});

/* ---------- OpenAI Setup ---------- */

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY missing in .env");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ---------- Dataset Memory ---------- */

let dataset = [];

/* ---------- Upload CSV API ---------- */

app.post("/upload", upload.single("file"), (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded"
      });
    }

    dataset = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => dataset.push(row))
      .on("end", () => {

        console.log("Rows loaded:", dataset.length);

        res.json({
          message: "CSV uploaded successfully",
          rows: dataset.length
        });

      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "CSV parsing failed" });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }

});

/* ---------- Ask Question API ---------- */

app.post("/ask", async (req, res) => {

  try {

    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "Question is required"
      });
    }

    if (dataset.length === 0) {
      return res.status(400).json({
        error: "Upload a CSV file first"
      });
    }

    const prompt = `
You are a business data analyst.

Dataset sample:
${JSON.stringify(dataset.slice(0, 10), null, 2)}

Question:
${question}

Give a short clear answer.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: prompt }
      ]
    });

    const answer = response.choices[0].message.content;

    res.json({
      answer,
      data: dataset
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "AI processing failed"
    });

  }

});

/* ---------- Start Server ---------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});