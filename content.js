// Modes
const COMPOSITION_ID = "composition";
const DETAILS_ID = "details";
const MEASUREMENTS_ID = "measurements";
const SIZE_ID = "size";
const FILTER_IDS = [COMPOSITION_ID, DETAILS_ID, MEASUREMENTS_ID, SIZE_ID];
const FILTER_LABEL_TEXT = {"composition": "Composition", "details": "Details", "measurements": "Measurements", "size": "Size"};

const ITEM_DATA_STRINGS = {"composition": '#compositionInfo',
						   "details": '#itemDescription',
						   "measurements": "#measurementsInfo",
	                       "size": null}; // Size is found by digging through javascript, not in html

//region Extension Initialization
var ExtensionSessionID = 0;
var ExtensionTeleyooxElement = null;

function restartExtension (teleyoox){
	console.log('[YOOX ADD FILTER_CODES] Restarting extension');

	StopPageFiltrator();
	ExtensionSessionID += 1;

	ExtensionTeleyooxElement = teleyoox;
	loadTemplates();
}
//endregion

//region Html Templates
const TOTAL_HTML_TEMPLATES = 2;
var htmlTemplates = {};
var loadedHtmlTemplatesCount = 0;

function loadTemplates (){
	loadedHtmlTemplatesCount = 0;

	console.log('Reloading templates');
	_loadTemplate('filterListTemplate.html');
	_loadTemplate('activeFilterTemplate.html');
}

function _loadTemplate (name){
	if (name in htmlTemplates && htmlTemplates[name].length > 0){
		_loadTemplate_Ended(name);
	}
	else {
		let url = chrome.extension.getURL('/' + name);
		$.get(url, function (data) {
			htmlTemplates[name] = data;
			_loadTemplate_Ended(name);
		});
	}
}

function _loadTemplate_Ended (name){
	loadedHtmlTemplatesCount++;

	if (loadedHtmlTemplatesCount === TOTAL_HTML_TEMPLATES){
		onAllTemplatesLoaded();
	}
}

function onAllTemplatesLoaded (){
	addFilterToTeleyoox();
}
//endregion

//region Filter Section Elements
var additionalFiltersSection = null;
var addFiltersSectionTitle = null;
var addFiltersSectionContent = null;

var inputFields = {};

var compOperatorCheckbox_AND;
var compOperatorCheckbox_OR;

function addFilterToTeleyoox() {
	console.log('Adding filter to teleyoox');

	let teleyooxPosition = document.getElementById('teleyoox-position');

	if (additionalFiltersSection !== null){
		additionalFiltersSection.remove();
	}

	let filterListTemplate = htmlTemplates['filterListTemplate.html'];
	$(teleyooxPosition).insertAt(1, $(filterListTemplate));

	additionalFiltersSection = $($(teleyooxPosition).children('#teleyooxAdditionalFilters')[0]);

    FILTER_IDS.forEach(key => {
        inputFields[key] = additionalFiltersSection.find("#" + key + "FilterInputField")[0];

        let uppercaseFilterId = key.charAt(0).toUpperCase() + key.slice(1);
        let applyFilterButton = additionalFiltersSection.find("#apply" + uppercaseFilterId + "FilterButton");
        applyFilterButton.click(_ => applyFilterButton_OnClick(key))
    });

	let clearAdditionalFiltersButton = additionalFiltersSection.find('#clearAdditionalFiltersButton');
	clearAdditionalFiltersButton.click(clearAdditionalFiltersButton_OnClick);

	compOperatorCheckbox_AND = additionalFiltersSection.find('.filterCheckboxButton')[0];
	$(compOperatorCheckbox_AND).click(compOperatorCheckbox_AND_OnClick);
	compOperatorCheckbox_OR = additionalFiltersSection.find('.filterCheckboxButton')[1];
	$(compOperatorCheckbox_OR).click(compOperatorCheckbox_OR_OnClick);

	removeAllFilterElements();

	addActiveFilterInfoElement();
	hideActiveFilterInfoElement();

	addFiltersSectionTitle =  additionalFiltersSection.find('.addFiltersSectionTitle')[0];
	$(addFiltersSectionTitle).click(addFiltersSectionTitle_OnClick);

	addFiltersSectionContent = additionalFiltersSection.find('.addFiltersSectionContent');

	chrome.storage.sync.get(FILTER_IDS.concat['isFolded', 'compOperator'], function(storage){
		let anyFilter = false;

        FILTER_IDS.forEach(filterStorageKey => {
            if (filterStorageKey in storage) {
			    storage[filterStorageKey].forEach(function (item) {
				    addFilterElement(item, filterStorageKey.replace("Filters", ""));
				    anyFilter = true;
			    });
            }
        });
		if ('isFolded' in storage && storage['isFolded'] === true){
			foldSection();
		}
		if (!('compOperator' in storage) || storage['compOperator'] === 'AND'){
			setComparisonOperator('AND');
		}
		else{
			setComparisonOperator('OR');
		}

 		if (anyFilter){
			StartPageFiltrator();
		}
	});
}

