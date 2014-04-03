// require:
//    - src/Coordinates.js (math utilities)
//    - index.html (nodes, obstacles)

// distances and bearings cache
// prenvent compute multiple times distances between nodes and obstacles
var sensorsCache = [];

// (Simulated) sensor class
function Sensor(node, number, position, beam, distance) {
	
	var node		= node;			// node number (ID)
	var number		= number;		// sensor number (ID)
	var position	= position;		// angle where the sensor is located, in radians (clockwise from North orientation of the UAV)
	var beam		= beam;			// beam width
	var distance	= distance;		// maximum distance
	
	var obstacleRadius = 2;			// cylindric obstacle radius
	
	// initialize distances cache
	if (!sensorsCache[node]) sensorsCache[node] = [];
	
	function stdAngleRange(angle) { return (angle + 2 * Math.PI) % (2 * Math.PI); }
	function getDistances() {
		var nodeCoordinates = nodes[node].position().coordinates;
		// sensor zero revalidate distances cache every time
		if (number == 0) {
			sensorsCache[node] = [];
			for (var i in nodes)
				if (i != node) {
					var coordinates = nodes[i].position().coordinates;
					sensorsCache[node].push({
						bearing: stdAngleRange(nodeCoordinates.initialBearingTo(coordinates)),
						distance: nodeCoordinates.greatCircleDistanceTo(coordinates)
					});
				}
			for (var i in obstacles)
				sensorsCache[node].push({
					bearing: stdAngleRange(nodeCoordinates.initialBearingTo(obstacles[i])),
					distance: nodeCoordinates.greatCircleDistanceTo(obstacles[i]) - obstacleRadius
				});
		}
		return sensorsCache[node];
	}
	
	this.getPosition = function () { return position; }
	this.getValue = function () {
		var minDistance = null;
		var distances = getDistances();
		var absPosition = stdAngleRange(nodes[node].position().orientation - position);
		for (var i in distances) {
			// check if the sensor "looks" in that way
			if (distances[i].bearing > absPosition + beam ||
				distances[i].bearing < absPosition - beam) continue;
			// check if the node's too far to be detected
			if (distances[i].distance > distance) continue;
			// node detected by sensor, compute minimum distance
			minDistance = Math.min([ minDistance, distances[i].distance ].filter(function (v) { return v; }));
		}
		return minDistance;
	}
}