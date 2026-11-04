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

    var data = {"OkPercent": 96.80901998704456, "KoPercent": 3.190980012955435};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7407459601653513, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.8732771310049512, 500, 1500, "S01_Browse_And_Checkout_T07_AddChairToCart"], "isController": true}, {"data": [0.8383291543195805, 500, 1500, "S01_Browse_And_Checkout_T11_SubmitOrder"], "isController": true}, {"data": [0.8517240292486132, 500, 1500, "S01_Browse_And_Checkout_T03_OpenTableProductCard"], "isController": true}, {"data": [0.8659822730842589, 500, 1500, "OpenCheckout"], "isController": false}, {"data": [0.8732771310049512, 500, 1500, "AddChairToCart"], "isController": false}, {"data": [0.8740349682107176, 500, 1500, "S01_Browse_And_Checkout_T10_LoadStateDropdown"], "isController": true}, {"data": [0.8560316721006055, 500, 1500, "S01_Browse_And_Checkout_T02_NavigateToTables"], "isController": true}, {"data": [0.8740349682107176, 500, 1500, "LoadStateDropdown"], "isController": false}, {"data": [0.8383291543195805, 500, 1500, "SubmitOrder"], "isController": false}, {"data": [0.8613648748277077, 500, 1500, "S01_Browse_And_Checkout_T04_AddTableToCart"], "isController": true}, {"data": [0.8540718095485885, 500, 1500, "NavigateToChairs"], "isController": false}, {"data": [0.8613648748277077, 500, 1500, "AddTableToCart"], "isController": false}, {"data": [0.17355124683871317, 500, 1500, "OpenApplication"], "isController": false}, {"data": [0.8700477194540006, 500, 1500, "OpenCart"], "isController": false}, {"data": [0.8610799021875619, 500, 1500, "OpenChairProductCard"], "isController": false}, {"data": [0.8560316721006055, 500, 1500, "NavigateToTables"], "isController": false}, {"data": [0.8540718095485885, 500, 1500, "S01_Browse_And_Checkout_T05_NavigateToChairs"], "isController": true}, {"data": [0.8610799021875619, 500, 1500, "S01_Browse_And_Checkout_T06_OpenChairProductCard"], "isController": true}, {"data": [0.8659822730842589, 500, 1500, "S01_Browse_And_Checkout_T09_OpenCheckout"], "isController": true}, {"data": [0.8700477194540006, 500, 1500, "S01_Browse_And_Checkout_T08_OpenCart"], "isController": true}, {"data": [0.17444924347377286, 500, 1500, "S01_Browse_And_Checkout_T01_OpenApplication"], "isController": true}, {"data": [0.8517240292486132, 500, 1500, "OpenTableProductCard"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 213038, 6798, 3.190980012955435, 1803.6959274870949, 0, 10316, 301.5, 10001.0, 10009.0, 10015.0, 37.71496572710601, 1253.1632044868202, 35.05432821644635], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["S01_Browse_And_Checkout_T07_AddChairToCart", 14946, 157, 1.0504482804763817, 863.818680583434, 11, 10020, 41.0, 4132.200000000004, 7743.299999999999, 9607.650000000003, 2.6635040600348754, 1.8256260505947264, 2.345187502060536], "isController": true}, {"data": ["S01_Browse_And_Checkout_T11_SubmitOrder", 8774, 156, 1.777980396626396, 1047.6294734442688, 12, 10021, 177.0, 4385.0, 7969.5, 9838.25, 1.5680788192834734, 1.2921474519076626, 9.753865686415603], "isController": true}, {"data": ["S01_Browse_And_Checkout_T03_OpenTableProductCard", 31728, 497, 1.566439737771054, 997.0005673222346, 5, 10119, 105.0, 7417.9000000000015, 8875.700000000004, 10002.0, 5.622856073457241, 255.80311818088254, 4.0570754842686565], "isController": true}, {"data": ["OpenCheckout", 8913, 98, 1.0995175586222372, 925.310894199483, 9, 10018, 69.0, 4416.400000000005, 8030.099999999995, 9677.020000000004, 1.5924372007480327, 101.16218949663227, 1.1225246388474635], "isController": false}, {"data": ["AddChairToCart", 14946, 157, 1.0504482804763817, 863.8186136759002, 11, 10020, 41.0, 4132.200000000004, 7743.299999999999, 9607.650000000003, 2.663504534693991, 1.825626375936842, 2.3451879199929286], "isController": false}, {"data": ["S01_Browse_And_Checkout_T10_LoadStateDropdown", 8808, 29, 0.32924613987284285, 888.0431425976415, 15, 10016, 32.0, 4546.200000000008, 7959.0999999999985, 9592.099999999999, 1.573755869869972, 4.007945212507071, 1.1994079177381118], "isController": true}, {"data": ["S01_Browse_And_Checkout_T02_NavigateToTables", 32205, 449, 1.3941934482223257, 982.1079024996092, 8, 10030, 101.0, 7481.700000000004, 8904.95, 9961.990000000002, 5.703653366643165, 279.71150279156683, 3.9821789238208507], "isController": true}, {"data": ["LoadStateDropdown", 8808, 29, 0.32924613987284285, 888.0431425976415, 15, 10016, 32.0, 4546.200000000008, 7959.0999999999985, 9592.099999999999, 1.573756151058435, 4.007945928620653, 1.1994081320405174], "isController": false}, {"data": ["SubmitOrder", 8774, 156, 1.777980396626396, 1047.6291315249618, 12, 10021, 177.0, 4385.0, 7969.5, 9838.25, 1.5680964749284179, 1.292162000727751, 9.753975509204658], "isController": false}, {"data": ["S01_Browse_And_Checkout_T04_AddTableToCart", 31197, 402, 1.2885854409077795, 938.270122127125, 5, 10035, 45.0, 7255.0, 8790.0, 9815.980000000003, 5.534518224419685, 3.798706600525475, 4.721849093258504], "isController": true}, {"data": ["NavigateToChairs", 15374, 232, 1.5090412384545335, 999.6935085208759, 12, 10027, 89.0, 4967.0, 8122.75, 9808.5, 2.7351598807161444, 123.79091780401123, 1.9720350378312783], "isController": false}, {"data": ["AddTableToCart", 31197, 402, 1.2885854409077795, 938.269833637847, 5, 10035, 45.0, 7255.0, 8790.0, 9815.980000000003, 5.534520188127916, 3.7987079483485586, 4.721850768622746], "isController": false}, {"data": ["OpenApplication", 36773, 4476, 12.171974002665, 5841.642754194703, 13, 10316, 8772.0, 10007.0, 10012.0, 10016.0, 6.5100741241681614, 299.8845862293158, 2.9573542611217234], "isController": false}, {"data": ["OpenCart", 9011, 94, 1.0431694595494396, 904.0318499611609, 7, 10021, 64.0, 4369.200000000001, 7968.199999999997, 9642.639999999998, 1.6076829080523487, 60.30130885388854, 1.1576201896186253], "isController": false}, {"data": ["OpenChairProductCard", 15131, 171, 1.1301301962857708, 955.7760227347828, 5, 10020, 84.0, 4619.000000000055, 8029.199999999999, 9761.68, 2.695272789715106, 123.98025752287445, 1.942161009127696], "isController": false}, {"data": ["NavigateToTables", 32205, 449, 1.3941934482223257, 982.1078093463723, 8, 10030, 101.0, 7481.700000000004, 8904.95, 9961.990000000002, 5.703654376786543, 279.711552329767, 3.982179629083147], "isController": false}, {"data": ["S01_Browse_And_Checkout_T05_NavigateToChairs", 15374, 232, 1.5090412384545335, 999.6935735657568, 12, 10027, 89.0, 4967.0, 8122.75, 9808.5, 2.735158907502028, 123.79087375720083, 1.9720343361493218], "isController": true}, {"data": ["S01_Browse_And_Checkout_T06_OpenChairProductCard", 15131, 171, 1.1301301962857708, 955.7762210032383, 5, 10020, 84.0, 4619.000000000055, 8029.199999999999, 9761.68, 2.695271829501924, 123.98021335388424, 1.9421603172168038], "isController": true}, {"data": ["S01_Browse_And_Checkout_T09_OpenCheckout", 8913, 98, 1.0995175586222372, 925.3110063951523, 9, 10018, 69.0, 4416.400000000005, 8030.099999999995, 9677.020000000004, 1.5924366317240604, 101.16215334844955, 1.1225242377368712], "isController": true}, {"data": ["S01_Browse_And_Checkout_T08_OpenCart", 9011, 94, 1.0431694595494396, 904.0319609366354, 7, 10021, 64.0, 4369.200000000001, 7968.199999999997, 9642.639999999998, 1.6076826212202688, 60.30129809533052, 1.157619983083739], "isController": true}, {"data": ["S01_Browse_And_Checkout_T01_OpenApplication", 36813, 4476, 12.158748268274794, 5842.916524054046, 0, 10316, 8772.0, 10007.0, 10012.0, 10016.0, 6.5171208746853235, 299.8829935440441, 2.9573385546306556], "isController": true}, {"data": ["OpenTableProductCard", 31728, 497, 1.566439737771054, 997.0003466969193, 5, 10119, 105.0, 7417.9000000000015, 8875.700000000004, 10002.0, 5.6228570699435, 255.80316351447973, 4.057076203266248], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["The operation lasted too long: It took 10,005 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 8, 0.11768167107972934, 0.0037551986030661196], "isController": false}, {"data": ["The operation lasted too long: It took 10,018 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,037 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["The operation lasted too long: It took 10,056 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,154 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,043 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,075 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,011 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 6, 0.088261253309797, 0.00281639895229959], "isController": false}, {"data": ["The operation lasted too long: It took 10,062 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,030 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,038 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,012 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["The operation lasted too long: It took 10,019 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,006 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 6, 0.088261253309797, 0.00281639895229959], "isController": false}, {"data": ["The operation lasted too long: It took 10,076 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,050 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,063 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,045 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,026 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["The operation lasted too long: It took 10,074 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,007 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["The operation lasted too long: It took 10,055 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,036 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["Add Chair to Cart did not return the success confirmation", 96, 1.412180052956752, 0.04506238323679344], "isController": false}, {"data": ["The operation lasted too long: It took 10,017 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["The operation lasted too long: It took 10,178 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["Assertion failed", 5, 0.07355104442483083, 0.002346999126916325], "isController": false}, {"data": ["Add Table to Cart did not return the success confirmation", 273, 4.015887025595763, 0.12814615232963134], "isController": false}, {"data": ["The operation lasted too long: It took 10,020 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,065 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,316 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 8, 0.11768167107972934, 0.0037551986030661196], "isController": false}, {"data": ["The operation lasted too long: It took 10,009 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 5, 0.07355104442483083, 0.002346999126916325], "isController": false}, {"data": ["500/Internal Server Error", 1782, 26.21359223300971, 0.8364704888329781], "isController": false}, {"data": ["The operation lasted too long: It took 10,008 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["The operation lasted too long: It took 10,010 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 6, 0.088261253309797, 0.00281639895229959], "isController": false}, {"data": ["The operation lasted too long: It took 10,001 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 8, 0.11768167107972934, 0.0037551986030661196], "isController": false}, {"data": ["The operation lasted too long: It took 10,046 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,040 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,053 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,085 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,066 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,021 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,028 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,015 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,002 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 5, 0.07355104442483083, 0.002346999126916325], "isController": false}, {"data": ["The operation lasted too long: It took 10,150 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,073 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,099 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,041 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,022 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,107 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,048 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,003 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 4, 0.05884083553986467, 0.0018775993015330598], "isController": false}, {"data": ["The operation lasted too long: It took 10,035 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,067 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,016 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 4, 0.05884083553986467, 0.0018775993015330598], "isController": false}, {"data": ["Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 4405, 64.79847013827596, 2.067706230813282], "isController": false}, {"data": ["The operation lasted too long: It took 10,113 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,058 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 3, 0.0441306266548985, 0.001408199476149795], "isController": false}, {"data": ["The operation lasted too long: It took 10,032 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,087 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,070 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,090 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,077 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,049 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,013 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 6, 0.088261253309797, 0.00281639895229959], "isController": false}, {"data": ["The operation lasted too long: It took 10,096 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,137 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,033 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,059 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,004 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}, {"data": ["500", 32, 0.47072668431891734, 0.015020794412264478], "isController": false}, {"data": ["The operation lasted too long: It took 10,023 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,071 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,069 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,119 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["Expected 302 redirect after placing order", 41, 0.6031185642836129, 0.019245392840713863], "isController": false}, {"data": ["The operation lasted too long: It took 10,061 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, 0.014710208884966167, 4.6939982538326495E-4], "isController": false}, {"data": ["The operation lasted too long: It took 10,014 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 2, 0.029420417769932334, 9.387996507665299E-4], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 213038, 6798, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 4405, "500/Internal Server Error", 1782, "Add Table to Cart did not return the success confirmation", 273, "Add Chair to Cart did not return the success confirmation", 96, "Expected 302 redirect after placing order", 41], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["S01_Browse_And_Checkout_T07_AddChairToCart", 1, 1, "Assertion failed", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["OpenCheckout", 8913, 98, "500/Internal Server Error", 59, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 39, "", "", "", "", "", ""], "isController": false}, {"data": ["AddChairToCart", 14946, 157, "Add Chair to Cart did not return the success confirmation", 96, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 60, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 1, "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["LoadStateDropdown", 8808, 29, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 29, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["SubmitOrder", 8774, 156, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 72, "500/Internal Server Error", 43, "Expected 302 redirect after placing order", 41, "", "", "", ""], "isController": false}, {"data": ["S01_Browse_And_Checkout_T04_AddTableToCart", 12, 4, "Assertion failed", 4, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["NavigateToChairs", 15374, 232, "500/Internal Server Error", 126, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 105, "The operation lasted too long: It took 10,005 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, "", "", "", ""], "isController": false}, {"data": ["AddTableToCart", 31197, 402, "Add Table to Cart did not return the success confirmation", 273, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 126, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 2, "The operation lasted too long: It took 10,001 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, "", ""], "isController": false}, {"data": ["OpenApplication", 36773, 4476, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 3493, "500/Internal Server Error", 847, "The operation lasted too long: It took 10,001 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 7, "The operation lasted too long: It took 10,011 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 6, "The operation lasted too long: It took 10,010 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 6], "isController": false}, {"data": ["OpenCart", 9011, 94, "500/Internal Server Error", 57, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 35, "The operation lasted too long: It took 10,005 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, "The operation lasted too long: It took 10,002 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, "", ""], "isController": false}, {"data": ["OpenChairProductCard", 15131, 171, "500/Internal Server Error", 96, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 73, "The operation lasted too long: It took 10,005 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 1, "", ""], "isController": false}, {"data": ["NavigateToTables", 32205, 449, "500/Internal Server Error", 266, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 180, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 2, "The operation lasted too long: It took 10,006 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, "", ""], "isController": false}, {"data": ["S01_Browse_And_Checkout_T05_NavigateToChairs", 1, 1, "500", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["S01_Browse_And_Checkout_T08_OpenCart", 1, 1, "500", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["S01_Browse_And_Checkout_T01_OpenApplication", 140, 30, "500", 30, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["OpenTableProductCard", 31728, 497, "500/Internal Server Error", 288, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 193, "Non HTTP response code: org.apache.http.NoHttpResponseException/Non HTTP response message: localhost:80 failed to respond", 2, "The operation lasted too long: It took 10,005 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1, "The operation lasted too long: It took 10,018 milliseconds, but should not have lasted longer than 10,000 milliseconds.", 1], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
