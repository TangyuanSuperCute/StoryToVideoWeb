// ============ 全局状态（重构为 chapter - paragraph - section 语义） ============
const state = {
  story: null,              // 顶层故事对象（聚合多章节）
  selectedSectionId: null,  // 当前选中的 section_id
};

// 示例 section JSON（与需求一致，截断版）
const SAMPLE_JSON = {
  meta: {
    source_id: "1",
    chapter_index: 1,
    chapter_title: "雾中路口",
    paragraph_index: 1,
    paragraph_title: "躲雨开机",
    section_budget: 2,
    actual_sections: 2
  },
  sections: [
    {
      section_id: "B01",
      adapted_text: "示例小节1……",
      intent: "建立氛围",
      visuals: { location: "高架匝道", characters: ["简北"], props: ["MiniDV"], visual_message: ["雾压低色温"] },
      audio: { narration: "旁白……", dialogues: [], sfx: ["雨声"] }
    },
    {
      section_id: "B02",
      adapted_text: "示例小节2……",
      intent: "进入记录",
      visuals: { location: "立柱背风面", characters: ["简北"], props: ["MiniDV"], visual_message: ["对焦锁∞"] },
      audio: { narration: "旁白……", dialogues: [], sfx: ["拨片声"] }
    }
  ]
};

// 期望JSON格式字符串（展示到弹窗中）
const SAMPLE_FORMAT = `{
  "meta": {
    "source_id": "1",
    "chapter_index": 1,
    "chapter_title": "……",
    "paragraph_index": 1,
    "paragraph_title": "……",
    "section_budget": 6,
    "actual_sections": 6
  },
  "sections": [
    {
      "section_id": "B01",
      "adapted_text": "……",
      "intent": "……",
      "visuals": {
        "location": "……",
        "characters": ["……"],
        "props": ["……"],
        "visual_message": ["……"]
      },
      "audio": {
        "narration": "……",
        "dialogues": [ { "character": "……", "line": "……" } ],
        "sfx": ["……"]
      }
    }
  ]
}`;

