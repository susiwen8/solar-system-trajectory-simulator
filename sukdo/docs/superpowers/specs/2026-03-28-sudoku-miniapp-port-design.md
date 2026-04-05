# Sudoku Mini App Port Design

## Goal

在保留现有网页数独产品全部核心能力的前提下，新增两套原生实现：

- 微信原生小程序
- 支付宝原生小程序

两端都需要提供完整的游戏页与解题页，且共享同一套纯 JavaScript 数独引擎与状态逻辑，避免后续行为漂移。

## Assumptions

- 用户明确要求我自行决策，不进行提问，因此本设计将现有仓库行为视为唯一产品基线。
- 现有网页版本继续保留，原生小程序实现以新增目录的方式并存，不替换当前 Web 入口。
- “所有功能”按当前仓库真实行为定义，而不是按数独产品的一般想象定义。
- Web 端快捷键会在小程序端映射为常驻触控操作，不额外追求物理键盘支持。
- 不引入跨端框架，不使用 Taro、uni-app、React/Vue 小程序方案；微信端使用原生 `Page`/`wxml`/`wxss`/`wx` API，支付宝端使用原生 `Page`/`axml`/`acss`/`my` API。

## Current Product Baseline

### 游戏页

当前网页游戏页已经具备以下能力，双端都要等价迁移：

- 生成唯一解数独题目，支持 `easy` / `medium` / `hard` 三档难度。
- 9x9 盘面，区分题目给定数字、玩家正式填写数字、试填数字。
- 可选中格子，并根据选中格高亮同行、同列、同宫以及同值数字。
- 笔记模式：空格支持 1-9 多候选数字切换。
- 试填模式：临时填写数字时保留原有笔记，并记录试填顺序。
- 定位试错：跳转到最早填错的试填格，并高亮该格。
- 提示：优先给当前选中空格填入正确答案，否则回退到第一个可填空格。
- 清空当前格。
- 重置本局。
- 计时、提示次数统计、按难度记录最佳成绩。
- 自动保存当前游戏快照，重新进入后恢复。
- 完成判定与完成态提示。
- 从游戏页把“原题”带到独立解题页，而不是带当前填写中的盘面。

### 解题页

当前网页解题页已经具备以下能力，双端都要等价迁移：

- 独立解题入口，可从游戏页跳转进入。
- 9x9 输入盘面展示。
- 支持从相册上传一张数独图片，识别后导入 9x9 盘面。
- 实时冲突校验，冲突格高亮。
- 支持载入示例题。
- 支持从 URL 参数预载入一题，且预载入后不自动求解。
- 自动求解时区分四种结果：
  - 输入冲突
  - 无解
  - 多解
  - 唯一解
- 唯一解时直接在输入盘面显示完整答案，并列出求解步骤。
- 自动求解后提供“从头引导 / 上一步 / 下一步 / 最终答案”教学回放。
- 步骤文本区分 `single`、`guess`、`backtrack`。

### 核心逻辑

当前仓库已有且必须复用语义的逻辑：

- 盘面合法性判断
- 单元候选数计算
- 题目生成
- 唯一解判定
- 求解与步骤追踪
- 游戏状态快照/恢复

## Approaches Considered

### 1. 两端各自复制一套完整逻辑

分别在微信与支付宝目录中复制数独引擎、状态管理、页面逻辑。

优点：

- 各端目录最独立。
- 平台文件更“纯”。

缺点：

- 逻辑重复度极高。
- 任一端修 bug 都需要双改。
- 最容易出现题目生成、提示、解题结果不一致。

### 2. 在现有 Web 代码上硬做平台适配

尽量复用 `src/*.js`，把 DOM 层剥离为小程序数据层。

优点：

- 可以复用部分现有逻辑与文案。

缺点：

- 当前代码按浏览器 DOM 组织，直接迁移会把小程序页面控制器做得非常拧巴。
- Web 页面职责混合，强行适配只会留下大量平台分支。

### 3. 提取共享纯逻辑层，双端各自保留原生页面壳

把数独引擎、游戏状态、游戏/解题视图模型、存储键名、序列化逻辑抽成共享 CommonJS 模块；微信和支付宝分别保留原生页面文件、模板文件和平台 API 适配。

优点：

- 行为一致性最好。
- 页面层仍然是原生小程序写法，便于后续真机调试。
- 共享层可直接用 Node 测试，测试覆盖最容易做深。

缺点：

- 需要额外设计共享控制器边界。
- 初次搭建时目录会变多。

## Chosen Approach

