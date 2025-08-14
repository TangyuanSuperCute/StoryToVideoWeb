import { state } from './src/state.js';
import { $, $all, showNotification, safeJsonParse } from './src/utils.js';
import { detectJsonType, importStory, importChapter, importParagraph } from './src/storyImport.js';
import {
  renderTree as renderTreeMod,
  updateEntities as updateEntitiesMod,
  updateEntityList as updateEntityListMod,
  addNewChapter as addNewChapterMod,
  addNewParagraph as addNewParagraphMod,
  deleteChapter as deleteChapterMod,
  deleteParagraph as deleteParagraphMod,
  deleteSection as deleteSectionMod,
  highlightActiveNode as highlightActiveNodeMod
} from './src/treeRender.js';
import {
  selectSection as selectSectionMod,
  renderList as renderListMod,
  updateSectionIntentFromEditor as updateSectionIntentFromEditorMod
} from './src/editorView.js';
import {
  createPanelSlots as createPanelSlotsMod,
  initCanvasArea as initCanvasAreaMod,
  handleImageUpload as handleImageUploadMod,
  clearCanvas as clearCanvasMod,
  removePanel as removePanelMod,
  updatePanelSlots as updatePanelSlotsMod
} from './src/panels.js';
import { openStoryFile as openStoryFileMod, saveStoryAs as saveStoryAsMod, clearStory as clearStoryMod } from './src/fileOps.js';

// ============ JSON结构检测 ============
// moved to src/storyImport.js

// ============ 初始化空故事 ============
function initEmptyStory() {
  state.story = {
    meta: {
      story_id: "new_story",
      name: "Untitled Story",
      created_at: new Date().toISOString()
    },
    chapters: []
  };
  renderTreeMod();
}

// ============ 渲染目录树 ============
// moved to src/treeRender.js

// ============ 导入JSON处理 ============
function openImportModal(targetType, chapterIdx = null, paragraphIdx = null) {
  const modal = $('#jsonModal');
  modal.classList.remove('hidden');
  $('#jsonInput').value = '';
  
  // 保存导入目标信息
  modal.dataset.targetType = targetType;
  modal.dataset.chapterIdx = chapterIdx !== null ? chapterIdx : '';
  modal.dataset.paragraphIdx = paragraphIdx !== null ? paragraphIdx : '';
  
  // 更新提示文本和示例
  let hint = '';
  let example = '';
  if (targetType === 'story') {
    hint = 'Import complete story JSON (with chapters array)';
    example = `{
  "story": {
    "meta": { "name": "Story Name" },
    "chapters": [
      {
        "meta": { "chapter_title": "Chapter 1" },
        "paragraphs": [ ... ]
      }
    ]
  }
}`;
  } else if (targetType === 'chapter') {
    hint = 'Import chapter JSON (with paragraphs array)';
    example = `{
  "meta": {
    "chapter_title": "Chapter Title"
  },
  "paragraphs": [
    {
      "meta": { "paragraph_title": "Paragraph 1" },
      "sections": [ ... ]
    }
  ]
}`;
  } else if (targetType === 'paragraph') {
    hint = 'Import paragraph JSON (with sections array)';
    example = `{
  "meta": {
    "paragraph_title": "Paragraph Title"
  },
  "sections": [
    {
      "section_id": "S01",
      "intent": "Section purpose",
      "adapted_text": "...",
      "visuals": {
        "location": "...",
        "characters": ["..."],
        "props": ["..."],
        "visual_message": ["..."]
      },
      "audio": {
        "narration": "...",
        "dialogues": [],
        "sfx": ["..."]
      }
    }
  ]
}`;
  }
  $('#jsonModal h3').textContent = hint;
  
  // 更新示例显示
  const exampleEl = $('#jsonExample');
  if (exampleEl) {
    exampleEl.textContent = example;
  }
}

function closeImportModal() {
  $('#jsonModal').classList.add('hidden');
}

