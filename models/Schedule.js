const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.ObjectId,
    ref: 'Course',
    required: [true, '请选择课程']
  },
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: 'Teacher',
    required: [true, '请选择教师']
  },
  classroom: {
    type: mongoose.Schema.ObjectId,
    ref: 'Classroom',
    required: [true, '请选择教室']
  },
  date: {
    type: Date,
    required: [true, '请选择上课日期']
  },
  startTime: {
    type: String,
    required: [true, '请选择开始时间'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, '请输入正确的时间格式 HH:mm']
  },
  endTime: {
    type: String,
    required: [true, '请选择结束时间'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, '请输入正确的时间格式 HH:mm']
  },
  repeatType: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'biweekly'],
    default: 'none'
  },
  repeatEndDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  actualStudents: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    maxlength: [300, '备注不能超过300个字符']
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ScheduleSchema.index({ teacher: 1, date: 1, startTime: 1 });
ScheduleSchema.index({ classroom: 1, date: 1, startTime: 1 });

module.exports = mongoose.model('Schedule', ScheduleSchema);
