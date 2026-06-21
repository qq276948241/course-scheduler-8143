const Teacher = require('../models/Teacher');
const Course = require('../models/Course');

exports.createTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.create(req.body);

    res.status(201).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllTeachers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, subject, keyword } = req.query;

    const query = {};
    if (status) query.status = status;
    if (subject) query.subject = { $regex: subject, $options: 'i' };
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword, $options: 'i' } }
      ];
    }

    const teachers = await Teacher.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Teacher.countDocuments(query);

    res.status(200).json({
      success: true,
      data: teachers,
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

exports.getTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: '教师不存在'
      });
    }

    const courses = await Course.find({ teacher: req.params.id }).select('name code status');

    res.status(200).json({
      success: true,
      data: { ...teacher._doc, courses }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTeacher = async (req, res, next) => {
  try {
    let teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: '教师不存在'
      });
    }

    teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: '教师不存在'
      });
    }

    const courseCount = await Course.countDocuments({ teacher: req.params.id });
    if (courseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该教师关联了 ${courseCount} 门课程，无法删除`
      });
    }

    await Teacher.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: '教师已删除'
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleTeacherStatus = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: '教师不存在'
      });
    }

    teacher.status = teacher.status === 'active' ? 'inactive' : 'active';
    await teacher.save();

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    next(err);
  }
};
