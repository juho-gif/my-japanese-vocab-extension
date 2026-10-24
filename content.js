chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "triggerSave") {
    handleSelectedWord();
  }
});

function handleSelectedWord() {
  const selectedText = window.getSelection().toString().trim();
  
  if (!selectedText) {
    alert('保存する単語を選択してください！');
    return;
  }

  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(selectedText)) {
    chrome.runtime.sendMessage({ action: "fetchWord", word: selectedText }, (response) => {
      if (response && response.success) {
        const item = response.data;
        const today = new Date().toISOString().split('T')[0];

        const newWord = {
          word: item.word,
          reading: item.reading,
          level: item.level,
          definitionEN: item.defEN,
          definitionCN: item.defCN,
          date: today
        };

        saveWord(newWord);
      }
    });
  } else {
    alert('日本語のテキストを選択してください！');
  }
}

function saveWord(newWord) {
  chrome.storage.local.get({ vocabList: [] }, (result) => {
    const list = result.vocabList;
    if (!list.some(item => item.word === newWord.word)) {
      list.push(newWord);
      chrome.storage.local.set({ vocabList: list }, () => {
        alert(`保存しました！\n単語: ${newWord.word} (${newWord.reading})\nレベル: ${newWord.level}\n中文: ${newWord.definitionCN}\nEnglish: ${newWord.definitionEN}`);
      });
    } else {
      alert('この単語はすでに登録されています！');
    }
  });
}