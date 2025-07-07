const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    translate: (args) => ipcRenderer.invoke('translate-text', args),
    generateStory: (args) => ipcRenderer.invoke('gemini-generate-story', args),

    addWord: (word) => ipcRenderer.invoke('add-word', word),
    getWords: () => ipcRenderer.invoke('get-words'),
});
