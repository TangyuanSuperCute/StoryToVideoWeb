import { state } from './state.js';
import { $ } from './utils.js';

function getCurrentSection() {
  const secPos = state.currentSection || null;
  if (!secPos) return null;
  const { cIdx, pIdx, sIdx } = secPos;
  return state.story?.chapters?.[cIdx]?.paragraphs?.[pIdx]?.sections?.[sIdx] || null;
}

function sectionKey() {
  const s = state.currentSection; if (!s) return '';
  return `${s.cIdx}-${s.pIdx}-${s.sIdx}`;
}

export function openImageGenModal(slotIndex) {
  const section = getCurrentSection(); if (!section) return;
  const modal = $('#imgGenModal');
  modal.classList.remove('hidden');
  modal.dataset.slotIndex = String(slotIndex);
  // 预填服务器与目录
  const savedServer = state.imageGen.server || localStorage.getItem('imggen_server') || 'https://cpngame.online/';
  const serverInput = document.getElementById('imgGenServer');
  if (serverInput) serverInput.value = savedServer;
  // 合成白底预览
  synthesizeSlotToCanvas(section, slotIndex);
  // 不再在弹窗中显示候选

  // 绑定一次性按钮
  $('#imgGenClose').onclick = () => modal.classList.add('hidden');
  $('#imgGenGenerate').onclick = async () => {
    try {
      await startGenerationFromModal();
    } catch (err) {
      console.error(err);
      alert(`生成失败：${err.message || err}`);
    }
  };
  // 选择本地目录（OPFS，需 https 环境或 localhost）
  $('#chooseLocalDir').onclick = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      state.imageGen.localDirHandle = dirHandle;
      $('#imgGenLocalDirLabel').value = dirHandle.name || '已选择';
      localStorage.setItem('imggen_local_dir', dirHandle.name || 'selected');
    } catch (e) {
      console.warn('目录选择取消或失败', e);
    }
  };
  // 尺寸变化时预览重绘
  const wInput = document.getElementById('imgGenWidth');
  const hInput = document.getElementById('imgGenHeight');
  if (wInput) wInput.oninput = () => synthesizeSlotToCanvas(section, slotIndex);
  if (hInput) hInput.oninput = () => synthesizeSlotToCanvas(section, slotIndex);
  // 将 visual_description 预填到提示词区域并全选聚焦
  try {
    const vd = (section.storyboard?.panels?.[slotIndex]?.image_description?.visual_description) || '';
    const promptEl = document.getElementById('imgGenPrompt');
    if (promptEl) {
      promptEl.value = vd || '';
      promptEl.focus();
      promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length);
    }
  } catch {}
}
function ensureCandidatesPanelExists() {
  let grid = document.querySelector('#sbCandGrid');
  if (grid) return grid;
  const container = document.querySelector('#storyboardContainer');
  if (!container) return null;
  const layoutEl = container.querySelector('.sb-layout');
  if (!layoutEl) return null;
  let overlay = layoutEl.querySelector('.sb-candidates-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sb-candidates-overlay';
    overlay.innerHTML = `<div id="sbCandGrid" class="sb-cand-grid"></div>`;
    layoutEl.appendChild(overlay);
  }
  return overlay.querySelector('#sbCandGrid');
}


function renderCandidates(key, slot) {
  const box = $('#imgGenCandidates');
  if (!box) return; // 弹窗已移除候选区域时直接跳过
  box.innerHTML = '';
  const task = state.imageGen.tasks[`${key}-${slot}`] || { images: [] };
  task.images.forEach((url, i) => {
    const d = document.createElement('div');
    d.className = 'cand';
    d.innerHTML = `<img src="${url}" alt="cand ${i+1}"/>`;
    d.addEventListener('click', () => applyCandidateToSlot(url, slot));
    box.appendChild(d);
  });
}

