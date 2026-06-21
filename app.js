require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/teachers', require('./routes/teachers'));
app.use('/api/v1/classrooms', require('./routes/classrooms'));
app.use('/api/v1/courses', require('./routes/courses'));
app.use('/api/v1/schedules', require('./routes/schedules'));
app.use('/api/v1/enrollments', require('./routes/enrollments'));
app.use('/api/v1/timetables', require('./routes/timetables'));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '排课系统后端服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '教育培训机构排课系统 API',
    docs: {
      baseUrl: '/api/v1',
      endpoints: {
        auth: '/api/v1/auth',
        teachers: '/api/v1/teachers',
        classrooms: '/api/v1/classrooms',
        courses: '/api/v1/courses',
        schedules: '/api/v1/schedules',
        enrollments: '/api/v1/enrollments',
        timetables: '/api/v1/timetables'
      }
    }
  });
});

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `找不到 ${req.method} ${req.originalUrl} 路由`
  });
});

app.use(errorHandler);

module.exports = app;
