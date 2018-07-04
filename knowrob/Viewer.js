/**
 * @author David Gossow - dgossow@willowgarage.com
 * @author Russell Toris - rctoris@wpi.edu
 * @author Jihoon Lee - jihoonlee.in@gmail.com
 */

/**
 * A Viewer can be used to render an interactive 3D scene to a HTML5 canvas.
 *
 * @constructor
 * @param options - object with following keys:
 *
 *  * div - the div to place the viewer in
 *  * width - the initial width, in pixels, of the canvas
 *  * height - the initial height, in pixels, of the canvas
 *  * background (optional) - the color to render the background, like '#efefef'
 *  * alpha (optional) - the alpha of the background
 *  * antialias (optional) - if antialiasing should be used
 *  * intensity (optional) - the lighting intensity setting to use
 *  * cameraPosition (optional) - the starting position of the camera
 */
EASE.Viewer = function(options) {
  options = options || {};
  var div = options.div;
  var width = options.width;
  var height = options.height;
  var background = options.background || '#111111';
  var antialias = options.antialias;
  var intensity = options.intensity || 0.66;
  var near = options.near || 0.01;
  var far = options.far || 1000;
  var alpha = options.alpha || 1.0;
  var cameraPosition = options.cameraPose || {
    x : 3,
    y : 3,
    z : 3
  };
  var cameraZoomSpeed = options.cameraZoomSpeed || 0.5;
  var on_window_dblclick = options.on_window_dblclick || function(_) { };

  // create the canvas to render to
  this.renderer = new THREE.WebGLRenderer({
    antialias : antialias,
    alpha: true
  });
  this.renderer.setClearColor(parseInt(background.replace('#', '0x'), 16), alpha);
  this.renderer.sortObjects = false;
  this.renderer.setSize(width, height);
  this.renderer.autoClear = false;
  
  if(options.enableShadows) {
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  else {
    this.renderer.shadowMapEnabled = false;
  }

  // create the global scene
  this.scene = new THREE.Scene();
  // create the global scene for HUD
  this.sceneOrtho = new THREE.Scene();

  // create the global camera
  this.camera = new THREE.PerspectiveCamera(81.4, width / height, near, far);
  this.camera.position.x = cameraPosition.x;
  this.camera.position.y = cameraPosition.y;
  this.camera.position.z = cameraPosition.z;
  // add controls to the camera
  this.cameraControls = new ROS3D.OrbitControls({
    scene : this.scene,
    camera : this.camera
  });
  this.cameraControls.userZoomSpeed = cameraZoomSpeed;
//   this.camera.setViewOffset( 1920, 1080, 370, 164, 1155, 736);
  
  // create the global camera with orthogonal projection
  this.cameraOrtho = new THREE.OrthographicCamera(
    -width/2, width/2,
    height/2, -height/2,
    1, 10
  );
  this.cameraOrtho.position.z = 10;

  // lights
  this.scene.add(new THREE.AmbientLight(0x555555));
  this.directionalLight = new THREE.DirectionalLight(0xeeeeee, intensity);
  this.directionalLight.position = new THREE.Vector3(-1, -1, 1);
  this.directionalLight.position.normalize();

  if(options.enableShadows) {
      this.directionalLight.castShadow = true;
      this.directionalLight.shadow.mapWidth = 512;
      this.directionalLight.shadow.mapHeight = 512;
      this.directionalLight.shadow.camera.near = 1;
      this.directionalLight.shadow.camera.far = 50;
      this.directionalLight.shadow.camera.left = -500;
      this.directionalLight.shadow.camera.right = 500;
      this.directionalLight.shadow.camera.top = 500;
      this.directionalLight.shadow.camera.bottom = -500;
      this.directionalLight.shadow.camera.visible = true;
  }
  this.scene.add(this.directionalLight);
  
  this.spotLight = new THREE.SpotLight( 0xffffbb, 0.9 );
  this.spotLight.position.set( 0, 0, 6 );
  this.spotLight.target.position.set( -1, 1, 0 );
  this.spotLight.angle = 160;
  if(options.enableShadows) {
      this.spotLight.castShadow = true;
      this.spotLight.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera(40.0, width / height, 1, 10) );
      this.spotLight.shadow.mapWidth = 4096;
      this.spotLight.shadow.mapHeight = 4096;
  }
  this.scene.add( this.spotLight );
  this.scene.add( this.spotLight.target );
//   this.scene.add( new THREE.SpotLightHelper( this.spotLight ) );

  // propagates mouse events to three.js objects
  this.selectableObjects = new THREE.Object3D();
  this.scene.add(this.selectableObjects);
  var mouseHandler = new ROS3D.MouseHandler({
    renderer : this.renderer,
    camera : this.camera,
    rootObject : this.scene,
    fallbackTarget : this.cameraControls,
    on_window_dblclick : on_window_dblclick
  });

  // highlights the receiver of mouse events
  this.highlighter = new ROS3D.Highlighter({
    mouseHandler : mouseHandler
  });

  this.stopped = true;
  this.animationRequestId = undefined;
  
  this.backgroundScene = new THREE.Scene();
  this.backgroundCamera = new THREE.Camera();
  this.backgroundScene.add(this.backgroundCamera);

  // add the renderer to the page
  div.appendChild(this.renderer.domElement);

  // begin the render loop
  this.start();
};

