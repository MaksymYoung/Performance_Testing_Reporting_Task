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

    var data = {"OkPercent": 99.98296569251313, "KoPercent": 0.017034307486871837};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9970571765341646, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9993962937687018, 500, 1500, "S01_Browse_And_Checkout_T07_AddChairToCart"], "isController": true}, {"data": [0.9745666258098407, 500, 1500, "S01_Browse_And_Checkout_T11_SubmitOrder"], "isController": true}, {"data": [0.9972459016393442, 500, 1500, "S01_Browse_And_Checkout_T03_OpenTableProductCard"], "isController": true}, {"data": [0.9991028839000481, 500, 1500, "OpenCheckout"], "isController": false}, {"data": [0.9996060924369747, 500, 1500, "S01_Browse_And_Checkout_T10_LoadStateDropdown"], "isController": true}, {"data": [0.9993962937687018, 500, 1500, "AddChairToCart"], "isController": false}, {"data": [0.9996060924369747, 500, 1500, "LoadStateDropdown"], "isController": false}, {"data": [0.9975940105942204, 500, 1500, "S01_Browse_And_Checkout_T02_NavigateToTables"], "isController": true}, {"data": [0.9745666258098407, 500, 1500, "SubmitOrder"], "isController": false}, {"data": [0.9993965788645188, 500, 1500, "S01_Browse_And_Checkout_T04_AddTableToCart"], "isController": true}, {"data": [0.9976778357954397, 500, 1500, "NavigateToChairs"], "isController": false}, {"data": [0.9993965788645188, 500, 1500, "AddTableToCart"], "isController": false}, {"data": [0.9989937437108982, 500, 1500, "OpenCart"], "isController": false}, {"data": [0.9967026771901303, 500, 1500, "OpenApplication"], "isController": false}, {"data": [0.9982415159707094, 500, 1500, "OpenChairProductCard"], "isController": false}, {"data": [0.9975940105942204, 500, 1500, "NavigateToTables"], "isController": false}, {"data": [0.9976778357954397, 500, 1500, "S01_Browse_And_Checkout_T05_NavigateToChairs"], "isController": true}, {"data": [0.9982415159707094, 500, 1500, "S01_Browse_And_Checkout_T06_OpenChairProductCard"], "isController": true}, {"data": [0.9991028839000481, 500, 1500, "S01_Browse_And_Checkout_T09_OpenCheckout"], "isController": true}, {"data": [0.9989937437108982, 500, 1500, "S01_Browse_And_Checkout_T08_OpenCart"], "isController": true}, {"data": [0.9967026771901303, 500, 1500, "S01_Browse_And_Checkout_T01_OpenApplication"], "isController": true}, {"data": [0.9972459016393442, 500, 1500, "OpenTableProductCard"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 510734, 87, 0.017034307486871837, 89.21647863662643, 11, 5045, 86.0, 284.0, 420.0, 885.9700000000048, 35.4680255888901, 1198.7857660176614, 34.36777711580345], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["S01_Browse_And_Checkout_T07_AddChairToCart", 38098, 9, 0.023623287311669905, 46.959499186308996, 15, 1048, 38.0, 81.90000000000146, 111.0, 217.9900000000016, 2.645825633298762, 1.7866829636118764, 2.338626427813851], "isController": true}, {"data": ["S01_Browse_And_Checkout_T11_SubmitOrder", 22844, 4, 0.01751006828926633, 233.3857468044125, 16, 5045, 189.0, 354.90000000000146, 502.9500000000007, 1225.9800000000032, 1.5865623089634935, 0.7879020129092583, 9.955423442421763], "isController": true}, {"data": ["S01_Browse_And_Checkout_T03_OpenTableProductCard", 76250, 17, 0.022295081967213116, 100.64544262295051, 15, 1977, 88.0, 181.0, 261.0, 553.9700000000048, 5.29536945810071, 244.34075524178206, 3.8434810180189793], "isController": true}, {"data": ["OpenCheckout", 22851, 5, 0.021880880486630783, 72.32878211019174, 14, 1400, 61.0, 102.0, 131.0, 257.9900000000016, 1.5871273973430498, 101.8804403047212, 1.1235018966340828], "isController": false}, {"data": ["S01_Browse_And_Checkout_T10_LoadStateDropdown", 22848, 3, 0.013130252100840336, 34.969800420168184, 15, 839, 29.0, 47.0, 64.0, 140.9900000000016, 1.586712505027923, 4.01309458510225, 1.2131179313713158], "isController": true}, {"data": ["AddChairToCart", 38098, 9, 0.023623287311669905, 46.95949918630897, 15, 1048, 38.0, 81.90000000000146, 111.0, 217.9900000000016, 2.645825633298762, 1.7866829636118764, 2.338626427813851], "isController": false}, {"data": ["LoadStateDropdown", 22848, 3, 0.013130252100840336, 34.969800420168184, 15, 839, 29.0, 47.0, 64.0, 140.9900000000016, 1.586712505027923, 4.01309458510225, 1.2131179313713158], "isController": false}, {"data": ["S01_Browse_And_Checkout_T02_NavigateToTables", 76268, 19, 0.02491215188545655, 94.96559500708017, 14, 1819, 83.0, 166.0, 250.0, 521.9900000000016, 5.296511738536158, 263.1445869045027, 3.718010974069642], "isController": true}, {"data": ["SubmitOrder", 22844, 4, 0.01751006828926633, 233.38574680441252, 16, 5045, 189.0, 354.90000000000146, 502.9500000000007, 1225.9800000000032, 1.5865623089634935, 0.7879020129092583, 9.955423442421763], "isController": false}, {"data": ["S01_Browse_And_Checkout_T04_AddTableToCart", 76232, 9, 0.011806065694196663, 47.41028701857541, 15, 1120, 39.0, 95.0, 132.0, 288.0, 5.2943116985037, 3.574320822496241, 4.534926034132066], "isController": true}, {"data": ["NavigateToChairs", 38111, 8, 0.02099131484348351, 93.73574558526443, 15, 1925, 80.0, 143.0, 198.0, 410.9900000000016, 2.647202585980252, 121.5044109946028, 1.9214718468258054], "isController": false}, {"data": ["AddTableToCart", 76232, 9, 0.011806065694196663, 47.41028701857538, 15, 1120, 39.0, 95.0, 132.0, 288.0, 5.2943116985037, 3.574320822496241, 4.534926034132066], "isController": false}, {"data": ["OpenCart", 22857, 4, 0.0175001093756836, 67.36807105044396, 15, 1201, 57.0, 93.0, 123.0, 252.0, 1.5874493092022333, 60.10794069144106, 1.1471849803270395], "isController": false}, {"data": ["OpenApplication", 76274, 0, 0.0, 117.46002569682936, 70, 2205, 104.0, 214.0, 303.0, 610.9800000000032, 5.296978075188699, 274.7652191599591, 2.6588346978974524], "isController": false}, {"data": ["OpenChairProductCard", 38101, 9, 0.023621427259127057, 89.00065615075708, 11, 1835, 77.0, 138.0, 192.95000000000073, 380.9900000000016, 2.6461752970809425, 122.95622913587212, 1.915693980411316], "isController": false}, {"data": ["NavigateToTables", 76268, 19, 0.02491215188545655, 94.9655950070802, 14, 1819, 83.0, 166.0, 250.0, 521.9900000000016, 5.29651210635803, 263.14460517885743, 3.7180112322708547], "isController": false}, {"data": ["S01_Browse_And_Checkout_T05_NavigateToChairs", 38111, 8, 0.02099131484348351, 93.73574558526443, 15, 1925, 80.0, 143.0, 198.0, 410.9900000000016, 2.647202585980252, 121.5044109946028, 1.9214718468258054], "isController": true}, {"data": ["S01_Browse_And_Checkout_T06_OpenChairProductCard", 38101, 9, 0.023621427259127057, 89.00065615075708, 11, 1835, 77.0, 138.0, 192.95000000000073, 380.9900000000016, 2.6461752970809425, 122.95622913587212, 1.915693980411316], "isController": true}, {"data": ["S01_Browse_And_Checkout_T09_OpenCheckout", 22851, 5, 0.021880880486630783, 72.32878211019174, 14, 1400, 61.0, 102.0, 131.0, 257.9900000000016, 1.5871273973430498, 101.8804403047212, 1.1235018966340828], "isController": true}, {"data": ["S01_Browse_And_Checkout_T08_OpenCart", 22857, 4, 0.0175001093756836, 67.36807105044396, 15, 1201, 57.0, 93.0, 123.0, 252.0, 1.5874493092022333, 60.10794069144106, 1.1471849803270395], "isController": true}, {"data": ["S01_Browse_And_Checkout_T01_OpenApplication", 76274, 0, 0.0, 117.46002569682936, 70, 2205, 104.0, 214.0, 303.0, 610.9800000000032, 5.296978443046405, 274.7652382414999, 2.6588348825447774], "isController": true}, {"data": ["OpenTableProductCard", 76250, 17, 0.022295081967213116, 100.6454426229505, 15, 1977, 88.0, 181.0, 261.0, 553.9700000000048, 5.295369825850739, 244.3407722106301, 3.843481284939024], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["Non HTTP response code: java.net.SocketException/Non HTTP response message: An established connection was aborted by the software in your host machine", 2, 2.2988505747126435, 3.9159327556027206E-4], "isController": false}, {"data": ["Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 83, 95.40229885057471, 0.01625112093575129], "isController": false}, {"data": ["500/Internal Server Error", 2, 2.2988505747126435, 3.9159327556027206E-4], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 510734, 87, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 83, "Non HTTP response code: java.net.SocketException/Non HTTP response message: An established connection was aborted by the software in your host machine", 2, "500/Internal Server Error", 2, "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["OpenCheckout", 22851, 5, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 4, "500/Internal Server Error", 1, "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["AddChairToCart", 38098, 9, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 9, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["LoadStateDropdown", 22848, 3, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 3, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["SubmitOrder", 22844, 4, "Non HTTP response code: java.net.SocketException/Non HTTP response message: An established connection was aborted by the software in your host machine", 2, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 2, "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["NavigateToChairs", 38111, 8, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 7, "500/Internal Server Error", 1, "", "", "", "", "", ""], "isController": false}, {"data": ["AddTableToCart", 76232, 9, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 9, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["OpenCart", 22857, 4, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 4, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["OpenChairProductCard", 38101, 9, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 9, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["NavigateToTables", 76268, 19, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 19, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["OpenTableProductCard", 76250, 17, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 17, "", "", "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
