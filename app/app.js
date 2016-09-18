const {app, BrowserWindow, ipcMain} = require('electron')
const Datastore = require('nedb')
const Util = require('./util.js')

var mbrDb = new Datastore()
var workingDate = Util.getNearestDate()

app.on('browser-window-created', (e, window) => {
  window.setMenu(null)
})

app.on('ready', () => {
  let win = new BrowserWindow({ width: 1000, height: 600 })
  win.on('closed', () => {
    win = null
  })

  win.loadURL(`file://${__dirname}/../view/html/mbr-ls.html`)
})

ipcMain.on('set-working-date', (evt, date) => {
  workingDate = date
})

ipcMain.on('new-mbr', (evt, mbr) => {
  mbr._workingDate = workingDate
  mbrDb.insert(mbr, function (err, newMbr) {
    if (err !== null) 
      rsp = err
    else 
      rsp = 'success'
    rsp = evt.sender.send('new-mbr', rsp)
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
      evt.sender.send('upd-mbr', affectedDocuments)
    }
  )
})