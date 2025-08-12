// ============ 全局状态管理 ============
const state = {
  story: null,  // 当前故事对象
  selectedSectionId: null  // 当前选中的section
};

// ============ 工具函数 ============
function $(selector) { return document.querySelector(selector); }
function $all(selector) { return document.querySelectorAll(selector); }

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

function safeJsonParse(text) {
  try { return [JSON.parse(text), null]; } catch (e) { return [null, e]; }
}

// ============ JSON结构检测 ============
function detectJsonType(obj) {
  if (!obj || typeof obj !== 'object') return null;
  
  // 检测是否是完整story（必须包含chapters数组）
  if (obj.story && Array.isArray(obj.story.chapters)) {
    return 'story';
  }
  
  // 检测是否是chapter（必须包含paragraphs数组）
  if (obj.meta && Array.isArray(obj.paragraphs)) {
    return 'chapter';
  }
  
  // 检测是否是paragraph（必须包含sections数组）
  if (obj.meta && Array.isArray(obj.sections)) {
    return 'paragraph';
  }
  
  return null;
}

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
  renderTree();
}

// ============ 渲染目录树 ============
function renderTree() {
  const container = $('#shotTree');
  container.innerHTML = '';
  
  if (!state.story) {
    initEmptyStory();
    return;
  }
  
  // 显示故事标题
  const storyHeader = document.createElement('div');
  storyHeader.className = 'story-header';
  storyHeader.innerHTML = `
    <i class="fas fa-book"></i>
    <span class="story-title editable-text" contenteditable="true"
          onblur="updateStoryName(this.textContent)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${state.story.meta?.name || 'Untitled Story'}</span>
  `;
  container.appendChild(storyHeader);
  
  // 如果没有章节，显示空状态
  if (state.story.chapters.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-tree';
    emptyDiv.innerHTML = `
      <div class="empty-card">
        <i class="fas fa-folder-open"></i>
        <div>No chapters yet</div>
        <button class="mini-btn btn-primary" onclick="addNewChapter()">
          <i class="fas fa-plus"></i> Add First Chapter
        </button>
        <div class="btn-group">
          <button class="mini-btn" onclick="openStoryFile()">
            <i class="fas fa-folder-open"></i> Open Story
          </button>
          <button class="mini-btn" onclick="openImportModal('story')">
            <i class="fas fa-file-import"></i> Import Story
          </button>
        </div>
      </div>
    `;
    container.appendChild(emptyDiv);
    return;
  }
  
  // 渲染章节
  state.story.chapters.forEach((chapter, cIdx) => {
    const cDiv = document.createElement('div');
    cDiv.className = 'tree-group editable';
    cDiv.innerHTML = `
      <div class="group-header">
        <span>Chapter ${cIdx + 1}: </span>
        <span class="editable-text" contenteditable="true" 
              onblur="updateChapterTitle(${cIdx}, this.textContent)"
              onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${chapter.meta?.chapter_title || 'Untitled'}</span>
        <button class="delete-btn" onclick="deleteChapter(${cIdx})" title="Delete Chapter">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    container.appendChild(cDiv);
    
    const cUl = document.createElement('ul');
    
    // 渲染段落
    if (chapter.paragraphs && chapter.paragraphs.length > 0) {
      chapter.paragraphs.forEach((paragraph, pIdx) => {
        const pLi = document.createElement('li');
        const pDiv = document.createElement('div');
        pDiv.className = 'node with-delete';
        pDiv.innerHTML = `
          <span class="badge subtle">P${pIdx + 1}</span>
          <strong class="title editable-text" contenteditable="true"
                  onblur="updateParagraphTitle(${cIdx}, ${pIdx}, this.textContent)"
                  onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                  onclick="event.stopPropagation()">${paragraph.meta?.paragraph_title || 'Untitled'}</strong>
          <button class="delete-btn small" onclick="deleteParagraph(${cIdx}, ${pIdx}); event.stopPropagation();" title="Delete Paragraph">
            <i class="fas fa-times"></i>
          </button>
        `;
        pLi.appendChild(pDiv);
        
        // 渲染sections
        if (paragraph.sections && paragraph.sections.length > 0) {
          const sUl = document.createElement('ul');
          paragraph.sections.forEach((section, sIdx) => {
            const sLi = document.createElement('li');
            const sDiv = document.createElement('div');
            sDiv.className = 'node';
            sDiv.dataset.cIdx = cIdx;
            sDiv.dataset.pIdx = pIdx;
            sDiv.dataset.sIdx = sIdx;
            sDiv.onclick = () => selectSection(cIdx, pIdx, sIdx);
            
            const sectionId = `S${sIdx + 1}`;
            const snippet = section.intent || section.adapted_text?.slice(0, 50) || 'Untitled';
            sDiv.innerHTML = `
              <div class="section-content">
                <span class="title">${sectionId}</span>
                <span class="muted">· 
                  <span class="section-text" title="${snippet}">${snippet}</span>
                </span>
              </div>
              <span class="badge">${section._panels?.filter(Boolean).length || 0}/3</span>
              <button class="delete-btn small" onclick="deleteSection(${cIdx}, ${pIdx}, ${sIdx}); event.stopPropagation();" title="Delete Section">
                <i class="fas fa-times"></i>
              </button>
            `;
            sDiv.className += ' with-delete';
            sLi.appendChild(sDiv);
            sUl.appendChild(sLi);
          });
          pLi.appendChild(sUl);
        }
        
        // 段落操作按钮（导入paragraph JSON）
        const pActionLi = document.createElement('li');
        pActionLi.className = 'action-buttons';
        pActionLi.innerHTML = `
          <button class="mini-btn" onclick="openImportModal('paragraph', ${cIdx}, ${pIdx})">
            <i class="fas fa-file-import"></i> Import Paragraph
          </button>
        `;
        pLi.appendChild(pActionLi);
        
        cUl.appendChild(pLi);
      });
    }
    
    // 章节操作按钮
    const cActionLi = document.createElement('li');
    cActionLi.className = 'action-buttons';
    cActionLi.innerHTML = `
      <div class="btn-group">
        <button class="mini-btn" onclick="openImportModal('chapter', ${cIdx})">
          <i class="fas fa-file-import"></i> Import Chapter
        </button>
        <button class="mini-btn btn-primary" onclick="addNewParagraph(${cIdx})">
          <i class="fas fa-plus"></i> New Paragraph
        </button>
      </div>
    `;
    cUl.appendChild(cActionLi);
    
    container.appendChild(cUl);
  });
  
  // 根级文件操作按钮
  const rootActionDiv = document.createElement('div');
  rootActionDiv.className = 'tree-actions';
  rootActionDiv.innerHTML = `
    <button class="mini-btn btn-primary btn-block" onclick="addNewChapter()">
      <i class="fas fa-plus"></i> New Chapter
    </button>
    <div class="btn-group">
      <button class="mini-btn" onclick="openStoryFile()">
        <i class="fas fa-folder-open"></i> Open
      </button>
      <button class="mini-btn" onclick="saveStoryAs()">
        <i class="fas fa-save"></i> Save
      </button>
      <button class="mini-btn" onclick="clearStory()">
        <i class="fas fa-trash"></i> Clear
      </button>
    </div>
  `;
  container.appendChild(rootActionDiv);
  
  updateEntities();
}

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
      "section_id": "B01",
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
  renderTree();
  showNotification('Import successful', 'success');
}

// ============ 导入处理函数 ============
function importStory(storyObj) {
  // 完全替换当前story，保留原始的story_id
  const originalStoryId = storyObj.story?.meta?.story_id || storyObj.meta?.story_id;
  state.story = {
    meta: {
      ...(storyObj.story?.meta || storyObj.meta || {}),
      story_id: originalStoryId || "new_story"
    },
    chapters: []
  };
  
  storyObj.story.chapters.forEach((chapter, cIdx) => {
    const newChapter = {
      meta: {
        ...chapter.meta,
        chapter_index: cIdx,  // 从0开始
        chapter_id: `C${cIdx}`
      },
      paragraphs: []
    };
    
    if (chapter.paragraphs) {
      chapter.paragraphs.forEach((paragraph, pIdx) => {
        const newParagraph = {
          meta: {
            ...paragraph.meta,
            chapter_index: cIdx,  // 从0开始
            paragraph_index: pIdx,  // 从0开始
            paragraph_id: `C${cIdx}_P${pIdx}`
          },
          sections: []
        };
        
        if (paragraph.sections) {
          paragraph.sections.forEach((section, sIdx) => {
            const newSection = {
              ...section,
              section_id: section.section_id || `C${cIdx}_P${pIdx}_S${sIdx}`,
              _panels: section._panels || [null, null, null]
            };
            newParagraph.sections.push(newSection);
          });
        }
        
        newChapter.paragraphs.push(newParagraph);
      });
    }
    
    state.story.chapters.push(newChapter);
  });
}

function importChapter(chapterObj, targetChapterIdx) {
  const cIdx = targetChapterIdx !== null ? targetChapterIdx : state.story.chapters.length;
  
  const newChapter = {
    meta: {
      ...chapterObj.meta,
      chapter_index: cIdx,  // 从0开始
      chapter_id: `C${cIdx}`
    },
    paragraphs: []
  };
  
  if (chapterObj.paragraphs) {
    chapterObj.paragraphs.forEach((paragraph, pIdx) => {
      const newParagraph = {
        meta: {
          ...paragraph.meta,
          chapter_index: cIdx,  // 从0开始
          paragraph_index: pIdx,  // 从0开始
          paragraph_id: `C${cIdx}_P${pIdx}`
        },
        sections: []
      };
      
      if (paragraph.sections) {
        paragraph.sections.forEach((section, sIdx) => {
          const newSection = {
            ...section,
            section_id: section.section_id || `C${cIdx}_P${pIdx}_S${sIdx}`,
            _panels: section._panels || [null, null, null]
          };
          newParagraph.sections.push(newSection);
        });
      }
      
      newChapter.paragraphs.push(newParagraph);
    });
  }
  
  // 替换或追加章节
  if (targetChapterIdx !== null && targetChapterIdx < state.story.chapters.length) {
    state.story.chapters[targetChapterIdx] = newChapter;
  } else {
    state.story.chapters.push(newChapter);
  }
}

function importParagraph(paragraphObj, chapterIdx, targetParagraphIdx) {
  if (chapterIdx === null || chapterIdx >= state.story.chapters.length) return;
  
  const chapter = state.story.chapters[chapterIdx];
  const pIdx = targetParagraphIdx !== null ? targetParagraphIdx : chapter.paragraphs.length;
  
  const newParagraph = {
    meta: {
      ...paragraphObj.meta,
      chapter_index: chapterIdx,  // 从0开始
      paragraph_index: pIdx,  // 从0开始
      paragraph_id: `C${chapterIdx}_P${pIdx}`
    },
    sections: []
  };
  
  if (paragraphObj.sections) {
    paragraphObj.sections.forEach((section, sIdx) => {
      const newSection = {
        ...section,
        section_id: section.section_id || `C${chapterIdx}_P${pIdx}_S${sIdx}`,
        _panels: section._panels || [null, null, null]
      };
      newParagraph.sections.push(newSection);
    });
  }
  
  // 替换或追加段落
  if (targetParagraphIdx !== null && targetParagraphIdx < chapter.paragraphs.length) {
    chapter.paragraphs[targetParagraphIdx] = newParagraph;
  } else {
    chapter.paragraphs.push(newParagraph);
  }
}

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
  renderTree();
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
  renderTree();
}

// ============ Section选择和编辑 ============
function selectSection(cIdx, pIdx, sIdx) {
  const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
  if (!section) return;
  
  state.selectedSectionId = section.section_id;
  
  $('#editorEmpty').classList.add('hidden');
  $('#editorPanel').classList.remove('hidden');
  
  // 保存当前编辑的section索引
  state.currentSection = { cIdx, pIdx, sIdx };
  
  // 更新编辑器内容
  $('#editorTitle').innerHTML = `
    ${section.section_id} · 
    <span class="editable-text" contenteditable="true"
          onblur="updateSectionIntentFromEditor(this.textContent)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
          style="font-weight: normal;">${section.intent || 'Untitled'}</span>
  `;
  $('#intentText').textContent = section.intent || '';
  $('#adaptedText').textContent = section.adapted_text || '';
  
  // 更新元信息
  const visuals = section.visuals || {};
  const audio = section.audio || {};
  
  renderList('#metaCharacters', visuals.characters || []);
  renderList('#metaProps', visuals.props || []);
  renderList('#metaLocation', visuals.location ? [visuals.location] : []);
  renderList('#metaVisuals', visuals.visual_message || []);
  renderList('#metaNarration', audio.narration ? [audio.narration] : []);
  renderList('#metaDialogues', (audio.dialogues || []).map(d => `${d.character}: ${d.line}`));
  renderList('#metaSfx', audio.sfx || []);
  
  updatePanelSlots(section);
  highlightActiveNode();
  
  // 高亮和置顶右侧全局元信息
  highlightAndSortGlobalMeta(section);
}

function renderList(selector, items) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

function highlightActiveNode() {
  $all('.tree .node').forEach(n => n.classList.remove('active'));
  if (state.selectedSectionId) {
    $all('.tree .node').forEach(n => {
      const section = state.story.chapters[n.dataset.cIdx]?.paragraphs[n.dataset.pIdx]?.sections[n.dataset.sIdx];
      if (section && section.section_id === state.selectedSectionId) {
        n.classList.add('active');
      }
    });
  }
}

// ============ 实体统计 ============
function updateEntities() {
  const entities = {
    characters: new Set(),
    locations: new Set(),
    props: new Set()
  };
  
  // 检查是否有有效的故事和章节
  if (state.story && state.story.chapters) {
    state.story.chapters.forEach(chapter => {
      chapter.paragraphs?.forEach(paragraph => {
        paragraph.sections?.forEach(section => {
          const v = section.visuals || {};
          (v.characters || []).forEach(c => entities.characters.add(c));
          if (v.location) entities.locations.add(v.location);
          (v.props || []).forEach(p => entities.props.add(p));
        });
      });
    });
  }
  
  // 更新右侧统计
  updateEntityList('#asideCharacters', entities.characters);
  updateEntityList('#asideLocations', entities.locations);
  updateEntityList('#asideProps', entities.props);
  
  const charCountEl = $('#asideCountCharacters');
  const locCountEl = $('#asideCountLocations');
  const propCountEl = $('#asideCountProps');
  
  if (charCountEl) charCountEl.textContent = entities.characters.size;
  if (locCountEl) locCountEl.textContent = entities.locations.size;
  if (propCountEl) propCountEl.textContent = entities.props.size;
}

function updateEntityList(selector, set) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = '';
  Array.from(set).sort().forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    li.dataset.value = item; // 添加data属性便于后续查找
    el.appendChild(li);
  });
}

// ============ 面板管理 ============
function createPanelSlots() {
  // 新的大画布区域已在HTML中定义
  initCanvasArea();
  initTabSwitching();
}

// 初始化画布区域
function initCanvasArea() {
  const placeholder = $('.canvas-placeholder');
  const fileInput = $('#canvasFileInput');
  
  if (placeholder && fileInput) {
    placeholder.addEventListener('click', () => fileInput.click());
    
    // 拖拽上传
    const canvasArea = $('.canvas-area');
    canvasArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      canvasArea.classList.add('dragover');
    });
    
    canvasArea.addEventListener('dragleave', () => {
      canvasArea.classList.remove('dragover');
    });
    
    canvasArea.addEventListener('drop', (e) => {
      e.preventDefault();
      canvasArea.classList.remove('dragover');
      // 处理文件上传
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageUpload(files[0]);
      }
    });
  }
}

// 初始化标签页切换（已移除标签页设计）
function initTabSwitching() {
  // 标签页功能已移除，所有信息同时展示
}

function updatePanelSlots(section) {
  const slots = $all('.panel-slot');
  const panels = section._panels || [null, null, null];
  
  slots.forEach((slot, idx) => {
    const url = panels[idx];
    if (url) {
      slot.innerHTML = `
        <img src="${url}" alt="Panel ${idx + 1}">
        <button class="remove-btn" onclick="removePanel(${idx})">Remove</button>
      `;
    }
  });
}

function handleImageUpload(file) {
  // 实现图片上传逻辑
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      // 显示图片预览
      const canvasArea = $('.canvas-area');
      canvasArea.innerHTML = `
        <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">
        <button class="remove-btn" onclick="clearCanvas()" style="position: absolute; top: 10px; right: 10px;">
          <i class="fas fa-times"></i> 清除
        </button>
      `;
    };
    reader.readAsDataURL(file);
  }
}

function clearCanvas() {
  const canvasArea = $('.canvas-area');
  canvasArea.innerHTML = `
    <div class="canvas-placeholder">
      <i class="fas fa-cloud-upload-alt"></i>
      <p>拖拽图片到此处或点击上传</p>
      <input type="file" accept="image/*" multiple style="display: none;" id="canvasFileInput">
    </div>
  `;
  initCanvasArea();
}

function removePanel(index) {
  // 实现移除面板逻辑
}

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', () => {
  // 初始化空故事
  initEmptyStory();
  
  // 创建面板槽位
  createPanelSlots();
  
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
});

// ============ 文件操作 ============
async function openStoryFile() {
  try {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const text = await file.text();
      const [obj, err] = safeJsonParse(text);
      
      if (err) {
        showNotification('Invalid JSON file', 'error');
        return;
      }
      
      const jsonType = detectJsonType(obj);
      if (jsonType !== 'story') {
        showNotification('File must contain a complete story structure', 'error');
        return;
      }
      
      importStory(obj);
      renderTree();
      showNotification('Story loaded successfully', 'success');
    };
    
    input.click();
  } catch (e) {
    showNotification('Failed to open file', 'error');
  }
}

async function saveStoryAs() {
  if (!state.story) {
    showNotification('No story to save', 'error');
    return;
  }
  
  const storyData = {
    story: state.story
  };
  
  const jsonText = JSON.stringify(storyData, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.story.meta?.name || 'story'}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showNotification('Story saved successfully', 'success');
}

function clearStory() {
  if (confirm('Are you sure you want to clear the entire story?')) {
    initEmptyStory();
    updateEntities(); // 清空实体统计
    showNotification('Story cleared', 'info');
  }
}

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
  
  renderTree();
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
  
  renderTree();
  showNotification('Paragraph deleted', 'info');
}

function deleteSection(cIdx, pIdx, sIdx) {
  if (!confirm(`Delete Section ${sIdx + 1}?`)) return;
  
  const paragraph = state.story.chapters[cIdx]?.paragraphs[pIdx];
  if (!paragraph) return;
  
  paragraph.sections.splice(sIdx, 1);
  
  // 保留原有的section_id，不重新分配
  
  renderTree();
  showNotification('Section deleted', 'info');
}

// 导出全局函数供HTML调用
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.parseImportJson = parseImportJson;
window.addNewChapter = addNewChapter;
window.addNewParagraph = addNewParagraph;
window.selectSection = selectSection;
window.removePanel = removePanel;
window.openStoryFile = openStoryFile;
window.saveStoryAs = saveStoryAs;
window.clearStory = clearStory;
window.updateStoryName = updateStoryName;
window.updateChapterTitle = updateChapterTitle;
window.updateParagraphTitle = updateParagraphTitle;
window.deleteChapter = deleteChapter;
window.deleteParagraph = deleteParagraph;
window.deleteSection = deleteSection;

// 添加section intent更新函数 - 从编辑器更新
function updateSectionIntentFromEditor(newIntent) {
  if (!state.currentSection) return;
  
  const { cIdx, pIdx, sIdx } = state.currentSection;
  const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
  if (!section) return;
  
  section.intent = newIntent.trim() || 'Untitled';
  
  // 只更新目录树中对应节点的文本，避免重新渲染整个树
  const nodes = $all('.tree .node');
  nodes.forEach(node => {
    if (node.dataset.cIdx == cIdx && 
        node.dataset.pIdx == pIdx && 
        node.dataset.sIdx == sIdx) {
      const textEl = node.querySelector('.section-text');
      if (textEl) {
        const snippet = section.intent || section.adapted_text?.slice(0, 50) || 'Untitled';
        textEl.textContent = snippet;
        textEl.title = snippet;
      }
    }
  });
  
  showNotification('Section intent updated', 'success');
}
window.updateSectionIntentFromEditor = updateSectionIntentFromEditor;

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
window.clearCanvas = clearCanvas;
