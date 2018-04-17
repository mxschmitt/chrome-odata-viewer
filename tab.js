var JSONTreeView = require('json-tree-view');

let store = []
let showItem = index => {
    let currentItem = store[index]
    $(".modal > .header").text(currentItem.path)
    var view = new JSONTreeView("example", currentItem.body)
    view.expand(true);

    $(".modal > .content").html(view.dom)
    view.readonly = true
    $('.fullscreen.modal').modal('show');
}
$(document).ready(() => {
    console.log("Initialized tab view")
    let viewTable = $("#view-table")
    chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
        store.push(data)
        viewTable.find("tbody").append(`<tr>
            <td>${data.path}</td>
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