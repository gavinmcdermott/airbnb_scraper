'use strict'

var _ = require('lodash');
var Firebase = require("firebase");  // Used to store scrapes
var moment = require('moment');
var q = require('q');
var requestP = require('request-promise');

var config = require('./config');


// Constants
// 

var LOCATION = config.location;
// For details on rest queries
// https://www.firebase.com/docs/rest/guide/retrieving-data.html#section-rest-queries
var SCRAPES_URL = config.store.scrapes.url;
var SCRAPES_QUERY_STRING = '.json?limitToLast=1&orderBy="$key"';

var CURRENT_MARKET_PATH = _.snakeCase(LOCATION.city + ' ' + LOCATION.state);
var INSIGHT_STORE = config.store.insights.instance;


// Data Parsers
// 


function getHouseDetails(details) {
  if (typeof(details.bedrooms) === 'undefined') {
    return;
  }

  return {
    id: details.id,
    bathrooms: details.bathrooms,
    bedrooms: details.bedrooms,
    beds: details.beds,
    price: details.price,
    location: {
      neighborhood: details.neighborhood || '',
      lat: details.lat,
      lng: details.lng
    }
  };
};


function getOccupancy(occupancy) {
  var monthData = _.first(occupancy);
  
  var bookings = monthData.days;
  var totalNights = _.keys(bookings).length;

  var occupiedNights = _.filter(bookings, function(booking) {
    return !booking.available;
  });
  var totalOccupiedNights = occupiedNights.length;

  var occupancyRate = totalOccupiedNights / totalNights;
  var occupancyPct = parseFloat((occupancyRate * 100).toFixed(2), 10);
  
  var priceTotal = _.reduce(bookings, function(sum, booking) {
    return sum + booking.price.local_price;
  }, 0);
  var priceAvg = parseInt((priceTotal / totalNights).toFixed(0));

  return {
    occupancy: occupancyPct,
    priceAvg: priceAvg
  };
};


function getBedValueDrivers(house) {
  var numBeds = house.beds;
  var numBedrooms = house.bedrooms;
  var priceAvg = house.priceAvg;
  var pricePerBed = parseFloat((priceAvg / numBeds).toFixed(2), 10);
  var pricePerBedroom;

  if (numBedrooms === 0) {
    pricePerBedroom = priceAvg;
  } else {
    pricePerBedroom = parseFloat((priceAvg / numBedrooms).toFixed(2), 10);
  }
  return {
    pricePerBed: pricePerBed,
    pricePerBedroom: pricePerBedroom
  };
};


function makeSenseOfBedrooms(bedrooms) {
  var totalHomes = bedrooms.length;
  var priceTotal = _.reduce(bedrooms, function(sum, house) {
    return sum + house.priceAvg;
  }, 0);
  var occupancyTotal = _.reduce(bedrooms, function(sum, house) {
    return sum + house.occupancy;
  }, 0);

  var priceAvg = parseFloat((priceTotal / totalHomes).toFixed(2), 10);
  var occupancyAvg = parseFloat((occupancyTotal / totalHomes).toFixed(2), 10);

  return {
    priceAvg: priceAvg,
    occupancyAvg: occupancyAvg,
    total: totalHomes
  };
};


// Fetch Sequence
// 


function getStarted() {
  console.log('');
  console.log('===================================================================================');
  console.log('Starting Data Parse for ' + LOCATION.city + ', ' + LOCATION.state);
  console.log('===================================================================================');
  console.log('');
  return q.when();
}


function generateMarketUrl() {
  var url = SCRAPES_URL + '/' + CURRENT_MARKET_PATH + SCRAPES_QUERY_STRING;
  return q.when(url);
}


function fetchMarketData(url) {
  console.log('=> Fetching ' + url);
  console.log('=> This could take awhile...');
  var options = {
    uri: url,
    headers: { 'user-agent': config.requestHelpers.userAgent }
  };
  return requestP(options);    
}


// Data looks like this:
// { 03_17_2016: { house_id: {}, house_id: {} } }
function parseRawData(data) {
  console.log('=> Received data for ' + LOCATION.string + '!');
  var results = {};
  var parsedRaw = JSON.parse(data);

  var dateKey = _.chain(parsedRaw).keys().first().value();
  var houses = parsedRaw[dateKey];

  _.forEach(houses, function(house, houseId) {  
    var parsedDetails = getHouseDetails(house.details);
    var parsedOccupancy = getOccupancy(house.availability);
    
    // We're only adding objects with valid
    if (parsedDetails) {
      // basic parsing results
      var parsedHouse = results[houseId] = parsedDetails;
      parsedHouse.occupancy = parsedOccupancy.occupancy;
      parsedHouse.priceAvg = parsedOccupancy.priceAvg;
      // add some pricing
      var bedValues = getBedValueDrivers(parsedHouse);
      parsedHouse.pricePerBedAvg = bedValues.pricePerBed;
      parsedHouse.pricePerBedroomAvg = bedValues.pricePerBedroom;
    }
  });
  var totalHouses = _.keys(results).length;

  // Tack on the date and total
  results.meta = {
    date: dateKey,
    total: totalHouses
  };
  return q.when(results);
};


function addInsightsToData(data) {
  var bedrooms = {
    distribution: {},
    data: {},
    date: data.meta.date,
    total: data.meta.total
  };

  var houses = _.filter(data, function(data, key) {
    return key !== 'meta';
  });

  _.forEach(houses, function(house) {
    var bedroomsCount = house.bedrooms;
    bedrooms.distribution[bedroomsCount] ? bedrooms.distribution[bedroomsCount].push(house) : bedrooms.distribution[bedroomsCount] = [house];
  });

  // Make initial sense of things
  _.forEach(bedrooms.distribution, function(bedroomsData, count) {
    bedrooms.data[count] = makeSenseOfBedrooms(bedroomsData);
  });
  return q.when(bedrooms);
};


function saveInsights(data) {
  // // We set the date of the insights based on the date of the data used
  INSIGHT_STORE.child(data.date).set(data)
  .then(function() {
    console.log('=> Latest insight data saved!');
    console.log('=> ' + config.store.insights.url);
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


// Run that parser!!
// 

getStarted()
.then(generateMarketUrl)
.then(fetchMarketData)
.then(parseRawData)
.then(addInsightsToData)
.then(saveInsights)
.catch(handleError);