// ============ 工具函数 ============
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 12px 16px;
    border-radius: 8px; color: #fff; font-weight: 600; z-index: 10000;
    transform: translateX(120%); transition: transform .25s ease; max-width: 320px;
    box-shadow: 0 6px 22px rgba(0,0,0,.2);
  `;
  notification.style.background = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#6366f1');
  document.body.appendChild(notification);
  requestAnimationFrame(() => notification.style.transform = 'translateX(0)');
  setTimeout(() => {
    notification.style.transform = 'translateX(120%)';
    setTimeout(() => notification.remove(), 250);
  }, 2600);
}

function $(selector) { return document.querySelector(selector); }
function $all(selector) { return document.querySelectorAll(selector); }

function safeJsonParse(text) {
  try { return [JSON.parse(text), null]; } catch (e) { return [null, e]; }
}

// ============ 初始化UI ============
document.addEventListener('DOMContentLoaded', () => {
  // 顶部按钮已移除，核心入口保留在目录空态和段落节点

  // 模态框
  $('#modalClose').addEventListener('click', closeImportModal);
  $('#modalCancel').addEventListener('click', closeImportModal);
  $('#modalParse').addEventListener('click', parseFromModal);
  $('#jsonExample').textContent = SAMPLE_FORMAT;

  // 搜索
  $('#treeSearch').addEventListener('input', filterTree);

  // 初始化右侧3个面板槽
  createPanelSlots();

  // 初始化为空故事
  if (!state.story) newProject();

  // 初始绑定“新建章”按钮（避免首次未渲染目录时无事件）
  const addChapterBtn = $('#btnNewChapter');
  if (addChapterBtn) addChapterBtn.addEventListener('click', addNewChapter);

  // 背景点击关闭任意弹窗
  $all('.modal').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  });

  // 事件委托（兜底，防止局部监听失效）
  document.body.addEventListener('click', (e) => {
    const id = (e.target && e.target.id) || (e.target.closest && e.target.closest('button') && e.target.closest('button').id);
    if (!id) return;
    if (id === 'modalParse') { parseFromModal(); }
    if (id === 'modalClose' || id === 'modalCancel') { closeImportModal(); }
    if (id === 'entitiesClose' || id === 'entitiesOk') { closeEntitiesModal(); }
  });
});

// ============ Tree（chapter - paragraph - section 层级） ============
function renderTree() {
  const container = $('#shotTree');
  container.innerHTML = '';
  if (!state.story) return;

  // 缺省时创建默认 chapter/paragraph
  if (!Array.isArray(state.story.chapters)) {
    const sections = (state.story.sections || []).map(s => s); // 兼容单段导入
    state.story.chapters = [ { id: 'C1', title: state.story.meta?.chapter_title || 'Chapter 1', paragraphs: [ { id: 'P1', title: state.story.meta?.paragraph_title || 'Paragraph 1', sections }] } ];
    delete state.story.sections;
  }

  // 空目录时显示导入JSON按钮
  const hasAny = state.story.chapters.some(c => (c.paragraphs||[]).some(p => (p.sections||[]).length > 0));
  if (!hasAny) {
    const wrapper = document.createElement('div');
    wrapper.className = 'empty-tree';
    wrapper.innerHTML = `<div class="empty-card">
      <i class="fas fa-file-import"></i>
      <div>当前目录为空，可导入 JSON</div>
      <button class="mini-btn" id="emptyImportBtn"><i class="fas fa-file-import"></i> 导入JSON</button>
    </div>`;
    container.appendChild(wrapper);
    const btn = wrapper.querySelector('#emptyImportBtn');
    btn.addEventListener('click', openImportModal);
  }

  state.story.chapters.forEach((chapter, cIdx) => {
    const cHeader = document.createElement('div');
    cHeader.className = 'tree-group';
    cHeader.textContent = chapter.title || `Chapter ${cIdx+1}`;
    container.appendChild(cHeader);

    const cUl = document.createElement('ul');

    (chapter.paragraphs || []).forEach((paragraph, pIdx) => {
      const pLi = document.createElement('li');
      const pHeader = document.createElement('div');
      pHeader.className = 'node';
      const pIndexLabel = `P${String(pIdx + 1).padStart(2,'0')}`;
      pHeader.innerHTML = `<span class="badge subtle">${pIndexLabel}</span> <strong class="title">${paragraph.title || 'Paragraph'}</strong>`;
      pLi.appendChild(pHeader);

      const pUl = document.createElement('ul');
      (paragraph.sections || []).forEach((section, sIdx) => {
        const li = document.createElement('li');
        const node = document.createElement('div');
        node.className = 'node';
        node.dataset.id = section.section_id;

        const thumb = document.createElement('img');
        thumb.className = 'thumb';
        const firstPanel = (section._panels || []).find(p => !!p);
        if (firstPanel) { thumb.src = firstPanel; } else { thumb.style.display = 'none'; }

        const titleSpan = document.createElement('span');
        const sIndexLabel = section.section_id || `B${String(sIdx+1).padStart(2,'0')}`;
        const snippet = section.intent || (section.adapted_text ? String(section.adapted_text).slice(0, 18) : '');
        titleSpan.innerHTML = `<span class="title">${sIndexLabel}</span> <span class="muted">${snippet ? '· ' + snippet : ''}</span>`;

        const badge = document.createElement('span');
        badge.className = 'badge';
        const count = (section._panels || []).filter(Boolean).length;
        badge.textContent = `${count}/3`;

        node.appendChild(thumb);
        node.appendChild(titleSpan);
        node.appendChild(badge);
        li.appendChild(node);
        pUl.appendChild(li);

        node.addEventListener('click', () => selectSection(section.section_id));
      });

      // 本段落的导入按钮
      const importLi = document.createElement('li');
      const importBtn = document.createElement('button');
      importBtn.className = 'mini-btn';
      importBtn.innerHTML = '<i class="fas fa-file-import"></i> Import JSON to Paragraph';
      importBtn.addEventListener('click', () => {
        openImportModalAppend();
        $('#jsonModal').dataset.targetChapter = cIdx;
        $('#jsonModal').dataset.targetParagraph = pIdx;
        $('#jsonModal').dataset.targetParagraphId = paragraph.id || '';
      });
      importLi.appendChild(importBtn);
      pUl.appendChild(importLi);

      pLi.appendChild(pUl);
      cUl.appendChild(pLi);
    });

    // 章节级操作：新建段（paragraph）
    const addSectionLi = document.createElement('li');
    const addSectionBtn = document.createElement('button');
    addSectionBtn.className = 'mini-btn';
    addSectionBtn.innerHTML = '<i class="fas fa-square-plus"></i> New Paragraph';
    addSectionBtn.addEventListener('click', () => addNewParagraph(cIdx));
    addSectionLi.appendChild(addSectionBtn);
    cUl.appendChild(addSectionLi);

    container.appendChild(cUl);
  });

  // 根级按钮：新建章
  const addChapterBtn = $('#btnNewChapter');
  if (addChapterBtn) {
    addChapterBtn.onclick = null;
    addChapterBtn.addEventListener('click', addNewChapter);
  }

  highlightActiveNode();
}

function highlightActiveNode() {
  $all('.tree .node').forEach(n => n.classList.remove('active'));
  if (!state.selectedSectionId) return;
  const active = $(`.tree .node[data-id="${state.selectedSectionId}"]`);
  if (active) active.classList.add('active');
}

function filterTree(e) {
  const keyword = e.target.value.trim().toLowerCase();
  $all('#shotTree .node').forEach(node => {
    const text = node.textContent.toLowerCase();
    node.style.display = text.includes(keyword) ? '' : 'none';
  });
}

// ============ 编辑器区域（section 详情） ============
function selectSection(sectionId) {
  state.selectedSectionId = sectionId;
  const section = findSectionById(sectionId);
  if (!section) return;

  $('#editorEmpty').classList.add('hidden');
  $('#editorPanel').classList.remove('hidden');

  // 标题
  $('#editorTitle').textContent = `${section.section_id} · ${section.intent || 'Untitled'}`;

  // intent/adapted_text 展示
  const intentEl = $('#intentText');
  const adaptedEl = $('#adaptedText');
  if (intentEl) intentEl.textContent = section.intent || '';
  if (adaptedEl) adaptedEl.textContent = section.adapted_text || '';

  // meta badges
  const badges = $('#metaBadges');
  badges.innerHTML = '';
  const makeBadge = (label) => { const b = document.createElement('span'); b.className = 'meta-badge'; b.textContent = label; return b; };
  const visuals = section.visuals || {};
  const audio = section.audio || {};
  const characters = visuals.characters || [];
  const props = visuals.props || [];
  const sfx = audio.sfx || [];
  const dialogues = Array.isArray(audio.dialogues) ? audio.dialogues : [];
  badges.appendChild(makeBadge(`${characters.length} 角色`));
  badges.appendChild(makeBadge(`${props.length} 道具`));
  badges.appendChild(makeBadge(`${sfx.length} 音效`));
  badges.appendChild(makeBadge(`${dialogues.length} 对白`));

  // 元信息列表
  renderList('#metaCharacters', characters);
  renderList('#metaProps', props);
  renderList('#metaVisuals', visuals.visual_message || []);
  renderList('#metaSfx', sfx);

  // 地点（单字符串 -> 列表展示）
  const locationStr = visuals.location ? [visuals.location] : [];
  renderList('#metaLocation', locationStr);

  // 旁白
  const narrationList = audio.narration ? [audio.narration] : [];
  renderList('#metaNarration', narrationList);

  // 对白（角色：台词）
  const dialogueList = dialogues.map(d => `${d.character ? d.character + '：' : ''}${d.line || ''}`);
  renderList('#metaDialogues', dialogueList);

  // 面板
  updatePanelSlots(section);
  highlightActiveNode();
}

function renderList(selector, arr) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = '';
  (arr || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

function createPanelSlots() {
  const container = $('#panelSlots');
  container.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('div');
    slot.className = 'panel-slot';
    slot.dataset.index = String(i);

    const hint = document.createElement('div');
    hint.className = 'slot-hint';
    hint.innerHTML = `<i class="fas fa-upload"></i><br/>拖拽图片到此处或点击上传`;

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.addEventListener('change', (e) => handleFileSelect(e, slot));

    ;['dragenter','dragover'].forEach(evt => slot.addEventListener(evt, (e)=>{ e.preventDefault(); slot.classList.add('dragover'); }));
    ;['dragleave','drop'].forEach(evt => slot.addEventListener(evt, (e)=>{ e.preventDefault(); slot.classList.remove('dragover'); }));
    slot.addEventListener('drop', (e)=> handleDrop(e, slot));

    slot.appendChild(hint);
    slot.appendChild(file);
    container.appendChild(slot);
  }
}

function updatePanelSlots(section) {
  const slots = $all('.panel-slot');
  slots.forEach(slot => {
    const idx = Number(slot.dataset.index);
    const url = (section._panels || [])[idx] || null;
    applySlotImage(slot, url);
  });
}

function applySlotImage(slot, url) {
  const oldImg = slot.querySelector('img');
  if (oldImg) oldImg.remove();
  const oldBtn = slot.querySelector('.remove-btn');
  if (oldBtn) oldBtn.remove();

  if (!url) return;
  const img = document.createElement('img');
  img.src = url;
  const btn = document.createElement('button');
  btn.className = 'remove-btn';
  btn.textContent = '移除';
  btn.addEventListener('click', () => removeSlotImage(slot));
  slot.appendChild(img);
  slot.appendChild(btn);
}

function removeSlotImage(slot) {
  if (!state.story || !state.selectedSectionId) return;
  const section = findSectionById(state.selectedSectionId);
  if (!section) return;
  const idx = Number(slot.dataset.index);
  section._panels[idx] = null;
  applySlotImage(slot, null);
  renderTree();
}

function handleFileSelect(e, slot) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setSlotImage(slot, reader.result);
  reader.readAsDataURL(file);
}

function handleDrop(e, slot) {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setSlotImage(slot, reader.result);
  reader.readAsDataURL(file);
}

function setSlotImage(slot, dataUrl) {
  if (!state.story || !state.selectedSectionId) return;
  const section = findSectionById(state.selectedSectionId);
  if (!section) return;
  const idx = Number(slot.dataset.index);
  section._panels[idx] = dataUrl; // base64 便于导出与再导入
  applySlotImage(slot, dataUrl);
  renderTree(); // 更新左侧缩略图与计数
}

// ============ 导入/导出/校验（识别结构并补全） ============
function openImportModal() {
  $('#jsonModal').classList.remove('hidden');
  $('#jsonInput').value = '';
}
function openImportModalAppend() {
  // 与 openImportModal 相同入口，通过标记决定合并
  $('#jsonModal').classList.remove('hidden');
  $('#jsonInput').value = '';
  $('#jsonModal').dataset.mode = 'append';
}
function closeImportModal() { $('#jsonModal').classList.add('hidden'); }

function parseFromModal() {
  const text = $('#jsonInput').value.trim();
  if (!text) { showNotification('请输入JSON', 'error'); return; }
  const [obj, err] = safeJsonParse(text);
  if (err) { showNotification('JSON解析失败', 'error'); return; }
  const kind = detectKind(obj);
  if (!kind) { showNotification('JSON结构不符合要求', 'error'); return; }
  const modal = $('#jsonModal');
  const mode = modal.dataset.mode;
  const targetC = modal.dataset.targetChapter;
  const targetP = modal.dataset.targetParagraph;
  const targetPid = modal.dataset.targetParagraphId;
  if (mode === 'append' && state.story) {
    appendPayload(obj, kind, targetC, targetP, targetPid);
    computeEntities();
    updateEntitiesView();
    renderTree();
    if (state.selectedSectionId) selectSection(state.selectedSectionId);
    showNotification('内容已追加到当前故事', 'success');
  } else {
    loadStoryFromPayload(obj, kind);
  }
  modal.dataset.mode = '';
  modal.dataset.targetChapter = '';
  modal.dataset.targetParagraph = '';
  modal.dataset.targetParagraphId = '';
  closeImportModal();
}

function loadSample() { loadStoryFromPayload(JSON.parse(JSON.stringify(SAMPLE_JSON)), 'section'); }

function loadStoryFromPayload(payload, kind) {
  // 统一规范化
  const story = normalizeToStory(payload, kind);
  state.story = story;
  // 选择第一个 section
  const first = state.story.chapters?.[0]?.paragraphs?.[0]?.sections?.[0];
  state.selectedSectionId = first ? first.section_id : null;
  renderTree();
  if (state.selectedSectionId) selectSection(state.selectedSectionId); else showEmptyEditor();
  showNotification('内容已加载', 'success');
  computeEntities();
  updateEntitiesView();
}

function showEmptyEditor() {
  $('#editorEmpty').classList.remove('hidden');
  $('#editorPanel').classList.add('hidden');
}

function exportJson() {
  if (!state.story) { showNotification('暂无可导出的内容', 'error'); return; }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.story, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = `${(state.story.meta && state.story.meta.source_id) || 'section'}.json`;
  a.click();
}

function clearAll() {
  state.story = null;
  state.selectedSectionId = null;
  $('#shotTree').innerHTML = '';
  showEmptyEditor();
}

// 类型探测：section | paragraph | chapter
function detectKind(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj.sections)) return 'section';
  if (Array.isArray(obj.paragraphs)) return 'paragraph';
  if (Array.isArray(obj.chapters)) return 'chapter';
  return null;
}

// 规范化：将任意层级 payload 规整为 story { meta, chapters: [ { paragraphs: [ { sections: [] } ] } ] }
function normalizeToStory(obj, kind) {
  const clone = JSON.parse(JSON.stringify(obj));
  const ensurePanels = (sec) => {
    if (!Array.isArray(sec._panels)) sec._panels = [null, null, null];
    if (sec._panels.length < 3) sec._panels = [...sec._panels, ...Array(3 - sec._panels.length).fill(null)];
    if (sec._panels.length > 3) sec._panels = sec._panels.slice(0, 3);
  };

  let chapters = [];
  if (kind === 'section') {
    const meta = clone.meta || {};
    const sections = (clone.sections || []).map(s => (ensurePanels(s), s));
    chapters = [ { id: 'C1', title: meta.chapter_title || `第${meta.chapter_index||1}章`, paragraphs: [ { id: 'P1', title: meta.paragraph_title || `第${meta.paragraph_index||1}段`, sections } ] } ];
    return { meta, chapters };
  }
  if (kind === 'paragraph') {
    const meta = clone.meta || {};
    const paragraphs = (clone.paragraphs || []).map(p => ({
      id: p.id || `P${Math.random().toString(36).slice(2,7)}`,
      title: p.title || '未命名段',
      sections: (p.sections || []).map(s => (ensurePanels(s), s))
    }));
    chapters = [ { id: 'C1', title: meta.chapter_title || `第${meta.chapter_index||1}章`, paragraphs } ];
    return { meta, chapters };
  }
  if (kind === 'chapter') {
    chapters = (clone.chapters || []).map((c, idx) => ({
      id: c.id || `C${idx+1}`,
      title: c.title || `第${idx+1}章`,
      paragraphs: (c.paragraphs || []).map((p, pIdx) => ({
        id: p.id || `P${pIdx+1}`,
        title: p.title || `第${pIdx+1}段`,
        sections: (p.sections || []).map(s => (ensurePanels(s), s))
      }))
    }));
    const meta = clone.meta || {};
    return { meta, chapters };
  }
  return { meta: clone.meta || {}, chapters: [] };
}

// ============ 故事项目：新建/追加/打开/保存 ============
function newProject() {
  state.story = { meta: {}, chapters: [] };
  state.selectedSectionId = null;
  $('#shotTree').innerHTML = '';
  showEmptyEditor();
  computeEntities();
  showNotification('已新建空故事', 'success');
}

function appendPayload(obj, kind, targetChapterIdx, targetParagraphIdx, targetParagraphId) {
  if (!state.story) state.story = { meta: {}, chapters: [] };
  if (!Array.isArray(state.story.chapters) || state.story.chapters.length === 0) {
    state.story.chapters = [ { id: 'C1', title: '第1章', paragraphs: [ { id: 'P1', title: '第1段', sections: [] } ] } ];
  }

  const cIdx = Number.isInteger(+targetChapterIdx) ? +targetChapterIdx : 0;
  let pIdx = Number.isInteger(+targetParagraphIdx) ? +targetParagraphIdx : null;
  // 优先用 paragraphId 精确定位
  let paragraph = null;
  const chapter = state.story.chapters[cIdx];
  if (!chapter) return;
  
  // 优先使用 paragraphId 查找
  if (targetParagraphId) {
    paragraph = (chapter.paragraphs || []).find(p => p.id === targetParagraphId) || null;
  }
  
  // 如果没找到，使用索引查找
  if (!paragraph && pIdx !== null) {
    paragraph = chapter.paragraphs?.[pIdx] || null;
  }
  
  // 如果还是没找到，说明出错了，不应该创建新的
  if (!paragraph) {
    showNotification('找不到目标段落，请重试', 'error');
    return;
  }

  // 统一转换为 sections 数组
  const normalized = normalizeToStory(obj, kind);
  const incomingSections = (normalized.chapters?.[0]?.paragraphs?.[0]?.sections) || [];

  const existingIds = new Set(
    state.story.chapters.flatMap(c => (c.paragraphs||[]) 
      .flatMap(p => (p.sections||[]).map(s => s.section_id)))
  );

  incomingSections.forEach(src => {
    const section = JSON.parse(JSON.stringify(src));
    // 校验：是否结构完全满足当前层级（section）
    if (!section.section_id || !section.visuals || !section.audio) {
      showNotification(`无法导入：结构不满足 section 要求`, 'error');
      return;
    }
    // 冲突处理：section_id 冲突则加后缀并写回
    let id = section.section_id;
    let suffix = 2;
    while (existingIds.has(id)) { id = `${section.section_id}#${suffix++}`; }
    if (id !== section.section_id) section.section_id = id;
    existingIds.add(id);
    // panels 规范化
    if (!Array.isArray(section._panels)) section._panels = [null, null, null];
    if (section._panels.length < 3) section._panels = [...section._panels, ...Array(3 - section._panels.length).fill(null)];
    if (section._panels.length > 3) section._panels = section._panels.slice(0, 3);
    paragraph.sections.push(section);
  });

  // 若之前没有选中，则选中第一个 section
  const first = state.story.chapters[0]?.paragraphs?.[0]?.sections?.[0];
  if (!state.selectedSectionId && first) state.selectedSectionId = first.section_id;
}

