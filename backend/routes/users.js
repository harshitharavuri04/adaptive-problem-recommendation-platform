const express = require("express");
const { auth } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { success, error } = require("../utils/responseHelper");
const User = require("../models/User");
const UserProgress = require("../models/UserProgress");
const TopicMastery = require("../models/TopicMastery");

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    success(res, user, "Profile retrieved successfully");
  } catch (err) {
    console.error("Get profile error:", err);
    error(res, "Failed to retrieve profile", 500);
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  auth,
  validate(schemas.updateProfile),
  async (req, res) => {
    try {
      const { username, skillLevel, preferences } = req.body;
      const updateFields = {};

      if (username) updateFields.username = username;
      if (skillLevel) updateFields["profile.skillLevel"] = skillLevel;
      if (preferences) updateFields["profile.preferences"] = preferences;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateFields },
        { new: true, runValidators: true }
      ).select("-password");

      success(res, user, "Profile updated successfully");
    } catch (err) {
      console.error("Update profile error:", err);
      if (err.code === 11000) {
        return error(res, "Username already taken", 400);
      }
      error(res, "Failed to update profile", 500);
    }
  }
);

// @route   GET /api/users/progress
// @desc    Get user progress overview
// @access  Private
router.get("/progress", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get overall stats
    const totalSolved = await UserProgress.countDocuments({
      userId,
      status: "solved",
    });
    const totalAttempted = await UserProgress.countDocuments({ userId });

    // Get topic mastery
    const topicMastery = await TopicMastery.find({ userId }).sort({
      masteryLevel: -1,
    });

    // Get recent progress
    const recentSolved = await UserProgress.find({
      userId,
      status: "solved",
    })
      .populate("problemId", "title difficulty topic")
      .sort({ solvedDate: -1 })
      .limit(10);

    // Calculate streak
    const user = await User.findById(userId);

    success(
      res,
      {
        stats: {
          totalSolved,
          totalAttempted,
          successRate:
            totalAttempted > 0
              ? Math.round((totalSolved / totalAttempted) * 100)
              : 0,
          currentStreak: user.profile.currentStreak,
          longestStreak: user.profile.longestStreak,
        },
        topicMastery,
        recentSolved,
      },
      "Progress retrieved successfully"
    );
  } catch (err) {
    console.error("Get progress error:", err);
    error(res, "Failed to retrieve progress", 500);
  }
});

// @route   GET /api/users/stats
// @desc    Get detailed user statistics
// @access  Private
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Aggregate statistics by topic and difficulty
    const stats = await UserProgress.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: {
            topic: "$topic",
            difficulty: "$difficulty",
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Format stats
    const formattedStats = {};
    stats.forEach((stat) => {
      const { topic, difficulty, status } = stat._id;
      if (!formattedStats[topic]) {
        formattedStats[topic] = {
          easy: { attempted: 0, solved: 0 },
          medium: { attempted: 0, solved: 0 },
          hard: { attempted: 0, solved: 0 },
        };
      }

      formattedStats[topic][difficulty].attempted += stat.count;
      if (status === "solved") {
        formattedStats[topic][difficulty].solved += stat.count;
      }
    });

    success(res, formattedStats, "Statistics retrieved successfully");
  } catch (err) {
    console.error("Get stats error:", err);
    error(res, "Failed to retrieve statistics", 500);
  }
});

module.exports = router;
