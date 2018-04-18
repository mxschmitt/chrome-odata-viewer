var JSONTreeView = require('json-tree-view');

let store = []

let showItem = index => {
    let currentItem = store[index]
    $(".modal > .header").text(`${currentItem.requestType}: ${currentItem.name} (${currentItem.path})`)

    if (currentItem.requestData) {
        var requestJSONTree = new JSONTreeView("Payload", currentItem.requestData)
        requestJSONTree.expand(true);
        $(".modal > .content > div > div:nth-child(1) > div").html(requestJSONTree.dom)
        requestJSONTree.readonly = true
    }
    var responseJSONTree = new JSONTreeView("Payload", currentItem.responseBody)
    responseJSONTree.expand(true);
    $(".modal > .content > div > div:nth-child(2) > div").html(responseJSONTree.dom)
    responseJSONTree.readonly = true

    $('.fullscreen.modal').modal('show');
}

$(document).ready(() => {
    let viewTable = $("#view-table")
    chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
        store.unshift(data)
        viewTable.find("tbody").prepend(`<tr>
            <td>${data.path}</td>
            <td>${data.requestType}</td>
            <td>${data.name}</td>
            <td>${data.timestamp}</td>
        </tr>`)
        let tableRows = viewTable.find("tr")
        tableRows.unbind("click")
        tableRows.click(e => {
            let index = $(e.target).closest("tr").index()
            showItem(index)
        })
        sendResponse(true)
    })
})