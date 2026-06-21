const mongoose = require('mongoose');

const ClassroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请输入教室名称'],
    unique: true,
    trim: true
  },
  building: {
    type: String,
    required: [true, '请输入所在楼栋'],
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, '请输入容纳人数'],
    min: [1, '容纳人数至少为1']
  },
  type: {
    type: String,
    enum: ['普通教室', '多媒体教室', '实验室', '机房', '会议室'],
    default: '普通教室'
  },
  equipment: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['available', 'maintenance', 'disabled'],
    default: 'available'
  },
  remark: {
    type: String,
    maxlength: [300, '备注不能超过300个字符']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Classroom', ClassroomSchema);
