const {getParamByName, floatToString, toFloat} = require('./../../lib/util.js')
const {ipcRenderer, remote} = require('electron')
const {dialog} = remote
const currentWindow = remote.getCurrentWindow()
const _id = getParamByName('_id', window.location.href)

var _mbrRebates = null  // stores mbrRebates values since last saved.
var _currentMbrRebates = null
var _saveCalled = false
var _leave_page = false
var _leave_reason = 'close'  // can be 'close' or <location url>


function goTo (pageUrl) {
  _leave_reason = pageUrl
  // TODO: not working
  currentWindow.loadURL(pageUrl)
  // TODO: add printtopdf function in listing page.
}

function getMbr () {
  ipcRenderer.send('get-mbr', _id)
}

function selectMbrDay (i, j, selectedVal, isToggle) {
  let rebateMbrDatesId = `input:checkbox[name="rebate-mbr-date-${i}-${j}"]`
  let rebateMbrDates = $(rebateMbrDatesId)
  for (let i=0; i<3; i++) {
    let e = $(rebateMbrDates[i])
    if (selectedVal == e.attr('val')) {
      if (isToggle) {
        e.parent().toggleClass('active')
      } else {
        e.parent().addClass('active')
      }
    } else {
      e.parent().removeClass('active')
    }
  }
}

function getSelectedMbrDay (i, j) {
  let rebateMbrDatesId = `input:checkbox[name="rebate-mbr-date-${i}-${j}"]`
  let rebateMbrDates = $(rebateMbrDatesId)
  for (let k=0; k<3; k++) {
    let e = $(rebateMbrDates[k])
    if (e.parent().hasClass('active')) {
      return e.attr('val')
    }
  }
  return null
}

function hasUnsavedChanges () {
  for (let key in _currentMbrRebates) {
    let mbrRebate1 = _mbrRebates[key]
    let mbrRebate2 = _currentMbrRebates[key]
    for (let i=0; i<mbrRebate1.length; i++) {
      let item1 = mbrRebate1[i]
      let item2 = mbrRebate2[i]
      if (item1.mbrDay != item2.mbrDay || 
          item1.mbrName != item2.mbrName ||
          item1.mbrPackage != item2.mbrPackage) {
        return true      
      }
    }
  }
  return false
}

function save () {
  ipcRenderer.send('upd-mbr', { _id: _id, mbr: _currentMbrRebates })
}

function saveOnlyIfChange () {
  if (hasUnsavedChanges()) {
    _saveCalled = true
    save()
  }
}

function resetChanges () {
  if (hasUnsavedChanges()) {
    let rsp = dialog.showMessageBox(
      currentWindow,
      {
        type: 'question',
        title: 'Reset Changes',
        message: 'All changes will be lost, confirm to reset?',
        buttons: ['No', 'Reset']
      })
    if (rsp === 1) {
      getMbr()
    }
  }
}

function updTotal () {
  if (!_currentMbrRebates) return

  let subTotal = {
    1: { 10: 0, 20: 0, 30: 0 },
    2: { 10: 0, 20: 0, 30: 0 },
    3: { 10: 0, 20: 0, 30: 0 }
  }
  let subTotalCnt = {
    1: { 10: 0, 20: 0, 30: 0 },
    2: { 10: 0, 20: 0, 30: 0 },
    3: { 10: 0, 20: 0, 30: 0 }
  }

  for (let i=1; i<=3; i++) {
    let mbrRebate = _currentMbrRebates['mbrRebate' + i]
    if (!mbrRebate) continue

    let subTotal_ = subTotal[i]
    let subTotalCnt_ = subTotalCnt[i]

    for (let j=0; j<30; j++) {
      let { mbrPackage, mbrDay } = mbrRebate[j]
      mbrPackage = toFloat(mbrPackage, 2)
      if (isNaN(mbrPackage)) mbrPackage = null
      mbrDay = parseInt(mbrDay)
      if (isNaN(mbrDay)) mbrDay = null

      if (mbrPackage && mbrDay) {
        subTotal_[mbrDay] += mbrPackage
        subTotalCnt_[mbrDay] += 1
      }
    }
  }

  // display subtotals
  let total = { 10: 0, 20: 0, 30: 0 }
  let totalCnt = { 10: 0, 20: 0, 30: 0 }
  for (let i=1; i<=3; i++) {
    let subTotal_ = subTotal[i]
    let subTotalCnt_ = subTotalCnt[i]
    i = parseInt(i)
    for (let k in subTotal_) {
      let subTotalCnt__ = subTotalCnt_[k]
      let packageSubTotal = subTotal_[k]
      let afterDeduct = packageSubTotal * i / 100

      $(`#rebate-subtotal-${i}-${k}-total`).html(
        floatToString(packageSubTotal, 2))
      $(`#rebate-subtotal-${i}-${k}`).html(floatToString(afterDeduct, 2))
      $(`#rebate-subtotal-${i}-${k}-count`).html(subTotalCnt__)

      total[k] += afterDeduct
      totalCnt[k] += subTotalCnt__
    }
  }

  // display total
  for (let k in total) {
    $(`#rebate-total-${k}`).html(floatToString(total[k], 2))
    $(`#rebate-total-${k}-count`).html(totalCnt[k])
  }
}