function parseImportJson() {
  const modal = $('#jsonModal');
  const text = $('#jsonInput').value.trim();
  
  if (!text) {
    showNotification('Please enter JSON', 'error');
    return;
  }
  
  const [obj, err] = safeJsonParse(text);
  if (err) {
    showNotification('Invalid JSON format', 'error');
    return;
  }
  
  const targetType = modal.dataset.targetType;
  const chapterIdx = modal.dataset.chapterIdx ? parseInt(modal.dataset.chapterIdx) : null;
  const paragraphIdx = modal.dataset.paragraphIdx ? parseInt(modal.dataset.paragraphIdx) : null;
  
  const jsonType = detectJsonType(obj);
  
  // 验证JSON类型是否匹配目标
  if (targetType === 'story' && jsonType !== 'story') {
    showNotification('JSON must be a complete story structure', 'error');
    return;
  }
  if (targetType === 'chapter' && jsonType !== 'chapter') {
    showNotification('JSON must be a chapter structure', 'error');
    return;
  }
  if (targetType === 'paragraph' && jsonType !== 'paragraph') {
    showNotification('JSON must be a paragraph structure', 'error');
    return;
  }
  
  // 执行导入
  if (targetType === 'story') {
    importStory(obj);
  } else if (targetType === 'chapter') {
    importChapter(obj, chapterIdx);
  } else if (targetType === 'paragraph') {
    importParagraph(obj, chapterIdx, paragraphIdx);
  }
  
  closeImportModal();
  renderTreeMod();
  showNotification('Import successful', 'success');
}

// ============ 导入处理函数 ============
// moved to src/storyImport.js

// moved to src/storyImport.js

// moved to src/storyImport.js

// ============ 新建操作 ============
function addNewChapter() {
  const cIdx = state.story.chapters.length;
  state.story.chapters.push({
    meta: {
      chapter_index: cIdx,  // 从0开始
      chapter_id: `C${cIdx}`,
      chapter_title: `Chapter ${cIdx + 1}`  // 显示从1开始
    },
    paragraphs: []
  });
  renderTreeMod();
}

function addNewParagraph(chapterIdx) {
  const chapter = state.story.chapters[chapterIdx];
  if (!chapter) return;
  
  const pIdx = chapter.paragraphs.length;
  chapter.paragraphs.push({
    meta: {
      chapter_index: chapterIdx,  // 从0开始
      paragraph_index: pIdx,  // 从0开始
      paragraph_id: `C${chapterIdx}_P${pIdx}`,
      paragraph_title: `Paragraph ${pIdx + 1}`  // 显示从1开始
    },
    sections: []
  });
  renderTreeMod();
}

// ============ Section选择和编辑 ============
// moved to src/editorView.js

// moved to src/editorView.js

function highlightActiveNode() {
  $all('.tree .node').forEach(n => n.classList.remove('active'));
  if (state.selectedSectionId) {
    const activeNode = $(`.tree .node[data-unique-id="${state.selectedSectionId}"]`);
    if (activeNode) {
      activeNode.classList.add('active');
    }
  }
}

// ============ 实体统计 ============
// moved to src/treeRender.js

// moved to src/treeRender.js

// ============ 面板管理 ============
// moved to src/panels.js

// 初始化画布区域
// moved to src/panels.js

// 初始化标签页切换（已移除标签页设计）
// moved to src/panels.js

// moved to src/panels.js

// moved to src/panels.js

// moved to src/panels.js

// moved to src/panels.js

