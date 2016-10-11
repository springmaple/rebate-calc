const {app, dialog, BrowserWindow, ipcMain, shell} = require('electron')
const Datastore = require('nedb')
const Util = require('./lib/util.js')
const fs = require('fs')
const htmlPath = `file://${__dirname}/front/html`
const oldDbPath = `${__dirname}\\..\\..\\calc.dat`
const newDbPath = `${__dirname}\\..\\..\\calc.dat2`


var mbrDb = null
var workingDay = Util.getNearestDay()
var win = null
var popWin = null


function logErr (title, err) {
  if (err) {
    dialog.showErrorBox(title, err)
    throw err
  }
}

function initDb (doneCb) {
  let doMigrate = true
  try {
    fs.accessSync(oldDbPath, fs.F_OK)
  } catch (e) {
    doMigrate = false
  }

  if (doMigrate) {
    try {
      fs.accessSync(newDbPath, fs.F_OK)
      doMigrate = false
    } catch (e) {
      doMigrate = true
    }
  }

  mbrDb = new Datastore({ filename: newDbPath, autoload: true })

  if (!doMigrate) {
    doneCb()
    return
  }

  let oldDb = new Datastore({ filename: oldDbPath, autoload: true })
  let profitDat = { _id: 'profit', mbrProfit10: null, 
                    mbrProfit20: null, mbrProfit30: null }
  oldDb.find({ _doc: 'profit' }, function (err, oldProfits) {
    logErr('Migrate "profit"', err)

    for (let profit of oldProfits) {
      let {m, d} = Util.splitDate(profit._date)
      if (m == 9) {  // September 2016 only.
        let mbrProfit = Util.toFloat(profit.mbrProfit, 2)
        if (isNaN(mbrProfit)) mbrProfit = null
        profitDat['mbrProfit' + d] = mbrProfit
      }
    }
    mbrDb.insert(profitDat)
    
    oldDb.find({ _doc: 'mbr' }, function (err, oldMbrs) {
      logErr('Migrate "mbr"', err)

      let totalMbrs = oldMbrs.length
      if (totalMbrs <= 0) {
        doneCb()
        return
      }

      let totalProcessed = 0
      for (let mbr of oldMbrs) {
        mbr._addDate = mbr._startDate
        if (mbr._endDate)
          mbr._rmDate = mbr._endDate
        delete mbr._startDate
        delete mbr._endDate
        delete mbr._doc
        for (let i=1; i<=3; i++) {
          let mbrRebateLs = []
          mbr['mbrRebate' + i] = mbrRebateLs
          for (let j=0; j<30; j++) {
            mbrRebateLs.push({mbrDay: null, mbrName: null, mbrPackage: null})
          }
        }

        oldDb.find(
          { _doc: 'rebate-mbr', mbr_id: mbr._id }, 
          function (err, oldMbrRebates) {
            logErr('Migrate "rebate-mbr"', err)

            for (let oldMbrRebate of oldMbrRebates) {
              let oldMbrRebateLs = oldMbrRebate.mbr
              if (oldMbrRebateLs && oldMbrRebateLs.length > 0) {
                let mbrRebateLs = mbr['mbrRebate' + oldMbrRebate.mbrPct]
                for (let j=0; j<30; j++) {
                  let mbrRebate = mbrRebateLs[j]
                  mbrRebate.mbrName = oldMbrRebateLs[j].mbrName
                  mbrRebate.mbrDay = oldMbrRebateLs[j].mbrDate
                }
              }
            }
            
            oldDb.find(
              { _doc: 'rebate-package', mbr_id: mbr._id }, 
              function (err, oldMbrPackages) {
                logErr('Migrate "rebate-package"', err)

                for (let oldMbrPackage of oldMbrPackages) {
                  // September 2016 only.
                  if (Util.splitDate(oldMbrPackage._date).m != 9) {
                    continue
                  }

                  let oldMbrPackageLs = oldMbrPackage.mbrPackage
                  if (oldMbrPackageLs && oldMbrPackageLs.length > 0) {
                    let mbrRebateLs = mbr['mbrRebate' + oldMbrPackage.mbrPct]
                    for (let j=0; j<30; j++)
                      mbrRebateLs[j].mbrPackage = oldMbrPackageLs[j]
                  }
                }
                
                mbrDb.insert(mbr)
                totalProcessed += 1
                if (totalProcessed === totalMbrs) {
                  doneCb()
                }
              })
          })
      }
    })
  })
}

