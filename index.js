/*
Interactive Tiers
Original code from: https://github.com/silverweed/tiers
Modified by: pinapelz
Licensed Under WTFPL
*/

'use strict';

const MAX_NAME_LEN = 200;
const DEFAULT_TIERS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
const TIER_COLORS = [
	'#ff6666',
	'#f0a731',
	'#f4d95b',
	'#66ff66',
	'#58c8f4',
	'#5b76f4',
	'#f45bed'
];

let unique_id = 0;

let unsaved_changes = false;

const LAYOUT_HORIZONTAL = 0;
const LAYOUT_VERTICAL = 1;
let cur_layout = LAYOUT_HORIZONTAL;

let all_headers = [];
let headers_orig_min_width;

let untiered_images;
let tierlist_div;
let dragged_image;
let dragged_item;
let drop_placeholder;

function reset_row(row) {
	row.querySelectorAll('span.item').forEach((item) => {
		for (let i = 0; i < item.children.length; ++i) {
			let img = item.children[i];
			item.removeChild(img);
			untiered_images.appendChild(img);
		}
		item.parentNode.removeChild(item);
	});
}

function hard_reset_list() {
	tierlist_div.innerHTML = '';
	untiered_images.innerHTML = '';
}

function soft_reset_list() {
	tierlist_div.querySelectorAll('.row').forEach(reset_row);
	unsaved_changes = true;
}

window.addEventListener('load', () => {
	untiered_images = document.querySelector('.images');
	tierlist_div = document.querySelector('.tierlist');

	for (let i = 0; i < DEFAULT_TIERS.length; ++i) {
		add_row(i, DEFAULT_TIERS[i]);
	}
	recompute_header_colors();

	headers_orig_min_width = all_headers[0][0].clientWidth;

	make_accept_drop(document.querySelector('.images'));

	bind_title_events();

	document.getElementById('load-img-input').addEventListener('input', (evt) => {
		let images = document.querySelector('.images');
		for (let file of evt.target.files) {
			let reader = new FileReader();
			reader.addEventListener('load', (load_evt) => {
				let img = create_img_with_src(load_evt.target.result);
				images.appendChild(img);
				unsaved_changes = true;
			});
			reader.readAsDataURL(file);
		}
	});

	document.onpaste = (evt) => {
		let clip_data = evt.clipboardData || evt.originalEvent.clipboardData;
		let items = clip_data.items;
		let images = document.querySelector('.images');
		for (let item of items) {
			if (item.kind === 'file') {
				let blob = item.getAsFile();
				let reader = new FileReader();
				reader.onload = (load_evt) => {
					let img = create_img_with_src(load_evt.target.result);
					images.appendChild(img);
					unsaved_changes = true;
				};
				reader.readAsDataURL(blob);
			}
		}
	};

	document.getElementById('reset-list-input').addEventListener('click', () => {
		if (confirm('Reset Tierlist? (this will place all images back in the pool)')) {
			soft_reset_list();
		}
	});

	document.getElementById('export-input').addEventListener('click', () => {
		let name = prompt('Please give a name to the file. This will export your tiers as a JSON file so you can continue working on it later');
		if (name) {
			save_tierlist(`${name}.json`);
		}
	});

	document.getElementById('export-input-html').addEventListener('click', () => {
		let name = prompt('This will export your tiers as a single interactive HTML file. Please give a name to the file');
		if (name) {
			save_tierlist_with_template(`${name}.html`);
		}
	});

	document.getElementById('import-input').addEventListener('input', (evt) => {
		if (!evt.target.files) {
			return;
		}
		let file = evt.target.files[0];
		let reader = new FileReader();
		reader.addEventListener('load', (load_evt) => {
			let raw = load_evt.target.result;
			let parsed = JSON.parse(raw);
			if (!parsed) {
				alert("Failed to parse data");
				return;
			}
			hard_reset_list();
			load_tierlist(parsed);
		});
		reader.readAsText(file);
	});

	bind_trash_events();
	bind_toggle_layout_events();

	window.addEventListener('beforeunload', (evt) => {
		if (!unsaved_changes) return null;
		var msg = "You have unsaved changes. Leave anyway?";
		(evt || window.event).returnValue = msg;
		return msg;
	});

	void try_load_tierlist_json();

	const modal = document.getElementById('image-modal');
	const modalImg = document.getElementById('modal-img');
	const modalTitle = document.getElementById('modal-title');
	const modalDesc = document.getElementById('modal-description');
	const modalSave = document.getElementById('modal-save');
	const modalClose = document.querySelector('.modal .close');
	let currentModalImage = null;

	function showModal(img) {
		currentModalImage = img;
		document.body.style.overflow = 'hidden';
		modal.style.display = 'flex';
		modalImg.src = img.src;
		modalTitle.value = img.dataset.title || '';
		modalDesc.value = img.dataset.description || '';
	}

	modalClose.addEventListener('click', () => {
		modal.style.display = 'none';
		document.body.style.overflow = 'hidden';
	});

	modalSave.addEventListener('click', () => {
		if (currentModalImage) {
			currentModalImage.dataset.title = modalTitle.value;
			currentModalImage.dataset.description = modalDesc.value;
		}
		modal.style.display = 'none';
		document.body.style.overflow = 'auto';
	});

	window.addEventListener('click', (evt) => {
		if (evt.target == modal) {
			modal.style.display = 'none';
			document.body.style.overflow = 'auto';
		}
	});

	tierlist_div.addEventListener('click', (evt) => {
		if (evt.target.tagName.toUpperCase() === 'IMG') {
			showModal(evt.target);
		}
	});
});

