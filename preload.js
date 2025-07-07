// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
contextBridge.exposeInMainWorld('electronAPI', {
    // Translation and Story APIs
    translate: (args) => ipcRenderer.invoke('translate-text', args),
    generateStory: (args) => ipcRenderer.invoke('gemini-generate-story', args),

    // Word Storage APIs
    addWord: (word) => ipcRenderer.invoke('add-word', word),
    getWords: () => ipcRenderer.invoke('get-words'),
});
