const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getMyTimetable,
  getTeacherTimetable,
  getClassroomTimetable,
  getCourseTimetable,
  getOverallTimetable,
  getTimetableStats
} = require('../controllers/timetableController');

const router = express.Router();

router.get('/mine', protect, getMyTimetable);

router.get('/teacher/:teacherId', protect, getTeacherTimetable);

router.get('/classroom/:classroomId', protect, getClassroomTimetable);

router.get('/course/:courseId', protect, getCourseTimetable);

router.get('/overall', protect, authorize('admin'), getOverallTimetable);

router.get('/stats', protect, authorize('admin'), getTimetableStats);

module.exports = router;
