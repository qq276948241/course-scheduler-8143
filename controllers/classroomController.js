const Classroom = require('../models/Classroom');
const Schedule = require('../models/Schedule');

exports.createClassroom = async (req, res, next) => {
  try {
    const classroom = await Classroom.create(req.body);

    res.status(201).json({
      success: true,
      data: classroom
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllClassrooms = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, type, building, keyword } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (building) query.building = { $regex: building, $options: 'i' };
    if (keyword) {
      query.name = { $regex: keyword, $options: 'i' };
    }

    const classrooms = await Classroom.find(query)
      .sort({ building: 1, name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Classroom.countDocuments(query);

    res.status(200).json({
      success: true,
      data: classrooms,
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

exports.getClassroom = async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: '教室不存在'
      });
    }

    res.status(200).json({
      success: true,
      data: classroom
    });
  } catch (err) {
    next(err);
  }
};

exports.updateClassroom = async (req, res, next) => {
  try {
    let classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: '教室不存在'
      });
    }

    classroom = await Classroom.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: classroom
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteClassroom = async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: '教室不存在'
      });
    }

    const scheduleCount = await Schedule.countDocuments({
      classroom: req.params.id,
      status: { $ne: 'cancelled' }
    });
    if (scheduleCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该教室有 ${scheduleCount} 条排课记录，无法删除`
      });
    }

    await Classroom.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: '教室已删除'
    });
  } catch (err) {
    next(err);
  }
};

exports.getClassroomAvailability = async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '请指定查询日期'
      });
    }

    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const classrooms = await Classroom.find({ status: 'available' });

    const schedules = await Schedule.find({
      date: { $gte: targetDate, $lt: nextDate },
      status: { $ne: 'cancelled' }
    }).select('classroom startTime endTime');

    const result = classrooms.map(classroom => {
      const occupiedSlots = schedules
        .filter(s => s.classroom.toString() === classroom._id.toString())
        .map(s => ({ startTime: s.startTime, endTime: s.endTime }));

      return {
        ...classroom._doc,
        occupiedSlots
      };
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};
