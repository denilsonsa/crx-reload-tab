'use strict';

//////////////////////////////////////////////////////////////////////
// Convenience wraooer function.

function run_with_tabId_and_bgPage(callback) {
	chrome.tabs.query({currentWindow: true, active : true}, function(tabs) {
		chrome.runtime.getBackgroundPage(function(bgpage) {
			callback(tabs[0].id, bgpage);
		});
	});
}

//////////////////////////////////////////////////////////////////////
// Button handlers.

function preset_button_click_handler(ev) {
	run_with_tabId_and_bgPage(function(tab_id, bgpage) {
		var seconds = parseInt(ev.target.dataset.seconds, 10);
		bgpage.set_reload(tab_id, seconds);
		window.close();
	});
}

function stop_this_tab_button_click_handler(ev) {
	run_with_tabId_and_bgPage(function(tab_id, bgpage) {
		bgpage.clear_reload(tab_id);
		window.close();
	});
}

function stop_all_tabs_button_click_handler(ev) {
	run_with_tabId_and_bgPage(function(tab_id, bgpage) {
		bgpage.clear_all_reloads();
		window.close();
	});
}

function custom_form_submit_handler(ev) {
	ev.preventDefault();
	run_with_tabId_and_bgPage(function(tab_id, bgpage) {
		var days    = ev.target.days.valueAsNumber;
		var hours   = ev.target.hours.valueAsNumber;
		var minutes = ev.target.minutes.valueAsNumber;
		var seconds = ev.target.seconds.valueAsNumber;

		var total = ((days * 24 + hours) * 60 + minutes) * 60 + seconds;

		bgpage.set_reload(tab_id, total);
		window.close();
	});
	ev.stopPropagation();
	return false;
}

//////////////////////////////////////////////////////////////////////
// Fancy spinbox handling.
// Also posted at: http://codepen.io/denilsonsa/pen/ZGYEEp?editors=101

function custom_form_input_handler(ev) {
	var form = ev.currentTarget;

	if (form.seconds.valueAsNumber == -1) {
		if (form.minutes.valueAsNumber > 0 || form.hours.valueAsNumber > 0 || form.days.valueAsNumber > 0) {
			form.minutes.valueAsNumber--;
			form.seconds.valueAsNumber = 59;
		} else {
			form.seconds.valueAsNumber = 0;
		}
	} else if (form.seconds.valueAsNumber == 60) {
		form.minutes.valueAsNumber++;
		form.seconds.valueAsNumber = 0;
	}

	if (form.minutes.valueAsNumber == -1) {
		if (form.hours.valueAsNumber > 0 || form.days.valueAsNumber > 0) {
			form.hours.valueAsNumber--;
			form.minutes.valueAsNumber = 59;
		} else {
			form.minutes.valueAsNumber = 0;
		}
	} else if (form.minutes.valueAsNumber == 60) {
		form.hours.valueAsNumber++;
		form.minutes.valueAsNumber = 0;
	}

	if (form.hours.valueAsNumber == -1) {
		if (form.days.valueAsNumber > 0) {
			form.days.valueAsNumber--;
			form.hours.valueAsNumber = 23;
		} else {
			form.hours.valueAsNumber = 0;
		}
	} else if (form.hours.valueAsNumber == 24) {
		form.days.valueAsNumber++;
		form.hours.valueAsNumber = 0;
	}

	if (form.days.valueAsNumber == -1) {
		form.days.valueAsNumber = 0;
	}
}

//////////////////////////////////////////////////////////////////////
// Initialization.

function init() {
	run_with_tabId_and_bgPage(function(tab_id, bgpage) {
		var total_reloads = bgpage.get_how_many_reloads_are_active();
		var interval_seconds = bgpage.get_reload(tab_id);
		var interval = bgpage.split_seconds(interval_seconds);

		var total_reloads_string = total_reloads + ' tabs';
		if (total_reloads == 0) {
			total_reloads_string = 'No tabs';
		} else if (total_reloads == 1) {
			total_reloads_string = '1 tab';
		}
		document.getElementById('number_of_reloading_tabs').value = total_reloads_string;
		if (total_reloads > 1
		|| (total_reloads == 1 && interval_seconds == 0)) {
			document.getElementById('section_other').style.display = 'block';
		}

		if (interval_seconds > 0) {
			document.getElementById('section_this_tab').style.display = 'block';
		}

		var preset_buttons = document.querySelectorAll('input.preset_button');
		for (var i = 0; i < preset_buttons.length; i++) {
			var button = preset_buttons[i];
			if (button.dataset.seconds == interval_seconds) {
				button.classList.add('active');
				button.disabled = true;
			}
			button.addEventListener('click', preset_button_click_handler);
		}

		var custom = document.getElementById('custom_form');
		custom.addEventListener('submit', custom_form_submit_handler);
		custom.addEventListener('input', custom_form_input_handler);
		custom.days.value = interval.days;
		custom.hours.value = interval.hours;
		custom.minutes.value = interval.minutes;
		custom.seconds.value = interval.seconds;

		document.getElementById('stop_this_tab_button').addEventListener('click', stop_this_tab_button_click_handler);
		document.getElementById('stop_all_tabs_button').addEventListener('click', stop_all_tabs_button_click_handler);
	});
}

// This script is being included with the "defer" attribute, which means it
// will only be executed after the document has been parsed.
init();