async function openLocalFile() {
  try {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
      const file = await handle.getFile();
      const text = await file.text();
      const [obj, err] = safeJsonParse(text);
      const kind = detectKind(obj);
      if (err || !kind) { showNotification('文件不是有效故事JSON', 'error'); return; }
      loadStoryFromPayload(obj, kind);
    } else {
      // 退化：使用隐藏的input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const text = await file.text();
        const [obj, err] = safeJsonParse(text);
        const kind = detectKind(obj);
        if (err || !kind) { showNotification('文件不是有效故事JSON', 'error'); return; }
        loadStoryFromPayload(obj, kind);
      };
      input.click();
    }
  } catch (e) {
    showNotification('打开文件失败', 'error');
  }
}

async function saveProject() {
  if (!state.story) { showNotification('无内容可保存', 'error'); return; }
  const jsonText = JSON.stringify(state.story, null, 2);
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: 'story.json', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      await writable.write(jsonText);
      await writable.close();
      showNotification('已保存到本地', 'success');
    } else {
      const a = document.createElement('a');
      a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonText);
      a.download = 'story.json';
      a.click();
    }
  } catch (e) {
    showNotification('保存失败', 'error');
  }
}

// ============ 实体总览 ============
const entities = { characters: new Set(), locations: new Set(), props: new Set() };

