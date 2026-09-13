// Create a new ListWidget
let widget = new ListWidget()

// Set widget padding
widget.setPadding(0, 8, 8, 5)

// Define the website URL
let url = 'https://bfgnet.de/sennelager-range-access'

// Get the current date and tomorrow's date in the desired format
let currentDate = new Date()
let tomorrowDate = new Date(currentDate)
tomorrowDate.setDate(tomorrowDate.getDate() + 1);

let formattedCurrentDate = currentDate.toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: '2-digit'
}).replace(/ /g, '-');

let formattedTomorrowDate = tomorrowDate.toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: '2-digit'
}).replace(/ /g, '-');

// Add title text with the current date
let titleTxt = widget.addText("Sennelager Range Access\n");
titleTxt.font = Font.boldSystemFont(10);
titleTxt.centerAlignText();
titleTxt.textColor = Color.gray();

// Call function to load the website
await loadSite(formattedCurrentDate, formattedTomorrowDate)

// Set the widget URL so that it opens the website when tapped
widget.url = url

// Present the widget (only if not running in the widget editor)
if (!config.runsInWidget) {
  widget.presentMedium()
}

// Set the widget and finish the script
Script.setWidget(widget)
Script.complete()

// Define the function to load the website
async function loadSite(currentDate, tomorrowDate) {
  // Initialize WebView and load the website
  let wbv = new WebView()
  await wbv.loadURL(url)
  
  // JavaScript to extract data from the website
 let jsc = `
  let currentDate = '${currentDate}';
  let tomorrowDate = '${tomorrowDate}';
  let data = [];
  let rows = [...document.querySelectorAll('.com-content-article__body tr')];
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    if (row.innerText.includes(currentDate) || row.innerText.includes(tomorrowDate)) {
      let rowData = [...row.querySelectorAll('td')].map(cell => cell.innerText).slice(1);
      
      rowData[0] = rowData[0].replace(currentDate, "Heute");
      rowData[0] = rowData[0].replace(tomorrowDate, "Morgen");
      
      data.push(rowData);
    }
  }
  data;
`

  // Execute JavaScript and get the result
  let val = await wbv.evaluateJavaScript(jsc)
  
  // Display the extracted data in the widget
  val.forEach(rowArr => {
    rowArr.forEach(cellTxt => {
      let tx = widget.addText(cellTxt)
      tx.centerAlignText()
      
      // Adjust font size based on text length
      let fontSize = 16
      if (cellTxt.length > 20) {
        fontSize = 14
      }
      if (cellTxt.length > 30) {
        fontSize = 12
      }
      tx.font = Font.semiboldSystemFont(fontSize)
      
      // Coloring the text based on content
      if (cellTxt.toLocaleLowerCase().includes("from") || cellTxt.toLocaleLowerCase().includes("until")||cellTxt.toLocaleLowerCase().includes("between")) {
         tx.textColor = Color.orange()
      } else if (cellTxt.toLocaleLowerCase().includes("closed")) { 
        tx.textColor = Color.red()
      } else if (cellTxt.toLocaleLowerCase().includes("open")) { 
        tx.textColor = Color.green()
      } else {
        tx.textColor = Color.white()
      }
    })
    widget.addSpacer(10) // Add space between rows
  })
}
