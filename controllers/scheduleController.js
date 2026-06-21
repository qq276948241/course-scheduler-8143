const Schedule = require('../models/Schedule');
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const Classroom = require('../models/Classroom');
const Enrollment = require('../models/Enrollment');
const { checkAllConflicts, generateRepeatDates } = require('../utils/scheduleConflicts');
const { buildScheduleQuery } = require('../utils/queryHelper');

exports.createSchedule = async (req, res, next) => {
  try {
    const { course, teacher, classroom, date, startTime, endTime, repeatType, repeatEndDate } = req.body;

    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    const teacherDoc = await Teacher.findById(teacher);
    if (!teacherDoc || teacherDoc.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: '教师不存在或状态无效'
      });
    }

    const classroomDoc = await Classroom.findById(classroom);
    if (!classroomDoc || classroomDoc.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: '教室不存在或不可用'
      });
    }

    if (courseDoc.teacher.toString() !== teacher) {
      return res.status(400).json({
        success: false,
        message: '该课程的指定教师与排课教师不一致'
      });
    }

    const dates = generateRepeatDates(date, repeatType, repeatEndDate);
    const createdSchedules = [];
    const conflicts = [];

    for (const currentDate of dates) {
      const conflict = await checkAllConflicts({
        teacher,
        classroom,
        date: currentDate,
        startTime,
        endTime
      });

      if (conflict.conflict) {
        conflicts.push({
          date: currentDate,
          ...conflict
        });
        continue;
      }

      const schedule = await Schedule.create({
        course,
        teacher,
        classroom,
        date: currentDate,
        startTime,
        endTime,
        repeatType,
        repeatEndDate: repeatType !== 'none' ? repeatEndDate : undefined,
        createdBy: req.user.id,
        notes: req.body.notes
      });
      createdSchedules.push(schedule);
    }

    if (createdSchedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: '所有排课日期均存在时间冲突',
        conflicts
      });
    }

    res.status(201).json({
      success: true,
      data: {
        created: createdSchedules,
        createdCount: createdSchedules.length,
        conflicts,
        conflictCount: conflicts.length
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllSchedules = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = buildScheduleQuery(req.query);

    const schedules = await Schedule.find(query)
      .populate('course', 'name code category')
      .populate('teacher', 'name subject')
      .populate('classroom', 'name building capacity')
      .sort({ date: 1, startTime: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Schedule.countDocuments(query);

    res.status(200).json({
      success: true,
      data: schedules,
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

exports.getSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('course', 'name code category duration maxStudents')
      .populate('teacher', 'name subject title phone')
      .populate('classroom', 'name building capacity type equipment')
      .populate('createdBy', 'name username');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: '排课记录不存在'
      });
    }

    const enrolledCount = await Enrollment.countDocuments({
      course: schedule.course._id,
      status: 'enrolled'
    });

    res.status(200).json({
      success: true,
      data: {
        ...schedule._doc,
        enrolledCount
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSchedule = async (req, res, next) => {
  try {
    let schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: '排课记录不存在'
      });
    }

    const updateData = { ...req.body };

    const needsConflictCheck =
      updateData.teacher ||
      updateData.classroom ||
      updateData.date ||
      updateData.startTime ||
      updateData.endTime;

    if (needsConflictCheck) {
      const conflict = await checkAllConflicts(
        {
          teacher: updateData.teacher || schedule.teacher,
          classroom: updateData.classroom || schedule.classroom,
          date: updateData.date || schedule.date,
          startTime: updateData.startTime || schedule.startTime,
          endTime: updateData.endTime || schedule.endTime
        },
        req.params.id
      );

      if (conflict.conflict) {
        return res.status(400).json({
          success: false,
          message: conflict.message,
          conflictType: conflict.type,
          conflictingSchedule: conflict.conflictingSchedule
        });
      }
    }

    schedule = await Schedule.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    })
      .populate('course', 'name code')
      .populate('teacher', 'name')
      .populate('classroom', 'name building');

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: '排课记录不存在'
      });
    }

    await Schedule.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: '排课记录已删除'
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: '排课记录不存在'
      });
    }

    if (schedule.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: '该排课已取消'
      });
    }

    schedule.status = 'cancelled';
    schedule.notes = req.body.reason
      ? `${schedule.notes || ''} 取消原因：${req.body.reason}`.trim()
      : schedule.notes;
    await schedule.save();

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (err) {
    next(err);
  }
};

exports.checkScheduleConflicts = async (req, res, next) => {
  try {
    const { teacher, classroom, date, startTime, endTime, excludeId } = req.body;

    if (!teacher || !classroom || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: '请提供完整的排课信息'
      });
    }

    const conflict = await checkAllConflicts(
      { teacher, classroom, date, startTime, endTime },
      excludeId
    );

    res.status(200).json({
      success: true,
      data: conflict
    });
  } catch (err) {
    next(err);
  }
};
