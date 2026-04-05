# Sukdo

一个零依赖运行的本地数独游戏，支持：

- 简单 / 中等 / 困难三档难度
- 键盘和鼠标双操作
- 笔记模式、提示、重置
- 计时、最佳成绩记录
- 自动保存当前进度
- 独立的自动解题页面，支持手填、粘贴导入、唯一解判断和步骤展开

## 运行

直接启动一个本地静态服务器：

```bash
npm start
```

然后在浏览器打开：

```text
http://localhost:4173
```

游戏主页：

```text
http://localhost:4173/index.html
```

H5 游戏页：

```text
http://localhost:4173/h5/index.html
```

自动解题页：

```text
http://localhost:4173/solver.html
```

H5 解题页：

```text
http://localhost:4173/h5/solver.html
```

你也可以在游戏主页点击“把这题带去解题器”，把当前局的原题直接带到 solver 页面继续分析。

如果你只是想看代码逻辑，入口文件在：

- `index.html`
- `styles.css`
- `src/main.js`
- `src/game-state.js`
- `src/sudoku.js`
- `src/solver-main.js`
- `src/solver-view.js`

H5 版本会直接复用 `miniapps/shared` 中给原生小程序准备的共享 controller / view model / 数独引擎逻辑，再由 `src/h5` 里的浏览器适配层负责页面渲染、存储和导航。

## 原生小程序实现

项目现在额外包含两套原生小程序版本：

- 微信原生小程序：`miniapps/wechat`
- 支付宝原生小程序：`miniapps/alipay`

两端共享的数独引擎、游戏状态、控制器和视图模型都在：

- `miniapps/shared`

为了适配微信 / 支付宝开发工具只打包各自工程根目录内文件的限制，运行时副本会同步到：

- `miniapps/wechat/shared`
- `miniapps/alipay/shared`

当 `miniapps/shared` 发生变更时，可执行：

```bash
npm run sync:miniapps:shared
```

其中：

- 游戏页都支持难度切换、笔记、试填、定位试错、提示、计时、最佳成绩和本地进度恢复
- 解题页都支持上传图片识别数独、冲突校验、唯一解判断，并直接在输入盘面展示答案和步骤
- 游戏页到解题页的带题跳转，传递的都是原题而不是当前盘面

自动化测试也已经覆盖到这两套原生实现对应的共享逻辑与页面文件结构。

## 测试

```bash
npm test
```

## 快捷键

- `1-9`: 填入数字
- `Delete` / `Backspace` / `0`: 清空当前格
- `N`: 切换笔记模式
- `H`: 使用提示
- `R`: 重置当前局
- `Arrow Keys`: 移动选中格子
