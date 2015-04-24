'use strict';

function foo(ev) {
	chrome.tabs.query({currentWindow: true, active : true}, function(tabs) {
		chrome.runtime.getBackgroundPage(function(bgpage) {
			bgpage.set_reload(tabs[0].id, parseInt(document.getElementById('therange').value, 10));
		});
	});
}

document.getElementById('thebutton').addEventListener('click', foo);
