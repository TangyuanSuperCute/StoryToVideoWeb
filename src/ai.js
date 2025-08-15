import { $, showNotification, safeJsonParse } from './utils.js';
import { state } from './state.js';
import { renderTree as renderTreeMod } from './treeRender.js';

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
    // 并行：结构拆解 + 全局主体抽取，二者都完成后再进入编辑页
    const disassemblePromise = (async () => {
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
      return parsedJson;
    })();

    const entitiesPromise = extractGlobalEntitiesWithAI(storyText, apiKey);

    const [parsedJson, globalEntities] = await Promise.all([disassemblePromise, entitiesPromise]);

    parsedJson.story.original_text = storyText;
    parsedJson.story.global_entities = globalEntities;

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


// ============ 段落文本提取（局部工具） ============
function findParagraphText(fullText, start, end) {
  if (!fullText || !start || !end) return null;
  let best = null;
  let searchFrom = 0;
  while (true) {
    const s = fullText.indexOf(start, searchFrom);
    if (s === -1) break;
    const e = fullText.indexOf(end, s + start.length);
    if (e !== -1) {
      const candidate = fullText.substring(s, e + end.length);
      if (!best || candidate.length < best.length) best = candidate;
    }
    searchFrom = s + 1;
  }
  if (best) return best;
  // 尝试宽松匹配：使用前缀片段进行定位
  const sHint = start.slice(0, Math.max(4, Math.min(8, Math.floor(start.length / 2))));
  const eHint = end.slice(0, Math.max(4, Math.min(8, Math.floor(end.length / 2))));
  searchFrom = 0;
  while (true) {
    const s = fullText.indexOf(sHint, searchFrom);
    if (s === -1) break;
    const e = fullText.indexOf(eHint, s + sHint.length);
    if (e !== -1) {
      const approx = fullText.substring(s, Math.min(fullText.length, e + end.length));
      if (!best || approx.length < best.length) best = approx;
    }
    searchFrom = s + 1;
  }
  return best;
}