function create_img_with_src(src) {
	let img = document.createElement('img');
	img.src = src;
	img.style.userSelect = 'none';
	img.classList.add('draggable');
	img.draggable = true;

	img.addEventListener("dragstart", (evt) => {
		evt.dataTransfer.setData("text/plain", '');
		evt.dataTransfer.effectAllowed = 'move';
		dragged_image = evt.target;
		dragged_item = wrap_image_in_item(dragged_image);
		dragged_image.classList.add("dragged");

		drop_placeholder = document.createElement('span');
		drop_placeholder.classList.add('item', 'drop-placeholder');
		let rect = dragged_item.getBoundingClientRect();
		drop_placeholder.style.width = `${Math.max(30, Math.ceil(rect.width))}px`;
		drop_placeholder.style.height = `${Math.max(30, Math.ceil(rect.height))}px`;
	});

	img.addEventListener("mouseenter", (evt) => {
        const title = evt.target.dataset.title;
        if (title) {
            evt.target.title = title;
        }
    });
	
	img.addEventListener("dragend", () => {
		if (dragged_image) {
			dragged_image.classList.remove("dragged");
		}
		if (drop_placeholder && drop_placeholder.parentNode) {
			drop_placeholder.parentNode.removeChild(drop_placeholder);
		}
		dragged_image = null;
		dragged_item = null;
		drop_placeholder = null;
	});

	return img;
}


function save(filename, text) {
	unsaved_changes = false;

	var el = document.createElement('a');
	el.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(text));
	el.setAttribute('download', filename);
	el.style.display = 'none';
	document.body.appendChild(el);
	el.click();
	document.body.removeChild(el);
}

