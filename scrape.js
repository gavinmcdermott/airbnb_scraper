var rp = require('request-promise');
var listings = require('./listings');
var config = require('./config');
var Parse = require('parse');
var _ = require('underscore');
var moment = require('moment');


var pricePath = 'https://www.airbnb.com/rooms/<LISTINGID>/personalization.json';
var availabilityPath = 'https://www.airbnb.com/api/v2/calendar_months?key=' + config.userKey + '&currency=USD&locale=en&listing_id=<LISTINGID>&month=' + config.month + '&year=' + config.year + '&count=3&_format=with_conditions';
// use <LISTINGID>, <MONTH>, etc as strings that we'll replace with actual listing id, month, etc.

var main = function() {

  var testURL = 'https://www.airbnb.com/rooms/5272115?checkin=11%2F11%2F2015&checkout=11%2F13%2F2015&s=LbXRFUYg';
  var testID = listingIdFromURL(testURL);

  console.log('listing,price,occupied rate');
  _.each(listings.listings, function(listingURL) {
    var listingID = listingIdFromURL(listingURL);
    var cleanURL = 'https://www.airbnb.com/rooms/' + listingID;
    var price, occupiedRate;

    debugger;

    getPrice(listingID)
    .then(function(p) {
      price = p;
      return getAvailability(listingID);
    })
    .then(function(availabilityData) {
      occupiedRate = getOccupancyRate(moment(), moment().add(config.daysToLookAhead, 'days'), availabilityData);
      console.log(cleanURL + ',' + price + ',' + occupiedRate);
    });
  });
}

// given raw JSON from airbnb's availabilityPath return, pulls out the booking rate 
// starting at the given date, for the given number of days
var getOccupancyRate = function(startDate, endDate, rawJSON) {
  var allDays = [];
  _.each(rawJSON.calendar_months, function(monthFragment) {
    var formattedDays = _.map(monthFragment.days, function(dayFragment) {
      return {
        date: moment(dayFragment.date),
        available: dayFragment.available
      };
    });
    allDays = allDays.concat(formattedDays);
  });

  var filteredByDate = _.filter(allDays, function(oneDay) {
    return (
      oneDay.date >= startDate &&
      oneDay.date <= endDate);
  });

  var occupied = _.where(filteredByDate, {available: false});

  var rate = occupied.length / filteredByDate.length;
  var rounded = parseFloat(rate).toFixed(1);
  return rounded;
};

// returns a promise
var getAvailability = function(listingID) {
  var completedAvailabilityPath = availabilityPath;
  completedAvailabilityPath = completedAvailabilityPath.replace('<LISTINGID>', listingID);

  var options = {
    uri: completedAvailabilityPath,
    headers: {'user-agent': 'Mozilla/5.0'}
  };

  return rp(options)
  .then(function (htmlString) {
    debugger;
    return Parse.Promise.as(JSON.parse(htmlString));
  })
  .catch(function (err) {
    console.log(err);
    return Parse.Promise(reject);
  });
}

// returns a promise
var getPrice = function(listingID) {
  var completedPricePath = pricePath;
  completedPricePath = completedPricePath.replace('<LISTINGID>', listingID);

  var options = {
    uri: completedPricePath,
    headers: {'user-agent': 'Mozilla/5.0'}
  };

  return rp(options)
  .then(function (htmlString) {
    var price = JSON.parse(htmlString).nightly_price;
    return Parse.Promise.as(price);
  })
  .catch(function (err) {
    console.log(err);
    return Parse.Promise.reject(err);
  });
}

var listingIdFromURL = function(url) {
  url = url.replace(/https:\/\/www.airbnb.com\/rooms\//, "");
  var pieces = url.split("?");
  return pieces[0]; // just the listing id
}

main();