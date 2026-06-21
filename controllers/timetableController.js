const Schedule = require('../models/Schedule');
const Enrollment = require('../models/Enrollment');
const {
  stripTime,
  parseDateRange,
  buildDateQuery,
  buildDateQueryLt,
  buildTopListPipeline,
  normalizeMatchDates
} = require('../utils/queryHelper');

const buildTimetableQuery = (baseQuery, { start, end }) => {
  return {
    ...baseQuery,
    ...buildDateQueryLt(start, end)
  };
};

const groupSchedulesByDate = (schedules) => {
  const grouped = {};
  schedules.forEach(s => {
    const dateKey = stripTime(s.date).toISOString().split('T')[0];
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(s);
  });
  return grouped;
};

exports.getMyTimetable = async (req, res, next) => {
  try {
    const { view } = req.query;
    const { start, end, startStr, endStr } = parseDateRange(req.query, { inclusiveEnd: false });

    const enrollments = await Enrollment.find({
      student: req.user.id,
      status: 'enrolled'
    }).select('course');

    const courseIds = enrollments.map(e => e.course);

    const query = buildTimetableQuery(
      { course: { $in: courseIds }, status: { $ne: 'cancelled' } },
      { start, end }
    );

    const schedules = await Schedule.find(normalizeMatchDates(query))
      .populate('course', 'name code category')
      .populate('teacher', 'name subject')
      .populate('classroom', 'name building')
      .sort({ date: 1, startTime: 1 });

    const grouped = groupSchedulesByDate(schedules);

    res.status(200).json({
      success: true,
      data: {
        range: { start: startStr, end: endStr },
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
    const { view } = req.query;
    const { start, end, startStr, endStr } = parseDateRange(req.query, { inclusiveEnd: false });

    const query = buildTimetableQuery(
      { teacher: teacherId, status: { $ne: 'cancelled' } },
      { start, end }
    );

    const schedules = await Schedule.find(normalizeMatchDates(query))
      .populate('course', 'name code category')
      .populate('classroom', 'name building')
      .sort({ date: 1, startTime: 1 });

    const grouped = groupSchedulesByDate(schedules);

    res.status(200).json({
      success: true,
      data: {
        range: { start: startStr, end: endStr },
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
    const { view } = req.query;
    const { start, end, startStr, endStr } = parseDateRange(req.query, { inclusiveEnd: false });

    const query = buildTimetableQuery(
      { classroom: classroomId, status: { $ne: 'cancelled' } },
      { start, end }
    );

    const schedules = await Schedule.find(normalizeMatchDates(query))
      .populate('course', 'name code category')
      .populate('teacher', 'name subject')
      .sort({ date: 1, startTime: 1 });

    const grouped = groupSchedulesByDate(schedules);

    res.status(200).json({
      success: true,
      data: {
        range: { start: startStr, end: endStr },
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

    if (startDate || endDate) {
      if (startDate) {
        const s = stripTime(startDate);
        if (!isNaN(s.getTime())) query.date = { ...query.date, $gte: s };
      }
      if (endDate) {
        const e = stripTime(endDate);
        if (!isNaN(e.getTime())) {
          e.setDate(e.getDate() + 1);
          query.date = { ...query.date, $lt: e };
        }
      }
    }

    const schedules = await Schedule.find(normalizeMatchDates(query))
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
    const { teacher, classroom, course, view } = req.query;
    const { start, end, startStr, endStr } = parseDateRange(req.query, { inclusiveEnd: false });

    const query = buildTimetableQuery({ status: { $ne: 'cancelled' } }, { start, end });
    if (teacher) query.teacher = teacher;
    if (classroom) query.classroom = classroom;
    if (course) query.course = course;

    const schedules = await Schedule.find(normalizeMatchDates(query))
      .populate('course', 'name code category')
      .populate('teacher', 'name subject')
      .populate('classroom', 'name building')
      .sort({ date: 1, startTime: 1 });

    const byTeacher = {};
    const byClassroom = {};

    schedules.forEach(s => {
      const tId = s.teacher._id.toString();
      if (!byTeacher[tId]) {
        byTeacher[tId] = { teacher: s.teacher, schedules: [] };
      }
      byTeacher[tId].schedules.push(s);

      const cId = s.classroom._id.toString();
      if (!byClassroom[cId]) {
        byClassroom[cId] = { classroom: s.classroom, schedules: [] };
      }
      byClassroom[cId].schedules.push(s);
    });

    const byDate = groupSchedulesByDate(schedules);

    res.status(200).json({
      success: true,
      data: {
        range: { start: startStr, end: endStr },
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
    const { start, end, startStr, endStr } = parseDateRange(req.query, { inclusiveEnd: false });

    const query = buildDateQuery(start, end);
    const matchScheduled = normalizeMatchDates({ ...query, status: 'scheduled' });
    const matchCompleted = normalizeMatchDates({ ...query, status: 'completed' });
    const matchCancelled = normalizeMatchDates({ ...query, status: 'cancelled' });
    const matchActive = normalizeMatchDates({ ...query, status: { $ne: 'cancelled' } });

    const [totalScheduled, totalCompleted, totalCancelled, teacherStats, classroomStats] = await Promise.all([
      Schedule.countDocuments(matchScheduled),
      Schedule.countDocuments(matchCompleted),
      Schedule.countDocuments(matchCancelled),
      Schedule.aggregate(buildTopListPipeline({
        match: matchActive,
        field: 'teacher',
        limit: 10
      })),
      Schedule.aggregate(buildTopListPipeline({
        match: matchActive,
        field: 'classroom',
        limit: 10
      }))
    ]);

    res.status(200).json({
      success: true,
      data: {
        range: { start: startStr, end: endStr },
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
