const {app, BrowserWindow, ipcMain, shell} = require('electron')
const Datastore = require('nedb')
const Util = require('./lib/util.js')
const fs = require('fs');
const htmlPath = `file://${__dirname}/front/html`
const oldDbPath = `${__dirname}\\..\\..\\calc.dat`
const newDbPath = `${__dirname}\\..\\..\\calc.dat2`

var mbrDb = null
var workingDay = Util.getNearestDay()
var win = null
var popWin = null
var hasOldDb = false

function initDb(callback) {
  
  try {
    fs.accessSync(oldDbPath, fs.F_OK)
    hasOldDb = true
  } catch (e) {
    mbrDb = new Datastore({ filename: newDbPath, autoload: true })
    callback()
  }
  
  if (hasOldDb) {
    try {
      fs.accessSync(newDbPath, fs.F_OK)
      mbrDb = new Datastore({ filename: newDbPath, autoload: true })
      callback()
    } catch (e) {
      let oldDb = new Datastore({ filename: oldDbPath, autoload: true })
      mbrDb = new Datastore({ filename: newDbPath, autoload: true })
      
      let profitDat = {_id: 'profit', mbrProfit10: null, mbrProfit20: null, mbrProfit30: null}
      oldDb.find({ _doc: 'profit' }, (evt, oldProfit) => {
        for (let profit of oldProfit) {
          let {m, d} = Util.splitDate(profit._date)
          if (m == 9) {
            let mbrProfit = Util.toFloat(profit.mbrProfit, 2)
            if (isNaN(mbrProfit))
              mbrProfit = null
            profitDat['mbrProfit' + d] = mbrProfit
          }
        }

        mbrDb.insert(profitDat)
        
        oldDb.find({ _doc: 'mbr' }, (evt, mbrs) => {
          if (!mbrs) {
            callback()
          } else {
            let totalMbrs = mbrs.length
            let totalProcessed = 0

            for (let mbr of mbrs) {
              mbr._addDate = mbr._startDate
              if (mbr._endDate)
                mbr._rmDate = mbr._endDate
              delete mbr._startDate
              delete mbr._endDate
              delete mbr._doc
              
              console.log('MBR:::::' + mbr)
              
              for (let i=1; i<=3; i++) {
                let mbrRebateLs = []
                mbr['mbrRebate' + i] = mbrRebateLs
                for (let j=0; j<30; j++) {
                  mbrRebateLs.push({mbrDay: null, mbrName: null, mbrPackage: null})
                }
              }
              
              oldDb.find({ _doc: 'rebate-mbr', mbr_id: mbr._id }, (err, mbrRebates) => {
                for (let oldMbrRebate of mbrRebates) {
                  let oldMbrRebateLs = oldMbrRebate.mbr
                  if (oldMbrRebateLs) {
                    let mbrRebateLs = mbr['mbrRebate' + oldMbrRebate.mbrPct]
                    for (let j=0; j<30; j++) {
                      mbrRebateLs[j].mbrName = oldMbrRebateLs[j].mbrName
                      mbrRebateLs[j].mbrDay = oldMbrRebateLs[j].mbrDate
                    }
                  }
                }
                
                oldDb.find({ _doc: 'rebate-package', mbr_id: mbr._id }, (err, mbrPackages) => {
                  for (let oldMbrPackage of mbrPackages) {
                    if (Util.splitDate(oldMbrPackage._date).m != 9)
                      continue
                    let oldMbrPackageLs = oldMbrPackage.mbrPackage
                    if (oldMbrPackageLs) {
                      let mbrRebateLs = mbr['mbrRebate' + oldMbrPackage.mbrPct]
                      for (let j=0; j<30; j++) {
                        mbrRebateLs[j].mbrPackage = oldMbrPackageLs[j]
                      }
                    }
                  }
                  
                  mbrDb.insert(mbr)
                  totalProcessed += 1
                  if (totalProcessed == totalMbrs)
                    callback()
                })
              })
            }
          }
        })

      })
      
    }
  }
}

function lsMbr() {
  mbrDb.find({ _day: workingDay, _rmDate: { $exists: false } })
    .sort({ mbrName: 1 })
    .exec((err, mbrs) => {
      if (err)
        alert(err)
      else
        win.webContents.send('ls-mbr', mbrs)
    })
}

function onMbrChanged(err) {
  if (err)
    alert(err)
  lsMbr()
}

