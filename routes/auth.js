const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getAllUsers,
  updateUserRole,
  deleteUser
} = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6个字符'),
    body('name').notEmpty().withMessage('姓名不能为空')
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  validate,
  login
);

router.get('/me', protect, getMe);

router.put('/profile', protect, updateProfile);

router.put(
  '/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('请输入当前密码'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6个字符')
  ],
  validate,
  changePassword
);

router.get('/users', protect, authorize('admin'), getAllUsers);

router.put('/users/:id/role', protect, authorize('admin'), updateUserRole);

router.delete('/users/:id', protect, authorize('admin'), deleteUser);

module.exports = router;
