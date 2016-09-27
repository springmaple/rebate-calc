module.exports = {

  getNearestDate: function() {
    /* Get date nearest to 10/20/30. */
    let d = new Date()
    let n = Math.round(d.getDate() / 10) * 10
    if (n <= 10)
      n = 10
    else if (n > 30)
      n = 30

    let m = d.getMonth() + 1
    let y = d.getFullYear()

    return y * 10000 + m * 100 + n  // e.g 20160920
  },

  joinDate: function(y, m, d) {
    return y * 10000 + m * 100 + d
  },

  splitDate: function(d) {
    return {
      y: Math.floor(d/10000),
      m: Math.floor((d%10000)/100),
      d: Math.floor(d%100) 
    }
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

  toFloat: function(val, precision) {
    return parseFloat(val).toFixed(precision)
  },

  floatToString: function(val, precision) {
    val = toFloat(val, 2)
    if (isNaN(val))
      return ''
    return val.toString()
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
