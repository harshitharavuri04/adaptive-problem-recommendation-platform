const express = require("express");
const { auth } = require("../middleware/auth");
const { success, error } = require("../utils/responseHelper");
const UserProgress = require("../models/UserProgress");
const TopicMastery = require("../models/TopicMastery");
const DailyRecommendation = require("../models/DailyRecommendation");

const router = express.Router();

// @route   GET /api/progress/stats
// @desc    Get detailed progress statistics
// @access  Private
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = "30" } = req.query; // days

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(timeframe));

    // Overall stats
    const totalSolved = await UserProgress.countDocuments({
      userId,
      status: "solved",
    });
    const totalAttempted = await UserProgress.countDocuments({ userId });
    const recentSolved = await UserProgress.countDocuments({
      userId,
      status: "solved",
      solvedDate: { $gte: daysAgo },
    });

    // Topic breakdown
    const topicStats = await UserProgress.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$topic",
          attempted: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ["$status", "solved"] }, 1, 0] } },
          avgAttempts: { $avg: "$totalAttempts" },
        },
      },
    ]);

    // Difficulty breakdown
    const difficultyStats = await UserProgress.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$difficulty",
          attempted: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ["$status", "solved"] }, 1, 0] } },
        },
      },
    ]);

    // Daily activity
    const dailyActivity = await UserProgress.aggregate([
      {
        $match: {
          userId,
          solvedDate: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$solvedDate" } },
          solved: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    success(
      res,
      {
        overview: {
          totalSolved,
          totalAttempted,
          recentSolved,
          successRate:
            totalAttempted > 0
              ? Math.round((totalSolved / totalAttempted) * 100)
              : 0,
        },
        topicStats,
        difficultyStats,
        dailyActivity,
      },
      "Progress statistics retrieved successfully"
    );
  } catch (err) {
    console.error("Get progress stats error:", err);
    error(res, "Failed to retrieve progress statistics", 500);
  }
});

// @route   GET /api/progress/history
// @desc    Get solution history
// @access  Private
router.get("/history", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const userId = req.user._id;

    const history = await UserProgress.find({ userId, status: "solved" })
      .populate("problemId", "title difficulty topic")
      .sort({ solvedDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await UserProgress.countDocuments({
      userId,
      status: "solved",
    });

    success(
      res,
      {
        history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      "Solution history retrieved successfully"
    );
  } catch (err) {
    console.error("Get history error:", err);
    error(res, "Failed to retrieve solution history", 500);
  }
});

// @route   GET /api/progress/mastery
// @desc    Get topic mastery levels
// @access  Private
router.get("/mastery", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const mastery = await TopicMastery.find({ userId }).sort({
      masteryLevel: -1,
    });

    // Calculate overall mastery
    const overallMastery =
      mastery.length > 0
        ? Math.round(
            mastery.reduce((sum, topic) => sum + topic.masteryLevel, 0) /
              mastery.length
          )
        : 0;

    success(
      res,
      {
        overallMastery,
        topics: mastery,
        recommendations: mastery
          .filter((topic) => topic.masteryLevel < 70)
          .sort((a, b) => a.masteryLevel - b.masteryLevel)
          .slice(0, 3)
          .map((topic) => ({
            topic: topic.topic,
            masteryLevel: topic.masteryLevel,
            recommendedDifficulty: topic.recommendedDifficulty,
            reason:
              topic.masteryLevel < 40
                ? "Focus on basics"
                : "Practice more problems",
          })),
      },
      "Topic mastery retrieved successfully"
    );
  } catch (err) {
    console.error("Get mastery error:", err);
    error(res, "Failed to retrieve topic mastery", 500);
  }
});

// @route   GET /api/progress/streak
// @desc    Get streak information
// @access  Private
router.get("/streak", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get last 30 days of activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRecommendations = await DailyRecommendation.find({
      userId,
      date: { $gte: thirtyDaysAgo },
    }).sort({ date: -1 });

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);

      const dayRecommendation = recentRecommendations.find(
        (r) => r.date.toDateString() === checkDate.toDateString()
      );

      if (dayRecommendation && dayRecommendation.completed) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Update user streak
    await req.user.updateOne({
      "profile.currentStreak": currentStreak,
      "profile.longestStreak": Math.max(
        currentStreak,
        req.user.profile.longestStreak || 0
      ),
    });

    success(
      res,
      {
        currentStreak,
        longestStreak: Math.max(
          currentStreak,
          req.user.profile.longestStreak || 0
        ),
        recentActivity: recentRecommendations.slice(0, 7).map((r) => ({
          date: r.date,
          completed: r.completed,
          skipped: r.skipped,
        })),
      },
      "Streak information retrieved successfully"
    );
  } catch (err) {
    console.error("Get streak error:", err);
    error(res, "Failed to retrieve streak information", 500);
  }
});

module.exports = router;