// ============ 初始化 ============
function initializeApp() {
  try {
    // 仅在编辑器页面执行的初始化
    if (document.querySelector('.app-container')) {
      const shotTree = $('#shotTree');
      if (shotTree) {
        shotTree.classList.add('tree');
      }

      const storyFromAI = localStorage.getItem('aiStory');
      if (storyFromAI) {
        const [storyData, err] = safeJsonParse(storyFromAI);
        if (storyData && !err) {
          importStory(storyData);
          renderTreeMod();
          showNotification('成功加载AI生成的故事！', 'success');
        }
        localStorage.removeItem('aiStory');
      } else {
        initEmptyStory();
      }

      // 创建面板槽位
      createPanelSlotsMod();

      // 绑定模态框事件
      $('#modalClose')?.addEventListener('click', closeImportModal);
      $('#modalCancel')?.addEventListener('click', closeImportModal);
      $('#modalParse')?.addEventListener('click', parseImportJson);

      // 搜索功能
      $('#treeSearch')?.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        $all('.tree .node').forEach(node => {
          node.style.display = node.textContent.toLowerCase().includes(keyword) ? '' : 'none';
        });
      });

      // 兜底刷新一次目录
      if (state.story) {
        renderTreeMod();
      }
    }
  } catch (err) {
    console.error('Editor initialize error:', err);
    showNotification('初始化编辑器失败，请查看控制台错误', 'error');
  }

  // 首页特有的逻辑（独立绑定，避免被前面错误影响）
  const startDisassembleBtn = $('#startDisassemble');
  if (startDisassembleBtn) {
    startDisassembleBtn.addEventListener('click', () => {
      const storyText = $('#storyInput').value;
      const apiKey = $('#apiKeyInput').value;
      if (!storyText.trim()) { showNotification('请输入故事内容', 'error'); return; }
      if (!apiKey.trim()) { showNotification('请输入OpenRouter API Key', 'error'); return; }
      import('./src/ai.js').then(m => m.disassembleStoryWithAI(storyText, apiKey));
    });
  }

  const loadStoryBtn = $('#loadStoryFile');
  if (loadStoryBtn) {
    loadStoryBtn.addEventListener('click', () => handleFileUpload('#storyInput'));
  }
  const loadKeyBtn = $('#loadApiKeyFile');
  if (loadKeyBtn) {
    loadKeyBtn.addEventListener('click', () => handleFileUpload('#apiKeyInput'));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function handleFileUpload(targetElementSelector) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            $(targetElementSelector).value = text;
            showNotification('文件内容已成功读取！', 'success');
        } catch (err) {
            showNotification('读取文件失败', 'error');
            console.error('File read error:', err);
        }
    };
    input.click();
}

