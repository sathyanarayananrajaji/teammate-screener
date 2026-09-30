import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  studentName: String,
  skill: String,
  level: String,
  score: Number,
  passed: Boolean,
}, { timestamps: true });

const Result = mongoose.models.Result || mongoose.model("Result", resultSchema);
export default Result;