function buildMbrRebatesFromDOM () {
  let mbrRebates = {}

  for (let i=1; i<=3; i++) {
    let rebateMbrLs = []
    mbrRebates['mbrRebate' + i] = rebateMbrLs

    for (let j=0; j<30; j++) {
      let rebateMbrNameId = `#rebate-mbr-name-${i}-${j}`
      let rebateMbrPackageId = `#rebate-mbr-package-${i}-${j}`

      let mbrPackage = toFloat($(rebateMbrPackageId).val(), 2)      

      if (isNaN(mbrPackage)) {
        mbrPackage = null
      }
      rebateMbrLs.push({
        mbrName: $(rebateMbrNameId).val(), 
        mbrDay: getSelectedMbrDay(i, j), 
        mbrPackage: mbrPackage
      })
    }
  }

  return mbrRebates
}

function initUI () {
  info_url = `mbr-info.html?_id=${_id}`
  $('#mbr-navibar').html(`
    <ul class="nav nav-tabs nav-justified">
      <li><a href="javascript:goTo('${info_url}')">Info</a></li>
      <li class="active"><a href="">Calculator</a></li>
    </ul>`)

  let mbrInfoElementMap = [
    {label: 'Name', id: 'mbr-name'},
    {label: 'Email', id: 'mbr-email'},
    {label: 'Bank Name', id: 'mbr-bank-name'},
    {label: 'Bank Acc', id: 'mbr-bank-acc'},
    {label: 'Package', id: 'mbr-package'}
  ]
  let rebateMbrInfo = $('#rebate-mbr-info')
  for ({label, id} of mbrInfoElementMap) {
    rebateMbrInfo.append(`
    <div class="form-group">
      <label class="control-label col-sm-2" for="${id}-lbl">${label}:</label>
        <div id="${id}-lbl" class="col-sm-10">
          <div id="${id}" class="form-control no-input-box">
            Loading...
            <!-- INSERT MBR INFO -->
          </div>
        </div>
    </div>`)
  }

  let rebatePanels = $('#rebate-panels')
  for (let i=3; i>=1; i--) {
    let rebatePanelHeadId = `rebate-panel-head-${i}`
    let rebatePanelBodyId = `rebate-panel-body-${i}`
    rebatePanels.append(`
      <div class="panel panel-default">
        <div id="${rebatePanelHeadId}" class="panel-heading rebate-panel-head">
          <h3 class="panel-title">${i}%</h3>
        </div>
        <div class="panel-body">
          <div class="row">
            <div id="${rebatePanelBodyId}" 
              class="col-md-9 rebate-panel-body-col no-wrap">
                <!-- INSERT MBR-LS HERE -->
            </div>
            <div class="col-md-3 rebate-panel-body-col">
              <table class="table table-bordered rebate-panel-subtotal">
                <thead>
                  <tr>
                    <th>
                      <span>10</span>
                      <span id="rebate-subtotal-${i}-10-count" 
                        class="label label-danger">0</span>
                    </th>
                    <th>
                      <span>20</span>
                      <span id="rebate-subtotal-${i}-20-count" 
                        class="label label-success">0</span>
                    </th>
                    <th>
                      <span>30</span>
                      <span id="rebate-subtotal-${i}-30-count" 
                        class="label label-primary">0</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span id="rebate-subtotal-${i}-10-total">0</span></td>
                    <td><span id="rebate-subtotal-${i}-20-total">0</span></td>
                    <td><span id="rebate-subtotal-${i}-30-total">0</span></td>
                  </tr>
                  <tr>
                    <td><span id="rebate-subtotal-${i}-10">0</span></td>
                    <td><span id="rebate-subtotal-${i}-20">0</span></td>
                    <td><span id="rebate-subtotal-${i}-30">0</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`)
    
    $(`#${rebatePanelHeadId}`).click(rebatePanelBodyId, function (evt) {
      $(`#${evt.data}`).toggleClass('wrap no-wrap')
    })
  }

  rebatePanels.append(`
    <div class="panel panel-default rebate-panel-total-panel">
      <div class="panel-body">
        <div class="row">
          <div class="col-md-9 rebate-panel-body-col"></div>
          <div class="col-md-3 rebate-panel-body-col">
            <table class="table table-bordered rebate-panel-total">
              <thead>
                <tr>
                  <th>
                    <span>10</span>
                    <span id="rebate-total-10-count" 
                      class="label label-danger">0</span>
                  </th>
                  <th>
                    <span>20</span>
                    <span id="rebate-total-20-count" 
                      class="label label-success">0</span>
                  </th>
                  <th>
                    <span>30</span>
                    <span id="rebate-total-30-count" 
                      class="label label-primary">0</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span id="rebate-total-10">0</span></td>
                  <td><span id="rebate-total-20">0</span></td>
                  <td><span id="rebate-total-30">0</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`)


  for (let i=3; i>=1; i--) {
    let rebatePanelBody = $(`#rebate-panel-body-${i}`)
    let rebateMbrHtml = ''
    for (let j=0; j<30; j++) {
      let rebateMbrDateId = `rebate-mbr-date-${i}-${j}`
      let rebateMbrNameId = `rebate-mbr-name-${i}-${j}`
      let rebateMbrPackageId = `rebate-mbr-package-${i}-${j}`
      rebateMbrHtml += `
        <li>
          <ul class="list-group" id="rebate-mbr-${i}-${j}">
            <li class="list-group-item">
              <div class="btn-group" data-toggle="buttons">
                <label class="btn btn-default">
                  <input name="${rebateMbrDateId}" i="${i}" j="${j}"
                    val="10" type="checkbox" />10
                </label>
                <label class="btn btn-default">
                  <input name="${rebateMbrDateId}" i="${i}" j="${j}"
                    val="20" type="checkbox" />20
                </label>
                <label class="btn btn-default">
                  <input name="${rebateMbrDateId}" i="${i}" j="${j}"
                    val="30" type="checkbox" />30
                </label>
              </div>
            </li>

            <li class="list-group-item">
              <input id="${rebateMbrNameId}" class="cnt-input" 
                i="${i}" j="${j}" placeholder="Name" />
            </li>

            <li class="list-group-item">
              <input id="${rebateMbrPackageId}" class="cnt-input" 
                i="${i}" j="${j}" type="number" placeholder="Package" />
            </li>
          </ul>
        </li>`
    }
    rebatePanelBody.html(`<ul class="cnt-ul">${rebateMbrHtml}</ul>`)
  }

  for (let i=3; i>=1; i--) {
    for (let j=0; j<30; j++) {
      let rebateMbrPackage = $(`#rebate-mbr-package-${i}-${j}`)
      rebateMbrPackage.focusout(function (evt) {
        let e = $(this)
        let inp = toFloat(e.val(), 2)
        let val = floatToString(inp, 2) 
        e.val(val)
        let i = e.attr('i')
        let j = e.attr('j')
        let mbrRebate = _currentMbrRebates['mbrRebate' + i][parseInt(j)] 
        mbrRebate.mbrPackage = val
        highlightFrame(i, j, mbrRebate)
        updTotal()
      })
      rebateMbrPackage.keypress(function (evt) {
        if (evt.which == 13) {
          $(this).blur()
        }
      })
      rebateMbrPackage.focus(function () {
        this.select()
      })

      let rebateMbrName = $(`#rebate-mbr-name-${i}-${j}`)
      rebateMbrName.focusout(function (evt) {
        let e = $(this)
        let i = e.attr('i')
        let j = e.attr('j')
        _currentMbrRebates['mbrRebate' + i][parseInt(j)].mbrName = e.val()
      })
      rebateMbrName.keypress(function (evt) {
        if (evt.which == 13) {
          $(this).blur()
        }
      })
       
      let rebateMbrDatesId = `input:checkbox[name="rebate-mbr-date-${i}-${j}"]`
      $(rebateMbrDatesId).change({i: i, j: j}, function (evt) {
        let e = $(this)
        let selectedVal = e.attr('val')
        let i = e.attr('i')
        let j = e.attr('j')
        selectMbrDay(evt.data.i, evt.data.j, selectedVal, true)

        let mbrRebate = _currentMbrRebates['mbrRebate' + i][parseInt(j)] 
        mbrRebate.mbrDay = getSelectedMbrDay(i, j)
        highlightFrame(i, j, mbrRebate)
        updTotal()
      })
    }
  }
}