async function disassembleStoryWithAI(storyText, apiKey) {
  const btn = $('#startDisassemble');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在拆解...';

  const prompt = `
你是一名"小说结构抽取器"。接收一段很长的小说原文后，将其解析为【故事→章节→段落（PSU：场景级叙事单元）】三级结构并输出一个**单一 JSON 对象**。除 JSON 外不要输出任何说明、前缀或代码块标记。

# 总目标与全局约束
- 若原文已显式分章（如"第一章""Chapter 1""序/楔子/尾声/番外"等），**按原章划分并保留原章名**；为这些章编号时，\\\`chapter_index\\\` 仍从 **0** 开始。
- 若原文未显式分章，仅在满足"自动分章触发条件"时才切分；否则**整篇视为 1 章**。
- **索引一律从 0 开始**：\\\`chapter_index\\\`、\\\`paragraph_index\\\` 都是 0,1,2,… 连续递增，不跳号。

# 自动分章触发条件（缺省不开启）
满足任一条件才自动分章：
1) 全文字数 ≥ 6000；或
2) 原始换行段（微单元）数量 ≥ 25；或
3) 存在 ≥ 2 个**强转场信号**（显著的时间/地点/视角切换，或显式分隔符如"***""——"）。
> 若不满足，上述文本**输出为 1 章**。

# 章节体量与均衡（防"碎章"）
- 建议章节数：\\\`N = clamp(round(总字数 / 8000), 1, 8)\\\`；最终章节数必须 \`1 ≤ N ≤ 8\`。
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

# 命名与摘要规则
- \\\`chapter_title\\\`：原章名或自拟（≤14字，主题+线索词）。
- \\\`paragraph_title\\\`：精炼标题（≤16字/≤10英文词），避免剧透。
- \\\`summary\\\`：1–3 句，≤120 字，只基于该段文本，不引入外部推断；包含关键人物与动作线索。
- 输出语言遵循原文主导语言（多语混排时以该段主导语言为准）。

# start10 / end10 提取
- 先 trim 段落首尾空白与分隔符（含全角空格）。
- 按"字符"计数（非字节），包含标点与引号；不足 10 则返回全段。
- 仅从该 PSU 正文中截取，不含章名、段号或分隔符。

# 故事 ID 与标题
- \\\`story.title\\\`：若原文显式给出书名/标题（如封面、首行、<TITLE>）则沿用；否则据文本主题自拟（≤20字）。
- \\\`story.id\\\`：将标题转小写、移除非字母数字，空格改连字符；若结果为空则用 \`"untitled"\`。

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
- \\\`chapters\\\` 与每个 \\\`paragraphs\\\` 数组**不可为空**。
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
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { "type": "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
    }

    const result = await response.json();
    const jsonString = result.choices[0].message.content;

    console.log("AI 模型的原始响应文本:", jsonString);

    // 清理AI返回的内容，只留下JSON部分
    const [parsedJson, parseErr] = safeJsonParse(jsonString);
    if(parseErr){
        console.error("无法将AI响应解析为JSON。原始文本:", jsonString);
        throw new Error("Failed to parse JSON from AI response.");
    }

    // 将原文添加到JSON对象中
    parsedJson.story.original_text = storyText;

    console.log("成功解析并添加原文后的JSON对象:", parsedJson);

    localStorage.setItem('aiStory', JSON.stringify(parsedJson));
    window.location.href = 'editor.html';

  } catch (error) {
    showNotification(`拆解失败: ${error.message}`, 'error');
    console.error("AI Disassembly Error:", error);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '启动 AI 拆解';
  }
}


// ============ 文件操作 ============
// moved to src/fileOps.js

// moved to src/fileOps.js

// moved to src/fileOps.js

// ============ 标题编辑 ============
function updateStoryName(newName) {
  state.story.meta = state.story.meta || {};
  state.story.meta.name = newName.trim() || 'Untitled Story';
  showNotification('Story name updated', 'success');
}

function updateChapterTitle(cIdx, newTitle) {
  if (!state.story.chapters[cIdx]) return;
  
  state.story.chapters[cIdx].meta = state.story.chapters[cIdx].meta || {};
  state.story.chapters[cIdx].meta.chapter_title = newTitle.trim() || 'Untitled';
  
  showNotification('Chapter title updated', 'success');
}

function updateParagraphTitle(cIdx, pIdx, newTitle) {
  const paragraph = state.story.chapters[cIdx]?.paragraphs[pIdx];
  if (!paragraph) return;
  
  paragraph.meta = paragraph.meta || {};
  paragraph.meta.paragraph_title = newTitle.trim() || 'Untitled';
  
  showNotification('Paragraph title updated', 'success');
}

// ============ 删除功能 ============
function deleteChapter(cIdx) {
  if (!confirm(`Delete Chapter ${cIdx + 1} and all its contents?`)) return;
  
  state.story.chapters.splice(cIdx, 1);
  
  // 重新分配章节索引（从0开始）
  state.story.chapters.forEach((chapter, idx) => {
    chapter.meta.chapter_index = idx;  // 从0开始
    chapter.meta.chapter_id = `C${idx}`;
    
    // 更新段落ID
    chapter.paragraphs?.forEach((para, pIdx) => {
      para.meta.chapter_index = idx;  // 从0开始
      para.meta.paragraph_index = pIdx;  // 从0开始
      para.meta.paragraph_id = `C${idx}_P${pIdx}`;
      
      // 更新section ID
      para.sections?.forEach((sec, sIdx) => {
        sec.section_id = sec.section_id || `C${idx}_P${pIdx}_S${sIdx}`;
      });
    });
  });
  
  renderTreeMod();
  showNotification('Chapter deleted', 'info');
}

function deleteParagraph(cIdx, pIdx) {
  if (!confirm(`Delete Paragraph ${pIdx + 1} and all its sections?`)) return;
  
  const chapter = state.story.chapters[cIdx];
  if (!chapter) return;
  
  chapter.paragraphs.splice(pIdx, 1);
  
  // 重新分配段落索引（从0开始）
  chapter.paragraphs.forEach((para, idx) => {
    para.meta.paragraph_index = idx;  // 从0开始
    para.meta.paragraph_id = `C${cIdx}_P${idx}`;
    
    // 更新section ID
    para.sections?.forEach((sec, sIdx) => {
      sec.section_id = sec.section_id || `C${cIdx}_P${idx}_S${sIdx}`;
    });
  });
  
  renderTreeMod();
  showNotification('Paragraph deleted', 'info');
}

function deleteSection(cIdx, pIdx, sIdx) {
  if (!confirm(`Delete Section ${sIdx + 1}?`)) return;
  
  const paragraph = state.story.chapters[cIdx]?.paragraphs[pIdx];
  if (!paragraph) return;
  
  paragraph.sections.splice(sIdx, 1);
  
  // 保留原有的section_id，不重新分配
  
  renderTreeMod();
  showNotification('Section deleted', 'info');
}

// 导出全局函数供HTML调用
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.parseImportJson = parseImportJson;
window.addNewChapter = addNewChapterMod;
window.addNewParagraph = addNewParagraphMod;
window.selectSection = selectSectionMod;
window.removePanel = removePanelMod;
window.updatePanelSlots = updatePanelSlotsMod;
window.openStoryFile = openStoryFileMod;
window.saveStoryAs = saveStoryAsMod;
window.clearStory = clearStoryMod;
window.updateStoryName = updateStoryName;
window.updateChapterTitle = updateChapterTitle;
window.updateParagraphTitle = updateParagraphTitle;
window.deleteChapter = deleteChapterMod;
window.deleteParagraph = deleteParagraphMod;
window.deleteSection = deleteSectionMod;

// 添加section intent更新函数 - 从编辑器更新
// moved to src/editorView.js
window.updateSectionIntentFromEditor = updateSectionIntentFromEditorMod;

// ============ 段落文本提取 ============
function findParagraphText(fullText, start, end) {
  if (!fullText || !start || !end) return null;

  const startIndex = fullText.indexOf(start);
  if (startIndex === -1) {
    console.error("findParagraphText: Start anchor not found:", start);
    return null;
  }
  
  const endIndex = fullText.indexOf(end, startIndex + start.length);

  if (endIndex === -1) {
    console.error("findParagraphText: End anchor not found after start:", end);
    return null;
  }

  return fullText.substring(startIndex, endIndex + end.length);
}


// ============ 段落级 Section 生成 ============
async function generateSectionsForParagraph(event, cIdx, pIdx) {
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

  const finalPrompt = `你是"联合改编引擎（SID + Section Adapter）"。

【总目标】
在一次调用中完成：
1) 对输入的小说原文窗口做信息密度打分（产出单一指标 sid_score ∈ [0,1]）。
2) 基于 sid_score 与用户指定的"改编档位/参数"，将原文改编为若干"故事小节（Story Sections）"。
3) 输出**严格JSON**（含 meta 与 sections），后续流程将只依赖这些小节而不再回看原文。

