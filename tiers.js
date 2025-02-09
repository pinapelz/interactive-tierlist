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
let tierlist_div;

window.addEventListener('load', () => {
	tierlist_div = document.querySelector('.tierlist');

	for (let i = 0; i < DEFAULT_TIERS.length; ++i) {
		add_row(i, DEFAULT_TIERS[i]);
	}
	recompute_header_colors();

	const modal = document.getElementById('image-modal');
	const modalImg = document.getElementById('modal-img');
	const modalTitle = document.getElementById('modal-title');
	const modalDesc = document.getElementById('modal-description');
	const modalClose = document.querySelector('.modal .close');
	let currentModalImage = null;

	function showModal(img) {
		currentModalImage = img;
		document.body.style.overflow = 'hidden';
		modal.style.display = 'flex';
		modalImg.src = img.src;
		modalTitle.value = img.dataset.title || 'No title';
		modalDesc.value = img.dataset.description || 'No description';
	}

	modalClose.addEventListener('click', () => {
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

	hard_reset_list();
	load_tierlist(EMBEDDED_JSON);
});


function create_img_with_src(src) {
	let img = document.createElement('img');
	img.src = src;
	img.style.userSelect = 'none';

	img.addEventListener("mouseenter", (evt) => {
        const title = evt.target.dataset.title;
        if (title) {
            evt.target.title = title;
        }
    });
	
	return img;
}

function hard_reset_list() {
	tierlist_div.innerHTML = '';
}

function load_tierlist(serialized_tierlist) {
	document.querySelector('.title-label').innerText = serialized_tierlist.title;
	for (let idx in serialized_tierlist.rows) {
		let ser_row = serialized_tierlist.rows[idx];
		let elem = add_row(idx, ser_row.name);

		for (let img_obj of (ser_row.imgs || [])) {
			let img = create_img_with_src(img_obj.src);
			img.dataset.title = img_obj.title || '';
			img.dataset.description = img_obj.description || '';
			let td = document.createElement('span');
			td.classList.add('item');
			td.appendChild(img);
			let items_container = elem.querySelector('.items');
			items_container.appendChild(td);
		}

		elem.querySelector('.header').innerText = ser_row.name;
	}
	recompute_header_colors();
}

function add_row(index, name) {
	let div = document.createElement('div');
	div.classList.add('row');

	let header = document.createElement('span');
	header.classList.add('header');
	header.innerText = name;

	let items = document.createElement('span');
	items.classList.add('items');

	div.appendChild(header);
	div.appendChild(items);

	let rows = tierlist_div.children;
	if (index >= rows.length) {
		tierlist_div.appendChild(div);
	} else {
		let nxt_child = rows[index];
		tierlist_div.insertBefore(div, nxt_child);
	}

	return div;
}

function recompute_header_colors() {
	let rows = tierlist_div.querySelectorAll('.row');
	rows.forEach((row, row_idx) => {
		let color = TIER_COLORS[row_idx % TIER_COLORS.length];
		row.querySelector('.header').style.backgroundColor = color;
	});
}
