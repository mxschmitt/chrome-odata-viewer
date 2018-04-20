var deleteKey = require('key-del')

let removeQuotesIfExist = value => {
    let match = /^'(.*)'$/.exec(value)
    if (match) {
        return match[1]
    }
    return value
}

let unmarshalJSONIfPossible = data => {
    if (data === null) {
        return null
    }
    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            let tmp = data[i]
            data[i] = unmarshalJSONIfPossible(data[i])
            console.log(`Converted  ${tmp} to ${data[i]}`)
        }
        return data
    }
    switch (typeof data) {
        case "object":
            if (data.length === 3) {
                debugger
            }
            Object.keys(data).forEach(key => {
                let tmp = data[key]
                data[key] = unmarshalJSONIfPossible(data[key])
                console.log(`Converted  ${tmp} to ${data[key]}`)
            })
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
            let matchResponsePayload = rawResponseBody.match(/({.+})/g)
            if (!matchResponsePayload) {
                return
            }
            let matchRequestPayload = data.request.postData.text.match(/batch_(?:\w+-\w+-\w+)(.*?)(?:\n|\r\n){3}-/gs)
            if (!matchRequestPayload) {
                return
            }
            if (matchRequestPayload.length !== matchResponsePayload.length) {
                return
            }
            matchResponsePayload.forEach((responseBodyRaw, index) => {
                let name,
                    requestType,
                    requestData

                let matchFunctionCall = /GET (\w+)(?:\?|)(?:\(|)(.*)(?:\)|) HTTP/.exec(matchRequestPayload[index])
                let matchODataCall = /GET (\w+)\((.*')\)/.exec(matchRequestPayload[index])
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
                            value: decodeURIComponent(removeQuotesIfExist(item.split("=")[1]))
                        }))
                    }
                } else {
                    console.error(`could not determine request type: ${matchRequestPayload[index]}`)
                    return
                }

                let responseBody = JSON.parse(responseBodyRaw)
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
        })
    }
})

chrome.devtools.panels.create("OData Payload Inspector", null, "tab.html")