/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9994843820056792, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9998953537044789, 500, 1500, "S01_Browse_And_Checkout_T07_AddChairToCart"], "isController": true}, {"data": [0.9984287709497207, 500, 1500, "S01_Browse_And_Checkout_T11_SubmitOrder"], "isController": true}, {"data": [0.9993016759776536, 500, 1500, "SubmitOrder-0"], "isController": false}, {"data": [0.9991637922023623, 500, 1500, "S01_Browse_And_Checkout_T03_OpenTableProductCard"], "isController": true}, {"data": [1.0, 500, 1500, "SubmitOrder-1"], "isController": false}, {"data": [0.9994768050226718, 500, 1500, "OpenCheckout"], "isController": false}, {"data": [1.0, 500, 1500, "S01_Browse_And_Checkout_T10_LoadStateDropdown"], "isController": true}, {"data": [0.9998953537044789, 500, 1500, "AddChairToCart"], "isController": false}, {"data": [1.0, 500, 1500, "LoadStateDropdown"], "isController": false}, {"data": [0.9993723192802595, 500, 1500, "S01_Browse_And_Checkout_T02_NavigateToTables"], "isController": true}, {"data": [0.9984287709497207, 500, 1500, "SubmitOrder"], "isController": false}, {"data": [1.0, 500, 1500, "S01_Browse_And_Checkout_T04_AddTableToCart"], "isController": true}, {"data": [0.9993722536095417, 500, 1500, "NavigateToChairs"], "isController": false}, {"data": [1.0, 500, 1500, "AddTableToCart"], "isController": false}, {"data": [0.9991114363370269, 500, 1500, "OpenApplication"], "isController": false}, {"data": [1.0, 500, 1500, "OpenCart"], "isController": false}, {"data": [0.9996861268047709, 500, 1500, "OpenChairProductCard"], "isController": false}, {"data": [0.9993723192802595, 500, 1500, "NavigateToTables"], "isController": false}, {"data": [0.9993722536095417, 500, 1500, "S01_Browse_And_Checkout_T05_NavigateToChairs"], "isController": true}, {"data": [0.9996861268047709, 500, 1500, "S01_Browse_And_Checkout_T06_OpenChairProductCard"], "isController": true}, {"data": [0.9994768050226718, 500, 1500, "S01_Browse_And_Checkout_T09_OpenCheckout"], "isController": true}, {"data": [1.0, 500, 1500, "S01_Browse_And_Checkout_T08_OpenCart"], "isController": true}, {"data": [0.9991114363370269, 500, 1500, "S01_Browse_And_Checkout_T01_OpenApplication"], "isController": true}, {"data": [0.9991637922023623, 500, 1500, "OpenTableProductCard"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 69777, 0, 0.0, 84.1455063989558, 22, 1985, 74.0, 147.0, 188.0, 259.0, 38.76342792764516, 318.71478864589795, 48.12128951680015], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["S01_Browse_And_Checkout_T07_AddChairToCart", 4778, 0, 0.0, 44.9238174968606, 25, 541, 36.0, 74.10000000000036, 96.0, 135.21000000000004, 2.6546597668477556, 1.8255093972205523, 2.4299252840438723], "isController": true}, {"data": ["S01_Browse_And_Checkout_T11_SubmitOrder", 2864, 0, 0.0, 225.49231843575416, 135, 1985, 216.0, 283.0, 314.0, 399.0499999999997, 1.5924027266560656, 15.272699813981063, 11.288049634182448], "isController": true}, {"data": ["SubmitOrder-0", 2864, 0, 0.0, 167.20670391061483, 92, 1529, 159.0, 217.0, 244.0, 317.3499999999999, 1.5924416846075833, 0.7902517706113886, 10.044230728932675], "isController": false}, {"data": ["S01_Browse_And_Checkout_T03_OpenTableProductCard", 9567, 0, 0.0, 92.69938329674925, 59, 904, 83.0, 131.0, 152.0, 199.3199999999997, 5.315614248757634, 60.64088325900993, 4.025032172120445], "isController": true}, {"data": ["SubmitOrder-1", 2864, 0, 0.0, 58.2081005586592, 40, 456, 54.0, 77.0, 87.0, 114.34999999999991, 1.5925656544088045, 14.48394915967695, 1.2441919175068785], "isController": false}, {"data": ["OpenCheckout", 2867, 0, 0.0, 65.3139169863971, 46, 734, 59.0, 85.0, 97.59999999999991, 132.32000000000016, 1.5941912940585097, 22.21474535980931, 1.178518368752238], "isController": false}, {"data": ["S01_Browse_And_Checkout_T10_LoadStateDropdown", 2864, 0, 0.0, 30.031424581005563, 22, 264, 27.0, 39.0, 44.0, 67.0, 1.5927055863703552, 1.5506767486811797, 1.267631887589687], "isController": true}, {"data": ["AddChairToCart", 4778, 0, 0.0, 44.9238174968606, 25, 541, 36.0, 74.10000000000036, 96.0, 135.21000000000004, 2.6546597668477556, 1.8255093972205523, 2.4299252840438723], "isController": false}, {"data": ["LoadStateDropdown", 2864, 0, 0.0, 30.03142458100556, 22, 264, 27.0, 39.0, 44.0, 67.0, 1.5927055863703552, 1.5506767486811797, 1.267631887589687], "isController": false}, {"data": ["S01_Browse_And_Checkout_T02_NavigateToTables", 9559, 0, 0.0, 83.76221362067162, 59, 772, 76.0, 109.0, 125.0, 172.0, 5.31432281995459, 59.70913215336956, 3.8975160525252903], "isController": true}, {"data": ["SubmitOrder", 2864, 0, 0.0, 225.49196927374297, 135, 1985, 216.0, 283.0, 314.0, 399.0499999999997, 1.5924027266560656, 15.272699813981063, 11.288049634182448], "isController": false}, {"data": ["S01_Browse_And_Checkout_T04_AddTableToCart", 9556, 0, 0.0, 44.850669736291394, 24, 499, 36.0, 73.0, 95.0, 135.4300000000003, 5.309930225205276, 3.6513882783331955, 4.714652894428741], "isController": true}, {"data": ["NavigateToChairs", 4779, 0, 0.0, 82.62628164888066, 59, 819, 75.0, 107.0, 122.0, 175.39999999999964, 2.655842492257266, 28.30951371848375, 2.0111273406036023], "isController": false}, {"data": ["AddTableToCart", 9556, 0, 0.0, 44.85066973629141, 24, 499, 36.0, 73.0, 95.0, 135.4300000000003, 5.309930225205276, 3.6513882783331955, 4.714652894428741], "isController": false}, {"data": ["OpenApplication", 9566, 0, 0.0, 107.67154505540441, 70, 1078, 98.0, 149.0, 171.0, 217.0, 5.314285015893968, 64.259254948046, 2.833593377615338], "isController": false}, {"data": ["OpenCart", 2867, 0, 0.0, 60.151028950122054, 42, 469, 55.0, 79.0, 92.0, 122.0, 1.594545065225069, 15.57076399867492, 1.2023672374033998], "isController": false}, {"data": ["OpenChairProductCard", 4779, 0, 0.0, 79.12764176605982, 57, 864, 73.0, 102.0, 117.0, 159.0, 2.655497168080913, 30.559328156160348, 2.0058410328072536], "isController": false}, {"data": ["NavigateToTables", 9559, 0, 0.0, 83.7622136206716, 59, 772, 76.0, 109.0, 125.0, 172.0, 5.31432281995459, 59.70913215336956, 3.8975160525252903], "isController": false}, {"data": ["S01_Browse_And_Checkout_T05_NavigateToChairs", 4779, 0, 0.0, 82.62628164888066, 59, 819, 75.0, 107.0, 122.0, 175.39999999999964, 2.655842492257266, 28.30951371848375, 2.0111273406036023], "isController": true}, {"data": ["S01_Browse_And_Checkout_T06_OpenChairProductCard", 4779, 0, 0.0, 79.12764176605982, 57, 864, 73.0, 102.0, 117.0, 159.0, 2.6554986436341936, 30.559345136753457, 2.005842147372673], "isController": true}, {"data": ["S01_Browse_And_Checkout_T09_OpenCheckout", 2867, 0, 0.0, 65.3139169863971, 46, 734, 59.0, 85.0, 97.59999999999991, 132.32000000000016, 1.5941921805068162, 22.214757712293906, 1.1785190240660741], "isController": true}, {"data": ["S01_Browse_And_Checkout_T08_OpenCart", 2867, 0, 0.0, 60.151028950122054, 42, 469, 55.0, 79.0, 92.0, 122.0, 1.5945441783842769, 15.5707553386571, 1.2023665686808052], "isController": true}, {"data": ["S01_Browse_And_Checkout_T01_OpenApplication", 9566, 0, 0.0, 107.67164959230598, 70, 1078, 98.0, 149.0, 171.0, 217.0, 5.314287968187603, 64.25929064658096, 2.8335949517875307], "isController": true}, {"data": ["OpenTableProductCard", 9567, 0, 0.0, 92.69938329674925, 59, 904, 83.0, 131.0, 152.0, 199.3199999999997, 5.315614248757634, 60.64088325900993, 4.025032172120445], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 69777, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
