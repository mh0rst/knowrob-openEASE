/**
 * Establishes connection to a ROS master via websocket.
 **/
function KnowrobClient(){
    var that = this;
    // OpenEASE frameControl
    this.frameControl = undefined;
    // OpenEASE frameControl
    this.onInitialized = undefined;
    // ROS handle
    this.ros = undefined;
    // URL for ROS server
    var rosURL = 'ws://localhost:9090';
    // Use rosauth?
    var authentication = true;
    // URL for rosauth token retrieval
    var authURL = '/wsauth/v1.0/by_session';
    // The selected episode
    this.episode;

    // true if authentication was sent to the connection
    this.isAuthenticated = false;
    // true iff registerNodes was called before
    this.isRegistered = false;
    // Prefix for mesh GET URL's
    var meshPath = '/';
    // Initially chosen category
    var initialCategory = undefined;
    // Initially chosen episode
    var initialEpisode = undefined;
    // Block the interface until an episode was selected?
    var requireEpisode = undefined;

    // sprite markers and render events
    var sprites = [];
    var render_event;

    // The selected marker object or undefined
    this.selectedMarker = undefined;
    
    // ROS messages
    var tfClient = undefined;
    this.markerArrayClient = undefined;
    var designatorClient = undefined;
    var imageClient = undefined;
    var cameraPoseClient = undefined;
    this.snapshotTopic = undefined;

    // Interval for sending keep-alive messages
    this.interval = undefined;
    
    this.nodesRegistered = false;
    
    // Redirects incomming marker messages to currently active canvas.
    function CanvasProxy() {
        this.viewer = function() {
            var ui = that.frameControl.getActiveFrame().ui;
            if(!ui)
              return undefined;
            if(!ui.rosViewer)
              return undefined;
            return ui.rosViewer.rosViewer;
        };
        this.addMarker = function(marker,node) {
            if(this.viewer())
              this.viewer().addMarker(marker,node);
        };
        this.removeMarker = function(marker,node) {
            if(this.viewer())
              this.viewer().removeMarker(marker,node);
        };
    };
    this.canvas = new CanvasProxy();

    this.setOptions = function(options, onInitialized) {
        that.frameControl = options.frameControl;
        rosURL = options.ros_url || 'ws://localhost:9090';
        authentication = options.authentication === '' ? true : options.authentication === 'True';
        authURL = options.auth_url || '/wsauth/v1.0/by_session';
        meshPath  = options.meshPath || '/';
        requireEpisode = options.require_episode;
        initialCategory = options.category;
        initialEpisode = options.episode;
        that.interval = options.interval;
        that.onInitialized = onInitialized;
    };
    
    this.init = function() {
        that.episode = new KnowrobEpisode(that);

        // Connect to ROS.
        that.connect(function () {
            if(initialCategory && initialEpisode)
                that.episode.setEpisode(initialCategory, initialEpisode);

            that.frameControl.createOverlay();

            if(requireEpisode && !that.episode.hasEpisode()) {
              that.frameControl.showPageOverlay("Please select an Episode");
            } else {
              that.frameControl.showPageOverlay("Loading Knowledge Base");
            }
        });
      
        setInterval(containerRefresh, 570000);
        containerRefresh();
        render_event = new CustomEvent('render', {'camera': null});
    };
    
    function containerRefresh() {
        $.ajax({
            url: '/api/v1.0/refresh_by_session',
            type: "GET",
            contentType: "application/json",
            dataType: "json"
        });
    };

    this.onRosConnected = function (postConnect) {
        if(postConnect) {
            postConnect();
        }
        that.registerNodes();
    }

    this.connect = function (postConnect) {
      if(that.ros) return;
      that.ros = new ROSLIB.Ros({url : rosURL});
      that.ros.on('connection', function() {
          console.log('Connected to websocket server.');
          if (authentication) {
              // Acquire auth token for current user and authenticate, then call registerNodes
              that.authenticate(authURL, that.onRosConnected.bind(undefined, postConnect));
          } else {
              // No authentication requested, call registerNodes directly
              that.waitForJsonProlog();
              that.onRosConnected(postConnect);
          }
      });
      that.ros.on('close', function() {
          console.log('Connection was closed.');
          that.frameControl.showPageOverlay("Connection was closed, reconnecting...");
          that.ros = undefined;
          that.isAuthenticated = false;
          that.isRegistered = false;
          setTimeout(that.connect, 500);
      });
      that.ros.on('error', function(error) {
          console.log('Error connecting to websocket server: ', error);
          that.frameControl.showPageOverlay("Connection error, reconnecting...");
          if(that.ros) that.ros.close();
          that.ros = undefined;
          that.isAuthenticated = false;
          that.isRegistered = false;
          setTimeout(that.connect, 500);
      });
    };

    this.authenticate = function (authurl, then) {
        console.log("Acquiring auth token");
        // Call wsauth api to acquire auth token by existing user login session
        $.ajax({
            url: authurl,
            type: "GET",
            contentType: "application/json",
            dataType: "json"
        }).done( function (request) {
            if(!that.ros) {
                console.warn("Lost connection to ROS master.");
                return;
            }
            if(that.isAuthenticated) {
                console.log("Already authenticated from previous request");
                return;
            }
            console.log("Sending auth token");
            that.ros.authenticate(request.mac,
                             request.client,
                             request.dest,
                             request.rand,
                             request.t,
                             request.level,
                             request.end);
            that.isAuthenticated = true;
            that.waitForJsonProlog();
            
            // If a callback function was specified, call it in the context of Knowrob class (that)
            if(then) {
                then.call(that);
            }
        });
    };
    
    this.registerNodes = function () {
      if(that.isRegistered) return;
      that.isRegistered = true;

      // Setup publisher that sends a dummy message in order to keep alive the socket connection
      {
          var interval = this.interval || 30000;
          // The topic dedicated to keep alive messages
          var keepAliveTopic = new ROSLIB.Topic({ ros : that.ros, name : '/keep_alive', messageType : 'std_msgs/Bool' });
          // A dummy message for the topic
          var keepAliveMsg = new ROSLIB.Message({ data : true });
          // Function that publishes the keep alive message
          var ping = function() { keepAliveTopic.publish(keepAliveMsg); };
          // Call ping at regular intervals.
          setInterval(ping, interval);
      };

      // topic used for publishing canvas snapshots
      that.snapshotTopic = new ROSLIB.Topic({
        ros : that.ros,
        name : '/openease/video/frame',
        messageType : 'sensor_msgs/Image'
      });

      // Setup a client to listen to TFs.
      tfClient = new ROSLIB.TFClient({
        ros : that.ros,
        angularThres : 0.01,
        transThres : 0.01,
        rate : 10.0,
        fixedFrame : '/my_frame'
      });

      // Setup the marker array client.
      that.markerArrayClient = new EASE.MarkerArrayClient({
        ros : that.ros,
        tfClient : tfClient,
        topic : '/visualization_marker_array',
        canvas : that.canvas,
        path : meshPath
      });

      // Setup the designator message client.
      designatorClient = new ROSLIB.Topic({
        ros : that.ros,
        name : '/logged_designators',
        messageType : 'designator_integration_msgs/Designator'
      });
      designatorClient.subscribe(function(message) {
        if(message.description.length==0) {
          console.warn("Ignoring empty designator.");
        }
        else {
          var desig_js = parse_designator(message.description);
          var html = format_designator(message.description);
          if(that.frameControl.getActiveFrame().on_designator_received)
            that.frameControl.getActiveFrame().on_designator_received(html);
        }
      });

      // Setup the image message client.
      imageClient = new ROSLIB.Topic({
        ros : that.ros,
        name : '/logged_images',
        messageType : 'std_msgs/String'
      });
      imageClient.subscribe(function(message) {
          var ext = message.data.substr(message.data.lastIndexOf('.') + 1).toLowerCase();
          var url = message.data;
          if(!url.startsWith("/knowrob/")) {
               if(url.startsWith("/home/ros/user_data"))  url = '/user_data/'+url.replace("/home/ros/user_data/", "");
               else url = '/knowrob/knowrob_data/'+url;
          }
          var imageHeight, imageWidth;
          var html = '';
          if(ext=='jpg' || ext =='png') {
              html += '<div class="image_view">';
              html += '<img id="mjpeg_image" class="picture" src="'+url+'" width="300" height="240"/>';
              html += '</div>';

              imageHeight = function(mjpeg_image) { return mjpeg_image.height; };
              imageWidth  = function(mjpeg_image) { return mjpeg_image.width; };
          }
          else if(ext =='ogg' || ext =='ogv' || ext =='mp4' || ext =='mov') {
              html += '<div class="image_view">';
              html += '  <video id="mjpeg_image" controls autoplay loop>';
              html += '    <source src="'+url+'" ';
              if(ext =='ogg' || ext =='ogv') html += 'type="video/ogg" ';
              else if(ext =='mp4') html += 'type="video/mp4" ';
              html += '/>';
              html += 'Your browser does not support the video tag.';
              html += '</video></div>';

              imageHeight = function(mjpeg_image) { return mjpeg_image.videoHeight; };
              imageWidth  = function(mjpeg_image) { return mjpeg_image.videoWidth; };
          }
          else {
              console.warn("Unknown data format on /logged_images topic: " + message.data);
          }
          if(html.length>0 && that.frameControl.getActiveFrame().on_image_received) {
              that.frameControl.getActiveFrame().on_image_received(html, imageWidth, imageHeight);
          }
      });

      // TODO redo highlighting with dedicated messages
//       var highlightClient = new ROSLIB.Topic({
//         ros : that.ros,
//         name : '/ease/canvas/highlight',
//         messageType : 'std_msgs/String'
//       });
//       highlightClient.subscribe(function(message) {
//         var objectId = message.data;
//         console.info(objectId);
//         if(objectId == '*') {
//         } else {
//         }
//       });
//       var unhighlightClient = new ROSLIB.Topic({
//         ros : that.ros,
//         name : '/ease/canvas/unhighlight',
//         messageType : 'std_msgs/String'
//       });
//       highlightClient.subscribe(function(message) {
//         var objectId = message.data;
//         console.info(objectId);
//         if(objectId == '*') {
//         } else {
//         }
//       });

      cameraPoseClient = new ROSLIB.Topic({
        ros : that.ros,
        name : '/camera/pose',
        messageType : 'geometry_msgs/Pose'
      });
      cameraPoseClient.subscribe(function(message) {
          if(that.frameControl.getActiveFrame().on_camera_pose_received)
            that.frameControl.getActiveFrame().on_camera_pose_received(message);
      });

      if(that.onInitialized !== undefined) {
        that.onInitialized();
      }
      that.nodesRegistered = true;
    };
    
    this.waitForJsonProlog = function () {
        var client = new JsonProlog(that.ros, {});
        client.jsonQuery("true", function(result) {
            client.finishClient();
            if(result.error) {
                // Service /json_prolog/simple_query does not exist
                setTimeout(that.waitForJsonProlog, 500);
            }
            else {
                that.frameControl.hidePageOverlay();
                if(requireEpisode && !that.episode.hasEpisode())
                  that.frameControl.showPageOverlay("Please select an Episode");
                that.episode.selectMongoDB();
            }
        });
    };
    
    ///////////////////////////////
    //////////// Marker Visualization
    ///////////////////////////////
    
    this.newProlog = function() {
        return that.ros ? new JsonProlog(that.ros, {}) : undefined;
    };
    
    this.newCanvas = function(options) {
        var x = new KnowrobCanvas(that, options);
        // connect to render event, dispatch to marker clients
		// FIXME TypeError: x.rosViewer.on is not a function
        //x.rosViewer.on('render', function(e) {
        //    if(that.markerClient)      that.markerClient.emit('render', e);
        //    if(that.markerArrayClient) that.markerArrayClient.emit('render', e);
        //});
        return x;
    };
    
    this.newDataVis = function(options) {
        return new DataVisClient(options);
    };
    
    this.newTaskTreeVis = function(options) {
        return new TaskTreeVisClient(options);
    };
    
    this.selectMarker = function(marker) {
        if(that.selectedMarker == marker)
          return;
        if(that.selectedMarker) {
          if(that.canvas.viewer()) {
            that.canvas.viewer().unhighlight(that.selectedMarker);
          }
        }
        that.selectedMarker = marker;
        // inform the active iframe about selection (e.g., to show object query library)
        if(that.frameControl.getActiveFrame())
          that.frameControl.getActiveFrame().selectMarker(marker);
        // tell the webgl canvas to highlight the selected object
        if(that.canvas.viewer())
          that.canvas.viewer().highlight(marker);
    };
    
    this.unselectMarker = function() {
      if(!that.selectedMarker)
        return;
      if(that.frameControl.getActiveFrame() && that.frameControl.getActiveFrame().unselectMarker)
        that.frameControl.getActiveFrame().unselectMarker(that.selectedMarker);
      // tell the webgl canvas to unhighlight the object
      if(that.canvas.viewer())
        that.canvas.viewer().unhighlight(that.selectedMarker);
      that.selectedMarker = undefined;
    };
    
    this.removeMarker = function(marker) {
        if(marker === that.selectedMarker) {
            that.unselectMarker();
        }
        if(that.frameControl.getActiveFrame() && that.frameControl.getActiveFrame().removeMarker)
            that.frameControl.getActiveFrame().removeMarker(marker);
    };
    
    this.showMarkerMenu = function(marker) {
        if(that.frameControl.getActiveFrame() && that.frameControl.getActiveFrame().showMarkerMenu)
          that.frameControl.getActiveFrame().showMarkerMenu(marker);
    };
    
    this.on_render = function(camera,scene) {
        if(that.frameControl.getActiveFrame() && that.frameControl.getActiveFrame().on_render)
            that.frameControl.getActiveFrame().on_render(camera,scene);

        var index;
        for(index = 0; index < sprites.length; index++) {
            //sprites[index].camera = camera;
            //render_event.target = sprites[index];
            render_event.camera = camera;
            sprites[index].dispatchEvent(render_event);
        }
    };
    
    ///////////////////////////////
    //////////// Edisodes
    ///////////////////////////////
    
    this.setEpisode = function(category, episode) {
        that.episode.setEpisode(category, episode, that.on_episode_selected);
    };
    
    this.on_episode_selected = function(library) {
        that.frameControl.on_episode_selected_all(library);
        // Hide "Please select an episode" overlay
        that.frameControl.hidePageOverlay();
        that.frameControl.showPageOverlay("Loading Knowledge Base");
        if(that.ros) that.ros.close(); // force reconnect
        
        $.ajax({
            url: '/knowrob/reset',
            type: "POST",
            contentType: "application/json",
            dataType: "json"
        });
    };

};
