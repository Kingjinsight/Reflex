// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fetch = require('node-fetch'); // For Gemini API calls
const { translate } = require('@vitalets/google-translate-api');

// Store will be initialized asynchronously
let store;
let mainWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    // and load the index.html of the app.
    mainWindow.loadFile('index.html');
}

app.whenReady().then(async () => {
    // FIX: Dynamically import electron-store
    const { default: Store } = await import('electron-store');
    
    // Initialize electron-store after it has been imported
    store = new Store({
        defaults: {
            dailyWords: {
                date: '',
                words: []
            },
            allTimeWords: []
        }
    });

    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// --- Word Storage Logic ---
function getTodayDateString() {
    return new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

ipcMain.handle('add-word', (event, word) => {
    const todayStr = getTodayDateString();
    const dailyData = store.get('dailyWords');
    const allTimeWords = store.get('allTimeWords');

    // Check if the date has changed; if so, reset the daily words
    if (dailyData.date !== todayStr) {
        dailyData.date = todayStr;
        dailyData.words = [];
        console.log('New day detected. Daily words have been reset.');
    }

    // Add to daily words if not already present
    if (!dailyData.words.includes(word)) {
        dailyData.words.push(word);
        if (dailyData.words.length > 10) dailyData.words.shift();
        console.log(`Added "${word}" to daily list.`);
    }

    // Add to all-time history if not already present
    if (!allTimeWords.includes(word)) {
        allTimeWords.push(word);
        console.log(`Added "${word}" to all-time history.`);
    }

    // Save back to the store
    store.set('dailyWords', dailyData);
    store.set('allTimeWords', allTimeWords);
});

ipcMain.handle('get-words', () => {
    // Also check date when retrieving words, just in case
    const todayStr = getTodayDateString();
    const dailyData = store.get('dailyWords');
    if (dailyData.date !== todayStr) {
        store.set('dailyWords', { date: todayStr, words: [] });
        return { daily: [], allTime: store.get('allTimeWords') };
    }
    return { daily: dailyData.words, allTime: store.get('allTimeWords') };
});


// --- API Handlers ---

ipcMain.handle('translate-text', async (event, { text, sourceLangCode, targetLangCode, mode, apiKey }) => {
    console.log(`Received ${mode} translation request for: "${text}"`);
    
    if (mode === 'dictionary') {
        try {
            const res = await translate(text, { from: sourceLangCode, to: targetLangCode });
            return res.text;
        } catch (error) {
            console.error('Google Translate API error:', error);
            throw new Error('Dictionary translation failed.');
        }
    } else { // 'ai_model'
        if (!apiKey) throw new Error('API Key is missing.');
        const prompt = `Translate the following text from ${sourceLangCode} to ${targetLangCode}, the output should be text rather than markdown. If the input is a single word, provide a dictionary-style entry with the following information: Translation(s): List the primary and any secondary meanings. If the input is a sentence or phrase, provide only the direct translation. Input text: '${text}'`;
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (!response.ok) throw new Error(`API request failed: ${await response.text()}`);
            const data = await response.json();
            if (data.candidates?.[0]?.content?.parts?.[0]) {
                 return data.candidates[0].content.parts[0].text.trim();
            }
            throw new Error('Invalid response structure from Gemini API.');
        } catch (error) {
            console.error('Failed to call Gemini API:', error);
            throw new Error('Failed to get translation from Gemini.');
        }
    }
});

ipcMain.handle('gemini-generate-story', async (event, { words, apiKey }) => {
    console.log(`Received story generation request for words: ${words.join(', ')}`);
    if (!apiKey) throw new Error('API Key is missing.');
    const prompt = `Write a very short, intersting two people talking for an English learner. The story must include the following words: ${words.join(', ')}. The story should contain some daily used words or slangs. Return the story in HTML format with the keywords wrapped in <strong> tags and without markdown language, just text.`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) throw new Error(`API request failed: ${await response.text()}`);
        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]) {
             return data.candidates[0].content.parts[0].text.trim();
        }
        throw new Error('Invalid response structure from Gemini API for story generation.');
    } catch (error) {
        console.error('Failed to call Gemini API for story:', error);
        throw new Error('Failed to generate story from Gemini.');
    }
});