// ============ 段落级 Section 生成 ============
export async function generateSectionsForParagraph(event, cIdx, pIdx) {
  const apiKey = localStorage.getItem('openRouterApiKey') || prompt('Please enter your OpenRouter API Key:');
  if (!apiKey) {
    showNotification('API Key is required to generate sections.', 'error');
    return;
  }
  localStorage.setItem('openRouterApiKey', apiKey);

  const chapter = state.story.chapters[cIdx];
  const paragraph = chapter?.paragraphs[pIdx];

  const fullStoryText = state.story.meta.original_text;
  const paragraphText = findParagraphText(fullStoryText, paragraph.start10, paragraph.end10);

  if (!paragraph || !paragraphText) {
    showNotification('Paragraph data or raw text is missing or could not be found.', 'error');
    return;
  }

  // 在生成新内容前，清空旧的sections
  paragraph.sections = [];

  const paragraphNode = document.querySelector(`.node.with-actions[data-chapter-idx='${cIdx}'][data-paragraph-idx='${pIdx}']`);
  if (paragraphNode) {
    paragraphNode.classList.add('generating');
  }
  state.generatingParagraphs = state.generatingParagraphs || [];
  const genKey = `${cIdx}-${pIdx}`;
  if (!state.generatingParagraphs.includes(genKey)) state.generatingParagraphs.push(genKey);

  // 获取上下文摘要
  const last_paragraph_summary = chapter.paragraphs[pIdx - 1]?.summary || '';
  const next_paragraph_summary = chapter.paragraphs[pIdx + 1]?.summary || '';

  const identity = {
    story_id: state.story.meta.story_id,
    story_name: state.story.meta.name,
    chapter_index: cIdx,
    chapter_title: chapter.meta.chapter_title,
    paragraph_index: pIdx,
    paragraph_title: paragraph.meta.paragraph_title,
    last_paragraph_summary: last_paragraph_summary,
    paragraph_summary: paragraph.summary,
    next_paragraph_summary: next_paragraph_summary
  };

  const adapt = {
    template_name: "标准",
    params_override: {}
  };

  const knowledgeBase = `{
  "templates": [
    {
      "name": "预告片/超宏",
      "aliases": ["预告片", "超宏", "trailer"],
      "params": { "style_multiplier": 0.70, "user_density_knob": 0, "compression_preference": 0.80, "dialogue_expansion": 0.20, "action_split": 0.20, "exposition_surfacing": 0.20, "pov_split_strictness": 0.20, "monologue_collapse": 0.70, "min_max_section_len": [40, 120], "salience_threshold": 0.60, "panel_hint_policy": "auto" }
    },
    {
      "name": "电影感",
      "aliases": ["电影", "film"],
      "params": { "style_multiplier": 0.85, "user_density_knob": 0, "compression_preference": 0.70, "dialogue_expansion": 0.30, "action_split": 0.40, "exposition_surfacing": 0.30, "pov_split_strictness": 0.30, "monologue_collapse": 0.60, "min_max_section_len": [30, 110], "salience_threshold": 0.55, "panel_hint_policy": "auto" }
    },
    {
      "name": "标准",
      "aliases": ["default", "standard"],
      "params": { "style_multiplier": 1.00, "user_density_knob": 0, "compression_preference": 0.50, "dialogue_expansion": 0.50, "action_split": 0.50, "exposition_surfacing": 0.40, "pov_split_strictness": 0.40, "monologue_collapse": 0.50, "min_max_section_len": [24, 90], "salience_threshold": 0.40, "panel_hint_policy": "auto" }
    },
    {
      "name": "电视剧",
      "aliases": ["剧集", "tv", "drama"],
      "params": { "style_multiplier": 1.40, "user_density_knob": 0, "compression_preference": 0.30, "dialogue_expansion": 0.70, "action_split": 0.70, "exposition_surfacing": 0.50, "pov_split_strictness": 0.60, "monologue_collapse": 0.40, "min_max_section_len": [22, 80], "salience_threshold": 0.30, "panel_hint_policy": "auto" }
    },
    {
      "name": "漫画分镜",
      "aliases": ["漫画", "comic", "storyboard"],
      "params": { "style_multiplier": 1.90, "user_density_knob": 0, "compression_preference": 0.20, "dialogue_expansion": 0.80, "action_split": 0.80, "exposition_surfacing": 0.60, "pov_split_strictness": 0.80, "monologue_collapse": 0.30, "min_max_section_len": [18, 70], "salience_threshold": 0.20, "panel_hint_policy": "auto" }
    }
  ],
  "rules": {
    "user_density_knob_mapping": { "-2": 0.70, "-1": 0.85, "0": 1.00, "1": 1.25, "2": 1.60 },
    "base_density_range": [1.2, 4.5],
    "budget_note": "SectionBudget = ceil( lerp(1.2,4.5,sid_score) * style_multiplier * user_multiplier * max(1, ceil(char_count/1000)) )"
  }
}`;

  // 构造主体名录（E）：从全局抽取结果中收集唯一规范名
  const roster = {
    characters: (state.story.meta.global_entities?.characters || []).map(x => ({ name: x.name })).filter(x => x.name),
    items: (state.story.meta.global_entities?.items || []).map(x => ({ name: x.name })).filter(x => x.name),
    locations: (state.story.meta.global_entities?.locations || []).map(x => ({ name: x.name })).filter(x => x.name),
  };

  const rawTextForPrompt = paragraphText || paragraph.summary || paragraph.meta?.paragraph_title || '';
  if (!paragraphText) {
    console.warn('[Section Gen] RAW_TEXT fallback to summary/title for', { cIdx, pIdx, start10: paragraph.start10, end10: paragraph.end10 });
    showNotification('未能在原文中定位该段文本，已使用该段摘要作为输入。', 'info');
  }

  const finalPrompt = `故事小节生成器
你是“联合改编引擎”。一次调用内完成：
(1) 对输入原文窗口生成单一信息密度分数 sid_score∈[0,1]（保留两位小数）。
(2) 合并改编参数得到 final_params，据此把原文改编为若干“故事小节（Story Sections）”。
(3) 输出仅一个严格 JSON 对象（含 evaluation 与 sections）。不得输出任何解释、注释或额外文本。
1.输入契约（严格遵守）
调用时输入以分段标签提供：
1.1. A) …（必填，JSON）
${JSON.stringify(identity, null, 2)}
1.2. B) …（二选一或并用，JSON）
${JSON.stringify(adapt, null, 2)}
1.3. C) <RAW_TEXT>…</RAW_TEXT>（必填，字符串）
${rawTextForPrompt}
1.4. D) <KNOWLEDGE_BASE>…</KNOWLEDGE_BASE>（可选，JSON）
${knowledgeBase}
1.5. E) …（必填，JSON）
由调用方预先维护的“主体名录”（唯一、规范名，禁止别名或括号补充）：
${JSON.stringify(roster, null, 2)}
2.密度打分（单指标）
依据事件密集度、场景切换、对话比例、状态或冲突变化、可视化潜力综合评估。
仅输出 sid_score（两位小数），不输出任何分项。
3.参数合并 → final_params
按顺序执行并得出 final_params（键集合固定如下）：
- style_multiplier (number)
- user_density_knob (integer ∈ [-2..+2])
- compression_preference (0..1)
- dialogue_expansion (0..1)
- action_split (0..1)
- exposition_surfacing (0..1)
- pov_split_strictness (0..1)
- monologue_collapse (0..1)
- min_max_section_len ([min,max] 字数)
- salience_threshold (0..1)
- panel_hint_policy ("auto" 等；本步不产 panel)
4.目标小节数（预算）
4.1. 先计算：
- base = lerp(1.2, 4.5, sid_score) ；低密→1.2，高密→4.5
- user_multiplier = map_knob(user_density_knob ∈ [-2..+2] → [0.7, 0.85, 1.0, 1.25, 1.6])
- K = ceil(原文字符数 / 1000)
- SectionBudget = ceil(base * final_params.style_multiplier * user_multiplier * max(1, K))
4.2. 约束：
- 允许 |actual_sections - SectionBudget| ≤ 1，超出则合并或细拆以回到预算附近。
- 严格遵守 min_max_section_len，必要时二次合并或再拆分。
5.改编与拆并策略（执行规则）
5.1. 文体：adapted_text 全文第三人称、现在时，可拍可听，连贯流畅。
5.2. 扩缩：当候选数 > 预算时，按 salience_threshold 合并低显著单元；compression_preference 越高越倾向合并并用叙述替代台词或细节。
5.3. 当候选数 < 预算时，遵循：
a) dialogue_expansion：把长对话拆节或外显隐含台词；
b) action_split：把复合动作链拆节；
c) exposition_surfacing > 0：把关键环境或设定“显影”为独立节；
d) pov_split_strictness 高：POV 一变即起新节；
e) monologue_collapse 高：独白压缩并并入邻节。
6.内置默认知识库（当 <KNOWLEDGE_BASE> 缺省时使用）
${knowledgeBase}
7.主体使用与一致性（关键新增要求）
7.1. 唯一规范名：E) 中的每个主体（人物、物品、场所）只有一个正式名字；禁止括号补充或任何形式的别名。
7.2. 只用已登记主体：
a) sections[].visuals.subjects 只能列出来自 E) 的主体；
b) audio.dialogues[].character 必须是已登记的 characters 之一；
c) 若原文存在未登记主体，不得发明命名，其信息转由 narration 概述，且不进入 dialogues。
7.3. 对应不缺漏：visuals.subjects.characters 与 audio.dialogues[].character 集合应一致（允许上镜无台词者只在 visuals.subjects.characters 保留）。
7.4. 非主体视觉：任何非主体视觉元素不进入 subjects，仅写入 visuals.setting 与 visual_message。
7.5. 场所选择：每节必须在 visuals.subjects.locations 中明确至少一个场所；visuals.setting 可进一步限定时段、天气。
7.6. 物品一致：被强调的关键物件仅使用 E).items 中的名称。
8.输出契约（仅允许一个 JSON 对象）
8.1. 结构与字段：
{
"evaluation": { "sid_score": 0.00, "section_budget": 0, "actual_sections": 0 },
"sections": [ { "section_id": "S01", "adapted_text": "string", "intent": "string", "visuals": { "subjects": { "characters": ["string"], "items": ["string"], "locations": ["string"] }, "setting": "string", "visual_message": ["string"] }, "audio": { "narration": "string", "dialogues": [ { "character": "string", "line": "string" } ], "sfx": ["string"] } } ]
}
8.2. 硬性约束：
- actual_sections 与 section_budget 满足 ±1；
- 每节 adapted_text 遵守 min_max_section_len（超出则拆；不足则合并或补充）；
- 旁白、台词、视觉三者在主体引用上保持一致；
- 不得出现未登记主体名；不得出现括号补充名；不得创造时代或设定冲突；
- 仅输出上述 JSON，不得输出任何其他字符（含空行或注释）。
9.生成流程（建议执行顺序）
9.1. 读取并校验 E)，构建“主体白名单”。
9.2. 评估 sid_score（两位小数）。
9.3. 合并 final_params。
9.4. 计算 SectionBudget。
9.5. 从原文抽取候选叙事单元，依据 final_params 拆并到预算附近。
9.6. 逐节撰写：adapted_text（第三人称、现在时）、intent、visuals（仅主体加 setting 与 visual_message）、audio（对白仅用白名单角色）。
9.7. 终检：预算、长度、主体一致性、禁用括号名、JSON 结构与类型正确。
9.8. 输出唯一 JSON。`;

  const button = event.target.closest('button');
  if (button) {
    button.disabled = true;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
  }

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
        messages: [{ role: "user", content: finalPrompt }],
        response_format: { "type": "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
    }

    const result = await response.json();
    const jsonString = result.choices[0].message.content;
    const [parsedJson, parseErr] = safeJsonParse(jsonString);
    if (parseErr) {
      throw new Error('AI response was not valid JSON.');
    }

    if (parsedJson && Array.isArray(parsedJson.sections)) {
      paragraph.sections = parsedJson.sections;
      showNotification(`Successfully generated ${parsedJson.sections.length} sections!`, 'success');
      renderTreeMod();
    } else {
      throw new Error('Invalid sections data received from AI.');
    }

  } catch (error) {
    showNotification(`Failed to generate sections: ${error.message}`, 'error');
    console.error('Section Generation Error:', error);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = `<i class=\"fas fa-wand-magic-sparkles\"></i>`;
    }
    // 仅移除当前完成项的 loading，不影响其他段落
    if (paragraphNode) {
      paragraphNode.classList.remove('generating');
    }
    state.generatingParagraphs = (state.generatingParagraphs || []).filter(k => k !== genKey);
  }
}


