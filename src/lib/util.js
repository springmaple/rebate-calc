function toFloat(val, precision) {
  return parseFloat(parseFloat(val).toFixed(precision))
}

module.exports = {

  getNearestDay: function() {
    let date = new Date()
    let d = Math.round(date.getDate() / 10) * 10
    if (d <= 10)
      d = 10
    else if (d > 30)
      d = 30
    return d
  },

  getTodayDate: function() {
    /* Get date nearest to 10/20/30. */
    let date = new Date()
    let d = date.getDate()
    let m = date.getMonth() + 1
    let y = date.getFullYear()

    return y * 10000 + m * 100 + d  // e.g 20160920
  },

  getParamByName: function(name, url) {
    /* Extract query value from URL. */
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  },

  toFloat: toFloat,

  floatToString: function(val, precision) {
    val = toFloat(val, 2)
    if (isNaN(val))
      return ''
    if (val == 0)
      return '0'
    return val.toFixed(2)
  },

  validateFloat: function(val, min, max) {
    let val_ = toFloat(val, 2)
    if (isNaN(val_))
      return null
    else if (val_ < min)
      return toFloat(min, 2)
    else if (val_ > max)
      return toFloat(max, 2)

    return val_
  }
}
