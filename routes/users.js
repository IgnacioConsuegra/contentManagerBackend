import express from "express";
import User from "../models/User.js";
import { isDeveloper } from "../middleware/devMiddleWare.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const users = await User.find({ developer: false });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", isDeveloper, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true },
    );
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
