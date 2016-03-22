'use strict'

var _ = require('lodash');
var Firebase = require("firebase");  // Used to store scrapes
var moment = require('moment');
var querystring = require('querystring');

var now = moment();


// Constants
// 


// walker delay
var FETCH_DELAY = 5000;

// Search limits - 50 is max aggressiveness
var SEARCH_LIMIT = 50;

// Note re: cities => we need to use the same syntax/spelling every time...So Use These Constants!!!
var LOCATIONS = {
  STATE_NAMES: {
    CA: 'CA',
  },
  CA: {
    LAKE_TAHOE_NORTH: 'North Lake Tahoe',
    LAKE_TAHOE_SOUTH: 'South Lake Tahoe'
  }
};


// Location to search
var SEARCH_CITY = LOCATIONS.CA.LAKE_TAHOE_SOUTH;  // IMPOTRANT: Be sure to use a city constant!
var SEARCH_STATE = LOCATIONS.STATE_NAMES.CA;
var SEARCH_COUNTRY = 'US';
var SEARCH_LOCATION_STRING = SEARCH_CITY + ' ' + SEARCH_STATE + ' ' + SEARCH_COUNTRY;

// String for URL replacement
var LISTING_ID_PARAM = 'LISTINGID';
// Year to check for airbnb availability
var YEAR_TO_CHECK = now.format('YYYY');
// Month to check for airbnb availability
var MONTH_TO_CHECK = now.format('M');  // March

// URL format in firebase: scrapes/<CITY_STATE>/<DAY_MONTH_YR>
// E.g.: /scrapes/north_lake_tahoe_us/7_3_2016
var LOCATION_ENDPOINT = _.snakeCase(SEARCH_CITY + ' ' + SEARCH_STATE);
var DATE_ENDPOINT = _.snakeCase(moment().format('MM') + ' ' + moment().format('DD') + ' ' + moment().format('YYYY'));

var SCRAPE_BASE_ENDPOINT = 'https://burning-inferno-3875.firebaseio.com/scrapes';
var SCRAPE_SAVE_ENDPOINT = SCRAPE_BASE_ENDPOINT + '/' + LOCATION_ENDPOINT + '/' + DATE_ENDPOINT;

var INSIGHT_BASE_ENDPOINT = 'https://burning-inferno-3875.firebaseio.com/insights';
var INSIGHT_SAVE_ENDPOINT = INSIGHT_BASE_ENDPOINT + '/' + LOCATION_ENDPOINT;



// Exports
// 

// 
module.exports.location = {
  city: SEARCH_CITY,
  state: SEARCH_STATE,
  country: SEARCH_STATE,
  string: SEARCH_LOCATION_STRING,
  markets: LOCATIONS
};

// The root for our firebase scrape data store
module.exports.store = {
  scrapes: {
    instance: new Firebase(SCRAPE_SAVE_ENDPOINT),
    url: SCRAPE_BASE_ENDPOINT
  },
  insights: {
    instance: new Firebase(INSIGHT_SAVE_ENDPOINT),
    url: INSIGHT_BASE_ENDPOINT
  }
};

// Any user's Airbnb user key - pulled manually from a console request :P
module.exports.userKey = '3092nxybyb0otqw18e8nh5nty';  // key from http://airbnbapi.org

module.exports.urlHelpers = {
  // Listings
  listingsSearch: {
    base: 'https://api.airbnb.com/v2/search_results?',
    params: {
      'client_id': module.exports.userKey,
      'location': SEARCH_LOCATION_STRING,
      // internals
      '_limit': SEARCH_LIMIT,
      '_offset': 0,
      // externals
      'min_bathrooms': 0,
      'min_bedrooms': 0,
      'min_beds': 1,
      'price_max': 5000,
      'price_min': 0,
      'currency': 'USD',
      'locale': 'en-US',
      'sort': 1,
    }
  },

  // Listing
  listingPrice: {
    base: 'https://www.airbnb.com/rooms/' + LISTING_ID_PARAM + '/personalization.json'
  },
  listingDetails: {
    base: 'https://api.airbnb.com/v2/listings/' + LISTING_ID_PARAM + '?',
    params: {
      client_id: module.exports.userKey,
      _format: 'v1_legacy_for_p3'
    }
  },
  listingAvailability: {
    base: 'https://www.airbnb.com/api/v2/calendar_months?',
    params: {
      'key': module.exports.userKey,
      'currency': 'USD',
      'locale': 'en',
      'listing_id': LISTING_ID_PARAM,
      'month': MONTH_TO_CHECK,
      'year': YEAR_TO_CHECK,
      'count': 1,
      '_format': 'with_conditions',
    }
  }
};

// Airbnb JSON endpoints
module.exports.url = {
  listings: {
    search: module.exports.urlHelpers.listingsSearch.base + querystring.stringify(module.exports.urlHelpers.listingsSearch.params)
  },
  listing: {
    pricing: module.exports.urlHelpers.listingPrice.base,
    details: module.exports.urlHelpers.listingDetails.base + querystring.stringify(module.exports.urlHelpers.listingDetails.params),
    availability: module.exports.urlHelpers.listingAvailability.base + querystring.stringify(module.exports.urlHelpers.listingAvailability.params)
  },
  constants: {
    LISTING_ID: LISTING_ID_PARAM
  }
};

module.exports.requestHelpers = {
  delay: FETCH_DELAY,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36'
};

// encodeURIComponent('sdf sdf  sdf3 - -')
