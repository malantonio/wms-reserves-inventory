// usage: 
// node inventory <startdate YYYYMMDD> <enddate YYYYMMDD>
// node inventory <startdate YYYYMMDD> (uses most recent report as end date)
// node inventory (uses default start + most recent report)

var csv = require('csv-parser')
var fs = require('fs')
var config = require('./config.json')

// if no start date provided, when did the semester start?
var DEFAULT_START_DATE = config.default_start_date

// institution specific
var OCLC_SYMBOL = config.oclc_symbol

// valid RESERVES_SHELVING_FIELD values that constitute an item being on reserve
var RESERVES_SHELVES = config.reserves_shelves

// OCLC row headers
var BARCODE_FIELD = config.barcode_field
var TITLE_FIELD = config.title_field
var COUNT_FIELD = config.count_field
var COURSE_NOTE_FIELD = config.course_note_field
var RESERVES_SHELVING_FIELD = config.reserves_shelving_field
var OCLC_NUM_FIELD = config.oclc_num_field
var FORMAT_FIELD = config.format_field

var INVENTORY_PATH = config.inventory_path

var argv = process.argv.slice(2)
var startDate, endDate

if (argv.length === 1) {
  startDate = argv[0]
  endDate = getRecentDate()
}

else if (argv.length === 0) {
  startDate = DEFAULT_START_DATE
  endDate = getRecentDate
}

else {
  startDate = argv[0]
  endDate = argv[1]
}

var dates = [startDate, endDate]
var outCsv = fs.createWriteStream('reserves-inventory-' + dates[0] + '-' + dates[1] + '.csv')
outCsv.write([
  'Barcode',
  'OCLC Number',
  'Title',
  'Format',
  'Reserve Location',
  'Courses',
  'Start Count (@ '+dates[0]+')',
  'Latest Count (@ '+dates[1]+')',
  'Delta\n'
].join(','))

// 1234567890: {
//   title: text,
//   oclc_number,
//   courses: [],
//   startCount: 0,
//   lastCount: 0,
//   delta: 0
// }
var data = {}

getCounts(dates[1], dates[0])

function getRecentDate () {
  var now = new Date()
  var year = now.getFullYear().toString()
  var month = (now.getMonth() + 1).toString()
  if (month < 10) month = '0' + month
  var date = now.getDate()
  var dow = now.getDay()

  var day = (date - dow).toString()
  if (day < 10) day = '0' + day

  return year + month + day
}

function getCounts (latestDate, startDate) {
  console.log('getting latest counts')
  fs.createReadStream(INVENTORY_PATH + inventoryFilename(latestDate))
    .pipe(csv({separator: '|'}))
    .on('data', handleLatestData)
    .on('end', function () { getEarlyCount(startDate) })
}

function handleLatestData (row) {
  if (!isReservesItem(row)) return

  data[row[BARCODE_FIELD]] = {
    title: row[TITLE_FIELD],
    oclc_number: row[OCLC_NUM_FIELD],
    format: row[FORMAT_FIELD],
    location: row[RESERVES_SHELVING_FIELD],
    courses: extractCourses(row[COURSE_NOTE_FIELD]),
    startCount: 0,
    latestCount: parseInt(row[COUNT_FIELD], 0),
    delta: parseInt(row[COUNT_FIELD], 0)
  }
}

function isReservesItem (row) {
  return RESERVES_SHELVES.indexOf(row[RESERVES_SHELVING_FIELD]) > -1
}

function extractCourses (notes) {
  var out = []
  
  notes.split('^').filter(filterCourses).map(extract)

  function filterCourses (note) {
    var reg = /^[A-Z]{3}[\s|\-]*\d{3,}/
    return reg.test(note)
  }

  function extract (course) {
    // sometimes our courses have ellipsis appended?
    course = course.replace(/\.\.\.$/, '')
    if (out.indexOf(course) === -1) {
      out.push(course)
    }
  }

  return out
}

function getEarlyCount (date) {
  console.log('getting early counts')
  fs.createReadStream(INVENTORY_PATH + inventoryFilename(date))
    .pipe(csv({separator: '|'}))
    .on('data', handleEarlyData)
    .on('end', handleReportEnd)
}

function inventoryFilename (date) {
  return (INVENTORY_PATH.substr(-1) === '/' ? '' : '/')
         + OCLC_SYMBOL + '.Item_Inventories.' + date + '.txt'
}

function handleEarlyData (row) {
  var barcode = row[BARCODE_FIELD]
  var item = data[barcode]

  if (!item) return

  item.startCount = parseInt(row[COUNT_FIELD], 0)
  item.delta = item.latestCount - item.startCount
}

function handleReportEnd () {
  var count = 0
  var totalCirc = 0
  var nonCirc = 0

  for (var barcode in data) {
    var item = data[barcode]
    var row = [
      barcode,
      item.oclc_number,
      // escape fields that may contain quotes
      '"' + item.title.replace(/"/g, '\"') + '"',
      item.format,
      item.location,
      '"' + item.courses.join('|').replace(/\"/g, '\"') + '"',
      item.startCount,
      item.latestCount,
      item.delta
    ].join(',') + '\n'

    outCsv.write(row)
    count++
    totalCirc += item.delta
    if (item.delta === 0) nonCirc++
  }
  console.log('done! some stats:')
  console.log('----------------')
  console.log('%d items reported', count)
  console.log('%d total circs', totalCirc)
  console.log('%d items that have not circulated', nonCirc)
}
