import express from "express";
import multer from "multer";
import {
  getJsonFromS3,
  putJsonToS3,
  uploadMediaToS3,
  deleteMediaFromS3,
} from "../services/s3Service.js";
import { isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", async (req, res) => {
  try {
    const data = await getJsonFromS3(
      process.env.S3_BUCKET_NAME,
      "epubList.json",
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/",
  isAdmin,
  upload.fields([
    { name: "epub", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title } = req.body;
      const files = req.files;

      if (!files.epub || !files.cover) {
        return res
          .status(400)
          .json({ error: "Both file and cover are required" });
      }

      const list = await getJsonFromS3(
        process.env.S3_BUCKET_NAME,
        "epubList.json",
      );
      const fileNameBase = title.replace(/\s+/g, "");

      const epubKey = `epubs/${fileNameBase}.${files.epub[0].originalname.split(".").pop()}`;
      const coverKey = `epubs/${fileNameBase}Cover.${files.cover[0].originalname.split(".").pop()}`;

      await uploadMediaToS3(
        process.env.S3_BUCKET_NAME,
        epubKey,
        files.epub[0].buffer,
        files.epub[0].mimetype,
      );
      await uploadMediaToS3(
        process.env.S3_BUCKET_NAME,
        coverKey,
        files.cover[0].buffer,
        files.cover[0].mimetype,
      );

      const newEntry = { title, url: epubKey, cover: coverKey };
      list.push(newEntry);
      await putJsonToS3(process.env.S3_BUCKET_NAME, "epubList.json", list);

      res.status(201).json(newEntry);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.delete("/:url", isAdmin, async (req, res) => {
  try {
    const list = await getJsonFromS3(
      process.env.S3_BUCKET_NAME,
      "epubList.json",
    );
    const index = list.findIndex(
      e => e.url === decodeURIComponent(req.params.url),
    );

    if (index === -1) return res.status(404).json({ error: "Not found" });

    await deleteMediaFromS3(process.env.S3_BUCKET_NAME, list[index].url);
    await deleteMediaFromS3(process.env.S3_BUCKET_NAME, list[index].cover);

    list.splice(index, 1);
    await putJsonToS3(process.env.S3_BUCKET_NAME, "epubList.json", list);
    res.status(200).json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
