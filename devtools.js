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
            data[i] = unmarshalJSONIfPossible(data[i])
        }
        return data
    }
    switch (typeof data) {
        case "object":
            Object.keys(data).forEach(key => {
                data[key] = unmarshalJSONIfPossible(data[key])
            })
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
                let eventData = {
                    path: urlParser.pathname,
                    name: name,
                    type: null,
                    request: {
                        data: null
                    },
                    response: {
                        data: null
                    },
                    timestamp: new Date(data.startedDateTime).toTimeString().split(' ')[0]
                }
                let matchFunctionCall = /GET (\w+)(?:\?|)(?:\(|)(.*)(?:\)|) HTTP/.exec(matchRequestPayload[index])
                let matchODataCall = /GET (\w+)\((.*')\)/.exec(matchRequestPayload[index])
                if (matchODataCall) {
                    eventData.type = "OData Read"
                    eventData.name = matchODataCall[1]
                    eventData.request.data = matchODataCall[2].split(",").map(item => ({
                        key: item.split("=")[0],
                        value: removeQuotesIfExist(item.split("=")[1])
                    }))
                } else if (matchFunctionCall) {
                    eventData.type = "Function Import"
                    eventData.name = matchFunctionCall[1]
                    if (matchFunctionCall[2]) {
                        eventData.request.data = matchFunctionCall[2].split("&").map(item => ({
                            key: item.split("=")[0],
                            value: decodeURIComponent(removeQuotesIfExist(item.split("=")[1]))
                        }))
                    }
                } else {
                    console.error(`could not determine request type: ${matchRequestPayload[index]}`)
                    return
                }

                eventData.response.data = JSON.parse(responseBodyRaw)
                if ('d' in eventData.response.data) {
                    eventData.response.data = eventData.response.data.d
                }

                eventData.response.data = deleteKey(eventData.response.data, "__metadata")
                eventData.response.data = deleteKey(eventData.response.data, "__deferred")

                eventData.response.data = unmarshalJSONIfPossible(eventData.response.data)
                eventData.request.data = unmarshalJSONIfPossible(eventData.request.data)

                console.debug("Sending message to the tab", eventData)
                chrome.runtime.sendMessage(eventData)
            })
        })
    }
})

chrome.devtools.panels.create("OData Payload Inspector", null, "tab.html")