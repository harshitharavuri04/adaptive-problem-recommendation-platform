const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Problem = require("../models/Problem");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");

dotenv.config();

// Load problems from the JSON file
const loadProblemsFromFile = () => {
  try {
    const filePath = path.join(__dirname, "problemPoolMongoFormat100.json");
    const jsonData = fs.readFileSync(filePath, "utf8");
    return JSON.parse(jsonData);
  } catch (error) {
    console.error("Error loading problems from JSON file:", error);
    return [];
  }
};

// Transform the JSON problems to match your schema
const transformProblems = (problems) => {
  return problems.map((problem) => {
    // Map difficulty levels
    const difficultyMap = {
      Easy: "easy",
      Medium: "medium",
      Hard: "hard",
    };

    // Map topic names to match your schema
    const topicMap = {
      Array: "arrays",
      String: "strings",
      "Hash Table": "arrays",
      "Dynamic Programming": "dynamic-programming",
      Math: "arrays",
      Sorting: "sorting",
      Greedy: "arrays",
      "Depth-First Search": "trees",
      Database: "arrays",
      "Binary Search": "searching",
      Tree: "trees",
      "Breadth-First Search": "trees",
      "Binary Tree": "trees",
      Matrix: "arrays",
      "Two Pointers": "arrays",
      "Binary Search Tree": "trees",
      "Bit Manipulation": "arrays",
      Stack: "stack",
      "Heap (Priority Queue)": "arrays",
      Graph: "graphs",
      Simulation: "arrays",
      Counting: "arrays",
      "Sliding Window": "arrays",
      "Union Find": "graphs",
      "Linked List": "linked-list",
      Design: "arrays",
      Trie: "trees",
      Backtracking: "arrays",
      "Divide and Conquer": "arrays",
      Recursion: "arrays",
      "Monotonic Stack": "stack",
      Queue: "queue",
      "Prefix Sum": "arrays",
      "Number Theory": "arrays",
      "Topological Sort": "graphs",
      Memoization: "dynamic-programming",
      Geometry: "arrays",
      "Hash Function": "arrays",
      "Rolling Hash": "strings",
      "Shortest Path": "graphs",
      "Game Theory": "arrays",
      Interactive: "arrays",
      "Data Stream": "arrays",
      Brainteaser: "arrays",
      Randomized: "arrays",
      Iterator: "arrays",
      Concurrency: "arrays",
      "Doubly-Linked List": "linked-list",
      "Minimum Spanning Tree": "graphs",
      "Eulerian Circuit": "graphs",
      "Strongly Connected Component": "graphs",
      "Biconnected Component": "graphs",
      "Monotonic Queue": "queue",
    };

    // Get primary topic from tags
    const primaryTopic =
      problem.tags && problem.tags.length > 0
        ? topicMap[problem.tags[0]] || "arrays"
        : "arrays";

    // Transform test cases
    const testCases = problem.examples
      ? problem.examples.map((example, index) => ({
          input: example.input || `Example ${index + 1} input`,
          expectedOutput: example.output || `Example ${index + 1} output`,
          isHidden: index >= 2, // Hide examples beyond the first 2
        }))
      : [
          {
            input: "Sample input",
            expectedOutput: "Sample output",
            isHidden: false,
          },
        ];

    // Transform examples for display
    const examples = problem.examples
      ? problem.examples.slice(0, 3).map((example) => ({
          input: example.input || "",
          output: example.output || "",
          explanation: example.explanation || "",
        }))
      : [];

    return {
      title: problem.title || "Untitled Problem",
      description: problem.description || "No description provided.",
      difficulty: difficultyMap[problem.difficulty] || "easy",
      topic: primaryTopic,
      tags: problem.tags || [],
      testCases: testCases,
      solution: problem.solution || "",
      hints: problem.hints || [],
      timeComplexity: problem.timeComplexity || "",
      spaceComplexity: problem.spaceComplexity || "",
      constraints: problem.constraints || "",
      examples: examples,
      isActive: true,
    };
  });
};

const sampleUsers = [
  {
    username: "testuser1",
    email: "test1@example.com",
    password: "password123",
    profile: {
      skillLevel: "beginner",
      preferences: ["arrays", "strings"],
    },
  },
  {
    username: "testuser2",
    email: "test2@example.com",
    password: "password123",
    profile: {
      skillLevel: "intermediate",
      preferences: ["trees", "graphs"],
    },
  },
  {
    username: "testuser3",
    email: "test3@example.com",
    password: "password123",
    profile: {
      skillLevel: "advanced",
      preferences: ["dynamic-programming", "graphs"],
    },
  },
  {
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    profile: {
      skillLevel: "advanced",
      preferences: [
        "arrays",
        "strings",
        "trees",
        "graphs",
        "dynamic-programming",
      ],
    },
  },
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/adaptive-problems"
    );
    console.log("✅ Connected to MongoDB");

    // Load problems from JSON file
    console.log("📁 Loading problems from JSON file...");
    const rawProblems = loadProblemsFromFile();

    if (rawProblems.length === 0) {
      console.error("❌ No problems loaded from JSON file");
      process.exit(1);
    }

    console.log(`📊 Found ${rawProblems.length} problems in JSON file`);

    // Transform problems to match schema
    console.log("🔄 Transforming problems to match database schema...");
    const transformedProblems = transformProblems(rawProblems);

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await Problem.deleteMany({});
    await User.deleteMany({});
    console.log("✅ Cleared existing data");

    // Seed problems
    console.log("🧩 Inserting problems...");
    const problems = await Problem.insertMany(transformedProblems);
    console.log(`✅ Inserted ${problems.length} problems`);

    // Seed users
    console.log("👥 Inserting users...");
    const users = await User.insertMany(sampleUsers);
    console.log(`✅ Inserted ${users.length} sample users`);

    console.log("\n🎉 Database seeded successfully!");

    // Display statistics
    console.log("\n📊 Seeding Statistics:");
    console.log(`📝 Total Problems: ${problems.length}`);
    console.log(`👥 Total Users: ${users.length}`);

    console.log("\n👤 Sample Users:");
    users.forEach((user) => {
      console.log(
        `   - ${user.username} (${user.email}) - ${user.profile.skillLevel}`
      );
    });

    // Analyze problems by topic
    console.log("\n🏷️  Problems by Topic:");
    const topicCounts = {};
    problems.forEach((problem) => {
      topicCounts[problem.topic] = (topicCounts[problem.topic] || 0) + 1;
    });

    Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([topic, count]) => {
        console.log(`   - ${topic}: ${count} problems`);
      });

    // Analyze problems by difficulty
    console.log("\n📈 Problems by Difficulty:");
    const difficultyCounts = {};
    problems.forEach((problem) => {
      difficultyCounts[problem.difficulty] =
        (difficultyCounts[problem.difficulty] || 0) + 1;
    });

    Object.entries(difficultyCounts).forEach(([difficulty, count]) => {
      console.log(`   - ${difficulty}: ${count} problems`);
    });

    console.log("\n🎯 Ready for Testing:");
    console.log("   - Run: npm run dev (to start server)");
    console.log("   - Login with any test user credentials");
    console.log("   - API: GET /api/problems/daily-recommendation");
    console.log("   - Test recommendation engine with 100 diverse problems!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
