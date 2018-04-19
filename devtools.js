var deleteKey = require('key-del')

let removeQuotesIfExist = value => {
    let match = /^'(.*)'$/.exec(value)
    if (match) {
        return match[1]
    }
    return value
}

let unmarshalJSONIfPossible = data => {
    switch (typeof data) {
        case "object":
            Object.keys(data).forEach(key => {
                data[key] = unmarshalJSONIfPossible(data[key])
            })
            break

        case "array":
            for (let i = 0; i < data.length; data++) {
                data[i] = unmarshalJSONIfPossible(data[i])
            }
            break
        case "number":
        case "boolean":
            break
        case "string":
            let tmp;
            try {
                tmp = JSON.parse(decodeURIComponent(escape(data)))
            } catch (err) { }
            if (tmp) {
                data = unmarshalJSONIfPossible(tmp)
            } else {
                let decodedData
                try {
                    decodedData = decodeURIComponent(escape(data))
                } catch (err) { }
                if (decodedData) {
                    data = decodedData
                }
            }
        default:
            break
    }
    return data
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
            let matchODataCall = /GET (\w+)\((.*')\)/.exec(data.request.postData.text)
            if (matchODataCall) {
                requestType = "OData Read"
                name = matchODataCall[1]
                requestData = matchODataCall[2].split(",").map(item => ({
                    key: item.split("=")[0],
                    value: removeQuotesIfExist(item.split("=")[1])
                }))
            } else if (matchFunctionCall) {
                requestType = "Function Import"
                name = matchFunctionCall[1]
                if (matchFunctionCall[2]) {
                    requestData = matchFunctionCall[2].split("&").map(item => ({
                        key: item.split("=")[0],
                        value: removeQuotesIfExist(item.split("=")[1])
                    }))
                }
            } else {
                console.error(`could not determine request type: ${data.request.postData.text}`)
                return
            }

            let responseBody = JSON.parse(matchPayload[0])
            if ('d' in responseBody) {
                responseBody = responseBody.d
            }
            responseBody = deleteKey(responseBody, "__metadata")
            responseBody = deleteKey(responseBody, "__deferred")
            responseBody = unmarshalJSONIfPossible(responseBody)
            requestData = unmarshalJSONIfPossible(requestData)
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