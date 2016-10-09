const {ipcRenderer} = require('electron')
const {toFloat, floatToString} = require('./../../lib/util.js')
const {version} = require('./../../package.json')
const KEY = { ESC: 27, ENTER: 13, CTRL_N: 14, CTRL_P: 16, CTRL_F: 6 }

var lastHighlightId = null
var mbrFindAwesomplete = null


function selectDay (day) {
  ipcRenderer.send('set-working-day', day)
}

function highlight (_id) {
  $(`#mbr-ls-tr-${lastHighlightId}`).removeClass('mbr-tr-highlight')
  lastHighlightId = _id
  $(`#mbr-ls-tr-${lastHighlightId}`).addClass('mbr-tr-highlight')
}

function scrollTo (element) {
  let pos = element.offset().top
  pos = parseFloat(pos) - 150
  $('html, body').animate({
    scrollTop: pos + 'px'
  }, 'fast')
}

function showMbrInfo (_id) {  // show create new member form if _id is null.
  ipcRenderer.send('show-page', {_id: _id, name: 'mbr-info'})
}

function showFind () {
  let e = $('#mbr-find')
  $('#mbr-find-div').css('display', 'inline-block')
  e.focus()
  e.select()
}

function showPrint () {
  $('#mbr-find').blur()
  window.print()
}

function openUrl (url) {
  ipcRenderer.send('open-url', url)
}

function checkHasMbr (mbr) {
  for (let mbrRebates of [mbr.mbrRebate1, mbr.mbrRebate2, mbr.mbrRebate3]) {
    if (!mbrRebates || mbrRebates.length <= 0) continue
    
    for (let mbrRebate of mbrRebates) {
      if (mbrRebate.mbrDay === null) continue

      let mbrPackage = parseFloat(mbrRebate.mbrPackage)
      if (!isNaN(mbrPackage) && mbrPackage > 0) return true
    }
  }
  return false
}

ipcRenderer.on('mbrs', function (evt, mbrs) {
  mbrsLen = mbrs['length']
  let mbrTotalPackage = $('#mbr-total-package')
  let mbrTotalHasMbr = $('#mbr-total-has-mbr')
  let mbrLsTableBody = $('#mbr-ls-table-body')

  mbrTotalPackage.html('-')
  mbrTotalHasMbr.html('-')
  

  if (!mbrsLen) {
    lastHighlightId = null
    mbrLsTableBody.html('<tr><td colspan="12">No records.</td></tr>')
    mbrFindAwesomplete.list = []
  } else {
    let profitPct = toFloat($('#mbr-profit').val(), 2)
    let isProfitAvail = !isNaN(profitPct)
    let totalPackage = 0
    let totalHasMbr = 0
    let mbrFindLs = []
    let mbrLsTableBodyCtnt = ''

    for (let mbr of mbrs) {
      let profit = 'N/A'
      if (isProfitAvail) {
        let mbrPackage = toFloat(mbr.mbrPackage, 2)
        if (!isNaN(mbrPackage)) {
          totalPackage += mbrPackage
          let profit_ = toFloat(mbrPackage * profitPct / 100, 2)
          if (!isNaN(profit_))
            profit = floatToString(profit_, 2)
        }
      }

      let mbr_id = mbr._id
      let hasMbrCls = ''
      if (checkHasMbr(mbr)) {
        hasMbrCls = 'class="glyphicon glyphicon-user"'
        totalHasMbr += 1
      }

      mbrFindLs.push({label: `${mbr.mbrName}||${mbr.mbrId}`, value: mbr_id})

      mbrLsTableBodyCtnt += `
        <tr class="mbr-tr" mbrId="${mbr_id}" id="mbr-ls-tr-${mbr_id}" 
          onclick="highlight('${mbr_id}')">
          
          <td><span ${hasMbrCls}></span></td>
          <td><a class="no-blue-text" 
            href="javascript:showMbrInfo('${mbr_id}')">${mbr.mbrName}</a></td>
          <td>${mbr.mbrId}</td>
          <td>${mbr.mbrHp}</td>
          <td>${mbr.mbrIc}</td>
          <td>${mbr.mbrEmail}</td>
          <td>${mbr.mbrBankName}</td>
          <td>${mbr.mbrBankAcc}</td>
          <td>${mbr.mbrJoinDate}</td>
          <td>${floatToString(mbr.mbrPackage, 2)}</td>
          <td>${mbr.mbrRemark}</td>
          <td>${profit}</td>
        </tr>`
    }

    mbrTotalPackage.html(floatToString(totalPackage))
    mbrTotalHasMbr.html(totalHasMbr.toString())
    mbrLsTableBody.html(mbrLsTableBodyCtnt)
    mbrFindAwesomplete.list = mbrFindLs
    highlight(lastHighlightId)

    $('.mbr-tr').dblclick(function () {
      let _id = $(this).attr('mbrId')
      ipcRenderer.send('show-page', {_id: _id, name: 'mbr-rebate'})
    })
  }
})

