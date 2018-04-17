chrome.devtools.network.onRequestFinished.addListener(data => {
    if (data.request.url.includes("$batch")) {
        let urlParser = document.createElement('a')
        urlParser.href = data.request.url
        data.getContent((content, encoding) => {
            let rawBody = encoding === "base64" ? atob(content) : content
            let match = /({.*})/.exec(rawBody)
            if (match.length == 0) {
                return
            }
            let body = JSON.parse(match[0])
            if ('d' in body) {
                body = body.d
            }
            let eventData = {
                path: urlParser.pathname,
                body: body,
                timestamp: data.startedDateTime
            }
            console.debug("Sending message to the ui5 tab", eventData)
            chrome.runtime.sendMessage(eventData)
        })
    }
})

chrome.devtools.panels.create("oData Inspector", null, "tab.html")