/**
 *  Start the render loop
 */
EASE.Viewer.prototype.start = function(){
  this.stopped = false;
  this.draw();
};

/**
 * Renders the associated scene to the viewer.
 */
EASE.Viewer.prototype.draw = function(){
  if(this.stopped){
    // Do nothing if stopped
    return;
  }

  // update the controls
  this.cameraControls.update();

  // notify listener about the draw call
//   FIXME
//   this.emit('render', {
//       'camera': this.camera,
//       'scene': this.scene
//   });

  // set the scene
  this.renderer.clear(true, true, true);
  this.renderer.render(this.backgroundScene, this.backgroundCamera);
  this.renderer.render(this.scene, this.camera);
  this.highlighter.renderHighlights(this.scene, this.renderer, this.camera);

  // draw the frame
  this.animationRequestId = requestAnimationFrame(this.draw.bind(this));
  
  // draw HUD
  this.renderer.render(this.sceneOrtho, this.cameraOrtho);
};

/**
 *  Stop the render loop
 */
EASE.Viewer.prototype.stop = function(){
  if(!this.stopped){
    // Stop animation render loop
    cancelAnimationFrame(this.animationRequestId);
  }
  this.stopped = true;
};

/**
 * Add the given THREE Object3D to the global scene in the viewer.
 *
 * @param object - the THREE Object3D to add
 * @param selectable (optional) - if the object should be added to the selectable list
 */
EASE.Viewer.prototype.addObject = function(object, selectable) {
  if (selectable) {
    this.selectableObjects.add(object);
  } else {
    this.scene.add(object);
  }
};

/**
 * Resize 3D viewer
 *
 * @param width - new width value
 * @param height - new height value
 */
EASE.Viewer.prototype.resize = function(width, height) {
  this.camera.width = width;
  this.camera.height = height;
  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();
  
  // update orthographic projection
  this.cameraOrtho.width = width;
  this.cameraOrtho.height = height;
  this.cameraOrtho.left = - width / 2;
  this.cameraOrtho.right = width / 2;
  this.cameraOrtho.top = height / 2;
  this.cameraOrtho.bottom = - height / 2;
  this.cameraOrtho.updateProjectionMatrix();
  
  this.renderer.setSize(width, height);
};

EASE.Viewer.prototype.addMarker = function(marker, node) {
  if(marker.isBackgroundMarker) {
    this.backgroundScene.add(node);
  }
  else if(marker.isSelectable) {
    this.selectableObjects.add(node);
  }
  else if(marker.isSceneOrtho) {
    this.sceneOrtho.add(node);
  }
  else {
    this.scene.add(node);
  }
  node.visible = true;
};

EASE.Viewer.prototype.removeMarker = function(marker, node) {
  if(marker.isBackgroundMarker) {
    this.backgroundScene.remove(node);
  }
  else if(marker.isSelectable) {
    this.selectableObjects.remove(node);
  }
  else if(marker.isSceneOrtho) {
    this.sceneOrtho.remove(node);
  }
  else {
    this.scene.remove(node);
  }
};
