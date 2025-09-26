const express = require("express");
const { auth } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { success, error } = require("../utils/responseHelper");
const Problem = require("../models/Problem");
const User = require("../models/User");
const UserProgress = require("../models/UserProgress");

const router = express.Router();

// Admin middleware (simplified - in production, add proper role-based auth)
const isAdmin = (req, res, next) => {
  // For hackathon, allow all authenticated users to be admin
  // In production, check user role
  next();
};

// @route   GET /api/admin/problems
// @desc    Get all problems for admin
// @access  Private (Admin)
router.get("/problems", auth, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, topic, difficulty } = req.query;

    const query = {};
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;

    const problems = await Problem.find(query)
      .populate("createdBy", "username")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Problem.countDocuments(query);

    success(
      res,
      {
        problems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      "Problems retrieved successfully"
    );
  } catch (err) {
    console.error("Get admin problems error:", err);
    error(res, "Failed to retrieve problems", 500);
  }
});

// @route   POST /api/admin/problems
// @desc    Create a new problem
// @access  Private (Admin)
router.post(
  "/problems",
  auth,
  isAdmin,
  validate(schemas.createProblem),
  async (req, res) => {
    try {
      const problemData = {
        ...req.body,
        createdBy: req.user._id,
      };

      const problem = new Problem(problemData);
      await problem.save();

      success(res, problem, "Problem created successfully", 201);
    } catch (err) {
      console.error("Create problem error:", err);
      error(res, "Failed to create problem", 500);
    }
  }
);

// @route   PUT /api/admin/problems/:id
// @desc    Update a problem
// @access  Private (Admin)
router.put(
  "/problems/:id",
  auth,
  isAdmin,
  validate(schemas.createProblem),
  async (req, res) => {
    try {
      const problem = await Problem.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!problem) {
        return error(res, "Problem not found", 404);
      }

      success(res, problem, "Problem updated successfully");
    } catch (err) {
      console.error("Update problem error:", err);
      error(res, "Failed to update problem", 500);
    }
  }
);

// @route   DELETE /api/admin/problems/:id
// @desc    Delete a problem (soft delete)
// @access  Private (Admin)
router.delete("/problems/:id", auth, isAdmin, async (req, res) => {
  try {
    const problem = await Problem.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!problem) {
      return error(res, "Problem not found", 404);
    }

    success(res, null, "Problem deleted successfully");
  } catch (err) {
    console.error("Delete problem error:", err);
    error(res, "Failed to delete problem", 500);
  }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin
// @access  Private (Admin)
router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments();

    // Get problem solving stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const solvedCount = await UserProgress.countDocuments({
          userId: user._id,
          status: "solved",
        });
        const attemptedCount = await UserProgress.countDocuments({
          userId: user._id,
        });

        return {
          ...user.toObject(),
          stats: {
            solved: solvedCount,
            attempted: attemptedCount,
            successRate:
              attemptedCount > 0
                ? Math.round((solvedCount / attemptedCount) * 100)
                : 0,
          },
        };
      })
    );

    success(
      res,
      {
        users: usersWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      "Users retrieved successfully"
    );
  } catch (err) {
    console.error("Get admin users error:", err);
    error(res, "Failed to retrieve users", 500);
  }
});

// @route   GET /api/admin/analytics
// @desc    Get platform analytics
// @access  Private (Admin)
router.get("/analytics", auth, isAdmin, async (req, res) => {
  try {
    // Basic analytics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    const totalProblems = await Problem.countDocuments({ isActive: true });
    const totalSolved = await UserProgress.countDocuments({ status: "solved" });

    // Problem difficulty distribution
    const difficultyStats = await Problem.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]);

    // Topic distribution
    const topicStats = await Problem.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$topic", count: { $sum: 1 } } },
    ]);

    // Most solved problems
    const popularProblems = await UserProgress.aggregate([
      { $match: { status: "solved" } },
      { $group: { _id: "$problemId", solveCount: { $sum: 1 } } },
      { $sort: { solveCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "problems",
          localField: "_id",
          foreignField: "_id",
          as: "problem",
        },
      },
      { $unwind: "$problem" },
      {
        $project: {
          title: "$problem.title",
          difficulty: "$problem.difficulty",
          topic: "$problem.topic",
          solveCount: 1,
        },
      },
    ]);

    success(
      res,
      {
        overview: {
          totalUsers,
          activeUsers,
          totalProblems,
          totalSolved,
        },
        difficultyStats,
        topicStats,
        popularProblems,
      },
      "Analytics retrieved successfully"
    );
  } catch (err) {
    console.error("Get analytics error:", err);
    error(res, "Failed to retrieve analytics", 500);
  }
});

module.exports = router;
