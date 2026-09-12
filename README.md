# 种豌豆 · 人物模拟实验室（Static Mock）

这是人物模拟测试器的独立公开静态版本，只用于 Mock 规则测试。

- 完全在浏览器中运行，不依赖 Python 后端或真实 AI。
- 不包含 API Key、私有游戏设计文档或人物 JSON 存档。
- 数据只保存在当前浏览器的 `localStorage`，不同设备不会自动同步。
- 可以导出/导入完整测试存档，也可以分别导出测试日志和候选事件。

## GitHub Pages

本仓库从 `main` branch 的根目录 `/` 发布，使用 GitHub Pages 的 **Deploy from a branch** 模式。

访问地址：

https://wangruiqi710-dotcom.github.io/zhongwandou-character-sim/

## 文件

```text
index.html
app.js
styles.css
README.md
.nojekyll
```

`index.html` 只通过相对路径加载 `./styles.css` 和 `./app.js`。
