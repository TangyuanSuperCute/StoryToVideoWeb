import { state } from './state.js';
import { $, $all } from './utils.js';
import { updatePanelSlots } from './panels.js';
import { highlightActiveNode } from './treeRender.js';

export function selectSection(uniqueId) {
  if (!uniqueId) return;
  const [cIdx, pIdx, sIdx] = uniqueId.split('-').map(Number);
  const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
  if (!section) return;
  state.selectedSectionId = uniqueId;
  $('#editorEmpty').classList.add('hidden');
  $('#editorPanel').classList.remove('hidden');
  state.currentSection = { cIdx, pIdx, sIdx };
  const displaySectionId = section.section_id.replace(/^B/i, 'S');
  $('#editorTitle').innerHTML = `
    <div class="section-id-badge">${displaySectionId}</div>
    <div class="editable-text section-intent-text" contenteditable="true">${section.intent || '未命名'}</div>
  `;
  // 绑定编辑事件，替代内联 onblur/onkeydown
  const intentEl = document.querySelector('.section-intent-text');
  if (intentEl) {
    intentEl.addEventListener('blur', () => updateSectionIntentFromEditor(intentEl.textContent));
    intentEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); intentEl.blur(); }
    });
  }
  $('#intentText').textContent = section.intent || '';
  $('#adaptedText').textContent = section.adapted_text || '';
  const visuals = section.visuals || {};
  const audio = section.audio || {};
  // 新规范：仅使用 subjects 结构
  const subjects = visuals.subjects || {};
  const characters = (subjects.characters || []).map(s => (s || '').trim()).filter(Boolean);
  const items = (subjects.items || []).map(s => (s || '').trim()).filter(Boolean);
  const locations = (subjects.locations || []).map(s => (s || '').trim()).filter(Boolean);
  renderList('#metaCharacters', characters);
  renderList('#metaProps', items);
  renderList('#metaLocation', locations);
  renderList('#metaVisuals', visuals.visual_message || []);
  renderList('#metaNarration', audio.narration ? [audio.narration] : []);
  renderList('#metaDialogues', (audio.dialogues || []).map(d => `${d.character}: ${d.line}`));
  renderList('#metaSfx', audio.sfx || []);

  // 更新画布与高亮树节点
  updatePanelSlots(section);
  highlightActiveNode();

  // 高亮右侧全局元信息
  highlightAndSortGlobalMeta(section);

  // 渲染分镜编辑区
  renderStoryboardEditor(section);
}

export function renderList(selector, items) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

export function updateSectionIntentFromEditor(newIntent) {
  if (!state.currentSection) return;
  const { cIdx, pIdx, sIdx } = state.currentSection;
  const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
  if (!section) return;
  section.intent = newIntent.trim() || 'Untitled';
  const nodes = $all('.tree .node');
  nodes.forEach(node => {
    if (node.dataset.cIdx == cIdx && node.dataset.pIdx == pIdx && node.dataset.sIdx == sIdx) {
      const textEl = node.querySelector('.section-text');
      if (textEl) {
        const snippet = section.intent || section.adapted_text?.slice(0, 50) || 'Untitled';
        textEl.textContent = snippet;
        textEl.title = snippet;
      }
    }
  });
}

// ============ 高亮和置顶全局元信息 ============
export function highlightAndSortGlobalMeta(section) {
  const visuals = section.visuals || {};
  const audio = section.audio || {};
  const subjects = visuals.subjects || {};
  const usedCharacters = new Set(subjects.characters || []);
  const usedLocations = new Set(subjects.locations || []);
  const usedProps = new Set(subjects.items || []);
  if (audio.dialogues) {
    audio.dialogues.forEach(d => { if (d.character) usedCharacters.add(d.character); });
  }
  animateSortList('#asideCharacters', usedCharacters);
  animateSortList('#asideLocations', usedLocations);
  animateSortList('#asideProps', usedProps);
}

