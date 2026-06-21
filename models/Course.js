const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请输入课程名称'],
    trim: true
  },
  code: {
    type: String,
    required: [true, '请输入课程编号'],
    unique: true,
    uppercase: true,
    trim: true
  },
  category: {
    type: String,
    required: [true, '请输入课程分类'],
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, '课程描述不能超过500个字符']
  },
  duration: {
    type: Number,
    required: [true, '请输入课程时长（分钟）'],
    min: [30, '课程时长至少30分钟']
  },
  credits: {
    type: Number,
    default: 1,
    min: [0, '学分不能为负数']
  },
  maxStudents: {
    type: Number,
    required: [true, '请输入最大选课人数'],
    min: [1, '选课人数至少为1']
  },
  price: {
    type: Number,
    default: 0,
    min: [0, '价格不能为负数']
  },
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: 'Teacher',
    required: [true, '请指定授课教师']
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'closed'],
    default: 'draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

CourseSchema.index({ name: 'text', code: 'text', category: 'text' });

module.exports = mongoose.model('Course', CourseSchema);
