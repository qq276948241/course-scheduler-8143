# 架构说明（ARCHITECTURE）

教育培训机构排课系统后端，基于 Node.js + Express + MongoDB 构建。本文档面向新接手项目的同事，帮助你快速理解整体技术架构、模块职责划分、请求流转链路以及数据库集合关联关系。

---

## 一、技术栈

| 分类 | 技术 | 版本 | 用途 |
| --- | --- | --- | --- |
| 运行时 | Node.js | ≥ 18 | JavaScript 服务端运行环境 |
| Web 框架 | Express | 4.19 | HTTP 路由与中间件编排 |
| 数据库 | MongoDB | ≥ 4.4 | 文档型数据库存储业务数据 |
| ODM | Mongoose | 8.6 | Schema 定义、关联填充、聚合管道构建 |
| 认证 | jsonwebtoken | 9.0 | JWT 签发与校验 |
| 密码 | bcryptjs | 2.4 | 密码加盐哈希与比对 |
| 参数校验 | express-validator | 7.2 | 请求体字段校验 |
| 跨域 | cors | 2.8 | CORS 中间件 |
| 配置 | dotenv | 16.4 | `.env` 环境变量加载 |
| 开发工具 | nodemon | 3.1 | 文件变更自动重启 |

依赖定义见 [package.json](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/package.json)。

---

## 二、目录结构

```
project56/
├── config/
│   └── db.js                  # MongoDB 连接封装
├── controllers/               # 业务逻辑层（8 个）
│   ├── authController.js      # 认证与用户管理
│   ├── teacherController.js   # 教师管理
│   ├── classroomController.js # 教室管理
│   ├── courseController.js    # 课程管理
│   ├── scheduleController.js  # 排课引擎
│   ├── enrollmentController.js# 学员选课
│   ├── timetableController.js # 课表查询
│   └── statsController.js     # 统计分析
├── middleware/                # 中间件层
│   ├── auth.js                # JWT 认证 + 角色授权
│   └── errorHandler.js        # 参数校验 + 统一错误处理
├── models/                    # 数据模型层（6 个集合）
│   ├── User.js
│   ├── Teacher.js
│   ├── Classroom.js
│   ├── Course.js
│   ├── Schedule.js
│   └── Enrollment.js
├── routes/                    # 路由层（8 个模块）
│   ├── auth.js
│   ├── teachers.js
│   ├── classrooms.js
│   ├── courses.js
│   ├── schedules.js
│   ├── enrollments.js
│   ├── timetables.js
│   └── stats.js
├── utils/                     # 工具层
│   ├── queryHelper.js         # 日期处理 + 查询构建 + 聚合管道
│   └── scheduleConflicts.js   # 排课冲突检测 + 重复日期生成
├── app.js                     # Express 应用实例与全局中间件
├── server.js                  # 服务启动入口
├── .env.example               # 环境变量示例
└── package.json
```

项目采用经典 **MVC 分层架构**，职责清晰分离：

- **Route（路由层）**：定义 URL 路径与 HTTP 方法，挂载中间件链，不写业务逻辑。
- **Middleware（中间件层）**：横切关注点——认证、授权、参数校验、错误处理。
- **Controller（控制层）**：业务逻辑编排，调用 Model 和 Utils，组装响应。
- **Model（模型层）**：Mongoose Schema 定义，包含字段校验、索引、实例方法。
- **Utils（工具层）**：可复用的纯函数与业务工具（日期处理、聚合管道构建、冲突检测）。

---

## 三、模块职责划分

### 3.1 认证模块（auth）

**路由**：`/api/v1/auth`（见 [routes/auth.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/auth.js)）

**控制器**：[authController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/authController.js)

| 端点 | 方法 | 权限 | 说明 |
| --- | --- | --- | --- |
| `/register` | POST | 公开 | 用户注册（密码自动加盐哈希） |
| `/login` | POST | 公开 | 用户登录（返回 JWT） |
| `/me` | GET | 登录 | 获取当前登录用户信息 |
| `/profile` | PUT | 登录 | 修改个人信息 |
| `/password` | PUT | 登录 | 修改密码 |
| `/users` | GET | 管理员 | 获取所有用户列表 |
| `/users/:id/role` | PUT | 管理员 | 修改用户角色 |
| `/users/:id` | DELETE | 管理员 | 删除用户 |