采用方案 3：共享纯逻辑层 + 双端原生页面壳。

这既满足“原生微信/原生支付宝小程序”的交付要求，也能让题目生成、提示、试填追踪、求解器结果等关键行为只维护一套实现。页面层只负责：

- 事件绑定
- 调用平台存储 / 导航 API
- 将共享 view model 写入 `setData`

## Repository Shape

新增目录结构如下：

```text
scripts/
  sync-miniapp-shared.mjs
miniapps/
  shared/
    package.json
    sudoku.js
    game-state.js
    game-view.js
    game-controller.js
    solver-view.js
    solver-controller.js
    solver-image-import.js
    storage.js
    constants.js
  wechat/
    app.js
    app.json
    app.wxss
    shared/
      constants.js
      sudoku.js
      game-state.js
      game-view.js
      game-controller.js
      solver-view.js
      solver-controller.js
      solver-image-import.js
      storage.js
    pages/
      game/
        index.js
        index.json
        index.wxml
        index.wxss
      solver/
        index.js
        index.json
        index.wxml
        index.wxss
  alipay/
    app.js
    app.json
    app.acss
    shared/
      constants.js
      sudoku.js
      game-state.js
      game-view.js
      game-controller.js
      solver-view.js
      solver-controller.js
      solver-image-import.js
      storage.js
    pages/
      game/
        index.js
        index.json
        index.axml
        index.acss
      solver/
        index.js
        index.json
        index.axml
        index.acss
tests/
  miniapps/
    shared-sudoku.test.js
    shared-game-state.test.js
    shared-game-controller.test.js
    shared-solver-controller.test.js
    shared-solver-image-import.test.js
    wechat-files.test.js
    alipay-files.test.js
```

说明：`miniapps/shared` 仍然是共享逻辑的唯一源码目录；`miniapps/wechat/shared` 与 `miniapps/alipay/shared` 是通过同步脚本生成的运行时副本，用来满足原生小程序只能加载工程根目录内模块的约束。

## Architecture

### Shared Sudoku Engine

`miniapps/shared/sudoku.js` 负责：

- `cloneBoard`
- `parseBoardInput`
- `validateBoard`
- `isValidPlacement`
- `getCandidates`
- `solveBoard`
- `countSolutions`
- `analyzeBoard`
- `generatePuzzle`
- `serializeBoard`

它是双端一致性的核心来源，API 语义要与现有 `src/sudoku.js` 保持一致。

### Shared Game State

`miniapps/shared/game-state.js` 负责：

- 创建新局
- 选中格切换
- 笔记模式开关
- 试填模式开关
- 正式填数 / 清空
- 试填顺序记录
- 提示逻辑
- 定位最早错误试填
- 完成判定
- 快照创建与恢复

它不依赖任何平台 API，只消费纯对象。

### Shared Game View Model

`miniapps/shared/game-view.js` 把原始 state 转成小程序页面可直接 `setData` 的结构，包括：

- 盘面 cell 列表与 class token
- 元信息文案
- 状态 pill
- 难度按钮状态
- 当前模式文案
- 原题序列化字符串

### Shared Game Controller

`miniapps/shared/game-controller.js` 负责把“状态变更 + 存储/导航副作用”封装成一套可测控制器接口。它不直接调用 `wx` 或 `my`，而是依赖注入平台适配器：

- `loadSession()`
- `saveSession(snapshot)`
- `loadBestTimes()`
- `saveBestTimes(bestTimes)`
- `navigateToSolver(puzzleString)`
- `now()`
- `setTimer(handler)`
- `clearTimer(timerId)`

### Shared Solver View / Controller

`miniapps/shared/solver-view.js` 与 `miniapps/shared/solver-controller.js` 分别负责：

- 输入盘面 cell 映射
- 用户消息文案
- 步骤格式化
- 逐步引导回放状态
- 图片识别导入
- 查询参数预加载
- 求解动作与结果管理

### Platform Shells

微信与支付宝两端页面壳只做这些事：

- 在 `onLoad` 中创建控制器。
- 在 `onShow` / `onHide` / `onUnload` 管理计时器生命周期。
- 在用户点击后调用共享控制器方法。
- 把控制器返回的 view model 传给 `setData`。
- 使用各自平台 API 实现存储和页面跳转。

## Feature Mapping For Mini Programs

### 游戏页交互

- 保留“点击格子 + 点击数字盘”主交互。
- 顶部保留计时、最佳、提示次数、当前难度。
- 保留笔记模式、试填模式、定位试错、提示、清空、重置本局。
- 保留难度切换。
- 保留已完成态与文案。
- 保留“把这题带去解题器”动作，使用页面跳转 query 串传原题。

