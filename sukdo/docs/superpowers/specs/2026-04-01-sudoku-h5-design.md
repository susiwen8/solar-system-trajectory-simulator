# Sudoku H5 Design

## Goal

在现有仓库中新增一套独立的 H5 数独实现：

- 提供独立的 H5 游戏页
- 提供独立的 H5 解题页
- 底层优先复用 `miniapps/shared` 中已经存在的小程序共享控制器、视图模型和数独逻辑
- 保留当前桌面网页版与原生小程序版，不做替换

本次新增的 H5 版本应当是移动端优先、可直接通过静态服务器访问的浏览器页面。

## Assumptions

- 用户明确要求“按我的想法直接实现，不要继续提问”，因此本文将直接固定设计并进入实现。
- H5 范围包含游戏页和解题页两部分。
- H5 解题页不包含图片识别导入，只保留手填、粘贴导入、自动求解和步骤回放。
- H5 页面视觉和交互优先靠近现有微信小程序页，而不是桌面网页双栏布局。
- 仓库继续保持零依赖静态运行体验，不引入新的前端构建工具。

## Current Baseline

### 当前网页版

当前仓库已经有一套浏览器数独页：

- `index.html` + `src/main.js`
- `solver.html` + `src/solver-main.js`

这套页面偏桌面布局，直接操作 DOM，使用 `src/*.js` 中的 ESM 逻辑。

### 当前小程序版

项目已经有微信 / 支付宝两套原生小程序壳：

- `miniapps/wechat`
- `miniapps/alipay`

两端共享的逻辑位于：

- `miniapps/shared/game-controller.js`
- `miniapps/shared/game-view.js`
- `miniapps/shared/solver-controller.js`
- `miniapps/shared/solver-view.js`
- `miniapps/shared/game-state.js`
- `miniapps/shared/sudoku.js`
- `miniapps/shared/new-game-flow.js`

这层已经把“小程序页面壳”和“数独业务状态”拆开，具备很适合 H5 复用的边界。

## Approaches Considered

### 1. 延续桌面网页逻辑，单独做一套移动样式

优点：

- 实现速度快
- 可以直接复用 `src/main.js` 与 `src/solver-main.js`

缺点：

- 与“基于小程序共享层做 H5”不一致
- 会继续维护两套 Web 页面逻辑来源
- 后续和小程序行为校准成本更高

### 2. 重构一套新的跨端 Core，再让小程序和 H5 一起切换

优点：

- 长期结构最干净
- 未来再扩其他端更容易

缺点：

- 改动面过大
- 会把这次“新增 H5”变成一次共享层重构
- 风险集中在已稳定的小程序实现上

### 3. 直接复用 `miniapps/shared`，为浏览器补一层 CommonJS 运行时和 H5 页面壳

优点：

- 最贴合当前仓库真实结构
- H5 与小程序共享 controller / view model，行为一致性最好
- 不需要引入新的构建工具

缺点：

- 浏览器端需要额外实现一个很小的 CommonJS 加载层
- H5 页面仍然要单独负责 DOM 渲染和事件绑定

## Chosen Approach

采用方案 3：

- 保持 `miniapps/shared` 作为 H5 与小程序共享逻辑的唯一来源
- 在浏览器端新增一个轻量的 CommonJS 运行时，通过 `fetch + Function` 方式从同源静态文件加载共享模块
- 新增独立的 H5 页面和移动端样式，不替换当前桌面网页

## Repository Shape

新增或修改的主要结构如下：

```text
h5/
  index.html
  solver.html
  styles.css
src/
  h5/
    commonjs-runtime.js
    platform.js
    dom-helpers.js
    game-page.js
    solver-page.js
docs/superpowers/specs/
  2026-04-01-sudoku-h5-design.md
docs/superpowers/plans/
  2026-04-01-sudoku-h5.md
tests/
  h5-pages.test.js
  h5-runtime.test.js
  h5-dom-helpers.test.js
README.md
index.html
solver.html
```

说明：

- `h5/` 目录承载新的独立 H5 页面。
- `src/h5/commonjs-runtime.js` 负责在浏览器中加载 `miniapps/shared/*.js`。
- `src/h5/platform.js` 负责存储、导航、query 参数、计时器等浏览器平台能力。
- `src/h5/dom-helpers.js` 负责把共享 view model 转成 H5 DOM 标记，尽量把复杂的字符串拼装从页面入口移走，便于测试。
- `src/h5/game-page.js` 与 `src/h5/solver-page.js` 负责事件绑定与页面更新。

