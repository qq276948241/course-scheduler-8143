const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const {
  createSchedule,
  getAllSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  cancelSchedule,
  checkScheduleConflicts
} = require('../controllers/scheduleController');

const router = express.Router();

router.post(
  '/check-conflicts',
  protect,
  authorize('admin'),
  [
    body('teacher').notEmpty().withMessage('请选择教师'),
    body('classroom').notEmpty().withMessage('请选择教室'),
    body('date').notEmpty().withMessage('请选择日期'),
    body('startTime').notEmpty().withMessage('请选择开始时间'),
    body('endTime').notEmpty().withMessage('请选择结束时间')
  ],
  validate,
  checkScheduleConflicts
);

router.route('/')
  .get(protect, getAllSchedules)
  .post(
    protect,
    authorize('admin'),
    [
      body('course').notEmpty().withMessage('请选择课程'),
      body('teacher').notEmpty().withMessage('请选择教师'),
      body('classroom').notEmpty().withMessage('请选择教室'),
      body('date').notEmpty().withMessage('请选择日期'),
      body('startTime').notEmpty().withMessage('请选择开始时间'),
      body('endTime').notEmpty().withMessage('请选择结束时间'),
      body('repeatType').isIn(['none', 'daily', 'weekly', 'biweekly']).withMessage('重复类型无效')
    ],
    validate,
    createSchedule
  );

router.patch('/:id/cancel', protect, authorize('admin'), cancelSchedule);

router.route('/:id')
  .get(protect, getSchedule)
  .put(protect, authorize('admin'), updateSchedule)
  .delete(protect, authorize('admin'), deleteSchedule);

module.exports = router;
