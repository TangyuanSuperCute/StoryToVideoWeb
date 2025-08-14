import { $ } from './utils.js';

export function createPanelSlots() {
  initCanvasArea();
  initTabSwitching();
}

export function initCanvasArea() {
  const placeholder = document.querySelector('.canvas-placeholder');
  const fileInput = document.querySelector('#canvasFileInput');
  if (placeholder && fileInput) {
    placeholder.addEventListener('click', () => fileInput.click());
    const canvasArea = document.querySelector('.canvas-area');
    canvasArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      canvasArea.classList.add('dragover');
    });
    canvasArea.addEventListener('dragleave', () => {
      canvasArea.classList.remove('dragover');
    });
    canvasArea.addEventListener('drop', (e) => {
      e.preventDefault();
      canvasArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageUpload(files[0]);
      }
    });
  }
}

export function initTabSwitching() {
  // 标签页功能移除
}

export function updatePanelSlots(section) {
  const slots = document.querySelectorAll('.panel-slot');
  const panels = section._panels || [null, null, null];
  slots.forEach((slot, idx) => {
    const url = panels[idx];
    if (url) {
      slot.innerHTML = `
        <img src="${url}" alt="Panel ${idx + 1}">
        <button class="remove-btn" onclick="removePanel(${idx})">Remove</button>
      `;
    }
  });
}

export function handleImageUpload(file) {
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const canvasArea = document.querySelector('.canvas-area');
      canvasArea.innerHTML = `
        <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">
        <button class="remove-btn" onclick="clearCanvas()" style="position: absolute; top: 10px; right: 10px;">
          <i class="fas fa-times"></i> 清除
        </button>
      `;
    };
    reader.readAsDataURL(file);
  }
}

export function clearCanvas() {
  const canvasArea = document.querySelector('.canvas-area');
  canvasArea.innerHTML = `
    <div class="canvas-placeholder">
      <i class="fas fa-cloud-upload-alt"></i>
      <p>拖拽图片到此处或点击上传</p>
      <input type="file" accept="image/*" multiple style="display: none;" id="canvasFileInput">
    </div>
  `;
  initCanvasArea();
}

export function removePanel(index) {
  // 预留
}


