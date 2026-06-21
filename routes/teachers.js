const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const {
  createTeacher,
  getAllTeachers,
  getTeacher,
  updateTeacher,
  deleteTeacher,
  toggleTeacherStatus
} = require('../controllers/teacherController');

const router = express.Router();

router.route('/')
  .get(protect, getAllTeachers)
  .post(
    protect,
    authorize('admin'),
    [
      body('name').notEmpty().withMessage('教师姓名不能为空'),
      body('gender').isIn(['男', '女']).withMessage('性别无效'),
      body('phone').matches(/^1[3-9]\d{9}$/).withMessage('请输入有效的手机号码'),
      body('subject').notEmpty().withMessage('授课科目不能为空')
    ],
    validate,
    createTeacher
  );

router.route('/:id')
  .get(protect, getTeacher)
  .put(protect, authorize('admin'), updateTeacher)
  .delete(protect, authorize('admin'), deleteTeacher);

router.patch('/:id/status', protect, authorize('admin'), toggleTeacherStatus);

module.exports = router;