function applyFilterButton_OnClick(filterId){
    inputField = inputFields[filterId];
    let filterInput = inputField.value.trim();
	if (filterInput.length === 0) return;

	inputField.value = '';
	addActiveFilter(filterInput, filterId);
}

function clearAdditionalFiltersButton_OnClick(){
    Object.keys(inputFields).forEach(field => field.value = "");
	removeAllActiveFilters();
}

function addFiltersSectionTitle_OnClick (){
	const foldedClassName = 'addFiltersSectionTitle_Folded';
	if (addFiltersSectionTitle.classList.contains(foldedClassName)){
		addFiltersSectionTitle.classList.remove(foldedClassName);
	}
	else {
		addFiltersSectionTitle.classList.add(foldedClassName);
	}

	let isFolded = addFiltersSectionTitle.classList.contains(foldedClassName) === true;
	addFiltersSectionContent.css('display', isFolded ? 'none' : '');

	chrome.storage.sync.set({'isFolded': isFolded}, () => { });
}

function foldSection (){
	const foldedClassName = 'addFiltersSectionTitle_Folded';
	if (!addFiltersSectionTitle.classList.contains(foldedClassName)){
		addFiltersSectionTitle.classList.add(foldedClassName);
	}
	addFiltersSectionContent.css('display', 'none');
}

var comparisonOperator = 'AND';
const CHECKED_CHECKBOX_CLASS = 'filterCheckboxChecked';
function setComparisonOperator (operator){
	if (operator !== 'AND' && operator !== 'OR') return;
	else comparisonOperator = operator;

	if (operator === 'AND') {
		if (!compOperatorCheckbox_AND.classList.contains(CHECKED_CHECKBOX_CLASS))
			compOperatorCheckbox_AND.classList.add(CHECKED_CHECKBOX_CLASS);
		compOperatorCheckbox_OR.classList.remove(CHECKED_CHECKBOX_CLASS);
	}
	else {
		if (!compOperatorCheckbox_OR.classList.contains(CHECKED_CHECKBOX_CLASS))
			compOperatorCheckbox_OR.classList.add(CHECKED_CHECKBOX_CLASS);
		compOperatorCheckbox_AND.classList.remove(CHECKED_CHECKBOX_CLASS);
	}
}

function compOperatorCheckbox_AND_OnClick (){
	if (comparisonOperator === 'AND') return;
	else setComparisonOperator('AND');

	chrome.storage.sync.set({'compOperator': comparisonOperator}, function () { });
	OnFiltersChanged();
}

function compOperatorCheckbox_OR_OnClick (){
	if (comparisonOperator === 'OR') return;
	else setComparisonOperator('OR');

	chrome.storage.sync.set({'compOperator': comparisonOperator}, function () { });
	OnFiltersChanged();
}
//endregion

