const {getParamByName, floatToString, toFloat} = require('./../../lib/util.js')
const {ipcRenderer, remote} = require('electron')
const currentWindow = remote.getCurrentWindow()
const _id = getParamByName('_id', window.location.href)

var _mbr = null


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

function save (i) {
  let rebateMbrLs = []
  let rebateMbrMbr = {}
  rebateMbrMbr['mbrRebate' + i] = rebateMbrLs
  let rebateMbrSave = { _id: _id, mbr: rebateMbrMbr }

  for (let j=0; j<30; j++) {
    let rebateMbrDatesId = `input:checkbox[name="rebate-mbr-date-${i}-${j}"]`
    let rebateMbrNameId = `#rebate-mbr-name-${i}-${j}`
    let rebateMbrPackageId = `#rebate-mbr-package-${i}-${j}`

    let mbrPackage = toFloat($(rebateMbrPackageId).val(), 2)
    let mbrDate = null
    let rebateMbrDates = $(rebateMbrDatesId)
    for (let k=0; k<3; k++) {
      let e = $(rebateMbrDates[k])
      if (e.parent().hasClass('active')) {
        mbrDate = e.attr('val')
        break
      }
    }

    if (isNaN(mbrPackage)) {
      mbrPackage = null
    }
    rebateMbrLs.push({
      mbrName: $(rebateMbrNameId).val(), 
      mbrDay: mbrDate, 
      mbrPackage: mbrPackage
    })
  }

  ipcRenderer.send('upd-mbr', rebateMbrSave)
}

function updTotal () {
  if (!_mbr) return

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
    let mbrRebate = _mbr['mbrRebate' + i]
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

function initUI () {
  $('#mbr-navibar').html(`
    <ul class="nav nav-tabs nav-justified">
      <li><a href="mbr-info.html?_id=${_id}">Info</a></li>
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
        save(e.attr('i'))
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
        save(rebateMbrName.attr('i'))
      })
      rebateMbrName.keypress(function (evt) {
        if (evt.which == 13) {
          $(this).blur()
        }
      })
       
      let rebateMbrDatesId = `input:checkbox[name="rebate-mbr-date-${i}-${j}"]`
      $(rebateMbrDatesId).change({i: i, j: j}, function (evt) {
        let selectedVal = $(this).attr('val')
        selectMbrDay(evt.data.i, evt.data.j, selectedVal, true)
        save($(this).attr('i'))
      })
    }
  }
}


ipcRenderer.on('mbr', function (evt, mbr) {
  _mbr = mbr
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

  let c = 'rebate-panel-active-10 rebate-panel-active-20 rebate-panel-active-30'
  for (let i=1; i<=3; i++) {
    let mbrRebate = mbr['mbrRebate' + i]
    if (mbrRebate) {
      for (let j=0; j<30; j++) {
        let {mbrDay, mbrName, mbrPackage} = mbrRebate[j]
        if (mbrDay != null) {
          selectMbrDay(i, j, mbrDay)
        }
        $(`#rebate-mbr-name-${i}-${j}`).val(mbrName)
        $(`#rebate-mbr-package-${i}-${j}`).val(floatToString(mbrPackage, 2))

        let rebateMbrBox = $(`#rebate-mbr-${i}-${j}`)
        rebateMbrBox.removeClass(c)
        if (mbrPackage && mbrDay) {
          rebateMbrBox.addClass(`rebate-panel-active-${mbrDay}`)
        }
      }
    }
  }

  updTotal()
})


window.onload = function () {
  initUI()
  ipcRenderer.send('get-mbr', _id)
}
