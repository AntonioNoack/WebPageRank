
var vertices = []
var edges = []

var forceWeightText = false
var fixed = 3

'sin,cos,tan,atan2,sqrt,PI,abs,min,max,pow'.split(',').forEach(x => { window[x] = Math[x]; })

function readHTMLArgs(){
	try {
		var allArgs = window.location.search.substr(1)
		var json = allArgs.split('data=')[1].split('=')[0]
		json = decodeURIComponent(json)
		importData(json)
	} catch(e){
		console.log(e)
	}
}

function symmetricPathExists(src, dst){
	for(var i=0;i<edges.length;i++){
		var e = edges[i]
		if(vertices[e[0]] == dst && vertices[e[1]] == src) return true
	}
}

function importData(json){
	try {
		if(json[0] != '{') json = atob(json)
		var data = JSON.parse(json);
		vertices = data.vertices || data.v || vertices
		vertices = vertices.map(v => {
			return (v.x === undefined) ? 
				{name: v[0], x: v[1], y: v[2]}
			: v
		})
		vertices.forEach(v => {
			v.name = v.name || v.n
			delete v.n
		})
		edges = data.edges || data.e || edges
		var vs = vertices.length
		edges = edges.filter(e => e[0] < vs && e[1] < vs && e[2])
	} catch(e){
		console.log(e)
	}
}

function calculate(){
	calculatePageRank()
	calculateHITS()
}

function length(v0){
	var dst = 0
	v0.forEach(v0i => {
		dst += sq(v0i)
	})
	return sqrt(dst);
}

function distance(v0, v1){
	var dst = 0
	v0.forEach((v0i, i) => {
		dst += sq(v0i - v1[i])
	})
	return sqrt(dst);
}

function normalize1(v, normalization, scale2){
	var sum = 0
	for(var i=0;i<v.length;i++) sum += v[i]
	var scale = 1/sum
	if(scale2 !== undefined) scale *= scale2
	if(normalization != '1') scale *= v.length
	for(var i=0;i<v.length;i++){
		v[i] *= scale
	}
	return scale
}

function normalize2(v, normalization, scale2){
	var scale = 1/length(v)
	if(scale2 !== undefined) scale *= scale2
	if(normalization != '1') scale *= v.length
	for(var i=0;i<v.length;i++){
		v[i] *= scale
	}
	return scale
}

function calculatePageRank(){
	
	// todo use preference vector instead of random, if available
	var preferenceVector;
	try {
		var pvValue = prPreferenceVector.value.trim()
		if(pvValue.length)
			preferenceVector = JSON.parse(pvValue)
	} catch(e){
		console.log(e)
	}
	
	var pr = vertices.map(x => 1)
	var outDegree = vertices.map(x => 0)
	edges.forEach(e => {
		e[2] = e[2] == 0 ? 0 : e[2]*1 || 0;
	})
	edges.forEach(e => {
		outDegree[e[0]] += e[2]
	})
	var random = prRandomJump.value*1 || 0;
	if(preferenceVector) normalize1(preferenceVector, '1', random)
	var outMultiplier = outDegree.map(out => (1-random)/out)
	var normalization = prNormalize.value.toLowerCase()
	var epsilon = 0.0001
	for(var i=0;i<1000;i++){
		var oldPr = pr
		pr = preferenceVector ? 
			pr.map((x, i) => preferenceVector[i] || 0) :
			pr.map(x => random)
		
		// update the scores...
		edges.forEach(e => {
			var src = e[0]
			var dst = e[1]
			var weight = e[2]
			pr[dst] += oldPr[src] * weight * outMultiplier[src]
		})
		
		// calculate the error
		var dst = distance(oldPr, pr)
		
		// normalize the values
		if(normalization != '0'){
			var multiplier = normalize1(pr, 'v')
			dst *= multiplier;
		}
		
		// compare to epsilon
		if(dst < epsilon) break;
		
	}
	if(normalization != '0'){
		normalize1(pr, normalization)
	}
	vertices.forEach((v, i) => {
		v.pr = pr[i]
		if(fixed) v.pr = v.pr.toFixed(fixed) * 1
	})
}

