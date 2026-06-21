const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const Enrollment = require('../models/Enrollment');

exports.createCourse = async (req, res, next) => {
  try {
    const { teacher } = req.body;

    const teacherDoc = await Teacher.findById(teacher);
    if (!teacherDoc) {
      return res.status(404).json({
        success: false,
        message: '指定的教师不存在'
      });
    }
    if (teacherDoc.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: '指定的教师状态非在职'
      });
    }

    const course = await Course.create(req.body);

    res.status(201).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllCourses = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, category, teacher, keyword } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (teacher) query.teacher = teacher;
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { code: { $regex: keyword, $options: 'i' } }
      ];
    }

    const courses = await Course.find(query)
      .populate('teacher', 'name subject title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Course.countDocuments(query);

    res.status(200).json({
      success: true,
      data: courses,
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

exports.getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teacher', 'name subject title phone email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    const enrolledCount = await Enrollment.countDocuments({
      course: req.params.id,
      status: 'enrolled'
    });

    res.status(200).json({
      success: true,
      data: {
        ...course._doc,
        enrolledCount,
        remainingSeats: course.maxStudents - enrolledCount
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    if (req.body.teacher && req.body.teacher !== course.teacher.toString()) {
      const teacherDoc = await Teacher.findById(req.body.teacher);
      if (!teacherDoc) {
        return res.status(404).json({
          success: false,
          message: '指定的教师不存在'
        });
      }
      if (teacherDoc.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: '指定的教师状态非在职'
        });
      }
    }

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('teacher', 'name subject title');

    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    const enrollCount = await Enrollment.countDocuments({
      course: req.params.id,
      status: 'enrolled'
    });
    if (enrollCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该课程已有 ${enrollCount} 名学员选课，无法删除`
      });
    }

    await Course.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: '课程已删除'
    });
  } catch (err) {
    next(err);
  }
};

exports.publishCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    course.status = course.status === 'published' ? 'draft' : 'published';
    await course.save();

    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

exports.getAvailableCourses = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, keyword } = req.query;

    const query = { status: 'published' };
    if (category) query.category = category;
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { code: { $regex: keyword, $options: 'i' } },
        { category: { $regex: keyword, $options: 'i' } }
      ];
    }

    const courses = await Course.find(query)
      .populate('teacher', 'name title subject')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const coursesWithEnrollInfo = await Promise.all(
      courses.map(async (course) => {
        const enrolledCount = await Enrollment.countDocuments({
          course: course._id,
          status: 'enrolled'
        });
        const userEnrolled = await Enrollment.countDocuments({
          course: course._id,
          student: req.user.id,
          status: 'enrolled'
        });

        return {
          ...course._doc,
          enrolledCount,
          remainingSeats: course.maxStudents - enrolledCount,
          isEnrolled: userEnrolled > 0
        };
      })
    );

    const total = await Course.countDocuments(query);

    res.status(200).json({
      success: true,
      data: coursesWithEnrollInfo,
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
