const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     教育培训机构排课系统后端服务已启动                      ║
╠══════════════════════════════════════════════════════════╣
║  模式: ${String(process.env.NODE_ENV || 'development').padEnd(49)}║
║  端口: ${String(PORT).padEnd(49)}║
║  地址: http://localhost:${String(PORT).padEnd(40)}║
║  API:  http://localhost:${String(PORT) + '/api/v1'.padEnd(39)}║
║  健康: http://localhost:${String(PORT) + '/api/v1/health'.padEnd(34)}║
╚══════════════════════════════════════════════════════════╝
  `);
});

process.on('unhandledRejection', (err, promise) => {
  console.error(`未处理的 Promise 拒绝: ${err.message}`);
  console.error(err.stack);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
