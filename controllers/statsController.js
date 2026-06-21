const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const Classroom = require('../models/Classroom');

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const calculateDuration = (startTime, endTime) => {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
};

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
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getMonthRange = (date = new Date()) => {
  const d = stripTime(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

exports.getTeacherWeeklyHours = async (req, res, next) => {
  try {
    const { weekDate } = req.query;

    const baseDate = weekDate ? new Date(weekDate) : new Date();
    const { start, end } = getWeekRange(baseDate);

    const schedules = await Schedule.find({
      date: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' }
    }).populate('teacher', 'name subject title phone');

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
    const { startDate, endDate, view = 'week' } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'month') {
      const range = getMonthRange();
      start = range.start;
      end = range.end;
    } else {
      const range = getWeekRange();
      start = range.start;
      end = range.end;
    }

    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const DAILY_WORKING_HOURS = 12;
    const DAILY_START_MINUTES = 8 * 60;
    const DAILY_END_MINUTES = 20 * 60;
    const MAX_DAILY_MINUTES = DAILY_END_MINUTES - DAILY_START_MINUTES;

    const schedules = await Schedule.find({
      date: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' }
    }).populate('classroom', 'name building capacity type');

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
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
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
    const { startDate, endDate } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const range = getMonthRange();
      start = range.start;
      end = range.end;
    }

    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const baseQuery = { date: { $gte: start, $lte: end } };

    const [
      totalScheduled,
      totalCompleted,
      totalCancelled,
      teacherStats,
      courseStats,
      dailyStats
    ] = await Promise.all([
      Schedule.countDocuments({ ...baseQuery, status: 'scheduled' }),
      Schedule.countDocuments({ ...baseQuery, status: 'completed' }),
      Schedule.countDocuments({ ...baseQuery, status: 'cancelled' }),

      Schedule.aggregate([
        { $match: { ...baseQuery, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$teacher',
            classCount: { $sum: 1 }
          }
        },
        { $sort: { classCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'teachers',
            localField: '_id',
            foreignField: '_id',
            as: 'info'
          }
        },
        { $unwind: '$info' },
        {
          $project: {
            _id: 0,
            teacherId: '$_id',
            name: '$info.name',
            subject: '$info.subject',
            classCount: 1
          }
        }
      ]),

      Schedule.aggregate([
        { $match: { ...baseQuery, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$course',
            classCount: { $sum: 1 }
          }
        },
        { $sort: { classCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'courses',
            localField: '_id',
            foreignField: '_id',
            as: 'info'
          }
        },
        { $unwind: '$info' },
        {
          $project: {
            _id: 0,
            courseId: '$_id',
            name: '$info.name',
            code: '$info.code',
            classCount: 1
          }
        }
      ]),

      Schedule.aggregate([
        { $match: { ...baseQuery, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' }
            },
            classCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            classCount: 1
          }
        }
      ])
    ]);

    const total = totalScheduled + totalCompleted + totalCancelled;
    const cancellationRate = total > 0 ? Math.round((totalCancelled / total) * 10000) / 100 : 0;
    const completionRate = total > 0 ? Math.round((totalCompleted / total) * 10000) / 100 : 0;

    const schedules = await Schedule.find({
      ...baseQuery,
      status: { $ne: 'cancelled' }
    });

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
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
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
    const { groupBy, startDate, endDate, status } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = stripTime(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const range = getMonthRange();
      start = range.start;
      end = range.end;
    }

    const match = { date: { $gte: start, $lte: end } };
    if (status && status !== 'all') {
      match.status = status;
    }

    let groupId;
    let lookupCollection;
    let lookupFields;

    switch (groupBy) {
      case 'teacher':
        groupId = '$teacher';
        lookupCollection = 'teachers';
        lookupFields = { name: 1, subject: 1, title: 1 };
        break;
      case 'classroom':
        groupId = '$classroom';
        lookupCollection = 'classrooms';
        lookupFields = { name: 1, building: 1, type: 1 };
        break;
      case 'course':
        groupId = '$course';
        lookupCollection = 'courses';
        lookupFields = { name: 1, code: 1, category: 1 };
        break;
      case 'status':
        groupId = '$status';
        break;
      case 'date':
        groupId = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        break;
      default:
        groupId = '$teacher';
        lookupCollection = 'teachers';
        lookupFields = { name: 1, subject: 1 };
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: groupId,
          classCount: { $sum: 1 },
          totalMinutes: {
            $sum: {
              $subtract: [
                { $add: [{ $multiply: [{ $toInt: { $substrCP: ['$endTime', 0, 2] } }, 60] }, { $toInt: { $substrCP: ['$endTime', 3, 2] } }] },
                { $add: [{ $multiply: [{ $toInt: { $substrCP: ['$startTime', 0, 2] } }, 60] }, { $toInt: { $substrCP: ['$startTime', 3, 2] } }] }
              ]
            }
          }
        }
      },
      { $sort: { classCount: -1 } }
    ];

    if (lookupCollection) {
      pipeline.push({
        $lookup: {
          from: lookupCollection,
          localField: '_id',
          foreignField: '_id',
          as: 'info'
        }
      });
      pipeline.push({ $unwind: { path: '$info', preserveNullAndEmptyArrays: true } });

      const project = {
        _id: 0,
        count: '$classCount',
        totalMinutes: 1,
        totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] }
      };

      if (groupBy === 'teacher') {
        project.teacherId = '$_id';
        project.name = '$info.name';
        project.subject = '$info.subject';
        project.title = '$info.title';
      } else if (groupBy === 'classroom') {
        project.classroomId = '$_id';
        project.name = '$info.name';
        project.building = '$info.building';
        project.type = '$info.type';
      } else if (groupBy === 'course') {
        project.courseId = '$_id';
        project.name = '$info.name';
        project.code = '$info.code';
        project.category = '$info.category';
      }

      pipeline.push({ $project: project });
    } else {
      pipeline.push({
        $project: {
          _id: 0,
          [groupBy]: '$_id',
          count: '$classCount',
          totalMinutes: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] }
        }
      });
    }

    const result = await Schedule.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: {
        groupBy,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        totalRecords: result.length,
        results: result
      }
    });
  } catch (err) {
    next(err);
  }
};
