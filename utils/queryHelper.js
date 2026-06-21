const Schedule = require('../models/Schedule');

const stripTime = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const nextDay = (date) => {
  const d = stripTime(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const calculateDuration = (startTime, endTime) => {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
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

const parseDateRange = (query, options = {}) => {
  const {
    startParam = 'startDate',
    endParam = 'endDate',
    viewParam = 'view',
    defaultView = 'week',
    inclusiveEnd = true
  } = options;

  const { [startParam]: startDate, [endParam]: endDate, [viewParam]: view = defaultView } = query;

  let start, end;
  if (startDate && endDate) {
    start = stripTime(startDate);
    end = inclusiveEnd ? endOfDay(endDate) : nextDay(endDate);
  } else if (view === 'month') {
    const range = getMonthRange();
    start = range.start;
    end = inclusiveEnd ? range.end : nextDay(range.end);
  } else {
    const range = getWeekRange();
    start = range.start;
    end = inclusiveEnd ? range.end : nextDay(range.end);
  }

  return {
    start,
    end,
    startStr: start.toISOString().split('T')[0],
    endStr: (inclusiveEnd ? end : new Date(end.getTime() - 86400000)).toISOString().split('T')[0],
    daysDiff: Math.ceil((endOfDay(end) - start) / (1000 * 60 * 60 * 24))
  };
};

const buildDateQuery = (start, end, field = 'date') => {
  return {
    [field]: { $gte: start, $lte: end }
  };
};

const buildDateQueryLt = (start, end, field = 'date') => {
  return {
    [field]: { $gte: start, $lt: end }
  };
};

const buildScheduleQuery = (filters = {}) => {
  const {
    course,
    teacher,
    classroom,
    status,
    startDate,
    endDate,
    excludeCancelled = true
  } = filters;

  const query = {};

  if (course) query.course = course;
  if (teacher) query.teacher = teacher;
  if (classroom) query.classroom = classroom;

  if (status) {
    query.status = status;
  } else if (excludeCancelled) {
    query.status = { $ne: 'cancelled' };
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = stripTime(startDate);
    if (endDate) query.date.$lt = nextDay(endDate);
  }

  return query;
};

const durationExpr = () => {
  return {
    $sum: {
      $subtract: [
        { $add: [{ $multiply: [{ $toInt: { $substrCP: ['$endTime', 0, 2] } }, 60] }, { $toInt: { $substrCP: ['$endTime', 3, 2] } }] },
        { $add: [{ $multiply: [{ $toInt: { $substrCP: ['$startTime', 0, 2] } }, 60] }, { $toInt: { $substrCP: ['$startTime', 3, 2] } }] }
      ]
    }
  };
};

const GROUP_BY_CONFIGS = {
  teacher: {
    groupId: '$teacher',
    lookup: {
      from: 'teachers',
      fields: { name: 1, subject: 1, title: 1 },
      idField: 'teacherId',
      mapFields: ['name', 'subject', 'title']
    }
  },
  classroom: {
    groupId: '$classroom',
    lookup: {
      from: 'classrooms',
      fields: { name: 1, building: 1, type: 1 },
      idField: 'classroomId',
      mapFields: ['name', 'building', 'type']
    }
  },
  course: {
    groupId: '$course',
    lookup: {
      from: 'courses',
      fields: { name: 1, code: 1, category: 1 },
      idField: 'courseId',
      mapFields: ['name', 'code', 'category']
    }
  },
  status: {
    groupId: '$status'
  },
  date: {
    groupId: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
  }
};

const buildTopListPipeline = ({ match, field, limit = 10, withDuration = false }) => {
  const config = GROUP_BY_CONFIGS[field];
  if (!config) {
    throw new Error(`Invalid group field: ${field}`);
  }

  const groupStage = {
    _id: config.groupId,
    classCount: { $sum: 1 }
  };

  if (withDuration) {
    groupStage.totalMinutes = durationExpr();
  }

  const pipeline = [
    { $match: match },
    { $group: groupStage },
    { $sort: { classCount: -1 } },
    { $limit: limit }
  ];

  if (config.lookup) {
    pipeline.push({
      $lookup: {
        from: config.lookup.from,
        localField: '_id',
        foreignField: '_id',
        as: 'info'
      }
    });
    pipeline.push({ $unwind: { path: '$info', preserveNullAndEmptyArrays: true } });

    const project = { _id: 0 };
    project[config.lookup.idField] = '$_id';
    project.classCount = 1;
    if (withDuration) {
      project.totalMinutes = 1;
      project.totalHours = { $round: [{ $divide: ['$totalMinutes', 60] }, 2] };
    }
    config.lookup.mapFields.forEach(f => {
      project[f] = `$info.${f}`;
    });
    pipeline.push({ $project: project });
  } else {
    pipeline.push({
      $project: {
        _id: 0,
        [field]: '$_id',
        classCount: 1,
        ...(withDuration ? {
          totalMinutes: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] }
        } : {})
      }
    });
  }

  return pipeline;
};

const buildGroupByAggregate = ({ groupBy, match }) => {
  const pipeline = buildTopListPipeline({
    match,
    field: groupBy,
    limit: 10000,
    withDuration: true
  });

  return Schedule.aggregate(pipeline);
};

const buildDailyDistributionPipeline = (match) => {
  return [
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
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
  ];
};

const calculateDaysDiff = (start, end) => {
  return Math.ceil((endOfDay(end) - start) / (1000 * 60 * 60 * 24));
};

module.exports = {
  stripTime,
  endOfDay,
  nextDay,
  timeToMinutes,
  calculateDuration,
  getWeekRange,
  getMonthRange,
  parseDateRange,
  buildDateQuery,
  buildDateQueryLt,
  buildScheduleQuery,
  durationExpr,
  GROUP_BY_CONFIGS,
  buildTopListPipeline,
  buildGroupByAggregate,
  buildDailyDistributionPipeline,
  calculateDaysDiff
};