【输入将由用户提供，包含三部分】
A) <IDENTITY>
${JSON.stringify(identity, null, 2)}
</IDENTITY>

B) <ADAPT>
${JSON.stringify(adapt, null, 2)}
</ADAPT>

C) <RAW_TEXT>
${paragraphText}
</RAW_TEXT>

D) （可选）<KNOWLEDGE_BASE>
${knowledgeBase}
</KNOWLEDGE_BASE>

【密度打分（只产出单指标）】
- 产出 sid_score ∈ [0,1]，保留两位小数。
- 打分依据：事件密集度、场景切换、对话比例、状态/冲突变化等整体可视化潜力。无需输出各分项，只给总分 sid_score。

【目标小节数（预算）】
- 先解析"最终参数 final_params"（见下节合并规则），然后计算：
  base = lerp(1.2, 4.5, sid_score)           # 低密→1.2，高密→4.5
  user_multiplier = map_knob(user_density_knob ∈ [-2..+2] → [0.7,0.85,1.0,1.25,1.6])
  K = ceil( 原文字符数 / 1000 )
  SectionBudget = ceil( base * final_params.style_multiplier * user_multiplier * max(1, K) )
- 允许 |actual_sections - SectionBudget| ≤ 1，超出需合并/细拆回预算附近。

