const express = require("express");
const { auth, optionalAuth } = require("../middleware/auth");
const { success, error } = require("../utils/responseHelper");
const Problem = require("../models/Problem");
const UserProgress = require("../models/UserProgress");
const DailyRecommendation = require("../models/DailyRecommendation");
const recommendationService = require("../services/recommendationService");

const router = express.Router();

// @route   GET /api/problems/daily-recommendation
// @desc    Get daily recommended problem for user
// @access  Private
router.get("/daily-recommendation", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if recommendation exists for today
    let recommendation = await DailyRecommendation.findOne({
      userId,
      date: today,
    })
      .populate("selectedProblem")
      .populate("recommendedProblems.problemId");

    // Generate new recommendation if none exists
    if (!recommendation) {
      const recommendedProblem =
        await recommendationService.generateDailyRecommendation(userId);

      recommendation = new DailyRecommendation({
        userId,
        date: today,
        recommendedProblems: [
          {
            problemId: recommendedProblem._id,
            difficulty: recommendedProblem.difficulty,
            topic: recommendedProblem.topic,
            reason: "daily_recommendation",
            priority: 1,
            score: 100,
          },
        ],
        selectedProblem: recommendedProblem._id,
      });

      await recommendation.save();
      await recommendation.populate("selectedProblem");
    }

    // Get user's progress on this problem
    const progress = await UserProgress.findOne({
      userId,
      problemId: recommendation.selectedProblem._id,
    });

    success(
      res,
      {
        problem: recommendation.selectedProblem,
        progress: progress || null,
        recommendationId: recommendation._id,
        reason:
          recommendation.recommendedProblems[0]?.reason ||
          "daily_recommendation",
      },
      "Daily recommendation retrieved successfully"
    );
  } catch (err) {
    console.error("Get daily recommendation error:", err);
    error(res, "Failed to get daily recommendation", 500);
  }
});

// @route   GET /api/problems/:id
// @desc    Get specific problem details
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem || !problem.isActive) {
      return error(res, "Problem not found", 404);
    }

    // Get user progress for this problem
    const progress = await UserProgress.findOne({
      userId: req.user._id,
      problemId: problem._id,
    });

    // Hide solution until solved
    const problemData = problem.toObject();
    if (!progress || progress.status !== "solved") {
      delete problemData.solution;
      // Only show first 2 hints
      if (problemData.hints && problemData.hints.length > 2) {
        problemData.hints = problemData.hints.slice(0, 2);
      }
    }

    success(
      res,
      {
        problem: problemData,
        progress: progress || null,
      },
      "Problem retrieved successfully"
    );
  } catch (err) {
    console.error("Get problem error:", err);
    error(res, "Failed to retrieve problem", 500);
  }
});

// @route   POST /api/problems/:id/submit
// @desc    Submit solution for a problem
// @access  Private
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const { code, language = "javascript", timeTaken } = req.body;
    const problemId = req.params.id;
    const userId = req.user._id;

    if (!code || !timeTaken) {
      return error(res, "Code and time taken are required", 400);
    }

    const problem = await Problem.findById(problemId);
    if (!problem || !problem.isActive) {
      return error(res, "Problem not found", 404);
    }

    // Simple test case validation (mock implementation)
    const testCasesPassed =
      Math.floor(Math.random() * problem.testCases.length) + 1;
    const totalTestCases = problem.testCases.length;
    const passed = testCasesPassed === totalTestCases;

    // Find or create user progress
    let progress = await UserProgress.findOne({ userId, problemId });

    if (!progress) {
      progress = new UserProgress({
        userId,
        problemId,
        difficulty: problem.difficulty,
        topic: problem.topic,
        attempts: [],
      });
    }

    // Add new attempt
    const attemptNumber = progress.attempts.length + 1;
    progress.attempts.push({
      attemptNumber,
      code,
      language,
      result: passed ? "passed" : "failed",
      timeTaken,
      testCasesPassed,
      totalTestCases,
      timestamp: new Date(),
    });

    // Update status
    if (passed) {
      progress.status = "solved";
      if (!progress.solvedDate) {
        progress.solvedDate = new Date();

        // Update user stats
        await req.user.updateOne({
          $inc: { "profile.totalSolved": 1 },
        });
      }
    } else {
      progress.status = "attempted";
    }

    await progress.save();

    // Update topic mastery
    await recommendationService.updateTopicMastery(
      userId,
      problem.topic,
      passed
    );

    success(
      res,
      {
        result: passed ? "passed" : "failed",
        testCasesPassed,
        totalTestCases,
        attempt: progress.attempts[progress.attempts.length - 1],
      },
      passed ? "Solution accepted!" : "Solution failed some test cases"
    );
  } catch (err) {
    console.error("Submit solution error:", err);
    error(res, "Failed to submit solution", 500);
  }
});

// @route   GET /api/problems/topic/:topic
// @desc    Get problems by topic
// @access  Private
router.get("/topic/:topic", auth, async (req, res) => {
  try {
    const { topic } = req.params;
    const { difficulty, limit = 10, page = 1 } = req.query;

    const query = { topic, isActive: true };
    if (difficulty) query.difficulty = difficulty;

    const problems = await Problem.find(query)
      .select("-solution -testCases")
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
    console.error("Get problems by topic error:", err);
    error(res, "Failed to retrieve problems", 500);
  }
});

module.exports = router;