**角色体系**：`admin`（管理员，可操作所有资源）与 `user`（普通学员，可选课、查课表）。

### 3.2 教师模块（teachers）

**路由**：`/api/v1/teachers`（见 [routes/teachers.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/teachers.js)）

**控制器**：[teacherController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/teacherController.js)

提供教师资源的 CRUD，以及状态切换（`active` / `inactive`）。查询类端点所有登录用户可访问，写操作仅管理员。

### 3.3 教室模块（classrooms）

**路由**：`/api/v1/classrooms`（见 [routes/classrooms.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/classrooms.js)）

**控制器**：[classroomController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/classroomController.js)

提供教室 CRUD，外加 `/availability` 教室可用性查询（根据日期与时间段判断哪些教室空闲）。

### 3.4 课程模块（courses）

**路由**：`/api/v1/courses`（见 [routes/courses.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/courses.js)）

**控制器**：[courseController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/courseController.js)

| 端点 | 方法 | 权限 | 说明 |
| --- | --- | --- | --- |
| `/available` | GET | 登录 | 获取已发布可选课程列表（供学员选课） |
| `/` | GET | 登录 | 课程列表（含草稿/已关闭） |
| `/:id/publish` | PATCH | 管理员 | 发布课程（draft → published） |
| `/:id` | GET/PUT/DELETE | 登录/管理员 | 课程详情与维护 |

课程状态机：`draft`（草稿）→ `published`（已发布，可被选课）→ `closed`（已关闭）。

### 3.5 排课模块（schedules）—— 核心引擎

**路由**：`/api/v1/schedules`（见 [routes/schedules.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/schedules.js)）

**控制器**：[scheduleController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/scheduleController.js)

这是系统最核心的模块，承担三大职责：

1. **冲突检测**：`POST /check-conflicts` 在排课前预检教师与教室的时间冲突，调用 [utils/scheduleConflicts.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/utils/scheduleConflicts.js) 的 `checkAllConflicts()`。
2. **排课创建（含重复排课）**：`POST /` 支持四种重复模式：
   - `none`：单次排课
   - `daily`：每日重复
   - `weekly`：每周重复
   - `biweekly`：双周重复

   由 `generateRepeatDates()` 生成日期序列，逐个日期做冲突检测，冲突的跳过、可排的创建，最终返回创建成功与冲突两部分结果。
3. **排课生命周期**：`scheduled`（已排）→ `completed`（已完成）/ `cancelled`（已取消），通过 `PATCH /:id/cancel` 取消排课。

### 3.6 选课模块（enrollments）

**路由**：`/api/v1/enrollments`（见 [routes/enrollments.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/enrollments.js)）

**控制器**：[enrollmentController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/enrollmentController.js)

| 端点 | 方法 | 权限 | 说明 |
| --- | --- | --- | --- |
| `/mine` | GET | 登录 | 我的选课记录 |
| `/courses/:courseId/enroll` | POST | 登录 | 选课（含容量校验、重复选课校验、退课后重选） |
| `/courses/:courseId/drop` | POST | 登录 | 退课 |
| `/courses/:courseId` | GET | 管理员 | 查看课程选课名单 |
| `/:enrollmentId/payment` | PATCH | 管理员 | 标记缴费状态 |
| `/:enrollmentId/complete` | PATCH | 管理员 | 标记课程完成 |
| `/` | GET | 管理员 | 全部选课记录 |

选课状态机：`enrolled`（已选）→ `dropped`（已退）/ `completed`（已完成）。免费课程选课时自动标记为已缴费。

### 3.7 课表查询模块（timetables）

**路由**：`/api/v1/timetables`（见 [routes/timetables.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/timetables.js)）

**控制器**：[timetableController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/timetableController.js)

提供多维度课表视图：

| 端点 | 方法 | 权限 | 说明 |
| --- | --- | --- | --- |
| `/mine` | GET | 登录 | 我的课表（按选课记录聚合） |
| `/teacher/:teacherId` | GET | 登录 | 教师课表 |
| `/classroom/:classroomId` | GET | 登录 | 教室课表 |
| `/course/:courseId` | GET | 登录 | 课程排课时间表 |
| `/overall` | GET | 管理员 | 全局课表总览 |
| `/stats` | GET | 管理员 | 课表统计（各状态数量 + Top 教师/教室） |

