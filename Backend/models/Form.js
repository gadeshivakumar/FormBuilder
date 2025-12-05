const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionKey: String,
  fieldId: String,
  label: String,
  type: String,
  name: String,    
  required: { type: Boolean, default: false },
  options: Object,  
  conditional: {
    type: Object,
    default: null
  }
});

const FormSchema = new mongoose.Schema({
  ownerAirtableUserId: String,
  baseId: String,
  tableId: String,
  tableName: String,
  questions: [QuestionSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Form", FormSchema);
