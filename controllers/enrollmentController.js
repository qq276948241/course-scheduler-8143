const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Schedule = require('../models/Schedule');

exports.enrollCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: '该课程未发布，无法选课'
      });
    }

    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === 'enrolled') {
        return res.status(400).json({
          success: false,
          message: '您已选过此课程'
        });
      }
      if (existingEnrollment.status === 'dropped') {
        existingEnrollment.status = 'enrolled';
        existingEnrollment.enrolledAt = Date.now();
        existingEnrollment.droppedAt = undefined;
        await existingEnrollment.save();

        return res.status(200).json({
          success: true,
          message: '已重新选课',
          data: existingEnrollment
        });
      }
    }

    const enrolledCount = await Enrollment.countDocuments({
      course: courseId,
      status: 'enrolled'
    });

    if (enrolledCount >= course.maxStudents) {
      return res.status(400).json({
        success: false,
        message: '该课程选课人数已满'
      });
    }

    const enrollment = await Enrollment.create({
      student: studentId,
      course: courseId,
      amount: course.price,
      paid: course.price === 0,
      paidAt: course.price === 0 ? Date.now() : undefined,
      remark: req.body.remark
    });

    res.status(201).json({
      success: true,
      data: enrollment
    });
  } catch (err) {
    next(err);
  }
};

exports.dropCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
      status: 'enrolled'
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: '您未选此课程'
      });
    }

    enrollment.status = 'dropped';
    enrollment.droppedAt = Date.now();
    enrollment.remark = req.body.reason
      ? `${enrollment.remark || ''} 退课原因：${req.body.reason}`.trim()
      : enrollment.remark;
    await enrollment.save();

    res.status(200).json({
      success: true,
      message: '退课成功',
      data: enrollment
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyEnrollments = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { student: req.user.id };
    if (status) query.status = status;

    const enrollments = await Enrollment.find(query)
      .populate({
        path: 'course',
        select: 'name code category duration credits maxStudents price',
        populate: {
          path: 'teacher',
          select: 'name subject title'
        }
      })
      .sort({ enrolledAt: -1 });

    const result = await Promise.all(
      enrollments.map(async (enrollment) => {
        const enrolledCount = await Enrollment.countDocuments({
          course: enrollment.course._id,
          status: 'enrolled'
        });
        return {
          ...enrollment._doc,
          course: {
            ...enrollment.course._doc,
            enrolledCount,
            remainingSeats: enrollment.course.maxStudents - enrolledCount
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (err) {
    next(err);
  }
};

exports.getCourseEnrollments = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { course: courseId };
    if (status) query.status = status;

    const enrollments = await Enrollment.find(query)
      .populate('student', 'name username phone email')
      .sort({ enrolledAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Enrollment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: enrollments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllEnrollments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      student,
      course,
      paid
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (student) query.student = student;
    if (course) query.course = course;
    if (paid !== undefined) query.paid = paid === 'true';

    const enrollments = await Enrollment.find(query)
      .populate('student', 'name username phone')
      .populate({
        path: 'course',
        select: 'name code category price',
        populate: { path: 'teacher', select: 'name' }
      })
      .sort({ enrolledAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Enrollment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: enrollments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { enrollmentId } = req.params;
    const { paid } = req.body;

    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: '选课记录不存在'
      });
    }

    enrollment.paid = paid;
    enrollment.paidAt = paid ? Date.now() : undefined;
    await enrollment.save();

    res.status(200).json({
      success: true,
      data: enrollment
    });
  } catch (err) {
    next(err);
  }
};

exports.completeEnrollment = async (req, res, next) => {
  try {
    const { enrollmentId } = req.params;

    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: '选课记录不存在'
      });
    }

    if (enrollment.status !== 'enrolled') {
      return res.status(400).json({
        success: false,
        message: '只有在选状态才能标记为完成'
      });
    }

    enrollment.status = 'completed';
    enrollment.completedAt = Date.now();
    await enrollment.save();

    res.status(200).json({
      success: true,
      data: enrollment
    });
  } catch (err) {
    next(err);
  }
};
