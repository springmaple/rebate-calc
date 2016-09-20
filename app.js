const {app, BrowserWindow, ipcMain} = require('electron')
const Datastore = require('nedb')
const Util = require('./lib/util.js')

var mbrDb = new Datastore({})
var workingDate = Util.getNearestDate()

var win = null
var popupWin = null

app.on('browser-window-created', (e, window) => {
  window.setMenu(null)
})

app.on('ready', () => {
  win = new BrowserWindow({ width: 1000, height: 600 })
  win.on('closed', () => {
    win = null
  })

  win.loadURL(`file://${__dirname}/front/html/mbr-ls.html`)
})


ipcMain.on('show-mbr-new', (evt, arg) => {
  popupWin = new BrowserWindow({
    parent: win,  
    modal: true,
    maximizable: false,
    minimizable: false,
    width: 800
  })
  popupWin.on('closed', () => {
    popupWin = null
  })
  popupWin.loadURL(`file://${__dirname}/front/html/mbr-new.html`)
})

ipcMain.on('show-mbr-info', (evt, _id) => {
  popupWin = new BrowserWindow({
    parent: win,  
    modal: true,
    maximizable: false,
    minimizable: false,
  })
  popupWin.on('closed', () => {
    popupWin = null
  })
  popupWin.loadURL(`file://${__dirname}/front/html/mbr-info.html?_id=${_id}`)
})

ipcMain.on('show-mbr-rebate', (evt, _id) => {
  popupWin = new BrowserWindow({
    parent: win,  
    modal: true,
    minimizable: false,
  })
  popupWin.on('closed', () => {
    popupWin = null
  })
  popupWin.loadURL(`file://${__dirname}/front/html/mbr-rebate.html?_id=${_id}`)
})

ipcMain.on('set-working-date', (evt, date) => {
  workingDate = date
  win.webContents.send('ls-mbr-reload', null)
})

ipcMain.on('new-mbr', (evt, mbr) => {
  mbr._workingDate = workingDate
  mbrDb.insert(mbr, function (err, newMbr) {
    if (err !== null) 
      evt.sender.send('new-mbr', err)
    else {
      popupWin.close()
      win.webContents.send('ls-mbr-reload', null)
    }
  })
})

ipcMain.on('ls-mbr', (evt, date) => {
  if (date === null)
    date = workingDate
  
  mbrDb.find({_workingDate: {$lte: date}}, (err, mbrs) => {
    evt.sender.send('ls-mbr', mbrs)
  })
})

ipcMain.on('get-mbr', (evt, _id) => {
  mbrDb.findOne({_id: _id}, (err, mbr) => {
    evt.sender.send('get-mbr', mbr)
  })
})

ipcMain.on('upd-mbr', (evt, obj) => {
  // obj: {_id: 'xxx', mbr: {...}}
  mbrDb.update({_id: obj._id}, {$set: obj.mbr}, {returnUpdatedDocs: true}, 
    function(err, numAffected, affectedDocuments, upsert) {
      popupWin.close()
      win.webContents.send('ls-mbr-reload', null)
    }
  )
})