function save_tierlist(filename) {
	let serialized_tierlist = {
		title: document.querySelector('.title-label').innerText,
		rows: [],
	};
	tierlist_div.querySelectorAll('.row').forEach((row, i) => {
		serialized_tierlist.rows.push({
			name: row.querySelector('.header label').innerText.substr(0, MAX_NAME_LEN)
		});
		serialized_tierlist.rows[i].imgs = [];
		row.querySelectorAll('img').forEach((img) => {
			serialized_tierlist.rows[i].imgs.push({
				src: img.src,
				title: img.dataset.title || '',
				description: img.dataset.description || ''
			});
		});
	});

	let untiered_imgs = document.querySelectorAll('.images img');
	if (untiered_imgs.length > 0) {
		serialized_tierlist.untiered = [];
		untiered_imgs.forEach((img) => {
			serialized_tierlist.untiered.push({
				src: img.src,
				title: img.dataset.title || '',
				description: img.dataset.description || ''
			});
		});
	}

	save(filename, JSON.stringify(serialized_tierlist));
}
async function save_tierlist_with_template(filename) {
    let serialized_tierlist = {
        title: document.querySelector('.title-label').innerText,
        rows: []
    };

    tierlist_div.querySelectorAll('.row').forEach((row, i) => {
        serialized_tierlist.rows.push({
            name: row.querySelector('.header').innerText.substr(0, MAX_NAME_LEN)
        });
        serialized_tierlist.rows[i].imgs = [];
        row.querySelectorAll('img').forEach((img) => {
            serialized_tierlist.rows[i].imgs.push({
                src: img.src,
                title: img.dataset.title || '',
                description: img.dataset.description || ''
            });
        });
    });

    let untiered_imgs = document.querySelectorAll('.images img');
    if (untiered_imgs.length > 0) {
        serialized_tierlist.untiered = [];
        untiered_imgs.forEach((img) => {
            serialized_tierlist.untiered.push({
                src: img.src,
                title: img.dataset.title || '',
                description: img.dataset.description || ''
            });
        });
    }

    try {
        // Fetch resources
        let [templateResponse, jsResponse, cssResponse] = await Promise.all([
            fetch('tiers.html'),
            fetch('tiers.js'),
            fetch('tiers.css')
        ]);

        let [templateHTML, scriptContent, styleContent] = await Promise.all([
            templateResponse.text(),
            jsResponse.text(),
            cssResponse.text()
        ]);

        // Inject the EMBEDDED_JSON inside a script tag
        let jsonScript = `<script>
            const EMBEDDED_JSON = ${JSON.stringify(serialized_tierlist, null, 4)};
        </script>`;

        let inlineScript = `<script>\n${scriptContent}\n</script>`;
        let inlineCSS = `<style>\n${styleContent}\n</style>`;
		let inlineTitle = `<title>${serialized_tierlist.title}</title>`;

		templateHTML = templateHTML.replace("<title>Interactive Tiers</title>", inlineTitle);
        templateHTML = templateHTML.replace("</head>", inlineCSS + "\n</head>");
        let updatedHTML = templateHTML.replace("</body>", jsonScript + "\n" + inlineScript + "\n</body>");
        save(filename, updatedHTML);
    } catch (e) {
        console.error("Error fetching resources:", e);
    }
}



function load_tierlist(serialized_tierlist) {
	document.querySelector('.title-label').innerText = serialized_tierlist.title;
	for (let idx in serialized_tierlist.rows) {
		let ser_row = serialized_tierlist.rows[idx];
		let elem = add_row(idx, ser_row.name);

		for (let img_obj of ser_row.imgs ?? []) {
			let img = create_img_with_src(img_obj.src);
			img.dataset.title = img_obj.title || '';
			img.dataset.description = img_obj.description || '';
			let td = document.createElement('span');
			td.classList.add('item');
			td.appendChild(img);
			let items_container = elem.querySelector('.items');
			items_container.appendChild(td);
		}

		elem.querySelector('label').innerText = ser_row.name;
	}
	recompute_header_colors();

	if (serialized_tierlist.untiered) {
		let images = document.querySelector('.images');
		for (let img_obj of serialized_tierlist.untiered) {
			let img = create_img_with_src(img_obj.src);
			img.dataset.title = img_obj.title || '';
			img.dataset.description = img_obj.description || '';
			images.appendChild(img);
		}
	}

	resize_headers();

	unsaved_changes = false;
}

function end_drag() {
	if (dragged_image) {
		dragged_image.classList.remove("dragged");
	}
	if (drop_placeholder && drop_placeholder.parentNode) {
		drop_placeholder.parentNode.removeChild(drop_placeholder);
	}
	dragged_image = null;
	dragged_item = null;
	drop_placeholder = null;
}

window.addEventListener('mouseup', end_drag);
window.addEventListener('dragend', end_drag);


function wrap_image_in_item(img) {
	let parent = img.parentNode;
	if (parent && parent.tagName.toUpperCase() === 'SPAN' && parent.classList.contains('item')) {
		return parent;
	}

	let wrapper = document.createElement('span');
	wrapper.classList.add('item');
	parent.insertBefore(wrapper, img);
	wrapper.appendChild(img);
	return wrapper;
}

function get_drop_container(elem) {
	let items_container = elem.querySelector('.items');
	return items_container || elem;
}

