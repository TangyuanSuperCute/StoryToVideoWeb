import { state } from './state.js';
import { showNotification } from './utils.js';

export function updateStoryName(newName) {
  state.story.meta = state.story.meta || {};
  state.story.meta.name = (newName || '').trim() || 'Untitled Story';
  showNotification('Story name updated', 'success');
}

export function updateChapterTitle(cIdx, newTitle) {
  if (!state.story.chapters[cIdx]) return;
  state.story.chapters[cIdx].meta = state.story.chapters[cIdx].meta || {};
  state.story.chapters[cIdx].meta.chapter_title = (newTitle || '').trim() || 'Untitled';
  showNotification('Chapter title updated', 'success');
}

export function updateParagraphTitle(cIdx, pIdx, newTitle) {
  const paragraph = state.story.chapters[cIdx]?.paragraphs[pIdx];
  if (!paragraph) return;
  paragraph.meta = paragraph.meta || {};
  paragraph.meta.paragraph_title = (newTitle || '').trim() || 'Untitled';
  showNotification('Paragraph title updated', 'success');
}


