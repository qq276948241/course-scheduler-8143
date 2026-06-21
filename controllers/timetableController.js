const Schedule = require('../models/Schedule');
const Enrollment = require('../models/Enrollment');

const stripTime = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekRange = (date = new Date()) => {
  const d = stripTime(date);
  const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (dayOfWeek - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

const getMonthRange = (date = new Date()) => {
  const d = stripTime(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start, end };
};

exports.getMyTimetable = async (req, res, next) => {
  try {
    const { startDate, endDate, view = 'week' } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      const eDate = new Date(endDate);
      end = new Date(eDate);
      end.setDate(end.getDate() + 1);
    } else if (view === 'month') {
      const range = getMonthRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    } else {
      const range = getWeekRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    }

    const enrollments = await Enrollment.find({
      student: req.user.id,
      status: 'enrolled'
    }).select('course');

    const courseIds = enrollments.map(e => e.course);

    const schedules = await Schedule.find({
      course: { $in: courseIds },
      date: { $gte: start, $lt: end },
      status: { $ne: 'cancelled' }
    })
      .populate('course', 'name code category')
      .populate('teacher', 'name subject')
      .populate('classroom', 'name building')
      .sort({ date: 1, startTime: 1 });

    const grouped = {};
    schedules.forEach(s => {
      const dateKey = stripTime(s.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(s);
    });

    res.status(200).json({
      success: true,
      data: {
        range: {
          start: start.toISOString().split('T')[0],
          end: new Date(end.getTime() - 86400000).toISOString().split('T')[0]
        },
        view,
        totalSchedules: schedules.length,
        schedules,
        groupedByDate: grouped
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getTeacherTimetable = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { startDate, endDate, view = 'week' } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      const eDate = new Date(endDate);
      end = new Date(eDate);
      end.setDate(end.getDate() + 1);
    } else if (view === 'month') {
      const range = getMonthRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    } else {
      const range = getWeekRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    }

    const schedules = await Schedule.find({
      teacher: teacherId,
      date: { $gte: start, $lt: end },
      status: { $ne: 'cancelled' }
    })
      .populate('course', 'name code category')
      .populate('classroom', 'name building')
      .sort({ date: 1, startTime: 1 });

    const grouped = {};
    schedules.forEach(s => {
      const dateKey = stripTime(s.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(s);
    });

    res.status(200).json({
      success: true,
      data: {
        range: {
          start: start.toISOString().split('T')[0],
          end: new Date(end.getTime() - 86400000).toISOString().split('T')[0]
        },
        view,
        totalSchedules: schedules.length,
        schedules,
        groupedByDate: grouped
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getClassroomTimetable = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { startDate, endDate, view = 'week' } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      const eDate = new Date(endDate);
      end = new Date(eDate);
      end.setDate(end.getDate() + 1);
    } else if (view === 'month') {
      const range = getMonthRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    } else {
      const range = getWeekRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    }

    const schedules = await Schedule.find({
      classroom: classroomId,
      date: { $gte: start, $lt: end },
      status: { $ne: 'cancelled' }
    })
      .populate('course', 'name code category')
      .populate('teacher', 'name subject')
      .sort({ date: 1, startTime: 1 });

    const grouped = {};
    schedules.forEach(s => {
      const dateKey = stripTime(s.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(s);
    });

    res.status(200).json({
      success: true,
      data: {
        range: {
          start: start.toISOString().split('T')[0],
          end: new Date(end.getTime() - 86400000).toISOString().split('T')[0]
        },
        view,
        totalSchedules: schedules.length,
        schedules,
        groupedByDate: grouped
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getCourseTimetable = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { startDate, endDate, status } = req.query;

    const query = { course: courseId };
    if (status) query.status = status;
    else query.status = { $ne: 'cancelled' };

    if (startDate) {
      query.date = { ...query.date, $gte: stripTime(startDate) };
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setDate(eDate.getDate() + 1);
      query.date = { ...query.date, $lt: eDate };
    }

    const schedules = await Schedule.find(query)
      .populate('teacher', 'name subject')
      .populate('classroom', 'name building capacity')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      data: {
        totalSchedules: schedules.length,
        schedules
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getOverallTimetable = async (req, res, next) => {
  try {
    const { startDate, endDate, teacher, classroom, course, view = 'week' } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      const eDate = new Date(endDate);
      end = new Date(eDate);
      end.setDate(end.getDate() + 1);
    } else if (view === 'month') {
      const range = getMonthRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    } else {
      const range = getWeekRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    }

    const query = {
      date: { $gte: start, $lt: end },
      status: { $ne: 'cancelled' }
    };
    if (teacher) query.teacher = teacher;
    if (classroom) query.classroom = classroom;
    if (course) query.course = course;

    const schedules = await Schedule.find(query)
      .populate('course', 'name code category')
      .populate('teacher', 'name subject')
      .populate('classroom', 'name building')
      .sort({ date: 1, startTime: 1 });

    const byTeacher = {};
    const byClassroom = {};
    const byDate = {};

    schedules.forEach(s => {
      const tId = s.teacher._id.toString();
      if (!byTeacher[tId]) {
        byTeacher[tId] = {
          teacher: s.teacher,
          schedules: []
        };
      }
      byTeacher[tId].schedules.push(s);

      const cId = s.classroom._id.toString();
      if (!byClassroom[cId]) {
        byClassroom[cId] = {
          classroom: s.classroom,
          schedules: []
        };
      }
      byClassroom[cId].schedules.push(s);

      const dateKey = stripTime(s.date).toISOString().split('T')[0];
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(s);
    });

    res.status(200).json({
      success: true,
      data: {
        range: {
          start: start.toISOString().split('T')[0],
          end: new Date(end.getTime() - 86400000).toISOString().split('T')[0]
        },
        view,
        totalSchedules: schedules.length,
        schedules,
        groupedByTeacher: Object.values(byTeacher),
        groupedByClassroom: Object.values(byClassroom),
        groupedByDate: byDate
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getTimetableStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      const eDate = new Date(endDate);
      end = new Date(eDate);
      end.setDate(end.getDate() + 1);
    } else {
      const range = getMonthRange();
      start = range.start;
      end = new Date(range.end);
      end.setDate(end.getDate() + 1);
    }

    const query = {
      date: { $gte: start, $lt: end }
    };

    const totalScheduled = await Schedule.countDocuments({ ...query, status: 'scheduled' });
    const totalCompleted = await Schedule.countDocuments({ ...query, status: 'completed' });
    const totalCancelled = await Schedule.countDocuments({ ...query, status: 'cancelled' });

    const teacherStats = await Schedule.aggregate([
      { $match: { ...query, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$teacher', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'teachers',
          localField: '_id',
          foreignField: '_id',
          as: 'teacherInfo'
        }
      },
      { $unwind: '$teacherInfo' },
      {
        $project: {
          _id: 1,
          count: 1,
          name: '$teacherInfo.name',
          subject: '$teacherInfo.subject'
        }
      }
    ]);

    const classroomStats = await Schedule.aggregate([
      { $match: { ...query, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$classroom', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'classrooms',
          localField: '_id',
          foreignField: '_id',
          as: 'classroomInfo'
        }
      },
      { $unwind: '$classroomInfo' },
      {
        $project: {
          _id: 1,
          count: 1,
          name: '$classroomInfo.name',
          building: '$classroomInfo.building'
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        range: {
          start: start.toISOString().split('T')[0],
          end: new Date(end.getTime() - 86400000).toISOString().split('T')[0]
        },
        overview: {
          scheduled: totalScheduled,
          completed: totalCompleted,
          cancelled: totalCancelled,
          total: totalScheduled + totalCompleted + totalCancelled
        },
        topTeachers: teacherStats,
        topClassrooms: classroomStats
      }
    });
  } catch (err) {
    next(err);
  }
};
