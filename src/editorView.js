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
    <div class="editable-text section-intent-text" contenteditable="true">${section.intent || 'Untitled'}</div>
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


