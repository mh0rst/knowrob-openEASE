/**
 * Controls OpenEASE webclient frame modules
 */
function FrameControl(options){

    var that = this;

    // The openEASE menu that allows to activate episodes/ui/..
    this.menu = options.menu;

    // User interface names (e.g., editor, memory replay, ...)
    var user_interfaces = options.user_interfaces || [];
    var user_interfaces_flat = options.user_interfaces_flat || [];

    // Query parameters encoded in URL
    // E.g., localhost/#foo&bar=1 yields in:
    //    URL_QUERY = {foo: undefined, bar: 1}
    var urlQuery = {};

    this.pageOverlayDisabled = false;

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
      showFrame(getActiveInterfaceName());
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

    function showFrame(iface_name) {
        var frame_name = getInterfaceFrameName(iface_name);
        // Hide inactive frames
        for(var i in user_interfaces) {
            if(user_interfaces[i].id == frame_name) continue;
            $("#"+user_interfaces[i].id+"-frame").hide();
            $("#"+user_interfaces[i].id+"-frame").removeClass("selected-frame");
            $("#"+user_interfaces[i].id+"-menu").removeClass("selected-menu");
        }

        var new_src = getInterfaceSrc(iface_name);
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
        var frame = document.getElementById(getActiveFrameName()+"-frame");
        if(frame) return frame.contentWindow;
        else return window;
        //else return undefined;
    };

    function getInterfaceFrameName(iface) {
        for(var i in user_interfaces) {
            var elem = user_interfaces[i];
            if(elem.id == iface) return elem.id;
            for(var j in elem.interfaces) {
                if(elem.interfaces[j].id == iface) return elem.id;
            }
        }
    };

    function getInterfaceSrc(iface) {
        for(var i in user_interfaces) {
            var elem = user_interfaces[i];
            if(elem.id == iface) return elem.src;
            for(var j in elem.interfaces) {
                if(elem.interfaces[j].id == iface) return elem.interfaces[j].src;
            }
        }
    };

    function getActiveFrameName() {
      return getInterfaceFrameName(getActiveInterfaceName());
    };

    function getActiveInterfaceName() {
      for(var i in user_interfaces_flat) {
        if(urlQuery[user_interfaces_flat[i].id]) return user_interfaces_flat[i].id;
      }
      return "kb";
    };

    this.on_register_nodes_all = function() {
        for(var i in user_interfaces) {
          var frame = document.getElementById(user_interfaces[i].id+"-frame");
          if(frame && frame.contentWindow && frame.contentWindow.on_register_nodes)
              frame.contentWindow.on_register_nodes();
      }
    }

    this.on_episode_selected_all = function(library) {
        for (var i in user_interfaces) {
            var frame = document.getElementById(user_interfaces[i].id + "-frame");
            if (frame && frame.contentWindow.on_episode_selected)
                frame.contentWindow.on_episode_selected(library);
        }
    }
}