function getProfit() {
  mbrDb.findOne({ _id: 'profit' }, (err, profit) => {
    let profit_ = null
    if (profit) {
      let mbrProfit = profit['mbrProfit' + workingDay]
      if (mbrProfit !== undefined)
        profit_ = mbrProfit
    }
    win.webContents.send('get-mbr-profit', profit_)
  })
}

function checkHasMbr(_id) {
  mbrDb.findOne({ _id: _id }, (err, mbr) => {
    let hasMbr = false
    for (let mbrRebate of [mbr.mbrRebate1, mbr.mbrRebate2, mbr.mbrRebate3]) {
      if (!mbrRebate)
        continue
      
      for (let mbrRebate_ of mbrRebate) {
        if (mbrRebate_.mbrDay === null)
          continue
          
        let mbrPackage = parseFloat(mbrRebate_.mbrPackage)
        if (!isNaN(mbrPackage) && mbrPackage > 0) {
          hasMbr = true
          break
        }
      }
    }
    win.webContents.send('check-has-mbr', { mbr_id: _id, hasMbr: hasMbr })
  })
}

app.on('browser-window-created', (e, window) => {
  window.setMenu(null)
})

app.on('ready', () => {
  initDb(() => {
    win = new BrowserWindow({ minWidth: 400, minHeight: 300, show: false, title: `Calc` })
    win.maximize()
    win.on('closed', () => {
      win = null
      app.quit()
    })
    win.loadURL(`${htmlPath}/mbr-ls.html`)
    win.show()
  })
})

ipcMain.on('show-mbr-page', (evt, page) => {
  popWin = new BrowserWindow({
    title: 'Member',
    minWidth: 400,
    minHeight: 300,
    show: false,
    parent: win,
    modal: true,
    minimizable: false,
  })
  popWin.maximize()
  popWin.on('closed', () => {
    popWin = null
  })

  let {_id, name} = page
  let url = `${htmlPath}/${name}.html`
  if (_id)
    url += `?_id=${_id}`
  popWin.loadURL(url)
  popWin.show()
})

ipcMain.on('set-working-day', (evt, day) => {
  workingDay = parseInt(day)
  win.webContents.send('get-working-day', day)
  getProfit()
})

ipcMain.on('get-working-day', (evt, _) => {
  evt.sender.send('get-working-day', workingDay)
})

ipcMain.on('new-mbr', (evt, mbr) => {
  mbr._addDate = Util.getTodayDate()
  mbr._day = workingDay
  mbrDb.insert(mbr, onMbrChanged)
})

ipcMain.on('upd-mbr', (evt, obj) => {
  mbrDb.update({ _id: obj._id }, { $set: obj.mbr }, {}, onMbrChanged)
})

ipcMain.on('del-mbr', (evt, _id) => {
  mbrDb.update({ _id: _id }, { $set: { _rmDate: Util.getTodayDate() } }, {}, onMbrChanged)
})

ipcMain.on('get-mbr', (evt, _id) => {
  mbrDb.findOne({ _id: _id }, (err, mbr) => {
    evt.sender.send('get-mbr', mbr)
  })
})

ipcMain.on('ls-mbr', lsMbr)

ipcMain.on('set-mbr-profit', (evt, profit) => {
  let updData = {}
  updData['mbrProfit' + workingDay] = profit
  mbrDb.update({ _id: 'profit' }, { $set: updData }, {},
    (err, numAff) => {
      if (!numAff) {
        updData._id = 'profit'
        mbrDb.insert(updData)
      }
    })
})

ipcMain.on('get-mbr-profit', getProfit)

ipcMain.on('set-mbr-rebate', (evt, obj) => {
  // obj: {_id: 'nedb_id', mbrRebate#: [...], }
  let _id = obj._id
  for (let i=1; i<=3; i++) {
    let key = 'mbrRebate' + i
    let mbrRebate = obj[key]
    if (mbrRebate) {
      let updDat = {}
      updDat[key] = mbrRebate
      mbrDb.update({ _id: _id }, { $set: updDat }, {}, (err, numAff) => {
        if (err)
          alert(err)
        else if (!numAff)
          alert(key + ' not updated!')
        else
          checkHasMbr(_id)
      })
    }
  }
})

ipcMain.on('check-has-mbr', (evt, _id) => {
  checkHasMbr(_id)
})

ipcMain.on('open-url', (evt, url) => {
  shell.openExternal(url)
})
