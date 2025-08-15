import { $, showNotification, safeJsonParse } from './utils.js';
import { detectJsonType, importStory, importChapter, importParagraph } from './storyImport.js';
import { renderTree as renderTreeMod } from './treeRender.js';

export function openImportModal(targetType, chapterIdx = null, paragraphIdx = null) {
  const modal = $('#jsonModal');
  modal.classList.remove('hidden');
  $('#jsonInput').value = '';
  modal.dataset.targetType = targetType;
  modal.dataset.chapterIdx = chapterIdx !== null ? chapterIdx : '';
  modal.dataset.paragraphIdx = paragraphIdx !== null ? paragraphIdx : '';

  let hint = '';
  let example = '';
  if (targetType === 'story') {
    hint = 'Import complete story JSON (with chapters array)';
    example = `{
  "story": {
    "meta": { "name": "Story Name" },
    "chapters": [ { "meta": { "chapter_title": "Chapter 1" }, "paragraphs": [ ... ] } ]
  }
}`;
  } else if (targetType === 'chapter') {
    hint = 'Import chapter JSON (with paragraphs array)';
    example = `{
  "meta": { "chapter_title": "Chapter Title" },
  "paragraphs": [ { "meta": { "paragraph_title": "Paragraph 1" }, "sections": [ ... ] } ]
}`;
  } else if (targetType === 'paragraph') {
    hint = 'Import paragraph JSON (with sections array)';
    example = `{
  "meta": { "paragraph_title": "Paragraph Title" },
  "sections": [ { "section_id": "S01", "intent": "...", "adapted_text": "..." } ]
}`;
  }
  $('#jsonModal h3').textContent = hint;
  const exampleEl = $('#jsonExample');
  if (exampleEl) exampleEl.textContent = example;
}

export function closeImportModal() {
  $('#jsonModal').classList.add('hidden');
}

export function parseImportJson() {
  const modal = $('#jsonModal');
  const text = $('#jsonInput').value.trim();
  if (!text) { showNotification('Please enter JSON', 'error'); return; }
  const [obj, err] = safeJsonParse(text);
  if (err) { showNotification('Invalid JSON format', 'error'); return; }

  const targetType = modal.dataset.targetType;
  const chapterIdx = modal.dataset.chapterIdx ? parseInt(modal.dataset.chapterIdx) : null;
  const paragraphIdx = modal.dataset.paragraphIdx ? parseInt(modal.dataset.paragraphIdx) : null;
  const jsonType = detectJsonType(obj);
  if (targetType === 'story' && jsonType !== 'story') return showNotification('JSON must be a complete story structure', 'error');
  if (targetType === 'chapter' && jsonType !== 'chapter') return showNotification('JSON must be a chapter structure', 'error');
  if (targetType === 'paragraph' && jsonType !== 'paragraph') return showNotification('JSON must be a paragraph structure', 'error');

  if (targetType === 'story') importStory(obj);
  else if (targetType === 'chapter') importChapter(obj, chapterIdx);
  else if (targetType === 'paragraph') importParagraph(obj, chapterIdx, paragraphIdx);

  closeImportModal();
  renderTreeMod();
  showNotification('Import successful', 'success');
}

export function bindImportModalControls() {
  $('#modalClose')?.addEventListener('click', closeImportModal);
  $('#modalCancel')?.addEventListener('click', closeImportModal);
  $('#modalParse')?.addEventListener('click', parseImportJson);
}


