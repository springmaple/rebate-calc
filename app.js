const {app, BrowserWindow} = require('electron')

app.on('browser-window-created', function (e, window) {
  window.setMenu(null);
});

app.on('ready', createWindow)

function createWindow() {
  let win = new BrowserWindow({ width: 1000, height: 600 })
  win.on('closed', () => {
    win = null
  })

  // Or load a local HTML file
  win.loadURL(`file://${__dirname}/html/index.html`)
}