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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9995458615837278, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9999100233939175, 500, 1500, "S01_Browse_And_Checkout_T07_AddChairToCart"], "isController": true}, {"data": [0.998343373493976, 500, 1500, "S01_Browse_And_Checkout_T11_SubmitOrder"], "isController": true}, {"data": [0.9993975903614458, 500, 1500, "SubmitOrder-0"], "isController": false}, {"data": [0.9992858418139617, 500, 1500, "S01_Browse_And_Checkout_T03_OpenTableProductCard"], "isController": true}, {"data": [1.0, 500, 1500, "SubmitOrder-1"], "isController": false}, {"data": [0.9995498199279712, 500, 1500, "OpenCheckout"], "isController": false}, {"data": [0.9999100233939175, 500, 1500, "AddChairToCart"], "isController": false}, {"data": [1.0, 500, 1500, "S01_Browse_And_Checkout_T10_LoadStateDropdown"], "isController": true}, {"data": [0.9994651453021929, 500, 1500, "S01_Browse_And_Checkout_T02_NavigateToTables"], "isController": true}, {"data": [1.0, 500, 1500, "LoadStateDropdown"], "isController": false}, {"data": [0.998343373493976, 500, 1500, "SubmitOrder"], "isController": false}, {"data": [1.0, 500, 1500, "S01_Browse_And_Checkout_T04_AddTableToCart"], "isController": true}, {"data": [0.9994624619243863, 500, 1500, "NavigateToChairs"], "isController": false}, {"data": [1.0, 500, 1500, "AddTableToCart"], "isController": false}, {"data": [0.9992432336182336, 500, 1500, "OpenApplication"], "isController": false}, {"data": [1.0, 500, 1500, "OpenCart"], "isController": false}, {"data": [0.9997305550565835, 500, 1500, "OpenChairProductCard"], "isController": false}, {"data": [0.9994651453021929, 500, 1500, "NavigateToTables"], "isController": false}, {"data": [0.9994624619243863, 500, 1500, "S01_Browse_And_Checkout_T05_NavigateToChairs"], "isController": true}, {"data": [0.9997305550565835, 500, 1500, "S01_Browse_And_Checkout_T06_OpenChairProductCard"], "isController": true}, {"data": [0.9995498199279712, 500, 1500, "S01_Browse_And_Checkout_T09_OpenCheckout"], "isController": true}, {"data": [1.0, 500, 1500, "S01_Browse_And_Checkout_T08_OpenCart"], "isController": true}, {"data": [0.9992432336182336, 500, 1500, "S01_Browse_And_Checkout_T01_OpenApplication"], "isController": true}, {"data": [0.9992858418139617, 500, 1500, "OpenTableProductCard"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 81494, 0, 0.0, 82.79808329447502, 22, 1985, 74.0, 147.0, 188.0, 259.0, 33.88578858451343, 278.8815949094393, 41.93726806406632], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["S01_Browse_And_Checkout_T07_AddChairToCart", 5557, 0, 0.0, 44.7282706496312, 25, 541, 36.0, 75.0, 96.0, 132.42000000000007, 2.3413638560328778, 1.610065783576367, 2.143135991074841], "isController": true}, {"data": ["S01_Browse_And_Checkout_T11_SubmitOrder", 3320, 0, 0.0, 221.97048192771106, 133, 1985, 213.0, 279.9000000000001, 310.0, 390.3699999999999, 1.4056182391667902, 13.481262668293148, 9.963916864243528], "isController": true}, {"data": ["SubmitOrder-0", 3320, 0, 0.0, 164.90301204819275, 92, 1529, 157.0, 215.0, 239.0, 312.1099999999997, 1.4056842993955134, 0.6975819147177263, 8.866194282294433], "isController": false}, {"data": ["S01_Browse_And_Checkout_T03_OpenTableProductCard", 11202, 0, 0.0, 91.20728441349749, 59, 904, 81.0, 128.0, 150.0, 195.96999999999935, 4.67351130391466, 53.31541777642743, 3.538744418341425], "isController": true}, {"data": ["SubmitOrder-1", 3320, 0, 0.0, 56.98795180722889, 40, 456, 53.0, 76.0, 85.0, 114.0, 1.4057926278032753, 12.785299553449125, 1.0982754904713088], "isController": false}, {"data": ["OpenCheckout", 3332, 0, 0.0, 64.13805522208864, 45, 734, 58.0, 84.0, 95.0, 129.67000000000007, 1.4097110134730635, 19.644033309949208, 1.0421398800772548], "isController": false}, {"data": ["AddChairToCart", 5557, 0, 0.0, 44.7282706496312, 25, 541, 36.0, 75.0, 96.0, 132.42000000000007, 2.34136484253405, 1.610066461955244, 2.143136894055453], "isController": false}, {"data": ["S01_Browse_And_Checkout_T10_LoadStateDropdown", 3325, 0, 0.0, 29.674285714285737, 22, 264, 27.0, 38.0, 43.0, 65.0, 1.4073037583686958, 1.369262578650292, 1.1200708623735225], "isController": true}, {"data": ["S01_Browse_And_Checkout_T02_NavigateToTables", 11218, 0, 0.0, 82.05972544125513, 59, 772, 74.0, 106.0, 122.0, 169.8099999999995, 4.676025386757903, 52.537540980482454, 3.4293897123585793], "isController": true}, {"data": ["LoadStateDropdown", 3325, 0, 0.0, 29.67428571428574, 22, 264, 27.0, 38.0, 43.0, 65.0, 1.4073049496502266, 1.3692637377299939, 1.1200718105126315], "isController": false}, {"data": ["SubmitOrder", 3320, 0, 0.0, 221.9701807228918, 133, 1985, 213.0, 279.9000000000001, 310.0, 390.3699999999999, 1.4056581126160779, 13.48164509392506, 9.964199512634623], "isController": false}, {"data": ["S01_Browse_And_Checkout_T04_AddTableToCart", 11178, 0, 0.0, 44.80059044551798, 24, 499, 36.0, 74.0, 95.0, 134.0, 4.67084889690996, 3.2119357924898697, 4.147128433275557], "isController": true}, {"data": ["NavigateToChairs", 5581, 0, 0.0, 81.01487188675854, 59, 819, 73.0, 105.0, 121.0, 173.1800000000003, 2.3386583451048457, 24.928539640044193, 1.7708576354303596], "isController": false}, {"data": ["AddTableToCart", 11178, 0, 0.0, 44.80059044551799, 24, 499, 36.0, 74.0, 95.0, 134.0, 4.670850848675799, 3.211937134632742, 4.147130166199011], "isController": false}, {"data": ["OpenApplication", 11232, 0, 0.0, 105.86262464387468, 70, 1078, 96.0, 146.0, 169.0, 213.0, 4.676260939690306, 56.54439741723181, 2.493396946358308], "isController": false}, {"data": ["OpenCart", 3338, 0, 0.0, 58.96405032953864, 42, 469, 53.0, 77.0, 89.0, 118.61000000000013, 1.40763937443123, 13.745735758431076, 1.0614336192135183], "isController": false}, {"data": ["OpenChairProductCard", 5567, 0, 0.0, 77.46901383150744, 56, 864, 71.0, 100.0, 114.0, 155.0, 2.3395985993507793, 26.92511773837156, 1.7672198023886012], "isController": false}, {"data": ["NavigateToTables", 11218, 0, 0.0, 82.05972544125514, 59, 772, 74.0, 106.0, 122.0, 169.8099999999995, 4.676031234121273, 52.5376066786058, 3.429394000805738], "isController": false}, {"data": ["S01_Browse_And_Checkout_T05_NavigateToChairs", 5581, 0, 0.0, 81.01487188675854, 59, 819, 73.0, 105.0, 121.0, 173.1800000000003, 2.3386573651154956, 24.928529194010718, 1.770856893371723], "isController": true}, {"data": ["S01_Browse_And_Checkout_T06_OpenChairProductCard", 5567, 0, 0.0, 77.46901383150743, 56, 864, 71.0, 100.0, 114.0, 155.0, 2.339597616106787, 26.925106422772267, 1.7672190596935702], "isController": true}, {"data": ["S01_Browse_And_Checkout_T09_OpenCheckout", 3332, 0, 0.0, 64.13805522208864, 45, 734, 58.0, 84.0, 95.0, 129.67000000000007, 1.4097104170492036, 19.644024998905273, 1.0421394391662568], "isController": true}, {"data": ["S01_Browse_And_Checkout_T08_OpenCart", 3338, 0, 0.0, 58.96405032953864, 42, 469, 53.0, 77.0, 89.0, 118.61000000000013, 1.40763937443123, 13.745735758431076, 1.0614336192135183], "isController": true}, {"data": ["S01_Browse_And_Checkout_T01_OpenApplication", 11232, 0, 0.0, 105.86271367521373, 70, 1078, 96.0, 146.0, 169.0, 213.0, 4.676200587023044, 56.54366764503841, 2.4933647661275216], "isController": true}, {"data": ["OpenTableProductCard", 11202, 0, 0.0, 91.20728441349749, 59, 904, 81.0, 128.0, 150.0, 195.96999999999935, 4.673515203526539, 53.31546226320042, 3.5387473710955475], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 81494, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
