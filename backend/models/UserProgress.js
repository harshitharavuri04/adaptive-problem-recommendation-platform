const mongoose = require("mongoose");

const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    attempts: [
      {
        attemptNumber: {
          type: Number,
          required: true,
        },
        code: {
          type: String,
          required: true,
        },
        language: {
          type: String,
          default: "javascript",
          enum: ["javascript", "python", "java", "cpp", "c"],
        },
        result: {
          type: String,
          enum: ["passed", "failed", "partial", "timeout", "runtime-error"],
          required: true,
        },
        timeTaken: {
          type: Number, // in minutes
          required: true,
        },
        testCasesPassed: {
          type: Number,
          default: 0,
        },
        totalTestCases: {
          type: Number,
          default: 0,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["not-attempted", "attempted", "solved", "skipped"],
      default: "not-attempted",
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
    firstAttemptDate: {
      type: Date,
    },
    solvedDate: {
      type: Date,
    },
    totalAttempts: {
      type: Number,
      default: 0,
    },
    bestTime: {
      type: Number, // in minutes
    },
    hintsUsed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Composite indexes
userProgressSchema.index({ userId: 1, problemId: 1 }, { unique: true });
userProgressSchema.index({ userId: 1, status: 1 });
userProgressSchema.index({ userId: 1, topic: 1, difficulty: 1 });
userProgressSchema.index({ userId: 1, solvedDate: -1 });

// Update total attempts before saving
userProgressSchema.pre("save", function (next) {
  this.totalAttempts = this.attempts.length;

  if (this.status === "solved" && !this.solvedDate) {
    this.solvedDate = new Date();
  }

  if (this.attempts.length > 0 && !this.firstAttemptDate) {
    this.firstAttemptDate = this.attempts[0].timestamp;
  }

  next();
});

module.exports = mongoose.model("UserProgress", userProgressSchema);