function get_drop_reference(container, x, y) {
	let children = Array.from(container.children).filter((child) => {
		if (child === dragged_item || child === drop_placeholder) return false;
		if (child.classList && child.classList.contains('item')) return true;
		return child.tagName && child.tagName.toUpperCase() === 'IMG';
	});

	for (let child of children) {
		let rect = child.getBoundingClientRect();
		if (y < rect.top) {
			return child;
		}
		if (y <= rect.bottom && x < rect.left + rect.width / 2) {
			return child;
		}
	}

	return null;
}

function make_accept_drop(elem) {
	elem.classList.add('droppable');

	elem.addEventListener('dragenter', (evt) => {
		evt.preventDefault();
		elem.classList.add('drag-entered');
	});

	elem.addEventListener('dragleave', (evt) => {
		if (elem.contains(evt.relatedTarget)) {
			return;
		}
		elem.classList.remove('drag-entered');
	});

	elem.addEventListener('dragover', (evt) => {
		evt.preventDefault();
		if (!dragged_item || !drop_placeholder) {
			return;
		}

		let items_container = get_drop_container(elem);
		let reference = get_drop_reference(items_container, evt.clientX, evt.clientY);
		if (reference) {
			items_container.insertBefore(drop_placeholder, reference);
		} else {
			items_container.appendChild(drop_placeholder);
		}
	});

	elem.addEventListener('drop', (evt) => {
		evt.preventDefault();
		elem.classList.remove('drag-entered');
		if (!dragged_item) {
			return;
		}

		let items_container = get_drop_container(elem);
		if (drop_placeholder && drop_placeholder.parentNode === items_container) {
			items_container.insertBefore(dragged_item, drop_placeholder);
			drop_placeholder.parentNode.removeChild(drop_placeholder);
		} else {
			let reference = get_drop_reference(items_container, evt.clientX, evt.clientY);
			if (reference) {
				items_container.insertBefore(dragged_item, reference);
			} else {
				items_container.appendChild(dragged_item);
			}
		}

		if (dragged_image) {
			dragged_image.classList.remove("dragged");
		}
		dragged_image = null;
		dragged_item = null;
		drop_placeholder = null;
		unsaved_changes = true;
	});
}


function enable_edit_on_click(container, input, label) {
	function change_label(evt) {
		input.style.display = 'none';
		label.innerText = input.value;
		label.style.display = 'inline';
		unsaved_changes = true;
	}

	input.addEventListener('change', change_label);
	input.addEventListener('focusout', change_label);

	container.addEventListener('click', (evt) => {
		label.style.display = 'none';
		input.value = label.innerText.substr(0, MAX_NAME_LEN);
		input.style.display = 'inline';
		input.select();
	});
}

function bind_title_events() {
	let title_label = document.querySelector('.title-label');
	let title_input = document.getElementById('title-input');
	let title = document.querySelector('.title');

	enable_edit_on_click(title, title_input, title_label);
}

function create_label_input(row, row_idx, row_name) {
	let input = document.createElement('input');
	input.id = `input-tier-${unique_id++}`;
	input.type = 'text';
	input.addEventListener('change', resize_headers);
	let label = document.createElement('label');
	label.htmlFor = input.id;
	label.innerText = row_name;

	let header = row.querySelector('.header');
	all_headers.splice(row_idx, 0, [header, input, label]);
	header.appendChild(label);
	header.appendChild(input);

	enable_edit_on_click(header, input, label);
}

function resize_headers() {
	let max_width = headers_orig_min_width;
	for (let [other_header, _i, label] of all_headers) {
		max_width = Math.max(max_width, label.clientWidth);
	}

	for (let [other_header, _i2, _l2] of all_headers) {
		other_header.style.minWidth = `${max_width}px`;
	}
}

