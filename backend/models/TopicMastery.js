const mongoose = require("mongoose");

const topicMasterySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topic: {
      type: String,
      required: true,
      enum: [
        "stack",
        "queue",
        "linked-list",
        "trees",
        "graphs",
        "dynamic-programming",
        "arrays",
        "strings",
        "sorting",
        "searching",
      ],
    },
    masteryLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    problemsAttempted: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
    problemsSolved: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
    successRates: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
      overall: { type: Number, default: 0 },
    },
    averageAttempts: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    weakAreas: [
      {
        type: String,
      },
    ],
    strengths: [
      {
        type: String,
      },
    ],
    recommendedDifficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
  },
  {
    timestamps: true,
  }
);

// Composite index
topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });
topicMasterySchema.index({ userId: 1, masteryLevel: -1 });
topicMasterySchema.index({ lastUpdated: -1 });

// Calculate mastery level before saving
topicMasterySchema.pre("save", function (next) {
  const totalSolved =
    this.problemsSolved.easy +
    this.problemsSolved.medium +
    this.problemsSolved.hard;
  const totalAttempted =
    this.problemsAttempted.easy +
    this.problemsAttempted.medium +
    this.problemsAttempted.hard;

  if (totalAttempted > 0) {
    // Base success rate (0-60 points)
    this.successRates.overall = (totalSolved / totalAttempted) * 100;
    let masteryScore = this.successRates.overall * 0.6;

    // Difficulty distribution bonus (0-25 points)
    const difficultyBonus =
      (this.problemsSolved.medium * 1.5 + this.problemsSolved.hard * 2.5) /
      Math.max(totalSolved, 1);
    masteryScore += difficultyBonus * 25;

    // Consistency bonus (0-15 points)
    const consistencyScore = Math.min(totalAttempted / 10, 1) * 15;
    masteryScore += consistencyScore;

    this.masteryLevel = Math.min(Math.round(masteryScore), 100);
  }

  // Determine recommended difficulty
  if (this.masteryLevel < 40) {
    this.recommendedDifficulty = "easy";
  } else if (this.masteryLevel < 70) {
    this.recommendedDifficulty = "medium";
  } else {
    this.recommendedDifficulty = "hard";
  }

  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model("TopicMastery", topicMasterySchema);
