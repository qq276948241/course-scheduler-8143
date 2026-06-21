const { validationResult } = require('express-validator');

exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

exports.errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  let message = err.message || '服务器内部错误';
  let statusCode = err.statusCode || 500;

  if (err.name === 'CastError') {
    message = '资源未找到';
    statusCode = 404;
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} 已存在`;
    statusCode = 400;
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
    return res.status(400).json({
      success: false,
      errors
    });
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};
