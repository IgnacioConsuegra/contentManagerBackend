import express from "express";
import multer from "multer";
import {
  getJsonFromS3,
  putJsonToS3,
  uploadMediaToS3,
} from "../services/s3Service.js";
import { isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const normalizeString = str => {
  return str.toLowerCase().replace(/\s+/g, "");
};

router.get("/", async (req, res) => {
  try {
    const data = await getJsonFromS3(process.env.S3_BUCKET_NAME, "songs.json");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", isAdmin, upload.single("file"), async (req, res) => {
  try {
    const { title, artist, category } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "File is required" });

    const songs = await getJsonFromS3(process.env.S3_BUCKET_NAME, "songs.json");

    const normalizedTitle = normalizeString(title);
    const normalizedArtist = normalizeString(artist);

    const isDuplicate = songs.some(
      song =>
        normalizeString(song.title) === normalizedTitle &&
        normalizeString(song.artist) === normalizedArtist,
    );

    if (isDuplicate) {
      return res.status(409).json({ error: "Song already exists" });
    }

    const fileName = `${artist.replace(/\s+/g, "")}${title.replace(/\s+/g, "")}.mp3`;
    const s3Key = `music/${fileName}`;

    await uploadMediaToS3(
      process.env.S3_BUCKET_NAME,
      s3Key,
      file.buffer,
      file.mimetype,
    );

    const newSong = {
      title,
      artist,
      url: s3Key,
      category,
    };

    songs.push(newSong);
    await putJsonToS3(process.env.S3_BUCKET_NAME, "songs.json", songs);

    res.status(201).json(newSong);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/", isAdmin, async (req, res) => {
  try {
    const { oldUrl, title, artist, category, url } = req.body;
    const songs = await getJsonFromS3(process.env.S3_BUCKET_NAME, "songs.json");

    const songIndex = songs.findIndex(song => song.url === oldUrl);

    if (songIndex === -1) {
      return res.status(404).json({ error: "Song not found" });
    }

    songs[songIndex] = {
      title,
      artist,
      category,
      url,
    };

    await putJsonToS3(process.env.S3_BUCKET_NAME, "songs.json", songs);
    res.status(200).json(songs[songIndex]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.delete("/:url", isAdmin, async (req, res) => {
  try {
    const songUrl = decodeURIComponent(req.params.url);
    const songs = await getJsonFromS3(process.env.S3_BUCKET_NAME, "songs.json");

    const songIndex = songs.findIndex(s => s.url === songUrl);
    if (songIndex === -1)
      return res.status(404).json({ error: "Song not found" });

    await deleteMediaFromS3(process.env.S3_BUCKET_NAME, songUrl);

    songs.splice(songIndex, 1);
    await putJsonToS3(process.env.S3_BUCKET_NAME, "songs.json", songs);

    res.status(200).json({ message: "Song deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default router;
