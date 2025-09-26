const mongoose = require("mongoose");

const dailyRecommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      },
    },
    recommendedProblems: [
      {
        problemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Problem",
          required: true,
        },
        difficulty: {
          type: String,
          enum: ["easy", "medium", "hard"],
          required: true,
        },
        topic: {
          type: String,
          required: true,
        },
        reason: {
          type: String,
          enum: [
            "new_topic",
            "reinforce_weak",
            "progression",
            "random",
            "streak_maintenance",
            "daily_recommendation",
          ], // ✅ Added 'daily_recommendation'
          required: true,
        },

        priority: {
          type: Number,
          required: true,
          min: 1,
          max: 10,
        },
        score: {
          type: Number,
          required: true,
        },
      },
    ],
    selectedProblem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    skipped: {
      type: Boolean,
      default: false,
    },
    feedback: {
      difficulty_rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      helpful: {
        type: Boolean,
      },
      comments: String,
    },
  },
  {
    timestamps: true,
  }
);

// Composite index to ensure one recommendation per user per day
dailyRecommendationSchema.index({ userId: 1, date: 1 }, { unique: true });
dailyRecommendationSchema.index({ date: -1 });
dailyRecommendationSchema.index({ userId: 1, completed: 1 });

module.exports = mongoose.model(
  "DailyRecommendation",
  dailyRecommendationSchema
);
