// Math utilites
Math.degToRadConst = Math.PI / 180;
Math.toRadians = function (angle) { return angle * Math.degToRadConst; }
Math.toDegrees = function (angle) { return angle / Math.degToRadConst; }

// Geo-coordinates
function Coordinates(lat, lng, alt) {
	this.lat = lat || 0;
	this.lng = lng || 0;
	this.alt = alt || 0;
	
	var earthRadius = 6378137;
	var eccentricity = 0.081819190842622;
	var clockwiseUsage = false; // from North
	// conversions
	this.toGoogleMaps = function () {
		return google && google.maps ? new google.maps.LatLng(this.lat, this.lng) : null;
	}
	this.toEquirectangularProjection = function () {
		var rLat = Math.toRadians(this.lat);
		return {
			x: earthRadius * Math.cos(rLat) * Math.toRadians(this.lng),
			y: earthRadius * rLat,
			z: this.alt
		};
	}
	this.fromEquirectangularProjection = function (point) {
		this.lat = Math.toDegrees(point.y / earthRadius);
		this.lng = Math.toDegrees(point.x / (earthRadius * Math.cos(Math.toRadians(this.lat))));
		this.alt = point.z;
		return this;
	}
	this.toMercatorProjection = function () {
		var rLat = Math.toRadians(Math.min(89.5, Math.max(-89.5, this.lat)));
		var eSinLat = eccentricity * Math.sin(rLat);
		return {
			x: earthRadius * Math.toRadians(this.lng),
			y: earthRadius * Math.log(Math.tan(Math.PI / 4 + rLat / 2) * Math.pow((1 - eSinLat) / (1 + eSinLat), eccentricity / 2)),
			z: this.alt
		};
	}
	this.fromMercatorProjection = function (point) {
		var halfPI = Math.PI / 2;
		var expYR = Math.exp(point.y / earthRadius);
		var lat = 2 * Math.atan(expYR) - halfPI;
		for (var i = 0, dLat = 1; Math.abs(dLat) > 1e-20 && i < 20; i++) {
			var eSinLat = eccentricity * Math.sin(lat);
			dLat = 2 * Math.atan(expYR / Math.pow((1 - eSinLat) / (1 + eSinLat), eccentricity / 2)) - halfPI - lat;
			lat += dLat;
		}
		this.lat = Math.toDegrees(lat);
		this.lng = Math.toDegrees(point.x / earthRadius);
		this.alt = point.z;
		return this;
	}
	this.toMercatorProjectionVariant = function () {
		var rLat = Math.toRadians(Math.min(89.5, Math.max(-89.5, this.lat)));
		var eSinLat = eccentricity * Math.sin(rLat);
		var scaledRadius = earthRadius * Math.cos(rLat);
		return {
			x: scaledRadius * Math.toRadians(this.lng),
			y: scaledRadius * Math.log(Math.tan(Math.PI / 4 + rLat / 2) * Math.pow((1 - eSinLat) / (1 + eSinLat), eccentricity / 2)),
			z: this.alt
		};
	}
	this.fromMercatorProjectionVariant = function (point, nearestLat) {
		var rLat = Math.toRadians(nearestLat || 0);
		var scaledRadius = earthRadius * Math.cos(rLat);
		var eSinLat = eccentricity * Math.sin(rLat);
		this.lat = Math.toDegrees(2 * Math.atan(Math.exp(point.y / scaledRadius) / Math.pow((1 - eSinLat) / (1 + eSinLat), eccentricity / 2)) - Math.PI / 2);
		this.lng = Math.toDegrees(point.x / scaledRadius);
		this.alt = point.z;
		return this;
	}
	// on a great circle path
	this.greatCircleDistanceTo = function (point) {
		// I don't use haversine formula because it returns bad-conditioned results
		// ** Haversine formula - R. W. Sinnott, "Virtues of the Haversine", Sky and Telescope, vol 68, no 2, 1984
		var cosLat1 = Math.cos(Math.toRadians(this.lat));
		var cosLat2 = Math.cos(Math.toRadians(point.lat));
		var cosLngD = Math.cos(Math.toRadians(Math.abs(point.lng - this.lng)));
		
		var sinLat1 = Math.sin(Math.toRadians(this.lat));
		var sinLat2 = Math.sin(Math.toRadians(point.lat));
		var sinLngD = Math.sin(Math.toRadians(Math.abs(point.lng - this.lng)));
		
		var y = Math.sqrt(Math.pow(cosLat2 * sinLngD, 2) + Math.pow(cosLat1 * sinLat2 - sinLat1 * cosLat2 * cosLngD, 2));
		var x = sinLat1 * sinLat2 + cosLat1 * cosLat2 * cosLngD;
		return earthRadius * Math.atan2(y, x);
	}
	this.initialBearingTo = function (point) {
		var lat1 = Math.toRadians(this.lat);
		var lat2 = Math.toRadians(point.lat);
		var dLng = Math.toRadians(point.lng - this.lng);
		
		var y = Math.sin(dLng) * Math.cos(lat2);
		var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
		var bearing = Math.atan2(y, x);
		return clockwiseUsage ? bearing : -bearing + Math.PI / 2;
	}
	this.finalBearingTo = function (point) {
		return (point.initialBearingTo(this) + (clockwiseUsage ? 1 : -1) * Math.PI) % (2 * Math.PI);
	}
	this.destination = function (bearing, distance) {
		if (!clockwiseUsage) bearing = -bearing + Math.PI / 2;
		var dR = distance / earthRadius;
		var rLat = Math.toRadians(this.lat);
		var lat = Math.asin(Math.sin(rLat) * Math.cos(dR) + Math.cos(rLat) * Math.sin(dR) * Math.cos(bearing));
		var lng = Math.toRadians(this.lng) + Math.atan2(Math.sin(bearing) * Math.sin(dR) * Math.cos(rLat), Math.cos(dR) - Math.sin(rLat) * Math.sin(lat));
		return new Coordinates(Math.toDegrees(lat), Math.toDegrees(lng), this.alt);
	}
	this.middlePointTo = function (point) {
		var lat1 = Math.toRadians(this.lat);
		var lng1 = Math.toRadians(this.lng);
		var lat2 = Math.toRadians(point.lat);
		var dLng = Math.toRadians(point.lng - this.lng);
		
		var Bx = Math.cos(lat2) * Math.cos(dLng);
		var By = Math.cos(lat2) * Math.sin(dLng);
		var lat = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt(Math.pow(Math.cos(lat1) + Bx, 2) + Math.pow(By, 2)));
		var lng = lng1 + Math.atan2(By, Math.cos(lat1) + Bx);
		return new Coordinates(Math.toDegrees(lat), Math.toDegrees(lng), (this.alt + point.alt) / 2);
	}
	// on loxodromic curves
	this.loxodromicDistanceTo = function (point) {
		var lat1 = Math.toRadians(this.lat);
		var dLat = Math.toRadians(point.lat - this.lat);
		var dLng = Math.toRadians(point.lng - this.lng);
		
		var dPhi = Math.log(Math.tan(Math.PI / 4 + Math.toRadians(point.lat) / 2) / Math.tan(Math.PI / 4 + lat1 / 2));
		// E-W line gives dPhi=0
		var q = isFinite(dLat / dPhi) ? dLat / dPhi : Math.cos(lat1);
		// if dLng over 180° take shorter rhumb across anti-meridian
		if (Math.abs(dLng) > Math.PI) dLng += (dLon > 0 ? -1 : +1) * 2 * Math.PI;
		return earthRadius * Math.sqrt(Math.pow(dLat, 2) + Math.pow(q, 2) * Math.pow(dLng, 2));
	}
	this.loxodromicBearingTo = function (point) {
		// on a rhumb line (or loxodrome)
		var dLng = Math.toRadians(point.lng - this.lng);
		var dPhi = Math.log(Math.tan(Math.PI / 4 + Math.toRadians(point.lat) / 2) / Math.tan(Math.PI / 4 + Math.toRadians(this.lat) / 2));
		var bearing = Math.atan2(dLng, dPhi);
		return clockwiseUsage ? bearing : -bearing + Math.PI / 2;
	}
	this.loxodromicMiddlePointTo = function (point) {
		var dLat = Math.toRadians(point.lat - this.lat);
		var dLng = Math.toRadians(point.lng - this.lng);
		
		var lat = (this.lat + point.lat) / 2;
		var f1 = Math.tan(Math.PI / 4 + Math.toRadians(this.lat) / 2);
		var f2 = Math.tan(Math.PI / 4 + Math.toRadians(point.lat) / 2);
		var f3 = Math.tan(Math.PI / 4 + Math.toRadians(lat) / 2);
		var lng = (dLng * Math.log(f3) + Math.toRadians(this.lng) * Math.log(f2) - Math.toRadians(point.lng) * Math.log(f1)) / Math.log(f2 / f1);
		// parallel of latitude
		lng = !isFinite(lng) ? (this.lng + point.lng) / 2 : Math.toDegrees(lng);
		// normalize to [-180, +180°]
		lng = (lng + 540) % 360 - 180;
		return new Coordinates(lat, lng, (this.alt + point.alt) / 2);
	}
}