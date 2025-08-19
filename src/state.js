// ============ 全局状态管理（模块） ============
export const state = {
  story: null, // 当前故事对象
  selectedSectionId: null, // 当前选中的section
  generatingParagraphs: [], // 跟踪正在生成的段落
  generatingStoryboards: [], // 跟踪正在生成分镜的 section（c-p-s 键）
  imageGen: {
    saveDir: null,
    server: null,
    tasks: {} // key: sectionKey-slotIndex -> {status, images:[], queue:[]}
  }
};


