import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  adminRequested: { type: Boolean, default: false },
  developer: { type: Boolean, default: false },
});

export default mongoose.model("User", userSchema);
