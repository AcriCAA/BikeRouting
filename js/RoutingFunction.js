// Load the google map
var map;
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 39.996926, lng: -75.21183},
    zoom: 11
  });
  new AutocompleteDirectionsHandler(map);
}

// autocomplete function
function AutocompleteDirectionsHandler(map) {
  this.map = map;
  this.originPlaceId = null;
  this.destinationPlaceId = null;
  this.travelMode = 'BICYCLING';
  var originInput = document.getElementById('origin-input');
  var destinationInput = document.getElementById('destination-input');
  var modeSelector = document.getElementById('mode-selector');
  this.directionsService = new google.maps.DirectionsService();
  this.directionsDisplay = new google.maps.DirectionsRenderer();
  this.directionsDisplay.setMap(map);

  var originAutocomplete = new google.maps.places.Autocomplete(
      originInput, {placeIdOnly: true});
  var destinationAutocomplete = new google.maps.places.Autocomplete(
      destinationInput, {placeIdOnly: true});
  this.setupPlaceChangedListener(originAutocomplete, 'ORIG');
  this.setupPlaceChangedListener(destinationAutocomplete, 'DEST');
}

AutocompleteDirectionsHandler.prototype.setupPlaceChangedListener = function(autocomplete, mode) {
  var me = this;
  autocomplete.bindTo('bounds', this.map);
  autocomplete.addListener('place_changed', function() {
    var place = autocomplete.getPlace();
    if (!place.place_id) {
      window.alert("Please select an option from the dropdown list.");
      return;
    }
    if (mode === 'ORIG') {
      me.originPlaceId = place.place_id;
    } else {
      me.destinationPlaceId = place.place_id;
    }
    me.route();
  });
};

// variables for creating a WKT
var wkt_conversion = function(route){
  // var route_wktstring = [];
  var start = "LINESTRING(";
  var end = ")";
  var join = ", ";
  var route_decoded = decode(route.overview_polyline);
  var middle = _.map(route_decoded,function(d) {
    return (d.longitude + " " + d.latitude);
  }).join(join);
  var wkt = start + middle + end; // well known text line string
  return wkt;
};

//// a function to get sql query string
var get_url = function(wkt){
  var sql = 'select * from allscore_length as L where ST_DWithin(ST_GeomFromText(\'' +
  wkt + '\')::geography,st_centroid(L.the_geom)::geography,5)';
  return "https://KristenZhao.carto.com/api/v2/sql?format=GeoJSON&q="+sql;
};


AutocompleteDirectionsHandler.prototype.route = function() {
  if (!this.originPlaceId || !this.destinationPlaceId) {
    return;
  }
  // hide route option panels
  $(".route-option").remove();

  var me = this;

  //// carto SQL query desired rows
  var getRouteScore = function(response,urls){
    $(urls).each(function(idx,url){
      // console.log('idx',idx);
      // Start query and score calculation
      $.getJSON(url).done(function(data){
        console.log('data',data);
        var sumlength = _.reduce(data.features, function(memo,i) {
          return memo+i.properties.lengthft;
        }, 0);
        _.each(data.features, function(iteratee){
          iteratee.properties.weightedScore =
          Math.round(iteratee.properties.lengthft/sumlength*iteratee.properties.finalscore);
        });
        var avgscore = _.reduce(data.features, function(memo,i){
          return memo+i.properties.weightedScore;
        }, 0);
        console.log('avgscore',avgscore);
        //// assign scores to panels
          $(".sidenav").append(
            "<div class='route-option' id='route" + idx + "'>" +
                "<div class='mdl-grid--no-spacing'>" +
                  "<div class='mdl-cell mdl-cell--12-col'>" +
                    "<h6 class='route-title'>" +
                      'via '.concat(me.directionsDisplay.directions.routes[idx].summary) +
                    '</h6>'+
                  '</div>' +
                '</div>' +
                "<div class='mdl-grid'>" +
                  "<div class='mdl-cell mdl-cell--2-col'>" +
                    "<i class='fa fa-bicycle' aria-hidden='true'></i>" +
                  '</div>' +
                '<div class="mdl-cell mdl-cell--3-col">' +
                me.directionsDisplay.directions.routes[idx].legs[0].distance.text +
                '</div>' +
                '<div class="mdl-cell mdl-cell--3-col">' +
                me.directionsDisplay.directions.routes[idx].legs[0].duration.text +
                '</div>' +
              '</div>' +
              '<div class="mdl-grid--no-spacing">' +
                '<div class="mdl-cell mdl-cell--12-col">' +
                  "<h4 class='route-title'>Score " +
                    avgscore +
                  '</h4>' +
                "</div>" +
              "</div>" +
            '</div>'
          );
          $("#route"+idx).click(function(){
            console.log('click fired for route',idx);
            me.directionsDisplay.setMap(null);
            me.directionsDisplay = new google.maps.DirectionsRenderer({
              map: map,
              directions: response,
              routeIndex: idx
            });
          });
        });
      });
    };

  var route_analyze = function(response, status) {
    if (status === 'OK') {
      me.directionsDisplay.setDirections(response);

      var route_wktstring = _.map(me.directionsDisplay.directions.routes,wkt_conversion);
      console.log('route_wktstring',route_wktstring);
      var urls = _.map(route_wktstring,get_url);
      console.log('urls',urls);
      getRouteScore(response,urls);
     }
     else {
     window.alert('Directions request failed due to ' + status);
     }
   };

  this.directionsService.route({
    origin: {'placeId': this.originPlaceId},
    destination: {'placeId': this.destinationPlaceId},
    travelMode: this.travelMode,
    provideRouteAlternatives: true
  }, route_analyze);
};
