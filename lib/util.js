module.exports.getNearestDate = getNearestDate
module.exports.getParamByName = getParamByName

function getNearestDate() {
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
}

function getParamByName(name, url) {
  /* Extract query value from URL. */
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}