export function animateSortList(selector, usedSet) {
  const container = $(selector);
  if (!container) return;
  const items = Array.from(container.children);
  if (items.length === 0) return;
  const originalPositions = new Map();
  items.forEach(item => { originalPositions.set(item, item.getBoundingClientRect().top); });
  const usedItems = []; const unusedItems = [];
  items.forEach(item => {
    const value = item.dataset.value || item.textContent;
    item.classList.remove('meta-item-highlighted', 'meta-item-faded');
    if (usedSet.has(value)) { usedItems.push(item); item.classList.add('meta-item-highlighted'); }
    else { unusedItems.push(item); item.classList.add('meta-item-faded'); }
  });
  const sortedItems = [...usedItems, ...unusedItems];
  container.innerHTML = '';
  sortedItems.forEach(item => container.appendChild(item));
  sortedItems.forEach(item => {
    const newTop = item.getBoundingClientRect().top;
    const deltaY = originalPositions.get(item) - newTop;
    if (Math.abs(deltaY) > 1) {
      item.style.transform = `translateY(${deltaY}px)`;
      item.style.transition = 'none';
      item.offsetHeight;
      item.style.transform = '';
      item.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  });
  setTimeout(() => { sortedItems.forEach(item => { item.style.transform = ''; item.style.transition = ''; }); }, 400);
}

export function clearGlobalMetaHighlight() {
  ['#asideCharacters', '#asideLocations', '#asideProps'].forEach(selector => {
    const container = $(selector);
    if (!container) return;
    Array.from(container.children).forEach(item => item.classList.remove('meta-item-highlighted', 'meta-item-faded'));
  });
}


// ============ 分镜编辑渲染（初版） ============
let storyboardEditorBound = false;
export function renderStoryboardEditor(section) {
  const container = $('#storyboardContainer');
  if (!container) return;
  container.innerHTML = '';

  const storyboard = section.storyboard;
  // 未生成分镜时也提供生成按钮
  if (!storyboard) {
    const actionsRow = document.createElement('div');
    actionsRow.className = 'sb-row';
    const genKeyEmpty = `${state.currentSection?.cIdx}-${state.currentSection?.pIdx}-${state.currentSection?.sIdx}`;
    const isGen = (state.generatingStoryboards || []).includes(genKeyEmpty);
    actionsRow.innerHTML = `
      <label class="sb-label">排版模板</label>
      <button class="mini-btn btn-primary" data-action="gen-storyboard" ${isGen?'disabled':''}>
        ${isGen ? '<i class="fas fa-spinner fa-spin"></i> 生成中…' : '<i class="fas fa-wand-magic-sparkles"></i> 生成分镜'}
      </button>
    `;
    container.appendChild(actionsRow);
    const hint = document.createElement('div');
    hint.className = 'sb-row';
    hint.innerHTML = `<label class="sb-label"></label><div class="sb-hint">尚未生成分镜。点击上方按钮生成。</div>`;
    container.appendChild(hint);
    if (!storyboardEditorBound) bindStoryboardEditorEvents();
    return;
  }

  // 确保面板图片数组存在并与 panels 同步长度
  const panelsLen = Array.isArray(storyboard.panels) ? storyboard.panels.length : 0;
  if (!Array.isArray(section._panels)) section._panels = [];
  if (section._panels.length !== panelsLen) {
    const newArr = new Array(panelsLen).fill(null);
    for (let i = 0; i < Math.min(section._panels.length, panelsLen); i++) newArr[i] = section._panels[i];
    section._panels = newArr;
  }

  // Layout Template
  const layoutWrap = document.createElement('div');
  layoutWrap.className = 'sb-row';
  layoutWrap.innerHTML = `
    <label class="sb-label">排版模板</label>
    <div class="sb-select-wrapper">
      <select class="sb-input" data-sb="layout_template">
        ${['single','double_vertical','triple_top_single_bottom_double','triple_top_double_bottom_single','quad_grid_2x2']
          .map(opt => `<option value="${opt}" ${storyboard.layout_template===opt?'selected':''}>${opt}</option>`).join('')}
      </select>
    </div>
  `;
  container.appendChild(layoutWrap);

  // 生成分镜按钮 loading 状态仅依据当前 section 的生成键
  const actionsRow = document.createElement('div');
  actionsRow.className = 'sb-row';
  const genKey = `${state.currentSection?.cIdx}-${state.currentSection?.pIdx}-${state.currentSection?.sIdx}`;
  const isGenerating = (state.generatingStoryboards || []).includes(genKey);
  actionsRow.innerHTML = `
    <label class="sb-label"></label>
    <button class="mini-btn btn-primary" data-action="gen-storyboard" data-gen-key="${genKey}" ${isGenerating?'disabled':''}>
      ${isGenerating ? '<i class="fas fa-spinner fa-spin"></i> 生成中…' : '<i class="fas fa-wand-magic-sparkles"></i> 生成分镜'}
    </button>
  `;
  container.appendChild(actionsRow);

  // Layout Canvas (根据排版模板展示可编辑图片槽位)
  const panelsCount = Array.isArray(storyboard.panels) ? storyboard.panels.length : 0;
  const layoutHeader = document.createElement('h4');
  layoutHeader.textContent = '模板画布';
  container.appendChild(layoutHeader);

  const layoutCanvas = document.createElement('div');
  const rawLayoutName = storyboard.layout_template || 'single';
  const layoutName = rawLayoutName === 'double_horizontal' ? 'double_vertical' : rawLayoutName;
  layoutCanvas.className = `sb-layout sb-layout-${layoutName}`;
  // 兼容旧结构：将 _panels 同步为多图图层结构 _slotLayers
  if (!Array.isArray(section._slotLayers)) section._slotLayers = new Array(panelsCount).fill(null).map(() => []);
  if (section._slotLayers.length !== panelsCount) {
    section._slotLayers = new Array(panelsCount).fill(null).map((_, i) => section._slotLayers?.[i] || []);
  }
  for (let i = 0; i < panelsCount; i++) {
    if ((section._slotLayers[i] || []).length === 0 && section._panels?.[i]) {
      section._slotLayers[i] = [{ id: `${Date.now()}_${i}`, src: section._panels[i], x: 0, y: 0, scale: 1, rotate: 0 }];
    }
  }

  const selected = section._selectedLayer || { slot: -1, layer: -1 };
  const slotsHtml = new Array(panelsCount).fill(0).map((_, i) => {
    const layers = Array.isArray(section._slotLayers?.[i]) ? section._slotLayers[i] : [];
    const layersHtml = layers.map((ly, j) => `
      <div class="sb-layer ${selected.slot===i && selected.layer===j ? 'selected' : ''}" data-slot-index="${i}" data-layer-index="${j}" style="--tx:${ly.x||0}px; --ty:${ly.y||0}px; --scale:${ly.scale||1}; --rotate:${(ly.rotate||0)}deg">
        <img src="${ly.src}" alt="layer ${j+1}" />
        <div class="sb-layer-tools">
          <div class="grp">
            <button class="sb-tool-btn" data-sb-action="layer-backward" title="下移一层"><i class="fas fa-arrow-down"></i></button>
            <button class="sb-tool-btn" data-sb-action="layer-forward" title="上移一层"><i class="fas fa-arrow-up"></i></button>
          </div>
          <div class="grp">
            <button class="sb-tool-btn danger" data-sb-action="layer-delete" title="删除此图层"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="sb-handles">
          <div class="sb-handle tl" data-handle="tl"></div>
          <div class="sb-handle tr" data-handle="tr"></div>
          <div class="sb-handle bl" data-handle="bl"></div>
          <div class="sb-handle br" data-handle="br"></div>
          <div class="sb-rotate"><div class="dot" data-rotate-handle></div></div>
        </div>
      </div>
    `).join('');
    const hasLayers = layers.length > 0;
    return `
      <div class="sb-slot" data-sb-slot-index="${i}">
        ${hasLayers ? '' : `
          <button class="sb-image-placeholder" data-sb-action="upload-image" data-panel-index="${i}">
            <i class="fas fa-cloud-upload-alt"></i>
            <span>上传参考图</span>
          </button>
        `}
        <div class="sb-slot-layers">${layersHtml}</div>
        <input type="file" accept="image/*" data-sb-file="${i}" style="display:none" />
        <button class="sb-gen-btn" title="生成候选图" data-sb-action="open-gen" data-slot-index="${i}"><i class="fas fa-wand-magic-sparkles"></i> 生图</button>
      </div>
    `;
  }).join('');
  layoutCanvas.innerHTML = `<div class="sb-layout-inner">${slotsHtml}</div>`;
  container.appendChild(layoutCanvas);

  // 候选列表（当前section级别，显示最近生成的图片，点击可加入当前选中的槽位或第一个槽位）
  const candWrap = document.createElement('div');
  candWrap.className = 'sb-candidates-panel';
  candWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><h4 style="margin:0">候选</h4><small style="color:#9ca3af">点击加入画布</small></div><div id="sbCandGrid" class="sb-cand-grid"></div>`;
  container.appendChild(candWrap);
  // 初次渲染候选
  import('./imageGen.js').then(m => m.updateCandidatesPanel && m.updateCandidatesPanel());

  // Panels
  const panelsHeader = document.createElement('h4');
  panelsHeader.textContent = '面板';
  container.appendChild(panelsHeader);

  (storyboard.panels || []).forEach((panel, pIdx) => {
    const pDiv = document.createElement('div');
    pDiv.className = 'sb-panel';
    const subject = panel?.image_description?.subject_description || { characters: [], items: [] };
    const characters = Array.isArray(subject.characters) ? subject.characters : [];
    const items = Array.isArray(subject.items) ? subject.items : [];
    const visualDesc = panel?.image_description?.visual_description || '';
    const imgUrl = section._panels?.[pIdx] || '';
    pDiv.innerHTML = `
      <div class="sb-panel-header">Panel ${pIdx + 1}</div>
      <div class="sb-panel-grid">
        <div class="sb-image">
          ${imgUrl ? `
            <div class="sb-image-wrap">
              <img src="${imgUrl}" alt="panel ${pIdx + 1}" />
              <button class="sb-image-remove" data-sb-action="remove-image" data-panel-index="${pIdx}"><i class="fas fa-times"></i></button>
            </div>
          ` : `
            <button class="sb-image-placeholder" data-sb-action="upload-image" data-panel-index="${pIdx}">
              <i class="fas fa-cloud-upload-alt"></i>
              <span>上传参考图</span>
            </button>
          `}
          <input type="file" accept="image/*" data-sb-file="${pIdx}" style="display:none" />
        </div>
        <div class="sb-form">
          <div class="sb-grid">
            <div class="sb-col">
              <div class="sb-subtitle">角色</div>
              <div class="sb-list">
                ${characters.map((ch, cIdx) => `
                  <div class="sb-row sb-row-2-inputs">
                    <input class="sb-input" placeholder="variant_id" data-sb="panels.${pIdx}.image_description.subject_description.characters.${cIdx}.variant_id" value="${(ch?.variant_id ?? '')}" />
                    <input class="sb-input" placeholder="state_note（一句话）" data-sb="panels.${pIdx}.image_description.subject_description.characters.${cIdx}.state_note" value="${(ch?.state_note ?? '')}" />
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="sb-col">
              <div class="sb-subtitle">道具</div>
              <div class="sb-list">
                ${items.map((it, iIdx) => `
                  <div class="sb-row sb-row-2-inputs">
                    <input class="sb-input" placeholder="variant_id" data-sb="panels.${pIdx}.image_description.subject_description.items.${iIdx}.variant_id" value="${(it?.variant_id ?? '')}" />
                    <input class="sb-input" placeholder="state_note（一句话）" data-sb="panels.${pIdx}.image_description.subject_description.items.${iIdx}.state_note" value="${(it?.state_note ?? '')}" />
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="sb-row sb-row-stacked">
            <label class="sb-label">visual_description</label>
            <textarea class="sb-textarea" rows="4" data-sb="panels.${pIdx}.image_description.visual_description">${visualDesc}</textarea>
          </div>
        </div>
      </div>
    `;
    container.appendChild(pDiv);
  });

  // Audio Prompts
  const audioHeader = document.createElement('h4');
  audioHeader.textContent = '音频提示';
  container.appendChild(audioHeader);

  (storyboard.audio_prompts || []).forEach((ap, aIdx) => {
    const type = ap?.type;
    const desc = ap?.description || {};
    const aDiv = document.createElement('div');
    aDiv.className = 'sb-audio';
    if (type === 'voiceover') {
      aDiv.innerHTML = `
        <div class="sb-row"><span class="sb-badge">旁白</span></div>
        <div class="sb-row"><input class="sb-input" placeholder="voice_id" data-sb="audio_prompts.${aIdx}.description.voice_id" value="${desc.voice_id ?? ''}" /></div>
        <div class="sb-row"><textarea class="sb-textarea" rows="2" placeholder="text" data-sb="audio_prompts.${aIdx}.description.text">${desc.text ?? ''}</textarea></div>
        <div class="sb-row"><input class="sb-input" placeholder="audio_description" data-sb="audio_prompts.${aIdx}.description.audio_description" value="${desc.audio_description ?? ''}" /></div>
      `;
    } else if (type === 'dialogue') {
      aDiv.innerHTML = `
        <div class="sb-row"><span class="sb-badge">对白</span></div>
        <div class="sb-row"><input class="sb-input" placeholder="voice_id" data-sb="audio_prompts.${aIdx}.description.voice_id" value="${desc.voice_id ?? ''}" /></div>
        <div class="sb-row"><textarea class="sb-textarea" rows="2" placeholder="text" data-sb="audio_prompts.${aIdx}.description.text">${desc.text ?? ''}</textarea></div>
        <div class="sb-row"><input class="sb-input" placeholder="audio_description" data-sb="audio_prompts.${aIdx}.description.audio_description" value="${desc.audio_description ?? ''}" /></div>
      `;
    } else if (type === 'sfx') {
      aDiv.innerHTML = `
        <div class="sb-row"><span class="sb-badge">音效</span></div>
        <div class="sb-row"><input class="sb-input" placeholder="sfx_id" data-sb="audio_prompts.${aIdx}.description.sfx_id" value="${desc.sfx_id ?? ''}" /></div>
        <div class="sb-row"><input class="sb-input" placeholder="sfx_description" data-sb="audio_prompts.${aIdx}.description.sfx_description" value="${desc.sfx_description ?? ''}" /></div>
      `;
    } else {
      aDiv.innerHTML = `<div class="sb-row"><span class="sb-badge">unknown</span></div>`;
    }
    container.appendChild(aDiv);
  });

  if (!storyboardEditorBound) bindStoryboardEditorEvents();
}

function bindStoryboardEditorEvents() {
  const container = $('#storyboardContainer');
  if (!container) return;
  // 统一监听 input/textarea/select 变化
  container.addEventListener('input', handleStoryboardChange);
  container.addEventListener('change', handleStoryboardChange);
  // 上传与删除图片
  container.addEventListener('click', (e) => {
    const upBtn = e.target.closest('[data-sb-action="upload-image"]');
    if (upBtn) {
      const idx = upBtn.getAttribute('data-panel-index');
      const file = container.querySelector(`input[type="file"][data-sb-file="${idx}"]`);
      if (file) file.click();
      return;
    }
    const clearBtn = e.target.closest('[data-sb-action="clear-slot"]');
    if (clearBtn) {
      const idx = parseInt(clearBtn.getAttribute('data-panel-index'));
      if (!isNaN(idx) && state.currentSection) {
        const { cIdx, pIdx, sIdx } = state.currentSection;
        const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
        if (section) {
          if (!Array.isArray(section._slotLayers)) section._slotLayers = [];
          section._slotLayers[idx] = [];
          renderStoryboardEditor(section);
        }
      }
      return;
    }
    const forwardBtn = e.target.closest('[data-sb-action="layer-forward"]');
    const backwardBtn = e.target.closest('[data-sb-action="layer-backward"]');
    const delBtn = e.target.closest('[data-sb-action="layer-delete"]');
    const scaleUpBtn = e.target.closest('[data-sb-action="layer-scale-up"]');
    const scaleDownBtn = e.target.closest('[data-sb-action="layer-scale-down"]');
    const rotLeftBtn = e.target.closest('[data-sb-action="layer-rotate-left"]');
    const rotRightBtn = e.target.closest('[data-sb-action="layer-rotate-right"]');
    if ((forwardBtn || backwardBtn || delBtn || scaleUpBtn || scaleDownBtn || rotLeftBtn || rotRightBtn) && state.currentSection) {
      // 工具条位于图层内部，依赖当前选中图层（点击任一工具会先选中其父图层）
      const layerEl = e.target.closest('.sb-layer');
      if (!layerEl) return;
      const idx = parseInt(layerEl.getAttribute('data-slot-index'));
      const { cIdx, pIdx, sIdx } = state.currentSection;
      const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
      if (!Array.isArray(section._slotLayers?.[idx])) return;
      const sel = { slot: idx, layer: parseInt(layerEl.getAttribute('data-layer-index')) };
      section._selectedLayer = sel;
      const arr = section._slotLayers[idx];
      const i = sel.layer;
      if (i < 0 || i >= arr.length) return;
      if (forwardBtn && i < arr.length - 1) {
        [arr[i], arr[i+1]] = [arr[i+1], arr[i]];
        section._selectedLayer.layer = i + 1;
      }
      if (backwardBtn && i > 0) {
        [arr[i], arr[i-1]] = [arr[i-1], arr[i]];
        section._selectedLayer.layer = i - 1;
      }
      if (delBtn) {
        arr.splice(i, 1);
        section._selectedLayer = { slot: idx, layer: Math.max(0, i-1) };
      }
      if (scaleUpBtn) arr[i] && (arr[i].scale = Math.min(8, (arr[i].scale||1) * 1.1));
      if (scaleDownBtn) arr[i] && (arr[i].scale = Math.max(0.1, (arr[i].scale||1) / 1.1));
      if (rotLeftBtn) arr[i] && (arr[i].rotate = (arr[i].rotate||0) - 5);
      if (rotRightBtn) arr[i] && (arr[i].rotate = (arr[i].rotate||0) + 5);
      // 交换/删除后需要重渲染以更新每个 .sb-layer 的 data-layer-index
      renderStoryboardEditor(section);
      return;
    }
    const rmBtn = e.target.closest('[data-sb-action="remove-image"]');
    if (rmBtn) {
      const idx = parseInt(rmBtn.getAttribute('data-panel-index'));
      if (!isNaN(idx) && state.currentSection) {
        const { cIdx, pIdx, sIdx } = state.currentSection;
        const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
        if (section) {
          if (!Array.isArray(section._panels)) section._panels = [];
          section._panels[idx] = null;
          renderStoryboardEditor(section);
        }
      }
    }
    const openGenBtn = e.target.closest('[data-sb-action="open-gen"]');
    if (openGenBtn) {
      const slotIndex = parseInt(openGenBtn.getAttribute('data-slot-index'));
      if (!isNaN(slotIndex)) {
        import('./imageGen.js').then(m => m.openImageGenModal(slotIndex));
      }
      return;
    }
  });
  container.addEventListener('change', async (e) => {
    const fileInput = e.target.closest('input[type="file"][data-sb-file]');
    if (!fileInput) return;
    const idx = parseInt(fileInput.getAttribute('data-sb-file'));
    const file = fileInput.files?.[0];
    if (!file || isNaN(idx) || !state.currentSection) return;
    const dataUrl = await readFileAsDataURL(file);
    const { cIdx, pIdx, sIdx } = state.currentSection;
    const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
    if (!section) return;
    if (!Array.isArray(section._slotLayers)) section._slotLayers = [];
    const layer = { id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`, src: dataUrl, x: 0, y: 0, scale: 1, rotate: 0 };
    section._slotLayers[idx] = section._slotLayers[idx] || [];
    section._slotLayers[idx].push(layer);
    renderStoryboardEditor(section);
  });
  // 拖拽到槽位上传
  container.addEventListener('dragover', (e) => {
    const slot = e.target.closest('.sb-slot');
    if (!slot) return;
    e.preventDefault();
    slot.classList.add('dragover');
  });
  container.addEventListener('dragleave', (e) => {
    const slot = e.target.closest('.sb-slot');
    if (!slot) return;
    slot.classList.remove('dragover');
  });
  container.addEventListener('drop', async (e) => {
    const slot = e.target.closest('.sb-slot');
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove('dragover');
    const idx = parseInt(slot.getAttribute('data-sb-slot-index'));
    const file = e.dataTransfer?.files?.[0];
    if (!file || isNaN(idx) || !state.currentSection) return;
    const dataUrl = await readFileAsDataURL(file);
    const { cIdx, pIdx, sIdx } = state.currentSection;
    const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
    if (!section) return;
    if (!Array.isArray(section._slotLayers)) section._slotLayers = [];
    const layer = { id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`, src: dataUrl, x: 0, y: 0, scale: 1, rotate: 0 };
    section._slotLayers[idx] = section._slotLayers[idx] || [];
    section._slotLayers[idx].push(layer);
    renderStoryboardEditor(section);
  });

  // 图层拖动/缩放/旋转（基础交互）
  let dragging = null;
  let startX = 0, startY = 0;
  container.addEventListener('pointerdown', (e) => {
    // 工具栏内的点击不触发拖拽
    if (e.target.closest('.sb-layer-tools')) return;
    // 旋转手柄/缩放手柄的按下会进入对应交互
    const rotateDot = e.target.closest('[data-rotate-handle]');
    const scaleHandle = e.target.closest('.sb-handle');
    if (rotateDot || scaleHandle) {
      e.preventDefault();
      if (!state.currentSection) return;
      const layerEl = e.target.closest('.sb-layer');
      if (!layerEl) return;
      const slot = parseInt(layerEl.getAttribute('data-slot-index'));
      const layer = parseInt(layerEl.getAttribute('data-layer-index'));
      const { cIdx, pIdx, sIdx } = state.currentSection;
      const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
      const ly = section?._slotLayers?.[slot]?.[layer];
      if (!ly) return;
      section._selectedLayer = { slot, layer };
      // 更新选中态可视化
      container.querySelectorAll('.sb-layer.selected').forEach(n => n.classList.remove('selected'));
      layerEl.classList.add('selected');
      // 记录中心点在视口坐标
      const rect = layerEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let mode = rotateDot ? 'rotate' : 'scale';
      // 缩放：以初始距离为基准，按比例缩放，避免首帧跳变
      const dx0 = (e.clientX - centerX);
      const dy0 = (e.clientY - centerY);
      const startDist = Math.max(8, Math.hypot(dx0, dy0));
      const startScale = ly.scale || 1;
      const onMove = (ev) => {
        if (mode === 'rotate') {
          const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * 180 / Math.PI + 90; // 让上方为0°
          ly.rotate = angle;
        } else if (mode === 'scale') {
          const dx = (ev.clientX - centerX);
          const dy = (ev.clientY - centerY);
          const dist = Math.max(8, Math.hypot(dx, dy));
          const ratio = dist / startDist;
          const newScale = startScale * ratio;
          ly.scale = Math.max(0.1, Math.min(8, newScale));
        }
        scheduleLayerStyleUpdate(layerEl, ly);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp, true);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, true);
      return;
    }
    const candidate = e.target.closest('.sb-layer');
    // 若没有直接命中图层，尝试用命中路径挑选最上层 .sb-layer
    let layerEl = candidate;
    if (!layerEl) {
      const path = document.elementsFromPoint(e.clientX, e.clientY);
      layerEl = path.find(node => node.classList && node.classList.contains('sb-layer')) || null;
    }
    if (!layerEl) return;
    e.preventDefault();
    const slot = parseInt(layerEl.getAttribute('data-slot-index'));
    const layer = parseInt(layerEl.getAttribute('data-layer-index'));
    dragging = { slot, layer, el: layerEl };
    startX = e.clientX; startY = e.clientY;
    if (!state.currentSection) return;
    const { cIdx, pIdx, sIdx } = state.currentSection;
    const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
    section._selectedLayer = { slot, layer };
    // 更新选中态可视化
    container.querySelectorAll('.sb-layer.selected').forEach(n => n.classList.remove('selected'));
    layerEl.classList.add('selected');
    // 提升当前图层 z-index，便于再次命中
    layerEl.style.zIndex = '10';
    layerEl.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', (e) => {
    if (!dragging || !state.currentSection) return;
    const dx = e.clientX - startX; const dy = e.clientY - startY;
    startX = e.clientX; startY = e.clientY;
    const { cIdx, pIdx, sIdx } = state.currentSection;
    const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
    const ly = section._slotLayers?.[dragging.slot]?.[dragging.layer];
    if (!ly) return;
    ly.x = (ly.x || 0) + dx; ly.y = (ly.y || 0) + dy;
    const layerEls = container.querySelectorAll(`.sb-layer[data-slot-index="${dragging.slot}"][data-layer-index="${dragging.layer}"]`);
    layerEls.forEach(el => scheduleLayerStyleUpdate(el, ly));
  });
  container.addEventListener('pointerup', () => { if (dragging?.el) dragging.el.style.zIndex = ''; dragging = null; });
  container.addEventListener('pointercancel', () => { dragging = null; });

  // 点击槽位空白处取消选中
  container.addEventListener('pointerdown', (e) => {
    const onLayer = e.target.closest('.sb-layer');
    const onTools = e.target.closest('.sb-layer-tools');
    const onHandle = e.target.closest('.sb-handle, [data-rotate-handle]');
    if (onLayer || onTools || onHandle) return;
    const slot = e.target.closest('.sb-slot');
    if (!slot) return;
    container.querySelectorAll('.sb-layer.selected').forEach(n => n.classList.remove('selected'));
    if (state.currentSection) {
      const { cIdx, pIdx, sIdx } = state.currentSection;
      const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
      if (section) section._selectedLayer = { slot: -1, layer: -1 };
    }
  });

  // 滚轮缩放、Alt+滚轮旋转
  container.addEventListener('wheel', (e) => {
    const layerEl = e.target.closest('.sb-layer');
    if (!layerEl || !state.currentSection) return;
    e.preventDefault();
    const slot = parseInt(layerEl.getAttribute('data-slot-index'));
    const layer = parseInt(layerEl.getAttribute('data-layer-index'));
    const { cIdx, pIdx, sIdx } = state.currentSection;
    const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
    const ly = section._slotLayers?.[slot]?.[layer];
    if (!ly) return;
    if (e.altKey) {
      ly.rotate = (ly.rotate || 0) + (e.deltaY > 0 ? 2 : -2);
    } else {
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      ly.scale = Math.max(0.1, Math.min(8, (ly.scale || 1) * factor));
    }
    scheduleLayerStyleUpdate(layerEl, ly);
  }, { passive: false });
  // 当生成器完成时，刷新视图
  document.addEventListener('storyboard-updated', () => {
    if (!state.currentSection) return;
    const { cIdx, pIdx, sIdx } = state.currentSection;
    const sec = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
    if (sec) renderStoryboardEditor(sec);
  });
  // 生成完成时刷新候选区（由 imageGen 广播）
  document.addEventListener('imagegen-candidates-updated', () => {
    const grid = document.querySelector('#sbCandGrid');
    if (!grid) return;
    import('./imageGen.js').then(m => m.preloadComfyWorkflow && m.preloadComfyWorkflow());
  });
  storyboardEditorBound = true;
}

function handleStoryboardChange(e) {
  const path = e.target?.dataset?.sb;
  if (!path) return;
  if (!state.currentSection) return;
  const { cIdx, pIdx, sIdx } = state.currentSection;
  const section = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
  if (!section?.storyboard) return;
  setDeepValue(section.storyboard, path, e.target.value);
  if (path === 'layout_template') {
    renderStoryboardEditor(section);
  }
}

function setDeepValue(root, path, value) {
  const segs = path.split('.');
  let obj = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const key = segs[i];
    if (!(key in obj)) obj[key] = {};
    obj = obj[key];
  }
  const last = segs[segs.length - 1];
  // 将空字符串标准化为 null（符合提示词 state_note/variant_id 可为 null 的要求）
  obj[last] = (value === '') ? null : value;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 轻量更新：把当前图层的 transform 直接写到 style，避免整块重绘；用 requestAnimationFrame 合批
let rafToken = null;
let pendingUpdates = [];
function scheduleLayerStyleUpdate(el, ly) {
  pendingUpdates.push([el, ly.x || 0, ly.y || 0, ly.scale || 1, ly.rotate || 0]);
  if (rafToken) return;
  rafToken = requestAnimationFrame(() => {
    const updates = pendingUpdates;
    pendingUpdates = [];
    rafToken = null;
    for (const [node, x, y, s, r] of updates) {
      node.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s}) rotate(${r}deg)`;
    }
  });
}

