const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Development mode: load from Nuxt dev server
    // Production mode: load from generated static files
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../.output/public/index.html'));
    }
}

function startPythonBackend() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        // Development: run Python script directly
        const pythonScript = path.join(__dirname, '../python_backend/server.py');
        pythonProcess = spawn('python3', [pythonScript], {
            cwd: path.join(__dirname, '../python_backend'),
            stdio: 'inherit'
        });
    } else {
        // Production: run compiled executable
        const backendExe = path.join(process.resourcesPath, 'backend.exe');
        pythonProcess = spawn(backendExe, {
            stdio: 'inherit'
        });
    }

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python backend:', err);
    });
}

app.whenReady().then(() => {
    startPythonBackend();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    // Kill Python process when app quits
    if (pythonProcess) {
        pythonProcess.kill();
    }
});

