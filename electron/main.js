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

function getBackendPath() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        return null; // Will use Python script directly
    }

    // Production: get the bundled backend executable
    // On Windows it's backend.exe, on macOS/Linux it's just backend
    const execName = process.platform === 'win32' ? 'backend.exe' : 'backend';
    return path.join(process.resourcesPath, execName);
}

function startPythonBackend() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        // Development: run Python script directly
        const pythonScript = path.join(__dirname, '../python_backend/server.py');
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        pythonProcess = spawn(pythonCmd, [pythonScript], {
            cwd: path.join(__dirname, '../python_backend'),
            stdio: 'inherit',
            env: { ...process.env }
        });
    } else {
        // Production: run compiled executable
        const backendPath = getBackendPath();

        // Set working directory to resources path for template files
        const workingDir = process.resourcesPath;

        pythonProcess = spawn(backendPath, [], {
            cwd: workingDir,
            stdio: 'inherit',
            env: { ...process.env }
        });
    }

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python backend:', err);
    });

    pythonProcess.on('exit', (code, signal) => {
        console.log(`Python backend exited with code ${code} and signal ${signal}`);
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

// Handle SIGTERM and SIGINT for clean shutdown
process.on('SIGTERM', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    app.quit();
});

process.on('SIGINT', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    app.quit();
});
