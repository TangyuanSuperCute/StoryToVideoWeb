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
  if (!storyboard) {
    const empty = document.createElement('div');
    empty.className = 'storyboard-empty muted';
    empty.innerHTML = '<p>尚未生成分镜。请点击右上角“生成分镜”按钮来生成。</p>';
    container.appendChild(empty);
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
        ${['single','double_vertical','double_horizontal','triple_top_single_bottom_double','triple_top_double_bottom_single','quad_grid_2x2']
          .map(opt => `<option value="${opt}" ${storyboard.layout_template===opt?'selected':''}>${opt}</option>`).join('')}
      </select>
    </div>
  `;
  container.appendChild(layoutWrap);

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
          <div class="sb-row">
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
    if (!Array.isArray(section._panels)) section._panels = [];
    section._panels[idx] = dataUrl;
    renderStoryboardEditor(section);
  });
  // 当生成器完成时，刷新视图
  document.addEventListener('storyboard-updated', () => {
    if (!state.currentSection) return;
    const { cIdx, pIdx, sIdx } = state.currentSection;
    const sec = state.story.chapters[cIdx]?.paragraphs[pIdx]?.sections[sIdx];
    if (sec) renderStoryboardEditor(sec);
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