function lsMbr(callback) {
  let query = { _day: workingDay, _rmDate: { $exists: false } }
  let sort = { mbrName: 1 }
  mbrDb.find(query).sort(sort).exec(function (err, mbrs) {
    logErr('ls-mbr', err)
    callback(mbrs)
  })
}


app.on('browser-window-created', function (e, window) {
  window.setMenu(null)
})

app.on('ready', function () {
  initDb(function () {
    win = new BrowserWindow({ minWidth: 480, minHeight: 640, 
                              show: false, title: `Calc` })
    win.on('closed', function () {
      win = null
      app.quit()
    })
    win.on('focus', function () {
      lsMbr(function (mbrs) {
        win.webContents.send('mbrs', mbrs)
      })
    })

    win.maximize()
    win.loadURL(`${htmlPath}/mbr-ls.html`)
    win.show()
  })
})


ipcMain.on('show-page', function (evt, pageInfo) {
  let {_id, name} = pageInfo
  let url = `${htmlPath}/${name}.html`
  if (_id)
    url += `?_id=${_id}`

  popWin = new BrowserWindow({
    title: 'Member',
    minWidth: 480,
    minHeight: 640,
    show: false,
    parent: win,
    modal: true,
    minimizable: false
  })
  popWin.on('closed', function () {
    popWin = null
  })
  popWin.maximize()
  popWin.loadURL(url)
  popWin.show()
})

ipcMain.on('open-url', function (evt, url) {
  shell.openExternal(url)
})

ipcMain.on('set-working-day', function (evt, day) {
  workingDay = parseInt(day)
  evt.sender.send('working-day', workingDay)
})

ipcMain.on('get-working-day', function (evt) {
  evt.sender.send('working-day', workingDay)
})

ipcMain.on('add-mbr', function (evt, mbr) {
  mbr._addDate = Util.getTodayDate()
  mbr._day = workingDay
  mbrDb.insert(mbr, function (err, newMbr) {
    logErr('add-mbr', err)
    evt.sender.send('mbr', newMbr)
  })
})

ipcMain.on('upd-mbr', function (evt, obj) {
  mbrDb.update(
    { _id: obj._id }, 
    { $set: obj.mbr }, 
    { returnUpdatedDocs: true, multi: false },
    function (err, numAffected, mbr) {
      logErr('upd-mbr', err)
      mbrDb.persistence.compactDatafile()
      evt.sender.send('mbr', mbr)
    })
})

ipcMain.on('del-mbr', function (evt, _id) {
  mbrDb.update(
    { _id: _id }, 
    { $set: { _rmDate: Util.getTodayDate() } }, 
    { returnUpdatedDocs: true, multi: false},
    function (err, numAffected, mbr) {
      logErr('del-mbr', err)
      evt.sender.send('mbr', mbr)
    })
})

ipcMain.on('get-mbr', function (evt, _id) {
  mbrDb.findOne({ _id: _id }, function (err, mbr) {
    logErr('get-mbr', err)
    evt.sender.send('mbr', mbr)
  })
})

ipcMain.on('ls-mbr', function (evt) {
  lsMbr(function (mbrs) {
    evt.sender.send('mbrs', mbrs)
  }) 
})

ipcMain.on('set-mbr-profit', function (evt, profit) {
  let updData = {}
  updData['mbrProfit' + workingDay] = profit
  mbrDb.update(
    { _id: 'profit' }, 
    { $set: updData }, 
    { returnUpdatedDocs: true, multi: false, upsert: true },
    function (err) {
      logErr('set-mbr-profit', err)
      evt.sender.send('mbr-profit', profit)
    })
})

ipcMain.on('get-mbr-profit', function (evt) {
  mbrDb.findOne({ _id: 'profit' }, function (err, profit) {
    logErr('get-mbr-profit', err)
    let profit_ = null
    if (profit) {
      let mbrProfit = profit['mbrProfit' + workingDay]
      if (mbrProfit) profit_ = mbrProfit
    }
    evt.sender.send('mbr-profit', profit_)
  })
})