function add_row(index, name) {
	let div = document.createElement('div');
	let header = document.createElement('span');
	let items = document.createElement('span');
	div.classList.add('row');
	header.classList.add('header');
	items.classList.add('items');
	div.appendChild(header);
	div.appendChild(items);
	let row_buttons = document.createElement('div');
	row_buttons.classList.add('row-buttons');
	let btn_plus_up = document.createElement('input');
	btn_plus_up.type = "button";
	btn_plus_up.value = '+';
	btn_plus_up.title = "Add row above";
	btn_plus_up.addEventListener('click', (evt) => {
		let parent_div = evt.target.parentNode.parentNode;
		let rows = Array.from(tierlist_div.children);
		let idx = rows.indexOf(parent_div);
		console.assert(idx >= 0);
		add_row(idx, '');
		recompute_header_colors();
	});
	let btn_rm = document.createElement('input');
	btn_rm.type = "button";
	btn_rm.value = '-';
	btn_rm.title = "Remove row";
	btn_rm.addEventListener('click', (evt) => {
		let rows = Array.from(tierlist_div.querySelectorAll('.row'));
		if (rows.length < 2) return;
		let parent_div = evt.target.parentNode.parentNode;
		let idx = rows.indexOf(parent_div);
		console.assert(idx >= 0);
		if (rows[idx].querySelectorAll('img').length === 0 ||
			confirm(`Remove tier ${rows[idx].querySelector('.header label').innerText}? (This will move back all its content to the untiered pool)`)) {
			rm_row(idx);
		}
		recompute_header_colors();
	});
	let btn_plus_down = document.createElement('input');
	btn_plus_down.type = "button";
	btn_plus_down.value = '+';
	btn_plus_down.title = "Add row below";
	btn_plus_down.addEventListener('click', (evt) => {
		let parent_div = evt.target.parentNode.parentNode;
		let rows = Array.from(tierlist_div.children);
		let idx = rows.indexOf(parent_div);
		console.assert(idx >= 0);
		add_row(idx + 1, name);
		recompute_header_colors();
	});
	row_buttons.appendChild(btn_plus_up);
	row_buttons.appendChild(btn_rm);
	row_buttons.appendChild(btn_plus_down);
	div.appendChild(row_buttons);

	let rows = tierlist_div.children;
	if (index === rows.length) {
		tierlist_div.appendChild(div);
	} else {
		let nxt_child = rows[index];
		tierlist_div.insertBefore(div, nxt_child);
	}

	make_accept_drop(div);
	create_label_input(div, index, name);

	return div;
}

function rm_row(idx) {
	let row = tierlist_div.children[idx];
	reset_row(row);
	tierlist_div.removeChild(row);
}

function recompute_header_colors() {
	tierlist_div.querySelectorAll('.row').forEach((row, row_idx) => {
		let color = TIER_COLORS[row_idx % TIER_COLORS.length];
		row.querySelector('.header').style.backgroundColor = color;
	});
}

function bind_trash_events() {
	let trash = document.getElementById('trash');
	trash.classList.add('droppable');
	trash.addEventListener('dragenter', (evt) => {
		evt.preventDefault();
		evt.target.src = 'img/trash-2.svg';
	});
	trash.addEventListener('dragexit', (evt) => {
		evt.preventDefault();
		evt.target.src = 'img/trash.svg';
	});
	trash.addEventListener('dragover', (evt) => {
		evt.preventDefault();
	});
	trash.addEventListener('drop', (evt) => {
		evt.preventDefault();
		evt.target.src = 'img/trash.svg';
		if (!dragged_item && !dragged_image) {
			return;
		}

		if (drop_placeholder && drop_placeholder.parentNode) {
			drop_placeholder.parentNode.removeChild(drop_placeholder);
		}

		if (dragged_item) {
			dragged_item.remove();
		} else if (dragged_image) {
			dragged_image.remove();
		}

		if (dragged_image) {
			dragged_image.classList.remove('dragged');
		}
		dragged_image = null;
		dragged_item = null;
		drop_placeholder = null;
		unsaved_changes = true;
	});
}

function bind_toggle_layout_events() {
	let toggle = document.getElementById('toggle-layout');
	toggle.addEventListener('click', () => {
		set_layout((cur_layout + 1) % 2);
	});
}

function set_layout(layout) {
	let main = document.getElementsByClassName("main-content")[0];
	if (layout === LAYOUT_VERTICAL) {
		main.classList.add("vertical");
	} else {
		main.classList.remove("vertical");
	}
	cur_layout = layout;
}

function is_url(str) {
	try {
		new URL(str);
		return true;
	} catch (e) {
		return false;
	}
}

async function try_load_tierlist_json() {
	const load_from_url = new URLSearchParams(window.location.search).get('url');
	if (load_from_url !== null && is_url(load_from_url)) {
		try {
			let result = await fetch(load_from_url);
			result = await result.json();
			hard_reset_list();
			load_tierlist(result);
		} catch (e) { console.error(e); }
	}
}
