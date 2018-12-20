/**
 * Controls OpenEASE webclient frame modules
 */
function FrameControl(options){

    var that = this;

    // The openEASE menu that allows to activate episodes/ui/..
    this.menu = options.menu;

    // User interface names (e.g., editor, memory replay, ...)
    this.common_user_interfaces = options.common_user_interfaces || [];

    this.webclient_user_interfaces = [];

    this.user_interfaces = [];

    this.user_interfaces_flat = [];

    this.pageOverlayDisabled = false;

    // Query parameters encoded in URL
    // E.g., localhost/#foo&bar=1 yields in:
    //    URL_QUERY = {foo: undefined, bar: 1}
    var urlQuery = {};

    this.init = function() {
        that.update_webclient_frames([]);
        createFrames(that.common_user_interfaces);
    }

    this.update_webclient_frames = function(webclient_user_interfaces) {
        for(var i in that.webclient_user_interfaces) {
            var id = that.webclient_user_interfaces[i].id + '-frame';
            var element = document.getElementById(id);
            element.parentNode.removeChild(element);
        }
        that.user_interfaces = webclient_user_interfaces.concat(that.common_user_interfaces);
        that.webclient_user_interfaces = webclient_user_interfaces;
        that.update_flat();
        createFrames(webclient_user_interfaces);

    }

    that.update_flat = function() {
        that.user_interfaces_flat = [];
        for(var i in that.user_interfaces) {
            var elem = that.user_interfaces[i];
            var ifaces = elem.interfaces;
            if(!ifaces) ifaces = [elem];
            for(var j in ifaces) {
                that.user_interfaces_flat.push(ifaces[j]);
            }
        };
    }

    function createFrames(interfaces) {
        // Declare page frames: Each user interface of openEASE is
        // put into an iframe that is child of #page
        for(var i in interfaces) {
            var elem = interfaces[i];
            var frame = document.createElement("iframe");
            frame.id = elem.id+'-frame';
            frame.className = 'content-frame';
            if(elem.interfaces && elem.interfaces[0].src)
                frame.src = elem.interfaces[0].src;
            else if(elem.src)
                frame.src = elem.src;
            else continue;
            document.getElementById('page').appendChild(frame);
        };
    }

    ///////////////////////////////
    //////////// URL Location
    ///////////////////////////////

    function updateQueryString() {
        urlQuery = {};
        var query = String(window.location.hash.substring(1));
        var vars = query.split("?");
        for (var i=0;i<vars.length;i++) {
            var pair = vars[i].split("=");
            if (typeof urlQuery[pair[0]] === "undefined") {
                // If first entry with this name
                urlQuery[pair[0]] = decodeURIComponent(pair[1]);
            }
            else if (typeof urlQuery[pair[0]] === "string") {
                // If second entry with this name
                var arr = [ urlQuery[pair[0]],decodeURIComponent(pair[1]) ];
                urlQuery[pair[0]] = arr;
            }
            else {
                // If third or later entry with this name
                urlQuery[pair[0]].push(decodeURIComponent(pair[1]));
            }
        }
    };

    this.updateLocation = function() {
      updateQueryString();
      that.showFrame(that.getActiveInterfaceName());
      // update episode selection from URL query
      // e.g., https://data.openease.org/#kb?category=foo?episode=bar
      if(urlQuery['category'] && urlQuery['episode']) {
          that.setEpisode(urlQuery['category'], urlQuery['episode']);
      }
    };

    ///////////////////////////////
    //////////// Frame Overlay
    ///////////////////////////////

    this.createOverlay = function() {
        // Create page iosOverlay
        var page = document.getElementById('page');
        if(page) {
            var pageOverlay = document.createElement("div");
            pageOverlay.setAttribute("id", "page-overlay");
            pageOverlay.className = "ios-overlay ios-overlay-hide div-overlay";
            pageOverlay.innerHTML += '<span class="title">Please select an Episode</span>';
            pageOverlay.style.display = 'none';
            page.appendChild(pageOverlay);
            var spinner = createSpinner();
            pageOverlay.appendChild(spinner.el);
        }
    };

    this.showPageOverlay = function(text) {
      var pageOverlay = document.getElementById('page-overlay');
      if(pageOverlay && !that.pageOverlayDisabled) {
          pageOverlay.children[0].innerHTML = text;
          pageOverlay.style.display = 'block';
          pageOverlay.className = pageOverlay.className.replace("hide","show");
          pageOverlay.style.pointerEvents = "auto";
          that.pageOverlayDisabled = true;
      }
    };

    this.hidePageOverlay = function() {
      var pageOverlay = document.getElementById('page-overlay');
      if(pageOverlay && that.pageOverlayDisabled) {
          //pageOverlay.style.display = 'none';
          pageOverlay.className = pageOverlay.className.replace("show","hide");
          pageOverlay.style.pointerEvents = "none";
          that.pageOverlayDisabled = false;
      }
    };

    ///////////////////////////////
    //////////// Frames
    ///////////////////////////////

    this.showFrame = function (iface_name) {
        var frame_name = that.getInterfaceFrameName(iface_name);
        // Hide inactive frames
        for(var i in that.user_interfaces) {
            if(that.user_interfaces[i].id == frame_name) continue;
            $("#"+that.user_interfaces[i].id+"-frame").hide();
            $("#"+that.user_interfaces[i].id+"-frame").removeClass("selected-frame");
            $("#"+that.user_interfaces[i].id+"-menu").removeClass("selected-menu");
        }

        var new_src = that.getInterfaceSrc(iface_name);
        var frame = document.getElementById(frame_name+"-frame");
        var old_src = frame.src;
        if(!old_src.endsWith(new_src)) {
            frame.src = new_src;
            if(frame.contentWindow && frame.contentWindow.on_register_nodes)
                frame.contentWindow.on_register_nodes();
        }

        // Show selected frame
        $("#"+frame_name+"-frame").show();
        $("#"+frame_name+"-frame").addClass("selected-frame");
        $("#"+frame_name+"-menu").addClass("selected-menu");
        // Load menu items of active frame
        that.menu.updateFrameMenu(document.getElementById(frame_name+"-frame").contentWindow);
    };

    this.getActiveFrame = function() {
        var frame = document.getElementById(that.getActiveFrameName()+"-frame");
        if(frame) return frame.contentWindow;
        else return window;
        //else return undefined;
    };

    this.getInterfaceFrameName = function(iface) {
        for(var i in that.user_interfaces) {
            var elem = that.user_interfaces[i];
            if(elem.id == iface) return elem.id;
            for(var j in elem.interfaces) {
                if(elem.interfaces[j].id == iface) return elem.id;
            }
        }
    };

    this.getInterfaceSrc = function (iface) {
        for(var i in that.user_interfaces) {
            var elem = that.user_interfaces[i];
            if(elem.id == iface) return elem.src;
            for(var j in elem.interfaces) {
                if(elem.interfaces[j].id == iface) return elem.interfaces[j].src;
            }
        }
    };

    this.getActiveFrameName = function () {
      return that.getInterfaceFrameName(that.getActiveInterfaceName());
    };

    this.getActiveInterfaceName = function () {
      for(var i in that.user_interfaces_flat) {
        if(urlQuery[that.user_interfaces_flat[i].id]) return that.user_interfaces_flat[i].id;
      }
      return "kb";
    };

    this.on_register_nodes_all = function() {
        for(var i in that.user_interfaces) {
          var frame = document.getElementById(that.user_interfaces[i].id+"-frame");
          if(frame && frame.contentWindow && frame.contentWindow.on_register_nodes)
              frame.contentWindow.on_register_nodes();
      }
    }

    this.on_episode_selected_all = function(library) {
        for (var i in that.user_interfaces) {
            var frame = document.getElementById(that.user_interfaces[i].id + "-frame");
            if (frame && frame.contentWindow.on_episode_selected)
                frame.contentWindow.on_episode_selected(library);
        }
    }
}
