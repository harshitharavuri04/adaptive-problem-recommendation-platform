const Joi = require("joi");

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    next();
  };
};

// Validation schemas
const schemas = {
  register: Joi.object({
    username: Joi.string().min(3).max(30).alphanum().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    skillLevel: Joi.string()
      .valid("beginner", "intermediate", "advanced")
      .optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    username: Joi.string().min(3).max(30).alphanum().optional(),
    skillLevel: Joi.string()
      .valid("beginner", "intermediate", "advanced")
      .optional(),
    preferences: Joi.array()
      .items(
        Joi.string().valid(
          "stack",
          "queue",
          "linked-list",
          "trees",
          "graphs",
          "dynamic-programming",
          "arrays",
          "strings"
        )
      )
      .optional(),
  }),

  submitSolution: Joi.object({
    code: Joi.string().required(),
    language: Joi.string()
      .valid("javascript", "python", "java", "cpp", "c")
      .optional(),
    timeTaken: Joi.number().min(0).required(),
  }),

  createProblem: Joi.object({
    title: Joi.string().max(200).required(),
    description: Joi.string().required(),
    difficulty: Joi.string().valid("easy", "medium", "hard").required(),
    topic: Joi.string()
      .valid(
        "stack",
        "queue",
        "linked-list",
        "trees",
        "graphs",
        "dynamic-programming",
        "arrays",
        "strings",
        "sorting",
        "searching"
      )
      .required(),
    tags: Joi.array().items(Joi.string()).optional(),
    testCases: Joi.array()
      .items(
        Joi.object({
          input: Joi.string().required(),
          expectedOutput: Joi.string().required(),
          isHidden: Joi.boolean().optional(),
        })
      )
      .min(1)
      .required(),
    solution: Joi.string().optional(),
    hints: Joi.array().items(Joi.string()).optional(),
    timeComplexity: Joi.string().optional(),
    spaceComplexity: Joi.string().optional(),
    constraints: Joi.string().optional(),
    examples: Joi.array()
      .items(
        Joi.object({
          input: Joi.string(),
          output: Joi.string(),
          explanation: Joi.string().optional(),
        })
      )
      .optional(),
  }),
};
module.exports = { validate, schemas };