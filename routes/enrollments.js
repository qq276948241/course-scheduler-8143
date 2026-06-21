const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  enrollCourse,
  dropCourse,
  getMyEnrollments,
  getCourseEnrollments,
  getAllEnrollments,
  updatePaymentStatus,
  completeEnrollment
} = require('../controllers/enrollmentController');

const router = express.Router();

router.get('/mine', protect, getMyEnrollments);

router.post('/courses/:courseId/enroll', protect, enrollCourse);

router.post('/courses/:courseId/drop', protect, dropCourse);

router.get('/courses/:courseId', protect, authorize('admin'), getCourseEnrollments);

router.patch('/:enrollmentId/payment', protect, authorize('admin'), updatePaymentStatus);

router.patch('/:enrollmentId/complete', protect, authorize('admin'), completeEnrollment);

router.get('/', protect, authorize('admin'), getAllEnrollments);

module.exports = router;
