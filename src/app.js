const {app, BrowserWindow, ipcMain} = require('electron')
const Datastore = require('nedb')
const Util = require('./lib/util.js')
const htmlPath = `file://${__dirname}/front/html`

var mbrDb = new Datastore({ filename: `${__dirname}\\..\\..\\calc.dat`, autoload: true })
var workingDate = Util.getNearestDate()
var win = null
var popWin = null


function lsMbr() {
  mbrDb.find({
    _doc: 'mbr', _startDate: { $lte: workingDate }, _day: Util.splitDate(workingDate).d,
    $or: [{ _endDate: null }, { _endDate: { $gt: workingDate } }]
  })
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

function checkHasMbr(_id) {
  let query = { _doc: 'rebate-package', mbr_id: _id, _date: workingDate }
  let rebatePackageActive = { 1: [], 2: [], 3: [] }
  mbrDb.find(query, (err, rebatePackages) => {
    let hasRebatePackage = false
    for (rebatePackage of rebatePackages) {
      let rpArray = rebatePackageActive[rebatePackage.mbrPct]
      for (let i = 0; i < rebatePackage.mbrPackage.length; i++) {
        let mbrPackageVal = rebatePackage.mbrPackage[i]
        let val = parseFloat(mbrPackageVal)
        if (!isNaN(val) && val > 0) {
          rpArray.push(i)
          hasRebatePackage = true
        }
      }
    }

    if (hasRebatePackage) {
      query = { _doc: 'rebate-mbr', mbr_id: _id }
      mbrDb.find(query, (err, rebateMbrs) => {
        let rebateMbrActive = { 1: null, 2: null, 3: null }
        let log = false
        for (rebateMbr of rebateMbrs) {
          log = true
          rebateMbrActive[rebateMbr.mbrPct] = rebateMbr.mbr
        }

        for (let z = 1; z <= 3; z++) {
          let rmActive = rebateMbrActive[z]
          if (!rmActive)
            continue
          for (j of rebatePackageActive[z])
            if (rmActive[j].mbrDate !== null) {
              win.webContents.send('check-has-mbr', { mbr_id: _id, hasMbr: true })
              return
            }
        }
        win.webContents.send('check-has-mbr', { mbr_id: _id, hasMbr: false })
      })
    } else
      win.webContents.send('check-has-mbr', { mbr_id: _id, hasMbr: false })
  })
}

app.on('browser-window-created', (e, window) => {
  window.setMenu(null)
})

app.on('ready', () => {
  win = new BrowserWindow({ minWidth: 400, minHeight: 300, show: false, title: `Calc - ${workingDate}` })
  win.maximize()
  win.on('closed', () => {
    win = null
    app.quit()
  })
  win.loadURL(`${htmlPath}/mbr-ls.html`)
  win.show()
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
  mbr._endDate = null
  mbr._day = Util.splitDate(workingDate).d
  mbr._doc = 'mbr'
  mbrDb.insert(mbr, onMbrChanged)
})

ipcMain.on('upd-mbr', (evt, obj) => {
  mbrDb.update({ _id: obj._id }, { $set: obj.mbr }, {}, onMbrChanged)
})

ipcMain.on('del-mbr', (evt, _id) => {
  mbrDb.update({ _id: _id }, { $set: { _endDate: workingDate } }, {}, onMbrChanged)
})

ipcMain.on('get-mbr', (evt, _id) => {
  mbrDb.findOne({ _id: _id }, (err, mbr) => {
    evt.sender.send('get-mbr', mbr)
  })
})

ipcMain.on('ls-mbr', lsMbr)

ipcMain.on('set-mbr-profit', (evt, profit) => {
  let query = { _doc: 'profit', _date: workingDate }
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

ipcMain.on('set-rebate-mbr', (evt, rebateMbr) => {
  let _doc = 'rebate-mbr'
  let {mbr_id, mbrPct, mbr} = rebateMbr
  let query = { _doc: _doc, mbr_id: mbr_id, mbrPct: mbrPct }
  mbrDb.update(query, { $set: { mbr: mbr } }, {},
    (err, numAff) => {
      if (!numAff)
        mbrDb.insert({ _doc: _doc, mbr_id: mbr_id, mbrPct: mbrPct, mbr: mbr }, (err) => {
          checkHasMbr(mbr_id)
        })
      else
        checkHasMbr(mbr_id)
    })
})

ipcMain.on('set-rebate-package', (evt, rebatePackage) => {
  let _doc = 'rebate-package'
  let _date = workingDate
  let {mbr_id, mbrPct, mbrPackage} = rebatePackage
  let query = { _doc: _doc, _date: _date, mbr_id: mbr_id, mbrPct: mbrPct }
  mbrDb.update(query, { $set: { mbrPackage: mbrPackage } }, {},
    (err, numAff) => {
      if (!numAff)
        mbrDb.insert({ _doc: _doc, _date: workingDate, mbr_id: mbr_id, mbrPct: mbrPct, mbrPackage: mbrPackage }, () => {
          checkHasMbr(mbr_id)
        })
      else
        checkHasMbr(mbr_id)
    })
})

ipcMain.on('ls-rebate', (evt, _id) => {
  for (let mbrPct = 3; mbrPct >= 1; mbrPct--) {
    let queryMbr = { _doc: 'rebate-mbr', mbr_id: _id, mbrPct: mbrPct }
    mbrDb.findOne(queryMbr, (err, rebateMbr) => {
      if (rebateMbr)
        evt.sender.send('ls-rebate-mbr', rebateMbr)
    })

    let queryPackage = { _doc: 'rebate-package', _date: workingDate, mbr_id: _id, mbrPct: mbrPct }
    mbrDb.findOne(queryPackage, (err, rebatePackage) => {
      if (rebatePackage)
        evt.sender.send('ls-rebate-package', rebatePackage)
      else
        evt.sender.send('ls-rebate-package-no-data', mbrPct)
    })
  }
})

ipcMain.on('check-has-mbr', (evt, _id) => {
  checkHasMbr(_id)
})
