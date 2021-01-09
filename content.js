// Modes
const COMPOSITION_FILTER = 1001;
const DETAILS_FILTER = 1002;

//region Extension Initialization
var ExtensionSessionID = 0;
var ExtensionTeleyooxElement = null;

function restartExtension (teleyoox){
	console.log('[YOOX ADD FILTERS] Restarting extension');

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

var detailsFilterInputField;
var compositionFilterInputField;

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

	detailsFilterInputField = additionalFiltersSection.find('#detailsFilterInputField')[0];
	compositionFilterInputField = additionalFiltersSection.find('#compositionFilterInputField')[0];

	let applyDetailsFilterButton = additionalFiltersSection.find('#applyDetailsFilterButton');
	let applyCompositionFilterButton = additionalFiltersSection.find('#applyCompositionFilterButton');
	let clearAdditionalFiltersButton = additionalFiltersSection.find('#clearAdditionalFiltersButton');

	applyDetailsFilterButton.click(applyDetailsFilterButton_OnClick);
	applyCompositionFilterButton.click(applyCompositionFilterButton_OnClick);
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

	chrome.storage.sync.get(['detailsFilters', 'compositionFilters', 'isFolded', 'compOperator'], function(storage){
		let anyFilter = false;

		if ('detailsFilters' in storage) {
			storage['detailsFilters'].forEach(function (item) {
				addFilterElement(item, DETAILS_FILTER);
				anyFilter = true;
			});
		}
		if ('compositionFilters' in storage) {
			storage['compositionFilters'].forEach(function (item) {
				addFilterElement(item, COMPOSITION_FILTER);
				anyFilter = true;
			});
		}
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

function applyDetailsFilterButton_OnClick (){
	let filterValue = detailsFilterInputField.value.trim();
	if (filterValue.length === 0) return;

	detailsFilterInputField.value = '';
	addActiveFilter(filterValue, DETAILS_FILTER);
}
function applyCompositionFilterButton_OnClick (){
	let filterValue = compositionFilterInputField.value.trim();
	if (filterValue.length === 0) return;

	compositionFilterInputField.value = '';
	addActiveFilter(filterValue, COMPOSITION_FILTER);
}
function clearAdditionalFiltersButton_OnClick (){
	detailsFilterInputField.value = '';
	compositionFilterInputField.value = '';

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
var detailsActiveFilters = {};
var compositionActiveFilters = {};

function addActiveFilter (filterValue, filterType){
	if (filterType !== COMPOSITION_FILTER && filterType !== DETAILS_FILTER) return;

	let storageKey = filterType === DETAILS_FILTER ? 'detailsFilters' : 'compositionFilters';

	chrome.storage.sync.get([storageKey], function (data){
		if (!(storageKey in data)) data[storageKey] = [];
		if (!data[storageKey].includes(filterValue)){
			// if filter is not added to the storage, add it there and save
			data[storageKey].push(filterValue);

			chrome.storage.sync.set({[storageKey]: data[storageKey]}, function (){
				addFilterElement(filterValue, filterType);
				OnFiltersChanged();
			});
		}
		else{
			// filter is already added to the storage
			addFilterElement(filterValue, filterType);
			OnFiltersChanged();
		}
	});
}
function removeActiveFilter (filterValue, filterType){
	if (filterType !== COMPOSITION_FILTER && filterType !== DETAILS_FILTER) return;

	let storageKey = filterType === DETAILS_FILTER ? 'detailsFilters' : 'compositionFilters';
	let activeFilterList = filterType === DETAILS_FILTER ? detailsActiveFilters : compositionActiveFilters;

	chrome.storage.sync.get([storageKey], function (data){
		if (!(storageKey in data)) data[storageKey] = [];
		if (data[storageKey].includes(filterValue)){
			data[storageKey].splice(data[storageKey].indexOf(filterValue));

			chrome.storage.sync.set({[storageKey]: data[storageKey]}, function () {
				OnFiltersChanged();
			});
		}
		else OnFiltersChanged();
	});

	removeFilterElement(filterValue, filterType);
}
function removeAllActiveFilters (){
	chrome.storage.sync.set({'detailsFilters': [], 'compositionFilters': []}, function () {
		OnFiltersChanged();
	});

	removeAllFilterElements();
}

function addFilterElement (filterValue, filterType){
	let activeFilterList = filterType === DETAILS_FILTER ? detailsActiveFilters : compositionActiveFilters;
	if (filterValue in activeFilterList) return; // already added

	let filterText = filterValue;
	if (filterType === COMPOSITION_FILTER) filterText = 'C: ' + filterText;
	else if (filterType === DETAILS_FILTER) filterText = 'D: ' + filterText;

	let templateCopy = $(htmlTemplates['activeFilterTemplate.html']);
	activeFiltersList.children('ul').insertAt(0, templateCopy);
	templateCopy.find('.active-filter-value')[0].innerText = filterText;
	templateCopy.click(function () {
		activeFilter_OnClick(filterValue, filterType);
	});

	activeFilterList[filterValue] = templateCopy;

	setActiveFilterInfoAsFirstSibling();
}
function removeFilterElement (filterValue, filterType){
	let activeFilterList = filterType === DETAILS_FILTER ? detailsActiveFilters : compositionActiveFilters;
	if (!filterValue in activeFilterList) return;

	activeFilterList[filterValue].remove();
	delete activeFilterList[filterValue];
}
function removeAllFilterElements (){
	if (activeFiltersList !== null){
		activeFiltersList.find('.customActiveFilterItem').remove();
		if (activeFilterInfoElement !== null) {
			activeFilterInfoElement.remove();
		}
	}

	detailsActiveFilters = {};
	compositionActiveFilters = {};
}

function activeFilter_OnClick (filterValue, filterType){
	removeActiveFilter(filterValue, filterType);
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
	chrome.storage.sync.get(['detailsFilters', 'compositionFilters'], function(storage){
		let anyFilter = false;

		if (!('detailsFilters' in storage)) storage['detailsFilters'] = [];
		if (!('compositionFilters' in storage)) storage['compositionFilters'] = [];

		let detailsFilters = storage['detailsFilters'];
		let compositionFilters = storage['compositionFilters'];
		if (detailsFilters.length > 0) anyFilter = true;
		if (compositionFilters.length > 0) anyFilter = true;

		if (anyFilter){
			StartPageFiltrator();
		}

		if (isFiltratorCompleted){
			let visibleItemCount = 0;
			for (let i = pageItems.length - 1; i >= 0; i--) {
				let item = pageItems[i];
				let isVisible = checkPageItemWithFilters(item, i, detailsFilters, compositionFilters);
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
				let detailsStr = getDetailsStringFromItemData(data);
				let compositionStr = getCompositionStringFromItemData(data);

				filtratorItemsData[index] = {'details': detailsStr, 'composition': compositionStr};
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

function checkPageItemWithFilters (pageItem, index, detailsFilters, compositionFilters){
	if (!(index in filtratorItemsData)) return false;

	let itemData = filtratorItemsData[index];
	let itemDetails = itemData['details'].toLowerCase();
	let itemComposition = itemData['composition'].toLowerCase();

	if (comparisonOperator === 'AND') { // AND
		for (let i = 0; i < detailsFilters.length; i++) {
			let filter = detailsFilters[i].trim().toLowerCase();
			if (filter.length > 0 && !itemDetails.includes(filter)) {
				return false;
			}
		}
		for (let i = 0; i < compositionFilters.length; i++) {
			let filter = compositionFilters[i].trim();
			if (filter.length > 0 && !itemComposition.includes(filter)) {
				return false;
			}
		}

		return true;
	}
	else{ // OR
		for (let i = 0; i < detailsFilters.length; i++) {
			let filter = detailsFilters[i].trim().toLowerCase();
			if (filter.length > 0 && itemDetails.includes(filter)) {
				return true;
			}
		}
		for (let i = 0; i < compositionFilters.length; i++) {
			let filter = compositionFilters[i].trim();
			if (filter.length > 0 && itemComposition.includes(filter)) {
				return true;
			}
		}

		return false;
	}
}

function setPageItemVisible (pageItem, isVisible){
	$(pageItem).parent().css('display', isVisible ? '' : 'none');
}

function getItemUrl (item){
	return $(item).find('.itemlink').attr('href');
}
function getDetailsStringFromItemData (itemData){
	var ownerDocument = document.implementation.createHTMLDocument('virtual');
	let itemDataElement = $(itemData, ownerDocument);

	return itemDataElement.find('#itemDescription').find('.info-body')[0].innerText;
}
function getCompositionStringFromItemData (itemData){
	var ownerDocument = document.implementation.createHTMLDocument('virtual');
	let itemDataElement = $(itemData, ownerDocument);

	return itemDataElement.find('#compositionInfo').find('.info-body')[0].innerText;
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