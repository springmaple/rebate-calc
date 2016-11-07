const {ipcRenderer, remote} = require('electron')
const {dialog} = remote
const {getParamByName, floatToString} = require('./../../lib/util.js')
const currentWindow = remote.getCurrentWindow()
const _id = getParamByName('_id', window.location.href)
const map = {
  mbrName: 'mbr-name',
  mbrId: 'mbr-id',
  mbrHp: 'mbr-hp', 
  mbrIc: 'mbr-ic', 
  mbrEmail: 'mbr-email',
  mbrBankName: 'mbr-bank-name',
  mbrBankAcc: 'mbr-bank-acc',
  mbrJoinDate: 'mbr-join-date',
  mbrPackage: 'mbr-package',
  mbrRemark: 'mbr-remark'
}

var _mbr = null
var _init = true
var _leave_page = false
var _leave_reason = 'close'  // can be 'close' or <location url>


function goTo (pageUrl) {
  _leave_reason = pageUrl
  if (hasMbrChange()) {
    window.close()
  } else {
    _leave_page = true
    window.location = pageUrl
  }
}

function rmErr () {
  $('#form-error').html('')
}

function prevalidate () {
  let mbrName = $('#mbr-name')
  let mbrNameVal = mbrName.val().trim()
  mbrName.val(mbrNameVal)
  if (mbrNameVal.length == 0) {
    $('#form-error').html(`
      <div class="alert alert-danger">
        <a href="javascript:rmErr()" class="close" 
          aria-label="close">&times;</a>
        Member name must not be empty.
      </div>`)
    mbrName.focus()
    return false
  }

  let mbrPackage = $('#mbr-package') 
  mbrPackage.val(floatToString(mbrPackage.val()))
  return true
}

function hasMbrChange () {
  for (let key in map) {
    let value = $(`#${map[key]}`).val()
    if (_mbr == null) {
      if (value != null && value.length > 0) {
        return true
      }
    } else if (value != _mbr[key]) {
      return true
    }
  }
  return false
}

function getMbrChange () {
  let mbr_ = {}
  for (let key in map) {
    let value = $(`#${map[key]}`).val() 
    if (_mbr == null || value != _mbr[key])
      mbr_[key] = value
  }
  return mbr_
}

function addMbr () {
  if (!prevalidate()) return false

  let mbrToIns = {}
  for (let key in map)
    mbrToIns[key] = $(`#${map[key]}`).val()

  ipcRenderer.send('add-mbr', mbrToIns)
}

function updMbr () {
  if (!prevalidate()) return false
  
  let mbrToUpd = getMbrChange()
  if (!$.isEmptyObject(mbrToUpd)) {
    ipcRenderer.send('upd-mbr', { _id: _id, mbr: mbrToUpd })
  }
  return true
}

function delMbr () {
  let msg = 'Confirm to delete member? You cannot undo after member is deleted.' 
  let rsp = dialog.showMessageBox(
    currentWindow,
    {
      type: 'question',
      title: 'Delete Member',
      message: msg,
      buttons: ['Cancel', 'Delete']
    })
  if (rsp === 1) {
    ipcRenderer.send('del-mbr', _id)
  }
}

function cnlUpdMbr () {
  if (hasMbrChange()) {
    let rsp = dialog.showMessageBox(
      currentWindow,
      {
        type: 'question',
        title: 'Unsaved Changes',
        message: 'Confirm to discard all changes?',
        buttons: ['No', 'Discard']
      })
    if (rsp !== 1) {
      return
    }
  }
  _leave_page = true
  window.close()
}

ipcRenderer.on('mbr', function (evt, mbr) {
  if (!_id || mbr._rmDate) {
    _leave_page = true
    _leave_reason = 'close'
    window.close()
    return
  }

  if (_leave_page) {
    if (_leave_reason === 'close') {
      window.close()
    } else {
      window.location = _leave_reason
    }
    return
  }

  _mbr = mbr
  for (let key in map) {
    $(`#${map[key]}`).val(mbr[key]) 
  }

  if (!_init) {
    let mbrUpdateStatus = $('#mbr-update-status')
    mbrUpdateStatus.show()
    setTimeout(function () {
      mbrUpdateStatus.fadeOut('fast');
    }, 400)
  } else {
    _init = false
    $('#body-container').show()
    $('#loader').hide()
  }
})

