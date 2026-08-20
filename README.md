# Reaction Lab · 反应测试中心

一个专注于人类反应速度测试的开源项目集合，包含多种反应测试模式，适用于游戏玩家训练、心理学实验、日常反应力自测等场景。

## 📁 项目结构

```
reaction-lab/
├── index.html              # 导航主页 — 所有测试项目的入口
├── README.md               # 项目说明文档
├── CSS/
│   └── style.css          # 全局共用样式表
├── js/                    # JavaScript 脚本目录
│   ├── basic.js           # 基础反应测试逻辑
│   ├── F1.js              # F1 发车反应测试逻辑
│   ├── nogo.js            # Go/No-Go 抑制反应测试逻辑
│   ├── balls.js           # 定位反应测试逻辑
│   ├── HSline.js          # 头线定位测试逻辑
│   ├── arrow.js           # 箭头反应测试逻辑
│   ├── recognize.js       # 辨别反应测试逻辑
│   └── calcul.js          # 运算反应测试逻辑
├── img/                   # 图片资源目录
│   ├── react.png          # 网站 favicon
│   └── logo.png           # F1 测试 logo
├── basic/                 # 基础反应测试
│   └── index.html
├── F1/                    # F1 发车反应测试
│   └── index.html
├── nogo/                  # Go/No-Go 抑制反应测试
│   └── index.html
├── balls/                 # 定位反应测试
│   └── index.html
├── HSline/                # 头线定位测试（FPS 训练）
│   └── index.html
├── arrow/                 # 箭头方向反应测试
│   └── index.html
├── recognize/             # 辨别反应测试
│   └── index.html
├── calcul/                # 运算反应测试（双线程）
│   └── index.html
└── contact/               # 敬请期待（占位页）
    └── index.html
```

## 🧪 测试项目说明

| 项目 | 路径 | 说明 |
|------|------|------|
| 基础反应测试 | `basic/` | 经典绿灯反应测试，测 5 次取平均 |
| F1 发车反应测试 | `F1/` | 模拟 F1 五盏红灯→绿灯发车信号 |
| 抑制反应测试 | `nogo/` | GO/NO-GO 范式，训练冲动抑制 |
| 定位反应测试 | `balls/` | 在多个符号中快速识别唯一目标 |
| 头线定位测试 | `HSline/` | 模拟 FPS 游戏头线定位点击 |
| 箭头反应测试 | `arrow/` | 方向键/WASD 快速反应 |
| 辨别反应测试 | `recognize/` | 按颜色+形状辨别目标 |
| 运算反应测试 | `calcul/` | 计算+反应双线程并行测试 |


## 🛠️ 技术栈

- 纯原生 JavaScript（无框架依赖）
- CSS3 动画 + CSS 变量
- HTML5 localStorage 本地存档
- Web Audio API（F1 声音提示）
- 支持鼠标 + 触控 + 键盘多端操作

## 📝 开发规范

- 所有子项目共享 `CSS/style.css` 基础样式
- 每个子项目独立 `index.html` + 对应 `js/*.js`
- 新增测试项目时：
  1. 在 `js/` 下创建对应 JS 文件
  2. 新建子文件夹并创建 `index.html`
  3. 在导航页 `index.html` 添加入口卡片
  4. 在 README 表格中补充说明

## 📄 License

MIT License
