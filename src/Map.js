// requires:
//    - index.html (nodes, destinations, masters, UI-interface)
//    - https://maps.googleapis.com/maps/api/js?sensor=false
//    - src/MarkerWithLabel.js
//    - src/Coordinates.js
//    - src/Node.js

// Google Maps wrapper
function Map() {
	// map variables
	var that = this, endCallback, lastFitTime = new Date();
	var mapNodes = [], mapDestinations = [], polyline, mapRefresh, running = false;
	var map = new google.maps.Map(document.getElementById('map'), {
		zoom: 3,
		tilt: 0,
		scaleControl: true,
		streetViewControl: false,
		center: new google.maps.LatLng(20, 0),
		//mapTypeId: google.maps.MapTypeId.HYBRID,
		panControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
		zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
		mapTypeControlOptions: {
			style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
			position: google.maps.ControlPosition.RIGHT_BOTTOM
		}
	});
	map.controls[google.maps.ControlPosition.RIGHT_TOP].push(document.getElementById('tilt'));
	map.controls[google.maps.ControlPosition.RIGHT_TOP].push(document.getElementById('fullscreen'));
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(document.getElementById('controls'));
	
	this.init = function (end) {
		endCallback = end;
		// reset old setting
		for (var i in mapDestinations)
			for (var j in mapDestinations[i])
				mapDestinations[i][j].setMap(null);
		for (var i in mapNodes)
			for (var j in mapNodes[i])
				mapNodes[i][j].setMap(null);
		mapDestinations = [];
		mapNodes = [];
		// initialiaze new settings
		if (destinations.length + nodes.length <= 0) return;
		map.setMapTypeId(google.maps.MapTypeId.HYBRID);
		var bounds = new google.maps.LatLngBounds();
		for (var i in destinations) bounds.extend(destinations[i].toGoogleMaps());
		for (var i in nodes) bounds.extend(nodes[i].position().coordinates.toGoogleMaps());
		map.setCenter(bounds.getCenter());
		map.fitBounds(bounds);
		lastFitTime = new Date();
		this.start();
	}
	this.start = function () {
		running = true;
		for (var i in nodes) nodes[i].start();
		mapRefresh = setInterval(function () {
			if (masters.length == 0) {
				that.stop();
				if (endCallback) endCallback();
			} else draw();
		}, parseInt(document.getElementById('mapRefresh').value));
		draw();
	}
	this.stop = function () {
		running = false;
		clearInterval(mapRefresh);
		for (var i in nodes) nodes[i].stop();
	}
	
	function getScale(latitude) {
		return Math.pow(2, map.getZoom()) / 156543.03392 / (!latitude ? 1 : Math.cos(latitude * Math.PI / 180));
	}
	function svgArcedTriangle(r, h, overture) {
		var cosOverture = Math.cos(overture / 2);
		var sinOverture = Math.cos(overture / 2);
		var point1 = [ r * cosOverture, r * sinOverture ];
		var point2 = [ r * cosOverture, - r * sinOverture ];
		var point3 = [ r + h, 0 ];
		return	'M' + point1.join(',') +
				' A' + [ r, r ].join(',') + ' 0 0,0 ' + point2.join(',') +
				' L' + point3.join(',') +
				' L' + point1.join(',');
	}
	function draw() {
		// not intialized yet
		if (destinations.length + nodes.length <= 0) return;
		var scale, nodesGM = nodes.map(function (value) { return value.position().coordinates.toGoogleMaps(); });
		// destinations
		for (var i = 0; i < destinations.length; i++) {
			var destination = destinations[i].toGoogleMaps();
			scale = getScale(destination.lat());
			if (!mapDestinations[i])
				mapDestinations[i] = {
					text: new MarkerWithLabel({
						map: map,
						position: destination,
						clickable: false,
						icon: { path: '', zIndex: 1 },
						labelContent: i.toString(),
						labelClass: 'text destination',
						labelStyle: { 'font-size': 3 * scale + 'px' },
						labelAnchor: new google.maps.Point(50, -1.3 * scale)
					}),
					circle: new google.maps.Circle({
						map: map,
						center: destination,
						radius: 1,
						fillColor: 'red',
						fillOpacity: 0.9,
						strokeColor: '#900',
						strokeWeight: 1,
						strokeOpacity: 1,
						clickable: false,
						zIndex: 1
					}),
					pin: new google.maps.Marker({
						map: map,
						position: destination,
						clickable: false,
						icon: {
							url: document.getElementById('destination').src,
							anchor: new google.maps.Point(7, 28),
							zIndex: 1
						}
					})
				};
			else {
				mapDestinations[i].text.labelStyle = { 'font-size': 3 * scale + 'px' };
				mapDestinations[i].text.labelAnchor = new google.maps.Point(50, -1.3 * scale);
			}
		}
		// nodes
		for (var i = 0; i < nodes.length; i++) {
			var center = nodesGM[i];
			var orientation = -Math.toDegrees(nodes[i].position().orientation);
			scale = getScale(center.lat());
			if (!mapNodes[i])
				mapNodes[i] = {
					text: new MarkerWithLabel({
						map: map,
						position: center,
						clickable: false,
						icon: { path: '', zIndex: 3 },
						labelContent: i.toString(),
						labelClass: 'text node',
						labelStyle: { 'font-size': 2 * scale + 'px' },
						labelAnchor: new google.maps.Point(50, -scale)
					}),
					point: new google.maps.Circle({
						map: map,
						center: center,
						radius: 0.5,
						fillColor: '#5bc0de',
						fillOpacity: 1,
						strokeColor: '#004F74',
						strokeWeight: 1,
						strokeOpacity: 1,
						clickable: false,
						zIndex: 3
					}),
					coverage: new google.maps.Circle({
						map: map,
						center: center,
						radius: parseInt(document.getElementById('coverage').value),
						fillColor: 'green',
						fillOpacity: 0.2,
						strokeColor: 'green',
						strokeWeight: 1,
						strokeOpacity: 0.5,
						clickable: false,
						zIndex: 0
					}),
					orientation: new google.maps.Marker({
						map: map,
						position: center,
						clickable: false,
						icon: {
							path: svgArcedTriangle(scale * 2 / 3, scale * 2 / 3, Math.PI / 2),
							rotation: orientation,
							fillColor: '#5bc0de',
							fillOpacity: 1,
							strokeColor: '#004F74',
							strokeWeight: 1,
							strokeOpacity: 1,
							zIndex: 3
						}
					})
				};
			else {
				mapNodes[i].text.setPosition(center);
				mapNodes[i].text.labelStyle = { 'font-size': 3 * scale + 'px' };
				mapNodes[i].text.labelAnchor = new google.maps.Point(50, 5 * scale);
				mapNodes[i].point.setCenter(center);
				mapNodes[i].coverage.setCenter(center);
				var icon = mapNodes[i].orientation.icon;
				icon.path = svgArcedTriangle(scale * 2 / 3, scale * 2 / 3, Math.PI / 2);
				icon.rotation = orientation;
				mapNodes[i].orientation.setIcon(icon);
				mapNodes[i].orientation.setPosition(center);
			}
		}
		// lines
		if (!polyline)
			polyline = new google.maps.Polyline({
				map: map,
				path: nodesGM,
				geodesic: true,
				strokeColor: '#000',
				strokeOpacity: 1,
				strokeWeight: 1,
				clickable: false,
				zIndex: 2
			});
		else polyline.setPath(nodesGM);
		// fit bounds
		if (running && document.getElementById('follow').checked && new Date().getTime() - lastFitTime.getTime() > 100) {
			lastFitTime = new Date();
			var bounds = new google.maps.LatLngBounds();
			for (var i in destinations) bounds.extend(destinations[i].toGoogleMaps());
			for (var i in nodes) bounds.extend(nodes[i].position().coordinates.toGoogleMaps());
			map.fitBounds(bounds);
		}
	}
	
	// listeners
	google.maps.event.addListener(map, 'zoom_changed', draw);
	google.maps.event.addListener(map, 'idle', function () {
		document.getElementById('start').focus();
	});
	document.getElementById('tilt').addEventListener('click', function () {
		map.setTilt((map.getTilt() + 45) % 90);
	});
	document.getElementById('fullscreen').addEventListener('click', function () {
		var mapDiv = document.getElementById('map');
		var prefixes = [ '', 'moz', 'webkit', 'o', 'ms' ];
		for (var i in prefixes) {
			var prefix = prefixes[i];
			if (typeof mapDiv[prefix + 'RequestFullScreen'] != 'undefined') {
				mapDiv[prefix + (document[prefix + 'IsFullScreen'] ? 'Cancel' : 'Request') + 'FullScreen']();
				break;
			}
		}
	});
	document.getElementById('mapRefresh').addEventListener('change', function () {
		clearInterval(mapRefresh);
		if (running) that.start();
	});
}