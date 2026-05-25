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

const normalizeString = str => {
  return str.toLowerCase().replace(/\s+/g, "");
};

router.get("/", async (req, res) => {
  try {
    const data = await getJsonFromS3(process.env.S3_BUCKET_NAME, "data.json");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/",
  isAdmin,
  upload.fields([
    { name: "mainPhoto", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, description, category, isFeatured } = req.body;
      const files = req.files;

      if (!files.mainPhoto || !files.thumbnail) {
        return res
          .status(400)
          .json({ error: "Main photo and thumbnail are required" });
      }

      const seriesList = await getJsonFromS3(
        process.env.S3_BUCKET_NAME,
        "data.json",
      );
      const normalizedTitle = normalizeString(title);

      if (seriesList.some(s => normalizeString(s.title) === normalizedTitle)) {
        return res.status(409).json({ error: "Series already exists" });
      }

      const id = title.replace(/\s+/g, "");

      const mainExt = files.mainPhoto[0].originalname.split(".").pop();
      const mainKey = `seriesPhotos/${id}mainCoverPhoto.${mainExt}`;

      const thumbExt = files.thumbnail[0].originalname.split(".").pop();
      const thumbKey = `seriesPhotos/${id}thumbnail.${thumbExt}`;

      await uploadMediaToS3(
        process.env.S3_BUCKET_NAME,
        mainKey,
        files.mainPhoto[0].buffer,
        files.mainPhoto[0].mimetype,
      );
      await uploadMediaToS3(
        process.env.S3_BUCKET_NAME,
        thumbKey,
        files.thumbnail[0].buffer,
        files.thumbnail[0].mimetype,
      );

      const newSeries = {
        id,
        title,
        description,
        mainPhoto: mainKey,
        seriesThumbnail: thumbKey,
        category,
        isFeatured: isFeatured === "true",
        episodes: [],
      };

      seriesList.push(newSeries);
      await putJsonToS3(process.env.S3_BUCKET_NAME, "data.json", seriesList);

      res.status(201).json(newSeries);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.put(
  "/:id",
  isAdmin,
  upload.fields([
    { name: "mainPhoto", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, description, category, isFeatured } = req.body;
      const files = req.files;
      const seriesList = await getJsonFromS3(
        process.env.S3_BUCKET_NAME,
        "data.json",
      );

      const index = seriesList.findIndex(s => s.id === req.params.id);
      if (index === -1)
        return res.status(404).json({ error: "Series not found" });

      let newMainKey = seriesList[index].mainPhoto;
      let newThumbKey = seriesList[index].seriesThumbnail;
      const id = title.replace(/\s+/g, "");

      if (files.mainPhoto) {
        if (newMainKey)
          await deleteMediaFromS3(process.env.S3_BUCKET_NAME, newMainKey);
        const mainExt = files.mainPhoto[0].originalname.split(".").pop();
        newMainKey = `seriesPhotos/${id}mainCoverPhoto.${mainExt}`;
        await uploadMediaToS3(
          process.env.S3_BUCKET_NAME,
          newMainKey,
          files.mainPhoto[0].buffer,
          files.mainPhoto[0].mimetype,
        );
      }

      if (files.thumbnail) {
        if (newThumbKey)
          await deleteMediaFromS3(process.env.S3_BUCKET_NAME, newThumbKey);
        const thumbExt = files.thumbnail[0].originalname.split(".").pop();
        newThumbKey = `seriesPhotos/${id}thumbnail.${thumbExt}`;
        await uploadMediaToS3(
          process.env.S3_BUCKET_NAME,
          newThumbKey,
          files.thumbnail[0].buffer,
          files.thumbnail[0].mimetype,
        );
      }

      seriesList[index] = {
        ...seriesList[index],
        title,
        description,
        category,
        mainPhoto: newMainKey,
        seriesThumbnail: newThumbKey,
        isFeatured: isFeatured === true || isFeatured === "true",
      };

      await putJsonToS3(process.env.S3_BUCKET_NAME, "data.json", seriesList);
      res.status(200).json(seriesList[index]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  "/:id/episodes",
  isAdmin,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, epId } = req.body;
      const files = req.files;

      if (!files.video) {
        return res.status(400).json({ error: "Video is required" });
      }

      const seriesList = await getJsonFromS3(
        process.env.S3_BUCKET_NAME,
        "data.json",
      );
      const seriesIndex = seriesList.findIndex(s => s.id === req.params.id);

      if (seriesIndex === -1)
        return res.status(404).json({ error: "Series not found" });

      if (seriesList[seriesIndex].episodes.some(e => e.id === epId)) {
        return res.status(409).json({ error: "Episode ID already exists" });
      }

      const videoFile = files.video[0];
      const videoKey = `videos/${req.params.id}-${epId}.${videoFile.originalname.split(".").pop()}`;
      await uploadMediaToS3(
        process.env.S3_BUCKET_NAME,
        videoKey,
        videoFile.buffer,
        videoFile.mimetype,
      );

      let finalThumbKey;
      if (files.thumbnail) {
        const thumbFile = files.thumbnail[0];
        finalThumbKey = `seriesPhotos/${req.params.id}-${epId}-thumb.${thumbFile.originalname.split(".").pop()}`;
        await uploadMediaToS3(
          process.env.S3_BUCKET_NAME,
          finalThumbKey,
          thumbFile.buffer,
          thumbFile.mimetype,
        );
      } else {
        const episodes = seriesList[seriesIndex].episodes;
        finalThumbKey =
          episodes.length > 0
            ? episodes[0].thumbnail
            : seriesList[seriesIndex].seriesThumbnail;
      }

      const newEpisode = {
        id: epId,
        title,
        url: videoKey,
        thumbnail: finalThumbKey,
      };

      seriesList[seriesIndex].episodes.push(newEpisode);
      await putJsonToS3(process.env.S3_BUCKET_NAME, "data.json", seriesList);

      res.status(201).json(seriesList[seriesIndex]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.delete("/:id/episodes/:epId", isAdmin, async (req, res) => {
  try {
    const seriesList = await getJsonFromS3(
      process.env.S3_BUCKET_NAME,
      "data.json",
    );
    const seriesIndex = seriesList.findIndex(s => s.id === req.params.id);

    if (seriesIndex === -1)
      return res.status(404).json({ error: "Series not found" });

    const episode = seriesList[seriesIndex].episodes.find(
      e => e.id === req.params.epId,
    );
    if (episode) {
      if (episode.url)
        await deleteMediaFromS3(process.env.S3_BUCKET_NAME, episode.url);
      const isThumbUsedElsewhere = seriesList[seriesIndex].episodes.some(
        e => e.id !== req.params.epId && e.thumbnail === episode.thumbnail,
      );
      const isThumbFromSeries =
        episode.thumbnail === seriesList[seriesIndex].seriesThumbnail;

      if (episode.thumbnail && !isThumbUsedElsewhere && !isThumbFromSeries) {
        await deleteMediaFromS3(process.env.S3_BUCKET_NAME, episode.thumbnail);
      }
    }

    seriesList[seriesIndex].episodes = seriesList[seriesIndex].episodes.filter(
      e => e.id !== req.params.epId,
    );

    await putJsonToS3(process.env.S3_BUCKET_NAME, "data.json", seriesList);
    res.status(200).json(seriesList[seriesIndex]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const seriesList = await getJsonFromS3(
      process.env.S3_BUCKET_NAME,
      "data.json",
    );
    const seriesIndex = seriesList.findIndex(s => s.id === req.params.id);

    if (seriesIndex === -1)
      return res.status(404).json({ error: "Series not found" });

    const seriesToDelete = seriesList[seriesIndex];

    if (seriesToDelete.mainPhoto)
      await deleteMediaFromS3(
        process.env.S3_BUCKET_NAME,
        seriesToDelete.mainPhoto,
      );
    if (seriesToDelete.seriesThumbnail)
      await deleteMediaFromS3(
        process.env.S3_BUCKET_NAME,
        seriesToDelete.seriesThumbnail,
      );

    for (const ep of seriesToDelete.episodes) {
      if (ep.url) await deleteMediaFromS3(process.env.S3_BUCKET_NAME, ep.url);
      if (ep.thumbnail && ep.thumbnail !== seriesToDelete.seriesThumbnail) {
        await deleteMediaFromS3(process.env.S3_BUCKET_NAME, ep.thumbnail);
      }
    }

    seriesList.splice(seriesIndex, 1);
    await putJsonToS3(process.env.S3_BUCKET_NAME, "data.json", seriesList);

    res.status(200).json({ message: "Series deleted permanently" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