async function applyCandidateToSlot(url, slotIndex) {
  const section = getCurrentSection(); if (!section) return;
  if (!Array.isArray(section._slotLayers)) section._slotLayers = [];
  const layer = { id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`, src: url, x: 0, y: 0, scale: 1, rotate: 0 };
  section._slotLayers[slotIndex] = section._slotLayers[slotIndex] || [];
  section._slotLayers[slotIndex].push(layer);
  // 通知重绘
  document.dispatchEvent(new CustomEvent('storyboard-updated'));
}

function synthesizeSlotToCanvas(section, slotIndex) {
  const canvas = /** @type {HTMLCanvasElement} */(document.getElementById('imgGenPreview'));
  const w = parseInt($('#imgGenWidth').value || '1024', 10) || 1024;
  const h = parseInt($('#imgGenHeight').value || '1024', 10) || 1024;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const targetSlot = document.querySelector(`.sb-slot[data-sb-slot-index="${slotIndex}"]`);
  const inner = targetSlot ? targetSlot.closest('.sb-layout-inner') : document.querySelector('.sb-layout-inner');
  const innerRect = inner ? inner.getBoundingClientRect() : { width: 1, height: 1, left: 0, top: 0 };
  const slotRect = targetSlot ? targetSlot.getBoundingClientRect() : innerRect;
  // 仅以当前槽位尺寸作为基准做适配，避免把整个布局的空白计算进去
  const baseW = targetSlot ? targetSlot.clientWidth : (inner ? inner.clientWidth : innerRect.width);
  const baseH = targetSlot ? targetSlot.clientHeight : (inner ? inner.clientHeight : innerRect.height);
  const scale = Math.min(w / baseW, h / baseH);
  const offsetX = (w - baseW * scale) / 2;
  const offsetY = (h - baseH * scale) / 2;
  // 只读取当前槽位的 .sb-layer，避免把其他槽位/分镜的图层一并合成
  const layerEls = targetSlot ? Array.from(targetSlot.querySelectorAll('.sb-layer')) : [];
  const promises = layerEls.map(layerEl => new Promise(resolve => {
    const imgEl = layerEl.querySelector('img');
    if (!imgEl) return resolve();
    const layerRect = layerEl.getBoundingClientRect();
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 解析矩阵获取纯缩放与旋转，避免使用旋转后外接矩形造成形变
      let ang = 0; let sx = 1; let sy = 1;
      try {
        const t = getComputedStyle(layerEl).transform;
        if (t && t !== 'none') {
          const m = t.match(/matrix\(([^)]+)\)/);
          if (m) {
            const [a, b, c, d] = m[1].split(',').map(v => parseFloat(v.trim())).slice(0,4);
            ang = Math.atan2(b, a);
            sx = Math.hypot(a, b);
            sy = Math.hypot(c, d);
          }
        }
      } catch {}
      const baseW = layerEl.offsetWidth || img.naturalWidth;
      const baseH = layerEl.offsetHeight || img.naturalHeight;
      const dw = baseW * sx * scale;
      const dh = baseH * sy * scale;
      // 使用旋转后的外接矩形中心（相对于当前槽位）作为绘制中心
      const centerX = offsetX + (layerRect.left - slotRect.left + layerRect.width / 2) * scale;
      const centerY = offsetY + (layerRect.top - slotRect.top + layerRect.height / 2) * scale;
      ctx.save();
      ctx.translate(centerX, centerY);
      if (ang) ctx.rotate(ang);
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = imgEl.src;
  }));
  return Promise.all(promises);
}

async function startGenerationFromModal() {
  const server = $('#imgGenServer').value.trim();
  const w = parseInt($('#imgGenWidth').value || '1024', 10) || 1024;
  const h = parseInt($('#imgGenHeight').value || '1024', 10) || 1024;
  const promptExtra = $('#imgGenPrompt').value || '';
  if (!server) throw new Error('请填写 ComfyUI 服务器地址');
  state.imageGen.server = server;
  localStorage.setItem('imggen_server', server);

  // 立即关闭弹窗，并在编辑页候选栏显示“生成中”占位
  try {
    const modalEl = document.getElementById('imgGenModal');
    if (modalEl) modalEl.classList.add('hidden');
    const grid = ensureCandidatesPanelExists();
    if (grid) {
      const pending = document.createElement('div');
      pending.className = 'sb-cand pending';
      pending.innerHTML = '<div style="display:grid;place-items:center;height:100px;color:#9ca3af">生成中…</div>';
      grid.prepend(pending);
    }
  } catch {}

  const sec = getCurrentSection(); if (!sec) throw new Error('无当前小节');
  const slotIndex = parseInt($('#imgGenModal').dataset.slotIndex || '0', 10) || 0;

  // 1) 将白底合成图导出并上传到服务器（经你的聚合服务）
  await synthesizeSlotToCanvas(sec, slotIndex);
  const canvas = /** @type {HTMLCanvasElement} */(document.getElementById('imgGenPreview'));
  // 为避免后端 413，优先使用 JPEG 并在失败(如 413)时自动降质重试
  const tryQualities = [0.85, 0.65, 0.5];
  let uploaded = false; let lastErr; let uploadedFileName = '';
  for (const q of tryQualities) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', q);
    const currentFileName = `ref_${Date.now()}_q${Math.round(q*100)}.jpg`;
    try {
      await uploadViaAggregator(server, blob, currentFileName);
      uploaded = true;
      uploadedFileName = currentFileName;
      break;
    } catch (e) {
      lastErr = e;
      const msg = (e && (e.message || String(e))) || '';
      // 若是实体过大，则继续降低质量重试；其他错误直接抛出
      if (!/413|Entity Too Large|Request Entity Too Large/i.test(msg)) {
        throw e;
      }
    }
  }
  if (!uploaded && lastErr) throw lastErr;
  // 可选：保存一份到本地所选文件夹
  if (state.imageGen.localDirHandle) {
    try {
      const fh = await state.imageGen.localDirHandle.getFileHandle(`ref_${Date.now()}.jpg`, { create: true });
      const writable = await fh.createWritable();
      // 以中等质量导出一份本地文件
      const localBlob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
      await writable.write(localBlob);
      await writable.close();
    } catch (e) { console.warn('保存本地失败', e); }
  }

  // 2) 调用 ComfyUI workflow 接口（使用附带的通用工作流模板）
  const vd = (sec.storyboard?.panels?.[slotIndex]?.image_description?.visual_description) || '';
  const fullPrompt = `${vd}${promptExtra ? `\n${promptExtra}` : ''}`;
  const promptId = await requestContextReference(server, {
    prompt: fullPrompt,
    reference_image: uploadedFileName || 'ref_latest.jpg',
    batch_size: 1,
    width: w,
    height: h,
    steps: 12,
    guidance: 2.5,
    seed: Math.floor(Math.random()*1e9)
  });

  // 3) 轮询队列/任务，获取输出图片URL，并加入候选列表
  const key = `${sectionKey()}-${slotIndex}`;
  state.imageGen.tasks[key] = state.imageGen.tasks[key] || { images: [], status: 'running' };
  // 弹窗不再显示候选与占位
  const outUrls = await waitForResultViaAggregator(server, promptId);
  state.imageGen.tasks[key] = state.imageGen.tasks[key] || { images: [] };
  state.imageGen.tasks[key].images.unshift(...outUrls);
  // 同步编辑区候选：替换“生成中”占位并刷新
  try {
    const grid = document.querySelector('#sbCandGrid');
    if (grid) {
      const first = grid.querySelector('.sb-cand.pending');
      if (first) first.remove();
    }
  } catch {}
  updateCandidatesPanel();
}

async function uploadToComfy(server, blob, dir, name) {
  const fd = new FormData();
  // 按你的服务器实现，字段名为 'image'，不需要 type/subfolder
  fd.append('image', new File([blob], name, { type: 'image/png' }));
  let resp;
  try {
    resp = await fetch(new URL('/upload/image', server), { method: 'POST', mode: 'cors', body: fd });
  } catch (e) {
    throw new Error('上传失败：网络/预检错误（可能 CORS 或协议混用）。');
  }
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`上传参考图失败 ${resp.status}: ${t}`);
  }
}

// 你的聚合服务器上传：/comfyui/upload-image（body: { message, context: { image_base64, filename } }）
async function uploadViaAggregator(server, blob, name) {
  const dataUrl = await blobToBase64(blob); // data:image/png;base64,xxxx
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const body = { message: 'upload image', context: { image_base64: base64, filename: name } };
  let resp;
  try {
    resp = await fetch(new URL('/comfyui/upload-image', server), {
      method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('上传失败：网络或预检被拦截（可能是 CORS 配置或证书问题）。');
  }
  if (!resp.ok) {
    let t = '';
    try { t = await resp.text(); } catch {}
    throw new Error(`聚合服务器上传失败 ${resp.status}: ${t}`);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 将 canvas 按指定编码导出为 Blob（封装 Promise）
function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch (_) {
      // 极端情况下 toBlob 可能不可用，退化到 toDataURL 再转 Blob
      const dataUrl = canvas.toDataURL(type, quality);
      const byteString = atob(dataUrl.split(',')[1] || '');
      const mimeString = (dataUrl.split(',')[0] || '').split(':')[1]?.split(';')[0] || type;
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      resolve(new Blob([ab], { type: mimeString }));
    }
  });
}

function buildWorkflowPayload(inputPath, width, height, promptExtra, section, slotIndex) {
  const vd = (section.storyboard?.panels?.[slotIndex]?.image_description?.visual_description) || '';
  const positive = `${vd}${promptExtra ? `\n${promptExtra}` : ''}`;
  const wf = JSON.parse(JSON.stringify(window.__comfy_base_workflow || {}));
  if (!wf || !wf.nodes || !Array.isArray(wf.nodes)) return { prompt: {} };

  // 把 workflow(nodes + links) 转为 ComfyUI /prompt 所需的 graph 结构
  const linkMap = new Map();
  (wf.links || []).forEach(arr => { const [id, fromNode, fromIdx] = arr; linkMap.set(id, { fromNode, fromIdx }); });
  const prompt = {};
  wf.nodes.forEach(node => {
    const inputs = {};
    // 绑定链路输入
    (node.inputs || []).forEach(inp => {
      if (inp.link != null) {
        const lk = linkMap.get(inp.link);
        // 使用 name 作为键（label 在 API 中并不稳定）
        if (lk) inputs[inp.name || inp.label] = [lk.fromNode, lk.fromIdx || 0];
      }
    });
    // 手动映射常见控件参数
    if (node.type === 'LoadImage') {
      // 对原生 ComfyUI，LoadImage 使用 filename + type + subfolder
      inputs['image'] = inputPath.split('/').pop();
      inputs['choose'] = 'image';
      inputs['subfolder'] = 'input';
      inputs['type'] = 'input';
    }
    if (node.type === 'EmptySD3LatentImage') {
      inputs['width'] = width; inputs['height'] = height; inputs['batch_size'] = 1;
    }
    if (node.type === 'ModelSamplingFlux') {
      inputs['width'] = width; inputs['height'] = height;
    }
    if (node.type === 'CLIPTextEncode') {
      inputs['text'] = positive;
      inputs['mask'] = null;
    }
    prompt[node.id] = { class_type: node.type, inputs };
  });
  return { prompt };
}

async function queuePrompt(server, payload) {
  const body = { prompt: payload.prompt || payload, client_id: (localStorage.getItem('comfy_client_id') || (()=>{ const id = (crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)); localStorage.setItem('comfy_client_id', id); return id; })()) };
  let resp;
  try {
    resp = await fetch(new URL('/prompt', server), {
      method: 'POST', mode: 'cors', body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('网络/预检失败（可能是CORS或HTTPS混用）。请确认目标服务允许跨域或尝试使用相同协议的地址。');
  }
  if (!resp.ok) {
    let t = '';
    try { t = await resp.text(); } catch {}
    throw new Error(`提交生图任务失败，HTTP ${resp.status} ${resp.statusText} ${t ? '- ' + t.slice(0,200) : ''}`);
  }
  const json = await resp.json();
  return json?.prompt_id || json?.promptId || json?.id || '';
}

// 你的聚合服务器提交工作流：/comfyui/execute-workflow（body: { context: { workflow, wait_for_result:false } }）
async function queuePromptViaAggregator(server, payload) {
  const body = { message: 'execute', context: { workflow: payload.prompt || payload, wait_for_result: false, max_wait_time: 300 } };
  let resp;
  try {
    resp = await fetch(new URL('/comfyui/execute-workflow', server), { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error('聚合服务器提交失败：网络或预检拦截。');
  }
  if (!resp.ok) {
    let t = '';
    try { t = await resp.text(); } catch {}
    throw new Error(`聚合服务器提交失败 ${resp.status}: ${t}`);
  }
  // 容错多种返回格式
  let data = null;
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  try {
    if (ct.includes('application/json')) data = await resp.json();
    else {
      const txt = (await resp.text()).trim();
      try { data = JSON.parse(txt); } catch { data = txt || null; }
    }
  } catch {
    // 空响应
    data = null;
  }
  let candidateId = (d => (
    d?.response?.prompt_id || d?.response?.promptId || d?.response?.task_id || d?.response?.taskId ||
    d?.prompt_id || d?.promptId || d?.task_id || d?.taskId || d?.job_id || d?.id || ''
  ))(data);
  if (!candidateId && typeof data === 'string') {
    const s = data;
    // 直接字符串里提取 prompt_id/uuid
    const m1 = s.match(/prompt[_\s-]?id\s*[:=]\s*"([^"]+)"/i);
    const m2 = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    candidateId = (m1 && m1[1]) || (m2 && m2[0]) || '';
  }
  if (candidateId) return candidateId;
  throw new Error(`聚合服务器返回异常: ${JSON.stringify(data).slice(0,200)}`);
}

async function waitForResultImages(server, promptId) {
  // 通过队列/历史接口查询，直到生成完成
  const maxWaitMs = 5 * 60 * 1000; const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 1500));
    let hist; try { hist = await fetch(new URL(`/history/${promptId}`, server), { mode: 'cors' }); } catch { continue; }
    if (!hist.ok) { continue; }
    const data = await hist.json();
    const entry = data?.[promptId];
    if (!entry) continue;
    const nodeResults = Object.values(entry.outputs || {});
    const imgs = [];
    nodeResults.forEach(out => {
      (out.images || []).forEach(im => {
        const url = new URL(`/view?filename=${encodeURIComponent(im.filename)}&type=${im.type}&subfolder=${encodeURIComponent(im.subfolder || '')}`, server).toString();
        imgs.push(url);
      });
    });
    if (imgs.length > 0) return imgs;
  }
  return [];
}

// 你的聚合服务器轮询结果：/comfyui/get-portrait-result（body: { context: { prompt_id } }）
async function waitForResultViaAggregator(server, promptId) {
  const maxWaitMs = 5 * 60 * 1000; const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 1500));
    const body = { message: 'get result', context: { prompt_id: promptId } };
    let resp; try { resp = await fetch(new URL('/comfyui/get-portrait-result', server), { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch { continue; }
    if (!resp.ok) continue;
    let data = null; try { data = await resp.json(); } catch {}
    // 兼容多种字段
    const status = data?.response?.status || data?.status || '';
    const imagesArr = data?.response?.images || data?.images || [];
    if ((data?.success === true || /completed|success/i.test(status)) && Array.isArray(imagesArr)) {
      const imgs = imagesArr.map(it => it?.image_base64 ? `data:image/png;base64,${it.image_base64}` : it?.url || it).filter(Boolean);
      if (imgs.length > 0) return imgs;
    }
  }
  return [];
}

// 直接调用你的 Context Reference 接口
async function requestContextReference(server, context) {
  const body = { message: 'context reference', context };
  const resp = await fetch(new URL('/comfyui/context-reference', server), {
    method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`context-reference 调用失败 ${resp.status}`);
  const data = await resp.json();
  if (data?.success && data.response?.prompt_id) return data.response.prompt_id;
  // 有些实现可能直接返回 {prompt_id} 或 {response:{prompt_id}}
  if (data?.response?.promptId) return data.response.promptId;
  if (data?.prompt_id) return data.prompt_id;
  throw new Error(`context-reference 返回异常: ${JSON.stringify(data).slice(0,200)}`);
}

// 可选：在入口加载时预取一次工作流模板
export async function preloadComfyWorkflow() {
  try {
    const resp = await fetch('通用context工作流.json');
    if (!resp.ok) return;
    const wf = await resp.json();
    window.__comfy_base_workflow = wf;
  } catch {}
}

export function updateCandidatesPanel() {
  const key = sectionKey();
  // 合并所有槽位的候选（简单处理：先用槽0）
  const task = state.imageGen.tasks[`${key}-0`] || { images: [] };
  const grid = ensureCandidatesPanelExists();
  if (!grid) return;
  grid.innerHTML = '';
  task.images.forEach((url) => {
    const d = document.createElement('div'); d.className = 'sb-cand';
    d.innerHTML = `<img src="${url}" />`;
    d.onclick = () => applyCandidateToSlot(url, (getCurrentSection()?._selectedLayer?.slot ?? 0));
    grid.appendChild(d);
  });
}


