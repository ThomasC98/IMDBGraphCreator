$(function() {

  var proxy = 'https://cors-anywhere.herokuapp.com/'; // used to bypass browser CORS
  var myUrl = 'https://www.imdb.com/title/'; // IMDB's link to their show titles
  var mapArray = new Array(); // Used to hold the arrays of each season's scores
  var showArray = new Array(); // Used to hold the arrays of each episode's score
  var seasons; // Used to hold the number of seasons
  var bar; // The increasing bar that show's load %
  var titleGrabbed = false;

  init();

  // Initialize the progress bar
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

  // On the click of the button will activate the process & disable the button
  // if the id is valid then reenable at the end of the process
  $("#startCollection").on("click", function() {
    var tvID = $("#showID").val();
    if (checkPattern(tvID)) {
      // $("#startCollection").enabled(false);

      bar.animate(.01);
      $("#myDiv").empty();
      titleGrabbed = false;
      mapArray = new Array();
      showArray = new Array();
      $("#titleText").text("Show Title Here");
      findSeasonNums(proxy + myUrl + $("#showID").val());
    }
  });


  // The TV id must match IMDB's of two t characters and 8 following digits
  // This can easily be accomplished through a regex match
  function checkPattern(tvID) {
    if (tvID.toLowerCase().match(/(tt)(\d{7}|\d{6})$/g)) {
      return true;
    } else {
      return false;
    }
  }

  // Makes the graph for a respective show by using IMDB page info
  function makeGraph(mapArray) {
    var content = $("#myDiv");
    var xVal;
    var yVal;
    var data = new Array();
    var episode = 1;
    var meanScore = Number((showArray.reduce(add, 0) / showArray.length).toFixed(2));

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
      var seasonAverageNum = 0;
      var startEpisode = episode;

      for (var p = 0; p < mapArray[i].size; p++) {
        seasonAverageNum += mapArray[i].get(p);
        xVal.push(episode);
        yVal.push(mapArray[i].get(p));
        episode++;
      }
      seasonAverageNum = Number((seasonAverageNum / mapArray[i].size)).toFixed(2);

      var seasonAvg = {
        x: Array.apply(null, Array(mapArray[i].size)).map(function(x, i) {
          return (i + startEpisode);
        }),
        y: Array.apply(null, Array(mapArray[i].size)).map(function(x, i) {
          return (seasonAverageNum)
        }),
        mode: 'lines',
        type: 'scatter',
        name: "Season " + (i + 1) + " Avg"
      }

      var spots = {
        x: xVal,
        y: yVal,
        mode: 'lines+markers',
        type: 'scatter',
        name: "Season " + (i + 1)
      }
      data.push(spots);
      data.push(seasonAvg);
    }

    var layout = {};
    Plotly.newPlot('myDiv', data, layout, {
      scrollZoom: true
    });
  }

  // Calls the information for that respective show's season
  function callData(url, season) {
    if (season != seasons + 1) {

      $.get(url + season + "", function(data) {
        var dfd = jQuery.Deferred();

        mapArray.push(fetchData(data));
        bar.animate(season / seasons);

        return dfd.promise();
      }).then(function() {
        if (season != seasons + 1) {
          callData(url, season + 1)
        }
      });
    } else {
      makeGraph(mapArray)
    }
  }

  function callTitle(url) {
    $.get(url, function(data) {
      var dfd = jQuery.Deferred();
      if (!(data.includes("The requested URL was not found on our server")) && !(titleGrabbed)) {
        var titleCut = data.substring(data.indexOf('class="title_wrapper"') + 36, data.indexOf('</h1>')).replace('&nbsp;', '');
        $("#titleText").text(titleCut);
        titleGrabbed = true;
      }
      return dfd;
    }).catch(function() {
      console.log("Error Title");
    })
  }

  function fetchData(data) {
    if (!(data.includes("The requested URL was not found on our server"))) {
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
      }
      return episodeMap;
    }
    return null;
  }

  function findSeasonNums(url) {
    var finalURL = proxy + myUrl + $("#showID").val();
    var promise = $.get(url, function(data) {
      var dfd = jQuery.Deferred();
      var index = data.indexOf("/title/" + $("#showID").val() + "/episodes?season=");
      var numSeasons = data.substring(index + 30, index + 36).replace(/\D/g, '');;
      seasons = Number(numSeasons);
      if (seasons == "0") {
        seasons = 1;
      }
      return dfd.promise();
    }).then(function() {
      callTitle(finalURL);
    }).then(function() {
      callData(finalURL + "/episodes?season=", 1);
    });
  }

  // Below here is JavaScript Math
  // Ex: tt4508902 (One Punch Man)
  // y = 0.03951x + 9.118182

  // Returns data points for the Plotly graph that is the line of best fit
  function findLineBestFit(scoreArray) {
    var n = scoreArray.length;
    var slope = solveSlope(scoreArray);

    var yInter = ((scoreArray.reduce(add, 0) / n) - (slope * ((n * (n + 1)) / 2) / n));

    var bestFit = {
      x: Array.apply(null, Array(n)).map(function(x, i) {
        return (i + 1);
      }),
      y: Array.apply(null, Array(showArray.length)).map(function(x, i) {
        return Number(((slope * (i + 1) + yInter).toFixed(2)));
      }),
      mode: 'lines',
      name: "Best Fit"
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

  // Multiply all scores by their respective season
  function multSum(scores) {
    var total = 0;
    for (var i = 0; i < scores.length; i++) {
      total += (i + 1) * scores[i];
    }
    return total;
  }

  // Used as the function to shorten array addition
  function add(a, b) {
    return a + b;
  }

});
