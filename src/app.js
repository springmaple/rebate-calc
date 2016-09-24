const {app, BrowserWindow, ipcMain} = require('electron')
const Datastore = require('nedb')
const Util = require('./lib/util.js')
const htmlPath = `file://${__dirname}/front/html`

var mbrDb = new Datastore({ filename: `${__dirname}\\app.db`, autoload: true })
var workingDate = Util.getNearestDate()
var win = null
var popWin = null


function lsMbr() {
  mbrDb.find({ _startDate: { $lte: workingDate }, _doc: 'mbr' })
    .sort({ mbrName: 1 })
    .exec((err, mbrs) => {
      win.webContents.send('ls-mbr', mbrs)
    })
}

function onMbrChanged(err) {
  if (err)
    alert(err)
  lsMbr()
}

function getProfit() {
  mbrDb.findOne({ _doc: 'profit', _date: workingDate }, (err, profit) => {
    win.webContents.send('get-mbr-profit', profit ? profit.mbrProfit : null)
  })
}

app.on('browser-window-created', (e, window) => {
  window.setMenu(null)
})

app.on('ready', () => {
  win = new BrowserWindow({ width: 1000, height: 600 })
  win.on('closed', () => {
    win = null
  })
  win.loadURL(`${htmlPath}/mbr-ls.html`)
})

ipcMain.on('show-mbr-info', (evt, _id) => {
  popWin = new BrowserWindow({
    parent: win,
    modal: true,
    minimizable: false,
  })
  popWin.on('closed', () => {
    popWin = null
  })
  let url = `${htmlPath}/mbr-info.html`
  if (_id)
    url += `?_id=${_id}`
  popWin.loadURL(url)
})

ipcMain.on('show-mbr-rebate', (evt, _id) => {
  popWin = new BrowserWindow({
    parent: win,
    modal: true,
    minimizable: false,
  })
  popWin.on('closed', () => {
    popWin = null
  })
  popWin.loadURL(`${htmlPath}/mbr-rebate.html?_id=${_id}`)
})

ipcMain.on('set-working-date', (evt, date) => {
  workingDate = date
  win.webContents.send('get-working-date', Util.splitDate(workingDate))
  getProfit()
})

ipcMain.on('get-working-date', (evt, arg) => {
  evt.sender.send('get-working-date', Util.splitDate(workingDate))
})

ipcMain.on('new-mbr', (evt, mbr) => {
  mbr._startDate = workingDate
  mbr._doc = 'mbr'
  mbrDb.insert(mbr, onMbrChanged)
})

ipcMain.on('upd-mbr', (evt, obj) => {
  mbrDb.update({ _id: obj._id }, { $set: obj.mbr }, {}, onMbrChanged)
})

ipcMain.on('get-mbr', (evt, _id) => {
  mbrDb.findOne({ _id: _id }, (err, mbr) => {
    evt.sender.send('get-mbr', mbr)
  })
})

ipcMain.on('ls-mbr', lsMbr)

ipcMain.on('set-mbr-profit', (evt, profit) => {
  query = { _doc: 'profit', _date: workingDate }
  if (profit === null)
    mbrDb.remove(query)
  else
    mbrDb.update(query, { $set: { mbrProfit: profit } }, {},
      (err, numAff) => {
        if (!numAff)
          mbrDb.insert({ _doc: 'profit', _date: workingDate, mbrProfit: profit })
      })
})

ipcMain.on('get-mbr-profit', getProfit)