function calculateHITS(){
	var hub = vertices.map(x => 1)
	var auth = vertices.map(x => 1)
	var  inDegree = vertices.map(x => 0),
		outDegree = vertices.map(x => 0)
	edges.forEach(e => {e[2] = e[2] == 0 ? 0 : e[2]*1 || 0;})
	edges.forEach(e => {
		var src = e[0], dst = e[1], weight = e[2]
		outDegree[src] += weight
		 inDegree[dst] += weight
	})
	// var random = prRandomJump.value*1 || 0;
	var  inMultiplier =  inDegree.map(inp => 1/inp)
	var outMultiplier = outDegree.map(out => 1/out)
	var normalization = hitsNormalize.value.toLowerCase()
	var size = vertices.length
	var epsilon = 0.0001
	for(var i=0;i<1000;i++){
		
		var oldHub = hub; hub = new Float64Array(size)
		var oldAuth = auth; auth = new Float64Array(size)
		
		// update the scores...
		edges.forEach(e => {
			var src = e[0]
			var dst = e[1]
			var weight = e[2]
			auth[dst] += oldHub[src] * weight * outMultiplier[src]
		})
		
		edges.forEach(e => {
			var src = e[0]
			var dst = e[1]
			var weight = e[2]
			hub[src] += auth[dst] * weight * inMultiplier[dst]
		})
		
		// calculate the error
		var dst = distance(oldHub, hub) + distance(oldAuth, auth)
		
		// normalize the values
		if(normalization != '0'){
			var multiplier = (
				normalize1(hub, normalization) + 
				normalize1(auth, normalization)
			) / 2;
			dst *= multiplier;
		}
		
		// compare to epsilon
		if(dst < epsilon) break;
		
	}
	vertices.forEach((v, i) => {
		v.hub = hub[i]
		v.auth = auth[i]
		if(fixed){
			 v.hub =  v.hub.toFixed(fixed) * 1
			v.auth = v.auth.toFixed(fixed) * 1
		}
	})
}

var center = { x: 0, y: 0 }
var zoom = 0.1

var ellipseW = 1
var ellipseH = 0.6

var selectedNode = null
var scale = 1

// rendering
var bothDirsOffset = 9

function render(changeInput){
	
	if(changeInput){
		document
			.getElementById('importData')
			.value = JSON.stringify({ edges, vertices })
	}
	
	// make the link for sharing smaller by removing calculated values
	var v2 = vertices.map(v => [v.name, v.x.toFixed(2)*1, v.y.toFixed(2)*1])
	document
		.getElementById('shareGraph')
		.value = 'https://phychi.com/pagerank/calc?data='+btoa(JSON.stringify({ e: edges, v: v2 }))
	
	// use svg instead of canvas? maybe...
	
	var canvas = document.getElementById('canvas')
	var w = window.innerWidth
	var h = window.innerHeight
	if(w < 1 || h < 1) return
	canvas.width = w
	canvas.height = h
	scale = zoom * h
	var ctx = canvas.getContext('2d')
	ctx.translate(w/2,h/2)
	ctx.scale(scale, scale)
	ctx.translate(center.x,center.y)
	ctx.textAlign = 'center'
	ctx.font = (24/scale)+'px Verdana'
	edges.forEach(e => {
		// draw arrow
		var src = vertices[e[0]]
		var dst = vertices[e[1]]
		if(src && dst){
			var weight = e[2]*1
			var dx0 = dst.x - src.x, dx = dx0
			var dy0 = dst.y - src.y, dy = dy0
			var len0 = sqrt(dx*dx+dy*dy);
			var angledLength = ellipseW * abs(dx)/len0 + ellipseH * abs(dy)/len0
			var size = min(1.5, 0.03 * len0 * scale);
			var len = size / scale / len0;
				
			// only is approximately correct... why?
			angledLength *= len0/(abs(dx0)+abs(dy0))
			
			var color = e === selectedNode ? selectedColor : '#aaa'
			
			dx *= len
			dy *= len
			if(len0 > 2 * angledLength){// not overlapping
				
				var bdo = symmetricPathExists(src, dst) ? bothDirsOffset : 0
				var sx = src.x + dx0/len0 * angledLength + dy * bdo
				var sy = src.y + dy0/len0 * angledLength - dx * bdo
				var tx = dst.x - dx0/len0 * angledLength + dy * bdo
				var ty = dst.y - dy0/len0 * angledLength - dx * bdo
				
				ctx.beginPath()
				ctx.moveTo(sx-dy, sy+dx)
				ctx.lineTo(sx+dy, sy-dx)
				
				// arrow style
				var a = 6, b = 5, c = 8
				
				ctx.lineTo(tx-a*dx+dy, ty-a*dy-dx)
				ctx.lineTo(tx-c*dx+b*dy, ty-c*dy-b*dx)
				ctx.lineTo(tx, ty)
				ctx.lineTo(tx-c*dx-b*dy, ty-c*dy+b*dx)
				ctx.lineTo(tx-a*dx-dy, ty-a*dy+dx)
				ctx.closePath()
				ctx.fillStyle = color
				ctx.fill()
				
				// ctx.lineWidth = 1/scale
				// ctx.strokeStyle = '#aaa'
				// ctx.stroke()
			}
			if(weight != 1 || forceWeightText){
				// todo draw text of the weight on the arrow :)
				ctx.fillStyle = color
				var x = (src.x+dst.x)/2 + dy * bothDirsOffset
				var y = (src.y+dst.y)/2 - dx * bothDirsOffset
				ctx.save()
				ctx.translate(x, y)
				// todo rotate 90° max xD
				var angle = atan2(dy,dx)
				var sign = 1
				if(angle < -PI/2) angle += PI, sign *= -1
				if(angle > +PI/2) angle -= PI, sign *= -1
				ctx.rotate(angle)
				ctx.fillText((weight*1.0).toFixed(2), + sign * 3 * dy, - sign * 3 * dx)
				ctx.restore()
			}
		}
	})
	var textHeight = 0.22
	ctx.font = textHeight + 'px Verdana'
	vertices.forEach((v, i) => {
		var color = v === selectedNode ? selectedColor : '#aaa'
		ctx.beginPath();
		ctx.ellipse(v.x, v.y, ellipseW, ellipseH, 0, 0, Math.PI*2)
		ctx.lineWidth = 3/scale
		ctx.strokeStyle = color
		ctx.stroke()
		ctx.fillStyle = color
		var name = v.name || 'Node['+i+']';
		ctx.fillText(name, v.x, v.y - textHeight * 0.3)
		ctx.fillText(v.hub.toFixed(2)+', '+v.auth.toFixed(2), v.x, v.y + textHeight * 0.8)
		ctx.fillText(v.pr.toFixed(3), v.x, v.y + textHeight * 1.9)
	})
}

