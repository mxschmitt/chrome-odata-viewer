var deleteKey = require('key-del')


// Extracted from 'https://sapui5.hana.ondemand.com/resources/sap/ui/thirdparty/datajs-dbg.js' to parse the OData requests
// #region

var batchMediaType = "multipart/mixed";
var responseStatusRegex = /^HTTP\/1\.\d (\d{3}) (.*)$/i;
var responseHeaderRegex = /^([^()<>@,;:\\"\/[\]?={} \t]+)\s?:\s?(.*)/;

var readLine = function (text, context) {
    /// <summary>
    /// Returns a substring from the position defined by the context up to the next line break (CRLF).
    /// </summary>
    /// <param name="text" type="String" optional="false">Input string.</param>
    /// <param name="context" optional="false">Context used for reading the input string.</param>
    /// <returns type="String">Substring to the first ocurrence of a line break or null if none can be found. </returns>

    return readTo(text, context, "\r\n");
};


var readTo = function (text, context, str) {
    /// <summary>
    /// Returns a substring from the position given by the context up to value defined by the str parameter and increments the position in the context.
    /// </summary>
    /// <param name="text" type="String" optional="false">Input string.</param>
    /// <param name="context" type="Object" optional="false">Context used for reading the input string.</param>
    /// <param name="str" type="String" optional="true">Substring to read up to.</param>
    /// <returns type="String">Substring to the first ocurrence of str or the end of the input string if str is not specified. Null if the marker is not found.</returns>

    var start = context.position || 0;
    var end = text.length;
    if (str) {
        end = text.indexOf(str, start);
        if (end === -1) {
            return null;
        }
        context.position = end + str.length;
    } else {
        context.position = end;
    }

    return text.substring(start, end);
};

var normalHeaders = {
    "accept": "Accept",
    "content-type": "Content-Type",
    "dataserviceversion": "DataServiceVersion",
    "maxdataserviceversion": "MaxDataServiceVersion",
    // ##### BEGIN: MODIFIED BY SAP
    "last-modified": "Last-Modified"
    // ##### END: MODIFIED BY SAP
};

var normalizeHeaders = function (headers) {
    /// <summary>Normalizes headers so they can be found with consistent casing.</summary>
    /// <param name="headers" type="Object">Dictionary of name/value pairs.</param>

    for (var name in headers) {
        var lowerName = name.toLowerCase();
        var normalName = normalHeaders[lowerName];
        if (normalName && name !== normalName) {
            var val = headers[name];
            delete headers[name];
            headers[normalName] = val;
        }
    }
};

var readHeaders = function (text, context) {
    /// <summary>
    /// Parses the http headers in the text from the position defined by the context.
    /// </summary>
    /// <param name="text" type="String" optional="false">Text containing an http response's headers</param>
    /// <param name="context">Context used for parsing.</param>
    /// <returns>Object containing the headers as key value pairs.</returns>
    /// <remarks>
    /// This function doesn't support split headers and it will stop reading when it hits two consecutive line breaks.
    /// </remarks>

    var headers = {};
    var parts;
    var line;
    var pos;

    do {
        pos = context.position;
        line = readLine(text, context);
        parts = responseHeaderRegex.exec(line);
        if (parts !== null) {
            headers[parts[1]] = parts[2];
        } else {
            // Whatever was found is not a header, so reset the context position.
            context.position = pos;
        }
    } while (line && parts);

    normalizeHeaders(headers);

    return headers;
};

var currentBoundary = function (context) {
    /// <summary>
    /// Gets the current boundary used for parsing the body of a multipart response.
    /// </summary>
    /// <param name="context">Context used for parsing a multipart response.</param>
    /// <returns type="String">Boundary string.</returns>

    var boundaries = context.boundaries;
    return boundaries[boundaries.length - 1];
};

var trimString = function (str) {
    /// <summary>Removes leading and trailing whitespaces from a string.</summary>
    /// <param name="str" type="String" optional="false" mayBeNull="false">String to trim</param>
    /// <returns type="String">The string with no leading or trailing whitespace.</returns>

    if (str.trim) {
        return str.trim();
    }

    return str.replace(/^\s+|\s+$/g, '');
};

var contentType = function (str) {
    /// <summary>Parses a string into an object with media type and properties.</summary>
    /// <param name="str" type="String">String with media type to parse.</param>
    /// <returns>null if the string is empty; an object with 'mediaType' and a 'properties' dictionary otherwise.</returns>

    if (!str) {
        return null;
    }

    var contentTypeParts = str.split(";");
    var properties = {};

    var i, len;
    for (i = 1, len = contentTypeParts.length; i < len; i++) {
        var contentTypeParams = contentTypeParts[i].split("=");
        properties[trimString(contentTypeParams[0])] = contentTypeParams[1];
    }

    return { mediaType: trimString(contentTypeParts[0]), properties: properties };
};

var readResponse = function (text, context, delimiter) {
    /// <summary>
    /// Parses an HTTP response.
    /// </summary>
    /// <param name="text" type="String" optional="false">Text representing the http response.</param>
    /// <param name="context" optional="false">Context used for parsing.</param>
    /// <param name="delimiter" type="String" optional="false">String used as delimiter of the multipart response parts.</param>
    /// <returns>Object representing the http response.</returns>

    // Read the status line.
    var pos = context.position;
    var match = responseStatusRegex.exec(readLine(text, context));

    var statusCode;
    var statusText;
    var headers;

    if (match) {
        statusCode = match[1];
        statusText = match[2];
        headers = readHeaders(text, context);
        readLine(text, context);
    } else {
        context.position = pos;
    }

    return {
        statusCode: statusCode,
        statusText: statusText,
        headers: headers,
        body: readTo(text, context, "\r\n" + delimiter)
    };
};

var partHandler = function (context) {
    /// <summary>
    /// Gets the handler for data serialization of individual requests / responses in a batch.
    /// </summary>
    /// <param name="context">Context used for data serialization.</param>
    /// <returns>Handler object.</returns>

    return context.handler.partHandler;
};

var readBatch = function (text, context) {
    /// <summary>
    /// Parses a multipart/mixed response body from from the position defined by the context.
    /// </summary>
    /// <param name="text" type="String" optional="false">Body of the multipart/mixed response.</param>
    /// <param name="context">Context used for parsing.</param>
    /// <returns>Array of objects representing the individual responses.</returns>

    var delimiter = "--" + currentBoundary(context);

    // Move beyond the delimiter and read the complete batch
    readTo(text, context, delimiter);

    // Ignore the incoming line
    readLine(text, context);

    // Read the batch parts
    var responses = [];
    var partEnd;

    while (partEnd !== "--" && context.position < text.length) {
        var partHeaders = readHeaders(text, context);
        var partContentType = contentType(partHeaders["Content-Type"]);

        if (partContentType && partContentType.mediaType === batchMediaType) {
            context.boundaries.push(partContentType.properties["boundary"]);
            try {
                var changeResponses = readBatch(text, context);
            } catch (e) {
                e.response = readResponse(text, context, delimiter);
                changeResponses = [e];
            }
            responses.push({ __changeResponses: changeResponses });
            context.boundaries.pop();
            readTo(text, context, "--" + currentBoundary(context));
        } else {
            if (!partContentType || partContentType.mediaType !== "application/http") {
                throw { message: "invalid MIME part type " };
            }
            // Skip empty line
            readLine(text, context);
            // Read the response
            var response = readResponse(text, context, delimiter);
            try {
                if (response.statusCode >= 200 && response.statusCode <= 299) {
                    partHandler(context.handlerContext).read(response, context.handlerContext);
                } else {
                    // Keep track of failed responses and continue processing the batch.
                    response = { message: "HTTP request failed", response: response };
                }
            } catch (e) {
                response = e;
            }

            responses.push(response);
        }

        partEnd = text.substr(context.position, 2);

        // Ignore the incoming line.
        readLine(text, context);
    }
    return responses;
};

// #endregion

chrome.devtools.network.onRequestFinished.addListener(data => {
    if (data.request.url.includes("$batch")) {
        let urlParser = document.createElement('a')
        urlParser.href = data.request.url
        data.getContent((responseContent, responseEncoding) => {
            let rawResponseBody = responseEncoding === "base64" ? atob(responseContent) : responseContent
            let requestBoundary = data.request.postData.text.match(/--(.*)/)
            if (!requestBoundary || requestBoundary.length !== 2) {
                console.error(`Request boundary length not 2: ${JSON.stringify(requestBoundary)}`)
                return
            }
            let requests = readBatch(data.request.postData.text, { boundaries: [requestBoundary[1]], handlerContext: { handler: { partHandler: { read: () => null } } } })
            let responseBoundary = rawResponseBody.match(/--(.*)/)
            if (!responseBoundary || responseBoundary.length !== 2) {
                console.error(`Request boundary length not 2: ${JSON.stringify(responseBoundary)}`)
                return
            }
            let responses = readBatch(rawResponseBody, { boundaries: [responseBoundary[1]], handlerContext: { handler: { partHandler: { read: () => null } } } })

            if (requests.length !== responses.length) {
                console.error(`Requests and Responses does not match: ${requests.length} ${responses.length}`)
                return
            }
            for (let i = 0; i < requests.length; i++) {
                let eventData = {
                    url: data.request.url,
                    path: urlParser.pathname,
                    name: "",
                    type: "",
                    request: {
                        data: null
                    },
                    response: {
                        data: JSON.parse(responses[i].body)
                    },
                    timestamp: new Date(data.startedDateTime).toTimeString().split(' ')[0]
                }
                try {
                    eventData.request.data = JSON.parse(requests[i].body)
                } catch(err) {
                    eventData.request.data = requests[i].body
                }
                if (eventData.response.data.d) {
                    eventData.response.data = eventData.response.data.d
                }
                eventData.response.data = deleteKey(eventData.response.data, "__metadata")
                eventData.response.data = deleteKey(eventData.response.data, "__deferred")

                console.debug("Sending message to the tab", eventData)
                chrome.runtime.sendMessage(eventData)
            }
        })
    }
})

chrome.devtools.panels.create("OData Payload Inspector", null, "dist/tab.html")