function computeEntities() {
  entities.characters.clear();
  entities.locations.clear();
  entities.props.clear();
  if (!state.story) return;
  const iterate = (sectionsArr) => sectionsArr.forEach(b => {
    const v = b.visuals || {};
    (v.characters || []).forEach(x => x && entities.characters.add(String(x)));
    if (v.location) entities.locations.add(String(v.location));
    (v.props || []).forEach(x => x && entities.props.add(String(x)));
  });
  if (Array.isArray(state.story.chapters)) {
    state.story.chapters.forEach(c => (c.paragraphs||[]).forEach(p => iterate(p.sections||[])));
  }
}

function openEntitiesModal() { $('#entitiesModal').classList.remove('hidden'); }
function closeEntitiesModal() { $('#entitiesModal').classList.add('hidden'); }

function updateEntitiesView() {
  const toList = (selector, set) => {
    const el = $(selector); if (!el) return;
    el.innerHTML = '';
    Array.from(set).sort().forEach(item => { const li = document.createElement('li'); li.textContent = item; el.appendChild(li); });
  };
  toList('#entitiesCharacters', entities.characters);
  toList('#entitiesLocations', entities.locations);
  toList('#entitiesProps', entities.props);
  const setText = (sel, n) => { const el = $(sel); if (el) el.textContent = String(n); };
  setText('#countCharacters', entities.characters.size);
  setText('#countLocations', entities.locations.size);
  setText('#countProps', entities.props.size);

  // 同步到右侧固定元信息区
  toList('#asideCharacters', entities.characters);
  toList('#asideLocations', entities.locations);
  toList('#asideProps', entities.props);
  setText('#asideCountCharacters', entities.characters.size);
  setText('#asideCountLocations', entities.locations.size);
  setText('#asideCountProps', entities.props.size);
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtns = ['#entitiesClose', '#entitiesOk'];
  closeBtns.forEach(sel => { const btn = $(sel); if (btn) btn.addEventListener('click', closeEntitiesModal); });
});