//region Active Filters
var activeFilters = {};
function clearActiveFilters(){
    FILTER_IDS.forEach(filterId => activeFilters[filterId] = {});
}
clearActiveFilters();

function addActiveFilter (filterInput, filterId){
	if (!FILTER_IDS.includes(filterId)) return;

	chrome.storage.sync.get([filterId], function (data){
		if (!(filterId in data)) data[filterId] = [];
		if (!data[filterId].includes(filterInput)){
			// if filter is not added to the storage, add it there and save
			data[filterId].push(filterInput);

			chrome.storage.sync.set({[filterId]: data[filterId]}, function (){
				addFilterElement(filterInput, filterId);
				OnFiltersChanged();
			});
		}
		else{
			// filter is already added to the storage
			addFilterElement(filterInput, filterId);
			OnFiltersChanged();
		}
	});
}

function removeActiveFilter (filterInput, filterId){
	if (!FILTER_IDS.includes(filterId)) return;

	chrome.storage.sync.get([filterId], function (data){
		if (!(filterId in data)) data[filterId] = [];
		if (data[filterId].includes(filterInput)){
			data[filterId].splice(data[filterId].indexOf(filterInput));

			chrome.storage.sync.set({[filterId]: data[filterId]}, function () {
				OnFiltersChanged();
			});
		}
		else OnFiltersChanged();
	});

	removeFilterElement(filterInput, filterId);
}

function removeAllActiveFilters (){
    var emptyFilters = {};
    FILTER_IDS.forEach(key => emptyFilters[key] = []);
	chrome.storage.sync.set(emptyFilters, function () {
		OnFiltersChanged();
	});

	removeAllFilterElements();
}

function addFilterElement (filterInput, filterId){
	let activeFilterList = activeFilters[filterId];
	if (filterInput in activeFilterList) return; // already added

	let filterText = FILTER_LABEL_TEXT[filterId] + ": " + filterInput;

	let templateCopy = $(htmlTemplates['activeFilterTemplate.html']);
	activeFiltersList.children('ul').insertAt(0, templateCopy);
	templateCopy.find('.active-filter-value')[0].innerText = filterText;
	templateCopy.click(function () {
		activeFilter_OnClick(filterInput, filterId);
	});

	activeFilterList[filterInput] = templateCopy;

	setActiveFilterInfoAsFirstSibling();
}

function removeFilterElement (filterInput, filterId){
	let activeFilterList = activeFilters[filterId];
	if (!filterInput in activeFilterList) return;

	activeFilterList[filterInput].remove();
	delete activeFilterList[filterInput];
}

function removeAllFilterElements (){
	if (activeFiltersList !== null){
		activeFiltersList.find('.customActiveFilterItem').remove();
		if (activeFilterInfoElement !== null) {
			activeFilterInfoElement.remove();
		}
	}

    clearActiveFilters();
}

function activeFilter_OnClick (filterInput, filterId){
	removeActiveFilter(filterInput, filterId);
}

var activeFiltersList = null;
var activeFilterInfoElement = null;
var activeFilterInfoElementValueElement;

function addActiveFilterInfoElement (){
	let templateCopy = $(htmlTemplates['activeFilterTemplate.html']);
	activeFiltersList = $('#active-filters-list');
	activeFiltersList.children('ul').insertAt(0, templateCopy);

	activeFilterInfoElement = templateCopy;

	activeFilterInfoElementValueElement = activeFilterInfoElement.find('.active-filter-value')[0];
	setTextToActiveFilterInfoElement('hello');

	templateCopy.children('a').css('pointer-events', 'none');
	templateCopy.find('.active-filter-x').remove();
}

function showActiveFilterInfoElement (){
	activeFilterInfoElement.css('display', '');
	setActiveFilterInfoAsFirstSibling();
}

