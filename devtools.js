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
            if (!matchPayload) {
                return
            }
            let name,
                requestType,
                requestData
            let matchFunctionCall = /GET (\w+)(?:\?|)(?:\(|)(.*)(?:\)|) HTTP/.exec(data.request.postData.text)
            if (matchFunctionCall) {
                requestType = "Function Import"
                name = matchFunctionCall[1]
                if (matchFunctionCall[2]) {
                    requestData = matchFunctionCall[2].split("&").map(item => ({
                        key: item.split("=")[0],
                        value: removeQuotesIfExist(item.split("=")[1])
                    }))
                }
            }
            let matchODataCall = /GET (\w+)\((.*')\)/.exec(data.request.postData.text)
            if (matchODataCall) {
                requestType = "OData Read"
                name = matchODataCall[1]
                requestData = matchODataCall[2].split(",").map(item => ({
                    key: item.split("=")[0],
                    value: removeQuotesIfExist(item.split("=")[1])
                }))
            }
            let responseBody = JSON.parse(matchPayload[0])
            if ('d' in responseBody) {
                responseBody = responseBody.d
            }
            responseBody = deleteKey(responseBody, "__metadata")
            responseBody = deleteKey(responseBody, "__deferred")
            let eventData = {
                path: urlParser.pathname,
                responseBody: responseBody,
                requestData: requestData,
                requestType: requestType,
                name: name,
                timestamp: new Date(data.startedDateTime).toTimeString().split(' ')[0]
            }
            console.debug("Sending message to the tab", eventData)
            chrome.runtime.sendMessage(eventData)
        })
    }
})

chrome.devtools.panels.create("OData Payload Inspector", null, "tab.html")