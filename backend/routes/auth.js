const express = require("express");
const { validate, schemas } = require("../middleware/validation");
const { success, error } = require("../utils/responseHelper");
const { generateToken } = require("../utils/jwt");
const User = require("../models/User");

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", validate(schemas.register), async (req, res) => {
  try {
    const { username, email, password, skillLevel } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return error(res, "Email already registered", 400);
      }
      return error(res, "Username already taken", 400);
    }

    // Create user
    const user = new User({
      username,
      email,
      password,
      profile: {
        skillLevel: skillLevel || "beginner",
      },
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    success(
      res,
      {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
        },
        token,
      },
      "User registered successfully",
      201
    );
  } catch (err) {
    console.error("Register error:", err);
    error(res, "Registration failed", 500);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return error(res, "Invalid credentials", 401);
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return error(res, "Invalid credentials", 401);
    }

    // Update last active
    await user.updateLastActive();

    // Generate token
    const token = generateToken(user._id);

    success(
      res,
      {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
        },
        token,
      },
      "Login successful"
    );
  } catch (err) {
    console.error("Login error:", err);
    error(res, "Login failed", 500);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post("/logout", (req, res) => {
  success(res, null, "Logged out successfully");
});

module.exports = router;
