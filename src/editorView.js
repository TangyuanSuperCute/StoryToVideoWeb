import { state } from './state.js';
import { $, $all } from './utils.js';

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
    <div class="editable-text section-intent-text" contenteditable="true"
          onblur="updateSectionIntentFromEditor(this.textContent)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
          ${section.intent || 'Untitled'}
    </div>
  `;
  $('#intentText').textContent = section.intent || '';
  $('#adaptedText').textContent = section.adapted_text || '';
  const visuals = section.visuals || {};
  const audio = section.audio || {};
  renderList('#metaCharacters', visuals.characters || []);
  renderList('#metaProps', visuals.props || []);
  renderList('#metaLocation', visuals.location ? [visuals.location] : []);
  renderList('#metaVisuals', visuals.visual_message || []);
  renderList('#metaNarration', audio.narration ? [audio.narration] : []);
  renderList('#metaDialogues', (audio.dialogues || []).map(d => `${d.character}: ${d.line}`));
  renderList('#metaSfx', audio.sfx || []);
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


