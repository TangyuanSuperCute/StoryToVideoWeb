# MaoDie Nebula (MDN) 故事创作与分镜预览工具

MaoDie Nebula (MDN) 是一个专为编剧、导演和内容创作者设计的Web工具。它允许用户导入结构化的故事JSON文件，并以直观、高效的方式浏览、编辑和预览每一个分镜的详细信息。

**在线访问地址:** [https://tangyuansupercute.github.io/StoryToVideoWeb/](https://tangyuansupercute.github.io/StoryToVideoWeb/)

## 🌟 核心功能

- **结构化故事浏览**: 以清晰的树状目录展示故事的章节、段落和分镜，方便快速导航。
- **分镜详情预览**: 选中任意分镜，即可在主编辑区查看其核心信息，包括镜头意图、改编文本、视觉元素（角色、地点、道具、视觉要点）和音频元素（旁白、对话、音效）。
- **图片面板管理**: 为每个分镜提供了独立的画板区域，支持拖拽或上传图片，直观地管理分镜的视觉参考。
- **全局元信息统计**: 在侧边栏实时统计整个故事中出现的关键实体（人物、地点、道具），帮助创作者把握全局。
- **一键生成分节**: 针对段落调用 OpenRouter，根据完整规范 prompt 自动生成结构化 `sections`。
- **全局主体抽取（可选）**: 通过 `extractGlobalEntitiesWithAI` 抽取全文的人物/物品/地点三类主体，便于资产管理与绘图。
- **响应式布局**: 界面适配不同尺寸的屏幕，方便在桌面或平板设备上使用。
- **JSON导入与导出**: 支持导入特定格式的JSON文件来加载整个故事，也提供了示例格式方便用户编写自己的故事脚本。

## 📁 项目结构（已模块化）

```
StoryToVideoWeb/
├── index.html          # 首页（AI 拆解入口）
├── editor.html         # 编辑器页
├── styles.css          # 样式文件
├── main.js             # 入口与初始化（仅桥接与事件绑定）
├── story.json          # 示例故事数据
├── src/
│   ├── state.js        # 全局状态（story、选中项等）
│   ├── utils.js        # DOM/通知/JSON 工具
│   ├── storyImport.js  # JSON 类型判定与导入实现
│   ├── treeRender.js   # 目录树渲染、实体统计、事件委托
│   ├── editorView.js   # 分镜选中、右侧信息渲染、高亮动画
│   ├── panels.js       # 画布/图片上传与展示
│   ├── fileOps.js      # 打开/保存/清空 故事
│   ├── metadata.js     # 标题与命名编辑（story/chapter/paragraph）
│   └── ai.js           # 首页拆解与分段生成（OpenRouter）
└── README.md
```

## 🚀 如何使用（本地开发）

1. 启动本地静态服务器（建议）：
   - VSCode 安装 Live Server 扩展，右键 `index.html` → Open with Live Server；或
   - 终端执行：`npx http-server -p 5500 -c-1`
2. 打开 `http://127.0.0.1:5500/` 访问首页。
3. 首页操作：
   - 粘贴故事原文 + API Key，点击“启动 AI 拆解”；或
   - 直接点击“直接编辑”进入编辑器页。
4. 编辑器页：
   - 左侧树：章节/段落/分节（支持搜索、事件委托按钮：新增/删除/导入/生成）
   - 中部：分镜信息 + 画布（拖拽图片或点击上传）
   - 右侧：全局实体统计（选择分镜后自动高亮并置顶，带动画）
 - 右上角：可扩展的 AI 工具（如“全局主体抽取”）

## 🎨 JSON 数据结构简介

本工具需要特定结构的JSON文件。核心结构如下：

```json
{
  "story": {
    "chapters": [
      {
        "paragraphs": [
          {
            "sections": [
              {
                "section_id": "B01",
                "adapted_text": "该分镜的改编文本...",
                "intent": "该分镜的创作意图...",
                "visuals": {
                  "location": "地点",
                  "characters": ["角色1", "角色2"],
                  "props": ["道具1"],
                  "visual_message": ["视觉要点1"]
                },
                "audio": {
                  "narration": "旁白内容...",
                  "dialogues": [{"character": "角色名", "line": "对话内容"}],
                  "sfx": ["音效1", "音效2"]
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```
您可以在 `story.json` 文件中查看完整的示例结构。

## 🛠️ 技术栈与实现要点

- **HTML5/CSS3/JS(ESM)**：原生 ES Module，入口只做初始化与桥接
- **事件委托**：树区域按钮通过 `data-action` 统一分发，避免大量内联 `onclick`
- **模块划分**：渲染、编辑、文件操作、AI 调用等职责清晰可维护
- **提示与动画**：轻量通知与列表动画（右侧实体高亮与置顶）
 - **完整 prompt**：拆解与分节 prompt 已完整复原，便于稳定输出结构

> 注意：直接 file:// 打开 ES Module 会被浏览器限制，请使用本地 http 服务器运行。

## 💡 未来可拓展方向

- [ ] 以事件委托彻底替换掉剩余的 window 挂载（已基本完成）
- [ ] 引入打包工具（Vite）与路径别名，支持生产构建
- [ ] 引入基础测试（数据导入/渲染）与 E2E（核心流程）
- [ ] 图片画布的多图排序与删除
- [ ] 移动端交互优化

---

**开始您的故事创作之旅吧！** 🎉
