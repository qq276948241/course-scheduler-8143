const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const {
  createClassroom,
  getAllClassrooms,
  getClassroom,
  updateClassroom,
  deleteClassroom,
  getClassroomAvailability
} = require('../controllers/classroomController');

const router = express.Router();

router.route('/')
  .get(protect, getAllClassrooms)
  .post(
    protect,
    authorize('admin'),
    [
      body('name').notEmpty().withMessage('教室名称不能为空'),
      body('building').notEmpty().withMessage('所在楼栋不能为空'),
      body('capacity').isInt({ min: 1 }).withMessage('容纳人数必须大于0'),
      body('type').isIn(['普通教室', '多媒体教室', '实验室', '机房', '会议室']).withMessage('教室类型无效')
    ],
    validate,
    createClassroom
  );

router.get('/availability', protect, getClassroomAvailability);

router.route('/:id')
  .get(protect, getClassroom)
  .put(protect, authorize('admin'), updateClassroom)
  .delete(protect, authorize('admin'), deleteClassroom);

module.exports = router;
