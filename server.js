import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import musicRoutes from "./routes/music.js";
import seriesRoutes from "./routes/series.js";
import epubsRoute from "./routes/epubs.js";
import users from "./routes/users.js";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://content-manager-frontend-brown.vercel.app",
    ],
    credentials: true,
  }),
);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("DB connected"))
  .catch(err => console.error(err));

app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/series", seriesRoutes);
app.use("/api/epubs", epubsRoute);
app.use("/api/users", users);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
