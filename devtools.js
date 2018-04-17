var deleteKey = require('key-del')

let removeQuotesIfExist = value => {
    let match = /^'(.*)'$/.exec(value)
    if (match) {
        return match[1]
    }
    return value
}

chrome.devtools.network.onRequestFinished.addListener(data => {
    if (data.request.url.includes("$batch")) {
        let urlParser = document.createElement('a')
        urlParser.href = data.request.url
        data.getContent((responseContent, responseEncoding) => {
            let rawResponseBody = responseEncoding === "base64" ? atob(responseContent) : responseContent
            let matchPayload = /({.*})/.exec(rawResponseBody)
            if (matchPayload.length == 0) {
                return
            }
            let name,
                kind,
                requestData
            let matchFunctionCall = /GET (\w+)\?(.*) HTTP/.exec(data.request.postData.text)
            if (matchFunctionCall) {
                kind = "Function Call"
                name = matchFunctionCall[1]
                requestData = matchFunctionCall[2].split("&").map(item => ({
                    key: item.split("=")[0],
                    value: removeQuotesIfExist(item.split("=")[1])
                }));
            }
            let matchOdataCall = /GET (\w+)\((.*')\)/.exec(data.request.postData.text)
            if (matchOdataCall) {
                kind = "oData read"
                name = matchOdataCall[1]
                requestData = matchOdataCall[2].split(",").map(item => ({
                    key: item.split("=")[0],
                    value: removeQuotesIfExist(item.split("=")[1])
                }))
            }
            let responseBody = JSON.parse(matchPayload[0])
            if ('d' in responseBody) {
                responseBody = responseBody.d
            }
            responseBody = deleteKey(responseBody, "__metadata")
            let eventData = {
                path: urlParser.pathname,
                responseBody: responseBody,
                requestData: requestData,
                kind: kind,
                name: name,
                timestamp: data.startedDateTime
            }
            console.debug("Sending message to the ui5 tab", eventData)
            chrome.runtime.sendMessage(eventData)
        })
    }
})

chrome.devtools.panels.create("oData Inspector", null, "tab.html")