function update(changeInput){
	calculate()
	render(changeInput)
}

// utils

function sq(x){ return x*x; }
function clamp(x,min,max){ return x<min?min:x<max?x:max; }

Array.prototype.removeIf = function(predicate) {
    var i = this.length;
    while (i--) {
        if (predicate(this[i], i)) {
            this.splice(i, 1);
        }
    }
};

Array.prototype.removeAt = function(index) {
    this.splice(index, 1)
};

Array.prototype.remove = function(object) {
    var index = this.indexOf(object)
	if(index >= 0) this.splice(index, 1)
};

window.onresize = render
var oc = [prRandomJump,prPreferenceVector,prNormalize,hitsNormalize];
oc.forEach(x => {
	x.onchange = update
})
var id = document.getElementById('importData')
id.onchange = function(){
	importData(id.value)
	update(false)
}
var up = function(){
	update(true)
}
prRandomJump.onkeyup = up
prPreferenceVector.onkeyup = up
id.onkeyup = function(){
	importData(id.value)
	update(false)
}

canvas.onmousewheel = function(e){
	var delta = e.deltaY / 100 // default: 100
	// todo zoom on cursor...
	var oldZoom = zoom;
	zoom = clamp(zoom * pow(1.2, -delta), 0.001, 1000.0)
	var deltaZoom = oldZoom - zoom;
	var x = e.pageX || e.offsetX
	var y = e.pageY || e.offsetY
	x = x/innerWidth*2-1
	y = y/innerHeight*2-1
	center.x -= deltaZoom * x
	center.y -= deltaZoom * y
	render(false)
}

function screen2Data(x,y){
	var w = window.innerWidth
	var h = window.innerHeight
	var scale = zoom * h
	x -= w/2
	y -= h/2
	x /= scale
	y /= scale
	x -= center.x
	y -= center.y
	return [x,y]
}

var startX = 0
var startY = 0

var selectedColor = '#c8ca81'

