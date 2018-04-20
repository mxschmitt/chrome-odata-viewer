var JSONTreeView = require("json-tree-view")
var toastr = require("toastr")

let store = []

const copyToClipboard = str => {
    const el = document.createElement('textarea');  // Create a <textarea> element
    el.value = str;                                 // Set its value to the string that you want copied
    el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
    el.style.position = 'absolute';
    el.style.left = '-9999px';                      // Move outside the screen to make it invisible
    document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
    const selected =
        document.getSelection().rangeCount > 0        // Check if there is any content selected previously
            ? document.getSelection().getRangeAt(0)     // Store selection if found
            : false;                                    // Mark as false to know no selection existed before
    el.select();                                    // Select the <textarea> content
    document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el);                  // Remove the <textarea> element
    if (selected) {                                 // If a selection existed before copying
        document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
        document.getSelection().addRange(selected);   // Restore the original selection
    }
}

let onTreeTableClick = (self, key, value) => {
    if (typeof value === "object") {
        copyToClipboard(JSON.stringify(value, "", "    "))
    } else {
        copyToClipboard(value)
    }
    toastr.success("Copied selected node to clipboard")
}

let showItem = index => {
    let currentItem = store[index]
    $(".modal > .header").text(`${currentItem.requestType}: ${currentItem.name} (${currentItem.path})`)

    if (currentItem.requestData) {
        var requestJSONTree = new JSONTreeView("Payload", currentItem.requestData)
        requestJSONTree.expand(true)
        requestJSONTree.on("click", onTreeTableClick)
        $(".modal > .content > div > div:nth-child(1) > div").html(requestJSONTree.dom)
        requestJSONTree.readonly = true
    }
    var responseJSONTree = new JSONTreeView("Payload", currentItem.responseBody)
    responseJSONTree.expand(true)
    $(".modal > .content > div > div:nth-child(2) > div").html(responseJSONTree.dom)
    responseJSONTree.readonly = true
    responseJSONTree.on("click", onTreeTableClick)

    $(".fullscreen.modal").modal("show")
}

let clearTable = () => {
    store = []
    $("#view-table tbody").empty()
}

$(document).ready(() => {
    $("#clear-button").click(() => {
        clearTable()
    })
    if (chrome.devtools.panels.themeName === "dark") {
        $("body").toggleClass("ui inverted")
        $(".add-inverted").toggleClass("inverted")
        $("#view-table").toggleClass("inverted")
    }
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