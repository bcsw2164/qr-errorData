const IMG_DIR = 'images';
const ORIGINAL_FILE = 'qr_clean_000';
const START_INDEX = 1;
const END_INDEX = 151;
const IMG_SIZE = 1000;
const DISPLAY_SIZE = 350;
const THRESHOLD = 128;

const startBtn = document.getElementById('startBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const resultBody = document.getElementById('resultBody');
const fillMaxEl = document.getElementById('fillMax');
const fillMinEl = document.getElementById('fillMin');
const overflowMaxEl = document.getElementById('overflowMax');
const overflowMinEl = document.getElementById('overflowMin');
const avgMaxEl = document.getElementById('avgMax');
const avgMinEl = document.getElementById('avgMin');

const results = {};

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + path));
    img.src = path;
  });
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function getImageData(img) {
  const canvas = document.createElement('canvas');
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, IMG_SIZE, IMG_SIZE);
  return ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
}

function isBlack(data, idx) {
  const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  return brightness < THRESHOLD;
}

function compare(origData, sketchData) {
  const total = IMG_SIZE * IMG_SIZE;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = IMG_SIZE;
  diffCanvas.height = IMG_SIZE;
  const diffCtx = diffCanvas.getContext('2d');
  const diffImageData = diffCtx.createImageData(IMG_SIZE, IMG_SIZE);
  const diffData = diffImageData.data;

  let origBlackCount = 0;
  let origWhiteCount = 0;
  let filledCount = 0;
  let overflowCount = 0;

  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    const origBlack = isBlack(origData.data, idx);
    const sketchBlack = isBlack(sketchData.data, idx);

    if (origBlack) {
      origBlackCount++;
      if (sketchBlack) filledCount++;
    } else {
      origWhiteCount++;
      if (sketchBlack) overflowCount++;
    }

    if (origBlack && !sketchBlack) {
      diffData[idx] = 255;
      diffData[idx + 1] = 0;
      diffData[idx + 2] = 0;
      diffData[idx + 3] = 255;
    } else if (!origBlack && sketchBlack) {
      diffData[idx] = 0;
      diffData[idx + 1] = 0;
      diffData[idx + 2] = 255;
      diffData[idx + 3] = 255;
    } else {
      diffData[idx + 3] = 0;
    }
  }

  diffCtx.putImageData(diffImageData, 0, 0);

  const fillRate = origBlackCount > 0 ? filledCount / origBlackCount : 0;
  const unfilledRate = 1 - fillRate;
  const overflowRate = origWhiteCount > 0 ? overflowCount / origWhiteCount : 0;

  return { unfilledRate, overflowRate, diffCanvas };
}

function makeThumbCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = DISPLAY_SIZE;
  canvas.height = DISPLAY_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
  return canvas;
}

function scaleCanvas(sourceCanvas, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0, size, size);
  return canvas;
}

function addRow(filename, thumbCanvas, diffCanvas, unfilledRate, overflowRate) {
  const row = document.createElement('tr');

  const nameCell = document.createElement('td');
  nameCell.textContent = filename;
  row.appendChild(nameCell);

  const thumbCell = document.createElement('td');
  thumbCell.appendChild(thumbCanvas);
  row.appendChild(thumbCell);

  const diffCell = document.createElement('td');
  diffCell.appendChild(scaleCanvas(diffCanvas, DISPLAY_SIZE));
  row.appendChild(diffCell);

  const fillCell = document.createElement('td');
  fillCell.className = 'col-fill';
  fillCell.textContent = unfilledRate.toFixed(3);
  row.appendChild(fillCell);

  const overflowCell = document.createElement('td');
  overflowCell.className = 'col-overflow';
  overflowCell.textContent = overflowRate.toFixed(3);
  row.appendChild(overflowCell);

  resultBody.appendChild(row);
}

async function runAnalysis() {
  startBtn.disabled = true;
  resultBody.innerHTML = '';
  for (const key in results) delete results[key];
  updateSummary();
  statusEl.textContent = '원본 로딩 중...';

  let origImg;
  try {
    origImg = await loadImage(`${IMG_DIR}/${ORIGINAL_FILE}.jpg`);
  } catch (err) {
    console.error(err);
    statusEl.textContent = '원본 이미지 로드 실패';
    startBtn.disabled = false;
    return;
  }
  const origData = getImageData(origImg);

  for (let i = START_INDEX; i <= END_INDEX; i++) {
    const filename = `qr_clean_${pad3(i)}`;
    statusEl.textContent = `분석 중... ${filename}`;
    let img;
    try {
      img = await loadImage(`${IMG_DIR}/${filename}.jpg`);
    } catch (err) {
      console.error(err);
      continue;
    }

    const sketchData = getImageData(img);
    const { unfilledRate, overflowRate, diffCanvas } = compare(origData, sketchData);
    const thumbCanvas = makeThumbCanvas(img);

    addRow(filename, thumbCanvas, diffCanvas, unfilledRate, overflowRate);
    results[filename] = { unfilledRate: Number(unfilledRate.toFixed(3)), overflowRate: Number(overflowRate.toFixed(3)) };
  }

  updateSummary();

  statusEl.textContent = '분석 완료';
  startBtn.disabled = false;
}

function updateSummary() {
  const entries = Object.entries(results);
  if (entries.length === 0) {
    fillMaxEl.textContent = '-';
    fillMinEl.textContent = '-';
    overflowMaxEl.textContent = '-';
    overflowMinEl.textContent = '-';
    avgMaxEl.textContent = '-';
    avgMinEl.textContent = '-';
    return;
  }

  const avgOf = (rates) => (rates.unfilledRate + rates.overflowRate) / 2;

  let fillMax = entries[0];
  let fillMin = entries[0];
  let overflowMax = entries[0];
  let overflowMin = entries[0];
  let avgMax = entries[0];
  let avgMin = entries[0];

  for (const entry of entries) {
    const [, rates] = entry;
    if (rates.unfilledRate > fillMax[1].unfilledRate) fillMax = entry;
    if (rates.unfilledRate < fillMin[1].unfilledRate) fillMin = entry;
    if (rates.overflowRate > overflowMax[1].overflowRate) overflowMax = entry;
    if (rates.overflowRate < overflowMin[1].overflowRate) overflowMin = entry;
    if (avgOf(rates) > avgOf(avgMax[1])) avgMax = entry;
    if (avgOf(rates) < avgOf(avgMin[1])) avgMin = entry;
  }

  fillMaxEl.textContent = `${fillMax[0]} (${fillMax[1].unfilledRate.toFixed(3)})`;
  fillMinEl.textContent = `${fillMin[0]} (${fillMin[1].unfilledRate.toFixed(3)})`;
  overflowMaxEl.textContent = `${overflowMax[0]} (${overflowMax[1].overflowRate.toFixed(3)})`;
  overflowMinEl.textContent = `${overflowMin[0]} (${overflowMin[1].overflowRate.toFixed(3)})`;
  avgMaxEl.textContent = `${avgMax[0]} (${avgOf(avgMax[1]).toFixed(3)})`;
  avgMinEl.textContent = `${avgMin[0]} (${avgOf(avgMin[1]).toFixed(3)})`;
}

async function copyResults() {
  const json = JSON.stringify(results, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    statusEl.textContent = 'JSON 복사 완료';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'JSON 복사 실패';
  }
}

startBtn.addEventListener('click', runAnalysis);
copyBtn.addEventListener('click', copyResults);
