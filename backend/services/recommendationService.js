const Problem = require("../models/Problem");
const UserProgress = require("../models/UserProgress");
const TopicMastery = require("../models/TopicMastery");
const User = require("../models/User");
const logger = require("../utils/logger");

class RecommendationService {
  // Generate daily recommendation for a user
  async generateDailyRecommendation(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      // Get user's topic mastery
      const topicMasteries = await TopicMastery.find({ userId });

      // Get user's recent progress
      const recentProgress = await UserProgress.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10);

      // If new user, start with easy array problems
      if (recentProgress.length === 0) {
        return await this.getRandomProblem("arrays", "easy");
      }

      // Find weakest topic
      const weakestTopic = await this.findWeakestTopic(userId, topicMasteries);

      if (weakestTopic) {
        // Focus on weak area
        const difficulty = this.selectDifficultyForTopic(weakestTopic);
        return await this.getRandomProblem(weakestTopic.topic, difficulty);
      }

      // Progressive learning: introduce new topic
      const nextTopic = await this.getNextTopic(userId, topicMasteries);
      if (nextTopic) {
        return await this.getRandomProblem(nextTopic, "easy");
      }

      // Fallback: random problem based on skill level
      return await this.getRandomProblem(
        null,
        user.profile.skillLevel === "beginner" ? "easy" : "medium"
      );
    } catch (error) {
      logger.error("Generate recommendation error:", error);
      // Fallback to any easy problem
      return await this.getRandomProblem("arrays", "easy");
    }
  }

  // Find the weakest topic for the user
  async findWeakestTopic(userId, topicMasteries) {
    if (topicMasteries.length === 0) return null;

    // Sort by mastery level ascending
    const sortedTopics = topicMasteries
      .filter((topic) => topic.masteryLevel < 70) // Only consider weak areas
      .sort((a, b) => a.masteryLevel - b.masteryLevel);

    return sortedTopics.length > 0 ? sortedTopics[0] : null;
  }

  // Select appropriate difficulty for a topic
  selectDifficultyForTopic(topicMastery) {
    if (topicMastery.masteryLevel < 30) return "easy";
    if (topicMastery.masteryLevel < 60) return "medium";
    return "hard";
  }

  // Get next topic to introduce
  async getNextTopic(userId, currentMasteries) {
    const allTopics = [
      "arrays",
      "strings",
      "stack",
      "queue",
      "linked-list",
      "trees",
      "graphs",
      "dynamic-programming",
    ];
    const masteredTopics = currentMasteries
      .filter((topic) => topic.masteryLevel >= 50)
      .map((topic) => topic.topic);

    // Find next topic not yet attempted or mastered
    for (const topic of allTopics) {
      if (!masteredTopics.includes(topic)) {
        const hasProgress = await UserProgress.findOne({ userId, topic });
        if (!hasProgress) {
          return topic;
        }
      }
    }

    return null;
  }

  // Get random problem by criteria
  async getRandomProblem(topic = null, difficulty = "easy") {
    try {
      const query = { isActive: true, difficulty };
      if (topic) query.topic = topic;

      const count = await Problem.countDocuments(query);
      if (count === 0) {
        // Fallback to any problem if no match found
        return await Problem.findOne({ isActive: true });
      }

      const randomIndex = Math.floor(Math.random() * count);
      return await Problem.findOne(query).skip(randomIndex);
    } catch (error) {
      logger.error("Get random problem error:", error);
      // Ultimate fallback
      return await Problem.findOne({ isActive: true });
    }
  }

  // Update topic mastery after solving a problem
  async updateTopicMastery(userId, topic, solved = false) {
    try {
      let topicMastery = await TopicMastery.findOne({ userId, topic });

      if (!topicMastery) {
        topicMastery = new TopicMastery({ userId, topic });
      }

      // Get all user progress for this topic
      const topicProgress = await UserProgress.find({ userId, topic });

      if (topicProgress.length === 0) return;

      // Calculate statistics
      const attempted = topicProgress.length;
      const solvedCount = topicProgress.filter(
        (p) => p.status === "solved"
      ).length;
      const successRate = (solvedCount / attempted) * 100;

      // Update counters by difficulty
      ["easy", "medium", "hard"].forEach((diff) => {
        const diffProblems = topicProgress.filter((p) => p.difficulty === diff);
        topicMastery.problemsAttempted[diff] = diffProblems.length;
        topicMastery.problemsSolved[diff] = diffProblems.filter(
          (p) => p.status === "solved"
        ).length;

        if (diffProblems.length > 0) {
          topicMastery.successRates[diff] =
            (topicMastery.problemsSolved[diff] / diffProblems.length) * 100;
          topicMastery.averageAttempts[diff] =
            diffProblems.reduce((sum, p) => sum + p.totalAttempts, 0) /
            diffProblems.length;
        }
      });

      // Calculate overall mastery (this will be done in pre-save hook)
      await topicMastery.save();

      logger.info(
        `Updated topic mastery for user ${userId}, topic ${topic}: ${topicMastery.masteryLevel}%`
      );
    } catch (error) {
      logger.error("Update topic mastery error:", error);
    }
  }

  // Analyze user performance patterns
  async analyzeUserPerformance(userId) {
    try {
      const recentProgress = await UserProgress.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20);

      if (recentProgress.length === 0) {
        return {
          overallSuccessRate: 0,
          averageAttempts: 0,
          strongTopics: [],
          weakTopics: [],
          recommendations: ["Start with easy array problems"],
        };
      }

      const solved = recentProgress.filter((p) => p.status === "solved").length;
      const overallSuccessRate = (solved / recentProgress.length) * 100;
      const averageAttempts =
        recentProgress.reduce((sum, p) => sum + p.totalAttempts, 0) /
        recentProgress.length;

      // Group by topics
      const topicStats = {};
      recentProgress.forEach((progress) => {
        if (!topicStats[progress.topic]) {
          topicStats[progress.topic] = { attempted: 0, solved: 0 };
        }
        topicStats[progress.topic].attempted++;
        if (progress.status === "solved") {
          topicStats[progress.topic].solved++;
        }
      });

      const strongTopics = Object.entries(topicStats)
        .filter(
          ([topic, stats]) =>
            stats.attempted >= 3 && stats.solved / stats.attempted >= 0.7
        )
        .map(([topic]) => topic);

      const weakTopics = Object.entries(topicStats)
        .filter(
          ([topic, stats]) =>
            stats.attempted >= 2 && stats.solved / stats.attempted < 0.5
        )
        .map(([topic]) => topic);

      // Generate recommendations
      const recommendations = [];
      if (weakTopics.length > 0) {
        recommendations.push(`Focus on ${weakTopics[0]} problems`);
      }
      if (overallSuccessRate < 50) {
        recommendations.push("Practice easier problems to build confidence");
      }
      if (averageAttempts > 3) {
        recommendations.push(
          "Take time to understand the problem before coding"
        );
      }

      return {
        overallSuccessRate,
        averageAttempts,
        strongTopics,
        weakTopics,
        recommendations:
          recommendations.length > 0
            ? recommendations
            : ["Keep up the good work!"],
      };
    } catch (error) {
      logger.error("Analyze performance error:", error);
      return {
        overallSuccessRate: 0,
        averageAttempts: 0,
        strongTopics: [],
        weakTopics: [],
        recommendations: ["Continue practicing consistently"],
      };
    }
  }

  // Calculate recommendation score for a problem
  calculateRecommendationScore(problem, userContext) {
    let score = 0;

    // Topic relevance (40%)
    if (userContext.weakTopics.includes(problem.topic)) {
      score += 40;
    } else if (userContext.preferredTopics.includes(problem.topic)) {
      score += 30;
    } else {
      score += 20;
    }

    // Difficulty appropriateness (30%)
    const userLevel = userContext.skillLevel;
    if (
      (userLevel === "beginner" && problem.difficulty === "easy") ||
      (userLevel === "intermediate" && problem.difficulty === "medium") ||
      (userLevel === "advanced" && problem.difficulty === "hard")
    ) {
      score += 30;
    } else if (
      (userLevel === "intermediate" && problem.difficulty === "easy") ||
      (userLevel === "advanced" && problem.difficulty === "medium")
    ) {
      score += 20;
    } else {
      score += 10;
    }

    // Learning progression (20%)
    const topicMastery = userContext.topicMasteries.find(
      (t) => t.topic === problem.topic
    );
    if (topicMastery) {
      if (topicMastery.masteryLevel < 50) {
        score += 20; // Focus on weak areas
      } else if (topicMastery.masteryLevel < 80) {
        score += 15; // Continue improvement
      } else {
        score += 5; // Already strong
      }
    } else {
      score += 25; // New topic
    }

    // Variety factor (10%)
    if (!userContext.recentTopics.includes(problem.topic)) {
      score += 10;
    } else {
      score += 5;
    }

    return score;
  }
}

module.exports = new RecommendationService();
