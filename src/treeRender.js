import { state } from './state.js';
import { $, $all, showNotification } from './utils.js';

// ============ 渲染目录树 ============
export function renderTree() {
  const container = $('#shotTree');
  container.innerHTML = '';
  
  if (!state.story) {
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
        <div class="empty-actions-grid">
          <button class="action-card" onclick="addNewChapter()">
            <i class="fas fa-plus-circle"></i>
            <span>New Chapter</span>
          </button>
          <button class="action-card" onclick="openStoryFile()">
            <i class="fas fa-folder-open"></i>
            <span>Open Story</span>
          </button>
          <button class="action-card" onclick="openImportModal('story')">
            <i class="fas fa-file-import"></i>
            <span>Import JSON</span>
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
        pDiv.className = 'node with-actions'; 
        pDiv.dataset.chapterIdx = cIdx;
        pDiv.dataset.paragraphIdx = pIdx;
        pDiv.innerHTML = `
          <div class="paragraph-row-1">
            <span class="paragraph-id-badge">P${pIdx + 1}</span>
            <div class="paragraph-actions-hover">
              <button class="action-btn-circle delete small" onclick="deleteParagraph(${cIdx}, ${pIdx}); event.stopPropagation();" title="Delete Paragraph">
                <i class="fas fa-trash"></i>
              </button>
              <button class="action-btn-circle small" onclick="openImportModal('paragraph', ${cIdx}, ${pIdx})" title="Import Paragraph">
                <i class="fas fa-file-import"></i>
              </button>
              <button class="action-btn-circle primary small" onclick="generateSectionsForParagraph(event, ${cIdx}, ${pIdx})" title="Generate Sections">
                <i class="fas fa-wand-magic-sparkles"></i>
              </button>
            </div>
          </div>
          <div class="paragraph-row-2">
            <strong class="title editable-text" contenteditable="true"
                    onblur="updateParagraphTitle(${cIdx}, ${pIdx}, this.textContent)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                    onclick="event.stopPropagation()">${paragraph.meta?.paragraph_title || 'Untitled'}</strong>
          </div>
        `;
        pLi.appendChild(pDiv);
        
        // 渲染sections
        if (paragraph.sections && paragraph.sections.length > 0) {
          const sUl = document.createElement('ul');
          paragraph.sections.forEach((section, sIdx) => {
            const sLi = document.createElement('li');
            const sDiv = document.createElement('div');
            const uniqueSectionId = `${cIdx}-${pIdx}-${sIdx}`;
            sDiv.className = 'node section-node';
            sDiv.dataset.uniqueId = uniqueSectionId;
            sDiv.onclick = () => selectSection(uniqueSectionId);
            
            const displayId = section.section_id?.replace(/^B/i, 'S') || `S${sIdx + 1}`;
            const snippet = section.intent || section.adapted_text?.slice(0, 50) || 'Untitled';
            sDiv.innerHTML = `
              <div class="section-content">
                <span class="title">${displayId}</span>
                <span class="muted">· 
                  <span class="section-text" title="${snippet}">${snippet}</span>
                </span>
              </div>
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

export function highlightActiveNode() {
  $all('.tree .node').forEach(n => n.classList.remove('active'));
  if (state.selectedSectionId) {
    const activeNode = $(`.tree .node[data-unique-id="${state.selectedSectionId}"]`);
    if (activeNode) {
      activeNode.classList.add('active');
    }
  }
}

// ============ 实体统计 ============
export function updateEntities() {
  const entities = {
    characters: new Set(),
    locations: new Set(),
    props: new Set()
  };
  
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

export function updateEntityList(selector, set) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = '';
  Array.from(set).sort().forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    li.dataset.value = item;
    el.appendChild(li);
  });
}

// ============ 新建 / 删除 ============
export function addNewChapter() {
  const cIdx = state.story.chapters.length;
  state.story.chapters.push({
    meta: {
      chapter_index: cIdx,
      chapter_id: `C${cIdx}`,
      chapter_title: `Chapter ${cIdx + 1}`
    },
    paragraphs: []
  });
  renderTree();
}

export function addNewParagraph(chapterIdx) {
  const chapter = state.story.chapters[chapterIdx];
  if (!chapter) return;
  const pIdx = chapter.paragraphs.length;
  chapter.paragraphs.push({
    meta: {
      chapter_index: chapterIdx,
      paragraph_index: pIdx,
      paragraph_id: `C${chapterIdx}_P${pIdx}`,
      paragraph_title: `Paragraph ${pIdx + 1}`
    },
    sections: []
  });
  renderTree();
}

export function deleteChapter(cIdx) {
  if (!confirm(`Delete Chapter ${cIdx + 1} and all its contents?`)) return;
  state.story.chapters.splice(cIdx, 1);
  state.story.chapters.forEach((chapter, idx) => {
    chapter.meta.chapter_index = idx;
    chapter.meta.chapter_id = `C${idx}`;
    chapter.paragraphs?.forEach((para, pIdx) => {
      para.meta.chapter_index = idx;
      para.meta.paragraph_index = pIdx;
      para.meta.paragraph_id = `C${idx}_P${pIdx}`;
      para.sections?.forEach((sec, sIdx) => {
        sec.section_id = sec.section_id || `C${idx}_P${pIdx}_S${sIdx}`;
      });
    });
  });
  renderTree();
  showNotification('Chapter deleted', 'info');
}

export function deleteParagraph(cIdx, pIdx) {
  if (!confirm(`Delete Paragraph ${pIdx + 1} and all its sections?`)) return;
  const chapter = state.story.chapters[cIdx];
  if (!chapter) return;
  chapter.paragraphs.splice(pIdx, 1);
  chapter.paragraphs.forEach((para, idx) => {
    para.meta.paragraph_index = idx;
    para.meta.paragraph_id = `C${cIdx}_P${idx}`;
    para.sections?.forEach((sec, sIdx) => {
      sec.section_id = sec.section_id || `C${cIdx}_P${idx}_S${sIdx}`;
    });
  });
  renderTree();
  showNotification('Paragraph deleted', 'info');
}

export function deleteSection(cIdx, pIdx, sIdx) {
  if (!confirm(`Delete Section ${sIdx + 1}?`)) return;
  const paragraph = state.story.chapters[cIdx]?.paragraphs[pIdx];
  if (!paragraph) return;
  paragraph.sections.splice(sIdx, 1);
  renderTree();
  showNotification('Section deleted', 'info');
}


