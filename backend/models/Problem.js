const mongoose = require("mongoose");

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Problem title is required"],
      trim: true,
      maxlength: [200, "Title must be less than 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Problem description is required"],
      trim: true,
    },
    difficulty: {
      type: String,
      required: [true, "Difficulty level is required"],
      enum: ["easy", "medium", "hard"],
    },
    topic: {
      type: String,
      required: [true, "Topic is required"],
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
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    testCases: [
      {
        input: {
          type: String,
          required: true,
        },
        expectedOutput: {
          type: String,
          required: true,
        },
        isHidden: {
          type: Boolean,
          default: false,
        },
      },
    ],
    solution: {
      type: String,
      trim: true,
    },
    hints: [
      {
        type: String,
        trim: true,
      },
    ],
    timeComplexity: {
      type: String,
      trim: true,
    },
    spaceComplexity: {
      type: String,
      trim: true,
    },
    constraints: {
      type: String,
      trim: true,
    },
    examples: [
      {
        input: String,
        output: String,
        explanation: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
problemSchema.index({ topic: 1, difficulty: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ topic: 1 });
problemSchema.index({ isActive: 1 });
problemSchema.index({ createdAt: -1 });

// Virtual for solve count
problemSchema.virtual("solveCount", {
  ref: "UserProgress",
  localField: "_id",
  foreignField: "problemId",
  count: true,
  match: { status: "solved" },
});

module.exports = mongoose.model("Problem", problemSchema);
