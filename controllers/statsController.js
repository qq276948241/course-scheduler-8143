const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const Classroom = require('../models/Classroom');
const {
  stripTime,
  timeToMinutes,
  calculateDuration,
  getWeekRange,
  parseDateRange,
  buildDateQuery,
  buildTopListPipeline,
  buildGroupByAggregate,
  buildDailyDistributionPipeline,
  toDate,
  isDateValid,
  normalizeMatchDates
} = require('../utils/queryHelper');

exports.getTeacherWeeklyHours = async (req, res, next) => {
  try {
    const { weekDate } = req.query;

    const baseDate = isDateValid(toDate(weekDate)) ? toDate(weekDate) : new Date();
    const { start, end } = getWeekRange(baseDate);

    const match = normalizeMatchDates({
      ...buildDateQuery(start, end),
      status: { $ne: 'cancelled' }
    });
    const schedules = await Schedule.find(match).populate('teacher', 'name subject title phone');

    const teacherMap = new Map();

    schedules.forEach(schedule => {
      const teacherId = schedule.teacher._id.toString();
      const duration = calculateDuration(schedule.startTime, schedule.endTime);
      const hours = duration / 60;

      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacher: schedule.teacher,
          totalHours: 0,
          totalMinutes: 0,
          classCount: 0,
          details: []
        });
      }

      const data = teacherMap.get(teacherId);
      data.totalHours += hours;
      data.totalMinutes += duration;
      data.classCount += 1;
      data.details.push({
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        duration,
        courseId: schedule.course
      });
    });

    const result = Array.from(teacherMap.values())
      .sort((a, b) => b.totalHours - a.totalHours)
      .map(item => ({
        ...item,
        totalHours: Math.round(item.totalHours * 100) / 100
      }));

    const allTeachers = await Teacher.find({ status: 'active' });
    const teachersWithClasses = result.length;
    const teachersWithNoClasses = allTeachers.length - teachersWithClasses;

    res.status(200).json({
      success: true,
      data: {
        weekRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        summary: {
          totalTeachers: allTeachers.length,
          teachersWithClasses,
          teachersWithNoClasses,
          totalHours: Math.round(result.reduce((sum, item) => sum + item.totalHours, 0) * 100) / 100,
          totalClasses: result.reduce((sum, item) => sum + item.classCount, 0)
        },
        teacherStats: result
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getClassroomUtilization = async (req, res, next) => {
  try {
    const { start, end, startStr, endStr, daysDiff } = parseDateRange(req.query);

    const DAILY_WORKING_HOURS = 12;
    const DAILY_START_MINUTES = 8 * 60;
    const DAILY_END_MINUTES = 20 * 60;
    const MAX_DAILY_MINUTES = DAILY_END_MINUTES - DAILY_START_MINUTES;

    const match = normalizeMatchDates({
      ...buildDateQuery(start, end),
      status: { $ne: 'cancelled' }
    });
    const schedules = await Schedule.find(match).populate('classroom', 'name building capacity type');

    const classroomMap = new Map();

    schedules.forEach(schedule => {
      const classroomId = schedule.classroom._id.toString();
      let startMin = timeToMinutes(schedule.startTime);
      let endMin = timeToMinutes(schedule.endTime);

      startMin = Math.max(startMin, DAILY_START_MINUTES);
      endMin = Math.min(endMin, DAILY_END_MINUTES);
      const effectiveMinutes = Math.max(0, endMin - startMin);

      if (!classroomMap.has(classroomId)) {
        classroomMap.set(classroomId, {
          classroom: schedule.classroom,
          usedMinutes: 0,
          classCount: 0,
          occupiedDates: new Set(),
          details: []
        });
      }

      const data = classroomMap.get(classroomId);
      data.usedMinutes += effectiveMinutes;
      data.classCount += 1;
      data.occupiedDates.add(stripTime(schedule.date).toISOString().split('T')[0]);
      data.details.push({
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        effectiveMinutes,
        courseId: schedule.course
      });
    });

    const result = Array.from(classroomMap.values())
      .sort((a, b) => b.usedMinutes - a.usedMinutes)
      .map(item => {
        const maxPossibleMinutes = daysDiff * MAX_DAILY_MINUTES;
        const utilizationRate = maxPossibleMinutes > 0
          ? Math.round((item.usedMinutes / maxPossibleMinutes) * 10000) / 100
          : 0;

        return {
          classroom: item.classroom,
          usedMinutes: item.usedMinutes,
          usedHours: Math.round((item.usedMinutes / 60) * 100) / 100,
          maxPossibleMinutes,
          maxPossibleHours: Math.round((maxPossibleMinutes / 60) * 100) / 100,
          utilizationRate,
          classCount: item.classCount,
          occupiedDays: item.occupiedDates.size
        };
      });

    const allClassrooms = await Classroom.find({ status: 'available' });
    const totalMaxMinutes = allClassrooms.length * daysDiff * MAX_DAILY_MINUTES;
    const totalUsedMinutes = result.reduce((sum, item) => sum + item.usedMinutes, 0);
    const overallUtilization = totalMaxMinutes > 0
      ? Math.round((totalUsedMinutes / totalMaxMinutes) * 10000) / 100
      : 0;

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startStr,
          end: endStr,
          days: daysDiff
        },
        settings: {
          dailyWorkingHours: DAILY_WORKING_HOURS,
          dailyStartTime: '08:00',
          dailyEndTime: '20:00'
        },
        summary: {
          totalClassrooms: allClassrooms.length,
          classroomsWithSchedule: result.length,
          classroomsWithNoSchedule: allClassrooms.length - result.length,
          totalUsedHours: Math.round((totalUsedMinutes / 60) * 100) / 100,
          totalMaxHours: Math.round((totalMaxMinutes / 60) * 100) / 100,
          overallUtilizationRate: overallUtilization
        },
        classroomStats: result
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getScheduleOverview = async (req, res, next) => {
  try {
    const { start, end, startStr, endStr, daysDiff } = parseDateRange(req.query);

    const baseQuery = buildDateQuery(start, end);
    const matchNotCancelled = normalizeMatchDates({
      ...baseQuery,
      status: { $ne: 'cancelled' }
    });
    const scheduledQuery = normalizeMatchDates({ ...baseQuery, status: 'scheduled' });
    const completedQuery = normalizeMatchDates({ ...baseQuery, status: 'completed' });
    const cancelledQuery = normalizeMatchDates({ ...baseQuery, status: 'cancelled' });

    const [
      totalScheduled,
      totalCompleted,
      totalCancelled,
      teacherStats,
      courseStats,
      dailyStats
    ] = await Promise.all([
      Schedule.countDocuments(scheduledQuery),
      Schedule.countDocuments(completedQuery),
      Schedule.countDocuments(cancelledQuery),
      Schedule.aggregate(buildTopListPipeline({ match: matchNotCancelled, field: 'teacher', limit: 10 })),
      Schedule.aggregate(buildTopListPipeline({ match: matchNotCancelled, field: 'course', limit: 10 })),
      Schedule.aggregate(buildDailyDistributionPipeline(matchNotCancelled))
    ]);

    const total = totalScheduled + totalCompleted + totalCancelled;
    const cancellationRate = total > 0 ? Math.round((totalCancelled / total) * 10000) / 100 : 0;
    const completionRate = total > 0 ? Math.round((totalCompleted / total) * 10000) / 100 : 0;

    const schedules = await Schedule.find(matchNotCancelled);
    let totalMinutes = 0;
    schedules.forEach(s => {
      totalMinutes += calculateDuration(s.startTime, s.endTime);
    });

    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
    const uniqueTeachers = new Set(schedules.map(s => s.teacher.toString())).size;
    const uniqueClassrooms = new Set(schedules.map(s => s.classroom.toString())).size;
    const uniqueCourses = new Set(schedules.map(s => s.course.toString())).size;

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startStr,
          end: endStr,
          days: daysDiff
        },
        overview: {
          totalClasses: total,
          scheduledClasses: totalScheduled,
          completedClasses: totalCompleted,
          cancelledClasses: totalCancelled,
          cancellationRate,
          completionRate,
          totalHours,
          uniqueTeachers,
          uniqueClassrooms,
          uniqueCourses,
          avgClassesPerDay: Math.round((schedules.length / daysDiff) * 100) / 100,
          avgHoursPerDay: Math.round((totalHours / daysDiff) * 100) / 100
        },
        topTeachers: teacherStats,
        topCourses: courseStats,
        dailyDistribution: dailyStats
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getCustomAggregate = async (req, res, next) => {
  try {
    const { groupBy = 'teacher', status } = req.query;
    const { start, end, startStr, endStr } = parseDateRange(req.query);

    const match = buildDateQuery(start, end);
    if (status && status !== 'all') {
      match.status = status;
    }

    const results = await buildGroupByAggregate({ groupBy, match: normalizeMatchDates(match) });

    res.status(200).json({
      success: true,
      data: {
        groupBy,
        dateRange: {
          start: startStr,
          end: endStr
        },
        totalRecords: results.length,
        results
      }
    });
  } catch (err) {
    next(err);
  }
};