所有课表查询支持按 `startDate` / `endDate` / `view`（`week` / `month`）过滤，结果按日期分组返回。

### 3.8 统计分析模块（stats）

**路由**：`/api/v1/stats`（见 [routes/stats.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/stats.js)）

**控制器**：[statsController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/statsController.js)

**权限**：路由级别整体挂载 `protect` + `authorize('admin')`，仅管理员可访问。

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/teachers/weekly-hours` | GET | 教师周课时量（按时长降序，含明细） |
| `/classrooms/utilization` | GET | 教室使用率（有效时长 / 工作时段上限） |
| `/schedules/overview` | GET | 排课总览（各状态数、取消率、Top 教师/课程、每日分布） |
| `/aggregate` | GET | 自定义分组聚合（`groupBy` 可选 teacher/classroom/course/status/date） |

统计接口大量使用 MongoDB 聚合管道（`$match` / `$group` / `$lookup` / `$unwind` / `$project`），管道构建逻辑统一封装在 [utils/queryHelper.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/utils/queryHelper.js)。

### 3.9 工具层

#### queryHelper.js

见 [utils/queryHelper.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/utils/queryHelper.js)，是统计与课表模块共用的查询构建中心，分三层：

1. **日期工具层**：`toDate()` / `isDateValid()` / `stripTime()` / `endOfDay()` / `nextDay()` / `getWeekRange()` / `getMonthRange()` / `parseDateRange()` —— 统一处理字符串到 `Date` 的转换与校验，防止非法日期污染查询。
2. **查询构建层**：`buildDateQuery()` / `buildDateQueryLt()` / `buildScheduleQuery()` / `toObjectId()` —— 生成 Mongoose 查询条件对象，支持 `$gte`/`$lte`（统计用，闭区间）与 `$gte`/`$lt`（列表用，开区间）两种模式。
3. **聚合管道层**：`normalizeMatchDates()` / `buildTopListPipeline()` / `buildDailyDistributionPipeline()` / `buildGroupByAggregate()` / `durationExpr()` —— 构建聚合管道。其中 `normalizeMatchDates()` 是关键防御函数，确保 `$match` 阶段的日期条件始终为 `Date` 类型（避免字符串与 Date 类型比较导致空结果）。

#### scheduleConflicts.js

见 [utils/scheduleConflicts.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/utils/scheduleConflicts.js)：

- `checkTeacherConflict()`：检测教师同一日期的时间段重叠。
- `checkClassroomConflict()`：检测教室同一日期的时间段重叠。
- `checkAllConflicts()`：依次执行教师→教室冲突检测，并校验时间合法性（结束须晚于开始）。
- `generateRepeatDates()`：根据 `repeatType` 生成重复排课日期序列。

冲突检测核心是 `isTimeOverlap()`：`s1 < e2 && s2 < e1`（两个时间段存在交集）。

---

## 四、请求流转链路

一个完整的 HTTP 请求从进入到响应，经历以下阶段：

```
HTTP 请求
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  server.js  →  app.listen()  启动服务                         │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  app.js 全局中间件                                           │
│  ┌─────────┐   ┌──────────────────┐                         │
│  │  cors   │ → │  express.json()   │  →  路由分发            │
│  └─────────┘   └──────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  routes/*.js  路由层                                         │
│  挂载中间件链（按需组合）：                                    │
│    protect          → JWT 校验，注入 req.user                │
│    authorize(roles) → 角色校验                               │
│    body(...).withMessage → express-validator 规则            │
│    validate         → 校验结果收集，失败返回 400              │
│  最后调用 controller 方法                                    │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  controllers/*.js  控制层                                    │
│  1. 解析 req.params / req.query / req.body / req.user       │
│  2. 调用 utils（queryHelper / scheduleConflicts）构建查询     │
│  3. 调用 Model 操作数据库（find / create / aggregate）       │
│  4. .populate() 填充关联文档                                 │
│  5. 组装响应 JSON，res.status().json()                       │
│  异常 → next(err) 抛给错误处理中间件                          │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  models/*.js  模型层                                         │
│  Mongoose Schema + 索引 + 实例方法（密码哈希、JWT 签发）     │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  errorHandler  统一错误处理中间件（app.js 末尾挂载）           │
│  处理 CastError / 11000 重复键 / ValidationError             │
│  统一返回 { success: false, message / errors }              │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
HTTP 响应
```

### 4.1 典型请求示例：管理员创建排课

以 `POST /api/v1/schedules`（带重复排课）为例，完整链路：

1. **全局中间件**（[app.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/app.js#L12-L13)）：`cors()` → `express.json()` 解析请求体。
2. **路由匹配**（[routes/schedules.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/schedules.js#L32-L48)）：依次执行 `protect`（校验 JWT）→ `authorize('admin')`（校验管理员）→ `body(...)` 参数校验规则 → `validate` 收集校验结果。
3. **控制器**（[scheduleController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/scheduleController.js#L9-L100)）：
   - 校验课程、教师、教室存在性与状态。
   - 校验排课教师与课程绑定教师一致。
   - 调用 `generateRepeatDates()` 生成日期序列。
   - 循环每个日期调用 `checkAllConflicts()` 做冲突检测。
   - 无冲突则 `Schedule.create()`，有冲突则记录到 conflicts 数组。
4. **模型层**（[models/Schedule.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/models/Schedule.js)）：写入文档，复合索引保证查询效率。
5. **响应**：返回 `{ created, createdCount, conflicts, conflictCount }`。
6. **异常**：任何步骤抛错经 `next(err)` 传入 [errorHandler.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/middleware/errorHandler.js#L17-L48) 统一处理。

### 4.2 典型请求示例：统计聚合查询

以 `GET /api/v1/stats/schedules/overview` 为例：

1. **路由层**（[routes/stats.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/routes/stats.js#L12-L13)）：`router.use(protect)` + `router.use(authorize('admin'))` 对整个 stats 路由生效。
2. **控制器**（[statsController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/statsController.js#L200-L273)）：
   - `parseDateRange()` 解析日期区间（字符串→Date，无效则回退默认周/月）。
   - `buildDateQuery()` 构建 `$gte`/`$lte` 日期条件。
   - `normalizeMatchDates()` 强制将 `$match` 的日期条件转为 `Date` 类型。
   - `Promise.all` 并发执行 `countDocuments`（3 个状态统计）+ `aggregate`（Top 教师/课程/每日分布，管道由 `buildTopListPipeline()` / `buildDailyDistributionPipeline()` 构建）。
3. **响应**：返回总览数据。

---

## 五、MongoDB 集合关系

系统共 6 个集合，通过 `ObjectId` 引用建立关联。`populate()` 在查询时填充关联文档。

```
                          ┌──────────────┐
                          │     User     │  用户/学员（admin / user）
                          │  _id         │
          createdBy ──────┤  username    │←─────────────┐
              (ref)       │  password    │              │ student (ref)
                          │  role        │              │
                          └──────────────┘              │
                                ▲                       │
                                │                       │
                         ┌──────┴───────┐        ┌──────┴───────┐
                         │   Schedule   │        │  Enrollment  │
                         │  _id         │        │  _id         │
            course ──────┤  date        │        │  status      │
            teacher ─────┤  startTime   │        │  paid        │── course (ref)
          classroom ─────┤  endTime     │        │  amount      │
            createdBy ───┤  status      │        └───────────────┘
                         │  repeatType  │              ▲
                         └──────────────┘              │ student+course 唯一索引
                                ▲                       │
                                │ 课程/教师/教室引用     │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │    Course    │  │   Teacher    │  │  Classroom   │
      │  _id         │  │  _id         │  │  _id         │
      │  code(唯一)   │  │  name        │  │  name(唯一)   │
      │  name        │  │  subject     │  │  building    │
      │  maxStudents │  │  status      │  │  capacity    │
      │  status      │  │  title       │  │  status      │
      │  teacher ─────┼──┤  phone       │  │  equipment   │
      └──────────────┘  └──────────────┘  └──────────────┘
            ▲ teacher (ref)     独立实体          独立实体
            │
            └── Course 引用 Teacher（课程绑定授课教师）
```

### 5.1 集合字段与关联明细

#### User（用户/学员）

定义见 [models/User.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/models/User.js)。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `username` | String | 用户名，唯一 |
| `password` | String | 加盐哈希密码（`select: false`，查询时不返回） |
| `name` | String | 姓名 |
| `phone` / `email` | String | 联系方式 |
| `role` | String | 角色：`admin` / `user` |

**实例方法**：`getSignedJwtToken()` 签发 JWT；`matchPassword()` 比对密码。`pre('save')` 钩子自动哈希密码。

#### Teacher（教师）

定义见 [models/Teacher.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/models/Teacher.js)。独立实体，无外键引用，被 `Course` 和 `Schedule` 引用。

#### Classroom（教室）

定义见 [models/Classroom.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/models/Classroom.js)。独立实体，`name` 唯一，被 `Schedule` 引用。

#### Course（课程）

定义见 [models/Course.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/models/Course.js)。

| 字段 | 类型 | 关联 |
| --- | --- | --- |
| `teacher` | ObjectId → `Teacher` | 课程绑定的授课教师（一对一） |
| `code` | String | 课程编号，唯一 |
| `maxStudents` | Number | 最大选课容量 |

建有文本索引 `{ name: 'text', code: 'text', category: 'text' }` 支持全文检索。

#### Schedule（排课）—— 关联中心

定义见 [models/Schedule.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/models/Schedule.js)。是系统关联最密集的集合：

| 字段 | 类型 | 关联 |
| --- | --- | --- |
| `course` | ObjectId → `Course` | 排课对应的课程 |
| `teacher` | ObjectId → `Teacher` | 授课教师 |
| `classroom` | ObjectId → `Classroom` | 上课教室 |
| `createdBy` | ObjectId → `User` | 创建该排课的管理员 |
| `date` | Date | 上课日期 |
| `startTime` / `endTime` | String | 时间段（`HH:mm` 格式） |
| `status` | String | `scheduled` / `completed` / `cancelled` |

**复合索引**（支撑冲突检测的高频查询）：
- `{ teacher: 1, date: 1, startTime: 1 }` —— 教师冲突检测
- `{ classroom: 1, date: 1, startTime: 1 }` —— 教室冲突检测

#### Enrollment（选课记录）

定义见 [models/Enrollment.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/models/Enrollment.js)。

| 字段 | 类型 | 关联 |
| --- | --- | --- |
| `student` | ObjectId → `User` | 选课学员 |
| `course` | ObjectId → `Course` | 所选课程 |
| `status` | String | `enrolled` / `dropped` / `completed` |
| `paid` | Boolean | 是否缴费 |
| `amount` | Number | 应缴金额 |

**唯一索引**：`{ student: 1, course: 1 }` —— 保证同一学员对同一课程只有一条选课记录（退课后重选复用该记录）。

### 5.2 关联关系总结

| 来源集合 | 字段 | 目标集合 | 关系 | 说明 |
| --- | --- | --- | --- | --- |
| Course | `teacher` | Teacher | 多对一 | 一个教师可讲授多门课程 |
| Schedule | `course` | Course | 多对一 | 一门课程可有多节排课 |
| Schedule | `teacher` | Teacher | 多对一 | 一个教师可有多节排课 |
| Schedule | `classroom` | Classroom | 多对一 | 一个教室可被多节排课占用 |
| Schedule | `createdBy` | User | 多对一 | 排课创建者 |
| Enrollment | `student` | User | 多对一 | 一个学员可有多条选课记录 |
| Enrollment | `course` | Course | 多对一 | 一门课程可被多个学员选课 |

> 注：本系统未使用 Mongoose 的 `populate` 反向虚拟字段（virtual populate）。教师/教室的「排课数」「被选人数」等反向统计通过 `stats` 模块的聚合管道实时计算，而非持久化存储。

---

## 六、认证与权限设计

### 6.1 JWT 认证流程

1. 用户 `POST /api/v1/auth/login` 提交用户名密码。
2. [authController.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/controllers/authController.js) 用 `matchPassword()` 比对哈希，成功后调用 `getSignedJwtToken()` 签发 JWT（payload 含 `id` 与 `role`，有效期由 `JWT_EXPIRE` 控制）。
3. 客户端后续请求在 `Authorization: Bearer <token>` 头中携带 JWT。
4. [middleware/auth.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/middleware/auth.js) 的 `protect()` 解析并 `jwt.verify()` 校验，通过后查库注入 `req.user`。

### 6.2 角色权限矩阵

| 模块 | 读操作 | 写操作 | 说明 |
| --- | --- | --- | --- |
| auth | `/me`、`/profile` | 登录用户自改 | 用户管理仅 admin |
| teachers | 登录用户 | admin | |
| classrooms | 登录用户 | admin | |
| courses | 登录用户 | admin | `/available` 供学员选课 |
| schedules | 登录用户 | admin | 冲突检测、取消均 admin |
| enrollments | 学员查自己 | 学员选/退课 | 选课名单、缴费、完成 admin |
| timetables | 登录用户 | — | `/overall`、`/stats` admin |
| stats | — | — | 全部 admin |

---

## 七、错误处理机制

统一错误处理见 [middleware/errorHandler.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/middleware/errorHandler.js)：

1. **参数校验错误**：`validate()` 中间件收集 `express-validator` 结果，失败返回 `400`，body 含字段级错误数组。
2. **Mongoose CastError**：无效 ObjectId 等，返回 `404`。
3. **重复键错误（code 11000）**：唯一索引冲突，返回 `400` 并提示冲突字段。
4. **ValidationError**：Schema 校验失败，返回 `400` 并列出字段级错误。
5. **其他异常**：默认 `500`，返回错误消息。

所有错误响应统一格式：

```json
{
  "success": false,
  "message": "错误描述"
}
```

或带字段级详情：

```json
{
  "success": false,
  "errors": [{ "field": "username", "message": "用户名不能为空" }]
}
```

---

## 八、关键设计要点

### 8.1 冲突检测的时间比较逻辑

排课冲突检测（[scheduleConflicts.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/utils/scheduleConflicts.js)）采用「日期 + 时间段」二维检测：

- 先用复合索引 `{ teacher, date, startTime }` 快速定位同一天该教师的所有排课。
- 再用 `isTimeOverlap()` 做时间段交集判断（`s1 < e2 && s2 < e1`）。
- 教室冲突同理，走 `{ classroom, date, startTime }` 索引。

### 8.2 重复排课的容错策略

`createSchedule` 对重复排课采用**部分成功**策略：逐个日期检测冲突，可排则创建、冲突则记录，最终统一返回 `created` 与 `conflicts` 两部分。客户端可据此决定是否重试冲突日期。

### 8.3 统计查询的日期类型安全

统计接口大量使用聚合管道，`$match` 阶段要求日期条件为 `Date` 类型。前端传入的 `startDate` / `endDate` 为字符串，[queryHelper.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/utils/queryHelper.js) 的 `normalizeMatchDates()` 在进入聚合管道前强制归一化，避免字符串与 Date 类型比较导致空结果。

### 8.4 选课容量并发控制

选课时通过 `Enrollment.countDocuments({ course, status: 'enrolled' })` 与 `course.maxStudents` 比对。注意：当前实现未使用事务或乐观锁，高并发下可能出现超卖，后续如需强一致可引入 MongoDB 事务或原子操作。

---

## 九、本地运行

1. 安装依赖：`npm install`
2. 复制 `.env.example` 为 `.env` 并填写 `MONGO_URI`、`JWT_SECRET`、`JWT_EXPIRE`、`PORT`。
3. 启动开发服务：`npm run dev`（nodemon 热重启）。
4. 生产启动：`npm start`。
5. 健康检查：`GET /api/v1/health`。

入口文件：[server.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/server.js) → [app.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/app.js)。

---

## 十、模块依赖关系总览

```
server.js
   └── app.js
        ├── config/db.js            (MongoDB 连接)
        ├── middleware/auth.js      (protect, authorize)
        ├── middleware/errorHandler.js (validate, errorHandler)
        └── routes/* (8 个)
             └── controllers/*
                  ├── models/* (6 个)
                  └── utils/
                       ├── queryHelper.js        (被 stats / timetable / schedule / scheduleConflicts 共用)
                       └── scheduleConflicts.js  (被 scheduleController 调用，依赖 queryHelper)
```

[queryHelper.js](file:///d:/code/ai-prompt/solo-20/repos/repo56/project56/utils/queryHelper.js) 是被引用最广的工具模块，统计、课表、排课、冲突检测四个业务模块均依赖其日期处理与查询构建能力。新增统计类接口时，优先复用其中的 `parseDateRange()`、`buildDateQuery()`、`buildTopListPipeline()` 等函数，避免重复造轮子。