// ============ 全局主体抽取（人物/物品/地点） ============
export async function extractGlobalEntitiesWithAI(storyText, apiKey) {
  if (!storyText || !storyText.trim()) {
    throw new Error('原文为空，无法抽取主体');
  }
  const prompt = `你是一名“小说主体抽取器（绘图友好）”。接收一段小说原文后，通读全文，抽取其中的人物、物品、场所三类主体，并输出一个单一 JSON 对象，包含 characters、items、locations 三个列表。除 JSON 外不要输出任何说明或前缀；不要使用代码块标记。



全局准则

只依据原文，严禁臆测。未知字段可省略或置为 null。



指代消解：同一主体的本名/别称/代称/描述性称呼须合并，name 用最常见称呼，其他进入 aliases（放在各类的 story 内）。



精炼优先：每个主体仅保留对剧情或识别最关键的信息。



语言一致：输出语言与原文保持一致（中文原文→中文输出）。



relations 规范：

[{ "target": "对方主体名称", "target_type": "character|item|location", "relation": "关系类型", "notes": "可选补充" }]

关系短语示例：亲属/同伴/雇佣/敌对/追逐/保护/威胁/交易/持有/遗失/制造/作者/来源/位于/发生地/前往/线索/隶属。



视觉描述（用于AI绘图的 visual_prompt）

以逗号分隔的短语编写，聚焦可见/可感细节：体貌、发型/服饰/配件、材质与质感、颜色/花纹、表情与状态、显著伤痕/标记、表面状况（潮湿/蒙尘/破损等）、近距可感环境要素（如“雨滴附着”“霓虹反光”）。



禁止出现画风与技法词（如“赛璐璐、油画、像素风、写实风、插画风、C4D、Octane、Unreal、PBR”）、构图/镜头/摄影参数（如“广角、俯拍、特写、景深、bokeh、F1.4、三分法、电影感、体素化”）、以及后期/滤镜词。



控制在8–18个短语；不写句子，不加句号。



输出格式（JSON 仅示例骨架，真实输出请填充可得字段）

{

"characters": [

{

"name": "主体名称",

"visual_prompt": "逗号分隔的纯视觉短语…",

"story": {

"summary": "≤120字的人物简介，聚焦身份/作用/动机（可省略冗余）",

"aliases": ["别称或代称…"],

"age": "年龄或年龄感（如“中年”）",

"race_or_species": "族属/物种",

"traits": ["关键性格/心理特质…（3-6条）"],

"occupation_or_role": "职业/社会角色",

"affiliation": "组织/阵营（可选）",

"goals_or_motivations": "目标/动机（可选）",

"status": "当前状态（如受伤/在逃/死亡…，可选）",

"last_known_location": "最近出现地点（引用 locations.name，可选）"

},

"relations": [

{ "target": "主体名称", "target_type": "character|item|location", "relation": "关系类型", "notes": "可选" }

]

}

],

"items": [

{

"name": "物品名称",

"visual_prompt": "材质、颜色、质感、形状、状态、标记等的短语…",

"story": {

"summary": "≤120字的物品设定与剧情作用",

"aliases": ["别称/描写性称呼…"],

"category": "类别（武器/文书/器械/照片/神器…）",

"key_properties": ["关键属性（锋利、破损、带血、通电、封印…）"],

"function": "主要用途/能力",

"owner_or_holder": "当前持有者（引用 characters.name）",

"origin_or_source": "来历/来源（可选）",

"status": "状态（完好/损坏/遗失/封存…）",

"last_known_location": "最近出现地点（引用 locations.name，可选）"

},

"relations": [

{ "target": "主体名称", "target_type": "character|item|location", "relation": "关系类型", "notes": "可选" }

]

}

],

"locations": [

{

"name": "地点名称",

"visual_prompt": "空间结构、表面材质、光线/天气、声响/气味、氛围等短语…",

"story": {

"summary": "≤120字的地点功能与剧情作用",

"location_type": "类型（路口/高架/公寓/酒吧/办公室…）",

"notable_features": ["显著要素（红绿灯、霓虹招牌、铁门…）"],

"geography_or_context": "隶属城市/区域/社会语境（可选）",

"function_or_usage": "用途（居住/交易/监控/埋伏…）",

"period_or_time": "时代/时段（夜晚/清晨/某年代，可选）",

"events_here": ["在此发生的重要事件（短语，可选）"]

},

"relations": [

{ "target": "主体名称", "target_type": "character|item|location", "relation": "关系类型", "notes": "可选" }

]

}

]

}



生成要求（务必遵守）

仅输出上述 JSON 结构，不得添加解释或示例句。



视觉仅写能被看见/感知的客观要素；设定信息放入 story。



能省则省：若信息无直接文本依据或对剧情非关键，省略该字段。


小说原文如下：
---
${storyText}
---`;

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
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
  }
  const result = await response.json();
  const jsonString = result.choices?.[0]?.message?.content || '';
  const [parsedJson, parseErr] = safeJsonParse(jsonString);
  if (parseErr) {
    throw new Error('AI 响应不是合法的 JSON');
  }
  return parsedJson;
}