window.onload = function () {
  let mbrInfoElementMap = [
    {label: 'Name', id: 'mbr-name', type: 'text', ph: 'Enter name'},
    {label: 'ID', id: 'mbr-id', type: 'text', ph: 'Enter id'},
    {label: 'Hp No', id: 'mbr-hp', type: 'text', ph: 'Enter hp no'},
    {label: 'IC', id: 'mbr-ic', type: 'text', ph: 'Enter ic'},
    {label: 'Email', id: 'mbr-email', type: 'text', ph: 'Enter email'},
    {label: 'Bank Name', id: 'mbr-bank-name', type: 'text', 
      ph: 'Enter bank name'},
    {label: 'Bank Acc', id: 'mbr-bank-acc', type: 'text', 
      ph: 'Enter bank acc'},
    {label: 'Join Date', id: 'mbr-join-date', type: 'text', 
      ph: 'Enter join date'},
    {label: 'Package', id: 'mbr-package', type: 'number', ph: 'Enter package'}
  ]
  let mbrInfoCtnt = ''
  
  for (let {label, id, type, ph} of mbrInfoElementMap) {
    mbrInfoCtnt += `
      <div class="form-group">
        <label class="control-label col-sm-2" for="${id}">${label}:</label>
        <div class="col-sm-10">
          <input type="${type}" class="form-control" id="${id}" 
            placeholder="${ph}">
        </div>
      </div>`
  }
  mbrInfoCtnt += `
    <div class="form-group">
      <label class="control-label col-sm-2" for="mbr-remark">Remark:</label>
      <div class="col-sm-10">
        <textarea class="form-control" id="mbr-remark" rows="2" 
          placeholder="Enter remark"></textarea>
      </div>
    </div>`

  let btnHtml = null
  if (_id) {
    btnHtml = `
      <div>
        <span>
          <button onclick="updMbr()" class="btn btn-primary">Save</button>
          <button onclick="cnlUpdMbr()" class="btn btn-default">Cancel</button>
          <span id="mbr-update-status">Changes saved!</span>
        </span>
        <span style="float: right">
          <button onclick="delMbr()" class="btn btn-danger">Delete</button>
        </span>
      </div>`
  } else {
    btnHtml = `
      <button onclick="addMbr()" class="btn btn-primary">New Member</button>
      <button onclick="window.close()" class="btn btn-default">Cancel</button>`
  }

  mbrInfoCtnt += `
    <div class="form-group">
      <div class="col-sm-offset-2 col-sm-10">
        ${btnHtml}
      </div>
    </div>`

  let mbrPackage = $('#mbr-package') 
  mbrPackage.focusout(evt => {
    mbrPackage.val(floatToString(mbrPackage.val(), 2))
  })

  let mbrName = $('#mbr-name') 
  mbrName.focusout(evt => {
    if (mbrName.val().length > 0) rmErr()
  })

  if (_id) {
    ipcRenderer.send('get-mbr', _id)

    calc_url = `mbr-rebate.html?_id=${_id}`
    $('#mbr-navibar').html(`
      <ul class="nav nav-tabs nav-justified">
        <li class="active"><a href="#">Info</a></li>
        <li><a href="javascript:goTo('${calc_url}')">Calculator</a></li>
      </ul>`)
  }
  $('#rebate-mbr-info').html(mbrInfoCtnt)

  if (!_id) {
    $('#body-container').show()
    $('#loader').hide()
  }
}

window.onbeforeunload = function (evt) {
  if (_leave_page)
    return

  if (hasMbrChange()) {
    evt.returnValue = 'false'

    if (_mbr == null) {
      dialog.showMessageBox(
        currentWindow,
        {
          type: 'question',
          title: 'Unsaved Data',
          message: 'Confirm to discard all data?',
          buttons: ['No', 'Discard']
        },
        function (rsp) {
          if (rsp === 1) {
            _leave_page = true
            if (_leave_reason === 'close') {
              window.close()
            } else {
              window.location = _leave_reason
            }
            return
          }
          _leave_page = false
          _leave_reason = 'close'
        }
      )
    } else {
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
            if (updMbr()) {
              return
            }
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
}