function hideActiveFilterInfoElement (){
	activeFilterInfoElement.css('display', 'none');
}

function setTextToActiveFilterInfoElement (text){
	activeFilterInfoElementValueElement.innerText = text;
	setActiveFilterInfoAsFirstSibling();
}
function setActiveFilterInfoAsFirstSibling (){
	if (activeFilterInfoElement !== null && activeFiltersList !== null) {
		activeFiltersList.prepend(activeFilterInfoElement);
	}
}

//endregion

//region Filtrator
var isFiltratorStarted = false;
var isFiltratorCompleted = false;

var pageItems = null;
var filtratorItemsData = {};

var filtratorIndexesInProgress = [];
var filtratorIndexesQueue = [];
var filtratorLoadedIndexes = 0;

const FILTRATOR_MAX_PARALLEL = 10;

function StopPageFiltrator (){
	isFiltratorStarted = false;
}

function StartPageFiltrator (){
	if (isFiltratorStarted) return;
	else {
		isFiltratorStarted = true;
	}

	showActiveFilterInfoElement();
	loadDataForEachPageItem();
}

function OnFiltersChanged (){
	chrome.storage.sync.get(FILTER_IDS, function(storage){
		let anyFilter = false;

        allFilters = {}
        FILTER_IDS.forEach(filterId => {
            if (!(filterId in storage)) storage[filterId] = [];
            let filters = storage[filterId];
            allFilters[filterId] = filters;
            if (filters.length > 0) anyFilter = true;
        })

		if (anyFilter){
			StartPageFiltrator();
		}

		if (isFiltratorCompleted){
			let visibleItemCount = 0;
			for (let i = pageItems.length - 1; i >= 0; i--) {
				let item = pageItems[i];
				let isVisible = checkPageItemWithFilters(item, i, allFilters);
				setPageItemVisible(item, isVisible);

				if (isVisible) visibleItemCount++;
			}

			setTextToActiveFilterInfoElement('Shown items: ' + visibleItemCount + ' / ' + pageItems.length);
		}
	});
}

function loadDataForEachPageItem (){
	pageItems = $("[id^=item_]");
	filtratorItemsData = {};

	filtratorIndexesQueue = GetRangeOfNumbers(0, pageItems.length);
	filtratorIndexesInProgress = [];
	filtratorLoadedIndexes = 0;

	if (pageItems.length === 0){
		setTextToActiveFilterInfoElement('No page items');
	}
	else{
		setTextToActiveFilterInfoElement('Loaded 0 / ' + pageItems.length);
		onPageDataLoadCompleted(null, ExtensionSessionID);
	}
}

function onPageDataLoadCompleted (index, sessionID){
	if (ExtensionSessionID !== sessionID) return;

	if (index !== null) {
		filtratorIndexesInProgress.splice(filtratorIndexesInProgress.indexOf(index), 1);
		filtratorLoadedIndexes++;
	}

	if (filtratorIndexesQueue.length > 0) {
		for (let i = filtratorIndexesInProgress.length; i <= FILTRATOR_MAX_PARALLEL; i++) {
			let lastItem = filtratorIndexesQueue.pop();
			filtratorIndexesInProgress.push(lastItem);
			loadOnePageData(lastItem, sessionID);
			//console.log('Loading ' + lastItem + '. Queue: ' + filtratorIndexesQueue + '. In progress: ' + filtratorIndexesInProgress);
		}
	}

	if (filtratorIndexesQueue.length === 0 && filtratorIndexesInProgress.length === 0){
		onAllPageDataLoaded();
	}
	else{
		setTextToActiveFilterInfoElement('Loaded ' + filtratorLoadedIndexes + ' / ' + pageItems.length);
	}
}

function onAllPageDataLoaded (){
	// apply filters to page items
	setTextToActiveFilterInfoElement('All items loaded');

	isFiltratorCompleted = true;
	OnFiltersChanged();
}

