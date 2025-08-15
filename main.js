import { state } from './src/state.js';
import { $, $all, showNotification, safeJsonParse } from './src/utils.js';
import { detectJsonType, importStory, importChapter, importParagraph } from './src/storyImport.js';
import {
  renderTree as renderTreeMod,
  updateEntities as updateEntitiesMod,
  updateEntityList as updateEntityListMod,
  addNewChapter as addNewChapterMod,
  addNewParagraph as addNewParagraphMod,
  deleteChapter as deleteChapterMod,
  deleteParagraph as deleteParagraphMod,
  deleteSection as deleteSectionMod,
  highlightActiveNode as highlightActiveNodeMod,
  bindTreeSearch as bindTreeSearchMod
} from './src/treeRender.js';
import {
  selectSection as selectSectionMod,
  renderList as renderListMod,
  updateSectionIntentFromEditor as updateSectionIntentFromEditorMod,
  highlightAndSortGlobalMeta as highlightAndSortGlobalMetaMod,
  clearGlobalMetaHighlight as clearGlobalMetaHighlightMod
} from './src/editorView.js';
import {
  createPanelSlots as createPanelSlotsMod,
  initCanvasArea as initCanvasAreaMod,
  handleImageUpload as handleImageUploadMod,
  clearCanvas as clearCanvasMod,
  removePanel as removePanelMod,
  updatePanelSlots as updatePanelSlotsMod
} from './src/panels.js';
import { openStoryFile as openStoryFileMod, saveStoryAs as saveStoryAsMod, clearStory as clearStoryMod } from './src/fileOps.js';
import { updateStoryName as updateStoryNameMod, updateChapterTitle as updateChapterTitleMod, updateParagraphTitle as updateParagraphTitleMod } from './src/metadata.js';
import { openImportModal as openImportModalMod, closeImportModal as closeImportModalMod, parseImportJson as parseImportJsonMod, bindImportModalControls as bindImportModalControlsMod } from './src/modals.js';

// ============ JSON结构检测 ============
// moved to src/storyImport.js

// ============ 初始化空故事 ============
function initEmptyStory() {
  state.story = {
    meta: {
      story_id: "new_story",
      name: "Untitled Story",
      created_at: new Date().toISOString()
    },
    chapters: []
  };
  renderTreeMod();
}

// ============ 渲染目录树 ============
// moved to src/treeRender.js

// 导入JSON处理迁移至 src/modals.js

// ============ 导入处理函数 ============
// moved to src/storyImport.js

// moved to src/storyImport.js

// moved to src/storyImport.js

// ============ 新建操作 ============
// moved to src/treeRender.js

// moved to src/treeRender.js

// ============ Section选择和编辑 ============
// moved to src/editorView.js

// moved to src/editorView.js

// moved to src/treeRender.js

// ============ 实体统计 ============
// moved to src/treeRender.js

// moved to src/treeRender.js

// ============ 面板管理 ============
// moved to src/panels.js

// 初始化画布区域
// moved to src/panels.js

// 初始化标签页切换（已移除标签页设计）
// moved to src/panels.js

// moved to src/panels.js

// moved to src/panels.js

// moved to src/panels.js

// moved to src/panels.js

// ============ 初始化 ============
function initializeApp() {
  try {
  // 仅在编辑器页面执行的初始化
  if (document.querySelector('.app-container')) {
    const shotTree = $('#shotTree');
    if (shotTree) {
      shotTree.classList.add('tree');
    }

    const storyFromAI = localStorage.getItem('aiStory');
    if (storyFromAI) {
        const [storyData, err] = safeJsonParse(storyFromAI);
        if (storyData && !err) {
            importStory(storyData);
          renderTreeMod();
            showNotification('成功加载AI生成的故事！', 'success');
        }
        localStorage.removeItem('aiStory');
    } else {
        initEmptyStory();
    }
    
    // 创建面板槽位
      createPanelSlotsMod();

      // 绑定模态框事件（迁移到模块）
      bindImportModalControlsMod();

      // 搜索功能（委托到模块）
      bindTreeSearchMod();

      // 兜底刷新一次目录
      if (state.story) {
        renderTreeMod();
      }
    }
  } catch (err) {
    console.error('Editor initialize error:', err);
    showNotification('初始化编辑器失败，请查看控制台错误', 'error');
  }

  // 首页特有的逻辑（独立绑定，避免被前面错误影响）
  const startDisassembleBtn = $('#startDisassemble');
  if (startDisassembleBtn) {
    startDisassembleBtn.addEventListener('click', () => {
      const storyText = $('#storyInput').value;
      const apiKey = $('#apiKeyInput').value;
      if (!storyText.trim()) { showNotification('请输入故事内容', 'error'); return; }
      if (!apiKey.trim()) { showNotification('请输入OpenRouter API Key', 'error'); return; }
      import('./src/ai.js').then(m => m.disassembleStoryWithAI(storyText, apiKey));
    });
  }

  const loadStoryBtn = $('#loadStoryFile');
  if (loadStoryBtn) {
    loadStoryBtn.addEventListener('click', () => handleFileUpload('#storyInput'));
  }
  const loadKeyBtn = $('#loadApiKeyFile');
  if (loadKeyBtn) {
    loadKeyBtn.addEventListener('click', () => handleFileUpload('#apiKeyInput'));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function handleFileUpload(targetElementSelector) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            $(targetElementSelector).value = text;
            showNotification('文件内容已成功读取！', 'success');
        } catch (err) {
            showNotification('读取文件失败', 'error');
            console.error('File read error:', err);
        }
    };
    input.click();
}

// duplicate disassembleStoryWithAI removed (see src/ai.js)


// ============ 文件操作 ============
// moved to src/fileOps.js

// moved to src/fileOps.js

// moved to src/fileOps.js

// ============ 标题编辑 ============
// moved to src/metadata.js

// ============ 删除功能 ============
// moved to src/treeRender.js

// moved to src/treeRender.js

// moved to src/treeRender.js

// 导出全局函数供HTML调用
window.openImportModal = openImportModalMod;
window.closeImportModal = closeImportModalMod;
window.parseImportJson = parseImportJsonMod;
// 以下接口逐步收敛，事件委托已替代
// 保留 minimal 对外接口：导入弹窗
window.updateStoryName = updateStoryNameMod;
window.updateChapterTitle = updateChapterTitleMod;
window.updateParagraphTitle = updateParagraphTitleMod;
// 删除/新增等操作已由事件委托驱动，无需 window 暴露

// 添加section intent更新函数 - 从编辑器更新
// moved to src/editorView.js
// 由模块内部事件绑定处理，不再暴露

// moved to src/ai.js


// ============ 段落级 Section 生成 ============
// 生成分节逻辑已迁移到 src/ai.js（事件委托直接调用模块）


// moved to src/editorView.js

// moved to src/editorView.js

// 清除高亮（当没有选中section时调用）
// moved to src/editorView.js

// 导出函数供外部调用
window.highlightAndSortGlobalMeta = highlightAndSortGlobalMetaMod;
window.clearGlobalMetaHighlight = clearGlobalMetaHighlightMod;
window.clearCanvas = clearCanvasMod;