## Architecture

### Browser CommonJS Runtime

浏览器端运行时负责：

- 通过 URL 加载 `miniapps/shared/*.js` 源文件
- 解析相对 `require('./x.js')`
- 维护模块缓存，避免重复执行
- 暴露 `loadCommonJsModule(url)` 给 H5 页面入口使用

边界上只支持当前仓库里需要的 CommonJS 用法：

- `require('./relative.js')`
- `module.exports = {}`
- `exports.foo = ...`

不尝试做通用 npm 级别模块系统。

### H5 Game Page

H5 游戏页基于 `createGameController` 驱动：

- `localStorage` 保存会话和最佳成绩
- `setInterval` 驱动计时
- 盘面、数字盘、按钮、弹窗都由 controller 返回的数据渲染
- “去解题页”继续传原题 puzzle，而不是当前盘面

页面交互保留小程序语义：

- 难度切换
- 笔记模式
- 试填模式
- 定位试错
- 提示
- 清空
- 重置本局
- 换一局确认弹窗

### H5 Solver Page

H5 解题页基于 `createSolverController` 驱动：

- 手动点选格子并填数
- 粘贴 81 格文本导入
- 自动求解
- 唯一解步骤回放
- 点击步骤跳转对应盘面
- 载入示例题
- 支持从 query 参数带题进入

不实现图片识别，不显示上传图片入口。

### Browser Platform Adapters

浏览器平台能力适配需要处理：

- H5 专用 `localStorage` key，避免覆盖桌面网页版和小程序版数据
- `window.location.href` 跳转到 `./solver.html?puzzle=...`
- `URLSearchParams` 读取 query 参数
- 页面生命周期中的计时器启动/停止

## UI And Layout

### 游戏页

视觉上靠近微信小程序：

- 顶部计时/最佳/提示数据卡
- 中间大棋盘卡片
- 下方难度切换与数字盘
- 操作按钮使用胶囊式大触达区
- 状态提示放在面板底部

同时补齐浏览器可用性：

- 使用 `button` 元素保证可点击与可访问性
- 保留 `aria-label`
- 在手机窄屏上单列布局，桌面上也保持移动端视觉比例，不回到原桌面双栏设计

### 解题页

布局同样采取卡片堆叠：

- 顶部返回游戏和标题
- 盘面输入棋盘
- 求解控制区
- 文本导入区
- 步骤回放区

步骤区默认纵向滚动，活动步骤高亮，并让“当前步骤说明”固定显示在上方。

## Error Handling

- 共享模块加载失败时，H5 页面显示明显错误信息，不静默失败。
- `query` 中带入的题目无效时，解题页复用共享 controller 的失败文案。
- 文本导入解析失败时，保留原有输入文本并展示错误提示。
- `localStorage` 读写失败时降级为内存态，不阻塞页面主流程。

## Testing Strategy

测试分为三层：

### 1. 文件与页面壳测试

验证：

- `h5/index.html` 和 `h5/solver.html` 存在
- 关键锚点 ID 存在
- 入口脚本和样式表引用正确

### 2. 运行时与渲染帮助函数测试

验证：

- 浏览器 CommonJS 运行时可以加载 `miniapps/shared/game-controller.js`
- DOM helper 可以正确输出小程序风格的 cell / keypad / steps 标记
- 新局弹窗和状态区域的标记符合预期

### 3. 既有共享逻辑回归

继续依赖已有 `tests/miniapps/shared-*.test.js` 作为核心业务回归保障。H5 自己不重复测试 controller 内部算法，只测试：

- 浏览器适配是否正确接线
- H5 页面是否消费了共享数据结构

## Risks And Mitigations

### 风险 1：浏览器运行时加载 CommonJS 的兼容性

缓解：

- 只支持仓库当前所需的最小 CommonJS 子集
- 用独立测试锁定模块缓存、相对路径解析和导出行为

### 风险 2：H5 页面和小程序 UI 语义漂移

缓解：

- 文案、状态值、步骤数据都直接复用 `miniapps/shared` 的输出
- DOM helper 尽量只做“展示映射”，不新增业务判断

### 风险 3：多端存储互相污染

缓解：

- 为 H5 单独设置存档 key 和最佳成绩 key
- 不复用桌面网页版 `sukdo.session`
- 不复用小程序版 `sukdo.mini.session`
