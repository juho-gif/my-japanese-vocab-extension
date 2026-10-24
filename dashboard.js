let currentTab = 'learning'; 
let currentLevel = 'ALL';
let currentLang = 'CN'; 
let isDarkMode = false;
let allVocabList = [];
let selectedWordIndex = -1; 

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ vocabList: [], userLang: 'CN', darkMode: false }, (result) => {
    const rawList = Array.isArray(result.vocabList) ? result.vocabList : [];
    allVocabList = rawList.map(item => {
      if (!item || typeof item !== 'object') return null;
      return {
        word: item.word || '未知',
        reading: item.reading || '无',
        level: item.level || '未分類',
        definitionCN: item.definitionCN || item.definition || '暂无',
        definitionEN: item.definitionEN || item.definition || 'None',
        sentence: item.sentence || '', // ✨ 保留例句数据
        date: item.date || new Date().toISOString().split('T')[0],
        isMastered: !!item.isMastered
      };
    }).filter(Boolean);

    currentLang = result.userLang || 'CN';
    isDarkMode = !!result.darkMode;

    applyTheme();
    updateLangBtnText();
    renderCounts();
    renderCards();
  });

  // 切换 学习中 / 覚えた 视图
  document.getElementById('toggle-view-btn').addEventListener('click', (e) => {
    if (currentTab === 'learning') {
      currentTab = 'mastered';
      e.target.textContent = '🔙 学習中に戻す';
      e.target.style.background = '#3b82f6';
    } else {
      currentTab = 'learning';
      e.target.textContent = '✅ 覚えたリスト';
      e.target.style.background = '#d97706';
    }
    renderCounts();
    renderCards();
  });

  document.getElementById('vocab-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) openDetailModal(parseInt(card.getAttribute('data-index'), 10));
  });

  document.getElementById('lang-btn')?.addEventListener('click', () => {
    currentLang = currentLang === 'CN' ? 'EN' : 'CN';
    chrome.storage.local.set({ userLang: currentLang });
    updateLangBtnText();
    renderCards();
  });

  document.getElementById('theme-btn')?.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    chrome.storage.local.set({ darkMode: isDarkMode });
    applyTheme();
  });

  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      currentLevel = target.getAttribute('data-level');
      renderCards();
    });
  });

  document.getElementById('close-detail').onclick = () => closeModal('detail-modal');
  document.getElementById('close-add').onclick = () => closeModal('add-modal');
  document.getElementById('add-word-btn').onclick = () => document.getElementById('add-modal').classList.add('show');
  
  document.getElementById('submit-new-btn').onclick = addNewWord;
  document.getElementById('save-edit-btn').onclick = saveWordEdit;
  document.getElementById('toggle-master-btn').onclick = toggleMasterStatus;
  document.getElementById('delete-word-btn').onclick = deleteWord;

  document.getElementById('auto-fetch-btn').addEventListener('click', autoFetchWordInfo);
});

async function autoFetchWordInfo() {
  const word = document.getElementById('new-word').value.trim();
  if (!word) {
    alert('先に単語を入力してください！');
    return;
  }
  
  const btn = document.getElementById('auto-fetch-btn');
  btn.textContent = '⏳ 取得中...';
  btn.disabled = true;

  try {
    let reading = '', en = '', cn = '', level = '未分類';
    
    const jishoRes = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`);
    const jishoData = await jishoRes.json();
    if (jishoData && jishoData.data && jishoData.data[0]) {
      const firstHit = jishoData.data[0];
      reading = firstHit.japanese?.[0]?.reading || '';
      en = firstHit.senses?.[0]?.english_definitions?.join(', ') || '';
      const match = firstHit.jlpt?.[0]?.match(/n\d/i);
      if (match) level = match[0].toUpperCase();
    }

    const gtRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`);
    const gtData = await gtRes.json();
    if (gtData && gtData[0] && gtData[0][0] && gtData[0][0][0]) {
      cn = gtData[0][0][0];
    }

    document.getElementById('new-reading').value = reading;
    document.getElementById('new-level').value = level;
    document.getElementById('new-en').value = en;
    document.getElementById('new-cn').value = cn;

  } catch (e) {
    console.error(e);
    alert('APIエラー。手動で入力してください。');
  } finally {
    btn.textContent = '🪄 自動取得';
    btn.disabled = false;
  }
}

function applyTheme() {
  if (isDarkMode) { document.body.classList.add('dark-mode'); document.getElementById('theme-btn').textContent = '☀️ Light Mode'; } 
  else { document.body.classList.remove('dark-mode'); document.getElementById('theme-btn').textContent = '🌙 Dark Mode'; }
}

function updateLangBtnText() {
  document.getElementById('lang-btn').textContent = `🌐 釈義言語: ${currentLang === 'CN' ? '中文' : 'English'}`;
}

