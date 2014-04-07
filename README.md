# Distributed UAVs Coordinator

<abbr title="Distributed UAVs Coordinator">DUC</abbr> is a distributed coordinator system that allows <abbr title="Unmanned Aerial Vehicle">UAV</abbr>s to communicate each others to preserve connectivity between two or more distant points, using the drones to form a wireless bridge across the points.

The drones are interconnected to form a single line, so that we can assign them an identification number. Each node can communicate only with adjacent nodes.

The output shows a map using [Google Maps API v3](https://developers.google.com/maps/).

To see DUC in action [click here](https://rawgithub.com/indrimuska/DUC/master/index.html).

## Legend

- **Node:** an autonomous system
- **Master:** a special node that has to reach a prefixed destination
- **Destination:** a geographic point that have to be reached by a master

## Idea

The main concept behind this project is to adapt [Self-Organizing Maps](http://en.wikipedia.org/wiki/Self-organizing_map) to produce an algorithm that evolves himself through the nodes and not thanks to a central communication unit. That's because SOMs are not distributed, in the sense that to choose the winner at each iteration you have to compute the distance from the input (in this case, inputs are the **destinations**) to the output neurons (2nd neurons layer models the **nodes**). This is also the main problem to make SOMs distributed.

To prevent global choosing of the winner at each iteration, masters are elected before initialization of the network and each of them has a personal prefixed destination to reach that cannot be changed. Masters are the *smart nodes* and they deals to assign command to the other *thin nodes*.

The main requirement is to **avoid breakage of the network line**. The nodes must be distant from each other not more than the distance of wireless coverage radius.

## Code

DUC provides several classes written in `javascript` to model position of nodes and destinations in a geographic coordinate system (longitude and latitude) and to refresh the map every prefixed time period.

### Coordinates

This class models the position of a point on the earth's surface given the latitude, the longitude and the altitude. It also provides several methods to help calculation of common problems in spherical trigonometry (in particular, in [WGS84](http://en.wikipedia.org/wiki/WGS84) geodesic system).

> **Note:** although the constructor requires the altitude as third attribute, it's not fully supported, yet.

#### Great-circle distance ([ref.](http://en.wikipedia.org/wiki/Great_circle_distance))

Computes the shortest distance between two points ![Start point](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20P_1%3D(%5Cphi_1%2C%5Clambda_1)) and ![End point](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20P_2%3D(%5Cphi_2%2C%5Clambda_2)), where ![Longitude](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20%5Cphi_i) and ![Latitude](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20%5Clambda_i) are the latitudes and the longitudes, respectively. It doesn't make use of the [Haversine Formula](http://en.wikipedia.org/wiki/Haversine_formula) because it is ill-conditioned if two points are very nearly antipodal, but it uses a special case of the [Vincenty formula](http://en.wikipedia.org/wiki/Vincenty%27s_formulae). Let ![Delta Phi](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20%5CDelta%5Cphi) and ![Delta Lambda](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20%5CDelta%5Clambda) the differences of latitude and longitude; then the distance ![d](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20d) between the two points is given by:

<p align="center"><img alt="Great-circle distance" src="http://latex.codecogs.com/png.latex?d%3DR%5Ccdot%5Carctan%5Cleft%28%5Cfrac%7B%5Csqrt%7B%5Cleft%28%5Ccos%5Cphi_2%5Ccdot%5Csin%5CDelta%5Clambda%5Cright%29%5E2&plus;%5Cleft%28%5Ccos%5Cphi_1%5Ccdot%5Csin%5Cphi_2-%5Csin%5Cphi_1%5Ccdot%5Ccos%5Cphi_2%5Ccdot%5Ccos%5CDelta%5Clambda%5Cright%29%5E2%7D%7D%7B%5Csin%5Cphi_1%5Ccdot%5Csin%5Cphi_2&plus;%5Ccos%5Cphi_1%5Ccdot%5Ccos%5Cphi_2%5Ccdot%5Ccos%5CDelta%5Clambda%7D%5Cright%29" /></p>

<p align="center"><img alt="Great circle distance" src="https://cloud.githubusercontent.com/assets/1561134/2566357/7195d0bc-b8c3-11e3-9630-05287cc92a5c.png" /></p>

#### Initial and final bearing

Since the heading vary along the great-circle path, `Coordinates` provides two methods to computes the initial and the final bearing, given the start and final point on an orthodromic line.

<p align="center"><img alt="Initial and final bearing" src="http://latex.codecogs.com/png.latex?%5Cbegin%7Balign*%7D%5CTheta_%7Binitial%7D%5Cleft%28P_1%2CP_2%5Cright%29%26%3D%5Carctan%5Cleft%28%5Cfrac%7B%5Ccos%5Cphi_2%5Ccdot%5Csin%5CDelta%5Clambda%7D%7B%5Ccos%5Cphi_1%5Ccdot%5Csin%5Cphi_2-%5Csin%5Cphi_1%5Ccdot%5Ccos%5Cphi_2%5Ccdot%5Ccos%5CDelta%5Clambda%7D%5Cright%29%5C%5C%20%5CTheta_%7Bfinal%7D%5Cleft%28P_1%2CP_2%5Cright%29%26%3D%5CTheta_%7Binitial%7D%5Cleft%28P_2%2CP_1%5Cright%29&plus;%5Cpi%5Cend%7Balign%7D" /></p>

> **Note:** result angles are given in radians and they are calculated by default using an *anticlockwise reference from East*. If you want to use the standard clockwise reference from North, commonly used in navigation, you have to set ([here](../blob/master/src/Coordinates.js#L13)):
```javascript
Coordinates.clockwiseUsage = true;
```

#### Destination

Calculates the destination point, given the start point ![Start point](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20P%3D%28%5Cphi%2C%5Clambda%29) and the initial bearing ![Initial bearing](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20%5CTheta) (in radians).

<p align="center"><img alt="Destination point" src="http://latex.codecogs.com/png.latex?P_d%3D%5Cleft%5C%7B%5Cbegin%7Bmatrix%7D%5Cbegin%7Baligned%7D%5Cphi_d%26%3D%5Carcsin%5Cleft%28%5Csin%5Cphi%5Ccdot%5Ccos%5Cfrac%7Bd%7D%7BR%7D&plus;%5Ccos%5Cphi%5Ccdot%5Csin%5Cfrac%7Bd%7D%7BR%7D%5Ccdot%5Ccos%5CTheta%5Cright%29%5C%5C%5Clambda_d%26%3D%5Clambda&plus;%5Cmathrm%7Batan2%7D%5Cleft%28%5Cbegin%7Bmatrix%7D%5Csin%5CTheta%5Ccdot%5Csin%5Cdfrac%7Bd%7D%7BR%7D%5Ccdot%5Ccos%5Cphi%2C%26%5Ccos%5Cdfrac%7Bd%7D%7BR%7D-%5Csin%5Cphi%5Ccdot%5Csin%5Cphi_d%5Cend%7Bmatrix%7D%5Cright%29%5Cend%7Baligned%7D%5Cend%7Bmatrix%7D" /></p>

#### Middle point

Computes the half-way point ![Middle point](http://latex.codecogs.com/png.latex?%5Cinline%5Ctiny%20P_m%3D%28%5Cphi_m%2C%5Clambda_m%29) between two points on a great-circle path.

<p align="center"><img alt="Middle point" src="http://latex.codecogs.com/png.latex?%5Cbegin%7Baligned%7DB_x%26%3D%5Ccos%5Cphi_2%5Ccdot%5Ccos%5CDelta%5Clambda%5C%5CB_y%26%3D%5Ccos%5Cphi_2%5Ccdot%5Csin%5CDelta%5Clambda%5C%5CP_m%26%3D%5Cleft%5C%7B%5Cbegin%7Bmatrix%7D%5Cbegin%7Baligned%7D%5Cphi_m%26%3D%5Cmathrm%7Batan2%7D%5Cleft%28%5Cbegin%7Bmatrix%7D%5Csin%5Cphi_1&plus;%5Csin%5Cphi_2%2C%26%5Csqrt%7B%5Cleft%28%5Ccos%5Cphi_1&plus;B_x%5Cright%29%5E2&plus;%7BB_y%7D%5E2%7D%5Cend%7Bmatrix%7D%5Cright%29%5C%5C%5Clambda_m%26%3D%5Clambda_1&plus;%5Cmathrm%7Batan2%7D%5Cleft%28%5Cbegin%7Bmatrix%7DB_y%2C%26%5Ccos%5Cphi_1&plus;B_x%5Cend%7Bmatrix%7D%5Cright%29%5Cend%7Baligned%7D%5Cend%7Bmatrix%7D%5Cend%7Baligned%7D" /></p>

#### Loxodromic distance, bearing and middle point

A loxodrome is a line on a sphere that cuts all meridians at the same angle, the path taken by a ship or plane that maintains a constant compass direction. It maintains the same initial bearing for all the route.

<p align="center"><img alt="Loxodrome" src="https://cloud.githubusercontent.com/assets/1561134/2566359/71c34d9e-b8c3-11e3-9db5-f5df9286416f.png" /></p>

#### Projections

##### Equirectangular projection ([ref.](http://en.wikipedia.org/wiki/Equirectangular_projection))

It's a simple cylindrical map projection.

<p align="center"><img alt="Equirectangular projection formula" src="http://latex.codecogs.com/png.latex?%5Cbegin%7Bmatrix%7D%5Cleft%5C%7B%5Cbegin%7Bmatrix%7D%5Cbegin%7Baligned%7Dx%26%3DR%5Ccdot%5Ccos%5Cphi%5Ccdot%5Clambda%5C%5Cy%26%3DR%5Ccdot%5Cphi%5Cend%7Baligned%7D%5Cend%7Bmatrix%7D%26%5CLeftrightarrow%26%5Cleft%5C%7B%5Cbegin%7Bmatrix%7D%5Cbegin%7Baligned%7D%5Cphi%26%3D%5Cfrac%7By%7D%7BR%7D%5C%5C%5Clambda%26%3D%5Cfrac%7Bx%7D%7BR%5Ccdot%5Ccos%5Cphi%7D%5Cend%7Baligned%7D%5Cend%7Bmatrix%7D%5Cend%7Bmatrix%7D" /></p>

##### Mercator projection ([ref.](http://en.wikipedia.org/wiki/Mercator_projection))

It's a cylindrical map projection that has the ability to represent rhumb lines (or loxodrome) as straight segments which conserve the angles with the meridians. A close variant of this projection is used by Google Maps. This version is a generalization for the [WSG84 ellipsoid](http://en.wikipedia.org/wiki/WGS84).

<p align="center"><img alt="Mercator projection formula" src="http://latex.codecogs.com/png.latex?%5Cleft%28x%2Cy%5Cright%29%3D%5Cleft%5C%7B%5Cbegin%7Bmatrix%7D%5Cbegin%7Baligned%7Dx%26%3DR%5Ccdot%5Clambda%5C%5Cy%26%3DR%5Ccdot%5Cln%5Cleft%5B%5Ctan%5Cleft%28%5Cfrac%7B%5Cpi%7D%7B4%7D&plus;%5Cfrac%7B%5Cphi%7D%7B2%7D%5Cright%29%5Cleft%28%5Cfrac%7B1-%5Cmathrm%7Be%7D%5Csin%5Cphi%7D%7B1&plus;%5Cmathrm%7Be%7D%5Csin%5Cphi%7D%5Cright%29%5E%5Cfrac%7B%5Cmathrm%7Be%7D%7D%7B2%7D%5Cright%5D%5Cend%7Baligned%7D%5Cend%7Bmatrix%7D" /></p>

##### Mercator projection variant

This method is a variant of [secant projection](http://en.wikipedia.org/wiki/Mercator_projection#Secant_projection) with standard parallels at the latitude of the point to project. It helps calculation of small (projected) distances between two points with an accuracy of few centimeters even for farthest points from the equator.

> **Note:** the inverse formula requires to know the latitude (or the nearest one) of the point to convert.

<p align="center"><img alt="Secant Mercator projection" src="https://cloud.githubusercontent.com/assets/1561134/2566358/71afce04-b8c3-11e3-92fc-dcf7475193b2.png" /></p>

### Sensor

This class simulates the behavior of a single proximity sensor installed on the UAV. As the ultrasonic sensors, every proximity sensor has a fixed beam width (overture angle) of the main lobe and a maximum distance to detect obstacles. Users can set the number of the sensors and the position of the sensor on the autonomous system (in terms of angular position). The main purpose of this class is to make possible the execution of a simple **collision avoidance** algorithm between nodes, which simulates the real behavior of the external sensors.

<p align="center"><img alt="Proximity sensors on board" src="https://cloud.githubusercontent.com/assets/1561134/2629271/92905748-be35-11e3-8aac-ff41e3d6f4d7.png" /></p>

### Map

It's just a Google Maps wrapper that deals to draw nodes, destinations and the network polyline across the nodes. It also has the ability to "follow" nodes during moving adapting zoom value and map bounds dynamically (only if `#follow` checkbox is checked).

> **Note:** to draw node and destination IDs, `Map` make use of an external project called [Marker With Label](https://code.google.com/p/google-maps-utility-library-v3/wiki/Libraries#Marker_With_Label).

<p align="center"><img alt="DUC map" src="https://cloud.githubusercontent.com/assets/1561134/2629299/f8b75c4c-be35-11e3-85c5-598ca1ec17dd.png" /></p>

## Author

This work is a part of my master thesis at the *University of Pisa*, in collaboration with [ReTiS Lab] (http://retis.sssup.it/) of *Scuola Superiore Sant'Anna*.

<div>
	<img alt="Indri Muska" src="https://cloud.githubusercontent.com/assets/1561134/2566665/451dc98a-b8c9-11e3-8d7f-45927aad9076.jpg" align="left" />
	<div>
		<hr />
		&nbsp; <b>Indri Muska</b><br>
		&nbsp; <a href="mailto:indrimuska@gmail.com">indrimuska@gmail.com</a>
		<hr />
	</div>
</div>