var dragging = false
var selectedNode = null;
canvas.onmousemove = function(e){
	if(dragging){
		var h = window.innerHeight
		var scale = zoom * h
		var dx = e.movementX / scale
		var dy = e.movementY / scale
		if(selectedNode){
			// move the node
			if(selectedNode.pr !== undefined){
				// a node
				selectedNode.x += dx
				selectedNode.y += dy
				selectedNode.x = selectedNode.x.toFixed(3)*1
				selectedNode.y = selectedNode.y.toFixed(3)*1
			} else {
				// a path, array
				// change the weight
				var delta = (e.movementX - e.movementY)/h
				selectedNode[2] = (0.1 + selectedNode[2]) * pow(5, delta) - 0.1
				selectedNode[2] = selectedNode[2].toFixed(3)*1
			}
		} else {
			// move the screen origin
			center.x += dx
			center.y += dy
		}
		update(true)
	}
}

function getTime(){
	return new Date().getTime() * 0.001
}

canvas.ondblclick = function(e){
	e.preventDefault()
	var mx = e.offsetX
	var my = e.offsetY
	var xy = screen2Data(mx,my)
	var x = xy[0]
	var y = xy[1]
	if(selectedNode){
		if(selectedNode.x !== undefined){
			selectedNode.name = prompt('Enter new node name:', selectedNode.name) || selectedNode.name
		} else {
			selectedNode[2] = prompt('Enter new path weight:', selectedNode[2].toFixed(2)) * 1 || selectedNode[2]
		}
	} else {
		vertices.push({
			name: 'Node['+vertices.length+']',
			x, y,
		})
	}
	update(true);
}

function getElementAt(mx,my,ignored){
	var xy = screen2Data(mx,my)
	var x = xy[0]
	var y = xy[1]
	var dst0 = 1
	var best = null
	vertices.forEach(v => {
		var dst = sq(v.x-x)+sq(v.y-y)
		if(dst < dst0 && v != ignored){
			best = v
			dst0 = dst
		}
	})
	if(!ignored){
		edges.forEach(e => {
			var src = vertices[e[0]]
			var dst = vertices[e[1]]
			
			var weight = e[2]*1
			
			var dx0 = dst.x - src.x, dx = dx0
			var dy0 = dst.y - src.y, dy = dy0
			var len0 = sqrt(dx*dx+dy*dy);
			var size = min(1.5, 0.03 * len0 * scale);
			var len = size / scale / len0;
			dx *= len
			dy *= len
			
			var bdo = symmetricPathExists(src, dst) ? bothDirsOffset : 0
			var cx = (src.x+dst.x)/2 + dy * bdo
			var cy = (src.y+dst.y)/2 - dx * bdo
			var dst = sq(cx-x)+sq(cy-y)
			if(dst < dst0 && dst < 0.3){
				dst0 = dst
				best = e
			}
		})
	}
	return best
}

canvas.onmousedown = function(e){
	// find the node at x,y
	var mx = e.offsetX
	var my = e.offsetY
	var xy = screen2Data(mx,my)
	startX = xy[0].toFixed(3)*1
	startY = xy[1].toFixed(3)*1
	selectedNode = getElementAt(mx,my)
	dragging = true
}

canvas.onmouseup = function(e){
	var mx = e.offsetX
	var my = e.offsetY
	if(selectedNode && selectedNode.name !== undefined){
		var draggedOnto = getElementAt(mx, my, selectedNode)
		if(draggedOnto && draggedOnto.name !== undefined){
			// todo (un)connect them and reset the coordinates
			selectedNode.x = startX
			selectedNode.y = startY
			var wasFound = false
			var src = selectedNode
			var dst = draggedOnto
			var srcI = vertices.indexOf(src)
			var dstI = vertices.indexOf(dst)
			for(var i=0;i<edges.length;i++){
				var e = edges[i]
				if(e[0] == srcI && e[1] == dstI){
					// found :) -> remove it
					edges.removeAt(i)
					wasFound = true
					break;
				}
			}
			if(!wasFound && srcI >= 0 && dstI >= 0){
				edges.push([srcI, dstI, 1])
			}
		}
	}
	update(true)
	dragging = false
}

document.onkeydown = function(e){
	if(e.key == 'Delete'){
		if(selectedNode){
			if(selectedNode.x !== undefined){
				var index = vertices.indexOf(selectedNode)
				if(index >= 0){
					vertices.removeAt(index)
					edges = edges.filter(e => e[0] != index && e[1] != index)
					edges.forEach(e => {
						if(e[0] > index) e[0]--
						if(e[1] > index) e[1]--
					})
				}
				// todo update all edges...
			} else {
				edges.remove(selectedNode)
			}
			update(true)
		}
	}
}

readHTMLArgs()
update(true)