export async function extractGlobalEntitiesForCurrentStory(event) {
  try {
    const apiKey = localStorage.getItem('openRouterApiKey') || prompt('Please enter your OpenRouter API Key:');
    if (!apiKey) {
      showNotification('缺少 API Key，无法调用主体抽取', 'error');
      return;
    }
    localStorage.setItem('openRouterApiKey', apiKey);
    const storyText = state?.story?.meta?.original_text || '';
    if (!storyText.trim()) {
      showNotification('未找到故事原文（meta.original_text）', 'error');
      return;
    }
    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...'; }
    const entities = await extractGlobalEntitiesWithAI(storyText, apiKey);
    state.story.meta.global_entities = entities;
    localStorage.setItem('aiGlobalEntities', JSON.stringify(entities));
    showNotification('全局主体抽取完成', 'success');
    // 触发刷新以使右侧全局元信息使用最新数据
    try { renderTreeMod(); } catch (_) {}
  } catch (err) {
    showNotification(`主体抽取失败: ${err.message}`, 'error');
    console.error('Global Entities Extraction Error:', err);
  } finally {
    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> 生成分镜'; }
  }
}


// ============ 分镜生成器（为某个 section 生成分镜 JSON） ============
/**
 * 基于给定的 section（故事小节 JSON）生成分镜 JSON（layout_template、panels、audio_prompts）。
 * 结果将写入：section.storyboard
 */
