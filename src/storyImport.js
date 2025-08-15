import { state } from './state.js';

// ============ JSON结构检测 ============
export function detectJsonType(obj) {
  if (!obj || typeof obj !== 'object') return null;

  const storyObj = obj.story || obj;

  if (storyObj.chapters) {
    if (!Array.isArray(storyObj.chapters)) {
      storyObj.chapters = [storyObj.chapters];
    }
    return 'story';
  }
  if (obj.meta && Array.isArray(obj.paragraphs)) {
    return 'chapter';
  }
  if (obj.meta && Array.isArray(obj.sections)) {
    return 'paragraph';
  }
  return null;
}

// ============ 导入处理函数 ============
export function importStory(storyObj) {
  const storyData = storyObj.story || storyObj;
  state.story = {
    meta: {
      ...(storyData.meta || {}),
      name: storyData.title || storyData.meta?.name || 'Untitled Story',
      story_id: storyData.id || storyData.meta?.story_id || 'new_story',
      original_text: storyData.original_text || '',
      global_entities: storyData.global_entities || storyData.meta?.global_entities
    },
    chapters: []
  };

  const chapters = storyData.chapters || [];
  chapters.forEach((chapter, cIdx) => {
    const newChapter = {
      meta: {
        ...chapter.meta,
        chapter_title: chapter.chapter_title || chapter.meta?.chapter_title || `Chapter ${cIdx + 1}`,
        chapter_index: chapter.chapter_index !== undefined ? chapter.chapter_index : cIdx,
        chapter_id: chapter.meta?.chapter_id || `C${cIdx}`
      },
      paragraphs: []
    };

    const paragraphs = chapter.paragraphs || [];
    paragraphs.forEach((paragraph, pIdx) => {
      const newParagraph = {
        meta: {
          ...paragraph.meta,
          paragraph_title: paragraph.paragraph_title || paragraph.meta?.paragraph_title || `Paragraph ${pIdx + 1}`,
          paragraph_index: paragraph.paragraph_index !== undefined ? paragraph.paragraph_index : pIdx,
          chapter_index: cIdx,
          paragraph_id: paragraph.meta?.paragraph_id || `C${cIdx}_P${pIdx}`
        },
        summary: paragraph.summary,
        start10: paragraph.start10,
        end10: paragraph.end10,
        sections: []
      };

      const sections = paragraph.sections || [];
      sections.forEach((section, sIdx) => {
        const newSection = {
          ...section,
          section_id: section.section_id || `C${cIdx}_P${pIdx}_S${sIdx}`,
          _panels: section._panels || [null, null, null]
        };
        newParagraph.sections.push(newSection);
      });

      newChapter.paragraphs.push(newParagraph);
    });

    state.story.chapters.push(newChapter);
  });
}

export function importChapter(chapterObj, targetChapterIdx) {
  const cIdx = targetChapterIdx !== null ? targetChapterIdx : state.story.chapters.length;

  const newChapter = {
    meta: {
      ...chapterObj.meta,
      chapter_title: chapterObj.chapter_title || chapterObj.meta?.chapter_title || `Chapter ${cIdx + 1}`,
      chapter_index: chapterObj.chapter_index !== undefined ? chapterObj.chapter_index : cIdx,
      chapter_id: chapterObj.meta?.chapter_id || `C${cIdx}`
    },
    paragraphs: []
  };

  const paragraphs = chapterObj.paragraphs || [];
  paragraphs.forEach((paragraph, pIdx) => {
    const newParagraph = {
      meta: {
        ...paragraph.meta,
        paragraph_title: paragraph.paragraph_title || paragraph.meta?.paragraph_title || `Paragraph ${pIdx + 1}`,
        paragraph_index: paragraph.paragraph_index !== undefined ? paragraph.paragraph_index : pIdx,
        chapter_index: cIdx,
        paragraph_id: paragraph.meta?.paragraph_id || `C${cIdx}_P${pIdx}`
      },
      summary: paragraph.summary,
      start10: paragraph.start10,
      end10: paragraph.end10,
      sections: []
    };

    const sections = paragraph.sections || [];
    sections.forEach((section, sIdx) => {
      const newSection = {
        ...section,
        section_id: section.section_id || `C${cIdx}_P${pIdx}_S${sIdx}`,
        _panels: section._panels || [null, null, null]
      };
      newParagraph.sections.push(newSection);
    });

    newChapter.paragraphs.push(newParagraph);
  });

  if (targetChapterIdx !== null && targetChapterIdx < state.story.chapters.length) {
    state.story.chapters[targetChapterIdx] = newChapter;
  } else {
    state.story.chapters.push(newChapter);
  }
}

export function importParagraph(paragraphObj, chapterIdx, targetParagraphIdx) {
  if (chapterIdx === null || chapterIdx >= state.story.chapters.length) return;

  const chapter = state.story.chapters[chapterIdx];
  const pIdx = targetParagraphIdx !== null ? targetParagraphIdx : chapter.paragraphs.length;

  const newParagraph = {
    meta: {
      ...paragraphObj.meta,
      paragraph_title: paragraphObj.paragraph_title || paragraphObj.meta?.paragraph_title || `Paragraph ${pIdx + 1}`,
      paragraph_index: paragraphObj.paragraph_index !== undefined ? paragraphObj.paragraph_index : pIdx,
      chapter_index: chapterIdx,
      paragraph_id: paragraphObj.meta?.paragraph_id || `C${chapterIdx}_P${pIdx}`
    },
    summary: paragraphObj.summary,
    start10: paragraphObj.start10,
    end10: paragraphObj.end10,
    sections: []
  };

  const sections = paragraphObj.sections || [];
  sections.forEach((section, sIdx) => {
    const newSection = {
      ...section,
      section_id: section.section_id || `C${chapterIdx}_P${pIdx}_S${sIdx}`,
      _panels: section._panels || [null, null, null]
    };
    newParagraph.sections.push(newSection);
  });

  if (targetParagraphIdx !== null && targetParagraphIdx < chapter.paragraphs.length) {
    chapter.paragraphs[targetParagraphIdx] = newParagraph;
  } else {
    chapter.paragraphs.push(newParagraph);
  }
}