【参数合并规则（得到 final_params）】
1) 若 ADAPT.template_name 存在：在知识库中查同名或别名的模板，取其参数为"模板参数"。
2) 若 ADAPT.params_override 存在：以"覆盖方式"应用到模板参数上（相同键以覆盖值为准）。
3) 若未给 template_name：默认使用模板"标准"。
4) 若未给 user_density_knob：默认 0。
5) final_params 的键集合（与知识库一致）：
   - style_multiplier              (数值)
   - user_density_knob             (整数 -2..+2)
   - compression_preference        (0..1)
   - dialogue_expansion            (0..1)
   - action_split                  (0..1)
   - exposition_surfacing          (0..1)
   - pov_split_strictness          (0..1)
   - monologue_collapse            (0..1)
   - min_max_section_len              ([min,max] 字数)
   - salience_threshold            (0..1)
   - panel_hint_policy             ("auto" 等，占位；本步不产 panel)

【改编要求（故事小节最小必要信息）】
- 每个小节必须**能独立复述**其情节（adapted_text），并覆盖下游生产所需：
  1) adapted_text：连贯、现在时、三人称、可拍可听，遵守 min_max_section_len。
  2) intent：一句话说明该节的叙事/情绪目标。
  3) visuals：
     - location：场地（可含时段/天气等必要限定）
     - characters：画面内出现的角色清单（名称或称谓）
     - props：关键物件清单
     - visual_message：必须被画面明确表达的要点 2–5 条
  4) audio：
     - narration：旁白文本（可直接TTS）
     - dialogues：按出现顺序排列的台词数组 [{character, line}]
     - sfx：必要音效清单（简述，如"近景雨声""门轴吱呀"）

【拆并策略（按 final_params 执行）】
- 若候选 > 预算：按 salience_threshold 合并低显著单元；提高 compression_preference 倾向合并。
- 若候选 < 预算：按 dialogue_expansion / action_split 拆分长对话与复合动作；exposition_surfacing>0 时将重要环境描写"显影"成节。
- pov_split_strictness 高：POV 一变即起新节；monologue_collapse 高：独白压缩并并入邻节。
- 严格执行 min_max_section_len，必要时二次合并/再拆分。

【一致性与完备性】
- 人名、地名、关键物件命名应在小节文本与 visuals/props 中一致。
- visuals/characters 与 audio/dialogues 中出现的角色应对应且不缺漏。
- 禁止引入无根据的新设定或时代冲突。

【输出JSON格式（只允许JSON，无其他文字/标点/Markdown）】
{
   "meta": {
     "story_id": "字符串",
     "story_name": "字符串",
     "chapter_index": 整数,
     "chapter_title": "字符串",
     "paragraph_index": 整数,
     "paragraph_title": "字符串",
     "last_paragraph_summary":"字符串",
     "paragraph_summary":"字符串",
     "next_paragraph_summary":"字符串",
    "template_used": "string",         // 实际采用的模板名（若无则为"标准"）
    "final_params": { ... }                 // 应用覆盖后的最终参数
   },
  "evaluation": {
    "sid_score": number,
    "section_budget": number,
    "actual_sections": number
  },
  "sections": [
    {
      "section_id": "S01",
      "adapted_text": "string",
      "intent": "string",
      "visuals": {
        "location": "string",
        "characters": ["string"],
        "props": ["string"],
        "visual_message": ["string"]
      },
      "audio": {
        "narration": "string",
        "dialogues": [ { "character": "string", "line": "string" } ],
        "sfx": ["string"]
      }
    }
  ]
}

