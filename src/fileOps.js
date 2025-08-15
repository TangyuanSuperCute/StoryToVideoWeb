import { state } from './state.js';
import { $, showNotification, safeJsonParse } from './utils.js';
import { detectJsonType, importStory } from './storyImport.js';
import { renderTree as renderTreeMod, updateEntities as updateEntitiesMod } from './treeRender.js';

export async function openStoryFile() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    // 放到 body，避免某些浏览器重复触发
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      const [obj, err] = safeJsonParse(text);
      if (err) { showNotification('Invalid JSON file', 'error'); return; }

      const jsonType = detectJsonType(obj);
      if (jsonType !== 'story') { showNotification('File must contain a complete story structure', 'error'); return; }

      importStory(obj);
      renderTreeMod();
      showNotification('Story loaded successfully', 'success');

      // 清理 input，防重复触发
      input.value = '';
      input.onchange = null;
      requestAnimationFrame(() => {
        input.remove();
      });
    };

    input.click();
  } catch (e) {
    showNotification('Failed to open file', 'error');
  }
}

export async function saveStoryAs() {
  if (!state.story) { showNotification('No story to save', 'error'); return; }
  const storyToSave = {
    id: state.story.meta.story_id,
    title: state.story.meta.name,
    original_text: state.story.meta.original_text || '',
    global_entities: state.story.meta.global_entities || undefined,
    chapters: (state.story.chapters || []).map(chapter => {
      const newParagraphs = (chapter.paragraphs || []).map(p => ({
        paragraph_index: p.meta.paragraph_index,
        paragraph_title: p.meta.paragraph_title,
        summary: p.summary,
        start10: p.start10,
        end10: p.end10,
        sections: p.sections,
      }));
      return {
        chapter_index: chapter.meta.chapter_index,
        chapter_title: chapter.meta.chapter_title,
        paragraphs: newParagraphs,
      };
    })
  };

  const storyData = { story: storyToSave };
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

export function clearStory() {
  if (!confirm('Are you sure you want to clear the entire story?')) return;
  state.story = {
    meta: {
      story_id: 'new_story',
      name: 'Untitled Story',
      created_at: new Date().toISOString()
    },
    chapters: []
  };
  renderTreeMod();
  updateEntitiesMod();
  $('#editorPanel')?.classList.add('hidden');
  $('#editorEmpty')?.classList.remove('hidden');
  showNotification('Story cleared', 'info');
}


