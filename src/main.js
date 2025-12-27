const { app, BrowserWindow, dialog, session, Menu, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const fs = require("fs");
const { ElectronBlocker } = require("@ghostery/adblocker-electron");

// logger
log.transports.file.level = "info";
autoUpdater.logger = log;

// Funkcia na inicializáciu adblocku
async function setupAdblocker() {
  try {
    const easyListPath = path.join(__dirname, "easylist.txt");
    
    if (fs.existsSync(easyListPath)) {
      const listContent = fs.readFileSync(easyListPath, "utf-8");
      const blocker = ElectronBlocker.parse(listContent);
      
      // Aplikuje adblock na všetky požiadavky v predvolenej relácii
      blocker.enableBlockingInSession(session.defaultSession);
      log.info("Adblocker úspešne načítaný z easylist.txt");
    } else {
      log.warn("Súbor easylist.txt nebol nájdený v koreňovom priečinku.");
    }
  } catch (error) {
    log.error("Chyba pri nastavovaní adblockeru:", error);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#05070f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: false, // Zmenené na false pre komunikáciu s render.js
      nodeIntegration: true,    // Povolené pre komunikáciu s render.js
      webviewTag: true 
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));

  // Logika pre sťahovanie (Progress Bar) - UPRAVENÁ ČASŤ
  win.webContents.session.on('will-download', (event, item, webContents) => {
    // Použijeme unikátne ID na sledovanie konkrétneho sťahovania v render.js
    const downloadId = item.getETag() || Date.now().toString(); 

    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        let progress = 0;
        if (total > 0) {
          progress = Math.round((received / total) * 100);
        }
        // Posiela komplexný objekt dát do render.js s názvom eventu 'download-update'
        win.webContents.send('download-update', { 
            id: downloadId, 
            percent: progress, 
            fileName: item.getFilename(),
            state: 'progressing'
        });
      }
    });
    
    item.once('done', (event, state) => {
      // Keď je sťahovanie dokončené alebo zrušené, informujeme render.js
      win.webContents.send('download-update', {
          id: downloadId,
          percent: 100,
          fileName: item.getFilename(),
          state: state // 'completed', 'cancelled', 'interrupted'
      });
    });
  });
}

// ===== KONTEXTOVÉ MENU (Pravý klik) =====
app.on('web-contents-created', (event, contents) => {
  contents.on('context-menu', (e, props) => {
    const menuItems = [];

    // Ak používateľ klikne na obrázok
    if (props.hasImageContents) {
      menuItems.push({
        label: 'Uložiť obrázok ako...',
        click: () => contents.downloadURL(props.srcURL)
      });
      menuItems.push({ type: 'separator' });
    }

    // Ak používateľ klikne na odkaz
    if (props.linkURL) {
      menuItems.push({
        label: 'Otvoriť v novom okne',
        click: () => {
          const newWin = new BrowserWindow({ width: 1200, height: 800 });
          newWin.loadURL(props.linkURL);
        }
      });
      menuItems.push({
        label: 'Kopírovať adresu odkazu',
        role: 'copyLink'
      });
      menuItems.push({ type: 'separator' });
    }

    // Štandardné možnosti
    menuItems.push(
      { label: 'Späť', click: () => contents.goBack(), enabled: contents.canGoBack() },
      { label: 'Vpred', click: () => contents.goForward(), enabled: contents.canGoForward() },
      { label: 'Znovu načítať', role: 'reload' },
      { type: 'separator' },
      { label: 'Kopírovať', role: 'copy' },
      { label: 'Prilepiť', role: 'paste' },
      { type: 'separator' },
      { label: 'Preskúmať (Inspect)', click: () => contents.openDevTools() }
    );

    const menu = Menu.buildFromTemplate(menuItems);
    menu.popup();
  });
});

// ===== AUTO UPDATER EVENTS =====
autoUpdater.on("checking-for-update", () => {
  log.info("Kontrolujem aktualizácie...");
});

autoUpdater.on("update-available", () => {
  dialog.showMessageBox({
    type: "info",
    title: "Aktualizácia",
    message: "Našla sa nová verzia. Sťahujem aktualizáciu..."
  });
});

autoUpdater.on("update-not-available", () => {
  log.info("Žiadna nová verzia");
});

autoUpdater.on("error", (err) => {
  dialog.showErrorBox(
    "Chyba aktualizácie",
    err == null ? "Neznáma chyba" : err.toString()
  );
});

autoUpdater.on("update-downloaded", () => {
  dialog.showMessageBox({
    type: "info",
    title: "Aktualizácia pripravená",
    message: "Aktualizácia je hotová. Reštartovať aplikáciu teraz?",
    buttons: ["Reštartovať", "Neskôr"]
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// ===== APP READY =====
app.whenReady().then(async () => {
  // Najprv nastavíme adblock, potom vytvoríme okno
  await setupAdblocker();
  
  createWindow();

  // spusti kontrolu po štarte appky
  autoUpdater.checkForUpdatesAndNotify();
});

// Ukončenie na macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