function renderCounts() {
  const currentTabList = allVocabList.filter(item => currentTab === 'mastered' ? item.isMastered : !item.isMastered);
  const counts = { ALL: currentTabList.length, N5: 0, N4: 0, N3: 0, N2: 0, N1: 0, '未分類': 0 };
  
  currentTabList.forEach(item => {
    const lvl = item.level || '未分類';
    if (counts[lvl] !== undefined) counts[lvl]++;
    else counts['未分類']++;
  });

  Object.keys(counts).forEach(lvl => {
    const el = document.getElementById(`cnt-${lvl}`);
    if (el) el.textContent = counts[lvl];
  });
  document.getElementById('total-count').textContent = `表示中: ${currentTabList.length} 件 (全 ${allVocabList.length} 件)`;
}

function renderCards() {
  const grid = document.getElementById('vocab-grid');
  if (!grid) return;

  let filtered = allVocabList.filter(item => currentTab === 'mastered' ? item.isMastered : !item.isMastered);
  if (currentLevel !== 'ALL') filtered = filtered.filter(item => (item.level || '未分類') === currentLevel);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty">該当する単語がありません。</div>';
    return;
  }

  // ✨ 卡片上不再渲染例文，保持清爽
  grid.innerHTML = filtered.slice().reverse().map((item) => {
    const displayDef = currentLang === 'CN' ? item.definitionCN : item.definitionEN;
    const realIndex = allVocabList.indexOf(item);
    
    return `
      <div class="card" data-index="${realIndex}">
        <span class="badge ${item.level}">${item.level}</span>
        <div class="word">${item.word}</div>
        <div class="reading">【${item.reading}】</div>
        <div class="def">${displayDef}</div>
      </div>
    `;
  }).join('');
}

function openDetailModal(index) {
  selectedWordIndex = index;
  const item = allVocabList[index];

  document.getElementById('edit-word').value = item.word;
  document.getElementById('edit-reading').value = item.reading;
  document.getElementById('edit-level').value = item.level;
  document.getElementById('edit-cn').value = item.definitionCN;
  document.getElementById('edit-en').value = item.definitionEN;
  document.getElementById('edit-sentence').value = item.sentence || ''; // 读取例句

  const toggleBtn = document.getElementById('toggle-master-btn');
  if (item.isMastered) {
    toggleBtn.textContent = '🔄 また忘れちゃった';
    toggleBtn.style.background = '#f97316';
  } else {
    toggleBtn.textContent = '✅ 覚えた';
    toggleBtn.style.background = '#10b981';
  }

  document.getElementById('detail-modal').classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

function saveWordEdit() {
  if (selectedWordIndex === -1) return;
  allVocabList[selectedWordIndex].word = document.getElementById('edit-word').value.trim();
  allVocabList[selectedWordIndex].reading = document.getElementById('edit-reading').value.trim();
  allVocabList[selectedWordIndex].level = document.getElementById('edit-level').value;
  allVocabList[selectedWordIndex].definitionCN = document.getElementById('edit-cn').value.trim();
  allVocabList[selectedWordIndex].definitionEN = document.getElementById('edit-en').value.trim();
  allVocabList[selectedWordIndex].sentence = document.getElementById('edit-sentence').value.trim(); // 保存例句
  
  saveToStorage();
  closeModal('detail-modal');
}

function toggleMasterStatus() {
  if (selectedWordIndex === -1) return;
  allVocabList[selectedWordIndex].isMastered = !allVocabList[selectedWordIndex].isMastered;
  saveToStorage();
  closeModal('detail-modal');
}

function deleteWord() {
  if (selectedWordIndex === -1) return;
  if (confirm(`「${allVocabList[selectedWordIndex].word}」を削除しますか？`)) {
    allVocabList.splice(selectedWordIndex, 1);
    saveToStorage();
    closeModal('detail-modal');
  }
}

function addNewWord() {
  const word = document.getElementById('new-word').value.trim();
  if (!word) { alert('単語を入力してください！'); return; }

  allVocabList.push({
    word: word,
    reading: document.getElementById('new-reading').value.trim() || '无',
    level: document.getElementById('new-level').value,
    definitionCN: document.getElementById('new-cn').value.trim() || '暂无',
    definitionEN: document.getElementById('new-en').value.trim() || 'None',
    sentence: document.getElementById('new-sentence').value.trim(), // ✨ 录入新例句
    date: new Date().toISOString().split('T')[0],
    isMastered: false
  });

  saveToStorage();
  document.getElementById('new-word').value = '';
  document.getElementById('new-reading').value = '';
  document.getElementById('new-cn').value = '';
  document.getElementById('new-en').value = '';
  document.getElementById('new-sentence').value = ''; // 清空例句
  closeModal('add-modal');
}

function saveToStorage() {
  chrome.storage.local.set({ vocabList: allVocabList }, () => {
    renderCounts();
    renderCards();
  });
}