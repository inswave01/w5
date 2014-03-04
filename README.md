Getting Started
====================
### Obtaining W5Grid

W5Grid has several methods that let the user start quickly.

Select a method that fits your environment and purpose.
<!--
#### Download Minified W5Grid

The fastest way to use W5Grid is to download the minified CSS and JavaScript version. 

Documents and original source not included.

COMMENT START
Downloading the minified W5Grid (Add a button)
COMMENT END

#### Additional downloads
-->
##### [Download source code](https://github.com/inswave/w5/archive/master.zip)

You can obtain the latest LESS and JavaScript source code of W5Grid directly from GitHub.

##### [Clone or fork via GitHub](https://github.com/inswave/w5.git)

You can clone or fork the W5Grid project by visiting GitHub.
<!--
##### Install with [Bower](http://bower.io/)

You can install and manage W5Grid styles, JavaScript, and documentation using Bower. 

Using Bower is recommended if you want to avoid cumbersome dependency management.

	$ bower install w5grid
-->
<!--
#### W5Grid CDN

CSS and JavaScript CDN support for W5Grid are provided. 

Use the [W5Grid CDN](http://) links described below.

	COMMENT START
	Latest minified CSS
	COMMENT END	
	<link rel="stylesheet" href="//w5.io/w5grid/1.0.0/css/w5.min.css">
	COMMENT START
	Optional theme
	COMMENT END
	<link rel="stylesheet" href="//w5.io/w5grid/1.0.0/css/w5-theme.min.css">
	COMMENT START
	Latest minified JavaScript
	COMMENT END
	<script src="//w5.io/w5grid/1.0.0/js/w5.min.1.0.0.js"></script>
-->
### Project Structure

The structure of the distributed Zip file is as follows:

	w5/
	
	├── dist/
	
	│ ├── css/
	
	│ ├── js/
	
	├── src/
	
	├── docs-assets/
	
	├── examples/
	
	└── *.html

* dist/ 

	* Minified distribution version
	
* src/ 

	* complete JS source code
	
	* source code for CSS
	
	* Not available in the trial distribution
	
* docs-assets/, examples/, *.html files

	* documentation & demos

### Dependencies and Installation

W5Grid has a few dependencies:

* [jQuery](http://jquery.com/)

* [Undersocre.js](http://underscorejs.org/)

* [Backbone.js](http://backbonejs.org/)

Your webpage will be updated to load these resources together with W5Grid CSS and JS. 

Put `<script>` tags right before closing a `</body>` tag in the following order. 

If the library has been used, it can be excluded.

	<!-- ... additional lines truncated for brevity ... -->
	
		<link rel="stylesheet" href="w5.min.css">
	
	</head>
	
	<!-- ... additional lines truncated for brevity ... -->
	
		<script src="jquery.min.js"></script>
		
		<script src="underscore-min.js"></script>
		
		<script src="backbone-min.js"></script>
		
		<script src="w5.min.*.*.*.js"></script>
	
	</body>

### Using

#### Converts the table on the screen into grids.

The table to be converted into grids is defined in a body tag.

	<!-- ... additional lines truncated for brevity ... -->
	
	<table id="tblMain">
	
		<thead>
	
			... additional lines truncated for brevity ...
	
		</thead>
	
		<tbody>
	
			<tr>
	
				<td>James</td>
	
				... additional lines truncated for brevity ...
	
			</tr>
	
			... additional lines truncated for brevity ...
	
		</tbody>
	
	</table>
	
	<!-- ... additional lines truncated for brevity ... -->

The grid object is returned if the `new w5.Grid()` constructor function is executed by taking the CSS selector(table) 

and basic grid information as parameters. 

'el' property takes a value of CSS Selector(Table ID)

Set 'parseTable' property value to 'ture' to convert the table to a grid.

`render()` from grid instance renders a grid on the screen.

The table header label will be used as grid column ID by default.

	var grid = new w5.Grid({
	
					el: "#tblMain",
					
					parseTable : true,
	
					option: {

					  width: "650px",
			
					  height: "400px",
			
					  caption: "Table to Grid",
			
					  rowNum: 10
					  
					}
		
				}).render();

The data can be fetched by accessing the cell at the position.

	// The position starts from 0.
	
	// Gets the data of the first cell using the get() function.
	
	var name = grid.cell(0, 0).get("data") // "James"

<a href="http://codepen.io/w5/pen/rjkIn" target="_blank">LIVE PREVIEW</a>

#### Creates a grid using JSON or two-dimensional array as data.

The div of the grid position is defined in a body tag, or an element is created.

	<div id="gridMain"></div>
	
	or
	
	$("body").append("<div id="gridMain"></div>");

Similar to converts the table into grid. 

Unlike convert, column information and data(collection property) should be provided. 
<!--
Use the basic information if the column information is omitted.
-->
	// The grid object can be created using the JSON array, which has the column id as a property. 
	
	// A string having the same structure as the JSON array can be used as collection property value instead of the JSON array. (Automatic conversion into the JSON array)
	
	var grid = new w5.Grid( {
	
	 el: "#gridMain",
	 
	 option{
	
	 	width: "650px",
	
		height: "400px",
	
	 	caption: "Array to Grid",
	
		rowNum: 10
		
	 },
	
	 colModel: [{ "colWidth": 100, "headerLabel": "first-name" },  
                { "colWidth": 80, "headerLabel": "last-name" }],
	
	 collection: [{"first-name": "James", "last-name": "Butt"},  
                  {"first-name": "Josephine", "last-name": "Darakjy"}]
	
	 });

The style and others can be changed by accessing a row or a column.

	// Changes the background color of the second column to orange.
	
	grid.col(1).set( "style", "background", "orange" );
	
	// Multiple style elements can be applied using the object at the same time.
	
	// Change the font color of the fourth row to green and use bold face.
	
	grid.row(3).set( "style", { "color": "green", "font-weight" : "bold" });

Chaining can be used.

	// Changes the first cell data and adds the class.
	
	grid.cell(0, 0).set("data", "Art").set("class", "bgYellow"); // .bgYellow { background-color: #fbca04; }

<a href="http://codepen.io/w5/pen/xFhqK" target="_blank">LIVE PREVIEW</a>
 
<!--
#### Customize

The grid CSS, like the color, can be customized using ThemeRoller.
COMMENT START
ThemeRoller Button
COMMENT END
-->
### Supported browsers

<!-- Is it better to separate the desktop from mobile?(http://docs.kendoui.com/getting-started/dataviz/

supported-browsers)-->

<!-- Specify the lowest supported browser version, or the version before the latest version is 

supported! -->

* Chrome

* Safari

* Firefox

* Internet Explorer 9+

* Opera

<!--
### Updating packages

If the new W5Grid is released, run "Bower update" from the "App" directory to update. 

 

bower update

All packages in "bower_components/" will be updated.
-->
