$(function() {

  var proxy = 'https://cors-anywhere.herokuapp.com/'; // used to bypass browser CORS
  var myUrl = 'https://www.imdb.com/title/'; // IMDB's link to their show titles
  var mapArray = new Array(); // Used to hold the arrays of each season's scores
  var showArray = new Array(); // Used to hold the arrays of each episode's score
  var seasons; // Used to hold the number of seasons
  var bar; // The increasing bar that show's load %

  init();


  $("#showID").on("keypress", function() {
    if (!(checkPattern($("#showID").val()))) {
      $("#showID").css("color", "red");
    } else {
      $("#showID").css("color", "black");
    }
  });


  // On the click of the button will activate the process & disable the button
  // if the id is valid then reenable at the end of the process
  $("#startCollection").on("click", function() {
    var tvID = $("#showID").val();
    console.log(proxy + myUrl + $("#showID").val());
    if (checkPattern(tvID)) {
      // $("#startCollection").enabled(false);
      bar.animate(.01);
      $("#myDiv").empty();
      mapArray = new Array();
      showArray = new Array();
      findSeasonNums(proxy + myUrl + $("#showID").val());
    }
  });


  // The TV id must match IMDB's of two t characters and 8 following digits
  // This can easily be accomplished through a regex match
  function checkPattern(tvID) {
    if (tvID.toLowerCase().match(/(tt)(\d{7}|\d{6})$/g)) {
      console.log("cool1");
      return true;
    } else {
      console.log("cool2");
      return false;
    }
  }


  function makeGraph(mapArray) {
    var content = $("#myDiv");
    var xVal;
    var yVal;
    var data = new Array();
    var episode = 1;
    var meanScore = Number((showArray.reduce(add, 0) / showArray.length).toFixed(2));
    console.log(meanScore);

    var bestFit = findLineBestFit(showArray); // Returns two points
    data.push(bestFit);

    var mean = {
      x: Array.apply(null, Array(showArray.length)).map(function(x, i) {
        return (i + 1);
      }),
      y: Array.apply(null, Array(showArray.length)).map(function(x, i) {
        return meanScore;
      }),
      mode: 'lines',
      name: "Mean Rating"
    };

    data.push(mean);

    for (var i = 0; i < mapArray.length; i++) {
      xVal = new Array();
      yVal = new Array();

      console.log("Season " + (i + 1) + " " + mapArray[i].size);

      for (var p = 0; p < mapArray[i].size; p++) {
        xVal.push(episode);
        yVal.push(mapArray[i].get(p));
        episode++;
      }

      console.log(data);
      var spots = {
        x: xVal,
        y: yVal,
        mode: 'lines+markers',
        type: 'scatter',
        name: "Season " + (i + 1)
      }
      data.push(spots);
    }

    var layout = {};
    Plotly.newPlot('myDiv', data, layout, {
      scrollZoom: true
    });
    console.log("Done!");
  }

  function callData(url, season) {
    if (season != seasons + 1) {
      console.log(url + season + "");

      $.get(url + season + "", function(data) {
        var dfd = jQuery.Deferred();
        var episodeMap = fetchData(data);
        mapArray.push(episodeMap);
        bar.animate(season / seasons);
        return dfd.promise();
      }).then(function() {
        if (season != seasons + 1) {
          callData(url, season + 1)
        }
      });
    } else {
      // console.log(mapArray);
      makeGraph(mapArray)
    }
  }

  // TODO: Check for "The requested URL was not found on our server"
  function fetchData(data) {
    var index = 0;
    var episodeMap = new Map();
    var episodes_cutdown = data.substring(data.indexOf("list detail eplist"), data.indexOf("<hr>") + 3);
    episodes_cutdown = episodes_cutdown.replace(/\s/g, '');
    var split = episodes_cutdown.split("ipl-rating-star__total-votes");
    for (var i = 0; i < split.length - 1; i++) {
      var rating = Number(split[i].substring(split[i].length - 22, split[i].length - 19));
      episodeMap.set(index, rating);
      showArray.push(rating);
      index++;
      // console.log(rating);
    }
    return episodeMap;
  }

  function findSeasonNums(url) {
    console.log(url);
    var promise = $.get(url, function(data) {
      var dfd = jQuery.Deferred();
      // console.log("/title/" + $("#showID").val() + "/episodes?season=");
      var index = data.indexOf("/title/" + $("#showID").val() + "/episodes?season=");
      var numSeasons = data.substring(index + 30, index + 36).replace(/\D/g, '');;
      seasons = Number(numSeasons);
      if (seasons == "0") {
        console.log("Error Found: Single Season Swap")
        seasons = 1;
      }
      console.log("Num Seasons = " + seasons);
      return dfd.promise();
    }).then(function() {
      var finalURL = proxy + myUrl + $("#showID").val() + "/episodes?season=";
      callData(finalURL, 1);
    });
  }

  // Below here is math JavaScript

  // y = 0.03951x + 9.118182
  // tt4508902
  // Returns a data point for the Plotly graph that is the line of best fit
  function findLineBestFit(scoreArray) {
    var n = scoreArray.length;
    var slope = solveSlope(scoreArray);

    var yInter = ((scoreArray.reduce(add, 0) / n) - (slope * ((n * (n + 1)) / 2) / n));

    var bestFit = {
      x: Array.apply(null, Array(n)).map(function(x, i) {
        return (i + 1);
      }),
      y: Array.apply(null, Array(showArray.length)).map(function(x, i) {
        return Number(((slope * (i+1) + yInter).toFixed(2)));
      }),
      mode: 'lines',
      name: "Mean Rating"
    };

    return bestFit;
  }

  function solveSlope(scores) {
    // We need to solve for Sum(xy), n*xAvg*yAvg, Sum(x^2), n*xAvg^2
    var n = scores.length;

    var xSum = ((n * (n + 1)) / 2);

    var xAvg = xSum / n;
    var yAvg = scores.reduce(add, 0) / n;

    // Sum(xy)
    var multTogether = multSum(scores);

    var avgMults = n * (xAvg * yAvg);

    // Sum(x^2)
    var xSquareSum = (n * (n + 1) * (2 * n + 1)) / 6;

    var avgSquare = n * (Math.pow(xAvg, 2));

    var slope = (multTogether - avgMults) / (xSquareSum - avgSquare);

    return slope;
  }

  function multSum(scores) {
    var total = 0;
    for (var i = 0; i < scores.length; i++) {
      total += (i + 1) * scores[i];
    }
    return total;
  }

  function add(a, b) {
    return a + b;
  }


  function init() {
    bar = new ProgressBar.SemiCircle(container, {
      strokeWidth: 6,
      color: '#FFEA82',
      trailColor: '#eee',
      trailWidth: 1,
      duration: 300,
      svgStyle: null,
      text: {
        value: '',
        alignToBottom: false
      },
      from: {
        color: '#FFEA82'
      },
      to: {
        color: '#ED6A5A'
      },
      // Set default step function for all animate calls
      step: (state, bar) => {
        bar.path.setAttribute('stroke', state.color);
        var value = Math.round(bar.value() * 100);
        if (value === 0) {
          bar.setText('');
        } else {
          bar.setText(value);
        }

        bar.text.style.color = state.color;
      }
    });
    bar.text.style.fontFamily = '"Raleway", Helvetica, sans-serif';
    bar.text.style.fontSize = '2rem';
  }

});