【输出限制】
- 仅输出一个JSON对象，必须可被机器解析。
- 严禁输出解释、注释、占位符或多余文本。
`;
  
  const button = event.target.closest('button');
  button.disabled = true;
  button.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

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
        model: "google/gemini-2.5-pro-preview", // 使用Flash模型可能更快更经济
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
      console.error("Failed to parse JSON from AI response:", jsonString);
      throw new Error("AI response was not valid JSON.");
    }

    // 更新段落的 sections
    if (parsedJson && Array.isArray(parsedJson.sections)) {
      paragraph.sections = parsedJson.sections;
      showNotification(`Successfully generated ${parsedJson.sections.length} sections!`, 'success');
      renderTreeMod(); // 重新渲染以反映变化
    } else {
      throw new Error("Invalid sections data received from AI.");
    }

  } catch (error) {
    showNotification(`Failed to generate sections: ${error.message}`, 'error');
    console.error("Section Generation Error:", error);
  } finally {
    const button = event.target.closest('button');
    if (button) {
      button.disabled = false;
      button.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i>`;
    }
    if (paragraphNode) {
      paragraphNode.classList.remove('generating');
    }
  }
}
window.generateSectionsForParagraph = generateSectionsForParagraph;


// ============ 高亮和置顶全局元信息 ============
function highlightAndSortGlobalMeta(section) {
  const visuals = section.visuals || {};
  const audio = section.audio || {};
  
  // 获取当前section使用的元信息
  const usedCharacters = new Set(visuals.characters || []);
  const usedLocations = new Set(visuals.location ? [visuals.location] : []);
  const usedProps = new Set(visuals.props || []);
  
  // 从对话中提取角色
  if (audio.dialogues) {
    audio.dialogues.forEach(d => {
      if (d.character) usedCharacters.add(d.character);
    });
  }
  
  // 处理三个列表
  animateSortList('#asideCharacters', usedCharacters);
  animateSortList('#asideLocations', usedLocations);
  animateSortList('#asideProps', usedProps);
}

function animateSortList(selector, usedSet) {
  const container = $(selector);
  if (!container) return;
  
  const items = Array.from(container.children);
  if (items.length === 0) return;
  
  // 记录原始位置
  const originalPositions = new Map();
  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    originalPositions.set(item, rect.top);
  });
  
  // 分离已使用和未使用的项目
  const usedItems = [];
  const unusedItems = [];
  
  items.forEach(item => {
    const value = item.dataset.value || item.textContent;
    
    // 移除之前的高亮
    item.classList.remove('meta-item-highlighted', 'meta-item-faded');
    
    if (usedSet.has(value)) {
      usedItems.push(item);
      item.classList.add('meta-item-highlighted');
    } else {
      unusedItems.push(item);
      item.classList.add('meta-item-faded');
    }
  });
  
  // 重新排序：先显示使用的，再显示未使用的
  const sortedItems = [...usedItems, ...unusedItems];
  
  // 清空容器并重新添加
  container.innerHTML = '';
  sortedItems.forEach(item => container.appendChild(item));
  
  // 计算新位置并应用动画
  sortedItems.forEach(item => {
    const newRect = item.getBoundingClientRect();
    const oldTop = originalPositions.get(item);
    const deltaY = oldTop - newRect.top;
    
    if (Math.abs(deltaY) > 1) {
      // 设置初始位置
      item.style.transform = `translateY(${deltaY}px)`;
      item.style.transition = 'none';
      
      // 强制重绘
      item.offsetHeight;
      
      // 应用动画
      item.style.transform = '';
      item.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  });
  
  // 清理过渡样式
  setTimeout(() => {
    sortedItems.forEach(item => {
      item.style.transform = '';
      item.style.transition = '';
    });
  }, 400);
}

// 清除高亮（当没有选中section时调用）
function clearGlobalMetaHighlight() {
  ['#asideCharacters', '#asideLocations', '#asideProps'].forEach(selector => {
    const container = $(selector);
    if (!container) return;
    
    Array.from(container.children).forEach(item => {
      item.classList.remove('meta-item-highlighted', 'meta-item-faded');
    });
  });
}

// 导出函数供外部调用
window.highlightAndSortGlobalMeta = highlightAndSortGlobalMeta;
window.clearGlobalMetaHighlight = clearGlobalMetaHighlight;
window.clearCanvas = clearCanvasMod;
