const mongoose = require("mongoose");

const questionSchema = mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    options: [
      {
        optionText: {
          type: String,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          required: true,
        },
      },
    ],
    examId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);

module.exports = Question;
