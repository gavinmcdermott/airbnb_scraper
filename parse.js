'use strict'

var _ = require('lodash');
var Firebase = require("firebase");  // Used to store scrapes
var moment = require('moment');
var q = require('q');
var requestP = require('request-promise');

var config = require('./config');


// The Market we want data for
// 

var MARKET_TO_PARSE = 'South Lake Tahoe';


// Constants
// 

var STORE_URL = config.store.url;
var MARKETS = config.store.markets;
var JSON_SPECIFIER = '.json';


// Data Parsers
// 



// 
// 
// TODO: these are naive - rework these - currently just for showing things working
// 
// 
function getHouseDetails(data) {
  
  // what I want!
  // {
  //   id: houseId,
  //   bathrooms: details.bathrooms,
  //   bedrooms: details.bedrooms,
  //   beds: details.beds,
  //   price: details.price,
  //   location: {
  //     neighborhood: details.neighborhood,
  //     lat: details.lat,
  //     lng: details.lng
  //   }
  // }

}


function getAvailabilityForCurrentMonth(data) {

}
// 
// 
// END TODO
// 
//





// Fetch Sequence
// 

function generateMarketUrl() {
  // urls for market data fetches
  var marketUrls = {};
  var market = _.snakeCase(MARKET_TO_PARSE);

  console.log('=> Generating the fetch endpoint for ' + MARKET_TO_PARSE);

  _.forEach(MARKETS, function(cities, stateKey) {
    if (stateKey === 'STATE_NAMES') return;
    _.forEach(cities, function(city, cityKey) {
      var cityKey = _.snakeCase(city);
      marketUrls[cityKey] = STORE_URL + '/' + _.snakeCase(city + ' ' + stateKey) + JSON_SPECIFIER;
    });
  });

  // ensure a valid market
  if (!_.has(marketUrls, market)) {
    throw new Error('Invalid market. Possible markets are: ' + _.keys(marketUrls));
  }
  return q.when(marketUrls[market]);
}


function fetchMarketData(url) {
  console.log('=> Fetching data at ' + url);
  var options = {
    uri: url,
    headers: { 'user-agent': config.requestHelpers.userAgent }
  };
  return requestP(options);    
}


// Data looks like this:
// { 
//   03_17_2016: {...},
//   03_18_2016: {...},
//   03_19_2016: {...}
// }
function parseMarketData(data) {
  console.log('=> Received data for ' + MARKET_TO_PARSE + '! Let\'s make some sense of it!');
  var parsed = JSON.parse(data);
  var houseDetails = getHouseDetails(parsed);
  var availabilityDetails = getAvailabilityForCurrentMonth(parsed);
  process.exit(1);
};


function handleError(err) {
  console.log(err);
  console.log('');
  console.log('!!!!ERROR!!!!');
  process.exit(1);
}


// Run that parser!!
// 

generateMarketUrl()
.then(fetchMarketData)
.then(parseMarketData)
.catch(handleError);