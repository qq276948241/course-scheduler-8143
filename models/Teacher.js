const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请输入教师姓名'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['男', '女'],
    required: [true, '请选择性别']
  },
  phone: {
    type: String,
    required: [true, '请输入联系电话'],
    match: [/^1[3-9]\d{9}$/, '请输入有效的手机号码']
  },
  email: {
    type: String,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
  },
  subject: {
    type: String,
    required: [true, '请输入授课科目'],
    trim: true
  },
  title: {
    type: String,
    enum: ['助教', '讲师', '高级讲师', '副教授', '教授'],
    default: '讲师'
  },
  description: {
    type: String,
    maxlength: [500, '个人简介不能超过500个字符']
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Teacher', TeacherSchema);