function loadOnePageData (index, sessionID){
	let item = pageItems[index];
	let itemUrl = getItemUrl(item);

	if (itemUrl === undefined) {
		console.log('Undefined url of item: ' + item);
		onPageDataLoadCompleted(index, sessionID);
		return;
	}

	$.ajax({
		url: itemUrl,
		success: function (data) {
			if (ExtensionSessionID === sessionID) {
				let itemStrings = {}
				FILTER_IDS.forEach(filterId => itemStrings[filterId] = getStringFromItemData(data, filterId));
				filtratorItemsData[index] = itemStrings;
				//console.log('Saved for index ' + index + '. Data: ' + JSON.stringify(filtratorItemsData[index]));
			}
		},
		error: function (errorThrown) {
			console.log(errorThrown);
		},
		complete: function (data){
			onPageDataLoadCompleted(index, sessionID);
		}
	});
}

function checkPageItemWithFilters (pageItem, index, allFilters){
	if (!(index in filtratorItemsData)) return false;

	let itemData = filtratorItemsData[index];
	FILTER_IDS.forEach(filterId => itemData[filterId] = itemData[filterId].toLowerCase());

    filterMatches = Object.keys(allFilters).map(filterId => {
        filters = allFilters[filterId];
        singleFilterMatches = filters.map(filter => {
            let trimmedFilter = filter.trim().toLowerCase();
			return !(trimmedFilter.length > 0 && !itemData[filterId].includes(trimmedFilter));
		});
		return singleFilterMatches;
    });

	if (comparisonOperator === 'AND') {
	    allMatches = filterMatches.map(matches => matches.every(x => x));
	    return allMatches.every(x => x);
	} else { // OR
	    allMatches = filterMatches.map(matches => matches.some(x => x));
	    return allMatches.some(x => x);
	}
}

function setPageItemVisible (pageItem, isVisible){
	$(pageItem).parent().css('display', isVisible ? '' : 'none');
}

function getItemUrl (item){
	return $(item).find('.itemlink').attr('href');
}

function getStringFromItemData(itemData, filterId){
    var ownerDocument = document.implementation.createHTMLDocument('virtual');
	let itemDataElement = $(itemData, ownerDocument);
	if(filterId === SIZE_ID) {
		size_js_plaintext = itemDataElement.find("script:contains('tc_vars')")[0].outerHTML;
		product_sizes = size_js_plaintext.split("product_sizes");
		return_sizes = "";
		for(i = 2; i < product_sizes.length; i++) {
			product_size = product_sizes[i].split("Text: ")[1].split("\"")[1];
			return_sizes += product_size + " "
		}
		return return_sizes.trim();
	} else {
	    itemDataString = ITEM_DATA_STRINGS[filterId];
		let foundItemProperty = itemDataElement.find(itemDataString);
		if(foundItemProperty.length > 0) {
			return foundItemProperty.find('.info-body')[0].innerText;
		} else return "";
	}
}
//endregion

//region Lang
jQuery.fn.insertAt = function (index, element) {
	var lastIndex = this.children().length;
	if (index < 0) {
		index = Math.max(0, lastIndex + 1 + index);
	}
	this.append(element);
	if (index < lastIndex) {
		this.children().eq(index).before(this.children().last());
	}
	return this;
};

function GetRangeOfNumbers (firstIncl, lastExcl){
	let list = [];
	for (let i = firstIncl; i < lastExcl;i++){
		list.push(i);
	}
	return list;
}
//endregion

//region Run
function onSecond (){
	let teleyoox = document.getElementById('teleyoox');
	if (teleyoox !== null && (ExtensionTeleyooxElement === null || !teleyoox.isSameNode(ExtensionTeleyooxElement))) {
		restartExtension(teleyoox);
	}

	setTimeout(onSecond, 500);
}

onSecond();
//endregion