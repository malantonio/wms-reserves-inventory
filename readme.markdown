# wms course reserves inventory

quick/messy cli script to generate a `.csv` file of items placed on reserve. parses `Item_Inventory`
files generated weekly by OCLC.

To place items on reserve, we use the following steps:

* change item's Temporary Location to the appropriate Reserves shelf
  * we have locations for `2 Hour`, `4 Hour` and `1 Day` reserves
* add a Public Note for each course:
  * ex. `FLM 101 - Lastname`

and then we also use WorldShare Discovery for catalog lookups.

This script parses two `Item_Inventory` files and returns stats for each item on reserve.

```bash
cd /path/to/oclc/inventories
git clone https://github.com/malantonio/wms-reserves-inventory .
npm install
```

edit `config.json` to fit your institution:

key                       | value 
--------------------------|-------
`default_start_date`      | if you don't want to pass the start date every time, give a default
`inventory_path`          | path to the directory storing the OCLC reports
`oclc_symbol`             | your institution's OCLC symbol (used to build the file name)
`reserves_shelves`        | an array of locations to look for items (using the field defined in `reserves_shelving_field`)
`barcode_field`           | the column for the item's barcode
`title_field`             | the column for the item's title
`count_field`             | the column to use for an item's check-out count
`course_note_field`       | the column used for storing the item's courses
`reserves_shelving_field` | the column to use for filtering out items on reserve
`oclc_num_field`          | the column for the item's OCLC number
`format_field`            | the column storing the item's format

then run it

```bash
node inventory <start date YYYYMMDD> <end date YYYYMMDD>
```

outputs a file (`reserves-inventory-YYYYMMDD-YYYYMMDD`) with the headers:
  * Barcode
  * OCLC Number
  * Title
  * Format
  * Reserve Location
  * Courses (`|` delimited)
  * Start Count (@ start date)
  * Latest Count (@ end date)
  * Delta (latest count - start count)