function highlightFrame (i, j, mbrRebate) {
  let c = 'rebate-panel-active-10 rebate-panel-active-20 rebate-panel-active-30'
  let rebateMbrBox = $(`#rebate-mbr-${i}-${j}`)
  rebateMbrBox.removeClass(c)
  if (mbrRebate && mbrRebate.mbrDay && mbrRebate.mbrPackage && 
      parseFloat(mbrRebate.mbrPackage) > 0) {
    rebateMbrBox.addClass(`rebate-panel-active-${mbrRebate.mbrDay}`)
  }
}


ipcRenderer.on('mbr', function (evt, mbr) {
  if (_leave_page) {
    if (_leave_reason === 'close') {
      window.close()
    } else {
      window.location = _leave_reason
    }
  }

  let map = {
    mbrName: 'mbr-name',
    mbrEmail: 'mbr-email',
    mbrBankName: 'mbr-bank-name',
    mbrBankAcc: 'mbr-bank-acc',
    mbrPackage: 'mbr-package'
  }
  for (let key in map) {
    $(`#${map[key]}`).html(mbr[key])
  }

  for (let i=1; i<=3; i++) {
    let mbrRebateLs = mbr['mbrRebate' + i]
    for (let j=0; j<30; j++) {
      let mbrRebate = null
      let mbrDay = null
      let mbrName = null
      let mbrPackage = null
      if (mbrRebateLs) {
        mbrRebate = mbrRebateLs[j]
        mbrDay = mbrRebate.mbrDay
        mbrName = mbrRebate.mbrName
        mbrPackage = mbrRebate.mbrPackage 
      }
      selectMbrDay(i, j, mbrDay)
      $(`#rebate-mbr-name-${i}-${j}`).val(mbrName)
      $(`#rebate-mbr-package-${i}-${j}`).val(floatToString(mbrPackage, 2))
      highlightFrame(i, j, mbrRebate)
    }
  }

  _mbrRebates = buildMbrRebatesFromDOM()
  _currentMbrRebates = JSON.parse(JSON.stringify(_mbrRebates))

  updTotal()

  if (_saveCalled) {
    _saveCalled = false
    let mbrSaveStatus = $('#mbr-save-status')
    mbrSaveStatus.show()
    setTimeout(function () {
      mbrSaveStatus.fadeOut('fast');
    }, 400)
  }
})


window.onload = function () {
  initUI()
  getMbr()
}

window.onbeforeunload = function (evt) {
  if (_leave_page)
    return

  if (hasUnsavedChanges()) {
    evt.returnValue = 'false'
    dialog.showMessageBox(
      currentWindow,
      {
        type: 'question',
        title: 'Unsaved Changes',
        message: 'Do you want to save all changes?',
        buttons: ['Save', "Don't Save", 'Cancel']
      },
      function (rsp) {
        _leave_page = true
        if (rsp === 0) {
          save()
          return
        } else if (rsp === 1) {
          if (_leave_reason === 'close') {
            window.close()
          } else {
            window.location = _leave_reason
          }
          return
        }
        _leave_page = false
        _leave_reason = 'close'
      })
  }
}
