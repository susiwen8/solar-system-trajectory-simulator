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

自动解题页：

```text
http://localhost:4173/solver.html
```

如果你只是想看代码逻辑，入口文件在：

- `index.html`
- `styles.css`
- `src/main.js`
- `src/game-state.js`
- `src/sudoku.js`
- `src/solver-main.js`
- `src/solver-view.js`

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
