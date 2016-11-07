const {ipcRenderer} = require('electron')
const {toFloat, floatToString} = require('./../../lib/util.js')
const {version} = require('./../../package.json')
const KEY = { ESC: 27, ENTER: 13, CTRL_N: 14, CTRL_P: 16, CTRL_F: 6 }

var workingDay = null
var filterDay = null
var pgDat = null
var lastHighlightId = null
var mbrFindAwesomplete = null
var mbrs = null


function toggleFilter (day) {
  let elements = $('#filter-day li')
  let day_ = 10
  for (let i=0; i<3; i++) {
    let e = $(elements[i])
    if (day === day_) {
      e.toggleClass('active')
      filterDay = e.hasClass('active')?day_:null
      localStorage.setItem('filterDay', filterDay)
    } else {
      e.removeClass('active')
    }
    day_ += 10
  }
  updMbrsView()
}

function selectDay (day) {
  localStorage.setItem('workingDay', day)
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
  if (!filterDay || _id) {
    ipcRenderer.send('show-page', { _id: _id, name: 'mbr-info' })
  }
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

function updMbrsView () {
  let colSpan = (filterDay)?11:12

  let profitPct = toFloat(pgDat['mbrProfit' + workingDay], 2)
  if (profitPct == null || isNaN(profitPct)) profitPct = null
  $('#mbr-profit').val(floatToString(profitPct, 2))

  let filtProfitPct = toFloat(pgDat[`mbrFilt${workingDay}_${filterDay}`], 2)
  if (filtProfitPct == null || isNaN(filtProfitPct)) filtProfitPct = null
  $('#mbr-filt-profit').val(floatToString(filtProfitPct, 2))

  mbrsLen = mbrs['length']
  let mbrTotalPackage = $('#mbr-total-package')
  let mbrTotalFilt = $('#mbr-total-filt')
  let mbrTotalHasMbr = $('#mbr-total-has-mbr')
  let mbrLsTableBody = $('#mbr-ls-table-body')

  mbrTotalPackage.html('-')
  mbrTotalHasMbr.html('-')
  mbrTotalFilt.html('-')

  if (!mbrsLen) {
    lastHighlightId = null
    mbrLsTableBody.html(`<tr><td colspan="${colSpan}">No members.</td></tr>`)
    mbrFindAwesomplete.list = []
  } else {
    let isProfitAvail = (profitPct != null)
    let totalPackage = 0
    
    let isFiltProfitAvail = (filtProfitPct != null)
    let totalFilt = 0

    let totalHasMbr = 0
    let mbrFindLs = []
    let mbrLsTableBodyCtnt = ''

    for (let mbr of mbrs) {
      let mbr_id = mbr._id
      let hasMbrCls = ''
      let filt = 0
      if (!filterDay) {
        if (checkHasMbr(mbr)) {
          hasMbrCls = 'class="glyphicon glyphicon-user"'
          totalHasMbr += 1
        }
      } else {
        for (let i=1; i<=3; i++) {
          let mbrRebate = mbr['mbrRebate' + i]
          if (mbrRebate) {
            for (let mbrRebate_ of mbrRebate) {
              if (mbrRebate_.mbrDay == filterDay) {
                let mbrPackage_ = toFloat(mbrRebate_.mbrPackage, 2)
                if (mbrPackage_) {
                  filt += toFloat(mbrPackage_ * i / 100, 2)
                }
              }
            }
          }
        }

        if (filt <= 0) {
          continue
        }
      }

      let profit = 'N/A'
      if (!filterDay) {
        let mbrPackage = toFloat(mbr.mbrPackage, 2)
        if (!isNaN(mbrPackage)) {
          totalPackage += mbrPackage
          if (isProfitAvail) {
            let profit_ = toFloat(mbrPackage * profitPct / 100, 2)
            if (!isNaN(profit_)) {
              profit = floatToString(profit_, 2)
            }
          }
        }
      }

      let filtProfit = 'N/A'
      if (filterDay) {
        totalFilt += filt
        if (isFiltProfitAvail) {
          let filtProfit_ = toFloat(filt * filtProfitPct, 2)
          if (!isNaN(filtProfit_)) {
            filtProfit = floatToString(filtProfit_, 2)
          }
        }
      } 

      mbrFindLs.push({label: `${mbr.mbrName}||${mbr.mbrId}`, value: mbr_id})

      mbrLsTableBodyCtnt += `
        <tr class="mbr-tr" mbrId="${mbr_id}" id="mbr-ls-tr-${mbr_id}" 
          onclick="highlight('${mbr_id}')">
          
          <td class="has-mbr-col"><span ${hasMbrCls}></span></td>
          <td><a class="no-blue-text" 
            href="javascript:showMbrInfo('${mbr_id}')">${mbr.mbrName}</a></td>
          <td>${mbr.mbrId}</td>
          <td>${mbr.mbrHp}</td>
          <td>${mbr.mbrIc}</td>
          <td>${mbr.mbrEmail}</td>
          <td>${mbr.mbrBankName}</td>
          <td>${mbr.mbrBankAcc}</td>
          <td>${mbr.mbrJoinDate}</td>
          <td>${mbr.mbrRemark}</td>
          <td class="rebate-total-col text-right">${floatToString(filt, 2)}</td>
          <td class="rebate-total-col text-right">${filtProfit}</td>
          <td class="has-mbr-col text-right">${floatToString(mbr.mbrPackage, 2)}</td>
          <td class="has-mbr-col text-right">${profit}</td>
        </tr>`
    }

    if (filterDay && mbrLsTableBodyCtnt === '') {
      mbrLsTableBodyCtnt = `<tr>
        <td colspan="${colSpan}">No matching members.</td>
      </tr>`
    }

    mbrTotalPackage.html(floatToString(totalPackage, 2))
    if (totalFilt == 0) mbrTotalFilt.html('N/A')
    else mbrTotalFilt.html(floatToString(totalFilt, 2))
    mbrTotalHasMbr.html(totalHasMbr.toString())
    mbrLsTableBody.html(mbrLsTableBodyCtnt)
    mbrFindAwesomplete.list = mbrFindLs
    highlight(lastHighlightId)

    $('.mbr-tr').dblclick(function () {
      let _id = $(this).attr('mbrId')
      ipcRenderer.send('show-page', {_id: _id, name: 'mbr-rebate'})
    })
  }

  if (filterDay) {
    $('.has-mbr-col').hide()
    $('.rebate-total-col').show()
  } else {
    $('.has-mbr-col').show()
    $('.rebate-total-col').hide()
  }
}


ipcRenderer.on('mbrs', function (evt, mbrs_) {
  mbrs = mbrs_
  updMbrsView()
})

ipcRenderer.on('pg-dat', function (evt, pgDat_) {
  pgDat = pgDat_
  ipcRenderer.send('ls-mbr', null)
})

ipcRenderer.on('working-day', function (evt, day) {
  workingDay = day
  let elements = $('#working-day li')
  let day_ = 10
  for (let i=0; i<3; i++) {
    let e = $(elements[i])
    if (day === day_) e.addClass('active')
    else e.removeClass('active')
    day_ += 10
  }
  ipcRenderer.send('get-pg-dat', null)
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
    if (isNaN(parsedInput)) parsedInput = null
    mbrProfit.val(floatToString(parsedInput, 2))
    pgDat['mbrProfit' + workingDay] = parsedInput
    ipcRenderer.send('set-pg-dat', pgDat)
  })
  mbrProfit.keypress(function (evt) {
    if (evt.which === KEY.ENTER) mbrProfit.blur()
  })
  mbrProfit.focus(function () {
    this.select()
  })

  let mbrFilt = $('#mbr-filt-profit')
  mbrFilt.focusout(function (evt) {
    if (filterDay) {
      let parsedInput = toFloat(mbrFilt.val(), 2)
      if (isNaN(parsedInput)) parsedInput = null
      mbrFilt.val(floatToString(parsedInput, 2))
      pgDat[`mbrFilt${workingDay}_${filterDay}`] = parsedInput
      ipcRenderer.send('set-pg-dat', pgDat)
    }
  })
  mbrFilt.keypress(function (evt) {
    if (evt.which === KEY.ENTER) mbrFilt.blur()
  })
  mbrFilt.focus(function () {
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
  filterDay = parseInt(localStorage.getItem('filterDay'))
  if ([10, 20, 30].includes(filterDay)) {
    let elements = $('#filter-day li')
    let e = $(elements[(filterDay / 10) - 1])
    e.addClass('active')
  } else {
    filterDay = null
  }

  workingDay_ = parseInt(localStorage.getItem('workingDay'))
  if ([10, 20, 30].includes(workingDay_)) {
    ipcRenderer.send('set-working-day', workingDay_)
  } else {
    ipcRenderer.send('get-working-day', null)
  }

  // check new version
  let updUrl = (
    'https://api.github.com/repos/springmaple/rebate-calc/releases/latest')
  $.getJSON(updUrl, function (data) {
    let tag = data['tag_name']
    if (version !== tag) {
      let url = data['html_url']
      let lbl = `${data['tag_name']}`
      $('#mbr-new-version').html(` ( <a href="javascript:openUrl('${url}')" 
        title="${url}" class="mbr-ls-update">${lbl}</a> )`)
      $('.mbr-ls-update').hover(function(evt) {
        $(this).css('animation', 'none')
      })
    }
  })
}
