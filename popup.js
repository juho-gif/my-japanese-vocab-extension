document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ vocabList: [], userLang: 'CN' }, (result) => {
    const list = result.vocabList || [];
    const currentLang = result.userLang || 'CN';
    const container = document.getElementById('word-list');
    const totalCount = document.getElementById('total-count');

    if (totalCount) {
      totalCount.textContent = list.length;
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="empty">まだ単語がありません。<br>Cmd+J で追加してください！</div>';
      return;
    }

    container.innerHTML = list.slice().reverse().map(item => {
      const level = item.level || '未分類';
      const word = item.word || '未知';
      const reading = item.reading || '无';
      
      // 兼容所有新旧数据格式
      let displayDef = 'No definition';
      if (currentLang === 'CN') {
        displayDef = item.definitionCN || item.definition || '暂无中文';
      } else {
        displayDef = item.definitionEN || item.definition || 'No definition';
      }

      return `
        <div class="card">
          <span class="badge ${level}">${level}</span>
          <div class="word">${word}</div>
          <div class="reading">【${reading}】</div>
          <div class="def">${displayDef}</div>
          <div class="meta">📅 ${item.date || ''}</div>
        </div>
      `;
    }).join('');
  });
});