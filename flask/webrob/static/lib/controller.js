function OpenEASEController() {

    var that = this;

    this.kbController = undefined;

    this.setClientOptions = function (options) {
        that.clientOptions = options;
    };

    this.setPageControls = function (frameControl, menu) {
        that.frameControl = frameControl;
        that.menu = menu;
    };

    this.setKonwrobController = function (kbController) {
        that.kbController = kbController;
    }

    this.getOptions = function () {
        return that.clientOptions;
    };

    this.getMenu = function () {
        return that.menu;
    };

    this.getFrameControl = function () {
        return that.frameControl;
    }

    this.setEpisode = function(category, episode) {
        if(that.kbController !== undefined) {
            that.kbController.setEpisode(category, episode);
        }
    };
}