### 键盘快捷键的端差异

小程序端不再实现 Web 键盘快捷键本身，但必须保证所有快捷键对应能力都存在明确的触控入口：

- `1-9` -> 数字盘按钮
- `N` -> 笔记模式按钮
- `G` -> 试填模式按钮
- `L` -> 定位试错按钮
- `H` -> 提示按钮
- `Delete` -> 清空按钮
- 方向键 -> 点击目标格切换选中

### 解题页交互

- 首屏只保留解题相关内容：必要操作、题目盘面、教学引导、步骤列表。
- 去掉欢迎文案、统计卡片等与当前解题动作无关的信息。
- 输入盘面只负责展示当前题目与求解答案，不再提供数字键盘。
- 页面提供“上传图片”按钮，调用原生相册选择与隐藏 canvas 完成图像识别。
- 导入后即时校验并高亮冲突格。
- 保留“自动求解 / 载入示例”。
- 唯一解时直接把完整答案渲染回输入盘面，并保留步骤列表。
- 自动求解后默认停在最终答案，同时允许用户从第一步开始逐步回放。
- 回放时高亮当前步骤对应格子，并展示“为什么这一步这样做”的教学文案。
- 保留从游戏页带题进入时的预载入能力，且不自动求解。

## Data Flow

### 游戏页

1. 页面加载时优先从本地存储恢复会话。
2. 如果没有有效快照，则按默认难度创建新局。
3. 页面交互调用共享 controller。
4. controller 更新共享 state。
5. controller 生成 view model 并触发持久化。
6. 需要跳转解题页时，把 `state.puzzle` 序列化后放入 query。

### 解题页

1. 页面加载时读取 query 中的 `puzzle`。
2. 如果 query 有效，则初始化输入盘面。
3. 用户上传图片后，通过隐藏 canvas 提取像素，并交给共享识别模块恢复 9x9 盘面。
4. controller 在导入后立即重算校验结果。
5. 用户点击求解时，调用共享 `analyzeBoard`。
6. controller 基于求解步骤构建可回放的引导时间线。
7. 根据结果展示错误信息，并在输入盘面与步骤列表中反映唯一解和当前引导步骤。

## Persistence Strategy

每个平台都各自维护以下本地存储键：

- `sukdo.mini.session`
- `sukdo.mini.best-times`

存储格式与 Web 版快照结构保持同构，便于逻辑理解和测试，但不要求与 Web 共用存储空间。

## Error Handling

- 无法恢复的会话快照：直接回退到新局。
- 图片中无法识别出数独网格或数字：显示识别失败提示，不污染当前结果。
- query 带题非法：页面正常打开，提示带题失败。
- 题目冲突：标红冲突格并阻止继续当作唯一解处理。
- 无解 / 多解：给出明确消息，不显示误导性的唯一解结果。

## Testing Strategy

测试必须覆盖“共享逻辑深测 + 页面壳结构验收”两层。

### 共享逻辑测试

- 题目生成、唯一解判断、求解步骤、冲突检测。
- 笔记模式、试填模式、提示、定位试错、完成判定。
- 会话快照与恢复。
- 游戏 controller 的存储、副作用和 solver 跳转串生成。
- 解题 controller 的导入、预加载、状态迁移与求解结果。
- 图片识别模块对清晰数独图的网格恢复、数字识别与异常兜底。
- 解题引导模式对步骤回放、当前高亮和前后切换的正确性。

### 页面壳测试

- 微信小程序页面文件存在且声明了所需页面。
- 支付宝小程序页面文件存在且声明了所需页面。
- 游戏页模板包含盘面、数字盘、难度操作、模式操作、状态区、解题器跳转入口。
- 解题页模板包含输入盘面、上传图片入口、隐藏 canvas、步骤列表和教学引导控制区。
- 页面脚本能 require 共享模块并导出合法 `Page(...)` 配置。

### 手工验证清单

- 微信开发者工具中完成一整局，关闭再进入后进度仍在。
- 微信端从游戏页带题进入解题页，确认带的是原题不是当前盘面。
- 微信端试填后能定位最早错误试填。
- 支付宝开发者工具中完成相同流程。
- 两端对同一题目的求解结果、步骤数量、冲突提示保持一致。

## Non-Goals

- 不做联网同步、账号体系、排行榜。
- 不将现有网页版本删除或重写为跨端方案。
- 不为小程序额外设计新玩法或新求解策略。
