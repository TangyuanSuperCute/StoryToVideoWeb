import { $, showNotification, safeJsonParse } from './utils.js';

export async function disassembleStoryWithAI(storyText, apiKey) {
  const btn = $('#startDisassemble');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在拆解...';
  const prompt = `
你是一名"小说结构抽取器"。接收一段很长的小说原文后，将其解析为【故事→章节→段落（PSU：场景级叙事单元）】三级结构并输出一个**单一 JSON 对象**。除 JSON 外不要输出任何说明、前缀或代码块标记。

# 总目标与全局约束
- 若原文已显式分章（如"第一章""Chapter 1""序/楔子/尾声/番外"等），**按原章划分并保留原章名**；为这些章编号时，\`chapter_index\` 仍从 **0** 开始。
- 若原文未显式分章，仅在满足"自动分章触发条件"时才切分；否则**整篇视为 1 章**。
- **索引一律从 0 开始**：\`chapter_index\`、\`paragraph_index\` 都是 0,1,2,… 连续递增，不跳号。

# 自动分章触发条件（缺省不开启）
满足任一条件才自动分章：
1) 全文字数 ≥ 6000；或
2) 原始换行段（微单元）数量 ≥ 25；或
3) 存在 ≥ 2 个**强转场信号**（显著的时间/地点/视角切换，或显式分隔符如"***""——"）。
> 若不满足，上述文本**输出为 1 章**。

# 章节体量与均衡（防"碎章"）
- 建议章节数：\`N = clamp(round(总字数 / 8000), 1, 8)\`；最终章节数必须 1 ≤ N ≤ 8。
- **每章体量下限**：≥ 3000 字 *或* ≥ 3 个 PSU（二者满足其一）。
- 禁止"薄章"：< 1000 字 且 < 2 个 PSU（序/楔子/尾声可豁免）。
- **均衡**：同一文本中，章节"最长字数/最短字数" ≤ 4:1；超出则向相邻章合并或回退边界，直至满足。

# 分段规则（PSU：场景级叙事单元）
**目标**：每章 **优先** 5–8 个 PSU（**软上限 8**）。仅在该章**明显超长**（≥12000 字）且内含多条并行叙事线时可达 9–10，但应优先合并将其压回 ≤8。
**PSU 定义**：能独立承载一个**小场景/叙事节拍**（进入→推进→收束），而不是作文式换行块。

## 可调体量阈值（默认）
- 单段目标体量：**200–1000** 个中文字符（或 **3–15** 句）。
- 极小段判定：**<120** 字 且 **<3** 句（"转场提示句"可豁免）。
- 对话合并最小规模：同一时空/话题下，**≥4** 句对话合并为 1 段。

## 段界信号（由强到弱）
1) **强转场**：时间跳跃（翌日/数小时后…）、地点切换（室外→室内/城市→乡间）、叙述视角突变（我→他/她/多人）、情节阶段切换（任务完成/冲突落幕）。
2) **中强**：主要人物集合显著变化（关键角色进出场）、叙事目标/话题改变、长描写后的显著停顿。
3) **弱信号**（仅微调）：气氛/语调转折、叙述方式切换（描写↔对白密集）。

## 对话文本的处理
- 连续对话行（哪怕"一句一行"）只要**时间/地点/话题一致**，**必须合并为同一 PSU**，直到出现话题或场景转换。
- 旁白/动作插句（"他沉默。""她看向窗外。"）若仍处同一话题，**并入当前 PSU**，不单列。

## 切分流程（强约束）
1) **收集微单元**：以原始换行/缩进形成"微单元"，不视为最终段。
2) **语义聚合**：按"时间—地点—人物—目标/话题"四要素，自左向右**贪心合并**微单元，直至达到 PSU **最小体量**（≥200字或≥3句），且未触发强转场。
3) **边界落点**：遇到强/中强信号**且**当前 PSU 已达最小体量→落段；否则继续吸纳相邻微单元。
4) **长段切分**：单段 >1000 字或 >15 句时，优先在**中强信号**处切分；若无，则在句末标点处就近切分，保持语义完整；**不得把一句话切成两段**。
5) **对话合并**：同一场景下的往返对话按**一个交流节拍**计为 1 PSU；仅当话题/立场发生实质转折时再分段。
6) **数量校准**：若本章 PSU 数 <5，可在最长段内部依据"次级冲突/小目标"再切 1–2 段；若 >8，执行"薄段回收与合并"。

## 薄段回收与合并
- **薄段**：<120 字 且 <3 句，且不属于"转场提示句"。
- **回收顺序**：优先与**后继**段合并；若语义不合，再与**前一**段合并。合并后重检体量与连贯性。
- **微跳剪容忍**：承担过渡/镜头剪接而三要素（时/地/人）未变时，**并入相邻段**。

## 章内均衡校验（段落级）
- 每章 5–8 段为宜；若 >8，按"同场景/同话题"**就近合并**，先并字数最少的相邻对；若 <3，则在**最长段**内按"次级冲突/话题转折"温和切 1–2 段。
- 同章内"最长段/最短段" ≤ **6:1**；超出则对最长段再切或将薄段并入最短段。

- 命名与摘要规则
- \`chapter_title\`：原章名或自拟（≤14字，主题+线索词）。
- \`paragraph_title\`：精炼标题（≤16字/≤10英文词），避免剧透。
- \`summary\`：1–3 句，≤120 字，只基于该段文本，不引入外部推断；包含关键人物与动作线索。
- 输出语言遵循原文主导语言（多语混排时以该段主导语言为准）。

- start10 / end10 提取
- 先 trim 段落首尾空白与分隔符（含全角空格）。
- 按"字符"计数（非字节），包含标点与引号；不足 10 则返回全段。
- 仅从该 PSU 正文中截取，不含章名、段号或分隔符。

- 故事 ID 与标题
- \`story.title\`：若原文显式给出书名/标题（如封面、首行、<TITLE>）则沿用；否则据文本主题自拟（≤20字）。
- \`story.id\`：将标题转小写、移除非字母数字，空格改连字符；若结果为空则用 "untitled"。

# 输出要求（唯一的大 JSON；UTF-8；字段齐全；无多余字段/注释/尾随逗号）
{
  "story": {
    "id": "<string>",
    "title": "<string>",
    "original_text": "<string>",
    "chapters": [
      {
        "chapter_index": <int>,
        "chapter_title": "<string>",
        "paragraphs": [
          {
            "paragraph_index": <int>,
            "paragraph_title": "<string>",
            "summary": "<string>",
            "start10": "<string>",
            "end10": "<string>",
            "raw_text": "<string>"
          }
        ]
      }
    ]
  }
}

# 质量与一致性自检（输出前必做）
- 仅输出**单个 JSON 对象**，不包含解释或额外文本。
- \`chapters\` 与每个 \`paragraphs\` 数组**不可为空**。
- 所有索引从 **0** 连续递增，无跳号。
- 每章段落数**尽量 ≤8**；若超过，必须先执行"薄段回收与合并"，仅在该章极长且多线叙事时才允许 9–10。

故事原文如下:
---
${storyText}
---
`;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tangyuansupercute.github.io/StoryToVideoWeb/",
        "X-Title": "MaoDie Nebula Story Studio",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro-preview",
        messages: [ { role: 'user', content: prompt } ],
        response_format: { type: 'json_object' }
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
    }
    const result = await response.json();
    const jsonString = result.choices[0].message.content;
    const [parsedJson, parseErr] = safeJsonParse(jsonString);
    if (parseErr) throw new Error('Failed to parse JSON from AI response.');
    parsedJson.story.original_text = storyText;
    localStorage.setItem('aiStory', JSON.stringify(parsedJson));
    window.location.href = 'editor.html';
  } catch (error) {
    showNotification(`拆解失败: ${error.message}`, 'error');
    console.error('AI Disassembly Error:', error);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '启动 AI 拆解';
  }
}


