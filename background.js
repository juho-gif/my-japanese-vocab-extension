// 监听快捷键 Cmd + J / Ctrl + J
chrome.commands.onCommand.addListener((command) => {
  if (command === "add-vocab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "triggerSave" });
      }
    });
  }
});

// 点击插件图标打开 Dashboard 网页
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// 监听查词消息：同时查 Jisho（日英）和 百度/谷歌接口（日中）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchWord") {
    const word = request.word;

    // 1. 日英 API (Jisho)
    const jishoUrl = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
    // 2. 日中 API (翻译)
    const cnUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;

    Promise.all([
      fetch(jishoUrl).then(res => res.json()).catch(() => null),
      fetch(cnUrl).then(res => res.json()).catch(() => null)
    ]).then(([jishoData, cnData]) => {
      
      let reading = '无';
      let level = '未分類';
      let defEN = 'No definition';
      let defCN = '暂无中文';

      // 提取 Jisho 数据（假名、等级、英文）
      if (jishoData && jishoData.data && jishoData.data.length > 0) {
        const item = jishoData.data[0];
        reading = item.japanese[0]?.reading || '无';
        
        if (item.jlpt && item.jlpt.length > 0) {
          level = item.jlpt[0].replace('jlpt-', '').toUpperCase();
        }
        
        defEN = item.senses[0]?.english_definitions.join('; ') || 'No definition';
      }

      // 提取中文翻译（直接拿最原汁原味的结果，不做复杂处理）
      if (cnData && cnData[0] && cnData[0][0] && cnData[0][0][0]) {
        defCN = cnData[0][0][0];
      }

      sendResponse({
        success: true,
        data: { word, reading, level, defEN, defCN }
      });
    });

    return true; // 保持异步
  }
});