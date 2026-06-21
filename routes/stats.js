const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getTeacherWeeklyHours,
  getClassroomUtilization,
  getScheduleOverview,
  getCustomAggregate
} = require('../controllers/statsController');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/teachers/weekly-hours', getTeacherWeeklyHours);

router.get('/classrooms/utilization', getClassroomUtilization);

router.get('/schedules/overview', getScheduleOverview);

router.get('/aggregate', getCustomAggregate);

module.exports = router;
