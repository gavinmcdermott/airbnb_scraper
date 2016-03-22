'use strict'

// Setup
// 

var _ = require('lodash');
var q = require('q');
var querystring = require('querystring');
var requestP = require('request-promise');

var config = require('./config');


// Url, Data, Setup
// 

var url = config.url;
var URL_LISTING_PARAM = url.constants.LISTING_ID;
var STORE = config.store.scrapes.instance;


// Helper functions
// 

function printStep(step) {
  console.log('');
  console.log('');
  console.log('Now ' + step + '...');
  console.log('---------------------------------------------------');
  console.log('');
}


// API Scrape Sequence
// 

function getStarted() {
  console.log('');
  console.log('===================================================================================');
  console.log('Starting Data Scrape for ' + config.location.city + ', ' + config.location.state);
  console.log('===================================================================================');
  console.log('');
  return q.when();
}


// Search for n listings in a give market
function searchListings() {
  var options = {
    uri: url.listings.search,
    headers: { 'user-agent': config.requestHelpers.userAgent }
  };

  // Return a promise
  return requestP(options)
  .then(function (data) {    
    var parsedJson = JSON.parse(data);
    var propIds = _.map(parsedJson.search_results, function(property) {
      return property.listing.id;
    });
    console.log('=> Returned ' + propIds.length + ' properties');
    // Wipe this; malformed key and not valuable data
    delete parsedJson.metadata.avg_price_by_room_type.ratio;

    return {
      search: parsedJson,
      propertyIds: propIds
    };
  });
}


// Get the listing details for each 
function getListingDetails(data) {
  printStep('Getting Listings Details');

  var detailFetches = _.map(data.propertyIds, function(propId) {
    var listingDetailUrl = url.listing.details.replace(URL_LISTING_PARAM, propId);
    var options = {
      uri: listingDetailUrl,
      headers: { 'user-agent': config.requestHelpers.userAgent }
    };
    return requestP(options);
  });
  console.log('=> Generated detail links for ' + detailFetches.length + ' listings');

  // For a more dialed-in throttling experience!
  // var detailData = [];
  // return detailFetches
  // .reduce(function (dataSoFar, nextFunc) {
  //   return dataSoFar.then(function(dataBeingPassed) {
  //     return q(nextFunc).delay(config.requestHelpers.delay).then(function(propJson) {
  //       var propDetails = JSON.parse(propJson);
  //       console.log('=> Fetched details for ' + propDetails.listing.id);
  //       detailData.push(propDetails);
  //     });
  //   });
  // }, q(detailData))

  return q.all(detailFetches)
  .then(function(detailData) {
    console.log('=> Fetched details for ' + detailData.length + ' listings');
    var parsedDetailJson = _.map(detailData, function(property) {
      return JSON.parse(property);
    });
    return {
      details: parsedDetailJson,
      search: data.search,
      propertyIds: data.propertyIds
    }
  });
};


// Get the listing availability for each
function getListingAvailability(data) {
  printStep('Getting Availability for Listings');

  var availabilityFetches =_.map(data.propertyIds, function(propId) {
    var listingAvailabilityUrl = url.listing.availability.replace(URL_LISTING_PARAM, propId);
    var options = {
      uri: listingAvailabilityUrl,
      headers: { 'user-agent': config.requestHelpers.userAgent }
    };
    return requestP(options);
  });
  console.log('=> Generated availability links for ' + availabilityFetches.length + ' listings');
  
  return q.all(availabilityFetches)
  .then(function(availabilityData) {
    console.log('=> Fetched availability for ' + availabilityData.length + ' listings');
    var parsedAvailabilityJson = _.map(availabilityData, function(property) {
      return JSON.parse(property);
    });
    return {
      availability: parsedAvailabilityJson,
      details: data.details,
      search: data.search,
      propertyIds: data.propertyIds
    }
  });
}


// Data Organization
// 

// link up availability and details data based on property ids
function organizeByPropIds(data) {
  printStep('Organizing Listings by ID');

  // Useful note: 
  // Q.all resolves with data in the same order of the incoming promises
  // So we can handle the kind of iterations you're about to see

  var storageObj = {};
  // map the prop ids as keys in the final storage object
  _.forEach(data.propertyIds, function(id) {
    storageObj[id] = {};
  });

  // map the property details to the correct property
  _.forEach(data.details, function(propDetails) {
    var key = 'details';
    var details = propDetails.listing;
    var id = details.id;

    if (_.has(storageObj, id)) {
      storageObj[id][key] = details;
    }
  });

  // map availability to the correct property
  _.forEach(data.availability, function(propAvail, idx) {
    var key = 'availability';
    var id = data.propertyIds[idx];

    if (_.has(storageObj, id)) {
      storageObj[id][key] = propAvail.calendar_months;
    }
  });
  console.log('=> ' + _.keys(storageObj).length + ' listings organized');
  return q.when(storageObj);
}


// Data Persistence
// 

function saveListings(data) {
  printStep('Saving Latest Listings Data');

  STORE.update(data)
  .then(function() {
    console.log('=> Latest listing data saved!');
    console.log('=> ' + config.store.scrapes.url);
    console.log('');
    console.log('');
    console.log('');
    process.exit(1);
  });
};


function handleError(err) {
  console.log(err);
  console.log('');
  console.log('!!!!ERROR!!!!');
  process.exit(1);
}


// Run it!
// 

getStarted()
.then(searchListings)
.then(getListingDetails)
.then(getListingAvailability)
.then(organizeByPropIds)
.then(saveListings)
.catch(handleError);
