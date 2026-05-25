import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const isDeveloper = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user || user.developer !== true) {
      return res
        .status(403)
        .json({ error: "Access denied. You are not a developer." });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