ipcRenderer.on('mbr-profit', function (evt, profit) {
  $('#mbr-profit').val(floatToString(profit, 2))
  ipcRenderer.send('ls-mbr', null)
})

ipcRenderer.on('working-day', function (evt, day) {
  let elements = $('#working-day li')
  let day_ = 10
  for (let i=0; i<3; i++) {
    let e = $(elements[i])
    if (day === day_) e.addClass('active')
    else e.removeClass('active')
    day_ += 10
  }
  ipcRenderer.send('get-mbr-profit', null)
})


window.onload = function () {
  // init UI
  $('#mbr-app-version').html(`v ${version}`)

  let mbrFind = $('#mbr-find')
  let mbrFindDiv = $('#mbr-find-div')
  mbrFind.focusout(function () {
    mbrFindDiv.css('display', 'none')
  })
  mbrFind.keyup(function (evt) {
    if (evt.which === KEY.ESC) mbrFind.blur()
  })
  mbrFind.focus(function () {
    this.select()
  })

  mbrFindAwesomplete = new Awesomplete(document.getElementById("mbr-find"), {
    autoFirst: true,
    minChars: 1,
    maxItems: 5,
    item: function (text, input) {
      let li = document.createElement('li')
      text = text.split('||')
      li.innerHTML = `
        <div class="mbr-ls-find-li">
          <div>${text[0]}</div>
          <div><small>${text[1]}</small></div>
        </div>`
      return li
    }
  })

  let mbrProfit = $('#mbr-profit')
  mbrProfit.focusout(function (evt) {
    let parsedInput = toFloat(mbrProfit.val(), 2)
    mbrProfit.val(floatToString(parsedInput, 2))
    ipcRenderer.send('set-mbr-profit', isNaN(parsedInput)?null:parsedInput)
  })
  mbrProfit.keypress(function (evt) {
    if (evt.which === KEY.ENTER) mbrProfit.blur()
  })
  mbrProfit.focus(function () {
    this.select()
  })

  $("body").keypress(function (evt) {
    if (evt.which === KEY.CTRL_N) showMbrInfo(null)
    else if (evt.which === KEY.CTRL_F) showFind()
    else if (evt.which === KEY.CTRL_P) showPrint()
  })

  window.addEventListener("awesomplete-select", function (evt){
      evt.preventDefault()
      $('#mbr-find').blur()
      $('#mbr-find').val('')
      highlight(evt.text.value)
      scrollTo($(`#mbr-ls-tr-${lastHighlightId}`))
  })

  // init data
  ipcRenderer.send('get-working-day', null)

  // check new version
  let updUrl = (
    'https://api.github.com/repos/springmaple/rebate-calc/releases/latest')
  $.getJSON(updUrl, function (data) {
    let tag = data['tag_name']
    if (version !== tag) {
      let url = data['html_url']
      let lbl = `v ${data['tag_name']} available`
      $('#mbr-ls-acts').append(`
        <li>
          <a href="javascript:openUrl('${url}')" 
            title="${url}" class="mbr-ls-update">${lbl}</a>
        </li>`)

      $('.mbr-ls-update').hover(function(evt) {
        $(this).css('animation', 'none')
      })
    }
  })
}