export async function generateStoryboardForSection(event, cIdx, pIdx, sIdx) {
  try {
    const apiKey = localStorage.getItem('openRouterApiKey') || prompt('Please enter your OpenRouter API Key:');
    if (!apiKey) {
      showNotification('缺少 API Key，无法生成分镜', 'error');
      return;
    }
    localStorage.setItem('openRouterApiKey', apiKey);

    const chapter = state?.story?.chapters?.[cIdx];
    const section = chapter?.paragraphs?.[pIdx]?.sections?.[sIdx];
    if (!section) {
      showNotification('未找到目标 section', 'error');
      return;
    }

    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    // 构造严格输入契约所需的最小 JSON（与项目 section 结构保持一致）
    const subjects = section?.visuals?.subjects || {};
    const inputSection = {
      section_id: section.section_id || `C${cIdx}_P${pIdx}_S${sIdx}`,
      adapted_text: section.adapted_text || '',
      intent: section.intent || '',
      visuals: {
        subjects: {
          characters: Array.isArray(subjects.characters) ? subjects.characters : [],
          items: Array.isArray(subjects.items) ? subjects.items : [],
          locations: Array.isArray(subjects.locations) ? subjects.locations : []
        },
        setting: section?.visuals?.setting || '',
        visual_message: Array.isArray(section?.visuals?.visual_message) ? section.visuals.visual_message : []
      },
      audio: {
        narration: section?.audio?.narration ?? null,
        dialogues: Array.isArray(section?.audio?.dialogues) ? section.audio.dialogues : [],
        sfx: Array.isArray(section?.audio?.sfx) ? section.audio.sfx : []
      }
    };

    const storyboardPrompt = `
分镜生成器
你是“分镜编导引擎”。
输入是一个 section（故事小节 JSON）；输出是一个分镜 JSON（仅输出一个合法 JSON 对象；禁止任何解释/Markdown/额外文字）。本分镜仅对应该 section。

1.输入契约（section）
必须包含：
1.1. section_id（字符串）
1.2. adapted_text（改编后文本）
1.3. intent（叙事目标/情绪）
1.4. visuals.subjects.characters[] | items[] | locations[]（主体名清单）
1.5. visuals.setting（场景设定）
1.6. visuals.visual_message[]（需要被视觉化的要点）
1.7. audio.narration（可空）、audio.dialogues[]、audio.sfx[]

2.输出契约（分镜 JSON，唯一输出）
仅包含以下三个顶层字段（不得新增其它字段）：
2.1. layout_template（图片排版模板）
2.1.1. 可选值：
- single
- double_vertical、double_horizontal
- triple_top_single_bottom_double、triple_top_double_bottom_single
- quad_grid_2x2
2.1.2. 选择规则（简述）：
- 仅一个核心画面 → single
- 建立场景 + 关键细节/动作 → double_*
- 1个全景 + 2个互补细节/动作 → triple_*（按叙事先后决定变体）
- 四个并列要点/时间切片/动作分解 → quad_grid_2x2

2.2. panels（数组；长度与排版模板一致）
2.2.1. 每个 panel 的结构（不得出现未列出的字段）：
{
"panel_index": 0,
"image_description": {
  "subject_description": {
    "characters": [
      { "variant_id": "string|null", "state_note": "string|null" }
    ],
    "items": [
      { "variant_id": "string|null", "state_note": "string|null" }
    ]
  },
  "visual_description": "English natural-language prompt. It MUST explicitly mention the names of appearing subjects exactly as in the section (so they can be replaced by visual references later). Describe precisely what to render: subjects, their action/state, scene/setting, lighting, environment/time/weather, mood/color. Follow Kontext rules below. If this is a repaint/edit, clearly say 'keep other details unchanged' and 'do not change the composition'. Never propose composition changes for repaint."
}
}
2.2.2. 说明：
- state_note 仅一句话（如：“fingers slightly trembling”, “coat hem wet”）。
- 若某类主体不存在，用空数组；variant_id 允许为 null（由下游绑定）。
- locations 不单列为字段，但应在 visual_description 中用自然语言点名与描述。

2.3. audio_prompts（数组）
三种其一：
2.3.1. a) 旁白（voiceover）
{
  "type": "voiceover",
  "description": {
    "voice_id": "string",
    "text": "string",
    "audio_description": "string // 速度/情绪/能量/停连，如：speed 0.9, tense, low energy, slight pauses at periods"
  }
}
2.3.2. b) 人物台词（dialogue）
{
  "type": "dialogue",
  "description": {
    "voice_id": "string",
    "text": "string",
    "audio_description": "string // 速度/情绪/口气等"
  }
}
2.3.3. c) 音效（sfx）
{
  "type": "sfx",
  "description": {
    "sfx_id": "string|null",
    "sfx_description": "string // 自然语言：来源/时长/强弱/空间感，如：soft domino click on carpet, 1.0s, near-field"
  }
}

3.Kontext（Flux Kontext）英文提示词规范（用于撰写每个 panel 的 visual_description）
3.1. 语言：自然英文、正向描述；45–120词为宜。尽量通过“说要什么”而非长串排除项实现控制；必要时可在句中简短排除（如 avoid blur/over-saturation）。
3.2. 主体显式：visual_description 必须点名将要出现的主体（与 section 中主体名完全一致），便于后续替换视觉提示词。
3.3. 重绘专则：若为重绘/编辑，请明确编辑对象或区域的自然语言定位，并包含 “keep other details unchanged” 与 “do not change the composition”；禁止提出任何改变构图/机位/景别的要求。
3.4. 信息合并：将动作/状态、场景/道具、光线方向与对比、环境/时间/天气、情绪与色彩走向等信息全部写进同一段 visual_description 中，形成可直接执行的高质量英文指令。
3.5. 连贯性：多 panel 时，如需延续上一图的光线/色调/位置关系，请在英文描述中自然说明（例：maintain continuity with the previous panel’s lighting and palette）。

4.生成流程（内部）
4.1. 读取 adapted_text、intent、visuals.visual_message，据此选择 layout_template。
4.2. 为每个 panel 填写 subject_description 与 visual_description（英文、正向；主体指名；重绘不改构图）。
4.3. 基于 audio 生成 audio_prompts（voiceover / dialogue / sfx）。
4.4. 仅输出一个分镜 JSON；键与层级严格按本规范；不包含未定义字段。

5.质量校验
5.1. 仅输出一个合法 JSON；顶层只含：layout_template、panels、audio_prompts。
5.2. panels 数量与 layout_template 匹配；每个 visual_description 都点名主体并包含必要环境/光线/情绪信息。
5.3. 重绘时必须包含“保持其它细节不变、不要改变构图”的语句；不得提出构图变更。
5.4. state_note 都为一句话；空缺可用 null。

以下是本次输入的 section（严格遵守输入契约）：
${JSON.stringify(inputSection, null, 2)}

仅输出分镜 JSON（只含 layout_template、panels、audio_prompts）。
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tangyuansupercute.github.io/StoryToVideoWeb/',
        'X-Title': 'MaoDie Nebula Story Studio'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro-preview',
        messages: [{ role: 'user', content: storyboardPrompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
    }

    const result = await response.json();
    const jsonString = result?.choices?.[0]?.message?.content || '';
    const [parsedJson, parseErr] = safeJsonParse(jsonString);
    if (parseErr) {
      throw new Error('AI 响应不是合法的 JSON');
    }

    // 轻量校验顶层三个字段
    if (!parsedJson || typeof parsedJson !== 'object') {
      throw new Error('分镜结果为空或类型不正确');
    }
    const { layout_template, panels, audio_prompts } = parsedJson;
    if (!layout_template || !Array.isArray(panels) || !Array.isArray(audio_prompts)) {
      throw new Error('分镜结果缺少必要字段（layout_template/panels/audio_prompts）');
    }

    // 写回 section
    section.storyboard = parsedJson;

    // 通知编辑器刷新分镜编辑区
    try { document.dispatchEvent(new CustomEvent('storyboard-updated')); } catch (_) {}

    showNotification('分镜生成完成', 'success');
  } catch (err) {
    showNotification(`分镜生成失败: ${err.message}`, 'error');
    console.error('Storyboard Generation Error:', err);
  } finally {
    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; }
  }
}