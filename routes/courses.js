const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const {
  createCourse,
  getAllCourses,
  getCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  getAvailableCourses
} = require('../controllers/courseController');

const router = express.Router();

router.get('/available', protect, getAvailableCourses);

router.route('/')
  .get(protect, getAllCourses)
  .post(
    protect,
    authorize('admin'),
    [
      body('name').notEmpty().withMessage('课程名称不能为空'),
      body('code').notEmpty().withMessage('课程编号不能为空'),
      body('category').notEmpty().withMessage('课程分类不能为空'),
      body('duration').isInt({ min: 30 }).withMessage('课程时长至少30分钟'),
      body('maxStudents').isInt({ min: 1 }).withMessage('选课人数至少为1'),
      body('teacher').notEmpty().withMessage('请指定授课教师')
    ],
    validate,
    createCourse
  );

router.patch('/:id/publish', protect, authorize('admin'), publishCourse);

router.route('/:id')
  .get(protect, getCourse)
  .put(protect, authorize('admin'), updateCourse)
  .delete(protect, authorize('admin'), deleteCourse);

module.exports = router;
