const Schedule = require('../models/Schedule');
const {
  stripTime,
  timeToMinutes,
  nextDay,
  buildDateQueryLt
} = require('./queryHelper');

const isTimeOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

const buildConflictQuery = (field, id, date, excludeId) => {
  const targetDate = stripTime(date);
  const query = {
    [field]: id,
    ...buildDateQueryLt(targetDate, nextDay(targetDate)),
    status: { $ne: 'cancelled' }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return query;
};

exports.checkTeacherConflict = async (teacherId, date, startTime, endTime, excludeId = null) => {
  const query = buildConflictQuery('teacher', teacherId, date, excludeId);
  const schedules = await Schedule.find(query);

  for (const s of schedules) {
    if (isTimeOverlap(startTime, endTime, s.startTime, s.endTime)) {
      return {
        conflict: true,
        type: 'teacher',
        message: '该教师在此时间段已有课程安排',
        conflictingSchedule: s
      };
    }
  }

  return { conflict: false };
};

exports.checkClassroomConflict = async (classroomId, date, startTime, endTime, excludeId = null) => {
  const query = buildConflictQuery('classroom', classroomId, date, excludeId);
  const schedules = await Schedule.find(query);

  for (const s of schedules) {
    if (isTimeOverlap(startTime, endTime, s.startTime, s.endTime)) {
      return {
        conflict: true,
        type: 'classroom',
        message: '该教室在此时间段已被占用',
        conflictingSchedule: s
      };
    }
  }

  return { conflict: false };
};

exports.checkAllConflicts = async (scheduleData, excludeId = null) => {
  const { teacher, classroom, date, startTime, endTime } = scheduleData;

  const teacherConflict = await exports.checkTeacherConflict(
    teacher, date, startTime, endTime, excludeId
  );
  if (teacherConflict.conflict) return teacherConflict;

  const classroomConflict = await exports.checkClassroomConflict(
    classroom, date, startTime, endTime, excludeId
  );
  if (classroomConflict.conflict) return classroomConflict;

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return {
      conflict: true,
      type: 'time',
      message: '结束时间必须晚于开始时间'
    };
  }

  return { conflict: false };
};

exports.generateRepeatDates = (startDate, repeatType, repeatEndDate) => {
  const dates = [];
  const current = stripTime(startDate);
  const end = stripTime(repeatEndDate || startDate);

  if (repeatType === 'none') {
    return [new Date(current)];
  }

  const intervalMs = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    biweekly: 14 * 24 * 60 * 60 * 1000
  }[repeatType] || 0;

  while (current <= end && dates.length < 365) {
    dates.push(new Date(current));
    current.setTime(current.getTime() + intervalMs);
  }

  return dates;
};