// ============ 目录交互：新建章/新建段/新建节(section) ============
function addNewChapter() {
  if (!state.story) state.story = { meta: {}, chapters: [] };
  if (!Array.isArray(state.story.chapters)) state.story.chapters = [];
  const id = `C${state.story.chapters.length + 1}`;
  state.story.chapters.push({ id, title: `Chapter ${state.story.chapters.length + 1}`, paragraphs: [] });
  renderTree();
}

function addNewParagraph(chapterIdx) {
  const c = state.story?.chapters?.[chapterIdx];
  if (!c) return;
  const pNum = (c.paragraphs?.length || 0) + 1;
  const id = `P${chapterIdx}_${pNum}`;  // 使用唯一ID格式，避免冲突
  c.paragraphs = c.paragraphs || [];
  c.paragraphs.push({ id, title: `Paragraph ${pNum}`, sections: [] });
  renderTree();
}

function addNewSection(chapterIdx, paragraphIdx) {
  const p = state.story?.chapters?.[chapterIdx]?.paragraphs?.[paragraphIdx];
  if (!p) return;
  const idNum = (p.sections?.length || 0) + 1;
  p.sections = p.sections || [];
  p.sections.push({ section_id: `B${String(idNum).padStart(2,'0')}`, title: `Section ${idNum}`, adapted_text: '', intent: '', visuals: { characters: [], props: [], visual_message: [] }, audio: { narration: '', dialogues: [], sfx: [] }, _panels: [null,null,null] });
  renderTree();
}

// 工具：根据 section_id 全局查找 section
function findSectionById(id) {
  for (const c of state.story?.chapters || []) {
    for (const p of c.paragraphs || []) {
      for (const s of p.sections || []) {
        if (s.section_id === id) return s;
      }
    }
  }
  return null;
}
