var JSONTreeView = require('json-tree-view');

let store = []
let showItem = index => {
    let currentItem = store[index]
    $(".modal > .header").text(currentItem.path)
    var requestJSONTree = new JSONTreeView("example", currentItem.requestData)
    requestJSONTree.expand(true);
    $(".modal > .content > div > div:nth-child(1) > div").html(requestJSONTree.dom)
    requestJSONTree.readonly = true
    var responseJSONTree = new JSONTreeView("example", currentItem.responseBody)
    responseJSONTree.expand(true);
    $(".modal > .content > div > div:nth-child(2) > div").html(responseJSONTree.dom)
    responseJSONTree.readonly = true
    $('.fullscreen.modal').modal('show');
}
$(document).ready(() => {
    console.log("Initialized tab view")
    let viewTable = $("#view-table")
    chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
        store.push(data)
        viewTable.find("tbody").append(`<tr>
            <td>${data.path}</td>
            <td>${data.kind}</td>
            <td>${data.name}</td>
            <td>${data.timestamp}</td>
        </tr>`)
        console.log(`Received data ${data.path} in the tab view`)
        let tableRows = viewTable.find("tr")
        tableRows.unbind("click")
        tableRows.click(e => {
            let index = $(e.target).closest("tr").index()
            showItem(index)
        })
    })
})