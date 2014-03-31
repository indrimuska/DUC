// requires:
//    - src/Coordinates.js

// UAV class
function Node(number, coordinates, orientation) {
	// node status
	var number			= number;			// node number (ID)
	var coordinates		= coordinates;		// intial position
	var orientation		= orientation;		// direction angle
	var radius;								// coverage radius
	var nodes;								// number of total nodes
	
	// other vars
	var precision		= 0.01;				// minimum distance from the target (in meters)
	var lastUpdateTime;						// algorithm's time refresh coefficient
	
	// SOM parameters
	var alphaZero		= 1;				// initial learning rate
	var alphaDecay		= 1;
	var sigmaZero;							// initial neighbour radius (initial value must be equal to the nr. of nodes)
	var sigmaDecay		= 0.99;
	var limit			= 0.5;				// reset limit
	var limitDecay		= 0.9;
	var reset;								// reset counter (initial value must be 1)
	
	// target point and neighbour nodes
	var arrival;							// only masters has arrival set
	var prevNode;							// previuous neighbour (if exists)
	var nextNode;							// next neighbour (if exists)
	var command;							// operation to be complete
	
	// mobility parameters
	var control;							// control timer
	var refuseCounter;						// counter for refusing assinged target (initial value must be 0)
	var refuseLimit		= 3;
	var rotationPole	= 0.8;				// LPF pole of rotation
	var movingPole		= 0.8;				// LPF pole of moving
	
	// SOM functions
	function learningRateUpdate() {
		return command.alpha * alphaDecay;
	}
	function neighbourRadiusUpdate() {
		if (command.sigma <= limit) {
			command.alpha = alphaZero;
			command.sigma = sigmaZero;
			limit *= limitDecay;
			reset++;
		}
		return command.sigma * sigmaDecay;
	}
	function neighbourhoodFunction(distance, sigma) {
		return Math.exp(- Math.pow(distance, 2) / (2 * reset * Math.pow(sigma, 2)));
	}
	function isInNeighbourhood(number, winner, sigma) {
		var integerSigma	= Math.ceil(sigma + 1);
		var firstNeighbour	= Math.max(winner - integerSigma, 0);
		var lastNeighbour	= Math.min(winner + integerSigma, nodes - 1);
		return number >= firstNeighbour && number <= lastNeighbour;
	}
	
	// geometrical functions
	function lineParameters(from, to) {
		var m = (to.y - from.y) / (to.x - from.x);
		var q = from.y - m * from.x;
		return { m: m, q: q };
	}
	function parabolaSolutions(a, b, c) {
		var delta = Math.pow(b, 2) - (4 * a * c);
		if (delta < 0) return NaN;
		var x1 = (-b + Math.sqrt(delta)) / (2 * a);
		var x2 = (-b - Math.sqrt(delta)) / (2 * a);
		return [ x1, x2 ];
	}
	function intersectLineAndCircle(line, center, radius, point) {
		if (!Number.isFinite(line.m)) {
			var a = 1;
			var b = -2 * center.y;
			var c = Math.pow(point.x, 2) + Math.pow(center.x, 2) + Math.pow(center.y, 2) - Math.pow(radius, 2) - (2 * point.x * center.x);
			var solutions = parabolaSolutions(a, b, c);
			return [
				{ x: point.x, y: solutions[0], z: 0 },
				{ x: point.x, y: solutions[1], z: 0 }
			];
		}
		var a = 1 + Math.pow(line.m, 2);
		var b = (-2 * center.x) + (2 * line.m * line.q) - (2 * line.m * center.y);
		var c = Math.pow(center.x, 2) + Math.pow(center.y, 2) + Math.pow(line.q, 2) - Math.pow(radius, 2) - (2 * line.q * center.y);
		var solutions = parabolaSolutions(a, b, c);
		var x1 = solutions[0];
		var x2 = solutions[1];
		return [
			{ x: x1, y: (line.m * x1) + line.q, z: 0 },
			{ x: x2, y: (line.m * x2) + line.q, z: 0 }
		];
	}
	function anglesDifference(alpha, beta) {
		var difference = beta - alpha;
		if (difference > Math.PI) difference -= 2 * Math.PI;
		if (difference < -Math.PI) difference += 2 * Math.PI;
		return difference;
	}
	function isInsideCircle(point, center, radius) {
		return point.greatCircleDistanceTo(center) - radius <= precision;
	}
	
	// geometrical functions (2)
	function isArrived(target) {
		return coordinates.greatCircleDistanceTo(target) <= precision;
	}
	function middlePoint() {
		var prev = prevNode ? prevNode.coordinates : coordinates;
		var next = nextNode ? nextNode.coordinates : coordinates;
		return prev.middlePointTo(next);
	}
	function directionPoints(from, to) {
		var points = new Array();
		// start point latituted (required for the Mercator inverse variant)
		var lat = from.lat;
		// projected coordinates
		from = from.toMercatorProjectionVariant();
		to = to.toMercatorProjectionVariant();
		// line parameters
		var line = lineParameters(from, to);
		// intersection points with the previous neighbour
		if (prevNode) points = points.concat(intersectLineAndCircle(line, prevNode.coordinates.toMercatorProjectionVariant(), radius, from));
		// intersection points with the next neighbour
		if (nextNode) points = points.concat(intersectLineAndCircle(line, nextNode.coordinates.toMercatorProjectionVariant(), radius, from));
		// convert from Mercator projection to Geo-coordinates
		for (var i in points) {
			var point = new Coordinates().fromMercatorProjectionVariant(points[i], lat);
			point.alt = (from.alt + to.alt) / 2;
			points[i] = point;
		}
		return points;
	}
	
	// control functions
	function estimateRotation() {
		return parseFloat(document.getElementById('angularVelocity').value) * parseInt(document.getElementById('control').value) / 1000;
	}
	function estimateMoving() {
		return parseFloat(document.getElementById('velocity').value) * parseInt(document.getElementById('control').value) / 1000;
	}
	function getOrientation(target) {
		// angle in direction of the target
		var ptAngle = coordinates.initialBearingTo(target);
		// difference between the two angles (with sign)
		var difference = anglesDifference(orientation, ptAngle);
		// direction of rotation
		var moltiplier = difference >= 0 ? +1 : -1;
		// absolute rotation angle
		difference = Math.min(estimateRotation(), Math.abs(difference));
		// new orientation angle
		return orientation + difference * moltiplier;
	}
	function getTargetPoint(destination, master, alpha, sigma, phi) {
		// check if the node falls in the neighborhood of master +/- sigma
		if (!isInNeighbourhood(number, master, sigma)) return false;
		// if master is arrived, it doesn't move
		if (arrival && isArrived(arrival)) return false;
		// angle of destination point
		var direction = coordinates.initialBearingTo(destination);
		// compute maximum distance
		var distance = alpha * phi * Math.min(estimateMoving(), coordinates.greatCircleDistanceTo(destination));
		// compute (imminent) target
		var target = coordinates.destination(direction, distance);
		// check if the target is inside the circles of neighbours
		if ((!prevNode || isInsideCircle(target, prevNode.coordinates, radius)) &&
			(!nextNode || isInsideCircle(target, nextNode.coordinates, radius)))
			return target;
		// compute new points of intersection between neighbour circles and the line in the direction of the target
		var points = directionPoints(coordinates, target);
		// choose the one inside both circles (at most 2) and in the right direction (only one)
		for (var i = 0; i < points.length; i++) {
			var point = points[i];
			var isInsidePrev = !prevNode || isInsideCircle(point, prevNode.coordinates, radius);
			var isInsideNext = !nextNode || isInsideCircle(point, nextNode.coordinates, radius);
			var sameDirection = coordinates.initialBearingTo(point) - direction <= precision;
			if (isInsidePrev && isInsideNext && sameDirection && !isArrived(point))
				return point;
		}
		// no target found
		return false;
	}
	
	// simulation functions
	function simulateRotation(rotation) {
		return (1 - rotationPole) * orientation + rotationPole * rotation;
	}
	function simulateMoving(destination) {
		return new Coordinates(
			(1 - movingPole) * coordinates.lat + movingPole * destination.lat,
			(1 - movingPole) * coordinates.lng + movingPole * destination.lng,
			(1 - movingPole) * coordinates.alt + movingPole * destination.alt
		);
	}
	
	// main
	function main() {
		// check if target exists
		if (!command.target) return;
		// update position (or just rotate)
		move(command.target, command.master, command.alpha, command.sigma);
		// only for masters
		if (!arrival) return;
		// destination reached
		if (isArrived(arrival)) {
			console.log("ARRIVED", number);
			// inform other nodes
			sendUpdate('all', number, arrival);
			// stop
			clearInterval(control);
			// to stop the UI after the last node is arrived
			for (var i in masters)
				if (masters[i] == number) {
					masters.splice(i, 1);
					break;
				}
			// exit
			return;
		}
		// time until last update
		var time = new Date().getTime() - lastUpdateTime.getTime();
		// check if algorithm have to update his parameters
		if (time < parseInt(document.getElementById('algorithm').value)) return;
		// update neighbours
		sendUpdate('all', number, arrival, command.alpha, command.sigma);
		// update coefficients
		lastUpdateTime = new Date();
		command.alpha = learningRateUpdate();
		command.sigma = neighbourRadiusUpdate();
	}
	function move(target, master, alpha, sigma) {
		var rotation, destination;
		// calculate possible destinations (middle point is for prevent deadlock on moving)
		var destinations = arrival ? [ arrival ] : [ target, middlePoint() ];
		//destinations = [ target, middlePoint() ];
		// neighbourhood constant
		var phi = neighbourhoodFunction(number - master, sigma);
		// iteration possible destinations
		for (var i in destinations) {
			// calculate destination angle
			rotation = getOrientation(destinations[i]);
			// calculate destination inside neighobur circles
			destination = getTargetPoint(destinations[i], master, alpha, sigma, phi);
			// destination founded
			if (destination) break;
		}
		// rotate
		orientation = simulateRotation(rotation);
		// no destinations avaibles
		if (!destination) return;
		// move to the final destination
		coordinates = simulateMoving(destination);
		// inform other nodes
		sendPosition(number);
	}
	
	// networking functions
	function send(to, message) {
		message = JSON.stringify(message);
		to.receive(message);
	}
	function sendNeighbours(message) {
		// sends the message to the next and previous node
		if (prevNode) send(prevNode, message);
		if (nextNode) send(nextNode, message);
	}
	function sendPosition(master) {
		// inform the nodes that I have changed position
		sendNeighbours({ text: 'new-position', node: number, position: coordinates, orientation: orientation });
	}
	function sendMessageSelective(to, message) {
		// mastes send the message to both neighbours
		if (to == 'all') sendNeighbours(message);
		// other nodes send the message "on cascade"
		else {
			if (prevNode.number == to) send(prevNode, message);
			if (nextNode.number == to) send(nextNode, message);
		}
	}
	function sendUpdate(to, master, target, alpha, sigma) {
		// telling others to move
		sendMessageSelective(to, { text: 'update', node: number, master: master, target: target, alpha: alpha, sigma: sigma });
	}
	function sendArrived(to, winner, target) {
		// telling others the master is arrived
		sendMessageSelective(to, { text: 'arrived', node: number, master: master, target: target });
	}
	
	// neighbour class
	function Neighbour(number, coordinates, orientation, receive) {
		this.number			= number;
		this.coordinates	= coordinates;
		this.orientation	= orientation;
		this.receive		= receive;
	}
	
	// public methods
	this.init = function (iRadius, iNodes, iPrevNode, iNextNode, iArrival) { // damned Apple, "i" stands for "input"
		// stop previous execution
		this.stop();
		// reset old values
		reset = 1;
		prevNode = null;
		nextNode = null;
		refuseCounter = 0;
		lastUpdateTime = new Date();
		command = { target: null, master: null, alpha: null, sigma: null };
		// new values
		radius	= iRadius;
		nodes	= iNodes;
		arrival	= iArrival || null;
		sigmaZero = nodes;
		// neighbours
		if (number > 0) prevNode = new Neighbour(number - 1, iPrevNode.coordinates, iPrevNode.orientation, iPrevNode.receive);
		if (number < nodes-1) nextNode = new Neighbour(number + 1, iNextNode.coordinates, iNextNode.orientation, iNextNode.receive);
		// master's settings
		if (arrival) command = { target: arrival, master: number, alpha: alphaZero, sigma: sigmaZero };
	}
	this.start = function () {
		// start timer
		control = setInterval(main, parseInt(document.getElementById('control').value));
		// start first computation
		main();
	}
	this.stop = function () {
		clearInterval(control);
		control = false;
	}
	this.restart = function () {
		this.stop();
		this.start();
	}
	this.receive = function (message) {
		setTimeout(function () {
			try {
				message = JSON.parse(message);
				switch (message.text) {
					case 'new-position':
						message.position = new Coordinates(message.position.lat, message.position.lng, message.position.alt);
						if (prevNode && prevNode.number == message.node) {
							prevNode.coordinates = message.position;
							prevNode.orientation = message.orientation;
						}
						if (nextNode && nextNode.number == message.node) {
							nextNode.coordinates = message.position;
							nextNode.orientation = message.orientation;
						}
						break;
					case 'update':
						message.target = new Coordinates(message.target.lat, message.target.lng, message.target.alt);
						// masters stop propagation
						if (arrival) return;
						// target already set
						if (command.target && command.target != message.target && ++refuseCounter > refuseLimit)
							refuseCounter = 0;
						// update command
						if (refuseCounter == 0)
							for (var i in command)
								command[i] = message[i];
						// update NEXT neighbour (by propagation)
						var next = 2 * number - message.node;
						sendUpdate(next, message.master, message.target, message.alpha, message.sigma);
						break;
					case 'arrived':
						message.target = new Coordinates(message.target.lat, message.target.lng, message.target.alt);
						// masters stop propagation
						if (arrival) return;
						// remove target
						if (command.target == message.target) command.target = null;
						// inform NEXT neighbour (by propagation)
						var next = 2 * number - message.node;
						sendArrived(next, message.master, message.target);
						break;
				}
			} catch (e) {
				console.error(e);
			}
		}, 1);
	}
	this.position = function () {
		return {
			coordinates: coordinates,
			orientation: orientation
		};
	}
	this.getDestination = function () { return arrival; }
}