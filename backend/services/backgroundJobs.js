const cron = require("node-cron");
const User = require("../models/User");
const DailyRecommendation = require("../models/DailyRecommendation");
const TopicMastery = require("../models/TopicMastery");
const UserProgress = require("../models/UserProgress");
const recommendationService = require("./recommendationService");
const logger = require("../utils/logger");

// Only run cron jobs if enabled
if (process.env.ENABLE_CRON_JOBS === "true") {
  // Daily recommendation generation - runs at midnight
  cron.schedule(
    "0 0 * * *",
    async () => {
      logger.info("Starting daily recommendation generation job");

      try {
        // Get all active users
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const activeUsers = await User.find({
          isActive: true,
          lastActive: { $gte: sevenDaysAgo },
        });

        logger.info(
          `Generating recommendations for ${activeUsers.length} active users`
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let successCount = 0;
        let errorCount = 0;

        for (const user of activeUsers) {
          try {
            // Check if recommendation already exists for today
            const existingRecommendation = await DailyRecommendation.findOne({
              userId: user._id,
              date: today,
            });

            if (existingRecommendation) {
              continue; // Skip if already generated
            }

            // Generate recommendation
            const recommendedProblem =
              await recommendationService.generateDailyRecommendation(user._id);

            if (recommendedProblem) {
              const recommendation = new DailyRecommendation({
                userId: user._id,
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
              successCount++;
            }
          } catch (userError) {
            logger.error(
              `Failed to generate recommendation for user ${user._id}:`,
              userError
            );
            errorCount++;
          }
        }

        logger.info(
          `Daily recommendation job completed. Success: ${successCount}, Errors: ${errorCount}`
        );
      } catch (error) {
        logger.error("Daily recommendation job failed:", error);
      }
    },
    {
      timezone: "UTC",
    }
  );

  // Topic mastery update - runs every 6 hours
  cron.schedule(
    "0 */6 * * *",
    async () => {
      logger.info("Starting topic mastery update job");

      try {
        // Get all users who have recent activity
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const recentProgress = await UserProgress.find({
          updatedAt: { $gte: twoDaysAgo },
        }).distinct("userId");

        logger.info(
          `Updating topic mastery for ${recentProgress.length} users with recent activity`
        );

        let updateCount = 0;

        for (const userId of recentProgress) {
          try {
            // Get all topics this user has attempted
            const userTopics = await UserProgress.distinct("topic", { userId });

            for (const topic of userTopics) {
              await recommendationService.updateTopicMastery(userId, topic);
              updateCount++;
            }
          } catch (userError) {
            logger.error(
              `Failed to update mastery for user ${userId}:`,
              userError
            );
          }
        }

        logger.info(
          `Topic mastery update completed. Updated ${updateCount} topic masteries`
        );
      } catch (error) {
        logger.error("Topic mastery update job failed:", error);
      }
    },
    {
      timezone: "UTC",
    }
  );

  // Data cleanup - runs daily at 2 AM
  cron.schedule(
    "0 2 * * *",
    async () => {
      logger.info("Starting data cleanup job");

      try {
        // Clean up old daily recommendations (keep only last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const cleanupResult = await DailyRecommendation.deleteMany({
          date: { $lt: thirtyDaysAgo },
        });

        logger.info(
          `Data cleanup completed. Removed ${cleanupResult.deletedCount} old daily recommendations`
        );

        // Update user streaks
        const activeUsers = await User.find({ isActive: true });
        let streakUpdateCount = 0;

        for (const user of activeUsers) {
          try {
            // Calculate current streak
            let currentStreak = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let i = 0; i < 30; i++) {
              const checkDate = new Date(today);
              checkDate.setDate(checkDate.getDate() - i);

              const dayRecommendation = await DailyRecommendation.findOne({
                userId: user._id,
                date: checkDate,
                completed: true,
              });

              if (dayRecommendation) {
                currentStreak++;
              } else {
                break;
              }
            }

            // Update user streak
            await User.updateOne(
              { _id: user._id },
              {
                "profile.currentStreak": currentStreak,
                "profile.longestStreak": Math.max(
                  currentStreak,
                  user.profile.longestStreak || 0
                ),
              }
            );

            streakUpdateCount++;
          } catch (userError) {
            logger.error(
              `Failed to update streak for user ${user._id}:`,
              userError
            );
          }
        }

        logger.info(`Updated streaks for ${streakUpdateCount} users`);
      } catch (error) {
        logger.error("Data cleanup job failed:", error);
      }
    },
    {
      timezone: "UTC",
    }
  );

  // User activity analysis - runs weekly on Sunday at 1 AM
  cron.schedule(
    "0 1 * * 0",
    async () => {
      logger.info("Starting weekly user activity analysis");

      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Analyze user engagement
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({
          lastActive: { $gte: oneWeekAgo },
        });
        const completedRecommendations =
          await DailyRecommendation.countDocuments({
            date: { $gte: oneWeekAgo },
            completed: true,
          });

        const engagementRate =
          totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

        logger.info(
          `Weekly Analysis - Total Users: ${totalUsers}, Active Users: ${activeUsers}, Engagement Rate: ${engagementRate.toFixed(
            2
          )}%, Completed Recommendations: ${completedRecommendations}`
        );

        // You could save these metrics to a database for dashboard display
      } catch (error) {
        logger.error("Weekly analysis job failed:", error);
      }
    },
    {
      timezone: "UTC",
    }
  );

  logger.info("Background jobs scheduled successfully");
} else {
  logger.info("Background jobs disabled");
}

module.exports = {
  // Export functions for manual execution if needed
  generateDailyRecommendations: async () => {
    // Implementation for manual execution
  },
  updateTopicMasteries: async () => {
    // Implementation for manual execution
  },
};
